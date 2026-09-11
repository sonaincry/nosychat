import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import type { UserAuth } from './types/chat';
import AuthForm from './components/AuthForm';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import Profile from './pages/Profile';
import { API_BASE_URL } from './api/axiosClient';
import { BookOpen, Gamepad2, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import './styles/chat.css';

const Books = lazy(() => import('./pages/Books'));
const BookReader = lazy(() => import('./pages/BookReader'));
const PartyMatch = lazy(() => import('./pages/PartyMatch'));

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

  const handleAvatarChanged = (avatarUrl: string | null) => {
    setUser(current => {
      if (!current) return current;
      const updatedUser = { ...current, avatarUrl };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
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
      <Suspense fallback={<div className="p-8 text-center">Đang tải…</div>}>
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
              <div className={`chat-shell ${activeGroupId ? 'chat-has-selection' : ''}`}><div className="chat-window">
                <Sidebar
                  user={user!}
                  onLogout={handleLogout}
                  hubConnection={hubConnection}
                  activeGroupId={activeGroupId}
                  onSelectGroup={(gid) => setActiveGroupId(gid)}
                />
                {activeGroupId ? (
                  <ChatArea key={activeGroupId} groupId={activeGroupId} user={user!} onBack={() => setActiveGroupId(null)} />
                ) : (
                  <div className="chat-welcome">
                    <div className="chat-welcome-icon"><MessageCircle size={44} /></div>
                    <p className="chat-eyebrow">MỘT GÓC NHỎ ĐỂ KẾT NỐI</p>
                    <h1>Câu chuyện hay bắt đầu<br />từ một lời chào.</h1>
                    <p>Chọn một người bạn để trò chuyện, chia sẻ một ngày<br />hoặc kể về cuốn sách bạn vừa đọc.</p>
                    <div className="chat-welcome-links"><Link className="chat-library-link" to="/books"><BookOpen size={18} /> Khám phá thư viện</Link><Link className="chat-library-link" to="/parties"><Gamepad2 size={18} /> Tìm đồng đội</Link></div>
                  </div>
                )}
              </div></div>
            </ProtectedRoute>
          }
        />

        {/* Route trang Profile */}
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute user={user}>
              <Profile onLogout={handleLogout} onAvatarChanged={handleAvatarChanged} />
            </ProtectedRoute>
          }
        />

        {/* Catch-all route */}
        <Route path="/books" element={<ProtectedRoute user={user}><Books user={user!} /></ProtectedRoute>} />
        <Route path="/books/:bookId" element={<ProtectedRoute user={user}><BookReader user={user!} /></ProtectedRoute>} />
        <Route path="/parties" element={<ProtectedRoute user={user}><PartyMatch user={user!} hubConnection={hubConnection} /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
