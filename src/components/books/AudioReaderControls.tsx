import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Square, X } from 'lucide-react';
import { booksApi, bookError } from '../../api/books';
import { narrationApi } from '../../api/narration';
import type { DocumentPage, DocumentSegment, ReadingPosition, ResumeSegment } from '../../types/book';
import type { NarratorProvider, NarratorVoice } from '../../types/narration';

type PlaybackState = 'idle' | 'preparing' | 'playing' | 'paused' | 'finished' | 'error';

interface SegmentCursor {
  pageNumber: number;
  blockIndex: number;
  segmentIndex: number;
  structureVersion: number;
  characterOffset?: number | null;
}

interface AudioReaderControlsProps {
  bookId: string;
  pageCount: number;
  visiblePage: number;
  onPageChange: (pageNumber: number) => void;
  onPositionChange: (position: ReadingPosition) => void;
  onClose: () => void;
}

interface VieNeuPlayback {
  context: AudioContext;
  controller: AbortController | null;
  sources: Set<AudioBufferSourceNode>;
  nextStart: number;
}

interface ResumeChoiceState {
  resume: ResumeSegment | null;
  savedPage: number;
  visiblePage: number;
  pausedPlayback: boolean;
}

const playbackLabels: Record<PlaybackState, string> = {
  idle: 'Sẵn sàng đọc từ tiến độ hiện tại',
  preparing: 'Đang chuẩn bị nội dung…',
  playing: 'Đang đọc',
  paused: 'Đã tạm dừng',
  finished: 'Đã đọc hết nội dung',
  error: 'Không thể đọc sách',
};

