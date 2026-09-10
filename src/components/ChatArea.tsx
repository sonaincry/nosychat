import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import type { Message, UserAuth } from '../types/chat';
import axiosClient, { API_BASE_URL } from '../api/axiosClient';
import { Send, Image, CheckCheck, UserPlus, Trash2, SmilePlus, ArrowLeft, MessageCircle } from 'lucide-react';
import AddMemberModal from './AddMemberModal';
import Avatar from './Avatar';

interface Friend {
  userId: string;
  displayName: string;
  username: string;
}

interface Props {
  groupId: string;
  groupName?: string;
  user: UserAuth;
  onBack: () => void;
}

const REACTION_EMOJIS = ['👍', '😂', '😮', '❤️', '😠', '🖕'];

export default function ChatArea({ groupId, groupName: initialGroupName, user, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [hubConnection, setHubConnection] = useState<signalR.HubConnection | null>(null);
  const [groupDetails, setGroupDetails] = useState<{ name: string; isGroup: boolean; avatarUrl?: string | null } | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [openPickerMsgId, setOpenPickerMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchGroupAndMessages = async () => {
      try {
        const resMsg = await axiosClient.get(`/Chat/messages/${groupId}`);
        setMessages(resMsg.data.reverse());

        const resDetail = await axiosClient.get(`/Chat/details/${groupId}`);
        setGroupDetails(resDetail.data);
      } catch (err) {
        console.error('Lỗi tải thông tin phòng chat:', err);
      }
    };

    if (groupId) {
      fetchGroupAndMessages();
    }
  }, [groupId]);

  // Close reaction picker when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpenPickerMsgId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFriends = async () => {
    try {
      const res = await axiosClient.get('/Friend/list');
      setFriends(res.data);
    } catch (err) {
      console.error('Lỗi tải danh sách bạn bè:', err);
    }
  };

  const handleOpenAddMember = () => {
    fetchFriends();
    setShowAddMember(true);
  };

  useEffect(() => {
    let isMounted = true;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/chatHub`, {
        accessTokenFactory: () => user.token,
      })
      .withAutomaticReconnect()
      .build();

    connection.on('ReactionsUpdated', (messageId: string, reactions: { userId: string; emoji: string }[]) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    });
    connection.on('MessageDeleted', (messageId: string) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, content: null } : m)));
    });

    connection.on('ReceiveMessage', (newMessage: Message) => {
      if (String(newMessage.groupId).toLowerCase() === String(groupId).toLowerCase()) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });

        if (newMessage.senderId !== user.userId) {
          connection.invoke('MarkAsRead', newMessage.id, groupId).catch(() => {});
        }
      }
    });

    connection.on('MessageRead', (messageId: string, userId: string) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId && !msg.readByUserIds.includes(userId)
            ? { ...msg, readByUserIds: [...msg.readByUserIds, userId] }
            : msg
        )
      );
    });

    connection.on('UserTyping', (userId: string) => {
      if (userId !== user.userId) setTypingUser('Đang nhập...');
    });
    connection.on('UserStoppedTyping', (userId: string) => {
      if (userId !== user.userId) setTypingUser(null);
    });

    connection
      .start()
      .then(async () => {
        if (isMounted) {
          setHubConnection(connection);
          await connection.invoke('JoinGroup', groupId);
        } else {
          connection.stop();
        }
      })
      .catch((err) => console.error('Lỗi kết nối SignalR:', err));

    return () => {
      isMounted = false;
      if (connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke('LeaveGroup', groupId).catch(() => {});
        connection.stop();
      }
    };
  }, [groupId, user.token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !hubConnection) return;

    try {
      await hubConnection.invoke('SendMessage', {
        groupId,
        content: inputText,
        messageType: 'Text',
        mediaUrl: null,
      });
      setInputText('');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      hubConnection.invoke('StopTyping', groupId).catch(() => {});
    } catch (err) {
      console.error('Lỗi gửi tin nhắn:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (!hubConnection) return;

    hubConnection.invoke('Typing', groupId).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      hubConnection.invoke('StopTyping', groupId).catch(() => {});
    }, 2000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !hubConnection) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axiosClient.post('/Chat/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await hubConnection.invoke('SendMessage', {
        groupId,
        content: null,
        messageType: 'Image',
        mediaUrl: res.data.url,
      });
    } catch (err) {
      alert('Upload ảnh thất bại!');
    }
  };

  const handleReact = (messageId: string, emoji: string) => {
    hubConnection?.invoke('ReactToMessage', messageId, groupId, emoji).catch(() => {});
    setOpenPickerMsgId(null);
  };

  const displayName = groupDetails?.name || initialGroupName || `Phòng Chat #${groupId.substring(0, 8)}...`;
  const isGroupChat = groupDetails?.isGroup ?? true;

  function formatTimeVN(utcDateString: string): string {
    const date = new Date(utcDateString);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  }

  function linkify(text: string): React.ReactNode[] {
  const urlRegex = /(?:https?:\/\/|www\.)[^\s]+/g;
  const parts = text.split(urlRegex);
  const matches = text.match(urlRegex) || [];

  const result: React.ReactNode[] = [];

  parts.forEach((part, index) => {
    if (part) {
      result.push(part);
    }
    if (matches[index]) {
      const url = matches[index];
      const href = url.startsWith('www.') ? `https://${url}` : url;
      
      result.push(
        <a // <-- Added the missing <a tag here
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-[#bc4653] hover:text-[#8d3440] break-all"
        >
          {url}
        </a>
      );
    }
  });

  return result;
}

  return (
    <div className="chat-conversation">
      {/* Header Thanh Chat */}
      <div className="chat-conversation-header">
        <div className="flex items-center gap-2">
          <button type="button" className="chat-mobile-back" onClick={onBack} aria-label="Về danh sách trò chuyện"><ArrowLeft size={20} /></button>
          <Avatar url={groupDetails?.avatarUrl} name={displayName} size={42} />
          <div><h1>{displayName}</h1><p className="chat-connection-label">{hubConnection ? 'Sẵn sàng trò chuyện' : 'Đang kết nối…'}</p></div>
        </div>

        {isGroupChat && (
          <button
            onClick={handleOpenAddMember}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fce5dd] text-[#bc4653] hover:bg-[#eb6873] hover:text-[#39372f] rounded-lg text-xs font-semibold transition"
            title="Thêm thành viên"
          >
            <UserPlus size={16} />
            <span>Thêm người</span>
          </button>
        )}
      </div>

      {/* Danh sách tin nhắn */}
      <div className="chat-messages flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && <div className="chat-first-message"><MessageCircle size={30} /><p>Gửi một lời chào để bắt đầu câu chuyện.</p></div>}
        {messages.map((msg) => {
          const isMe = msg.senderId === user.userId;
          const isPickerOpen = openPickerMsgId === msg.id;

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
              <div className={`flex items-end gap-2 max-w-md ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMe && <Avatar url={msg.senderAvatarUrl} name={msg.senderName} size={28} />}

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-[10px] text-[#827b6e] mb-1 px-1">{msg.senderName}</span>
                  )}

                  <div className={`relative flex items-center gap-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div
                      className={`p-3 rounded-2xl text-sm ${
                        isMe ? 'chat-bubble-mine rounded-br-none' : 'chat-bubble-other rounded-bl-none'
                      }`}
                    >
                      {msg.isDeleted ? (
                        <p className="italic text-[#827b6e] text-xs">Tin nhắn đã bị xoá</p>
                      ) : msg.messageType === 'Image' ? (
                        <img src={msg.mediaUrl!} alt="Attachment" className="rounded-lg max-h-60 object-cover" />
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{linkify(msg.content || '')}</p>
                      )}
                    </div>

                    {/* Action buttons: react + delete, only visible on hover */}
                    {!msg.isDeleted && (
                      <div className={`chat-message-actions flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <button
                          onClick={() => setOpenPickerMsgId(isPickerOpen ? null : msg.id)}
                          className="text-[#827b6e] hover:text-yellow-400 p-1.5 rounded-full hover:bg-white"
                          title="Thả cảm xúc"
                        >
                          <SmilePlus size={16} />
                        </button>

                        {isMe && (
                          <button
                            onClick={() => {
                              if (confirm('Xoá tin nhắn này?')) {
                                hubConnection?.invoke('DeleteMessage', msg.id, groupId).catch(() => {});
                              }
                            }}
                            className="text-[#827b6e] hover:text-red-400 p-1.5 rounded-full hover:bg-white"
                            title="Xoá tin nhắn"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Reaction emoji picker popup */}
                    {isPickerOpen && (
                      <div
                        ref={pickerRef}
                        className={`absolute -top-12 z-20 bg-white border border-[#e1dccf] rounded-full px-2 py-1.5 flex gap-1 shadow-xl ${
                          isMe ? 'right-0' : 'left-0'
                        }`}
                      >
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className="text-lg hover:scale-125 transition-transform px-0.5"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className={`flex gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(
                        msg.reactions.reduce((acc: Record<string, number>, r) => {
                          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([emoji, count]) => (
                        <span
                          key={emoji}
                          className="text-[11px] bg-white text-[#615d53] border border-[#e1dccf] rounded-full px-2 py-0.5 flex items-center gap-1 shadow-sm"
                        >
                          <span>{emoji}</span>
                          {count > 1 && <span className="font-semibold text-[#827b6e] text-[10px]">{count}</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center space-x-1 mt-1 text-[10px] text-[#827b6e] px-1">
                    <span>{formatTimeVN(msg.createdAt)}</span>
                    {isMe && (
                      <CheckCheck size={14} className={msg.readByUserIds.length > 1 ? 'text-[#bc4653]' : 'text-[#827b6e]'} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {typingUser && (
        <p className="text-xs text-[#827b6e] px-4 pb-1 italic">{typingUser}</p>
      )}

      {/* Ô nhập tin nhắn */}
      <form onSubmit={handleSend} className="chat-composer">
        <label title="Gửi ảnh" className="p-2 hover:bg-white rounded-lg cursor-pointer text-[#827b6e]">
          <Image size={20} />
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" aria-label="Gửi ảnh" />
        </label>
        <textarea
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e as any);
            }
          }}
          rows={1}
          placeholder="Nhập tin nhắn..."
          aria-label="Nội dung tin nhắn"
          className="flex-1 p-3 bg-white rounded-xl outline-none text-sm focus:ring-1 focus:ring-[#eb6873] text-[#39372f] resize-none"
        />
        <button type="submit" disabled={!inputText.trim() || !hubConnection} aria-label="Gửi tin nhắn" className="chat-send-button">
          <Send size={18} />
        </button>
      </form>

      {showAddMember && (
        <AddMemberModal
          groupId={groupId}
          friends={friends}
          onClose={() => setShowAddMember(false)}
          onMemberAdded={() => {}}
        />
      )}
    </div>
  );
}
