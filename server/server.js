'use strict';
// =====================================================================
//  売倍アイランド マルチプレイ用サーバー（baibai-island-server）
//  ・PeerJS の接続の仲介（/island）…… つなぐ時の最初だけ使う。遊んでいる間の通信は、プレイヤーどうしが直接やりとりする（サーバーを通らないので、ラグは増えない）
//  ・部屋の番号の割り当て・公開ルームの一覧・部屋番号からの検索（回数制限つき）
//  ・部屋の中身（島・持ち物など）は、サーバーには保存しない
// =====================================================================
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { ExpressPeerServer } = require('peer');

const PORT = Number(process.env.PORT) || 10000;
// ゲームを置いている場所（ここから来た通信だけ受け付ける）。ほかにも足したい時は、Render の環境変数 ALLOW_ORIGINS に「,」区切りで書く
const ORIGINS = String(process.env.ALLOW_ORIGINS || 'https://h1ro223.github.io').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
// 自分のパソコンで試す時（VS Code の Live Server・ファイルを直接開いた時）も使えるようにする
const LOCAL_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const okOrigin = o => !o || o === 'null' || ORIGINS.includes(o) || LOCAL_RE.test(o);

const ROOM_TTL = 35 * 1000;        // ホストからの生存信号（10秒ごと）が35秒とどかない部屋は消す
const ROOM_OFF_TTL = 120 * 1000;   // ホストが接続用サーバーから2分はなれたままの部屋も消す
const MAX_ROOMS = 1000;
const FIND_MISS_MAX = 10;          // 1分間に10回、存在しない番号を調べた人は……
const FIND_LOCK_MS = 60 * 1000;    // ……1分間、検索できなくする（4桁の番号の総当たり対策）
const FIND_MAX = 60;               // 1分間に調べられる回数（見つかった時もふくむ）
const OPEN_MAX = 20;               // 10分間に作れる部屋の数（1人あたり）

const app = express();
app.set('trust proxy', true);      // Render の中継を通るので、相手のIPは X-Forwarded-For から取る
app.disable('x-powered-by');

// ---- CORS（ゲームのページから読めるようにする） ----
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && okOrigin(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Max-Age', '600'); }
  if (req.method === 'OPTIONS') { res.status(o && !okOrigin(o) ? 403 : 204).end(); return; }
  next();
});
const guard = (req, res, next) => { const o = req.headers.origin; if (o && !okOrigin(o)) { res.status(403).json({ ok: false, why: 'origin' }); return; } next(); };

// ---- 起きているかの確認（ゲームが起こす時・Render のヘルスチェック） ----
app.get('/', (req, res) => res.type('text/plain').send('baibai-island-server OK'));
app.get(['/health', '/island/health'], (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.type('text/plain').send('ok'); });

// ---- 部屋 ----
const rooms = new Map();           // 部屋番号 → { room, peer, key, ip, at, beat, info, lc, offAt }
const peersOn = new Set();         // 接続用サーバーにつながっているホスト（PeerJS の ID）
const now = () => Date.now();
const ipOf = req => String(req.ip || (req.socket && req.socket.remoteAddress) || '?');
const rnd = n => crypto.randomBytes(n).toString('hex');
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const int = (v, lo, hi) => { const x = Math.floor(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo; };
const visible = r => !!(r.lc || peersOn.has(r.peer));
function body(req) { try { const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); return b && typeof b === 'object' ? b : {}; } catch (e) { return {}; } }
const txt = express.text({ type: '*/*', limit: '4kb' });   // ゲームは text/plain で送る（ブラウザの事前確認を減らすため・sendBeacon でも送れるように）

// 部屋の情報は、決まった項目・決まった長さだけ受け取る
function cleanInfo(i) {
  i = i && typeof i === 'object' ? i : {};
  return {
    host: clean(i.host, 8) || 'ホスト', n: int(i.n, 0, 6), max: int(i.max, 1, 6), st: i.st === 'play' ? 'play' : 'lobby', day: int(i.day, 0, 999),
    pub: i.pub ? 1 : 0, join: i.join === 'ask' ? 'ask' : 'free', mid: i.mid ? 1 : 0, ver: clean(i.ver, 24), mode: clean(i.mode, 140),
    rh: Array.isArray(i.rh) ? i.rh.slice(0, 6).map(x => String(x).replace(/[^a-z0-9]/g, '').slice(0, 8)).filter(Boolean) : [],
  };
}
function newRoomNo() {
  for (let k = 0; k < 60; k++) { const r = String(1000 + crypto.randomInt(9000)); if (!rooms.has(r)) return r; }
  for (let n = 1000; n < 10000; n++) if (!rooms.has(String(n))) return String(n);
  return null;
}
// 回数制限（1人ずつ）
const hits = new Map();   // ip → { open: [時刻], find: [時刻], miss: [時刻], lock: 時刻 }
const hitOf = ip => { let h = hits.get(ip); if (!h) { h = { open: [], find: [], miss: [], lock: 0 }; hits.set(ip, h); } return h; };
const keep = (a, ms) => { const t = now() - ms; while (a.length && a[0] < t) a.shift(); return a; };

