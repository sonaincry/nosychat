import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Users, X } from 'lucide-react';

interface Friend {
  userId: string;
  displayName: string;
  username: string;
}

interface CreateGroupModalProps {
  friends: Friend[];
  onClose: () => void;
  onGroupCreated: (groupId: string) => void;
}

// Bỏ từ khóa 'default' ở dòng này
export function CreateGroupModal({ friends, onClose, onGroupCreated }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) return alert('Vui lòng nhập tên nhóm');
    if (selectedUserIds.length === 0) return alert('Vui lòng chọn ít nhất 1 người bạn');

    setLoading(true);
    try {
      const res = await axiosClient.post('/Chat/create-group', {
        groupName: groupName.trim(),
        memberIds: selectedUserIds,
      });
      onGroupCreated(res.data.groupId);
      onClose();
    } catch (err) {
      alert('Tạo nhóm thất bại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-blue-500" /> Tạo nhóm chat mới
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1">TÊN NHÓM</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ví dụ: Nhóm Dev NosyChat..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-2">
            CHỌN THÀNH VIÊN ({selectedUserIds.length})
          </label>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {friends.map((f) => {
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
            })}
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
            disabled={loading}
            onClick={handleCreate}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Đang tạo...' : 'Tạo nhóm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Giữ lại duy nhất dòng export default này
export default CreateGroupModal;