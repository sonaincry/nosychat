import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import type { UserAuth } from './types/chat';
import AuthForm from './components/AuthForm';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import Profile from './pages/Profile';
import { API_BASE_URL } from './api/axiosClient';

export default function App() {
  const [user, setUser] = useState<UserAuth | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [hubConnection, setHubConnection] = useState<HubConnection | null>(null);

  // 1. Restore phiên đăng nhập
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.clear();
      }
    }
  }, []);

  // 2. Khởi tạo SignalR HubConnection khi user đã login
  useEffect(() => {
    if (!user?.token) {
      setHubConnection(null);
      return;
    }

    console.log('🔵 Creating NEW SignalR connection, token:', user.token.substring(0, 20));  // 👈 add

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/chatHub`, {
        accessTokenFactory: () => user.token,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connection
      .start()
      .then(() => {
        console.log('🟢 Connection started successfully');  // 👈 add
        setHubConnection(connection);
      })
      .catch((err) => console.error('Lỗi kết nối SignalR:', err));

    return () => {
      console.log('🔴 Cleanup: stopping connection');  // 👈 add
      connection.stop();
    };
}, [user?.token]);

  useEffect(() => {
  if (!hubConnection || !user) return;

  hubConnection.on('AvatarUpdated', (userId: string, avatarUrl: string) => {
    if (userId === user.userId) {
      const updated = { ...user, avatarUrl };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
    }
  });

  return () => {
    hubConnection.off('AvatarUpdated');
  };
}, [hubConnection, user]);

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setActiveGroupId(null);
  };

  if (!user) {
    return <AuthForm onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Route trang nhắn tin chính */}
        <Route
          path="/"
          element={
            <div className="flex h-screen bg-slate-900 text-slate-100">
              <Sidebar
                user={user}
                onLogout={handleLogout}
                hubConnection={hubConnection}
                activeGroupId={activeGroupId} 
                onSelectGroup={(gid) => setActiveGroupId(gid)}
              />
              {activeGroupId ? (
                <ChatArea groupId={activeGroupId} user={user} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                  Chọn một người bạn hoặc phòng chat ở danh sách bên trái để bắt đầu nhắn tin nhé!
                </div>
              )}
            </div>
          }
        />

        {/* Route trang Profile cá nhân/bạn bè */}
        <Route path="/profile/:userId" element={<Profile onLogout={handleLogout} />} />

        {/* Chuyển hướng các route không tồn tại về trang chủ */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}