import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import type { UserAuth } from '../types/chat';
import { MessageSquare, LogOut, User, UserCheck, Users, BookOpen, Search, Plus, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HubConnection } from '@microsoft/signalr';
import CreateGroupModal from './CreateGroupModal';
import Avatar from './Avatar';
import { useRef } from 'react';
import { getProfile } from '../api/profile';

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
    const [search, setSearch] = useState('');
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState(user.avatarUrl);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const navigate = useNavigate();
    const [groups, setGroups] = useState<GroupItem[]>([]);
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const visibleGroups = groups.filter((g) => g.isGroup || g.lastMessageAt !== null);

    useEffect(() => {
        const controller = new AbortController();
        void getProfile(user.userId, controller.signal)
            .then(profile => setCurrentAvatarUrl(profile.avatarUrl))
            .catch(() => { /* Keep the authenticated-user fallback when refresh fails. */ });
        return () => controller.abort();
    }, [user.userId, user.avatarUrl]);
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
        <aside className="chat-sidebar">
            <div className="chat-sidebar-brand"><span className="chat-brand-icon"><MessageSquare size={22} /></span><strong>Nosy</strong><span className="chat-brand-caption">Góc trò chuyện</span></div>
            <button className="chat-profile" onClick={() => navigate(`/profile/${user.userId}`)}>
                <Avatar url={user.avatarUrl ?? currentAvatarUrl} name={user.displayName || user.username} size={42} />
                <span><strong>{user.displayName || user.username}</strong><small>@{user.username}</small></span>
                <User size={18} />
            </button>
            <nav className="chat-tabs" aria-label="Không gian"><span className="selected"><MessageSquare size={17} /> Chat</span><button onClick={() => navigate('/books')}><BookOpen size={17} /> Sách</button><button onClick={() => navigate('/parties')}><Gamepad2 size={17} /> Party</button></nav>
            <label className="chat-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm bạn bè, nhóm…" aria-label="Tìm bạn bè, nhóm" /></label>
            <div className="chat-sidebar-list">
                {pendingRequests.length > 0 && <section><h2 className="chat-list-heading">Lời mời kết bạn <span>{pendingRequests.length}</span></h2>
                    {pendingRequests.map(req => <div key={req.friendshipId} className="chat-friend-request"><Avatar url={req.avatarUrl} name={req.displayName} size={34} /><span>{req.displayName}</span><button title="Chấp nhận kết bạn" onClick={() => handleAccept(req.friendshipId)}><UserCheck size={18} /></button></div>)}
                </section>}
                <section><div className="chat-list-heading"><h2>Cuộc trò chuyện</h2><button onClick={() => setShowCreateGroup(true)} title="Tạo nhóm"><Plus size={17} /> Tạo nhóm</button></div>
                    {visibleGroups.filter(group => (group.name || 'Cuộc trò chuyện').toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(group => (
                        <button key={group.id} onClick={() => handleOpenGroup(group.id)} className={`chat-contact ${activeGroupId === group.id ? 'is-active' : ''}`} aria-current={activeGroupId === group.id ? 'true' : undefined}>
                            <span className="chat-group-avatar">{group.name?.charAt(0) || <Users size={20} />}</span>
                            <span className="chat-contact-copy"><strong>{group.name || 'Cuộc trò chuyện'}</strong><small>{group.lastMessageType === 'Image' ? 'Ảnh được chia sẻ' : group.lastMessageType === 'Gif' ? 'GIF được chia sẻ' : group.lastMessageType === 'Sticker' ? 'Sticker được gửi' : group.lastMessageContent || 'Bắt đầu trò chuyện'}</small></span>
                            {group.unreadCount > 0 && <span className="chat-unread">{group.unreadCount > 9 ? '9+' : group.unreadCount}</span>}
                        </button>
                    ))}
                    {visibleGroups.length === 0 && <p className="chat-list-empty">Những câu chuyện mới sẽ xuất hiện ở đây.</p>}
                </section>
                <section><h2 className="chat-list-heading">Bạn bè <span>{friends.length}</span></h2>
                    {friends.filter(friend => `${friend.displayName} ${friend.username}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(friend => (
                        <button key={friend.userId} className="chat-contact" onClick={() => handleSelectFriend(friend.userId)}>
                            <span className="chat-contact-avatar"><Avatar url={friend.avatarUrl} name={friend.displayName} size={40} />{onlineUserIds.has(friend.userId) && <i aria-label="Đang online" />}</span>
                            <span className="chat-contact-copy"><strong>{friend.displayName}</strong><small>@{friend.username}</small></span><MessageSquare size={16} />
                        </button>
                    ))}
                    {friends.length === 0 && <p className="chat-list-empty">Chia sẻ trang cá nhân để kết nối với bạn bè.</p>}
                </section>
            </div>
            <div className="chat-sidebar-footer"><span>Một lời chào, một kết nối.</span><button onClick={onLogout} title="Đăng xuất"><LogOut size={18} /></button></div>
            {showCreateGroup && <CreateGroupModal friends={friends} onClose={() => setShowCreateGroup(false)} onGroupCreated={groupId => { fetchUserGroups(); onSelectGroup(groupId); }} />}
        </aside>
    );
}

