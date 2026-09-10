import api, { API_BASE_URL } from './axiosClient';
import type { NarratorVoice, SynthesizeNarrationRequest } from '../types/narration';

function bearerToken() {
  const savedUser = localStorage.getItem('user');
  if (!savedUser) return '';
  try {
    return JSON.parse(savedUser).token ?? '';
  } catch {
    return '';
  }
}

export const narrationApi = {
  voices: async (signal?: AbortSignal) =>
    (await api.get<NarratorVoice[]>('/narration/vieneu/voices', { signal })).data,

  stream: async (request: SynthesizeNarrationRequest, signal: AbortSignal) => {
    const token = bearerToken();
    const response = await fetch(`${API_BASE_URL}/api/narration/vieneu/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      let message = 'VieNeu không thể tạo âm thanh.';
      try {
        const problem = await response.json();
        if (typeof problem?.detail === 'string') message = problem.detail;
      } catch {
        // Keep the readable default when the service did not return JSON.
      }
      throw new Error(message);
    }
    if (!response.body) throw new Error('Trình duyệt không nhận được audio stream từ VieNeu.');
    return response.body;
  },
};
