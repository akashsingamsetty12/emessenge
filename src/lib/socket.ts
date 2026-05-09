import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initSocket = (userId: string) => {
  if (socket) return socket;

  // 1. Priority: Manually saved IP from Server Settings
  const savedIp = typeof window !== 'undefined' ? localStorage.getItem('server_ip') : null;
  
  // 2. Secondary: Environment variable (useful for production/specific builds)
  const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  
  // 3. Fallback: Current window hostname (preserving laptop-to-laptop)
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  
  let url = '';
  if (savedIp) {
    url = savedIp.startsWith('http') ? savedIp : `http://${savedIp}:3001`;
  } else if (envUrl) {
    url = envUrl;
  } else {
    url = `http://${host}:3001`;
  }
  
  console.log(`[Socket] Connecting to ${url} (User: ${userId})`);
  
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
