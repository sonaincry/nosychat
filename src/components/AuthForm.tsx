import React, { useState } from 'react';
import axios from 'axios';
import { BookOpen, Eye, EyeOff, MessageCircle, Sparkles } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
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
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && typeof err.response?.data === 'string') {
        setError(err.response.data);
      } else if (axios.isAxiosError(err) && !err.response) {
        setError('Không kết nối được máy chủ. Vui lòng kiểm tra Backend rồi thử lại.');
      } else {
        setError('Chưa thể hoàn tất. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ffa571] p-4 text-[#39372f] sm:p-8">
      <main className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden border border-[#e6dccb] bg-[#f3f0e5] shadow-[0_24px_70px_rgba(89,53,34,0.16)] sm:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#eee9dc] p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3 text-xl font-bold">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7dcd4] text-[#bd5360]"><MessageCircle size={22} /></span>
            Nosy
          </div>
          <div className="relative z-10 max-w-md">
            <p className="mb-5 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-[#a1694f]"><Sparkles size={14} /> KHÔNG GIAN CỦA BẠN</p>
            <h1 className="font-serif text-5xl leading-[1.15] tracking-[-0.04em] text-[#38352e]">Trò chuyện gần hơn.<br />Đọc sách sâu hơn.</h1>
            <p className="mt-6 text-sm leading-7 text-[#827766]">Một nơi nhẹ nhàng để giữ liên lạc với bạn bè và tiếp tục những trang sách đang đọc dở.</p>
          </div>
          <div className="relative z-10 flex items-center gap-3 text-xs text-[#8d806f]"><BookOpen size={18} /> Thư viện chung cho mọi thành viên</div>
          <div className="absolute -bottom-20 -right-14 h-72 w-56 rotate-12 rounded-[28px] bg-[#edb9a8] opacity-70" />
          <div className="absolute bottom-16 right-32 h-64 w-44 -rotate-6 rounded-[24px] border border-[#c9c9a5] bg-[#dfe1c9] opacity-90" />
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-12">
          <form onSubmit={handleSubmit} className="w-full max-w-sm">
            <div className="mb-9 lg:hidden">
              <div className="flex items-center gap-3 text-xl font-bold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7dcd4] text-[#bd5360]"><MessageCircle size={22} /></span>Nosy</div>
            </div>
            <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-[#a1694f]">{isRegister ? 'BẮT ĐẦU CÂU CHUYỆN' : 'CHÀO MỪNG TRỞ LẠI'}</p>
            <h2 className="text-3xl font-semibold tracking-[-0.03em]">{isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</h2>
            <p className="mb-8 mt-3 text-sm leading-6 text-[#817767]">{isRegister ? 'Tạo một góc nhỏ cho những cuộc trò chuyện và trang sách của bạn.' : 'Tiếp tục cuộc trò chuyện và cuốn sách bạn đang đọc.'}</p>

            <div className="space-y-5">
              {isRegister && <label className="block text-xs font-semibold text-[#665e52]">Tên hiển thị
                <input type="text" placeholder="Bạn muốn được gọi là gì?" value={displayName} onChange={e => setDisplayName(e.target.value)} className="mt-2 w-full rounded-xl border border-[#ded6c8] bg-[#fffdf8] px-4 py-3.5 text-sm outline-none transition focus:border-[#d87b80] focus:ring-2 focus:ring-[#efc5c0]" required />
              </label>}
              <label className="block text-xs font-semibold text-[#665e52]">Tên đăng nhập
                <input type="text" autoComplete="username" placeholder="Nhập tên đăng nhập" value={username} onChange={e => setUsername(e.target.value)} className="mt-2 w-full rounded-xl border border-[#ded6c8] bg-[#fffdf8] px-4 py-3.5 text-sm outline-none transition focus:border-[#d87b80] focus:ring-2 focus:ring-[#efc5c0]" required />
              </label>
              <label className="block text-xs font-semibold text-[#665e52]">Mật khẩu
                <span className="relative mt-2 block">
                  <input type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="Nhập mật khẩu" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-[#ded6c8] bg-[#fffdf8] px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#d87b80] focus:ring-2 focus:ring-[#efc5c0]" required />
                  <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[#918675] hover:text-[#b84956]" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </span>
              </label>
            </div>

            {error && <p className="mt-5 rounded-xl bg-[#fbe2dd] px-4 py-3 text-xs leading-5 text-[#9f3947]" role="alert">{error}</p>}
            <button type="submit" disabled={submitting} className="mt-7 w-full rounded-xl bg-[#e86772] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#d45663] disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Đang xử lý…' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
            <p className="mt-6 text-center text-xs text-[#817767]">
              {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
              <button type="button" onClick={() => { setIsRegister(value => !value); setError(''); }} className="font-semibold text-[#b84956] hover:underline">{isRegister ? 'Đăng nhập' : 'Đăng ký ngay'}</button>
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
