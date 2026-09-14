export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
  createdAt: string;
}

export interface AdminOverview {
  totalUsers: number;
  users: AdminUser[];
}

export interface BookFolderSyncItem {
  folderName: string;
  status: 'Imported' | 'Updated' | 'Existing' | 'Skipped';
  message: string;
  bookId: string | null;
}

export interface BookFolderSyncResult {
  imported: number;
  updated: number;
  existing: number;
  skipped: number;
  items: BookFolderSyncItem[];
}
