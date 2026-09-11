import api from './axiosClient';
import type { AdminOverview } from '../types/admin';

export const adminApi = {
  overview: async (signal?: AbortSignal) =>
    (await api.get<AdminOverview>('/admin/overview', { signal })).data,
};
