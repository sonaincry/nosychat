import axios from 'axios';
import api from './axiosClient';

export interface ProfileData {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isSelf: boolean;
  friendStatus: 'None' | 'PendingSent' | 'PendingReceived' | 'Accepted';
  friendshipId?: string;
}

export const getProfile = async (userId: string, signal?: AbortSignal) =>
  (await api.get<ProfileData>(`/Friend/profile/${userId}`, { signal })).data;

export function profileError(error: unknown) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 404) return { title: 'Không tìm thấy tài khoản', message: 'Đường dẫn này không trỏ đến tài khoản hiện có.', loginRequired: false };
  if (status === 401) return { title: 'Phiên đăng nhập đã hết hạn', message: 'Đăng nhập lại để xem trang cá nhân.', loginRequired: true };
  if (axios.isAxiosError(error) && !error.response) return { title: 'Không kết nối được máy chủ', message: 'Máy chủ có thể đang khởi động lại. Vui lòng thử lại sau ít giây.', loginRequired: false };
  return { title: 'Chưa tải được trang cá nhân', message: 'Máy chủ đang gặp lỗi. Bạn có thể thử lại, không cần tạo tài khoản mới.', loginRequired: false };
}
