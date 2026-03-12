import { io } from 'socket.io-client';

export function createSocket(token) {
  return io('http://localhost:3001', {
    auth: { token },
    reconnectionAttempts: 5,
  });
}
