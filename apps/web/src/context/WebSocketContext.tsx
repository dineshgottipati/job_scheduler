import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({ isConnected: false });

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) {
      setIsConnected(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload.event === 'JOB_UPDATED') {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['queueStats'] });
            queryClient.invalidateQueries({ queryKey: ['overviewStats'] });
          } else if (payload.event === 'QUEUE_STATS_UPDATED') {
            queryClient.invalidateQueries({ queryKey: ['queues'] });
            queryClient.invalidateQueries({ queryKey: ['queueStats'] });
          } else if (payload.event === 'WORKER_HEARTBEAT') {
            queryClient.invalidateQueries({ queryKey: ['workers'] });
          } else if (payload.event === 'DLQ_ENTRY_ADDED') {
            queryClient.invalidateQueries({ queryKey: ['dlq'] });
          }
        } catch (err) {
          // ignore
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (err) {
      setIsConnected(false);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [token, queryClient]);

  return (
    <WebSocketContext.Provider value={{ isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
