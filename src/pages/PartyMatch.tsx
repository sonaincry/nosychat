import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HubConnection } from '@microsoft/signalr';
import { Bell, BookOpen, Clock3, Gamepad2, Headphones, Heart, Home, MessageSquare, ShieldCheck, Upload, Users, X } from 'lucide-react';
import { partiesApi, partyError } from '../api/parties';
import Avatar from '../components/Avatar';
import type { UserAuth } from '../types/chat';
import type { Game, Party, PartyNotification, PlayerGame, SwipeProfile } from '../types/party';
import '../styles/party.css';

interface Props { user: UserAuth; hubConnection: HubConnection | null; }

const emptyProfile = {
  gameId: '', rank: '', preferredRole: '', serverRegion: '', language: 'Tiếng Việt',
  voiceChatAvailable: false, bio: '', photoUrls: [] as string[], preferredPlayTime: '',
};

export default function PartyMatch({ user, hubConnection }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [profiles, setProfiles] = useState<PlayerGame[]>([]);
  const [notifications, setNotifications] = useState<PartyNotification[]>([]);
  const [swipeGameId, setSwipeGameId] = useState('');
  const [targetCount, setTargetCount] = useState(0);
  const [candidates, setCandidates] = useState<SwipeProfile[]>([]);
  const [profile, setProfile] = useState(emptyProfile);
  const [selected, setSelected] = useState<Party | null>(null);
  const [matchedParty, setMatchedParty] = useState<Party | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [gameName, setGameName] = useState('');
  const [gameSizes, setGameSizes] = useState<number[]>([5]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = user.username.toLowerCase() === 'admin' || user.displayName.toLowerCase() === 'admin';
  const selectedGame = games.find(game => game.id === swipeGameId);
  const candidate = candidates[0];
  const unreadCount = notifications.filter(item => !item.isRead).length;
  const myParties = useMemo(() => parties.filter(party => party.isMember), [parties]);

  const loadDashboard = useCallback(async () => {
    try {
      const [nextGames, nextParties, nextProfiles, nextNotifications] = await Promise.all([
        partiesApi.games(), partiesApi.browse({}), partiesApi.playerGames(), partiesApi.notifications(),
      ]);
      setGames(nextGames);
      setParties(nextParties);
      setProfiles(nextProfiles);
      setNotifications(nextNotifications);
      setSwipeGameId(current => current || nextGames[0]?.id || '');
      setTargetCount(current => current || nextGames[0]?.partySizes.find(size => size >= 2) || 0);
      setError('');
    } catch (err) { setError(partyError(err)); }
  }, []);

  const loadCandidates = useCallback(async () => {
    if (!swipeGameId || targetCount < 2) { setCandidates([]); return; }
    setLoadingCandidates(true);
    try { setCandidates(await partiesApi.swipeCandidates(swipeGameId, targetCount)); setError(''); }
    catch (err) { setCandidates([]); setError(partyError(err)); }
    finally { setLoadingCandidates(false); }
  }, [swipeGameId, targetCount]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadCandidates(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCandidates]);
  useEffect(() => {
    if (!hubConnection) return;
    const changed = () => void loadDashboard();
    hubConnection.on('PartyChanged', changed);
    hubConnection.on('PartyNotification', changed);
    return () => { hubConnection.off('PartyChanged', changed); hubConnection.off('PartyNotification', changed); };
  }, [hubConnection, loadDashboard]);

  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setError('');
    try { await action(); await loadDashboard(); after?.(); }
    catch (err) { setError(partyError(err)); }
    finally { setBusy(false); }
  };

  const handleSwipe = async (liked: boolean) => {
    if (!candidate) return;
    setBusy(true); setError('');
    try {
      const result = await partiesApi.swipe(candidate.userId, swipeGameId, targetCount, liked);
      setCandidates(current => current.slice(1));
      if (result.isMutualMatch && result.party) setMatchedParty(result.party);
      await loadDashboard();
    } catch (err) { setError(partyError(err)); }
    finally { setBusy(false); }
  };

  const openProfile = (gameId = swipeGameId || games[0]?.id || '') => {
    const saved = profiles.find(item => item.gameId === gameId);
    setProfile(saved ? {
      gameId: saved.gameId, rank: saved.rank ?? '', preferredRole: saved.preferredRole ?? '',
      serverRegion: saved.serverRegion, language: saved.language,
      voiceChatAvailable: saved.voiceChatAvailable, bio: saved.bio ?? '',
      photoUrls: saved.photoUrls, preferredPlayTime: saved.preferredPlayTime ?? '',
    } : { ...emptyProfile, gameId });
    setShowProfile(true);
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file || profile.photoUrls.length >= 4) return;
    setBusy(true);
    try {
      const url = await partiesApi.uploadProfilePhoto(file);
      setProfile(current => ({ ...current, photoUrls: [...current.photoUrls, url].slice(0, 4) }));
    } catch (err) { setError(partyError(err)); }
    finally { setBusy(false); }
  };

  return <div className="party-shell"><div className="party-window">
    <aside className="party-rail">
      <Link to="/parties" className="party-brand"><Gamepad2 size={28} /></Link>
      <nav><Link to="/parties" className="active" title="Party Match"><Home /></Link><Link to="/" title="Chat"><MessageSquare /></Link><Link to="/books" title="Thư viện"><BookOpen /></Link></nav>
    </aside>

    <main className="party-main">
      <header className="party-header">
        <div><p className="party-eyebrow">PARTY MATCH</p><h1>Quẹt đúng người. Lập team ngay.</h1></div>
        <div className="party-header-actions">
          <button className="party-icon-button" onClick={() => setShowNotifications(value => !value)} title="Thông báo"><Bell size={20} />{unreadCount > 0 && <span>{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
          <Link to={`/profile/${user.userId}`} className="party-user"><Avatar url={user.avatarUrl} name={user.displayName} size={36} /><strong>{user.displayName}</strong></Link>
        </div>
      </header>

      {showNotifications && <section className="party-notifications">
        <div className="party-section-title"><h2>Thông báo</h2><button onClick={() => setShowNotifications(false)}><X size={18} /></button></div>
        {notifications.length === 0 ? <p>Chưa có thông báo.</p> : notifications.map(item => <button key={item.id} className={item.isRead ? '' : 'unread'} onClick={() => run(() => partiesApi.readNotification(item.id))}><span>{item.message}</span><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></button>)}
      </section>}

      <section className="party-hero party-swipe-hero">
        <div><span className="party-pill"><Users size={15} /> Match đồng đội, không phải hẹn hò</span><h2>Một cú quẹt.<br />Một party mới.</h2><p>Chỉ cần mutual match với một thành viên. Party tự mở rộng và tự tạo group chat.</p></div>
        <div className="party-hero-actions"><button className="party-secondary" onClick={() => openProfile()}><ShieldCheck size={18} /> Hồ sơ game</button>{isAdmin && <button className="party-secondary" onClick={() => setShowAdmin(true)}>Quản lý game</button>}</div>
      </section>

      {error && <div className="party-error" role="alert">{error}<button onClick={() => { void loadDashboard(); void loadCandidates(); }}>Thử lại</button></div>}

      <section className="swipe-workspace">
        <div className="swipe-settings">
          <p className="party-eyebrow">TÌM ĐỒNG ĐỘI</p><h2>Chọn trận đấu</h2>
          <label>Game<select value={swipeGameId} onChange={event => { const game = games.find(item => item.id === event.target.value); setSwipeGameId(event.target.value); setTargetCount(game?.partySizes.find(size => size >= 2) ?? 0); }}>{games.map(game => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
          <label>Target players<select value={targetCount} onChange={event => setTargetCount(Number(event.target.value))}>{selectedGame?.partySizes.filter(size => size >= 2).map(size => <option key={size} value={size}>{size} người</option>)}</select></label>
          <div className="swipe-tip"><Heart size={18} /><p>Mutual match với bất kỳ thành viên nào cũng đủ để vào Party đang tìm người.</p></div>
        </div>

        <div className="swipe-deck">
          {loadingCandidates ? <div className="party-empty">Đang tìm người chơi…</div> : !candidate ? <div className="party-empty"><Gamepad2 size={40} /><h3>Đã xem hết hồ sơ phù hợp</h3><p>Cập nhật hồ sơ hoặc thử game và số người khác.</p></div> : <article className="swipe-card">
            <div className="swipe-photo">{candidate.photoUrls[0] || candidate.avatarUrl ? <img src={candidate.photoUrls[0] || candidate.avatarUrl || ''} alt={candidate.displayName} /> : <Avatar url={null} name={candidate.displayName} size={100} />}<span className="swipe-online">@{candidate.username}</span></div>
            <div className="swipe-card-copy"><h2>{candidate.displayName}</h2><div className="party-tags"><span>{candidate.serverRegion}</span><span>{candidate.language}</span>{candidate.rank && <span>{candidate.rank}</span>}{candidate.preferredRole && <span>{candidate.preferredRole}</span>}</div>{candidate.bio && <p>{candidate.bio}</p>}<div className="swipe-meta">{candidate.voiceChatAvailable && <span><Headphones size={15} /> Có voice chat</span>}{candidate.preferredPlayTime && <span><Clock3 size={15} /> {candidate.preferredPlayTime}</span>}</div></div>
            <div className="swipe-actions"><button disabled={busy} className="swipe-pass" onClick={() => void handleSwipe(false)} title="Bỏ qua"><X /></button><button disabled={busy} className="swipe-like" onClick={() => void handleSwipe(true)} title="Thích"><Heart fill="currentColor" /></button></div>
          </article>}
        </div>
      </section>

      <div className="party-section-title"><div><p className="party-eyebrow">PARTY CỦA BẠN</p><h2>{myParties.length} đội đang hoạt động</h2></div></div>
      {myParties.length === 0 ? <div className="party-empty"><Users size={38} /><h3>Chưa có party</h3><p>Mutual match đầu tiên sẽ tự động tạo Party và ChatGroup.</p></div> : <div className="party-grid">{myParties.map(party => <article className="party-card" key={party.id}>
        <div className="party-card-top"><span className={`party-state state-${party.state.toLowerCase()}`}>{party.state}</span><strong>{party.currentSize} / {party.desiredSize}</strong></div><h3>{party.gameName}</h3>
        <div className="party-tags"><span>{party.serverRegion}</span><span>{party.language}</span>{party.rank && <span>{party.rank}</span>}</div>
        <div className="party-slots">{Array.from({ length: party.desiredSize }, (_, index) => <span key={index} className={index < party.currentSize ? 'filled' : ''}>{index < party.members.length ? party.members[index].displayName.charAt(0) : '+'}</span>)}</div>
        <button className="party-secondary" onClick={() => setSelected(party)}>Xem Party</button>
      </article>)}</div>}
    </main>

    {matchedParty && <div className="party-modal-backdrop"><section className="party-modal match-modal"><div className="match-hearts"><Heart fill="currentColor" /><Gamepad2 /></div><p className="party-eyebrow">MUTUAL MATCH</p><h2>Party đã sẵn sàng cho hai bạn!</h2><p>{matchedParty.gameName} · {matchedParty.currentSize}/{matchedParty.desiredSize}. ChatGroup đã được tạo tự động.</p><div className="party-modal-actions"><button className="party-secondary" onClick={() => setMatchedParty(null)}>Tiếp tục quẹt</button><Link className="party-primary" to="/">Mở chat</Link></div></section></div>}

    {selected && <div className="party-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setSelected(null)}><section className="party-modal party-detail"><button className="party-modal-close" onClick={() => setSelected(null)}><X /></button><p className="party-eyebrow">{selected.state}</p><h2>{selected.gameName} · {selected.currentSize}/{selected.desiredSize}</h2><div className="party-member-list">{selected.members.map(member => <div key={member.userId}><Avatar url={member.avatarUrl} name={member.displayName} size={38} /><span><strong>{member.displayName}{member.isLeader && ' · Leader'}</strong><small>{member.isOnline ? 'Online' : 'Offline'} · @{member.username}</small></span>{selected.leaderId === user.userId && !member.isLeader && <button onClick={() => run(() => partiesApi.removeMember(selected.id, member.userId))}>Xóa</button>}</div>)}</div><div className="party-modal-actions"><Link className="party-primary" to="/"><MessageSquare size={17} /> Mở group chat</Link>{selected.leaderId === user.userId && selected.state === 'Ready' && <button className="party-primary" onClick={() => run(() => partiesApi.startPlaying(selected.id))}>Bắt đầu chơi</button>}{selected.leaderId === user.userId ? <button className="party-danger" onClick={() => run(() => partiesApi.close(selected.id), () => setSelected(null))}>Kết thúc Party</button> : <button className="party-danger" onClick={() => run(() => partiesApi.leave(selected.id), () => setSelected(null))}>Rời Party</button>}</div></section></div>}

    {showProfile && <div className="party-modal-backdrop"><form className="party-modal" onSubmit={event => { event.preventDefault(); void run(() => partiesApi.savePlayerGame(profile), () => { setShowProfile(false); void loadCandidates(); }); }}><button type="button" className="party-modal-close" onClick={() => setShowProfile(false)}><X /></button><p className="party-eyebrow">HỒ SƠ NGƯỜI CHƠI</p><h2>Cho đồng đội biết về bạn</h2><label>Game<select required value={profile.gameId} onChange={event => openProfile(event.target.value)}>{games.map(game => <option value={game.id} key={game.id}>{game.name}</option>)}</select></label><label>Bio<textarea maxLength={500} value={profile.bio} onChange={event => setProfile({ ...profile, bio: event.target.value })} placeholder="Phong cách chơi, mục tiêu, tính cách…" /></label><div className="party-form-row"><label>Rank<input value={profile.rank} onChange={event => setProfile({ ...profile, rank: event.target.value })} /></label><label>Preferred role<input value={profile.preferredRole} onChange={event => setProfile({ ...profile, preferredRole: event.target.value })} /></label></div><div className="party-form-row"><label>Server / Region<input required value={profile.serverRegion} onChange={event => setProfile({ ...profile, serverRegion: event.target.value })} /></label><label>Languages<input required value={profile.language} onChange={event => setProfile({ ...profile, language: event.target.value })} placeholder="Tiếng Việt, English" /></label></div><label>Preferred play time<input value={profile.preferredPlayTime} onChange={event => setProfile({ ...profile, preferredPlayTime: event.target.value })} placeholder="20:00–23:00, cuối tuần…" /></label><div><span className="party-field-label">Ảnh hồ sơ · tối đa 4</span><div className="profile-photo-list">{profile.photoUrls.map((url, index) => <span key={url}><img src={url} alt={`Ảnh ${index + 1}`} /><button type="button" onClick={() => setProfile(current => ({ ...current, photoUrls: current.photoUrls.filter(photo => photo !== url) }))}><X /></button></span>)}{profile.photoUrls.length < 4 && <label className="profile-photo-upload"><Upload /><input type="file" accept="image/*" onChange={event => { void handlePhotoUpload(event.target.files?.[0]); event.target.value = ''; }} /></label>}</div></div><label className="party-check"><input type="checkbox" checked={profile.voiceChatAvailable} onChange={event => setProfile({ ...profile, voiceChatAvailable: event.target.checked })} /> Có thể dùng voice chat</label><button className="party-primary" disabled={busy}>Lưu hồ sơ</button></form></div>}

    {showAdmin && <div className="party-modal-backdrop"><form className="party-modal" onSubmit={event => { event.preventDefault(); void run(() => partiesApi.createGame(gameName, gameSizes), () => { setShowAdmin(false); setGameName(''); setGameSizes([5]); }); }}><button type="button" className="party-modal-close" onClick={() => setShowAdmin(false)}><X /></button><p className="party-eyebrow">ADMIN</p><h2>Thêm trò chơi mới</h2><label>Tên trò chơi<input required maxLength={100} value={gameName} onChange={event => setGameName(event.target.value)} /></label><fieldset><legend>Số người được phép</legend><div className="party-size-picker">{Array.from({ length: 10 }, (_, index) => index + 1).map(size => <label key={size}><input type="checkbox" checked={gameSizes.includes(size)} onChange={() => setGameSizes(current => current.includes(size) ? current.filter(item => item !== size) : [...current, size].sort((a, b) => a - b))} /><span>{size}</span></label>)}</div></fieldset><button className="party-primary" disabled={busy || gameSizes.length === 0}>Tạo trò chơi</button></form></div>}
  </div></div>;
}
