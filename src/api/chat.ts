import api from './axiosClient';
import type { SharedMediaPage, SharedMediaType } from '../types/chat';

export const chatApi = {
  sharedMedia: async (groupId: string, type: SharedMediaType, page: number, signal?: AbortSignal) =>
    (await api.get<SharedMediaPage>(`/Chat/shared/${groupId}`, {
      params: { type, page, pageSize: 24 }, signal,
    })).data,
};