// 部屋を作る：番号と接続ID・合言葉（key）を割り当てる
app.post('/island/rooms/open', guard, txt, (req, res) => {
  const b = body(req), ip = ipOf(req), hx = hitOf(ip);
  if (keep(hx.open, 10 * 60 * 1000).length >= OPEN_MAX) { res.status(429).json({ ok: false, why: 'many' }); return; }
  if (rooms.size >= MAX_ROOMS) { res.status(503).json({ ok: false, why: 'busy' }); return; }
  const room = newRoomNo(); if (!room) { res.status(503).json({ ok: false, why: 'busy' }); return; }
  hx.open.push(now());
  const r = { room, peer: `bbi-${room}-${rnd(6)}`, key: rnd(12), ip, at: now(), beat: now(), info: cleanInfo(b.info), lc: b.lc ? 1 : 0, offAt: 0 };
  rooms.set(room, r);
  res.json({ ok: true, room, peer: r.peer, key: r.key });
});
// ホストの生存信号（10秒ごと・人数や設定が変わった時）。サーバーが再起動して部屋が消えていた時は、同じ番号で作り直す
app.post('/island/rooms/beat', guard, txt, (req, res) => {
  const b = body(req), room = clean(b.room, 4), key = clean(b.key, 40), peer = clean(b.peer, 40);
  let r = rooms.get(room);
  if (r && r.key !== key) { res.status(409).json({ ok: false, why: 'taken' }); return; }
  if (!r) {
    if (!/^[0-9]{4}$/.test(room) || !/^[0-9a-f]{24}$/.test(key) || !/^bbi-[0-9]{4}-[0-9a-f]{12}$/.test(peer) || peer.slice(4, 8) !== room) { res.status(400).json({ ok: false, why: 'bad' }); return; }
    if (rooms.size >= MAX_ROOMS) { res.status(503).json({ ok: false, why: 'busy' }); return; }
    r = { room, peer, key, ip: ipOf(req), at: now(), beat: now(), info: cleanInfo(b.info), lc: b.lc ? 1 : 0, offAt: 0 }; rooms.set(room, r);
  }
  r.beat = now(); if (b.info) r.info = cleanInfo(b.info);
  res.json({ ok: true, on: visible(r) ? 1 : 0 });
});
// 部屋を閉じる（ホストが部屋を閉じた・ページを閉じた時。sendBeacon でも届く）
app.post('/island/rooms/close', guard, txt, (req, res) => {
  const b = body(req), r = rooms.get(clean(b.room, 4));
  if (r && r.key === clean(b.key, 40)) rooms.delete(r.room);
  res.json({ ok: true });
});
// 公開ルームの一覧（非公開の部屋は出さない）
app.get('/island/rooms', guard, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const t = now(), list = [];
  for (const r of rooms.values()) { if (!r.info.pub || !visible(r)) continue; list.push(Object.assign({ room: r.room, age: Math.round((t - r.at) / 1000) }, r.info)); }
  list.sort((a, b) => (a.st === b.st ? a.age - b.age : a.st === 'lobby' ? -1 : 1));
  res.json({ ok: true, now: t, rooms: list.slice(0, 100) });
});
// 部屋番号から、つなぐ先（接続ID）を調べる。公開・非公開どちらも。存在しない番号を何度も調べる人は、しばらく止める
app.get('/island/find', guard, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ip = ipOf(req), hx = hitOf(ip), t = now();
  if (hx.lock > t) { res.status(429).json({ ok: false, why: 'many', wait: Math.ceil((hx.lock - t) / 1000) }); return; }
  if (keep(hx.find, 60 * 1000).length >= FIND_MAX) { res.status(429).json({ ok: false, why: 'many', wait: 30 }); return; }
  hx.find.push(t);
  const room = clean(req.query.room, 4), r = /^[0-9]{4}$/.test(room) ? rooms.get(room) : null;
  if (!r) {
    hx.miss.push(t); if (keep(hx.miss, 60 * 1000).length >= FIND_MISS_MAX) { hx.lock = t + FIND_LOCK_MS; hx.miss.length = 0; }
    res.status(404).json({ ok: false, why: 'nf' }); return;
  }
  if (!visible(r)) { res.status(404).json({ ok: false, why: 'off' }); return; }   // ホストが接続用サーバーから一時的にはなれている（回数には数えない）
  res.json({ ok: true, room: r.room, peer: r.peer, info: r.info });
});

// ---- 古い部屋・回数の記録のそうじ ----
setInterval(() => {
  const t = now();
  for (const r of rooms.values()) {
    if (t - r.beat > ROOM_TTL) { rooms.delete(r.room); continue; }
    if (!r.lc && !peersOn.has(r.peer)) { if (!r.offAt) r.offAt = t; else if (t - r.offAt > ROOM_OFF_TTL) rooms.delete(r.room); } else r.offAt = 0;
  }
  for (const [ip, h] of hits) { keep(h.open, 10 * 60 * 1000); keep(h.find, 60 * 1000); keep(h.miss, 60 * 1000); if (!h.open.length && !h.find.length && !h.miss.length && h.lock < t) hits.delete(ip); }
}, 5000).unref();

// ---- PeerJS の接続の仲介（/island） ----
const server = http.createServer(app);
const peerServer = ExpressPeerServer(server, {
  path: '/', proxied: true, allow_discovery: false, alive_timeout: 90000,
  corsOptions: { origin: (o, cb) => cb(null, okOrigin(o)) },
});
peerServer.on('connection', c => { try { peersOn.add(c.getId()); } catch (e) { /* 何もしない */ } });
peerServer.on('disconnect', c => { try { peersOn.delete(c.getId()); } catch (e) { /* 何もしない */ } });
app.use('/island', peerServer);

app.use((req, res) => res.status(404).json({ ok: false, why: 'nf' }));
server.listen(PORT, () => console.log(`baibai-island-server: port ${PORT}`));
