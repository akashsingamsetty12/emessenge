import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initSocket = (userId: string) => {
  if (socket) return socket;

  // In production, this would be the deployed URL
  const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
  
  socket = io(url, {
    query: { userId },
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
