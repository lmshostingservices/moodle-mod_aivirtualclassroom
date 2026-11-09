// AI Virtual Classroom browser client.
// Media: WebRTC to the Cloudflare Realtime SFU (via the Worker's authenticated proxy).
// Signalling, chat, whiteboard, slides, polls, Q&A, notes and captions: one WebSocket to the room's Durable Object.
//
// Bandwidth savers built in (Cloudflare bills only data *delivered* to participants):
//  * Simulcast: cameras are sent in 2-3 qualities; each viewer pulls the smallest one that fits its tile.
//  * Only visible cameras are pulled (max N per person, teachers first); muted/off cameras are never pulled.
//  * Camera policy per room (everyone / teachers only / audio only) + spotlight for one student.
//  * Hidden browser tab or Data Saver = no incoming camera video at all.
//  * Opus mono + DTX (near-zero audio while silent), capped bitrates, low-fps screen share.
//  * Slides render locally from a PDF (bytes once, not a video stream); whiteboard is vector data.
/* eslint-disable no-console */

import { LANGUAGES, REGIONS, findLang, searchLangs, suggested } from './languages.js';

const C = window.AIVC_CONFIG;
const W = C.worker.replace(/\/$/, '');
const ME = C.me;
const EMOJIS = ['👍', '👏', '❤️', '😂', '🎉', '😮', '🤔', '🙌', '🔥', '✅'];
const COLORS = ['#111111', '#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#ffffff'];

// ------------------------------------------------------------------ tiny DOM helpers
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const AVATAR_TONES = ['#2f6f5e', '#5b5fa8', '#a0573e', '#3f6f9a', '#7a5a8c', '#4f7a3a', '#8a6a2a', '#9a4a5e'];
const tone = (s) => AVATAR_TONES[[...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_TONES.length];
const realPic = (url) => !!url && !/\/u\/f[123](\b|$)|\/theme\/image\.php\/[^/]+\/core\/\d+\/u\//.test(url);
const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function download(name, text, type = 'text/markdown') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function toast(msg, ms = 3500) {
  const t = h('div', { class: 'lm-toast' }, msg);
  $('#lm-toasts').append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}
const lsGet = (k) => { try { return localStorage.getItem('aivirtualclassroom:' + k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem('aivirtualclassroom:' + k, v); } catch (e) { /* storage unavailable */ } };


// ------------------------------------------------------------------ icons (one consistent 24px line set)
const ICONS = {
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.6"/><path d="M4 18l5-5 3.5 3.5L15 14l5 4.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M3.5 3.5l17 17"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2s1.2 1.7 2.8 2c1.7.3 2.9.9 2.9 2.2s-1.3 2.2-2.9 2.2c-1.3 0-2.4-.6-2.9-1.5M12 6v1.8M12 16.2V18"/>',
  vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  volOff: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  quiz: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.4"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cam: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3"/>',
  camOff: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3M3.5 3.5l17 17"/>',
  screen: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4M12 13V8M9.5 10.5L12 8l2.5 2.5"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-7V4.5a1.5 1.5 0 0 1 3 0V12m0-6a1.5 1.5 0 0 1 3 0v7.5a7.5 7.5 0 0 1-7.5 7.5h-.4a6.5 6.5 0 0 1-5.5-3l-1.4-2.6a1.6 1.6 0 0 1 2.7-1.7L8 15.5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10.2a2.3 2.3 0 1 0 0 3.6M17 10.2a2.3 2.3 0 1 0 0 3.6"/>',
  present: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4.5M8.5 20.5h7M7.5 12l3-3 2 2 4-4"/>',
  grid: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2"/><rect x="13" y="13" width="7.5" height="7.5" rx="2"/>',
  speaker: '<rect x="3" y="3" width="18" height="12" rx="2"/><rect x="3" y="17.5" width="5" height="3.5" rx="1"/><rect x="9.5" y="17.5" width="5" height="3.5" rx="1"/><rect x="16" y="17.5" width="5" height="3.5" rx="1"/>',
  chat: '<path d="M20.5 14.5a2 2 0 0 1-2 2h-10l-5 4v-14a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/><path d="M8 9.5h8M8 12.5h5"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  leave: '<path d="M3.5 14.2c4.7-4.6 12.3-4.6 17 0l-1.7 2.2a1 1 0 0 1-1.3.3l-2.6-1.4a1 1 0 0 1-.5-.9v-1.8a10 10 0 0 0-4.8 0v1.8a1 1 0 0 1-.5.9l-2.6 1.4a1 1 0 0 1-1.3-.3z"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  pen: '<path d="M4.5 19.5l4-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.5 15.5z"/><path d="M14.5 6.5l3 3"/>',
  marker: '<path d="M14 3.5l6.5 6.5-8 8H7v-5.5z"/><path d="M4 20.5h9"/>',
  eraser: '<path d="M9 20h11M5.6 15.4l8.8-8.8a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L11 18H8.2z"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H12"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9.5 7V4.5h5V7"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  lock: '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  notes: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12.5h7M9 16.5h5"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.4v.6M12 16.8h.01"/>',
  poll: '<path d="M5 20V11M12 20V4.5M19 20v-6"/>',
  door: '<path d="M3.5 20.5h17M6.5 20.5V4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M14 12.5h.01"/>',
  rec: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.6.7-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.7z"/>',
  eject: '<path d="M12 4l7.5 9h-15zM4.5 18.5h15"/>',
  blur: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M3 4h.01M3 8h.01M3 12h.01M21 4h.01M21 8h.01M21 12h.01"/>',
  feather: '<path d="M20 4c-6.5 0-12 4.5-12.5 12L4 20M8 16h6c4-2 6-6.5 6-12"/>',
  signal: '<path d="M5 19v-3M10 19v-6M15 19v-9M20 19V5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
};
function icon(name) {
  const span = document.createElement('span');
  span.className = 'ico';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return span;
}

// ------------------------------------------------------------------ state
const S = {
  ws: null, cid: null, joined: false, left: false, ended: false, welcomed: false,
  participants: new Map(), // cid -> p
  room: null, // current room state {key, name, stage, boards, pres, poll, notes, policy, qa, tx}
  bo: { active: false, rooms: {} }, rec: { on: false }, locked: false, lobby: [],
  chat: [], unread: 0,
  pc: null, sid: null, iceServers: null,
  mic: null, cam: null, camRaw: null, screen: null, // local tracks
  audioTx: null, videoTx: null, screenTx: null, // transceivers
  micOn: lsGet('mic') !== '0', camOn: lsGet('cam') === '1', blur: lsGet('blur') === '1', bg: lsGet('bg') || (lsGet('blur') === '1' ? 'blur' : 'none'), smooth: lsGet('smooth') === '1', look: lsGet('look') === '1',
  blurAmt: Math.max(0, Math.min(1, parseFloat(lsGet('blurAmt') || '0.9'))),
  lookBright: Math.max(0, Math.min(1, parseFloat(lsGet('lookBright') || '0.5'))),
  lookZoom: Math.max(0, Math.min(1, parseFloat(lsGet('lookZoom2') || '0'))),
  noiseSuppression: lsGet('ns') !== '0', dataSaver: lsGet('ds') === '1',
  view: 'auto', hand: false, handCount: 0, tab: 'chat',
  pulls: new Map(), // key -> {sid,name,cid,kind,mid,track,tr,rid}
  speaking: new Map(), lastSpoke: new Map(),
  hidden: false, hiddenTimer: null,
  stats: { rx: 0, tx: 0, rxRate: 0, txRate: 0, last: null },
  captions: new Map(), ccOn: false, recog: null,
  notesV: 0, notesText: '',
  boardTool: { tool: 'pen', color: '#e53935', width: 4 },
};

// ------------------------------------------------------------------ signalling
function send(msg) {
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(msg));
}

function connect() {
  const ws = new WebSocket(W.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(C.token));
  S.ws = ws;
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch (err) {
      console.error(err);
    }
  };
  ws.onclose = (e) => {
    if (S.left || S.ended || e.code === 4003) return;
    setStatus('Reconnecting…');
    setTimeout(connect, 1500 + Math.random() * 1500);
  };
  ws.onopen = () => setStatus('');
}
setInterval(() => send({ t: 'ping' }), 25000);

function me() {
  return S.participants.get(S.cid);
}
function isMod() {
  return !!ME.mod;
}
function pol() {
  return (S.room && S.room.policy) || { video: C.videoPolicy || 'teachers' };
}
function roomPeers() {
  const key = S.room ? S.room.key : 'main';
  return [...S.participants.values()].filter((p) => p.room === key);
}

async function onMessage(m) {
  switch (m.t) {
    case 'waiting':
      return overlay('Waiting room', 'Please wait — a teacher will let you in shortly.', false);
    case 'denied':
      S.ended = true;
      return overlay('Not admitted', 'A teacher did not admit you to this meeting.', true);
    case 'kicked':
      S.ended = true;
      cleanup();
      return overlay('Removed from meeting', 'A teacher removed you from this meeting.', true);
    case 'full':
      S.ended = true;
      return overlay('Class is full', m.message || 'This class has reached the student limit for its AI Virtual Classroom plan.', true);
    case 'plan':
      if (m.allow === false && !S.cid) {
        S.ended = true;
        return overlay('Live classes paused', m.message || 'AI Virtual Classroom is paused for this site. Please contact your Moodle administrator.', true);
      }
      S.plan = m;
      if (isMod() && m.message) toast('ℹ️ ' + m.message, 12000);
      return;
    case 'locked':
      if (m.on === undefined) {
        S.ended = true;
        return overlay('Meeting locked', 'This meeting is locked. Ask your teacher to unlock it.', true);
      }
      S.locked = m.on;
      toast(m.on ? `🔒 ${m.by} locked the meeting` : `🔓 ${m.by} unlocked the meeting`);
      return renderTop();
    case 'welcome': {
      overlay(null);
      S.cid = m.self.cid;
      S.participants = new Map(m.participants.map((p) => [p.cid, p]));
      S.participants.set(m.self.cid, m.self);
      S.bo = m.bo;
      S.rec = m.rec;
      S.locked = !!m.locked;
      S.chat = m.chat || [];
      setRoom(m.room);
      if (S.ccOn) CC.save();
      if (lsGet('anon') === '1' && !ME.mod) send({ t: 'slateanon', on: true });
      if (lsGet('dname')) send({ t: 'rename', name: lsGet('dname') });
      if (!S.welcomed) {
        S.welcomed = true;
        renderAll();
        try {
          await startMedia();
        } catch (e) {
          console.error(e);
          setStatus('Audio/video unavailable');
          toast('⚠️ Audio/video could not connect (' + e.message + '). Chat, whiteboard, slides and notes still work. Try reloading.', 9000);
        }
      } else {
        announceTracks();
      }
      renderAll();
      return;
    }
    case 'join':
      S.participants.set(m.p.cid, m.p);
      if (isMod() && m.p.room === S.room.key && S.participants.size < 30) toast(`${m.p.name} joined`);
      return renderAll();
    case 'leave':
      S.participants.delete(m.cid);
      return renderAll();
    case 'update':
      S.participants.set(m.p.cid, m.p);
      if (m.p.cid === S.cid) ME.name = m.p.name;
      return renderAll();
    case 'rooms': {
      const mine = m.map[S.cid];
      for (const [cid, room] of Object.entries(m.map)) {
        const p = S.participants.get(cid);
        if (p) p.room = room;
      }
      if (mine && S.room && mine !== S.room.key) toast(`Moving to ${roomLabel(mine)}…`);
      return renderAll();
    }
    case 'roomstate':
      setRoom(m.room);
      S.chat = m.chat || [];
      toast(`You are now in ${m.room.name}`);
      return renderAll();
    case 'bo':
      S.bo = m.bo;
      if (!m.bo.active) toast('Breakout rooms closed — back to the main room');
      return renderAll();
    case 'chat':
      S.chat.push(m);
      if (S.tab !== 'chat' || !panelOpen()) S.unread++;
      if (m.announce) toast(`📣 ${m.name}: ${m.text}`, 8000);
      else if (m.dm && m.cid !== S.cid) toast(`✉️ Private message from ${m.name}`);
      return renderSide(), renderBar();
    case 'hand': {
      const p = S.participants.get(m.cid);
      if (p) p.hand = m.up;
      if (m.cid === S.cid) S.hand = m.up;
      if (m.up && isMod() && p && m.cid !== S.cid) toast(`✋ ${p.name} raised their hand`);
      return renderAll();
    }
    case 'emoji':
      return flyEmoji(m.e, m.name);
    case 'forceMute':
      if (m.kind === 'v') {
        if (S.camOn) await toggleCam(false);
        toast(`${m.by} turned your camera off`);
      } else {
        if (S.micOn) toggleMic(false);
        toast(`${m.by} muted you`);
      }
      return;
    case 'rec':
      S.rec = m.rec;
      if (m.rec.on) toast(`⏺ ${m.rec.by} started recording`);
      return renderTop();
    case 'lobby':
      S.lobby = m.list;
      if (m.list.length && isMod()) toast(`🚪 ${m.list.length} waiting to join`);
      return renderSide(), renderBar();
    case 'stage':
      S.room.stage = m.mode;
      return renderAll();
    case 'pres':
      S.room.pres = m.pres;
      S.room.stage = m.stage;
      return renderAll();
    case 'page':
      if (S.room.pres) { S.room.pres.page = m.page; S.room.pres.step = m.step | 0; }
      if (S.room.pres && S.room.pres.type === 'show' && Slides.show && Slides.show.key === S.room.pres.key) {
        Slides.showGoto(true);
        return renderStage();
      }
      return renderStage();
    case 'wb':
      return Board.remote(m);
    case 'slates':
      S.room.slates = m.slates;
      return renderStage();
    case 'slateboards':
      Object.assign(S.room.boards, m.boards);
      return renderStage();
    case 'quiz':
      return quizMod().then((Q) => Q.onState(m.quiz));
    case 'quizres':
      return quizMod().then((Q) => Q.onResults(m));
    case 'quizstamp':
      return quizMod().then((Q) => Q.onStamp(m));
    case 'poll':
      S.room.poll = m.poll;
      if (m.poll && m.poll.open && m.poll.mine === null && !isMod()) toast('📊 New poll — open the Polls tab', 5000);
      return renderSide(), renderBar();
    case 'qa':
      S.room.qa = m.qa;
      return renderSide();
    case 'policy': {
      const before = S.room.policy;
      S.room.policy = m.policy;
      if (before.video !== m.policy.video || before.spot !== m.policy.spot) applyCameraPolicy();
      if (before.cc !== m.policy.cc && m.policy.cc && !S.ccOn) toggleCaptions(true);
      return renderAll();
    }
    case 'notes':
      return Notes.remote(m);
    case 'notesAck':
      S.notesV = Math.max(S.notesV, m.v);
      return;
    case 'notesFull':
      S.room.notes = { text: m.text, v: m.v };
      return Notes.reset(m.text, m.v);
    case 'allNotes': {
      const md = `# ${C.title} — shared notes\n\n` + m.notes.map((n) => `## ${n.name}\n\n${n.text}\n`).join('\n');
      return download(`${C.title} - shared notes (all rooms).md`, md);
    }
    case 'caption':
      return S.ccOn ? CC.onCaption(m) : undefined;
    case 'ccneed':
      CC.need = m.on;
      return Recog.sync();
    case 'spoke': {
      // The server heard me speak another language than my "I speak" setting (e.g. a guest whose browser is in
      // English): switch, so my captions are labelled and translated correctly for everyone.
      const want = String(m.lang || '').split('-')[0];
      if (!want || CC.prefs.speak.split('-')[0] === want) return undefined;
      const l = suggested().find((x) => x.code.split('-')[0] === want) || findLang(want);
      if (!l) return undefined;
      CC.prefs.speak = l.code;
      CC.save();
      Recog.sync();
      renderBar();
      return toast(`💬 Captions now use ${l.name} for your speech. Change it under Captions › Your microphone.`, 7000);
    }
    case 'ended':
      S.ended = true;
      cleanup();
      return overlay('Meeting ended', `${m.by} ended the meeting for everyone.`, true);
    case 'error':
      return toast('⚠️ ' + m.msg);
  }
}

// AI quiz module, loaded the first time it is needed.
let quizModP = null;
function quizMod() {
  if (!quizModP) {
    quizModP = import(C.pdfjs.replace(/vendor\/$/, '') + 'quiz.js?v=' + (C.v || '')).then((m) => m.init({ h, icon, toast, send, S, C, W, isMod, sleep, renderBar }));
  }
  return quizModP;
}

function setRoom(room) {
  if (room && room.quiz !== undefined) quizMod().then((Q) => Q.onState(room.quiz));
  const prevKey = S.room && S.room.key;
  S.room = room;
  room.boards = room.boards || {};
  if (prevKey !== room.key) {
    Notes.reset(room.notes.text, room.notes.v);
    Captions.clear();
  }
  applyCameraPolicy();
}

function roomLabel(key) {
  if (key === 'main') return 'Main room';
  return (S.bo.rooms && S.bo.rooms[key]) || (C.plan && C.plan.rooms[key]) || key;
}

// ------------------------------------------------------------------ SFU (Cloudflare Realtime)
let chain = Promise.resolve();
function serial(fn) {
  const p = chain.then(fn);
  chain = p.catch(() => {});
  return p;
}

