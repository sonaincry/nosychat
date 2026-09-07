import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import type { UserAuth } from '../types/chat';

interface Props {
  onLoginSuccess: (user: UserAuth) => void;
}

export default function AuthForm({ onLoginSuccess }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await axiosClient.post('/Auth/register', { username, password, displayName });
        alert('Đăng ký thành công! Bạn có thể đăng nhập ngay.');
        setIsRegister(false);
      } else {
        const res = await axiosClient.post('/Auth/login', { username, password });
        const authData: UserAuth = res.data;
        localStorage.setItem('token', authData.token);
        localStorage.setItem('user', JSON.stringify(authData));
        onLoginSuccess(authData);
      }
    } catch (err: any) {
      alert(err.response?.data || 'Có lỗi xảy ra!');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
      <form onSubmit={handleSubmit} className="w-96 p-8 bg-slate-800 rounded-xl shadow-2xl space-y-4 border border-slate-700">
        <h1 className="text-3xl font-bold text-center text-blue-400">NosyChat 💬</h1>
        {isRegister && (
          <input
            type="text"
            placeholder="Tên hiển thị (DisplayName)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full p-3 bg-slate-700 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-500"
            required
          />
        )}
        <input
          type="text"
          placeholder="Tên đăng nhập (Username)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-3 bg-slate-700 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-500"
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 bg-slate-700 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-500"
          required
        />
        <button type="submit" className="w-full p-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-sm transition">
          {isRegister ? 'Đăng ký' : 'Đăng nhập'}
        </button>
        <p
          onClick={() => setIsRegister(!isRegister)}
          className="text-xs text-center text-slate-400 cursor-pointer hover:underline pt-2"
        >
          {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
        </p>
      </form>
    </div>
  );
}