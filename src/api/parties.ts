import axios from 'axios';
import axiosClient from './axiosClient';
import type { Game, Party, PartyFilters, PartyNotification, PlayerGame, SwipeProfile, SwipeResult } from '../types/party';

export const partiesApi = {
  games: () => axiosClient.get<Game[]>('/Party/games').then(response => response.data),
  createGame: (name: string, partySizes: number[], modes: string[]) =>
    axiosClient.post<Game>('/Party/games', { name, partySizes, modes }).then(response => response.data),
  updateGame: (gameId: string, name: string, partySizes: number[], modes: string[]) =>
    axiosClient.put<Game>(`/Party/games/${gameId}`, { name, partySizes, modes }).then(response => response.data),
  deleteGame: (gameId: string) => axiosClient.delete(`/Party/games/${gameId}`),
  playerGames: () => axiosClient.get<PlayerGame[]>('/Party/profile/games').then(response => response.data),
  savePlayerGame: (data: Omit<PlayerGame, 'gameName' | 'modes'> & { modeIds: string[] }) =>
    axiosClient.put<PlayerGame>('/Party/profile/games', data).then(response => response.data),
  browse: (filters: PartyFilters) =>
    axiosClient.get<Party[]>('/Party', { params: filters }).then(response => response.data),
  details: (partyId: string) => axiosClient.get<Party>(`/Party/${partyId}`).then(response => response.data),
  create: (data: {
    gameId: string; desiredSize: number; rank?: string; preferredRole?: string;
    serverRegion: string; language: string; voiceChatRequired: boolean; notes?: string;
  }) => axiosClient.post<Party>('/Party', data).then(response => response.data),
  requestJoin: (partyId: string) => axiosClient.post(`/Party/${partyId}/join-requests`),
  accept: (requestId: string) => axiosClient.post(`/Party/join-requests/${requestId}/accept`),
  reject: (requestId: string) => axiosClient.post(`/Party/join-requests/${requestId}/reject`),
  leave: (partyId: string) => axiosClient.post(`/Party/${partyId}/leave`),
  removeMember: (partyId: string, memberId: string) => axiosClient.delete(`/Party/${partyId}/members/${memberId}`),
  startPlaying: (partyId: string) => axiosClient.post(`/Party/${partyId}/playing`),
  close: (partyId: string) => axiosClient.post(`/Party/${partyId}/close`),
  notifications: () => axiosClient.get<PartyNotification[]>('/Party/notifications').then(response => response.data),
  readNotification: (notificationId: string) => axiosClient.put(`/Party/notifications/${notificationId}/read`),
  swipeCandidates: (gameId: string, targetPlayerCount: number) =>
    axiosClient.get<SwipeProfile[]>('/Party/swipe-candidates', { params: { gameId, targetPlayerCount } })
      .then(response => response.data),
  swipe: (targetUserId: string, gameId: string, targetPlayerCount: number, liked: boolean) =>
    axiosClient.post<SwipeResult>('/Party/swipes', { targetUserId, gameId, targetPlayerCount, liked })
      .then(response => response.data),
  uploadProfilePhoto: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post<{ url: string }>('/Chat/upload-image', formData)
      .then(response => response.data.url);
  },
};

export function partyError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (typeof error.response?.data === 'string') return error.response.data;
    if (error.response?.data?.detail) return error.response.data.detail;
    if (error.response?.data?.title) return error.response.data.title;
  }
  return 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}