async function api(path, method, body) {
  const r = await fetch(W + '/sfu' + path, {
    method,
    headers: { Authorization: 'Bearer ' + C.token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errorCode) throw new Error(j.errorDescription || j.error || 'SFU HTTP ' + r.status);
  return j;
}

// Opus: mono, capped bitrate, DTX (no packets while silent), FEC for lossy links.
function mungeOpus(sdp) {
  const m = sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
  if (!m) return sdp;
  const pt = m[1];
  const rate = ME.mod ? 32000 : 24000;
  return sdp.replace(new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`), (line, params) => {
    const kv = Object.fromEntries(params.split(';').filter(Boolean).map((x) => x.trim().split('=')));
    Object.assign(kv, { usedtx: '1', stereo: '0', 'sprop-stereo': '0', useinbandfec: '1', maxaveragebitrate: String(rate) });
    return `a=fmtp:${pt} ` + Object.entries(kv).map(([k, v]) => `${k}=${v}`).join(';');
  });
}

async function initPc() {
  try {
    const r = await fetch(W + '/ice', { headers: { Authorization: 'Bearer ' + C.token } });
    S.iceServers = (await r.json()).iceServers;
  } catch (e) {
    S.iceServers = [{ urls: 'stun:stun.cloudflare.com:3478' }];
  }
  const pc = new RTCPeerConnection({ iceServers: S.iceServers, bundlePolicy: 'max-bundle' });
  S.pc = pc;
  pc.addEventListener('connectionstatechange', () => {
    const st = pc.connectionState;
    if (pc !== S.pc) return;
    if (st === 'failed') reconnectMedia();
    else if (st === 'connected') { setStatus(''); S.mediaRetries = 0; }
  });
  const s = await api('/sessions/new', 'POST');
  S.sid = s.sessionId;
}

// Publish local tracks. entries: [{track, name, enc}]
function publish(entries) {
  return serial(async () => {
    const trs = entries.map((e) => S.pc.addTransceiver(e.track, { direction: 'sendonly', sendEncodings: e.enc }));
    await S.pc.setLocalDescription(await S.pc.createOffer());
    const res = await api(`/sessions/${S.sid}/tracks/new`, 'POST', {
      sessionDescription: { type: 'offer', sdp: S.pc.localDescription.sdp },
      tracks: trs.map((t, i) => ({ location: 'local', mid: t.mid, trackName: entries[i].name })),
    });
    await S.pc.setRemoteDescription({ type: 'answer', sdp: mungeOpus(res.sessionDescription.sdp) });
    return trs;
  });
}

async function renegotiateIfNeeded(res) {
  if (res.requiresImmediateRenegotiation) {
    await S.pc.setRemoteDescription(res.sessionDescription);
    await S.pc.setLocalDescription(await S.pc.createAnswer());
    await api(`/sessions/${S.sid}/renegotiate`, 'PUT', { sessionDescription: { type: 'answer', sdp: S.pc.localDescription.sdp } });
  }
}

// Pull remote tracks. items: [{sid, name, rid?}]
function pull(items) {
  return serial(async () => {
    const res = await api(`/sessions/${S.sid}/tracks/new`, 'POST', {
      tracks: items.map((i) => ({
        location: 'remote', sessionId: i.sid, trackName: i.name,
        ...(i.rid ? { simulcast: { preferredRid: i.rid, priorityOrdering: 'asciibetical' } } : {}),
      })),
    });
    await renegotiateIfNeeded(res);
    return items.map((i) => {
      const t = (res.tracks || []).find((x) => x.trackName === i.name && x.sessionId === i.sid);
      if (!t || t.errorCode || !t.mid) return null;
      const tr = S.pc.getTransceivers().find((x) => x.mid === t.mid);
      return tr ? { mid: t.mid, track: tr.receiver.track, tr } : null;
    });
  });
}

function closeTransceivers(trs) {
  return serial(async () => {
    const mids = trs.map((t) => t.mid).filter(Boolean);
    trs.forEach((t) => {
      try { t.stop(); } catch (e) { /* already stopped */ }
    });
    if (!mids.length) return;
    await S.pc.setLocalDescription(await S.pc.createOffer());
    const res = await api(`/sessions/${S.sid}/tracks/close`, 'PUT', {
      tracks: mids.map((mid) => ({ mid })),
      sessionDescription: { type: 'offer', sdp: S.pc.localDescription.sdp },
      force: false,
    });
    if (res.sessionDescription) await S.pc.setRemoteDescription(res.sessionDescription);
  });
}

function switchLayer(pullRec, ridWanted) {
  return serial(async () => {
    const res = await api(`/sessions/${S.sid}/tracks/update`, 'PUT', {
      tracks: [{ location: 'remote', sessionId: pullRec.sid, trackName: pullRec.name, mid: pullRec.mid,
        simulcast: { preferredRid: ridWanted, priorityOrdering: 'asciibetical' } }],
    });
    await renegotiateIfNeeded(res);
    pullRec.rid = ridWanted;
  });
}

// ------------------------------------------------------------------ local media
function camAllowed() {
  const p = pol();
  if (ME.mod && p.video !== 'none') return true;
  if (p.spot && p.spot === S.cid) return true;
  return p.video === 'all';
}

async function getMic() {
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: S.noiseSuppression, autoGainControl: true, channelCount: 1 },
    });
    return s.getAudioTracks()[0];
  } catch (e) {
    toast('Microphone not available: ' + e.message);
    return null;
  }
}

async function getCam() {
  try {
    // Trainers capture Full HD 1080p, students HD 720p, both at 30 fps.
    const s = await navigator.mediaDevices.getUserMedia({
      video: ME.mod
        ? { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
    });
    const t = s.getVideoTracks()[0];
    t.contentHint = 'motion';
    return t;
  } catch (e) {
    toast('Camera not available: ' + e.message);
    return null;
  }
}

// Trainers send 1080p Full HD + 720p HD + 360p. Students send 720p HD + 360p + 180p.
// The smaller layers are only used for thumbnails, or for 720p when a window is too small to show 1080p.
function camEncodings() {
  if (C.simulcast === false) return [{ maxBitrate: ME.mod ? 3000000 : 1500000, maxFramerate: 30 }];
  return ME.mod
    ? [
      { rid: 'f', maxBitrate: 3000000, maxFramerate: 30 },
      { rid: 'h', maxBitrate: 1500000, maxFramerate: 30, scaleResolutionDownBy: 1.5 },
      { rid: 'q', maxBitrate: 400000, maxFramerate: 24, scaleResolutionDownBy: 3 },
    ]
    : [
      // Same smoothness as the trainer's layers: the small layers are what everyone sees while slides, a screen,
      // the whiteboard or speaker view are on, and 15 fps there made learners and guests look laggy.
      { rid: 'f', maxBitrate: 1500000, maxFramerate: 30 },
      { rid: 'h', maxBitrate: 600000, maxFramerate: 30, scaleResolutionDownBy: 2 },
      { rid: 'q', maxBitrate: 200000, maxFramerate: 24, scaleResolutionDownBy: 4 },
    ];
}

// Full HD from a trainer only when the main screen is big enough to show it; otherwise their 720p HD layer.
function bigRid(p) {
  if (!p.mod) return 'f';
  const el = $('#lm-stage-content');
  const px = (el ? el.clientWidth : window.innerWidth) * (window.devicePixelRatio || 1);
  return px >= 1400 ? 'f' : 'h';
}

// The media connection failed (network change, Wi-Fi drop, a media server restart): keep rebuilding it quietly,
// waiting a little longer each time, for about two minutes before asking the user. (Three quick tries used to give
// up after a few seconds, so any drop longer than that needed a page reload.)
const MEDIA_RETRY_S = [1, 2, 3, 5, 8, 10, 15, 15, 15, 15, 15, 15];
async function reconnectMedia() {
  if (S.ended || S.left) return;
  S.mediaRetries = (S.mediaRetries || 0) + 1;
  if (S.mediaRetries > MEDIA_RETRY_S.length) {
    setStatus('Media connection lost');
    overlayAction('Connection lost', 'Your audio/video connection dropped.', 'Reconnect', () => location.reload());
    return;
  }
  setStatus('Reconnecting audio and video…');
  const old = S.pc;
  S.pc = null;
  chain = Promise.resolve();
  try { old.close(); } catch (e) { /* closed */ }
  if (S.screen) { S.screen.getTracks().forEach((t) => t.stop()); S.screen = null; }
  S.audioTx = S.videoTx = S.screenTx = null;
  S.sid = null;
  S.pulls.clear();
  // Wait, but go straight away when the browser says the network is back.
  await new Promise((r) => {
    const t = setTimeout(done, MEDIA_RETRY_S[S.mediaRetries - 1] * 1000);
    function done() { clearTimeout(t); window.removeEventListener('online', done); r(); }
    window.addEventListener('online', done);
  });
  if (S.ended || S.left) return;
  try {
    await startMedia();
  } catch (e) {
    console.error(e);
    reconnectMedia();
  }
}

async function startMedia() {
  setStatus('Connecting media…');
  await initPc();
  if (!S.mic) S.mic = await getMic();
  const entries = [];
  if (S.mic) {
    S.mic.enabled = S.micOn;
    entries.push({ track: S.mic, name: 'a' });
  }
  if (S.camOn && camAllowed()) {
    await ensureCamTrack();
    if (S.cam) entries.push({ track: S.cam, name: 'v', enc: camEncodings() });
  } else {
    S.camOn = false;
  }
  if (entries.length) {
    const trs = await publish(entries);
    entries.forEach((e, i) => {
      if (e.name === 'a') S.audioTx = trs[i];
      if (e.name === 'v') S.videoTx = trs[i];
    });
    if (S.videoTx) tuneSender(S.videoTx.sender, 'maintain-framerate');
  }
  watchSpeaking(S.mic, S.cid);
  announceTracks();
  setStatus('');
  reconcile();
  startStats();
  if (pol().cc) toggleCaptions(true);
}

function tuneSender(sender, pref) {
  try {
    const p = sender.getParameters();
    p.degradationPreference = pref;
    sender.setParameters(p).catch(() => {});
  } catch (e) { /* not supported */ }
}

function announceTracks() {
  if (!S.sid) return;
  send({
    t: 'tracks', sid: S.sid,
    tr: { a: S.audioTx ? 'a' : null, v: S.videoTx ? 'v' : null, s: S.screenTx ? 's' : null, sim: C.simulcast !== false },
    mu: { a: !S.micOn || !S.mic, v: !S.camOn || !S.cam },
  });
}

function toggleMic(on = !S.micOn) {
  S.micOn = on;
  lsSet('mic', on ? '1' : '0');
  if (S.mic) S.mic.enabled = on;
  announceTracks();
  Captions.sync();
  renderBar();
  renderTiles();
}

async function ensureCamTrack() {
  if (S.cam && S.cam.readyState === 'live') return;
  S.camRaw = await getCam();
  S.cam = S.camRaw ? await buildCam(S.camRaw) : null;
}

// Camera effects chain: raw camera -> smooth skin (GPU) -> background blur -> sent and shown.
async function buildCam(raw) {
  let t = raw;
  if (FxSafe.off) return t; // effects stopped for this class after repeated graphics failures
  if (S.look) t = await Look.wrap(t);
  if (S.smooth) t = Smooth.wrap(t);
  if (S.bg && S.bg !== 'none') t = await Blur.wrap(t, S.bg);
  return t;
}
// ------------------------------------------------------------------ background-proof frame clock
// Browsers pause animation frames and video-frame callbacks (and slow timers to once a second) when the tab is
// in the background or another window is in front. Camera effects draw each frame, so the video everyone else
// sees would freeze. A tiny worker keeps time instead: workers are not throttled, so effects keep running.
const Tick = {
  worker: null, subs: new Set(),
  on(fn) {
    this.subs.add(fn);
    if (!this.worker) {
      try {
        this.worker = new Worker(URL.createObjectURL(new Blob(['let t=null;onmessage=(e)=>{clearInterval(t);if(e.data)t=setInterval(()=>postMessage(0),e.data);};'], { type: 'text/javascript' })));
        this.worker.onmessage = () => { for (const f of [...this.subs]) { try { f(); } catch (e) { console.warn('tick', e); } } };
      } catch (e) { this.worker = null; }
    }
    this.sync();
    return () => { this.subs.delete(fn); this.sync(); };
  },
  // Only tick while the page is hidden and someone needs it (visible pages use the normal frame callbacks).
  sync() { if (this.worker) this.worker.postMessage(document.hidden && this.subs.size ? 33 : 0); },
};
document.addEventListener('visibilitychange', () => Tick.sync());
// Run fn for every new camera frame: the video's own frame callback when visible, the worker clock when hidden.
function frameLoop(video, fn, alive) {
  let last = -1;
  let lastAt = 0;
  const step = (fromTick) => {
    if (!alive()) return off();
    if (document.hidden !== !!fromTick) return; // the other path is driving
    // Visible: draw each new camera frame once. Background: draw on the worker clock (about 30 a second), since
    // some browsers stop updating the video's clock in a background tab.
    if (fromTick ? performance.now() - lastAt < 30 : video.currentTime === last) return;
    last = video.currentTime;
    lastAt = performance.now();
    fn();
  };
  const raf = () => {
    if (!alive()) return off();
    if (!document.hidden) step(false);
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(raf); else requestAnimationFrame(raf);
  };
  const off = Tick.on(() => step(true));
  raf();
  return off;
}

// ------------------------------------------------------------------ safe failure handling for camera effects
// When the graphics chip stops (studio model error, WebGL context lost, driver reset), the page must never crash:
//  1. switch to the plain camera at once (no new graphics work while the chip recovers);
//  2. stop and release every effect (worker, WebGL contexts, canvas tracks);
//  3. after a pause, and only once a test WebGL context works, turn the effects back on;
//  4. a burst of failures counts once; after 3 failures, effects stay off for this class (the saved choice is kept).
// A marker in this browser notes when camera effects are running. If the page dies with them running, the person
// cut-out runs on the processor the next time the class opens, so a computer that can't run it never crashes twice.
const FxSafe = {
  off: false, count: 0, last: 0, timer: null, tries: 0,
  fail(what, why) {
    const now = Date.now();
    console.warn('camera effects stopped:', what, why || '');
    if (now - this.last < 2000) return; // every canvas reports a GPU reset at once: handle it one time
    this.last = now;
    this.count++;
    // The person model may hold a dead graphics context: drop it so it is rebuilt fresh.
    Blur.dropSegmenter();
    this.toRaw();
    clearTimeout(this.timer);
    if (this.count >= 3) {
      this.off = true;
      toast('Camera effects are off for this class because your computer’s graphics kept stopping. Your camera is still on.', 7000);
      if (S.room) renderBar();
      return;
    }
    toast('Camera effects stopped for a moment. Your camera is still on; trying again.', 6000);
    this.tries = 0;
    this.timer = setTimeout(() => this.retry(), 3000);
  },
  retry() {
    if (this.off) return;
    if (!this.gpuOk() && ++this.tries < 5) { this.timer = setTimeout(() => this.retry(), 3000); return; }
    if (!this.gpuOk()) { this.off = true; toast('Camera effects are off for this class. Your camera is still on.', 6000); return; }
    rebuildCam();
  },
  gpuOk() {
    try {
      const c = document.createElement('canvas');
      const g = c.getContext('webgl');
      const ok = !!g && !g.isContextLost();
      const x = g && g.getExtension('WEBGL_lose_context');
      if (x) x.loseContext();
      return ok;
    } catch (e) { return false; }
  },
  // Plain camera now, no graphics work: in the class it is sent as is; on the join screen the preview shows it.
  toRaw() {
    Blur.stop();
    Smooth.stop();
    Look.stop();
    try {
      if (S.onFxRaw) { S.onFxRaw(); return; }
      if (!S.camOn || !S.camRaw) return;
      if (S.cam && S.cam !== S.camRaw) S.cam.stop();
      S.cam = S.camRaw;
      if (S.videoTx) S.videoTx.sender.replaceTrack(S.cam).catch(() => {});
      renderTiles();
    } catch (e) { console.warn('raw camera', e); }
  },
  // Crash marker: notes which camera effects are running. If the page dies with them on, they start safer next time.
  mark(mode) { lsSet('fxlive', mode || ''); },
  checkLastCrash() {
    const m = lsGet('fxlive');
    if (!m) return;
    this.mark(false);
    if (m === 'standard') Blur.cpu = true; // effects stopped the page last time: run the cut-out on the processor
  },
};

// Effects changes are applied one at a time.
let camBuild = Promise.resolve();
function rebuildCam() {
  camBuild = camBuild.then(rebuildCamNow).catch((e) => console.warn('camera effects', e));
  return camBuild;
}
// Load anything slow (the person cut-out model, the face finder, the background picture) while the current camera
// keeps playing. Only then is the old picture swapped for the new one, so changing effects never freezes video.
async function preloadFx() {
  if (FxSafe.off) return;
  const jobs = [];
  if (S.bg && S.bg !== 'none') {
    jobs.push(Blur.loadSegmenter().catch(() => {}));
    if (S.bg !== 'blur') jobs.push(Backgrounds.image(S.bg).catch(() => null));
  }
  if (S.look) jobs.push(Look.faceFinder());
  await Promise.all(jobs);
}
async function rebuildCamNow() {
  await preloadFx();
  if (S.onFx) return S.onFx(); // join screen preview
  if (!S.camOn || !S.camRaw) return;
  Blur.stop();
  Smooth.stop();
  Look.stop();
  if (S.cam && S.cam !== S.camRaw) S.cam.stop();
  S.cam = await buildCam(S.camRaw);
  if (S.videoTx) await S.videoTx.sender.replaceTrack(S.cam);
  renderTiles();
}

async function toggleCam(on = !S.camOn) {
  if (on && !camAllowed()) return toast('Your teacher has turned student cameras off to save bandwidth.');
  S.camOn = on;
  if (on) S.camForcedOff = false;
  lsSet('cam', on ? '1' : '0');
  if (on) {
    await ensureCamTrack();
    if (!S.cam) {
      S.camOn = false;
    } else if (S.videoTx) {
      await S.videoTx.sender.replaceTrack(S.cam);
    } else if (S.pc) {
      [S.videoTx] = await publish([{ track: S.cam, name: 'v', enc: camEncodings() }]);
      tuneSender(S.videoTx.sender, 'maintain-framerate');
    }
  } else {
    // Stop sending entirely (no upstream bytes, camera light off).
    if (S.videoTx) await S.videoTx.sender.replaceTrack(null);
    Blur.stop();
    Smooth.stop();
    Look.stop();
    [S.cam, S.camRaw].forEach((t) => t && t.stop());
    S.cam = S.camRaw = null;
  }
  announceTracks();
  renderBar();
  renderTiles();
}

function applyCameraPolicy() {
  if (S.camOn && !camAllowed()) {
    S.camForcedOff = true; // the room setting turned it off, not this person
    toggleCam(false);
    toast('Cameras are limited in this room to save bandwidth.');
  } else if (S.camForcedOff && !S.camOn && camAllowed()) {
    // Cameras allowed again (e.g. back from "Audio only"): a teacher's camera comes straight back on; anyone else
    // decides for themselves.
    S.camForcedOff = false;
    if (ME.mod) toggleCam(true);
    else toast('Cameras are allowed again. Turn yours on with Start video.', 6000);
  }
  renderBar();
}

async function toggleScreen() {
  if (S.screen) return stopScreen();
  if (!ME.mod && !C.studentScreenShare && !pol().present) return toast('Screen sharing is for teachers in this room.');
  try {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 15 }, width: { max: 1920 }, height: { max: 1080 } }, audio: false });
    S.screen = s.getVideoTracks()[0];
    S.screen.contentHint = 'detail';
    S.screen.addEventListener('ended', stopScreen);
    [S.screenTx] = await publish([{ track: S.screen, name: 's', enc: [{ maxBitrate: 2000000, maxFramerate: 15 }] }]);
    tuneSender(S.screenTx.sender, 'maintain-resolution');
    announceTracks();
    toast('Tip: presenting slides as a PDF (Present ▸ Upload) uses far less data than sharing your screen.', 6000);
  } catch (e) {
    S.screen = null;
    if (e.name !== 'NotAllowedError') toast('Could not share screen: ' + e.message);
  }
  renderAll();
}

async function stopScreen() {
  if (!S.screen) return;
  const tr = S.screenTx;
  S.screen.stop();
  S.screen = null;
  S.screenTx = null;
  announceTracks();
  if (tr) await closeTransceivers([tr]).catch(console.error);
  renderAll();
}

// ------------------------------------------------------------------ background blur
// ------------------------------------------------------------------ Studio look (works on any computer)
// Better lighting and framing, done with one light graphics pass:
//  * lighting: auto exposure (brightens a dark room), gentle white balance, lifted shadows, a touch of contrast and
//    colour, and a soft key light on the middle of the picture;
//  * framing: finds your face a few times a second and keeps you centred and slightly zoomed in, moving smoothly.
//    If face finding is not available, it simply centres and zooms in a little.
// The picture is measured on a tiny 48 x 27 copy and the face finder runs on the processor about 3 times a second,
// so it costs very little and never depends on the graphics chip being fast.
const Look = {
  video: null, gl: null, track: null, loopOff: null, face: null, faceLoading: null,
  async faceFinder() {
    if (this.face !== null) return this.face;
    if (!this.faceLoading) this.faceLoading = (async () => {
      try {
        const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
        const v = await import(base + '/vision_bundle.mjs');
        const files = await v.FilesetResolver.forVisionTasks(base + '/wasm');
        this.face = await v.FaceDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite', delegate: 'CPU' },
          runningMode: 'VIDEO', minDetectionConfidence: 0.5,
        });
      } catch (e) {
        console.warn('face finder', e);
        this.face = false; // centre and zoom only
      }
      return this.face;
    })();
    return this.faceLoading;
  },
  async wrap(raw) {
    try {
      const st = raw.getSettings();
      const video = h('video', { muted: true, playsinline: true });
      video.srcObject = new MediaStream([raw]);
      await video.play().catch(() => {});
      const w = video.videoWidth || st.width || 1280;
      const hh = video.videoHeight || st.height || 720;
      const fps = Math.min(30, Math.round(st.frameRate || 30));
      const face = await this.faceFinder();
      const cv = h('canvas', { width: w, height: hh });
      const gl = cv.getContext('webgl', { premultipliedAlpha: false, antialias: false });
      if (!gl) throw new Error('no webgl');
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (this.video === video) FxSafe.fail('look', 'graphics reset'); });
      const vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
      // One light graphics pass. Around your face: a soft key light and a touch of sharpening. Away from you: the room
      // goes a little softer, darker and calmer, like a portrait lens. Plus auto exposure, white balance and a gentle
      // film-style tone curve. No cut-out model is needed (the face finder is tiny), so it suits ordinary computers.
      const fs = `precision mediump float;varying vec2 uv;uniform sampler2D t;uniform vec4 crop;uniform vec3 gain;uniform float lift;
uniform vec2 fc;uniform float fr;uniform float room;uniform vec2 px;
vec3 grab(vec2 o){return texture2D(t,crop.xy+o*crop.zw).rgb;}
void main(){vec2 q=uv;vec3 c=grab(q);
vec2 e=(uv-fc)/vec2(fr*1.25,fr*2.1);float d=length(e);            /* distance from you (head and shoulders) */
float w=smoothstep(.75,1.7,d)*room;                                 /* how much "room" this pixel is */
vec3 bl=vec3(0.);float n=0.;
for(int i=-2;i<=2;i++){for(int j=-2;j<=2;j++){vec2 o=vec2(float(i),float(j))*px*(1.5+7.*w);bl+=grab(q+o);n+=1.;}}
bl/=n;
vec3 sm=(grab(q+vec2(px.x,0.))+grab(q-vec2(px.x,0.))+grab(q+vec2(0.,px.y))+grab(q-vec2(0.,px.y)))*.25;
c=mix(c,bl,w*.85);                                                  /* soft background */
c+=(c-sm)*.45*(1.-w);                                               /* crisper you */
c*=gain;
c=c+lift*(1.-c)*(1.-c)*.5;                                          /* lift shadows */
c*=1.+.20*exp(-d*d*1.4)-.26*w;                                      /* key light on you, room a little darker */
float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.10-.25*w);    /* colour on you, calmer room */
c=c*(1.+.35*c)/(1.+.35*c*c+.0001)*1.02;                              /* gentle film curve */
c=mix(vec3(.5),c,1.05);
gl_FragColor=vec4(clamp(c,0.,1.),1.);}`;
      const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(pr);
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
      gl.viewport(0, 0, w, hh);
      const uCrop = gl.getUniformLocation(pr, 'crop');
      const uGain = gl.getUniformLocation(pr, 'gain');
      const uLift = gl.getUniformLocation(pr, 'lift');
      const uFc = gl.getUniformLocation(pr, 'fc');
      const uFr = gl.getUniformLocation(pr, 'fr');
      const uRoom = gl.getUniformLocation(pr, 'room');
      gl.uniform2f(gl.getUniformLocation(pr, 'px'), 1 / w, 1 / hh);
      // Small copies: 48 x 27 to measure the light, 256 wide for the face finder.
      const tiny = h('canvas', { width: 48, height: 27 });
      const tx = tiny.getContext('2d', { willReadFrequently: true });
      const fw = 256, fh = Math.round(256 * hh / w);
      const fcv = h('canvas', { width: fw, height: fh });
      const fx = fcv.getContext('2d');
      // Fixed framing: a steady zoom on the centre of the picture (Zoom slider). The camera never moves or follows you.
      const ZOOM = 1 + 0.4 * S.lookZoom;
      const cur = { z: ZOOM, cx: 0.5, cy: 0.5, g: [1, 1, 1], lift: 0, fx: 0.5, fy: 0.42, fr: 0.16 };
      const tgt = { z: ZOOM, cx: 0.5, cy: 0.5, g: [1, 1, 1], lift: 0, fx: 0.5, fy: 0.42, fr: 0.16 };
      let lastLight = 0, lastFace = 0;
      this.video = video;
      this.gl = gl;
      const draw = () => {
        if (this.video !== video) return;
        try {
          if (gl.isContextLost()) return FxSafe.fail('look', 'graphics lost');
          if (video.readyState < 2) return;
          const now = performance.now();
          if (now - lastLight > 400) {
            // Light: aim the average brightness at a pleasant level, and take out most of a colour cast.
            lastLight = now;
            tx.drawImage(video, 0, 0, 48, 27);
            const px = tx.getImageData(0, 0, 48, 27).data;
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
            const n = px.length / 4; r /= n * 255; g /= n * 255; b /= n * 255;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            // Brighter, like a well-lit video call: aim a little above middle grey.
            // Brightness slider: 0 = darker than the camera, 0.5 = default, 1 = bright.
            const aim = 0.3 + 0.32 * S.lookBright;
            const ex = Math.max(0.6, Math.min(1.8, aim / Math.max(lum, 0.05)));
            const m = (r + g + b) / 3;
            const wb = [r, g, b].map((c) => Math.max(0.9, Math.min(1.12, Math.pow(m / Math.max(c, 0.02), 0.35))));
            tgt.g = wb.map((k) => k * ex);
            tgt.lift = Math.max(0, Math.min(0.4, (aim - 0.05 - lum) * 1.3));
          }
          if (face && now - lastFace > 330) {
            // Framing: centre the face, eyes a little above the middle, face about a quarter of the width.
            lastFace = now;
            fx.drawImage(video, 0, 0, fw, fh);
            const res = face.detectForVideo(fcv, now);
            const d = res && res.detections && res.detections[0];
            if (d && d.boundingBox) {
              const bb = d.boundingBox;
              const fcx = (bb.originX + bb.width / 2) / fw;
              const fcy = (bb.originY + bb.height / 2) / fh;
              // Only used to place the soft key light on your face; the framing stays fixed.
              tgt.fx = fcx; tgt.fy = fcy; tgt.fr = Math.max(0.08, Math.min(0.35, bb.width / fw));
            }
          }
          // Ease towards the targets so nothing jumps.
          tgt.z = 1 + 0.4 * S.lookZoom; // zoom slider: 1x to 1.4x on the centre, never moving
          const ease = 0.08;
          cur.z += (tgt.z - cur.z) * ease;
          cur.cx += (tgt.cx - cur.cx) * ease;
          cur.cy += (tgt.cy - cur.cy) * ease;
          cur.lift += (tgt.lift - cur.lift) * 0.06;
          cur.fx += (tgt.fx - cur.fx) * 0.12; cur.fy += (tgt.fy - cur.fy) * 0.12; cur.fr += (tgt.fr - cur.fr) * 0.08;
          cur.g = cur.g.map((k, i) => k + (tgt.g[i] - k) * 0.06);
          const cw = 1 / cur.z, chh = 1 / cur.z;
          const x0 = Math.max(0, Math.min(1 - cw, cur.cx - cw / 2));
          const y0 = Math.max(0, Math.min(1 - chh, cur.cy - chh / 2));
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
          gl.uniform4f(uCrop, x0, y0, cw, chh);
          gl.uniform3f(uGain, cur.g[0], cur.g[1], cur.g[2]);
          gl.uniform1f(uLift, cur.lift);
          // Your position in the framed picture. With a background effect on, the room is replaced anyway, so the
          // lens softening is left out (it would only blur the edge the cut-out uses).
          gl.uniform2f(uFc, (cur.fx - x0) / cw, (cur.fy - y0) / chh);
          gl.uniform1f(uFr, cur.fr / cw);
          // No "portrait lens": the room around you stays sharp and keeps its colour (Studio look only brightens and
          // zooms). It used to soften and darken the edges of the picture, which looked like blur with blur off.
          gl.uniform1f(uRoom, 0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        } catch (err) { return FxSafe.fail('look', err && err.message); }
      };
      this.loopOff = frameLoop(video, draw, () => this.video === video);
      const out = cv.captureStream(fps).getVideoTracks()[0];
      out.contentHint = 'motion';
      this.track = out;
      return out;
    } catch (e) {
      console.warn('studio look', e);
      this.stop();
      return raw;
    }
  },
  stop() {
    if (this.loopOff) { this.loopOff(); this.loopOff = null; }
    if (this.video) this.video.srcObject = null;
    this.video = null;
    if (this.track) { try { this.track.stop(); } catch (e) { /* ignore */ } }
    this.track = null;
    if (this.gl) { try { const x = this.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* ignore */ } }
    this.gl = null;
  },
};
async function setLook(on) {
  S.look = on;
  lsSet('look', on ? '1' : '0');
  if (S.room) renderBar();
  await rebuildCam();
  if (S.room) renderBar();
}

const Blur = {
  segmenter: null, multiclass: false, raf: null, video: null, gl: null, track: null, cpu: false,
  dropSegmenter() {
    if (this.segmenter) { try { this.segmenter.close(); } catch (e) { /* already gone */ } }
    this.segmenter = null;
  },
  loadSegmenter() {
    if (this.segmenter) return Promise.resolve();
    // One load at a time, shared by everyone who asks (preload and the effect itself).
    if (!this.segLoading) this.segLoading = this.loadSegmenterNow().finally(() => { this.segLoading = null; });
    return this.segLoading;
  },
  async loadSegmenterNow() {
    toast('Loading background effects (first time only)…');
    const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const v = await import(base + '/vision_bundle.mjs');
    const files = await v.FilesetResolver.forVisionTasks(base + '/wasm');
    const make = (model) => v.ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: model, delegate: this.cpu ? 'CPU' : 'GPU' },
      runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true,
    });
    // The multiclass model separates hair, face, body and clothes from the background much more cleanly than the
    // basic selfie model; fall back to the basic one on devices that cannot run it.
    try {
      this.segmenter = await make('https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite');
      this.multiclass = true;
    } catch (e) {
      this.segmenter = await make('https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite');
      this.multiclass = false;
    }
  },
  async wrap(raw, mode = 'blur') {
    // 1) Native platform blur (Chrome on some OSes) costs no CPU.
    if (mode === 'blur') try {
      const caps = raw.getCapabilities ? raw.getCapabilities() : {};
      if (caps.backgroundBlur && caps.backgroundBlur.includes(true)) {
        await raw.applyConstraints({ backgroundBlur: true });
        return raw;
      }
    } catch (e) { /* fall through */ }
    // 2) MediaPipe segmentation on a small copy of the frame, then a GPU compositor that refines the edge with the
    //    full-resolution picture (joint bilateral upsampling), smooths it over time to stop flicker, and blends softly.
    try {
      const studio = false;
      await this.loadSegmenter();
      const st = raw.getSettings();
      const video = h('video', { muted: true, playsinline: true });
      video.srcObject = new MediaStream([raw]);
      await video.play();
      const w = video.videoWidth || st.width || 1280;
      const hh = video.videoHeight || st.height || 720;
      const fps = Math.min(30, Math.round(st.frameRate || 30));
      // Segmentation input: 256 px wide, same aspect as the camera.
      // Square, like the detector's own input (it squares whatever it is given).
      const sw = studio ? 512 : 256;
      const sh = sw;
      const small = h('canvas', { width: sw, height: sh });
      const sctx = small.getContext('2d');
      const mask = new Uint8Array(sw * sh);
      let prev = new Float32Array(sw * sh);
      let prevB = new Float32Array(sw * sh);
      let havePrev = false;
      // (1) Crop around you: the detector looks at a box around the person found last time, not the whole room, so
      //     ears, hair and fingers get more detail. The detector squares its input anyway, so the box can take your
      //     shape (less stretching than the full 16:9 frame). Normalised 0..1.
      const roi = { x: 0, y: 0, w: 1, h: 1 };
      let mroi = { x: 0, y: 0, w: 1, h: 1 }; // the box the current mask was made in
      // (3) Movement prediction: how fast the top, middle and bottom of you move sideways, used to slide the last
      //     cut-out along on frames where the detector does not run.
      const vel = [0, 0, 0];
      const lastC = [null, null, null];
      let bandY = [0.33, 0.66];
      let segAt = 0;
      // (4) Quality levels: 0 = detector every frame, full edge detail; 3 = for slow computers.
      const TIERS = [{ every: 0, guide: 640 }, { every: 33, guide: 640 }, { every: 50, guide: 480 }, { every: 80, guide: 320 }];
      let tier = this.cpu ? 2 : 0;
      let winCost = 0, winN = 0, goodWins = 0, badWins = 0, slowRun = 0, lastTierChange = 0;
      // Where in the picture something is really moving (a waving arm), from a coarse frame-to-frame comparison of the
      // camera picture itself: the outline follows instantly there, and stays steady where nothing moves.
      const MW = 64, MH = Math.max(18, Math.round(64 * hh / w));
      const motCan = h('canvas', { width: MW, height: MH });
      const motCtx = motCan.getContext('2d', { willReadFrequently: true });
      let motPrev = null;
      const motRaw = new Float32Array(MW * MH);
      const motMap = new Float32Array(MW * MH);
      const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      const clamp01 = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      // Move the stored smoothing history into a new crop box, so changing the box never makes the cut-out jump.
      const moveRoi = (nx, ny, nw, nh) => {
        if (Math.abs(nx - roi.x) + Math.abs(ny - roi.y) + Math.abs(nw - roi.w) + Math.abs(nh - roi.h) < 1e-4) return;
        for (let y = 0; y < sh; y++) {
          const fy = ny + (y + 0.5) / sh * nh;
          const oy = Math.floor((fy - roi.y) / roi.h * sh);
          for (let x = 0; x < sw; x++) {
            const fx = nx + (x + 0.5) / sw * nw;
            const ox = Math.floor((fx - roi.x) / roi.w * sw);
            prevB[y * sw + x] = (ox >= 0 && oy >= 0 && ox < sw && oy < sh) ? prev[oy * sw + ox] : 0;
          }
        }
        const t = prev; prev = prevB; prevB = t;
        roi.x = nx; roi.y = ny; roi.w = nw; roi.h = nh;
      };
      const full = () => moveRoi(0, 0, 1, 1);
      // A box of size bw x bh centred on (cx, cy), kept inside the frame.
      const boxAt = (cx, cy, bw, bh) => [clamp01(cx - bw / 2, 0, 1 - bw), clamp01(cy - bh / 2, 0, 1 - bh), bw, bh];
      // After each detection: find you, plan the next crop box and measure sideways speed per band.
      const track = (now) => {
        let x0 = sw, x1 = -1, y0 = sh, y1 = -1, n = 0;
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            if (mask[y * sw + x] > 128) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          }
        }
        if (n < sw * sh * 0.004) { full(); vel[0] = vel[1] = vel[2] = 0; lastC.fill(null); return; }
        const fx = (x) => roi.x + x / sw * roi.w;
        const fy = (y) => roi.y + y / sh * roi.h;
        const bx0 = fx(x0), bx1 = fx(x1 + 1), by0 = fy(y0), by1 = fy(y1 + 1);
        // Sideways speed of the top, middle and bottom thirds of you.
        const yA = y0 + (y1 - y0) / 3, yB = y0 + 2 * (y1 - y0) / 3;
        bandY = [fy(yA), fy(yB)];
        const sx = [0, 0, 0], sn = [0, 0, 0];
        for (let y = y0; y <= y1; y++) {
          const b = y < yA ? 0 : (y < yB ? 1 : 2);
          for (let x = x0; x <= x1; x++) { if (mask[y * sw + x] > 128) { sx[b] += x; sn[b]++; } }
        }
        const dt = now - segAt;
        for (let b = 0; b < 3; b++) {
          if (sn[b] < 20) { vel[b] = 0; lastC[b] = null; continue; }
          const c = fx(sx[b] / sn[b]);
          if (lastC[b] !== null && dt > 0 && dt < 300) vel[b] = vel[b] * 0.4 + ((c - lastC[b]) / dt) * 0.6;
          lastC[b] = c;
        }
        // Next crop: the box around you plus a generous margin (wider when moving), at least a third of the frame.
        const speed = Math.max(Math.abs(vel[0]), Math.abs(vel[1]), Math.abs(vel[2])) * 150;
        const tw = clamp01((bx1 - bx0) * 1.3 + 0.1 + speed, 0.35, 1);
        const th = clamp01((by1 - by0) * 1.2 + 0.1, 0.35, 1);
        const [tx, ty] = boxAt((bx0 + bx1) / 2, (by0 + by1) / 2 - 0.03, tw, th);
        // You touch a side of the crop that is not the frame edge: widen straight away, no smoothing.
        const touch = (x0 <= 2 && roi.x > 0.001) || (x1 >= sw - 3 && roi.x + roi.w < 0.999)
          || (y0 <= 2 && roi.y > 0.001) || (y1 >= sh - 3 && roi.y + roi.h < 0.999);
        if (touch) {
          const nw = Math.min(1, Math.max(tw, roi.w) * 1.3);
          const nh = Math.min(1, Math.max(th, roi.h) * 1.3);
          moveRoi(...boxAt((bx0 + bx1) / 2, (by0 + by1) / 2, nw, nh));
        } else if (Math.abs(tx - roi.x) > 0.03 || Math.abs(ty - roi.y) > 0.03 || Math.abs(tw - roi.w) > 0.015 || Math.abs(th - roi.h) > 0.015) {
          // Dead zone and easing stop the crop from jittering.
          moveRoi(roi.x + (tx - roi.x) * 0.5, roi.y + (ty - roi.y) * 0.5, roi.w + (tw - roi.w) * 0.5, roi.h + (th - roi.h) * 0.5);
        }
      };
      // Background: picture cover-fitted once, or a blurred copy of the camera each frame.
      let bgCanvas = null;
      if (mode !== 'blur') {
        const src = await Backgrounds.image(mode);
        if (src) {
          bgCanvas = h('canvas', { width: w, height: hh });
          const bx = bgCanvas.getContext('2d');
          const sc = Math.max(w / src.width, hh / src.height);
          bx.drawImage(src, (w - src.width * sc) / 2, (hh - src.height * sc) / 2, src.width * sc, src.height * sc);
        }
      }
      const blurOn = !bgCanvas;
      const out = h('canvas', { width: w, height: hh });
      const gl = out.getContext('webgl', { premultipliedAlpha: false, antialias: false });
      if (!gl) throw new Error('no webgl');
      // If the graphics chip resets (overloaded or driver problem), fall back instead of leaving a frozen picture.
      out.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        if (this.video !== video) return;
        FxSafe.fail(studio ? 'studio' : 'background', 'graphics reset');
      });
      // Pass 1 (mid resolution): joint bilateral filter, as in Google's design. Smooths the rough model mask into an
      // even outline, letting it follow real colour edges in the picture (hair, shoulders, fingers) without catching
      // on patterns in the room. Pass 2 (full resolution): composite.
      let gw = Math.min(w, TIERS[tier].guide);
      let gh = Math.round(gw * hh / w);
      const vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
      // The mask arrives for the crop box (roi); outside it is room, unless the box edge is the frame edge (lim).
      // shf slides each third of you sideways by the predicted movement on frames without a fresh detection.
      const fsGuide = `precision highp float;varying vec2 uv;uniform sampler2D vid,msk;uniform vec2 gpx,bnd;uniform vec3 shf;uniform vec4 roi,lim;uniform float rad;
float mk(vec2 o){float s=mix(mix(shf.x,shf.y,smoothstep(bnd.x-.06,bnd.x+.06,o.y)),shf.z,smoothstep(bnd.y-.06,bnd.y+.06,o.y));
vec2 q=(vec2(o.x-s,o.y)-roi.xy)/roi.zw;if(q.x<lim.x||q.y<lim.y||q.x>lim.z||q.y>lim.w)return 0.;return texture2D(msk,clamp(q,0.,1.)).r;}
void main(){vec3 c0=texture2D(vid,uv).rgb;float s=0.;float ws=0.;float g=0.;float gs=0.;
for(int i=-3;i<=3;i++){for(int j=-3;j<=3;j++){vec2 d=vec2(float(i),float(j));vec2 o=uv+d*gpx*rad;vec3 dc=texture2D(vid,o).rgb-c0;
float m=mk(o);float sp=exp(-dot(d,d)*.18);float w=sp*exp(-dot(dc,dc)*20.);s+=m*w;ws+=w;g+=m*sp;gs+=sp;}}
/* mostly the smooth shape of you (even outline that follows your head), nudged by colour edges so it sits on
   your real edge; colour alone would let a dark room behind dark hair bulge into the outline */
/* colour may pull the outline in freely, but only push it out a little: a room the same colour as your clothes
   (white board behind a white shirt) can't be pulled in with you */
float gm=g/gs;float r=min(mix(gm,s/ws,.35),gm+.08);gl_FragColor=vec4(r,r,r,1.);}`;
      // Blur like Google Meet: a quarter-size copy of the room with you left out (each pixel weighted by how much it
      // is room), then a wide, even Gaussian blur in two directions, twice. The weights travel with the colours, so you
      // are never smeared into the room and the blur is equally smooth right up to your edge (no blocks).
      const fsDown = `precision mediump float;varying vec2 uv;uniform sampler2D vid,alp;uniform vec2 vpx;
float al(vec2 p){return texture2D(alp,vec2(p.x,1.-p.y)).r;}
void main(){vec3 s=vec3(0.);float ws=0.;vec3 all=vec3(0.);
for(int i=0;i<4;i++){for(int j=0;j<4;j++){vec2 o=uv+(vec2(float(i),float(j))-1.5)*vpx;vec3 c=texture2D(vid,o).rgb;float w=1.-smoothstep(.12,.45,al(o));
s+=c*w;ws+=w;all+=c;}}
gl_FragColor=vec4(ws>.01?s/ws:all/16.,ws/16.);}`;
      const fsBlur = `precision mediump float;varying vec2 uv;uniform sampler2D src;uniform vec2 dir;
vec4 fb(vec2 p){return texture2D(src,vec2(p.x,1.-p.y));}
void main(){vec3 s=vec3(0.);float ws=0.;float kw=0.;vec3 all=vec3(0.);
for(int i=-6;i<=6;i++){float k=exp(-float(i*i)/14.);vec4 t=fb(uv+dir*float(i));s+=t.rgb*t.a*k;ws+=t.a*k;kw+=k;all+=t.rgb*k;}
gl_FragColor=vec4(ws>.0005?s/ws:all/kw,ws/kw);}`;
      // Composite: you over the blurred room (or the picture) with a soft edge a couple of pixels wide. On the edge,
      // the colour is eased towards the average of the nearby pixels that are clearly you, which removes the room
      // and the dark rim webcams add next to bright clothes, without patches.
      const fs = `precision mediump float;varying vec2 uv;uniform sampler2D vid,alp,bg,blr,loc;uniform vec2 vpx;uniform float bb;
float al(vec2 p){return texture2D(alp,vec2(p.x,1.-p.y)).r;}
void main(){vec3 c=texture2D(vid,uv).rgb;float r=al(uv);
vec3 room=texture2D(blr,vec2(uv.x,1.-uv.y)).rgb;

/* a picture sits a little tighter round you than blur (as Google Meet does) */
float a=bb>.5?smoothstep(.29,.645,r):smoothstep(.32,.67,r);
/* on the soft edge, a pixel that looks just like the room behind you (a white board) is room, not you: fade it out,
   so no glowing halo of the real room shows around you */
vec4 lr=texture2D(loc,vec2(uv.x,1.-uv.y));
float sim=1.-smoothstep(.07,.24,min(length(c-room),lr.a>.05?length(c-lr.rgb):9.));a*=1.-sim*(1.-smoothstep(.75,.97,a));
vec3 b=bb>.5?room:texture2D(bg,uv).rgb;
float z=smoothstep(.05,.3,r)*(1.-smoothstep(.75,.97,r));
if(z>.01){vec3 s=vec3(0.);float ws=0.;
for(int i=-2;i<=2;i++){for(int j=-2;j<=2;j++){vec2 o=uv+vec2(float(i),float(j))*vpx*1.5;float k=smoothstep(.6,.95,al(o));s+=texture2D(vid,o).rgb*k;ws+=k;}}
if(ws>.3)c=mix(c,s/ws,z*.7);}
/* picture: edge pixels are part you, part real room; take the room's colour (known from the room-only blur) back out,
   so no fringe of the real room shows against the picture */
if(bb<.5&&a>.01&&a<.99){vec3 F=clamp((c-(1.-a)*room)/max(a,.3),0.,1.);c=mix(c,F,(1.-a)*.85);}
float e=(1.-a)*a*4.;vec3 f=mix(c,b,(bb>.5?.12:.03)*e);gl_FragColor=vec4(mix(b,f,a),1.);}`;
      const sh_ = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const prog = (f) => { const p = gl.createProgram(); gl.attachShader(p, sh_(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh_(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); return p; };
      const pG = prog(fsGuide);
      const pr = prog(fs);
      const pD = prog(fsDown);
      const pB = prog(fsBlur);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      [pG, pr, pD, pB].forEach((p) => { const l = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); });
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const mkTex = (unit) => {
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t);
        [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
        [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
        return t;
      };
      const tVid = mkTex(0);
      const tMsk = mkTex(1);
      const tBg = mkTex(2);
      const tAlp = mkTex(3);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gw, gh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const mkFb = (tex) => {
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return f;
      };
      const fb = mkFb(tAlp);
      // Quarter-size blur buffers (A and B, used in turn).
      const bw = Math.max(32, Math.round(w / 4));
      const bh = Math.max(18, Math.round(hh / 4));
      const tA = mkTex(4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const tB = mkTex(5);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fbA = mkFb(tA);
      const fbB = mkFb(tB);
      // A lightly blurred copy of the room only (no you): the local room colour right next to you, used to recognise
      // room pixels on your edge (a white board) and fade them out.
      const tC = mkTex(6);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fbC = mkFb(tC);
      gl.useProgram(pD);
      gl.uniform1i(gl.getUniformLocation(pD, 'vid'), 0);
      gl.uniform1i(gl.getUniformLocation(pD, 'alp'), 3);
      gl.uniform2f(gl.getUniformLocation(pD, 'vpx'), 1 / w, 1 / hh);
      gl.useProgram(pB);
      const uSrc = gl.getUniformLocation(pB, 'src');
      const uDir = gl.getUniformLocation(pB, 'dir');
      gl.useProgram(pG);
      gl.uniform1i(gl.getUniformLocation(pG, 'vid'), 0);
      gl.uniform1i(gl.getUniformLocation(pG, 'msk'), 1);
      const uGpx = gl.getUniformLocation(pG, 'gpx');
      const uRoi = gl.getUniformLocation(pG, 'roi');
      const uLim = gl.getUniformLocation(pG, 'lim');
      const uShf = gl.getUniformLocation(pG, 'shf');
      const uBnd = gl.getUniformLocation(pG, 'bnd');
      const uRad = gl.getUniformLocation(pG, 'rad');
      gl.uniform1f(uRad, 1.8);
      gl.uniform2f(uGpx, 1 / gw, 1 / gh);
      // Change the edge-detail resolution (quality levels).
      const setGuide = (n) => {
        gw = Math.min(w, n);
        gh = Math.round(gw * hh / w);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, tAlp);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gw, gh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.useProgram(pG);
        gl.uniform2f(uGpx, 1 / gw, 1 / gh);
      };
      const setTier = (t) => {
        t = Math.max(0, Math.min(TIERS.length - 1, t));
        if (t === tier) return;
        tier = t;
        lastTierChange = performance.now();
        goodWins = badWins = 0;
        if (Math.min(w, TIERS[t].guide) !== gw) setGuide(TIERS[t].guide);
      };
      this.quality = () => ({ tier, roi: { ...roi }, vel: vel.slice() }); // for testing
      this.setTier = setTier;
      gl.useProgram(pr);
      gl.uniform1i(gl.getUniformLocation(pr, 'vid'), 0);
      gl.uniform1i(gl.getUniformLocation(pr, 'bg'), 2);
      gl.uniform1i(gl.getUniformLocation(pr, 'alp'), 3);
      gl.uniform1i(gl.getUniformLocation(pr, 'blr'), 4);
      gl.uniform1i(gl.getUniformLocation(pr, 'loc'), 6);
      gl.uniform1f(gl.getUniformLocation(pr, 'bb'), blurOn ? 1 : 0);
      // Blur strength (the slider): the spacing of the blur samples. 0 = light, 1 = strong. Changes live.
      let step = 2;
      const setAmount = (amt) => { step = 0.6 + 2.0 * Math.max(0, Math.min(1, amt)); };
      setAmount(S.blurAmt);
      this.setAmount = setAmount;
      gl.uniform2f(gl.getUniformLocation(pr, 'vpx'), 1 / w, 1 / hh);
      if (bgCanvas) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, tBg);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, bgCanvas);
      }
      this.video = video;
      this.gl = gl;
      FxSafe.mark(studio ? 'studio' : 'standard');
      let lastT = -1;
      let lastMark = 0;
      let lastSeg = 0;
      const frame = () => {
        if (this.video !== video) return;
        try {
        if (performance.now() - lastMark > 5000) { lastMark = performance.now(); FxSafe.mark(studio ? 'studio' : 'standard'); }
        if (gl.isContextLost()) return FxSafe.fail(studio ? 'studio' : 'background', 'graphics lost');
        if (video.readyState >= 2 && video.currentTime !== lastT) {
          lastT = video.currentTime;
          // The person cut-out runs about 15 times a second (smoothed between runs); the picture itself is drawn
          // at the full camera frame rate. This halves the work and keeps video smooth on ordinary computers.
          // Like Google Meet: the cut-out is worked out for every camera frame, so it always matches the picture
          // (a cut-out from an earlier frame shows a halo when you move). Slower computers without graphics
          // acceleration for the detector do it every other frame.
          const t0 = performance.now();
          const segNow = studio || t0 - lastSeg >= TIERS[tier].every;
          if (segNow) {
            lastSeg = t0;
            mroi = { x: roi.x, y: roi.y, w: roi.w, h: roi.h };
            sctx.drawImage(video, roi.x * w, roi.y * hh, roi.w * w, roi.h * hh, 0, 0, sw, sh);
          }
          if (!studio && segNow) this.segmenter.segmentForVideo(small, t0, (res) => {
            const ms = res.confidenceMasks;
            const bgConf = ms[0].getAsFloat32Array();
            // Person = 1 - background (multiclass category 0 is background; the basic model's single mask is the person).
            // (2) Steady outline: how much are you moving? (share of your pixels that changed a lot, plus how fast you
            // were moving at the last detection). Edge wobble from the detector is a small share; real movement is big.
            motCtx.drawImage(video, 0, 0, MW, MH);
            const md = motCtx.getImageData(0, 0, MW, MH).data;
            const lum = new Float32Array(MW * MH);
            for (let i = 0; i < lum.length; i++) lum[i] = (md[i * 4] * 0.299 + md[i * 4 + 1] * 0.587 + md[i * 4 + 2] * 0.114) / 255;
            for (let i = 0; i < lum.length; i++) motRaw[i] = motPrev ? sstep(.025, .1, Math.abs(lum[i] - motPrev[i])) : 0;
            motPrev = lum;
            // Spread each moving cell to its neighbours, so the whole edge of a moving arm counts as moving.
            for (let y = 0; y < MH; y++) {
              for (let x = 0; x < MW; x++) {
                let m = 0;
                for (let dy = -1; dy <= 1; dy++) {
                  const yy = Math.min(MH - 1, Math.max(0, y + dy)) * MW;
                  for (let dx = -1; dx <= 1; dx++) m = Math.max(m, motRaw[yy + Math.min(MW - 1, Math.max(0, x + dx))]);
                }
                motMap[y * MW + x] = m;
              }
            }
            let big = 0, body = 0;
            for (let i = 0; i < mask.length; i++) {
              const pers = this.multiclass ? 1 - bgConf[i] : bgConf[i];
              if (pers > .5 || prev[i] > .5) { body++; if (Math.abs(pers - prev[i]) > .5) big++; }
            }
            const moving = Math.max(sstep(.025, .09, body ? big / body : 0),
              sstep(.0012, .006, Math.max(Math.abs(vel[0]) * 0.5, Math.abs(vel[1]), Math.abs(vel[2])) * 33));
            // Sitting still: the outline changes slowly and evenly (detector wobble is averaged away, so no bits of room
            // pop in and out). Moving: it follows straight away, so there is no gap.
            for (let i = 0; i < mask.length; i++) {
              const pers = this.multiclass ? 1 - bgConf[i] : bgConf[i];
              const mx = Math.min(MW - 1, Math.floor((mroi.x + ((i % sw) + 0.5) / sw * mroi.w) * MW));
              const my = Math.min(MH - 1, Math.floor((mroi.y + (Math.floor(i / sw) + 0.5) / sh * mroi.h) * MH));
              const k = havePrev ? .28 + .7 * Math.max(moving, motMap[my * MW + mx]) : 1;
              const v = prev[i] + (pers - prev[i]) * k;
              prev[i] = v;
              mask[i] = v * 255;
            }
            havePrev = true;
          });
          // Crop box and slide used for this frame's mask (the mask still belongs to the box it was made in).
          gl.useProgram(pG);
          gl.uniform4f(uRoi, mroi.x, mroi.y, mroi.w, mroi.h);
          // The edge filter's window follows the mask's detail: a tighter crop = finer mask = smaller window.
          gl.uniform1f(uRad, 1.8 * Math.max(0.5, Math.max(mroi.w, mroi.h * hh / w) * (this.radK || 1)));
          gl.uniform4f(uLim, mroi.x <= 0.001 ? -9 : 0, mroi.y <= 0.001 ? -9 : 0, mroi.x + mroi.w >= 0.999 ? 9 : 1, mroi.y + mroi.h >= 0.999 ? 9 : 1);
          gl.uniform2f(uBnd, bandY[0], bandY[1]);
          if (segNow) {
            gl.uniform3f(uShf, 0, 0, 0);
          } else {
            const ago = t0 - segAt;
            const sl = (v) => Math.max(-0.06, Math.min(0.06, v * ago));
            gl.uniform3f(uShf, sl(vel[0]), sl(vel[1]), sl(vel[2]));
          }
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, tMsk);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, sw, sh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, mask);
          // Plan the next crop after this frame's mask is uploaded with the box it was made in.
          if (segNow && !studio) { track(t0); segAt = t0; }
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tVid);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.viewport(0, 0, gw, gh);
          gl.useProgram(pG);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.activeTexture(gl.TEXTURE3);
          gl.bindTexture(gl.TEXTURE_2D, tAlp);
          {
            // Room without you, quarter size (blur mode shows it; picture mode uses it to clean your edge colour) -> A; then blur A->B (across), B->A (down), twice.
            gl.viewport(0, 0, bw, bh);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
            gl.useProgram(pD);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.useProgram(pB);
            // First round with tightly packed samples (removes fine detail such as book spines, so the wide rounds
            // that follow cannot leave stripes), then two wide rounds; together the same strength as the slider.
            const s0 = Math.min(step, 1);
            const s1 = Math.sqrt(Math.max(0.01, (2 * step * step - s0 * s0) / 2));
            [s0, s1, s1].forEach((st, n) => {
              gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
              gl.uniform1i(uSrc, 4);
              gl.uniform2f(uDir, st / bw, 0);
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
              gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
              gl.uniform1i(uSrc, 5);
              gl.uniform2f(uDir, 0, st / bh);
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
              if (n === 0) {
                // Keep the lightly blurred room (after the fine round) as the local room colour.
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbC);
                gl.uniform1i(uSrc, 4);
                gl.uniform2f(uDir, 0, 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
              }
            });
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, w, hh);
          gl.useProgram(pr);
          gl.activeTexture(gl.TEXTURE3);
          gl.bindTexture(gl.TEXTURE_2D, tAlp);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          // (4) Quality levels: step down after two slow 30-frame windows (or three very slow frames in a row),
          // step back up after five quick windows. One second between changes.
          const cost = performance.now() - t0;
          slowRun = cost > 60 ? slowRun + 1 : 0;
          winCost += cost; winN++;
          const now = performance.now();
          if (this.fixedTier != null) { if (tier !== this.fixedTier) setTier(this.fixedTier); } else if (slowRun >= 4 && now - lastTierChange > 1000) { setTier(tier + 1); slowRun = 0; winCost = winN = 0; }
          if (winN >= 30 && this.fixedTier == null) {
            const avg = winCost / winN;
            winCost = winN = 0;
            if (avg > 30) { badWins++; goodWins = 0; } else if (avg < 14) { goodWins++; badWins = 0; } else { goodWins = badWins = 0; }
            if (now - lastTierChange > 1000) {
              if (badWins >= 2) setTier(tier + 1);
              else if (goodWins >= 5 && !(this.cpu && tier <= 1)) setTier(tier - 1);
            }
          }
        }
        } catch (err) {
          // Never leave a frozen picture or an endless error loop: hand over to the safe path once.
          return FxSafe.fail(studio ? 'studio' : 'background', err && err.message);
        }
      };
      // Keeps drawing when the tab is in the background, so the class never sees a frozen picture.
      this.loopOff = frameLoop(video, frame, () => this.video === video);
      const t = out.captureStream(fps).getVideoTracks()[0];
      t.contentHint = 'motion';
      this.track = t;
      return t;
    } catch (e) {
      console.warn(e);
      this.stop();
      toast('Background effects are not available on this device.');
      return raw;
    }
  },
  // Release everything: the loop, the hidden video, the canvas track and the WebGL context (graphics memory).
  stop() {
    cancelAnimationFrame(this.raf);
    if (this.loopOff) { this.loopOff(); this.loopOff = null; }
    if (this.video) this.video.srcObject = null;
    this.video = null; // set first, so the context-lost event below is ignored
    if (this.track) { try { this.track.stop(); } catch (e) { /* ignore */ } }
    this.track = null;
    if (this.gl) { try { const x = this.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* ignore */ } }
    this.gl = null;
    FxSafe.mark(false);
  },
};
// Runs after Blur exists: if the last page died while effects were running, start safer this time.
FxSafe.checkLastCrash();
window.addEventListener('pagehide', () => FxSafe.mark(false));

function bgLabel() {
  if (!S.bg || S.bg === 'none') return 'None';
  if (S.bg === 'blur') return 'Blur';
  if (S.bg === 'custom') return 'Your picture';
  return (Backgrounds.list.find((b) => b.id === S.bg) || Backgrounds.photos.find((b) => b.id === S.bg) || {}).name || 'On';
}

function renameMe() {
  const cur = (S.participants.get(S.cid) || {}).name || ME.name;
  const v = window.prompt('Your name as others see it in this class (leave empty to use your Moodle name):', cur);
  if (v === null) return;
  const name = v.replace(/\s+/g, ' ').trim().slice(0, 60);
  lsSet('dname', name);
  send({ t: 'rename', name });
}

async function setBlur(on) {
  return setBackground(on ? 'blur' : 'none');
}

// Blur strength slider (0 = light, 1 = strong). Remembered on this device; applied live.
function setBlurAmount(v) {
  S.blurAmt = Math.max(0, Math.min(1, v));
  lsSet('blurAmt', String(S.blurAmt));
  if (S.bg !== 'blur') return setBackground('blur');
  if (Blur.video && Blur.setAmount) Blur.setAmount(S.blurAmt);
}
function blurSlider() {
  return h('label', { class: 'lm-menu-item lm-slider' }, icon('blur'), h('span', {}, 'Blur strength'),
    h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(S.blurAmt * 100), 'aria-label': 'Blur strength',
      oninput: (e) => setBlurAmount(e.target.value / 100) }),
    h('small', { class: 'ends' }, h('span', {}, 'Light'), h('span', {}, 'Strong')));
}

// Studio look sliders (0..1): brightness and zoom. Remembered on this device; applied live.
function setLookValue(key, v) {
  S[key] = Math.max(0, Math.min(1, v));
  lsSet(key === 'lookZoom' ? 'lookZoom2' : key, String(S[key]));
  if (!S.look) setLook(true);
}
function lookSliders() {
  const one = (key, ic, label, lo, hi) => h('label', { class: 'lm-menu-item lm-slider' }, icon(ic), h('span', {}, label),
    h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(S[key] * 100), 'aria-label': label,
      oninput: (e) => setLookValue(key, e.target.value / 100) }),
    h('small', { class: 'ends' }, h('span', {}, lo), h('span', {}, hi)));
  return [one('lookBright', 'sun', 'Brightness', 'Darker', 'Brighter'), one('lookZoom', 'search', 'Zoom', 'Full view', 'Close')];
}

async function setBackground(mode) {
  S.bg = mode;
  S.blur = mode === 'blur';
  lsSet('bg', mode);
  lsSet('blur', S.blur ? '1' : '0');
  if (S.room) renderBar();
  await rebuildCam();
  if (S.room) renderBar();
}

// ------------------------------------------------------------------ virtual backgrounds (green screen without the green screen)
// Built-in pictures are painted in the browser (no downloads); "Your picture" is kept on this device only.
// ------------------------------------------------------------------ class picture (chosen in the waiting room)
// Take a photo with the camera, upload one, or pick a fun avatar. Saved to the person's Moodle files (never their
// Moodle profile), shown on their tile, in People and next to their captions in every class.
const Avatar = {
  FUN: [['🦊', '#ff9f2e', '#ffd28a'], ['🐼', '#8c9eff', '#dfe4ff'], ['🦉', '#a46bff', '#e3d2ff'], ['🐨', '#3fa3ff', '#cfe6ff'],
    ['🐯', '#f78e08', '#ffe1b8'], ['🐙', '#ff5fb0', '#ffd6ea'], ['🦁', '#e2c227', '#fff1b3'], ['🐸', '#2fc46b', '#c9f2d8'],
    ['🐧', '#22c3c3', '#c8f1f1'], ['🦄', '#c6007f', '#ffd1ec'], ['🐶', '#a0573e', '#f2d9cc'], ['🚀', '#0a60e9', '#cfe0ff']],
  face(size) {
    return realPic(ME.pic) ? h('img', { class: 'lm-av-img', src: ME.pic, alt: '', style: `width:${size}px;height:${size}px` })
      : h('span', { class: 'lm-av-txt', style: `width:${size}px;height:${size}px;background:${tone(ME.name)}` }, initials(ME.name));
  },
  fun([e, a, b]) {
    const c = h('canvas', { width: 192, height: 192 });
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 192, 192);
    g.addColorStop(0, b); g.addColorStop(1, a);
    x.fillStyle = g;
    x.fillRect(0, 0, 192, 192);
    x.font = '118px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(e, 96, 104);
    return c;
  },
  async save(dataUrl) {
    const body = new URLSearchParams({ sesskey: C.sesskey });
    if (dataUrl) body.set('data', dataUrl); else body.set('remove', '1');
    try {
      const r = await fetch(C.avatarUrl, { method: 'POST', credentials: 'same-origin', body });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.pic) throw new Error(j.error || 'Could not save your picture.');
      ME.pic = j.pic;
      C.token = j.token; // the class sees the new picture when you join
      C.customPic = !!j.custom;
      toast(dataUrl ? 'Picture saved. Everyone sees it in class.' : 'Using your Moodle picture.');
      return true;
    } catch (e) {
      toast('⚠️ ' + e.message);
      return false;
    }
  },
  open(video, redraw) {
    const sheet = h('div', { class: 'lm-sheet lm-av-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lm-av-title' });
    const el = h('div', { class: 'lm-sheet-backdrop', onclick: (e) => e.target === el && close() }, sheet);
    const close = () => { el.remove(); if (redraw) redraw(); };
    el.addEventListener('keydown', (e) => e.key === 'Escape' && close());
    const done = async (data) => { sheet.classList.add('busy'); if (await this.save(data)) close(); else sheet.classList.remove('busy'); };
    const snap = () => {
      if (!video || !video.videoWidth) return toast('Turn your camera on first, then take your photo.');
      const side = Math.min(video.videoWidth, video.videoHeight);
      const c = h('canvas', { width: 384, height: 384 });
      const x = c.getContext('2d');
      x.translate(384, 0); x.scale(-1, 1); // same as the mirrored preview
      x.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, 384, 384);
      done(c.toDataURL('image/jpeg', .9));
    };
    const upload = () => {
      const inp = h('input', { type: 'file', accept: 'image/*' });
      inp.onchange = async () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        try {
          const bmp = await createImageBitmap(f);
          const side = Math.min(bmp.width, bmp.height);
          const c = h('canvas', { width: 384, height: 384 });
          c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 384, 384);
          done(c.toDataURL('image/jpeg', .9));
        } catch (e) { toast('Could not use that picture.'); }
      };
      inp.click();
    };
    sheet.replaceChildren(
      h('header', {}, h('h3', { id: 'lm-av-title' }, 'Your picture in class'), h('button', { class: 'lm-icon-btn', 'aria-label': 'Close', onclick: close }, icon('x'))),
      h('div', { class: 'lm-av-now' }, this.face(84), h('p', { class: 'lm-sheet-hint' }, 'Shown on your tile when your camera is off, in People, and next to your captions. Your Moodle profile picture is not changed.')),
      h('div', { class: 'lm-av-acts' },
        h('button', { class: 'lm-primary', onclick: snap, disabled: !(video && video.videoWidth) }, icon('cam'), 'Take a photo'),
        h('button', { class: 'lm-secondary', onclick: upload }, icon('plus'), 'Upload a picture')),
      h('h4', { class: 'lm-av-h' }, 'Or pick a fun avatar'),
      h('div', { class: 'lm-av-grid' }, ...this.FUN.map((f) => {
        const c = this.fun(f);
        return h('button', { class: 'lm-av-fun', 'aria-label': 'Avatar ' + f[0], onclick: () => done(c.toDataURL('image/jpeg', .92)) }, c);
      })),
      C.customPic ? h('button', { class: 'lm-linkish lm-av-reset', onclick: () => done(null) }, 'Use my Moodle picture instead') : '');
    document.body.append(el);
  },
};

const Backgrounds = {
  list: [
    { id: 'studio', name: 'Studio', paint: (x, w, hh) => Backgrounds.grad(x, w, hh, ['#e9edf2', '#b9c2cc'], 'radial') },
    { id: 'lavender', name: 'Lavender', paint: (x, w, hh) => { Backgrounds.grad(x, w, hh, ['#efe6ff', '#b58cf6'], 'linear'); Backgrounds.blobs(x, w, hh, ['#ffffff', '#d9c2ff', '#c6007f'], 9); } },
    { id: 'ocean', name: 'Ocean', paint: (x, w, hh) => { Backgrounds.grad(x, w, hh, ['#d6ecff', '#0a60e9'], 'linear'); Backgrounds.blobs(x, w, hh, ['#ffffff', '#8ccaff'], 9); } },
    { id: 'sunset', name: 'Sunset', paint: (x, w, hh) => { Backgrounds.grad(x, w, hh, ['#ffe1b8', '#f78e08', '#c6007f'], 'linear'); Backgrounds.blobs(x, w, hh, ['#fff4d6', '#ffd08a'], 8); } },
    { id: 'forest', name: 'Forest', paint: (x, w, hh) => { Backgrounds.grad(x, w, hh, ['#d9f2df', '#1f7a4c'], 'linear'); Backgrounds.blobs(x, w, hh, ['#f4ffe9', '#9bd8a5'], 12); } },
  ],
  // Office photos shipped inside the plugin (client/backgrounds), so they load from the client's own Moodle.
  photos: [
    { id: 'office', name: 'Open-plan office', file: 'open-plan' },
    { id: 'executive', name: 'Executive office', file: 'executive' },
    { id: 'scandi', name: 'Home office', file: 'scandi' },
    { id: 'loft', name: 'Brick loft', file: 'loft' },
    { id: 'library', name: 'Library', file: 'library' },
    { id: 'plantwall', name: 'Plant wall', file: 'plant-wall' },
    { id: 'skyline', name: 'City view', file: 'skyline' },
    { id: 'cowork', name: 'Creative studio', file: 'cowork' },
    { id: 'coastal', name: 'Beach office', file: 'coastal' },
    { id: 'training', name: 'Training room', file: 'training' },
  ],
  photoUrl(b, thumb) { return new URL(`./backgrounds/${thumb ? 'thumbs/' : ''}${b.file}.jpg`, import.meta.url).href; },
  cache: {},
  grad(x, w, hh, cols, kind) {
    const g = kind === 'radial' ? x.createRadialGradient(w * .5, hh * .35, hh * .1, w * .5, hh * .5, w * .75) : x.createLinearGradient(0, 0, w * .4, hh);
    cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    x.fillStyle = g;
    x.fillRect(0, 0, w, hh);
  },
  blobs(x, w, hh, cols, n) {
    let seed = n * 97;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    x.filter = 'blur(' + Math.round(w / 40) + 'px)';
    for (let i = 0; i < n; i++) {
      x.globalAlpha = .25 + rnd() * .35;
      x.fillStyle = cols[i % cols.length];
      x.beginPath();
      x.arc(rnd() * w, rnd() * hh, (.04 + rnd() * .12) * w, 0, Math.PI * 2);
      x.fill();
    }
    x.filter = 'none';
    x.globalAlpha = 1;
  },
  canvas(id, w = 1920, hh = 1080) {
    const key = id + w;
    if (this.cache[key]) return this.cache[key];
    const b = this.list.find((x) => x.id === id);
    if (!b) return null;
    const c = h('canvas', { width: w, height: hh });
    b.paint(c.getContext('2d'), w, hh);
    return (this.cache[key] = c);
  },
  async image(mode) {
    if (mode === 'custom') {
      const data = this.custom || lsGet('bgimg');
      if (!data) return null;
      if (this.customImg && this.customImg.src === data) return this.customImg;
      const img = new Image();
      img.src = data;
      await img.decode().catch(() => {});
      if (img.width) this.customImg = img;
      return img.width ? img : null;
    }
    const ph = this.photos.find((b) => b.id === mode);
    if (ph) {
      if (this.cache[mode]) return this.cache[mode];
      const img = new Image();
      img.src = this.photoUrl(ph);
      await img.decode().catch(() => {});
      return img.width ? (this.cache[mode] = img) : null;
    }
    return this.canvas(mode);
  },
  upload() {
    const inp = h('input', { type: 'file', accept: 'image/*' });
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try {
        toast('Adding your picture…');
        // Shrink the photo off the main thread first (a phone photo can be 12 megapixels), then encode it
        // asynchronously, so nothing freezes while it is added.
        const probe = await createImageBitmap(f);
        const sc = Math.min(1, 1920 / probe.width, 1080 / probe.height);
        const cw = Math.round(probe.width * sc), ch = Math.round(probe.height * sc);
        probe.close && probe.close();
        const bmp = await createImageBitmap(f, { resizeWidth: cw, resizeHeight: ch, resizeQuality: 'high' });
        const c = h('canvas', { width: cw, height: ch });
        c.getContext('2d').drawImage(bmp, 0, 0);
        bmp.close && bmp.close();
        const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
        let data = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
        if (data.length > 2500000) data = c.toDataURL('image/jpeg', .6);
        lsSet('bgimg', data);
        if (lsGet('bgimg') !== data) toast('That picture is too large to keep for next time, but it is used now.');
        this.custom = data;
        this.close();
        await setBackground('custom');
      } catch (e) {
        toast('Could not use that picture.');
      }
    };
    inp.click();
  },
  open() {
    this.sheet = h('div', { class: 'lm-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lm-bg-title' });
    this.el = h('div', { class: 'lm-sheet-backdrop', onclick: (e) => e.target === this.el && this.close() }, this.sheet);
    this.el.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    document.body.append(this.el);
    this.render();
  },
  close() {
    if (this.el) this.el.remove();
    this.el = null;
  },
  render() {
    if (!this.el) return;
    const tile = (mode, label, thumb) => h('button', {
      class: 'lm-bg-tile' + (S.bg === mode ? ' on' : ''), 'aria-pressed': S.bg === mode ? 'true' : 'false',
      onclick: async () => { await setBackground(mode); this.render(); },
    }, thumb, h('span', {}, label));
    const pic = (src) => { const c = h('canvas', { width: 160, height: 90 }); const x = c.getContext('2d'); if (src) { const sc = Math.max(160 / src.width, 90 / src.height); x.drawImage(src, (160 - src.width * sc) / 2, (90 - src.height * sc) / 2, src.width * sc, src.height * sc); } return c; };
    const custom = lsGet('bgimg') || this.custom;
    let customThumb = h('div', { class: 'lm-bg-icon' }, icon('plus'));
    if (custom) { const im = new Image(); im.src = custom; im.className = 'lm-bg-img'; customThumb = im; }
    this.sheet.replaceChildren(
      h('header', {},
        h('h3', { id: 'lm-bg-title' }, 'Background'),
        h('button', { class: 'lm-icon-btn', 'aria-label': 'Close', onclick: () => this.close() }, icon('x'))),
      h('p', { class: 'lm-sheet-hint' }, S.camOn ? 'Pick a background. Everyone sees it straight away.' : 'Pick a background. It is used when you turn your camera on.'),
      h('div', { class: 'lm-bg-grid' },
        tile('none', 'None', h('div', { class: 'lm-bg-icon' }, icon('cam'))),
        tile('blur', 'Blur', h('div', { class: 'lm-bg-icon blur' }, icon('blur'))),
        ...this.photos.map((b) => tile(b.id, b.name, h('img', { class: 'lm-bg-img', src: this.photoUrl(b, true), alt: '', loading: 'lazy' }))),
        ...this.list.map((b) => tile(b.id, b.name, pic(this.canvas(b.id, 320, 180)))),
        custom ? tile('custom', 'Your picture', customThumb) : '',
        h('button', { class: 'lm-bg-tile', onclick: () => this.upload() }, h('div', { class: 'lm-bg-icon' }, icon('plus')), h('span', {}, custom ? 'Change picture' : 'Upload a picture'))),
      h('p', { class: 'lm-sheet-hint small' }, 'Your picture stays on this device. Works best with good light in front of you.'));
  },
};

async function setSmooth(on) {
  S.smooth = on;
  lsSet('smooth', on ? '1' : '0');
  if (S.room) renderBar(); // show the new state straight away (the button stayed lit, so a second click turned it back on)
  await rebuildCam();
  if (S.room) renderBar();
  if (on && !Smooth.ok) toast('Smooth skin is not available on this device.');
}

// ------------------------------------------------------------------ smooth skin (one-click touch-up)
// WebGL edge-preserving filter: a bilateral blur applied only to skin tones, blended softly with the
// original, plus a gentle lift of shadows. Eyes, hair, lips and the background stay sharp.
// Runs on the GPU at the camera's own resolution and frame rate (1080p for trainers).
const Smooth = {
  ok: true, video: null, raf: null, gl: null,
  wrap(raw) {
    try {
      const st = raw.getSettings();
      const w = st.width || 1280;
      const hh = st.height || 720;
      const fps = Math.min(30, Math.round(st.frameRate || 30));
      const video = h('video', { muted: true, playsinline: true });
      video.srcObject = new MediaStream([raw]);
      video.play().catch(() => {});
      const cv = h('canvas', { width: w, height: hh });
      const gl = cv.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: false, antialias: false });
      if (!gl) throw new Error('no webgl');
      cv.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        if (this.video !== video) return;
        FxSafe.fail('smooth', 'graphics reset');
      });
      const vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
      const fs = `precision mediump float;varying vec2 uv;uniform sampler2D t;uniform vec2 px;
float skin(vec3 c){float y=dot(c,vec3(.299,.587,.114));float cb=.5+dot(c,vec3(-.1687,-.3313,.5));float cr=.5+dot(c,vec3(.5,-.4187,-.0813));
return smoothstep(.27,.33,cb)*(1.-smoothstep(.50,.56,cb))*smoothstep(.50,.53,cr)*(1.-smoothstep(.68,.72,cr))*smoothstep(.08,.18,y);}
void main(){vec3 c=texture2D(t,uv).rgb;vec3 acc=c;float ws=1.;
for(int i=-3;i<=3;i++){for(int j=-3;j<=3;j++){if(i==0&&j==0)continue;vec2 o=vec2(float(i),float(j))*px*1.6;vec3 s=texture2D(t,uv+o).rgb;
vec3 d=s-c;float w=exp(-dot(d,d)*90.)*exp(-float(i*i+j*j)*.08);acc+=s*w;ws+=w;}}
vec3 sm=acc/ws;float m=skin(c)*.75;vec3 o=mix(c,sm,m);o=o+(1.-o)*.035*m;o=pow(o,vec3(.97));gl_FragColor=vec4(o,1.);}`;
      const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(pr);
      gl.useProgram(pr);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
      gl.uniform2f(gl.getUniformLocation(pr, 'px'), 1 / w, 1 / hh);
      gl.viewport(0, 0, w, hh);
      this.video = video;
      this.gl = gl;
      const draw = () => {
        if (this.video !== video) return;
        try {
          if (gl.isContextLost()) return FxSafe.fail('smooth', 'graphics lost');
          if (video.readyState >= 2) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          }
        } catch (err) { return FxSafe.fail('smooth', err && err.message); }
      };
      this.loopOff = frameLoop(video, draw, () => this.video === video);
      const out = cv.captureStream(fps).getVideoTracks()[0];
      out.contentHint = 'motion';
      this.track = out;
      this.ok = true;
      return out;
    } catch (e) {
      console.warn('smooth skin', e);
      this.ok = false;
      return raw;
    }
  },
  stop() {
    cancelAnimationFrame(this.raf);
    if (this.loopOff) { this.loopOff(); this.loopOff = null; }
    if (this.video) this.video.srcObject = null;
    this.video = null;
    if (this.track) { try { this.track.stop(); } catch (e) { /* ignore */ } }
    this.track = null;
    if (this.gl) { try { const x = this.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* ignore */ } }
    this.gl = null;
  },
};

async function setNoiseSuppression(on) {
  S.noiseSuppression = on;
  lsSet('ns', on ? '1' : '0');
  if (S.mic) await S.mic.applyConstraints({ noiseSuppression: on, echoCancellation: true, autoGainControl: true }).catch(() => {});
}

// ------------------------------------------------------------------ speaking detection
let audioCtx = null;
const analysers = new Map();
function watchSpeaking(track, cid) {
  if (!track || !audioCtx) return;
  try {
    const src = audioCtx.createMediaStreamSource(new MediaStream([track]));
    const an = audioCtx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    analysers.set(cid, { an, buf: new Uint8Array(an.fftSize), track });
  } catch (e) { /* ignore */ }
}
setInterval(() => {
  let changed = false;
  for (const [cid, a] of analysers) {
    if (a.track.readyState === 'ended') {
      analysers.delete(cid);
      continue;
    }
    a.an.getByteTimeDomainData(a.buf);
    let sum = 0;
    for (const v of a.buf) sum += (v - 128) * (v - 128);
    const level = Math.sqrt(sum / a.buf.length);
    const isMe = cid === S.cid;
    const speaking = level > 6 && (!isMe || S.micOn);
    if (speaking) S.lastSpoke.set(cid, Date.now());
    if (!!S.speaking.get(cid) !== speaking) {
      S.speaking.set(cid, speaking);
      changed = true;
    }
  }
  if (changed) {
    document.querySelectorAll('.lm-tile').forEach((t) => t.classList.toggle('speaking', !!S.speaking.get(t.dataset.cid)));
    if (S.view === 'speaker') renderStage();
  }
}, 200);

// ------------------------------------------------------------------ layout & subscriptions
function videoAllowedFor(p) {
  const pp = pol();
  if (!p.tr || !p.tr.v || (p.mu && p.mu.v)) return false;
  if (pp.spot === p.cid) return true;
  if (pp.video === 'all') return true;
  if (pp.video === 'teachers') return p.mod;
  return false;
}

function sortedPeers() {
  const spot = pol().spot;
  return roomPeers().sort((a, b) => (b.cid === spot) - (a.cid === spot) || b.mod - a.mod || a.j - b.j);
}

// Decide what the stage shows and which cameras are visible at which quality.
function layout() {
  const peers = sortedPeers();
  const screenOwner = peers.find((p) => p.tr && p.tr.s);
  const st = S.room ? S.room.stage : 'grid';
  // Auto view: in a big class with only one or two cameras (e.g. "teachers only"), show the camera large.
  const withVideo = peers.filter((p) => (p.cid === S.cid ? S.camOn : videoAllowedFor(p)));
  const autoSpeaker = S.view === 'auto' && peers.length > 6 && withVideo.length > 0 && withVideo.length <= 2;
  let stage = 'gallery';
  if (st === 'wb') stage = 'wb';
  else if (st === 'pres' && S.room.pres) stage = 'pres';
  else if (st === 'slates' && S.room.slates) stage = 'slates';
  else if (screenOwner) stage = 'screen';
  else if (S.view === 'speaker' || pol().spot || autoSpeaker) stage = 'speaker';

  let big = null;
  if (stage === 'speaker') {
    const spot = pol().spot && S.participants.get(pol().spot);
    if (spot && spot.room === S.room.key) big = spot;
    else {
      // Prefer the most recent speaker who has a camera; fall back to the most recent speaker.
      const others = peers.filter((p) => p.cid !== S.cid);
      const rank = (a, b) => (S.lastSpoke.get(b.cid) || 0) - (S.lastSpoke.get(a.cid) || 0) || b.mod - a.mod;
      const cams = others.filter(videoAllowedFor).sort(rank);
      big = cams[0] || others.sort(rank)[0] || peers[0];
    }
  }
  const tiles = stage === 'gallery' ? peers : peers.filter((p) => !big || p.cid !== big.cid);
  const max = Math.max(1, C.maxVideo || 12);
  const blockVideo = S.dataSaver;
  const want = new Map(); // cid -> rid
  if (!blockVideo) {
    if (big && big.cid !== S.cid && videoAllowedFor(big)) want.set(big.cid, bigRid(big));
    const stripMax = stage === 'gallery' ? max : Math.min(max, 6);
    const n = tiles.length;
    const ridFor = stage !== 'gallery' ? 'q' : n <= 4 ? 'f' : n <= 9 ? 'h' : 'q';
    let count = 0;
    for (const p of tiles) {
      if (count >= stripMax) break;
      if (p.cid === S.cid || !videoAllowedFor(p)) continue;
      want.set(p.cid, p.mod && ridFor === 'f' ? 'h' : ridFor); // a trainer's 720p layer is already HD in a gallery tile
      count++;
    }
    // Tab in the background: keep every video running on its smallest layer (no stall when you come back, and
    // almost no data), then switch straight back to full quality when the tab is visible again.
    if (S.hidden) for (const k of want.keys()) want.set(k, 'q');
  }
  return { stage, big, tiles, want, screenOwner };
}

let reconciling = false;
let reconcileAgain = false;
async function reconcile() {
  if (!S.pc || !S.sid) return;
  if (reconciling) {
    reconcileAgain = true;
    return;
  }
  reconciling = true;
  // The media connection this pass works on. If it is replaced meanwhile (reconnect after a network drop), the
  // pass stops: results from the old connection must never be stored, or those videos would stay black.
  const pc0 = S.pc;
  const stale = () => S.pc !== pc0;
  try {
    do {
      reconcileAgain = false;
      if (stale()) return;
      const L = layout();
      const desired = new Map();
      for (const p of roomPeers()) {
        if (p.cid === S.cid || !p.sid || !p.tr) continue;
        if (p.tr.a) desired.set(`${p.sid}/a`, { sid: p.sid, name: 'a', cid: p.cid, kind: 'audio' });
        if (p.tr.s) desired.set(`${p.sid}/s`, { sid: p.sid, name: 's', cid: p.cid, kind: 'screen' });
        if (L.want.has(p.cid)) desired.set(`${p.sid}/v`, { sid: p.sid, name: 'v', cid: p.cid, kind: 'video', rid: p.tr.sim ? L.want.get(p.cid) : null });
      }
      const remove = [...S.pulls].filter(([k]) => !desired.has(k));
      const add = [...desired].filter(([k]) => !S.pulls.has(k));
      const relayer = [...desired].filter(([k, d]) => S.pulls.has(k) && d.rid && S.pulls.get(k).rid !== d.rid);
      if (remove.length) {
        remove.forEach(([k]) => S.pulls.delete(k));
        await closeTransceivers(remove.map(([, v]) => v.tr).filter(Boolean));
        if (stale()) return;
      }
      if (add.length) {
        const res = await pull(add.map(([, v]) => v));
        if (stale()) return;
        add.forEach(([k, v], i) => {
          if (!res[i]) return;
          S.pulls.set(k, { ...v, ...res[i] });
          if (v.kind === 'audio') attachAudio(v.cid, res[i].track);
        });
      }
      for (const [k, d] of relayer) {
        if (stale()) return;
        await switchLayer(S.pulls.get(k), d.rid).catch((e) => console.warn('layer', e));
      }
      renderTiles();
      renderStage();
    } while (reconcileAgain);
  } catch (e) {
    // A reconnect in the middle is expected (the new connection reconciles itself); anything else is retried.
    if (!stale()) {
      console.error('reconcile', e);
      setTimeout(reconcile, 3000);
    }
  } finally {
    reconciling = false;
    // The new connection may have asked to reconcile while this old pass was still running: do it now.
    if (stale() && S.pc) setTimeout(reconcile, 0);
  }
}

const audioEls = new Map();
function attachAudio(cid, track) {
  let el = audioEls.get(cid);
  if (!el) {
    el = h('audio', { autoplay: true });
    $('#lm-audio').append(el);
    audioEls.set(cid, el);
  }
  el.srcObject = new MediaStream([track]);
  el.volume = origVolume(cid, false);
  el.play().catch(() => {});
  watchSpeaking(track, cid);
  Recorder.addAudio(track);
}
function gcAudio() {
  for (const [cid, el] of audioEls) {
    const p = S.participants.get(cid);
    if (!p || p.room !== S.room.key) {
      el.srcObject = null;
      el.remove();
      audioEls.delete(cid);
      analysers.delete(cid);
    }
  }
}

function trackFor(cid, kind) {
  if (cid === S.cid) return kind === 'screen' ? S.screen : S.cam;
  const p = S.participants.get(cid);
  if (!p || !p.sid) return null;
  const rec = S.pulls.get(`${p.sid}/${kind === 'screen' ? 's' : 'v'}`);
  return rec ? rec.track : null;
}

// ------------------------------------------------------------------ rendering
const tileEls = new Map();
function tileEl(p, kind = 'video') {
  const key = p.cid + ':' + kind;
  let t = tileEls.get(key);
  if (!t) {
    const video = h('video', { autoplay: true, playsinline: true, muted: true });
    const av = h('div', { class: 'lm-avatar' });
    const label = h('div', { class: 'lm-label' });
    t = { el: h('div', { class: 'lm-tile', 'data-cid': p.cid }, av, video, label), video, av, label, track: null };
    if (kind === 'screen') t.el.classList.add('screen');
    tileEls.set(key, t);
  }
  const track = trackFor(p.cid, kind);
  if (track !== t.track) {
    t.track = track;
    t.video.srcObject = track ? new MediaStream([track]) : null;
    if (track) t.video.play().catch(() => {});
  }
  const hasVideo = !!track && (kind === 'screen' || (p.cid === S.cid ? S.camOn : !(p.mu && p.mu.v)));
  t.el.classList.toggle('novideo', !hasVideo);
  t.el.classList.toggle('mirror', p.cid === S.cid && kind === 'video');
  t.el.classList.toggle('speaking', !!S.speaking.get(p.cid));
  t.av.innerHTML = realPic(p.pic) ? `<img src="${esc(p.pic)}" alt="">` : `<span style="background:${tone(p.name)}">${esc(initials(p.name))}</span>`;
  const micOff = p.cid === S.cid ? !S.micOn : p.mu && p.mu.a;
  t.label.replaceChildren(
    micOff && kind !== 'screen' ? Object.assign(icon('micOff'), { className: 'ico off' }) : '',
    h('span', { class: 'nm' }, p.name + (kind === 'screen' ? '’s screen' : '') + (p.cid === S.cid ? ' (you)' : '')),
    p.mod && kind !== 'screen' ? h('span', { class: 'role' }, 'Teacher') : '');
  t.el.classList.toggle('hand', !!p.hand);
  if (!t.handEl) {
    t.handEl = h('div', { class: 'lm-tile-hand' }, icon('hand'));
    t.el.append(t.handEl);
  }
  return t.el;
}

function renderTiles() {
  if (!S.room) return;
  const L = layout();
  const grid = $('#lm-grid');
  const strip = $('#lm-strip');
  const mainList = L.stage === 'gallery' ? L.tiles : [];
  const stripList = L.stage === 'gallery' ? [] : L.tiles;
  grid.replaceChildren(...mainList.map((p) => tileEl(p)));
  const n = mainList.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : 5;
  grid.style.setProperty('--cols', cols);
  const stripKids = stripList.map((p) => tileEl(p));
  if (L.screenOwner && L.stage !== 'screen') stripKids.unshift(tileEl(L.screenOwner, 'screen'));
  strip.replaceChildren(...stripKids);
  strip.hidden = !stripKids.length;
  for (const [key] of tileEls) {
    const cid = key.split(':')[0];
    if (!S.participants.has(cid)) tileEls.delete(key);
  }
  gcAudio();
}

function renderStage() {
  if (!S.room) return;
  const L = layout();
  const stage = $('#lm-stage');
  stage.dataset.mode = L.stage;
  const content = $('#lm-stage-content');
  const tools = $('#lm-stage-tools');
  tools.replaceChildren();
  if (L.stage === 'gallery') {
    content.replaceChildren();
    content.hidden = true;
    $('#lm-grid').hidden = false;
  } else {
    $('#lm-grid').hidden = true;
    content.hidden = false;
    if (L.stage === 'screen') content.replaceChildren(tileEl(L.screenOwner, 'screen'));
    else if (L.stage === 'speaker') content.replaceChildren(L.big ? tileEl(L.big) : '');
    else if (L.stage === 'wb') {
      Object.assign(Board, { lead: null, extra: null, palette: null, stampTools: null, onStamp: null, drawCheck: null, afterDraw: null, noClear: false });
      Board.mount(content, tools, 'wb', 16 / 9);
    }
    else if (L.stage === 'pres') Slides.mount(content, tools);
    else if (L.stage === 'slates') Slates.mount(content, tools);
  }
  if (L.stage !== 'slates') Slates.focus = null;
  if (L.stage !== 'wb' && L.stage !== 'pres' && L.stage !== 'slates') Board.unmount();
}

function renderTop() {
  const top = $('#lm-top');
  const bo = S.bo.active && S.bo.closesAt ? Math.max(0, Math.round((S.bo.closesAt - Date.now()) / 1000)) : null;
  const kbps = Math.round(S.stats.rxRate);
  const level = !S.stats.last ? 0 : kbps < 50 ? 1 : kbps < 600 ? 2 : 3;
  top.replaceChildren(
    h('div', { class: 'lm-title' },
      h('span', { class: 'lm-mark', 'aria-hidden': 'true' }),
      h('div', { class: 'lm-titles' }, h('strong', {}, C.title), C.course ? h('span', { class: 'lm-course' }, C.course) : ''),
      S.room ? h('span', { class: 'lm-chip' + (S.room.key !== 'main' ? ' bo' : '') }, S.room.key !== 'main' ? icon('door') : '', S.room.name || roomLabel(S.room.key)) : ''),
    h('div', { class: 'lm-top-right' },
      isMod() ? classLink() : '',
      bo !== null ? h('span', { class: 'lm-chip warn', title: 'Breakout rooms close in' }, `${Math.floor(bo / 60)}:${String(bo % 60).padStart(2, '0')}`) : '',
      S.locked ? h('span', { class: 'lm-chip', title: 'Meeting locked' }, icon('lock'), 'Locked') : '',
      S.rec.on ? h('span', { class: 'lm-chip rec' }, h('span', { class: 'dot' }), 'Recording') : '',
      S.dataSaver ? h('span', { class: 'lm-chip' }, icon('feather'), 'Data saver') : '',
      h('span', { class: 'lm-net lv' + level, title: `Receiving ${kbps} kbps, sending ${Math.round(S.stats.txRate)} kbps. ${(S.stats.rx / 1048576).toFixed(1)} MB this session.` },
        h('span', { class: 'bars' }, h('i'), h('i'), h('i')), `${kbps} kbps`),
      h('span', { id: 'lm-status' }, S.statusText || '')));
}
setInterval(() => S.bo.active && S.bo.closesAt && renderTop(), 1000);

// Copy text, with a fallback for browsers or pages where the async clipboard isn't allowed.
function copyText(text, msg) {
  const done = () => toast(msg);
  const fallback = () => {
    const ta = h('textarea', { style: 'position:fixed;left:-9999px' }); ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { window.prompt('Copy this:', text); }
    ta.remove();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

// Teachers: the class link in the top bar with a Copy button, so it's easy to paste into an email or chat.
// Learners open it in Moodle and press Join. When guests are allowed, the guest invite link can be copied too.
function classLink() {
  const url = C.returnUrl;
  const short = url.replace(/^https?:\/\//, '');
  const copy = (text, what) => copyText(text, `${what} copied. Paste it into an email or chat.`);
  return h('span', { class: 'lm-linkchip' },
    icon('link'),
    h('span', { class: 'url', title: url }, short),
    h('button', { class: 'cp', title: 'Copy the class link', 'aria-label': 'Copy the class link', onclick: () => copy(url, 'Class link') }, 'Copy'),
    C.guestUrl ? h('button', { class: 'cp', title: 'Copy a ready-to-send guest invite (class name, time, link and how to join) for people without a Moodle login', onclick: () => copy(C.guestInvite || C.guestUrl, 'Guest invite') }, 'Guest invite') : '');
}

function setStatus(t) {
  S.statusText = t;
  const el = $('#lm-status');
  if (el) el.textContent = t;
}

const iconEl = (n) => icon(n);
function btn(label, icon, onclick, opts = {}) {
  return h('button', { class: 'lm-btn ' + (opts.cls || ''), title: opts.title || label, onclick, disabled: opts.disabled, 'aria-pressed': opts.pressed === undefined ? null : String(!!opts.pressed) },
    h('span', { class: 'i' }, typeof icon === 'string' && ICONS[icon] ? iconEl(icon) : icon), h('span', { class: 'l' }, label), opts.badge ? h('span', { class: 'lm-badge' }, opts.badge) : '');
}

function renderBar() {
  const bar = $('#lm-bar');
  if (!bar) return;
  const canPresent = isMod() || pol().present;
  const pollWaiting = S.room && S.room.poll && S.room.poll.open && S.room.poll.mine === null && !isMod();
  const sideBadge = (S.unread || 0) + (isMod() ? S.lobby.length : 0) + (pollWaiting ? 1 : 0);
  const showingSpeaker = S.room && layout().stage === 'speaker';
  const ccLang = findLang(CC.prefs.show);
  const pop = (b, menu) => h('div', { class: 'lm-pop-wrap' }, b, menu);
  const toggleOpen = (e) => {
    const w = e.currentTarget.closest('.lm-pop-wrap'); const was = w.classList.contains('open'); closePops();
    if (was) return;
    w.classList.add('open');
    // The bar scrolls sideways when the window is narrow, so menus are placed over the button on the page itself.
    const pop = w.querySelector('.lm-pop');
    if (pop && window.innerWidth > 820) {
      const r = w.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(window.innerWidth - 8, r.left + r.width / 2)) + 'px';
      requestAnimationFrame(() => {
        const pr = pop.getBoundingClientRect();
        if (pr.right > window.innerWidth - 8) pop.style.left = (parseFloat(pop.style.left) - (pr.right - window.innerWidth + 8)) + 'px';
        if (pr.left < 8) pop.style.left = (parseFloat(pop.style.left) + (8 - pr.left)) + 'px';
      });
    }
  };
  const item = (ic, label, fn, cls) => h('button', { class: 'lm-menu-item ' + (cls || ''), onclick: () => { closePops(); fn(); } }, icon(ic), h('span', {}, label));
  const check = (ic, label, on, fn) => h('label', { class: 'lm-menu-item check' }, icon(ic), h('span', {}, label),
    h('input', { type: 'checkbox', checked: on, onchange: (e) => fn(e.target.checked) }), h('span', { class: 'sw' }));
  const panelBtn = (k, label, ic, badge) => btn(label, ic, () => {
    if (panelOpen() && S.tab === k) return togglePanel(false);
    S.tab = k; if (k === 'chat') S.unread = 0; togglePanel(true); renderSide();
  }, { cls: panelOpen() && S.tab === k ? 'on' : '', badge: badge || null, title: label });
  const bgOn = S.bg && S.bg !== 'none' && S.bg !== 'blur';
  const endMeeting = () => { if (window.confirm('End the meeting for everyone?')) send({ t: 'end' }); };
  const pollBadge = pollWaiting ? '!' : null;
  // Bottom bar, left to right, one job per group:
  //  1 You: mic, camera, screen share      2 Camera look: blur, background, smooth skin, studio look
  //  3 Take part: hand, react, captions, present, view      4 Panels: chat, people, notes, Q&A, polls, breakouts
  //  5 Settings: your name, data saver      6 Teacher: record      7 Leave (and End for teachers)
  // Groups marked lm-fold go into "More" on narrower screens (lm-fold2 only on small ones).
  bar.replaceChildren(
    h('div', { class: 'lm-group' },
      h('div', { class: 'lm-split' },
        btn(S.micOn ? 'Mute' : 'Unmute', S.micOn ? 'mic' : 'micOff', () => toggleMic(), { cls: S.micOn ? '' : 'off', pressed: !S.micOn }),
        pop(h('button', { class: 'lm-split-lang', title: 'Microphone options', 'aria-label': 'Microphone options', onclick: toggleOpen }, h('span', { class: 'chev' }, icon('next'))),
          h('div', { class: 'lm-pop menu' }, check('mic', 'Noise suppression', S.noiseSuppression, setNoiseSuppression)))),
      btn(S.camOn ? 'Stop video' : 'Start video', S.camOn ? 'cam' : 'camOff', () => toggleCam(), { cls: S.camOn ? '' : 'off', disabled: !camAllowed() && !S.camOn, title: camAllowed() ? 'Camera' : 'Cameras are off in this room to save bandwidth' }),
      btn(S.screen ? 'Stop share' : 'Share', S.screen ? 'stop' : 'screen', toggleScreen, { cls: S.screen ? 'on' : '', disabled: !isMod() && !C.studentScreenShare && !pol().present })),
    h('div', { class: 'lm-group lm-fold' },
      h('div', { class: 'lm-split' + (S.bg === 'blur' ? ' on' : '') },
        btn('Blur', 'blur', () => setBackground(S.bg === 'blur' ? 'none' : 'blur'), { cls: S.bg === 'blur' ? 'on' : '', pressed: S.bg === 'blur', title: 'Blur your background' }),
        pop(h('button', { class: 'lm-split-lang', title: 'Blur strength', 'aria-label': 'Blur strength', onclick: toggleOpen }, h('span', { class: 'chev' }, icon('next'))),
          h('div', { class: 'lm-pop menu' }, blurSlider()))),
      btn('Background', 'image', () => Backgrounds.open(), { cls: bgOn ? 'on' : '', title: bgOn ? 'Background: ' + bgLabel() : 'Put a picture behind you' }),
      btn('Smooth skin', 'sparkles', () => setSmooth(!S.smooth), { cls: S.smooth ? 'on' : '', pressed: !!S.smooth, title: 'A gentle touch-up of your camera' }),
      h('div', { class: 'lm-split' + (S.look ? ' on' : '') },
        btn('Studio look', 'sun', () => setLook(!S.look), { cls: S.look ? 'on' : '', pressed: !!S.look, title: 'A brighter picture and a slight zoom' }),
        pop(h('button', { class: 'lm-split-lang', title: 'Brightness and zoom', 'aria-label': 'Brightness and zoom', onclick: toggleOpen }, h('span', { class: 'chev' }, icon('next'))),
          h('div', { class: 'lm-pop menu' }, ...lookSliders())))),
    h('div', { class: 'lm-group' },
      btn(S.hand ? 'Lower hand' : 'Raise hand', 'hand', () => { send({ t: 'hand', up: !S.hand }); if (!S.hand) S.handCount++; }, { cls: S.hand ? 'on hand' : '', pressed: S.hand }),
      pop(btn('React', 'smile', toggleOpen),
        h('div', { class: 'lm-pop emojis' }, ...EMOJIS.map((em) => h('button', { class: 'lm-emoji-btn', 'aria-label': 'Send ' + em, onclick: () => { send({ t: 'emoji', e: em }); closePops(); } }, em)))),
      h('div', { class: 'lm-split' + (S.ccOn ? ' on' : '') },
        btn('Captions', 'cc', () => toggleCaptions(), { cls: S.ccOn ? 'on' : '', pressed: S.ccOn, title: 'Turn captions on or off' }),
        h('button', { class: 'lm-split-lang', title: 'Choose caption language', 'aria-label': 'Choose caption language', onclick: () => LangPicker.open('show') },
          ccLang ? h('span', { class: 'flag' }, ccLang.flag || ccLang.cc) : h('span', { class: 'aa' }, 'Aa'),
          h('span', { class: 'chev' }, icon('next')))),
      canPresent ? pop(btn('Present', 'present', toggleOpen, { cls: S.room && S.room.stage !== 'grid' ? 'on' : '' }),
        h('div', { class: 'lm-pop menu' },
          item('pen', 'Whiteboard', () => send({ t: 'stage', mode: 'wb' })),
          isMod() ? item('grid', 'Student boards (everyone draws, you mark)', () => {
            const prompt = window.prompt('What should students answer on their boards? (optional)', S.room.slates && S.room.slates.prompt || '');
            if (prompt !== null) send({ t: 'slates', op: 'start', prompt });
          }) : '',
          isMod() && S.room && S.room.slates && S.room.stage !== 'slates' ? item('grid', 'Back to student boards', () => send({ t: 'slates', op: 'reopen' })) : '',
          item('notes', 'Present a file (PowerPoint, PDF, Word, Excel, image)', () => Slides.pick()),
          isMod() && C.quizUrl ? item('quiz', S.quiz ? 'AI quiz results' : 'AI quiz from slides', () => quizMod().then((Q) => (S.quiz ? Q.openResults() : Q.openMaker(Slides)))) : '',
          S.room && S.room.pres ? item('present', `Show “${S.room.pres.name}”`, () => send({ t: 'stage', mode: 'pres' })) : '',
          S.room && S.room.stage !== 'grid' ? item('grid', 'Back to video', () => send({ t: 'stage', mode: 'grid' })) : '')) : '',
      btn(showingSpeaker ? 'Gallery' : 'Speaker', showingSpeaker ? 'grid' : 'speaker', () => { S.view = showingSpeaker ? 'gallery' : 'speaker'; renderAll(); }, { title: showingSpeaker ? 'Gallery view' : 'Speaker view' })),
    h('div', { class: 'lm-group lm-panels' },
      panelBtn('chat', 'Chat', 'chat', S.unread),
      h('span', { class: 'lm-fold2' }, panelBtn('people', 'People', 'users', isMod() && S.lobby.length ? S.lobby.length : null),
        panelBtn('notes', 'Notes', 'notes'),
        panelBtn('qa', 'Q&A', 'question'),
        panelBtn('polls', 'Polls', 'poll', pollBadge),
        isMod() ? panelBtn('breakouts', 'Breakouts', 'door', S.bo && S.bo.active ? '●' : null) : '')),
    h('div', { class: 'lm-group lm-fold' },
      btn('My name', 'pen', renameMe, { title: 'Change your name as others see it in this class' }),
      btn('Data saver', 'feather', () => setDataSaver(!S.dataSaver), { cls: S.dataSaver ? 'on' : '', pressed: !!S.dataSaver, title: 'Hear everyone and see slides and screens, without camera video' })),
    isMod() ? h('div', { class: 'lm-group lm-fold' },
      btn(Recorder.active ? 'Stop rec' : 'Record', Recorder.active ? 'stop' : 'rec', () => Recorder.toggle(), { cls: Recorder.active ? 'rec on' : '', pressed: !!Recorder.active, title: Recorder.active ? 'Stop recording' : 'Start recording' })) : '',
    h('div', { class: 'lm-group' },
      h('span', { class: 'lm-more' }, pop(btn('More', 'more', toggleOpen),
        h('div', { class: 'lm-pop menu up-right' },
          check('blur', 'Blur background', S.bg === 'blur', (on) => setBackground(on ? 'blur' : 'none')),
          blurSlider(),
          item('image', bgOn ? 'Background: ' + bgLabel() : 'Background picture', () => Backgrounds.open()),
          check('sparkles', 'Smooth skin', S.smooth, setSmooth),
          check('sun', 'Studio look', S.look, setLook),
          ...lookSliders(),
          h('span', { class: 'lm-more2' },
            item('users', 'People', () => { S.tab = 'people'; togglePanel(true); renderSide(); }),
            item('notes', 'Notes', () => { S.tab = 'notes'; togglePanel(true); renderSide(); }),
            item('question', 'Q&A', () => { S.tab = 'qa'; togglePanel(true); renderSide(); }),
            item('poll', 'Polls', () => { S.tab = 'polls'; togglePanel(true); renderSide(); }),
            isMod() ? item('door', 'Breakout rooms', () => { S.tab = 'breakouts'; togglePanel(true); renderSide(); }) : ''),
          item('pen', 'Change my name', renameMe),
          check('feather', 'Data saver', S.dataSaver, setDataSaver),
          isMod() ? item(Recorder.active ? 'stop' : 'rec', Recorder.active ? 'Stop recording' : 'Start recording', () => Recorder.toggle(), Recorder.active ? 'danger' : '') : '',
          isMod() ? item('x', 'End meeting for everyone', endMeeting, 'danger') : ''))),
      isMod() ? h('span', { class: 'lm-fold-end' }, btn('End', 'x', endMeeting, { cls: 'end', title: 'End the meeting for everyone' })) : '',
      btn('Leave', 'leave', leave, { cls: 'leave' })),
  );
}
function closePops() {
  document.querySelectorAll('.lm-pop-wrap.open').forEach((x) => x.classList.remove('open'));
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.lm-pop-wrap')) closePops();
});

function setDataSaver(on) {
  S.dataSaver = on;
  lsSet('ds', on ? '1' : '0');
  send({ t: 'stats', rx: S.stats.rx, tx: S.stats.tx, ds: on });
  toast(on ? 'Data saver on: you will hear everyone and see slides/screens, but not cameras.' : 'Data saver off');
  renderAll();
  reconcile();
}

function panelOpen() {
  return document.body.classList.contains('panel-open');
}
function togglePanel(force) {
  document.body.classList.toggle('panel-open', force === undefined ? !panelOpen() : force);
  if (panelOpen() && S.tab === 'chat') S.unread = 0;
  renderBar();
}

function renderAll() {
  renderTop();
  renderTiles();
  renderStage();
  renderBar();
  renderSide();
  reconcile();
}

// ------------------------------------------------------------------ side panel
const TABS = () => [
  ['chat', 'Chat', 'chat'], ['people', 'People', 'users'], ['notes', 'Notes', 'notes'], ['qa', 'Q&A', 'question'], ['polls', 'Polls', 'poll'],
  ...(isMod() ? [['breakouts', 'Breakouts', 'door']] : []),
];

function renderSide() {
  const side = $('#lm-side');
  if (!side || !S.room) return;
  const tabs = h('div', { class: 'lm-tabs', role: 'tablist' }, ...TABS().map(([k, l, ic]) => {
    let badge = '';
    if (k === 'chat' && S.unread) badge = S.unread;
    if (k === 'people' && isMod() && S.lobby.length) badge = S.lobby.length;
    if (k === 'polls' && S.room.poll && S.room.poll.open && S.room.poll.mine === null && !isMod()) badge = '!';
    return h('button', { class: S.tab === k ? 'active' : '', role: 'tab', 'aria-selected': String(S.tab === k), title: l, onclick: () => { S.tab = k; if (k === 'chat') S.unread = 0; renderSide(); renderBar(); } }, icon(ic), h('span', { class: 'tl' }, l), badge ? h('span', { class: 'lm-badge' }, badge) : '');
  }), h('button', { class: 'lm-close lm-icon-btn', title: 'Close panel', 'aria-label': 'Close panel', onclick: () => togglePanel(false) }, icon('x')));
  const body = h('div', { class: 'lm-side-body' });
  // Remember what the user was typing / which field had focus, so live updates don't wipe it.
  const kept = {};
  side.querySelectorAll('[data-keep]').forEach((el) => {
    kept[el.dataset.keep] = { value: el.value, focus: document.activeElement === el, a: el.selectionStart, b: el.selectionEnd };
  });
  ({ chat: ChatTab, people: PeopleTab, notes: Notes.tab, qa: QaTab, polls: PollTab, breakouts: BreakoutTab }[S.tab] || ChatTab)(body);
  side.replaceChildren(tabs, body);
  side.querySelectorAll('[data-keep]').forEach((el) => {
    const k = kept[el.dataset.keep];
    if (!k) return;
    const authoritative = el.dataset.keep === 'sharednotes' || el.dataset.keep === 'mynotes';
    if (!authoritative) {
      if (el.tagName === 'SELECT') {
        if ([...el.options].some((o) => o.value === k.value)) el.value = k.value;
      } else {
        el.value = k.value;
      }
    }
    if (k.focus) {
      el.focus();
      try { el.setSelectionRange(k.a, k.b); } catch (e) { /* not a text field */ }
    }
  });
  const log = side.querySelector('.lm-chatlog');
  if (log) log.scrollTop = log.scrollHeight;
}

function ChatTab(body) {
  const others = [...S.participants.values()].filter((p) => p.cid !== S.cid);
  const log = h('div', { class: 'lm-chatlog' }, ...S.chat.filter((m) => m.announce || m.dm || m.room === S.room.key).map((m) =>
    h('div', { class: 'lm-msg' + (m.announce ? ' announce' : '') + (m.dm ? ' dm' : '') + (m.cid === S.cid ? ' mine' : '') },
      h('div', { class: 'meta' }, h('b', {}, m.dm ? (m.cid === S.cid ? `To ${m.toName}` : m.name) : m.name),
        m.dm ? h('span', { class: 'tag' }, 'Private') : m.announce ? h('span', { class: 'tag' }, 'To all rooms') : '', h('time', {}, fmtTime(m.ts))),
      h('div', { class: 'text', html: linkify(esc(m.text)) }))));
  const to = h('select', { class: 'lm-to', 'data-keep': 'chatto', 'aria-label': 'Send to' }, h('option', { value: '' }, 'Everyone'),
    ...others.filter((p) => p.room === S.room.key || isMod()).map((p) => h('option', { value: p.cid }, `${p.name} (private)`)));
  const input = h('textarea', { rows: 2, placeholder: 'Message…', 'data-keep': 'chatinput', 'data-focus': '1', onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } } });
  function sendChat() {
    const text = input.value.trim();
    if (!text) return;
    if (to.value) send({ t: 'dm', to: to.value, text });
    else send({ t: 'chat', text });
    input.value = '';
  }
  body.append(log, h('div', { class: 'lm-compose' }, to, input, h('button', { class: 'lm-primary', onclick: sendChat }, 'Send')));
}
function linkify(s) {
  return s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function PeopleTab(body) {
  const mod = isMod();
  const p = pol();
  if (mod && S.lobby.length) {
    body.append(h('h4', {}, `Waiting to join (${S.lobby.length})`),
      ...S.lobby.map((l) => h('div', { class: 'lm-person' }, h('span', { class: 'n' }, l.name, l.guest ? ' (guest)' : ''),
        h('button', { onclick: () => send({ t: 'admit', cid: l.cid }) }, 'Admit'), h('button', { class: 'danger', onclick: () => send({ t: 'deny', cid: l.cid }) }, 'Deny'))),
      h('button', { class: 'lm-primary', onclick: () => send({ t: 'admit', cid: '*' }) }, 'Admit everyone'));
  }
  if (mod) {
    const sel = (val, opts, on) => h('select', { onchange: (e) => on(e.target.value) }, ...opts.map(([v, l]) => h('option', { value: v, selected: v === val }, l)));
    body.append(h('h4', {}, 'Room controls'),
      h('div', { class: 'lm-controls' },
        h('label', { class: 'row-label' }, 'Cameras ', sel(p.video, [['teachers', 'Teachers only'], ['all', 'Everyone'], ['none', 'Audio only']], (v) => send({ t: 'policy', video: v })),
          h('button', { title: 'Apply to every room', onclick: () => send({ t: 'policy', video: p.video, everywhere: true }) }, 'All rooms')),
        ...[['draw', 'Students can draw'], ['notes', 'Students can edit shared notes'], ['present', 'Students can present and share screen'], ['cc', 'Captions on for everyone']].map(([k, label]) =>
          h('label', { class: 'lm-switchrow' }, h('span', {}, label), h('input', { type: 'checkbox', checked: !!p[k], onchange: (e) => send({ t: 'policy', [k]: e.target.checked }) }), h('span', { class: 'sw' }))),
        h('div', { class: 'row' },
          h('button', { onclick: () => send({ t: 'muteAll' }) }, icon('micOff'), 'Mute all'),
          h('button', { onclick: () => send({ t: 'lower', cid: '*' }) }, icon('hand'), 'Lower all'),
          h('button', { onclick: () => send({ t: 'lock', on: !S.locked }) }, icon('lock'), S.locked ? 'Unlock' : 'Lock')),
        C.guestUrl ? h('button', { onclick: () => copyText(C.guestInvite || C.guestUrl, 'Guest invite copied. Paste it into an email or chat.') }, icon('link'), 'Copy guest invite') : ''));
  }
  const groups = {};
  for (const x of S.participants.values()) (groups[x.room] = groups[x.room] || []).push(x);
  const keys = Object.keys(groups).sort((a, b) => (a === S.room.key ? -1 : b === S.room.key ? 1 : a.localeCompare(b)));
  for (const k of keys) {
    if (!mod && k !== S.room.key) continue;
    const list = groups[k].sort((a, b) => b.hand - a.hand || b.mod - a.mod || a.name.localeCompare(b.name));
    body.append(h('h4', {}, `${roomLabel(k)} (${list.length})`), ...list.map((x) => {
      const actions = mod && x.cid !== S.cid ? [
        x.hand ? h('button', { class: 'lm-icon-btn sm', title: 'Lower hand', onclick: () => send({ t: 'lower', cid: x.cid }) }, icon('hand')) : '',
        h('button', { class: 'lm-icon-btn sm', title: 'Mute', onclick: () => send({ t: 'mute', cid: x.cid, kind: 'a' }) }, icon('micOff')),
        h('button', { class: 'lm-icon-btn sm', title: 'Turn camera off', onclick: () => send({ t: 'mute', cid: x.cid, kind: 'v' }) }, icon('camOff')),
        h('button', { class: 'lm-icon-btn sm' + (p.spot === x.cid ? ' on' : ''), title: p.spot === x.cid ? 'Remove spotlight' : 'Spotlight (everyone sees this camera)', onclick: () => send({ t: 'policy', spot: p.spot === x.cid ? null : x.cid }) }, icon('star')),
        !x.mod ? h('button', { class: 'lm-icon-btn sm danger', title: 'Remove from meeting', onclick: () => window.confirm(`Remove ${x.name}? They cannot rejoin this session.`) && send({ t: 'kick', cid: x.cid }) }, icon('eject')) : '',
      ] : [];
      return h('div', { class: 'lm-person' + (x.hand ? ' hand' : '') },
        h('span', { class: 'av', style: `background:${tone(x.name)}` }, initials(x.name)),
        h('span', { class: 'n' }, h('span', { class: 'nm' }, x.name, x.cid === S.cid ? ' (you)' : ''),
          mod && x.real ? h('span', { class: 'role g', title: 'Name in Moodle' }, x.real) : '',
          x.cid === S.cid ? h('button', { class: 'lm-link', onclick: renameMe }, 'Edit name') : '',
          x.mod ? h('span', { class: 'role' }, 'Teacher') : x.guest ? h('span', { class: 'role g' }, 'Guest') : ''),
        x.hand ? h('span', { class: 'hand-ic', title: 'Hand raised' }, icon('hand')) : '',
        h('span', { class: 'st' }, icon(x.mu && x.mu.a ? 'micOff' : 'mic')), actions.length ? h('span', { class: 'acts' }, ...actions) : '');
    }));
  }
  if (!mod && C.handGoal) body.append(h('p', { class: 'lm-muted' }, `Raise your hand at least ${C.handGoal} time(s) to complete this activity. This session: ${S.handCount}.`));
}

function QaTab(body) {
  const qa = (S.room.qa || []).slice().sort((a, b) => a.answered - b.answered || b.votes - a.votes || a.ts - b.ts);
  const input = h('textarea', { rows: 2, placeholder: 'Ask a question…', 'data-keep': 'qainput', 'data-focus': '1' });
  const anon = h('input', { type: 'checkbox' });
  body.append(h('div', { class: 'lm-compose col' }, input,
    h('div', { class: 'row' }, h('label', {}, anon, ' Ask anonymously'),
      h('button', { class: 'lm-primary', onclick: () => { if (input.value.trim()) { send({ t: 'qa', op: 'ask', text: input.value, anon: anon.checked }); input.value = ''; } } }, 'Ask'))));
  if (!qa.length) body.append(h('p', { class: 'lm-muted' }, 'No questions yet. Upvote questions you also want answered.'));
  for (const q of qa) {
    body.append(h('div', { class: 'lm-q' + (q.answered ? ' answered' : '') },
      h('button', { class: 'vote' + (q.voted ? ' on' : ''), title: 'Upvote', 'aria-pressed': String(q.voted), onclick: () => send({ t: 'qa', op: 'up', id: q.id }) }, h('span', { class: 'up' }), h('b', {}, q.votes)),
      h('div', { class: 'body' }, h('div', {}, q.text), h('div', { class: 'meta' }, h('b', {}, q.anon ? (q.name ? `Anonymous (${q.name})` : 'Anonymous') : q.name), h('time', {}, fmtTime(q.ts)), q.answered ? h('span', { class: 'tag ok' }, 'Answered') : '')),
      isMod() ? h('button', { class: 'lm-icon-btn sm', title: 'Mark answered', onclick: () => send({ t: 'qa', op: 'answered', id: q.id }) }, icon('check')) : '',
      isMod() || q.mine ? h('button', { class: 'lm-icon-btn sm', title: 'Delete', onclick: () => send({ t: 'qa', op: 'del', id: q.id }) }, icon('trash')) : ''));
  }
}

function PollTab(body) {
  const p = S.room.poll;
  if (isMod()) {
    const q = h('input', { type: 'text', placeholder: 'Question', 'data-keep': 'pollq' });
    const opts = h('textarea', { rows: 4, placeholder: 'One option per line', 'data-keep': 'pollopts' });
    body.append(h('h4', {}, 'New poll'), h('div', { class: 'lm-compose col' }, q, opts,
      h('div', { class: 'row' },
        h('button', { onclick: () => { q.value = 'Did that make sense?'; opts.value = 'Yes\nMostly\nNot yet'; } }, 'Quick check'),
        h('button', { class: 'lm-primary', onclick: () => send({ t: 'poll', op: 'new', q: q.value, opts: opts.value.split('\n') }) }, 'Launch poll'))));
  }
  if (!p) {
    body.append(h('p', { class: 'lm-muted' }, isMod() ? 'Launch a poll to check understanding.' : 'No poll right now.'));
    return;
  }
  const total = p.counts ? p.counts.reduce((a, b) => a + b, 0) : p.total;
  body.append(h('div', { class: 'lm-poll' }, h('h4', {}, p.q, p.open ? '' : ' (closed)'),
    ...p.opts.map((o, i) => {
      const n = p.counts ? p.counts[i] : null;
      const pct = n !== null && total ? Math.round((n / total) * 100) : 0;
      return h('button', { class: 'opt' + (p.mine === i ? ' mine' : ''), disabled: !p.open, onclick: () => send({ t: 'poll', op: 'vote', i }) },
        h('span', { class: 'bar', style: `width:${pct}%` }), h('span', { class: 't' }, o), n !== null ? h('span', { class: 'c' }, `${pct}%`) : '');
    }),
    h('div', { class: 'lm-muted' }, p.total === 1 ? '1 vote' : `${p.total} votes`, !isMod() && !p.shown ? '. Results appear when the teacher shares them.' : ''),
    isMod() ? h('div', { class: 'row' },
      h('button', { onclick: () => send({ t: 'poll', op: 'show' }) }, p.shown ? 'Hide results' : 'Share results'),
      p.open ? h('button', { onclick: () => send({ t: 'poll', op: 'close' }) }, 'Close voting') : '',
      h('button', { class: 'danger', onclick: () => send({ t: 'poll', op: 'remove' }) }, 'Remove')) : ''));
}

function BreakoutTab(body) {
  const plan = C.plan || { rooms: {}, assign: {}, counts: {} };
  const roomKeys = Object.keys(plan.rooms);
  if (!S.bo.active) {
    if (!roomKeys.length) {
      body.append(h('p', {}, 'No breakout rooms are set up yet. Each teacher gets a room.'),
        C.breakoutsUrl ? h('a', { href: C.breakoutsUrl, target: '_blank', class: 'lm-primary lm-linkbtn' }, 'Set up breakout rooms') : '');
      return;
    }
    const minutes = h('input', { type: 'number', min: 0, max: 240, value: 10, 'data-keep': 'bomin', style: 'width:5em' });
    body.append(h('p', {}, 'One room per teacher. Students go to the teacher they are assigned to; whiteboard, slides, notes, Q&A and polls work in every room.'),
      h('ul', { class: 'lm-rooms' }, ...roomKeys.map((k) => h('li', {}, plan.rooms[k], h('span', { class: 'cnt' }, `${plan.counts[k] || 0} students`)))),
      h('div', { class: 'row' }, h('label', {}, 'Auto-close after ', minutes, ' min (0 = never)')),
      h('div', { class: 'row' },
        h('button', { class: 'lm-primary', onclick: () => send({ t: 'bo-open', rooms: plan.rooms, assign: plan.assign, minutes: +minutes.value }) }, 'Open breakout rooms'),
        C.breakoutsUrl ? h('a', { href: C.breakoutsUrl, target: '_blank', class: 'lm-linkbtn' }, 'Edit assignments') : ''));
    return;
  }
  const visit = h('select', {}, h('option', { value: 'main' }, 'Main room'), ...Object.entries(S.bo.rooms).map(([k, v]) => h('option', { value: k, selected: S.room.key === k }, v)));
  const msg = h('input', { type: 'text', placeholder: 'Message to every room', 'data-keep': 'bomsg' });
  const counts = {};
  for (const p of S.participants.values()) counts[p.room] = (counts[p.room] || 0) + 1;
  body.append(h('p', { class: 'lm-live' }, h('span', { class: 'dot' }), 'Breakout rooms are open'),
    h('ul', { class: 'lm-rooms' }, ...Object.entries(S.bo.rooms).map(([k, v]) => h('li', {}, v, h('span', { class: 'cnt' }, `${counts[k] || 0} here`))),
      h('li', {}, 'Main room', h('span', { class: 'cnt' }, `${counts.main || 0} here`))),
    h('div', { class: 'row' }, visit, h('button', { onclick: () => send({ t: 'visit', room: visit.value }) }, 'Go to room')),
    h('div', { class: 'row' }, msg, h('button', { onclick: () => { if (msg.value.trim()) { send({ t: 'chat', text: msg.value, announce: true }); msg.value = ''; } } }, 'Broadcast')),
    h('div', { class: 'row' },
      h('button', { onclick: () => send({ t: 'bo-extend', minutes: 5 }) }, '+5 min'),
      h('button', { onclick: () => send({ t: 'allNotes' }) }, 'Export all rooms’ notes'),
      h('button', { class: 'danger', onclick: () => send({ t: 'bo-close' }) }, 'Close all rooms')));
}

// ------------------------------------------------------------------ shared + personal notes
const Notes = {
  sub: 'shared',
  el: null,
  mine: C.myNotes || lsGet('notes:' + C.title) || '',
  saveTimer: null,
  saved: '',
  reset(text, v) {
    S.notesText = text || '';
    S.notesV = v || 0;
    if (this.el) this.el.value = S.notesText;
  },
  canEdit() {
    return isMod() || !!pol().notes;
  },
  remote(m) {
    if (m.from === S.cid) return;
    if (m.v !== S.notesV + 1) {
      send({ t: 'notesGet' });
      return;
    }
    S.notesV = m.v;
    const { s, d, i } = m.op;
    S.notesText = S.notesText.slice(0, s) + i + S.notesText.slice(s + d);
    if (this.el) {
      const el = this.el;
      let a = el.selectionStart;
      let b = el.selectionEnd;
      const shift = (pos) => (pos > s ? Math.max(s, pos - d) + i.length : pos);
      a = shift(a);
      b = shift(b);
      el.value = S.notesText;
      if (document.activeElement === el) el.setSelectionRange(a, b);
    }
  },
  onInput(el) {
    const prev = S.notesText;
    const next = el.value;
    let s = 0;
    while (s < prev.length && s < next.length && prev[s] === next[s]) s++;
    let e1 = prev.length;
    let e2 = next.length;
    while (e1 > s && e2 > s && prev[e1 - 1] === next[e2 - 1]) { e1--; e2--; }
    S.notesText = next;
    S.notesV++;
    send({ t: 'notes', s, d: e1 - s, i: next.slice(s, e2) });
  },
  // AI summary of my private notes (plus what was said and shown), added to the end of my notes. Included in the price.
  async summariseMine(btn, ta) {
    if (!Notes.mine || Notes.mine.trim().length < 20) return toast('Write a few notes first, then ask for a summary.');
    btn.disabled = true;
    toast('Summarising your notes…');
    try {
      const r = await fetch(`${W}/ai/notes`, { method: 'POST', headers: { Authorization: 'Bearer ' + C.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: Notes.mine }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.summary) return toast(j.error || 'The summary could not be made right now.');
      const text = `${Notes.mine.replace(/\s+$/, '')}\n\n--- AI summary of my notes (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) ---\n${j.summary}\n`;
      ta.value = text;
      Notes.saveMine(text);
      ta.scrollTop = ta.scrollHeight;
    } catch (e) {
      toast('The summary could not be made right now.');
    } finally {
      btn.disabled = false;
    }
  },
  saveMine(text) {
    this.mine = text;
    lsSet('notes:' + C.title, text);
    clearTimeout(this.saveTimer);
    if (!C.notesUrl) return;
    this.saveTimer = setTimeout(async () => {
      const fd = new FormData();
      fd.append('sesskey', C.sesskey);
      fd.append('content', text);
      try {
        const r = await fetch(C.notesUrl, { method: 'POST', body: fd, credentials: 'same-origin' });
        const st = $('#lm-notes-status');
        if (st) st.textContent = r.ok ? 'Saved to Moodle ' + fmtTime(Date.now()) : 'Not saved — check your connection';
      } catch (e) { /* retried on next keystroke */ }
    }, 1500);
  },
  tab(body) {
    const subtabs = h('div', { class: 'lm-subtabs' },
      h('button', { class: Notes.sub === 'shared' ? 'active' : '', onclick: () => { Notes.sub = 'shared'; renderSide(); } }, `Shared (${S.room.name || 'room'})`),
      h('button', { class: Notes.sub === 'mine' ? 'active' : '', onclick: () => { Notes.sub = 'mine'; renderSide(); } }, 'My notes'));
    body.append(subtabs);
    if (Notes.sub === 'shared') {
      const ta = h('textarea', { class: 'lm-notes', 'data-keep': 'sharednotes', readonly: !Notes.canEdit(), placeholder: Notes.canEdit() ? 'Shared notes for this room — everyone here sees them live.' : 'The teacher’s notes for this room appear here.', oninput: (e) => Notes.onInput(e.target) });
      ta.value = S.notesText;
      Notes.el = ta;
      body.append(ta, h('div', { class: 'row' },
        h('button', { onclick: () => download(`${C.title} - ${S.room.name} notes.md`, `# ${C.title} — ${S.room.name}\n\n${S.notesText}\n`) }, icon('download'), 'Download'),
        isMod() ? h('button', { onclick: () => send({ t: 'allNotes' }) }, icon('download'), 'All rooms') : '',
        C.exportUrl ? h('a', { class: 'lm-linkbtn', target: '_blank', href: C.exportUrl + '&type=shared' }, 'All sessions') : ''),
      S.room.tx && S.room.tx.length ? h('p', { class: 'lm-muted' }, 'Caption transcripts are saved with the shared notes.') : '');
    } else {
      const ta = h('textarea', { class: 'lm-notes', 'data-keep': 'mynotes', placeholder: 'Private notes — only you can see these. They are saved to Moodle automatically.', oninput: (e) => Notes.saveMine(e.target.value) });
      ta.value = Notes.mine;
      body.append(ta, h('div', { class: 'row' },
        h('button', { onclick: () => download(`${C.title} - my notes.md`, `# ${C.title} — my notes\n\n${Notes.mine}\n`) }, icon('download'), 'Download'),
        h('button', { onclick: (e) => Notes.summariseMine(e.currentTarget, ta) }, icon('sparkles'), 'AI summary'),
        C.exportUrl ? h('a', { class: 'lm-linkbtn', target: '_blank', href: C.exportUrl + '&type=mine' }, 'Export from Moodle') : '',
        h('span', { id: 'lm-notes-status', class: 'lm-muted' }, C.notesUrl ? '' : 'Saved in this browser only')));
    }
  },
};

