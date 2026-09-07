import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { UserPlus, X } from 'lucide-react';

interface Friend {
    userId: string;
    displayName: string;
    username: string;
}

interface AddMemberModalProps {
    groupId: string;
    friends: Friend[];
    onClose: () => void;
    onMemberAdded: () => void;
}

export default function AddMemberModal({ groupId, friends, onClose, onMemberAdded }: AddMemberModalProps) {
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [existingMemberIds, setExistingMemberIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchingMembers, setFetchingMembers] = useState(true);

    // Tải danh sách thành viên hiện tại của nhóm để loại trừ khỏi danh sách hiển thị
    useEffect(() => {
        const fetchGroupMembers = async () => {
            try {
                const res = await axiosClient.get(`/Chat/members/${groupId}`);
                setExistingMemberIds(res.data);
            } catch (err) {
                console.error('Lỗi lấy danh sách thành viên nhóm', err);
            } finally {
                setFetchingMembers(false);
            }
        };

        if (groupId) {
            fetchGroupMembers();
        }
    }, [groupId]);

    // Lọc danh sách bạn bè: Chỉ giữ lại những người CHƯA ở trong nhóm
    const availableFriends = friends.filter((f) => !existingMemberIds.includes(f.userId));

    const toggleSelectUser = (userId: string) => {
        setSelectedUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleAddMembers = async () => {
        if (selectedUserIds.length === 0) return alert('Vui lòng chọn ít nhất 1 người bạn');

        setLoading(true);
        try {
            await axiosClient.post('/Chat/add-members', {
                groupId,
                memberIds: selectedUserIds,
            });
            alert('Thêm thành viên thành công!');
            onMemberAdded();
            onClose();
        } catch (err) {
            alert('Thêm thành viên thất bại!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <UserPlus size={20} className="text-blue-500" /> Thêm thành viên vào nhóm
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-2">
                        CHỌN BẠN BÈ ({selectedUserIds.length})
                    </label>

                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                        {fetchingMembers ? (
                            <p className="text-xs text-slate-400 italic p-2 text-center">Đang tải thành viên...</p>
                        ) : availableFriends.length === 0 ? (
                            <p className="text-xs text-slate-500 italic p-2 text-center">
                                Tất cả bạn bè của bạn đều đã ở trong nhóm này hoặc bạn chưa có bạn bè.
                            </p>
                        ) : (
                            availableFriends.map((f) => {
                                const isSelected = selectedUserIds.includes(f.userId);
                                return (
                                    <div
                                        key={f.userId}
                                        onClick={() => toggleSelectUser(f.userId)}
                                        className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between border transition ${
                                            isSelected
                                                ? 'bg-blue-600/20 border-blue-500 text-white'
                                                : 'bg-slate-800/40 border-transparent text-slate-300 hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className="text-sm font-medium">{f.displayName || f.username}</span>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            readOnly
                                            className="accent-blue-600 rounded"
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition"
                    >
                        Hủy
                    </button>
                    <button
                        disabled={loading || selectedUserIds.length === 0}
                        onClick={handleAddMembers}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                    >
                        {loading ? 'Đang thêm...' : 'Xác nhận'}
                    </button>
                </div>
            </div>
        </div>
    );
}