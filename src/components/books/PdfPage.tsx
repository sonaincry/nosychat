import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export default function PdfPage({ document, page, scale, onRendered }: {
  document: PDFDocumentProxy; page: number; scale: number; onRendered: (page: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const rendered = useRef(onRendered);
  useEffect(() => { rendered.current = onRendered; }, [onRendered]);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | undefined;
    const canvas = window.document.createElement('canvas');
    canvas.setAttribute('aria-label', `Trang ${page}`);
    canvas.setAttribute('role', 'img');
    void document.getPage(page).then(async pdfPage => {
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      task = pdfPage.render({ canvas, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      await task.promise;
      if (!cancelled) {
        container.current?.replaceChildren(canvas);
        setBusy(false); rendered.current(page);
      }
    }).catch(err => {
      if (!cancelled && err?.name !== 'RenderingCancelledException') {
        setError('Không thể hiển thị trang này. Hãy thử trang khác hoặc mở lại sách.'); setBusy(false);
      }
    });
    return () => { cancelled = true; task?.cancel(); canvas.remove(); };
  }, [document, page, scale]);

  return <>{error && <div className="book-error" role="alert">{error}</div>}{busy && <div className="reader-page-skeleton" aria-label="Đang chuẩn bị trang sách" />}<div ref={container} className="pdf-canvas" /></>;
}