// ------------------------------------------------------------------ whiteboard (also slide annotations)
const Board = {
  canvas: null, ctx: null, id: null, aspect: 16 / 9, drawing: null, pending: [], flushTimer: null, mine: [], ro: null, host: null,
  strokes(id = this.id) {
    return (S.room.boards[id] = S.room.boards[id] || []);
  },
  canDraw() {
    if (this.drawCheck) return this.drawCheck(this.id);
    return isMod() || !!pol().draw;
  },
  mount(host, tools, id, aspect, under) {
    if (!this.stampTools && S.boardTool.tool.startsWith('stamp:')) S.boardTool.tool = 'pen';
    if (this.host !== host || this.id !== id || !this.canvas || !host.contains(this.canvas)) {
      this.unmount();
      this.host = host;
      this.id = id;
      this.aspect = aspect;
      this.canvas = h('canvas', { class: 'lm-board' + (under ? ' overlay' : '') });
      this.ctx = this.canvas.getContext('2d');
      const wrap = under || h('div', { class: 'lm-board-wrap' });
      if (!under) {
        wrap.style.background = '#fff';
        host.replaceChildren(wrap);
      }
      wrap.append(this.canvas);
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(host);
      this.bind();
      this.resize();
    }
    this.tools(tools);
  },
  unmount() {
    if (this.ro) this.ro.disconnect();
    this.ro = null;
    this.canvas = null;
    this.host = null;
    this.id = null;
  },
  resize() {
    if (!this.canvas || !this.host) return;
    const box = this.canvas.parentNode;
    if (!box) return;
    let w;
    let hh;
    if (box.classList.contains('lm-board-wrap')) {
      const r = this.host.getBoundingClientRect();
      w = Math.min(r.width, r.height * this.aspect);
      hh = w / this.aspect;
      box.style.width = w + 'px';
      box.style.height = hh + 'px';
    } else {
      const r = box.getBoundingClientRect();
      w = r.width;
      hh = r.height;
    }
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hh * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = hh + 'px';
    this.draw();
  },
  draw() {
    if (!this.ctx) return;
    drawStrokes(this.ctx, this.strokes(), this.canvas.width, this.canvas.height);
    if (this.afterDraw) this.afterDraw();
  },
  stroke(s, W2, H2) {
    const c = this.ctx;
    if (!s.p || s.p.length < 2) return;
    c.globalAlpha = s.k === 'hl' ? 0.35 : 1;
    c.strokeStyle = s.c;
    c.lineWidth = (s.k === 'hl' ? s.w * 3 : s.w) * (W2 / 1000);
    c.beginPath();
    c.moveTo((s.p[0] / 10000) * W2, (s.p[1] / 10000) * H2);
    for (let i = 2; i < s.p.length; i += 2) c.lineTo((s.p[i] / 10000) * W2, (s.p[i + 1] / 10000) * H2);
    if (s.p.length === 2) c.lineTo((s.p[0] / 10000) * W2 + 0.1, (s.p[1] / 10000) * H2);
    c.stroke();
    c.globalAlpha = 1;
  },
  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 10000), Math.round(((e.clientY - r.top) / r.height) * 10000)];
  },
  bind() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => {
      const t = S.boardTool;
      if (t.tool.startsWith('stamp:') && this.onStamp) {
        const [x, y] = this.pos(e);
        this.onStamp(t.tool.slice(6), x, y);
        return;
      }
      if (!this.canDraw()) return;
      cv.setPointerCapture(e.pointerId);
      if (t.tool === 'eraser') {
        this.drawing = { eraser: true };
        this.erase(this.pos(e));
        return;
      }
      const s = { id: rid(), c: t.color, w: t.width, k: t.tool === 'hl' ? 'hl' : 'pen', u: ME.uid, p: this.pos(e) };
      this.strokes().push(s);
      this.mine.push(s.id);
      this.drawing = s;
      this.pending = s.p.slice();
      this.flush();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.drawing) return;
      if (this.drawing.eraser) return this.erase(this.pos(e));
      const [x, y] = this.pos(e);
      this.drawing.p.push(x, y);
      this.pending.push(x, y);
      this.draw();
      if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), 60);
    });
    const end = () => {
      if (this.drawing && !this.drawing.eraser) this.flush();
      this.drawing = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  },
  flush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const s = this.drawing;
    if (!s || !this.pending.length) return;
    send({ t: 'wb', b: this.id, op: 's', id: s.id, c: s.c, w: s.w, k: s.k, p: this.pending });
    this.pending = [];
  },
  erase([x, y]) {
    const hit = this.strokes().filter((s) => {
      for (let i = 0; i < s.p.length; i += 2) if (Math.abs(s.p[i] - x) < 120 && Math.abs(s.p[i + 1] - y) < 200) return true;
      return false;
    }).map((s) => s.id);
    if (!hit.length) return;
    S.room.boards[this.id] = this.strokes().filter((s) => !hit.includes(s.id));
    send({ t: 'wb', b: this.id, op: 'del', ids: hit });
    this.draw();
  },
  remote(m) {
    const list = (S.room.boards[m.b] = S.room.boards[m.b] || []);
    const wasEmpty = !list.length;
    if (m.op === 's') {
      let s = list.find((x) => x.id === m.id);
      if (!s) list.push((s = { id: m.id, c: m.c, w: m.w, k: m.k, u: m.u, p: [] }));
      s.p.push(...m.p);
    } else if (m.op === 'del') {
      S.room.boards[m.b] = list.filter((x) => !m.ids.includes(x.id));
    } else if (m.op === 'clear') {
      S.room.boards[m.b] = [];
    }
    if (m.b === this.id) this.draw();
    if (String(m.b).startsWith('slate:')) {
      // First ink on a board (or a cleared board) changes the grid's counter and labels.
      if (isMod() && !Slates.focus && (wasEmpty !== !(S.room.boards[m.b] || []).length)) renderStage();
      else Slates.changed();
    }
  },
  tools(bar) {
    if (!bar) return;
    const t = S.boardTool;
    const can = this.canDraw();
    const tool = (k, ic, label) => h('button', { class: 'lm-tool' + (t.tool === k ? ' on' : ''), title: label, 'aria-label': label, 'aria-pressed': String(t.tool === k), onclick: () => { t.tool = k; this.tools(bar); } }, icon(ic));
    bar.replaceChildren(
      ...(this.lead || []),
      ...(can ? [
        h('div', { class: 'lm-toolgroup' }, tool('pen', 'pen', 'Pen'), tool('hl', 'marker', 'Highlighter'), tool('eraser', 'eraser', 'Eraser')),
        h('div', { class: 'lm-toolgroup' }, ...(this.palette || COLORS).map((c) => h('button', { class: 'sw' + (t.color === c ? ' on' : ''), style: `--c:${c}`, title: 'Colour', 'aria-label': 'Colour ' + c, onclick: () => { t.color = c; if (t.tool === 'eraser') t.tool = 'pen'; this.tools(bar); } }))),
        h('div', { class: 'lm-toolgroup' }, ...[2, 4, 8].map((w) => h('button', { class: 'lm-tool wd' + (t.width === w ? ' on' : ''), title: `${w}px line`, 'aria-label': `${w} pixel line`, onclick: () => { t.width = w; this.tools(bar); } }, h('span', { class: 'dotw', style: `--w:${w + 2}px` })))),
        h('button', { class: 'lm-tool', title: 'Undo my last stroke', 'aria-label': 'Undo', onclick: () => { const id = this.mine.pop(); if (id) { S.room.boards[this.id] = this.strokes().filter((s) => s.id !== id); send({ t: 'wb', b: this.id, op: 'del', ids: [id] }); this.draw(); } } }, icon('undo')),
        ...(this.stampTools ? [h('div', { class: 'lm-toolgroup' }, ...this.stampTools.map((k) => h('button', { class: 'lm-tool stamp' + (t.tool === 'stamp:' + k ? ' on' : ''), title: STAMPS[k].label, 'aria-label': 'Stamp: ' + STAMPS[k].label, onclick: () => { t.tool = 'stamp:' + k; this.tools(bar); } }, stampEl(k, true))))] : []),
        isMod() && !this.noClear ? h('button', { class: 'lm-tool', title: 'Clear for everyone', 'aria-label': 'Clear for everyone', onclick: () => window.confirm('Clear this board for everyone?') && send({ t: 'wb', b: this.id, op: 'clear' }) }, icon('trash')) : '',
      ] : [h('span', { class: 'lm-viewonly' }, 'View only')]),
      h('button', { class: 'lm-tool', title: 'Save as image', 'aria-label': 'Save as image', onclick: () => this.save() }, icon('download')),
      ...(this.extra || []),
    );
  },
  save() {
    const out = h('canvas', { width: this.canvas.width, height: this.canvas.height });
    const c = out.getContext('2d');
    const under = this.canvas.parentNode.querySelector('canvas.lm-slide, img.lm-slide');
    c.fillStyle = '#fff';
    c.fillRect(0, 0, out.width, out.height);
    if (under) c.drawImage(under, 0, 0, out.width, out.height);
    c.drawImage(this.canvas, 0, 0);
    const a = h('a', { href: out.toDataURL('image/png'), download: `${C.title} - ${this.id === 'wb' ? 'whiteboard' : 'slide'}.png` });
    a.click();
  },
};


