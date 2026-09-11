import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getGiphyMedia, hasGiphyApiKey } from '../api/giphy';
import type { GiphyMediaItem, GiphyMediaType } from '../api/giphy';

interface Props {
  onClose: () => void;
  onSelect: (item: GiphyMediaItem, type: GiphyMediaType) => Promise<void>;
}

export default function GiphyPicker({ onClose, onSelect }: Props) {
  const [type, setType] = useState<GiphyMediaType>('Gif');
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState<{ key: string; items: GiphyMediaItem[]; error: string }>({ key: '', items: [], error: '' });
  const [selectionError, setSelectionError] = useState('');
  const [sendingId, setSendingId] = useState('');
  const requestKey = `${type}:${searchQuery}`;
  const hasCurrentResult = result.key === requestKey;
  const items = hasCurrentResult ? result.items : [];
  const error = hasCurrentResult ? result.error : '';
  const loading = hasGiphyApiKey && !hasCurrentResult;

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(query), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!hasGiphyApiKey) return;
    const controller = new AbortController();
    void getGiphyMedia(type, searchQuery, controller.signal)
      .then(items => setResult({ key: requestKey, items, error: '' }))
      .catch(err => {
        if (!controller.signal.aborted) setResult({ key: requestKey, items: [], error: err instanceof Error ? err.message : 'Không tải được GIPHY.' });
      });
    return () => controller.abort();
  }, [type, searchQuery, requestKey]);

  const selectItem = async (item: GiphyMediaItem) => {
    setSendingId(item.id);
    try {
      await onSelect(item, type);
      onClose();
    } catch {
      setSelectionError(`Không gửi được ${type === 'Sticker' ? 'sticker' : 'GIF'}.`);
      setSendingId('');
    }
  };

  return <section className="giphy-picker" aria-label="GIPHY media picker">
    <header className="giphy-picker-header">
      <div className="giphy-picker-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={type === 'Gif'} className={type === 'Gif' ? 'active' : ''} onClick={() => setType('Gif')}>GIF</button>
        <button type="button" role="tab" aria-selected={type === 'Sticker'} className={type === 'Sticker' ? 'active' : ''} onClick={() => setType('Sticker')}>Sticker</button>
      </div>
      <button type="button" className="giphy-picker-close" onClick={onClose} aria-label="Đóng GIPHY"><X size={18} /></button>
    </header>
    <label className="giphy-search"><Search size={17} /><input value={query} maxLength={50} onChange={event => setQuery(event.target.value)} placeholder={`Tìm ${type === 'Sticker' ? 'sticker' : 'GIF'}…`} autoFocus /></label>
    <p className="giphy-picker-caption">{searchQuery ? `Kết quả cho “${searchQuery}”` : 'Đang thịnh hành'}</p>
    {!hasGiphyApiKey ? <p className="giphy-picker-state">Thiếu cấu hình <code>VITE_GIPHY_API_KEY</code>.</p>
      : error ? <p className="giphy-picker-state error" role="alert">{error}</p>
      : loading ? <p className="giphy-picker-state">Đang tải…</p>
      : items.length === 0 ? <p className="giphy-picker-state">Không tìm thấy kết quả.</p>
      : <div className={`giphy-grid ${type === 'Sticker' ? 'stickers' : ''}`}>
        {items.map(item => <button type="button" key={item.id} disabled={Boolean(sendingId)} onClick={() => void selectItem(item)} aria-label={`Gửi ${item.title}`}>
          <img src={item.previewUrl} alt={item.title} loading="lazy" />
        </button>)}
      </div>}
    {selectionError && <p className="giphy-send-error" role="alert">{selectionError}</p>}
    <small className="giphy-attribution">Powered by GIPHY</small>
  </section>;
}
