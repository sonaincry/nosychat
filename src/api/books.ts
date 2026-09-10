import axios from 'axios';
import api, { API_BASE_URL } from './axiosClient';
import type { Book, BookList, ReadingPosition, DocumentStructure, DocumentPage, ResumeSegment } from '../types/book';

export const booksApi = {
  list: async (search: string, page: number, signal?: AbortSignal) =>
    (await api.get<BookList>('/books', { params: { search, page }, signal })).data,
  recent: async (signal?: AbortSignal) => (await api.get<Book[]>('/books/recent', { signal })).data,
  get: async (id: string, signal?: AbortSignal) => (await api.get<Book>(`/books/${id}`, { signal })).data,
  upload: async (form: FormData, onProgress: (percent: number) => void) =>
    (await api.post<Book>('/books', form, {
      onUploadProgress: event => onProgress(event.total ? Math.round(event.loaded / event.total * 100) : 0),
    })).data,
  cover: async (id: string, signal?: AbortSignal) =>
    (await api.get<Blob>(`/books/${id}/cover`, { responseType: 'blob', signal })).data,
  pdf: (id: string, token: string) => ({
    url: `${API_BASE_URL}/api/books/${id}/pdf`,
    httpHeaders: { Authorization: `Bearer ${token}` },
  }),
  saveProgress: async (id: string, position: number | ReadingPosition) => {
    await api.put(`/books/${id}/progress`, typeof position === 'number' ? { currentPage: position } : position);
  },
  getProgress: async (id: string, signal?: AbortSignal) =>
    (await api.get<ReadingPosition>(`/books/${id}/progress`, { signal })).data,
  structure: async (id: string, signal?: AbortSignal) =>
    (await api.get<DocumentStructure>(`/books/${id}/structure`, { signal })).data,
  prepareStructure: async (id: string, signal?: AbortSignal) =>
    (await api.post<DocumentStructure>(`/books/${id}/structure/prepare`, undefined, { signal })).data,
  structuredPage: async (id: string, page: number, signal?: AbortSignal) =>
    (await api.get<DocumentPage>(`/books/${id}/structure/pages/${page}`, { signal })).data,
  resumeSegment: async (id: string, signal?: AbortSignal) =>
    (await api.get<ResumeSegment>(`/books/${id}/resume-segment`, { signal })).data,
};

export function bookError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 409) return 'Tên sách này đã có trong thư viện chung. Hãy tìm sách để đọc hoặc chọn tên khác.';
    if (!error.response) return 'Không kết nối được máy chủ. Kiểm tra BE và địa chỉ API rồi thử lại.';
    if (error.response?.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.response?.status === 404) return 'Không tìm thấy sách hoặc bạn không có quyền truy cập.';
    if (typeof error.response?.data === 'string') return error.response.data;
    const problem = error.response.data;
    if (problem && typeof problem === 'object') {
      const message = typeof problem.detail === 'string' ? problem.detail : problem.title;
      if (typeof message === 'string') {
        return typeof problem.traceId === 'string' ? `${message} (Mã lỗi: ${problem.traceId})` : message;
      }
    }
  }
  return 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}