// Shared stroke renderer (whiteboard, slides, student boards, thumbnails).
function drawStrokes(c, strokes, W2, H2, clear = true) {
  if (clear) c.clearRect(0, 0, W2, H2);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const s of strokes || []) {
    if (!s.p || s.p.length < 2) continue;
    c.globalAlpha = s.k === 'hl' ? 0.35 : 1;
    c.strokeStyle = s.c;
    c.lineWidth = (s.k === 'hl' ? s.w * 3 : s.w) * (W2 / 1000);
    c.beginPath();
    c.moveTo((s.p[0] / 10000) * W2, (s.p[1] / 10000) * H2);
    for (let i = 2; i < s.p.length; i += 2) c.lineTo((s.p[i] / 10000) * W2, (s.p[i + 1] / 10000) * H2);
    if (s.p.length === 2) c.lineTo((s.p[0] / 10000) * W2 + 0.1, (s.p[1] / 10000) * H2);
    c.stroke();
  }
  c.globalAlpha = 1;
}

// Marking stamps. Green for positive, amber for "have another go" — never red on student work.
const STAMPS = {
  tick: { label: 'Tick', cls: 'ok', ic: 'check' },
  cross: { label: 'Not quite', cls: 'amber', ic: 'x' },
  star: { label: 'Star', cls: 'star', ic: 'star' },
  smile: { label: 'Smiley', cls: 'ok', ic: 'smile' },
  question: { label: 'Question', cls: 'blue', text: '?' },
  great: { label: 'Great work', cls: 'ok pill', text: 'Great work' },
  nearly: { label: 'Nearly', cls: 'amber pill', text: 'Nearly' },
};
function stampEl(k, small) {
  const d = STAMPS[k];
  return h('span', { class: `lm-stamp ${d.cls}${small ? ' sm' : ''}` }, d.ic ? icon(d.ic) : h('b', {}, d.text));
}
const BOARD_PALETTE = ['#111111', '#1e88e5', '#22c65e', '#f78e08', '#8e24aa'];
const MARK_PALETTE = ['#22c65e', '#f78e08', '#1e88e5', '#8e24aa', '#111111'];

