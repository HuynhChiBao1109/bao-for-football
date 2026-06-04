import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { API_BASE_URL } from '../lib/apiClient';

const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL || API_BASE_URL;
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket.io';

export function useSocketSession() {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(SOCKET_BASE_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect_error', () => {
      socket.disconnect();
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [token]);
}