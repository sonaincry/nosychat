import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import type { UserAuth } from '../types/chat';
import { MessageSquare, LogOut, User, UserCheck, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HubConnection } from '@microsoft/signalr';
import CreateGroupModal from './CreateGroupModal';
import Avatar from './Avatar';
import { useRef } from 'react';

interface Friend {
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
}

interface PendingRequest {
    friendshipId: string;
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
}

interface Props {
    user: UserAuth;
    onSelectGroup: (groupId: string) => void;
    hubConnection: HubConnection | null;
    onLogout: () => void;
    activeGroupId: string | null;
}

interface GroupItem {
    id: string;
    name: string;
    isGroup: boolean;
    lastMessageContent: string | null;
    lastMessageType: string | null;
    lastMessageAt: string | null;
    lastMessageSenderId: string | null;
    unreadCount: number;
}

export default function Sidebar({ user, hubConnection, onSelectGroup, onLogout, activeGroupId }: Props) {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const navigate = useNavigate();
    const [groups, setGroups] = useState<GroupItem[]>([]);
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const visibleGroups = groups.filter((g) => g.isGroup || g.lastMessageAt !== null);
    const fetchUserGroups = async () => {
        try {
            const res = await axiosClient.get('/Chat/my-groups');
            setGroups(res.data);
        } catch (err) {
            console.error('Lỗi tải danh sách nhóm', err);
        }
    };

    const fetchFriends = async () => {
        try {
            const res = await axiosClient.get('/Friend/list');
            setFriends(res.data);
        } catch (err) {
            console.error('Lỗi tải danh sách bạn bè', err);
        }
    };

    const fetchPendingRequests = async () => {
        try {
            const res = await axiosClient.get('/Friend/pending-requests');
            setPendingRequests(res.data);
        } catch (err) {
            console.error('Lỗi tải danh sách lời mời kết bạn', err);
        }
    };

    const activeGroupIdRef = useRef(activeGroupId);
    useEffect(() => {
        activeGroupIdRef.current = activeGroupId;
    }, [activeGroupId]);

    useEffect(() => {
        fetchFriends();
        fetchPendingRequests();
        fetchUserGroups();

        if (hubConnection) {
            hubConnection.on("UserStatusChanged", (userId: string, isOnline: boolean) => {
                setOnlineUserIds((prev) => {
                    const next = new Set(prev);
                    isOnline ? next.add(userId) : next.delete(userId);
                    return next;
                });
            });

            hubConnection.on("ReceiveFriendRequest", () => {
                fetchPendingRequests();
            });

            hubConnection.on("FriendRequestAccepted", () => {
                fetchFriends();
                fetchPendingRequests();
            });

            hubConnection.on("GroupListUpdated", () => {
                fetchUserGroups();
            });

            hubConnection.on("ReceiveMessage", (msg: any) => {
    setGroups((prev) => {
        const exists = prev.some((g) => g.id === msg.groupId);

        if (!exists) {
            // Brand new chat we don't have locally yet — refetch full list to pick it up
            fetchUserGroups();
            return prev; 
        }

        return prev.map((g) => {
            if (g.id !== msg.groupId) return g;
            const isOpenNow = activeGroupIdRef.current === msg.groupId;
            const isMine = msg.senderId === user.userId;
            return {
                ...g,
                lastMessageContent: msg.content,
                lastMessageType: msg.messageType,
                lastMessageAt: msg.createdAt,
                lastMessageSenderId: msg.senderId,
                unreadCount: (!isMine && !isOpenNow) ? g.unreadCount + 1 : g.unreadCount,
            };
        });
    });
});
        }

        return () => {
            if (hubConnection) {
                hubConnection.off("UserStatusChanged");
                hubConnection.off("ReceiveFriendRequest");
                hubConnection.off("FriendRequestAccepted");
                hubConnection.off("GroupListUpdated");
                hubConnection.off("ReceiveMessage");
            }
        };
    }, [hubConnection, user.userId]);

    const handleOpenGroup = async (groupId: string) => {
        setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)));
        try {
            await axiosClient.post(`/Chat/mark-read/${groupId}`);
        } catch (err) {
            console.error('Lỗi đánh dấu đã đọc', err);
        }
        onSelectGroup(groupId);
    };

    const handleAccept = async (friendshipId: string) => {
        try {
            await axiosClient.post(`/Friend/accept/${friendshipId}`);
            alert('Đã chấp nhận lời mời kết bạn!');
            fetchFriends();
            fetchPendingRequests();
        } catch (err) {
            alert('Chấp nhận lời mời thất bại!');
        }
    };

    const handleSelectFriend = async (targetUserId: string) => {
        try {
            const res = await axiosClient.post('/Chat/private', { targetUserId });
            onSelectGroup(res.data);
        } catch (err) {
            alert('Không thể mở phòng chat!');
        }
    };

    return (
        <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
            {/* Header Profile cá nhân */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div
                    onClick={() => navigate(`/profile/${user.userId}`)}
                    className="flex items-center space-x-3 cursor-pointer group"
                    title="Xem trang cá nhân"
                >
                    <Avatar url={user.avatarUrl} name={user.displayName || user.username} size={40} />
                    <div className="truncate max-w-[120px]">
                        <p className="font-bold text-sm text-white truncate group-hover:text-blue-400 transition">
                            {user.displayName || user.username}
                        </p>
                        <p className="text-xs text-slate-400 truncate">@{user.username}</p>
                    </div>
                </div>


                <div className="flex items-center space-x-1">
                    <button
                        onClick={() => navigate(`/profile/${user.userId}`)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        title="Trang cá nhân"
                    >
                        <User size={18} />
                    </button>
                    <button
                        onClick={onLogout}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                        title="Đăng xuất"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Lời mời kết bạn */}
                {pendingRequests.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                            <UserPlus size={14} /> Lời mời kết bạn ({pendingRequests.length})
                        </p>
                        <div className="space-y-2">
                            {pendingRequests.map((req) => (
                                <div
                                    key={req.friendshipId}
                                    className="p-3 bg-slate-800 border border-amber-500/30 rounded-xl flex items-center justify-between"
                                >
                                    <div className="flex items-center space-x-2 truncate mr-2">
                                        <Avatar url={req.avatarUrl} name={req.displayName} size={32} />
                                        <div className="truncate">
                                            <p className="text-sm font-medium text-slate-200 truncate">{req.displayName}</p>
                                            <p className="text-[11px] text-slate-500 truncate">@{req.username}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAccept(req.friendshipId)}
                                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition flex items-center gap-1 text-xs font-medium"
                                        title="Chấp nhận"
                                    >
                                        <UserCheck size={14} /> Đồng ý
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Danh sách Nhóm Chat & Bạn Bè */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Nhóm Chat ({visibleGroups.length})
                        </p>
                        <button
                            onClick={() => setShowCreateGroup(true)}
                            className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1"
                        >
                            <Users size={12} /> + Tạo nhóm
                        </button>
                    </div>

                    <div className="space-y-1 mb-4">
                        {visibleGroups.map((group) => {
                            const isUnread = group.unreadCount > 0;
                            const previewText =
                                group.lastMessageType === 'Image'
                                    ? '📷 Hình ảnh'
                                    : group.lastMessageContent || 'Chưa có tin nhắn';

                            return (
                                <div
                                    key={group.id}
                                    onClick={() => handleOpenGroup(group.id)}
                                    className="p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl cursor-pointer flex items-center justify-between transition border border-transparent hover:border-slate-700"
                                >
                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                        <div className="w-9 h-9 bg-purple-600/30 text-purple-400 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                                            {group.name ? group.name.charAt(0) : 'G'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm truncate ${isUnread ? 'font-bold text-white' : 'font-medium text-slate-200'}`}>
                                                {group.name}
                                            </p>
                                            <p className={`text-xs truncate ${isUnread ? 'font-semibold text-slate-200' : 'text-slate-500'}`}>
                                                {previewText}
                                            </p>
                                        </div>
                                    </div>

                                    {isUnread ? (
                                        <span className="ml-2 bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 flex-shrink-0">
                                            {group.unreadCount > 9 ? '9+' : group.unreadCount}
                                        </span>
                                    ) : (
                                        <MessageSquare size={16} className="text-slate-500 flex-shrink-0" />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Bạn bè ({friends.length})
                        </p>
                    </div>

                    {friends.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                            Chưa có bạn bè. Gửi link trang cá nhân để kết bạn!
                        </p>
                    ) : (
                        friends.map((friend) => (
                            <div
                                key={friend.userId}
                                onClick={() => handleSelectFriend(friend.userId)}
                                className="p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl cursor-pointer flex items-center justify-between transition border border-transparent hover:border-slate-700 mb-2"
                            >
                                <div className="flex items-center space-x-3 min-w-0">
                                    <div className="relative flex-shrink-0">
                                        <Avatar url={friend.avatarUrl} name={friend.displayName} size={36} />
                                        {onlineUserIds.has(friend.userId) && (
                                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-900 rounded-full" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-200 truncate">{friend.displayName}</p>
                                        <p className="text-[11px] text-slate-500 truncate">@{friend.username}</p>
                                    </div>
                                </div>
                                <MessageSquare size={16} className="text-slate-500 flex-shrink-0" />
                            </div>
                        ))
                    )}
                </div>
            </div>


            {/* Footer */}
            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={onLogout}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-red-600/20 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 font-medium text-sm rounded-xl flex items-center justify-center space-x-2 transition"
                >
                    <LogOut size={16} />
                    <span>Đăng xuất</span>
                </button>
            </div>

            {showCreateGroup && (
                <CreateGroupModal
                    friends={friends}
                    onClose={() => setShowCreateGroup(false)}
                    onGroupCreated={(groupId) => {
                        fetchUserGroups();
                        onSelectGroup(groupId);
                    }}
                />
            )}
        </div>
    );
}