import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Image, Link2, LoaderCircle, X } from 'lucide-react';
import { chatApi } from '../api/chat';
import type { SharedMediaItem, SharedMediaType } from '../types/chat';

interface Props {
  groupId: string;
  conversationName: string;
  deletedMessageIds: string[];
  onClose: () => void;
}

const tabs: { type: SharedMediaType; label: string; icon: typeof Image }[] = [
  { type: 'Media', label: 'Media', icon: Image },
  { type: 'Files', label: 'Files', icon: FileText },
  { type: 'Links', label: 'Links', icon: Link2 },
];

export default function SharedMediaGallery({ groupId, conversationName, deletedMessageIds, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<SharedMediaType>('Media');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SharedMediaItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void chatApi.sharedMedia(groupId, activeTab, page, controller.signal)
      .then(result => {
        setItems(current => page === 1 ? result.items : [
          ...current,
          ...result.items.filter(item => !current.some(existing =>
            existing.messageId === item.messageId && existing.url === item.url)),
        ]);
        setHasMore(result.hasMore);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Không tải được nội dung đã chia sẻ.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeTab, groupId, page]);

  const visibleItems = useMemo(() => {
    const deleted = new Set(deletedMessageIds);
    return items.filter(item => !deleted.has(item.messageId));
  }, [deletedMessageIds, items]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const formatDate = (value: string) => new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return <div className="shared-gallery-backdrop motion-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="shared-gallery motion-panel" role="dialog" aria-modal="true" aria-labelledby="shared-gallery-title">
      <header><div><p>NỘI DUNG ĐÃ CHIA SẺ</p><h2 id="shared-gallery-title">{conversationName}</h2></div><button type="button" onClick={onClose} aria-label="Đóng thư viện"><X size={20} /></button></header>
      <div className="shared-gallery-tabs" role="tablist">{tabs.map(tab => { const Icon = tab.icon; return <button type="button" role="tab" aria-selected={activeTab === tab.type} className={activeTab === tab.type ? 'active' : ''} key={tab.type} onClick={() => { if (tab.type === activeTab) return; setLoading(true); setError(''); setActiveTab(tab.type); setPage(1); setItems([]); }}><Icon size={16} />{tab.label}</button>; })}</div>
      <div className="shared-gallery-body">
        {activeTab === 'Media' && <div className="shared-media-grid">{visibleItems.map(item => <a key={`${item.messageId}-${item.url}`} href={item.url} target="_blank" rel="noopener noreferrer" title={`Mở ảnh ngày ${formatDate(item.createdAt)}`}><img src={item.url} alt="Ảnh đã chia sẻ" loading="lazy" /><span>{formatDate(item.createdAt)}</span></a>)}</div>}
        {activeTab === 'Files' && <div className="shared-file-list">{visibleItems.map(item => <a key={`${item.messageId}-${item.url}`} href={item.url} target="_blank" rel="noopener noreferrer"><FileText size={22} /><span><strong>{item.fileName || 'Tệp đính kèm'}</strong><small>{[item.contentType, item.sizeBytes ? `${Math.ceil(item.sizeBytes / 1024)} KB` : null, formatDate(item.createdAt)].filter(Boolean).join(' · ')}</small></span><ExternalLink size={15} /></a>)}</div>}
        {activeTab === 'Links' && <div className="shared-link-list">{visibleItems.map(item => <a key={`${item.messageId}-${item.url}`} href={item.url} target="_blank" rel="noopener noreferrer"><Link2 size={20} /><span><strong>{item.url}</strong>{item.context && <small>{item.context}</small>}<time>{formatDate(item.createdAt)}</time></span><ExternalLink size={15} /></a>)}</div>}
        {!loading && !error && visibleItems.length === 0 && <div className="shared-gallery-empty">Chưa có nội dung trong mục này.</div>}
        {error && <div className="shared-gallery-error" role="alert">{error}</div>}
        {loading && <div className="shared-gallery-loading" role="status"><LoaderCircle className="motion-spin" size={20} /> Đang tải…</div>}
        {!loading && !error && hasMore && <button type="button" className="shared-gallery-more" onClick={() => { setLoading(true); setError(''); setPage(value => value + 1); }}>Tải thêm</button>}
      </div>
    </section>
  </div>;
}
