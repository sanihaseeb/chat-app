# ChatApp

A real-time chat application with private messaging, built with React, Node.js, Socket.IO, and SQLite.

[Dark purple UI with sidebar showing channels and direct messages]

## Features

- **Real-time messaging** — instant delivery via WebSockets
- **Direct messages** — private 1-1 conversations with any user
- **#general channel** — shared room for everyone
- **Live presence** — online/offline indicators update in real-time
- **Typing indicators** — see when someone is typing
- **Persistent history** — messages saved to SQLite, loaded on reconnect
- **Secure auth** — JWT authentication with bcrypt password hashing
- **Dark purple UI** — clean, modern interface

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jsonwebtoken), bcrypt |

## Getting Started

### Prerequisites
- Node.js 16+

### 1. Clone the repo

```bash
git clone https://github.com/sanihaseeb/chat-app.git
cd chat-app
```

### 2. Set up the server

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and set a strong `JWT_SECRET`:

```
JWT_SECRET=your-long-random-secret-here
PORT=3001
```

### 3. Set up the client

```bash
cd ../client
npm install
```

### 4. Run the app

In one terminal:
```bash
cd server && npm run dev
```

In another terminal:
```bash
cd client && npm start
```

Open [http://localhost:3000](http://localhost:3000) — register an account and start chatting.

## Project Structure

```
chat-app/
├── client/                  # React frontend
│   └── src/
│       ├── App.js           # Root component, socket + auth management
│       ├── socket.js        # Socket.IO client factory
│       └── components/
│           ├── Auth.js      # Login / register
│           ├── Sidebar.js   # Channel list, DM list, presence
│           └── Chat.js      # Message feed and input
│
└── server/
    ├── index.js             # Express app, REST API, Socket.IO handlers
    ├── .env                 # Secret config (not committed)
    └── .env.example         # Template for required env vars
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Create account |
| POST | `/api/login` | Sign in, receive JWT |
| GET | `/api/messages` | Load global chat history |
| GET | `/api/users` | List all other users |
| POST | `/api/conversations` | Get or create a DM conversation |
| GET | `/api/conversations` | List your DM conversations |
| GET | `/api/conversations/:id/messages` | Load DM history |

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `message` | client → server | Send a global message |
| `dm_message` | client → server | Send a DM |
| `join_conversation` | client → server | Join a DM room |
| `typing` / `stop_typing` | client → server | Typing indicator |
| `message` | server → client | New global message |
| `dm_message` | server → client | New DM received |
| `online_users` | server → client | Updated presence list |
| `typing` | server → client | Typing status update |
