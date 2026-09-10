import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { X, Upload } from 'lucide-react';
import { booksApi, bookError } from '../../api/books';

export default function UploadBookModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pdf = form.get('pdf') as File;
    const cover = form.get('cover') as File;
    if (!pdf.size || pdf.size > 25 * 1024 * 1024 || !pdf.name.toLowerCase().endsWith('.pdf')) {
      setError('Chọn file PDF hợp lệ, tối đa 25 MB.'); return;
    }
    if (cover.size > 3 * 1024 * 1024) { setError('Ảnh bìa tối đa 3 MB.'); return; }
    if (!cover.size) form.delete('cover');
    setBusy(true); setError('');
    try { await booksApi.upload(form, setPercent); onCreated(); }
    catch (err) { setError(bookError(err)); setBusy(false); }
  }

  return <dialog ref={dialog} className="book-upload-dialog" onCancel={event => {
    event.preventDefault(); if (!busy) onClose();
  }} aria-labelledby="upload-book-title">
    <form onSubmit={submit}>
      <div className="book-section-heading"><h2 id="upload-book-title">Thêm sách mới</h2>
        <button type="button" className="book-icon-button" disabled={busy} onClick={onClose} aria-label="Đóng"><X /></button>
      </div>
      <p className="book-muted">Sách bạn thêm sẽ được chia sẻ với mọi thành viên. Tên sách phải chưa có trong thư viện.</p>
      <fieldset disabled={busy}>
        <label>Tên sách<input name="title" required maxLength={250} autoFocus placeholder="Nhập tên sách" /></label>
        <label>Tác giả <span className="book-muted">(tùy chọn)</span><input name="author" maxLength={200} placeholder="Tên tác giả" /></label>
        <label>Ảnh bìa <span className="book-muted">· PNG, JPEG, WebP · tối đa 3 MB</span>
          <input name="cover" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
            const file = event.target.files?.[0]; setPreview(file ? URL.createObjectURL(file) : '');
          }} />
        </label>
        {preview && <img className="book-upload-preview" src={preview} alt="Xem trước ảnh bìa" />}
        <label>File PDF <span className="book-muted">· tối đa 25 MB · không khóa mật khẩu</span>
          <input name="pdf" type="file" accept="application/pdf,.pdf" required />
        </label>
      </fieldset>
      {error && <p role="alert" className="book-error">{error}</p>}
      <button className="book-primary" disabled={busy}><Upload size={17} />
        {busy ? (percent === 100 ? 'Đang xử lý PDF…' : `Đang tải ${percent}%…`) : 'Thêm vào thư viện'}
      </button>
    </form>
  </dialog>;
}