// Student boards: every student draws on their own board; the teacher sees them all and marks them.
const Slates = {
  focus: null, // uid the teacher is marking
  raf: 0,
  get sl() {
    return S.room && S.room.slates;
  },
  board(uid, teacher) {
    return `slate:${this.sl.id}:${uid}${teacher ? ':t' : ''}`;
  },
  students() {
    return roomPeers().filter((p) => !p.mod).sort((a, b) => a.j - b.j);
  },
  label(p) {
    if (!p.anon) return p.name;
    return 'Student ' + (this.students().findIndex((x) => x.uid === p.uid) + 1);
  },
  avatar(p, size) {
    if (p.anon) return h('span', { class: 'av anon', style: `width:${size}px;height:${size}px` }, icon('users'));
    return realPic(p.pic)
      ? h('img', { class: 'av', src: p.pic, alt: '', style: `width:${size}px;height:${size}px` })
      : h('span', { class: 'av', style: `width:${size}px;height:${size}px;background:${tone(p.name)}` }, initials(p.name));
  },
  mark(uid) {
    return (this.sl.marks && this.sl.marks[uid]) || { status: null, stamps: [] };
  },
  changed() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.refresh());
  },
  // Redraw thumbnails / overlays without rebuilding the DOM.
  refresh() {
    document.querySelectorAll('canvas[data-slate]').forEach((cv) => {
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const W = Math.max(1, Math.round(r.width * dpr));
      const H = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const c = cv.getContext('2d');
      drawStrokes(c, S.room.boards[cv.dataset.slate] || [], W, H);
      if (cv.dataset.slate2) drawStrokes(c, S.room.boards[cv.dataset.slate2] || [], W, H, false);
    });
  },
  stamps(uid) {
    return h('div', { class: 'lm-stamps' }, ...this.mark(uid).stamps.map((st) => {
      const el = stampEl(st.k);
      el.style.left = st.x / 100 + '%';
      el.style.top = st.y / 100 + '%';
      return el;
    }));
  },
  status(uid, big) {
    const st = this.mark(uid).status;
    if (!st) return '';
    return h('span', { class: 'lm-mark-badge ' + (st === 'correct' ? 'ok' : 'amber') + (big ? ' big' : '') },
      icon(st === 'correct' ? 'check' : 'undo'), st === 'correct' ? 'Correct' : 'Have another go');
  },
  fit(host, wrap) {
    fitSlide(wrap, 16 / 9);
  },
  mount(host, tools) {
    const sl = this.sl;
    if (!sl) return;
    Board.lead = null;
    Board.extra = null;
    Board.palette = null;
    Board.stampTools = null;
    Board.onStamp = null;
    Board.drawCheck = null;
    Board.afterDraw = null;
    Board.noClear = false;
    const shown = sl.show && S.participants.size && roomPeers().find((p) => p.uid === sl.show);
    if (isMod()) return this.focus ? this.mountFocus(host, tools) : this.mountGrid(host, tools);
    if (shown && shown.uid !== ME.uid) return this.mountShown(host, tools, shown);
    return this.mountMine(host, tools);
  },
  mountGrid(host, tools) {
    Board.unmount();
    const sl = this.sl;
    const list = this.students();
    const answered = list.filter((p) => (S.room.boards[this.board(p.uid)] || []).length).length;
    tools.replaceChildren(
      h('span', { class: 'lm-slate-prompt' }, icon('pen'), sl.prompt || 'Student boards'),
      h('span', { class: 'lm-slate-count' }, `${answered} of ${list.length} answered`),
      h('div', { class: 'lm-toolgroup' },
        h('button', { class: 'lm-tool txt ok', onclick: () => send({ t: 'slates', op: 'markAll', status: 'correct' }) }, icon('check'), 'Mark all correct'),
        h('button', { class: 'lm-tool txt', onclick: () => send({ t: 'slates', op: 'markAll', status: null }) }, 'Clear marks')),
      sl.active
        ? h('button', { class: 'lm-tool txt', onclick: () => send({ t: 'slates', op: 'end' }) }, icon('x'), 'Finish')
        : h('button', { class: 'lm-tool txt', onclick: () => send({ t: 'slates', op: 'reopen' }) }, 'Reopen boards'));
    const n = list.length;
    // Choose columns so every board (16:9 paper + name row) fits the stage without scrolling when possible.
    const box = host.getBoundingClientRect();
    let best = { cols: 1, w: 0 };
    for (let c = 1; c <= Math.max(1, n); c++) {
      const rows = Math.ceil(n / c) || 1;
      const w = Math.min((box.width - (c - 1) * 12) / c, ((box.height - (rows - 1) * 12) / rows - 44) * (16 / 9));
      if (w > best.w) best = { cols: c, w };
    }
    const tileW = Math.max(180, Math.floor(best.w));
    const grid = h('div', { class: 'lm-slate-grid', style: `--cols:${best.cols};--tw:${tileW}px` }, ...list.map((p) => {
      const st = this.mark(p.uid).status;
      return h('button', { class: 'lm-slate' + (st ? ' ' + st : '') + (sl.show === p.uid ? ' shown' : ''), 'aria-label': `Open ${this.label(p)}’s board`, onclick: () => { this.focus = p.uid; renderStage(); } },
        h('div', { class: 'paper' },
          h('canvas', { 'data-slate': this.board(p.uid), 'data-slate2': this.board(p.uid, true) }),
          this.stamps(p.uid),
          (S.room.boards[this.board(p.uid)] || []).length ? '' : h('span', { class: 'empty' }, 'Not started')),
        h('div', { class: 'who' }, this.avatar(p, 26), h('span', { class: 'nm' }, this.label(p)), this.status(p.uid)));
    }));
    if (!n) grid.append(h('p', { class: 'lm-muted' }, 'Student boards appear here as students join.'));
    host.replaceChildren(grid);
    requestAnimationFrame(() => this.refresh());
  },
  mountFocus(host, tools) {
    const sl = this.sl;
    const list = this.students();
    const i = list.findIndex((p) => p.uid === this.focus);
    const p = list[i];
    if (!p) {
      this.focus = null;
      return this.mountGrid(host, tools);
    }
    let wrap = host.querySelector('.lm-slide-wrap.slate');
    if (!wrap || wrap.dataset.uid !== p.uid) {
      wrap = h('div', { class: 'lm-slide-wrap slate', 'data-uid': p.uid }, h('canvas', { class: 'lm-slide', 'data-slate': this.board(p.uid) }));
      host.replaceChildren(wrap);
      Board.unmount();
    }
    this.fit(host, wrap);
    wrap.querySelectorAll('.lm-stamps').forEach((x) => x.remove());
    wrap.append(this.stamps(p.uid));
    const go = (d) => { const q = list[(i + d + list.length) % list.length]; this.focus = q.uid; renderStage(); };
    Board.palette = MARK_PALETTE;
    if (!MARK_PALETTE.includes(S.boardTool.color)) S.boardTool.color = MARK_PALETTE[0];
    Board.stampTools = ['tick', 'cross', 'star', 'smile', 'question', 'great', 'nearly'];
    Board.noClear = true;
    Board.onStamp = (k, x, y) => send({ t: 'slates', op: 'stamp', uid: p.uid, k, x, y });
    Board.extra = [
      h('div', { class: 'lm-toolgroup' },
        h('button', { class: 'lm-tool txt ok' + (this.mark(p.uid).status === 'correct' ? ' on' : ''), onclick: () => send({ t: 'slates', op: 'mark', uid: p.uid, status: this.mark(p.uid).status === 'correct' ? null : 'correct' }) }, icon('check'), 'Correct'),
        h('button', { class: 'lm-tool txt amber' + (this.mark(p.uid).status === 'try' ? ' on' : ''), onclick: () => send({ t: 'slates', op: 'mark', uid: p.uid, status: this.mark(p.uid).status === 'try' ? null : 'try' }) }, icon('undo'), 'Have another go'),
        h('button', { class: 'lm-tool', title: 'Remove last stamp', 'aria-label': 'Remove last stamp', onclick: () => send({ t: 'slates', op: 'unstamp', uid: p.uid }) }, icon('trash'))),
      h('button', { class: 'lm-tool txt' + (sl.show === p.uid ? ' on' : ''), onclick: () => send({ t: 'slates', op: 'show', uid: sl.show === p.uid ? null : p.uid }) }, icon('present'), sl.show === p.uid ? 'Stop showing' : 'Show to class'),
    ];
    // The way back to the grid stays in the toolbar however often the toolbar redraws.
    Board.lead = [h('div', { class: 'lm-toolgroup' },
      h('button', { class: 'lm-tool txt', onclick: () => { this.focus = null; renderStage(); } }, icon('grid'), 'All boards'),
      h('button', { class: 'lm-tool', title: 'Previous student', 'aria-label': 'Previous student', onclick: () => go(-1) }, icon('back')),
      h('span', { class: 'lm-slate-who' }, this.avatar(p, 24), this.label(p)),
      h('button', { class: 'lm-tool', title: 'Next student', 'aria-label': 'Next student', onclick: () => go(1) }, icon('next')))];
    Board.mount(host, null, this.board(p.uid, true), 16 / 9, wrap);
    Board.tools(tools);
    requestAnimationFrame(() => { this.refresh(); Board.resize(); });
  },
  mountMine(host, tools) {
    const sl = this.sl;
    const me2 = me();
    Board.palette = BOARD_PALETTE;
    if (!BOARD_PALETTE.includes(S.boardTool.color)) S.boardTool.color = BOARD_PALETTE[0];
    Board.drawCheck = () => sl.active;
    Board.afterDraw = () => this.changed();
    Board.lead = null;
    Board.extra = [
      h('label', { class: 'lm-switchrow lm-anon', title: 'Hide your name and picture on your board' },
        h('span', {}, 'Hide my name'), h('input', { type: 'checkbox', checked: !!(me2 && me2.anon), onchange: (e) => { lsSet('anon', e.target.checked ? '1' : '0'); send({ t: 'slateanon', on: e.target.checked }); } }), h('span', { class: 'sw' })),
    ];
    const id = this.board(ME.uid);
    Board.mount(host, tools, id, 16 / 9);
    const wrap = Board.canvas.parentNode;
    if (!wrap.querySelector('canvas.marks')) {
      wrap.append(h('canvas', { class: 'marks', 'data-slate': this.board(ME.uid, true) }));
    }
    wrap.querySelectorAll('.lm-stamps, .lm-slate-head, .lm-mark-badge').forEach((x) => x.remove());
    wrap.append(this.stamps(ME.uid));
    tools.prepend(h('span', { class: 'lm-slate-prompt', title: 'Only you and your teacher can see your board' }, icon('pen'), sl.prompt || 'Your board'),
      this.status(ME.uid, true) || '', sl.active ? '' : h('span', { class: 'lm-viewonly' }, 'Boards are closed'));
    requestAnimationFrame(() => this.refresh());
  },
  mountShown(host, tools, p) {
    Board.unmount();
    tools.replaceChildren(h('span', { class: 'lm-slate-prompt' }, icon('present'), `Your teacher is showing ${this.label(p)}’s board`));
    const wrap = h('div', { class: 'lm-slide-wrap slate' },
      h('canvas', { class: 'lm-slide', 'data-slate': this.board(p.uid), 'data-slate2': this.board(p.uid, true) }),
      this.stamps(p.uid),
      h('div', { class: 'who float' }, this.avatar(p, 28), h('span', { class: 'nm' }, this.label(p)), this.status(p.uid)));
    host.replaceChildren(wrap);
    this.fit(host, wrap);
    requestAnimationFrame(() => this.refresh());
  },
};
window.addEventListener('resize', () => S.room && S.room.stage === 'slates' && renderStage());

