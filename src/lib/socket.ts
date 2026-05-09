import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initSocket = (userId: string) => {
  if (socket) return socket;

  // 1. Check if user manually set an IP
  const savedIp = typeof window !== 'undefined' ? localStorage.getItem('server_ip') : null;
  
  // 2. Otherwise auto-resolve based on current URL
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  
  const finalHost = savedIp || host;
  const url = `http://${finalHost}:3001`;
  
  console.log(`[Socket] Connecting to ${url}...`);
  
  socket = io(url, {
    query: { userId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity
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
