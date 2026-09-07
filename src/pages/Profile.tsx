import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { UserPlus, Check, MessageSquare, Clock, Copy, KeyRound, ArrowLeft, LogOut } from 'lucide-react';
import { useRef } from 'react';

interface ProfileData {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isSelf: boolean;
  friendStatus: 'None' | 'PendingSent' | 'PendingReceived' | 'Accepted';
  friendshipId?: string;
}

interface ProfileProps {
  onLogout?: () => void;
}



export default function Profile({ onLogout }: ProfileProps) {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
const [uploading, setUploading] = useState(false);

const handleAvatarClick = () => {
  if (profile?.isSelf) fileInputRef.current?.click();
};

const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 3 * 1024 * 1024) {
    alert('Ảnh quá lớn, vui lòng chọn ảnh dưới 3MB.');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  setUploading(true);
  try {
    await axiosClient.post('/User/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    fetchProfile(); // reload to show new avatar
  } catch (err) {
    alert('Đổi ảnh đại diện thất bại!');
  } finally {
    setUploading(false);
  }
};

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get(`/Friend/profile/${userId}`);
      setProfile(res.data);
    } catch (err) {
      console.error('Lỗi lấy thông tin Profile:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/';
    }
  };

  const handleSendRequest = async () => {
    try {
      await axiosClient.post(`/Friend/request/${userId}`);
      fetchProfile();
    } catch (err: any) {
      alert(err.response?.data || 'Có lỗi xảy ra khi gửi lời mời');
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile?.friendshipId) return;
    try {
      await axiosClient.post(`/Friend/accept/${profile.friendshipId}`);
      fetchProfile();
    } catch (err) {
      alert('Không thể chấp nhận lời mời');
    }
  };

  const handleStartChat = async () => {
    try {
      const res = await axiosClient.post('/Chat/private', { targetUserId: userId });
      navigate('/', { state: { selectedGroupId: res.data } });
    } catch (err) {
      alert('Lỗi tạo phòng chat');
    }
  };

  const copyProfileLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="p-8 text-white text-center">Đang tải Trang cá nhân...</div>;

  // XỬ LÝ KHI USER KHÔNG TỒN TẠI (VD: Vừa Drop DB)
  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6 shadow-xl">
          <h2 className="text-xl font-bold text-red-400">Tài khoản không tồn tại!</h2>
          <p className="text-slate-400 text-sm">
            Dữ liệu tài khoản này không còn trong hệ thống (hoặc cơ sở dữ liệu đã được làm mới).
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-600 hover:bg-red-500 font-semibold rounded-xl flex items-center justify-center space-x-2 transition"
          >
            <LogOut size={18} />
            <span>Đăng xuất & Tạo tài khoản mới</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative">
      {/* Nút quay lại Chat */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center space-x-2 text-slate-400 hover:text-white transition"
      >
        <ArrowLeft size={20} />
        <span>Quay lại trang chat</span>
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6 shadow-xl">
        <div
  onClick={handleAvatarClick}
  className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center text-3xl font-bold uppercase shadow-lg overflow-hidden relative ${
    profile.isSelf ? 'cursor-pointer group' : ''
  }`}
  title={profile.isSelf ? 'Đổi ảnh đại diện' : undefined}
>
  {profile.avatarUrl ? (
    <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full bg-blue-600 flex items-center justify-center">
      {profile.displayName ? profile.displayName.charAt(0) : 'U'}
    </div>
  )}

  {profile.isSelf && (
    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-medium transition">
      {uploading ? 'Đang tải...' : 'Đổi ảnh'}
    </div>
  )}
</div>

{profile.isSelf && (
  <input
    type="file"
    accept="image/png, image/jpeg, image/webp"
    ref={fileInputRef}
    onChange={handleAvatarChange}
    className="hidden"
  />
)}

        <div>
          <h2 className="text-2xl font-bold">{profile.displayName}</h2>
          <p className="text-slate-400 text-sm">@{profile.username}</p>
        </div>

        <button
          onClick={copyProfileLink}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center justify-center space-x-2 text-xs transition"
        >
          <Copy size={14} />
          <span>{copied ? 'Đã chép link Trang cá nhân!' : 'Sao chép link Trang cá nhân'}</span>
        </button>

        <div className="pt-4 border-t border-slate-800">
          {/* TRƯỜNG HỢP 1: LÀ CHÍNH BẢN THÂN MÌNH */}
          {profile.isSelf ? (
            <div className="space-y-3">
              <button
                onClick={() => alert('Tính năng Thay đổi mật khẩu đéo có, đợi đi')}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center space-x-2 transition border border-slate-700"
              >
                <KeyRound size={18} />
                <span>Thay đổi mật khẩu</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full py-3 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-semibold rounded-xl flex items-center justify-center space-x-2 transition border border-red-500/30"
              >
                <LogOut size={18} />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            /* TRƯỜNG HỢP 2: LÀ NGƯỜI KHÁC */
            <>
              {profile.friendStatus === 'None' && (
                <button
                  onClick={handleSendRequest}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl flex items-center justify-center space-x-2 transition"
                >
                  <UserPlus size={18} />
                  <span>Kết bạn</span>
                </button>
              )}

              {profile.friendStatus === 'PendingSent' && (
                <button disabled className="w-full py-3 bg-slate-800 text-slate-400 font-semibold rounded-xl flex items-center justify-center space-x-2">
                  <Clock size={18} />
                  <span>Đã gửi lời mời</span>
                </button>
              )}

              {profile.friendStatus === 'PendingReceived' && (
                <button
                  onClick={handleAcceptRequest}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 font-semibold rounded-xl flex items-center justify-center space-x-2 transition"
                >
                  <Check size={18} />
                  <span>Chấp nhận lời mời kết bạn</span>
                </button>
              )}

              {profile.friendStatus === 'Accepted' && (
                <button
                  onClick={handleStartChat}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl flex items-center justify-center space-x-2 transition"
                >
                  <MessageSquare size={18} />
                  <span>Nhắn tin ngay</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}