// ------------------------------------------------------------------ presentation (PDF / image), rendered locally
// Fit a slide, picture or PDF page inside the stage, below the toolbar, at its own shape. CSS does the maths
// (container units), so it stays right when the toolbar appears, the window resizes or the side panel opens.
function fitSlide(wrap, ratio) {
  const r = Math.max(.2, Math.min(5, ratio || 16 / 9));
  Object.assign(wrap.style, { width: `min(100cqw, calc(100cqh * ${r.toFixed(4)}))`, height: 'auto', aspectRatio: String(r.toFixed(4)), maxHeight: '100cqh' });
}

const Slides = {
  pdfjs: null, docs: new Map(), renderedKey: null,
  canPresent() {
    return isMod() || !!pol().present;
  },
  async lib() {
    if (!this.pdfjs) {
      this.pdfjs = await import(C.pdfjs + 'pdf.min.js');
      this.pdfjs.GlobalWorkerOptions.workerSrc = C.pdfjs + 'pdf.worker.min.js';
    }
    return this.pdfjs;
  },
  async fetchFile(key) {
    const r = await fetch(`${W}/files/get?key=${encodeURIComponent(key)}`, { headers: { Authorization: 'Bearer ' + C.token } });
    if (!r.ok) throw new Error('Could not load slides');
    return r.arrayBuffer();
  },
  async doc(pres) {
    if (!this.docs.has(pres.key)) {
      this.docs.set(pres.key, (async () => {
        const data = await this.fetchFile(pres.key);
        if (pres.type === 'image') return { image: URL.createObjectURL(new Blob([data])) };
        if (pres.type === 'show') return { show: this.showUrl(new TextDecoder().decode(data)) };
        const lib = await this.lib();
        return { pdf: await lib.getDocument({ data }).promise };
      })());
    }
    return this.docs.get(pres.key);
  },
  pick() {
    const input = h('input', { type: 'file', accept: '.pptx,.ppt,.pps,.ppsx,.pptm,.odp,.key,.docx,.doc,.odt,.rtf,.txt,.xlsx,.xls,.ods,.csv,application/pdf,image/png,image/jpeg,image/webp,image/gif' });
    input.onchange = () => input.files[0] && this.upload(input.files[0]);
    input.click();
  },
  async upload(file) {
    if (file.size > 50 * 1024 * 1024) return toast('Slides must be under 50 MB. Tip: export as PDF.');
    let showType = null;
    let showPages = 1;
    if (/\.(pptx?|ppsx?|pptm|odp|key|docx?|odt|rtf|txt|xlsx?|ods|csv)$/i.test(file.name)) {
      // PowerPoint, Word and Excel: Moodle converts them (PowerPoint keeps animations and transitions when the
      // server has LibreOffice).
      if (!C.slidesUrl) return toast('Only teachers can upload Office files. Save it as PDF to present it.');
      const isShow = /\.(pptx?|ppsx?|pptm|odp|key)$/i.test(file.name);
      toast(`Preparing ${file.name}…${isShow ? ' (animations and transitions included)' : ''}`, 8000);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('sesskey', C.sesskey);
        const r = await fetch(C.slidesUrl, { method: 'POST', body: fd, credentials: 'same-origin' });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Conversion failed');
        showType = r.headers.get('X-LiveLab-Type') === 'show' ? 'show' : 'pdf';
        showPages = parseInt(r.headers.get('X-LiveLab-Pages') || '1', 10) || 1;
        const base = file.name.replace(/\.[^.]+$/, '');
        file = new File([await r.blob()], base + (showType === 'show' ? '.svg' : '.pdf'), { type: showType === 'show' ? 'image/svg+xml' : 'application/pdf' });
      } catch (e) {
        return toast('⚠️ ' + e.message);
      }
    }
    // Pictures: phone photos are often 12 megapixels and 5-10 MB. Everyone would download and decode that, which
    // makes the class lag. Shrink to at most 2560 px (sharper than any screen shows it) before uploading.
    if (!showType && /^image\/(jpeg|png|webp|heic|heif|bmp)$/.test(file.type)) file = await this.shrinkImage(file);
    toast(`Uploading ${file.name}…`);
    try {
      const r = await fetch(`${W}/files/upload?name=${encodeURIComponent(file.name)}`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + C.token, 'Content-Type': file.type }, body: file,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Upload failed');
      let pages = showType === 'show' ? showPages : 1;
      const type = showType === 'show' ? 'show' : file.type === 'application/pdf' ? 'pdf' : 'image';
      if (type === 'pdf') {
        const lib = await this.lib();
        const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
        pages = pdf.numPages;
        this.docs.set(j.key, Promise.resolve({ pdf }));
      }
      send({ t: 'pres', key: j.key, name: file.name.replace(/\.[^.]+$/, ''), pages, type });
    } catch (e) {
      toast('⚠️ ' + e.message + (file.type.includes('presentation') ? ' (Save PowerPoint/Keynote as PDF first.)' : ''));
    }
  },
  async shrinkImage(file) {
    try {
      const bmp = await createImageBitmap(file);
      const max = 2560;
      const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
      // Already small and light: send as it is.
      if (sc === 1 && file.size < 1.5 * 1024 * 1024) { bmp.close && bmp.close(); return file; }
      const c = h('canvas', { width: Math.round(bmp.width * sc), height: Math.round(bmp.height * sc) });
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; // transparent PNGs show on white, like a slide
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close && bmp.close();
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (e) {
      return file;
    }
  },
  go(delta) {
    const p = S.room.pres;
    if (!p || !this.canPresent()) return;
    if (p.type === 'show') {
      // The presenter's slide show plays the next animation or transition, then reports where it is.
      if (this.show && this.show.frame) this.show.frame.contentWindow.postMessage({ lv: 1, cmd: delta > 0 ? 'next' : 'prev' }, '*');
      return;
    }
    const page = Math.max(1, Math.min(p.pages, p.page + delta));
    if (page !== p.page) {
      p.page = page;
      send({ t: 'page', page });
      renderStage();
    }
  },
  async mount(host, tools) {
    const p = S.room.pres;
    if (!p) return;
    const key = `${p.key}#${p.page}`;
    let wrap = host.querySelector('.lm-slide-wrap');
    if (!wrap) {
      wrap = h('div', { class: 'lm-slide-wrap' });
      host.replaceChildren(wrap);
    }
    Object.assign(Board, { palette: null, stampTools: null, onStamp: null, drawCheck: null, afterDraw: null, noClear: false });
    const nav = [
      h('span', { class: 'lm-pres-name' }, p.name),
      h('div', { class: 'lm-toolgroup pager' },
        this.canPresent() ? h('button', { class: 'lm-tool', title: 'Previous slide', 'aria-label': 'Previous slide', onclick: () => this.go(-1), disabled: p.page <= 1 }, icon('back')) : '',
        h('span', { class: 'pg' }, `${p.page} / ${p.pages}`),
        this.canPresent() ? h('button', { class: 'lm-tool', title: 'Next slide', 'aria-label': 'Next slide', onclick: () => this.go(1), disabled: p.type !== 'show' && p.page >= p.pages }, icon('next')) : ''),
      this.canPresent() ? h('button', { class: 'lm-tool', title: 'Stop presenting', 'aria-label': 'Stop presenting', onclick: () => send({ t: 'pres', clear: true }) }, icon('x')) : '',
    ];
    Board.lead = null;
    Board.extra = nav;
    if (this.renderedKey === key && wrap.querySelector('.lm-slide')) {
      Board.mount(host, tools, `p:${p.key}:${p.page}`, 16 / 9, wrap);
      return;
    }
    this.renderedKey = key;
    try {
      const d = await this.doc(p);
      if (S.room.pres !== p || `${p.key}#${p.page}` !== key) return;
      const r = host.getBoundingClientRect();
      let el;
      if (d.show) {
        const ratio = 16 / 9;
        const w = Math.min(r.width, r.height * ratio);
        fitSlide(wrap, ratio);
        if (!this.show || this.show.key !== p.key || !this.show.frame.isConnected) {
          // Sandboxed: the slide show runs its own script but cannot reach this page, the class or anyone's sign-in.
          const frame = h('iframe', { class: 'lm-slide lm-show', sandbox: 'allow-scripts', src: d.show, title: p.name, tabindex: '-1' });
          this.show = { key: p.key, frame, ready: false, slide: 0, step: 0 };
        }
        el = this.show.frame;
        if (el.parentNode !== wrap) wrap.replaceChildren(el);
        Board.unmount();
        Board.mount(host, tools, `p:${p.key}:${p.page}`, 16 / 9, wrap);
        this.showGoto(false);
        return;
      }
      if (d.image) {
        el = h('img', { class: 'lm-slide', src: d.image, alt: p.name, decoding: 'async' });
        await el.decode().catch(() => new Promise((res) => { el.onload = res; el.onerror = res; }));
        const ratio = el.naturalWidth / el.naturalHeight || 16 / 9;
        const w = Math.min(r.width, r.height * ratio);
        fitSlide(wrap, ratio);
      } else {
        const page = await d.pdf.getPage(p.page);
        const vp1 = page.getViewport({ scale: 1 });
        const ratio = vp1.width / vp1.height;
        const w = Math.min(r.width, r.height * ratio);
        const scale = (w / vp1.width) * (window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale });
        el = h('canvas', { class: 'lm-slide', width: vp.width, height: vp.height });
        await page.render({ canvasContext: el.getContext('2d'), viewport: vp }).promise;
        if (this.canPresent() && this.lastCtx !== key) {
          // Share the slide's words so captions spell jargon correctly and translations use the right terms.
          this.lastCtx = key;
          page.getTextContent().then((tc) => send({ t: 'slidectx', text: tc.items.map((i) => i.str).join(' ').slice(0, 1200) })).catch(() => {});
        }
        fitSlide(wrap, ratio);
      }
      wrap.replaceChildren(el);
      Board.unmount();
      Board.mount(host, tools, `p:${p.key}:${p.page}`, 16 / 9, wrap);
    } catch (e) {
      host.replaceChildren(h('p', { class: 'lm-muted' }, 'Could not show slides: ' + e.message));
    }
  },
};
// Animated PowerPoint shows (LibreOffice presentation engine). A small bridge lets the room drive the show and keep
// everyone on the same slide and animation step.
Slides.bridge = `<script type="text/ecmascript"><![CDATA[
(function () {
  function txt() { try { return theMetaDoc.aMetaSlideSet[nCurSlide].slideElement.textContent.replace(/\\s+/g, ' ').trim().slice(0, 1200); } catch (e) { return ''; } }
  // Report once any slide transition has finished, so the slide number is the new one.
  function after(kind) { var t0 = Date.now(); (function w() { var busy = false; try { busy = aSlideShow.isTransitionPlaying(); } catch (e) {} if (busy && Date.now() - t0 < 4000) setTimeout(w, 50); else st(kind); })(); }
  function st(kind) { try { parent.postMessage({ lv: 1, kind: kind, slide: nCurSlide, step: aSlideShow.nCurrentEffect || 0, pages: theMetaDoc.nNumberOfSlides, text: txt() }, '*'); } catch (e) {} }
  function quiet(fn) { try { fn(); } catch (e) {} }
  window.addEventListener('message', function (e) {
    var d = e.data || {}; if (!d.lv) return;
    if (d.cmd === 'next') { quiet(function () { dispatchEffects(1); }); setTimeout(function () { after('moved'); }, 30); }
    else if (d.cmd === 'prev') { quiet(function () { dispatchEffects(-1); }); setTimeout(function () { after('moved'); }, 30); }
    else if (d.cmd === 'goto') {
      quiet(function () {
        var cur = nCurSlide, curStep = aSlideShow.nCurrentEffect || 0;
        if (d.animate && d.slide === cur && d.step === curStep + 1) { aSlideShow.nextEffect(); }
        else if (d.animate && d.slide === cur + 1 && d.step === 0) { switchSlide(1, false); }
        else if (d.slide !== cur || d.step !== curStep) {
          aSlideShow.displaySlide(d.slide, true);
          for (var i = 0; i < d.step; i++) { aSlideShow.nextEffect(); aSlideShow.skipAllPlayingEffects(); }
        }
      });
      setTimeout(function () { after('synced'); }, 30);
    }
  });
  window.addEventListener('load', function () { setTimeout(function () { st('ready'); }, 400); });
})();
]]></script>`;
Slides.showUrl = function (svg) {
  const i = svg.lastIndexOf('</svg>');
  const out = i > 0 ? svg.slice(0, i) + this.bridge + svg.slice(i) : svg;
  return URL.createObjectURL(new Blob([out], { type: 'image/svg+xml' }));
};
Slides.showGoto = function (animate) {
  const p = S.room && S.room.pres;
  const sh = this.show;
  if (!p || !sh || !sh.ready || sh.key !== p.key) return;
  sh.frame.contentWindow.postMessage({ lv: 1, cmd: 'goto', slide: (p.page || 1) - 1, step: p.step | 0, animate }, '*');
};
window.addEventListener('message', (e) => {
  const d = e.data || {};
  const sh = Slides.show;
  if (!d.lv || !d.kind || !sh || !sh.frame || e.source !== sh.frame.contentWindow) return;
  sh.slide = d.slide;
  sh.step = d.step;
  if (d.kind === 'ready') { sh.ready = true; Slides.showGoto(false); return; }
  const p = S.room && S.room.pres;
  if (d.kind === 'moved' && p && p.key === sh.key && Slides.canPresent()) {
    p.page = d.slide + 1;
    p.step = d.step;
    send({ t: 'page', page: p.page, step: p.step });
    if (d.text && Slides.lastCtx !== p.key + '#' + p.page) { Slides.lastCtx = p.key + '#' + p.page; send({ t: 'slidectx', text: d.text }); }
    renderStage();
  }
});

