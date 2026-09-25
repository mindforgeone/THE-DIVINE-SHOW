import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { Award, Check, MessageCircle, Plus, Send, ShieldCheck, Swords, UserPlus, Users, X } from 'lucide-react';
import { db } from '../firebase';
import { calculateStats, createId, getCurrentDayIndex, number, todayKey } from '../marathon/model';

const friendshipId = (first, second) => [first, second].sort().join('__');

export default function CommunityModule({ user, privateState }) {
  const [tab, setTab] = useState('people');
  const [profiles, setProfiles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const uid = user.uid;

  const publicProfile = useMemo(() => {
    const currentIndex = privateState?.startDate ? getCurrentDayIndex(privateState.startDate, todayKey(), privateState.durationDays) : 0;
    const stats = privateState?.days ? calculateStats(privateState, currentIndex, 'all') : null;
    const profile = privateState?.profile || {};
    const latestWeight = stats?.lastWeight || number(profile.currentWeight);
    return {
      uid,
      displayName: profile.displayName || user.displayName || 'Участник',
      photoUrl: profile.photoUrl || user.photoURL || '',
      bio: profile.bio || '',
      discoverable: profile.discoverable !== false,
      shareProgress: profile.shareProgress !== false,
      shareWeight: Boolean(profile.shareWeight),
      durationDays: privateState?.durationDays || null,
      journeyDay: privateState?.startDate ? currentIndex + 1 : 0,
      completionRate: profile.shareProgress !== false ? stats?.completionRate || 0 : null,
      strongDays: profile.shareProgress !== false ? (stats?.resultCounts?.strong || 0) + (stats?.resultCounts?.expansion || 0) : null,
      totalSteps: profile.shareProgress !== false ? stats?.steps?.reduce((sum, item) => sum + item.value, 0) || 0 : null,
      currentWeight: profile.shareWeight ? latestWeight || null : null,
      weightDelta: profile.shareWeight ? stats?.weightDelta || 0 : null,
      updatedAtClient: new Date().toISOString(),
    };
  }, [privateState, uid, user.displayName, user.photoURL]);

  useEffect(() => {
    if (!db || !uid) return undefined;
    setDoc(doc(db, 'publicProfiles', uid), { ...publicProfile, updatedAt: serverTimestamp() }, { merge: true }).catch(() => setNotice('Публичный профиль пока не синхронизирован. Личные данные не затронуты.'));
    const unsubscribers = [
      onSnapshot(collection(db, 'publicProfiles'), (snapshot) => setProfiles(snapshot.docs.map((item) => item.data()).filter((item) => item.discoverable !== false))),
      onSnapshot(query(collection(db, 'friendRequests'), where('participants', 'array-contains', uid)), (snapshot) => setRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) )),
      onSnapshot(query(collection(db, 'friendships'), where('members', 'array-contains', uid)), (snapshot) => setFriendships(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) )),
      onSnapshot(query(collection(db, 'conversations'), where('members', 'array-contains', uid)), (snapshot) => setConversations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) )),
      onSnapshot(query(collection(db, 'challenges'), where('participants', 'array-contains', uid)), (snapshot) => setChallenges(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) )),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [publicProfile, uid]);

  useEffect(() => {
    if (!activeChat) return undefined;
    return onSnapshot(query(collection(db, 'conversations', activeChat.id, 'messages'), orderBy('createdAtClient', 'asc')), (snapshot) => setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
  }, [activeChat]);

  const profileById = (id) => profiles.find((item) => item.uid === id) || { uid: id, displayName: 'Участник', photoUrl: '' };
  const friendIds = friendships.flatMap((item) => item.members || []).filter((id) => id !== uid);
  const pendingByUser = (id) => requests.find((item) => item.status === 'pending' && item.participants?.includes(id));
  const requestFriend = async (to) => {
    const id = friendshipId(uid, to);
    await setDoc(doc(db, 'friendRequests', id), { from: uid, to, participants: [uid, to], status: 'pending', createdAtClient: new Date().toISOString(), createdAt: serverTimestamp() });
  };
  const answerRequest = async (request, accepted) => {
    if (!accepted) { await updateDoc(doc(db, 'friendRequests', request.id), { status: 'declined', answeredAt: serverTimestamp() }); return; }
    const batch = writeBatch(db);
    batch.update(doc(db, 'friendRequests', request.id), { status: 'accepted', answeredAt: serverTimestamp() });
    batch.set(doc(db, 'friendships', friendshipId(request.from, request.to)), { members: [request.from, request.to], createdAt: serverTimestamp(), createdAtClient: new Date().toISOString() });
    await batch.commit();
  };
  const openChat = async (friendUid) => {
    const id = `dm__${friendshipId(uid, friendUid)}`;
    const conversation = { id, members: [uid, friendUid], type: 'direct', title: '', createdAtClient: new Date().toISOString() };
    await setDoc(doc(db, 'conversations', id), { ...conversation, updatedAt: serverTimestamp() }, { merge: true });
    setActiveChat(conversation);
    setTab('messages');
  };
  const send = async () => {
    if (!activeChat || !text.trim()) return;
    const value = text.trim(); setText('');
    await addDoc(collection(db, 'conversations', activeChat.id, 'messages'), { senderId: uid, text: value, createdAtClient: new Date().toISOString(), createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'conversations', activeChat.id), { lastMessage: value.slice(0, 120), updatedAt: serverTimestamp() });
  };

  return <div className="grid gap-4"><section className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><div className="flex items-center gap-3"><Users size={22} className="text-[#0d8b71]" /><div><div className="text-sm font-black text-[#0d735f]">Вместе</div><h1 className="text-2xl font-black">Друзья и честные вызовы</h1></div></div><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Здесь сравнивается верность личному плану. Вес и фото видны только если человек сам это разрешил.</p><div className="mt-4 grid grid-cols-3 gap-1 bg-[#edf4f2] p-1 rounded-md">{[['people', 'Люди'], ['messages', 'Сообщения'], ['challenges', 'Вызовы']].map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-10 text-xs font-black rounded-sm ${tab === id ? 'bg-[#15333b] text-white' : 'text-slate-500'}`}>{label}</button>)}</div></section>{notice && <div className="border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800 rounded-md">{notice}</div>}
    {tab === 'people' && <People profiles={profiles.filter((item) => item.uid !== uid)} requests={requests} friendIds={friendIds} currentUid={uid} pendingByUser={pendingByUser} onRequest={requestFriend} onAnswer={answerRequest} onMessage={openChat} />}
    {tab === 'messages' && <Messages conversations={conversations} active={activeChat} messages={messages} uid={uid} profileById={profileById} text={text} onText={setText} onOpen={setActiveChat} onSend={send} />}
    {tab === 'challenges' && <Challenges items={challenges} uid={uid} profileById={profileById} friendIds={friendIds} onOpen={() => setChallengeOpen(true)} onChat={(item) => { setActiveChat({ id: item.chatId, members: item.participants, title: item.title, type: 'challenge' }); setTab('messages'); }} />}
    {challengeOpen && <ChallengeEditor friendIds={friendIds} profileById={profileById} onClose={() => setChallengeOpen(false)} onSave={async (draft) => { const id = createId('challenge'); const participants = [uid, ...draft.participants]; const chatId = `challenge__${id}`; const batch = writeBatch(db); batch.set(doc(db, 'challenges', id), { ...draft, createdBy: uid, participants, chatId, status: 'active', createdAtClient: new Date().toISOString(), createdAt: serverTimestamp() }); batch.set(doc(db, 'conversations', chatId), { members: participants, title: draft.title, type: 'challenge', createdAtClient: new Date().toISOString(), createdAt: serverTimestamp() }); await batch.commit(); setChallengeOpen(false); }} />}
  </div>;
}

function People({ profiles, requests, friendIds, currentUid, pendingByUser, onRequest, onAnswer, onMessage }) {
  const incoming = requests.filter((item) => item.to === currentUid && item.status === 'pending');
  return <div className="grid gap-4">{incoming.length > 0 && <section className="border border-[#b9ddd3] bg-[#eaf8f4] p-4 rounded-lg"><h2 className="font-black">Запросы в друзья</h2><div className="mt-3 grid gap-2">{incoming.map((request) => <div key={request.id} className="flex items-center gap-3 bg-white p-3 rounded-md"><span className="flex-1 font-black">Новый запрос</span><button type="button" onClick={() => onAnswer(request, true)} className="icon-command text-emerald-600" title="Принять"><Check size={17} /></button><button type="button" onClick={() => onAnswer(request, false)} className="icon-command danger" title="Отклонить"><X size={17} /></button></div>)}</div></section>}<section className="grid gap-3 sm:grid-cols-2">{profiles.map((profile) => { const friend = friendIds.includes(profile.uid); const pending = pendingByUser(profile.uid); return <ProfileCard key={profile.uid} profile={profile}>{friend ? <button type="button" onClick={() => onMessage(profile.uid)} className="inline-flex min-h-10 items-center gap-2 bg-[#15333b] px-3 text-sm font-black text-white rounded-md"><MessageCircle size={16} />Написать</button> : <button type="button" disabled={Boolean(pending)} onClick={() => onRequest(profile.uid)} className="inline-flex min-h-10 items-center gap-2 border border-[#b9ddd3] bg-[#eaf8f4] px-3 text-sm font-black text-[#0d735f] disabled:opacity-60 rounded-md"><UserPlus size={16} />{pending ? 'Запрос отправлен' : 'Добавить'}</button>}</ProfileCard>; })}{!profiles.length && <Empty text="Другие участники появятся здесь после входа во вкладку «Друзья»." />}</section></div>;
}

function ProfileCard({ profile, children }) { const medals = [profile.strongDays >= 7 && '7 сильных дней', profile.completionRate >= 80 && 'Курс 80%+', profile.totalSteps >= 100000 && '100 000 шагов'].filter(Boolean); return <article className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><div className="flex items-start gap-3"><img src={profile.photoUrl || ''} alt="" className="h-14 w-14 bg-[#dfeae7] object-cover rounded-md" /><div className="min-w-0 flex-1"><h2 className="truncate font-black">{profile.displayName}</h2><p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{profile.bio || 'Идёт своим маршрутом'}</p></div></div><div className="mt-3 grid grid-cols-3 gap-1 text-center"><Mini label="День" value={profile.journeyDay || '—'} /><Mini label="План" value={profile.completionRate === null ? 'скрыто' : `${profile.completionRate || 0}%`} /><Mini label="Вес" value={profile.currentWeight ? `${profile.currentWeight} кг` : 'скрыто'} /></div>{medals.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{medals.map((medal) => <span key={medal} className="inline-flex items-center gap-1 bg-[#fff7dc] px-2 py-1 text-[10px] font-black text-[#8b6b16] rounded-sm"><Award size={12} />{medal}</span>)}</div>}<div className="mt-3">{children}</div></article>; }
function Mini({ label, value }) { return <span className="bg-[#f4f8f7] p-2 text-[10px] font-bold text-slate-500 rounded-sm">{label}<strong className="mt-1 block text-xs text-[#15333b]">{value}</strong></span>; }

function Messages({ conversations, active, messages, uid, profileById, text, onText, onOpen, onSend }) {
  if (active) return <section className="border border-[#cfe0dc] bg-white rounded-lg"><div className="flex items-center gap-3 border-b border-[#dfeae7] p-3"><button type="button" onClick={() => onOpen(null)} className="icon-command" title="Назад"><X size={17} /></button><strong>{active.title || profileById(active.members?.find((id) => id !== uid)).displayName}</strong></div><div className="grid max-h-[50vh] min-h-64 content-end gap-2 overflow-y-auto p-3">{messages.map((message) => <div key={message.id} className={`max-w-[82%] p-3 text-sm font-semibold rounded-md ${message.senderId === uid ? 'ml-auto bg-[#0d8b71] text-white' : 'bg-[#edf4f2]'}`}>{message.senderId !== uid && active.type === 'challenge' && <small className="mb-1 block font-black text-[#0d735f]">{profileById(message.senderId).displayName}</small>}{message.text}</div>)}</div><div className="flex gap-2 border-t border-[#dfeae7] p-3"><input value={text} onChange={(event) => onText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSend(); }} placeholder="Сообщение" className="field-control" /><button type="button" onClick={onSend} className="icon-command bg-[#0d8b71] text-white" title="Отправить"><Send size={17} /></button></div></section>;
  return <section className="grid gap-2">{conversations.map((conversation) => { const other = profileById(conversation.members?.find((id) => id !== uid)); return <button key={conversation.id} type="button" onClick={() => onOpen(conversation)} className="flex items-center gap-3 border border-[#cfe0dc] bg-white p-3 text-left rounded-lg"><img src={conversation.type === 'challenge' ? '' : other.photoUrl || ''} alt="" className="h-11 w-11 bg-[#dfeae7] object-cover rounded-md" /><span className="min-w-0 flex-1"><strong className="block truncate">{conversation.title || other.displayName}</strong><small className="block truncate font-semibold text-slate-500">{conversation.lastMessage || 'Начать разговор'}</small></span></button>; })}{!conversations.length && <Empty text="Открой друга в списке людей и начни разговор." />}</section>;
}

function Challenges({ items, uid, profileById, friendIds, onOpen, onChat }) { const valueFor = (profile, metric) => metric === 'steps' ? (profile.totalSteps || 0).toLocaleString('ru-RU') : metric === 'strongDays' ? profile.strongDays || 0 : `${profile.completionRate || 0}%`; return <div className="grid gap-3"><button type="button" disabled={!friendIds.length} onClick={onOpen} className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#b6506b] font-black text-white disabled:bg-slate-300 rounded-md"><Plus size={17} />Новый вызов</button>{items.map((item) => <article key={item.id} className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center bg-[#fdebf0] text-[#a43855] rounded-md"><Swords size={19} /></span><div><h2 className="font-black">{item.title}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{item.days} дней · {item.metric === 'adherence' ? 'процент выполнения личного плана' : item.metric}</p></div></div><div className="mt-3 grid gap-1 sm:grid-cols-2">{item.participants?.map((id) => { const profile = profileById(id); return <span key={id} className="flex items-center justify-between bg-[#edf4f2] px-3 py-2 text-xs font-bold rounded-sm"><span>{id === uid ? 'Вы' : profile.displayName}</span><strong>{valueFor(profile, item.metric)}</strong></span>; })}</div><div className="mt-3 flex items-start gap-2 text-xs font-bold leading-5 text-[#0d735f]"><ShieldCheck size={15} className="mt-0.5 shrink-0" />{item.honesty || 'Мы отмечаем факты честно: этот вызов нужен нам, а не рейтингу.'}</div>{item.chatId && <button type="button" onClick={() => onChat(item)} className="mt-3 inline-flex min-h-10 items-center gap-2 border border-[#cfe0dc] px-3 text-sm font-black rounded-md"><MessageCircle size={16} />Командный чат</button>}</article>)}{!items.length && <Empty text="Создай личный или командный вызов после добавления друзей." />}</div>; }

function ChallengeEditor({ friendIds, profileById, onSave, onClose }) { const [draft, setDraft] = useState({ title: '', days: 30, metric: 'adherence', participants: [], honesty: 'Отмечаем факты честно и поддерживаем друг друга без унижения.' }); const toggle = (id) => setDraft({ ...draft, participants: draft.participants.includes(id) ? draft.participants.filter((item) => item !== id) : [...draft.participants, id] }); return <div role="dialog" aria-modal="true" aria-label="Новый вызов" className="fixed inset-0 z-50 grid place-items-center bg-[#15333b]/50 p-3"><section className="w-full max-w-lg bg-white p-4 rounded-lg"><div className="flex justify-between"><h2 className="text-2xl font-black">Новый вызов</h2><button type="button" onClick={onClose} className="icon-command"><X size={18} /></button></div><div className="mt-4 grid gap-3"><label className="form-label">Название<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="field-control mt-1" /></label><div className="grid grid-cols-2 gap-2"><label className="form-label">Дней<select value={draft.days} onChange={(event) => setDraft({ ...draft, days: number(event.target.value) })} className="field-control mt-1"><option>7</option><option>14</option><option>30</option><option>90</option></select></label><label className="form-label">Что сравниваем<select value={draft.metric} onChange={(event) => setDraft({ ...draft, metric: event.target.value })} className="field-control mt-1"><option value="adherence">% личного плана</option><option value="steps">Шаги</option><option value="strongDays">Сильные дни</option></select></label></div><div><div className="form-label">Участники</div><div className="mt-2 grid gap-2">{friendIds.map((id) => <button key={id} type="button" onClick={() => toggle(id)} className={`flex min-h-11 items-center gap-2 border p-2 text-left rounded-md ${draft.participants.includes(id) ? 'border-[#0d8b71] bg-[#eaf8f4]' : 'border-[#d7e5e1]'}`}><span className="grid h-5 w-5 place-items-center border rounded-sm">{draft.participants.includes(id) && <Check size={13} />}</span>{profileById(id).displayName}</button>)}</div></div><label className="form-label">Условие честности<textarea value={draft.honesty} onChange={(event) => setDraft({ ...draft, honesty: event.target.value })} className="field-control mt-1 min-h-20" /></label><button type="button" disabled={!draft.title.trim() || !draft.participants.length} onClick={() => onSave(draft)} className="min-h-12 bg-[#b6506b] font-black text-white disabled:bg-slate-300 rounded-md">Создать вызов</button></div></section></div>; }
function Empty({ text }) { return <div className="border border-dashed border-[#bdd3cd] bg-[#f5faf8] p-6 text-center text-sm font-bold text-slate-400 rounded-lg">{text}</div>; }
