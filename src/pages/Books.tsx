import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Home, MessageSquare, Plus, Search, ArrowLeft, ArrowRight, Gamepad2 } from 'lucide-react';
import type { UserAuth } from '../types/chat';
import type { Book, BookList } from '../types/book';
import { booksApi, bookError } from '../api/books';
import BookCard from '../components/books/BookCard';
import UploadBookModal from '../components/books/UploadBookModal';
import Avatar from '../components/Avatar';
import '../styles/books.css';

export default function Books({ user }: { user: UserAuth }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BookList | null>(null);
  const [recent, setRecent] = useState<Book[]>([]);
  const [upload, setUpload] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setError('');
      void Promise.all([booksApi.list(search, page, controller.signal), booksApi.recent(controller.signal)])
        .then(([list, history]) => { if (!controller.signal.aborted) { setData(list); setRecent(history); } })
        .catch(err => { if (!controller.signal.aborted) setError(bookError(err)); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, page, revision]);

  return <div className="books-shell"><div className="books-window">
    <aside className="books-rail">
      <Link to="/books" className="books-brand" aria-label="Thư viện"><BookOpen size={29} /></Link>
      <nav><Link to="/books" className="active" aria-label="Trang chủ thư viện"><Home /></Link>
        <Link to="/" aria-label="Quay lại chat" title="Quay lại chat"><MessageSquare /></Link><Link to="/parties" aria-label="Tìm đồng đội" title="Party Match"><Gamepad2 /></Link></nav>
    </aside>
    <main className="books-main">
      <header className="books-header">
        <label className="books-search"><Search size={20} /><input aria-label="Tìm sách" placeholder="Tìm tên sách, tác giả…" value={search} maxLength={250} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
        <Link className="books-user" to={`/profile/${user.userId}`}><Avatar url={user.avatarUrl} name={user.displayName || user.username} size={36} /><span>{user.displayName || user.username}</span></Link>
      </header>
      <div className="books-intro"><div><p className="book-eyebrow">THƯ VIỆN CHUNG</p><h1>Thêm một trang, thêm một thế giới.</h1><p className="book-muted">Cùng góp sách hay, cùng khám phá những câu chuyện mới.</p></div>
        <button className="book-primary" onClick={() => setUpload(true)}><Plus size={18} /> Thêm sách</button></div>
      {error ? <div role="alert" className="book-error">{error} <button onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> :
        loading ? <p className="book-empty" role="status">Đang mở thư viện…</p> : <>
          {!search && page === 1 && recent.length > 0 && <section><div className="book-section-heading"><h2>Đang đọc</h2><span className="book-muted">Tiếp tục từ trang gần nhất</span></div><div className="books-row">{recent.map(book => <BookCard key={book.id} book={book} />)}</div></section>}
          {!search && page === 1 && !!data?.items.length && <section><div className="book-section-heading"><h2>Mới thêm</h2><a href="#all-books">Xem tất cả</a></div><div className="books-row">{data.items.slice(0, 8).map(book => <BookCard key={book.id} book={book} />)}</div></section>}
          <section id="all-books"><div className="book-section-heading"><h2>{search ? 'Kết quả tìm kiếm' : 'Tất cả sách'}</h2><span className="book-muted">{data?.total ?? 0} cuốn sách</span></div>
            {data?.items.length ? <div className="books-grid">{data.items.map(book => <BookCard key={book.id} book={book} />)}</div> : <div className="book-empty"><BookOpen size={42} /><h3>{search ? 'Chưa tìm thấy sách phù hợp' : 'Thư viện đang chờ cuốn sách đầu tiên'}</h3><p>{search ? 'Thử tên sách hoặc tác giả khác.' : 'Thêm PDF và ảnh bìa để bắt đầu đọc.'}</p></div>}
            {data && data.total > data.pageSize && <div className="books-pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Trang trước"><ArrowLeft size={18} /></button><span>{page} / {Math.ceil(data.total / data.pageSize)}</span><button disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)} aria-label="Trang sau"><ArrowRight size={18} /></button></div>}
          </section>
        </>}
    </main>
  </div>{upload && <UploadBookModal onClose={() => setUpload(false)} onCreated={() => { setUpload(false); setSearch(''); setPage(1); setRevision(value => value + 1); }} />}</div>;
}
