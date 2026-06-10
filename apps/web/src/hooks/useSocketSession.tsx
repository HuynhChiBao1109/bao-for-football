import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { API_BASE_URL } from '../lib/apiClient';

const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL || API_BASE_URL;
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket.io';

type SocketSessionContextValue = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketSessionContext = createContext<SocketSessionContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const socketSession = io(SOCKET_BASE_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: { token },
    });

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleConnectError = () => setIsConnected(false);

    socketSession.on('connect', handleConnect);
    socketSession.on('disconnect', handleDisconnect);
    socketSession.on('connect_error', handleConnectError);

    socketRef.current = socketSession;
    setSocket(socketSession);

    return () => {
      socketSession.off('connect', handleConnect);
      socketSession.off('disconnect', handleDisconnect);
      socketSession.off('connect_error', handleConnectError);
      socketSession.disconnect();
      if (socketRef.current === socketSession) {
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [token]);

  const value = useMemo(
    () => ({
      socket,
      isConnected,
    }),
    [isConnected, socket],
  );

  return <SocketSessionContext.Provider value={value}>{children}</SocketSessionContext.Provider>;
}

export function useSocketSession() {
  const context = useContext(SocketSessionContext);
  if (!context) {
    throw new Error('useSocketSession must be used inside SocketProvider');
  }
  return context;
}