document.addEventListener('keydown', (e) => {
  if (!S.room || S.room.stage !== 'pres' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') Slides.go(1);
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') Slides.go(-1);
});
window.addEventListener('resize', () => {
  if (S.room && S.room.stage === 'pres') {
    Slides.renderedKey = null;
    renderStage();
  }
});

// ------------------------------------------------------------------ captions, translation and spoken translation
// Pipeline (why it reads well): live words appear instantly from the browser's recognizer; each finished phrase is
// re-transcribed by Whisper on the server (primed with key terms + the slide), then translated as a whole sentence
// by an AI model with the previous lines as context. Lines are only ever appended — no flicker.
const CC = {
  prefs: (() => {
    let p = null;
    try { p = JSON.parse(lsGet('cc') || 'null'); } catch (e) { /* ignore */ }
    const sug = suggested()[0];
    return Object.assign({ speak: sug ? sug.code : 'en-AU', show: '', voice: false, original: true }, p || {});
  })(),
  save() {
    lsSet('cc', JSON.stringify(this.prefs));
    // show '' = "Original language": the server sends no translations to this person.
    send({ t: 'ccprefs', on: S.ccOn, show: this.prefs.show || '' });
  },
  need: false, // someone in my room reads captions → I should upload my speech
  serverAsr: true, // flips off if the server can't recognise (then browser finals are used)
  lines: [], // committed: {id, cid, name, text, original, translated, ts}
  live: new Map(), // cid -> {name, text, ts}
  history: [],
  showLang() {
    return this.prefs.show || this.prefs.speak;
  },
  wantsTranslation(lang) {
    return !!this.prefs.show && this.prefs.show.split('-')[0] !== String(lang).split('-')[0];
  },
  onCaption(m) {
    // The language each person speaks, for "Hear only the translated voice". Only finished lines count (they carry
    // the language the server detected from the speech).
    if (m.final && m.lang && m.cid !== S.cid && !m.translated && speakerLang.get(m.cid) !== m.lang) {
      speakerLang.set(m.cid, m.lang);
      const el = audioEls.get(m.cid);
      if (el) el.volume = origVolume(m.cid, false);
    }
    if (!m.final) {
      if (this.wantsTranslation(m.lang)) {
        this.live.set(m.cid, { name: m.name, text: '…', ts: Date.now() }); // don't show foreign-language half sentences
      } else {
        this.live.set(m.cid, { name: m.name, text: m.text, ts: Date.now() });
      }
      return this.render();
    }
    this.live.delete(m.cid);
    if (m.translated) {
      // "Original language" chosen: keep captions exactly as spoken.
      if (!this.prefs.show) return undefined;
      // Replace the original line we showed while waiting for the translation.
      // Update the original line in place, wherever it is. A late translation of an older line must never pull the
      // bubble back to a speaker who has already finished (that made captions jump between people).
      const line = this.lines.find((l) => l.id === m.id) || this.history.find((l) => l.id === m.id);
      const spoken = !!(line && line.translated); // already translated on this computer and read aloud
      if (line) Object.assign(line, { text: m.text, original: line.original || m.original, translated: true, pending: false });
      else this.push({ id: m.id, cid: m.cid, name: m.name, text: m.text, original: m.original, translated: true });
      if (!spoken) Voice.say(m.text, this.showLang(), m.cid);
    } else {
      const pending = this.wantsTranslation(m.lang);
      this.push({ id: m.id, cid: m.cid, name: m.name, text: m.text, original: null, translated: false, pending });
      if (pending) Local.translate(m, this);
    }
    this.render();
  },
  push(line) {
    line.ts = Date.now();
    this.lines.push(line);
    if (this.lines.length > 3) this.lines.shift();
    this.history.push(line);
    if (this.history.length > 500) this.history.shift();
  },
  clear() {
    this.lines = [];
    this.live.clear();
    this.slots = [];
    const box = $('#lm-captions');
    if (box) box.replaceChildren();
    this.render();
  },
  // Captions: one bubble, for the person speaking now. When someone else starts talking, the same bubble switches
  // to them (name, colour, picture and words change in place). It is built once and then only its words change
  // (two text nodes: finished words and live words), so nothing is redrawn, re-animated or reordered.
  // If two people talk over each other, the bubble stays with the current speaker until they pause.
  slots: [], // {cid, name, parts: Map(id -> line), live, ts, el, done, now, orig, shown}
  slotFor(cid, name) {
    let s = this.slots.find((x) => x.cid === cid);
    if (s) return s;
    const box = $('#lm-captions');
    const fresh = () => {
      const t = { cid, name, parts: new Map(), live: '', ts: Date.now(), el: null, shown: false };
      t.done = document.createTextNode('');
      t.now = document.createTextNode('');
      t.av = h('span', { class: 'cav' });
      t.nm = h('b', {});
      t.orig = h('span', { class: 'orig' });
      t.el = h('div', { class: 'cap out' }, t.av, h('div', { class: 'cmain' }, t.nm,
        h('div', { class: 'cbody' }, h('div', { class: 'cin' }, h('span', { class: 't' }, t.done), h('span', { class: 't live' }, t.now))), t.orig));
      if (box) box.append(t.el);
      return t;
    };
    if (!this.slots.length) {
      s = fresh();
      this.slots.push(s);
    } else {
      s = this.slots[0];
      // Someone is still talking: wait for a short pause before handing the bubble over.
      // Also wait (up to 3 s) for the translation of their last sentence, so it is read before the bubble moves on.
      if (s.shown && s.cid !== cid) {
        const lastPart = [...s.parts.values()].pop();
        if (Date.now() - (s.spoke || 0) < 700) return null;
        if (Date.now() - (s.changed || 0) < 1500) return null; // let people read a sentence (or its translation) that just appeared
        if (lastPart && lastPart.pending && Date.now() - lastPart.ts < 3000) return null;
      }
      Object.assign(s, { cid, name, parts: new Map(), live: '', ts: Date.now(), spoke: 0 });
      s.done.data = '';
      s.now.data = '';
    }
    this.dress(s);
    return s;
  },
  dress(s) {
    const p = S.participants.get(s.cid) || (s.cid === S.cid ? { name: ME.name, pic: ME.pic } : { name: s.name });
    const col = capColor(s.cid, s.name);
    s.el.style.setProperty('--cc', col);
    s.nm.textContent = s.cid === S.cid ? 'You' : (p.name || s.name);
    const pic = realPic(p.pic) ? p.pic : '';
    if (s.av.dataset.pic !== pic || s.av.dataset.col !== col) {
      s.av.dataset.pic = pic;
      s.av.dataset.col = col;
      s.av.replaceChildren(pic ? h('img', { src: pic, alt: '' }) : document.createTextNode(initials(s.name)));
      s.av.style.background = pic ? 'transparent' : col;
    }
  },
  render() {
    const box = $('#lm-captions');
    if (!box) return;
    const now = Date.now();
    // Your own words are never shown to you (you know what you said); everyone else sees them.
    for (const l of this.lines) {
      if (l.slotted || l.cid === S.cid || now - l.ts > 10000) continue;
      const s = this.slotFor(l.cid, l.name);
      if (!s) continue;
      s.parts.set(l.id, l);
      if (s.parts.size > 4) s.parts.delete(s.parts.keys().next().value);
      s.ts = Math.max(s.ts, l.ts);
      s.spoke = Math.max(s.spoke || 0, l.ts);
      l.slotted = true;
    }
    for (const [cid, l] of this.live) {
      if (cid === S.cid || now - l.ts > 6000 || !l.text) continue;
      const s = this.slotFor(cid, l.name);
      if (!s) continue;
      if (s.live !== l.text) s.spoke = now;
      s.live = l.text;
      s.ts = Math.max(s.ts, l.ts);
    }
    for (const s of this.slots) {
      const lv = this.live.get(s.cid);
      if (!lv || now - lv.ts > 6000) s.live = '';
      // Finished words: the last few sentences, kept short so the bubble stays two or three lines.
      // A line waiting for its translation is not shown in the speaker's language (no flash of foreign words);
      // the bubble shows "…" until the translation arrives (or the original, if none comes within ~3 s).
      let done = [...s.parts.values()].filter((l) => !l.pending).map((l) => l.text).join(' ');
      if (done.length > 260) done = '…' + done.slice(done.length - 260).replace(/^\S*\s/, '');
      const waiting = [...s.parts.values()].some((l) => l.pending);
      const live = s.live ? (done ? ' ' : '') + s.live : waiting ? (done ? ' ' : '') + '…' : '';
      if (s.done.data !== done) { s.done.data = done; s.changed = now; }
      if (s.now.data !== live) s.now.data = live;
      // Words start at the top; once they fill two lines the newest line stays at the bottom (like a teleprompter).
      const body = s.done.parentNode.parentNode.parentNode;
      const full = body.firstChild.offsetHeight > body.clientHeight + 1;
      if (body.classList.contains('full') !== full) body.classList.toggle('full', full);
      const last = [...s.parts.values()].pop();
      // One clean line in your language: the original is not repeated under the translation.
      const orig = '';
      if (s.orig.textContent !== orig) s.orig.textContent = orig;
      const pending = !!(last && last.pending);
      const typing = (s.live === '…' || waiting) && !done;
      if (s.el.classList.contains('typing') !== typing) s.el.classList.toggle('typing', typing);
      if (s.el.classList.contains('pending') !== pending) s.el.classList.toggle('pending', pending);
      // Fade out after 14 s of silence; fade back in place when they speak again (no rebuild, no jump).
      const show = (done || live || pending) && now - s.ts < 14000;
      if (s.shown !== !!show) {
        s.shown = !!show;
        s.el.classList.toggle('out', !show);
        if (show) this.dress(s);
      }
    }
    box.hidden = !S.ccOn || !this.slots.some((s) => s.shown);
  },
};
// Caption colours: bright, readable on dark, never red. Same person, same colour, all class.
const CAP_COLORS = ['#a46bff', '#3fa3ff', '#2fc46b', '#ff9f2e', '#ff5fb0', '#22c3c3', '#e2c227', '#8c9eff'];
const capColor = (cid, name) => CAP_COLORS[[...String(name || cid)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % CAP_COLORS.length];
setInterval(() => CC.render(), 1000);

// On-device translation (Chrome/Edge desktop) when the server didn't translate a line within 2.5 s.
const Local = {
  cache: new Map(),
  async translate(m, cc) {
    await sleep(2500);
    const line = cc.lines.find((l) => l.id === m.id) || cc.history.find((l) => l.id === m.id);
    if (!line || line.translated || !('Translator' in self)) {
      if (line) line.pending = false;
      return cc.render();
    }
    try {
      const pair = { sourceLanguage: m.lang.split('-')[0], targetLanguage: cc.showLang().split('-')[0] };
      const key = pair.sourceLanguage + '>' + pair.targetLanguage;
      if (!this.cache.has(key)) this.cache.set(key, self.Translator.create(pair));
      const tr = await (await this.cache.get(key)).translate(m.text);
      Object.assign(line, { original: line.text, text: tr, translated: true, pending: false });
      Voice.say(tr, cc.showLang(), m.cid);
    } catch (e) {
      line.pending = false;
    }
    cc.render();
  },
};

// Spoken translation: read translated lines aloud in the listener's language and turn the speaker down.
const Voice = {
  queue: 0,
  endAt: 0,
  // True while a translation is being read aloud here, and for a moment after (room echo, recogniser lag).
  speaking() { return this.queue > 0 || ('speechSynthesis' in window && speechSynthesis.speaking) || Date.now() - this.endAt < 700; },
  on() {
    // Only with a translation language chosen ("Original language" has nothing to read aloud).
    return S.ccOn && CC.prefs.voice && !!CC.prefs.show && 'speechSynthesis' in window;
  },
  // Throw away whatever the browser recogniser has half-heard (it may contain the translated voice); it restarts itself.
  flushRecog() {
    try { S.recog && S.recog.abort(); } catch (e) { /* ignore */ }
  },
  pick(lang) {
    const voices = speechSynthesis.getVoices();
    const exact = voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase());
    const base = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase()));
    const rank = (v) => (/(natural|neural|premium|enhanced|google|online)/i.test(v.name) ? 0 : 1);
    return [...exact, ...base].sort((a, b) => rank(a) - rank(b))[0] || null;
  },
  say(text, lang, cid) {
    if (!this.on() || cid === S.cid || !text) return;
    if (this.queue > 2) speechSynthesis.cancel(), (this.queue = 0); // fell behind: jump to the newest line
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const v = this.pick(lang);
    if (v) u.voice = v;
    u.rate = this.queue ? 1.2 : 1.05;
    if (!this.queue) this.flushRecog();
    this.queue++;
    duck(cid, true);
    u.onend = u.onerror = () => {
      this.queue = Math.max(0, this.queue - 1);
      this.endAt = Date.now();
      if (!this.queue) this.flushRecog();
      if (!this.queue) setTimeout(() => !this.queue && duck(cid, false), 1200);
    };
    speechSynthesis.speak(u);
  },
};
// Speaker volume while translations are read aloud: turned down while a translation plays, or fully muted for
// speakers of another language when "Hear only the translated voice" is on.
const speakerLang = new Map(); // cid -> language they speak (from their captions)
function origVolume(cid, ducked) {
  const mine = CC.showLang().split('-')[0];
  const theirs = String(speakerLang.get(cid) || '').split('-')[0];
  if (Voice.on() && CC.prefs.muteOrig && theirs && theirs !== mine) return 0;
  return ducked ? 0.15 : 1;
}
function duck(cid, on) {
  const el = audioEls.get(cid);
  if (el) el.volume = origVolume(cid, on);
}
function applyOrigVolume() {
  for (const [cid, el] of audioEls) el.volume = origVolume(cid, false);
}

// Phrase detector: cuts my microphone into phrases at natural pauses and sends each one for accurate recognition.
const Phraser = {
  ctx: null, node: null, active: false, frames: [], pre: [], speaking: false, silence: 0, len: 0, floor: 0.004, queue: Promise.resolve(), seq: 0,
  async start() {
    if (this.active || !S.mic) return;
    this.active = true;
    try {
      this.ctx = new AudioContext({ sampleRate: 16000 });
      const code = 'class P extends AudioWorkletProcessor{process(i){if(i[0]&&i[0][0])this.port.postMessage(i[0][0].slice(0));return true}}registerProcessor("p",P)';
      await this.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
      const src = this.ctx.createMediaStreamSource(new MediaStream([S.mic]));
      this.node = new AudioWorkletNode(this.ctx, 'p');
      let acc = [];
      this.node.port.onmessage = (e) => {
        acc.push(e.data);
        if (acc.length >= 3) { // ~24 ms frames
          const f = new Float32Array(acc.reduce((n, a) => n + a.length, 0));
          let o = 0;
          for (const a of acc) { f.set(a, o); o += a.length; }
          acc = [];
          this.frame(f);
        }
      };
      src.connect(this.node);
    } catch (e) {
      console.warn('phraser', e);
      this.active = false;
      CC.serverAsr = false;
    }
  },
  stop() {
    this.active = false;
    try { this.ctx && this.ctx.close(); } catch (e) { /* ignore */ }
    this.ctx = null;
    this.frames = [];
    this.speaking = false;
  },
  frame(f) {
    let sum = 0;
    for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
    const rms = Math.sqrt(sum / f.length);
    const ms = (f.length / 16000) * 1000;
    if (!S.micOn) rms > 0 && (this.speaking = false);
    // While the translated voice is playing on this computer, its sound must not be captioned as my speech.
    if (Voice.speaking()) { if (this.speaking) { this.frames = []; this.speaking = false; } return; }
    const voiced = S.micOn && rms > Math.max(0.012, this.floor * 3);
    if (!voiced) this.floor = this.floor * 0.98 + rms * 0.02;
    if (!this.speaking) {
      this.pre.push(f);
      if (this.pre.length > 12) this.pre.shift(); // ~300 ms pre-roll
      if (voiced) {
        this.speaking = true;
        this.frames = this.pre.slice();
        this.pre = [];
        this.len = 0;
        this.silence = 0;
      }
      return;
    }
    this.frames.push(f);
    this.len += ms;
    this.silence = voiced ? 0 : this.silence + ms;
    // End of phrase: a 650 ms pause, or a shorter pause once the phrase is long, or a hard cap.
    if (this.silence > 650 || (this.len > 9000 && this.silence > 220) || this.len > 15000) this.flush();
  },
  flush() {
    const frames = this.frames;
    this.frames = [];
    this.speaking = false;
    if (this.len - this.silence < 450) return; // a cough or a click
    const wav = toWav(frames);
    const seg = String(++this.seq);
    this.queue = this.queue.then(() => this.upload(wav, seg)); // in order, one at a time
  },
  async upload(wav, seg) {
    try {
      const r = await fetch(`${W}/asr?lang=${encodeURIComponent(CC.prefs.speak)}&seg=${seg}&cid=${encodeURIComponent(S.cid || '')}`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + C.token, 'Content-Type': 'audio/wav' }, body: wav,
      });
      if (r.status === 409 || r.status === 502 || r.status === 404) {
        CC.serverAsr = false; // fall back to the browser's own final lines
        this.stop();
      }
    } catch (e) { /* network blip: phrase lost, keep going */ }
  },
};
function toWav(frames) {
  const n = frames.reduce((a, f) => a + f.length, 0);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  let o = 44;
  for (const f of frames) for (let i = 0; i < f.length; i++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, f[i])) * 0x7fff, true);
  return buf;
}

// Browser recognizer: instant interim words (and final lines if the server recognizer is unavailable).
const Recog = {
  sync() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speaking = (S.ccOn || CC.need) && S.micOn;
    // Accurate server recognition while someone is reading captions.
    if (speaking && CC.serverAsr) Phraser.start();
    else Phraser.stop();
    const want = speaking && !!SR;
    if (want && !S.recog) {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = CC.prefs.speak;
      let last = 0;
      r.onresult = (ev) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const text = res[0].transcript.trim();
          if (!text) continue;
          const final = res.isFinal && !CC.serverAsr;
          // Never caption the translated voice coming out of this computer's own speakers.
          if (Voice.speaking()) continue;
          if (final || Date.now() - last > 350) {
            last = Date.now();
            // With server recognition on, the server sends the real words; the browser only signals "speaking…".
            // (Mixing two recognisers' words in one caption is what jumbled captions.)
            send({ t: 'caption', text: CC.serverAsr ? '…' : text, final, lang: CC.prefs.speak });
            if (S.ccOn && !res.isFinal) CC.onCaption({ cid: S.cid, name: ME.name, text, lang: CC.prefs.speak, final: false });
          }
        }
      };
      r.onend = () => {
        if (S.recog === r) setTimeout(() => { try { r.start(); } catch (e) { /* already running */ } }, 250);
      };
      r.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') {
          S.recog = null;
        }
      };
      S.recog = r;
      try { r.start(); } catch (e) { /* ignore */ }
    } else if ((!want || (S.recog && S.recog.lang !== CC.prefs.speak)) && S.recog) {
      const r = S.recog;
      S.recog = null;
      try { r.stop(); } catch (e) { /* ignore */ }
      if (want) Recog.sync();
    }
  },
};
const Captions = {
  show: (cid, name, text, final) => CC.onCaption({ cid, name, text, final, lang: CC.prefs.speak }),
  clear: () => CC.clear(),
  sync: () => Recog.sync(),
  render: () => CC.render(),
};

function toggleCaptions(on = !S.ccOn) {
  const firstTime = on && !lsGet('cc');
  S.ccOn = on;
  CC.save();
  applyOrigVolume(); // captions off: nobody stays muted for a translation that is no longer read
  if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
  Recog.sync();
  CC.render();
  renderBar();
  if (firstTime && !LangPicker.el) LangPicker.open('show');
}

