require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] }
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
const PORT = process.env.PORT || 3001;

const db = new Database(path.join(__dirname, 'chat.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id),
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    conversation_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );
`);

// Migration: add conversation_id column if it doesn't exist yet
try {
  db.exec('ALTER TABLE messages ADD COLUMN conversation_id INTEGER DEFAULT NULL');
} catch (_) {}

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.trim().length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username.trim(), hashed);
    const token = jwt.sign({ id: result.lastInsertRowid, username: username.trim() }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: username.trim() });
  } catch (err) {
    if (err.message.includes('UNIQUE')) res.status(409).json({ error: 'Username already taken' });
    else res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

// Global chat messages
app.get('/api/messages', authenticateToken, (req, res) => {
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id IS NULL ORDER BY created_at ASC LIMIT 100').all();
  res.json(messages);
});

// All users except self
app.get('/api/users', authenticateToken, (req, res) => {
  const users = db.prepare('SELECT id, username FROM users WHERE id != ? ORDER BY username ASC').all(req.user.id);
  res.json(users);
});

// Get or create a 1-1 conversation
app.post('/api/conversations', authenticateToken, (req, res) => {
  const otherId = parseInt(req.body.userId);
  if (!otherId) return res.status(400).json({ error: 'userId required' });
  const [u1, u2] = [req.user.id, otherId].sort((a, b) => a - b);
  let conv = db.prepare('SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?').get(u1, u2);
  if (!conv) {
    const result = db.prepare('INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)').run(u1, u2);
    conv = { id: result.lastInsertRowid, user1_id: u1, user2_id: u2 };
  }
  const otherUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(otherId);
  res.json({ ...conv, otherUser });
});

// List user's conversations
app.get('/api/conversations', authenticateToken, (req, res) => {
  const uid = req.user.id;
  const convs = db.prepare(`
    SELECT c.id, c.user1_id, c.user2_id, c.created_at,
      u.username AS other_username, u.id AS other_user_id,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
    FROM conversations c
    JOIN users u ON (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END = u.id)
    WHERE c.user1_id = ? OR c.user2_id = ?
    ORDER BY last_message_at DESC, c.created_at DESC
  `).all(uid, uid, uid);
  res.json(convs);
});

// Messages for a specific conversation
app.get('/api/conversations/:id/messages', authenticateToken, (req, res) => {
  const convId = parseInt(req.params.id);
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)').get(convId, req.user.id, req.user.id);
  if (!conv) return res.status(403).json({ error: 'Not authorized' });
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100').all(convId);
  res.json(messages);
});

// Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = user;
    next();
  });
});

const typingUsers = new Set();
const onlineUsers = new Map(); // username -> socket.id

io.on('connection', (socket) => {
  console.log(`+ ${socket.user.username} connected`);
  onlineUsers.set(socket.user.username, socket.id);
  io.emit('online_users', Array.from(onlineUsers.keys()));

  // Global message
  socket.on('message', (content) => {
    if (!content || typeof content !== 'string' || !content.trim()) return;
    const text = content.trim().slice(0, 1000);
    const result = db.prepare('INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)').run(socket.user.id, socket.user.username, text);
    io.emit('message', {
      id: result.lastInsertRowid,
      user_id: socket.user.id,
      username: socket.user.username,
      content: text,
      conversation_id: null,
      created_at: new Date().toISOString()
    });
  });

  // Join a DM conversation room
  socket.on('join_conversation', (conversationId) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)').get(conversationId, socket.user.id, socket.user.id);
    if (conv) socket.join(`conv:${conversationId}`);
  });

  // DM message
  socket.on('dm_message', ({ conversationId, content }) => {
    if (!content || typeof content !== 'string' || !content.trim()) return;
    const text = content.trim().slice(0, 1000);
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)').get(conversationId, socket.user.id, socket.user.id);
    if (!conv) return;
    const result = db.prepare('INSERT INTO messages (user_id, username, content, conversation_id) VALUES (?, ?, ?, ?)').run(socket.user.id, socket.user.username, text, conversationId);
    io.to(`conv:${conversationId}`).emit('dm_message', {
      id: result.lastInsertRowid,
      user_id: socket.user.id,
      username: socket.user.username,
      content: text,
      conversation_id: conversationId,
      created_at: new Date().toISOString()
    });
  });

  // Typing indicators (global or DM)
  socket.on('typing', ({ conversationId } = {}) => {
    if (conversationId) {
      socket.to(`conv:${conversationId}`).emit('typing', { users: [socket.user.username], conversationId });
    } else {
      typingUsers.add(socket.user.username);
      socket.broadcast.emit('typing', { users: Array.from(typingUsers), conversationId: null });
    }
  });

  socket.on('stop_typing', ({ conversationId } = {}) => {
    if (conversationId) {
      socket.to(`conv:${conversationId}`).emit('typing', { users: [], conversationId });
    } else {
      typingUsers.delete(socket.user.username);
      socket.broadcast.emit('typing', { users: Array.from(typingUsers), conversationId: null });
    }
  });

  socket.on('disconnect', () => {
    typingUsers.delete(socket.user.username);
    onlineUsers.delete(socket.user.username);
    io.emit('online_users', Array.from(onlineUsers.keys()));
    io.emit('typing', { users: Array.from(typingUsers), conversationId: null });
    console.log(`- ${socket.user.username} disconnected`);
  });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
