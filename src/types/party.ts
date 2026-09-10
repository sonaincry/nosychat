export interface Game {
  id: string;
  name: string;
  partySizes: number[];
}

export interface PlayerGame {
  gameId: string;
  gameName: string;
  rank: string | null;
  preferredRole: string | null;
  serverRegion: string;
  language: string;
  voiceChatAvailable: boolean;
  bio: string | null;
  photoUrls: string[];
  preferredPlayTime: string | null;
}

export interface PartyMember {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
  isLeader: boolean;
  joinedAt: string;
}

export interface JoinRequest {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  rank: string | null;
  preferredRole: string | null;
  serverRegion: string;
  language: string;
  voiceChatAvailable: boolean;
  createdAt: string;
}

export interface Party {
  id: string;
  gameId: string;
  gameName: string;
  leaderId: string;
  leaderName: string;
  leaderAvatarUrl: string | null;
  groupId: string | null;
  desiredSize: number;
  currentSize: number;
  state: 'Searching' | 'Ready' | 'Playing' | 'Finished';
  rank: string | null;
  preferredRole: string | null;
  serverRegion: string;
  language: string;
  voiceChatRequired: boolean;
  notes: string | null;
  createdAt: string;
  isMember: boolean;
  hasPendingRequest: boolean;
  members: PartyMember[];
  pendingRequests: JoinRequest[];
}

export interface SwipeProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  photoUrls: string[];
  rank: string | null;
  preferredRole: string | null;
  serverRegion: string;
  language: string;
  voiceChatAvailable: boolean;
  preferredPlayTime: string | null;
}

export interface SwipeResult {
  isMutualMatch: boolean;
  party: Party | null;
}

export interface PartyNotification {
  id: string;
  partyId: string | null;
  actorUserId: string | null;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface PartyFilters {
  gameId?: string;
  rank?: string;
  server?: string;
  language?: string;
  voiceChat?: boolean;
  role?: string;
  partySize?: number;
}
