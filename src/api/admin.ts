import api from './axiosClient';
import type { AdminOverview, BookFolderSyncResult } from '../types/admin';

export const adminApi = {
  overview: async (signal?: AbortSignal) =>
    (await api.get<AdminOverview>('/admin/overview', { signal })).data,
  syncBooks: async () =>
    (await api.post<BookFolderSyncResult>('/admin/books/sync')).data,
};
