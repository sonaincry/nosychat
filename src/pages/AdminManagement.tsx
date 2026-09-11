import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BookOpen, Gamepad2, Home, MessageSquare, Mic2, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { adminApi } from '../api/admin';
import { narrationApi } from '../api/narration';
import { partiesApi, partyError } from '../api/parties';
import type { AdminOverview } from '../types/admin';
import type { UserAuth } from '../types/chat';
import type { NarratorVoice } from '../types/narration';
import type { Game } from '../types/party';
import '../styles/admin.css';

const emptyGame = { id: '', name: '', partySizes: [5] as number[], modes: '' };

export default function AdminManagement({ user }: { user: UserAuth }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [voices, setVoices] = useState<NarratorVoice[]>([]);
  const [gameForm, setGameForm] = useState(emptyGame);
  const [voiceName, setVoiceName] = useState('');
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [fileRevision, setFileRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [voiceError, setVoiceError] = useState('');

  const isAdmin = user.username.toLowerCase() === 'admin';

  async function loadCore(signal?: AbortSignal) {
    const [nextOverview, nextGames] = await Promise.all([adminApi.overview(signal), partiesApi.games()]);
    setOverview(nextOverview);
    setGames(nextGames);
  }

  async function loadVoices(signal?: AbortSignal) {
    try { setVoices(await narrationApi.voices(signal)); setVoiceError(''); }
    catch (err) { setVoiceError(partyError(err)); }
  }

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadCore(controller.signal).catch(err => { if (!controller.signal.aborted) setError(partyError(err)); });
      void loadVoices(controller.signal);
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  async function saveGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const modes = gameForm.modes.split(/[,\n]/).map(mode => mode.trim()).filter(Boolean);
    setBusy(true); setError('');
    try {
      if (gameForm.id) await partiesApi.updateGame(gameForm.id, gameForm.name.trim(), gameForm.partySizes, modes);
      else await partiesApi.createGame(gameForm.name.trim(), gameForm.partySizes, modes);
      setGameForm(emptyGame);
      await loadCore();
    } catch (err) { setError(partyError(err)); }
    finally { setBusy(false); }
  }

  async function deleteGame(game: Game) {
    if (!window.confirm(`Xóa trò chơi “${game.name}”?`)) return;
    setBusy(true); setError('');
    try { await partiesApi.deleteGame(game.id); await loadCore(); }
    catch (err) { setError(partyError(err)); }
    finally { setBusy(false); }
  }

  async function addVoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!voiceFile || !voiceName.trim()) return;
    setBusy(true); setVoiceError('');
    try {
      await narrationApi.addVoice(voiceName.trim(), voiceFile);
      setVoiceName(''); setVoiceFile(null); setFileRevision(value => value + 1);
      await loadVoices();
    } catch (err) { setVoiceError(partyError(err)); }
    finally { setBusy(false); }
  }

  async function deleteVoice(voice: NarratorVoice) {
    if (!window.confirm(`Xóa giọng “${voice.name}”?`)) return;
    setBusy(true); setVoiceError('');
    try { await narrationApi.deleteVoice(voice.id); await loadVoices(); }
    catch (err) { setVoiceError(partyError(err)); }
    finally { setBusy(false); }
  }

  const clonedVoices = voices.filter(voice => voice.isCloned);
  return <div className="admin-shell"><div className="admin-window">
    <aside className="admin-rail"><Link className="admin-brand" to="/admin"><ShieldCheck /></Link><nav><Link className="active" to="/admin" title="Admin"><Home /></Link><Link to="/" title="Chat"><MessageSquare /></Link><Link to="/books" title="Sách"><BookOpen /></Link><Link to="/parties" title="Party"><Gamepad2 /></Link></nav></aside>
    <main className="admin-main">
      <header className="admin-header"><div><p>ADMIN MANAGEMENT</p><h1>Quản trị Nosy</h1><span>Tổng quan tài khoản, giọng đọc và cấu hình Matching.</span></div><strong>@{user.username}</strong></header>
      {error && <div className="admin-error" role="alert">{error}</div>}
      <section className="admin-stats"><article><Users /><span>Người dùng</span><strong>{overview?.totalUsers ?? '—'}</strong></article><article><Gamepad2 /><span>Trò chơi</span><strong>{games.length}</strong></article><article><Mic2 /><span>Giọng nhân bản</span><strong>{clonedVoices.length}</strong></article></section>

      <section className="admin-card admin-games"><div className="admin-section-heading"><div><p>MATCHING</p><h2>Quản lý trò chơi</h2></div><button onClick={() => setGameForm(emptyGame)}><Plus size={16} /> Thêm mới</button></div>
        <form className="admin-game-form" onSubmit={event => void saveGame(event)}><label>Tên trò chơi<input required maxLength={100} value={gameForm.name} onChange={event => setGameForm({ ...gameForm, name: event.target.value })} /></label><fieldset><legend>Số người được phép</legend><div className="admin-size-picker">{Array.from({ length: 10 }, (_, index) => index + 1).map(size => <label key={size}><input type="checkbox" checked={gameForm.partySizes.includes(size)} onChange={() => setGameForm(current => ({ ...current, partySizes: current.partySizes.includes(size) ? current.partySizes.filter(value => value !== size) : [...current.partySizes, size].sort((a, b) => a - b) }))} /><span>{size}</span></label>)}</div></fieldset><label>Modes <small>Phân cách bằng dấu phẩy hoặc xuống dòng</small><textarea placeholder="Premier, Matchmaking, Faceit" value={gameForm.modes} onChange={event => setGameForm({ ...gameForm, modes: event.target.value })} /></label><div className="admin-form-actions">{gameForm.id && <button type="button" onClick={() => setGameForm(emptyGame)}>Hủy sửa</button>}<button className="admin-primary" disabled={busy || !gameForm.name.trim() || !gameForm.partySizes.length}>{gameForm.id ? 'Lưu thay đổi' : 'Tạo trò chơi'}</button></div></form>
        <div className="admin-game-list">{games.map(game => <article key={game.id}><div><strong>{game.name}</strong><span>{game.partySizes.join(', ')} người</span></div><p>{game.modes.length ? game.modes.map(mode => mode.name).join(' · ') : 'Chưa cấu hình mode'}</p><div><button title="Sửa" onClick={() => setGameForm({ id: game.id, name: game.name, partySizes: game.partySizes, modes: game.modes.map(mode => mode.name).join(', ') })}><Pencil size={15} /></button><button className="danger" title="Xóa" disabled={busy} onClick={() => void deleteGame(game)}><Trash2 size={15} /></button></div></article>)}</div>
      </section>

      <section className="admin-card"><div className="admin-section-heading"><div><p>VIENEU V3 TURBO</p><h2>Giọng nhân bản</h2></div></div>{voiceError && <div className="admin-error" role="alert">{voiceError}</div>}<form className="admin-voice-form" onSubmit={event => void addVoice(event)}><input required maxLength={80} placeholder="Tên giọng" value={voiceName} onChange={event => setVoiceName(event.target.value)} /><input key={fileRevision} required type="file" accept="audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/mp4,.mp3,.wav,.flac,.ogg,.m4a" onChange={event => setVoiceFile(event.target.files?.[0] ?? null)} /><button className="admin-primary" disabled={busy || !voiceFile || !voiceName.trim()}>Thêm giọng</button></form><div className="admin-voice-list">{clonedVoices.map(voice => <div key={voice.id}><span><Mic2 size={16} /><strong>{voice.name}</strong></span><button disabled={busy} onClick={() => void deleteVoice(voice)}><Trash2 size={15} /> Xóa</button></div>)}{!clonedVoices.length && <p>Chưa có giọng nhân bản.</p>}</div></section>

      <section className="admin-card"><div className="admin-section-heading"><div><p>ACCOUNTS</p><h2>Người dùng</h2></div></div><div className="admin-user-table"><div className="head"><span>Tài khoản</span><span>Trạng thái</span><span>Ngày tạo</span></div>{overview?.users.map(account => <div key={account.id}><span><strong>{account.displayName}</strong><small>@{account.username}</small></span><span className={account.isOnline ? 'online' : ''}>{account.isOnline ? 'Online' : 'Offline'}</span><time>{new Date(account.createdAt).toLocaleDateString('vi-VN')}</time></div>)}</div></section>
    </main>
  </div></div>;
}
