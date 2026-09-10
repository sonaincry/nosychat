import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { booksApi } from '../../api/books';
import type { Book } from '../../types/book';

export default function BookCard({ book }: { book: Book }) {
  const [cover, setCover] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let url = '';
    if (book.hasCover) {
      void booksApi.cover(book.id, controller.signal).then(blob => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setCover(url);
      }).catch(() => { /* The title remains visible when a cover cannot load. */ });
    }
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [book.id, book.hasCover]);

  return <Link className="book-card" to={`/books/${book.id}`}>
    <div className="book-cover">
      {cover ? <img src={cover} alt={`Bìa ${book.title}`} /> :
        <div className="book-cover-placeholder"><BookOpen size={32} /><span>{book.title}</span></div>}
      <span className="book-pages">{book.pageCount} trang</span>
    </div>
    <h3>{book.title}</h3>
    <p>{book.author || 'Chưa rõ tác giả'}</p>
    {book.currentPage != null && <div className="book-progress-info">
      <progress value={book.currentPage} max={book.pageCount} aria-label="Tiến độ đọc" />
      <span>{book.currentPage}/{book.pageCount} trang</span>
    </div>}
  </Link>;
}
