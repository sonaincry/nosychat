import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import type { UserAuth } from './types/chat';
import AuthForm from './components/AuthForm';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import Profile from './pages/Profile';
import { API_BASE_URL } from './api/axiosClient';

function ProtectedRoute({ user, children }: { user: UserAuth | null; children: React.ReactNode }) {
  const location = useLocation();

  if (!user) {
    localStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<UserAuth | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // 🟢 State chờ restore token
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [hubConnection, setHubConnection] = useState<HubConnection | null>(null);

  // 1. Restore phiên đăng nhập từ localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.clear();
      }
    }
    setAuthLoading(false); // 🟢 Đã hoàn tất kiểm tra localStorage
  }, []);

  // 2. Khởi tạo SignalR HubConnection
  useEffect(() => {
    if (!user?.token) {
      setHubConnection(null);
      return;
    }

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/chatHub`, {
        accessTokenFactory: () => user.token,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connection
      .start()
      .then(() => setHubConnection(connection))
      .catch((err) => console.error('Lỗi kết nối SignalR:', err));

    return () => {
      connection.stop();
    };
  }, [user?.token]);

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setActiveGroupId(null);
  };

  const handleLoginSuccess = (u: UserAuth) => {
    setUser(u);
    const redirectUrl = localStorage.getItem('redirectAfterLogin');
    if (redirectUrl) {
      localStorage.removeItem('redirectAfterLogin');
      window.location.href = redirectUrl; // Redirect đúng link profile
    }
  };

  // 🟢 Tránh render Router khi chưa kiểm tra xong trạng thái đăng nhập
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-400">
        Đang tải...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            user ? <Navigate to="/" replace /> : <AuthForm onLoginSuccess={handleLoginSuccess} />
          }
        />

        {/* Route trang nhắn tin chính */}
        <Route
          path="/"
          element={
            <ProtectedRoute user={user}>
              <div className="flex h-screen bg-slate-900 text-slate-100">
                <Sidebar
                  user={user!}
                  onLogout={handleLogout}
                  hubConnection={hubConnection}
                  activeGroupId={activeGroupId}
                  onSelectGroup={(gid) => setActiveGroupId(gid)}
                />
                {activeGroupId ? (
                  <ChatArea groupId={activeGroupId} user={user!} />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                    Chọn một người bạn hoặc phòng chat ở danh sách bên trái để bắt đầu nhắn tin nhé!
                  </div>
                )}
              </div>
            </ProtectedRoute>
          }
        />

        {/* Route trang Profile */}
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute user={user}>
              <Profile onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}