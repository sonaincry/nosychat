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
      <div className="bg-[#f7f4eb] border border-[#e1dccf] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-[#e1dccf] pb-3">
          <h3 className="text-lg font-bold text-[#39372f] flex items-center gap-2">
            <Users size={20} className="text-[#bb5660]" /> Tạo nhóm chat mới
          </h3>
          <button onClick={onClose} className="text-[#827b6e] hover:text-[#39372f]">
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-[#827b6e] block mb-1">TÊN NHÓM</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ví dụ: Nhóm Dev NosyChat..."
            className="w-full bg-white border border-[#e1dccf] rounded-xl px-4 py-2.5 text-[#39372f] text-sm focus:outline-none focus:border-[#d98688]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-[#827b6e] block mb-2">
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
                      ? 'bg-[#fce5dd] border-[#d98688] text-[#39372f]'
                      : 'bg-white/40 border-transparent text-[#615d53] hover:bg-white'
                  }`}
                >
                  <span className="text-sm font-medium">{f.displayName || f.username}</span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="accent-[#d98688] rounded"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-[#e1dccf]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white hover:bg-[#e3d9c7] text-[#615d53] rounded-xl text-sm font-semibold transition"
          >
            Hủy
          </button>
          <button
            disabled={loading}
            onClick={handleCreate}
            className="flex-1 py-2.5 bg-[#eb6873] hover:bg-[#d95865] text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
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