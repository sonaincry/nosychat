import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Headphones, Moon, Sun } from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { booksApi, bookError } from '../api/books';
import type { Book, ReadingPosition } from '../types/book';
import type { UserAuth } from '../types/chat';
import PdfPage from '../components/books/PdfPage';
import AudioReaderControls from '../components/books/AudioReaderControls';
import '../styles/books.css';

GlobalWorkerOptions.workerSrc = workerUrl;

// Bundle supporting PDF resources locally so scanned/CJK books work without a CDN.
const pdfAssets = import.meta.glob<string>('/node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm}/*', {
  query: '?url', import: 'default', eager: true,
});
class PdfBinaryDataFactory {
  async fetch({ filename }: { filename: string }) {
    const entry = Object.entries(pdfAssets).find(([path]) => path.endsWith(`/${filename}`));
    if (!entry) throw new Error(`Missing PDF resource: ${filename}`);
    const response = await fetch(entry[1]);
    if (!response.ok) throw new Error(`Cannot load PDF resource: ${filename}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}

export default function BookReader({ user }: { user: UserAuth }) {
  const { bookId = '' } = useParams();
  return <Reader key={bookId} bookId={bookId} user={user} />;
}

function Reader({ user, bookId }: { user: UserAuth; bookId: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [dark, setDark] = useState(() => localStorage.getItem('book-reader-theme') === 'dark');
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('');
  const [audioOpen, setAudioOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const saveQueue = useRef(Promise.resolve());
  const lastRendered = useRef<number | null>(null);
  const savedPage = useRef<number | null>(null);
  const lastProgress = useRef<number | ReadingPosition | null>(null);
  const mounted = useRef(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    let task: ReturnType<typeof getDocument> | undefined;
    void booksApi.get(bookId, controller.signal).then(async result => {
      if (controller.signal.aborted) return;
      task = getDocument({ ...booksApi.pdf(bookId, user.token), useWorkerFetch: false, BinaryDataFactory: PdfBinaryDataFactory });
      const document = await task.promise;
      if (controller.signal.aborted) return;
      setBook(result); setPage(result.currentPage ?? 1); setPdf(document);
    }).catch(err => { if (!controller.signal.aborted) setError(bookError(err)); });
    return () => { controller.abort(); if (task) void task.destroy(); };
  }, [bookId, user.token, revision]);

  const queueProgress = useCallback((position: number | ReadingPosition, force = false) => {
    const progressPage = typeof position === 'number' ? position : position.currentPage;
    lastProgress.current = position;
    if (!force && typeof position === 'number' && savedPage.current === progressPage) return;
    savedPage.current = progressPage;
    setSaveState('Đang lưu…');
    // Serialize saves so a slower request cannot overwrite a newer page.
    saveQueue.current = saveQueue.current.then(() => booksApi.saveProgress(bookId, position))
      .then(() => { if (mounted.current) setSaveState('Đã lưu tiến độ'); })
      .catch(() => { savedPage.current = null; if (mounted.current) setSaveState('Chưa lưu được tiến độ'); });
  }, [bookId]);

  const saveProgress = useCallback((renderedPage: number) => {
    lastRendered.current = renderedPage;
    queueProgress(renderedPage);
  }, [queueProgress]);

  const saveLogicalProgress = useCallback((position: ReadingPosition) => queueProgress(position), [queueProgress]);

  const goTo = useCallback((next: number) => {
    if (!pdf) return;
    const target = Math.max(1, Math.min(pdf.numPages, next));
    if (target === page) return;
    setPage(target); viewport.current?.scrollTo({ top: 0 });
  }, [page, pdf]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); goTo(page + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(page - 1); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [page, goTo]);

  return <div className={`book-reader ${dark ? 'reader-dark' : ''}`}>
    <header className="reader-header"><Link className="book-icon-button" to="/books" aria-label="Về thư viện"><ArrowLeft /></Link>
      <div className="reader-title"><h1>{book?.title || 'Góc đọc'}</h1><p>{book?.author || 'Một khoảng thời gian cho câu chuyện của bạn'}</p></div>
      <div className="reader-header-actions">
        <button className={`book-icon-button ${audioOpen ? 'active' : ''}`} onClick={() => setAudioOpen(value => !value)} disabled={!book || !pdf} aria-label="Đọc sách bằng giọng nói"><Headphones /></button>
        <button className="book-icon-button" onClick={() => { localStorage.setItem('book-reader-theme', dark ? 'light' : 'dark'); setDark(!dark); }} aria-label={dark ? 'Giao diện sáng' : 'Giao diện tối'}>{dark ? <Sun /> : <Moon />}</button>
      </div>
    </header>
    <div ref={viewport} className="reader-viewport">
      {error ? <div role="alert" className="book-error">{error}<button onClick={() => { setError(''); setPdf(null); setBook(null); setRevision(value => value + 1); }}>Thử lại</button></div> : pdf ?
        <PdfPage key={page} document={pdf} page={page} scale={1.5} onRendered={saveProgress} /> : <div className="reader-page-skeleton" aria-label="Đang chuẩn bị trang sách" />}
    </div>
    {audioOpen && book && pdf && <AudioReaderControls bookId={book.id} pageCount={pdf.numPages} visiblePage={page} onPageChange={goTo} onPositionChange={saveLogicalProgress} onClose={() => setAudioOpen(false)} />}
    <footer className="reader-footer">
      <nav className="reader-page-navigation" aria-label="Lật trang sách">
        <button className="reader-turn-page" disabled={!pdf || page <= 1} onClick={() => goTo(page - 1)}><ChevronLeft size={20} /><span>Trang trước</span></button>
        <div className="reader-position">{pdf ? <form onSubmit={event => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem('readerPage') as HTMLInputElement;
          const requestedPage = Number(input.value);
          if (Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= pdf.numPages) goTo(requestedPage);
          else input.value = String(page);
        }}><input key={page} name="readerPage" type="number" min={1} max={pdf.numPages} defaultValue={page} aria-label="Trang hiện tại" /><span>/ {pdf.numPages}</span></form> : <span>Góc đọc</span>}
          {pdf && <progress value={page} max={pdf.numPages} aria-label="Tiến độ đọc" />}
        </div>
        <button className="reader-turn-page reader-turn-next" disabled={!pdf || page >= pdf.numPages} onClick={() => goTo(page + 1)}><span>Trang tiếp</span><ChevronRight size={20} /></button>
      </nav>
      {saveState === 'Chưa lưu được tiến độ' && <span role="status">{saveState}<button onClick={() => { const progress = lastProgress.current ?? lastRendered.current; if (progress != null) queueProgress(progress, true); }}>Thử lại</button></span>}
    </footer>
  </div>;
}
