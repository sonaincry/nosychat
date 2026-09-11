import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FileText, RefreshCw, Sparkles, X } from 'lucide-react';
import { bookError, booksApi } from '../../api/books';
import type { Book, BookSummaryResult, BookSummaryStatus } from '../../types/book';

export default function BookSummaryDialog({ book, onClose }: { book: Book; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const startLock = useRef(false);
  const [status, setStatus] = useState<BookSummaryStatus | null>(null);
  const [summary, setSummary] = useState<BookSummaryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const polling = status != null && ['Pending', 'Processing', 'RateLimited'].includes(status.status);

  useEffect(() => { dialog.current?.showModal(); }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    const next = await booksApi.summaryStatus(book.id, signal);
    const result = next.status === 'Ready' ? await booksApi.summary(book.id, signal) : null;
    if (signal?.aborted) return next;
    if (result) setSummary(result);
    setStatus(next);
    setError('');
    return next;
  }, [book.id]);

  useEffect(() => {
    const controller = new AbortController();
    void booksApi.summaryStatus(book.id, controller.signal)
      .then(async next => {
        if (controller.signal.aborted) return;
        const result = next.status === 'Ready' ? await booksApi.summary(book.id, controller.signal) : null;
        if (controller.signal.aborted) return;
        if (result) setSummary(result);
        setStatus(next);
      })
      .catch(err => { if (!controller.signal.aborted) setError(bookError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [book.id]);

  useEffect(() => {
    if (!polling) return;
    const controller = new AbortController();
    let checking = false;
    const timer = window.setInterval(() => {
      if (checking) return;
      checking = true;
      void load(controller.signal)
        .catch(err => { if (!controller.signal.aborted) setError(bookError(err)); })
        .finally(() => { checking = false; });
    }, 2500);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [polling, load]);

  async function start() {
    if (startLock.current) return;
    startLock.current = true;
    setStarting(true); setError(''); setSummary(null);
    try { setStatus(await booksApi.startSummary(book.id)); }
    catch (err) { setError(bookError(err)); }
    finally { startLock.current = false; setStarting(false); }
  }

  const percent = status?.totalChunks
    ? Math.round(status.completedChunks / status.totalChunks * 100) : 0;
  const active = status && ['Pending', 'Processing', 'RateLimited'].includes(status.status);

  return <dialog ref={dialog} className="book-summary-dialog" onCancel={event => {
    event.preventDefault(); onClose();
  }} aria-labelledby="book-summary-title">
    <div className="book-summary-heading">
      <div><p className="book-eyebrow">TÓM TẮT SÁCH</p><h2 id="book-summary-title">{book.title}</h2></div>
      <button className="book-icon-button" onClick={onClose} aria-label="Đóng"><X /></button>
    </div>

    {loading ? <div className="book-summary-state" role="status"><RefreshCw className="book-spin" />Đang tải…</div> :
      summary ? <SummaryMarkdown content={summary.content} /> :
      active ? <div className="book-summary-state" role="status">
        <Sparkles />
        <h3>{status.status === 'RateLimited' ? 'Đang chờ lượt Gemini' : 'Đang tạo bản tóm tắt…'}</h3>
        <p>{status.status === 'RateLimited'
          ? 'Hệ thống sẽ tự tiếp tục khi hạn mức cho phép.'
          : status.totalChunks ? `Đã xử lý ${status.completedChunks}/${status.totalChunks} phần.` : 'Đang chuẩn bị nội dung sách.'}</p>
        {status.totalChunks > 0 && <progress value={status.completedChunks} max={status.totalChunks} aria-label="Tiến độ tóm tắt" />}
        {status.totalChunks > 0 && <span>{percent}%</span>}
      </div> : <div className="book-summary-state">
        <FileText />
        <h3>{status?.status === 'Failed' ? 'Chưa thể tạo bản tóm tắt' : 'Chưa có bản tóm tắt'}</h3>
        <p>{status?.errorMessage || 'Tạo một bản tóm tắt tiếng Việt đầy đủ, khoảng 10 phút đọc.'}</p>
        <button className="book-primary" disabled={starting} onClick={() => void start()}>
          <Sparkles size={17} />{starting ? 'Đang bắt đầu…' : status?.status === 'Failed' ? 'Thử lại' : 'Tạo tóm tắt'}
        </button>
      </div>}
    {error && <p role="alert" className="book-error">{error}</p>}
  </dialog>;
}

function SummaryMarkdown({ content }: { content: string }) {
  const elements: ReactNode[] = [];
  let paragraph: string[] = [];
  let unordered: string[] = [];
  let ordered: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    elements.push(<p key={key++}>{renderInline(text, key)}</p>);
    paragraph = [];
  };
  const flushLists = () => {
    if (unordered.length > 0) {
      elements.push(<ul key={key++}>{unordered.map((item, index) =>
        <li key={index}>{renderInline(item, `${key}-${index}`)}</li>)}</ul>);
      unordered = [];
    }
    if (ordered.length > 0) {
      elements.push(<ol key={key++}>{ordered.map((item, index) =>
        <li key={index}>{renderInline(item, `${key}-${index}`)}</li>)}</ol>);
      ordered = [];
    }
  };
  const flushAll = () => { flushParagraph(); flushLists(); };

  for (const rawLine of content.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) { flushAll(); continue; }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length, 4);
      const Heading = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      elements.push(<Heading key={key++}>{renderInline(heading[2], key)}</Heading>);
      continue;
    }
    if (/^((?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line)) {
      flushAll(); elements.push(<hr key={key++} />); continue;
    }
    const bullet = /^[-+*]\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (ordered.length > 0) flushLists();
      unordered.push(bullet[1]);
      continue;
    }
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (numbered) {
      flushParagraph();
      if (unordered.length > 0) flushLists();
      ordered.push(numbered[1]);
      continue;
    }
    flushLists();
    paragraph.push(line);
  }
  flushAll();
  return <article className="book-summary-content">{elements}</article>;
}

function renderInline(text: string, keyPrefix: string | number): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).filter(Boolean).map((part, index) => {
    const bold = (part.startsWith('**') && part.endsWith('**')) ||
      (part.startsWith('__') && part.endsWith('__'));
    return bold ? <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong> : part;
  });
}
