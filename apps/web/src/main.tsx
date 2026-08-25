import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import { AuthProvider } from './context/AuthContext';
import { OrgProvider } from './context/OrgContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { App } from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <OrgProvider>
            <WebSocketProvider>
              <ConfigProvider
                theme={{
                  algorithm: theme.defaultAlgorithm,
                  token: {
                    colorPrimary: '#1677ff',
                    borderRadius: 8,
                    colorBgBase: '#f8fafc',
                    colorBgContainer: '#ffffff',
                    colorBgElevated: '#ffffff',
                    colorText: '#0f172a',
                    colorTextSecondary: '#64748b',
                    colorBorder: '#e2e8f0',
                    colorBorderSecondary: '#f1f5f9'
                  }
                }}
              >
                <App />
              </ConfigProvider>
            </WebSocketProvider>
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