// ------------------------------------------------------------------ language picker: one question, one list
// Main question: "Which language do you want the class in?" → captions and (optionally) voice in that language.
// The microphone language is auto-detected and shown as a single small line, for the rare case it's wrong.
const LangPicker = {
  open(mode = 'show') {
    this.mode = mode; // 'show' (the main question) or 'speak' (microphone language)
    this.q = '';
    this.sheet = h('div', { class: 'lm-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lm-sheet-title' });
    this.el = h('div', { class: 'lm-sheet-backdrop', onclick: (e) => e.target === this.el && this.close() }, this.sheet);
    this.el.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    document.body.append(this.el);
    this.render();
    setTimeout(() => { const i = this.sheet.querySelector('input[type=search]'); if (i) i.focus(); }, 40);
  },
  close() {
    if (this.el) this.el.remove();
    this.el = null;
  },
  pick(code) {
    if (this.mode === 'speak') {
      CC.prefs.speak = code;
      this.mode = 'show';
    } else {
      CC.prefs.show = code;
      if (code && 'Translator' in self) {
        // On-device translation packs (Chrome/Edge desktop) download after a click: start it now.
        self.Translator.create({ sourceLanguage: 'en', targetLanguage: code.split('-')[0] }).catch(() => {});
      }
    }
    if (!S.ccOn) S.ccOn = true;
    CC.save();
    applyOrigVolume();
    Recog.sync();
    renderBar();
    this.q = '';
    this.render();
  },
  groups(current) {
    const row = (l) => h('button', { class: 'lm-lang' + (l.code === current ? ' on' : ''), role: 'option', 'aria-selected': String(l.code === current), onclick: () => this.pick(l.code) },
      h('span', { class: 'flag', 'aria-hidden': 'true' }, l.flag || l.cc),
      h('span', { class: 'nm' }, h('span', { class: 'n1' }, l.name, h('span', { class: 'ct' }, l.country)), l.native !== l.name ? h('span', { class: 'n2' }, l.native) : ''),
      l.code === current ? h('span', { class: 'tick' }, icon('check')) : '');
    const out = [];
    if (!this.q) {
      const sug = suggested();
      if (sug.length) out.push(h('div', { class: 'grp' }, h('h5', {}, 'Suggested'), ...sug.map(row)));
    }
    const list = searchLangs(this.q);
    for (const r of REGIONS) {
      const items = list.filter((l) => l.region === r);
      if (items.length) out.push(h('div', { class: 'grp' }, h('h5', {}, r), ...items.map(row)));
    }
    if (!list.length) out.push(h('p', { class: 'empty' }, `Nothing matches “${this.q}”. Try the language in English, its own name, or a country.`));
    return out;
  },
  render() {
    const p = CC.prefs;
    const speakMode = this.mode === 'speak';
    const current = speakMode ? p.speak : p.show;
    const chosen = p.show ? findLang(p.show) : null;
    const chosenName = chosen ? chosen.name.replace(/ \(.*\)$/, '') : null;
    const listEl = h('div', { class: 'lm-lang-list', role: 'listbox', 'aria-label': speakMode ? 'Microphone language' : 'Class language', onkeydown: (e) => {
      const all = [...this.sheet.querySelectorAll('.lm-lang')];
      const i = all.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < all.length - 1) { e.preventDefault(); all[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? all[i - 1] : this.sheet.querySelector('input[type=search]')).focus(); }
    } });
    const fill = () => listEl.replaceChildren(
      !speakMode && !this.q ? h('button', { class: 'lm-lang same' + (!p.show ? ' on' : ''), onclick: () => this.pick('') },
        h('span', { class: 'flag' }, icon('cc')), h('span', { class: 'nm' }, h('span', { class: 'n1' }, 'Original language'), h('span', { class: 'n2' }, 'Captions exactly as spoken, no translation')),
        !p.show ? h('span', { class: 'tick' }, icon('check')) : '') : '',
      ...this.groups(current));
    fill();
    const input = h('input', { type: 'search', value: this.q, placeholder: 'Type a language or country — e.g. Thai, Brazil, Deutsch',
      'aria-label': 'Search languages and countries', autocomplete: 'off',
      oninput: (e) => { this.q = e.target.value; fill(); },
      onkeydown: (e) => {
        if (e.key === 'Enter') { const f = searchLangs(this.q)[0]; if (f) this.pick(f.code); }
        if (e.key === 'ArrowDown') { e.preventDefault(); const b = listEl.querySelector('.lm-lang'); if (b) b.focus(); }
      } });
    const toggle = (on, title, sub, fn, disabled) => h('button', { class: 'lm-bigtoggle' + (on ? ' on' : ''), 'aria-pressed': String(on), disabled, onclick: fn },
      h('span', { class: 'ic' }, icon(title.startsWith('Hear only') ? 'micOff' : title.startsWith('Hear') ? 'volume' : 'cc')),
      h('span', { class: 'tx' }, h('b', {}, title), h('small', {}, sub)),
      h('span', { class: 'state' }, on ? 'On' : 'Off'));
    this.sheet.replaceChildren(
      h('header', {},
        speakMode ? h('button', { class: 'lm-icon-btn', 'aria-label': 'Back', onclick: () => { this.mode = 'show'; this.q = ''; this.render(); } }, icon('back')) : '',
        h('h3', { id: 'lm-sheet-title' }, speakMode ? 'Which language do you speak?' : 'Which language do you want the class in?'),
        h('button', { class: 'lm-icon-btn', 'aria-label': 'Close', onclick: () => this.close() }, icon('x'))),
      speakMode
        ? h('p', { class: 'lm-sheet-hint' }, 'Used to turn your voice into captions for everyone else.')
        : h('p', { class: 'lm-sheet-hint' }, 'Pick your language and everything the teacher and classmates say is shown in it.'),
      h('div', { class: 'lm-search' }, icon('search'), input),
      listEl,
      speakMode ? '' : h('footer', {},
        h('div', { class: 'lm-toggles' },
          toggle(S.ccOn, chosenName ? `Captions in ${chosenName}` : 'Captions', 'Words appear on screen as people speak',
            () => { toggleCaptions(!S.ccOn); this.render(); }),
          toggle(S.ccOn && p.voice, chosenName ? `Hear the class in ${chosenName}` : 'Hear the class in my language',
            chosenName ? 'A voice reads the translation; the speaker is turned down' : 'Choose a language above first',
            () => { p.voice = !(S.ccOn && p.voice); if (p.voice && !S.ccOn) toggleCaptions(true); if (!p.voice) speechSynthesis.cancel(); CC.save(); applyOrigVolume(); this.render(); },
            !chosenName),
          S.ccOn && p.voice ? toggle(!!p.muteOrig, 'Hear only the translated voice',
            'Mutes speakers who use another language, so you only hear the translation. Speakers of your language stay on.',
            () => { p.muteOrig = !p.muteOrig; CC.save(); applyOrigVolume(); this.render(); }) : ''),
        h('div', { class: 'lm-sheet-foot' },
          h('button', { class: 'lm-link', onclick: () => { this.mode = 'speak'; this.q = ''; this.render(); } },
            icon('mic'), 'Your microphone: ', h('b', {}, langLabel(p.speak)), h('span', { class: 'chg' }, 'Change')),
          h('button', { class: 'lm-primary', onclick: () => this.close() }, 'Done'))),
    );
  },
};
function langLabel(code) {
  const l = findLang(code);
  return l ? `${l.flag} ${l.name}${LANGUAGES.filter((x) => x.name === l.name).length > 1 ? ' (' + l.country + ')' : ''}` : code;
}

// ------------------------------------------------------------------ flying emojis
function flyEmoji(e, name) {
  const layer = $('#lm-emoji-layer');
  const el = h('div', { class: 'lm-fly', style: `left:${8 + Math.random() * 80}%;--drift:${Math.round(Math.random() * 80 - 40)}px` }, h('span', { class: 'e' }, e), h('span', { class: 'n' }, name));
  layer.append(el);
  setTimeout(() => el.remove(), 7200);
}

// ------------------------------------------------------------------ recording (composited in the moderator's browser, streamed to R2)
const Recorder = {
  active: false, mr: null, key: null, uploadId: null, parts: [], buf: [], bufSize: 0, partNo: 1, queue: Promise.resolve(),
  started: 0, ac: null, dest: null, sources: new Map(), ticker: null, canvas: null,
  PART: 8 * 1024 * 1024,
  async toggle() {
    return this.active ? this.stop() : this.start();
  },
  addAudio(track) {
    if (!this.active || !track || this.sources.has(track.id)) return;
    try {
      const src = this.ac.createMediaStreamSource(new MediaStream([track]));
      src.connect(this.dest);
      this.sources.set(track.id, src);
    } catch (e) { /* ignore */ }
  },
  async rec(path, body, method = 'POST') {
    const r = await fetch(W + path, { method, headers: { Authorization: 'Bearer ' + C.token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Recording error');
    return j;
  },
  async start() {
    if (!window.MediaRecorder) return toast('Recording is not supported in this browser.');
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return toast('Recording is not supported in this browser.');
    try {
      const j = await this.rec('/rec/create', { mime });
      Object.assign(this, { key: j.key, uploadId: j.uploadId, parts: [], buf: [], bufSize: 0, partNo: 1, queue: Promise.resolve(), started: Date.now() });
    } catch (e) {
      return toast('⚠️ ' + e.message);
    }
    this.canvas = h('canvas', { width: 1280, height: 720 });
    const ctx = this.canvas.getContext('2d');
    this.ac = new AudioContext();
    this.dest = this.ac.createMediaStreamDestination();
    this.sources = new Map();
    this.active = true;
    if (S.mic) this.addAudio(S.mic);
    for (const p of S.pulls.values()) if (p.kind === 'audio') this.addAudio(p.track);
    const stream = new MediaStream([...this.canvas.captureStream(15).getVideoTracks(), ...this.dest.stream.getAudioTracks()]);
    this.mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1200000, audioBitsPerSecond: 64000 });
    this.mr.ondataavailable = (e) => {
      if (e.data && e.data.size) {
        this.buf.push(e.data);
        this.bufSize += e.data.size;
        this.flush(false);
      }
    };
    this.mr.start(3000);
    // Worker-driven timer keeps drawing even when the tab is in the background.
    const blob = new Blob(['setInterval(()=>postMessage(0),66)'], { type: 'text/javascript' });
    this.ticker = new Worker(URL.createObjectURL(blob));
    this.ticker.onmessage = () => {
      try { this.draw(ctx); } catch (e) { if (!this.drawErr) { this.drawErr = true; console.error('recording frame', e); } }
    };
    send({ t: 'rec', on: true });
    renderBar();
    window.addEventListener('beforeunload', this.warn);
  },
  warn(e) {
    e.preventDefault();
    e.returnValue = '';
  },
  draw(ctx) {
    const W2 = 1280;
    const H2 = 720;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W2, H2);
    const stageEl = $('#lm-stage-content');
    const stageVisible = stageEl && !stageEl.hidden;
    const tiles = [...document.querySelectorAll(stageVisible ? '#lm-strip .lm-tile' : '#lm-grid .lm-tile')];
    const fit = (src, sw, sh, x, y, w, hh, cover) => {
      if (!sw || !sh) return;
      const r = cover ? Math.max(w / sw, hh / sh) : Math.min(w / sw, hh / sh);
      const dw = sw * r;
      const dh = sh * r;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, hh);
      ctx.clip();
      ctx.drawImage(src, x + (w - dw) / 2, y + (hh - dh) / 2, dw, dh);
      ctx.restore();
    };
    const drawTile = (t, x, y, w, hh) => {
      const v = t.querySelector('video');
      const nmEl = t.querySelector('.lm-label .nm');
      const name = (nmEl ? nmEl.textContent : t.querySelector('.lm-label').textContent).replace(/ \(you\)$/, '');
      const teacher = !!t.querySelector('.lm-label .role');
      ctx.fillStyle = '#18241f';
      ctx.fillRect(x, y, w, hh);
      if (!t.classList.contains('novideo') && v && v.videoWidth) fit(v, v.videoWidth, v.videoHeight, x, y, w, hh, !t.classList.contains('screen'));
      else {
        // No camera: the profile picture in a circle (or initials), like the live tile.
        const d = Math.round(Math.min(w, hh) * 0.42);
        const cx = x + w / 2;
        const cy = y + hh / 2 - 10;
        const img = t.querySelector('.lm-avatar img');
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
        ctx.clip();
        if (img && img.complete && img.naturalWidth) ctx.drawImage(img, cx - d / 2, cy - d / 2, d, d);
        else {
          ctx.fillStyle = tone(name);
          ctx.fillRect(cx - d / 2, cy - d / 2, d, d);
          ctx.fillStyle = '#fff';
          ctx.font = `600 ${Math.round(d / 2.6)}px 'Instrument Sans', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(initials(name), cx, cy + 1);
          ctx.textBaseline = 'alphabetic';
        }
        ctx.restore();
      }
      const label = name.slice(0, 40) + (teacher ? '  ·  Teacher' : '');
      ctx.font = `500 15px 'Instrument Sans', sans-serif`;
      const lw = Math.min(w - 16, ctx.measureText(label).width + 20);
      ctx.fillStyle = 'rgba(10,16,14,.72)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x + 8, y + hh - 34, lw, 26, 8); else ctx.rect(x + 8, y + hh - 34, lw, 26);
      ctx.fill();
      ctx.fillStyle = '#ecefe4';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 18, y + hh - 16, w - 36);
    };
    const slide = stageVisible && stageEl.querySelector('canvas.lm-slide, img.lm-slide');
    const board = stageVisible && stageEl.querySelector('canvas.lm-board');
    const vid = stageVisible && stageEl.querySelector('.lm-tile');
    if (stageVisible && (slide || board || vid)) {
      const sw = tiles.length ? 1000 : W2;
      if (slide || board) {
        ctx.fillStyle = '#fff';
        const ref = slide || board;
        const rw = ref.width || ref.naturalWidth;
        const rh = ref.height || ref.naturalHeight;
        const r = Math.min(sw / rw, H2 / rh);
        const x = (sw - rw * r) / 2;
        const y = (H2 - rh * r) / 2;
        ctx.fillRect(x, y, rw * r, rh * r);
        if (slide) ctx.drawImage(slide, x, y, rw * r, rh * r);
        if (board) ctx.drawImage(board, x, y, rw * r, rh * r);
      } else if (vid) drawTile(vid, 0, 0, sw, H2);
      tiles.slice(0, 4).forEach((t, i) => drawTile(t, 1000, i * 180, 280, 180));
    } else {
      // Gallery, or a stage with nothing on it yet: show everyone rather than an empty frame.
      if (!tiles.length && stageVisible) tiles.push(...document.querySelectorAll('#lm-strip .lm-tile'));
      const n = Math.min(tiles.length, 16);
      const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
      const rows = Math.max(1, Math.ceil(n / cols));
      const w = W2 / cols;
      const hh = H2 / rows;
      tiles.slice(0, 16).forEach((t, i) => drawTile(t, (i % cols) * w + 2, Math.floor(i / cols) * hh + 2, w - 4, hh - 4));
    }
    const cap = $('#lm-captions');
    if (cap && !cap.hidden && cap.textContent) {
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      ctx.fillRect(140, H2 - 90, 1000, 60);
      ctx.fillStyle = '#fff';
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cap.lastChild.textContent.slice(-90), W2 / 2, H2 - 52);
    }
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(24, 24, 8, 0, Math.PI * 2);
    ctx.fill();
  },
  flush(final) {
    // R2 multipart: every part except the last must be the same size.
    while (this.bufSize >= this.PART || (final && this.bufSize > 0)) {
      const blob = new Blob(this.buf);
      const size = Math.min(this.PART, blob.size);
      const part = blob.slice(0, size);
      const rest = blob.slice(size);
      this.buf = rest.size ? [rest] : [];
      this.bufSize = rest.size;
      const n = this.partNo++;
      this.queue = this.queue.then(() => this.uploadPart(n, part));
    }
  },
  async uploadPart(n, blob) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const r = await fetch(`${W}/rec/part?key=${encodeURIComponent(this.key)}&uploadId=${encodeURIComponent(this.uploadId)}&n=${n}`, {
          method: 'PUT', headers: { Authorization: 'Bearer ' + C.token }, body: blob,
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        this.parts.push(await r.json());
        return;
      } catch (e) {
        await sleep(1000 * attempt);
      }
    }
    toast('⚠️ Part of the recording failed to upload.');
  },
  async stop() {
    if (!this.active) return;
    this.active = false;
    renderBar();
    send({ t: 'rec', on: false });
    toast('Saving recording…');
    await new Promise((res) => {
      this.mr.onstop = res;
      this.mr.stop();
    });
    this.ticker.terminate();
    this.flush(true);
    await this.queue;
    window.removeEventListener('beforeunload', this.warn);
    if (!this.parts.length) {
      this.rec('/rec/abort', { key: this.key, uploadId: this.uploadId }).catch(() => {});
      this.ac.close().catch(() => {});
      return toast('⚠️ Nothing was recorded, so there is nothing to save.', 8000);
    }
    try {
      this.parts.sort((a, b) => a.partNumber - b.partNumber);
      await this.rec('/rec/complete', { key: this.key, uploadId: this.uploadId, parts: this.parts, seconds: (Date.now() - this.started) / 1000, started: this.started / 1000 });
      toast('✅ Recording saved. Students will be emailed a link.', 6000);
    } catch (e) {
      toast('⚠️ Recording could not be saved: ' + e.message, 8000);
    }
    this.ac.close().catch(() => {});
  },
};

// ------------------------------------------------------------------ stats / bandwidth meter
function startStats() {
  if (S.statsOn) return;
  S.statsOn = true;
  let lastReport = 0;
  setInterval(async () => {
    if (!S.pc) return;
    let rx = 0;
    let tx = 0;
    let lost = 0;
    let recv = 0;
    const st = await S.pc.getStats();
    st.forEach((r) => {
      if (r.type === 'transport') {
        rx += r.bytesReceived || 0;
        tx += r.bytesSent || 0;
      }
      if (r.type === 'inbound-rtp' && r.kind === 'video') {
        lost += r.packetsLost || 0;
        recv += r.packetsReceived || 0;
      }
    });
    if (!rx && !tx) {
      st.forEach((r) => {
        if (r.type === 'candidate-pair' && r.nominated) {
          rx += r.bytesReceived || 0;
          tx += r.bytesSent || 0;
        }
      });
    }
    const now = Date.now();
    if (S.stats.last) {
      const dt = (now - S.stats.last.t) / 1000;
      S.stats.rxRate = Math.max(0, ((rx - S.stats.last.rx) * 8) / 1000 / dt);
      S.stats.txRate = Math.max(0, ((tx - S.stats.last.tx) * 8) / 1000 / dt);
    }
    // Poor connection? Suggest data saver once.
    if (S.stats.last && recv - S.stats.last.recv > 200) {
      const lossRate = (lost - S.stats.last.lost) / Math.max(1, recv - S.stats.last.recv + lost - S.stats.last.lost);
      if (lossRate > 0.08 && !S.dataSaver && !S.suggestedSaver) {
        S.suggestedSaver = true;
        overlayAction('Weak connection', 'Turn on Data saver? You will still hear everyone and see slides and screen shares.', 'Turn on Data saver', () => { overlay(null); setDataSaver(true); }, true);
      }
    }
    S.stats.last = { t: now, rx, tx, lost, recv };
    S.stats.rx = rx;
    S.stats.tx = tx;
    renderTop();
    if (now - lastReport > 30000) {
      lastReport = now;
      send({ t: 'stats', rx, tx, ds: S.dataSaver });
    }
  }, 4000);
}

// Tab hidden for more than 5 seconds: cameras drop to their smallest layer (they keep playing, so there is no
// stall when you come back). Visible again: straight back to full quality.
document.addEventListener('visibilitychange', () => {
  clearTimeout(S.hiddenTimer);
  if (document.hidden) {
    S.hiddenTimer = setTimeout(() => {
      S.hidden = true;
      reconcile();
    }, 5000);
  } else if (S.hidden) {
    S.hidden = false;
    reconcile();
  }
});

// ------------------------------------------------------------------ overlays, join screen, leave
function overlay(title, text, final) {
  const o = $('#lm-overlay');
  if (!title) {
    o.hidden = true;
    return;
  }
  o.hidden = false;
  o.replaceChildren(h('div', { class: 'lm-card' }, h('h2', {}, title), h('p', {}, text),
    final ? h('a', { class: 'lm-primary lm-linkbtn', href: C.returnUrl }, 'Back to course') : h('div', { class: 'lm-spinner' })));
}
function overlayAction(title, text, label, fn, dismissable) {
  const o = $('#lm-overlay');
  o.hidden = false;
  o.replaceChildren(h('div', { class: 'lm-card' }, h('h2', {}, title), h('p', {}, text),
    h('div', { class: 'row' }, h('button', { class: 'lm-primary', onclick: fn }, label), dismissable ? h('button', { onclick: () => overlay(null) }, 'Not now') : '')));
}

function cleanup() {
  try {
    if (Recorder.active) Recorder.stop();
    [S.mic, S.cam, S.camRaw, S.screen].forEach((t) => t && t.stop());
    Blur.stop();
    Smooth.stop();
    Look.stop();
    if (S.recog) {
      const r = S.recog;
      S.recog = null;
      r.stop();
    }
    if (S.pc) S.pc.close();
  } catch (e) { /* ignore */ }
}

async function leave() {
  if (Recorder.active) await Recorder.stop();
  S.left = true;
  send({ t: 'stats', rx: S.stats.rx, tx: S.stats.tx });
  await sleep(150);
  try { S.ws.close(1000); } catch (e) { /* ignore */ }
  cleanup();
  location.href = C.returnUrl;
}

function shell() {
  document.body.className = 'lm';
  $('#aivirtualclassroom-app').replaceChildren(
    h('header', { id: 'lm-top' }),
    h('div', { id: 'lm-body' },
      h('main', { id: 'lm-stage' },
        h('div', { id: 'lm-stage-tools', class: 'lm-stage-tools' }),
        h('div', { id: 'lm-grid' }),
        h('div', { id: 'lm-stage-content', hidden: true }),
        h('div', { id: 'lm-strip', hidden: true }),
        h('div', { id: 'lm-captions', hidden: true, 'aria-live': 'polite' }),
        h('div', { id: 'lm-emoji-layer' })),
      h('aside', { id: 'lm-side' })),
    h('footer', { id: 'lm-bar' }),
    h('div', { id: 'lm-audio', hidden: true }),
    h('div', { id: 'lm-toasts', 'aria-live': 'polite' }),
    h('div', { id: 'lm-overlay', hidden: true }),
  );
}

async function prejoin() {
  shell();
  const o = $('#lm-overlay');
  o.hidden = false;
  o.classList.add('join');
  const video = h('video', { autoplay: true, playsinline: true, muted: true, class: 'mirror' });
  let preview = null;
  const camOk = ME.mod ? C.videoPolicy !== 'none' : C.videoPolicy === 'all';
  if (!camOk) S.camOn = false;
  let fxTrack = null;
  // Show the camera with the same effects (studio look, smooth skin, background) the class will see.
  async function applyFx() {
    Blur.stop();
    Smooth.stop();
    Look.stop();
    if (fxTrack && preview && fxTrack !== preview.getVideoTracks()[0]) fxTrack.stop();
    fxTrack = null;
    if (!preview) return;
    const raw = preview.getVideoTracks()[0];
    fxTrack = await buildCam(raw);
    video.srcObject = new MediaStream([fxTrack]);
  }
  S.onFx = async () => { await applyFx(); draw(); };
  // Safe path after an effects failure: show the plain camera straight away.
  S.onFxRaw = () => { if (preview) { fxTrack = null; video.srcObject = preview; } };
  async function showPreview() {
    Blur.stop();
    Smooth.stop();
    Look.stop();
    if (preview) preview.getTracks().forEach((t) => t.stop());
    preview = null;
    video.srcObject = null;
    if (S.camOn) {
      try {
        preview = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        video.srcObject = preview;
        await applyFx();
      } catch (e) { toast('Camera blocked: ' + e.message); }
    }
    draw();
  }
  const draw = () => {
    const ccLang = findLang(CC.prefs.show);
    o.replaceChildren(h('div', { class: 'lm-card join' },
      h('div', { class: 'lm-preview' + (S.camOn ? '' : ' off') },
        video,
        S.camOn ? '' : h('div', { class: 'lm-preview-off' }, realPic(ME.pic) ? h('img', { class: 'av', src: ME.pic, alt: '', style: 'object-fit:cover' }) : h('span', { class: 'av', style: `background:${tone(ME.name)}` }, initials(ME.name)), h('span', {}, camOk ? 'Camera is off' : 'Cameras are off in this class')),
        h('div', { class: 'lm-preview-ctl' },
          h('button', { class: 'lm-round' + (S.micOn ? '' : ' off'), 'aria-pressed': String(!S.micOn), title: S.micOn ? 'Turn microphone off' : 'Turn microphone on', onclick: () => { S.micOn = !S.micOn; lsSet('mic', S.micOn ? '1' : '0'); draw(); } }, icon(S.micOn ? 'mic' : 'micOff')),
          h('button', { class: 'lm-round' + (S.camOn ? '' : ' off'), disabled: !camOk, title: camOk ? (S.camOn ? 'Turn camera off' : 'Turn camera on') : 'Cameras are off in this class', onclick: async () => { S.camOn = !S.camOn; lsSet('cam', S.camOn ? '1' : '0'); await showPreview(); } }, icon(S.camOn ? 'cam' : 'camOff'))),
        h('div', { class: 'lm-preview-name' }, lsGet('dname') || ME.name,
          h('button', { class: 'lm-preview-edit', title: 'Change the name others see', 'aria-label': 'Change the name others see', onclick: (e) => {
            const v = window.prompt('Your name as others see it in this class (leave empty to use your Moodle name):', lsGet('dname') || ME.name);
            if (v === null) return;
            lsSet('dname', v.replace(/\s+/g, ' ').trim().slice(0, 60));
            e.currentTarget.parentNode.firstChild.textContent = lsGet('dname') || ME.name;
          } }, icon('pen')))),
      h('div', { class: 'lm-join-side' },
        C.course ? h('div', { class: 'lm-join-course' }, C.course) : '',
        h('h1', {}, C.title),
        h('p', { class: 'lm-join-lede' }, 'Check how you look and sound, then join the class.'),
        h('div', { class: 'lm-join-opts' },
          h('button', { class: 'lm-opt', onclick: () => { LangPicker.open('show'); const watch = setInterval(() => { if (!LangPicker.el) { clearInterval(watch); draw(); } }, 300); } },
            h('span', { class: 'ic' }, icon('cc')),
            h('span', { class: 'tx' }, h('b', {}, 'Captions and language'), h('small', {}, ccLang ? `${ccLang.flag} ${ccLang.name}${CC.prefs.voice ? ', spoken aloud' : ''}` : (S.ccOn ? 'On, original language' : 'Off'))),
            h('span', { class: 'go' }, icon('next'))),
          h('label', { class: 'lm-opt' },
            h('span', { class: 'ic' }, icon('feather')),
            h('span', { class: 'tx' }, h('b', {}, 'Data saver'), h('small', {}, 'Hear everyone and see slides, without camera video')),
            h('input', { type: 'checkbox', checked: S.dataSaver, onchange: (e) => { S.dataSaver = e.target.checked; lsSet('ds', e.target.checked ? '1' : '0'); } }), h('span', { class: 'sw' })),
          C.avatarUrl ? h('button', { class: 'lm-opt', onclick: () => Avatar.open(video, draw) },
            h('span', { class: 'ic av' }, Avatar.face(30)),
            h('span', { class: 'tx' }, h('b', {}, 'Your picture in class'), h('small', {}, C.customPic ? 'Shown on your tile and next to your captions' : 'Add a photo or a fun avatar for your tile and captions')),
            h('span', { class: 'go' }, icon('next'))) : '',
          camOk ? h('button', { class: 'lm-opt', onclick: () => Backgrounds.open() },
            h('span', { class: 'ic' }, icon('blur')),
            h('span', { class: 'tx' }, h('b', {}, 'Background'), h('small', {}, bgLabel())),
            h('span', { class: 'go' }, icon('next'))) : '',
          camOk ? h('label', { class: 'lm-opt' },
            h('span', { class: 'ic' }, icon('sun')),
            h('span', { class: 'tx' }, h('b', {}, 'Studio look'), h('small', {}, 'A brighter picture and a slight zoom')),
            h('input', { type: 'checkbox', checked: S.look, onchange: (e) => setLook(e.target.checked) }), h('span', { class: 'sw' })) : '',
          camOk ? h('label', { class: 'lm-opt' },
            h('span', { class: 'ic' }, icon('sparkles')),
            h('span', { class: 'tx' }, h('b', {}, 'Smooth skin'), h('small', {}, 'A gentle touch-up of your camera')),
            h('input', { type: 'checkbox', checked: S.smooth, onchange: (e) => setSmooth(e.target.checked) }), h('span', { class: 'sw' })) : ''),
        !camOk ? h('p', { class: 'lm-join-note' }, C.videoPolicy === 'none' ? 'This class is audio-only to keep it fast for everyone.' : 'Student cameras are off in this class to keep it fast for everyone. Your teacher can turn them on.') : '',
        h('button', { class: 'lm-primary big', onclick: async () => {
          S.onFx = null;
          S.onFxRaw = null;
          Blur.stop();
          Smooth.stop();
          Look.stop();
          if (fxTrack) fxTrack.stop();
          if (preview) preview.getTracks().forEach((t) => t.stop());
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          await audioCtx.resume().catch(() => {});
          o.classList.remove('join');
          overlay('Joining…', 'Connecting to the classroom.', false);
          connect();
        } }, 'Join now'),
        h('a', { href: C.returnUrl, class: 'lm-back' }, 'Back to course'))));
  };
  await showPreview();
}

// Read-only handle for diagnostics in browser devtools.
Object.defineProperty(window, '__aivirtualclassroom', { get: () => S });
prejoin();
