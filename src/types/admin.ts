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
