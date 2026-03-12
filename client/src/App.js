import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';
import { createSocket } from './socket';

export default function App() {
  const [auth, setAuth] = useState(null);
  const [socket, setSocket] = useState(null);
  const [activeChat, setActiveChat] = useState(null); // null = general
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('chat_token');
    const username = localStorage.getItem('chat_username');
    if (token && username) setAuth({ token, username });
  }, []);

  // Create/destroy socket on auth change
  useEffect(() => {
    if (!auth) {
      setSocket(prev => { prev?.disconnect(); return null; });
      setOnlineUsers([]);
      return;
    }
    const s = createSocket(auth.token);
    s.on('online_users', (users) => setOnlineUsers(users));
    setSocket(s);
    return () => {
      s.off('online_users', setOnlineUsers);
      s.disconnect();
    };
  }, [auth]);

  function handleAuth({ token, username }) {
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_username', username);
    setAuth({ token, username });
  }

  function handleLogout() {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_username');
    setAuth(null);
    setActiveChat(null);
  }

  if (!auth) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', minHeight: '100vh', background: '#0d0a17',
      }}>
        <Auth onAuth={handleAuth} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0d0a17' }}>
      <Sidebar
        token={auth.token}
        username={auth.username}
        onlineUsers={onlineUsers}
        activeChat={activeChat}
        onSelectChat={setActiveChat}
        onLogout={handleLogout}
      />
      <Chat
        token={auth.token}
        username={auth.username}
        activeChat={activeChat}
        onlineUsers={onlineUsers}
        socket={socket}
      />
    </div>
  );
}
