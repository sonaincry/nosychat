export interface UserAuth {
  token: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  displayName: string;
}

export interface Message {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string | null;
  messageType: string;
  mediaUrl: string | null;
  isDeleted: boolean;
  createdAt: string;
  readByUserIds: string[];
  reactions?: Reaction[];
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export type SharedMediaType = 'Media' | 'Files' | 'Links';

export interface SharedMediaItem {
  messageId: string;
  kind: SharedMediaType;
  url: string;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  context: string | null;
  createdAt: string;
}

export interface SharedMediaPage {
  items: SharedMediaItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}