function audioError(error: unknown) {
  const message = bookError(error);
  if (message === 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.' && error instanceof Error) return error.message;
  return message;
}

export default function AudioReaderControls({
  bookId,
  pageCount,
  visiblePage,
  onPageChange,
  onPositionChange,
  onClose,
}: AudioReaderControlsProps) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<NarratorProvider>('browser');
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [browserVoiceUri, setBrowserVoiceUri] = useState('');
  const [vieNeuVoices, setVieNeuVoices] = useState<NarratorVoice[]>([]);
  const [vieNeuVoiceId, setVieNeuVoiceId] = useState('');
  const [loadingVieNeuVoices, setLoadingVieNeuVoices] = useState(false);
  const [resumeChoice, setResumeChoice] = useState<ResumeChoiceState | null>(null);
  const [rate, setRate] = useState(1);
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const pageCache = useRef(new Map<number, DocumentPage>());
  const cursorRef = useRef<SegmentCursor | null>(null);
  const runIdRef = useRef(0);
  const browserVoiceUriRef = useRef('');
  const vieNeuVoiceIdRef = useRef('');
  const rateRef = useRef(1);
  const vieNeuPlaybackRef = useRef<VieNeuPlayback | null>(null);
  const browserUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setBrowserVoices(available);
      setBrowserVoiceUri(current => {
        if (current && available.some(voice => voice.voiceURI === current)) return current;
        return available.find(voice => voice.lang.toLowerCase().startsWith('vi'))?.voiceURI
          ?? available[0]?.voiceURI
          ?? '';
      });
    };
    const timer = window.setTimeout(loadVoices, 0);
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      runIdRef.current += 1;
      window.speechSynthesis.cancel();
      browserUtteranceRef.current = null;
      const playback = vieNeuPlaybackRef.current;
      playback?.controller?.abort();
      playback?.sources.forEach(source => { try { source.stop(); } catch { /* Already stopped. */ } });
      if (playback) void playback.context.close();
      vieNeuPlaybackRef.current = null;
    };
  }, []);

  useEffect(() => { browserVoiceUriRef.current = browserVoiceUri; }, [browserVoiceUri]);
  useEffect(() => { vieNeuVoiceIdRef.current = vieNeuVoiceId; }, [vieNeuVoiceId]);
  useEffect(() => { rateRef.current = rate; }, [rate]);

  useEffect(() => {
    if (provider !== 'vieneu' || vieNeuVoices.length) return;
    const controller = new AbortController();
    void narrationApi.voices(controller.signal).then(available => {
      setVieNeuVoices(available);
      setVieNeuVoiceId(current => current || available[0]?.id || '');
      setError('');
    }).catch(err => {
      if (!controller.signal.aborted) setError(audioError(err));
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingVieNeuVoices(false);
    });
    return () => controller.abort();
  }, [provider, vieNeuVoices.length]);

  async function getPage(pageNumber: number) {
    const cached = pageCache.current.get(pageNumber);
    if (cached) return cached;
    const documentPage = await booksApi.structuredPage(bookId, pageNumber);
    pageCache.current.set(pageNumber, documentPage);
    return documentPage;
  }

  async function getSegment(cursor: SegmentCursor): Promise<DocumentSegment | null> {
    const documentPage = await getPage(cursor.pageNumber);
    return documentPage.blocks
      .find(block => block.index === cursor.blockIndex)?.segments
      .find(segment => segment.index === cursor.segmentIndex) ?? null;
  }

  async function findFirstCursor(startPage: number): Promise<SegmentCursor | null> {
    for (let pageNumber = Math.max(1, startPage); pageNumber <= pageCount; pageNumber += 1) {
      const cursor = await findFirstCursorOnPage(pageNumber);
      if (cursor) return cursor;
    }
    return null;
  }

  async function findFirstCursorOnPage(pageNumber: number): Promise<SegmentCursor | null> {
    const documentPage = await getPage(pageNumber);
    for (const block of documentPage.blocks) {
      const segment = block.segments.find(item => item.text.trim());
      if (segment) {
        return {
          pageNumber,
          blockIndex: block.index,
          segmentIndex: segment.index,
          structureVersion: documentPage.structureVersion,
          characterOffset: null,
        };
      }
    }
    return null;
  }

  async function findNextCursor(cursor: SegmentCursor): Promise<SegmentCursor | null> {
    const documentPage = await getPage(cursor.pageNumber);
    const blockPosition = documentPage.blocks.findIndex(block => block.index === cursor.blockIndex);
    if (blockPosition >= 0) {
      const block = documentPage.blocks[blockPosition];
      const segmentPosition = block.segments.findIndex(segment => segment.index === cursor.segmentIndex);
      const nextSegment = block.segments.slice(segmentPosition + 1).find(segment => segment.text.trim());
      if (nextSegment) {
        return { pageNumber: cursor.pageNumber, blockIndex: block.index, segmentIndex: nextSegment.index, structureVersion: documentPage.structureVersion, characterOffset: null };
      }
      for (const nextBlock of documentPage.blocks.slice(blockPosition + 1)) {
        const firstSegment = nextBlock.segments.find(segment => segment.text.trim());
        if (firstSegment) {
          return { pageNumber: cursor.pageNumber, blockIndex: nextBlock.index, segmentIndex: firstSegment.index, structureVersion: documentPage.structureVersion, characterOffset: null };
        }
      }
    }
    return findFirstCursor(cursor.pageNumber + 1);
  }

  function stopVieNeuPlayback() {
    const playback = vieNeuPlaybackRef.current;
    if (!playback) return;
    playback.controller?.abort();
    playback.sources.forEach(source => { try { source.stop(); } catch { /* Already stopped. */ } });
    void playback.context.close();
    vieNeuPlaybackRef.current = null;
  }

  function unlockVieNeuPlayback() {
    let playback = vieNeuPlaybackRef.current;
    if (!playback || playback.context.state === 'closed') {
      playback = {
        context: new AudioContext({ sampleRate: 48_000 }),
        controller: null,
        sources: new Set(),
        nextStart: 0,
      };
      vieNeuPlaybackRef.current = playback;
    }

    // Mobile browsers only allow Web Audio to start during a direct tap/click.
    // Resume and play one silent sample before any API request loses that gesture.
    if (playback.context.state !== 'running') void playback.context.resume().catch(() => undefined);
    const silentBuffer = playback.context.createBuffer(1, 1, 48_000);
    const silentSource = playback.context.createBufferSource();
    silentSource.buffer = silentBuffer;
    silentSource.connect(playback.context.destination);
    silentSource.start();
  }

  async function playVieNeuSegment(text: string, runId: number) {
    let playback = vieNeuPlaybackRef.current;
    if (!playback || playback.context.state === 'closed') {
      unlockVieNeuPlayback();
      playback = vieNeuPlaybackRef.current;
    }
    if (!playback) throw new Error('Trình duyệt không thể khởi tạo trình phát âm thanh.');

    const controller = new AbortController();
    playback.controller = controller;
    await playback.context.resume();
    if (playback.context.state !== 'running') {
      throw new Error('Trình duyệt đang chặn âm thanh. Hãy chạm Đọc sách lần nữa.');
    }
    const stream = await narrationApi.stream({ text, voiceId: vieNeuVoiceIdRef.current || null }, controller.signal);
    const reader = stream.getReader();
    let headerBytesLeft = 44;
    let leftoverByte: number | null = null;
    let pendingSources = 0;
    let streamFinished = false;
    let emittedAudio = false;
    let resolvePlayback!: () => void;
    const completed = new Promise<void>(resolve => { resolvePlayback = resolve; });
    const finishIfComplete = () => {
      if (streamFinished && pendingSources === 0) resolvePlayback();
    };

    try {
      while (runId === runIdRef.current) {
        const { done, value } = await reader.read();
        if (done) break;
        let bytes = value;
        if (headerBytesLeft > 0) {
          const skipped = Math.min(headerBytesLeft, bytes.length);
          headerBytesLeft -= skipped;
          bytes = bytes.subarray(skipped);
        }
        if (!bytes.length) continue;

        if (leftoverByte != null) {
          const combined = new Uint8Array(bytes.length + 1);
          combined[0] = leftoverByte;
          combined.set(bytes, 1);
          bytes = combined;
          leftoverByte = null;
        }
        if (bytes.length % 2) {
          leftoverByte = bytes[bytes.length - 1];
          bytes = bytes.subarray(0, bytes.length - 1);
        }
        if (!bytes.length) continue;

        const sampleCount = bytes.length / 2;
        const audioBuffer = playback.context.createBuffer(1, sampleCount, 48_000);
        const samples = audioBuffer.getChannelData(0);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (let index = 0; index < sampleCount; index += 1) {
          samples[index] = view.getInt16(index * 2, true) / 32768;
        }

        const source = playback.context.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = rateRef.current;
        source.connect(playback.context.destination);
        const startAt = Math.max(playback.context.currentTime + (emittedAudio ? 0.04 : 0.3), playback.nextStart);
        playback.nextStart = startAt + audioBuffer.duration / rateRef.current;
        playback.sources.add(source);
        pendingSources += 1;
        emittedAudio = true;
        source.onended = () => {
          playback?.sources.delete(source);
          pendingSources -= 1;
          finishIfComplete();
        };
        source.start(startAt);
      }
    } finally {
      streamFinished = true;
      playback.controller = null;
      reader.releaseLock();
      finishIfComplete();
    }

    if (!emittedAudio && runId === runIdRef.current) throw new Error('VieNeu không trả về dữ liệu âm thanh.');
    await completed;
  }

  async function speakCursor(cursor: SegmentCursor, runId: number): Promise<void> {
    try {
      const segment = await getSegment(cursor);
      if (runId !== runIdRef.current) return;
      if (!segment) throw new Error('Vị trí đọc không còn hợp lệ.');

      cursorRef.current = cursor;
      setCurrentPage(cursor.pageNumber);
      setError('');
      setPlaybackState('playing');
      onPageChange(cursor.pageNumber);
      onPositionChange({
        currentPage: cursor.pageNumber,
        currentBlockIndex: cursor.blockIndex,
        currentSegmentIndex: cursor.segmentIndex,
        characterOffset: cursor.characterOffset ?? null,
        structureVersion: cursor.structureVersion,
      });

      if (provider === 'vieneu') {
        await playVieNeuSegment(segment.text, runId);
        if (runId !== runIdRef.current) return;
        const nextCursor = await findNextCursor(cursor);
        if (!nextCursor) { cursorRef.current = null; setPlaybackState('finished'); return; }
        await speakCursor(nextCursor, runId);
      } else {
        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.rate = rateRef.current;
        const selectedVoice = browserVoices.find(voice => voice.voiceURI === browserVoiceUriRef.current);
        if (selectedVoice) { utterance.voice = selectedVoice; utterance.lang = selectedVoice.lang; }
        utterance.onend = () => {
          if (browserUtteranceRef.current === utterance) browserUtteranceRef.current = null;
          void (async () => {
            if (runId !== runIdRef.current) return;
            const nextCursor = await findNextCursor(cursor);
            if (runId !== runIdRef.current) return;
            if (!nextCursor) { cursorRef.current = null; setPlaybackState('finished'); return; }
            await speakCursor(nextCursor, runId);
          })();
        };
        utterance.onerror = event => {
          if (runId !== runIdRef.current || event.error === 'canceled' || event.error === 'interrupted') return;
          if (browserUtteranceRef.current === utterance) browserUtteranceRef.current = null;
          setError('Trình duyệt không thể phát đoạn này. Hãy thử giọng đọc khác.');
          setPlaybackState('error');
        };
        browserUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(audioError(err));
      setPlaybackState('error');
    }
  }

  async function start() {
    // Keep the page from the click moment. Nothing may navigate before this is compared.
    const requestedVisiblePage = visiblePage;
    if (provider === 'browser' && (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window))) {
      setError('Trình duyệt này chưa hỗ trợ đọc văn bản.');
      setPlaybackState('error');
      return;
    }
    if (playbackState === 'paused') {
      const savedPage = cursorRef.current?.pageNumber;
      if (savedPage && requestedVisiblePage !== savedPage) {
        setResumeChoice({ resume: null, savedPage, visiblePage: requestedVisiblePage, pausedPlayback: true });
        return;
      }
      if (provider === 'vieneu') await vieNeuPlaybackRef.current?.context.resume();
      else window.speechSynthesis.resume();
      setPlaybackState('playing');
      return;
    }

    const runId = ++runIdRef.current;
    window.speechSynthesis.cancel();
    browserUtteranceRef.current = null;
    stopVieNeuPlayback();
    setPlaybackState('preparing');
    setError('');
    try {
      if (provider === 'vieneu') unlockVieNeuPlayback();
      let structure = await booksApi.structure(bookId);
      if (structure.status !== 'Ready' && structure.status !== 'NoText') {
        structure = await booksApi.prepareStructure(bookId);
      }
      if (runId !== runIdRef.current) return;
      if (structure.status === 'NoText') throw new Error('PDF này không có văn bản có thể đọc bằng giọng nói.');
      if (structure.status !== 'Ready') throw new Error(structure.errorMessage || 'Chưa thể chuẩn bị nội dung sách.');

      const resume = await booksApi.resumeSegment(bookId);
      if (runId !== runIdRef.current) return;
      if (requestedVisiblePage !== resume.position.currentPage) {
        setResumeChoice({
          resume,
          savedPage: resume.position.currentPage,
          visiblePage: requestedVisiblePage,
          pausedPlayback: false,
        });
        setPlaybackState('idle');
        return;
      }
      await playFromResume(resume, runId);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(audioError(err));
      setPlaybackState('error');
    }
  }

  async function playFromResume(resume: ResumeSegment, runId: number) {
      const position = resume.position;
      let cursor: SegmentCursor | null = null;
      if (resume.segment && position.currentBlockIndex != null && position.currentSegmentIndex != null && position.structureVersion != null) {
        cursor = {
          pageNumber: position.currentPage,
          blockIndex: position.currentBlockIndex,
          segmentIndex: position.currentSegmentIndex,
          structureVersion: position.structureVersion,
          characterOffset: position.characterOffset,
        };
      }
      cursor ??= await findFirstCursor(position.currentPage);
      if (runId !== runIdRef.current) return;
      if (!cursor) throw new Error('Không tìm thấy nội dung văn bản từ trang hiện tại.');
      await speakCursor(cursor, runId);
  }

  async function chooseResume(useVisiblePage: boolean) {
    const choice = resumeChoice;
    if (!choice) return;
    if (!useVisiblePage && choice.pausedPlayback) {
      setResumeChoice(null);
      onPageChange(choice.savedPage);
      if (provider === 'vieneu') await vieNeuPlaybackRef.current?.context.resume();
      else window.speechSynthesis.resume();
      setPlaybackState('playing');
      return;
    }

    const runId = ++runIdRef.current;
    window.speechSynthesis.cancel();
    browserUtteranceRef.current = null;
    stopVieNeuPlayback();
    setResumeChoice(null);
    setPlaybackState('preparing');
    setError('');
    try {
      if (provider === 'vieneu') unlockVieNeuPlayback();
      if (useVisiblePage) {
        const cursor = await findFirstCursorOnPage(choice.visiblePage);
        if (runId !== runIdRef.current) return;
        if (!cursor) throw new Error(`Trang ${choice.visiblePage} không có nội dung văn bản có thể đọc.`);
        await speakCursor(cursor, runId);
      } else {
        if (!choice.resume) throw new Error('Không tìm thấy tiến độ nghe đã lưu.');
        await playFromResume(choice.resume, runId);
      }
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(audioError(err));
      setPlaybackState('error');
    }
  }

  function pause() {
    if (provider === 'vieneu') void vieNeuPlaybackRef.current?.context.suspend();
    else window.speechSynthesis.pause();
    setPlaybackState('paused');
  }
  function stop() {
    runIdRef.current += 1;
    window.speechSynthesis.cancel();
    browserUtteranceRef.current = null;
    stopVieNeuPlayback();
    cursorRef.current = null;
    setResumeChoice(null);
    setPlaybackState('idle');
    setError('');
  }
  function restartCurrentSegment(nextRate?: number, nextVoiceId?: string) {
    if (nextRate != null) rateRef.current = nextRate;
    if (nextVoiceId != null) {
      if (provider === 'vieneu') vieNeuVoiceIdRef.current = nextVoiceId;
      else browserVoiceUriRef.current = nextVoiceId;
    }
    if (playbackState !== 'playing' && playbackState !== 'paused') return;
    const cursor = cursorRef.current;
    if (!cursor) return;
    const runId = ++runIdRef.current;
    window.speechSynthesis.cancel();
    browserUtteranceRef.current = null;
    stopVieNeuPlayback();
    if (provider === 'vieneu') unlockVieNeuPlayback();
    void speakCursor(cursor, runId);
  }
  function close() { stop(); onClose(); }

  const canPause = playbackState === 'playing';
  return <section className="audio-reader" aria-label="Trình đọc sách bằng giọng nói">
    <div className="audio-reader-status">
      <span className={`audio-reader-indicator ${playbackState}`} aria-hidden="true" />
      <div><strong>{playbackLabels[playbackState]}</strong><span>{currentPage ? `Trang ${currentPage}/${pageCount} · Tiếp tục từ đoạn gần nhất` : 'Sẽ tiếp tục từ tiến độ gần nhất'}</span></div>
    </div>
    <div className="audio-reader-buttons">
      <button type="button" className="audio-reader-primary" onClick={canPause ? pause : () => void start()} disabled={playbackState === 'preparing' || resumeChoice != null}>
        {canPause ? <Pause size={18} /> : playbackState === 'finished' ? <RotateCcw size={18} /> : <Play size={18} />}
        <span>{canPause ? 'Tạm dừng' : playbackState === 'paused' ? 'Tiếp tục' : playbackState === 'finished' ? 'Đọc lại' : 'Đọc sách'}</span>
      </button>
      <button type="button" className="audio-reader-icon" onClick={stop} disabled={playbackState === 'idle'} aria-label="Dừng đọc"><Square size={16} /></button>
    </div>
    <label className="audio-reader-field"><span>Nguồn giọng</span><select value={provider} onChange={event => { const nextProvider = event.target.value as NarratorProvider; stop(); if (nextProvider === 'vieneu' && !vieNeuVoices.length) setLoadingVieNeuVoices(true); setProvider(nextProvider); }}>
      <option value="browser">Giọng trình duyệt</option><option value="vieneu">VieNeu v3 Turbo</option>
    </select></label>
    <label className="audio-reader-field"><span>Tốc độ</span><select value={rate} onChange={event => { const value = Number(event.target.value); setRate(value); restartCurrentSegment(value); }}>
      <option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option><option value={2}>2×</option>
    </select></label>
    {provider === 'vieneu'
      ? <label className="audio-reader-field audio-reader-voice"><span>Giọng VieNeu</span><select value={vieNeuVoiceId} disabled={loadingVieNeuVoices || !vieNeuVoices.length} onChange={event => { setVieNeuVoiceId(event.target.value); restartCurrentSegment(undefined, event.target.value); }}>
        {loadingVieNeuVoices && <option value="">Đang tải giọng…</option>}
        {!loadingVieNeuVoices && !vieNeuVoices.length && <option value="">VieNeu chưa sẵn sàng</option>}
        {vieNeuVoices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
      </select></label>
      : <label className="audio-reader-field audio-reader-voice"><span>Giọng trình duyệt</span><select value={browserVoiceUri} disabled={!browserVoices.length} onChange={event => { setBrowserVoiceUri(event.target.value); restartCurrentSegment(undefined, event.target.value); }}>
        {!browserVoices.length && <option value="">Giọng mặc định</option>}
        {browserVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
      </select></label>}
    <button type="button" className="audio-reader-close" onClick={close} aria-label="Đóng trình đọc"><X size={18} /></button>
    {resumeChoice && <div className="audio-resume-choice" role="dialog" aria-label="Chọn vị trí bắt đầu nghe">
      <p>Bạn đang xem trang {resumeChoice.visiblePage}. Muốn tiếp tục nghe từ đâu?</p>
      <button type="button" onClick={() => void chooseResume(false)}>Tiếp tục từ trang {resumeChoice.savedPage}</button>
      <button type="button" onClick={() => void chooseResume(true)}>Bắt đầu từ trang {resumeChoice.visiblePage}</button>
    </div>}
    {error && <p className="audio-reader-error" role="alert">{error}</p>}
  </section>;
}
