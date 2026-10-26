'use strict';
/* ==================================================================
   DRIFT ISLE ～無人島脱出記～
   made by hiro/ヒロ  https://github.com/h1ro223
   ================================================================== */
(() => {
const VERSION = '1.0.0';
const TS = 16;            // タイルサイズ(px)
const DAY_LEN = 480;      // 1日の長さ(秒)
const SAVE_KEY = 'driftisle_save_v1_';
const OPT_KEY = 'driftisle_opt_v1';
const ACH_KEY = 'driftisle_ach_v1';

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const chance = p => Math.random() < p;
const pick = a => a[Math.floor(Math.random() * a.length)];
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DIRV = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]; // 上右下左

// ---------- palette ----------
const PAL = {
  '0': '#160f1c', '1': '#1d2b53', '2': '#7e2553', '3': '#1e6b3c', '4': '#ab5236', '5': '#5f574f', '6': '#c2c3c7', '7': '#fff1e8',
  '8': '#ff3355', '9': '#ffa300', 'a': '#ffec27', 'b': '#3fd64e', 'c': '#29adff', 'd': '#83769c', 'e': '#ff8fb4', 'f': '#ffccaa',
  'g': '#3b2a1e', 'h': '#6b4226', 'i': '#8f5a32', 'j': '#c98e4f', 'k': '#2d5a27', 'l': '#4a8f3a', 'm': '#7cc35a', 'n': '#3a3f4a',
  'o': '#6c7380', 'p': '#a0a8b4', 'q': '#e8d49a', 'r': '#c9b077', 's': '#1f6fb5', 't': '#5ec8e8', 'u': '#a33b3b', 'v': '#e7ad7e',
  'w': '#bf7f52', 'x': '#3a2418', 'y': '#f6e27a', 'z': '#c48ef0', 'A': '#7a48b8', 'B': '#c8d0d8', 'C': '#59616b', 'D': '#e8704a',
  'E': '#a63d26', 'F': '#7a5038', 'G': '#43291c', 'H': '#9aa14e', 'I': '#5d6b2a', 'J': '#ece2cc', 'K': '#a3a9b1', 'L': '#5c6169',
  'M': '#3f8f8a', 'N': '#3a3355', 'O': '#8a7f9a', 'P': '#ffe08a', 'Q': '#ff7a1a', 'R': '#f4f4f0', 'S': '#3d74b8', 'T': '#2a4f80',
  'U': '#d94a4a', 'V': '#2b8e9e', 'W': '#9fe0f4', 'X': '#4b3a2a', 'Y': '#d4a83a', 'Z': '#7a5a2a'
};
const colOf = c => PAL[c] || c;

// ---------- canvas helpers ----------
function mkC(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return c; }
const cx2 = c => { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return x; };
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function P(x, X, Y, c) { x.fillStyle = colOf(c); x.fillRect(X | 0, Y | 0, 1, 1); }
function R(x, X, Y, w, h, c) { x.fillStyle = colOf(c); x.fillRect(X | 0, Y | 0, w | 0, h | 0); }
function E(x, cx, cy, rx, ry, c) {
  x.fillStyle = colOf(c);
  for (let j = -ry; j <= ry; j++) { const t = 1 - (j * j) / ((ry + 0.5) * (ry + 0.5)); if (t < 0) continue; const hw = Math.floor(rx * Math.sqrt(t) + 0.5); x.fillRect(cx - hw, cy + j, hw * 2 + 1, 1); }
}
const inEl = (px, py, cx, cy, rx, ry) => ((px - cx) * (px - cx)) / ((rx + .5) * (rx + .5)) + ((py - cy) * (py - cy)) / ((ry + .5) * (ry + .5)) <= 1;
function outline(c, col) {
  const x = cx2(c), w = c.width, h = c.height; let d;
  try { d = x.getImageData(0, 0, w, h); } catch (e) { return c; }
  if (!d || !d.data || d.data.length < w * h * 4) return c;
  const s = d.data, a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = s[i * 4 + 3] > 40 ? 1 : 0;
  const [r, g, b] = hexRGB(col || '#160f1c');
  for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
    const i = y * w + X; if (a[i]) continue;
    if ((X > 0 && a[i - 1]) || (X < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) { const k = i * 4; s[k] = r; s[k + 1] = g; s[k + 2] = b; s[k + 3] = 255; }
  }
  x.putImageData(d, 0, 0); return c;
}
function fromMap(rows, sub, opt) {
  opt = opt || {};
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, m = opt.noOutline ? 0 : 1;
  const c = mkC(w + m * 2, h + m * 2), x = cx2(c);
  for (let j = 0; j < h; j++) { const r = rows[j]; for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch === '.' || ch === ' ') continue; const col = (sub && sub[ch]) || PAL[ch]; if (!col) continue; x.fillStyle = col; x.fillRect(i + m, j + m, 1, 1); } }
  if (!opt.noOutline) outline(c, opt.oc);
  return c;
}
function flipH(s) { const c = mkC(s.width, s.height), x = cx2(c); x.translate(s.width, 0); x.scale(-1, 1); x.drawImage(s, 0, 0); return c; }
function scaleC(s, k) { const c = mkC(s.width * k, s.height * k), x = cx2(c); x.drawImage(s, 0, 0, c.width, c.height); return c; }
function tintC(s, col, a) { const c = mkC(s.width, s.height), x = cx2(c); x.drawImage(s, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = a; x.fillStyle = colOf(col); x.fillRect(0, 0, c.width, c.height); return c; }
function whiteC(s) { return tintC(s, '#ffffff', 1); }
function fitIcon(s, size) { // 大きいスプライトをアイコン用に縮小（整数倍で）
  size = size || 16; const k = Math.max(s.width, s.height) > size ? size / Math.max(s.width, s.height) : 1;
  const c = mkC(size, size), x = cx2(c); const w = Math.round(s.width * k), h = Math.round(s.height * k);
  x.drawImage(s, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h); return c;
}

// ---------- sprite store ----------
const SPR = {};      // name -> canvas
const ICON = {};     // item icon name -> canvas
const ICONURL = {};  // item icon name -> dataURL

// アイテム・小物のドット絵（自動で縁取りされる）
const MAPS = {
  wood: ['............', '..hhhhhhhh..', '.hiiiiiiiijj', '.iiiiiiiijqj', '.iihhiiiijqj', '.iiiiiihijqj', '.iiiiiiiijjj', '..hhhhhhhh..'],
  stick: ['.........ij', '........ij.', '.......ij..', '......ij.l.', '.....ij.ll.', '....ij.....', '...ij......', '..ij.......', '.ij........', 'ih.........'],
  fiber: ['..m..m..m.', '..lm.lm.l.', '...l.l.ml.', '...lmlml..', '....lll...', '...kyyyk..', '....lll...', '...lm.ml..', '..ml...lm.', '..l.....l.'],
  stone: ['....nnnn....', '..nnooppnn..', '.noopppppon.', '.nooopppoon.', '.noooooooonn', '.nnooooonnn.', '..nnnnnnnn..'],
  flint: ['.....55.....', '....5nn5....', '...5nnnn5...', '..5nn6nnn5..', '.5nnn6nnnn5.', '..5nnnnnn5..', '...55nnn5...', '.....555....'],
  leaf: ['.........m.', '.......mml.', '.....mmlll.', '....mllllk.', '...mlllmlk.', '..mllmllk..', '..llmllk...', '.lmllkk....', '.lllk......', '.lkk.......', 'h..........'],
  clay: ['....4444....', '..44jj4444..', '.44jj444444.', '.4444444uu..', '.44444uuu...', '..4uuuuu....'],
  iron_ore: ['....nnnn....', '..nnooonn...', '.noo9oooon..', '.no99oo4on..', '.nooooo99n..', '.n4ooooo9n..', '..nnnnnnn...'],
  iron: ['...BBBBBBB..', '..BRRBBBBC..', '.BBBBBBBCC..', '.CCCCCCCC...'],
  coal: ['....0000....', '..00n5n00...', '.0n5n0n550..', '.0nn05nnn0..', '..000nn00...', '.....000....'],
  rope: ['...jjjjjj...', '..jiiiiiij..', '.ji.jjjj.ij.', '.ji.j..j.ij.', '.ji.jjjj.ij.', '..jiiiiiij..', '...jjjjjji..', '.........i..', '..........i.'],
  cloth: ['..RRRRRRRR..', '..R7777776..', '..RSSSSSS6..', '..R7777776..', '..RSSSSSS6..', '..R7777776..', '..66666666..'],
  leather: ['.F........F.', '.FF.FFFF.FF.', '..FFwwwwFF..', '..FwwjwwwF..', '..FwwwwwwF..', '.FFwwwwjwFF.', 'FF.FwwwwF.FF', '....FFFF....'],
  bone: ['.JJ.........', 'JJJJ........', '.JJJJ.......', '..JJJ.......', '...JJJ......', '....JJJ.....', '.....JJJ....', '......JJJ...', '.......JJJJ.', '........JJJJ', '.........JJ.'],
  feather: ['.........77', '........776', '.......7766', '......776..', '.....776...', '....776....', '...776.....', '..766......', '.j6........', 'j..........'],
  shell: ['....eeee....', '...eeffee...', '..effeeffe..', '..efeffefe..', '..eefeefee..', '...eeeeee...', '....e..e....'],
  scrap: ['...C..BB....', '..CBBBBC....', '..BCCBB.BC..', '...BBCCBBB..', '..CB.BBCC...', '...CC..C....'],
  crystal: ['.....z......', '....zz7.....', '...Azz7z....', '..Azzzz7z...', '..AAzzzzz...', '...AAzzz....', '....AAz.....'],
  resin: ['.....9......', '....9a9.....', '...9aay9....', '..99ayy99...', '..999a999...', '...99999....', '....999.....'],
  salt: ['.....77.....', '....7777....', '...777677...', '..77767777..', '..66666666..'],
  claw: ['..DD....DD..', '.DDDD..DDDD.', '.DDDDD.DDDD.', '..DDDDDDDD..', '...DDDDDD...', '....EEEE....', '....EEEE....', '...EEEE.....'],
  berry: ['.....l......', '....lk......', '...UU.UU....', '..UeUUUeU...', '..UUUUUUU...', '...UeUUU....', '....UUU.....'],
  coconut: ['....hhhh....', '..hhiiihh...', '.hhiihiiih..', '.hiiiiiihh..', '.hihii0iih..', '.hhii0i0hh..', '..hhiiihh...', '....hhhh....'],
  banana: ['.........h.', '........hy.', '.......yay.', '......yaay.', '....yyaay..', '..yyaayy...', '.yaaay.....', '.yyy.......'],
  mushroom: ['....hhhh....', '..hhjjhhhh..', '.hjjhhhjhhh.', '.hhhhhhhhhh.', '...JJJJJJ...', '....JJJJ....', '....JJJJ....', '....JJJ.....'],
  red_mushroom: ['....8888....', '..8877888u..', '.877888878u.', '.8888u8888u.', '...JJJJJJ...', '....JJJJ....', '....JJJJ....', '....JJJ.....'],
  potato: ['...ZZZZZ....', '..ZjjjjjZ...', '.ZjjZjjjjZ..', '.ZjjjjjZjZ..', '..ZjjjjjjZ..', '...ZZZZZZ...'],
  watermelon: ['...3333.....', '..3bb3bb3...', '.3b3bb3bb3..', '.3bb3bb3b3..', '.3b3bb3bb3..', '..3bb3bb3...', '...3333.....'],
  fish: ['....SSSS.....', '..SScccSS..S.', '.ScWccccccSS.', '.Sc0ccccccS..', '.ScccccccccSS', '..SSccccSS..S', '....SSSS.....'],
  meat: ['.........JJ.', '........JJJ.', '.......JJJ..', '..uuuuJJ....', '.uUUUUuu....', 'uUeUUUUu....', 'uUUUUeUu....', 'uUUUUUUu....', '.uUUUUu.....', '..uuuu......'],
  crab_meat: ['...DDDD.....', '..DR77DD....', '.DR7777RD...', '.D77R77RD...', '..D7777D....', '...DDDD.....'],
  jerky: ['..uu........', '..uEu..uu...', '...uEu.uEu..', '....uEuuEu..', '.....uEEu...', '......uu....'],
  canned: ['...BBBBBB...', '..BRRRRRRB..', '..CUUUUUUC..', '..CU7777UC..', '..CUUUUUUC..', '..CUUUUUUC..', '..BCCCCCCB..'],
  bowl: ['..h~~~~~~h..', '.hh~~~~~~hh.', '.hiiiiiiiih.', '..hiiiiiih..', '...hhhhhh...'],
  seed: ['....hh......', '...h..h.....', '...hjjh.....', '..hjjjjh....', '.hjj##jjh...', '.hj#jj#jh...', '.hjjj#jjh...', '..hhhhhh....'],
  herb: ['...b..b.....', '..bmbbmb....', '..mbmmbm....', '...bmmb..b..', '....bb..bmb.', '.....l.bmb..', '.....l.l....', '.....lll....'],
  bandage: ['...RRRRRR...', '..R777777R..', '.R77666677R.', '.R76RRRR67R.', '.R77666677R.', '..R777777R..', '...RRRRRR...'],
  medicine: ['.....hh.....', '.....JJ.....', '....R77R....', '...R7777R...', '...RbbbbR...', '...RbmbbR...', '...RbbbbR...', '....RRRR....'],
  axe: ['......%###.', '.....%####.', '.....%##i#.', '......%i##.', '......i....', '.....i.....', '....i......', '...i.......', '..i........', '.h.........'],
  pick: ['..%%###....', '.%.....##..', '.......i##.', '......i...#', '.....i....%', '....i......', '...i.......', '..i........', '.h.........'],
  shovel: ['.........i.', '........i..', '.......i...', '......i....', '.....i.....', '...##......', '..####.....', '..%###.....', '...%#......'],
  hammer: ['...%####%..', '...%####%..', '....%%i%...', '......i....', '......i....', '......i....', '......i....', '......h....'],
  spear: ['..........#', '.........##', '........#%.', '.......i...', '......i....', '.....i.....', '....i......', '...i.......', '..i........', '.h.........'],
  sword: ['.........BR', '........BRC', '.......BRC.', '......BRC..', '.....BRC...', '..Y.BRC....', '...YRC.....', '...hY......', '..hhY......', '.h...Y.....'],
  bow: ['...ii......', '..i.7......', '.i...7.....', '.i....7....', 'i.....7....', 'i.....7....', '.i....7....', '.i...7.....', '..i.7......', '...ii......'],
  arrow: ['.........6.', '........66.', '.......B6..', '......i....', '.....i.....', '....i......', '...i.......', '.7i........', '.77........', '7..........'],
  torch: ['.....Q.....', '....QaQ....', '....QPQ....', '.....Q.....', '....hjh....', '.....i.....', '.....i.....', '.....i.....', '.....i.....', '.....h.....'],
  lantern: ['.....CC.....', '....C..C....', '...CCCCCC...', '...BaPaaB...', '...BaPPaB...', '...BaaaaB...', '...CCCCCC...'],
  rod: ['.........i.', '........i.6', '.......i..6', '......i...6', '.....i....6', '....i.....6', '...i......B', '..i........', '.h.........'],
  clay_pot: ['...4444444..', '..4j44444u4.', '..44444444u.', '..u4444444u.', '...uuuuuuu..'],
  armor: ['..##....##..', '.####..####.', '.##########.', '..%######%..', '...######...', '...##**##...', '...######...', '...%%%%%%...'],
  backpack: ['....hhhh....', '...h....h...', '..FFFFFFFF..', '..FwwwwwwF..', '..FwYYwwwF..', '..FwwwwwwF..', '..FwwwwwwF..', '..FFFFFFFF..'],
  sail: ['.....i......', '.....iRR....', '.....iRRR...', '.....iRRRR..', '.....iRRRRR.', '.....iRRRRR.', '.....iRRRR..', '.....i......', '..hhhhhhhh..'],
  oar: ['.........i.', '........i..', '.......i...', '......i....', '.....i.....', '...jjj.....', '..jjjj.....', '.jjjj......', '.jjj.......'],
  compass: ['...pppppp...', '..p777777p..', '.p77787777p.', '.p7778U777p.', '.p777UU777p.', '.p777C7777p.', '..p777777p..', '...pppppp...'],
  tube: ['....RRRR....', '...R7..7R...', '...R.aa.R...', '...R.Pa.R...', '...R.aa.R...', '...R7..7R...', '...CCCCCC...', '....C.C.....', '....C.C.....'],
  antenna: ['.....BB.....', '.....B......', '.....B......', '...B.B.B....', '....BBB.....', '.....B......', '.....B......', '...CCCCC....', '...CCCCC....'],
  battery: ['....CC..CC..', '...BBBBBBBB.', '...B8BBBBcB.', '...BBBBBBBB.', '...BCCCCCCB.', '...BC7CCCCB.', '...BBBBBBBB.'],
  tablet: ['...oooooo...', '..oppppppo..', '..op****po..', '..op*pp*po..', '..op****po..', '..oppppppo..', '..ooooooon..'],
  tmap: ['.qqqqqqqqqq.', '.qrrqqqqqrq.', '.qqq8qq8qqq.', '.qqqq88qqqq.', '.qqqq88qqqq.', '.qqq8qq8qqq.', '.qrqqqqqqrq.', '.qqqqqqqqqq.'],
  boot: ['....hhhh....', '....hiih....', '....hiih....', '....hiih....', '....hiiihh..', '...hiiiiiih.', '...hhhhhhhh.'],
  gold: ['...YYYY.....', '..YaaaaY....', '.YaYYYYaY...', '.YaYaaYaY...', '.YaYYYYaY...', '..YaaaaY....', '...YYYY.....'],
  pearl: ['....7777....', '...776677...', '...766d67...', '...776677...', '....7777....'],
  page: ['..qqqqqqq...', '..q666666q..', '..q6qqqq6q..', '..q666666q..', '..q6qqq66q..', '..q666666q..', '..qqqqqqqq..'],
  // ---- world small objects ----
  twig: ['......i.......', '..iiiiiiih....', '.i....i..ii...', '........i.....'],
  pebble: ['..nn....', '.npon...', 'nooon.no', '.nnn.nop', '.....nn.'],
  driftwood: ['..hhhhhhhhhhh...', '.hjjjjjjjjjjjh..', 'hjjiijjjjiijjjh.', '.hiiiiiiiiiiih..', '..hhhh...hhh....'],
  bottle: ['.......W..', '......WtW.', '.WWWWWWtW.', 'WttRqtttW.', 'WttqqtttW.', '.WWWWWWWW.'],
  crate: ['hhhhhhhhhhhhhh', 'hjjjjjjjjjjjjh', 'hjiiijjjjiiijh', 'hjjiiijjiiijjh', 'hjjjiiiiiijjjh', 'hjjjjiiiijjjjh', 'hjjjiiiiiijjjh', 'hjjiiijjiiijjh', 'hjiiijjjjiiijh', 'hjjjjjjjjjjjjh', 'hhhhhhhhhhhhhh'],
  note: ['.qqqqq..', '.q666q..', '.qqqqqq.', '.q6666q.', '.qqqqqq.', '.q666q..', '.qqqqq..'],
  // ---- animals ----
  crab: ['.D..........D.', 'DDD........DDD', '.DD.0....0.DD.', '..DDD7DD7DDD..', '...DDDDDDDD...', '..DDDDDDDDDD..', '.D.EEEEEEEE.D.', 'D..E.E..E.E..D'],
  boar: ['...GFFFFFF........', '..GFFFFFFFFF......', '.GFFFFFFFFFFFF....', 'GFFFFFFFFFFFFFFw..', 'FFFFFFFFFFFFFF0Fww', 'FFFFFFFFFFFFFFFwwJ', '.FFFFFFFFFFFFFwwJ.', '.FFFFFFFFFFFFF....', '..GG.GG...GG.GG...', '..GG.GG...GG.GG...'],
  snake: ['..........HHH...', '.........HH0HH..', '..HHH....HHHHHu.', '.HIIIH...HH..u..', 'HI...IH.HH......', 'H.....IHHI......', '.......IIH......'],
  monkey: ['....FFFF......', '...FvvvvF.....', '..FvvvvvvF....', '..Fv0vv0vF....', '..FvvwwvvF....', '...FvvvvF.....', '..FFFFFFFF....', '.FFvvvvvFF....', '.F.vvvvv.F..F.', '...FFFFF...F..', '...F...F..F...', '...F...F.F....'],
  gull: ['.....77.....', '....7707....', '....777a9...', '..77777.....', '.7777666....', '777766......', '..666.......', '...9..9.....'],
  wolf: ['................KK', '..............KKLK', '..KKKKKKKKKKKKKK0K', '.KKKKKKKKKKKKKKKKL', 'KKKKKKKKKKKKKKKKK.', 'L.KKKKKKKKKKKKK...', '..LKKKKKKKKKKKK...', '...LL.LL...LL.LL..', '...L..L....L..L...'],
  bat1: ['N............N', 'NN....NN....NN', 'NNN..N8N8..NNN', '.NNNNNNNNNNNN.', '...NNNNNNNN...', '.....NNNN.....'],
  bat2: ['......NN......', '.....N8N8.....', '..NNNNNNNNNN..', '.NNNNNNNNNNNN.', 'NNN..NNNN..NNN', 'N.....NN.....N'],
  spider: ['.5..........5.', '..5..5555..5..', '5..55555555..5', '.5558555855...', '...55555555...', '5.5555555555.5', '.5..555555..5.', '..5........5..'],
  // ---- structures ----
  workbench: ['jjjjjjjjjjjjjjjj', 'jiiiiiiiiiiiiiij', 'hhhhhhhhhhhhhhhh', '.h.oo.......h.h.', '.h.oo...B...h.h.', '.h..........h.h.', '.hhhhhhhhhhhh.h.', '.h..........h.h.', '.h..........h...'],
  leafbed: ['..llllllllllll..', '.lmmlmmlmmlmmll.', 'lmllmllmllmllmll', 'llmllmllmllmlllk', 'klllllllllllllkk', '.kkkkkkkkkkkkkk.', '..hhhhhhhhhhhh..'],
  oldbed: ['hhhhhhhhhhhhhhh', 'hRRRRjjjjjjjjjh', 'hR77RSSSSSSSSSh', 'hR77RSTSSSTSSSh', 'hRRRRSSSSSSSSSh', 'hhhhhhhhhhhhhhh', '.h...........h.'],
  chest: ['.hhhhhhhhhhhh.', 'hjjjjjjjjjjjjh', 'hjiiiiiiiiiijh', 'hhhhhhYYhhhhhh', 'hjjjjjYaYjjjjh', 'hjiiiiYYiiiijh', 'hjiiiiiiiiiijh', 'hjjjjjjjjjjjjh', 'hhhhhhhhhhhhhh'],
  collector: ['llllllllllllll', '.lmmmmmmmmmml.', '..lmmmmmmmml..', '...llllllll...', '....h....h....', '....h.tt.h....', '....h.tt.h....', '...hhhhhhhh...', '...hi~~~~ih...', '...hiiiiiih...', '...hhhhhhhh...'],
  torchpost: ['hjjjh', '.hih.', '..i..', '..i..', '..i..', '..i..', '..i..', '..i..', '.hih.', 'hhhhh'],
  furnace: ['....oooooooo....', '...oppppppppo...', '..oppoooooooppo.', '..opo000000opo..', '..opo0QQQQ0opo..', '..opo0QaaQ0opo..', '..opo000000opo..', '..oppoooooopo...', '..oooooooooooo..', '..nnnnnnnnnnnn..'],
  radio: ['..........B...', '..........B...', '..CCCCCCCCBC..', '.CppppppppppC.', '.Cp0000pYpYpC.', '.Cp0aa0ppppC..', '.Cp0000pCpCpC.', '.CppppppppppC.', '.CCCCCCCCCCCC.', '.h..........h.', '.h..........h.'],
  statue: ['...oooooo...', '..oppppppo..', '..opnnnnpo..', '..oppppppo..', '..op0pp0po..', '..oppppppo..', '..oppnppo...', '...opppo....', '..oppppppo..', '..oppnnppo..', '..oppppppo..', '..oooooooo..', '.onnnnnnnno.', '.oooooooooo.'],
  shrine: ['..uuuuuuuuuu..', '.uUUUUUUUUUUu.', 'uuuuuuuuuuuuuu', '..oo......oo..', '..op.oooo.op..', '..op.o**o.op..', '..op.oooo.op..', '..oooooooooo..', '.onnnnnnnnnno.'],
  lifeboat: ['....QQQQQQQQQQQQQQQQQQQQ....', '..QQ99999999999999999999QQ..', '.Q9999RRRRRRRRRRRRRRRR9999Q.', 'Q99RRRhhhhhhhhhhhhhhhhRRR99Q', 'Q9RRhhjjjjjjjjjjjjjjjjhhRR9Q', '.Q9RRhhhhhhhhhhhhhhhhhhRR9Q.', '..QQ99999999999999999999QQ..', '....QQQQQQQQQQQQQQQQQQQQ....'],
  milcrate: ['IIIIIIIIIIIIIIII', 'IHHHHHHHHHHHHHHI', 'IHHIIIHHHHIIIHHI', 'IHHHHHHHHHHHHHHI', 'ICCCCCCCCCCCCCCI', 'IHHHH7H7H7HHHHHI', 'IHHHHHHHHHHHHHHI', 'IHHHHHHHHHHHHHHI', 'IIIIIIIIIIIIIIII'],
  ship: ['..........R.........', '..........RR........', '..........RRR.......', '.....C....RRRR......', '.....C....R.........', 'UUUUUUUUUUUUUUUUUUU.', '.UBBBBBBBBBBBBBBBU..', '..UUUUUUUUUUUUUUU...'],
};

// ---------- 地形タイル生成 ----------
// tile ids
const T = { DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, FOREST: 4, JUNGLE: 5, ROCK: 6, SWAMP: 7, FRESH: 8, PATH: 9, RFLOOR: 10, RWALL: 11, CFLOOR: 12, CWALL: 13, FARM: 14, PLANK: 15, LOGWALL: 16 };
const TINFO = [
  { n: '深い海', solid: 1, water: 'sea', prio: 0, mc: '#1d5f9e' },
  { n: '浅瀬', solid: 0, water: 'sea', prio: 1, mc: '#3fa7d4', spd: .62 },
  { n: '砂浜', prio: 2, mc: '#e6d39a' },
  { n: '草原', prio: 4, mc: '#5a9e3e' },
  { n: '森', prio: 5, mc: '#3f7d32' },
  { n: 'ジャングル', prio: 6, mc: '#2f6e3a' },
  { n: '岩場', prio: 7, mc: '#8a8578' },
  { n: '沼地', prio: 3, mc: '#5b6b34', spd: .75 },
  { n: '池', solid: 1, water: 'fresh', prio: -1, mc: '#4a9ad6' },
  { n: '小道', prio: -1, mc: '#b08d5f', spd: 1.08 },
  { n: '遺跡の床', prio: -1, mc: '#9b9a8a' },
  { n: '遺跡の壁', solid: 1, prio: -1, mc: '#5e574c' },
  { n: '洞窟の床', prio: -1, mc: '#4a4252' },
  { n: '洞窟の壁', solid: 1, prio: -1, mc: '#1b1622' },
  { n: '畑', prio: -1, mc: '#6b4a2e' },
  { n: '床板', prio: -1, mc: '#a2723f' },
  { n: '丸太の壁', solid: 1, prio: -1, mc: '#5a3a20' },
];
const TILE_COLS = {
  0: ['#1d5f9e', '#195690', '#2a6fae'], 1: ['#3fa7d4', '#38a0cc', '#55b8e0'], 2: ['#e6d39a', '#d8c287', '#f2e3b3'],
  3: ['#5a9e3e', '#4f8f35', '#6db04c'], 4: ['#3f7d32', '#356c2a', '#4a8a3a'], 5: ['#2f6e3a', '#285f31', '#3b7d44'],
  6: ['#8a8578', '#7a756a', '#9d988b'], 7: ['#5b6b34', '#4e5d2c', '#6a7a40'], 8: ['#4a9ad6', '#3f8cc8', '#62afe4'],
  9: ['#b08d5f', '#9f7d52', '#c09e6e'], 10: ['#9b9a8a', '#8b8a7b', '#aaa99a'], 11: ['#6e675b', '#5e574c', '#827a6c'],
  12: ['#4a4252', '#3e3746', '#564d60'], 13: ['#1b1622', '#241d2d', '#2f2738'], 14: ['#6b4a2e', '#5a3d25', '#7a573a'],
  15: ['#a2723f', '#8d6234', '#b5824c'], 16: ['#7a5230', '#5a3a20', '#8f6440'],
};
const TILESET = []; // TILESET[type][variant][frame]
const EDGE = [];    // EDGE[type][dir] 隣接ブレンド
function genTiles() {
  const r = mulberry32(4242);
  for (let t = 0; t <= 16; t++) {
    TILESET[t] = [];
    const [base, dk, lt] = TILE_COLS[t];
    for (let v = 0; v < 4; v++) {
      TILESET[t][v] = [];
      const anim = (t === T.DEEP || t === T.SHALLOW || t === T.FRESH);
      const frames = anim ? 4 : 1;
      // 静的なノイズ点を先に決める
      const dots = []; for (let i = 0; i < 26; i++) dots.push([Math.floor(r() * 16), Math.floor(r() * 16), r()]);
      for (let f = 0; f < frames; f++) {
        const c = mkC(TS, TS), x = cx2(c);
        R(x, 0, 0, 16, 16, base);
        switch (t) {
          case T.DEEP: case T.SHALLOW: case T.FRESH: {
            for (const [a, b, q] of dots) if (q < .5) P(x, a, b, dk);
            for (let k = 0; k < 3; k++) { // 波
              const wy = (k * 5 + v * 3 + 2) % 16; const wx = (k * 7 + f * 2 + v * 5) % 16;
              R(x, wx, wy, 4, 1, lt); R(x, (wx + 4) % 16, wy - 1 < 0 ? 15 : wy - 1, 2, 1, lt);
            }
            if (t === T.FRESH && v === 0 && f % 2 === 0) { E(x, 5, 9, 2, 1, '#4a8f3a'); P(x, 5, 9, '#7cc35a'); }
            break;
          }
          case T.SAND:
            for (const [a, b, q] of dots) P(x, a, b, q < .5 ? dk : lt);
            if (v === 1) { P(x, 11, 4, '#ff8fb4'); P(x, 12, 4, '#ffccaa'); }
            break;
          case T.GRASS: case T.FOREST: case T.JUNGLE:
            for (const [a, b, q] of dots) P(x, a, b, q < .55 ? dk : lt);
            for (let k = 0; k < (t === T.GRASS ? 3 : 2); k++) { const a = Math.floor(r() * 14) + 1, b = Math.floor(r() * 13) + 2; P(x, a, b, lt); P(x, a, b - 1, lt); P(x, a + 1, b - 1, dk); }
            if (t === T.GRASS && v === 2) { P(x, 4, 5, '#fff1e8'); P(x, 10, 11, '#ffec27'); }
            break;
          case T.ROCK:
            for (const [a, b, q] of dots) P(x, a, b, q < .5 ? dk : lt);
            R(x, 2 + v * 2, 6, 4, 1, '#6a655b'); P(x, 6 + v * 2, 7, '#6a655b'); P(x, 7 + v * 2, 8, '#6a655b');
            break;
          case T.SWAMP:
            for (const [a, b, q] of dots) P(x, a, b, q < .5 ? dk : lt);
            if (v % 2 === 0) { E(x, 8, 9, 3, 1, '#3d5a4a'); P(x, 7, 9, '#5d8a76'); }
            break;
          case T.PATH:
            for (const [a, b, q] of dots) P(x, a, b, q < .6 ? dk : lt);
            P(x, 3, 4, '#8a8578'); P(x, 11, 12, '#8a8578');
            break;
          case T.RFLOOR:
            R(x, 0, 0, 16, 1, dk); R(x, 0, 8, 16, 1, dk); R(x, 0, 0, 1, 8, dk); R(x, 8, 8, 1, 8, dk);
            for (const [a, b, q] of dots) if (q < .25) P(x, a, b, lt);
            if (v === 3) { P(x, 3, 12, '#6f8a4a'); P(x, 4, 12, '#6f8a4a'); P(x, 4, 13, '#6f8a4a'); }
            break;
          case T.RWALL:
            R(x, 0, 0, 16, 3, lt);
            R(x, 0, 7, 16, 1, dk); R(x, 0, 12, 16, 1, dk); R(x, 5, 3, 1, 4, dk); R(x, 12, 8, 1, 4, dk); R(x, 3, 13, 1, 3, dk);
            R(x, 0, 15, 16, 1, '#3e382f');
            if (v === 2) { P(x, 9, 4, '#6f8a4a'); P(x, 10, 4, '#6f8a4a'); P(x, 10, 5, '#6f8a4a'); }
            break;
          case T.CFLOOR:
            for (const [a, b, q] of dots) P(x, a, b, q < .5 ? dk : lt);
            break;
          case T.CWALL:
            for (const [a, b, q] of dots) P(x, a, b, q < .5 ? dk : lt);
            break;
          case T.FARM:
            for (let k = 0; k < 4; k++) R(x, 0, 2 + k * 4, 16, 1, dk);
            for (const [a, b, q] of dots) if (q < .3) P(x, a, b, lt);
            break;
          case T.PLANK:
            for (let k = 0; k < 4; k++) R(x, 0, k * 4 + 3, 16, 1, dk);
            P(x, (v * 5 + 3) % 16, 1, dk); P(x, (v * 3 + 9) % 16, 9, dk);
            break;
          case T.LOGWALL:
            for (let k = 0; k < 4; k++) { R(x, 0, k * 4, 16, 1, lt); R(x, 0, k * 4 + 3, 16, 1, dk); }
            R(x, 0, 15, 16, 1, '#3a2414');
            break;
        }
        TILESET[t][v][f] = c;
      }
    }
  }
  // edge blend sprites
  for (let t = 0; t <= 16; t++) {
    EDGE[t] = [];
    for (let dir = 0; dir < 4; dir++) {
      const c = mkC(TS, TS), x = cx2(c);
      const src = TILESET[t][0][0];
      x.fillStyle = '#000';
      let prev = 3;
      for (let i = 0; i < 16; i++) {
        let depth = clamp(prev + Math.floor(r() * 3) - 1, 2, 5); prev = depth;
        if (i === 0 || i === 15) depth = Math.min(depth, 3);
        if (dir === 0) x.fillRect(i, 0, 1, depth);
        else if (dir === 2) x.fillRect(i, 16 - depth, 1, depth);
        else if (dir === 3) x.fillRect(0, i, depth, 1);
        else x.fillRect(16 - depth, i, depth, 1);
      }
      x.globalCompositeOperation = 'source-in';
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-over';
      EDGE[t][dir] = c;
    }
  }
}

// ---------- 自然物などの手続き生成スプライト ----------
function genObjSprites() {
  const OC = '#160f1c', GOC = '#11240f';
  // 広葉樹 3種
  for (let v = 0; v < 3; v++) {
    const r = mulberry32(100 + v), c = mkC(24, 30), x = cx2(c);
    R(x, 10, 18, 4, 10, 'h'); R(x, 10, 18, 1, 9, 'i'); P(x, 9, 27, 'h'); P(x, 14, 27, 'h'); P(x, 12, 22, 'g');
    const cy = 11 + (v === 2 ? 1 : 0), rx = v === 1 ? 9 : 10;
    E(x, 12, cy + 2, rx, 8, 'k'); E(x, 11, cy, rx - 1, 8, 'l');
    if (v === 1) { E(x, 6, cy + 3, 4, 3, 'l'); E(x, 17, cy + 3, 4, 3, 'l'); }
    E(x, 9, cy - 3, 5, 4, 'm');
    for (let i = 0; i < 60; i++) {
      const px = 2 + Math.floor(r() * 20), py = 2 + Math.floor(r() * 17);
      if (!inEl(px, py, 11, cy, rx - 1, 8)) continue;
      if (py > cy + 2) P(x, px, py, 'k'); else if (r() < .5) P(x, px, py, py < cy - 2 ? '#a3d873' : 'm');
    }
    SPR['tree' + v] = outline(c, GOC);
  }
  // 松っぽい木（岩場用）
  {
    const c = mkC(18, 30), x = cx2(c);
    R(x, 8, 22, 3, 7, 'h');
    for (let i = 0; i < 4; i++) { const w = 3 + i * 2, y = 3 + i * 5; for (let k = 0; k < 6; k++) R(x, 9 - Math.floor(w * (k / 5)), y + k, Math.floor(w * (k / 5)) * 2 + 1, 1, k < 2 ? 'l' : 'k'); }
    P(x, 9, 2, 'm');
    SPR.pine = outline(c, GOC);
  }
  // ヤシ 2種
  for (let v = 0; v < 2; v++) {
    const c = mkC(28, 34), x = cx2(c); const bend = v ? 3 : -3;
    for (let i = 0; i <= 21; i++) { const t = i / 21; const X = Math.round(14 + bend * t * t); const Y = 33 - i; R(x, X - 1, Y, 3, 1, i % 3 === 0 ? 'i' : 'j'); P(x, X + 1, Y, 'i'); }
    const tx = 14 + bend, ty = 11;
    const angs = [-2.9, -2.3, -1.65, -1.1, -0.45, 0.2];
    for (const a of angs) {
      for (let t = 0; t < 12; t++) {
        const X = Math.round(tx + Math.cos(a) * t), Y = Math.round(ty + Math.sin(a) * t * 0.7 + t * t * 0.055);
        P(x, X, Y, 'l'); P(x, X, Y + 1, 'k'); if (t < 7) P(x, X, Y - 1, 'm');
        if (t > 2 && t % 2 === 0) { P(x, X, Y + 2, 'k'); P(x, X + (Math.cos(a) > 0 ? -1 : 1), Y + 2, 'l'); }
      }
    }
    E(x, tx, ty, 2, 1, 'm');
    SPR['palm' + v] = outline(c, GOC);
  }
  // バナナの木
  {
    const c = mkC(22, 28), x = cx2(c);
    R(x, 10, 14, 3, 13, 'I'); R(x, 10, 14, 1, 13, 'H');
    const leaves = [[-2.6, 9], [-1.9, 10], [-1.2, 9], [-0.5, 10], [0.1, 9]];
    for (const [a, L] of leaves) for (let t = 0; t < L; t++) {
      const X = Math.round(11 + Math.cos(a) * t), Y = Math.round(12 + Math.sin(a) * t * .8 + t * t * .04);
      R(x, X - 1, Y, 3, 2, 'l'); P(x, X, Y, 'm');
    }
    SPR.banana_tree = outline(c, GOC);
  }
  // 茂み
  {
    const c = mkC(18, 14), x = cx2(c);
    E(x, 9, 8, 8, 5, 'k'); E(x, 8, 7, 7, 4, 'l'); E(x, 6, 5, 3, 2, 'm'); E(x, 12, 6, 2, 2, 'm');
    SPR.bush = outline(c, GOC);
  }
  // 草むら・シダ
  {
    const c = mkC(14, 11), x = cx2(c);
    const blades = [[2, 6], [4, 9], [6, 7], [7, 10], [9, 8], [11, 6]];
    for (const [bx, h] of blades) { for (let k = 0; k < h; k++) P(x, bx + (k > h - 3 ? (bx < 7 ? -1 : 1) : 0), 10 - k, k > h - 4 ? 'm' : 'l'); }
    SPR.grass = outline(c, GOC);
    const c2 = mkC(16, 12), x2 = cx2(c2);
    for (const a of [-2.5, -1.9, -1.2, -.6]) for (let t = 0; t < 7; t++) { const X = Math.round(8 + Math.cos(a) * t), Y = Math.round(10 + Math.sin(a) * t * .9 + t * t * .07); P(x2, X, Y, 'l'); P(x2, X, Y - 1, t % 2 ? 'm' : 'l'); }
    SPR.fern = outline(c2, GOC);
  }
  // 岩 2種 + 鉱石 + 大岩
  const rock = (w, h, seed, spk) => {
    const r = mulberry32(seed), c = mkC(w, h), x = cx2(c); const cx = w >> 1, cy = h >> 1;
    E(x, cx, cy + 1, cx - 1, cy - 1, 'n'); E(x, cx - 1, cy, cx - 2, cy - 2, 'o'); E(x, cx - 2, cy - 2, Math.max(1, cx - 4), Math.max(1, cy - 3), 'p');
    for (let i = 0; i < 10; i++) { const px = Math.floor(r() * w), py = Math.floor(r() * h); if (inEl(px, py, cx - 1, cy, cx - 2, cy - 2)) P(x, px, py, r() < .5 ? 'n' : 'o'); }
    if (spk) for (let i = 0; i < spk.n; i++) { const px = 2 + Math.floor(r() * (w - 4)), py = 2 + Math.floor(r() * (h - 4)); if (inEl(px, py, cx - 1, cy, cx - 3, cy - 3)) { P(x, px, py, spk.c); if (spk.c2) P(x, px + 1, py, spk.c2); } }
    return outline(c, OC);
  };
  SPR.rock0 = rock(16, 12, 7, null); SPR.rock1 = rock(14, 11, 9, null);
  SPR.iron_rock = rock(16, 13, 11, { n: 9, c: '#d9823b', c2: '#9c5a2a' });
  SPR.coal_rock = rock(16, 13, 13, { n: 10, c: '#1a1520', c2: '#2c2633' });
  SPR.boulder = rock(22, 18, 17, null);
  {
    const c = mkC(16, 16), x = cx2(c);
    E(x, 8, 12, 6, 3, 'n'); E(x, 8, 11, 5, 2, 'o');
    const shards = [[5, 3, 9], [8, 1, 11], [11, 4, 8], [7, 6, 6]];
    for (const [sx, sy, h] of shards) { for (let k = 0; k < h; k++) { const w = k < 2 ? 1 : 2; R(x, sx - (w >> 1), sy + k, w, 1, k < 3 ? '#efd6ff' : (k % 3 ? 'z' : 'A')); } }
    SPR.crystal_rock = outline(c, '#20112e');
  }
  // 切り株・若木
  { const c = mkC(12, 9), x = cx2(c); E(x, 6, 5, 4, 3, 'h'); E(x, 6, 3, 4, 2, 'j'); P(x, 6, 3, 'i'); P(x, 5, 3, 'i'); SPR.stump = outline(c, OC); }
  { const c = mkC(10, 13), x = cx2(c); R(x, 5, 5, 1, 8, 'h'); E(x, 3, 5, 2, 1, 'l'); E(x, 7, 3, 2, 1, 'm'); E(x, 5, 1, 1, 1, 'l'); SPR.sapling = outline(c, GOC); }
  // 粘土層
  { const c = mkC(16, 10), x = cx2(c); E(x, 8, 5, 7, 4, '#8a4a2c'); E(x, 7, 4, 6, 3, '#b0643c'); P(x, 5, 3, '#d58a5a'); P(x, 6, 3, '#d58a5a'); P(x, 10, 5, '#d58a5a'); SPR.clay_o = outline(c, OC); }
  // 花
  [['#ff4d6a', '#ffd34d'], ['#ffec27', '#ffffff'], ['#ffffff', '#ffec27'], ['#c48ef0', '#fff1e8']].forEach((cc, i) => {
    const c = mkC(12, 9), x = cx2(c);
    for (const [fx, fy] of [[2, 3], [6, 1], [9, 4]]) { R(x, fx, fy + 2, 1, 9 - fy - 2, 'l'); P(x, fx - 1, fy, cc[0]); P(x, fx + 1, fy, cc[0]); P(x, fx, fy - 1, cc[0]); P(x, fx, fy + 1, cc[0]); P(x, fx, fy, cc[1]); }
    SPR['flower' + i] = c;
  });
  // いもの株
  { const c = mkC(12, 10), x = cx2(c); for (const [a, L] of [[-2.4, 5], [-1.6, 6], [-.8, 5]]) for (let t = 0; t < L; t++) P(x, Math.round(6 + Math.cos(a) * t), Math.round(8 + Math.sin(a) * t), t > 2 ? 'm' : 'l'); E(x, 6, 8, 2, 1, 'Z'); SPR.potato_o = outline(c, GOC); }
  // 薬草（ワールド）
  SPR.herb_o = fromMap(MAPS.herb, null, { oc: GOC });
  SPR.mushroom_o = fromMap(MAPS.mushroom); SPR.red_mushroom_o = fromMap(MAPS.red_mushroom);
  // 小物
  for (const k of ['twig', 'pebble', 'driftwood', 'bottle', 'crate', 'note', 'workbench', 'leafbed', 'oldbed', 'chest', 'torchpost', 'furnace', 'radio', 'statue', 'shrine', 'lifeboat', 'milcrate', 'ship']) SPR[k] = fromMap(MAPS[k]);
  SPR.shell_o = fromMap(MAPS.shell);
  SPR.collector0 = fromMap(MAPS.collector, { '~': '#3b2a1e' }); SPR.collector1 = fromMap(MAPS.collector, { '~': '#9fe0f4' });
  SPR.shrine_empty = fromMap(MAPS.shrine, { '*': '#3a3f4a' }); SPR.shrine = fromMap(MAPS.shrine, { '*': '#ffec27' });
  SPR.rchest = fromMap(MAPS.chest, { h: '#4a4a52', j: '#9aa0a8', i: '#6c7380', Y: '#d4a83a', a: '#ffec27' });
  SPR.oldpack = fromMap(MAPS.backpack, { F: '#4d5a2a', w: '#6b7a3a', Y: '#a0a8b4', h: '#3b2a1e' });
  SPR.bag = fromMap(MAPS.backpack, { F: '#3d74b8', w: '#5a8fd0', Y: '#ffec27' });
  // 動物
  for (const k of ['crab', 'boar', 'snake', 'monkey', 'gull', 'wolf', 'bat1', 'bat2', 'spider']) { SPR[k] = fromMap(MAPS[k]); SPR[k + '_f'] = flipH(SPR[k]); }
  SPR.gull_fly = (() => { const c = fromMap(['7..........7', '77........77', '.777.77.777.', '..77777777..', '....7a9.....', '.....66.....']); return c; })();
  // キングクラブ（巨大化＋王冠）
  {
    const base = fromMap(MAPS.crab, { D: '#d0402a', E: '#7a2216' }, { noOutline: true });
    const big = scaleC(base, 3); const c = mkC(big.width + 2, big.height + 8), x = cx2(c);
    x.drawImage(big, 1, 7);
    const cr = [[18, 4], [21, 1], [24, 4], [27, 1], [30, 4]];
    R(x, 17, 5, 15, 3, 'a'); for (const [px, py] of cr) R(x, px, py, 2, 4, 'a'); P(x, 24, 6, '8'); P(x, 20, 6, 'c'); P(x, 28, 6, 'c');
    SPR.kingcrab = outline(c, OC); SPR.kingcrab_f = flipH(SPR.kingcrab);
  }
  // ゴーレム
  {
    const c = mkC(30, 32), x = cx2(c);
    R(x, 6, 10, 18, 14, 'O'); R(x, 6, 10, 18, 3, '#a59bb5'); R(x, 9, 2, 12, 9, 'O'); R(x, 9, 2, 12, 2, '#a59bb5');
    R(x, 11, 5, 3, 2, 'z'); R(x, 16, 5, 3, 2, 'z'); P(x, 12, 5, '#ffffff'); P(x, 17, 5, '#ffffff');
    R(x, 1, 11, 5, 12, '#6e6480'); R(x, 24, 11, 5, 12, '#6e6480'); R(x, 0, 21, 6, 4, 'O'); R(x, 24, 21, 6, 4, 'O');
    R(x, 8, 24, 5, 7, '#6e6480'); R(x, 17, 24, 5, 7, '#6e6480');
    R(x, 13, 14, 4, 4, 'A'); P(x, 14, 15, 'z'); P(x, 15, 16, 'z'); R(x, 8, 19, 2, 1, 'z'); R(x, 20, 19, 2, 1, 'z');
    P(x, 7, 13, '#5e8a4a'); P(x, 8, 13, '#5e8a4a'); P(x, 22, 16, '#5e8a4a');
    SPR.golem = outline(c, OC);
  }
  // たき火・のろし台の土台
  {
    const c = mkC(16, 12), x = cx2(c);
    for (const [sx, sy] of [[1, 8], [4, 10], [8, 10], [12, 9], [13, 6], [2, 5]]) { E(x, sx + 1, sy, 1, 1, 'o'); P(x, sx, sy - 1, 'p'); }
    R(x, 3, 6, 10, 2, 'h'); R(x, 5, 5, 6, 2, 'i'); P(x, 4, 7, 'j'); P(x, 11, 6, 'j');
    SPR.campfire = outline(c, OC);
  }
  {
    const c = mkC(22, 22), x = cx2(c);
    E(x, 11, 18, 10, 3, 'n'); E(x, 11, 17, 9, 2, 'o');
    for (let i = 0; i < 7; i++) { const lx = 4 + i * 2; for (let k = 0; k < 12; k++) P(x, Math.round(lx + (11 - lx) * (k / 12)), 17 - k, k % 4 === 0 ? 'h' : 'i'); }
    R(x, 9, 4, 4, 2, 'l'); P(x, 10, 3, 'm');
    SPR.signal = outline(c, OC);
  }
  // 柵（オートタイル用パーツは描画時に組み立て）
  // SOSサイン
  {
    const L = { S: ['111', '100', '111', '001', '111'], O: ['111', '101', '101', '101', '111'] };
    const c = mkC(38, 14), x = cx2(c);
    let ox = 1;
    for (const ch of 'SOS') { const g = L[ch]; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '1') { E(x, ox + i * 4 + 1, 2 + j * 2 + 1, 1, 1, 'p'); P(x, ox + i * 4, 2 + j * 2, '#d9dde2'); } ox += 13; }
    SPR.sos = outline(c, OC);
  }
  // いかだ（土台／完成）
  {
    const c = mkC(26, 18), x = cx2(c);
    for (let i = 0; i < 8; i++) { R(x, 1 + i * 3, 2, 3, 14, i % 2 ? 'i' : 'j'); R(x, 1 + i * 3, 2, 1, 14, 'h'); }
    R(x, 0, 5, 26, 1, 'q'); R(x, 0, 12, 26, 1, 'q');
    SPR.raft = outline(c, OC);
    const c2 = mkC(26, 30), x2 = cx2(c2);
    x2.drawImage(SPR.raft, 0, 12);
    R(x2, 12, 1, 2, 20, 'h'); for (let k = 0; k < 11; k++) R(x2, 14, 3 + k, Math.min(9, 2 + k), 1, k % 4 === 0 ? '#e0dccf' : 'R');
    R(x2, 3, 20, 7, 1, 'j'); R(x2, 16, 22, 7, 1, 'j');
    SPR.raft_full = outline(c2, OC);
  }
  // 朽ちたいかだ
  {
    const c = mkC(24, 14), x = cx2(c);
    for (let i = 0; i < 6; i++) { const h = 6 + ((i * 7) % 5); R(x, 1 + i * 4, 13 - h - (i % 2), 3, h, i % 2 ? 'X' : 'F'); }
    R(x, 0, 6, 12, 1, '#7a6a52');
    SPR.old_raft = outline(c, OC);
  }
  // 難破船
  {
    const c = mkC(44, 28), x = cx2(c);
    for (let k = 0; k < 10; k++) { const w = 36 - Math.abs(k - 5) * 3; R(x, 22 - (w >> 1) + (k > 6 ? 4 : 0), 8 + k * 2, w - (k > 6 ? 8 : 0), 2, k % 2 ? 'h' : 'i'); }
    R(x, 4, 8, 34, 2, 'g'); R(x, 6, 10, 2, 16, 'g');
    R(x, 20, 0, 3, 14, 'G'); R(x, 23, 2, 8, 5, '#d8d0c0'); R(x, 23, 2, 8, 1, '#a89f8c');
    P(x, 30, 12, '0'); P(x, 31, 13, '0'); P(x, 14, 18, '0'); R(x, 26, 20, 3, 2, '0');
    SPR.wreck = outline(c, OC);
  }
  // 遺跡パーツ
  {
    const c = mkC(10, 26), x = cx2(c);
    R(x, 0, 0, 10, 4, 'p'); R(x, 1, 4, 8, 19, 'o'); R(x, 1, 4, 2, 19, 'p'); R(x, 7, 4, 2, 19, 'n'); R(x, 0, 23, 10, 3, 'p');
    P(x, 3, 9, '#5e8a4a'); P(x, 4, 10, '#5e8a4a'); P(x, 6, 16, '#5e8a4a');
    SPR.pillar = outline(c, OC);
  }
  for (const st of [0, 1, 2, 3]) { // 祭壇 (置かれた石版数)
    const c = mkC(32, 16), x = cx2(c);
    R(x, 1, 4, 30, 10, 'o'); R(x, 1, 4, 30, 3, 'p'); R(x, 1, 13, 30, 2, 'n');
    const cols = ['#ffec27', '#9fe0f4', '#c48ef0'];
    for (let i = 0; i < 3; i++) { R(x, 5 + i * 9, 7, 5, 5, 'n'); if (i < st) { R(x, 5 + i * 9, 5, 5, 6, 'p'); R(x, 6 + i * 9, 6, 3, 3, cols[i]); } }
    SPR['altar' + st] = outline(c, OC);
  }
  {
    const c = mkC(16, 22), x = cx2(c);
    R(x, 0, 0, 16, 22, 'O'); R(x, 0, 0, 16, 2, '#a59bb5'); R(x, 7, 2, 2, 20, 'N');
    R(x, 3, 6, 3, 3, '#ffec27'); R(x, 10, 6, 3, 3, '#9fe0f4'); R(x, 6, 12, 4, 3, '#c48ef0');
    R(x, 2, 18, 12, 1, 'N');
    SPR.rdoor = outline(c, OC);
  }
  {
    const c = mkC(12, 12), x = cx2(c);
    R(x, 2, 4, 8, 7, 'o'); R(x, 1, 3, 10, 2, 'p'); R(x, 1, 10, 10, 2, 'n');
    SPR.pedestal = outline(c, OC);
  }
  // 洞窟の入口・出口
  {
    const c = mkC(26, 20), x = cx2(c);
    E(x, 13, 11, 12, 8, 'o'); E(x, 12, 10, 11, 7, 'p'); E(x, 13, 13, 7, 6, '#120d18'); R(x, 6, 13, 14, 6, '#120d18');
    P(x, 5, 6, 'n'); P(x, 19, 5, 'n'); P(x, 8, 4, 'o');
    SPR.cave_in = outline(c, OC);
    const c2 = mkC(16, 20), x2 = cx2(c2);
    x2.globalAlpha = .35; R(x2, 3, 0, 10, 20, '#fff4c8'); x2.globalAlpha = 1;
    for (let k = 0; k < 6; k++) { R(x2, 4, 2 + k * 3, 8, 1, 'j'); } R(x2, 4, 0, 1, 20, 'h'); R(x2, 11, 0, 1, 20, 'h');
    SPR.cave_out = c2;
  }
  // ヘリコプター
  {
    const c = mkC(52, 26), x = cx2(c);
    R(x, 2, 2, 48, 2, '#2a2a33');
    R(x, 24, 4, 3, 4, '#2a2a33');
    E(x, 22, 13, 12, 6, 'U'); E(x, 21, 12, 11, 5, '#ee6a5a'); E(x, 15, 11, 5, 3, 'W'); P(x, 13, 10, '#ffffff');
    R(x, 32, 11, 16, 3, 'U'); R(x, 46, 7, 3, 7, 'U'); R(x, 45, 7, 5, 1, '#2a2a33');
    R(x, 12, 21, 22, 2, '#2a2a33'); R(x, 15, 18, 2, 3, '#2a2a33'); R(x, 28, 18, 2, 3, '#2a2a33');
    R(x, 20, 13, 10, 2, '#ffffff');
    SPR.heli = outline(c, OC);
  }
  // 宝の目印
  { const c = mkC(10, 10), x = cx2(c); for (let i = 0; i < 8; i++) { R(x, 1 + i, 1 + i, 2, 1, '8'); R(x, 8 - i, 1 + i, 2, 1, '8'); } SPR.xmark = outline(c, OC); }
}

// ---------- アイテムアイコン生成 ----------
function genIcons() {
  const add = (name, cv) => { ICON[name] = cv; };
  const simple = ['wood', 'stick', 'fiber', 'stone', 'flint', 'leaf', 'clay', 'iron_ore', 'iron', 'coal', 'rope', 'cloth', 'leather', 'bone', 'feather', 'shell', 'scrap', 'crystal', 'resin', 'salt', 'claw',
    'berry', 'coconut', 'banana', 'mushroom', 'red_mushroom', 'potato', 'watermelon', 'jerky', 'canned', 'herb', 'bandage', 'medicine', 'bow', 'arrow', 'torch', 'lantern', 'rod', 'clay_pot',
    'backpack', 'sail', 'oar', 'compass', 'tube', 'antenna', 'battery', 'tmap', 'boot', 'gold', 'pearl', 'page', 'sword'];
  for (const k of simple) add(k, fromMap(MAPS[k]));
  add('fish', fromMap(MAPS.fish)); add('meat', fromMap(MAPS.meat)); add('crab_meat', fromMap(MAPS.crab_meat));
  add('cfish', tintC(ICON.fish, '#7a3a10', .45)); add('cmeat', tintC(ICON.meat, '#6a2a08', .4)); add('ccrab', tintC(ICON.crab_meat, '#c05020', .35));
  add('cmushroom', tintC(ICON.mushroom, '#5a2a08', .35)); add('cpotato', tintC(ICON.potato, '#7a3a10', .35));
  const bowls = { bowl: '#3b2a1e', dwater: '#7a8a3a', cwater: '#9fe0f4', swater: '#2b8e9e', soup: '#f0b050', stew: '#b0502a' };
  for (const k in bowls) add(k, fromMap(MAPS.bowl, { '~': bowls[k] }));
  add('bseed', fromMap(MAPS.seed, { '#': '#d94a4a' })); add('mseed', fromMap(MAPS.seed, { '#': '#1e6b3c' }));
  const mat = { s: { '#': '#a0a8b4', '%': '#59616b' }, i: { '#': '#e0e6ec', '%': '#7a838e' } };
  add('axe_s', fromMap(MAPS.axe, mat.s)); add('axe_i', fromMap(MAPS.axe, mat.i));
  add('pick_s', fromMap(MAPS.pick, mat.s)); add('pick_i', fromMap(MAPS.pick, mat.i));
  add('shovel', fromMap(MAPS.shovel, mat.s)); add('hammer', fromMap(MAPS.hammer, mat.s));
  add('spear_w', fromMap(MAPS.spear, { '#': '#c98e4f', '%': '#8f5a32' })); add('spear_s', fromMap(MAPS.spear, { '#': '#3a3f4a', '%': '#5f574f' }));
  add('armor_leaf', fromMap(MAPS.armor, { '#': '#4a8f3a', '%': '#2d5a27', '*': '#7cc35a' }));
  add('armor_fur', fromMap(MAPS.armor, { '#': '#9c6a48', '%': '#6b4226', '*': '#d9b38c' }));
  add('armor_bone', fromMap(MAPS.armor, { '#': '#ece2cc', '%': '#a89f8c', '*': '#6b4226' }));
  add('armor_iron', fromMap(MAPS.armor, { '#': '#c8d0d8', '%': '#59616b', '*': '#ffec27' }));
  add('tablet_a', fromMap(MAPS.tablet, { '*': '#ffec27' })); add('tablet_b', fromMap(MAPS.tablet, { '*': '#9fe0f4' })); add('tablet_c', fromMap(MAPS.tablet, { '*': '#c48ef0' }));
  // 設置物はワールドのスプライトから
  const fromSpr = { '@campfire': 'campfire', '@workbench': 'workbench', '@bed': 'leafbed', '@chest': 'chest', '@collector': 'collector0', '@torchpost': 'torchpost', '@furnace': 'furnace', '@signal': 'signal', '@sos': 'sos', '@raft': 'raft' };
  for (const k in fromSpr) add(k, fitIcon(SPR[fromSpr[k]], 16));
  { const c = mkC(16, 16), x = cx2(c); R(x, 2, 3, 2, 12, 'h'); R(x, 12, 3, 2, 12, 'h'); R(x, 0, 6, 16, 2, 'j'); R(x, 0, 11, 16, 2, 'j'); add('@fence', outline(c)); }
  { const c = mkC(16, 16), x = cx2(c); R(x, 1, 3, 2, 12, 'h'); R(x, 13, 3, 2, 12, 'h'); R(x, 3, 5, 10, 9, 'j'); R(x, 3, 8, 10, 1, 'i'); R(x, 7, 5, 1, 9, 'i'); add('@gate', outline(c)); }
  for (const k in ICON) { try { ICONURL[k] = ICON[k].toDataURL(); } catch (e) { ICONURL[k] = ''; } }
}

// ---------- プレイヤー（手続き生成） ----------
// SPR.pl[dir][frame] dir:0上 1右 2下 3左, frame 0..3
function genPlayer() {
  const mk = (dir, fr) => {
    const c = mkC(16, 20), x = cx2(c);
    const step = fr === 1 ? 1 : fr === 3 ? -1 : 0;
    const bob = (fr === 1 || fr === 3) ? 1 : 0;
    const S = 'S', Sd = 'T', skin = 'v', skd = 'w', hair = 'x', pants = '#8a6a44';
    const y0 = 2 + bob;
    if (dir === 2 || dir === 0) {
      // 脚
      const lh = 3;
      R(x, 5, 15 + bob, 2, lh - (step > 0 ? 1 : 0), skd); R(x, 9, 15 + bob, 2, lh - (step < 0 ? 1 : 0), skd);
      R(x, 5, 13 + bob, 6, 2, pants);
      // 体
      R(x, 5, 8 + bob, 6, 5, S); R(x, 5, 12 + bob, 6, 1, Sd); if (dir === 2) { P(x, 7, 9 + bob, '#ffffff'); P(x, 8, 10 + bob, '#ffffff'); }
      // 腕
      R(x, 4, 8 + bob + (step > 0 ? 1 : 0), 1, 4, skin); R(x, 11, 8 + bob + (step < 0 ? 1 : 0), 1, 4, skin);
      // 頭
      R(x, 4, y0, 8, 6, skin);
      if (dir === 2) {
        R(x, 4, y0 - 1, 8, 3, hair); R(x, 3, y0, 1, 4, hair); R(x, 12, y0, 1, 4, hair); P(x, 4, y0 + 2, hair); P(x, 11, y0 + 2, hair);
        R(x, 4, y0 + 1, 8, 1, 'U'); P(x, 12, y0 + 2, 'U');
        P(x, 6, y0 + 3, '0'); P(x, 9, y0 + 3, '0'); P(x, 6, y0 + 4, skd); P(x, 9, y0 + 4, skd);
      } else {
        R(x, 3, y0 - 1, 10, 6, hair); R(x, 4, y0 + 1, 8, 1, 'U'); P(x, 7, y0 + 2, 'U'); P(x, 8, y0 + 3, 'U');
      }
    } else {
      // 横向き（右）
      const fx = (dir === 1);
      R(x, 6 + step, 15 + bob, 2, 3, skd); R(x, 8 - step, 15 + bob, 2, 3 - (step ? 1 : 0), '#a8693f');
      R(x, 5, 13 + bob, 6, 2, pants);
      R(x, 5, 8 + bob, 6, 5, S); R(x, 5, 12 + bob, 6, 1, Sd);
      R(x, 7 + step, 9 + bob, 2, 4, skin);
      R(x, 4, y0, 8, 6, skin);
      R(x, 4, y0 - 1, 7, 3, hair); R(x, 3, y0, 3, 5, hair);
      R(x, 4, y0 + 1, 8, 1, 'U'); P(x, 3, y0 + 2, 'U'); P(x, 2, y0 + 3, 'U');
      P(x, 9, y0 + 3, '0'); P(x, 11, y0 + 4, skd);
      if (!fx) { /* 左は反転で作る */ }
    }
    return outline(c, '#160f1c');
  };
  SPR.pl = [];
  for (let d = 0; d < 4; d++) {
    SPR.pl[d] = [];
    for (let f = 0; f < 4; f++) SPR.pl[d][f] = d === 3 ? flipH(mk(1, f)) : mk(d, f);
  }
  SPR.pl_white = SPR.pl.map(a => a.map(whiteC));
}

// ---------- ピクセル数字フォント ----------
const DIGITS = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
  '!': ['010', '010', '010', '000', '010'], '?': ['111', '001', '011', '000', '010'], 'z': ['111', '001', '010', '100', '111']
};
function drawNum(x, str, X, Y, col, sh) {
  str = String(str); let ox = X - Math.floor(str.length * 4 / 2);
  for (const ch of str) {
    const g = DIGITS[ch]; if (g) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '1') { if (sh) { x.fillStyle = sh; x.fillRect(ox + i + 1, Y + j + 1, 1, 1); } x.fillStyle = col; x.fillRect(ox + i, Y + j, 1, 1); }
    ox += 4;
  }
}

function buildAllSprites() { genTiles(); genObjSprites(); genIcons(); genPlayer(); }

// =====================================================================
//  DATA
// =====================================================================
const DIFF = [
  { n: 'やさしい', d: '空腹・渇きがゆるやか。倒れても持ち物を失わない。', drain: .65, dmg: .6, mobs: .8, keep: true },
  { n: 'ふつう', d: 'おすすめ。倒れると持ち物をその場に落とす。', drain: 1, dmg: 1, mobs: 1, keep: false },
  { n: 'きびしい', d: '過酷な島。消耗が早く、動物も凶暴。', drain: 1.3, dmg: 1.45, mobs: 1.3, keep: false },
];

// ---------- items ----------
const IT = {
  wood: { n: '木材', ic: 'wood', fuel: 90, d: '丈夫な木材。建築や道具作りの基本素材。たき火の燃料にもなる。' },
  stick: { n: '枝', ic: 'stick', fuel: 30, d: '細い木の枝。道具の柄や燃料に。' },
  fiber: { n: '植物繊維', ic: 'fiber', d: '草むらから取れる繊維。ねじればロープになる。' },
  stone: { n: '石', ic: 'stone', d: '手頃な大きさの石。' },
  flint: { n: '火打ち石', ic: 'flint', d: '鋭く割れる石。刃物や矢じりに。' },
  leaf: { n: '大きな葉', ic: 'leaf', fuel: 15, d: 'ヤシやシダの大きな葉。寝床や服の材料。' },
  clay: { n: '粘土', ic: 'clay', d: '水辺や沼で掘れる粘土。かまどや土鍋の材料。シャベルで掘る。' },
  iron_ore: { n: '鉄鉱石', ic: 'iron_ore', d: '鉄を含んだ鉱石。かまどで精錬できる。' },
  iron: { n: '鉄インゴット', ic: 'iron', d: '精錬した鉄。強力な道具の材料。' },
  coal: { n: '炭', ic: 'coal', fuel: 120, d: 'よく燃える。精錬に必要。' },
  rope: { n: 'ロープ', ic: 'rope', d: '繊維を編んだ丈夫なロープ。' },
  cloth: { n: '布', ic: 'cloth', d: '船から流れ着いた布。包帯や帆に使える。' },
  leather: { n: '毛皮', ic: 'leather', d: '動物の毛皮。暖かい服やかばんが作れる。' },
  bone: { n: '骨', ic: 'bone', d: '動物の骨。硬くて軽い。' },
  feather: { n: '羽根', ic: 'feather', d: '鳥の羽根。矢羽根になる。' },
  shell: { n: '貝殻', ic: 'shell', d: '大きな貝殻。2つで器になる。' },
  scrap: { n: '金属くず', ic: 'scrap', d: '船の残骸の金属片。溶かせば鉄になる。無線機の修理にも。' },
  crystal: { n: '水晶', ic: 'crystal', d: '洞窟の奥で光る結晶。鉄のつるはしで掘れる。' },
  resin: { n: '樹脂', ic: 'resin', fuel: 40, d: '木から取れるベタベタした樹脂。よく燃える。' },
  salt: { n: '塩', ic: 'salt', d: '海水を煮詰めた塩。干し肉作りに。' },
  claw: { n: '大バサミ', ic: 'claw', d: 'キングクラブの巨大なハサミ。島の王を倒した証。' },

  berry: { n: 'ベリー', ic: 'berry', eat: { h: 7, w: 3 }, d: '甘酸っぱい木の実。' },
  coconut: { n: 'ココナッツ', ic: 'coconut', st: 20, eat: { h: 6, w: 28 }, ret: 'bowl', d: '果汁で喉をうるおせる。飲んだ後の殻は器になる。' },
  banana: { n: 'バナナ', ic: 'banana', st: 20, eat: { h: 16, w: 2, sta: 15 }, d: '栄養満点。スタミナも回復。' },
  mushroom: { n: 'キノコ', ic: 'mushroom', st: 20, eat: { h: 5 }, d: '食べられるキノコ。焼くとおいしい。' },
  red_mushroom: { n: '赤いキノコ', ic: 'red_mushroom', st: 20, eat: { h: 2, poison: 12 }, d: '毒々しい色をしている…食べないほうがいい。' },
  potato: { n: 'いも', ic: 'potato', st: 30, eat: { h: 8 }, plant: 'potato', d: '野生のいも。畑に植えると増やせる。' },
  watermelon: { n: 'スイカ', ic: 'watermelon', st: 10, eat: { h: 20, w: 40 }, d: 'みずみずしい大玉。' },
  raw_fish: { n: '生魚', ic: 'fish', st: 20, eat: { h: 6, sick: .35 }, d: '生だとお腹を壊すかも。焼いて食べよう。' },
  raw_meat: { n: '生肉', ic: 'meat', st: 20, eat: { h: 7, sick: .5 }, d: '焼いて食べよう。塩があれば干し肉にもできる。' },
  crab_meat: { n: 'カニの身', ic: 'crab_meat', st: 20, eat: { h: 5, sick: .3 }, d: '焼くと香ばしい。' },
  cooked_fish: { n: '焼き魚', ic: 'cfish', st: 20, eat: { h: 28, hp: 4 }, d: 'こんがり焼けた魚。' },
  cooked_meat: { n: '焼き肉', ic: 'cmeat', st: 20, eat: { h: 38, hp: 6 }, d: 'ジューシーな焼き肉。' },
  cooked_crab: { n: '焼きガニ', ic: 'ccrab', st: 20, eat: { h: 24, hp: 5 }, d: '香ばしいカニ。' },
  cooked_mushroom: { n: '焼きキノコ', ic: 'cmushroom', st: 20, eat: { h: 12 }, d: '香りがいい。' },
  baked_potato: { n: '焼きいも', ic: 'cpotato', st: 20, eat: { h: 22, hp: 3 }, d: 'ほくほく。' },
  jerky: { n: '干し肉', ic: 'jerky', st: 20, eat: { h: 26 }, d: '長持ちする保存食。航海には欠かせない。' },
  fish_soup: { n: '魚のスープ', ic: 'soup', st: 10, eat: { h: 45, w: 30, hp: 15, fed: 150 }, ret: 'bowl', d: '体の芯から温まる。しばらく満腹効果。' },
  stew: { n: '肉じゃがシチュー', ic: 'stew', st: 10, eat: { h: 60, w: 25, hp: 25, fed: 220 }, ret: 'bowl', d: '島で一番のごちそう。長い満腹効果。' },
  canned: { n: '缶詰', ic: 'canned', st: 20, eat: { h: 30, w: 8 }, d: '船の積み荷。文明の味。' },

  bowl: { n: '器', ic: 'bowl', st: 20, d: '水をくむ容器。水辺や雨水集め器の前で使う。' },
  dirty_water: { n: '汚れた水', ic: 'dwater', st: 20, eat: { w: 22, sick: .4 }, ret: 'bowl', d: 'そのままだとお腹を壊すかも。たき火で煮沸しよう。' },
  clean_water: { n: 'きれいな水', ic: 'cwater', st: 20, eat: { w: 38 }, ret: 'bowl', d: '安全な飲み水。' },
  sea_water: { n: '海水', ic: 'swater', st: 20, eat: { w: -15 }, ret: 'bowl', d: '飲むと逆に喉が渇く。たき火で煮詰めると塩になる。' },

  berry_seed: { n: 'ベリーの種', ic: 'bseed', st: 30, plant: 'berry', d: '畑に植えるとベリーが実る。' },
  melon_seed: { n: 'スイカの種', ic: 'mseed', st: 30, plant: 'melon', d: '畑に植えるとスイカが育つ。時間がかかる。' },
  herb: { n: '薬草', ic: 'herb', st: 30, eat: { hp: 6, cure: 'poison' }, d: '苦いが毒消しの効果がある。' },
  bandage: { n: '包帯', ic: 'bandage', st: 20, eat: { hp: 30 }, d: '傷の手当てに。体力を30回復。' },
  medicine: { n: '薬', ic: 'medicine', st: 10, eat: { hp: 50, cure: 'all' }, d: '体力を大きく回復し、毒や腹痛を治す。' },

  stone_axe: { n: '石の斧', ic: 'axe_s', st: 1, dur: 90, tool: { cls: 'axe', tier: 1, pow: 2 }, dmg: 5, d: '木を切り倒せる。' },
  iron_axe: { n: '鉄の斧', ic: 'axe_i', st: 1, dur: 260, tool: { cls: 'axe', tier: 2, pow: 5 }, dmg: 9, d: 'よく切れる鉄の斧。' },
  stone_pick: { n: '石のつるはし', ic: 'pick_s', st: 1, dur: 90, tool: { cls: 'pick', tier: 1, pow: 2 }, dmg: 4, d: '岩や鉱石を掘れる。' },
  iron_pick: { n: '鉄のつるはし', ic: 'pick_i', st: 1, dur: 260, tool: { cls: 'pick', tier: 2, pow: 5 }, dmg: 7, d: '大岩や水晶も掘れる。' },
  shovel: { n: 'シャベル', ic: 'shovel', st: 1, dur: 120, tool: { cls: 'shovel', tier: 1, pow: 3 }, dmg: 3, d: '粘土やいもを掘る。草地を耕して畑にできる。宝探しにも。' },
  hammer: { n: 'ハンマー', ic: 'hammer', st: 1, dur: 150, tool: { cls: 'hammer', tier: 1, pow: 99 }, dmg: 4, d: '設置した物を一瞬で解体してアイテムに戻す。（素手でもⒶ長押しで回収できる）' },
  fishing_rod: { n: '釣り竿', ic: 'rod', st: 1, dur: 60, rod: true, dmg: 1, d: '水辺で使うと釣りができる。' },
  torch: { n: 'たいまつ', ic: 'torch', st: 10, dur: 150, light: 78, burn: true, dmg: 3, d: '持っている間、周りを照らす。燃え尽きるとなくなる。' },
  lantern: { n: 'ランタン', ic: 'lantern', st: 1, light: 104, dmg: 2, d: '水晶の光で周りを明るく照らす。燃え尽きない。' },
  clay_pot: { n: '土鍋', ic: 'clay_pot', st: 1, d: '持っていると、たき火でスープやシチューが作れる。' },
  wood_spear: { n: '木の槍', ic: 'spear_w', st: 1, dur: 70, dmg: 7, reach: 24, spd: .32, weapon: 1, d: 'リーチの長い武器。' },
  stone_spear: { n: '石の槍', ic: 'spear_s', st: 1, dur: 110, dmg: 10, reach: 24, spd: .32, weapon: 1, d: '火打ち石の穂先がついた槍。' },
  iron_sword: { n: '鉄の剣', ic: 'sword', st: 1, dur: 320, dmg: 16, reach: 19, spd: .22, weapon: 1, d: '素早く振れる強力な剣。' },
  bow: { n: '弓', ic: 'bow', st: 1, dur: 150, bow: true, dmg: 2, d: '矢を持っていると遠くの敵を撃てる。' },
  arrow: { n: '矢', ic: 'arrow', d: '弓で撃つ。' },

  leaf_armor: { n: '葉っぱの服', ic: 'armor_leaf', st: 1, armor: { def: 1, warm: 4, rain: .5 }, d: '防御+1。雨に濡れにくくなる。' },
  fur_armor: { n: '毛皮の服', ic: 'armor_fur', st: 1, armor: { def: 3, warm: 24, rain: .8 }, d: '防御+3。とても暖かい。' },
  bone_armor: { n: '骨の鎧', ic: 'armor_bone', st: 1, armor: { def: 6, warm: 8, rain: 1 }, d: '防御+6。' },
  iron_armor: { n: '鉄の鎧', ic: 'armor_iron', st: 1, armor: { def: 10, warm: 6, rain: 1 }, d: '防御+10。島で最強の守り。' },
  backpack: { n: '毛皮のかばん', ic: 'backpack', st: 1, upgrade: 'bag', d: '使うと持ち物の枠が8つ増える。' },

  campfire: { n: 'たき火', ic: '@campfire', st: 10, place: 'campfire', d: '料理・煮沸ができ、暖かく明るい。燃料をくべて維持しよう。' },
  workbench: { n: '作業台', ic: '@workbench', st: 5, place: 'workbench', d: '近くにいると高度なクラフトができる。' },
  leaf_bed: { n: '葉っぱの寝床', ic: '@bed', st: 5, place: 'bed', d: '夜に眠って朝まで休める。復活地点になる。' },
  chest: { n: '収納箱', ic: '@chest', st: 5, place: 'chest', d: 'アイテムを20個まで保管できる。' },
  collector: { n: '雨水集め器', ic: '@collector', st: 5, place: 'collector', d: '雨が降るときれいな水がたまる。器で汲もう。' },
  fence: { n: '木の柵', ic: '@fence', place: 'fence', d: '動物の侵入を防ぐ。' },
  gate: { n: '柵の扉', ic: '@gate', st: 20, place: 'gate', d: 'プレイヤーだけが通り抜けられる柵。動物は通れない。' },
  torch_post: { n: '松明台', ic: '@torchpost', st: 20, place: 'torch_post', d: '燃え尽きない明かり。夜の拠点に。' },
  furnace: { n: 'かまど', ic: '@furnace', st: 5, place: 'furnace', d: '鉄の精錬や土鍋づくりができる。' },
  signal_fire: { n: 'のろし台', ic: '@signal', st: 1, place: 'signal', d: '山頂に設置できる。船が見えたら火をつけよう。' },
  sos: { n: 'SOSサイン', ic: '@sos', st: 5, place: 'sos', d: '砂浜に設置する救難サイン。' },
  raft_frame: { n: 'いかだの土台', ic: '@raft', st: 1, place: 'raft', d: '砂浜に接した浅瀬に設置する。' },

  sail: { n: '帆', ic: 'sail', st: 5, d: 'いかだの帆。' },
  oar: { n: 'オール', ic: 'oar', st: 10, d: 'いかだを漕ぐ。' },
  compass: { n: '方位磁針', ic: 'compass', st: 5, d: '海の上で方角を知る。航海に必須。' },
  tube: { n: '真空管', ic: 'tube', st: 5, key: 1, d: '古い無線機の部品。' },
  antenna: { n: 'アンテナ', ic: 'antenna', st: 5, key: 1, d: '遺跡に祀られていた金属の棒。' },
  battery: { n: 'バッテリー', ic: 'battery', st: 5, key: 1, d: '救命ボートに積まれていた無線機用バッテリー。' },
  tablet_a: { n: '太陽の石版', ic: 'tablet_a', st: 5, key: 1, d: '太陽の紋様が刻まれた石版。' },
  tablet_b: { n: '月の石版', ic: 'tablet_b', st: 5, key: 1, d: '月の紋様が刻まれた石版。' },
  tablet_c: { n: '星の石版', ic: 'tablet_c', st: 5, key: 1, d: '星の紋様が刻まれた石版。' },
  boot: { n: '古い長靴', ic: 'boot', st: 10, d: '釣れてしまった。…何に使おう。' },
  gold: { n: '金貨', ic: 'gold', st: 99, d: '古い金貨。この島では何も買えない。' },
  pearl: { n: '真珠', ic: 'pearl', st: 20, d: '美しい真珠。' },
};
for (let i = 0; i < 6; i++) IT['tmap' + i] = { n: '宝の地図 #' + (i + 1), ic: 'tmap', st: 1, tmap: i, d: '使うと地図に宝のありかが記される。シャベルで掘ろう。' };
for (const k in IT) { const it = IT[k]; it.id = k; if (it.st == null) it.st = 50; }

// ---------- world objects ----------
// solid:当たり判定, box:[x0,y0,x1,y1](タイル内), hp/tool/tier:破壊, drops:[id,min,max,prob], use:調べる処理
const OB = {
  tree: { n: '木', solid: 1, box: [5, 9, 11, 16], hp: 8, tool: 'axe', tier: 1, drops: [['wood', 2, 3], ['stick', 1, 2], ['resin', 1, 1, .3], ['leaf', 0, 1, .3]], hand: 'stick', regrow: 1, snd: 'chop', mc: '#2d5a27' },
  pine: { n: '針葉樹', solid: 1, box: [5, 9, 11, 16], hp: 8, tool: 'axe', tier: 1, drops: [['wood', 2, 3], ['resin', 1, 2, .7]], hand: 'stick', regrow: 1, snd: 'chop', mc: '#2d5a27' },
  palm: { n: 'ヤシの木', solid: 1, box: [5, 9, 11, 16], hp: 6, tool: 'axe', tier: 1, drops: [['wood', 1, 2], ['leaf', 2, 3]], use: 'palm', regrow: 1, snd: 'chop', mc: '#4a8f3a' },
  banana_tree: { n: 'バナナの木', solid: 1, box: [5, 9, 11, 16], hp: 4, tool: 'axe', tier: 1, drops: [['leaf', 2, 3]], use: 'banana', regrow: 1, snd: 'chop', mc: '#4a8f3a' },
  bush: { n: 'ベリーの茂み', solid: 1, box: [2, 7, 14, 16], use: 'bush', mc: '#3a7a30' },
  grass: { n: '草むら', use: 'pick', drops: [['fiber', 1, 2], ['berry_seed', 1, 1, .06]], lbl: '刈る' },
  fern: { n: 'シダ', use: 'pick', drops: [['leaf', 1, 2], ['fiber', 0, 1, .5]], lbl: '刈る' },
  twig: { n: '落ち枝', use: 'pick', drops: [['stick', 1, 2]] },
  pebble: { n: '小石', use: 'pick', drops: [['stone', 1, 2], ['flint', 1, 1, .3]] },
  shell_o: { n: '貝殻', use: 'pick', drops: [['shell', 1, 1]] },
  driftwood: { n: '流木', use: 'pick', drops: [['wood', 1, 2], ['stick', 0, 1]] },
  flower: { n: '花', deco: 1 },
  mushroom_o: { n: 'キノコ', use: 'pick', drops: [['mushroom', 1, 1]] },
  red_mushroom_o: { n: '赤いキノコ', use: 'pick', drops: [['red_mushroom', 1, 1]] },
  herb_o: { n: '薬草', use: 'pick', drops: [['herb', 1, 2]] },
  potato_o: { n: '野生のいも', use: 'pick', drops: [['potato', 1, 2]], lbl: '掘る' },
  clay_o: { n: '粘土層', hp: 3, tool: 'shovel', tier: 1, drops: [['clay', 2, 3]], snd: 'dig', mc: '#b0643c' },
  rock: { n: '岩', solid: 1, box: [1, 5, 15, 16], hp: 8, tool: 'pick', tier: 1, drops: [['stone', 2, 3], ['flint', 0, 1, .5]], snd: 'mine', mc: '#6c7380' },
  iron_rock: { n: '鉄鉱石の岩', solid: 1, box: [1, 5, 15, 16], hp: 12, tool: 'pick', tier: 1, drops: [['iron_ore', 1, 2], ['stone', 1, 1]], snd: 'mine', mc: '#b0703a' },
  coal_rock: { n: '石炭の岩', solid: 1, box: [1, 5, 15, 16], hp: 9, tool: 'pick', tier: 1, drops: [['coal', 1, 2], ['stone', 0, 1]], snd: 'mine', mc: '#2c2633' },
  crystal_rock: { n: '水晶', solid: 1, box: [2, 4, 14, 16], hp: 12, tool: 'pick', tier: 2, drops: [['crystal', 1, 2]], snd: 'mine', light: 34, lc: '#c48ef0', mc: '#c48ef0' },
  boulder: { n: '大岩', solid: 1, box: [0, 2, 16, 16], hp: 24, tool: 'pick', tier: 2, drops: [['stone', 4, 6], ['iron_ore', 0, 2, .5]], snd: 'mine', mc: '#5f6570' },
  stump: { n: '切り株', hp: 3, tool: 'axe', tier: 1, drops: [['wood', 0, 1]], snd: 'chop' },
  sapling: { n: '若木', deco: 1 },
  crate: { n: '木箱', solid: 1, box: [1, 4, 15, 16], use: 'crate', lbl: '開ける' },
  bottle: { n: '漂着ビン', use: 'bottle', lbl: '拾う' },
  note: { n: '日記のページ', use: 'note', lbl: '読む', glow: 1 },
  old_pack: { n: '古いリュック', use: 'oldpack', lbl: '調べる', glow: 1 },
  old_raft: { n: '朽ちたいかだ', use: 'examine', txt: '朽ち果てたいかだの残骸だ。誰かがここから海に出ようとしたらしい…。' },
  wreck: { n: '難破船', solid: 1, box: [-8, 0, 24, 16], use: 'examine', txt: 'あなたが乗っていた客船の残骸だ。もう二度と浮かぶことはないだろう。', mc: '#6b4226' },
  lifeboat: { n: '救命ボート', solid: 1, box: [-4, 4, 20, 16], use: 'lifeboat', lbl: '調べる', mc: '#ff7a1a' },
  milcrate: { n: '軍の物資箱', solid: 1, box: [0, 4, 16, 16], use: 'milcrate', lbl: '開ける', mc: '#5d6b2a' },
  cave_in: { n: '洞窟の入口', solid: 1, box: [0, 0, 16, 12], use: 'cave_in', lbl: '入る', mc: '#120d18' },
  cave_out: { n: '出口', use: 'cave_out', lbl: '外に出る', mc: '#fff4c8' },
  shrine: { n: '山頂の祠', solid: 1, box: [1, 6, 15, 16], use: 'shrine', lbl: '調べる', mc: '#d94a4a' },
  altar: { n: '石の祭壇', solid: 1, box: [-6, 4, 22, 16], use: 'altar', lbl: '調べる', mc: '#a0a8b4' },
  rdoor: { n: '遺跡の扉', solid: 1, use: 'rdoor', lbl: '調べる', mc: '#8a7f9a' },
  pillar: { n: '石柱', solid: 1, box: [3, 8, 13, 16], use: 'examine', txt: '苔むした石柱。不思議な文字が刻まれている。', mc: '#a0a8b4' },
  statue: { n: '石像', solid: 1, box: [2, 6, 14, 16], use: 'examine', txt: '海を見つめる石像。どこか寂しげな顔をしている。', mc: '#a0a8b4' },
  pedestal: { n: '台座', solid: 1, box: [2, 4, 14, 16], use: 'pedestal', lbl: '調べる', mc: '#a0a8b4' },
  radio: { n: '古い無線機', solid: 1, box: [1, 4, 15, 16], use: 'radio', lbl: '調べる', mc: '#c8d0d8' },
  heli: { n: '救助ヘリ', solid: 1, box: [-16, 4, 32, 16], use: 'heli', lbl: '乗り込む', mc: '#d94a4a' },
  bag: { n: '落とし物', use: 'bag', lbl: '拾う', glow: 1 },
  crop: { n: '作物', use: 'crop', lbl: '収穫' },
  // ---- 設置物 (pl:1 はハンマーで解体可能) ----
  campfire: { n: 'たき火', solid: 1, box: [1, 6, 15, 16], use: 'campfire', pl: 1, item: 'campfire', lbl: '使う', mc: '#ff7a1a' },
  workbench: { n: '作業台', solid: 1, box: [0, 4, 16, 16], use: 'workbench', pl: 1, item: 'workbench', lbl: 'クラフト', mc: '#c98e4f' },
  bed: { n: '寝床', solid: 0, use: 'bed', pl: 1, item: 'leaf_bed', lbl: '眠る', mc: '#7cc35a' },
  old_bed: { n: '古いベッド', solid: 1, box: [0, 4, 16, 16], use: 'bed', lbl: '眠る', mc: '#3d74b8' },
  chest: { n: '収納箱', solid: 1, box: [1, 5, 15, 16], use: 'chest', pl: 1, item: 'chest', lbl: '開ける', mc: '#c98e4f' },
  rchest: { n: '古代の箱', solid: 1, box: [1, 5, 15, 16], use: 'chest', lbl: '開ける', mc: '#d4a83a' },
  collector: { n: '雨水集め器', solid: 1, box: [2, 6, 14, 16], use: 'collector', pl: 1, item: 'collector', lbl: '水を汲む', mc: '#5ec8e8' },
  fence: { n: '木の柵', solid: 1, pl: 1, item: 'fence', mc: '#8f5a32' },
  gate: { n: '柵の扉', solid: 1, mobOnly: 1, pl: 1, item: 'gate', mc: '#a07040' },
  torch_post: { n: '松明台', solid: 1, box: [5, 8, 11, 16], pl: 1, item: 'torch_post', light: 70, mc: '#ffe08a' },
  furnace: { n: 'かまど', solid: 1, box: [1, 4, 15, 16], use: 'furnace', pl: 1, item: 'furnace', lbl: '使う', mc: '#a0a8b4' },
  signal: { n: 'のろし台', solid: 1, box: [0, 4, 16, 16], use: 'signal', pl: 1, item: 'signal_fire', lbl: '調べる', mc: '#ff7a1a' },
  sos: { n: 'SOSサイン', pl: 1, item: 'sos', mc: '#d9dde2' },
  raft: { n: 'いかだ', solid: 1, box: [-4, 2, 20, 16], use: 'raft', pl: 1, item: 'raft_frame', lbl: '調べる', mc: '#c98e4f' },
};
for (const k in OB) OB[k].id = k;

// ---------- crops ----------
const CROPS = {
  potato: { n: 'いも', days: 2, out: [['potato', 3, 4]], col: '#7cc35a', fruit: '#c98e4f' },
  berry: { n: 'ベリー', days: 1.5, out: [['berry', 3, 5], ['berry_seed', 1, 2]], col: '#4a8f3a', fruit: '#d94a4a' },
  melon: { n: 'スイカ', days: 3, out: [['watermelon', 1, 2], ['melon_seed', 1, 2]], col: '#3fd64e', fruit: '#1e6b3c' },
};

// ---------- mobs ----------
const MB = {
  crab: { n: 'カニ', hp: 8, spd: 26, dmg: 4, r: 6, ai: 'neutral', land: 0, spr: 'crab', drops: [['crab_meat', 1, 2], ['shell', 1, 1, .35]] },
  boar: { n: 'イノシシ', hp: 22, spd: 40, dmg: 10, r: 7, ai: 'charger', land: 1, spr: 'boar', drops: [['raw_meat', 1, 2], ['leather', 1, 1, .8], ['bone', 1, 1, .5]] },
  snake: { n: 'ヘビ', hp: 10, spd: 30, dmg: 5, r: 6, ai: 'aggro', aggro: 58, poison: 9, land: 1, spr: 'snake', drops: [['raw_meat', 1, 1, .5]] },
  monkey: { n: 'サル', hp: 12, spd: 52, dmg: 4, r: 6, ai: 'ranged', land: 1, spr: 'monkey', drops: [['banana', 1, 1, .5], ['leather', 1, 1, .3]] },
  gull: { n: 'カモメ', hp: 4, spd: 36, dmg: 0, r: 5, ai: 'flee', land: 0, fly: 1, spr: 'gull', drops: [['feather', 1, 2], ['raw_meat', 1, 1, .3]] },
  wolf: { n: 'オオカミ', hp: 26, spd: 60, dmg: 8, r: 7, ai: 'aggro', aggro: 130, land: 1, night: 1, spr: 'wolf', drops: [['leather', 1, 1, .75], ['bone', 1, 2, .6], ['raw_meat', 1, 1, .5]] },
  bat: { n: 'コウモリ', hp: 6, spd: 56, dmg: 4, r: 5, ai: 'flyer', aggro: 110, fly: 1, spr: 'bat1', drops: [['feather', 1, 1, .25]] },
  spider: { n: '洞窟グモ', hp: 18, spd: 42, dmg: 7, r: 6, ai: 'aggro', aggro: 90, poison: 6, land: 1, spr: 'spider', drops: [['fiber', 1, 2], ['rope', 1, 1, .45]] },
  golem: { n: '古代の番人', hp: 320, spd: 22, dmg: 16, r: 12, ai: 'golem', boss: 1, land: 1, spr: 'golem', drops: [['tablet_b', 1, 1], ['crystal', 3, 5], ['iron', 3, 4]] },
  kingcrab: { n: 'キングクラブ', hp: 240, spd: 30, dmg: 14, r: 13, ai: 'kingcrab', boss: 1, land: 0, spr: 'kingcrab', drops: [['claw', 1, 1], ['crab_meat', 4, 6], ['shell', 3, 5], ['pearl', 1, 2]] },
};

// ---------- recipes ----------
// s: hand=手作業 / bench=作業台 / fire=たき火 / furnace=かまど
const RC = [
  { o: 'rope', r: { fiber: 3 }, s: 'hand', c: 'mat' },
  { o: 'torch', r: { stick: 1, fiber: 1 }, s: 'hand', c: 'tool' },
  { o: 'stone_axe', r: { stick: 2, stone: 2, fiber: 2 }, s: 'hand', c: 'tool' },
  { o: 'stone_pick', r: { stick: 2, stone: 3, fiber: 2 }, s: 'hand', c: 'tool' },
  { o: 'wood_spear', r: { stick: 3, fiber: 1 }, s: 'hand', c: 'war' },
  { o: 'campfire', r: { stick: 3, stone: 4 }, s: 'hand', c: 'build' },
  { o: 'leaf_bed', r: { leaf: 6, fiber: 2 }, s: 'hand', c: 'build' },
  { o: 'workbench', r: { wood: 6, stick: 4 }, s: 'hand', c: 'build' },
  { o: 'bowl', r: { shell: 2 }, s: 'hand', c: 'mat' },
  { o: 'bandage', r: { cloth: 1, fiber: 1 }, s: 'hand', c: 'med' },
  { o: 'sos', r: { stone: 15 }, s: 'hand', c: 'esc' },

  { o: 'bowl', r: { wood: 2 }, s: 'bench', c: 'mat' },
  { o: 'stone_spear', r: { stick: 2, flint: 2, rope: 1 }, s: 'bench', c: 'war' },
  { o: 'fishing_rod', r: { stick: 3, rope: 2 }, s: 'bench', c: 'tool' },
  { o: 'shovel', r: { stick: 2, stone: 2, rope: 1 }, s: 'bench', c: 'tool' },
  { o: 'hammer', r: { stick: 2, stone: 3, rope: 1 }, s: 'bench', c: 'tool' },
  { o: 'bow', r: { stick: 3, rope: 2 }, s: 'bench', c: 'war' },
  { o: 'arrow', n: 4, r: { stick: 2, flint: 1, feather: 1 }, s: 'bench', c: 'war' },
  { o: 'chest', r: { wood: 8, rope: 1 }, s: 'bench', c: 'build' },
  { o: 'collector', r: { wood: 4, leaf: 4, rope: 1 }, s: 'bench', c: 'build' },
  { o: 'fence', n: 2, r: { wood: 2 }, s: 'bench', c: 'build' },
  { o: 'gate', r: { wood: 3, rope: 1 }, s: 'bench', c: 'build' },
  { o: 'torch_post', r: { wood: 2, stick: 2, resin: 1 }, s: 'bench', c: 'build' },
  { o: 'furnace', r: { stone: 12, clay: 6 }, s: 'bench', c: 'build' },
  { o: 'leaf_armor', r: { leaf: 8, fiber: 4 }, s: 'bench', c: 'war' },
  { o: 'fur_armor', r: { leather: 5, rope: 2 }, s: 'bench', c: 'war' },
  { o: 'bone_armor', r: { bone: 8, leather: 2, rope: 2 }, s: 'bench', c: 'war' },
  { o: 'backpack', r: { leather: 4, rope: 3 }, s: 'bench', c: 'tool' },
  { o: 'medicine', r: { herb: 3, clean_water: 1 }, s: 'bench', c: 'med' },
  { o: 'iron_axe', r: { stick: 2, iron: 3 }, s: 'bench', c: 'tool' },
  { o: 'iron_pick', r: { stick: 2, iron: 3 }, s: 'bench', c: 'tool' },
  { o: 'iron_sword', r: { stick: 1, iron: 4, leather: 1 }, s: 'bench', c: 'war' },
  { o: 'iron_armor', r: { iron: 10, leather: 4 }, s: 'bench', c: 'war' },
  { o: 'lantern', r: { iron: 2, crystal: 1, resin: 2 }, s: 'bench', c: 'tool' },
  { o: 'signal_fire', r: { wood: 20, stone: 10, leaf: 10 }, s: 'bench', c: 'esc' },
  { o: 'raft_frame', r: { wood: 30, rope: 10 }, s: 'bench', c: 'esc' },
  { o: 'sail', r: { cloth: 4, stick: 4, rope: 2 }, s: 'bench', c: 'esc' },
  { o: 'oar', r: { wood: 3, rope: 1 }, s: 'bench', c: 'esc' },
  { o: 'compass', r: { iron: 1, crystal: 1 }, s: 'bench', c: 'esc' },

  { o: 'iron', r: { iron_ore: 2, coal: 1 }, s: 'furnace', c: 'mat' },
  { o: 'iron', r: { scrap: 3, coal: 1 }, s: 'furnace', c: 'mat' },
  { o: 'coal', r: { wood: 2 }, s: 'furnace', c: 'mat' },
  { o: 'clay_pot', r: { clay: 4 }, s: 'furnace', c: 'tool' },

  { o: 'cooked_fish', r: { raw_fish: 1 }, s: 'fire', c: 'food' },
  { o: 'cooked_meat', r: { raw_meat: 1 }, s: 'fire', c: 'food' },
  { o: 'cooked_crab', r: { crab_meat: 1 }, s: 'fire', c: 'food' },
  { o: 'cooked_mushroom', r: { mushroom: 1 }, s: 'fire', c: 'food' },
  { o: 'baked_potato', r: { potato: 1 }, s: 'fire', c: 'food' },
  { o: 'clean_water', r: { dirty_water: 1 }, s: 'fire', c: 'food', noRet: 1 },
  { o: 'salt', r: { sea_water: 1 }, s: 'fire', c: 'food' },
  { o: 'jerky', r: { raw_meat: 1, salt: 1 }, s: 'fire', c: 'food' },
  { o: 'fish_soup', r: { raw_fish: 1, mushroom: 1, clean_water: 1 }, s: 'fire', c: 'food', tool: 'clay_pot', noRet: 1 },
  { o: 'stew', r: { raw_meat: 1, potato: 1, clean_water: 1 }, s: 'fire', c: 'food', tool: 'clay_pot', noRet: 1 },
];
RC.forEach((r, i) => { r.i = i; if (!r.n) r.n = 1; });
const RC_CATS = [['all', 'すべて'], ['tool', '道具'], ['war', '武器・防具'], ['build', '設置'], ['mat', '素材'], ['food', '料理'], ['med', '薬'], ['esc', '脱出']];
const STATION_N = { hand: '手作業', bench: '作業台', fire: 'たき火', furnace: 'かまど' };

// ---------- loot ----------
const LOOT = {
  wreck: [['cloth', 1, 3], ['rope', 1, 2], ['canned', 1, 1, .7], ['bandage', 1, 1, .4], ['scrap', 1, 2, .7], ['bowl', 1, 1, .5], ['melon_seed', 1, 2, .3], ['berry_seed', 1, 2, .3]],
  beach: [['cloth', 1, 2, .6], ['rope', 1, 2, .5], ['canned', 1, 1, .35], ['scrap', 1, 2, .6], ['bandage', 1, 1, .2], ['bowl', 1, 1, .25], ['melon_seed', 1, 2, .15], ['stick', 1, 3, .4]],
  treasure: [['gold', 4, 10], ['pearl', 1, 2, .6], ['iron', 2, 4, .7], ['crystal', 1, 2, .5], ['canned', 1, 2, .6], ['medicine', 1, 1, .5]],
  bottle: [['rope', 1, 2, .4], ['cloth', 1, 1, .4], ['melon_seed', 1, 2, .3], ['berry_seed', 1, 2, .3], ['bandage', 1, 1, .2]],
};

// ---------- story ----------
const PAGES = [null,
  { t: '漂着者へ', b: ['この島に流れ着いた誰かへ。', '俺の名は水野ケンジ。海洋調査船「かもめ丸」の乗組員だった。', '嵐で船が沈み、気がつけばこの浜に打ち上げられていた。', 'ここには誰もいない。助けも来ない。…少なくとも、待っているだけでは。', '生き延びるために学んだことを、このノートに残しておく。', 'どうか、君は帰ってくれ。'] },
  { t: '水と火', b: ['一番大事なのは水だ。海水は絶対に飲むな。喉が余計に渇くだけだ。', '池の水はそのままだと腹を壊す。器に汲んで、たき火で煮沸しろ。', 'ココナッツはありがたい。果汁を飲んだら、殻は器として使える。', '雨の日はチャンスだ。葉っぱで雨水を集める仕掛けを作れば、きれいな水が手に入る。', '夜は冷える。火のそばを離れるな。'] },
  { t: '石の遺跡', b: ['ジャングルの奥に、古い石の遺跡を見つけた。', '誰が造ったのかはわからない。中庭の祭壇には三つのくぼみがある。', '奥の扉には、太陽・月・星の紋様。', 'きっと三枚の石版をはめれば開くのだろう。', '太陽の石版は山頂の祠に祀られていた。月と星は…まだわからない。', '小屋の箱に、古い宝の地図をしまっておいた。何か関係があるかもしれない。'] },
  { t: '洞窟', b: ['山のふもとに洞窟がある。中は真っ暗だ。明かりなしでは一歩も進めない。', '壁には鉄鉱石や石炭が埋まっていた。', '奥へ行くほど、青白く光る水晶が増えていく。水晶は鉄のつるはしでないと掘れない。', 'コウモリとでかいクモには気をつけろ。毒をもらったら薬草を噛め。'] },
  { t: '相棒のリュック', b: ['相棒のサエキが沼地でヘビにかまれた。', '三日三晩うなされたが、薬草のおかげでなんとか助かった。', '薬草を3つ、きれいな水で練れば「薬」になる。作業台で作れる。', '回復したサエキは、自分で組んだいかだで先に島を出た。「必ず助けを呼んでくる」と言って。', 'このリュックは、あいつの置き土産だ。'] },
  { t: '山頂にて', b: ['山の頂上から海を見渡した。晴れた日には、水平線を船が横切っていくのが見える。', 'ここでのろしを上げれば、きっと気づいてもらえる。', '浜辺にSOSの文字を並べておけば、なおいい。', '…だがこの季節は霧が多い。俺が火を焚いたときには、いつも船は見えなかった。', '船が見えたら、すぐに火をつけろ。迷うな。'] },
  { t: '救命ボート', b: ['北の入り江に、かもめ丸の救命ボートが流れ着いているのを見つけた。', '中には無線機用のバッテリーが残っているはずだ。', 'だが入り江には、とんでもなくでかいカニが住みついている。王様気取りだ。', '今の装備じゃ近づくことすらできなかった。'] },
  { t: '番人', b: ['洞窟の最深部に、古い軍の物資箱があった。中身は無線機の部品かもしれない。', 'だが、その前に「番人」がいる。石でできた巨人だ。', '遺跡の民が造ったものなのだろうか。動きは遅いが、一撃が重い。', '赤い印が出たら、すぐに離れろ。', '鉄の武器と、十分な食料、そして回復の手段を持って挑め。'] },
  { t: '星の民', b: ['扉の奥は、遺跡の民の祈りの間だった。', '壁画によれば、彼らは星を頼りに海を渡り、この島を去ったらしい。', '祭壇には奇妙な金属の棒が祀られていた。これはアンテナに使えそうだ。', '真空管、アンテナ、バッテリー。三つがそろえば、小屋の無線機が生き返るかもしれない。'] },
  { t: '美緒へ', b: ['美緒へ。今日はお前の誕生日だな。十歳おめでとう。', '父さんはまだ帰れそうにない。でも、あきらめてはいない。', '明日、自分で組んだいかだで海に出る。星を見て、北へ進むつもりだ。', 'もしこのノートを誰かが拾ったなら、どうか娘に伝えてほしい。', '父さんは、最後まで帰ろうとしていたと。'] },
];
const TIPS = [
  '「夜はオオカミが出る。火のそばか、柵で囲った拠点にいろ」…走り書きのメモだ。',
  '「ヤシの木を素手で揺らすと、ココナッツが落ちてくる」と書かれている。',
  '「草むらを刈ると植物繊維が取れる。3つでロープになる」と書かれている。',
  '「生の肉や魚は腹を壊す。たき火で焼け」と書かれている。',
  '「イノシシは怒らせると突進してくる。横に避けろ」と書かれている。',
  '「海水を器に汲んでたき火で煮詰めると塩が取れる。塩と生肉で干し肉ができる」と書かれている。',
  '「寒さは体力を奪う。毛皮の服は暖かい」と書かれている。',
  '「ハンマーがあれば、建てた物を材料に戻せる」と書かれている。',
  '「サルは木の実を投げてくる。遠くからでも油断するな」と書かれている。',
  '「嵐のあとの浜辺には、いろいろな物が流れ着く」と書かれている。',
];

const ENDINGS = {
  A: { t: 'END A「大海原へ」', b: ['いかだは波を越え、三日三晩、海をさまよった。', '四日目の朝、水平線の向こうに漁船の影が見えた。', '力いっぱい手を振るあなたに、汽笛が応えた。', '―― あなたは、自らの手で島を脱出した。'] },
  B: { t: 'END B「のろしの約束」', b: ['山頂から立ちのぼる煙に、船が進路を変えた。', '浜辺に並べたSOSの文字を、甲板の船員が指さしている。', '小さなボートが近づいてくる。あなたは砂浜を駆けだした。', '―― 島の空に上がった煙は、確かに届いた。'] },
  C: { t: 'END C「遠い声」', b: ['ノイズの向こうから、確かに人の声が聞こえた。', '約束どおり、救助のヘリコプターが小屋の前に降り立った。', '機内から島を見下ろす。ケンジが遺した日記を、あなたは強く抱きしめた。', '―― 遠い声は、島と世界をつないだ。'] },
  TRUE: { t: 'EPILOGUE「帰還」', b: ['数ヶ月後。あなたはケンジの日記を手に、ある港町を訪れた。', '出迎えたのは、水野美緒と名乗る女性だった。', '「父は…12年前、漂流しているところを漁船に助けられたんです。」', '「でも、島でのことは何も覚えていなくて。」', '奥の部屋から、白髪まじりの男性が顔を出す。', '日記を受け取った瞬間、その目に光が戻った。', '「…ああ。サエキは、ちゃんと帰れたかな」', '―― 全ての記録が、持ち主のもとへ帰った。'] },
};

// ---------- 実績 ----------
const ACH = [
  ['start', '漂着', '島に流れ着いた'],
  ['craft1', 'はじめての道具', '初めてアイテムを作った'],
  ['fire', '文明の火', 'たき火を設置した'],
  ['night1', '夜を越えて', '最初の夜を生き延びた'],
  ['day10', 'サバイバー', '10日間生き延びた'],
  ['day30', '島の主', '30日間生き延びた'],
  ['lumber', '木こり', '木を30本切り倒した'],
  ['miner', '採掘者', '岩を30個掘った'],
  ['cook', '島の料理人', '料理を30回作った'],
  ['stew', '島のごちそう', 'シチューかスープを食べた'],
  ['fish1', '釣り人', '魚を10匹釣った'],
  ['bigfish', '大物', '大物を釣り上げた'],
  ['boot', 'ハズレ', '古い長靴を釣った'],
  ['hunter', '狩人', '動物を30匹倒した'],
  ['iron', '鉄器時代', '鉄インゴットを作った'],
  ['builder', '建築家', '設置物を30個置いた'],
  ['farmer', '農家', '作物を10回収穫した'],
  ['treasure', 'トレジャーハンター', '宝を3つ掘り当てた'],
  ['ruins', '扉の向こう', '遺跡の扉を開いた'],
  ['golem', '番人を越えし者', '古代の番人を倒した'],
  ['kingcrab', 'カニの王', 'キングクラブを倒した'],
  ['pages', '記録者', '日記のページを全て集めた'],
  ['endA', '大海原へ', 'END Aを見た'],
  ['endB', 'のろしの約束', 'END Bを見た'],
  ['endC', '遠い声', 'END Cを見た'],
  ['endT', '帰還', '真のエピローグを見た'],
];

// ---------- メイン目標 ----------
const QUESTS = [
  { t: '流れ着いた砂浜', d: '浜辺に流れ着いた木箱を調べてみよう。', items: g => [['木箱を開ける', Math.min(1, g.stats.crates), 1]] },
  { t: '材料集め', d: '石の斧の材料を集めよう。落ち枝・小石は拾うだけ。植物繊維は草むらを刈ると取れる。', items: g => { const d = g.flags.made_stone_axe; return [qm('枝', 'stick', 3, d), qm('石', 'stone', 3, d), qm('植物繊維', 'fiber', 2, d)]; } },
  { t: '最初の道具', d: 'クラフト画面で「石の斧」を作ろう。', items: g => [['石の斧を作る', g.flags.made_stone_axe ? 1 : 0, 1]] },
  { t: '火をおこそう', d: '斧で木を切ると枝が取れる。たき火を作って、置きたい場所に向かって使おう。', items: g => { const d = g.flags.placed_campfire, m = d || g.flags.made_campfire; return [qm('枝', 'stick', 3, m), qm('石', 'stone', 4, m), ['たき火を設置する', d ? 1 : 0, 1]]; } },
  { t: '水の確保', d: 'ヤシの木を素手で揺らすとココナッツが落ちる。または器で池の水を汲み、たき火で煮沸しよう。', any: 1, items: g => [['ココナッツを飲む', g.flags.drank_coconut ? 1 : 0, 1], ['きれいな水を作る', (g.flags.gotclean || g.flags.boiled || g.flags.safe_drink) ? 1 : 0, 1]] },
  { t: '夜に備えて', d: '大きな葉はシダを刈るか、ヤシの木を切ると取れる。寝床で眠ると朝になり、セーブされる。', items: g => { const d = g.flags.placed_bed, m = d || g.flags.made_leaf_bed; return [qm('大きな葉', 'leaf', 6, m), qm('植物繊維', 'fiber', 2, m), ['寝床を設置する', d ? 1 : 0, 1]]; } },
  { t: '作業台', d: '木材は斧で木を切り倒すと取れる。作業台のそばでは作れる物が一気に増える。', items: g => { const d = g.flags.placed_workbench, m = d || g.flags.made_workbench; return [qm('木材', 'wood', 6, m), qm('枝', 'stick', 4, m), ['作業台を設置する', d ? 1 : 0, 1]]; } },
  { t: '島の探索', d: '島の内陸に誰かの小屋があるらしい。地図で点滅している目印を目指そう。', items: g => [['ケンジの小屋を見つける', g.pois.hut && g.pois.hut.found ? 1 : 0, 1]], target: g => g.pois.hut },
  { t: 'ケンジの日記', d: '小屋の中に残された日記を読もう。', items: g => [['日記を読む', g.pages[1] ? 1 : 0, 1]], target: g => g.pois.hut },
  { t: '島からの脱出', d: '3つの脱出ルートのどれかを達成しよう。', items: g => [], final: 1 },
];
// 目標の項目 [表示名, 現在, 必要数]。done が真なら達成扱い
function qm(label, id, need, done) { return [label, done ? need : Math.min(need, cnt(id)), need]; }
function qProg(q) { const it = q.items(G); return { it, ok: q.any ? it.some(x => x[1] >= x[2]) : (it.length > 0 && it.every(x => x[1] >= x[2])) }; }

const HELP = [
  ['目的', '無人島で生き延び、脱出の方法を見つけよう。脱出ルートは「いかだ」「のろし」「無線」の3つ。島に残された日記が手がかりになる。'],
  ['ステータス', '体力・空腹・水分・スタミナ・体温に気をつけよう。空腹か水分が0になると体力が減っていく。夜や雨は体が冷える。たき火のそばは暖かい。'],
  ['基本操作', 'Ⓐ：調べる／採取／攻撃／使う　Ⓑ：長押しでダッシュ（メニューでは戻る）　Ⓧ：バッグ　Ⓨ：クラフト。ホットバーで手に持つ物を選び、Ⓐで使う。'],
  ['キーボード', '移動：WASD／矢印　Ⓐ：Space／J／Z　Ⓑ（ダッシュ）：Shift／K　バッグ：Bキー／I／Tab　クラフト：C　地図：M　メニュー：Esc　持ち物切替：1〜8、Q／E、ホイール'],
  ['コントローラー', '移動：左スティック／十字キー　A：アクション　B：ダッシュ／戻る　X：バッグ　Y：クラフト　LB／RB：持ち物切替（メニューではタブ切替）　START：メニュー　SELECT：地図'],
  ['道具と採取', '木は斧、岩はつるはし、粘土はシャベルで。素手でも草むら・落ち枝・小石は拾える。素手で木を叩くと枝、ヤシを揺らすとココナッツが落ちる。'],
  ['設置物の回収', '自分で置いた物（たき火・柵・収納箱など）は、Ⓐを長押しすると回収してアイテムに戻せる。中に入っていた物はその場に落ちる。ハンマーを持っていれば一瞬で解体できる。'],
  ['水', '器を持って水辺でⒶ。池の水は汚れているので、たき火で煮沸しよう。海水は煮詰めると塩になる。雨水集め器の水はそのまま飲める。'],
  ['料理と設備', 'たき火のそばで「料理」タブのレシピが作れる。作業台・かまどのそばでもそれぞれのレシピが解放される。たき火は燃料（木材や枝）を持ってⒶでくべる。'],
  ['夜と眠り', '夜はオオカミが出て危険。寝床で眠ると朝まで休めて、自動でセーブされる。寝床は倒れたときの復活地点になる。'],
  ['釣り', '釣り竿を持って水辺でⒶ。浮きが沈んで「!」が出たらⒶ。動くバーが緑の範囲に来たときにⒶで釣り上げる。'],
  ['畑', 'シャベルで草地を耕すと畑になる。いも・種を持って畑にⒶで植えられる。雨の日はよく育つ。'],
  ['セーブ', '眠ると自動セーブ。メニューの「システム」からいつでもセーブできる。セーブ枠は3つ。'],
];

// =====================================================================
//  WORLD
// =====================================================================
function newMap(id, w, h, fill, oob) {
  const m = { id, w, h, oob, t: new Uint8Array(w * h), o: new Array(w * h).fill(null), seen: new Uint8Array(w * h), ents: [], drops: [], img: null };
  m.t.fill(fill); return m;
}
const inB = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
const tAt = (m, x, y) => inB(m, x, y) ? m.t[y * m.w + x] : m.oob;
const oAt = (m, x, y) => inB(m, x, y) ? m.o[y * m.w + x] : null;
function setO(m, x, y, o) { if (!inB(m, x, y)) return; m.o[y * m.w + x] = o; m.litDirty = true; r3ObjChanged(m, x, y); if (o) { o.x = x; o.y = y; } if (m.seen[y * m.w + x]) mmPaint(m, x, y); }
function delO(m, x, y) { setO(m, x, y, null); }
function setT(m, x, y, t) { if (!inB(m, x, y)) return; m.t[y * m.w + x] = t; r3TileChanged(m, x, y); if (m.seen[y * m.w + x]) mmPaint(m, x, y); }
const isWater = t => t === T.DEEP || t === T.SHALLOW || t === T.FRESH;
const isSolidT = t => !!(TINFO[t] && TINFO[t].solid);
const walkT = t => !isSolidT(t);                     // プレイヤーが歩けるタイル
const landT = t => walkT(t) && !isWater(t);          // 陸地
function mkO(k, extra) {
  const o = { k };
  if (k === 'tree') o.v = randi(0, 2);
  if (k === 'palm') { o.v = randi(0, 1); o.c = randi(0, 2); }
  if (k === 'bush' || k === 'banana_tree') o.r = 1;
  if (k === 'rock') o.v = randi(0, 1);
  if (k === 'flower') o.v = randi(0, 3);
  return extra ? Object.assign(o, extra) : o;
}

// ---------- noise ----------
function makeNoise(Rn) {
  const N = 256, P2 = new Float32Array(N * N); for (let i = 0; i < P2.length; i++) P2[i] = Rn();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const g = (i, j) => P2[((j & 255) << 8) | (i & 255)];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, x, y, oct) { let s = 0, a = 1, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; t += a; a *= .5; f *= 2; } return s / t; }

// ---------- BFS ----------
function bfs(m, sx, sy, pass) {
  const N = m.w * m.h, dist = new Int32Array(N).fill(-1), prev = new Int32Array(N).fill(-1), q = new Int32Array(N);
  if (!inB(m, sx, sy)) return { dist, prev };
  let h = 0, t = 0; const s = sy * m.w + sx; dist[s] = 0; q[t++] = s;
  while (h < t) {
    const i = q[h++], x = i % m.w, y = (i / m.w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRV[d].x, ny = y + DIRV[d].y; if (!inB(m, nx, ny)) continue;
      const j = ny * m.w + nx; if (dist[j] >= 0 || !pass(nx, ny, j)) continue;
      dist[j] = dist[i] + 1; prev[j] = i; q[t++] = j;
    }
  }
  return { dist, prev };
}
function carvePath(m, B, tx, ty) { // BFS結果を使い、目的地までの経路上の障害物(自然物)を除去
  let i = ty * m.w + tx; if (B.dist[i] < 0) return false;
  let guard = 0;
  while (i >= 0 && guard++ < 100000) {
    const x = i % m.w, y = (i / m.w) | 0; const o = m.o[i];
    if (o && OB[o.k].solid && !OB[o.k].use && !OB[o.k].pl) m.o[i] = null;
    if (o && (o.k === 'bush' || o.k === 'palm' || o.k === 'banana_tree' || o.k === 'crate')) { if (OB[o.k].solid) m.o[i] = null; }
    i = B.prev[i];
  }
  return true;
}
function freeNear(m, x, y, pred, maxR) { // (x,y)近くで条件を満たすタイルを探す
  maxR = maxR || 8;
  for (let r = 0; r <= maxR; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
    const nx = x + i, ny = y + j; if (inB(m, nx, ny) && pred(nx, ny)) return { x: nx, y: ny };
  }
  return null;
}

// ---------- 島の生成 ----------
const RUINS_TPL = [
  ',,,,#############,,,,',
  ',,,,#...........#,,,,',
  ',,,,#..T..n..C..#,,,,',
  ',,,,#...........#,,,,',
  ',,,,######D######,,,,',
  ',,.................,,',
  ',.P...............P.,',
  ',.........A.........,',
  ',...................,',
  ',.P...............P.,',
  ',,.................,,',
  ',,,,,,,S.....S,,,,,,,',
  ',,,,,,,,m___,,,,,,,,,',
  ',,,,,,,,,___,,,,,,,,,',
];
function genIsland(seed) {
  const R = mulberry32(seed >>> 0);
  const rr = (a, b) => a + Math.floor(R() * (b - a + 1));
  const W = 150, H = 150;
  const m = newMap('island', W, H, T.DEEP, T.DEEP);
  const n1 = makeNoise(R), n2 = makeNoise(R), n3 = makeNoise(R), n4 = makeNoise(R);
  const ang = -Math.PI / 2 + (R() - .5) * 1.6;
  const mx = W / 2 + Math.cos(ang) * W * .13, my = H / 2 + Math.sin(ang) * H * .13;
  const E = new Float32Array(W * H), M = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, nx = x / W * 2 - 1, ny = y / H * 2 - 1;
    const d = Math.sqrt(nx * nx * .92 + ny * ny * 1.02);
    let e = fbm(n1, x / 30, y / 30, 4) * .7 + fbm(n2, x / 10, y / 10, 3) * .3;
    e = e + .3 - Math.pow(d, 1.8) * 1.08;
    const md = Math.hypot(x - mx, y - my) / (W * .17); if (md < 1) e += (1 - md) * (1 - md) * .45;
    E[i] = e; M[i] = fbm(n3, x / 24 + 50, y / 24, 3);
  }
  for (let i = 0; i < W * H; i++) {
    const e = E[i], mo = M[i]; let t;
    if (e < .16) t = T.DEEP; else if (e < .225) t = T.SHALLOW; else if (e < .29) t = T.SAND;
    else if (e > .7) t = T.ROCK;
    else if (mo > .6 && e < .38) t = T.SWAMP;
    else if (mo > .55) t = T.JUNGLE; else if (mo > .45) t = T.FOREST; else t = T.GRASS;
    m.t[i] = t;
  }
  // 池
  let ponds = 0;
  for (let k = 0; k < 400 && ponds < 4; k++) {
    const x = rr(20, W - 21), y = rr(20, H - 21), t = m.t[y * W + x];
    if (t !== T.GRASS && t !== T.FOREST) continue;
    const r = 2 + R() * 1.6; let ok = true;
    for (let j = -5; j <= 5 && ok; j++) for (let i = -5; i <= 5; i++) { const tt = tAt(m, x + i, y + j); if (!(tt === T.GRASS || tt === T.FOREST || tt === T.JUNGLE)) { ok = false; break; } }
    if (!ok) continue;
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (Math.hypot(i, j * 1.2) <= r + n4((x + i) / 3, (y + j) / 3) * 1.2) setT(m, x + i, y + j, T.FRESH);
    ponds++;
  }
  // 中心から到達できない陸地を海にする
  let cxs = W >> 1, cys = H >> 1;
  { const f = freeNear(m, cxs, cys, (x, y) => landT(tAt(m, x, y)), 40); if (f) { cxs = f.x; cys = f.y; } }
  { const B = bfs(m, cxs, cys, (x, y) => walkT(tAt(m, x, y))); for (let i = 0; i < W * H; i++) if (B.dist[i] < 0 && m.t[i] !== T.DEEP && m.t[i] !== T.FRESH) m.t[i] = T.DEEP; }
  // 孤立した池(周りが全部池)は気にしない
  // スポーン地点：南側の砂浜
  let spawn = null;
  {
    let best = -1;
    for (let x = (W >> 1) - 18; x <= (W >> 1) + 18; x++) for (let y = H - 1; y > H / 2; y--) {
      const t = m.t[y * W + x]; if (t === T.SAND && tAt(m, x, y - 1) !== T.DEEP && tAt(m, x, y - 2) !== T.DEEP) { if (y > best) { best = y; spawn = { x, y }; } break; }
      if (t !== T.DEEP && t !== T.SHALLOW) break;
    }
    if (!spawn) spawn = freeNear(m, W >> 1, H - 30, (x, y) => tAt(m, x, y) === T.SAND, 60) || { x: cxs, y: cys };
  }
  const reach = bfs(m, spawn.x, spawn.y, (x, y) => walkT(tAt(m, x, y)));
  const reachable = (x, y) => inB(m, x, y) && reach.dist[y * W + x] >= 0;
  const reserved = new Uint8Array(W * H);
  const reserve = (x0, y0, w, h) => { for (let j = y0; j < y0 + h; j++) for (let i = x0; i < x0 + w; i++) if (inB(m, i, j)) reserved[j * W + i] = 1; };
  const dS = (x, y) => Math.hypot(x - spawn.x, y - spawn.y);
  const areaOk = (x0, y0, w, h, pred) => { for (let j = y0; j < y0 + h; j++) for (let i = x0; i < x0 + w; i++) { if (!inB(m, i, j) || reserved[j * W + i] || !pred(m.t[j * W + i])) return false; } return true; };
  const findBest = (tries, valid, score) => { let best = null, bs = -1e9; for (let k = 0; k < tries; k++) { const x = rr(2, W - 3), y = rr(2, H - 3); if (!valid(x, y)) continue; const s = score(x, y); if (s > bs) { bs = s; best = { x, y }; } } return best; };
  const info = { spawn, pois: {}, treasures: [] };
  // --- 小屋 ---
  {
    const okT = t => t === T.GRASS || t === T.FOREST || t === T.JUNGLE;
    let p = findBest(3000, (x, y) => areaOk(x - 1, y - 1, 11, 12, okT) && reachable(x + 4, y + 8), (x, y) => -Math.abs(dS(x, y) - 36) - Math.abs(y - H * .45) * .3);
    if (!p) p = findBest(4000, (x, y) => areaOk(x - 1, y - 1, 11, 12, t => landT(t) && t !== T.SAND) && reachable(x + 4, y + 8), (x, y) => -Math.abs(dS(x, y) - 36));
    if (!p) p = findBest(6000, (x, y) => areaOk(x, y, 9, 9, landT), (x, y) => -Math.abs(dS(x, y) - 30));
    if (!p) p = { x: spawn.x - 4, y: spawn.y - 20 };
    const hx = p.x, hy = p.y;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 9; i++) {
      const wall = (i === 0 || i === 8 || j === 0 || j === 6) && !(j === 6 && i === 4);
      m.t[(hy + j) * W + hx + i] = wall ? T.LOGWALL : T.PLANK; m.o[(hy + j) * W + hx + i] = null;
    }
    setT(m, hx + 4, hy + 7, T.PATH); setT(m, hx + 4, hy + 8, T.PATH);
    reserve(hx - 2, hy - 2, 13, 14);
    setO(m, hx + 1, hy + 1, mkO('old_bed'));
    setO(m, hx + 5, hy + 1, mkO('radio', { fixed: 0 }));
    setO(m, hx + 7, hy + 1, mkO('rchest', { items: [{ id: 'tmap0', n: 1 }, { id: 'page2', n: 1 }, { id: 'rope', n: 2 }, { id: 'bandage', n: 2 }, { id: 'bowl', n: 2 }, { id: 'stone_axe', n: 1, d: 25 }] }));
    m.o[(hy + 1) * W + hx + 7].k = 'chest';
    setO(m, hx + 4, hy + 3, mkO('note', { pg: 1 }));
    info.pois.hut = { x: hx + 4, y: hy + 3, n: 'ケンジの小屋', r: 6 };
    info.heli = { x: hx + 4, y: hy + 10 };
  }
  // --- 遺跡 ---
  {
    const tw = RUINS_TPL[0].length, th = RUINS_TPL.length;
    const okT = t => landT(t) && t !== T.SAND && t !== T.ROCK;
    let p = findBest(4000, (x, y) => areaOk(x - 1, y - 1, tw + 2, th + 2, okT) && reachable(x + 10, y + th), (x, y) => (m.t[(y + 7) * W + x + 10] === T.JUNGLE ? 30 : 0) + Math.min(60, dS(x, y)) + R() * 5);
    if (!p) p = findBest(6000, (x, y) => areaOk(x, y, tw, th, landT), (x, y) => dS(x, y));
    if (p) {
      const rx = p.x, ry = p.y;
      for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
        const ch = RUINS_TPL[j][i], x = rx + i, y = ry + j, idx = y * W + x; if (ch === ',') continue;
        m.o[idx] = null;
        if (ch === '#') { m.t[idx] = T.RWALL; continue; }
        m.t[idx] = ch === '_' || ch === 'm' ? T.PATH : T.RFLOOR;
        const map = { P: 'pillar', S: 'statue', A: 'altar', D: 'rdoor', T: 'pedestal', C: 'rchest' };
        if (map[ch]) setO(m, x, y, mkO(map[ch]));
        if (ch === 'A') m.o[idx].n = 0;
        if (ch === 'T') m.o[idx].has = 1;
        if (ch === 'C') m.o[idx].items = [{ id: 'crystal', n: 3 }, { id: 'gold', n: 12 }, { id: 'pearl', n: 1 }, { id: 'medicine', n: 2 }, { id: 'iron', n: 3 }];
        if (ch === 'n') setO(m, x, y, mkO('note', { pg: 9 }));
        if (ch === 'm') setO(m, x, y, mkO('note', { pg: 3 }));
      }
      reserve(rx - 1, ry - 1, tw + 2, th + 2);
      info.pois.ruins = { x: rx + 10, y: ry + 7, n: '古代遺跡', r: 9 };
    }
  }
  // --- 山頂 ---
  {
    let bi = -1, be = -1e9;
    for (let i = 0; i < W * H; i++) if (landT(m.t[i]) && !reserved[i] && reach.dist[i] >= 0 && E[i] > be) { const x = i % W, y = (i / W) | 0; if (x < 6 || y < 6 || x > W - 7 || y > H - 7) continue; be = E[i]; bi = i; }
    const sx = bi % W, sy = (bi / W) | 0;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (Math.hypot(i, j) <= 3.3 && inB(m, sx + i, sy + j)) { m.t[(sy + j) * W + sx + i] = T.ROCK; m.o[(sy + j) * W + sx + i] = null; }
    setO(m, sx, sy - 1, mkO('shrine', { has: 1 }));
    setO(m, sx + 2, sy, mkO('note', { pg: 6 }));
    reserve(sx - 4, sy - 4, 9, 9);
    info.pois.summit = { x: sx, y: sy, n: '山頂', r: 5 };
  }
  // --- 洞窟の入口 ---
  {
    const s = info.pois.summit;
    let p = findBest(5000, (x, y) => {
      if (m.t[y * W + x] !== T.ROCK || reserved[y * W + x]) return false;
      const b = tAt(m, x, y + 1); if (!landT(b) || b === T.ROCK) return false;
      return reachable(x, y + 1) && Math.hypot(x - s.x, y - s.y) > 6;
    }, (x, y) => -Math.hypot(x - s.x, y - s.y) * .5 + Math.min(40, dS(x, y)) * .3);
    if (!p) p = findBest(5000, (x, y) => landT(m.t[y * W + x]) && !reserved[y * W + x] && landT(tAt(m, x, y + 1)) && reachable(x, y + 1), (x, y) => -Math.hypot(x - s.x, y - s.y));
    m.t[p.y * W + p.x] = T.ROCK;
    setO(m, p.x, p.y, mkO('cave_in'));
    for (let j = -1; j <= 2; j++) for (let i = -1; i <= 1; i++) if (inB(m, p.x + i, p.y + j) && !(i === 0 && j === 0)) { const o = oAt(m, p.x + i, p.y + j); if (o && OB[o.k].solid) delO(m, p.x + i, p.y + j); }
    reserve(p.x - 2, p.y - 2, 5, 5);
    info.pois.cave = { x: p.x, y: p.y, n: '洞窟', r: 5 };
  }
  // --- キングクラブの入り江 ---
  {
    let p = findBest(5000, (x, y) => {
      if (m.t[y * W + x] !== T.SAND || reserved[y * W + x] || !reachable(x, y)) return false;
      let open = 0; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const t = tAt(m, x + i, y + j); if (t === T.SAND || t === T.SHALLOW || t === T.GRASS) open++; }
      return open > 38;
    }, (x, y) => dS(x, y) + (y < H / 2 ? 20 : 0));
    if (!p) p = findBest(8000, (x, y) => m.t[y * W + x] === T.SAND && reachable(x, y) && !reserved[y * W + x], (x, y) => dS(x, y));
    if (!p) p = freeNear(m, W >> 1, 20, (x, y) => landT(tAt(m, x, y)) && reachable(x, y), 80);
    setO(m, p.x, p.y, mkO('lifeboat', { done: 0 }));
    for (let j = -3; j <= 4; j++) for (let i = -3; i <= 3; i++) { const o = oAt(m, p.x + i, p.y + j); if (o && o.k !== 'lifeboat') delO(m, p.x + i, p.y + j); }
    reserve(p.x - 5, p.y - 5, 11, 11);
    const home = freeNear(m, p.x, p.y + 3, (x, y) => walkT(tAt(m, x, y)) && !oAt(m, x, y) && reachable(x, y), 5) || { x: p.x, y: p.y + 2 };
    info.pois.cove = { x: p.x, y: p.y, n: '北の入り江', r: 7, bx: home.x, by: home.y };
  }
  // --- 朽ちたいかだ ---
  {
    const c = info.pois.cove;
    let p = findBest(5000, (x, y) => m.t[y * W + x] === T.SAND && !reserved[y * W + x] && reachable(x, y) && landT(tAt(m, x + 1, y)), (x, y) => Math.min(dS(x, y), Math.hypot(x - c.x, y - c.y)));
    if (!p) p = freeNear(m, spawn.x - 20, spawn.y - 10, (x, y) => landT(tAt(m, x, y)) && reachable(x, y) && !reserved[y * W + x], 60);
    setO(m, p.x, p.y, mkO('old_raft'));
    const q = freeNear(m, p.x + 1, p.y, (x, y) => landT(tAt(m, x, y)) && !oAt(m, x, y) && reachable(x, y), 4) || p;
    setO(m, q.x, q.y, mkO('note', { pg: 10 }));
    reserve(p.x - 2, p.y - 2, 5, 5);
    info.pois.oldraft = { x: p.x, y: p.y, n: '朽ちたいかだ', r: 4 };
  }
  // --- サエキのリュック ---
  {
    let p = findBest(5000, (x, y) => (m.t[y * W + x] === T.SWAMP || m.t[y * W + x] === T.JUNGLE) && !reserved[y * W + x] && reachable(x, y) && dS(x, y) > 25, (x, y) => (m.t[y * W + x] === T.SWAMP ? 20 : 0) + R() * 10);
    if (!p) p = findBest(5000, (x, y) => landT(m.t[y * W + x]) && !reserved[y * W + x] && reachable(x, y) && dS(x, y) > 20, () => R());
    setO(m, p.x, p.y, mkO('old_pack'));
    reserve(p.x - 1, p.y - 1, 3, 3);
    info.pois.pack = { x: p.x, y: p.y, n: '古いリュック', r: 3, hidden: 1 };
  }
  // --- 宝のありか ---
  {
    const okT = t => t === T.SAND || t === T.GRASS || t === T.FOREST || t === T.JUNGLE;
    for (let k = 0; k < 6; k++) {
      const p = findBest(1500, (x, y) => okT(m.t[y * W + x]) && !reserved[y * W + x] && reachable(x, y) && dS(x, y) > 14 && info.treasures.every(t => Math.hypot(t.x - x, t.y - y) > 18), () => R());
      if (!p) continue;
      info.treasures.push({ x: p.x, y: p.y, found: 0, known: 0, tab: info.treasures.length === 0 ? 1 : 0 });
      reserve(p.x, p.y, 1, 1);
    }
    if (!info.treasures.length) { // 星の石版の宝は必ず用意する
      const p = freeNear(m, spawn.x, spawn.y - 10, (x, y) => landT(tAt(m, x, y)) && !reserved[y * W + x] && reachable(x, y), 60) || spawn;
      info.treasures.push({ x: p.x, y: p.y, found: 0, known: 0, tab: 1 }); reserve(p.x, p.y, 1, 1);
    }
  }
  // --- 難破船と木箱 ---
  {
    reserve(spawn.x - 3, spawn.y - 3, 7, 7);
    const wp = freeNear(m, spawn.x + 5, spawn.y, (x, y) => tAt(m, x, y) === T.SAND && !reserved[y * W + x] && tAt(m, x - 1, y) === T.SAND && tAt(m, x + 1, y) !== T.DEEP, 10) || freeNear(m, spawn.x + 4, spawn.y - 2, (x, y) => landT(tAt(m, x, y)) && !reserved[y * W + x], 10);
    if (wp) { setO(m, wp.x, wp.y, mkO('wreck')); reserve(wp.x - 2, wp.y - 1, 5, 3); }
    let placed = 0;
    for (let k = 0; k < 200 && placed < 4; k++) {
      const x = spawn.x + rr(-7, 7), y = spawn.y + rr(-5, 3);
      if (!inB(m, x, y) || reserved[y * W + x] || !landT(m.t[y * W + x]) || m.o[y * W + x] || !reachable(x, y)) continue;
      if (Math.hypot(x - spawn.x, y - spawn.y) < 2) continue;
      setO(m, x, y, mkO('crate', { loot: 'wreck', first: placed === 0 ? 1 : 0 })); placed++;
      reserve(x, y, 1, 1);
    }
  }
  // --- 自然物の配置 ---
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; if (reserved[i] || m.o[i]) continue;
    const t = m.t[i], r = R(); let k = null;
    switch (t) {
      case T.SAND: k = r < .03 ? 'palm' : r < .045 ? 'shell_o' : r < .053 ? 'driftwood' : r < .063 ? 'pebble' : null; break;
      case T.GRASS: k = r < .05 ? 'tree' : r < .075 ? 'bush' : r < .155 ? 'grass' : r < .19 ? 'flower' : r < .205 ? 'pebble' : r < .22 ? 'twig' : r < .232 ? 'rock' : r < .238 ? 'potato_o' : r < .244 ? 'herb_o' : null; break;
      case T.FOREST: k = r < .17 ? 'tree' : r < .19 ? 'bush' : r < .24 ? 'fern' : r < .255 ? 'mushroom_o' : r < .28 ? 'twig' : r < .29 ? 'rock' : r < .3 ? 'herb_o' : r < .33 ? 'grass' : null; break;
      case T.JUNGLE: k = r < .06 ? 'palm' : r < .09 ? 'banana_tree' : r < .17 ? 'tree' : r < .27 ? 'fern' : r < .28 ? 'bush' : r < .29 ? 'mushroom_o' : r < .305 ? 'herb_o' : r < .315 ? 'twig' : null; break;
      case T.ROCK: k = r < .07 ? 'rock' : r < .095 ? 'iron_rock' : r < .105 ? 'boulder' : r < .135 ? 'pebble' : r < .14 ? 'coal_rock' : r < .16 ? 'pine' : null; break;
      case T.SWAMP: k = r < .03 ? 'clay_o' : r < .05 ? 'mushroom_o' : r < .058 ? 'red_mushroom_o' : r < .09 ? 'fern' : r < .12 ? 'tree' : r < .135 ? 'herb_o' : r < .16 ? 'grass' : null; break;
    }
    if (!k && (t === T.GRASS || t === T.FOREST) && r > .9) { let nearW = false; for (let d = 0; d < 4; d++) if (tAt(m, x + DIRV[d].x, y + DIRV[d].y) === T.FRESH) nearW = true; if (nearW) k = 'clay_o'; }
    if (k) { const o = mkO(k); if (k === 'palm') o.c = Math.floor(R() * 3); setO(m, x, y, o); }
  }
  // --- ねんどを最低限保証（沼地がない島でも詰まないように） ---
  {
    let clay = 0; for (const o of m.o) if (o && o.k === 'clay_o') clay++;
    const nearW = (x, y, t2) => DIRV.some(d => t2.includes(tAt(m, x + d.x, y + d.y)));
    for (let k = 0; k < 8000 && clay < 12; k++) {
      const x = rr(2, W - 3), y = rr(2, H - 3), i = y * W + x, t = m.t[i];
      if (reserved[i] || m.o[i] || reach.dist[i] < 0) continue;
      const green = t === T.GRASS || t === T.FOREST || t === T.JUNGLE;
      if (t === T.SWAMP || (green && nearW(x, y, [T.FRESH])) || (k > 4000 && green && nearW(x, y, [T.FRESH, T.SHALLOW])) || (k > 6500 && green)) { setO(m, x, y, mkO('clay_o')); clay++; }
    }
  }
  // --- 主要地点への道を確保 ---
  {
    const B = bfs(m, spawn.x, spawn.y, (x, y) => walkT(tAt(m, x, y)));
    const tg = [];
    for (const k in info.pois) { const p = info.pois[k]; const a = freeNear(m, p.x, p.y + 1, (x, y) => walkT(tAt(m, x, y)) && B.dist[y * W + x] >= 0 && (!oAt(m, x, y) || !OB[oAt(m, x, y).k].solid), 4); if (a) tg.push(a); }
    if (info.heli) tg.push(info.heli);
    for (const t of info.treasures) tg.push(t);
    for (const t of tg) carvePath(m, B, t.x, t.y);
  }
  // ヘリの着陸地点を空ける
  if (info.heli) for (let j = -1; j <= 1; j++) for (let i = -2; i <= 2; i++) { const x = info.heli.x + i, y = info.heli.y + j; if (inB(m, x, y)) { if (!landT(tAt(m, x, y))) setT(m, x, y, T.GRASS); delO(m, x, y); } }
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const o = oAt(m, spawn.x + i, spawn.y + j); if (o && OB[o.k].solid && o.k !== 'crate' && o.k !== 'wreck') delO(m, spawn.x + i, spawn.y + j); }
  return { m, info };
}

// ---------- 洞窟の生成 ----------
function genCave(seed) {
  const R = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const W = 72, H = 56; const m = newMap('cave', W, H, T.CWALL, T.CWALL);
  let g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = (x < 2 || y < 2 || x > W - 3 || y > H - 3 || R() < .46) ? 1 : 0;
  for (let it = 0; it < 5; it++) {
    const ng = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (x < 2 || y < 2 || x > W - 3 || y > H - 3) { ng[y * W + x] = 1; continue; }
      let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) n += g[(y + j) * W + x + i];
      ng[y * W + x] = n > 4 ? 1 : n < 4 ? 0 : g[y * W + x];
    }
    g = ng;
  }
  const ex = 5, ey = H >> 1;
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (Math.hypot(i, j) <= 3.2) g[(ey + j) * W + ex + i] = 0;
  // 入口から右へ一本道を通しておく（必ず奥まで繋がるように）
  { let x = ex, y = ey; while (x < W - 12) { for (let j = -1; j <= 1; j++) if (y + j > 2 && y + j < H - 3) g[(y + j) * W + x] = 0; x++; if (R() < .3) y = clamp(y + (R() < .5 ? -1 : 1), 8, H - 9); } }
  for (let i = 0; i < W * H; i++) m.t[i] = g[i] ? T.CWALL : T.CFLOOR;
  let B = bfs(m, ex, ey, (x, y) => tAt(m, x, y) === T.CFLOOR);
  for (let i = 0; i < W * H; i++) if (B.dist[i] < 0) m.t[i] = T.CWALL;
  let fi = -1, fd = -1;
  for (let y = 9; y < H - 9; y++) for (let x = 9; x < W - 9; x++) { const i = y * W + x; if (B.dist[i] > fd) { fd = B.dist[i]; fi = i; } }
  const bx = fi % W, by = (fi / W) | 0;
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) if (Math.hypot(i, j) <= 6.3) m.t[(by + j) * W + bx + i] = T.CFLOOR;
  B = bfs(m, ex, ey, (x, y) => tAt(m, x, y) === T.CFLOOR);
  let maxD = 0; for (let i = 0; i < W * H; i++) if (B.dist[i] > maxD) maxD = B.dist[i];
  setO(m, ex, ey, mkO('cave_out'));
  // 物資箱：ボス部屋の入口から最も遠い側
  let ci = -1, cd = -1;
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const x = bx + i, y = by + j; if (Math.hypot(i, j) > 5) continue; const d = B.dist[y * W + x]; if (d > cd) { cd = d; ci = y * W + x; } }
  const mcx = ci % W, mcy = (ci / W) | 0;
  setO(m, mcx, mcy, mkO('milcrate', { done: 0 }));
  const inBoss = (x, y) => Math.hypot(x - bx, y - by) <= 7.5;
  // メモ
  const findD = (target) => { let best = -1, bd = 1e9; for (let i = 0; i < W * H; i++) { const d = B.dist[i]; if (d < 0) continue; const x = i % W, y = (i / W) | 0; if (inBoss(x, y) || m.o[i]) continue; const s = Math.abs(d - target); if (s < bd) { bd = s; best = i; } } return { x: best % W, y: (best / W) | 0 }; };
  const p4 = findD(7); setO(m, p4.x, p4.y, mkO('note', { pg: 4 }));
  const p8 = findD(Math.max(10, B.dist[by * W + bx] - 10)); setO(m, p8.x, p8.y, mkO('note', { pg: 8 }));
  // 鉱石など
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; if (m.t[i] !== T.CFLOOR || m.o[i] || inBoss(x, y) || Math.hypot(x - ex, y - ey) < 4) continue;
    let wallN = 0; for (let d = 0; d < 4; d++) if (tAt(m, x + DIRV[d].x, y + DIRV[d].y) === T.CWALL) wallN++;
    const r = R(), deep = B.dist[i] > maxD * .45;
    let k = null;
    if (wallN >= 1) k = r < .05 ? 'coal_rock' : r < .1 ? 'iron_rock' : (deep && r < .135) ? 'crystal_rock' : r < .155 ? 'rock' : null;
    else k = r < .012 ? 'mushroom_o' : r < .016 ? 'pebble' : null;
    if (k) setO(m, x, y, mkO(k));
  }
  B = bfs(m, ex, ey, (x, y) => tAt(m, x, y) === T.CFLOOR);
  carvePath(m, B, bx, by); carvePath(m, B, p4.x, p4.y); carvePath(m, B, p8.x, p8.y);
  { const a = freeNear(m, mcx, mcy + 1, (x, y) => tAt(m, x, y) === T.CFLOOR && !oAt(m, x, y), 3); if (a) carvePath(m, B, a.x, a.y); }
  return { m, info: { entrance: { x: ex, y: ey }, boss: { x: bx, y: by } } };
}

// ---------- タイトル用の小さな島 ----------
function genDemo() {
  const r = genIsland(12345);
  return r;
}

// ---------- serialize ----------
function rle(a) { const out = []; let p = a[0], c = 1; for (let i = 1; i < a.length; i++) { if (a[i] === p && c < 65535) c++; else { out.push(p, c); p = a[i]; c = 1; } } out.push(p, c); return out; }
function unrle(a, n) { const r = new Uint8Array(n); let k = 0; for (let i = 0; i < a.length; i += 2) { r.fill(a[i], k, Math.min(n, k + a[i + 1])); k += a[i + 1]; } return r; }
function serMap(m) {
  const objs = [];
  for (let i = 0; i < m.o.length; i++) { const o = m.o[i]; if (o) { const c = Object.assign({}, o); delete c.x; delete c.y; delete c.shk; objs.push([i, c]); } }
  return { id: m.id, w: m.w, h: m.h, oob: m.oob, t: rle(m.t), s: rle(m.seen), o: objs, d: m.drops.map(d => ({ id: d.id, n: d.n, dur: d.dur, x: Math.round(d.x), y: Math.round(d.y) })) };
}
function deserMap(s) {
  const m = newMap(s.id, s.w, s.h, 0, s.oob);
  m.t = unrle(s.t, s.w * s.h); m.seen = unrle(s.s, s.w * s.h);
  for (const [i, c] of s.o) { c.x = i % s.w; c.y = (i / s.w) | 0; m.o[i] = c; }
  m.drops = (s.d || []).map(d => ({ id: d.id, n: d.n, dur: d.dur, x: d.x, y: d.y, z: 0, vz: 0, vx: 0, vy: 0, age: 0 }));
  return m;
}

// =====================================================================
//  GAME LOGIC
// =====================================================================
for (let i = 1; i <= 10; i++) IT['page' + i] = { id: 'page' + i, n: '日記のページ ' + i, ic: 'page', st: 1, page: i, d: '水野ケンジの日記の切れはし。' };
const TOOLV = { axe: '伐採', pick: '採掘', shovel: '掘る' };
const TOOLN = { axe: '斧', pick: 'つるはし', shovel: 'シャベル' };
const LIGHT_K = { campfire: 1, signal: 1, torch_post: 1, crystal_rock: 1, note: 1, old_pack: 1, bag: 1, heli: 1 };
const FLAT_K = { flower: 1, sos: 1, crop: 1, twig: 1, pebble: 1, shell_o: 1, note: 1, bottle: 1, clay_o: 1, cave_out: 1, bed: 1, old_raft: 1, stump: 1, bag: 1, old_pack: 1 };

const OPT = Object.assign({ bgm: 6, se: 7, swapAB: false, swapXY: false, touch: 1, dark: 0, flicker: true, view3d: false, q3d: 1, minimap: true, dmgNum: true, shake: true },
  (() => { try { return JSON.parse(localStorage.getItem(OPT_KEY)) || {}; } catch (e) { return {}; } })());
function saveOpt() { try { localStorage.setItem(OPT_KEY, JSON.stringify(OPT)); } catch (e) { } }
let ACHV = (() => { try { return JSON.parse(localStorage.getItem(ACH_KEY)) || {}; } catch (e) { return {}; } })();
function unlock(id) {
  if (ACHV[id]) return; const a = ACH.find(x => x[0] === id); if (!a) return;
  ACHV[id] = Date.now(); try { localStorage.setItem(ACH_KEY, JSON.stringify(ACHV)); } catch (e) { }
  toast('実績解除：' + a[1], 'ach'); sfx('ach');
}

let G = null;
const RT = { parts: [], floats: [], projs: [], cam: { x: 0, y: 0 }, shake: 0, flash: 0, lightning: 0, clock: 0, vw: 320, vh: 180, scale: 2, toastKeys: {}, find: {}, act: null, tg: null, boss: null, voy: null, tick: 0, spawnT: 2, lastTile: -1, heat: false, heatT: 0, deadT: 0, invDirty: true, questDirty: true };
const hour = () => G.time * 24;
const isNight = () => { const h = hour(); return h >= 19.5 || h < 5; };

function newPlayer(sp) {
  return { x: sp.x * TS + 8, y: sp.y * TS + 12, dir: 2, ax: 0, ay: 1, hp: 100, mhp: 100, food: 85, water: 80, sta: 100, temp: 70, poison: 0, sick: 0, fed: 0,
    inv: 0, swing: 0, swDur: .3, swHit: false, swType: null, swTgt: null, anim: 0, moving: false, running: false, staDelay: 0, kbx: 0, kby: 0, fishing: null, dead: false, cd: 0, rep: false, hurtFlash: 0, pick: null, pickT: 0, pickA: null };
}
function newGame(seed, diff, slot) {
  const isl = genIsland(seed), cave = genCave(seed);
  G = {
    v: 1, seed, diff, slot, maps: { island: isl.m, cave: cave.m }, mapId: 'island', map: null,
    time: .29, day: 1, lastHour: 6, weather: 'clear', wT: 4, rain: 0,
    p: newPlayer(isl.info.spawn), inv: new Array(32).fill(null), invSize: 24, armor: null, sel: 0,
    flags: {}, pages: [], stats: { crates: 0, chop: 0, mine: 0, craft: 0, cook: 0, fish: 0, kills: 0, deaths: 0, placed: 0, harvest: 0, treasure: 0, dist: 0 },
    pois: isl.info.pois, treasures: isl.info.treasures, heli: isl.info.heli, caveInfo: cave.info,
    spawnPt: { map: 'island', x: isl.info.spawn.x, y: isl.info.spawn.y },
    quest: 0, boss: { golem: 0, kingcrab: 0 }, ship: null, shipPlan: null, rescue: null, playTime: 0, endings: {},
  };
  G.map = G.maps.island;
  initRuntime();
  unlock('start');
}
function initRuntime() {
  r3Reset();
  RT.parts = []; RT.floats = []; RT.projs = []; RT.shake = 0; RT.flash = 0; RT.lightning = 0; RT.boss = null; RT.lastTile = -1; RT.find = {}; RT.voy = null;
  RT.deadT = 0; RT.deadShown = 0; RT.tick = 0; RT.spawnT = 2; RT.heatT = 0; RT.invDirty = true; RT.questDirty = true; RT.lock = false;
  for (const id in G.maps) { const m = G.maps[id]; m.ents = []; m.litDirty = true; mmBuild(m); }
  G.mode = 'play'; G.p.dead = false; G.p.fishing = null; G.p.swing = 0;
  snapCam(); revealAround(true);
}

// ---------- inventory ----------
function invChanged() { RT.invDirty = true; }
const held = () => G.inv[G.sel];
function cnt(id) { let c = 0; for (let i = 0; i < G.invSize; i++) { const s = G.inv[i]; if (s && s.id === id) c += s.n; } return c; }
function canFit(id) { const def = IT[id]; if (!def) return false; if (def.page) return true; for (let i = 0; i < G.invSize; i++) { const s = G.inv[i]; if (!s) return true; if (def.st > 1 && s.id === id && s.n < def.st) return true; } return false; }
function invAdd(id, n, dur) {
  const def = IT[id]; if (!def) return 0; n = n || 1;
  if (def.page) { readPage(def.page); return 0; }
  if (def.st > 1) for (let i = 0; i < G.invSize && n > 0; i++) { const s = G.inv[i]; if (s && s.id === id && s.n < def.st) { const k = Math.min(n, def.st - s.n); s.n += k; n -= k; } }
  for (let i = 0; i < G.invSize && n > 0; i++) if (!G.inv[i]) { const k = Math.min(n, def.st); G.inv[i] = { id, n: k }; if (def.dur) G.inv[i].d = dur != null ? dur : def.dur; n -= k; }
  invChanged(); return n;
}
function invRemove(id, n) {
  for (let i = G.invSize - 1; i >= 0 && n > 0; i--) { const s = G.inv[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) G.inv[i] = null; } }
  invChanged();
}
function give(id, n, quiet, dur) {
  if (!n || n <= 0 || !IT[id]) return;
  const left = invAdd(id, n, dur), got = n - left;
  if (got > 0 && !quiet && !IT[id].page) pickupToast(id, got);
  if (left > 0) { dropAt(G.map, G.p.x, G.p.y - 4, id, left, dur, true); toast('持ち物がいっぱい！足元に置いた', 'warn', 'full'); }
}
function take1(i) { const s = G.inv[i]; if (!s) return; s.n--; if (s.n <= 0) G.inv[i] = null; invChanged(); }
function useDur(n) {
  const s = held(); if (!s || s.d == null) return;
  s.d -= n; if (s.d <= 0) { toast(IT[s.id].n + 'が壊れた！', 'bad'); sfx('break'); G.inv[G.sel] = null; } invChanged();
}
function dropAt(m, x, y, id, n, dur, nopick) { m.drops.push({ id, n, dur, x, y, z: 0, vz: rand(40, 70), vx: rand(-30, 30), vy: rand(-20, 20), age: 0, np: nopick ? 2 : .35 }); }
function rollLoot(tab, cb) { for (const [id, a, b, pr] of tab) { if (pr != null && !chance(pr)) continue; const n = randi(a, b); if (n > 0) cb(id, n); } }

// ---------- stations ----------
function stations() {
  const st = { hand: true }; const m = G.map, p = G.p, tx = Math.floor(p.x / TS), ty = Math.floor((p.y - 3) / TS);
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
    const o = oAt(m, tx + i, ty + j); if (!o) continue;
    if (o.k === 'workbench') st.bench = true; else if (o.k === 'furnace') st.furnace = true; else if (o.k === 'campfire' && o.fuel > 0) st.fire = true;
  }
  return st;
}
function canCraft(rc, st) {
  st = st || stations(); if (!st[rc.s]) return false; if (rc.tool && !cnt(rc.tool)) return false;
  for (const k in rc.r) if (cnt(k) < rc.r[k]) return false; return true;
}
function maxCraft(rc, st) { if (!canCraft(rc, st)) return 0; let n = 99; for (const k in rc.r) n = Math.min(n, Math.floor(cnt(k) / rc.r[k])); return n; }
function doCraft(rc, times) {
  times = times || 1; let made = 0; const st = stations();
  for (let t = 0; t < times; t++) {
    if (!canCraft(rc, st)) break;
    for (const k in rc.r) { invRemove(k, rc.r[k]); if (IT[k].ret && !rc.noRet) invAdd(IT[k].ret, rc.r[k]); }
    give(rc.o, rc.n, true); made++;
    G.stats.craft++; G.flags['made_' + rc.o] = 1;
    if (rc.s === 'fire') { G.stats.cook++; if (G.stats.cook >= 30) unlock('cook'); if (rc.o === 'clean_water') { G.flags.boiled = 1; G.flags.gotclean = 1; } }
  }
  if (!made) { sfx('no'); return 0; }
  pickupToast(rc.o, rc.n * made);
  sfx(rc.s === 'fire' ? 'cook' : rc.s === 'furnace' ? 'smelt' : 'craft');
  unlock('craft1'); if (rc.o === 'iron') unlock('iron');
  return made;
}

// ---------- 対象・アクション ----------
function getTarget() {
  const p = G.p, m = G.map;
  const ox = [0, 11, 0, -11][p.dir], oy = [-14, -3, 8, -3][p.dir];
  const fx = p.x + ox, fy = p.y + oy, tx = Math.floor(fx / TS), ty = Math.floor(fy / TS);
  const o = oAt(m, tx, ty);
  if (o && !OB[o.k].deco) return { x: tx, y: ty, o };
  for (const dx of [-1, 1, -2, 2]) {
    const o2 = oAt(m, tx + dx, ty); if (!o2) continue; const b = OB[o2.k].box;
    if (b && (b[0] < 0 || b[2] > 16)) { const bx0 = (tx + dx) * TS + b[0], bx1 = (tx + dx) * TS + b[2]; if (fx >= bx0 && fx <= bx1) return { x: tx + dx, y: ty, o: o2 }; }
  }
  const ptx = Math.floor(p.x / TS), pty = Math.floor((p.y - 3) / TS), o3 = oAt(m, ptx, pty);
  if (o3 && OB[o3.k].use && !OB[o3.k].solid) return { x: ptx, y: pty, o: o3 };
  return { x: tx, y: ty, o: null };
}
function waterFront(range) {
  const p = G.p, m = G.map, d = DIRV[p.dir], ptx = Math.floor(p.x / TS), pty = Math.floor((p.y - 3) / TS);
  for (let k = 1; k <= range; k++) {
    const tx = ptx + d.x * k, ty = pty + d.y * k, t = tAt(m, tx, ty);
    if (isWater(t) && inB(m, tx, ty)) return { tx, ty, kind: TINFO[t].water, px: tx * TS + 8, py: ty * TS + 9 };
    const o = oAt(m, tx, ty); if (!walkT(t) || (o && OB[o.k].solid)) return null;
  }
  return null;
}
function actionInfo() {
  const p = G.p; if (p.fishing || p.dead) return null;
  const s = held(), def = s ? IT[s.id] : null, tg = getTarget(), o = tg.o, od = o ? OB[o.k] : null;
  RT.tg = tg;
  if (o && def && def.tool) {
    if (def.tool.cls === 'hammer' && od.pl) return { lbl: '解体：' + od.n, f: () => startSwing('obj', tg), rep: 1, tgt: 1 };
    if (od.tool === def.tool.cls) return { lbl: TOOLV[od.tool] + '：' + od.n, f: () => startSwing('obj', tg), rep: 1, tgt: 1 };
  }
  // 自分で置いた物は、ハンマー以外でもⒶ長押しで回収できる（閉じ込め防止）
  const pk = (o && od.pl && !(def && def.tool && def.tool.cls === 'hammer')) ? tg : null, sub = pk ? '長押しで回収' : null;
  if (o && od.use) {
    if ((o.k === 'campfire' || o.k === 'signal') && def && def.fuel) return { lbl: '燃料をくべる：' + def.n, f: () => addFuel(o), tgt: 1, pick: pk, sub };
    return { lbl: (od.lbl || '調べる') + '：' + od.n, f: () => useObj(tg), tgt: 1, pick: pk, sub };
  }
  if (pk) return { lbl: '回収：' + od.n, f: () => toast('Ⓐを長押しすると回収できる', '', 'pickhint'), tgt: 1, pick: pk, sub: '長押し' };
  if (def) {
    if (def.place) { const why = canPlace(s.id, tg.x, tg.y); return { lbl: why || ('設置：' + def.n), f: () => { if (why) { toast(why, 'warn', 'place'); sfx('no'); } else placeIt(tg.x, tg.y); }, bad: !!why, place: 1 }; }
    if (def.plant && tAt(G.map, tg.x, tg.y) === T.FARM && !o) return { lbl: '植える：' + def.n, f: () => plantIt(tg) };
    if (s.id === 'bowl') { const w = waterFront(2); if (w) return { lbl: w.kind === 'sea' ? '海水を汲む' : '水を汲む', f: () => fillBowl(w) }; }
    if (def.rod) { const w = waterFront(3); return w ? { lbl: '釣りをする', f: () => startFish(w) } : { lbl: '水辺に向かって使おう', f: () => toast('水辺に向かって使おう', 'warn', 'rod'), bad: 1 }; }
    if (def.bow) return { lbl: '矢を撃つ（残り' + cnt('arrow') + '）', f: shootArrow };
    if (def.tool && def.tool.cls === 'shovel' && !o) { const dg = digInfo(tg); if (dg) return { lbl: dg, f: () => startSwing('dig', tg), rep: 1 }; }
    if (def.eat) { const e = def.eat; const v = (e.w || 0) > (e.h || 0) ? '飲む' : e.h ? '食べる' : '使う'; return { lbl: v + '：' + def.n, f: () => consume(G.sel) }; }
    if (def.upgrade || def.tmap != null) return { lbl: '使う：' + def.n, f: () => consume(G.sel) };
  } else {
    const w = waterFront(1); if (w) return { lbl: w.kind === 'sea' ? '海水を飲む' : '池の水を飲む', f: () => drinkDirect(w) };
  }
  if (o && od.tool && (od.solid || od.hp)) return { lbl: TOOLN[od.tool] + 'が必要', f: () => startSwing('atk', tg), bad: 1, rep: 1, tgt: 1 };
  if (o && od.hand) return { lbl: '叩く：' + od.n, f: () => startSwing('atk', tg), rep: 1, tgt: 1 };
  return { lbl: def && (def.weapon || def.tool) ? '攻撃' : 'パンチ', f: () => startSwing('atk', tg), rep: 1, weak: 1 };
}
function doAction() {
  const p = G.p; if (p.swing > 0 || p.cd > 0) return;
  const a = actionInfo(); if (!a) return; p.rep = !!a.rep; a.f();
}
function startSwing(type, tg) {
  const p = G.p, s = held(), def = s ? IT[s.id] : null, cost = type === 'atk' ? 3 : 4;
  if (p.sta < cost) { toast('つかれた…少し休もう', 'warn', 'tired'); p.cd = .4; return; }
  p.sta -= cost; p.staDelay = .9;
  p.swing = .0001; p.swDur = def && def.spd ? def.spd : .28; p.swType = type; p.swHit = false; p.swTgt = tg;
  sfx('swing');
}
function resolveSwing() {
  const p = G.p, m = G.map, s = held(), def = s ? IT[s.id] : null;
  const reach = def && def.reach ? def.reach : 15, dmg = def ? (def.dmg || 1) : 2;
  const dv = DIRV[p.dir], hx = p.x + dv.x * reach * .75, hy = p.y - 5 + dv.y * reach * .75, hr = reach * .55 + 5;
  let hit = false;
  for (const e of m.ents) {
    if (e.dead || e.hidden) continue;
    if (Math.hypot(e.x - hx, (e.y - e.def.r * .6) - hy) < hr + e.def.r) { hurtMob(e, Math.round(dmg * (p.fed > 0 ? 1.15 : 1)), p.x, p.y - 5); hit = true; }
  }
  if (hit) { useDur(1); return; }
  const tg = p.swTgt; if (!tg) return;
  if (p.swType === 'dig') { doDig(tg); useDur(1); return; }
  const o = oAt(m, tg.x, tg.y); if (!o) return; const od = OB[o.k];
  if (def && def.tool) {
    if (def.tool.cls === 'hammer' && od.pl) { dismantle(tg.x, tg.y, o); useDur(1); return; }
    if (od.tool === def.tool.cls) {
      if ((def.tool.tier || 1) >= (od.tier || 1)) { damageObj(m, tg.x, tg.y, o, def.tool.pow); useDur(1); }
      else { toast('この道具では歯が立たない…（鉄の' + TOOLN[od.tool] + 'が必要）', 'warn', 'tier'); sfx('clink'); o.shk = .15; }
      return;
    }
  }
  if (od.hand === 'stick') { o.shk = .25; sfx('thud'); leafParts(tg.x * TS + 8, tg.y * TS - 4); if (chance(.3)) dropAt(m, tg.x * TS + 8, tg.y * TS + 12, 'stick', 1); return; }
  if (od.tool && (od.solid || od.hp)) { o.shk = .15; sfx('clink'); toast(TOOLN[od.tool] + 'が必要だ', 'warn', 'need' + od.tool); }
}
function damageObj(m, x, y, o, pow) {
  const od = OB[o.k]; o.hp = (o.hp != null ? o.hp : od.hp) - pow; o.shk = .25; sfx(od.snd || 'thud');
  hitParts(x * TS + 8, y * TS + 8, od);
  if (o.hp <= 0) breakObj(m, x, y, o);
}
function breakObj(m, x, y, o) {
  const od = OB[o.k], cx = x * TS + 8, cy = y * TS + 12;
  rollLoot(od.drops || [], (id, n) => dropAt(m, cx, cy, id, n));
  if (o.k === 'palm' && o.c) dropAt(m, cx, cy, 'coconut', o.c);
  delO(m, x, y);
  if (od.regrow) setO(m, x, y, { k: 'stump', was: o.k, t: 30 });
  if (od.tool === 'axe' && o.k !== 'stump') { G.stats.chop++; if (G.stats.chop >= 30) unlock('lumber'); }
  if (od.tool === 'pick') { G.stats.mine++; if (G.stats.mine >= 30) unlock('miner'); }
  breakParts(cx, cy - 4, od); sfx(od.tool === 'axe' ? 'fall' : 'crumble'); shake(2);
}
function dismantle(x, y, o) {
  const m = G.map, od = OB[o.k], cx = x * TS + 8, cy = y * TS + 12;
  if (o.items) for (const it of o.items) if (it) dropAt(m, cx, cy, it.id, it.n, it.d);
  if (o.k === 'raft') { if (o.sail) dropAt(m, cx, cy, 'sail', 1); if (o.oar) dropAt(m, cx, cy, 'oar', o.oar); if (o.compass) dropAt(m, cx, cy, 'compass', 1); }
  delO(m, x, y); dropAt(m, cx, cy, od.item, 1); sfx('crumble'); breakParts(cx, cy - 4, od);
}

// ---------- 設置・畑・掘る ----------
function canPlace(id, tx, ty) {
  const m = G.map, k = IT[id].place, t = tAt(m, tx, ty);
  if (!inB(m, tx, ty)) return 'ここには置けない';
  const o = oAt(m, tx, ty); if (o && !OB[o.k].deco) return 'ここには置けない';
  if (k === 'raft') {
    if (G.mapId !== 'island' || t !== T.SHALLOW) return '砂浜に接した浅瀬に置こう';
    let adj = false; for (const d of DIRV) if (tAt(m, tx + d.x, ty + d.y) === T.SAND) adj = true;
    if (!adj) return '砂浜に接した浅瀬に置こう';
    if (findObj('raft')) return 'いかだはひとつまで';
  } else {
    if (!landT(t) || t === T.FARM) return 'ここには置けない';
    if (k === 'sos' && t !== T.SAND) return 'SOSサインは砂浜に置こう';
    if (k === 'signal') { const s = G.pois.summit; if (G.mapId !== 'island' || Math.hypot(tx - s.x, ty - s.y) > 5) return 'のろし台は山頂に置こう'; if (findObj('signal')) return 'のろし台はひとつまで'; }
  }
  if (OB[k].solid && !OB[k].mobOnly) { const p = G.p; if (p.x + 4 > tx * TS && p.x - 4 < tx * TS + TS && p.y > ty * TS && p.y - 4 < ty * TS + TS) return '自分の足元には置けない'; }
  for (const e of m.ents) if (!e.dead && Math.floor(e.x / TS) === tx && Math.floor((e.y - 2) / TS) === ty) return 'ここには置けない';
  return '';
}
function placeIt(tx, ty) {
  const s = held(); if (!s) return; const def = IT[s.id], k = def.place, m = G.map;
  const o = { k };
  if (k === 'campfire') o.fuel = 150; if (k === 'chest') o.items = new Array(20).fill(null); if (k === 'collector') o.w = 0;
  if (k === 'signal') o.fuel = 0; if (k === 'raft') { o.sail = 0; o.oar = 0; o.compass = 0; }
  setO(m, tx, ty, o); take1(G.sel);
  G.stats.placed++; if (G.stats.placed >= 30) unlock('builder');
  G.flags['placed_' + k] = 1; if (k === 'campfire') unlock('fire');
  sfx('place'); dustParts(tx * TS + 8, ty * TS + 13);
  RT.find = {};
}
function plantIt(tg) {
  const s = held(); if (!s) return; const def = IT[s.id];
  setO(G.map, tg.x, tg.y, { k: 'crop', c: def.plant, g: 0 }); take1(G.sel); sfx('dig'); dustParts(tg.x * TS + 8, tg.y * TS + 12);
}
const treasureAt = (x, y) => G.mapId === 'island' ? G.treasures.find(t => !t.found && t.x === x && t.y === y) : null;
function digInfo(tg) {
  const t = tAt(G.map, tg.x, tg.y);
  if (treasureAt(tg.x, tg.y)) return '掘る：宝のありか';
  if (t === T.GRASS || t === T.FOREST || t === T.JUNGLE || t === T.SWAMP) return '耕す';
  if (t === T.SAND) return '砂を掘る';
  return null;
}
function doDig(tg) {
  const m = G.map; if (oAt(m, tg.x, tg.y)) return; const t = tAt(m, tg.x, tg.y), cx = tg.x * TS + 8, cy = tg.y * TS + 12;
  const tr = treasureAt(tg.x, tg.y);
  if (tr) {
    tr.found = 1; G.stats.treasure++; if (G.stats.treasure >= 3) unlock('treasure');
    if (tr.tab) dropAt(m, cx, cy, 'tablet_c', 1);
    rollLoot(LOOT.treasure, (id, n) => dropAt(m, cx, cy, id, n));
    toast('宝を掘り当てた！', 'big'); sfx('treasure'); poofParts(cx, cy - 4, 20, ['#ffec27', '#ffffff', '#ffa300']); return;
  }
  dustParts(cx, cy); sfx('dig');
  if (t === T.SAND) { if (chance(.18)) dropAt(m, cx, cy, pick(['shell', 'shell', 'stone', 'flint']), 1); return; }
  if (t === T.GRASS || t === T.FOREST || t === T.JUNGLE || t === T.SWAMP) { setT(m, tg.x, tg.y, T.FARM); G.flags.tilled = 1; }
}

// ---------- 飲食 ----------
function consume(i) {
  const s = G.inv[i]; if (!s) return; const def = IT[s.id], p = G.p;
  if (def.upgrade === 'bag') { if (G.invSize >= 32) { toast('これ以上は大きくできない', 'warn'); return; } G.invSize = 32; take1(i); toast('持ち物の枠が32に増えた！', 'good'); sfx('levelup'); return; }
  if (def.tmap != null) {
    const tr = G.treasures[def.tmap]; if (!tr) { toast('かすれて読めない…', 'warn'); return; }
    if (tr.found) { toast('この宝はもう掘り出した', 'warn'); take1(i); return; }
    tr.known = 1; toast('地図に宝のありか（×印）が記された！', 'good'); sfx('page'); UI.openMain('map'); return;
  }
  const e = def.eat; if (!e || (p.cd > 0 && !UI.open)) return;
  if (e.h) p.food = clamp(p.food + e.h, 0, 100);
  if (e.w) p.water = clamp(p.water + e.w, 0, 100);
  if (e.hp) p.hp = clamp(p.hp + e.hp, 0, p.mhp);
  if (e.sta) p.sta = clamp(p.sta + e.sta, 0, 100);
  if (e.poison) { p.poison = Math.max(p.poison, e.poison); toast('うっ…毒だ！', 'bad'); }
  if (e.sick && chance(e.sick)) { p.sick = Math.max(p.sick, 70); toast('お腹の調子が悪い…', 'bad'); }
  if (e.cure === 'poison' || e.cure === 'all') { if (p.poison > 0) toast('毒が消えた', 'good'); p.poison = 0; }
  if (e.cure === 'all') p.sick = 0;
  if (e.fed) p.fed = Math.max(p.fed, e.fed);
  if (e.w < 0) toast('しょっぱい！喉がもっと渇いた…', 'bad');
  sfx((e.w || 0) > (e.h || 0) ? 'drink' : (e.hp && !e.h) ? 'heal' : 'eat');
  if (s.id === 'clean_water' || s.id === 'coconut') G.flags.safe_drink = 1;
  if (s.id === 'coconut') G.flags.drank_coconut = 1;
  if (s.id === 'stew' || s.id === 'fish_soup') unlock('stew');
  floatTxt(p.x, p.y - 22, '+', e.hp && !e.h ? '#7cff9a' : '#ffe08a');
  take1(i); if (def.ret) give(def.ret, 1, true);
  p.cd = .35;
}
function drinkDirect(w) {
  const p = G.p; if (p.cd > 0) return; p.cd = .6;
  if (w.kind === 'sea') { p.water = Math.max(0, p.water - 6); toast('しょっぱい！海水は飲めない…', 'bad', 'sea'); }
  else { p.water = Math.min(100, p.water + 10); if (chance(.2)) { p.sick = Math.max(p.sick, 50); toast('お腹の調子が悪い…（煮沸した方がよさそうだ）', 'bad'); } }
  sfx('drink'); splashParts(w.px, w.py);
}
function fillBowl(w) { take1(G.sel); give(w.kind === 'sea' ? 'sea_water' : 'dirty_water', 1); sfx('splash'); splashParts(w.px, w.py); }

// ---------- 釣り ----------
function startFish(w) { G.p.fishing = { ph: 'cast', t: .45, bx: w.px, by: w.py, kind: w.kind }; sfx('cast'); }
function updFish(dt) {
  const p = G.p, f = p.fishing;
  if (Math.hypot(Inp.mx, Inp.my) > .4 || Inp.pr('B')) { p.fishing = null; return; }
  f.t -= dt;
  switch (f.ph) {
    case 'cast': if (f.t <= 0) { f.ph = 'wait'; f.t = rand(2.5, 7) * (G.rain > .3 ? .7 : 1); } break;
    case 'wait': if (Inp.pr('A')) toast('まだ早い…浮きが沈むのを待とう', '', 'early'); if (f.t <= 0) { f.ph = 'bite'; f.t = .95; sfx('bite'); splashParts(f.bx, f.by); Inp.rumble(.3, .1, 120); } break;
    case 'bite': if (Inp.pr('A')) startReel(f); else if (f.t <= 0) { f.ph = 'wait'; f.t = rand(2, 5); toast('逃げられた…', '', 'miss'); } break;
    case 'reel': {
      f.c += f.v * dt; if (f.c > 1) { f.c = 1; f.v = -Math.abs(f.v); } if (f.c < 0) { f.c = 0; f.v = Math.abs(f.v); }
      if (Inp.pr('A')) {
        if (f.c >= f.za && f.c <= f.za + f.zw) { f.hits++; sfx('reelhit'); if (f.hits >= f.need) { landFish(f); return; } f.za = rand(.05, .95 - f.zw); f.v *= 1.12; }
        else { f.miss++; sfx('no'); if (f.miss >= 3) { toast('糸が切れてしまった…', 'bad'); p.fishing = null; useDur(1); return; } }
      }
      break;
    }
  }
}
function startReel(f) {
  const r = Math.random(); let type;
  if (f.kind === 'sea') type = r < .05 ? 'treasure' : r < .11 ? 'boot' : r < .24 ? 'big' : 'fish';
  else type = r < .05 ? 'boot' : r < .18 ? 'big' : 'fish';
  const cfg = { fish: [2, .3, 1.1], big: [3, .22, 1.45], boot: [1, .4, .9], treasure: [3, .2, 1.35] }[type];
  Object.assign(f, { ph: 'reel', type, need: cfg[0], zw: cfg[1], v: cfg[2], c: 0, za: rand(.15, .9 - cfg[1]), hits: 0, miss: 0 }); sfx('reel');
}
function landFish(f) {
  G.p.fishing = null; useDur(1); sfx('catch'); splashParts(f.bx, f.by);
  if (f.type === 'fish') { give('raw_fish', 1); G.stats.fish++; }
  else if (f.type === 'big') { give('raw_fish', 3); G.stats.fish++; unlock('bigfish'); toast('大物だ！', 'good'); }
  else if (f.type === 'boot') { give('boot', 1); unlock('boot'); }
  else { rollLoot(LOOT.treasure, (id, n) => give(id, Math.min(n, 3))); toast('海の底から宝箱が釣れた！', 'good'); }
  if (G.stats.fish >= 10) unlock('fish1');
}
function shootArrow() {
  const p = G.p; if (p.cd > 0) return;
  if (!cnt('arrow')) { toast('矢がない（作業台で作れる）', 'warn', 'arrow'); sfx('no'); p.cd = .3; return; }
  invRemove('arrow', 1); p.cd = .45;
  let ax = p.ax, ay = p.ay; if (!ax && !ay) { ax = DIRV[p.dir].x; ay = DIRV[p.dir].y; }
  const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
  RT.projs.push({ x: p.x + ax * 6, y: p.y - 6 + ay * 6, vx: ax * 230, vy: ay * 230, dmg: 11, life: .9, r: 3, from: 'p', type: 'arrow' });
  sfx('shoot'); useDur(1);
}

// ---------- オブジェクトを調べる ----------
function useObj(tg) {
  const m = G.map, o = tg.o, od = OB[o.k], cx = tg.x * TS + 8, cy = tg.y * TS + 12, p = G.p;
  p.cd = .25;
  switch (od.use) {
    case 'pick': rollLoot(od.drops, (id, n) => give(id, n)); delO(m, tg.x, tg.y); sfx('pick'); leafParts(cx, cy - 4); break;
    case 'palm': if (o.c > 0) { o.c--; o.shk = .3; dropAt(m, cx, cy - 2, 'coconut', 1); sfx('thud'); r3ObjChanged(m, tg.x, tg.y); } else { o.shk = .2; toast('ココナッツはなっていない', '', 'palm'); } break;
    case 'bush': if (o.r) { o.r = 0; o.t = 30; r3ObjChanged(m, tg.x, tg.y); give('berry', randi(2, 3)); if (chance(.2)) give('berry_seed', 1); sfx('pick'); leafParts(cx, cy - 4); } else toast('まだ実がなっていない', '', 'bush'); break;
    case 'banana': if (o.r) { o.r = 0; o.t = 40; r3ObjChanged(m, tg.x, tg.y); give('banana', randi(2, 3)); sfx('pick'); } else toast('まだバナナはなっていない', '', 'ban'); break;
    case 'crate': {
      if (o.first) { give('cloth', 2); give('rope', 1); give('canned', 1); give('bowl', 1); }
      else rollLoot(LOOT[o.loot || 'beach'], (id, n) => give(id, n));
      delO(m, tg.x, tg.y); G.stats.crates++; sfx('crate'); breakParts(cx, cy - 4, OB.crate); break;
    }
    case 'bottle': {
      delO(m, tg.x, tg.y); sfx('pick');
      const unknown = G.treasures.map((t, i) => i).filter(i => i > 0 && !G.treasures[i].found && !G.treasures[i].known && !cnt('tmap' + i));
      if (unknown.length && chance(.4)) { give('tmap' + pick(unknown), 1); UI.say(['ビンの中には古い地図が入っていた。']); }
      else if (chance(.5)) UI.say(['ビンの中に手紙が入っていた。', pick(TIPS)]);
      else rollLoot(LOOT.bottle, (id, n) => give(id, n));
      break;
    }
    case 'note': delO(m, tg.x, tg.y); readPage(o.pg); break;
    case 'oldpack': delO(m, tg.x, tg.y); give('herb', 3); give('rope', 2); give('bandage', 1); readPage(5); break;
    case 'examine': UI.say([od.txt]); break;
    case 'campfire':
      if (!(o.fuel > 0)) { toast('火が消えている。燃料（木材・枝など）を持ってくべよう', 'warn', 'fireout'); break; }
      UI.openMain('craft', { cat: 'food' }); break;
    case 'workbench': UI.openMain('craft', { cat: 'all' }); break;
    case 'furnace': UI.openMain('craft', { cat: 'mat' }); break;
    case 'bed': trySleep(); break;
    case 'chest': UI.openChest(o); break;
    case 'bag': UI.openChest(o, true); break;
    case 'collector': {
      if (!(o.w > 0)) { toast('まだ水がたまっていない（雨が降るとたまる）', '', 'col'); break; }
      const b = cnt('bowl'); if (!b) { toast('器が必要だ', 'warn', 'bowl'); break; }
      const k = Math.min(b, o.w); invRemove('bowl', k); give('clean_water', k); o.w -= k; G.flags.gotclean = 1; sfx('splash'); break;
    }
    case 'crop': {
      if (o.g >= 1) { const c = CROPS[o.c]; for (const [id, a, b] of c.out) give(id, randi(a, b)); delO(m, tg.x, tg.y); sfx('pick'); leafParts(cx, cy - 4); G.stats.harvest++; if (G.stats.harvest >= 10) unlock('farmer'); }
      else toast('まだ育っていない（' + Math.floor(o.g * 100) + '%）', '', 'crop');
      break;
    }
    case 'cave_in': {
      if (!heldLight()) UI.ask('中は真っ暗だ。明かり（たいまつ等）を持っていないけど入る？', ['入る', 'やめる'], i => { if (i === 0) enterCave(); });
      else enterCave(); break;
    }
    case 'cave_out': travel('island', G.pois.cave.x, G.pois.cave.y + 1); break;
    case 'shrine':
      if (o.has) { o.has = 0; give('tablet_a', 1); sfx('item'); UI.say(['祠の奥に、太陽の紋様が刻まれた石版が祀られていた。', '「太陽の石版」を手に入れた。']); }
      else UI.say(['空になった小さな祠。山頂の風が吹き抜けていく。']); break;
    case 'altar': UI.openAltar(o); break;
    case 'rdoor': UI.say(['固く閉ざされた石の扉だ。', '太陽・月・星の紋様が刻まれている。中庭の祭壇と関係がありそうだ。']); break;
    case 'pedestal':
      if (o.has) { o.has = 0; give('antenna', 1); sfx('item'); UI.say(['台座には奇妙な金属の棒が祀られていた。', '「アンテナ」を手に入れた。']); }
      else UI.say(['何も置かれていない台座だ。']); break;
    case 'radio': UI.openRadio(o); break;
    case 'lifeboat':
      if (!G.boss.kingcrab) { UI.say(['かもめ丸の救命ボートだ。', '…砂の下で何か巨大なものが動いた気がする。']); break; }
      if (o.done) { UI.say(['空っぽの救命ボートだ。']); break; }
      o.done = 1; sfx('crate'); give('battery', 1); give('canned', 3); give('cloth', 4); give('rope', 3); give('bandage', 2); readPage(7); break;
    case 'milcrate':
      if (!G.boss.golem) { UI.say(['古い軍の物資箱だ。', '番人の目が光っている…。今は開けられそうにない。']); break; }
      if (o.done) { UI.say(['空っぽの物資箱だ。']); break; }
      o.done = 1; sfx('crate'); give('tube', 1); give('lantern', 1); give('medicine', 2); give('canned', 3); give('iron', 5);
      UI.say(['物資箱の中から、厳重に梱包された「真空管」が見つかった！']); break;
    case 'signal': signalUse(o); break;
    case 'raft': UI.openRaft(o); break;
    case 'heli': UI.ask('救助ヘリに乗り込みますか？（島を脱出します）', ['乗り込む', 'まだ残る'], i => { if (i === 0) triggerEnding('C'); }); break;
  }
}
function heldLight() { const s = held(); return s && IT[s.id].light; }
function enterCave() { const e = G.caveInfo.entrance; travel('cave', e.x + 1, e.y); }
function addFuel(o) {
  const s = held(); if (!s) return; const def = IT[s.id]; if (!def.fuel) return;
  const max = 600; if ((o.fuel || 0) >= max - 5) { toast('これ以上はくべられない', '', 'fuelmax'); return; }
  const was = o.fuel > 0; o.fuel = Math.min(max, (o.fuel || 0) + def.fuel * (o.k === 'signal' ? .7 : 1)); take1(G.sel);
  sfx(was ? 'fuel' : 'ignite'); sparkParts(o.x * TS + 8, o.y * TS + 6); G.map.litDirty = true; G.p.cd = .2;
}
function signalUse(o) {
  if (o.fuel > 0) { UI.say(['のろしが勢いよく燃えている。（あと約' + Math.ceil(o.fuel / (DAY_LEN / 24)) + '時間）', G.ship ? '船よ、気づいてくれ…！' : '晴れた日に船が通るのを待とう。']); return; }
  if (cnt('wood') >= 10) UI.ask('のろしに火をつけますか？（木材×10を使う）' + (G.ship ? '' : '\n※船が見えていないうちに燃やすと、燃え尽きてしまうかも'), ['火をつける', 'やめる'], i => {
    if (i !== 0) return; invRemove('wood', 10); o.fuel = 300; sfx('ignite'); toast('のろしが上がった！', 'good'); G.map.litDirty = true; sparkParts(o.x * TS + 8, o.y * TS);
  });
  else UI.say(['のろしに火をつけるには木材が10個必要だ。', '晴れた日に船が見えたら火をつけよう。']);
}
function readPage(n) {
  const first = !G.pages[n]; G.pages[n] = 1; const pg = PAGES[n];
  sfx('page'); UI.say([{ name: '日記 その' + n + '「' + pg.t + '」', text: pg.b.join('\n'), book: 1 }]);
  if (first) toast('日記のページを手に入れた（' + pageCount() + '/10）', 'good');
  if (pageCount() >= 10) unlock('pages');
}
const pageCount = () => G.pages.filter(Boolean).length;
function findObj(k) {
  const c = RT.find[k]; if (c && RT.clock - c.t < 1) return c.o;
  const m = G.maps.island; let f = null; for (const o of m.o) if (o && o.k === k) { f = o; break; }
  RT.find[k] = { t: RT.clock, o: f }; return f;
}
function trySleep() {
  const h = hour();
  if (!(h >= 19 || h < 5)) { toast('まだ眠くない…（夜19時から眠れる）', 'warn', 'sleep'); return; }
  if (enemyNear(9)) { toast('近くに危険な動物がいて眠れない！', 'bad', 'sleepe'); return; }
  const p = G.p;
  UI.fade(() => {
    if (h >= 19) { G.day++; onNewDay(); }
    G.time = 6 / 24; G.lastHour = 6;
    p.food = Math.max(5, p.food - 12); p.water = Math.max(5, p.water - 16); p.hp = Math.min(p.mhp, p.hp + 40); p.sta = 100; p.temp = Math.max(p.temp, 55);
    G.spawnPt = { map: G.mapId, x: Math.floor(p.x / TS), y: Math.floor((p.y - 3) / TS) };
    for (const e of G.map.ents) if (e.def.night) e.dead = true;
    hourTick(6);
    const ok = saveGame(G.slot, true);
    toast(G.day + '日目の朝になった。' + (ok ? '（セーブしました）' : ''), 'good'); sfx('morning');
  }, 900);
}
function enemyNear(r) { const p = G.p; return G.map.ents.some(e => !e.dead && (e.def.ai === 'aggro' || e.def.boss || e.aggro > 0) && Math.hypot(e.x - p.x, e.y - p.y) < r * TS); }

// ---------- 無線・いかだ・祭壇 ----------
const RADIO_NEED = [['tube', 1], ['antenna', 1], ['battery', 1], ['scrap', 4]];
function repairRadio(o) {
  for (const [k, n] of RADIO_NEED) if (cnt(k) < n) return false;
  for (const [k, n] of RADIO_NEED) invRemove(k, n);
  o.fixed = 1; sfx('craft'); toast('無線機が直った！', 'good'); return true;
}
function callRescue() {
  if (G.rescue) return; G.rescue = { day: G.day + 1, st: 'wait' };
  sfx('radio');
  UI.say([{ name: '無線機', text: 'ザザッ…ザ……こちら……海上保安庁……聞こえ……' }, { name: 'あなた', text: '聞こえますか！島にいます！遭難者です！' },
    { name: '無線機', text: '…確認した。そちらの位置を特定した。明日の正午、救助ヘリを向かわせる。' }, { name: '無線機', text: '小屋の前の開けた場所に着陸する。それまで、なんとか持ちこたえてくれ。' }],
    () => toast('明日の正午に救助ヘリが来る！今夜は動物が多い。気をつけよう', 'big'));
}
function heliArrive() {
  const m = G.maps.island, h = G.heli;
  const pos = freeNear(m, h.x, h.y, (x, y) => landT(tAt(m, x, y)) && !oAt(m, x, y) && !oAt(m, x - 1, y) && !oAt(m, x + 1, y) && landT(tAt(m, x - 1, y)) && landT(tAt(m, x + 1, y)), 12) || h;
  setO(m, pos.x, pos.y, { k: 'heli' }); G.rescue.st = 'landed'; G.rescue.x = pos.x; G.rescue.y = pos.y;
  toast('救助ヘリが小屋の前に着陸した！急ごう！', 'big'); sfx('heli');
}
function raftInstall(o, part) {
  if (part === 'sail' && !o.sail && cnt('sail')) { invRemove('sail', 1); o.sail = 1; }
  else if (part === 'oar' && (o.oar || 0) < 2 && cnt('oar')) { const k = Math.min(2 - (o.oar || 0), cnt('oar')); invRemove('oar', k); o.oar = (o.oar || 0) + k; }
  else if (part === 'compass' && !o.compass && cnt('compass')) { invRemove('compass', 1); o.compass = 1; }
  else return false;
  sfx('place'); return true;
}
const raftParts = o => o.sail && o.oar >= 2 && o.compass;
const raftReady = o => raftParts(o) && cnt('jerky') >= 5 && cnt('clean_water') >= 5;
function launchRaft(o) {
  if (!raftReady(o)) return;
  saveGame(G.slot, true);
  invRemove('jerky', 5); invRemove('clean_water', 5); invAdd('bowl', 5);
  startVoyage(o);
}
function altarPlace(o) {
  const ids = ['tablet_a', 'tablet_b', 'tablet_c']; o.has = o.has || {}; let placed = 0;
  for (const id of ids) if (!o.has[id] && cnt(id)) { invRemove(id, 1); o.has[id] = 1; placed++; }
  o.n = Object.keys(o.has).length;
  if (placed) sfx('place');
  if (o.n >= 3 && !G.flags.ruinsOpen) {
    G.flags.ruinsOpen = 1; const m = G.maps.island;
    for (let i = 0; i < m.o.length; i++) { const d = m.o[i]; if (d && d.k === 'rdoor') { poofParts(d.x * TS + 8, d.y * TS + 4, 30, ['#8a7f9a', '#c48ef0', '#ffffff']); delO(m, d.x, d.y); } }
    shake(8); sfx('door'); unlock('ruins'); toast('遺跡の扉が開いた！', 'big');
  }
  return placed;
}

// ---------- 時間・天候 ----------
function updTime(dt) {
  G.time += dt / DAY_LEN; if (G.time >= 1) { G.time -= 1; G.day++; onNewDay(); }
  const h = Math.floor(hour()); if (h !== G.lastHour) { G.lastHour = h; hourTick(h); }
  G.playTime += dt;
  const tr = { clear: 0, cloudy: 0, rain: .65, storm: 1 }[G.weather] || 0;
  G.rain += (tr - G.rain) * Math.min(1, dt * .25);
}
function onNewDay() {
  if (G.day >= 2) unlock('night1'); if (G.day >= 10) unlock('day10'); if (G.day >= 30) unlock('day30');
  G.shipPlan = (G.day >= 3 && Math.random() < .5) ? { h: randi(9, 14) } : null;
}
function hourTick(h) {
  G.wT--; if (G.wT <= 0) changeWeather();
  for (const id in G.maps) objTick(G.maps[id], h);
  if (h === 6) { notice(G.day + '日目'); if (G.mapId === 'island') beachWash(1); }
  if (G.shipPlan && h === G.shipPlan.h && !G.ship && G.weather !== 'storm') startShip();
  if (G.rescue && G.rescue.st === 'wait' && G.day >= G.rescue.day && h >= 12) heliArrive();
  if (h === 19 && G.mapId === 'island') toast('日が暮れてきた。夜は危険な動物が出る', 'warn');
}
function changeWeather() {
  const tr = { clear: [['clear', .55], ['cloudy', .33], ['rain', .12]], cloudy: [['clear', .35], ['cloudy', .3], ['rain', .28], ['storm', .07]], rain: [['cloudy', .4], ['rain', .3], ['storm', .1], ['clear', .2]], storm: [['rain', .55], ['cloudy', .45]] }[G.weather] || [['clear', 1]];
  let r = Math.random(), nw = G.weather; for (const [w, pr] of tr) { if (r < pr) { nw = w; break; } r -= pr; }
  if (G.day <= 1 && (nw === 'rain' || nw === 'storm')) nw = 'cloudy';
  if (G.rescue && G.rescue.st === 'wait' && isNight()) nw = 'storm';
  const prev = G.weather; G.weather = nw; G.wT = randi(3, 6);
  if (prev === 'storm' && nw !== 'storm') { beachWash(3); toast('嵐が去った。浜辺に何か流れ着いているかも', 'good'); }
  if (nw !== prev && G.mapId === 'island') { const msg = { clear: '空が晴れてきた', cloudy: '雲が出てきた', rain: '雨が降り出した', storm: '嵐がやってきた！' }[nw]; toast(msg, nw === 'storm' ? 'bad' : ''); }
}
function beachWash(k) {
  const m = G.maps.island, p = G.p;
  const items = k >= 3 ? ['crate', 'crate', 'bottle', 'driftwood', 'driftwood', 'driftwood', 'driftwood', 'shell_o', 'shell_o'] : (chance(.35) ? ['bottle', 'driftwood'] : ['driftwood']);
  for (const k2 of items) for (let t = 0; t < 60; t++) {
    const x = randi(2, m.w - 3), y = randi(2, m.h - 3); if (m.t[y * m.w + x] !== T.SAND || m.o[y * m.w + x]) continue;
    if (G.mapId === 'island' && Math.hypot(x * TS - p.x, y * TS - p.y) < 10 * TS) continue;
    setO(m, x, y, k2 === 'crate' ? mkO('crate', { loot: 'beach' }) : mkO(k2)); break;
  }
}
const CAPS = { grass: 260, twig: 110, pebble: 130, fern: 300, shell_o: 24, driftwood: 24, mushroom_o: 60, herb_o: 70, clay_o: 34, rock: 210, iron_rock: 70, bush: 100, potato_o: 18, flower: 90, coal_rock: 34, crystal_rock: 16, red_mushroom_o: 8 };
const SPAWNS = {
  [T.SAND]: [['shell_o', .12], ['driftwood', .08], ['pebble', .05]],
  [T.GRASS]: [['grass', .3], ['twig', .15], ['pebble', .12], ['flower', .08], ['bush', .03], ['potato_o', .03], ['herb_o', .03]],
  [T.FOREST]: [['twig', .25], ['fern', .2], ['mushroom_o', .1], ['grass', .1], ['herb_o', .05]],
  [T.JUNGLE]: [['fern', .3], ['mushroom_o', .06], ['herb_o', .06], ['twig', .1]],
  [T.ROCK]: [['pebble', .3], ['rock', .1], ['iron_rock', .04]],
  [T.SWAMP]: [['clay_o', .12], ['mushroom_o', .1], ['red_mushroom_o', .04], ['herb_o', .06]],
  [T.CFLOOR]: [['coal_rock', .07], ['iron_rock', .07], ['crystal_rock', .03], ['rock', .05], ['mushroom_o', .05]],
};
function objTick(m, h) {
  const counts = {}, rainK = (m.id === 'island' && G.rain > .3) ? 1.6 : 1, p = G.p;
  const ptx = Math.floor(p.x / TS), pty = Math.floor((p.y - 3) / TS), here = G.mapId === m.id;
  for (let i = 0; i < m.o.length; i++) {
    const o = m.o[i]; if (!o) continue; counts[o.k] = (counts[o.k] || 0) + 1;
    switch (o.k) {
      case 'bush': case 'banana_tree': if (!o.r) { o.t = (o.t == null ? 30 : o.t) - rainK; if (o.t <= 0) { o.r = 1; o.t = null; r3ObjChanged(m, o.x, o.y); } } break;
      case 'palm': if ((o.c || 0) < 2 && Math.random() < .03) { o.c = (o.c || 0) + 1; r3ObjChanged(m, o.x, o.y); } break;
      case 'stump': if (o.was) { o.t = (o.t == null ? 30 : o.t) - 1; if (o.t <= 0) setO(m, o.x, o.y, { k: 'sapling', was: o.was, t: 36 }); } break;
      case 'sapling': o.t -= rainK; if (o.t <= 0 && !(here && Math.abs(o.x - ptx) <= 1 && Math.abs(o.y - pty) <= 1) && safeBlock(m, o.x, o.y)) { const n = mkO(o.was || 'tree'); if (o.was === 'palm') n.c = 0; setO(m, o.x, o.y, n); } break;
      case 'crop': o.g = Math.min(1, o.g + rainK / (CROPS[o.c].days * 24)); break;
      case 'collector': if (m.id === 'island') { if (G.rain > .3) o.w = Math.min(4, (o.w || 0) + (G.weather === 'storm' ? 2 : 1)); else if (h === 6) o.w = Math.min(4, (o.w || 0) + 1); } break;
    }
  }
  const tries = m.id === 'island' ? 10 : 4;
  for (let k = 0; k < tries; k++) {
    const x = randi(1, m.w - 2), y = randi(1, m.h - 2), idx = y * m.w + x; if (m.o[idx]) continue;
    if (here && Math.hypot(x - ptx, y - pty) < 14) continue;
    const list = SPAWNS[m.t[idx]]; if (!list) continue;
    if (m.id === 'island' && G.treasures.some(tr => !tr.found && tr.x === x && tr.y === y)) continue;
    let r = Math.random();
    for (const [kk, pr] of list) {
      if (r < pr) {
        if ((counts[kk] || 0) < (CAPS[kk] || 50)) {
          if (OB[kk].solid) { if (m.id === 'cave') { let w = false; for (const d of DIRV) if (tAt(m, x + d.x, y + d.y) === T.CWALL) w = true; if (!w) break; } if (!safeBlock(m, x, y)) break; }
          setO(m, x, y, mkO(kk)); counts[kk] = (counts[kk] || 0) + 1;
        }
        break;
      }
      r -= pr;
    }
  }
  clayTick(m, counts, here, ptx, pty);
}
// そのマスをふさいでも周囲の通路がつながったままか（局所的な連結チェック）
function safeBlock(m, x, y) {
  const ring = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const free = ring.map(([dx, dy]) => { const t = tAt(m, x + dx, y + dy), o = oAt(m, x + dx, y + dy); return walkT(t) && !(o && OB[o.k].solid && !OB[o.k].mobOnly); });
  const f = i => free[(i + 8) % 8];
  const orth = [1, 3, 5, 7].filter(i => f(i)); if (orth.length <= 1) return true;
  let comps = orth.length; for (const i of [1, 3, 5, 7]) if (f(i) && f(i + 2) && f(i + 1)) comps--;
  return comps <= 1;
}
function clayTick(m, counts, here, ptx, pty) {
  if (m.id !== 'island' || (counts.clay_o || 0) >= 12) return;
  for (let k = 0; k < 60; k++) {
    const x = randi(2, m.w - 3), y = randi(2, m.h - 3), i = y * m.w + x, t = m.t[i];
    if (m.o[i] || (here && Math.hypot(x - ptx, y - pty) < 12)) continue;
    const green = t === T.GRASS || t === T.FOREST || t === T.JUNGLE;
    if (t === T.SWAMP || (green && DIRV.some(d => { const n = tAt(m, x + d.x, y + d.y); return n === T.FRESH || (k > 30 && n === T.SHALLOW); }))) { setO(m, x, y, mkO('clay_o')); counts.clay_o = (counts.clay_o || 0) + 1; return; }
  }
}
function startShip() {
  const m = G.maps.island; G.shipPlan = null;
  G.ship = { t: 120, dur: 120, y: (Math.random() < .5 ? 5 : m.h - 6) * TS, dir: Math.random() < .5 ? 1 : -1, chk: 0 };
  toast('水平線に船の影が見える！のろしを上げるなら今だ！', 'big'); sfx('horn');
}
function updShip(dt) {
  const s = G.ship; s.t -= dt; s.chk -= dt;
  if (s.chk <= 0) {
    s.chk = 1; const sig = findObj('signal');
    if (sig && sig.fuel > 0 && findObj('sos')) { G.ship = null; shipRescue(); return; }
  }
  if (s.t <= 0) {
    const sig = findObj('signal');
    toast(sig && sig.fuel > 0 ? '船は気づかずに去っていった…浜辺にSOSのサインがあれば…' : '船は水平線の向こうへ去っていった…', 'warn');
    G.ship = null;
  }
}
function shipRescue() {
  sfx('horn');
  UI.say(['汽笛が鳴った！', '船が進路を変え、まっすぐ島へ向かってくる！'], () => triggerEnding('B'));
}

// ---------- 地点・目標 ----------
function revealAround(force) {
  const p = G.p, m = G.map, tx = Math.floor(p.x / TS), ty = Math.floor((p.y - 3) / TS);
  const key = tx + ty * 10000 + (m.id === 'cave' ? 1e8 : 0); if (!force && key === RT.lastTile) return; RT.lastTile = key;
  const R2 = m.id === 'cave' ? 6 : 9;
  for (let j = -R2; j <= R2; j++) for (let i = -R2; i <= R2; i++) {
    if (i * i + j * j > R2 * R2) continue; const x = tx + i, y = ty + j; if (!inB(m, x, y)) continue;
    const idx = y * m.w + x; if (!m.seen[idx]) { m.seen[idx] = 1; mmPaint(m, x, y); }
  }
}
function poiTick() {
  if (G.mapId !== 'island') return; const p = G.p, px = p.x / TS, py = p.y / TS;
  for (const k in G.pois) { const po = G.pois[k]; if (po.found) continue; if (Math.hypot(px - po.x, py - po.y) <= po.r) { po.found = 1; if (!po.hidden) { notice('発見：' + po.n); sfx('discover'); } RT.questDirty = true; } }
}
function questTick() {
  if (G.quest >= QUESTS.length - 1) return;
  const q = QUESTS[G.quest];
  if (qProg(q).ok) { G.quest++; toast('目標達成：' + q.t, 'quest'); sfx('quest'); RT.questDirty = true; }
}
function routes() {
  const r = findObj('raft'), radio = findObj('radio'), fixed = !!(radio && radio.fixed), b = x => x ? 1 : 0;
  return [
    { n: 'いかだで脱出', items: [['浅瀬に「いかだの土台」を設置', b(r), 1], ['帆を取り付ける', b(r && r.sail), 1], ['オールを取り付ける', r ? Math.min(2, r.oar || 0) : 0, 2], ['方位磁針を取り付ける', b(r && r.compass), 1], ['干し肉', Math.min(5, cnt('jerky')), 5], ['きれいな水', Math.min(5, cnt('clean_water')), 5]] },
    { n: 'のろしで救助', items: [['山頂に「のろし台」を設置', b(findObj('signal')), 1], ['砂浜に「SOSサイン」を設置', b(findObj('sos')), 1], ['船が見えたら、のろしに火をつける', 0, 1]] },
    { n: '無線で救助', items: [['真空管（洞窟の最深部）', b(fixed || cnt('tube')), 1], ['アンテナ（遺跡の奥）', b(fixed || cnt('antenna')), 1], ['バッテリー（北の入り江）', b(fixed || cnt('battery')), 1], ['金属くず', fixed ? 4 : Math.min(4, cnt('scrap')), 4], ['小屋の無線機を修理する', b(fixed), 1], ['無線で救助を呼ぶ', b(G.rescue), 1]] },
  ];
}

// ---------- 状態・体温 ----------
function nearHeat() {
  const p = G.p; for (const o of getLit(G.map)) {
    const d = Math.hypot(o.x * TS + 8 - p.x, o.y * TS + 10 - p.y) / TS;
    if (o.k === 'campfire' && o.fuel > 0 && d < 3.5) return true; if (o.k === 'torch_post' && d < 2.2) return true; if (o.k === 'signal' && o.fuel > 0 && d < 4.5) return true;
  }
  return false;
}
function tempTarget() {
  const h = hour(), p = G.p; let t;
  if (G.mapId === 'cave') t = 50;
  else { t = (h >= 7 && h < 17) ? (G.weather === 'clear' ? 76 : 66) : ((h >= 17 && h < 20) || (h >= 5 && h < 7)) ? 56 : 38; const ar = G.armor ? IT[G.armor.id].armor : null; t -= G.rain * 24 * (ar ? ar.rain : 1); }
  if (G.armor) t += IT[G.armor.id].armor.warm * (t < 65 ? 1 : .2);
  if (tAt(G.map, Math.floor(p.x / TS), Math.floor((p.y - 2) / TS)) === T.SHALLOW) t -= 12;
  if (RT.heat) t = Math.max(t, 90);
  return clamp(t, 0, 100);
}
let warnT = 0;
function updStats(dt) {
  const p = G.p, D = DIFF[G.diff], h = hour();
  const fedK = p.fed > 0 ? .5 : 1, sickK = p.sick > 0 ? 2 : 1;
  p.food = Math.max(0, p.food - .1 * dt * D.drain * fedK * sickK * (p.running ? 1.25 : 1));
  p.water = Math.max(0, p.water - .135 * dt * D.drain * sickK * (p.running ? 1.5 : 1) * (G.mapId === 'island' && G.weather === 'clear' && h > 10 && h < 16 ? 1.2 : 1));
  RT.heatT -= dt; if (RT.heatT <= 0) { RT.heatT = .5; RT.heat = nearHeat(); }
  p.temp += (tempTarget() - p.temp) * Math.min(1, dt * .06);
  if (p.staDelay > 0) p.staDelay -= dt; else p.sta = Math.min(100, p.sta + 18 * dt * (p.temp < 30 ? .5 : 1) * (p.food < 10 ? .5 : 1));
  if (p.fed > 0) p.fed -= dt; if (p.sick > 0) p.sick -= dt;
  if (p.poison > 0) { p.poison -= dt; if (p.hp > 1) p.hp = Math.max(1, p.hp - 1.3 * dt); }
  let dmg = 0; if (p.food <= 0) dmg += .7; if (p.water <= 0) dmg += .9; if (p.temp < 12) dmg += .6;
  if (dmg > 0) { p.hp -= dmg * dt; RT.starveT = (RT.starveT || 0) + dt; if (RT.starveT > 1.4) { RT.starveT = 0; RT.flash = Math.max(RT.flash, .12); } if (p.hp <= 0) die(); }
  else if (p.food > 45 && p.water > 45 && p.poison <= 0 && p.temp >= 25) p.hp = Math.min(p.mhp, p.hp + (p.fed > 0 ? .8 : .3) * dt);
  warnT -= dt;
  if (warnT <= 0) {
    warnT = 25;
    if (p.water < 20) toast('喉が渇いた…水を飲もう', 'warn');
    else if (p.food < 20) toast('お腹がすいた…何か食べよう', 'warn');
    else if (p.temp < 25) toast('体が冷えている…火のそばで温まろう', 'warn');
    else warnT = 3;
  }
}

// ---------- 移動 ----------
function solidAt(m, x0, y0, x1, y1, who) {
  const tx0 = Math.floor(x0 / TS), tx1 = Math.floor((x1 - .01) / TS), ty0 = Math.floor(y0 / TS), ty1 = Math.floor((y1 - .01) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) {
    if (tx >= tx0 && tx <= tx1) {
      const t = tAt(m, tx, ty);
      if (who === 'fly') { if (t === T.CWALL || t === T.RWALL || t === T.LOGWALL || !inB(m, tx, ty)) return true; }
      else { if (isSolidT(t)) return true; if (who === 'land' && t === T.SHALLOW) return true; }
    }
    if (who === 'fly') continue;
    const o = oAt(m, tx, ty); if (!o) continue; const od = OB[o.k]; if (!od.solid) continue; if (od.mobOnly && who === 'p') continue;
    const b = od.box || [0, 0, 16, 16];
    if (x0 < tx * TS + b[2] && x1 > tx * TS + b[0] && y0 < ty * TS + b[3] && y1 > ty * TS + b[1]) return true;
  }
  return false;
}
function moveP(dx, dy) {
  const p = G.p, m = G.map, steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx) { const nx = p.x + sx; if (!solidAt(m, nx - 4, p.y - 4, nx + 4, p.y, 'p')) p.x = nx; else if (!sy) { for (const n of [-3, 3]) if (!solidAt(m, nx - 4, p.y - 4 + n, nx + 4, p.y + n, 'p') && !solidAt(m, p.x - 4, p.y - 4 + Math.sign(n), p.x + 4, p.y + Math.sign(n), 'p')) { p.y += Math.sign(n) * .6; break; } } }
    if (sy) { const ny = p.y + sy; if (!solidAt(m, p.x - 4, ny - 4, p.x + 4, ny, 'p')) p.y = ny; else if (!sx) { for (const n of [-3, 3]) if (!solidAt(m, p.x - 4 + n, ny - 4, p.x + 4 + n, ny, 'p') && !solidAt(m, p.x - 4 + Math.sign(n), p.y - 4, p.x + 4 + Math.sign(n), p.y, 'p')) { p.x += Math.sign(n) * .6; break; } } }
  }
}
function moveEnt(m, e, dx, dy) {
  const r = e.def.r * .7, who = (e.def.fly && (e.k !== 'gull' || e.fl)) ? 'fly' : (e.def.land ? 'land' : 'amph');
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5)); let blocked = false;
  for (let i = 0; i < steps; i++) {
    const sx = dx / steps, sy = dy / steps;
    if (sx) { const nx = e.x + sx; if (!solidAt(m, nx - r, e.y - r * .7, nx + r, e.y, who)) e.x = nx; else blocked = true; }
    if (sy) { const ny = e.y + sy; if (!solidAt(m, e.x - r, ny - r * .7, e.x + r, ny, who)) e.y = ny; else blocked = true; }
  }
  return blocked;
}
function updPlayer(dt) {
  const p = G.p, m = G.map;
  p.inv = Math.max(0, p.inv - dt); p.cd = Math.max(0, p.cd - dt); p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  if (Math.abs(p.kbx) + Math.abs(p.kby) > 1) { moveP(p.kbx * dt, p.kby * dt); const k = Math.pow(.0005, dt); p.kbx *= k; p.kby *= k; } else { p.kbx = p.kby = 0; }
  if (Inp.pr('LB')) { G.sel = (G.sel + 7) % 8; invChanged(); sfx('tick'); }
  if (Inp.pr('RB')) { G.sel = (G.sel + 1) % 8; invChanged(); sfx('tick'); }
  if (p.fishing) { updFish(dt); p.moving = false; p.running = false; return; }
  let mx = Inp.mx, my = Inp.my; const mag = Math.hypot(mx, my);
  p.moving = mag > .15;
  if (p.moving) {
    if (mag > 1) { mx /= mag; my /= mag; }
    p.ax = mx; p.ay = my;
    if (!p.swing) { if (Math.abs(mx) > Math.abs(my) * 1.05) p.dir = mx > 0 ? 1 : 3; else p.dir = my > 0 ? 2 : 0; }
    const t = tAt(m, Math.floor(p.x / TS), Math.floor((p.y - 2) / TS));
    let spd = 66 * (TINFO[t].spd || 1);
    p.running = Inp.dn('B') && p.sta > 1 && !p.swing;
    if (p.running) { spd *= 1.65; p.sta = Math.max(0, p.sta - 13 * dt); p.staDelay = .6; }
    if (p.swing > 0) spd *= .45; if (p.food <= 0 || p.water <= 0) spd *= .85;
    const ox = p.x, oy = p.y;
    moveP(mx * spd * dt, my * spd * dt);
    G.stats.dist += Math.hypot(p.x - ox, p.y - oy);
    p.anim += dt * (p.running ? 11 : 7.5);
    if ((t === T.SHALLOW) && Math.random() < dt * 6) splashParts(p.x, p.y - 1, 1);
  } else { p.running = false; p.anim = 0; }
  // 手持ちのたいまつ
  const s = held(); if (s && IT[s.id].burn) { s.d -= dt; if (s.d <= 0) { toast('たいまつが燃え尽きた', 'warn'); G.inv[G.sel] = null; } if (Math.floor(s.d + dt) !== Math.floor(s.d)) invChanged(); }
  if (p.swing > 0) {
    p.swing += dt;
    if (!p.swHit && p.swing >= p.swDur * .45) { p.swHit = true; resolveSwing(); }
    if (p.swing >= p.swDur) { p.swing = 0; p.cd = .06; }
  } else if (p.pick) {
    // 設置物：短く押す＝使う／長押し＝回収
    const pk = p.pick, tg = getTarget();
    if (tg.o !== pk.o || oAt(m, pk.x, pk.y) !== pk.o) { p.pick = null; }
    else if (Inp.dn('A')) {
      p.pickT += dt;
      if (p.pickT >= .9) { p.pick = null; p.cd = .35; p.rep = false; dismantle(pk.x, pk.y, pk.o); toast(OB[pk.o.k].n + 'を回収した', 'good'); RT.find = {}; }
    } else { const a = p.pickA, tap = p.pickT < .3; p.pick = null; if (tap && a) { p.rep = !!a.rep; a.f(); } }
  } else if (Inp.pr('A')) {
    const a = actionInfo();
    if (a && a.pick && p.cd <= 0) { p.pick = a.pick; p.pickT = 0; p.pickA = a; }
    else doAction();
  }
  else if (Inp.dn('A') && p.rep && p.cd <= 0) { const a = actionInfo(); if (a && a.rep && !a.pick) a.f(); }
}

// ---------- ダメージ ----------
function hurtPlayer(dmg, sx, sy, opt) {
  const p = G.p; if (p.inv > 0 || p.dead || G.mode !== 'play') return;
  const def = G.armor ? IT[G.armor.id].armor.def : 0;
  const d = Math.max(1, Math.round(dmg * DIFF[G.diff].dmg - def));
  p.hp -= d; p.inv = .8; p.hurtFlash = .3; p.fishing = null;
  const a = Math.atan2(p.y - sy, p.x - sx); p.kbx = Math.cos(a) * 150; p.kby = Math.sin(a) * 150;
  if (opt && opt.poison) { if (p.poison <= 0) toast('毒を受けた！薬草で治せる', 'bad'); p.poison = Math.max(p.poison, opt.poison); }
  floatTxt(p.x, p.y - 20, '-' + d, '#ff5a6a'); sfx('hurt'); shake(4); RT.flash = Math.max(RT.flash, .22); Inp.rumble(.6, .4, 160);
  if (p.hp <= 0) die();
}
function hurtMob(e, dmg, fx, fy) {
  if (e.dead || e.hidden) return;
  e.hp -= dmg; e.hurt = .15; e.aggro = 12;
  if (e.def.boss && e.st === 'idle') { e.st = 'move'; e.t = 1; bossStart(e); }
  if (!e.def.boss) { const a = Math.atan2(e.y - fy, e.x - fx); e.kbx = Math.cos(a) * 130; e.kby = Math.sin(a) * 130; if (e.st === 'wind') e.st = 'chase'; }
  if (OPT.dmgNum) floatTxt(e.x, e.y - e.def.r * 2 - 6, String(dmg), '#ffffff');
  sfx('hit'); hitSpark(e.x, e.y - e.def.r);
  if (e.hp <= 0) killMob(e);
}
function killMob(e) {
  const m = G.map; e.dead = true;
  rollLoot(e.def.drops, (id, n) => dropAt(m, e.x, e.y - 4, id, n));
  poofParts(e.x, e.y - 6, e.def.boss ? 40 : 12); sfx(e.def.boss ? 'bossdie' : 'kill');
  G.stats.kills++; if (G.stats.kills >= 30) unlock('hunter');
  if (e.k === 'golem') { G.boss.golem = 1; unlock('golem'); toast('古代の番人を倒した！奥の物資箱を調べよう', 'big'); }
  if (e.k === 'kingcrab') { G.boss.kingcrab = 1; unlock('kingcrab'); toast('キングクラブを倒した！救命ボートを調べよう', 'big'); }
  if (e.def.boss) { RT.boss = null; UI.bossBar(null); shake(10); updateMusic(true); }
}
function die() {
  const p = G.p; if (p.dead) return;
  p.dead = true; p.hp = 0; p.fishing = null; p.swing = 0; p.pick = null; G.stats.deaths++; sfx('die'); G.mode = 'dead'; RT.deadT = 0; RT.deadShown = 0;
  RT.lostItems = false;
  if (!DIFF[G.diff].keep) {
    const items = []; for (let i = 0; i < G.invSize; i++) { const s = G.inv[i]; if (s && !IT[s.id].key) { items.push(s); G.inv[i] = null; } }
    if (items.length) {
      const m = G.map; const pt = freeNear(m, Math.floor(p.x / TS), Math.floor((p.y - 3) / TS), (x, y) => landT(tAt(m, x, y)) && !oAt(m, x, y), 12);
      if (pt) { setO(m, pt.x, pt.y, { k: 'bag', items }); RT.lostItems = true; } else for (const s of items) invAdd(s.id, s.n, s.d);
    }
    invChanged();
  }
  playBgm(null);
}
function respawn() {
  const p = G.p, sp = G.spawnPt;
  UI.fade(() => {
    if (G.mapId !== sp.map) switchMap(sp.map);
    const m = G.map; let x = sp.x, y = sp.y;
    if (solidAt(m, x * TS + 4, y * TS + 8, x * TS + 12, y * TS + 12, 'p')) { const f = freeNear(m, x, y, (a, b) => walkT(tAt(m, a, b)) && !(oAt(m, a, b) && OB[oAt(m, a, b).k].solid), 6); if (f) { x = f.x; y = f.y; } }
    p.x = x * TS + 8; p.y = y * TS + 12; p.dead = false; p.hp = 60; p.food = Math.max(p.food, 50); p.water = Math.max(p.water, 50); p.sta = 100; p.temp = 60; p.poison = 0; p.sick = 0; p.inv = 2; p.kbx = p.kby = 0;
    for (const e of m.ents) if (!e.def.boss && Math.hypot(e.x - p.x, e.y - p.y) < 12 * TS) e.dead = true;
    for (const e of m.ents) if (e.def.boss) bossReset(e);
    G.mode = 'play'; snapCam(); revealAround(true); updateMusic(true); UI.hideDeath();
    if (RT.lostItems) toast('持ち物は倒れた場所に落ちている。回収しよう', 'warn');
  });
}

// ---------- 敵 ----------
function spawnMob(k, x, y) {
  const d = MB[k], hp = d.boss ? Math.round(d.hp * [.75, 1, 1.3][G.diff]) : d.hp;
  const e = { k, def: d, x, y, hp, mhp: hp, dir: 1, st: 'idle', t: rand(.5, 2), atkCD: 0, hurt: 0, aggro: 0, anim: rand(0, 9), dead: false, hx: x, hy: y, kbx: 0, kby: 0 };
  G.map.ents.push(e); return e;
}
function nearLight(tx, ty, r) { for (const o of getLit(G.map)) { if ((o.k === 'campfire' && o.fuel > 0) || o.k === 'torch_post' || (o.k === 'signal' && o.fuel > 0)) if (Math.hypot(o.x - tx, o.y - ty) < r) return true; } return false; }
function spawnTick() {
  const m = G.map, p = G.p, D = DIFF[G.diff], night = isNight();
  const caps = G.mapId === 'cave' ? { bat: 7, spider: 5 } : { crab: 6, boar: 4, snake: 3, monkey: 3, gull: 4, wolf: night ? ((G.rescue && G.rescue.st === 'wait') ? 9 : 4) : 0 };
  const cn = {}; for (const e of m.ents) if (!e.dead) cn[e.k] = (cn[e.k] || 0) + 1;
  const keys = Object.keys(caps).filter(k => (cn[k] || 0) < Math.round(caps[k] * D.mobs)); if (!keys.length) return;
  const k = pick(keys);
  for (let tries = 0; tries < 8; tries++) {
    const a = Math.random() * Math.PI * 2, d = rand(13, 21) * TS, x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    if (!inB(m, tx, ty)) continue; const t = tAt(m, tx, ty), o = oAt(m, tx, ty); if (o && OB[o.k].solid) continue;
    let ok = false;
    switch (k) {
      case 'crab': case 'gull': ok = t === T.SAND; break;
      case 'boar': ok = t === T.GRASS || t === T.FOREST; break;
      case 'snake': ok = t === T.SWAMP || t === T.JUNGLE || (t === T.FOREST && chance(.3)); break;
      case 'monkey': ok = t === T.JUNGLE; break;
      case 'wolf': ok = t === T.GRASS || t === T.FOREST || t === T.JUNGLE || t === T.SAND; break;
      case 'bat': case 'spider': ok = t === T.CFLOOR; break;
    }
    if (!ok) continue;
    if (k === 'wolf' && nearLight(tx, ty, 8)) continue;
    if (G.mapId === 'cave') { const ci = G.caveInfo; if (Math.hypot(tx - ci.entrance.x, ty - ci.entrance.y) < 9 || Math.hypot(tx - ci.boss.x, ty - ci.boss.y) < 9) continue; }
    else { const c = G.pois.cove; if (!G.boss.kingcrab && Math.hypot(tx - c.x, ty - c.y) < 9) continue; }
    spawnMob(k, tx * TS + 8, ty * TS + 12); return;
  }
}
function bossTick() {
  const m = G.map, p = G.p, px = p.x / TS, py = p.y / TS;
  if (G.mapId === 'island' && !G.boss.kingcrab) { const c = G.pois.cove; if (Math.hypot(px - c.bx, py - c.by) < 16 && !m.ents.some(e => e.k === 'kingcrab' && !e.dead)) spawnMob('kingcrab', c.bx * TS + 8, c.by * TS + 12); }
  if (G.mapId === 'cave' && !G.boss.golem) { const b = G.caveInfo.boss; if (Math.hypot(px - b.x, py - b.y) < 18 && !m.ents.some(e => e.k === 'golem' && !e.dead)) spawnMob('golem', b.x * TS + 8, b.y * TS + 12); }
}
function bossStart(e) { RT.boss = e; UI.bossBar(e); updateMusic(true); notice(e.def.n + 'が現れた！'); sfx('roar'); shake(6); }
function bossReset(e) { e.hp = e.mhp; e.x = e.hx; e.y = e.hy; e.st = 'idle'; e.hidden = false; if (RT.boss === e) { RT.boss = null; UI.bossBar(null); updateMusic(true); } }
function updMobs(dt) {
  const m = G.map;
  for (let i = m.ents.length - 1; i >= 0; i--) { const e = m.ents[i]; if (e.dead) { m.ents.splice(i, 1); continue; } updMob(m, e, dt); }
  const es = m.ents;
  for (let a = 0; a < es.length; a++) for (let b = a + 1; b < es.length; b++) {
    const A = es[a], B = es[b]; if (A.def.boss || B.def.boss || A.dead || B.dead) continue;
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), md = A.def.r + B.def.r - 2;
    if (d > .01 && d < md) { const pu = (md - d) * .5 / d; moveEnt(m, A, -dx * pu, -dy * pu); moveEnt(m, B, dx * pu, dy * pu); }
  }
}
function updMob(m, e, dt) {
  const d = e.def, p = G.p;
  e.anim += dt; e.hurt = Math.max(0, e.hurt - dt); e.atkCD = Math.max(0, e.atkCD - dt); if (e.aggro > 0) e.aggro -= dt;
  if (Math.abs(e.kbx) + Math.abs(e.kby) > 2) { moveEnt(m, e, e.kbx * dt, e.kby * dt); const k = Math.pow(.001, dt); e.kbx *= k; e.kby *= k; } else e.kbx = e.kby = 0;
  const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
  if (!d.boss && dist > 36 * TS) { e.dead = true; return; }
  if (d.night && !isNight()) e.flee = 1;
  if (p.dead || G.mode !== 'play') { if (!d.boss) wander(m, e, dt); return; }
  if (e.flee) { moveEnt(m, e, -dx / dist * d.spd * 1.2 * dt, -dy / dist * d.spd * 1.2 * dt); e.dir = dx > 0 ? -1 : 1; if (dist > 14 * TS) e.dead = true; return; }
  switch (d.ai) {
    case 'neutral': if (e.aggro > 0) chaseAttack(m, e, dt, dist, dx, dy); else wander(m, e, dt); break;
    case 'charger': aiCharger(m, e, dt, dist, dx, dy); break;
    case 'aggro': if (dist < d.aggro || (e.aggro > 0) || (e.st === 'chase' && dist < d.aggro * 1.8) || e.st === 'wind') chaseAttack(m, e, dt, dist, dx, dy); else { if (e.st === 'chase') e.st = 'idle'; wander(m, e, dt); } break;
    case 'ranged': aiRanged(m, e, dt, dist, dx, dy); break;
    case 'flee': aiGull(m, e, dt, dist, dx, dy); break;
    case 'flyer': aiBat(m, e, dt, dist, dx, dy); break;
    case 'golem': aiGolem(m, e, dt, dist, dx, dy); break;
    case 'kingcrab': aiKingCrab(m, e, dt, dist, dx, dy); break;
  }
}
function wander(m, e, dt) {
  e.t -= dt;
  if (e.t <= 0) {
    if (e.st === 'walk') { e.st = 'idle'; e.t = rand(1, 3); }
    else { e.st = 'walk'; e.t = rand(.6, 2); const a = Math.random() * Math.PI * 2; e.wx = Math.cos(a); e.wy = Math.sin(a); if (e.k === 'crab') e.wy *= .3; }
  }
  if (e.st === 'walk') { const sp = e.def.spd * .45; if (moveEnt(m, e, e.wx * sp * dt, e.wy * sp * dt)) e.t = 0; if (Math.abs(e.wx) > .1) e.dir = e.wx > 0 ? 1 : -1; }
  else if (e.st !== 'idle') e.st = 'idle';
}
function chaseAttack(m, e, dt, dist, dx, dy) {
  const d = e.def;
  if (e.st === 'wind') {
    e.t -= dt;
    if (e.t <= 0) { e.st = 'chase'; if (dist < d.r + 13) hurtPlayer(d.dmg, e.x, e.y, d.poison ? { poison: d.poison } : null); e.atkCD = 1.1; moveEnt(m, e, dx / dist * 5, dy / dist * 5); }
    return;
  }
  e.st = 'chase'; e.dir = dx > 0 ? 1 : -1;
  if (dist < d.r + 9) { if (e.atkCD <= 0) { e.st = 'wind'; e.t = .32; } }
  else moveEnt(m, e, dx / dist * d.spd * dt, dy / dist * d.spd * dt);
}
function aiCharger(m, e, dt, dist, dx, dy) {
  const d = e.def;
  if (e.aggro <= 0 && e.st !== 'dash') { wander(m, e, dt); return; }
  if (e.hp < e.mhp * .25 && e.st !== 'dash') { e.flee = 1; return; }
  e.t -= dt;
  switch (e.st) {
    case 'wind': if (e.t <= 0) { e.st = 'dash'; e.t = .75; } break;
    case 'dash': { const hw = moveEnt(m, e, e.cx * d.spd * 3.3 * dt, e.cy * d.spd * 3.3 * dt); if (dist < d.r + 9) { hurtPlayer(d.dmg, e.x, e.y); e.t = 0; } if (e.t <= 0 || hw) { e.st = 'rest'; e.t = 1.1; } break; }
    case 'rest': if (e.t <= 0) e.st = 'chase'; break;
    default:
      e.st = 'chase'; e.dir = dx > 0 ? 1 : -1;
      if (dist < 80) { e.st = 'wind'; e.t = .55; e.cx = dx / dist; e.cy = dy / dist; sfx('grunt'); }
      else moveEnt(m, e, dx / dist * d.spd * dt, dy / dist * d.spd * dt);
  }
}
function aiRanged(m, e, dt, dist, dx, dy) {
  const d = e.def; if (dist > 110 && e.aggro <= 0) { wander(m, e, dt); return; }
  e.dir = dx > 0 ? 1 : -1;
  if (dist < 55) moveEnt(m, e, -dx / dist * d.spd * dt, -dy / dist * d.spd * dt); else if (dist > 95) moveEnt(m, e, dx / dist * d.spd * .7 * dt, dy / dist * d.spd * .7 * dt);
  e.st = 'chase'; e.thr = (e.thr == null ? 1 : e.thr) - dt;
  if (e.thr <= 0) { e.thr = rand(1.8, 2.6); RT.projs.push({ x: e.x, y: e.y - 8, vx: dx / dist * 120, vy: dy / dist * 120, dmg: d.dmg, life: 1.4, r: 3, from: 'e', type: 'nut' }); sfx('throw'); }
}
function aiGull(m, e, dt, dist, dx, dy) {
  if (e.fl) { e.flT = (e.flT || 0) + dt; e.x -= dx / dist * 80 * dt; e.y -= dy / dist * 80 * dt + 10 * dt; if (e.flT > 4) e.dead = true; return; }
  if (dist < 42 || e.aggro > 0) { e.fl = 1; sfx('gull'); return; }
  wander(m, e, dt);
}
function aiBat(m, e, dt, dist, dx, dy) {
  const d = e.def; e.ph = (e.ph || 0) + dt * 6;
  if (dist < d.aggro || e.aggro > 0) {
    e.bt = (e.bt || 0) - dt; let vx, vy;
    if (e.bt > 0) { vx = -dx / dist; vy = -dy / dist; } else { vx = dx / dist + Math.cos(e.ph) * .6; vy = dy / dist + Math.sin(e.ph * 1.3) * .6; }
    moveEnt(m, e, vx * d.spd * dt, vy * d.spd * dt); e.dir = dx > 0 ? 1 : -1;
    if (dist < d.r + 9 && e.atkCD <= 0) { hurtPlayer(d.dmg, e.x, e.y); e.atkCD = 1.2; e.bt = .6; }
  } else moveEnt(m, e, Math.cos(e.ph * .3) * 20 * dt, Math.sin(e.ph * .23) * 20 * dt);
}
function aiGolem(m, e, dt, dist, dx, dy) {
  const d = e.def, p = G.p;
  if (e.st === 'idle') { if (dist < TS * 7) { e.st = 'move'; e.t = 1; bossStart(e); } return; }
  if (Math.hypot(p.x - e.hx, p.y - e.hy) > TS * 17) { bossReset(e); return; }
  const ph2 = e.hp < e.mhp * .5, sk = ph2 ? 1.35 : 1; if (e.st !== 'charge') e.dir = dx > 0 ? 1 : -1; e.t -= dt;
  switch (e.st) {
    case 'move':
      if (dist > 30) moveEnt(m, e, dx / dist * d.spd * sk * dt, dy / dist * d.spd * sk * dt);
      if (e.t <= 0) { if (dist < 52) { e.st = 'slamW'; e.t = ph2 ? .7 : .9; } else if (Math.random() < .5) { e.st = 'throwW'; e.t = .6; } else { e.st = 'chargeW'; e.t = .75; e.cx = dx / dist; e.cy = dy / dist; } sfx('golem'); }
      break;
    case 'slamW': if (e.t <= 0) { if (dist < 50) hurtPlayer(18, e.x, e.y); shake(7); sfx('boom'); ringParts(e.x, e.y, 46, '#a59bb5'); e.st = 'move'; e.t = ph2 ? .9 : 1.4; } break;
    case 'throwW': if (e.t <= 0) { const n = ph2 ? 5 : 3, base = Math.atan2(dy, dx); for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * .28; RT.projs.push({ x: e.x, y: e.y - 18, vx: Math.cos(a) * 115 * sk, vy: Math.sin(a) * 115 * sk, dmg: 10, life: 2.2, r: 5, from: 'e', type: 'rock' }); } sfx('throw'); e.st = 'move'; e.t = 1.2; } break;
    case 'chargeW': if (e.t <= 0) { e.st = 'charge'; e.t = .7; } break;
    case 'charge': { const hit = moveEnt(m, e, e.cx * 175 * sk * dt, e.cy * 175 * sk * dt); if (dist < d.r + 10) hurtPlayer(15, e.x, e.y); if (hit || e.t <= 0) { if (hit) { shake(5); sfx('boom'); } e.st = 'move'; e.t = 1.3; } break; }
    default: e.st = 'move';
  }
}
function aiKingCrab(m, e, dt, dist, dx, dy) {
  const d = e.def, p = G.p;
  if (e.st === 'idle') { e.hidden = false; if (dist < TS * 6) { e.st = 'move'; e.t = 1; bossStart(e); } return; }
  if (Math.hypot(p.x - e.hx, p.y - e.hy) > TS * 18) { bossReset(e); return; }
  const ph2 = e.hp < e.mhp * .5; e.t -= dt; if (!e.hidden) e.dir = dx > 0 ? 1 : -1;
  switch (e.st) {
    case 'move':
      if (dist > 26) moveEnt(m, e, dx / dist * d.spd * dt, dy / dist * d.spd * .6 * dt);
      if (e.t <= 0) { if (dist < 44) { e.st = 'snapW'; e.t = .5; } else if (Math.random() < .55) { e.st = 'bubW'; e.t = .6; } else { e.st = 'burrow'; e.t = 1.2; e.hidden = true; sfx('dig'); } }
      break;
    case 'snapW': if (e.t <= 0) { e.st = 'snap'; e.t = .3; e.cx = dx / dist; e.cy = dy / dist; sfx('snap'); } break;
    case 'snap': moveEnt(m, e, e.cx * 210 * dt, e.cy * 210 * dt); if (dist < d.r + 10) hurtPlayer(14, e.x, e.y); if (e.t <= 0) { e.st = 'move'; e.t = ph2 ? .8 : 1.3; } break;
    case 'bubW':
      if (e.t <= 0) {
        const n = ph2 ? 14 : 10; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + e.anim; RT.projs.push({ x: e.x, y: e.y - 10, vx: Math.cos(a) * 72, vy: Math.sin(a) * 72, dmg: 6, life: 2.6, r: 4, from: 'e', type: 'bubble' }); }
        if (ph2) { const a0 = Math.atan2(dy, dx); for (let k = -1; k <= 1; k++) RT.projs.push({ x: e.x, y: e.y - 10, vx: Math.cos(a0 + k * .2) * 110, vy: Math.sin(a0 + k * .2) * 110, dmg: 6, life: 2, r: 4, from: 'e', type: 'bubble' }); }
        sfx('bubble'); e.st = 'move'; e.t = 1.3;
      }
      break;
    case 'burrow': moveEnt(m, e, dx / dist * 95 * dt, dy / dist * 95 * dt); if (Math.random() < .4) dustParts(e.x, e.y, 1); if (e.t <= 0) { e.st = 'emergeW'; e.t = .7; } break;
    case 'emergeW': if (e.t <= 0) { e.hidden = false; if (dist < 36) hurtPlayer(16, e.x, e.y); shake(5); sfx('boom'); ringParts(e.x, e.y, 34, '#e6d39a'); e.st = 'move'; e.t = 1.2; } break;
    default: e.st = 'move';
  }
}
function updProjs(dt) {
  const m = G.map, p = G.p;
  for (let i = RT.projs.length - 1; i >= 0; i--) {
    const q = RT.projs[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot = (q.rot || 0) + dt * 10;
    let dead = q.life <= 0;
    if (!dead) {
      const tx = Math.floor(q.x / TS), ty = Math.floor((q.y + 6) / TS), t = tAt(m, tx, ty);
      if (t === T.CWALL || t === T.RWALL || t === T.LOGWALL) dead = true;
      else { const o = oAt(m, tx, ty); if (o && OB[o.k].solid && !OB[o.k].mobOnly) { const b = OB[o.k].box || [0, 0, 16, 16], lx = q.x - tx * TS, ly = q.y + 6 - ty * TS; if (lx >= b[0] && lx <= b[2] && ly >= b[1] && ly <= b[3]) dead = true; } }
    }
    if (!dead && q.from === 'e' && !p.dead && Math.hypot(q.x - p.x, q.y - (p.y - 6)) < q.r + 5) { hurtPlayer(q.dmg, q.x - q.vx * .1, q.y - q.vy * .1); dead = true; }
    if (!dead && q.from === 'p') for (const e of m.ents) { if (e.dead || e.hidden) continue; if (Math.hypot(q.x - e.x, q.y - (e.y - e.def.r * .6)) < q.r + e.def.r) { hurtMob(e, q.dmg, q.x - q.vx * .05, q.y - q.vy * .05); dead = true; break; } }
    if (dead) {
      if (q.type === 'arrow' && chance(.5) && walkT(tAt(m, Math.floor(q.x / TS), Math.floor((q.y + 6) / TS)))) dropAt(m, q.x, q.y + 6, 'arrow', 1);
      RT.projs.splice(i, 1); puffParts(q.x, q.y, q.type);
    }
  }
}
function updDrops(dt) {
  const m = G.map, p = G.p;
  for (let i = m.drops.length - 1; i >= 0; i--) {
    const d = m.drops[i]; d.age += dt; if (d.np > 0) d.np -= dt;
    if (d.vz || d.z > 0) { d.z += d.vz * dt; d.vz -= 260 * dt; if (d.z <= 0) { d.z = 0; d.vz = Math.abs(d.vz) > 30 ? -d.vz * .35 : 0; } }
    if (d.vx || d.vy) {
      const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt; if (walkT(tAt(m, Math.floor(nx / TS), Math.floor(ny / TS)))) { d.x = nx; d.y = ny; }
      const f = Math.pow(.02, dt); d.vx *= f; d.vy *= f; if (Math.abs(d.vx) < 1) d.vx = 0; if (Math.abs(d.vy) < 1) d.vy = 0;
    }
    if (d.age > 900) { m.drops.splice(i, 1); continue; }
    if (d.np <= 0 && !p.dead) {
      const dd = Math.hypot(d.x - p.x, d.y - (p.y - 4));
      if (dd < 30 && canFit(d.id)) {
        if (dd < 9) { const left = invAdd(d.id, d.n, d.dur); if (left < d.n) { pickupToast(d.id, d.n - left); sfx('pick'); } if (left > 0) { d.n = left; d.np = 2; } else m.drops.splice(i, 1); }
        else { const k = Math.min(1, 150 * dt / dd); d.x += (p.x - d.x) * k; d.y += (p.y - 4 - d.y) * k; }
      }
    }
  }
}
function getLit(m) {
  if (m.litDirty || !m.lit) { m.lit = []; for (const o of m.o) if (o && LIGHT_K[o.k]) m.lit.push(o); m.litDirty = false; }
  return m.lit;
}
function updFires(dt) {
  for (const id in G.maps) {
    const m = G.maps[id];
    for (const o of getLit(m)) if ((o.k === 'campfire' || o.k === 'signal') && o.fuel > 0) {
      o.fuel -= dt * (id === 'island' && G.rain > .3 ? 1.5 : 1);
      if (o.fuel <= 0) { o.fuel = 0; if (id === G.mapId && Math.hypot(o.x * TS - G.p.x, o.y * TS - G.p.y) < 12 * TS) toast((o.k === 'signal' ? 'のろし' : 'たき火') + 'の火が消えた', 'warn', 'out' + o.x); }
    }
  }
}

// ---------- マップ移動 ----------
function switchMap(id) {
  const old = G.map; old.ents = []; RT.projs = []; RT.boss = null; UI.bossBar(null);
  G.mapId = id; G.map = G.maps[id]; G.map.ents = []; RT.lastTile = -1; RT.find = {};
}
function travel(id, tx, ty) {
  UI.fade(() => {
    switchMap(id); const p = G.p; p.x = tx * TS + 8; p.y = ty * TS + 12; p.fishing = null; p.swing = 0;
    snapCam(); revealAround(true); updateMusic(true);
    if (id === 'cave') notice('地下洞窟'); else notice('島に戻った');
  });
}

// ---------- 航海ミニゲーム ----------
function startVoyage(o) {
  G.mode = 'voyage'; RT.voy = { d: 0, hp: 100, x: 0, vx: 0, t: 0, obs: [], spawnT: 1.5, rx: o.x, ry: o.y, inv: 0, done: false, res: null, endT: 0 };
  UI.voyage(true); updateMusic(true); notice('出航！陸地を目指せ');
}
function updVoyage(dt) {
  const V = RT.voy; V.t += dt; V.inv = Math.max(0, V.inv - dt);
  const storm = V.d > .4 && V.d < .72;
  const scroll = storm ? 95 : 72, half = Math.min(90, RT.vw / 2 - 16);
  if (V.done) { V.endT -= dt; if (V.endT <= 0) endVoyage(); return; }
  V.vx += Inp.mx * 700 * dt; V.vx *= Math.pow(.03, dt); V.x = clamp(V.x + V.vx * dt, -half, half);
  if (Math.abs(V.x) >= half) V.vx = 0;
  V.d = Math.min(1, V.d + dt / 85);
  V.spawnT -= dt;
  if (V.spawnT <= 0 && V.d < .95) {
    V.spawnT = storm ? rand(.45, .75) : rand(.8, 1.3);
    const r = Math.random(), x = rand(-half, half);
    if (r < .38) V.obs.push({ k: 'rock', x, y: -20, r: 9, dmg: 22 });
    else if (r < .63) V.obs.push({ k: 'wave', x, y: -20, r: 11, dmg: 14, vx: (Math.random() < .5 ? -1 : 1) * rand(25, 45) });
    else if (r < .85) V.obs.push({ k: 'shark', x, y: -20, r: 8, dmg: 18, ph: Math.random() * 6 });
    else V.obs.push({ k: 'crate', x, y: -20, r: 8 });
  }
  const ry = RT.vh * .74;
  for (let i = V.obs.length - 1; i >= 0; i--) {
    const o = V.obs[i]; o.y += scroll * dt;
    if (o.k === 'wave') { o.x += o.vx * dt; if (Math.abs(o.x) > half) o.vx *= -1; }
    if (o.k === 'shark') { o.ph += dt * 3; o.x += Math.cos(o.ph) * 60 * dt; o.y += 20 * dt; }
    if (o.y > RT.vh + 30) { V.obs.splice(i, 1); continue; }
    if (Math.hypot(o.x - V.x, o.y - ry) < o.r + 9) {
      if (o.k === 'crate') { V.hp = Math.min(100, V.hp + 15); sfx('pick'); V.obs.splice(i, 1); continue; }
      if (V.inv <= 0) { V.hp -= o.dmg; V.inv = 1; sfx('crash'); shake(6); Inp.rumble(.8, .6, 200); if (o.k !== 'rock') V.obs.splice(i, 1); }
    }
  }
  if (storm && Math.random() < dt * .25) { RT.lightning = .25; sfx('thunder'); }
  if (V.hp <= 0) { V.done = true; V.res = 'fail'; V.endT = 2.5; sfx('die'); }
  else if (V.d >= 1) { V.done = true; V.res = 'win'; V.endT = 2.5; sfx('catch'); }
}
function endVoyage() {
  const V = RT.voy; UI.voyage(false);
  if (V.res === 'win') { RT.voy = null; triggerEnding('A'); return; }
  RT.voy = null; G.mode = 'play';
  const m = G.maps.island; if (G.mapId !== 'island') switchMap('island');
  const pt = freeNear(m, V.rx, V.ry, (x, y) => landT(tAt(m, x, y)) && !(oAt(m, x, y) && OB[oAt(m, x, y).k].solid), 6) || { x: V.rx, y: V.ry };
  const p = G.p; p.x = pt.x * TS + 8; p.y = pt.y * TS + 12; p.hp = Math.max(20, p.hp - 30); p.water = Math.max(10, p.water - 30); p.food = Math.max(10, p.food - 20);
  snapCam(); updateMusic(true);
  UI.say(['いかだは荒波に砕かれてしまった…。', 'なんとか島へ泳ぎ戻った。いかだの骨組みは無事だ。', '食料と水をもう一度用意して、再挑戦しよう。']);
}
function triggerEnding(key) {
  G.endings[key] = 1; unlock('end' + key);
  const trueEnd = key === 'C' && pageCount() >= 10; if (trueEnd) unlock('endT');
  saveGame(G.slot, true);
  G.mode = 'ending'; UI.showEnding(key, trueEnd); playBgm('ending');
}

// ---------- メインアップデート ----------
function update(dt) {
  RT.clock += dt;
  RT.shake = Math.max(0, RT.shake - dt * 18); RT.flash = Math.max(0, RT.flash - dt); RT.lightning = Math.max(0, RT.lightning - dt);
  if (G.mode === 'voyage') { updVoyage(dt); updParts(dt); return; }
  if (G.mode === 'dead') { RT.deadT += dt; if (RT.deadT > 1.3 && !RT.deadShown) { RT.deadShown = 1; UI.showDeath(); } updMobs(dt); updProjs(dt); updParts(dt); updCam(dt); return; }
  if (G.mode !== 'play') return;
  updTime(dt); updFires(dt);
  updPlayer(dt); if (G.mode !== 'play') return;
  updStats(dt); if (G.mode !== 'play') return;
  updMobs(dt); updProjs(dt); updDrops(dt); updParts(dt);
  if (G.ship) updShip(dt);
  revealAround();
  RT.tick += dt;
  if (RT.tick >= .5) { RT.tick = 0; poiTick(); questTick(); bossTick(); updateMusic(); }
  RT.spawnT -= dt; if (RT.spawnT <= 0) { RT.spawnT = 1.3; spawnTick(); }
  if (G.weather === 'storm' && G.mapId === 'island' && Math.random() < dt * .07) { RT.lightning = .3; setTimeout(() => sfx('thunder'), 250); }
  RT.act = actionInfo();
  updCam(dt);
}
function updCam(dt) {
  const p = G.p, m = G.map, mw = m.w * TS, mh = m.h * TS;
  RT.cam.x = p.x - Math.floor(RT.vw / 2); RT.cam.y = p.y - 8 - Math.floor(RT.vh / 2);
  RT.cam.x = mw > RT.vw ? clamp(RT.cam.x, 0, mw - RT.vw) : (mw - RT.vw) / 2; RT.cam.y = mh > RT.vh ? clamp(RT.cam.y, 0, mh - RT.vh) : (mh - RT.vh) / 2;
}
function snapCam() { RT.cam.x = G.p.x - RT.vw / 2; RT.cam.y = G.p.y - 8 - RT.vh / 2; updCam(0); }
function shake(n) { if (OPT.shake) RT.shake = Math.max(RT.shake, n); }

// ---------- セーブ／ロード ----------
function saveGame(slot, quiet) {
  if (!G) return false;
  try {
    const p = G.p, d = {
      v: 1, ver: VERSION, seed: G.seed, diff: G.diff, mapId: G.mapId, maps: { island: serMap(G.maps.island), cave: serMap(G.maps.cave) },
      time: G.time, day: G.day, lastHour: G.lastHour, weather: G.weather, wT: G.wT, rain: G.rain,
      p: { x: p.x, y: p.y, dir: p.dir, hp: p.hp, mhp: p.mhp, food: p.food, water: p.water, sta: p.sta, temp: p.temp, poison: p.poison, sick: p.sick, fed: p.fed },
      inv: G.inv, invSize: G.invSize, armor: G.armor, sel: G.sel, flags: G.flags, pages: G.pages, stats: G.stats, pois: G.pois, treasures: G.treasures, heli: G.heli,
      caveInfo: G.caveInfo, spawnPt: G.spawnPt, quest: G.quest, boss: G.boss, shipPlan: G.shipPlan, rescue: G.rescue, playTime: G.playTime, endings: G.endings, savedAt: Date.now()
    };
    if (p.dead) { d.p.hp = 60; }
    localStorage.setItem(SAVE_KEY + slot, JSON.stringify(d));
    if (!quiet) toast('スロット' + (slot + 1) + 'にセーブしました', 'good');
    return true;
  } catch (e) { toast('セーブに失敗しました（ブラウザの保存容量が不足しています）', 'bad'); return false; }
}
function loadGame(slot) {
  let d; try { d = JSON.parse(localStorage.getItem(SAVE_KEY + slot)); } catch (e) { return false; }
  if (!d || !d.maps) return false;
  try {
    const maps = { island: deserMap(d.maps.island), cave: deserMap(d.maps.cave) };
    G = Object.assign({}, d, { slot, maps, map: null, p: Object.assign(newPlayer({ x: 0, y: 0 }), d.p), ship: null });
    G.inv = (d.inv || []).concat(new Array(32).fill(null)).slice(0, 32);
    G.map = G.maps[G.mapId] || G.maps.island;
    initRuntime(); return true;
  } catch (e) { console.error(e); return false; }
}
function slotInfo(slot) {
  try { const s = localStorage.getItem(SAVE_KEY + slot); if (!s) return null; const d = JSON.parse(s); return { day: d.day, diff: d.diff, play: d.playTime || 0, at: d.savedAt, pages: (d.pages || []).filter(Boolean).length, endings: d.endings || {} }; }
  catch (e) { return null; }
}

// =====================================================================
//  RENDER
// =====================================================================
let CV, CTX, LC, LX, CUR_M = null;
const SHD = {}, SPRW = {};
const DEMO = { m: null, x: 0, y: 0, h: 15, tg: 0, pts: [] };
function setupCanvas() {
  CV = $('#game'); CTX = cx2(CV); LC = mkC(10, 10); LX = cx2(LC);
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 120)); resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight, short = Math.min(w, h);
  let s = Math.max(2, Math.round(short / 210)); if (w > h && h < 520) s = Math.max(2, Math.round(h / 185));
  RT.scale = s; RT.vw = Math.ceil(w / s); RT.vh = Math.ceil(h / s);
  CV.width = RT.vw; CV.height = RT.vh; CV.style.width = RT.vw * s + 'px'; CV.style.height = RT.vh * s + 'px';
  LC.width = RT.vw; LC.height = RT.vh; CTX.imageSmoothingEnabled = false; LX.imageSmoothingEnabled = false;
  if (G && G.map) updCam(0);
  r3Resize();
}
function shadow(w) { w = Math.max(4, w | 0); if (!SHD[w]) { const c = mkC(w, 4), x = cx2(c); E(x, w >> 1, 2, (w >> 1) - 1, 1, 'rgba(0,0,0,.24)'); SHD[w] = c; } return SHD[w]; }
const wht = k => SPRW[k] || (SPRW[k] = whiteC(SPR[k]));
function dB(ctx, img, sx, sy, ox, oy) { ctx.drawImage(img, Math.round(sx + 8 - img.width / 2 + (ox || 0)), Math.round(sy + 16 - img.height + (oy || 0))); }

function render() {
  const ctx = CTX; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const use3d = r3On(), try3 = (fn, after) => { let ok = false; try { ok = fn(); } catch (e) { console.error(e); r3Fail('3D表示でエラーが起きたため、2D表示に戻しました'); } if (ok) { after(); return true; } return false; };
  if (RT.screen === 'game' && G && G.map) {
    if (G.mode === 'voyage' && RT.voy) { if (use3d && try3(r3RenderVoyage, () => ctx.clearRect(0, 0, RT.vw, RT.vh))) return; r3Hide(); renderVoyage(ctx); return; }
    if (use3d && try3(r3Render, () => r3Overlay(ctx))) return;
    r3Hide(); renderGame(ctx); return;
  }
  if (use3d && DEMO.m && try3(r3RenderDemo, () => ctx.clearRect(0, 0, RT.vw, RT.vh))) return;
  r3Hide();
  if (DEMO.m) renderDemo(ctx); else { ctx.fillStyle = '#0d2238'; ctx.fillRect(0, 0, RT.vw, RT.vh); }
}
function renderGame(ctx) {
  const m = G.map, h = hour(); CUR_M = m;
  let cx = Math.round(RT.cam.x), cy = Math.round(RT.cam.y);
  if (RT.shake > 0) { cx += Math.round(rand(-RT.shake, RT.shake) * .5); cy += Math.round(rand(-RT.shake, RT.shake) * .5); }
  drawTiles(ctx, m, cx, cy);
  drawGround(ctx, m, cx, cy);
  drawSorted(ctx, m, cx, cy, true);
  drawProjs(ctx, cx, cy);
  drawParts(ctx, cx, cy);
  if (G.mapId === 'island') drawWeather(ctx, G.rain, G.weather === 'storm');
  drawLighting(ctx, m, cx, cy, h, G.mapId === 'island' ? G.rain : 0);
  drawOverlays(ctx, cx, cy);
  if (RT.flash > 0) { ctx.fillStyle = 'rgba(255,40,60,' + Math.min(.5, RT.flash * 1.2) + ')'; ctx.fillRect(0, 0, RT.vw, RT.vh); }
  if (RT.lightning > 0) { ctx.fillStyle = 'rgba(235,242,255,' + Math.min(.8, RT.lightning * 2.4) + ')'; ctx.fillRect(0, 0, RT.vw, RT.vh); }
  const p = G.p;
  if (!p.dead && p.hp < 25) { const a = (.18 + Math.sin(RT.clock * 5) * .08); ctx.fillStyle = 'rgba(200,0,30,' + a + ')'; ctx.fillRect(0, 0, RT.vw, 3); ctx.fillRect(0, RT.vh - 3, RT.vw, 3); ctx.fillRect(0, 0, 3, RT.vh); ctx.fillRect(RT.vw - 3, 0, 3, RT.vh); }
}

// ---------- tiles ----------
function drawTiles(ctx, m, cx, cy) {
  const fr = Math.floor(RT.clock * 2.2) % 4;
  const x0 = Math.floor(cx / TS), y0 = Math.floor(cy / TS), x1 = Math.floor((cx + RT.vw) / TS), y1 = Math.floor((cy + RT.vh) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tAt(m, tx, ty), v = ((tx * 7919) ^ (ty * 104729) ^ (tx * ty * 31)) & 3, set = TILESET[t][v], sx = tx * TS - cx, sy = ty * TS - cy;
    ctx.drawImage(set[set.length > 1 ? (fr + v) % 4 : 0], sx, sy);
    const pr = TINFO[t].prio;
    if (pr >= 0) for (let d = 0; d < 4; d++) { const nt = tAt(m, tx + DIRV[d].x, ty + DIRV[d].y); if (TINFO[nt].prio > pr) ctx.drawImage(EDGE[nt][d], sx, sy); }
    if (t === T.SHALLOW) {
      for (let d = 0; d < 4; d++) {
        const nt = tAt(m, tx + DIRV[d].x, ty + DIRV[d].y); if (TINFO[nt].prio < 2) continue;
        const ph = (RT.clock * 1.6 + tx * .7 + ty * .37) % 2, off = 2 + Math.floor(ph < 1 ? ph * 3 : (2 - ph) * 3);
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        if (d === 0) ctx.fillRect(sx + (tx % 3), sy + off, 13, 1); else if (d === 2) ctx.fillRect(sx + (ty % 3), sy + 15 - off, 13, 1);
        else if (d === 3) ctx.fillRect(sx + off, sy + (ty % 3), 1, 13); else ctx.fillRect(sx + 15 - off, sy + (tx % 3), 1, 13);
      }
    } else if (t === T.FRESH) {
      ctx.fillStyle = '#9fd8f2';
      for (let d = 0; d < 4; d++) { const nt = tAt(m, tx + DIRV[d].x, ty + DIRV[d].y); if (nt === T.FRESH) continue; if (d === 0) ctx.fillRect(sx, sy, 16, 1); else if (d === 2) ctx.fillRect(sx, sy + 15, 16, 1); else if (d === 3) ctx.fillRect(sx, sy, 1, 16); else ctx.fillRect(sx + 15, sy, 1, 16); }
    } else if (t === T.CWALL) {
      if (tAt(m, tx, ty + 1) === T.CFLOOR) { ctx.fillStyle = '#382e44'; ctx.fillRect(sx, sy + 9, 16, 7); ctx.fillStyle = '#4c405c'; ctx.fillRect(sx, sy + 9, 16, 1); ctx.fillStyle = '#2a2234'; ctx.fillRect(sx + (v * 4 + 2) % 14, sy + 11, 1, 4); ctx.fillRect(sx + (v * 7 + 9) % 14, sy + 12, 1, 3); }
    } else if (t === T.CFLOOR) {
      if (tAt(m, tx, ty - 1) === T.CWALL) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(sx, sy, 16, 3); }
    } else if (t === T.RWALL) {
      if (tAt(m, tx, ty + 1) !== T.RWALL) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(sx, sy + 16, 16, 3); }
    } else if (t === T.LOGWALL) {
      if (tAt(m, tx, ty + 1) !== T.LOGWALL) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(sx, sy + 16, 16, 2); }
    }
  }
}
function drawGround(ctx, m, cx, cy) {
  if (G.mapId === 'island') for (const tr of G.treasures) if (tr.known && !tr.found) {
    const sx = tr.x * TS - cx, sy = tr.y * TS - cy; if (sx < -16 || sy < -16 || sx > RT.vw || sy > RT.vh) continue;
    ctx.globalAlpha = .75 + Math.sin(RT.clock * 4) * .2; ctx.drawImage(SPR.xmark, sx + 2, sy + 3); ctx.globalAlpha = 1;
  }
  for (const e of m.ents) {
    if (e.dead) continue; const sx = Math.round(e.x - cx), sy = Math.round(e.y - cy), pu = .2 + Math.abs(Math.sin(RT.clock * 10)) * .2;
    if (e.st === 'slamW') ring(ctx, sx, sy - 4, 50, pu);
    else if (e.st === 'emergeW') ring(ctx, sx, sy - 2, 36, pu);
    else if (e.st === 'chargeW' && e.cx != null) { ctx.fillStyle = 'rgba(255,40,60,' + pu + ')'; for (let k = 0; k < 120; k += 3) ctx.fillRect(Math.round(sx + e.cx * k) - 2, Math.round(sy - 6 + e.cy * k) - 2, 5, 5); }
    else if (e.st === 'snapW' || (e.st === 'wind' && e.def.ai === 'charger')) { drawNum(ctx, '!', sx, sy - e.def.r * 2 - 14, '#ff3355', '#160f1c'); }
  }
}
function ring(ctx, x, y, r, a) {
  ctx.fillStyle = 'rgba(255,40,60,' + a + ')'; ctx.beginPath(); ctx.ellipse(x, y, r, r * .62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,100,.85)'; ctx.lineWidth = 1; ctx.stroke();
}

// ---------- sorted objects / entities ----------
function drawSorted(ctx, m, cx, cy, play) {
  const L = [];
  const x0 = Math.floor(cx / TS) - 2, y0 = Math.floor(cy / TS) - 1, x1 = Math.floor((cx + RT.vw) / TS) + 2, y1 = Math.floor((cy + RT.vh) / TS) + 3;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const o = oAt(m, tx, ty); if (o) L.push({ y: FLAT_K[o.k] ? ty * TS + 1 : ty * TS + 15, o, tx, ty }); }
  if (play) {
    const inV = (x, y) => x > cx - 48 && x < cx + RT.vw + 48 && y > cy - 32 && y < cy + RT.vh + 64;
    for (const e of m.ents) if (!e.dead && inV(e.x, e.y)) L.push({ y: e.y, e });
    for (const d of m.drops) if (inV(d.x, d.y)) L.push({ y: d.y, d });
    L.push({ y: G.p.y, pl: 1 });
    if (G.ship && G.mapId === 'island') L.push({ y: -1e5, ship: 1 });
  }
  L.sort((a, b) => a.y - b.y);
  for (const it of L) {
    if (it.o) drawObj(ctx, it.o, it.tx * TS - cx, it.ty * TS - cy);
    else if (it.e) drawEnt(ctx, it.e, cx, cy);
    else if (it.d) drawDrop(ctx, it.d, cx, cy);
    else if (it.pl) drawPlayer(ctx, cx, cy);
    else if (it.ship) drawShip(ctx, cx, cy);
  }
}
function flame(ctx, x, y, s) {
  const t = RT.clock, n = Math.max(3, Math.round(4 * s));
  for (let i = 0; i < n; i++) {
    const ph = t * 9 + i * 1.7, fx = Math.round(x + Math.sin(ph) * s + (i - n / 2) * 1.3), h = Math.round((3 + (Math.sin(ph * 1.3) + 1) * 2.4) * s);
    R(ctx, fx, y - h, 2, h, '#ff7a1a'); R(ctx, fx, y - Math.round(h * .65), 1, Math.round(h * .65), '#ffa300');
  }
  R(ctx, Math.round(x) - 1, y - Math.round(3 * s), 2, Math.round(3 * s), '#ffe08a');
}
function drawObj(ctx, o, sx, sy) {
  let shk = 0; if (o.shk > 0) { o.shk -= 1 / 60; shk = Math.round(Math.sin(RT.clock * 70) * 1.2); }
  const t = RT.clock, bob = Math.round(Math.sin(t * 3 + sx * .1));
  switch (o.k) {
    case 'tree': ctx.drawImage(shadow(16), sx, sy + 13); dB(ctx, SPR['tree' + (o.v || 0)], sx, sy, shk, 1); break;
    case 'pine': ctx.drawImage(shadow(12), sx + 2, sy + 13); dB(ctx, SPR.pine, sx, sy, shk, 1); break;
    case 'palm': {
      ctx.drawImage(shadow(12), sx + 2 + (o.v ? 3 : -3), sy + 13); dB(ctx, SPR['palm' + (o.v || 0)], sx, sy, shk, 1);
      if (o.c > 0) { const bx = sx + 8 + (o.v ? 3 : -3) + shk; R(ctx, bx - 4, sy - 5, 3, 3, '#5a3a20'); P(ctx, bx - 4, sy - 5, '#8f5a32'); if (o.c > 1) { R(ctx, bx + 1, sy - 4, 3, 3, '#5a3a20'); P(ctx, bx + 1, sy - 4, '#8f5a32'); } }
      break;
    }
    case 'banana_tree': dB(ctx, SPR.banana_tree, sx, sy, shk, 1); if (o.r) { R(ctx, sx + 5 + shk, sy - 2, 5, 3, '#ffec27'); R(ctx, sx + 6 + shk, sy + 1, 3, 2, '#d4a83a'); } break;
    case 'bush': {
      ctx.drawImage(shadow(16), sx, sy + 13); dB(ctx, SPR.bush, sx, sy, shk, 1);
      if (o.r) for (const [bx, by] of [[3, 6], [8, 4], [12, 7], [6, 10], [11, 11]]) { R(ctx, sx - 1 + bx + shk, sy + 1 + by, 2, 2, '#d94a4a'); P(ctx, sx - 1 + bx + shk, sy + 1 + by, '#ff8fb4'); }
      break;
    }
    case 'grass': dB(ctx, SPR.grass, sx, sy, Math.round(Math.sin(t * 2 + sx * .3) * .6), 0); break;
    case 'fern': dB(ctx, SPR.fern, sx, sy, shk, 0); break;
    case 'rock': ctx.drawImage(shadow(14), sx + 1, sy + 13); dB(ctx, SPR['rock' + (o.v || 0)], sx, sy, shk, 1); break;
    case 'iron_rock': case 'coal_rock': ctx.drawImage(shadow(14), sx + 1, sy + 13); dB(ctx, SPR[o.k], sx, sy, shk, 1); break;
    case 'boulder': ctx.drawImage(shadow(20), sx - 2, sy + 13); dB(ctx, SPR.boulder, sx, sy, shk, 1); break;
    case 'crystal_rock': dB(ctx, SPR.crystal_rock, sx, sy, shk, 1); if (Math.floor(t * 3 + sx) % 7 === 0) P(ctx, sx + 6, sy + 2, '#ffffff'); break;
    case 'stump': dB(ctx, SPR.stump, sx, sy, shk, -1); break;
    case 'sapling': dB(ctx, SPR.sapling, sx, sy, 0, -1); break;
    case 'clay_o': dB(ctx, SPR.clay_o, sx, sy, shk, -2); break;
    case 'flower': dB(ctx, SPR['flower' + (o.v || 0)], sx, sy, 0, -2); break;
    case 'twig': dB(ctx, SPR.twig, sx, sy, 0, -4); break;
    case 'pebble': dB(ctx, SPR.pebble, sx, sy, 0, -4); break;
    case 'shell_o': dB(ctx, SPR.shell_o, sx, sy, 0, -4); break;
    case 'driftwood': dB(ctx, SPR.driftwood, sx, sy, 0, -3); break;
    case 'bottle': dB(ctx, SPR.bottle, sx, sy, 0, -4 + bob); if (Math.floor(t * 2) % 5 === 0) P(ctx, sx + 6, sy + 6, '#ffffff'); break;
    case 'mushroom_o': case 'red_mushroom_o': case 'herb_o': case 'potato_o': dB(ctx, SPR[o.k], sx, sy, shk, -2); break;
    case 'crate': ctx.drawImage(shadow(14), sx + 1, sy + 13); dB(ctx, SPR.crate, sx, sy, shk, 0); break;
    case 'note': dB(ctx, SPR.note, sx, sy, 0, -4 + bob); if (Math.floor(t * 4) % 3 === 0) P(ctx, sx + 12, sy + 2 + bob, '#ffffff'); break;
    case 'old_pack': dB(ctx, SPR.oldpack, sx, sy, 0, -1); if (Math.floor(t * 4) % 3 === 0) P(ctx, sx + 13, sy + 2, '#ffffff'); break;
    case 'bag': dB(ctx, SPR.bag, sx, sy, 0, -2 + bob); if (Math.floor(t * 4) % 2 === 0) P(ctx, sx + 13, sy + 1, '#ffec27'); break;
    case 'old_raft': dB(ctx, SPR.old_raft, sx, sy, 0, 0); break;
    case 'wreck': dB(ctx, SPR.wreck, sx, sy, 0, 2); break;
    case 'lifeboat': dB(ctx, SPR.lifeboat, sx, sy, 0, 0); break;
    case 'milcrate': dB(ctx, SPR.milcrate, sx, sy, shk, 0); if (o.done) R(ctx, sx + 1, sy + 4, 14, 2, '#2a2a2a'); break;
    case 'cave_in': dB(ctx, SPR.cave_in, sx, sy, 0, 2); break;
    case 'cave_out': ctx.globalAlpha = .75 + Math.sin(t * 2) * .2; dB(ctx, SPR.cave_out, sx, sy, 0, 0); ctx.globalAlpha = 1; break;
    case 'shrine': dB(ctx, o.has ? SPR.shrine : SPR.shrine_empty, sx, sy, 0, 0); if (o.has && Math.floor(t * 3) % 2) P(ctx, sx + 8, sy + 5, '#ffffff'); break;
    case 'altar': dB(ctx, SPR['altar' + Math.min(3, o.n || 0)], sx, sy, 0, 0); break;
    case 'rdoor': dB(ctx, SPR.rdoor, sx, sy, shk, 0); break;
    case 'pillar': dB(ctx, SPR.pillar, sx, sy, 0, 0); break;
    case 'statue': dB(ctx, SPR.statue, sx, sy, 0, 0); break;
    case 'pedestal': dB(ctx, SPR.pedestal, sx, sy, 0, 0); if (o.has) { ctx.drawImage(ICON.antenna, sx + 1, sy - 9 + bob); if (Math.floor(t * 3) % 2) P(ctx, sx + 10, sy - 6, '#ffffff'); } break;
    case 'radio': dB(ctx, SPR.radio, sx, sy, 0, 0); if (o.fixed) P(ctx, sx + 11, sy + 8, Math.floor(t * 3) % 2 ? '#3fd64e' : '#1e6b3c'); break;
    case 'heli': {
      ctx.drawImage(shadow(40), sx - 12, sy + 13); dB(ctx, SPR.heli, sx, sy, 0, 0);
      const w = 14 + Math.round(Math.abs(Math.sin(t * 22)) * 34); R(ctx, sx + 8 - (w >> 1), sy - 7, w, 1, '#2a2a33'); R(ctx, sx + 8 - (w >> 2), sy - 7, w >> 1, 1, '#555c66'); break;
    }
    case 'crop': drawCrop(ctx, o, sx, sy); break;
    case 'campfire': {
      dB(ctx, SPR.campfire, sx, sy, 0, -1);
      if (o.fuel > 0) flame(ctx, sx + 8, sy + 10, 1 + Math.min(.6, o.fuel / 600)); else if (Math.floor(t * 2) % 2) P(ctx, sx + 8, sy + 6, '#8a8a8a');
      break;
    }
    case 'signal': dB(ctx, SPR.signal, sx, sy, 0, 0); if (o.fuel > 0) flame(ctx, sx + 8, sy + 10, 2.4); break;
    case 'workbench': dB(ctx, SPR.workbench, sx, sy, 0, 0); break;
    case 'bed': dB(ctx, SPR.leafbed, sx, sy, 0, -1); break;
    case 'old_bed': dB(ctx, SPR.oldbed, sx, sy, 0, 0); break;
    case 'chest': dB(ctx, SPR.chest, sx, sy, 0, 0); break;
    case 'rchest': dB(ctx, SPR.rchest, sx, sy, 0, 0); break;
    case 'furnace': dB(ctx, SPR.furnace, sx, sy, 0, 0); if (Math.floor(t * 6) % 2) R(ctx, sx + 6, sy + 10, 4, 1, '#ffe08a'); break;
    case 'torch_post': dB(ctx, SPR.torchpost, sx, sy, 0, 0); flame(ctx, sx + 8, sy + 5, .8); break;
    case 'collector': dB(ctx, o.w > 0 ? SPR.collector1 : SPR.collector0, sx, sy, 0, 0); break;
    case 'fence': case 'gate': drawFence(ctx, o, sx, sy); break;
    case 'sos': dB(ctx, SPR.sos, sx, sy, 0, -1); break;
    case 'raft': dB(ctx, o.sail ? SPR.raft_full : SPR.raft, sx, sy, 0, 3 + bob); break;
  }
}
function drawCrop(ctx, o, sx, sy) {
  const c = CROPS[o.c] || CROPS.potato, g = o.g || 0, bx = sx + 8, by = sy + 13;
  if (g < .25) { R(ctx, bx, by - 2, 1, 2, c.col); P(ctx, bx - 1, by - 3, c.col); P(ctx, bx + 1, by - 3, c.col); }
  else if (g < .6) { R(ctx, bx, by - 5, 1, 5, '#3a7a30'); E(ctx, bx - 2, by - 4, 2, 1, c.col); E(ctx, bx + 2, by - 5, 2, 1, c.col); }
  else {
    R(ctx, bx, by - 8, 1, 8, '#3a7a30'); E(ctx, bx - 3, by - 5, 3, 2, c.col); E(ctx, bx + 3, by - 6, 3, 2, c.col); E(ctx, bx, by - 9, 2, 2, c.col);
    if (g >= 1) {
      if (o.c === 'melon') { E(ctx, bx + 1, by - 1, 4, 3, c.fruit); R(ctx, bx - 1, by - 3, 1, 4, '#3fd64e'); R(ctx, bx + 2, by - 3, 1, 4, '#3fd64e'); }
      else { R(ctx, bx - 4, by - 6, 2, 2, c.fruit); R(ctx, bx + 2, by - 8, 2, 2, c.fruit); R(ctx, bx, by - 4, 2, 2, c.fruit); }
      if (Math.floor(RT.clock * 2) % 2) P(ctx, bx + 5, by - 11, '#ffffff');
    }
  }
}
function drawFence(ctx, o, sx, sy) {
  const m = CUR_M, isF = (x, y) => { const q = oAt(m, x, y); return q && (q.k === 'fence' || q.k === 'gate'); };
  const rail = '#c98e4f', dk = '#3b2a1e';
  const hr = (x, w) => { R(ctx, x, sy + 6, w, 4, dk); R(ctx, x, sy + 7, w, 2, rail); R(ctx, x, sy + 11, w, 4, dk); R(ctx, x, sy + 12, w, 2, rail); };
  if (isF(o.x - 1, o.y)) hr(sx, 8); if (isF(o.x + 1, o.y)) hr(sx + 8, 8);
  if (isF(o.x, o.y - 1)) { R(ctx, sx + 6, sy - 6, 4, 12, dk); R(ctx, sx + 7, sy - 6, 2, 12, '#a87442'); }
  if (o.k === 'gate') { R(ctx, sx + 1, sy + 5, 14, 10, dk); R(ctx, sx + 2, sy + 6, 12, 8, '#b07848'); R(ctx, sx + 2, sy + 9, 12, 1, '#6b4226'); R(ctx, sx + 7, sy + 6, 1, 8, '#6b4226'); }
  else { R(ctx, sx + 5, sy + 2, 5, 14, dk); R(ctx, sx + 6, sy + 3, 3, 12, '#6b4226'); R(ctx, sx + 6, sy + 3, 1, 12, '#8f5a32'); R(ctx, sx + 6, sy + 3, 3, 1, rail); }
}
function drawEnt(ctx, e, cx, cy) {
  const sx = Math.round(e.x - cx), sy = Math.round(e.y - cy);
  let k = e.def.spr; if (e.k === 'bat') k = Math.floor(e.anim * 8) % 2 ? 'bat1' : 'bat2'; if (e.k === 'gull' && e.fl) k = 'gull_fly';
  if (e.hidden) { E(ctx, sx, sy - 1, 9, 3, '#a08a60'); E(ctx, sx, sy - 2, 7, 2, '#e6d39a'); if (Math.random() < .3) P(ctx, sx + randi(-6, 6), sy - 4, '#c9b077'); return; }
  const kk = (e.dir < 0 && SPR[k + '_f']) ? k + '_f' : k;
  const img = e.hurt > 0 ? wht(kk) : SPR[kk];
  const sw = img.width, sh = img.height, shw = clamp(sw - 4, 8, 30);
  const flying = e.def.fly && (e.k === 'bat' || e.fl);
  ctx.drawImage(shadow(flying ? 8 : shw), sx - ((flying ? 8 : shw) >> 1), sy - 2);
  let ox = 0, oy = 0;
  if (e.st === 'walk' || e.st === 'chase' || e.st === 'move' || e.st === 'dash') oy = -(Math.floor(e.anim * 8) % 2);
  if (/W$/.test(e.st) || e.st === 'wind') ox = Math.round(Math.sin(RT.clock * 50));
  if (flying) oy -= 8 + Math.round(Math.sin(e.anim * 5) * 2);
  ctx.drawImage(img, sx - (sw >> 1) + ox, sy - sh + 2 + oy);
  if (e.k === 'golem' && e.st !== 'idle') { P(ctx, sx - 3 + ox, sy - sh + 8 + oy, '#ffffff'); }
  if (!e.def.boss && e.hp < e.mhp) { R(ctx, sx - 7, sy - sh - 2 + oy, 14, 2, '#160f1c'); R(ctx, sx - 7, sy - sh - 2 + oy, Math.max(1, Math.round(14 * e.hp / e.mhp)), 2, '#ff5a6a'); }
}
function drawDrop(ctx, d, cx, cy) {
  const ic = ICON[IT[d.id] ? IT[d.id].ic : 'page']; if (!ic) return;
  if (d.age > 840 && Math.floor(RT.clock * 8) % 2) return;
  const sx = Math.round(d.x - cx), sy = Math.round(d.y - cy), bob = d.z > 0 ? 0 : Math.round(Math.sin(RT.clock * 4 + d.x) * 1);
  ctx.drawImage(shadow(8), sx - 4, sy - 2);
  ctx.drawImage(ic, sx - (ic.width >> 1), sy - ic.height - Math.round(d.z) + bob);
  if (d.n > 1) drawNum(ctx, d.n > 99 ? '99' : String(d.n), sx + 5, sy - 6 - Math.round(d.z) + bob, '#ffffff', '#160f1c');
}
const HOLD_SHOW = s => { const d = IT[s.id]; return d && (d.tool || d.weapon || d.rod || d.bow || d.light); };
function drawHeld(ctx, sx, sy, dir, prog) {
  const s = held(); if (!s || !HOLD_SHOW(s)) return; const ic = ICON[IT[s.id].ic]; if (!ic) return;
  const hand = [[-4, -9], [2, -7], [3, -7], [-2, -7]][dir];
  ctx.save(); ctx.translate(sx + hand[0], sy + hand[1]); if (dir === 3) ctx.scale(-1, 1);
  let a;
  if (prog != null) { const r = [[-2.4, -.2], [-1.4, 1.2], [-.5, 2.1], [-1.4, 1.2]][dir], e = 1 - Math.pow(1 - prog, 3); a = r[0] + (r[1] - r[0]) * e; }
  else a = [-.9, -.45, .25, -.45][dir];
  ctx.rotate(a); ctx.drawImage(ic, -2, -ic.height + 3); ctx.restore();
}
function drawPlayer(ctx, cx, cy) {
  const p = G.p, sx = Math.round(p.x - cx), sy = Math.round(p.y - cy);
  if (p.dead) { ctx.save(); ctx.translate(sx, sy - 5); ctx.rotate(Math.PI / 2); ctx.drawImage(SPR.pl[2][0], -9, -11); ctx.restore(); return; }
  const inW = tAt(G.map, Math.floor(p.x / TS), Math.floor((p.y - 2) / TS)) === T.SHALLOW;
  if (!inW) ctx.drawImage(shadow(10), sx - 5, sy - 2);
  const f = p.moving ? Math.floor(p.anim) % 4 : 0;
  const prog = p.swing > 0 ? Math.min(1, p.swing / p.swDur) : null;
  const img = p.hurtFlash > 0 ? SPR.pl_white[p.dir][f] : SPR.pl[p.dir][f];
  const blink = p.inv > 0 && p.hurtFlash <= 0 && Math.floor(RT.clock * 16) % 2 === 0;
  const bx = sx - (img.width >> 1), by = sy - img.height + 1;
  if (p.dir === 0) drawHeld(ctx, sx, sy, p.dir, prog);
  if (!blink) {
    if (inW) { ctx.drawImage(img, 0, 0, img.width, img.height - 6, bx, by + 4, img.width, img.height - 6); const w = 10 + Math.round(Math.sin(RT.clock * 5)); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(sx - (w >> 1), sy - 2, w, 1); }
    else ctx.drawImage(img, bx, by);
  }
  if (p.dir !== 0) drawHeld(ctx, sx, sy, p.dir, prog);
  if (p.fishing) {
    const f = p.fishing, tip = [[-2, -22], [12, -20], [4, -12], [-12, -20]][p.dir];
    const tx = sx + tip[0], ty = sy + tip[1], bx2 = Math.round(f.bx - cx), by2 = Math.round(f.by - cy) + (f.ph === 'bite' ? 2 : Math.round(Math.sin(RT.clock * 3)));
    if (f.ph !== 'cast') {
      ctx.fillStyle = 'rgba(255,255,255,.7)'; const n = Math.max(Math.abs(bx2 - tx), Math.abs(by2 - ty)) || 1;
      for (let i = 0; i <= n; i += 1) { const k = i / n; ctx.fillRect(Math.round(tx + (bx2 - tx) * k), Math.round(ty + (by2 - ty) * k + Math.sin(k * Math.PI) * 4), 1, 1); }
      R(ctx, bx2 - 1, by2 - 2, 3, 2, '#ff3355'); R(ctx, bx2 - 1, by2, 3, 1, '#ffffff');
      if (f.ph === 'bite') drawNum(ctx, '!', sx, sy - 30, '#ffec27', '#160f1c');
    }
  }
}
function drawShip(ctx, cx, cy) {
  const s = G.ship, W = G.maps.island.w * TS, pr = 1 - s.t / s.dur;
  const x = s.dir > 0 ? lerp(-80, W + 80, pr) : lerp(W + 80, -80, pr);
  const sx = Math.round(x - cx), sy = Math.round(s.y - cy); if (sx < -40 || sx > RT.vw + 40 || sy < -30 || sy > RT.vh + 30) return;
  const img = s.dir > 0 ? SPR.ship : (SPR.ship_f || (SPR.ship_f = flipH(SPR.ship)));
  ctx.drawImage(img, sx - (img.width >> 1), sy - img.height + Math.round(Math.sin(RT.clock * 2)));
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(sx - s.dir * 14, sy, 8, 1);
}
function drawProjs(ctx, cx, cy) {
  for (const q of RT.projs) {
    const sx = Math.round(q.x - cx), sy = Math.round(q.y - cy);
    if (q.type === 'arrow') { const a = Math.atan2(q.vy, q.vx); for (let k = 0; k < 7; k++) P(ctx, Math.round(sx - Math.cos(a) * k), Math.round(sy - Math.sin(a) * k), k < 2 ? '#c8d0d8' : k > 5 ? '#ffffff' : '#c98e4f'); }
    else if (q.type === 'nut') { R(ctx, sx - 1, sy - 1, 3, 3, '#6b4226'); P(ctx, sx - 1, sy - 1, '#c98e4f'); }
    else if (q.type === 'rock') { E(ctx, sx, sy, 3, 3, '#5f574f'); E(ctx, sx - 1, sy - 1, 2, 2, '#8a7f9a'); }
    else if (q.type === 'bubble') { ctx.fillStyle = 'rgba(159,224,244,.85)'; ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill(); P(ctx, sx - 1, sy - 2, '#ffffff'); }
  }
}

// ---------- particles ----------
function addP(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    if (RT.parts.length > 500) RT.parts.shift();
    const l = rand(o.l * .6, o.l);
    RT.parts.push({ x: x + rand(-(o.sx || 3), o.sx || 3), y: y + rand(-(o.sy || 2), o.sy || 2), z: o.z || 0, vx: rand(-o.v, o.v), vy: rand(-o.v, o.v) * .6, vz: o.vz != null ? rand(o.vz * .5, o.vz) : rand(20, 60), g: o.g != null ? o.g : 160, l, ml: l, c: Array.isArray(o.c) ? pick(o.c) : o.c, s: o.s || 1 });
  }
}
function hitParts(x, y, od) { addP(x, y, 5, { v: 50, l: .5, c: od.tool === 'axe' ? ['#c98e4f', '#8f5a32', '#e0b070'] : od.tool === 'pick' ? ['#a0a8b4', '#6c7380', '#d0d6dc'] : ['#b0643c', '#8a4a2c'], vz: 60 }); }
function breakParts(x, y, od) { addP(x, y, 14, { v: 70, l: .7, c: od && od.tool === 'pick' ? ['#a0a8b4', '#6c7380', '#d0d6dc'] : ['#c98e4f', '#8f5a32', '#4a8f3a', '#7cc35a'], vz: 80, s: 2 }); }
function leafParts(x, y) { addP(x, y, 5, { v: 30, l: .9, c: ['#4a8f3a', '#7cc35a'], vz: 30, g: 40 }); }
function dustParts(x, y, n) { addP(x, y, n || 6, { v: 30, l: .5, c: ['#c9b077', '#e6d39a', '#a08a60'], vz: 25, g: 80 }); }
function splashParts(x, y, n) { addP(x, y, n || 6, { v: 35, l: .5, c: ['#ffffff', '#9fe0f4', '#5ec8e8'], vz: 60, g: 220 }); }
function sparkParts(x, y) { addP(x, y, 8, { v: 25, l: .8, c: ['#ffe08a', '#ffa300', '#ff7a1a'], vz: 50, g: -20 }); }
function poofParts(x, y, n, c) { addP(x, y, n, { v: 60, l: .7, c: c || ['#ffffff', '#d0d0d0', '#a0a0a0'], vz: 40, g: 30, s: 2 }); }
function hitSpark(x, y) { addP(x, y, 6, { v: 70, l: .25, c: ['#ffffff', '#ffe08a'], vz: 30, g: 0 }); }
function ringParts(x, y, r, c) { for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; RT.parts.push({ x: x + Math.cos(a) * r * .3, y: y + Math.sin(a) * r * .2, z: 0, vx: Math.cos(a) * r * 2, vy: Math.sin(a) * r * 1.4, vz: 30, g: 120, l: .5, ml: .5, c, s: 2 }); } }
function puffParts(x, y, type) { addP(x, y, type === 'bubble' ? 4 : 3, { v: 20, l: .3, c: type === 'bubble' ? ['#ffffff', '#9fe0f4'] : ['#d0d0d0'], vz: 10, g: 0 }); }
function updParts(dt) {
  for (let i = RT.parts.length - 1; i >= 0; i--) {
    const q = RT.parts[i]; q.l -= dt; if (q.l <= 0) { RT.parts.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= q.g * dt;
    if (q.z < 0) { q.z = 0; q.vz = 0; q.vx *= .5; q.vy *= .5; }
    const f = Math.pow(.3, dt); q.vx *= f; q.vy *= f;
  }
  for (let i = RT.floats.length - 1; i >= 0; i--) { const f = RT.floats[i]; f.t += dt; if (f.t > .9) RT.floats.splice(i, 1); }
  if (G && G.map) for (const o of getLit(G.map)) {
    if (o.k === 'signal' && o.fuel > 0 && Math.random() < dt * 9) addP(o.x * TS + 8, o.y * TS - 2, 1, { v: 6, l: 3.2, c: ['#d8d8d8', '#b8b8b8', '#f0f0f0'], vz: 22, g: -3, s: 3, sx: 2 });
    else if (o.k === 'campfire' && o.fuel > 0 && Math.random() < dt * 2) addP(o.x * TS + 8, o.y * TS + 4, 1, { v: 4, l: 1.6, c: ['#a0a0a0', '#c0c0c0'], vz: 14, g: -2, s: 1, sx: 1 });
  }
}
function floatTxt(x, y, txt, col) { RT.floats.push({ x, y, t: 0, txt, col }); }
function drawParts(ctx, cx, cy) {
  for (const q of RT.parts) { ctx.globalAlpha = Math.min(1, q.l / q.ml * 2); ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x - cx), Math.round(q.y - cy - q.z), q.s, q.s); }
  ctx.globalAlpha = 1;
}

// ---------- weather / light ----------
function drawWeather(ctx, r, storm) {
  if (r < .05) return;
  ctx.fillStyle = 'rgba(40,52,74,' + (r * .2) + ')'; ctx.fillRect(0, 0, RT.vw, RT.vh);
  const n = Math.floor(r * (RT.vw * RT.vh) / 300) + 6, t = RT.clock, sl = storm ? 2 : 1;
  ctx.fillStyle = 'rgba(210,225,255,.62)';
  for (let i = 0; i < n; i++) {
    const sp = 230 + (i % 7) * 22, ph = (i * 0.6180339) % 1;
    const x = ((i * 73.13 + ph * 400 + t * 50 * sl) % (RT.vw + 20)) - 10, y = ((i * 41.7 + ph * 900 + t * sp) % (RT.vh + 20)) - 10;
    for (let k = 0; k < 5; k++) ctx.fillRect(Math.floor(x - k * sl * .5), Math.floor(y - k * 1.6), 1, 1);
  }
}
function darknessAt(h) { if (h >= 6.5 && h < 17) return 0; if (h >= 17 && h < 20) return (h - 17) / 3 * .86; if (h >= 20 || h < 4.5) return .86; return (6.5 - h) / 2 * .86; }
function collectLights(m) {
  const L = [];
  if (G && G.map === m && RT.screen === 'game' && !G.p.dead) { const p = G.p, s = held(), d = s && IT[s.id]; L.push({ x: p.x, y: p.y - 8, r: d && d.light ? d.light : 28, fl: d && d.burn, warm: d && d.burn, sd: 0 }); }
  for (const o of getLit(m)) {
    const x = o.x * TS + 8, y = o.y * TS + 8, sd = o.x * 3.1 + o.y * 1.7;
    if (o.k === 'campfire') { if (o.fuel > 0) L.push({ x, y, r: 86, fl: 1, warm: 1, sd }); }
    else if (o.k === 'signal') { if (o.fuel > 0) L.push({ x, y: y - 6, r: 132, fl: 1, warm: 1, sd }); }
    else if (o.k === 'torch_post') L.push({ x, y: y - 8, r: 72, fl: 1, warm: 1, sd });
    else if (o.k === 'crystal_rock') L.push({ x, y, r: 30 });
    else if (o.k === 'heli') L.push({ x, y, r: 70 });
    else L.push({ x, y, r: 16 });
  }
  if (RT.boss && RT.boss.k === 'golem' && !RT.boss.dead) L.push({ x: RT.boss.x, y: RT.boss.y - 26, r: 26 });
  return L;
}
function drawLighting(ctx, m, cx, cy, h, rain) {
  let dark = m.id === 'cave' ? .93 : darknessAt(h) + rain * .12;
  if (OPT.dark) dark *= .72; dark = Math.min(.95, dark);
  if (m.id === 'island') {
    let tint = 0; if (h >= 16 && h < 19.5) tint = 1 - Math.abs(h - 18) / 2; else if (h >= 4.5 && h < 7) tint = 1 - Math.abs(h - 5.8) / 1.3;
    if (tint > 0) { ctx.fillStyle = 'rgba(255,110,40,' + (tint * .14) + ')'; ctx.fillRect(0, 0, RT.vw, RT.vh); }
  }
  if (dark < .02) return;
  const lx = LX; lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1; lx.clearRect(0, 0, RT.vw, RT.vh);
  lx.fillStyle = m.id === 'cave' ? 'rgba(6,4,14,' + dark + ')' : 'rgba(10,14,44,' + dark + ')'; lx.fillRect(0, 0, RT.vw, RT.vh);
  lx.globalCompositeOperation = 'destination-out'; lx.fillStyle = '#000';
  const lights = collectLights(m);
  for (const L of lights) {
    const x = L.x - cx, y = L.y - cy; if (x < -L.r || y < -L.r || x > RT.vw + L.r || y > RT.vh + L.r) continue;
    // ゆらぎは時間だけで決める（位置に依存させない）。設定でOFFにできる
    const r = L.r * (L.fl && OPT.flicker ? 1 + Math.sin(RT.clock * 4.2 + (L.sd || 0)) * .018 + Math.sin(RT.clock * 6.9 + (L.sd || 0) * 1.7) * .01 : 1);
    for (const [k, a] of [[1, .3], [.75, .35], [.5, .35], [.3, .45]]) { lx.globalAlpha = a; lx.beginPath(); lx.arc(Math.round(x), Math.round(y), Math.round(r * k), 0, Math.PI * 2); lx.fill(); }
  }
  lx.globalAlpha = 1; lx.globalCompositeOperation = 'source-over';
  ctx.drawImage(LC, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const L of lights) if (L.warm) { const x = L.x - cx, y = L.y - cy; if (x < -L.r || y < -L.r || x > RT.vw + L.r || y > RT.vh + L.r) continue; ctx.globalAlpha = .1 * dark; ctx.fillStyle = '#ff9a40'; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), Math.round(L.r * .55), 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawOverlays(ctx, cx, cy) {
  const p = G.p;
  if (G.mode === 'play' && RT.act && RT.tg && !p.fishing) {
    const tg = RT.tg, sx = tg.x * TS - cx, sy = tg.y * TS - cy;
    if (RT.act.place) {
      const s = held(), k = s && IT[s.id].place, sp = { campfire: 'campfire', workbench: 'workbench', bed: 'leafbed', chest: 'chest', collector: 'collector0', torch_post: 'torchpost', furnace: 'furnace', signal: 'signal', sos: 'sos', raft: 'raft' }[k];
      ctx.globalAlpha = .55; if (sp) dB(ctx, SPR[sp], sx, sy, 0, 0); else if (s) ctx.drawImage(ICON[IT[s.id].ic], sx + 1, sy + 1); ctx.globalAlpha = 1;
      brackets(ctx, sx, sy, RT.act.bad ? '#ff3355' : '#7cff9a');
    } else if (RT.act.tgt && tg.o) brackets(ctx, sx, sy, RT.act.bad ? '#ff7a7a' : '#ffffff');
  }
  if (p.pick && p.pickT > .1) { const sx = p.pick.x * TS - cx, sy = p.pick.y * TS - cy - 7; R(ctx, sx - 1, sy - 1, 18, 4, '#160f1c'); R(ctx, sx, sy, Math.max(1, Math.round(16 * Math.min(1, p.pickT / .9))), 2, '#7cff9a'); }
  for (const f of RT.floats) drawNum(ctx, f.txt, Math.round(f.x - cx), Math.round(f.y - cy - f.t * 18), f.col, '#160f1c');
  const f = p.fishing;
  if (f && f.ph === 'reel') {
    const sx = Math.round(p.x - cx), sy = Math.round(p.y - cy) - 38, w = 54, x0 = sx - (w >> 1);
    R(ctx, x0 - 2, sy - 2, w + 4, 10, '#160f1c'); R(ctx, x0, sy, w, 6, '#1d3550');
    R(ctx, x0 + Math.round(f.za * w), sy, Math.max(2, Math.round(f.zw * w)), 6, '#3fd64e');
    R(ctx, x0 + Math.round(f.c * (w - 1)), sy - 2, 1, 10, '#ffffff');
    for (let i = 0; i < f.need; i++) R(ctx, sx - f.need * 3 + i * 6, sy + 10, 4, 3, i < f.hits ? '#ffec27' : '#3a3f4a');
    for (let i = 0; i < 3; i++) R(ctx, x0 + w + 4, sy + i * 3, 2, 2, i < f.miss ? '#ff3355' : '#3a3f4a');
  }
}
function brackets(ctx, sx, sy, col) {
  const a = Math.floor(RT.clock * 3) % 2 ? 0 : 1; ctx.fillStyle = col;
  const x0 = sx - a, y0 = sy - a, x1 = sx + 15 + a, y1 = sy + 15 + a;
  ctx.fillRect(x0, y0, 4, 1); ctx.fillRect(x0, y0, 1, 4); ctx.fillRect(x1 - 3, y0, 4, 1); ctx.fillRect(x1, y0, 1, 4);
  ctx.fillRect(x0, y1, 4, 1); ctx.fillRect(x0, y1 - 3, 1, 4); ctx.fillRect(x1 - 3, y1, 4, 1); ctx.fillRect(x1, y1 - 3, 1, 4);
}

// ---------- minimap ----------
function mmBuild(m) {
  m.img = mkC(m.w, m.h); m.ictx = cx2(m.img); m.ictx.fillStyle = '#0a1420'; m.ictx.fillRect(0, 0, m.w, m.h);
  for (let i = 0; i < m.seen.length; i++) if (m.seen[i]) mmPaint(m, i % m.w, (i / m.w) | 0);
}
function mmPaint(m, x, y) {
  if (!m.ictx) return; const i = y * m.w + x, o = m.o[i];
  let col = TINFO[m.t[i]].mc; if (o && OB[o.k] && OB[o.k].mc) col = OB[o.k].mc;
  m.ictx.fillStyle = col; m.ictx.fillRect(x, y, 1, 1);
}
const POI_COL = { hut: '#ffa300', ruins: '#c48ef0', summit: '#ff3355', cave: '#e0e6ec', cove: '#29adff', oldraft: '#c98e4f' };
function mapMarkers(x, tx, ty, s, mini) {
  const m = G.map, blink = Math.floor(RT.clock * 3) % 2;
  const dot = (wx, wy, col, r) => { x.fillStyle = '#160f1c'; x.fillRect(Math.round(tx(wx)) - r - 1, Math.round(ty(wy)) - r - 1, r * 2 + 3, r * 2 + 3); x.fillStyle = col; x.fillRect(Math.round(tx(wx)) - r, Math.round(ty(wy)) - r, r * 2 + 1, r * 2 + 1); };
  const r = mini ? 1 : Math.max(1, Math.round(s));
  if (G.mapId === 'island') {
    for (const k in G.pois) { const po = G.pois[k]; if (po.found && !po.hidden) dot(po.x + .5, po.y + .5, POI_COL[k] || '#ffffff', r); }
    for (const tr of G.treasures) if (tr.known && !tr.found) { const X = Math.round(tx(tr.x + .5)), Y = Math.round(ty(tr.y + .5)); x.fillStyle = '#ff3355'; for (let k = -r - 1; k <= r + 1; k++) { x.fillRect(X + k, Y + k, 1, 1); x.fillRect(X + k, Y - k, 1, 1); } }
    const q = QUESTS[G.quest]; if (q && q.target) { const tgt = q.target(G); if (tgt && blink) dot(tgt.x + .5, tgt.y + .5, '#ffec27', r); }
    const r2 = findObj('raft'); if (r2) dot(r2.x + .5, r2.y + .5, '#c98e4f', mini ? 0 : r);
    if (G.rescue && G.rescue.st === 'landed' && blink) dot(G.rescue.x + .5, G.rescue.y + .5, '#ff3355', r + 1);
    if (G.ship) { const W = m.w * TS, pr = 1 - G.ship.t / G.ship.dur, sxp = (G.ship.dir > 0 ? lerp(-80, W + 80, pr) : lerp(W + 80, -80, pr)) / TS; dot(sxp, G.ship.y / TS, '#ffffff', r); }
  } else {
    const ci = G.caveInfo; dot(ci.entrance.x + .5, ci.entrance.y + .5, '#fff4c8', r);
    if (!G.boss.golem && m.seen[ci.boss.y * m.w + ci.boss.x]) dot(ci.boss.x + .5, ci.boss.y + .5, '#ff3355', r);
  }
  if (G.spawnPt && G.spawnPt.map === G.mapId) dot(G.spawnPt.x + .5, G.spawnPt.y + .5, '#7cff9a', mini ? 0 : r);
  if (blink || !mini) dot(G.p.x / TS, G.p.y / TS, '#ffffff', r);
}
function drawMini(c) {
  if (!G || !G.map) return; const x = cx2(c), W = c.width, H = c.height, m = G.map, p = G.p;
  x.fillStyle = '#081018'; x.fillRect(0, 0, W, H);
  const sx = Math.round(p.x / TS - W / 2), sy = Math.round(p.y / TS - H / 2);
  const sx0 = Math.max(0, sx), sy0 = Math.max(0, sy), sx1 = Math.min(m.w, sx + W), sy1 = Math.min(m.h, sy + H);
  if (sx1 > sx0 && sy1 > sy0) x.drawImage(m.img, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 - sx, sy0 - sy, sx1 - sx0, sy1 - sy0);
  mapMarkers(x, wx => wx - sx, wy => wy - sy, 1, true);
}
function drawFullMap(c) {
  const x = cx2(c), m = G.map, s = Math.max(1, Math.floor(Math.min(c.width / m.w, c.height / m.h)));
  x.fillStyle = '#081018'; x.fillRect(0, 0, c.width, c.height);
  const ox = Math.floor((c.width - m.w * s) / 2), oy = Math.floor((c.height - m.h * s) / 2);
  x.imageSmoothingEnabled = false; x.drawImage(m.img, ox, oy, m.w * s, m.h * s);
  mapMarkers(x, wx => ox + wx * s, wy => oy + wy * s, s * .8, false);
}

// ---------- 航海 ----------
function renderVoyage(ctx) {
  const V = RT.voy, W = RT.vw, H = RT.vh, t = RT.clock, storm = V.d > .4 && V.d < .72, fr = Math.floor(t * 2.2) % 4;
  const scrolled = V.t * (storm ? 95 : 72), off = Math.floor(scrolled) % 16, base = Math.floor(scrolled / 16);
  for (let y = -1; y <= Math.ceil(H / 16); y++) for (let x = 0; x <= Math.ceil(W / 16); x++) ctx.drawImage(TILESET[T.DEEP][((x * 3 + (y - base) * 5) & 3)][fr], x * 16, y * 16 + off);
  const cxm = W / 2;
  for (const o of V.obs) {
    const x = Math.round(cxm + o.x), y = Math.round(o.y);
    if (o.k === 'rock') { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - 12, y + 3, 24, 1); ctx.drawImage(SPR.boulder, x - 12, y - 14); }
    else if (o.k === 'wave') { for (let i = -11; i <= 11; i++) { const yy = y + Math.round(i * i / 22) - 3; R(ctx, x + i, yy, 1, 2, '#ffffff'); R(ctx, x + i, yy + 2, 1, 1, '#9fe0f4'); } }
    else if (o.k === 'shark') { for (let k = 0; k < 7; k++) R(ctx, x - 3 + Math.floor(k / 2), y - k, 7 - k, 1, k ? '#5c6169' : '#3a3f4a'); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x - 6, y + 1, 12, 1); }
    else if (o.k === 'crate') ctx.drawImage(SPR.crate, x - 8, y - 6 + Math.round(Math.sin(t * 3 + o.x)));
  }
  const rx = Math.round(cxm + V.x), ry = Math.round(H * .74), bob = Math.round(Math.sin(t * 3));
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(rx - 10, ry + 4, 2, 6 + (Math.floor(t * 8) % 3)); ctx.fillRect(rx + 9, ry + 4, 2, 6 + (Math.floor(t * 8 + 1) % 3));
  if (!(V.inv > 0 && Math.floor(t * 16) % 2)) { ctx.drawImage(SPR.raft_full, rx - 14, ry - 26 + bob); ctx.drawImage(SPR.pl[0][0], rx - 13, ry - 18 + bob); }
  if (storm) { ctx.fillStyle = 'rgba(10,14,40,.35)'; ctx.fillRect(0, 0, W, H); drawWeather(ctx, 1, true); }
  else if (V.d > .85) { ctx.fillStyle = 'rgba(255,170,90,' + ((V.d - .85) * 1.2) + ')'; ctx.fillRect(0, 0, W, H); }
  if (V.d > .9) { const lh = Math.round((V.d - .9) * 10 * 40); R(ctx, 0, 0, W, lh, '#3f7d32'); R(ctx, 0, lh, W, 3, '#e6d39a'); }
  if (RT.lightning > 0) { ctx.fillStyle = 'rgba(235,242,255,' + Math.min(.8, RT.lightning * 2.4) + ')'; ctx.fillRect(0, 0, W, H); }
}

// ---------- タイトル背景 ----------
function initDemo() {
  const r = genIsland(20260917); DEMO.m = r.m; DEMO.m.litDirty = true;
  DEMO.pts = [r.info.spawn, r.info.pois.hut, r.info.pois.ruins, r.info.pois.summit, r.info.pois.cove].filter(Boolean);
  DEMO.x = r.info.spawn.x * TS - 160; DEMO.y = r.info.spawn.y * TS - 120; DEMO.tg = 1;
  const m = DEMO.m; for (const s of [[0, 0]]) { }
  const sp = r.info.spawn; const f = freeNear(m, sp.x - 2, sp.y - 1, (x, y) => landT(tAt(m, x, y)) && !oAt(m, x, y), 4); if (f) setO(m, f.x, f.y, { k: 'campfire', fuel: 9999 });
}
function updDemo(dt) {
  if (!DEMO.m) return; const tg = DEMO.pts[DEMO.tg % DEMO.pts.length];
  const tx = tg.x * TS - RT.vw / 2, ty = tg.y * TS - RT.vh / 2, dx = tx - DEMO.x, dy = ty - DEMO.y, d = Math.hypot(dx, dy);
  if (d < 6) DEMO.tg++; else { DEMO.x += dx / d * 14 * dt; DEMO.y += dy / d * 14 * dt; }
  DEMO.h = (DEMO.h + dt * .12) % 24;
}
function renderDemo(ctx) {
  const m = DEMO.m; CUR_M = m; const cx = Math.round(DEMO.x), cy = Math.round(DEMO.y);
  drawTiles(ctx, m, cx, cy); drawSorted(ctx, m, cx, cy, false); drawParts(ctx, cx, cy);
  drawLighting(ctx, m, cx, cy, DEMO.h, 0);
}

// =====================================================================
//  UI
// =====================================================================
const $id = id => document.getElementById(id);
const UI = { open: null, tab: 'bag', invSel: 0, moveFrom: null, craftCat: 'all', chest: null, chestBag: false, panelObj: null, jSel: 1, dlg: null, dq: [], titleSt: 'main', titleSlot: 0, focusKey: null, last: {}, pk: {}, miniT: 0, endBusy: false, endT: null, heldT: 0 };
const MTABS = [['bag', 'バッグ'], ['craft', 'クラフト'], ['map', '地図'], ['goal', '目標'], ['journal', '日記'], ['sys', 'システム']];
const HUDICON = {
  hp: ['.88.88.', '8888888', '8878888', '.88888.', '..888..', '...8...'],
  food: ['....JJ.', '...JJJ.', '..uuJ..', '.uUUu..', 'uUeUu..', 'uUUu...', '.uu....'],
  water: ['...c...', '..ccc..', '.ccccc.', '.cWccc.', 'ccWcccc', '.ccccc.', '..ccc..'],
  sta: ['...aa.', '..aa..', '.aaaa.', '..aa..', '.aa...', 'aa....'],
  temp: ['..7..', '.767.', '.787.', '.787.', '.787.', '88888', '.888.'],
};
const btn = (act, label, attrs, cls, fk) => `<button class="btn nav ${cls || ''}" data-act="${act}" data-fk="${fk || 'b-' + act}" ${attrs || ''}>${label}</button>`;
function slotHTML(s, attrs, cls) {
  let inner = '';
  if (s && IT[s.id]) {
    const d = IT[s.id]; inner = `<img src="${ICONURL[d.ic] || ''}" alt="">` + (s.n > 1 ? `<b>${s.n}</b>` : '');
    if (s.d != null && d.dur) { const r = clamp(s.d / d.dur, 0, 1); inner += `<i class="${r < .25 ? 'low' : ''}" style="width:${Math.round(r * 100)}%"></i>`; }
  }
  return `<div class="slot nav ${cls || ''}" ${attrs || ''}>${inner}</div>`;
}
function fmtTime(s) { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}時間${m}分` : `${m}分`; }
function slotDesc(inf) { return `${inf.day}日目・${DIFF[inf.diff] ? DIFF[inf.diff].n : ''}・${fmtTime(inf.play)}・日記${inf.pages}/10${Object.keys(inf.endings || {}).length ? '・★' + Object.keys(inf.endings).sort().join('') : ''}`; }
const glyph = b => Inp.mode === 'kb' ? ({ A: 'Space', B: 'Shift', X: 'B', Y: 'C', START: 'Esc', SELECT: 'M', LB: 'Q', RB: 'E' }[b] || b) : b;
const gk = b => `<span class="key k${b}">${glyph(b)}</span>`;

function uiInit() {
  for (const k in HUDICON) { const img = $id('ic-' + k); if (img) try { img.src = fromMap(HUDICON[k]).toDataURL(); } catch (e) { } }
  const hb = $id('hotbar'); hb.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const d = el('div', 'hs'); d.dataset.i = i; d.innerHTML = `<img alt=""><b></b><i></i><u>${i + 1}</u>`;
    d.dataset.tip = 'inv:' + i;
    d.addEventListener('click', () => { if (G && G.mode === 'play' && !UI.open) { G.sel = i; invChanged(); sfx('tick'); if (Inp.mode === 'touch') tipTouch(d); } }); hb.appendChild(d);
  }
  tipEl = el('div'); tipEl.id = 'tip'; $id('app').appendChild(tipEl);
  $id('modal').addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t) { if (e.target.id === 'modal') UI.close(); else { const tt = e.target.closest('[data-tip]'); if (tt && Inp.mode === 'touch') tipTouch(tt); } return; }
    UI.act(t.dataset.act, t.dataset, t);
  });
  $id('dialog').addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (t) UI.act(t.dataset.act, t.dataset, t); else UI.dlgA(); });
  for (const id of ['title', 'death', 'ending']) $id(id).addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (t) UI.act(t.dataset.act, t.dataset, t); else if (id === 'ending' && UI.endBusy) UI.endSkip(); });
  $id('quest').addEventListener('click', () => UI.openMain('goal'));
  $id('mini').addEventListener('click', () => UI.openMain('map'));
  $$('#hud-btns [data-ui]').forEach(b => b.addEventListener('click', () => { if (b.dataset.ui === 'v3d') toggle3D(); else UI.openMain(b.dataset.ui === 'map' ? 'map' : 'sys'); }));
  $id('rt-close').addEventListener('click', () => document.body.classList.add('rt-off'));
  applyOpt();
}
function applyOpt() {
  setVol();
  document.body.classList.remove('ts0', 'ts1', 'ts2'); document.body.classList.add('ts' + (OPT.touch | 0));
  const mm = $id('mini'); if (mm) mm.style.display = OPT.minimap ? '' : 'none';
}

// ---------- ツールチップ（アイテム情報） ----------
let tipEl = null, tipT = 0, tipSrc = null;
function tipItem(spec) {
  if (!G || !spec) return null; const i = spec.indexOf(':'), k = i < 0 ? spec : spec.slice(0, i), v = i < 0 ? '' : spec.slice(i + 1);
  if (k === 'inv') { const s = G.inv[+v]; return s && IT[s.id] ? { s } : null; }
  if (k === 'armor') return G.armor ? { s: G.armor } : null;
  if (k === 'ch') { const s = UI.chest && UI.chest.items && UI.chest.items[+v]; return s && IT[s.id] ? { s } : null; }
  if (k === 'it') return IT[v] ? { s: { id: v, n: 1 }, own: cnt(v) } : null;
  return null;
}
function tipShow(spec, x, y, anchor) {
  if (!tipEl) return; const d = tipItem(spec); if (!d) { tipHide(); return; }
  const s = d.s, def = IT[s.id], st = itemStats(s);
  if (tipSrc !== spec + '|' + s.n + '|' + (s.d | 0)) {
    tipEl.innerHTML = `<div class="tt-h"><img src="${ICONURL[def.ic] || ''}" alt=""><b>${esc(def.n)}${s.n > 1 ? ' ×' + s.n : ''}</b>${def.key ? '<span class="tag">大切なもの</span>' : ''}</div>${def.d ? `<p>${esc(def.d)}</p>` : ''}${st.length ? `<ul>${st.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}${d.own != null ? `<p class="own">所持 ${d.own}</p>` : ''}`;
    tipSrc = spec + '|' + s.n + '|' + (s.d | 0);
  }
  tipEl.classList.add('show');
  const W = window.innerWidth, H = window.innerHeight, r = tipEl.getBoundingClientRect(); let lx, ly;
  if (anchor) {
    lx = anchor.right + 8; ly = anchor.top;
    if (lx + r.width > W - 6) lx = anchor.left - r.width - 8;
    if (lx < 6) { lx = anchor.left + anchor.width / 2 - r.width / 2; ly = anchor.top - r.height - 8; if (ly < 6) ly = anchor.bottom + 8; }
  } else { lx = x + 16; ly = y + 16; if (lx + r.width > W - 6) lx = x - r.width - 12; if (ly + r.height > H - 6) ly = y - r.height - 12; }
  tipEl.style.left = Math.round(clamp(lx, 6, Math.max(6, W - r.width - 6))) + 'px';
  tipEl.style.top = Math.round(clamp(ly, 6, Math.max(6, H - r.height - 6))) + 'px';
}
function tipHide() { if (tipEl) tipEl.classList.remove('show'); tipSrc = null; tipT = 0; }
function tipTouch(t) { tipShow(t.dataset.tip, 0, 0, t.getBoundingClientRect()); tipT = 2.2; }

// ---------- toasts / notice ----------
function addToast(e, ms) { const box = $id('toasts'); box.appendChild(e); while (box.children.length > 6) box.firstChild.remove(); e._h = setTimeout(() => fadeOut(e), ms); }
function fadeOut(e) { e.classList.add('out'); setTimeout(() => e.remove(), 400); }
function toast(msg, cls, key) {
  if (key) { const now = performance.now(); if (RT.toastKeys[key] && now - RT.toastKeys[key] < 4000) return; RT.toastKeys[key] = now; }
  if (cls === 'big') { notice(msg); return; }
  addToast(el('div', 'toast ' + (cls || ''), esc(msg)), cls === 'ach' ? 3600 : 2800);
}
function pickupToast(id, n) {
  const d = IT[id]; if (!d) return; const now = performance.now(), ex = UI.pk[id];
  if (ex && ex.el.isConnected && !ex.el.classList.contains('out') && now - ex.t < 2400) {
    ex.n += n; ex.t = now; ex.el.querySelector('span').textContent = d.n + ' ×' + ex.n; clearTimeout(ex.el._h); ex.el._h = setTimeout(() => fadeOut(ex.el), 2400);
    ex.el.classList.remove('pop'); void ex.el.offsetWidth; ex.el.classList.add('pop'); return;
  }
  const e = el('div', 'toast pick', `<img src="${ICONURL[d.ic] || ''}" alt=""><span>${esc(d.n)} ×${n}</span>`);
  addToast(e, 2400); UI.pk[id] = { el: e, n, t: now };
}
let noticeT = null;
function notice(msg) {
  const n = $id('notice'); n.textContent = msg; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show');
  clearTimeout(noticeT); noticeT = setTimeout(() => n.classList.remove('show'), 3200);
}

// ---------- HUD ----------
function tempWord(t) { return t < 15 ? '凍える' : t < 30 ? '寒い' : t < 45 ? '肌寒い' : t < 82 ? '快適' : '暖かい'; }
function setBar(k, v, txt) {
  const key = Math.round(clamp(v, 0, 1) * 200) + '|' + txt; if (UI.last['bar' + k] === key) return; UI.last['bar' + k] = key;
  const e = $id('bar-' + k); if (!e) return; e.querySelector('i').style.width = (clamp(v, 0, 1) * 100) + '%'; e.querySelector('b').textContent = txt; e.classList.toggle('low', v < .25);
}
function setHTML(id, h) { if (UI.last['h' + id] === h) return; UI.last['h' + id] = h; $id(id).innerHTML = h; }
function hudUpdate(dt) {
  if (!G) return; const p = G.p;
  setBar('hp', p.hp / p.mhp, Math.ceil(Math.max(0, p.hp))); setBar('food', p.food / 100, Math.ceil(p.food)); setBar('water', p.water / 100, Math.ceil(p.water));
  setBar('sta', p.sta / 100, Math.ceil(p.sta)); setBar('temp', p.temp / 100, tempWord(p.temp));
  const ef = [];
  if (p.poison > 0) ef.push(['bad', '毒']); if (p.sick > 0) ef.push(['bad', '腹痛']); if (p.fed > 0) ef.push(['good', '満腹']);
  if (RT.heat) ef.push(['warm', 'たき火']); if (p.temp < 30) ef.push(['cold', '寒い']); if (G.mapId === 'island' && G.rain > .3) ef.push(['wet', '雨']);
  setHTML('effects', ef.map(([c, t]) => `<span class="ef ${c}">${t}</span>`).join(''));
  const h = hour(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
  setHTML('clock', `<span class="cd">${G.day}日目</span><span class="ct">${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span><span class="cw">${G.mapId === 'cave' ? '洞窟' : { clear: '晴れ', cloudy: 'くもり', rain: '雨', storm: '嵐' }[G.weather]}</span>`);
  // hint
  let hint = '';
  const f = p.fishing;
  if (G.mode === 'play' && !p.dead) {
    if (f) hint = f.ph === 'reel' ? gk('A') + '緑の範囲で押す！' : f.ph === 'bite' ? gk('A') + '今だ！引け！' : '浮きが沈むのを待とう　' + gk('B') + 'やめる';
    else if (p.pick && p.pickT > .1) hint = gk('A') + '回収中…（そのまま押し続ける）';
    else if (RT.act && !(RT.act.weak && !(RT.tg && RT.tg.o))) hint = gk('A') + `<span class="${RT.act.bad ? 'bad' : ''}">${esc(RT.act.lbl)}</span>` + (RT.act.sub ? `<small class="hsub">${esc(RT.act.sub)}</small>` : '');
  }
  setHTML('hint', hint); $id('hint').style.visibility = hint ? 'visible' : 'hidden';
  if (RT.invDirty) { RT.invDirty = false; hotbarUpdate(); }
  if (RT.questDirty || (UI.qT = (UI.qT || 0) + dt) > .5) { UI.qT = 0; RT.questDirty = false; questUpdate(); }
  UI.miniT += dt; if (UI.miniT > .1 && OPT.minimap) { UI.miniT = 0; drawMini($id('mini')); }
  if (RT.boss) { const b = $id('bossbar'); b.querySelector('i').style.width = clamp(RT.boss.hp / RT.boss.mhp, 0, 1) * 100 + '%'; }
  UI.heldT -= dt; if (UI.heldT <= 0) $id('held-name').classList.remove('show');
}
function hotbarUpdate() {
  const hs = $$('#hotbar .hs');
  hs.forEach((d, i) => {
    const s = G.inv[i], img = d.querySelector('img'), b = d.querySelector('b'), du = d.querySelector('i');
    if (s && IT[s.id]) { const def = IT[s.id]; img.src = ICONURL[def.ic] || ''; img.style.visibility = 'visible'; b.textContent = s.n > 1 ? s.n : ''; if (s.d != null && def.dur) { du.style.display = 'block'; du.style.width = Math.round(clamp(s.d / def.dur, 0, 1) * 100) + '%'; du.className = s.d / def.dur < .25 ? 'low' : ''; } else du.style.display = 'none'; }
    else { img.style.visibility = 'hidden'; b.textContent = ''; du.style.display = 'none'; }
    d.classList.toggle('on', i === G.sel);
  });
  const s = held(), nm = s ? IT[s.id].n : '素手';
  if (UI.last.held !== nm + G.sel) {
    if (UI.last.held != null) { const st = s ? itemStats(s).slice(0, 3).join('・') : ''; $id('held-name').innerHTML = `<b>${esc(nm)}</b>${st ? `<small>${esc(st)}</small>` : ''}`; $id('held-name').classList.add('show'); UI.heldT = 1.8; }
    UI.last.held = nm + G.sel;
  }
}
function qLine(label, c, mx) {
  const ok = c >= mx;
  return `<li class="${ok ? 'ok' : ''}"><span>${esc(label)}</span><em>${mx > 1 ? c + '/' + mx : ''}${ok ? ' ✅' : ''}</em></li>`;
}
function questUpdate() {
  let h;
  if (G.quest < QUESTS.length - 1) {
    const q = QUESTS[G.quest], { it } = qProg(q);
    h = `<b>${esc(q.t)}${q.any ? '<span class="qany">どちらか1つ</span>' : ''}</b><ul>${it.map(([l, c, m]) => qLine(l, c, m)).join('')}</ul><small class="qd">${esc(q.d)}</small>`;
  } else {
    const rs = routes(); let best = rs[0], bv = -1;
    for (const r of rs) { const v = r.items.filter(x => x[1] >= x[2]).length / r.items.length; if (v > bv) { bv = v; best = r; } }
    const next = best.items.filter(x => x[1] < x[2]).slice(0, 3);
    h = `<b>脱出：${esc(best.n)}</b><ul>${next.map(([l, c, m]) => qLine(l, c, m)).join('')}</ul><small class="qd">${rs.map(x => x.n.replace(/で.*$/, '') + ' ' + x.items.filter(i => i[1] >= i[2]).length + '/' + x.items.length).join('　')}</small>`;
  }
  setHTML('quest', h);
}
UI.bossBar = e => { const b = $id('bossbar'); if (!e) { b.classList.add('hidden'); return; } $id('boss-name').textContent = e.def.n; b.classList.remove('hidden'); };

// ---------- modal ----------
UI.openMain = (tab, opt) => {
  if (!G || RT.screen !== 'game' || G.mode !== 'play') return;
  const was = UI.open; UI.open = 'main'; UI.tab = tab || 'bag'; if (opt && opt.cat) UI.craftCat = opt.cat;
  if (tab === 'bag' && UI.invSel !== 'armor' && (UI.invSel == null)) UI.invSel = G.sel;
  UI.moveFrom = null; UI.focusKey = UI.tab === 'bag' ? 's-' + G.sel : null; if (UI.tab === 'bag' && !was) UI.invSel = G.sel;
  $id('modal').classList.remove('hidden'); renderModal(); if (!was) sfx('open');
};
UI.openPanel = (kind, o) => { UI.open = kind; UI.panelObj = o; UI.focusKey = null; $id('modal').classList.remove('hidden'); renderModal(); sfx('open'); };
UI.openChest = (o, isBag) => { UI.chest = o; UI.chestBag = !!isBag; if (!o.items) o.items = []; if (!isBag) while (o.items.length < 20) o.items.push(null); UI.openPanel('chest', o); };
UI.openRaft = o => UI.openPanel('raft', o);
UI.openRadio = o => UI.openPanel('radio', o);
UI.openAltar = o => UI.openPanel('altar', o);
UI.close = () => { tipHide(); if (!UI.open) return; UI.open = null; UI.moveFrom = null; $id('modal').classList.add('hidden'); sfx('close'); RT.invDirty = true; };
const PANEL_TITLE = { chest: '収納', raft: 'いかだ', radio: '古い無線機', altar: '石の祭壇', help: '遊び方', opts: '設定', ach: '実績', credit: 'クレジット' };
function renderModal() {
  tipHide();
  const tabs = $id('m-tabs'), body = $id('m-body'), st = body.scrollTop;
  if (UI.open === 'main') {
    tabs.innerHTML = MTABS.map(([k, n]) => `<button class="tab nav ${UI.tab === k ? 'on' : ''}" data-act="tab" data-t="${k}" data-fk="tab-${k}">${n}</button>`).join('');
    body.innerHTML = ({ bag: tabBag, craft: tabCraft, map: tabMap, goal: tabGoal, journal: tabJournal, sys: tabSys })[UI.tab]();
    if (UI.tab === 'map') { const c = $id('fullmap'); if (c) { c.width = G.map.w * 3; c.height = G.map.h * 3; drawFullMap(c); } }
  } else {
    if (UI.open === 'chest' && UI.chest) tabs.innerHTML = `<div class="ptitle">${UI.chestBag ? '落とし物' : esc(OB[UI.chest.k] ? OB[UI.chest.k].n : '収納')}</div>`;
    else tabs.innerHTML = `<div class="ptitle">${esc(PANEL_TITLE[UI.open] || '')}</div>`;
    body.innerHTML = ({ chest: panelChest, raft: panelRaft, radio: panelRadio, altar: panelAltar, help: panelHelp, opts: () => '<div class="sys">' + optsHTML() + '</div>', ach: panelAch, credit: () => creditHTML() })[UI.open]();
  }
  $id('modal').dataset.kind = UI.open === 'main' ? 'main-' + UI.tab : UI.open;
  body.scrollTop = st;
  $id('m-help').innerHTML = Inp.mode === 'kb' ? '矢印：選択　Space：決定　Esc：閉じる' + (UI.open === 'main' ? '　Q/E：タブ切替' : '') : Inp.mode === 'pad' ? 'A：決定　B：閉じる' + (UI.open === 'main' ? '　LB/RB：タブ切替' : '') : '';
  restoreFocus();
}
function restoreFocus() {
  const root = navRoot(); if (!root) return;
  let e = UI.focusKey ? root.querySelector(`[data-fk="${UI.focusKey}"]`) : null;
  if (!e || e.offsetParent === null) { const els = navEls(root); e = els.find(x => !x.classList.contains('x') && !x.classList.contains('tab')) || els[0]; }
  if (e) navFocus(e, true);
}

// --- bag ---
function itemStats(s) {
  const d = IT[s.id], a = [];
  if (d.eat) { const e = d.eat; if (e.h) a.push('空腹 ' + (e.h > 0 ? '+' : '') + e.h); if (e.w) a.push('水分 ' + (e.w > 0 ? '+' : '') + e.w); if (e.hp) a.push('体力 +' + e.hp); if (e.sta) a.push('スタミナ +' + e.sta); if (e.fed) a.push('満腹効果'); if (e.sick) a.push('腹痛の危険'); if (e.poison) a.push('毒あり'); if (e.cure) a.push(e.cure === 'all' ? '毒・腹痛を治す' : '毒を治す'); }
  if (d.dmg && (d.weapon || d.tool)) a.push('攻撃力 ' + d.dmg);
  if (d.tool && d.tool.pow < 90) a.push('採集力 ' + d.tool.pow);
  if (d.armor) a.push('防御 +' + d.armor.def, '保温 +' + d.armor.warm);
  if (d.light) a.push('明るさ ' + d.light);
  if (d.dur && s.d != null) a.push((d.burn ? '残り ' : '耐久 ') + Math.ceil(s.d) + ' / ' + d.dur);
  if (d.fuel) a.push('燃料 約' + Math.max(1, Math.round(d.fuel / (DAY_LEN / 24))) + '時間');
  if (d.plant) a.push('畑に植えられる');
  return a;
}
function tabBag() {
  const sel = UI.invSel, def = G.armor ? IT[G.armor.id].armor.def : 0; let used = 0; for (let i = 0; i < G.invSize; i++) if (G.inv[i]) used++;
  let h = `<div class="bag"><div class="bag-l"><div class="eqrow">${slotHTML(G.armor, 'data-act="islot" data-i="armor" data-fk="s-armor" data-tip="armor"', 'eq' + (sel === 'armor' ? ' on' : '') + (UI.moveFrom === 'armor' ? ' mv' : ''))}<div class="eqtx"><span>防具</span><small>防御 ${def}</small></div><div class="cap">${used} / ${G.invSize}</div></div><div class="grid">`;
  for (let i = 0; i < 32; i++) {
    if (i >= G.invSize) { h += '<div class="slot lock"></div>'; continue; }
    h += slotHTML(G.inv[i], `data-act="islot" data-i="${i}" data-fk="s-${i}" data-tip="inv:${i}"`, (i < 8 ? 'hb ' : '') + (sel === i ? 'on ' : '') + (UI.moveFrom === i ? 'mv ' : '') + (G.sel === i ? 'held' : ''));
  }
  h += `</div><p class="tip">${UI.moveFrom != null ? '入れ替え先の枠を選んでください' : '上の段（1〜8）がホットバー。緑枠が手に持っている物'}</p></div><div class="bag-r">${itemDetail(sel)}</div></div>`;
  return h;
}
function itemDetail(sel) {
  const s = sel === 'armor' ? G.armor : G.inv[sel];
  if (!s || !IT[s.id]) return '<div class="det empty">アイテムを選ぶと<br>説明が表示されます</div>';
  const d = IT[s.id], st = itemStats(s); let b = '';
  if (sel === 'armor') b += btn('iunequip', 'はずす');
  else {
    if (d.eat || d.upgrade || d.tmap != null) { const e = d.eat; b += btn('iuse', e ? ((e.w || 0) > (e.h || 0) ? '飲む' : e.h ? '食べる' : '使う') : '使う', '', 'pri'); }
    if (d.armor) b += btn('iequip', '装備する', '', 'pri');
    if (G.sel !== sel) b += btn('ihold', '手に持つ');
    b += btn('imove', UI.moveFrom === sel ? '移動をやめる' : '移動');
    if (!d.key) { b += btn('idrop', '1つ捨てる'); if (s.n > 1) b += btn('idropall', 'すべて捨てる'); }
  }
  return `<div class="det"><div class="dh"><img src="${ICONURL[d.ic] || ''}" alt=""><div><h3>${esc(d.n)}${s.n > 1 ? ' ×' + s.n : ''}</h3>${d.key ? '<span class="tag">大切なもの</span>' : ''}</div></div><p>${esc(d.d || '')}</p>${st.length ? '<ul class="st">' + st.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ''}<div class="btns">${b}</div></div>`;
}
function moveSlot(a, b) {
  if (a === b) return;
  if (a === 'armor' || b === 'armor') {
    const i = a === 'armor' ? b : a, s = G.inv[i];
    if (s && !IT[s.id].armor) { toast('防具ではない', 'warn'); return; }
    G.inv[i] = G.armor; G.armor = s || null; invChanged(); sfx('equip'); return;
  }
  const A = G.inv[a], B = G.inv[b];
  if (A && B && A.id === B.id && IT[A.id].st > 1) { const k = Math.min(A.n, IT[A.id].st - B.n); B.n += k; A.n -= k; if (A.n <= 0) G.inv[a] = null; }
  else { G.inv[a] = B; G.inv[b] = A; }
  invChanged(); sfx('tick');
}
// --- craft ---
function tabCraft() {
  const st = stations(), cat = UI.craftCat;
  const badge = (k, n) => `<span class="sb ${st[k] ? 'on' : ''}">${n}</span>`;
  let h = `<div class="craft"><div class="cbar"><div class="stn"><span class="dim">近くの設備</span>${badge('bench', '作業台')}${badge('fire', 'たき火')}${badge('furnace', 'かまど')}</div><div class="cats">` +
    RC_CATS.map(([k, n]) => `<button class="cat nav ${cat === k ? 'on' : ''}" data-act="ccat" data-c="${k}" data-fk="cat-${k}">${n}</button>`).join('') + `</div></div><div class="rlist">`;
  const list = RC.filter(r => cat === 'all' || r.c === cat).map(r => ({ r, can: canCraft(r, st), hs: !!st[r.s] }))
    .sort((a, b) => (b.can - a.can) || (b.hs - a.hs) || (a.r.i - b.r.i));
  for (const { r, can, hs } of list) {
    const d = IT[r.o], mx = can ? maxCraft(r, st) : 0;
    const req = Object.entries(r.r).map(([k, n]) => { const c = cnt(k); return `<span class="rq ${c >= n ? 'ok' : 'ng'}" data-tip="it:${k}"><img src="${ICONURL[IT[k].ic] || ''}" alt=""><em>${esc(IT[k].n)} ${Math.min(c, 999)}/${n}</em></span>`; }).join('') +
      (r.tool ? `<span class="rq ${cnt(r.tool) ? 'ok' : 'ng'}" data-tip="it:${r.tool}"><img src="${ICONURL[IT[r.tool].ic] || ''}" alt=""><em>${esc(IT[r.tool].n)}が必要</em></span>` : '');
    h += `<div class="rc ${can ? 'can' : hs ? 'lack' : 'nost'}"><span class="riw" data-tip="it:${r.o}"><img class="ri" src="${ICONURL[d.ic] || ''}" alt=""></span><div class="rm"><div class="rn">${esc(d.n)}${r.n > 1 ? ' ×' + r.n : ''}<span class="rs s-${r.s}">${STATION_N[r.s]}</span></div><div class="rd">${esc(d.d || '')}</div><div class="rr">${req}</div></div><div class="rb">` +
      `<button class="btn nav ${can ? 'pri' : 'off'}" data-act="craft" data-i="${r.i}" data-n="1" data-fk="cr-${r.i}">作る</button>` + (mx >= 2 ? `<button class="btn sm nav" data-act="craft" data-i="${r.i}" data-n="${Math.min(5, mx)}" data-fk="crm-${r.i}">×${Math.min(5, mx)}</button>` : '') + `</div></div>`;
  }
  if (!list.length) h += '<p class="dim">レシピがありません</p>';
  return h + '</div></div>';
}
// --- map ---
function tabMap() {
  const isl = G.mapId === 'island'; let lg = '';
  if (isl) for (const k in G.pois) { const po = G.pois[k]; if (po.found && !po.hidden) lg += `<li><i style="background:${POI_COL[k] || '#fff'}"></i>${esc(po.n)}</li>`; }
  lg += '<li><i style="background:#fff"></i>現在地</li><li><i style="background:#7cff9a"></i>復活地点</li>';
  if (isl) { lg += '<li><i class="xm"></i>宝のありか</li><li><i style="background:#ffec27"></i>目標地点</li>'; }
  return `<div class="mapw"><div class="mapbox"><canvas id="fullmap"></canvas></div><div class="legend"><h4>${isl ? '島の地図' : '洞窟の地図'}</h4><ul>${lg}</ul><p class="dim">歩いた場所が地図に記されていく。</p></div></div>`;
}
// --- goal ---
function tabGoal() {
  let h = '<div class="goal">';
  if (G.quest < QUESTS.length - 1) {
    const q = QUESTS[G.quest], { it } = qProg(q);
    h += `<section><h3>いまの目標</h3><div class="qbox"><b>${esc(q.t)}</b><p>${esc(q.d)}</p>${q.any ? '<p class="dim">どちらか1つ達成すればOK</p>' : ''}<ul class="qlist">${it.map(([l, c, m]) => qLine(l, c, m)).join('')}</ul></div></section>`;
  }
  h += '<section><h3>脱出ルート</h3>';
  if (G.pages[1]) h += '<div class="routes">' + routes().map(r => { const dn = r.items.filter(x => x[1] >= x[2]).length; return `<div class="route"><div class="rh"><b>${esc(r.n)}</b><small>${dn}/${r.items.length}</small></div><ul class="qlist">${r.items.map(([l, c, m]) => qLine(l, c, m)).join('')}</ul></div>`; }).join('') + '</div>';
  else h += '<p class="dim">島のどこかに、先に漂着した人の手がかりがあるらしい。</p>';
  h += '</section>';
  const tabs = ['tablet_a', 'tablet_b', 'tablet_c'].filter(k => cnt(k)).length + (findAltarN());
  const st = G.stats;
  h += `<section><h3>記録</h3><div class="recs"><div><span>生存日数</span><b>${G.day}日</b></div><div><span>日記のページ</span><b>${pageCount()}/10</b></div><div><span>石版</span><b>${Math.min(3, tabs)}/3</b></div><div><span>宝の発掘</span><b>${st.treasure}</b></div><div><span>作ったアイテム</span><b>${st.craft}</b></div><div><span>倒した動物</span><b>${st.kills}</b></div><div><span>釣った魚</span><b>${st.fish}</b></div><div><span>プレイ時間</span><b>${fmtTime(G.playTime)}</b></div></div></section>`;
  h += '<section><h3>実績</h3>' + achHTML() + '</section></div>';
  return h;
}
function findAltarN() { for (const o of G.maps.island.o) if (o && o.k === 'altar') return o.n || 0; return 0; }
function achHTML() { return `<div class="achs">${ACH.map(([id, n, d]) => `<div class="ach ${ACHV[id] ? 'ok' : ''}"><b>${ACHV[id] ? esc(n) : '？？？'}</b><small>${esc(d)}</small></div>`).join('')}</div><p class="dim center">${Object.keys(ACHV).filter(k => ACH.some(a => a[0] === k)).length} / ${ACH.length}</p>`; }
function panelAch() { return '<div class="goal">' + achHTML() + '</div>'; }
// --- journal ---
function tabJournal() {
  let h = '<div class="jr"><div class="jlist">';
  for (let i = 1; i <= 10; i++) { const has = G.pages[i]; h += `<button class="jp nav ${UI.jSel === i ? 'on' : ''} ${has ? '' : 'nohave'}" data-act="jsel" data-i="${i}" data-fk="jp-${i}">${i}. ${has ? esc(PAGES[i].t) : '？？？'}</button>`; }
  h += '</div><div class="jtext scroll">';
  const pg = G.pages[UI.jSel] && PAGES[UI.jSel];
  h += pg ? `<h3>その${UI.jSel}「${esc(pg.t)}」</h3>` + pg.b.map(x => `<p>${esc(x)}</p>`).join('') : '<p class="dim">まだ見つけていないページ。<br>島のどこかにあるはずだ。</p>';
  return h + `</div></div><p class="dim center">集めたページ ${pageCount()} / 10</p>`;
}
// --- system ---
const OPTDEF = [['view3d', '表示モード（Ctrlキーで切替）', ['2D', '3D']], ['q3d', '3Dの画質', ['低', '中', '高']], ['bgm', 'BGMの音量', 'num'], ['se', '効果音の音量', 'num'], ['swapAB', 'A/Bボタンの入れ替え', 'bool'], ['swapXY', 'X/Yボタンの入れ替え', 'bool'], ['touch', 'タッチボタンの大きさ', ['小', '中', '大']], ['dark', '夜の明るさ', ['ふつう', '明るめ']], ['flicker', '光のゆらぎ', 'bool'], ['minimap', 'ミニマップ', 'bool'], ['dmgNum', 'ダメージ数字', 'bool'], ['shake', '画面のゆれ', 'bool']];
function optsHTML() {
  return '<div class="opts">' + OPTDEF.map(([k, n, ty]) => {
    let c;
    if (ty === 'num') c = `<button class="btn sm nav" data-act="opt" data-k="${k}" data-v="-1" data-fk="o-${k}-m">−</button><span class="ov">${OPT[k]}</span><button class="btn sm nav" data-act="opt" data-k="${k}" data-v="1" data-fk="o-${k}-p">＋</button>`;
    else if (ty === 'bool') c = `<button class="btn tg nav ${OPT[k] ? 'on' : ''}" data-act="opt" data-k="${k}" data-fk="o-${k}">${OPT[k] ? 'ON' : 'OFF'}</button>`;
    else c = `<button class="btn tg nav" data-act="opt" data-k="${k}" data-fk="o-${k}">${ty[OPT[k] | 0]}</button>`;
    return `<div class="orow"><span>${n}</span><div>${c}</div></div>`;
  }).join('') + '<p class="dim">※ Switch系のコントローラーでは、A/BとX/Yの入れ替えをONにするとボタン表記どおりに操作できます。</p></div>';
}
function creditHTML() {
  return `<div class="credit"><h3>DRIFT ISLE ～無人島脱出記～</h3><p>v${VERSION}</p><p><a class="nav ghl" data-fk="gh" href="https://github.com/h1ro223" target="_blank" rel="noopener">made by hiro/ヒロ</a></p><p class="dim">このゲームはオリジナル作品です。<br>グラフィック・BGM・効果音はすべてプログラムで生成しています。<br>フォント：DotGothic16（Google Fonts／SIL Open Font License）</p></div>`;
}
function tabSys() {
  let h = '<div class="sys"><section><h3>セーブ</h3><div class="slots">';
  for (let s = 0; s < 3; s++) { const inf = slotInfo(s); h += `<button class="slotbtn nav" data-act="save" data-s="${s}" data-fk="sv-${s}"><b>スロット${s + 1}${G.slot === s ? '（プレイ中）' : ''}</b><small>${inf ? slotDesc(inf) : '空き'}</small></button>`; }
  h += '</div><p class="dim">眠ると自動でセーブされます。2分ごとにも自動セーブします。</p></section><section><h3>設定</h3>' + optsHTML() + '</section><section class="row">' + btn('help', '遊び方') + btn('totitle', 'タイトルへ戻る') + '</section>' + creditHTML() + '</div>';
  return h;
}
function panelHelp() { return '<div class="help">' + HELP.map(([t, d]) => `<section><h4>${esc(t)}</h4><p>${esc(d)}</p></section>`).join('') + '</div>'; }
// --- panels ---
function panelChest() {
  const o = UI.chest, bag = UI.chestBag;
  let h = `<div class="chest"><div class="grid c">`;
  o.items.forEach((s, i) => h += slotHTML(s, `data-act="ch" data-i="${i}" data-fk="ch-${i}" data-tip="ch:${i}"`));
  h += `</div><div class="row">${btn('takeall', 'すべて取り出す')}${bag ? '' : btn('putall', '素材をしまう')}</div><h4>持ち物</h4><div class="grid">`;
  for (let i = 0; i < G.invSize; i++) h += slotHTML(G.inv[i], `data-act="ci" data-i="${i}" data-fk="ci-${i}" data-tip="inv:${i}"`, i < 8 ? 'hb' : '');
  return h + `</div><p class="tip">選んだアイテムを反対側へ移します${bag ? '' : '。「素材をしまう」はホットバー以外の素材をまとめてしまいます'}</p></div>`;
}
function prow(label, ok, val, act) { return `<div class="prow ${ok ? 'ok' : ''}"><span class="pl">${label}</span><span class="pv">${val}</span>${act || ''}</div>`; }
function panelRaft() {
  const o = UI.panelObj; if (!o) return '';
  const inst = (part, done, have) => done ? '<span class="tag">完了</span>' : `<button class="btn sm nav ${have ? 'pri' : 'off'}" data-act="rinst" data-p="${part}" data-fk="ri-${part}">取り付ける</button>`;
  let h = '<div class="pnl"><p>いかだを完成させ、航海の準備を整えよう。航海中は左右に動いて岩やサメ、大波を避ける。流木の箱を拾うといかだが修理できる。</p><h4>いかだの部品</h4>';
  h += prow('帆', o.sail, o.sail ? '取り付け済み' : '所持 ' + cnt('sail'), inst('sail', o.sail, cnt('sail')));
  h += prow('オール', o.oar >= 2, (o.oar || 0) + ' / 2', inst('oar', o.oar >= 2, cnt('oar')));
  h += prow('方位磁針', o.compass, o.compass ? '取り付け済み' : '所持 ' + cnt('compass'), inst('compass', o.compass, cnt('compass')));
  h += '<h4>航海の食料と水（出航時に使う）</h4>' + prow('干し肉', cnt('jerky') >= 5, Math.min(cnt('jerky'), 99) + ' / 5') + prow('きれいな水', cnt('clean_water') >= 5, Math.min(cnt('clean_water'), 99) + ' / 5');
  return h + `<div class="row">${btn('launch', '出航する', '', raftReady(o) ? 'big pri' : 'big off')}</div></div>`;
}
function panelRadio() {
  const o = UI.panelObj; if (!o) return ''; let h = '<div class="pnl">';
  if (!o.fixed) {
    h += '<p>ケンジが使っていた古い無線機。部品が足りず、ノイズすら出ない。</p><h4>修理に必要なもの</h4>';
    for (const [k, n] of RADIO_NEED) h += prow(`<img src="${ICONURL[IT[k].ic]}" alt="">${esc(IT[k].n)}`, cnt(k) >= n, Math.min(cnt(k), n) + ' / ' + n);
    const can = RADIO_NEED.every(([k, n]) => cnt(k) >= n);
    h += `<div class="row">${btn('rfix', '修理する', '', can ? 'big pri' : 'big off')}</div>`;
  } else if (!G.rescue) h += '<p>無線機は直っている。いつでも救助を呼べる。</p><p class="dim">救助を呼ぶと、翌日の正午にヘリが小屋の前に来る。その夜は嵐になり、オオカミが多く現れるので備えておこう。</p>' + `<div class="row">${btn('rcall', '救助を呼ぶ', '', 'big pri')}</div>`;
  else h += G.rescue.st === 'landed' ? '<p>救助ヘリが到着している！小屋の前へ急ごう。</p>' : `<p>救助を要請済み。<b>${G.rescue.day}日目の正午</b>にヘリが来る。</p>`;
  return h + '</div>';
}
function panelAltar() {
  const o = UI.panelObj; if (!o) return ''; o.has = o.has || {};
  const tb = [['tablet_a', '太陽'], ['tablet_b', '月'], ['tablet_c', '星']];
  let h = '<div class="pnl"><p>石の祭壇に三つのくぼみがある。太陽・月・星の紋様が刻まれている。</p><div class="tabs3">';
  for (const [k, n] of tb) h += `<div class="tb3 ${o.has[k] ? 'ok' : ''}"><img src="${ICONURL[IT[k].ic]}" alt="" class="${o.has[k] || cnt(k) ? '' : 'none'}"><span>${n}の石版</span><small>${o.has[k] ? 'はめこみ済み' : cnt(k) ? '持っている' : '未発見'}</small></div>`;
  const can = tb.some(([k]) => !o.has[k] && cnt(k));
  h += `</div><div class="row">${G.flags.ruinsOpen ? '<p class="okt">扉は開いている。</p>' : btn('aplace', '石版をはめこむ', '', can ? 'big pri' : 'big off')}</div>`;
  if (!G.flags.ruinsOpen) h += '<p class="dim">太陽は山の頂に、月は地の底の番人のもとに、星は古い地図の示す場所に眠る――。</p>';
  return h + '</div>';
}

// ---------- actions ----------
UI.act = (act, ds, t) => {
  const off = t && t.classList.contains('off');
  if (t && t.dataset.fk) UI.focusKey = t.dataset.fk;
  switch (act) {
    case 'close': UI.close(); break;
    case 'tab': UI.tab = ds.t; UI.focusKey = 'tab-' + ds.t; sfx('tick'); renderModal(); break;
    case 'islot': {
      const i = ds.i === 'armor' ? 'armor' : +ds.i;
      if (UI.moveFrom != null && UI.moveFrom !== i) { moveSlot(UI.moveFrom, i); UI.moveFrom = null; UI.invSel = i; }
      else { UI.invSel = i; sfx('tick'); }
      renderModal(); break;
    }
    case 'iuse': consume(UI.invSel); if (UI.open) renderModal(); break;
    case 'iequip': moveSlot(UI.invSel, 'armor'); UI.invSel = 'armor'; renderModal(); break;
    case 'iunequip': { const k = G.inv.findIndex((s, i) => !s && i < G.invSize); if (k < 0) { toast('持ち物がいっぱい', 'warn'); break; } G.inv[k] = G.armor; G.armor = null; UI.invSel = k; invChanged(); sfx('equip'); renderModal(); break; }
    case 'ihold': { if (UI.invSel === 'armor') break; if (UI.invSel < 8) G.sel = UI.invSel; else { moveSlot(UI.invSel, G.sel); UI.invSel = G.sel; } invChanged(); sfx('equip'); renderModal(); break; }
    case 'imove': UI.moveFrom = UI.moveFrom === UI.invSel ? null : UI.invSel; renderModal(); break;
    case 'idrop': case 'idropall': {
      const s = G.inv[UI.invSel]; if (!s || IT[s.id].key) break; const p = G.p, n = act === 'idrop' ? 1 : s.n;
      dropAt(G.map, p.x + DIRV[p.dir].x * 10, p.y + DIRV[p.dir].y * 8, s.id, n, s.d, true);
      s.n -= n; if (s.n <= 0) G.inv[UI.invSel] = null; invChanged(); sfx('place'); renderModal(); break;
    }
    case 'ccat': UI.craftCat = ds.c; sfx('tick'); renderModal(); break;
    case 'craft': {
      const r = RC[+ds.i]; if (!r) break;
      if (off) { const st = stations(); if (!st[r.s]) toast(STATION_N[r.s] + 'のそばで作れる', 'warn'); else if (r.tool && !cnt(r.tool)) toast(IT[r.tool].n + 'が必要', 'warn'); else toast('材料が足りない', 'warn'); sfx('no'); break; }
      doCraft(r, Math.max(1, +ds.n || 1)); renderModal(); break;
    }
    case 'jsel': UI.jSel = +ds.i; sfx('tick'); renderModal(); break;
    case 'save': {
      const s = +ds.s, inf = slotInfo(s);
      const go = () => { if (saveGame(s)) { G.slot = s; } renderModal(); };
      if (inf && s !== G.slot) UI.ask('スロット' + (s + 1) + 'には別のデータがあります。上書きしますか？', ['上書きする', 'やめる'], i => { if (i === 0) go(); });
      else go();
      break;
    }
    case 'opt': {
      const d = OPTDEF.find(x => x[0] === ds.k); if (!d) break; const k = d[0];
      if (k === 'view3d') { toggle3D(); renderModal(); break; }
      if (k === 'q3d') { OPT.q3d = ((OPT.q3d | 0) + 1) % 3; saveOpt(); r3Rebuild(); sfx('tick'); renderModal(); break; }
      if (d[2] === 'num') OPT[k] = clamp((OPT[k] | 0) + (+ds.v), 0, 10); else if (d[2] === 'bool') OPT[k] = !OPT[k]; else OPT[k] = ((OPT[k] | 0) + 1) % d[2].length;
      saveOpt(); applyOpt(); sfx('tick'); renderModal(); break;
    }
    case 'help': UI.openPanel('help'); break;
    case 'totitle': UI.ask('タイトルに戻りますか？', ['セーブして戻る', 'セーブせずに戻る', 'やめる'], i => { if (i === 0) saveGame(G.slot, true); if (i <= 1) { UI.close(); UI.title(); } }); break;
    case 'ch': {
      const o = UI.chest, i = +ds.i, it = o.items[i]; if (!it) break;
      const left = invAdd(it.id, it.n, it.d);
      if (left === it.n) { toast('持ち物がいっぱい', 'warn'); sfx('no'); break; }
      if (left > 0) it.n = left; else o.items[i] = null; sfx('pick'); afterChest(); break;
    }
    case 'ci': {
      const o = UI.chest, i = +ds.i, s = G.inv[i]; if (!s) break;
      if (UI.chestBag) { toast('ここには入れられない', 'warn'); break; }
      if (IT[s.id].key) { toast('大切なものはしまえない', 'warn'); break; }
      if (!putChest(o, s)) { toast('箱がいっぱい', 'warn'); sfx('no'); break; }
      if (s.n <= 0) G.inv[i] = null; invChanged(); sfx('pick'); renderModal(); break;
    }
    case 'takeall': { const o = UI.chest; let any = false; o.items.forEach((it, i) => { if (!it) return; const left = invAdd(it.id, it.n, it.d); if (left < it.n) any = true; if (left > 0) it.n = left; else o.items[i] = null; }); if (any) sfx('pick'); else toast('持ち物がいっぱい', 'warn'); afterChest(); break; }
    case 'putall': { const o = UI.chest; for (let i = 8; i < G.invSize; i++) { const s = G.inv[i]; if (!s || IT[s.id].key || IT[s.id].dur || IT[s.id].place || IT[s.id].eat) continue; putChest(o, s); if (s.n <= 0) G.inv[i] = null; } invChanged(); sfx('pick'); renderModal(); break; }
    case 'rinst': if (!off && raftInstall(UI.panelObj, ds.p)) renderModal(); else sfx('no'); break;
    case 'launch': {
      const o = UI.panelObj; if (off) { toast(raftParts(o) ? '干し肉ときれいな水を5つずつ用意しよう' : 'いかだの部品がそろっていない', 'warn'); sfx('no'); break; }
      UI.ask('島を離れて出航しますか？\n（出航前の状態を自動でセーブします）', ['出航する', 'まだ準備する'], i => { if (i === 0) { UI.close(); launchRaft(o); } }); break;
    }
    case 'rfix': if (off) { toast('部品が足りない', 'warn'); sfx('no'); break; } repairRadio(UI.panelObj); renderModal(); break;
    case 'rcall': UI.close(); callRescue(); break;
    case 'aplace': if (off) { toast('はめこめる石版を持っていない', 'warn'); sfx('no'); break; } altarPlace(UI.panelObj); renderModal(); break;
    case 'choice': { const d = UI.dlg; if (!d) break; const i = +ds.i; sfx('ok'); nextDlg(); if (d.cb) d.cb(i); break; }
    // title
    case 'tmain': renderTitle('main'); sfx('tick'); break;
    case 'tcont': renderTitle('load'); sfx('tick'); break;
    case 'tnew': renderTitle('new'); sfx('tick'); break;
    case 'tload': { if (off) { sfx('no'); break; } const s = +ds.s; RT.lock = true; notice('読み込み中…'); setTimeout(() => { const ok = loadGame(s); RT.lock = false; if (ok) enterGame(false); else toast('データの読み込みに失敗しました', 'bad'); }, 40); break; }
    case 'tdel': { const s = +ds.s; UI.ask('スロット' + (s + 1) + 'のデータを削除しますか？\n（元に戻せません）', ['削除する', 'やめる'], i => { if (i === 0) { try { localStorage.removeItem(SAVE_KEY + s); } catch (e) { } renderTitle([0, 1, 2].some(x => slotInfo(x)) ? 'load' : 'main'); } }); break; }
    case 'tnewslot': { const s = +ds.s; UI.titleSlot = s; if (slotInfo(s)) UI.ask('スロット' + (s + 1) + 'のデータを上書きして、新しく始めますか？', ['上書きする', 'やめる'], i => { if (i === 0) renderTitle('diff'); }); else renderTitle('diff'); sfx('tick'); break; }
    case 'tdiff': { const inp = $id('seed-in'), sv = ((inp && inp.value) || '').replace(/\D/g, '').slice(0, 9); const seed = sv ? (+sv >>> 0) : ((Math.random() * 1e9) >>> 0); startNew(UI.titleSlot, +ds.d, seed); break; }
    case 'thelp': UI.openPanel('help'); break;
    case 'topts': UI.openPanel('opts'); break;
    case 'tach': UI.openPanel('ach'); break;
    case 'tcredit': UI.openPanel('credit'); break;
    case 'respawn': sfx('ok'); respawn(); break;
    case 'dtitle': UI.ask('タイトルに戻りますか？（最後のセーブから再開できます）', ['戻る', 'やめる'], i => { if (i === 0) { UI.hideDeath(); UI.title(); } }); break;
    case 'etitle': $id('ending').classList.add('hidden'); UI.title(); break;
  }
};
function putChest(o, s) {
  const st = IT[s.id].st;
  if (st > 1) for (const it of o.items) if (it && it.id === s.id && it.n < st) { const k = Math.min(s.n, st - it.n); it.n += k; s.n -= k; if (s.n <= 0) return true; }
  const j = o.items.findIndex(x => !x); if (j < 0) return false;
  o.items[j] = { id: s.id, n: s.n }; if (s.d != null) o.items[j].d = s.d; s.n = 0; return true;
}
function afterChest() {
  invChanged(); const o = UI.chest;
  if (UI.chestBag && !o.items.some(Boolean)) { delO(G.map, o.x, o.y); UI.close(); toast('落とし物をすべて回収した', 'good'); return; }
  renderModal();
}

// ---------- dialog ----------
UI.say = (lines, cb) => {
  lines.forEach((l, i) => { const d = typeof l === 'string' ? { text: l } : Object.assign({}, l); if (i === lines.length - 1 && cb) d.cb = cb; UI.dq.push(d); });
  if (!UI.dlg) nextDlg();
};
UI.ask = (text, opts, cb) => { UI.dq.push({ text, choices: opts, cb }); if (!UI.dlg) nextDlg(); };
function nextDlg() {
  const d = UI.dq.shift(), box = $id('dialog');
  if (!d) { UI.dlg = null; box.classList.add('hidden'); restoreFocus(); return; }
  UI.dlg = d; d.shown = d.book ? d.text.length : 0; d.chShown = 0;
  box.classList.remove('hidden'); box.classList.toggle('book', !!d.book); box.classList.toggle('ask', !!d.choices);
  const nm = $id('d-name'); nm.textContent = d.name || ''; nm.style.display = d.name ? '' : 'none';
  $id('d-choices').innerHTML = ''; $id('d-text').scrollTop = 0; renderDlgText(); if (dlgDone()) showChoices();
}
function renderDlgText() { const d = UI.dlg; $id('d-text').textContent = d.text.slice(0, Math.floor(d.shown)); }
const dlgDone = () => UI.dlg && UI.dlg.shown >= UI.dlg.text.length;
function showChoices() {
  const d = UI.dlg; if (!d || !d.choices || d.chShown) return; d.chShown = 1;
  $id('d-choices').innerHTML = d.choices.map((c, i) => `<button class="btn nav ${i === 0 ? 'pri' : ''}" data-act="choice" data-i="${i}" data-fk="dc-${i}">${esc(c)}</button>`).join('');
  UI.focusKey = 'dc-0'; navFocus($id('d-choices').querySelector('.nav'), true);
}
UI.dlgA = () => {
  const d = UI.dlg; if (!d) return;
  if (!dlgDone()) { d.shown = d.text.length; renderDlgText(); showChoices(); return; }
  if (d.choices) { navClick(); return; }
  const cb = d.cb; sfx('tick'); nextDlg(); if (cb) cb();
};

// ---------- title / game flow ----------
UI.title = () => {
  RT.screen = 'title'; G = null; RT.voy = null; tipHide();
  document.body.classList.remove('ingame');
  for (const id of ['hud', 'death', 'ending', 'voyhud', 'modal']) $id(id).classList.add('hidden');
  UI.open = null; UI.dq = []; UI.dlg = null; $id('dialog').classList.add('hidden'); RT.boss = null; UI.bossBar(null);
  clearTimeout(UI.endT); UI.endBusy = false;
  $id('title').classList.remove('hidden'); renderTitle('main'); playBgm('title');
};
const tbtn = (act, label, sub) => `<button class="tbtn nav" data-act="${act}" data-fk="t-${act}"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
function renderTitle(st) {
  UI.titleSt = st; const box = $id('title-menu'), any = [0, 1, 2].some(s => slotInfo(s)); let h = '';
  if (st === 'main') h = (any ? tbtn('tcont', 'つづきから') : '') + tbtn('tnew', 'はじめから') + '<div class="tsub">' + tbtn('thelp', '遊び方') + tbtn('topts', '設定') + tbtn('tach', '実績') + tbtn('tcredit', 'クレジット') + '</div>';
  else if (st === 'load' || st === 'new') {
    h = `<p class="tm-h">${st === 'load' ? 'つづきから遊ぶデータを選んでください' : '新しい冒険を記録するスロットを選んでください'}</p>`;
    for (let s = 0; s < 3; s++) {
      const inf = slotInfo(s);
      h += `<div class="tslot"><button class="tbtn nav ${st === 'load' && !inf ? 'off' : ''}" data-act="${st === 'load' ? 'tload' : 'tnewslot'}" data-s="${s}" data-fk="ts-${s}"><b>スロット${s + 1}</b><small>${inf ? slotDesc(inf) : '空き'}</small></button>${inf && st === 'load' ? `<button class="tdel nav" data-act="tdel" data-s="${s}" data-fk="td-${s}">削除</button>` : ''}</div>`;
    }
    h += tbtn('tmain', '戻る');
  } else if (st === 'diff') {
    h = '<p class="tm-h">難易度を選んでください</p>' + DIFF.map((d, i) => `<button class="tbtn nav" data-act="tdiff" data-d="${i}" data-fk="tdf-${i}"><b>${d.n}</b><small>${d.d}</small></button>`).join('') +
      `<label class="seed"><span>島のシード（空欄でランダム）</span><input id="seed-in" inputmode="numeric" pattern="[0-9]*" maxlength="9" placeholder="例：12345" autocomplete="off"></label>` + tbtn('tnew', '戻る');
  }
  box.innerHTML = h; UI.focusKey = null; restoreFocus();
}
function startNew(slot, diff, seed) {
  RT.lock = true; notice('島を生成しています…');
  setTimeout(() => {
    try { newGame(seed, diff, slot); RT.lock = false; enterGame(true); saveGame(slot, true); }
    catch (e) { console.error(e); RT.lock = false; toast('島の生成に失敗しました。もう一度お試しください', 'bad'); }
  }, 60);
}
function enterGame(isNew) {
  RT.screen = 'game'; document.body.classList.add('ingame');
  $id('title').classList.add('hidden'); $id('hud').classList.remove('hidden'); UI.hideDeath(); $id('ending').classList.add('hidden');
  UI.open = null; $id('modal').classList.add('hidden');
  UI.last = {}; RT.invDirty = true; RT.questDirty = true; UI.invSel = G.sel;
  updateMusic(true);
  if (isNew) UI.say(['……波の音で目を覚ました。', '乗っていた客船は、嵐で沈んでしまったらしい。', 'ここは、どこかの島の砂浜のようだ。', 'まずは辺りに流れ着いた木箱を調べてみよう。'], () => {
    toast(Inp.mode === 'kb' ? '移動：WASD　調べる：Space　ダッシュ：Shift　バッグ：Bキー　クラフト：C' : Inp.mode === 'pad' ? '移動：左スティック　調べる：A　ダッシュ：B　バッグ：X　クラフト：Y' : '左側をなぞって移動、Ⓐで調べる・使う', '');
  });
  else notice(G.day + '日目');
  if (!OPT.hint3d && R3 && typeof THREE !== 'undefined') { OPT.hint3d = 1; saveOpt(); setTimeout(() => { if (RT.screen === 'game') toast(Inp.mode === 'touch' ? '右上の「3D」ボタンで3D表示に切り替えられます' : 'Ctrlキーで3D表示に切り替えられます（設定からも変更可）', 'good'); }, 7000); }
}
UI.showDeath = () => {
  $id('death-msg').textContent = DIFF[G.diff].keep ? '持ち物はそのまま残っている。' : RT.lostItems ? '持ち物は倒れた場所に落としてしまった。目を覚ましたら回収しに行こう。' : '';
  $id('death').classList.remove('hidden'); UI.focusKey = 'respawn'; restoreFocus();
};
UI.hideDeath = () => $id('death').classList.add('hidden');
UI.showEnding = (key, tr) => {
  const E = ENDINGS[key], box = $id('ending'), body = $id('end-body');
  UI.close(); $id('hud').classList.add('hidden'); $id('voyhud').classList.add('hidden'); document.body.classList.remove('ingame');
  box.classList.remove('hidden'); body.innerHTML = `<h2>${esc(E.t)}</h2>`;
  const lines = E.b.slice(); if (tr) lines.push('', '― ' + ENDINGS.TRUE.t + ' ―', ...ENDINGS.TRUE.b);
  let i = 0; UI.endBusy = true;
  const finish = () => {
    UI.endBusy = false; const st = G.stats, pages = pageCount();
    let sc = G.day <= 8 ? 3 : G.day <= 14 ? 2 : G.day <= 22 ? 1 : 0; if (pages >= 10) sc++; if (G.diff === 2) sc++; if (key === 'C') sc++;
    const rank = sc >= 5 ? 'S' : sc >= 4 ? 'A' : sc >= 2 ? 'B' : 'C';
    const card = el('div', 'eend', `<div class="estats"><div><span>脱出までの日数</span><b>${G.day}日</b></div><div><span>プレイ時間</span><b>${fmtTime(G.playTime)}</b></div><div><span>作ったアイテム</span><b>${st.craft}</b></div><div><span>倒した動物</span><b>${st.kills}</b></div><div><span>日記のページ</span><b>${pages}/10</b></div><div><span>難易度</span><b>${DIFF[G.diff].n}</b></div></div><div class="rank">RANK <b>${rank}</b></div>` +
      (key === 'C' && !tr ? '<p class="dim">日記を10ページすべて集めて無線で脱出すると、もうひとつの物語が見られる。</p>' : '') +
      `<p class="dim">ほかのエンディングも目指してみよう。セーブデータから脱出直前の島に戻れます。</p><button class="tbtn nav" data-act="etitle" data-fk="etitle"><b>タイトルへ</b></button><p class="ecr"><a href="https://github.com/h1ro223" target="_blank" rel="noopener">made by hiro/ヒロ</a></p>`);
    body.appendChild(card); UI.focusKey = 'etitle'; restoreFocus(); card.scrollIntoView({ block: 'nearest' });
  };
  const add = () => {
    if (i < lines.length) { const p = el('p', 'el', lines[i] ? esc(lines[i]) : '&nbsp;'); body.appendChild(p); p.scrollIntoView({ block: 'nearest' }); i++; UI.endT = setTimeout(add, lines[i - 1] ? 1900 : 700); }
    else finish();
  };
  UI.endSkip = () => { clearTimeout(UI.endT); while (i < lines.length) { body.appendChild(el('p', 'el', lines[i] ? esc(lines[i]) : '&nbsp;')); i++; } finish(); };
  UI.endT = setTimeout(add, 900);
};
UI.endSkip = () => { };
UI.voyage = on => { $id('voyhud').classList.toggle('hidden', !on); $id('hud').classList.toggle('hidden', !!on); };
function voyHud() {
  const V = RT.voy; $id('voy-prog').querySelector('i').style.width = (V.d * 100) + '%'; $id('voy-hp').querySelector('i').style.width = Math.max(0, V.hp) + '%';
  const msg = V.done ? (V.res === 'win' ? '陸地が見えた！' : 'いかだが壊れてしまった…') : (V.d > .4 && V.d < .72 ? '嵐の海域だ！' : V.t < 4 ? '左右に動いて障害物を避けよう' : '');
  setHTML('voy-msg', msg);
}
UI.fade = (cb, hold) => {
  RT.lock = true; const f = $id('fade'); f.classList.add('on');
  setTimeout(() => { try { if (cb) cb(); } catch (e) { console.error(e); } setTimeout(() => { f.classList.remove('on'); RT.lock = false; }, hold || 160); }, 380);
};
UI.update = dt => {
  if (tipT > 0) { tipT -= dt; if (tipT <= 0) tipHide(); }
  if (UI.dlg && !dlgDone()) { UI.dlg.shown += dt * 46; renderDlgText(); if (dlgDone()) showChoices(); }
  const nx = $id('d-next'); if (nx) nx.style.visibility = UI.dlg && dlgDone() && !UI.dlg.choices ? 'visible' : 'hidden';
  if (RT.screen === 'game' && G) { if (G.mode === 'voyage' && RT.voy) voyHud(); else if (G.mode === 'play' || G.mode === 'dead') hudUpdate(dt); }
};

// =====================================================================
//  3D VIEW（Three.js r149）
//  見た目だけを3Dにする。移動・当たり判定・ルールは2Dと共通
// =====================================================================
const CH3 = 12;
const R3 = {
  ok: false, tried: false, failed: false, gen: 1, q: 1, cvs: null, ren: null, scene: null, cam: null, hemi: null, sun: null, pls: [], mats: null,
  types: {}, tex: {}, u: null, list: [], cur: null, pl: null, ents: new Map(), drops: new Map(), projs: new Map(), dyn: null,
  pitch: 84, pitchT: 52, leaving: false, cx: 0, cy: 0, cz: 0, camInit: false, last: 0, perf: [], perfT: 0, downT: 0, iconMats: {}, tele: [], voy: null, noAuto: false
};
const r3On = () => !!(OPT.view3d && R3.ok && !R3.failed);
function h2(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
let TN3 = null;

// ---------- 初期化 ----------
function r3Init() {
  if (R3.tried) return R3.ok; R3.tried = true;
  if (typeof THREE === 'undefined') return (R3.ok = false);
  try {
    THREE.ColorManagement.legacyMode = false;
    if (!TN3) TN3 = makeNoise(mulberry32(31337));
    const c = document.createElement('canvas'); c.id = 'game3d'; $id('app').insertBefore(c, $id('game')); R3.cvs = c;
    R3.q = OPT.q3d | 0;
    const ren = new THREE.WebGLRenderer({ canvas: c, antialias: R3.q >= 2, powerPreference: 'high-performance' });
    if (!ren.getContext()) throw new Error('no webgl');
    ren.outputEncoding = THREE.sRGBEncoding; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.05;
    ren.shadowMap.enabled = R3.q >= 1; ren.shadowMap.type = THREE.PCFSoftShadowMap;
    R3.ren = ren;
    c.addEventListener('webglcontextlost', e => { e.preventDefault(); if (!R3.tearing) r3Fail('3D表示が停止したため、2D表示に戻しました'); });
    R3.scene = new THREE.Scene(); R3.scene.fog = new THREE.Fog(0x9fd0f0, 20, 60); R3.scene.background = new THREE.Color(0x9fd0f0);
    R3.cam = new THREE.PerspectiveCamera(38, 1, .3, 240);
    R3.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x4a5a3a, .6); R3.scene.add(R3.hemi);
    const sun = new THREE.DirectionalLight(0xfff2dd, 2); sun.castShadow = R3.q >= 1;
    const ms = R3.q >= 2 ? 2048 : 1024; sun.shadow.mapSize.set(ms, ms); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
    R3.scene.add(sun); R3.scene.add(sun.target); R3.sun = sun;
    const np = [2, 4, 6][R3.q];
    for (let i = 0; i < np; i++) { const l = new THREE.PointLight(0xff8a3a, 0, 7, 2); R3.scene.add(l); R3.pls.push(l); }
    R3.u = { uTime: { value: 0 }, uPS: { value: new THREE.Vector2(-9999, -9999) }, uPD: { value: 0 }, uPR: { value: 0 }, uSee: { value: 0 } };
    r3Tex(); r3Mats();
    R3.dyn = new THREE.Group(); R3.scene.add(R3.dyn);
    // パーティクル
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3)); pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
    R3.parts = new THREE.Points(pg, new THREE.PointsMaterial({ size: .13, vertexColors: true, transparent: true, opacity: .95, depthWrite: false, map: R3.tex.dot, alphaTest: .05 }));
    R3.parts.frustumCulled = false; R3.dyn.add(R3.parts);
    // 雨
    const nr = [140, 300, 560][R3.q], rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nr * 6), 3));
    R3.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xc8d8ff, transparent: true, opacity: .5, depthWrite: false })); R3.rain.frustumCulled = false; R3.rain.userData.n = nr;
    R3.rainP = new Float32Array(nr * 3); for (let i = 0; i < nr; i++) { R3.rainP[i * 3] = rand(-16, 16); R3.rainP[i * 3 + 1] = rand(0, 14); R3.rainP[i * 3 + 2] = rand(-16, 16); }
    R3.dyn.add(R3.rain);
    // 対象マーカー
    const mk = new THREE.Group(), mm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, depthWrite: false });
    for (const [x, z, r] of [[-.5, -.5, 0], [.5, -.5, Math.PI / 2], [.5, .5, Math.PI], [-.5, .5, -Math.PI / 2]]) {
      const c2 = new THREE.Group(); c2.position.set(x, 0, z); c2.rotation.y = -r;
      const a = new THREE.Mesh(new THREE.BoxGeometry(.24, .03, .05), mm); a.position.set(.12, 0, .025); const b = new THREE.Mesh(new THREE.BoxGeometry(.05, .03, .24), mm); b.position.set(.025, 0, .12);
      c2.add(a, b); mk.add(c2);
    }
    mk.userData.mat = mm; R3.marker = mk; R3.dyn.add(mk);
    R3.ok = true;
    r3Resize();
  } catch (e) { console.error(e); R3.ok = false; try { if (R3.cvs) R3.cvs.remove(); } catch (_) { } }
  return R3.ok;
}
function r3Fail(msg) { R3.failed = true; OPT.view3d = false; saveOpt(); if (R3.cvs) R3.cvs.style.display = 'none'; if (msg) toast(msg, 'warn'); r3BtnLabel(); }
function r3Resize() {
  if (!R3.ok) return; const q = R3.q, dpr = window.devicePixelRatio || 1;
  const pr = q === 0 ? Math.min(dpr, 1) * .62 : q === 1 ? Math.min(dpr, 1.25) : Math.min(dpr, 2);
  R3.ren.setPixelRatio(pr); R3.ren.setSize(window.innerWidth, window.innerHeight, false);
  R3.cvs.style.width = window.innerWidth + 'px'; R3.cvs.style.height = window.innerHeight + 'px';
  R3.cam.aspect = window.innerWidth / Math.max(1, window.innerHeight); R3.cam.updateProjectionMatrix();
}
function r3Teardown() {
  for (const M3 of R3.list.slice()) r3DisposeMap(M3);
  R3.list = []; R3.types = {}; R3.ents.clear(); R3.drops.clear(); R3.projs.clear(); R3.pl = null; R3.voy = null; R3.iconMats = {}; R3.tele = [];
  R3.tearing = true; try { R3.ren.dispose(); R3.ren.forceContextLoss(); } catch (e) { } R3.tearing = false;
  if (R3.cvs) R3.cvs.remove();
  R3.ok = false; R3.tried = false; R3.pls = []; R3.gen++; R3.camInit = false;
}
function r3Rebuild() { if (!R3.tried) return; const on = R3.ok; r3Teardown(); if (on || OPT.view3d) r3Init(); }
function r3Reset() { // 新しいゲーム・ロード時：旧マップの3Dデータを破棄
  if (!R3.ok) return;
  for (const M3 of R3.list.slice()) if (!DEMO.m || M3.m !== DEMO.m) r3DisposeMap(M3);
  for (const [, v] of R3.ents) R3.dyn.remove(v.g); R3.ents.clear();
  for (const [, v] of R3.drops) R3.dyn.remove(v); R3.drops.clear();
  for (const [, v] of R3.projs) R3.dyn.remove(v); R3.projs.clear();
  R3.camInit = false;
}

// ---------- テクスチャ・マテリアル ----------
function r3Tex() {
  const T3x = R3.tex;
  { // 地面の粒状テクスチャ
    const c = mkC(256, 256), x = cx2(c), r = mulberry32(99);
    x.fillStyle = '#e4e4e4'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { const v = 150 + Math.floor(r() * 105); x.fillStyle = `rgba(${v},${v},${v},.55)`; const s = r() < .8 ? 1 : 2; x.fillRect(Math.floor(r() * 256), Math.floor(r() * 256), s, s); }
    for (let i = 0; i < 40; i++) { const v = 200 + Math.floor(r() * 40); x.fillStyle = `rgba(${v},${v},${v},.25)`; x.beginPath(); x.arc(r() * 256, r() * 256, 6 + r() * 18, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; T3x.grain = t;
  }
  const radial = (stops, size) => { const c = mkC(size, size), x = cx2(c), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); for (const [o, col] of stops) g.addColorStop(o, col); x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
  T3x.flame = (() => { const c = mkC(64, 128), x = cx2(c); const g = x.createRadialGradient(32, 92, 2, 32, 80, 60); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(.25, 'rgba(255,200,80,.95)'); g.addColorStop(.55, 'rgba(255,110,30,.6)'); g.addColorStop(1, 'rgba(255,60,0,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(32, 0); x.quadraticCurveTo(64, 70, 50, 110); x.quadraticCurveTo(32, 128, 14, 110); x.quadraticCurveTo(0, 70, 32, 0); x.fill(); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
  T3x.glow = radial([[0, 'rgba(255,255,255,1)'], [.3, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']], 64);
  T3x.dot = radial([[0, 'rgba(255,255,255,1)'], [.55, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']], 16);
  T3x.shadow = radial([[0, 'rgba(0,0,0,.55)'], [.6, 'rgba(0,0,0,.3)'], [1, 'rgba(0,0,0,0)']], 32);
}
function r3Mats() {
  const M = {}, U = R3.u;
  const SEE = `#include <clipping_planes_fragment>
  if (uSee > .5) { vec2 dd = gl_FragCoord.xy - uPS; float r2 = dot(dd, dd); if (r2 < uPR * uPR && gl_FragCoord.z < uPD) { if (r2 < uPR * uPR * .3 || mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < .5) discard; } }`;
  const see = (mat, wind) => {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uPS = U.uPS; sh.uniforms.uPD = U.uPD; sh.uniforms.uPR = U.uPR; sh.uniforms.uSee = U.uSee; sh.uniforms.uTime = U.uTime;
      sh.fragmentShader = 'uniform vec2 uPS; uniform float uPD; uniform float uPR; uniform float uSee;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', SEE);
      if (wind) sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#else
  vec3 ip = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
#endif
  float sw = max(0.0, position.y - .45);
  transformed.x += sin(uTime * 1.6 + ip.x * .7 + ip.z * .4) * sw * .035;
  transformed.z += cos(uTime * 1.3 + ip.z * .6 + ip.x * .2) * sw * .025;`);
    };
    mat.customProgramCacheKey = () => wind ? 'see-wind' : 'see';
  };
  M.std = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0 }); see(M.std, false);
  M.leaf = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0, side: THREE.DoubleSide }); see(M.leaf, true);
  M.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .38, metalness: .65 }); see(M.metal, false);
  M.plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86 });
  M.crystal = new THREE.MeshStandardMaterial({ color: 0xc48ef0, emissive: 0x7a3fd0, emissiveIntensity: .95, roughness: .15, metalness: .1, transparent: true, opacity: .88 });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x9fe0f4, roughness: .05, metalness: .2, transparent: true, opacity: .55 });
  M.emis = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  M.dark = new THREE.MeshBasicMaterial({ color: 0x040306 });
  M.water = new THREE.MeshStandardMaterial({ color: 0x5fb0d6, transparent: true, opacity: .78, roughness: .08, metalness: .1 });
  M.ghostOk = new THREE.MeshBasicMaterial({ color: 0x7cff9a, transparent: true, opacity: .42, depthWrite: false });
  M.ghostNg = new THREE.MeshBasicMaterial({ color: 0xff5060, transparent: true, opacity: .42, depthWrite: false });
  M.shadow = new THREE.MeshBasicMaterial({ map: R3.tex.shadow, transparent: true, depthWrite: false });
  M.tele = new THREE.MeshBasicMaterial({ color: 0xff2840, transparent: true, opacity: .35, depthWrite: false });
  M.line = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 });
  const spr = (tex, col, add) => new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  M.flame = spr(R3.tex.flame, 0xffffff, true); M.flame2 = spr(R3.tex.flame, 0xffe0a0, true);
  M.glowW = spr(R3.tex.glow, 0xfff4d0, true); M.glowG = spr(R3.tex.glow, 0xffd24a, true); M.glowP = spr(R3.tex.glow, 0xc48ef0, true); M.glowB = spr(R3.tex.glow, 0x9fe0f4, true);
  M.smoke = spr(R3.tex.glow, 0xbfbfbf, false);
  M.terrain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0, map: R3.tex.grain, bumpMap: R3.tex.grain, bumpScale: .035 });
  R3.mats = M;
}
function entMat() { return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }); }

// ---------- ジオメトリ組み立て ----------
function M4(x, y, z, rx, ry, rz, sx, sy, sz) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
  const S = sx == null ? 1 : sx; m.compose(new THREE.Vector3(x || 0, y || 0, z || 0), q, new THREE.Vector3(S, sy == null ? S : sy, sz == null ? S : sz)); return m;
}
class GB {
  constructor(seed) { this.p = []; this.r = mulberry32(seed || 1); }
  add(g, col, m, jit) {
    const q = g.index ? g.toNonIndexed() : g.clone(); g.dispose();
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    if (!q.attributes.normal) q.computeVertexNormals();
    if (m) q.applyMatrix4(m);
    const n = q.attributes.position.count, c = new Float32Array(n * 3), b = new THREE.Color(col), j = jit == null ? .07 : jit;
    for (let i = 0; i < n; i += 3) { const k = 1 + (this.r() - .5) * 2 * j; for (let t = 0; t < 3 && i + t < n; t++) { c[(i + t) * 3] = b.r * k; c[(i + t) * 3 + 1] = b.g * k; c[(i + t) * 3 + 2] = b.b * k; } }
    q.setAttribute('color', new THREE.BufferAttribute(c, 3)); this.p.push(q); return this;
  }
  geo() {
    let n = 0; for (const q of this.p) n += q.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
    for (const q of this.p) { P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); C.set(q.attributes.color.array, o * 3); o += q.attributes.position.count; q.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.computeBoundingSphere(); this.p = []; return g;
  }
}
const gBox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const gCyl = (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s || 7);
const gCone = (r, h, s) => new THREE.ConeGeometry(r, h, s || 6);
const gSph = (r, ws, hs) => new THREE.SphereGeometry(r, ws || 8, hs || 6);
function blob(r, det, amp, seed, smooth) {
  const g = new THREE.IcosahedronGeometry(r, det), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = 1 + amp * (Math.sin(v.x * 7.1 / r + seed) * Math.sin(v.y * 6.3 / r + seed * 1.7) * Math.sin(v.z * 5.7 / r + seed * .3) + .5 * Math.sin((v.x * 13 + v.z * 11) / r + seed));
    v.multiplyScalar(d); p.setXYZ(i, v.x, v.y, v.z);
  }
  if (smooth) { const nn = g.attributes.normal; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); nn.setXYZ(i, v.x, v.y, v.z); } }
  else g.computeVertexNormals();
  return g;
}
function gFrond(len, wid, droop, segs, rise) {
  const P = [], pt = t => [t * len, (rise == null ? .18 : rise) * t * len - droop * t * t * len, 0];
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs, w0 = wid * Math.sin(Math.PI * (t0 * .9 + .1)) * .5, w1 = wid * Math.sin(Math.PI * Math.min(1, t1 * .9 + .1)) * .5;
    const a = pt(t0), b = pt(t1);
    const A1 = [a[0], a[1] - w0 * .3, -w0], A2 = [a[0], a[1], 0], A3 = [a[0], a[1] - w0 * .3, w0], B1 = [b[0], b[1] - w1 * .3, -w1], B2 = [b[0], b[1], 0], B3 = [b[0], b[1] - w1 * .3, w1];
    P.push(...A1, ...B1, ...B2, ...A1, ...B2, ...A2, ...A2, ...B2, ...B3, ...A2, ...B3, ...A3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
function mkTreeGB(seed, det) {
  const b = new GB(seed), r = b.r;
  b.add(gCyl(.08, .16, 1.5, 7), '#5b4030', M4(0, .75, 0));
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + r(); b.add(gCone(.07, .42, 5), '#4e3727', M4(Math.cos(a) * .13, .12, Math.sin(a) * .13, Math.sin(a) * .9, 0, -Math.cos(a) * .9)); }
  b.add(gCyl(.03, .05, .7, 5), '#5b4030', M4(.2, 1.4, 0, 0, 0, -.9)); b.add(gCyl(.03, .05, .6, 5), '#5b4030', M4(-.18, 1.5, .05, .2, 0, .9));
  const greens = ['#2c5524', '#386a2b', '#447a32', '#52893a', '#3e7030'];
  for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = i === 0 ? 0 : .32 + r() * .32, rr = (i === 0 ? .72 : .5) + r() * .22; b.add(blob(rr, det, .14, seed + i * 3.7, true), greens[(i + seed) % 5], M4(Math.cos(a) * d, 1.9 + (i === 0 ? .25 : r() * .5), Math.sin(a) * d, 0, r() * 3, 0, 1, .8, 1), .1); }
  return b;
}
function mkPalmGB(seed, bend) {
  const b = new GB(seed), r = b.r, segs = 9, H = 2.35;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs, x0 = bend * t0 * t0, x1 = bend * t1 * t1, y0 = t0 * H, y1 = t1 * H, len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(x1 - x0, y1 - y0);
    b.add(gCyl(.085 - t1 * .025, .1 - t0 * .025, len * 1.06, 7), i % 2 ? '#8a6a48' : '#76593b', M4((x0 + x1) / 2, (y0 + y1) / 2, 0, 0, 0, -ang));
  }
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28 + r() * .3; b.add(gFrond(1.25 + r() * .3, .42, .55 + r() * .25, 7), k % 2 ? '#4f8a36' : '#43782e', M4(bend, H, 0, 0, a, 0), .08); }
  b.add(gSph(.13, 6, 5), '#5a4a2a', M4(bend, H - .05, 0));
  return b;
}
function rockGB(seed, det, r0, col, spk, spkCol) {
  const b = new GB(seed), r = b.r;
  b.add(blob(r0, det, .26, seed, false), col, M4(0, r0 * .45, 0, 0, r() * 3, 0, 1, .62, 1), .1);
  b.add(blob(r0 * .5, det, .3, seed + 5, false), col, M4(r0 * .55, r0 * .25, r0 * .2, 0, 0, 0, 1, .7, 1), .1);
  for (let i = 0; i < (spk || 0); i++) { const a = r() * 6.28, h = r0 * (.25 + r() * .5); b.add(blob(.05 + r() * .04, 0, .2, i, false), spkCol, M4(Math.cos(a) * r0 * .85, h, Math.sin(a) * r0 * .85), .15); }
  return b;
}
// key -> レイヤー配列 [{g, m, cs}]
function T3(key) {
  if (R3.types[key] !== undefined) return R3.types[key];
  let L = null; try { L = buildType(key); } catch (e) { console.error('3D type', key, e); }
  return (R3.types[key] = L);
}
function buildType(key) {
  const det = R3.q === 0 ? 0 : 1, one = (b, m, cs) => [{ g: b.geo(), m: m || 'std', cs: cs !== false }];
  let b;
  switch (key) {
    case 'tree0': case 'tree1': case 'tree2': return one(mkTreeGB(+key[4] * 17 + 3, det), 'leaf');
    case 'pine': b = new GB(4); b.add(gCyl(.07, .13, 1.2, 6), '#5b4030', M4(0, .6, 0)); for (let i = 0; i < 4; i++) b.add(gCone(.75 - i * .15, .9, 8), i % 2 ? '#2d5a27' : '#264d22', M4(0, 1.1 + i * .48, 0, 0, i, 0), .1); return one(b, 'leaf');
    case 'palm0': return one(mkPalmGB(21, -.42), 'leaf');
    case 'palm1': return one(mkPalmGB(33, .5), 'leaf');
    case 'coconut': b = new GB(2); b.add(gSph(.09, 7, 5), '#4a3520', null, .15); return one(b);
    case 'banana': b = new GB(8); b.add(gCyl(.1, .13, 1.0, 7), '#6b7a32', M4(0, .5, 0)); for (let k = 0; k < 6; k++) b.add(gFrond(1.0, .55, .35, 6, .35), k % 2 ? '#4f9a3a' : '#5aa844', M4(0, 1.0, 0, 0, k * 1.05, 0), .08); return one(b, 'leaf');
    case 'bananas': b = new GB(3); for (let i = 0; i < 6; i++) b.add(gCyl(.03, .025, .18, 5), '#ffd84a', M4(Math.cos(i) * .06, .78 - (i % 3) * .05, .12 + Math.sin(i) * .05, .4, 0, Math.cos(i) * .4)); return one(b);
    case 'bush': case 'bush_r': {
      b = new GB(6); const r = b.r;
      for (let i = 0; i < 4; i++) b.add(blob(.32 + r() * .1, det, .12, i * 3, true), ['#2f5a26', '#3b6c2c', '#457a33'][i % 3], M4((r() - .5) * .35, .3 + r() * .12, (r() - .5) * .3, 0, 0, 0, 1, .8, 1), .1);
      if (key === 'bush_r') for (let i = 0; i < 12; i++) { const a = r() * 6.28, h = .25 + r() * .3; b.add(gSph(.045, 5, 4), '#c8323a', M4(Math.cos(a) * .38, h, Math.sin(a) * .34), .1); }
      return one(b, 'leaf');
    }
    case 'grass': { b = new GB(7); const r = b.r; for (let i = 0; i < 9; i++) b.add(gCone(.025, .3 + r() * .25, 3), r() < .5 ? '#5f9a3e' : '#78b850', M4((r() - .5) * .3, .15, (r() - .5) * .3, (r() - .5) * .5, r() * 3, (r() - .5) * .5)); return one(b, 'leaf', false); }
    case 'fern': { b = new GB(9); for (let k = 0; k < 6; k++) b.add(gFrond(.5, .16, .45, 5, .55), k % 2 ? '#3f8a3a' : '#4c9a40', M4(0, .03, 0, 0, k * 1.05, 0)); return one(b, 'leaf', false); }
    case 'rock0': return one(rockGB(11, det, .42, '#7c7f86'));
    case 'rock1': return one(rockGB(13, det, .36, '#868990'));
    case 'iron_rock': return one(rockGB(15, det, .42, '#74767c', 7, '#c06a2e'));
    case 'coal_rock': return one(rockGB(17, det, .42, '#4a4a52', 7, '#16141a'));
    case 'boulder': return one(rockGB(19, det, .85, '#6c7078'));
    case 'crystal_rock': {
      const b1 = rockGB(23, det, .3, '#3c3a48'), b2 = new GB(25), r = b2.r;
      for (let i = 0; i < 5; i++) b2.add(new THREE.OctahedronGeometry(.1, 0), '#c48ef0', M4((r() - .5) * .3, .25 + r() * .15, (r() - .5) * .3, (r() - .5) * .6, r() * 3, (r() - .5) * .6, 1, 3 + r() * 1.5, 1));
      return [{ g: b1.geo(), m: 'std', cs: true }, { g: b2.geo(), m: 'crystal', cs: false }];
    }
    case 'stump': b = new GB(3); b.add(gCyl(.17, .2, .24, 9), '#5b4030', M4(0, .12, 0)); b.add(gCyl(.16, .16, .02, 9), '#b08a5a', M4(0, .245, 0)); return one(b);
    case 'sapling': b = new GB(5); b.add(gCyl(.015, .02, .5, 4), '#5b4030', M4(0, .25, 0)); b.add(blob(.12, 0, .1, 1, true), '#5a9e3e', M4(.06, .45, 0)); b.add(blob(.1, 0, .1, 2, true), '#6db04c', M4(-.05, .38, .03)); return one(b, 'leaf');
    case 'clay_o': b = new GB(4); b.add(blob(.36, det, .2, 3, true), '#9a5232', M4(0, .03, 0, 0, 0, 0, 1, .28, 1)); b.add(blob(.16, 0, .2, 5, true), '#b8683e', M4(.12, .06, .08, 0, 0, 0, 1, .3, 1)); return one(b, 'std', false);
    case 'flower0': case 'flower1': case 'flower2': case 'flower3': {
      const pc = ['#ff4d6a', '#ffec27', '#ffffff', '#c48ef0'][+key[6]], cc = ['#ffd34d', '#ffffff', '#ffec27', '#fff1e8'][+key[6]]; b = new GB(7); const r = b.r;
      for (let i = 0; i < 3; i++) { const x = (r() - .5) * .4, z = (r() - .5) * .4, h = .18 + r() * .1; b.add(gCyl(.01, .01, h, 3), '#4a8f3a', M4(x, h / 2, z)); for (let k = 0; k < 5; k++) b.add(gSph(.03, 4, 3), pc, M4(x + Math.cos(k * 1.26) * .035, h, z + Math.sin(k * 1.26) * .035)); b.add(gSph(.022, 4, 3), cc, M4(x, h + .01, z)); }
      return one(b, 'leaf', false);
    }
    case 'twig': b = new GB(3); b.add(gCyl(.018, .025, .55, 4), '#6b4a2e', M4(0, .03, 0, 0, .3, Math.PI / 2)); b.add(gCyl(.012, .015, .22, 4), '#6b4a2e', M4(.08, .04, .08, 0, -.6, Math.PI / 2)); return one(b, 'std', false);
    case 'pebble': { b = new GB(5); const r = b.r; for (let i = 0; i < 3; i++) b.add(blob(.07 + r() * .04, 0, .2, i, false), ['#8a8e96', '#6c7078', '#a0a4ac'][i], M4((r() - .5) * .3, .03, (r() - .5) * .3, 0, 0, 0, 1, .6, 1)); return one(b, 'std', false); }
    case 'shell_o': b = new GB(3); b.add(new THREE.SphereGeometry(.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#f2c0b4', M4(0, .0, 0, 0, 0, 0, 1, .45, 1.2)); for (let i = 0; i < 4; i++) b.add(gBox(.01, .02, .2), '#e09a8c', M4(-.06 + i * .04, .035, 0)); return one(b, 'std', false);
    case 'driftwood': b = new GB(4); b.add(gCyl(.07, .09, 1.1, 6), '#b8a07a', M4(0, .07, 0, 0, .4, Math.PI / 2)); b.add(gCyl(.03, .05, .35, 5), '#a8906a', M4(.15, .12, -.1, 0, -.4, 1.2)); return one(b, 'std', false);
    case 'bottle': { const b1 = new GB(2), b2 = new GB(3); b1.add(gCyl(.06, .07, .28, 8), '#9fe0f4', M4(0, .07, 0, 0, .7, Math.PI / 2)); b2.add(gCyl(.025, .025, .06, 6), '#c98e4f', M4(-.11, .07, -.12, 0, .7, Math.PI / 2)); b2.add(gBox(.1, .01, .06), '#f4ecd8', M4(0, .07, 0, 0, .7, 0)); return [{ g: b1.geo(), m: 'glass', cs: false }, { g: b2.geo(), m: 'std', cs: false }]; }
    case 'mushroom_o': case 'red_mushroom_o': {
      const red = key[0] === 'r'; b = new GB(5);
      for (const [x, z, s] of [[0, 0, 1], [.13, .08, .7], [-.1, .1, .6]]) { b.add(gCyl(.03 * s, .04 * s, .14 * s, 6), '#efe6d6', M4(x, .07 * s, z)); b.add(new THREE.SphereGeometry(.1 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), red ? '#c8323a' : '#8a5a36', M4(x, .13 * s, z, 0, 0, 0, 1, .7, 1)); if (red) for (let k = 0; k < 4; k++) b.add(gSph(.015 * s, 4, 3), '#ffffff', M4(x + Math.cos(k * 1.6) * .06 * s, .17 * s, z + Math.sin(k * 1.6) * .06 * s)); }
      return one(b, 'std', false);
    }
    case 'herb_o': { b = new GB(6); const r = b.r; for (let i = 0; i < 8; i++) b.add(blob(.07, 0, .1, i, true), i % 2 ? '#5fbf4a' : '#7cd36e', M4((r() - .5) * .22, .08 + r() * .12, (r() - .5) * .22, 0, 0, 0, 1, .5, 1.4)); return one(b, 'leaf', false); }
    case 'potato_o': { b = new GB(8); b.add(blob(.08, 0, .2, 2, false), '#8a6a3a', M4(.05, .03, .05)); for (let k = 0; k < 5; k++) b.add(gFrond(.25, .12, .2, 3, .8), '#5a9e3e', M4(0, .02, 0, 0, k * 1.26, 0)); return one(b, 'leaf', false); }
    case 'crate': b = new GB(5); b.add(gBox(.66, .62, .66), '#9a6a3a', M4(0, .31, 0)); for (const s of [-1, 1]) { b.add(gBox(.7, .08, .7), '#6b4a2e', M4(0, .31 + s * .27, 0)); b.add(gBox(.08, .62, .7), '#6b4a2e', M4(s * .31, .31, 0)); } b.add(gBox(.04, .8, .67), '#7a5434', M4(0, .31, 0, 0, 0, .78)); return one(b);
    case 'old_raft': { b = new GB(6); const r = b.r; for (let i = 0; i < 6; i++) b.add(gCyl(.08, .09, .9 + r() * .5, 6), i % 2 ? '#6e5a44' : '#5c4a38', M4(-.5 + i * .19, .07, (r() - .5) * .2, Math.PI / 2, (r() - .5) * .3, 0)); b.add(gBox(1.1, .03, .04), '#8a7a5a', M4(0, .14, .2)); return one(b); }
    case 'wreck': {
      b = new GB(7); const r = b.r;
      for (let i = 0; i < 9; i++) { const z = -.6 + i * .15, w = 2.4 - Math.abs(i - 4) * .22; b.add(gBox(w, .12, .16), i % 2 ? '#7a5434' : '#6a4a2e', M4(.2, .5 + Math.abs(i - 4) * .1, z, .3, 0, -.15)); }
      b.add(gBox(2.6, .5, .1), '#5a3a22', M4(.2, .45, -.7, 0, 0, -.12)); b.add(gBox(.12, 1.8, .12), '#4a3020', M4(.1, 1.3, -.2, .2, 0, .35)); b.add(gBox(.9, .6, .03), '#d8d0c0', M4(.38, 1.75, -.15, .2, 0, .35));
      for (let i = 0; i < 6; i++) b.add(gBox(.5 + r() * .4, .05, .14), '#7a5434', M4(-1.2 + r() * 2.6, .05, .5 + r() * .6, 0, r() * 3, 0));
      return one(b);
    }
    case 'lifeboat': b = new GB(7); b.add(gSph(.5, 12, 6), '#ff7a1a', M4(0, .28, 0, 0, 0, 0, 1.9, .55, .85)); b.add(gBox(1.6, .1, .6), '#f4f4f0', M4(0, .5, 0)); b.add(gBox(1.4, .06, .48), '#6b4226', M4(0, .52, 0)); for (const x of [-.4, .2]) b.add(gBox(.08, .06, .5), '#8a5a32', M4(x, .58, 0)); return one(b);
    case 'milcrate': b = new GB(5); b.add(gBox(.9, .62, .66), '#5d6b2a', M4(0, .31, 0)); b.add(gBox(.92, .1, .68), '#3f4a1c', M4(0, .5, 0)); b.add(gBox(.3, .14, .02), '#e8e0c0', M4(0, .3, .335)); return one(b);
    case 'cave_in': {
      b = new GB(9); const r = b.r;
      for (let i = 0; i < 9; i++) { const a = Math.PI * (i / 8); b.add(blob(.38 + r() * .18, det, .3, i, false), '#6c6f78', M4(Math.cos(a) * .85, Math.sin(a) * .95 + .1, -.1, 0, 0, 0, 1, 1, .9), .12); }
      b.add(blob(.9, det, .2, 3, false), '#5c5f68', M4(0, .7, -.7, 0, 0, 0, 1.4, 1.1, .8));
      const b2 = new GB(2); b2.add(new THREE.CircleGeometry(.72, 12, 0, Math.PI), '#000000', M4(0, .08, .02)); b2.add(gBox(1.44, .1, .02), '#000000', M4(0, .06, .02));
      return [{ g: b.geo(), m: 'std', cs: true }, { g: b2.geo(), m: 'emis', cs: false }];
    }
    case 'shrine': b = new GB(5); b.add(gBox(.8, .15, .7), '#7a7c84', M4(0, .07, 0)); for (const x of [-.3, .3]) b.add(gBox(.1, .6, .1), '#8a8c94', M4(x, .45, .2)); b.add(gBox(.6, .5, .4), '#8a8c94', M4(0, .4, -.1)); b.add(gBox(.95, .1, .8), '#b03030', M4(0, .82, 0)); b.add(gBox(.75, .12, .6), '#c84040', M4(0, .92, 0)); b.add(gBox(.3, .3, .02), '#3a3f4a', M4(0, .42, .11)); return one(b);
    case 'rdoor': b = new GB(5); b.add(gBox(1.0, 1.7, .3), '#7a7090', M4(0, .85, 0)); b.add(gBox(.04, 1.6, .32), '#3a3355', M4(0, .85, 0)); { const b2 = new GB(6); b2.add(gBox(.18, .18, .02), '#ffec27', M4(-.25, 1.25, .16)); b2.add(gBox(.18, .18, .02), '#9fe0f4', M4(.25, 1.25, .16)); b2.add(gBox(.22, .18, .02), '#c48ef0', M4(0, .85, .16)); return [{ g: b.geo(), m: 'std', cs: true }, { g: b2.geo(), m: 'emis', cs: false }]; }
    case 'pillar': b = new GB(4); b.add(gBox(.62, .2, .62), '#a8a49a', M4(0, .1, 0)); b.add(gCyl(.24, .26, 1.7, 10), '#9c978b', M4(0, 1.0, 0)); b.add(gBox(.62, .2, .62), '#a8a49a', M4(0, 1.9, 0)); b.add(blob(.12, 0, .3, 4, true), '#5e8a4a', M4(.2, 1.2, .12)); b.add(blob(.1, 0, .3, 6, true), '#5e8a4a', M4(-.18, .5, .14)); return one(b);
    case 'statue': b = new GB(4); b.add(gBox(.7, .3, .6), '#7c7c74', M4(0, .15, 0)); b.add(gBox(.56, 1.3, .48), '#8a8a80', M4(0, .95, 0)); b.add(gBox(.6, .14, .3), '#7c7c74', M4(0, 1.32, .14)); b.add(gBox(.14, .44, .16), '#7c7c74', M4(0, 1.06, .3)); b.add(gBox(.4, .06, .08), '#5c5c54', M4(0, .78, .26)); return one(b);
    case 'workbench': b = new GB(5); b.add(gBox(1.0, .1, .62), '#b07a46', M4(0, .7, 0)); for (const [x, z] of [[-.42, -.24], [.42, -.24], [-.42, .24], [.42, .24]]) b.add(gBox(.08, .7, .08), '#6b4a2e', M4(x, .35, z)); b.add(gBox(.85, .05, .5), '#8a5a32', M4(0, .25, 0)); b.add(gBox(.3, .05, .1), '#a0a8b4', M4(-.2, .78, .05, 0, .4, 0)); b.add(gCyl(.02, .02, .3, 4), '#6b4a2e', M4(.2, .77, 0, 0, 0, Math.PI / 2)); return one(b);
    case 'bed': { b = new GB(5); const r = b.r; b.add(gBox(.9, .06, .62), '#4a7a32', M4(0, .03, 0)); for (let i = 0; i < 7; i++) b.add(blob(.18, 0, .1, i, true), i % 2 ? '#5c9a3e' : '#4f8a36', M4(-.35 + i * .12, .07, (r() - .5) * .2, 0, 0, 0, 1.4, .3, 1.6)); return one(b, 'leaf', false); }
    case 'old_bed': b = new GB(5); b.add(gBox(.95, .3, .7), '#6b4226', M4(0, .15, 0)); b.add(gBox(.9, .12, .65), '#3d74b8', M4(.06, .34, 0)); b.add(gBox(.24, .1, .5), '#f4f4f0', M4(-.33, .36, 0)); return one(b);
    case 'chest': case 'rchest': { const st = key === 'rchest'; b = new GB(5); b.add(gBox(.7, .38, .48), st ? '#8a8c94' : '#9a6a3a', M4(0, .19, 0)); b.add(gBox(.72, .14, .5), st ? '#6c7078' : '#7a5434', M4(0, .43, 0)); b.add(gBox(.74, .04, .52), '#d4a83a', M4(0, .37, 0)); const b2 = new GB(3); b2.add(gBox(.1, .12, .04), '#ffd24a', M4(0, .34, .25)); return [{ g: b.geo(), m: 'std', cs: true }, { g: b2.geo(), m: 'metal', cs: false }]; }
    case 'furnace': { b = new GB(5); const r = b.r; for (let y = 0; y < 3; y++) for (let i = 0; i < 4; i++) b.add(gBox(.24, .24, .24), ['#7a7c84', '#8a8c94', '#6c7078'][(i + y) % 3], M4(-.36 + i * .24, .12 + y * .24, 0, 0, (r() - .5) * .1, 0, 1, 1, 2.6)); b.add(gBox(.4, .3, .1), '#1a1418', M4(0, .26, .3)); const b2 = new GB(3); b2.add(gBox(.32, .2, .02), '#ff8a2a', M4(0, .22, .36)); return [{ g: b.geo(), m: 'std', cs: true }, { g: b2.geo(), m: 'emis', cs: false }]; }
    case 'fence_post': b = new GB(3); b.add(gBox(.13, .8, .13), '#6b4226', M4(0, .4, 0)); b.add(gCone(.1, .1, 4), '#7a5434', M4(0, .85, 0, 0, .78, 0)); return one(b);
    case 'rail_x': b = new GB(3); b.add(gBox(1.0, .07, .05), '#c98e4f', M4(0, .5, 0)); b.add(gBox(1.0, .07, .05), '#b07a46', M4(0, .28, 0)); return one(b);
    case 'rail_z': b = new GB(3); b.add(gBox(.05, .07, 1.0), '#c98e4f', M4(0, .5, 0)); b.add(gBox(.05, .07, 1.0), '#b07a46', M4(0, .28, 0)); return one(b);
    case 'gate': b = new GB(4); for (const x of [-.46, .46]) b.add(gBox(.12, .85, .12), '#6b4226', M4(x, .42, 0)); for (let i = 0; i < 5; i++) b.add(gBox(.15, .6, .05), '#b07848', M4(-.3 + i * .15, .38, 0)); b.add(gBox(.85, .06, .06), '#6b4226', M4(0, .5, .03)); return one(b);
    case 'sos': {
      b = new GB(5); const r = b.r, L = { S: ['111', '100', '111', '001', '111'], O: ['111', '101', '101', '101', '111'] }; let ox = -1.1;
      for (const ch of 'SOS') { const g = L[ch]; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '1') b.add(blob(.08, 0, .2, i + j, false), '#c8ccd2', M4(ox + i * .17, .04, -.35 + j * .17, 0, r() * 3, 0, 1, .6, 1)); ox += .75; }
      return one(b, 'std', false);
    }
    case 'cwall': { b = new GB(5); const r = b.r; b.add(gBox(1.02, 2.3, 1.02), '#2c2632', M4(0, 1.15, 0)); for (let i = 0; i < 4; i++) b.add(blob(.32, 0, .3, i, false), '#3a3242', M4((r() - .5) * .7, .4 + r() * 1.6, .45, 0, 0, 0, 1, 1.2, .5)); return one(b); }
    case 'rwall': b = new GB(5); b.add(gBox(1.0, 1.8, 1.0), '#8a8478', M4(0, .9, 0)); for (let y = 0; y < 4; y++) b.add(gBox(1.02, .04, 1.02), '#6a655b', M4(0, .4 + y * .42, 0)); b.add(gBox(1.04, .12, 1.04), '#a09a8c', M4(0, 1.82, 0)); return one(b);
    case 'lwall': b = new GB(5); for (let y = 0; y < 5; y++) b.add(gCyl(.13, .13, 1.04, 8), y % 2 ? '#7a5230' : '#6a4426', M4(0, .14 + y * .25, 0, 0, 0, Math.PI / 2)); for (let y = 0; y < 5; y++) b.add(gCyl(.13, .13, 1.04, 8), y % 2 ? '#6a4426' : '#7a5230', M4(0, .26 + y * .25, 0, Math.PI / 2, 0, 0)); return one(b);
    case 'campfire_base': { b = new GB(5); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; b.add(blob(.09, 0, .25, i, false), i % 2 ? '#8a8c94' : '#6c7078', M4(Math.cos(a) * .3, .05, Math.sin(a) * .3)); } for (let i = 0; i < 4; i++) b.add(gCyl(.04, .05, .5, 5), '#6b4226', M4(0, .12, 0, 0, i * .8, Math.PI / 2 - .5)); return one(b); }
    case 'torch_post': b = new GB(3); b.add(gCyl(.04, .06, 1.1, 6), '#6b4226', M4(0, .55, 0)); b.add(gCyl(.08, .05, .16, 6), '#3a2a1e', M4(0, 1.15, 0)); return one(b);
    case 'signal_base': { b = new GB(5); const r = b.r; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; b.add(blob(.14, 0, .25, i, false), '#7a7c84', M4(Math.cos(a) * .62, .08, Math.sin(a) * .62)); } for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; b.add(gCyl(.05, .07, 1.5, 5), i % 2 ? '#6b4226' : '#7a5434', M4(Math.cos(a) * .3, .6, Math.sin(a) * .3, Math.sin(a) * .35, 0, -Math.cos(a) * .35)); } b.add(blob(.25, 0, .2, 2, true), '#4f8a36', M4(0, 1.25, 0)); return one(b); }
    case 'collector_base': b = new GB(4); for (const [x, z] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) b.add(gBox(.06, .9, .06), '#6b4226', M4(x, .45, z)); b.add(new THREE.ConeGeometry(.55, .4, 8, 1, true), '#5c9a3e', M4(0, 1.0, 0, Math.PI, 0, 0)); b.add(gCyl(.24, .24, .4, 10), '#8a5a32', M4(0, .2, 0)); return one(b, 'leaf');
    case 'raft_base': { b = new GB(6); for (let i = 0; i < 8; i++) b.add(gCyl(.1, .1, 1.5, 7), i % 2 ? '#a07040' : '#8a5a32', M4(-.7 + i * .2, .06, 0, Math.PI / 2, 0, 0)); b.add(gBox(1.65, .05, .06), '#c9b077', M4(0, .17, .45)); b.add(gBox(1.65, .05, .06), '#c9b077', M4(0, .17, -.45)); return one(b); }
    case 'sail': b = new GB(3); b.add(gCyl(.04, .05, 1.9, 6), '#5b4030', M4(0, .95, 0)); b.add(gBox(.9, 1.1, .03), '#f0ece0', M4(.48, 1.15, 0)); b.add(gBox(.9, .05, .05), '#5b4030', M4(.48, .6, 0)); return one(b);
    case 'heli_body': b = new GB(5); b.add(gSph(.7, 14, 10), '#d94a4a', M4(0, .75, 0, 0, 0, 0, 1.5, .9, 1)); b.add(gSph(.5, 12, 8), '#9fe0f4', M4(.62, .85, 0, 0, 0, 0, .8, .7, .9)); b.add(gBox(1.8, .2, .2), '#d94a4a', M4(-1.6, .9, 0)); b.add(gBox(.12, .6, .3), '#d94a4a', M4(-2.45, 1.15, 0)); for (const z of [-.5, .5]) { b.add(gBox(1.6, .06, .06), '#2a2a33', M4(0, .05, z)); b.add(gBox(.06, .3, .06), '#2a2a33', M4(.4, .2, z)); b.add(gBox(.06, .3, .06), '#2a2a33', M4(-.4, .2, z)); } b.add(gCyl(.06, .06, .3, 6), '#2a2a33', M4(0, 1.5, 0)); b.add(gBox(1.4, .06, .02), '#ffffff', M4(.1, .55, .69)); return one(b, 'metal');
    case 'rotor': b = new GB(2); b.add(gBox(4.2, .03, .18), '#2a2a33', M4(0, 0, 0)); b.add(gBox(.18, .03, 4.2), '#2a2a33', M4(0, 0, 0)); return one(b, 'metal');
    case 'altar_base': b = new GB(5); b.add(gBox(1.9, .55, .8), '#8a8c94', M4(0, .27, 0)); b.add(gBox(2.0, .1, .9), '#a0a4ac', M4(0, .58, 0)); for (let i = 0; i < 3; i++) b.add(gBox(.36, .06, .36), '#3a3f4a', M4(-.6 + i * .6, .62, 0)); return one(b);
    case 'tablet': b = new GB(3); b.add(gBox(.3, .4, .08), '#a0a4ac', M4(0, .2, 0)); return one(b);
    case 'pedestal_base': b = new GB(4); b.add(gBox(.7, .14, .7), '#7a7c84', M4(0, .07, 0)); b.add(gBox(.46, .6, .46), '#8a8c94', M4(0, .44, 0)); b.add(gBox(.62, .1, .62), '#a0a4ac', M4(0, .78, 0)); return one(b);
    case 'antenna': b = new GB(2); b.add(gCyl(.02, .02, .7, 5), '#c8d0d8', M4(0, .35, 0)); for (let i = 0; i < 3; i++) b.add(gCyl(.01, .01, .3 - i * .07, 4), '#c8d0d8', M4(0, .45 + i * .1, 0, 0, 0, Math.PI / 2)); return one(b, 'metal');
    case 'radio_base': b = new GB(4); b.add(gBox(.85, .08, .55), '#8f5a32', M4(0, .55, 0)); for (const [x, z] of [[-.35, -.2], [.35, -.2], [-.35, .2], [.35, .2]]) b.add(gBox(.06, .55, .06), '#6b4226', M4(x, .27, z)); b.add(gBox(.6, .36, .36), '#59616b', M4(0, .78, 0)); b.add(gBox(.3, .2, .02), '#1a1a20', M4(-.1, .8, .19)); b.add(gCyl(.04, .04, .03, 8), '#d4a83a', M4(.18, .82, .19, Math.PI / 2, 0, 0)); b.add(gCyl(.012, .012, .6, 4), '#c8d0d8', M4(.25, 1.25, -.1)); return one(b, 'metal');
    case 'note': b = new GB(2); b.add(gBox(.3, .015, .38), '#f1e1b4', M4(0, .03, 0, 0, .3, 0)); for (let i = 0; i < 4; i++) b.add(gBox(.22, .017, .015), '#8a7458', M4(0, .035, -.1 + i * .06, 0, .3, 0)); return one(b, 'std', false);
    case 'pack': b = new GB(4); b.add(gBox(.42, .46, .26), '#4d5a2a', M4(0, .23, 0)); b.add(gBox(.44, .16, .28), '#3f4a1c', M4(0, .4, .02)); b.add(gBox(.06, .3, .04), '#2a2a1a', M4(-.12, .3, -.15)); return one(b);
    case 'bag': b = new GB(4); b.add(gBox(.42, .46, .26), '#3d74b8', M4(0, .23, 0)); b.add(gBox(.44, .16, .28), '#2a4f80', M4(0, .4, .02)); b.add(gBox(.1, .08, .02), '#ffec27', M4(0, .32, .15)); return one(b);
    case 'ladder': b = new GB(3); for (const x of [-.25, .25]) b.add(gBox(.05, 2.4, .05), '#6b4226', M4(x, 1.2, 0)); for (let i = 0; i < 7; i++) b.add(gBox(.5, .04, .04), '#c98e4f', M4(0, .2 + i * .32, 0)); return one(b);
    case 'ship': b = new GB(5); b.add(gBox(5.2, .9, 1.4), '#c83030', M4(0, .4, 0)); b.add(gBox(5.4, .2, 1.5), '#f4f4f0', M4(0, .95, 0)); b.add(gBox(2, 1.0, 1.1), '#f4f4f0', M4(-.8, 1.5, 0)); b.add(gCyl(.18, .18, .9, 8), '#2a2a33', M4(-.6, 2.4, 0)); return one(b, 'metal');
  }
  if (key.startsWith('crop_')) {
    const [, c, st] = key.split('_'), cr = CROPS[c] || CROPS.potato, s = +st; b = new GB(7); const r = b.r;
    const sc = [.35, .6, .9, 1][s];
    for (let k = 0; k < 5; k++) b.add(gFrond(.3 * sc + .05, .14 * sc + .04, .25, 3, .9), cr.col, M4(0, .02, 0, 0, k * 1.26, 0));
    if (s >= 2) b.add(gCyl(.012, .015, .35 * sc, 4), '#3a7a30', M4(0, .17 * sc, 0));
    if (s === 3) { if (c === 'melon') b.add(gSph(.18, 10, 8), '#1e6b3c', M4(.12, .14, .05, 0, 0, 0, 1.2, .9, 1)); else for (let i = 0; i < 5; i++) b.add(gSph(c === 'berry' ? .04 : .06, 6, 4), cr.fruit, M4((r() - .5) * .28, .12 + r() * .18, (r() - .5) * .28)); }
    return one(b, 'leaf', false);
  }
  return null;
}
const ROT0 = { wreck: 1, lifeboat: 1, sos: 1, rdoor: 1, statue: 1, cave_in: 1, workbench: 1, chest: 1, rchest: 1, old_bed: 1, furnace: 1, milcrate: 1, shrine: 1, gate: 1, crate: 0, bed: 1 };

// ---------- 特殊オブジェクト（状態でアニメ・光る物） ----------
function layerMeshes(key, parent, opt) { const L = T3(key); if (!L) return []; const out = []; for (const l of L) { const me = new THREE.Mesh(l.g, R3.mats[l.m]); me.castShadow = l.cs && R3.q > 0; me.receiveShadow = true; parent.add(me); out.push(me); } return out; }
function sprite(mat, sx, sy, y) { const s = new THREE.Sprite(mat); s.scale.set(sx, sy, 1); s.position.y = y || 0; return s; }
const flick = (t, s) => OPT.flicker ? Math.sin(t * 9 + s) * .07 + Math.sin(t * 14.3 + s * 1.7) * .04 : 0;
const SPF = {
  campfire: o => { const g = new THREE.Group(); layerMeshes('campfire_base', g); const f1 = sprite(R3.mats.flame, .5, .8), f2 = sprite(R3.mats.flame2, .3, .5); g.add(f1, f2);
    const sp = { g, upd(t) { const on = o.fuel > 0; f1.visible = f2.visible = on; sp.light = null; if (!on) return; const k = 1 + Math.min(.6, o.fuel / 600), f = flick(t, o.x); f1.scale.set(.55 * k, (.8 + f) * k, 1); f1.position.y = .1 + .36 * k; f2.scale.set(.32 * k, (.5 + f) * k, 1); f2.position.y = .1 + .24 * k; sp.light = { c: 0xff8a3a, i: 2.4 * k * (1 + f), d: 8, y: .6 }; } }; return sp; },
  torch_post: o => { const g = new THREE.Group(); layerMeshes('torch_post', g); const f = sprite(R3.mats.flame, .28, .45, 1.38); g.add(f);
    const sp = { g, upd(t) { const k = flick(t, o.x + o.y); f.scale.set(.28, .45 + k, 1); sp.light = { c: 0xffa050, i: 1.7 * (1 + k), d: 6.5, y: 1.4 }; } }; return sp; },
  signal: o => { const g = new THREE.Group(); layerMeshes('signal_base', g); const fs = [sprite(R3.mats.flame, 1.1, 1.8, 1.0), sprite(R3.mats.flame2, .7, 1.2, .8), sprite(R3.mats.flame, .8, 1.3, 1.2)]; fs[2].position.x = .2; fs.forEach(f => g.add(f));
    const sp = { g, upd(t) { const on = o.fuel > 0; fs.forEach(f => f.visible = on); sp.light = null; if (!on) return; const k = flick(t, 2); fs[0].scale.set(1.1, 1.8 + k * 2, 1); fs[1].scale.set(.7, 1.2 + k, 1); fs[2].scale.set(.8, 1.3 - k, 1); sp.light = { c: 0xff7a2a, i: 3.2 * (1 + k), d: 13, y: 1.4 }; } }; return sp; },
  collector: o => { const g = new THREE.Group(); layerMeshes('collector_base', g); const w = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .02, 12), R3.mats.water); g.add(w);
    return { g, upd() { w.visible = o.w > 0; w.position.y = .05 + Math.min(4, o.w || 0) * .085; } }; },
  raft: o => { const g = new THREE.Group(); layerMeshes('raft_base', g); const s = new THREE.Group(); layerMeshes('sail', s); g.add(s);
    return { g, water: true, upd(t) { s.visible = !!o.sail; g.position.y = .02 + Math.sin(t * 1.6 + o.x) * .04; g.rotation.z = Math.sin(t * 1.2) * .03; } }; },
  heli: o => { const g = new THREE.Group(); layerMeshes('heli_body', g); const r = new THREE.Group(); r.position.y = 1.66; layerMeshes('rotor', r); g.add(r); const l = sprite(R3.mats.glowW, .5, .5, 1.0); l.position.x = 1.0; g.add(l);
    const sp = { g, upd(t, dt) { r.rotation.y += dt * 14; l.visible = Math.floor(t * 2) % 2 === 0; sp.light = { c: 0xffffff, i: 1.2, d: 7, y: 1.2 }; } }; return sp; },
  altar: o => { const g = new THREE.Group(); layerMeshes('altar_base', g); const ids = ['tablet_a', 'tablet_b', 'tablet_c'], cols = [R3.mats.glowG, R3.mats.glowB, R3.mats.glowP], tabs = [];
    for (let i = 0; i < 3; i++) { const tg = new THREE.Group(); tg.position.set(-.6 + i * .6, .62, 0); layerMeshes('tablet', tg); const gl = sprite(cols[i], .5, .5, .25); tg.add(gl); g.add(tg); tabs.push(tg); }
    return { g, upd() { const h = o.has || {}; tabs.forEach((tg, i) => tg.visible = !!h[ids[i]]); } }; },
  pedestal: o => { const g = new THREE.Group(); layerMeshes('pedestal_base', g); const a = new THREE.Group(); a.position.y = .84; layerMeshes('antenna', a); const gl = sprite(R3.mats.glowW, .6, .6, .4); a.add(gl); g.add(a);
    return { g, upd(t) { a.visible = !!o.has; a.rotation.y = t * .6; } }; },
  shrine: o => { const g = new THREE.Group(); layerMeshes('shrine', g); const gl = sprite(R3.mats.glowG, .45, .45, .42); gl.position.z = .14; g.add(gl);
    return { g, upd(t) { gl.visible = !!o.has; gl.material.opacity = 1; gl.scale.setScalar(.4 + Math.sin(t * 3) * .05); } }; },
  radio: o => { const g = new THREE.Group(); layerMeshes('radio_base', g); const led = sprite(R3.mats.glowG, .16, .16, .9); led.position.set(.18, 0, .2); g.add(led);
    return { g, upd(t) { led.visible = !!o.fixed && Math.floor(t * 2) % 2 === 0; } }; },
  crop: o => { const g = new THREE.Group(); let cur = -1, ms = [];
    return { g, upd() { const s = (o.g || 0) >= 1 ? 3 : o.g >= .6 ? 2 : o.g >= .25 ? 1 : 0; if (s !== cur) { cur = s; ms.forEach(me => g.remove(me)); ms = layerMeshes('crop_' + o.c + '_' + s, g); } } }; },
  note: o => { const g = new THREE.Group(); const p = new THREE.Group(); layerMeshes('note', p); g.add(p); const gl = sprite(R3.mats.glowW, .7, .7, .2); g.add(gl);
    return { g, upd(t) { p.position.y = .15 + Math.sin(t * 2.4 + o.x) * .05; p.rotation.y = t * .5; gl.material.opacity = .7; gl.scale.setScalar(.6 + Math.sin(t * 3) * .1); } }; },
  bag: o => { const g = new THREE.Group(); layerMeshes('bag', g); const gl = sprite(R3.mats.glowG, .7, .7, .4); g.add(gl); return { g, upd(t) { gl.scale.setScalar(.6 + Math.sin(t * 4) * .12); } }; },
  old_pack: o => { const g = new THREE.Group(); layerMeshes('pack', g); const gl = sprite(R3.mats.glowW, .55, .55, .4); g.add(gl); return { g, upd(t) { gl.visible = Math.sin(t * 2.5) > -.3; } }; },
  cave_out: o => { const g = new THREE.Group(); layerMeshes('ladder', g); const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, .9, 4, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); beam.position.y = 2; g.add(beam);
    const sp = { g, upd() { sp.light = { c: 0xfff0c8, i: 1.4, d: 6, y: 1.5 }; } }; return sp; },
};
// 置ける物のゴースト（設置プレビュー）
const PLACE3 = { campfire: 'campfire_base', workbench: 'workbench', bed: 'bed', chest: 'chest', collector: 'collector_base', fence: 'fence_post', gate: 'gate', torch_post: 'torch_post', furnace: 'furnace', signal: 'signal_base', sos: 'sos', raft: 'raft_base' };

// ---------- マップ（地形・海・壁） ----------
const TH3 = t => t === T.DEEP ? -1.3 : t === T.SHALLOW ? -.32 : t === T.FRESH ? -.5 : t === T.SAND ? .04 : t === T.SWAMP ? .1 : t === T.GRASS ? .22 : (t === T.FOREST || t === T.JUNGLE) ? .28 : (t === T.PATH || t === T.FARM) ? .2 : (t === T.RFLOOR || t === T.RWALL || t === T.PLANK || t === T.LOGWALL) ? .26 : (t === T.CFLOOR || t === T.CWALL) ? 0 : .3;
const TC3 = { 0: '#203848', 1: '#b9a674', 2: '#d8c48f', 3: '#5e8c3c', 4: '#46702f', 5: '#3b6630', 6: '#86817a', 7: '#4d5733', 8: '#4a5a3c', 9: '#9a7b52', 10: '#9c978b', 11: '#9c978b', 12: '#3b3540', 13: '#0c0a10', 14: '#5b3e26', 15: '#8f6539', 16: '#8f6539' };
let TCL3 = null;
function r3Map(m) {
  if (m._r3 && m._r3.gen === R3.gen) return m._r3;
  const M3 = { m, gen: R3.gen, group: new THREE.Group(), chunks: new Map(), hs: null, th: null, terrain: null, water: null, walls: [], built: false };
  Object.defineProperty(m, '_r3', { value: M3, writable: true, configurable: true, enumerable: false });
  R3.scene.add(M3.group); R3.list.push(M3);
  r3Terrain(M3); if (m.id !== 'cave') r3Water(M3); r3Walls(M3);
  return M3;
}
function r3DisposeMap(M3) {
  M3.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
  if (M3.terrain) M3.terrain.geometry.dispose(); if (M3.water) { M3.water.geometry.dispose(); M3.water.material.dispose(); M3.htex.dispose(); }
  R3.scene.remove(M3.group); R3.list = R3.list.filter(x => x !== M3); M3.gen = -1;
}
function r3Terrain(M3) {
  const m = M3.m, W = m.w, H = m.h;
  if (!TCL3) { TCL3 = {}; for (const k in TC3) TCL3[k] = new THREE.Color(TC3[k]); }
  const rd = new Float32Array(W * H).fill(0), q = []; // 岩場の奥行き（山の高さ）
  for (let i = 0; i < W * H; i++) { if (m.t[i] !== T.ROCK) rd[i] = 0; else rd[i] = -1; }
  for (let i = 0; i < W * H; i++) if (rd[i] === -1) { const x = i % W, y = (i / W) | 0; for (const d of DIRV) { const t = tAt(m, x + d.x, y + d.y); if (t !== T.ROCK) { rd[i] = 1; q.push(i); break; } } }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const d of DIRV) { const nx = x + d.x, ny = y + d.y; if (!inB(m, nx, ny)) continue; const j = ny * W + nx; if (rd[j] === -1) { rd[j] = rd[i] + 1; q.push(j); } } }
  const th = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const t = m.t[i]; th[i] = t === T.ROCK ? .45 + Math.min(Math.max(rd[i], 1), 9) * .42 : TH3(t); }
  M3.th = th;
  const CW = W + 1, CHh = H + 1, n = CW * CHh, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), hs = new Float32Array(n);
  M3.hs = hs; M3.CW = CW;
  for (let cy = 0; cy <= H; cy++) for (let cx = 0; cx <= W; cx++) r3Corner(M3, cx, cy, pos, col, uv);
  const idx = new Uint32Array(W * H * 6); let k = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = y * CW + x, b = a + 1, c = a + CW, d = c + 1; if ((x + y) % 2) { idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; } else { idx[k++] = a; idx[k++] = c; idx[k++] = d; idx[k++] = a; idx[k++] = d; idx[k++] = b; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
  const me = new THREE.Mesh(g, R3.mats.terrain); me.receiveShadow = true; me.castShadow = R3.q >= 2 && m.id !== 'cave'; me.frustumCulled = false;
  M3.terrain = me; M3.group.add(me);
}
function r3Corner(M3, cx, cy, pos, col, uv) {
  const m = M3.m, W = m.w, CW = M3.CW, th = M3.th; let h = 0, r = 0, g = 0, b = 0, n = 0, rock = 0, land = 0;
  for (let j = cy - 1; j <= cy; j++) for (let i = cx - 1; i <= cx; i++) {
    const t = tAt(m, i, j), hh = inB(m, i, j) ? th[j * W + i] : TH3(t), c = TCL3[t] || TCL3[0];
    h += hh; r += c.r; g += c.g; b += c.b; n++; if (t === T.ROCK) rock++; if (!isWater(t)) land++;
  }
  h /= n; r /= n; g /= n; b /= n;
  const nz = TN3(cx * .13, cy * .13), jt = h2(cx, cy);
  if (m.id !== 'cave') { h += (jt - .5) * (rock ? .22 : .05); const k = .88 + nz * .2 + (jt - .5) * .05; r *= k; g *= k; b *= k; if (h > -.12 && h < .1 && land < 4 && land > 0) { r *= .78; g *= .78; b *= .8; } if (rock && h > 1.2) { const l = Math.min(.25, (h - 1.2) * .06); r += l * .3; g += l * .3; b += l * .3; } }
  else { const k = .85 + nz * .3; r *= k; g *= k; b *= k; }
  const i = cy * CW + cx; M3.hs[i] = h;
  if (pos) { pos[i * 3] = cx; pos[i * 3 + 1] = h; pos[i * 3 + 2] = cy; col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b; uv[i * 2] = cx * .35; uv[i * 2 + 1] = cy * .35; }
  return [h, r, g, b];
}
function r3TileChanged(m, x, y) {
  const M3 = m._r3; if (!M3 || M3.gen !== R3.gen || !M3.terrain) return;
  const t = m.t[y * m.w + x]; M3.th[y * m.w + x] = t === T.ROCK ? M3.th[y * m.w + x] : TH3(t);
  const g = M3.terrain.geometry, P = g.attributes.position.array, C = g.attributes.color.array;
  for (let cy = y; cy <= y + 1; cy++) for (let cx = x; cx <= x + 1; cx++) { const [h, r, gg, b] = r3Corner(M3, cx, cy); const i = cy * M3.CW + cx; P[i * 3 + 1] = h; C[i * 3] = r; C[i * 3 + 1] = gg; C[i * 3 + 2] = b; }
  g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; M3.normDirty = true;
}
function r3ObjChanged(m, x, y) {
  const M3 = m._r3; if (!M3 || M3.gen !== R3.gen) return;
  const cx = Math.floor(x / CH3), cy = Math.floor(y / CH3), mark = (a, b) => { const c = M3.chunks.get(a + ',' + b); if (c) c.dirty = true; };
  mark(cx, cy); if (x % CH3 === 0) mark(cx - 1, cy); if (y % CH3 === 0) mark(cx, cy - 1);
}
function r3GroundAt(M3, X, Z) {
  const CW = M3.CW, Hh = M3.m.h + 1; X = clamp(X, 0, CW - 1.001); Z = clamp(Z, 0, Hh - 1.001);
  const x0 = Math.floor(X), z0 = Math.floor(Z), fx = X - x0, fz = Z - z0, hs = M3.hs;
  const a = hs[z0 * CW + x0], b = hs[z0 * CW + x0 + 1], c = hs[(z0 + 1) * CW + x0], d = hs[(z0 + 1) * CW + x0 + 1];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}
const WATER_VS = `uniform float uTime; varying vec3 vW;
float wv(vec2 p){ return sin(p.x*.9+uTime*1.1)*.035 + sin(p.y*1.3-uTime*.9)*.03 + sin((p.x+p.y)*2.1+uTime*1.7)*.015; }
void main(){ vec4 w = modelMatrix * vec4(position,1.0); w.y += wv(w.xz); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform float uAmb; uniform vec3 uDeep; uniform vec3 uShal;
uniform sampler2D uH; uniform vec2 uMap; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF; varying vec3 vW;
float wv(vec2 p){ return sin(p.x*.9+uTime*1.1)*.035 + sin(p.y*1.3-uTime*.9)*.03 + sin((p.x+p.y)*2.1+uTime*1.7)*.015; }
float hg(vec2 p){ vec2 uv = p / uMap; if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return -2.0; return texture2D(uH, uv).r * 6.0 - 1.5; }
void main(){
  float depth = clamp(-hg(vW.xz), 0.0, 3.0);
  float e = .08, h0 = wv(vW.xz);
  vec3 n = normalize(vec3(h0 - wv(vW.xz + vec2(e, 0.)), e, h0 - wv(vW.xz + vec2(0., e))));
  n = normalize(n + vec3(sin(vW.x*6.+uTime*2.)*.05, 0., cos(vW.z*7.-uTime*1.6)*.05));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 base = mix(uShal, uDeep, smoothstep(.05, 1.5, depth));
  vec3 col = base * (uAmb + max(dot(n, uSunDir), 0.0) * uSunCol * .55);
  col = mix(col, uSky, fres * .55);
  vec3 Hh = normalize(uSunDir + V); col += uSunCol * pow(max(dot(n, Hh), 0.0), 140.0) * 1.3;
  float foam = smoothstep(.2, 0.0, depth) * (.55 + .45 * sin(vW.x*5. + vW.z*4. + uTime*2.4));
  col = mix(col, vec3(.92, .95, 1.0) * (uAmb + .55 * length(uSunCol)), clamp(foam, 0., 1.) * .8);
  float a = mix(.5, .93, smoothstep(0.0, 1.2, depth)); a = max(a, foam * .85);
  float fd = length(vW - cameraPosition); col = mix(col, uFogC, smoothstep(uFogN, uFogF, fd));
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;
function r3WaterMat(htex, W, H) {
  return new THREE.ShaderMaterial({
    vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false,
    uniforms: { uTime: R3.u.uTime, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color(.6, .8, 1) }, uAmb: { value: .5 },
      uDeep: { value: new THREE.Color('#0d4a6e') }, uShal: { value: new THREE.Color('#3fb8c8') }, uH: { value: htex }, uMap: { value: new THREE.Vector2(W, H) },
      uFogC: { value: new THREE.Color() }, uFogN: { value: 20 }, uFogF: { value: 60 } }
  });
}
function r3Water(M3) {
  const m = M3.m, W = m.w, H = m.h, d = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { const v = Math.round(clamp((M3.th[i] + 1.5) / 6, 0, 1) * 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true; M3.htex = tex;
  const seg = [70, 130, 190][R3.q], geo = new THREE.PlaneGeometry(W + 140, H + 140, seg, seg); geo.rotateX(-Math.PI / 2);
  const me = new THREE.Mesh(geo, r3WaterMat(tex, W, H)); me.position.set(W / 2, 0, H / 2); me.renderOrder = 2; me.frustumCulled = false;
  M3.water = me; M3.group.add(me);
}
function r3Walls(M3) {
  const m = M3.m, inst = { rwall: [], lwall: [], cwall: [] };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const t = m.t[y * m.w + x], Y = M3.hs[y * M3.CW + x];
    if (t === T.RWALL) inst.rwall.push(M4(x + .5, .26, y + .5));
    else if (t === T.LOGWALL) inst.lwall.push(M4(x + .5, .26, y + .5));
    else if (t === T.CWALL) { let nb = false; for (let j = -1; j <= 1 && !nb; j++) for (let i = -1; i <= 1; i++) if (tAt(m, x + i, y + j) === T.CFLOOR) { nb = true; break; } if (nb) inst.cwall.push(M4(x + .5, 0, y + .5, 0, Math.floor(h2(x, y) * 4) * Math.PI / 2, 0, 1, .8 + h2(y, x) * .5, 1)); }
  }
  for (const k in inst) { const arr = inst[k]; if (!arr.length) continue; const L = T3(k); for (const l of L) { const im = new THREE.InstancedMesh(l.g, R3.mats[l.m], arr.length); arr.forEach((mt, i) => im.setMatrixAt(i, mt)); im.castShadow = R3.q > 0 && k !== 'cwall'; im.receiveShadow = true; im.frustumCulled = false; M3.group.add(im); M3.walls.push(im); } }
}
function r3BuildChunk(M3, cx, cy) {
  const m = M3.m, g = new THREE.Group(), inst = {}, specials = [];
  const add = (key, X, Y, Z, ry, s) => { (inst[key] || (inst[key] = [])).push(M4(X, Y, Z, 0, ry, 0, s, s, s)); };
  const isF = (x, y) => { const q = oAt(m, x, y); return q && (q.k === 'fence' || q.k === 'gate'); };
  for (let ty = cy * CH3; ty < Math.min(m.h, (cy + 1) * CH3); ty++) for (let tx = cx * CH3; tx < Math.min(m.w, (cx + 1) * CH3); tx++) {
    const o = m.o[ty * m.w + tx]; if (!o) continue;
    const X = tx + .5, Z = ty + .5, Y = r3GroundAt(M3, X, Z), hr = h2(tx, ty), ry = hr * 6.283, sc = .88 + h2(ty, tx) * .24, k = o.k;
    if (SPF[k]) { const sp = SPF[k](o); sp.g.position.set(X, sp.water ? 0 : Y, Z); g.add(sp.g); specials.push(sp); continue; }
    switch (k) {
      case 'tree': add('tree' + (o.v || 0), X, Y, Z, ry, sc); break;
      case 'palm': { const v = o.v || 0, bend = v ? .5 : -.42; add('palm' + v, X, Y, Z, ry, sc); for (let c = 0; c < (o.c || 0); c++) { const lx = bend + Math.cos(c * 2.2) * .12, lz = Math.sin(c * 2.2) * .12, ly = 2.35 - .2; add('coconut', X + (lx * Math.cos(ry) + lz * Math.sin(ry)) * sc, Y + ly * sc, Z + (-lx * Math.sin(ry) + lz * Math.cos(ry)) * sc, 0, 1); } break; }
      case 'bush': add(o.r ? 'bush_r' : 'bush', X, Y, Z, ry, sc); break;
      case 'banana_tree': add('banana', X, Y, Z, ry, sc); if (o.r) add('bananas', X, Y, Z, ry, sc); break;
      case 'rock': add('rock' + (o.v || 0), X, Y, Z, ry, sc); break;
      case 'flower': add('flower' + (o.v || 0), X, Y, Z, ry, 1); break;
      case 'fence': case 'gate':
        add(k === 'gate' ? 'gate' : 'fence_post', X, Y, Z, 0, 1);
        if (isF(tx + 1, ty)) add('rail_x', X + .5, (Y + r3GroundAt(M3, X + 1, Z)) / 2, Z, 0, 1);
        if (isF(tx, ty + 1)) add('rail_z', X, (Y + r3GroundAt(M3, X, Z + 1)) / 2, Z + .5, 0, 1);
        break;
      default: if (T3(k)) add(k, X, Y, Z, ROT0[k] ? 0 : ry, ROT0[k] ? 1 : sc);
    }
  }
  for (const key in inst) {
    const L = T3(key); if (!L) continue; const arr = inst[key];
    for (const l of L) { const im = new THREE.InstancedMesh(l.g, R3.mats[l.m], arr.length); for (let i = 0; i < arr.length; i++) im.setMatrixAt(i, arr[i]); im.instanceMatrix.needsUpdate = true; im.castShadow = l.cs && R3.q > 0; im.receiveShadow = true; im.frustumCulled = false; g.add(im); }
  }
  return { g, specials, cx, cy, dirty: false };
}
function r3DropChunk(M3, key, c) { c.g.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); M3.group.remove(c.g); M3.chunks.delete(key); }
function r3Chunks(M3, X, Z, force) {
  const rad = R3.q === 2 ? 3 : 2, ccx = Math.floor(X / CH3), ccz = Math.floor(Z / CH3), maxX = Math.ceil(M3.m.w / CH3) - 1, maxZ = Math.ceil(M3.m.h / CH3) - 1;
  let budget = force ? 999 : 3;
  for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
    const cx = ccx + dx, cz = ccz + dz; if (cx < 0 || cz < 0 || cx > maxX || cz > maxZ) continue;
    const key = cx + ',' + cz, c = M3.chunks.get(key);
    if (!c && budget > 0) { const nc = r3BuildChunk(M3, cx, cz); M3.chunks.set(key, nc); M3.group.add(nc.g); budget--; }
    else if (c && c.dirty && budget > 0) { r3DropChunk(M3, key, c); const nc = r3BuildChunk(M3, cx, cz); M3.chunks.set(key, nc); M3.group.add(nc.g); budget--; }
  }
  for (const [key, c] of M3.chunks) if (Math.abs(c.cx - ccx) > rad + 1 || Math.abs(c.cy - ccz) > rad + 1) r3DropChunk(M3, key, c);
}
function r3ShowOnly(M3) { for (const x of R3.list) x.group.visible = x === M3; if (R3.voy) R3.voy.g.visible = false; }

// ---------- 光・空 ----------
const SKYK = [[0, '#0a1228'], [4.5, '#101a36'], [5.8, '#e8a070'], [7.2, '#a8cde8'], [12, '#9fd0f0'], [16.3, '#b0d0e6'], [18, '#f09060'], [19.4, '#45304f'], [20.6, '#0d1632'], [24, '#0a1228']];
const SUNK = [[0, '#7080b8'], [5, '#8090c0'], [6, '#ff9a5a'], [7.5, '#ffe2bc'], [12, '#fff6e8'], [16.5, '#ffd8a8'], [18.2, '#ff8048'], [19.3, '#6070a8'], [24, '#7080b8']];
const kfCol = (K, h, out) => { for (let i = 0; i < K.length - 1; i++) { const [h0, c0] = K[i], [h1, c1] = K[i + 1]; if (h >= h0 && h <= h1) { const t = (h - h0) / Math.max(.001, h1 - h0); return out.copy(new THREE.Color(c0)).lerp(new THREE.Color(c1), t); } } return out.set(K[0][1]); };
function r3Env(h, rain, cave, storm, tgt, d) {
  const sky = kfCol(SKYK, h, new THREE.Color()), sunC = kfCol(SUNK, h, new THREE.Color());
  const dark = darknessAt(h) / .86, day = 1 - dark, br = OPT.dark ? .1 : 0;
  let sunI = .28 + 1.9 * day, hemiI = .14 + br + .55 * day;
  if (rain > .05) { const gray = new THREE.Color('#5a6676').lerp(sky, .35); sky.lerp(gray, rain * .75); sunI *= 1 - rain * .65; hemiI *= 1 - rain * .25; }
  if (RT.lightning > 0) { hemiI += RT.lightning * 4; sky.lerp(new THREE.Color('#e8f0ff'), Math.min(1, RT.lightning * 2)); }
  const sc = R3.scene, fogN = cave ? d * .98 : d * (1.05 - rain * .2), fogF = cave ? d * 1.75 : d * (2.5 - rain * .8);
  if (cave) { sky.set('#030205'); sunI = .08; hemiI = .16 + br * .8; }
  sc.background.copy(sky); sc.fog.color.copy(sky); sc.fog.near = fogN; sc.fog.far = fogF;
  // 太陽（夜は月）
  const t = (h - 6) / 12, isDay = t > -.05 && t < 1.05;
  const dir = isDay ? new THREE.Vector3(Math.cos(clamp(t, 0, 1) * Math.PI) * .75, Math.sin(clamp(t, 0, 1) * Math.PI) * .9 + .22, -.45) : new THREE.Vector3(-.35, .85, .35);
  dir.normalize();
  const s = R3.sun; s.color.copy(sunC); s.intensity = sunI; s.position.set(tgt.x + dir.x * 40, tgt.y + dir.y * 40, tgt.z + dir.z * 40); s.target.position.copy(tgt); s.target.updateMatrixWorld();
  const ext = Math.max(14, d * 1.05); const sca = s.shadow.camera; if (sca.right !== ext) { sca.left = -ext; sca.right = ext; sca.top = ext; sca.bottom = -ext; sca.near = 1; sca.far = 100; sca.updateProjectionMatrix(); }
  R3.hemi.intensity = hemiI; R3.hemi.color.copy(sky).lerp(new THREE.Color('#ffffff'), .35); R3.hemi.groundColor.set(cave ? '#1a1420' : '#3a3428');
  // 海の色
  for (const M3 of R3.list) if (M3.water && M3.group.visible) { const u = M3.water.material.uniforms; u.uSunDir.value.copy(dir); u.uSunCol.value.copy(sunC).multiplyScalar(Math.min(1.3, sunI * .55)); u.uSky.value.copy(sky); u.uAmb.value = .25 + hemiI * .45; u.uFogC.value.copy(sky); u.uFogN.value = fogN; u.uFogF.value = fogF; u.uDeep.value.set(dark > .5 ? '#06243a' : '#0d4a6e'); u.uShal.value.set(dark > .5 ? '#1b5a6a' : '#3fb8c8'); }
  return { dir, dark };
}
function r3Lights(cands, px, pz) {
  cands.sort((a, b) => a.dd - b.dd);
  R3.pls.forEach((l, i) => { const c = cands[i]; if (!c) { l.intensity = 0; return; } l.color.setHex(c.c); l.intensity = c.i; l.distance = c.d; l.position.set(c.x, c.y, c.z); });
}

// ---------- キャラクター ----------
function mkMesh(b, mat) { const me = new THREE.Mesh(b.geo(), mat); me.castShadow = R3.q > 0; me.receiveShadow = true; return me; }
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function limb(parent, x, y, z, w, h, d, col, mat) { const pv = pivot(parent, x, y, z), b = new GB(3); b.add(gBox(w, h, d), col, M4(0, -h / 2, 0)); pv.add(mkMesh(b, mat)); return pv; }
function mkHuman() {
  const mat = entMat(), g = new THREE.Group(), body = pivot(g, 0, 0, 0), b = new GB(7);
  b.add(gBox(.34, .36, .2), '#3d74b8', M4(0, .78, 0)); b.add(gBox(.35, .06, .21), '#2a4f80', M4(0, .62, 0)); b.add(gBox(.34, .14, .21), '#8a6a44', M4(0, .54, 0));
  b.add(gBox(.06, .1, .01), '#f4f4f0', M4(0, .88, .105));
  b.add(gBox(.28, .28, .27), '#e7ad7e', M4(0, 1.12, 0)); b.add(gBox(.3, .1, .29), '#3a2418', M4(0, 1.29, 0)); b.add(gBox(.3, .22, .08), '#3a2418', M4(0, 1.17, -.12));
  b.add(gBox(.305, .05, .295), '#d94a4a', M4(0, 1.22, 0)); b.add(gBox(.04, .14, .04), '#d94a4a', M4(-.08, 1.15, -.16, .4, 0, 0));
  b.add(gBox(.045, .05, .01), '#1a1010', M4(-.065, 1.13, .136)); b.add(gBox(.045, .05, .01), '#1a1010', M4(.065, 1.13, .136));
  body.add(mkMesh(b, mat));
  const legs = [limb(body, -.085, .48, 0, .12, .46, .13, '#bf7f52', mat), limb(body, .085, .48, 0, .12, .46, .13, '#bf7f52', mat)];
  const arms = [limb(body, -.22, .94, 0, .1, .38, .11, '#e7ad7e', mat), limb(body, .22, .94, 0, .1, .38, .11, '#e7ad7e', mat)];
  const hand = pivot(arms[1], 0, -.36, .02);
  return { g, body, legs, arms, hand, mat, held: null, heldId: null, yaw: 0 };
}
function mkHeld(id) {
  const d = IT[id]; if (!d) return null;
  const g = new THREE.Group(), b = new GB(5), headCol = /iron|sword|lantern/.test(id) ? '#d8dee6' : '#8a8e96';
  let mat = 'std';
  if (d.tool && d.tool.cls === 'axe') { b.add(gCyl(.022, .025, .6, 5), '#8f5a32', M4(0, .3, 0)); b.add(gBox(.04, .14, .17), headCol, M4(0, .55, .07)); mat = 'metal'; }
  else if (d.tool && d.tool.cls === 'pick') { b.add(gCyl(.022, .025, .6, 5), '#8f5a32', M4(0, .3, 0)); b.add(gBox(.04, .05, .42), headCol, M4(0, .58, 0, -.2, 0, 0)); mat = 'metal'; }
  else if (d.tool && d.tool.cls === 'shovel') { b.add(gCyl(.02, .022, .7, 5), '#8f5a32', M4(0, .35, 0)); b.add(gBox(.16, .2, .02), headCol, M4(0, .78, 0)); mat = 'metal'; }
  else if (d.tool && d.tool.cls === 'hammer') { b.add(gCyl(.022, .025, .5, 5), '#8f5a32', M4(0, .25, 0)); b.add(gBox(.1, .1, .22), headCol, M4(0, .5, 0)); mat = 'metal'; }
  else if (id === 'iron_sword') { b.add(gBox(.04, .14, .04), '#6b4226', M4(0, .07, 0)); b.add(gBox(.04, .03, .2), '#d4a83a', M4(0, .15, 0)); b.add(gBox(.025, .6, .07), '#e0e6ec', M4(0, .46, 0)); mat = 'metal'; }
  else if (id === 'wood_spear' || id === 'stone_spear') { b.add(gCyl(.02, .022, 1.2, 5), '#a07040', M4(0, .45, 0)); b.add(gCone(.045, .16, 5), id === 'stone_spear' ? '#3a3f4a' : '#c98e4f', M4(0, 1.12, 0)); }
  else if (d.bow) { b.add(new THREE.TorusGeometry(.32, .018, 4, 12, Math.PI), '#8f5a32', M4(0, .32, 0, 0, Math.PI / 2, Math.PI / 2)); b.add(gBox(.005, .64, .005), '#f4f4f0', M4(0, .32, 0)); }
  else if (d.rod) { b.add(gCyl(.012, .02, 1.3, 5), '#a07040', M4(0, .6, 0)); b.add(gCyl(.04, .04, .04, 8), '#59616b', M4(0, .15, .04, Math.PI / 2, 0, 0)); }
  else if (id === 'torch') { b.add(gCyl(.025, .03, .5, 5), '#6b4226', M4(0, .25, 0)); b.add(gCyl(.045, .035, .1, 6), '#3a2a1e', M4(0, .52, 0)); const f = sprite(R3.mats.flame, .22, .38, .7); g.add(f); g.userData.flame = f; }
  else if (id === 'lantern') { b.add(gBox(.16, .2, .16), '#59616b', M4(0, .05, 0)); b.add(gCyl(.04, .04, .04, 6), '#59616b', M4(0, .18, 0)); const f = sprite(R3.mats.glowB, .45, .45, .05); g.add(f); mat = 'metal'; }
  else { // それ以外はアイコンを手に持つ
    const s = new THREE.Sprite(r3IconMat(d.ic)); s.scale.set(.32, .32, 1); s.position.y = .12; g.add(s); return g;
  }
  const me = new THREE.Mesh(b.geo(), R3.mats[mat]); me.castShadow = R3.q > 0; g.add(me);
  return g;
}
function r3IconMat(ic) {
  if (R3.iconMats[ic]) return R3.iconMats[ic];
  const cv = ICON[ic]; let tex = null;
  if (cv) { tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.encoding = THREE.sRGBEncoding; tex.generateMipmaps = false; }
  return (R3.iconMats[ic] = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: .4 }));
}
function mkQuad(o) {
  const mat = entMat(), g = new THREE.Group(), body = pivot(g, 0, 0, 0), b = new GB(o.seed || 3);
  b.add(blob(.5, 1, .06, 2, true), o.col, M4(0, o.h, 0, 0, 0, 0, o.w, o.bh, o.len));
  b.add(blob(.5, 1, .05, 4, true), o.col, M4(0, o.h + o.hy, o.len * .48 + o.hl * .25, 0, 0, 0, o.hw, o.hh, o.hl));
  if (o.extra) o.extra(b);
  body.add(mkMesh(b, mat));
  const ly = o.h - o.bh * .3, ll = ly - .02, legs = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) legs.push(limb(body, x * o.w * .3, ly, z * o.len * .3, .08, ll, .08, o.dk, mat));
  let tail = null; if (o.tail) { tail = pivot(body, 0, o.h + o.bh * .2, -o.len * .48); const tb = new GB(4); tb.add(gCyl(.02, .045, o.tail, 5), o.dk, M4(0, 0, -o.tail / 2, Math.PI / 2 + .5, 0, 0)); tail.add(mkMesh(tb, mat)); }
  g.scale.setScalar(o.sc || 1);
  return { g, body, mat, anim(e, t, mv) { const s = mv ? Math.sin(t * o.step) * .6 : 0; legs[0].rotation.x = s; legs[3].rotation.x = s; legs[1].rotation.x = -s; legs[2].rotation.x = -s; body.position.y = mv ? Math.abs(Math.sin(t * o.step)) * .03 : 0; if (tail) tail.rotation.y = Math.sin(t * 6) * .3; body.rotation.x = e.st === 'wind' || e.st === 'dash' ? .15 : 0; } };
}
function mkMob(k) {
  if (k === 'crab' || k === 'kingcrab') {
    const king = k === 'kingcrab', mat = entMat(), g = new THREE.Group(), body = pivot(g, 0, 0, 0), b = new GB(5), col = king ? '#b8301e' : '#d0552c', dk = king ? '#7a1e12' : '#9a3a1e';
    b.add(blob(.2, 1, .05, 3, true), col, M4(0, .16, 0, 0, 0, 0, 1.25, .55, 1));
    for (const x of [-.06, .06]) { b.add(gCyl(.015, .015, .1, 4), dk, M4(x, .25, .12)); b.add(gSph(.03, 6, 4), '#111111', M4(x, .31, .12)); }
    body.add(mkMesh(b, mat));
    const claws = [-1, 1].map(s => { const pv = pivot(body, s * .2, .16, .14), c = new GB(7); c.add(gBox(.06, .06, .14), dk, M4(0, 0, .06)); c.add(blob(.08, 0, 0, 1, true), col, M4(0, .02, .16, 0, 0, 0, 1, .7, 1.3)); pv.add(mkMesh(c, mat)); return pv; });
    const legs = []; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const pv = pivot(body, s * .2, .14, -.06 + i * .08), l = new GB(9); l.add(gBox(.18, .025, .025), dk, M4(s * .09, -.04, 0, 0, 0, s * -.5)); pv.add(mkMesh(l, mat)); legs.push([pv, s, i]); }
    if (king) { const c = new GB(11); c.add(gCyl(.1, .1, .05, 8), '#ffd24a', M4(0, .3, 0)); for (let q = 0; q < 5; q++) { const a = q / 5 * 6.28; c.add(gCone(.022, .08, 4), '#ffd24a', M4(Math.cos(a) * .09, .36, Math.sin(a) * .09)); } c.add(gSph(.022, 5, 4), '#ff3355', M4(0, .32, .1)); body.add(new THREE.Mesh(c.geo(), R3.mats.metal)); }
    g.scale.setScalar(king ? 3.2 : 1.35);
    return { g, mat, anim(e, t, mv) { for (const [pv, s, i] of legs) pv.rotation.z = Math.sin(t * 14 + i * 2 + (s > 0 ? 0 : 3)) * (mv ? .35 : .05); const sn = /W$/.test(e.st) || e.st === 'snap' ? 1 : 0; for (const c of claws) c.rotation.x = -.3 - sn * .7 + Math.sin(t * 3) * .1; } };
  }
  if (k === 'boar') return mkQuad({ col: '#6e4a35', dk: '#43291c', h: .42, w: .34, bh: .3, len: .52, hy: -.02, hw: .22, hh: .2, hl: .3, step: 12, tail: .14, sc: 1.6, extra: b => { b.add(gCyl(.05, .06, .07, 8), '#b07a60', M4(0, .38, .47, Math.PI / 2, 0, 0)); for (const x of [-.05, .05]) { b.add(gCone(.012, .07, 4), '#ece2cc', M4(x, .36, .46, -1.2, 0, 0)); b.add(gCone(.035, .08, 4), '#43291c', M4(x * 1.6, .49, .3, -.3, 0, x * 5)); b.add(gSph(.016, 4, 3), '#110a08', M4(x * 1.3, .44, .43)); } } });
  if (k === 'wolf') return mkQuad({ col: '#9aa1a8', dk: '#5c6169', h: .46, w: .26, bh: .26, len: .55, hy: .08, hw: .18, hh: .18, hl: .3, step: 14, tail: .4, seed: 9, sc: 1.55, extra: b => { b.add(gBox(.09, .07, .14), '#8a9198', M4(0, .5, .52)); b.add(gSph(.022, 5, 4), '#111111', M4(0, .52, .6)); for (const x of [-.055, .055]) { b.add(gCone(.035, .1, 4), '#5c6169', M4(x, .66, .32)); b.add(gBox(.03, .02, .01), '#ffd24a', M4(x, .57, .47)); } } });
  if (k === 'monkey') { const mq = mkQuad({ col: '#7a5038', dk: '#5a3a26', h: .38, w: .26, bh: .32, len: .3, hy: .22, hw: .22, hh: .22, hl: .22, step: 13, tail: .45, seed: 7, sc: 1.25, extra: b => { b.add(gBox(.16, .12, .04), '#e7ad7e', M4(0, .6, .33)); for (const x of [-.04, .04]) b.add(gSph(.018, 4, 3), '#111111', M4(x, .62, .35)); for (const x of [-.12, .12]) b.add(gSph(.04, 5, 4), '#e7ad7e', M4(x, .64, .22)); } }); mq.body.rotation.x = -.3; return mq; }
  if (k === 'snake') {
    const mat = entMat(), g = new THREE.Group(), segs = [];
    for (let i = 0; i < 9; i++) { const b = new GB(i), r = .065 - i * .004; b.add(gSph(r, 7, 5), i % 2 ? '#8a9a4e' : '#5d6b2a', M4(0, r, 0, 0, 0, 0, 1, .8, 1.3)); if (i === 0) { b.add(gSph(.015, 4, 3), '#111111', M4(-.035, .08, .05)); b.add(gSph(.015, 4, 3), '#111111', M4(.035, .08, .05)); b.add(gBox(.01, .005, .07), '#c83030', M4(0, .05, .1)); } const me = mkMesh(b, mat); g.add(me); segs.push(me); }
    return { g, mat, anim(e, t, mv) { segs.forEach((s, i) => { s.position.z = .2 - i * .09; s.position.x = Math.sin(t * (mv ? 9 : 2) - i * .9) * .07 * (i ? 1 : .3); s.position.y = e.st === 'wind' && i < 3 ? .12 - i * .04 : 0; }); } };
  }
  if (k === 'gull') {
    const mat = entMat(), g = new THREE.Group(), body = pivot(g, 0, 0, 0), b = new GB(3);
    b.add(blob(.12, 1, .03, 1, true), '#f4f4f0', M4(0, .2, 0, 0, 0, 0, .9, .8, 1.5)); b.add(gSph(.08, 7, 5), '#f4f4f0', M4(0, .3, .15)); b.add(gCone(.025, .1, 4), '#ffa300', M4(0, .29, .25, Math.PI / 2, 0, 0)); b.add(gBox(.02, .12, .02), '#ffa300', M4(-.04, .07, 0)); b.add(gBox(.02, .12, .02), '#ffa300', M4(.04, .07, 0));
    body.add(mkMesh(b, mat)); const wings = [-1, 1].map(s => { const pv = pivot(body, s * .1, .24, 0), w = new GB(4); w.add(gBox(.36, .02, .14), '#c2c3c7', M4(s * .18, 0, 0)); w.add(gBox(.1, .021, .1), '#3a3f4a', M4(s * .33, 0, -.02)); pv.add(mkMesh(w, mat)); return [pv, s]; });
    return { g, mat, anim(e, t) { const fly = e.fl; for (const [pv, s] of wings) pv.rotation.z = fly ? Math.sin(t * 16) * .8 * s : s * -.1; body.rotation.x = fly ? 0 : Math.max(0, Math.sin(t * 3)) * .3; } };
  }
  if (k === 'bat') {
    const mat = entMat(), g = new THREE.Group(), body = pivot(g, 0, 0, 0), b = new GB(3);
    b.add(gSph(.1, 7, 5), '#3a3355', M4(0, 0, 0)); for (const x of [-.04, .04]) { b.add(gCone(.025, .07, 4), '#3a3355', M4(x, .1, 0)); } const be = new GB(4); be.add(gBox(.025, .02, .01), '#ff3355', M4(-.035, .02, .09)); be.add(gBox(.025, .02, .01), '#ff3355', M4(.035, .02, .09));
    body.add(mkMesh(b, mat)); body.add(new THREE.Mesh(be.geo(), R3.mats.emis));
    const wings = [-1, 1].map(s => { const pv = pivot(body, s * .08, .02, 0), w = new GB(4); w.add(gBox(.32, .015, .2), '#2b2644', M4(s * .16, 0, 0)); pv.add(mkMesh(w, mat)); return [pv, s]; });
    return { g, mat, anim(e, t) { for (const [pv, s] of wings) pv.rotation.z = Math.sin(t * 22) * .9 * s; } };
  }
  if (k === 'spider') {
    const mat = entMat(), g = new THREE.Group(), body = pivot(g, 0, 0, 0), b = new GB(3);
    b.add(blob(.18, 1, .05, 2, true), '#3a3a40', M4(0, .22, -.12, 0, 0, 0, 1, .8, 1.2)); b.add(gSph(.11, 8, 6), '#2a2a30', M4(0, .2, .12));
    const be = new GB(4); for (const x of [-.04, .04, -.02, .02]) be.add(gSph(.018, 4, 3), '#ff3355', M4(x, .25 + (Math.abs(x) < .03 ? .03 : 0), .22)); body.add(mkMesh(b, mat)); body.add(new THREE.Mesh(be.geo(), R3.mats.emis));
    const legs = []; for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const pv = pivot(body, s * .08, .22, .12 - i * .07), l = new GB(9); l.add(gBox(.3, .025, .025), '#2a2a30', M4(s * .14, .06, 0, 0, 0, s * .45)); l.add(gBox(.22, .022, .022), '#2a2a30', M4(s * .33, -.04, 0, 0, 0, s * -.9)); pv.add(mkMesh(l, mat)); pv.rotation.y = (i - 1.5) * .35 * s; legs.push([pv, s, i]); }
    return { g, mat, anim(e, t, mv) { for (const [pv, s, i] of legs) pv.rotation.z = Math.sin(t * 16 + i * 1.6) * (mv ? .3 : .05); } };
  }
  if (k === 'golem') {
    const mat = entMat(), g = new THREE.Group(), body = pivot(g, 0, 0, 0), b = new GB(9);
    b.add(gBox(1.0, .95, .6), '#8a7f9a', M4(0, 1.45, 0)); b.add(gBox(.8, .3, .55), '#7a7090', M4(0, .92, 0)); b.add(gBox(.55, .45, .48), '#8a7f9a', M4(0, 2.15, .02));
    for (let i = 0; i < 5; i++) b.add(blob(.12, 0, .3, i, true), '#5e8a4a', M4(-.4 + i * .2, 1.92, (i % 2 ? .3 : -.3)));
    body.add(mkMesh(b, mat));
    const gl = new GB(3); gl.add(gBox(.12, .07, .02), '#d0a0ff', M4(-.12, 2.18, .27)); gl.add(gBox(.12, .07, .02), '#d0a0ff', M4(.12, 2.18, .27)); gl.add(gBox(.2, .2, .02), '#a060e0', M4(0, 1.5, .31)); gl.add(gBox(.5, .03, .02), '#a060e0', M4(0, 1.25, .31)); body.add(new THREE.Mesh(gl.geo(), R3.mats.emis));
    const arms = [-1, 1].map(s => { const pv = pivot(body, s * .65, 1.8, 0), a = new GB(5); a.add(gBox(.34, .9, .34), '#7a7090', M4(0, -.45, 0)); a.add(gBox(.42, .38, .42), '#8a7f9a', M4(0, -1.0, 0)); pv.add(mkMesh(a, mat)); return pv; });
    const legs = [-1, 1].map(s => limb(body, s * .26, .8, 0, .34, .8, .38, '#6e6480', mat));
    return { g, mat, anim(e, t, mv) {
      const w = mv ? Math.sin(t * 5) * .35 : 0; legs[0].rotation.x = w; legs[1].rotation.x = -w;
      let a = -w * .6; if (e.st === 'slamW') a = -2.8; else if (e.st === 'throwW') a = -1.6; else if (e.st === 'chargeW' || e.st === 'charge') a = -1.2;
      arms[0].rotation.x += (a - arms[0].rotation.x) * .2; arms[1].rotation.x += ((e.st === 'throwW' ? 0 : a) - arms[1].rotation.x) * .2; body.rotation.x = e.st === 'charge' ? .3 : 0;
    } };
  }
  const mat = entMat(), g = new THREE.Group(), b = new GB(1); b.add(gBox(.3, .3, .3), '#888888', M4(0, .15, 0)); g.add(mkMesh(b, mat)); return { g, mat, anim() { } };
}
const lerpAng = (a, b, t) => { let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * t; };

// ---------- 毎フレームの描画（ゲーム） ----------
const _v = () => new THREE.Vector3();
function r3Frame() { const now = RT.clock, dt = clamp(now - (R3.last || now), 0, .1); R3.last = now; R3.u.uTime.value = now; R3.pitch += (R3.pitchT - R3.pitch) * Math.min(1, dt * 3.5); return dt; }
function r3CamSetup(X, Y, Z, dt, pitchOverride) {
  const cam = R3.cam, asp = cam.aspect, vf = 38 * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp);
  const wantW = (RT.vw / 16) / 2 * .8, wantH = (RT.vh / 16) / 2 * .8;
  const d = clamp(Math.max(wantW / Math.tan(hf / 2), wantH / Math.tan(vf / 2) * .78), 7, 24);
  if (!R3.camInit || Math.hypot(X - R3.cx, Z - R3.cz) > 6) { R3.cx = X; R3.cy = Y; R3.cz = Z; R3.camInit = true; }
  const k = Math.min(1, dt * 9); R3.cx += (X - R3.cx) * k; R3.cz += (Z - R3.cz) * k; R3.cy += (Y - R3.cy) * Math.min(1, dt * 4);
  const pr = (pitchOverride || R3.pitch) * Math.PI / 180;
  let sx = 0, sz = 0; if (RT.shake > 0) { sx = rand(-1, 1) * RT.shake * .02; sz = rand(-1, 1) * RT.shake * .02; }
  cam.position.set(R3.cx + sx, R3.cy + d * Math.sin(pr), R3.cz + d * Math.cos(pr) + sz); cam.lookAt(R3.cx + sx, R3.cy, R3.cz + sz);
  cam.updateMatrixWorld(); return d;
}
function r3Render() {
  if (!r3On()) return false;
  const dt = r3Frame(), m = G.map, M3 = r3Map(m); r3ShowOnly(M3); R3.dyn.visible = true;
  const p = G.p, X = p.x / TS, Z = (p.y - 2) / TS, gy = r3GroundAt(M3, X, Z);
  const d = r3CamSetup(X, Math.max(gy, -.2) + .45, Z, dt);
  r3Chunks(M3, X, Z, !M3.built); M3.built = true;
  if (M3.normDirty) { M3.terrain.geometry.computeVertexNormals(); M3.normDirty = false; }
  const tgt = new THREE.Vector3(R3.cx, R3.cy, R3.cz);
  r3Env(hour(), m.id === 'island' ? G.rain : 0, m.id === 'cave', G.weather === 'storm', tgt, d);
  const cands = [], t = RT.clock;
  for (const [, c] of M3.chunks) for (const sp of c.specials) { sp.upd(t, dt); if (sp.light) { const wx = sp.g.position.x, wz = sp.g.position.z; cands.push({ c: sp.light.c, i: sp.light.i, d: sp.light.d, x: wx, y: sp.g.position.y + sp.light.y, z: wz, dd: (wx - X) ** 2 + (wz - Z) ** 2 }); } }
  if (m.id === 'cave') for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) { const o = oAt(m, Math.floor(X) + i, Math.floor(Z) + j); if (o && o.k === 'crystal_rock') cands.push({ c: 0xb070ff, i: .8, d: 3.5, x: o.x + .5, y: r3GroundAt(M3, o.x + .5, o.y + .5) + .5, z: o.y + .5, dd: 30 + i * i + j * j }); }
  r3Player(M3, dt, cands, X, Z, gy);
  r3Ents(M3, dt); r3Drops(M3); r3Projs(M3); r3Parts(M3); r3Marker(M3); r3Tele(M3); r3Rain(m.id === 'island' ? G.rain : 0, G.weather === 'storm', dt); r3Ship(M3); r3Treasure(M3);
  r3Lights(cands, X, Z);
  r3See(X, gy + .8, Z);
  R3.cvs.style.display = 'block';
  R3.ren.render(R3.scene, R3.cam);
  return true;
}
function r3See(X, Y, Z) {
  const u = R3.u, v = new THREE.Vector3(X, Y, Z).project(R3.cam), s = new THREE.Vector2(); R3.ren.getDrawingBufferSize(s);
  u.uPS.value.set((v.x * .5 + .5) * s.x, (v.y * .5 + .5) * s.y); u.uPD.value = v.z * .5 + .5 - .002; u.uPR.value = s.y * .11; u.uSee.value = R3.pitch < 80 ? 1 : 0;
}
function r3Player(M3, dt, cands, X, Z, gy) {
  const p = G.p; if (!R3.pl) { R3.pl = mkHuman(); R3.dyn.add(R3.pl.g); const sh = new THREE.Mesh(new THREE.PlaneGeometry(.7, .7), R3.mats.shadow); sh.rotation.x = -Math.PI / 2; R3.pl.shadow = sh; R3.dyn.add(sh); }
  const P = R3.pl, g = P.g, t = RT.clock;
  g.position.set(X, gy, Z); P.shadow.position.set(X, Math.max(gy, .01) + .02, Z); P.shadow.visible = gy > -.05;
  const want = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][p.dir]; P.yaw = lerpAng(P.yaw, want, Math.min(1, dt * 14)); g.rotation.y = P.yaw;
  const s = held(), id = s ? s.id : null;
  if (id !== P.heldId) { if (P.held) P.hand.remove(P.held); P.held = id ? mkHeld(id) : null; if (P.held) { P.held.rotation.x = Math.PI / 2 - .3; P.hand.add(P.held); } P.heldId = id; }
  const ph = p.anim * 1.6, walk = p.moving ? Math.sin(ph) * .7 : 0;
  P.legs[0].rotation.x = walk; P.legs[1].rotation.x = -walk; P.arms[0].rotation.x = -walk * .7;
  let ra = walk * .7;
  if (p.swing > 0) { const pr = Math.min(1, p.swing / p.swDur), e = 1 - Math.pow(1 - pr, 3); ra = lerp(-3.0, -.35, e); }
  else if (p.fishing) ra = -1.1;
  else if (p.pick) ra = -.8 + Math.sin(t * 20) * .1;
  P.arms[1].rotation.x = ra;
  P.body.position.y = p.moving ? Math.abs(Math.sin(ph)) * .035 : 0;
  g.rotation.x = 0; g.visible = !(p.inv > 0 && p.hurtFlash <= 0 && Math.floor(t * 16) % 2 === 0);
  if (p.dead) { g.rotation.x = -Math.PI / 2; g.position.y = gy + .15; g.visible = true; }
  P.mat.emissive.setRGB(p.hurtFlash > 0 ? .8 : 0, p.hurtFlash > 0 ? .15 : 0, p.hurtFlash > 0 ? .15 : 0);
  // 持っている明かり
  const d = s && IT[s.id];
  const wpos = new THREE.Vector3(); P.hand.getWorldPosition(wpos);
  if (P.held && P.held.userData.flame) { const k = flick(t, 7); P.held.userData.flame.scale.set(.22, .38 + k, 1); }
  const cv = G.mapId === 'cave';
  if (d && d.light) cands.push({ c: d.burn ? 0xffa050 : 0xd0f0ff, i: (d.burn ? 1.9 : 1.7) * (cv ? 1.35 : 1), d: (d.burn ? 7.5 : 9) * (cv ? 1.25 : 1), x: wpos.x, y: wpos.y + .4, z: wpos.z, dd: -1 });
  else if (darknessAt(hour()) > .3 || cv) cands.push({ c: 0xbcc8ff, i: cv ? .8 : .55, d: cv ? 4.5 : 3.6, x: X, y: gy + 1.4, z: Z, dd: -.5 });
  // 釣り糸
  if (p.fishing && p.fishing.ph !== 'cast') {
    if (!R3.line) { R3.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), R3.mats.line); R3.line.frustumCulled = false; R3.bob = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3355 })); R3.dyn.add(R3.line, R3.bob); }
    const f = p.fishing, bx = f.bx / TS, bz = f.by / TS, by = (f.ph === 'bite' ? -.04 : .02) + Math.sin(t * 3) * .02;
    const tip = new THREE.Vector3(); if (P.held) { P.held.localToWorld(tip.set(0, 1.25, 0)); } else tip.copy(wpos);
    const pts = []; for (let i = 0; i <= 10; i++) { const k = i / 10; pts.push(new THREE.Vector3(lerp(tip.x, bx, k), lerp(tip.y, by, k) - Math.sin(k * Math.PI) * .3, lerp(tip.z, bz, k))); }
    R3.line.geometry.setFromPoints(pts); R3.bob.position.set(bx, by, bz); R3.line.visible = R3.bob.visible = true;
  } else if (R3.line) R3.line.visible = R3.bob.visible = false;
}
function r3Ents(M3, dt) {
  const m = G.map, seen = new Set(), t = RT.clock;
  for (const e of m.ents) {
    if (e.dead) continue; seen.add(e);
    let E = R3.ents.get(e);
    if (!E) { E = mkMob(e.k); E.yaw = 0; E.px = e.x; E.pz = e.y; R3.dyn.add(E.g); R3.ents.set(e, E); }
    const X = e.x / TS, Z = (e.y - 2) / TS, gy = r3GroundAt(M3, X, Z), dx = e.x - E.px, dz = e.y - E.pz, mv = Math.hypot(dx, dz) > .05;
    E.px = e.x; E.pz = e.y;
    if (mv) E.yaw = lerpAng(E.yaw, Math.atan2(dx, dz), Math.min(1, dt * 10)); else if (e.st === 'chase' || /W$/.test(e.st) || e.st === 'wind') E.yaw = lerpAng(E.yaw, Math.atan2(G.p.x - e.x, G.p.y - e.y), Math.min(1, dt * 6));
    const fly = (e.k === 'bat') || (e.k === 'gull' && e.fl);
    E.g.position.set(X, Math.max(gy, e.def.land ? gy : -.25) + (fly ? 1.1 + Math.sin(t * 4 + e.anim) * .12 : 0), Z); E.g.rotation.y = E.yaw;
    if (/W$/.test(e.st) || e.st === 'wind') E.g.position.x += Math.sin(t * 50) * .015;
    E.g.visible = !e.hidden; E.anim(e, t + e.anim, mv);
    E.mat.emissive.setRGB(e.hurt > 0 ? 1 : 0, e.hurt > 0 ? 1 : 0, e.hurt > 0 ? 1 : 0);
    if (e.hidden) { if (!E.mound) { E.mound = new THREE.Mesh(T3('clay_o')[0].g, R3.mats.plain); E.mound.scale.set(2.2, 3, 2.2); R3.dyn.add(E.mound); } E.mound.visible = true; E.mound.position.set(X, gy, Z); E.mound.rotation.y = t * 2; }
    else if (E.mound) E.mound.visible = false;
  }
  for (const [e, E] of R3.ents) if (!seen.has(e)) { R3.dyn.remove(E.g); if (E.mound) R3.dyn.remove(E.mound); E.mat.dispose(); R3.ents.delete(e); }
}
function r3Drops(M3) {
  const m = G.map, seen = new Set(), t = RT.clock;
  for (const d of m.drops) {
    seen.add(d); let S = R3.drops.get(d);
    if (!S) { S = new THREE.Sprite(r3IconMat(IT[d.id] ? IT[d.id].ic : 'page')); S.scale.set(.42, .42, 1); R3.dyn.add(S); R3.drops.set(d, S); }
    const X = d.x / TS, Z = (d.y - 2) / TS; S.position.set(X, Math.max(r3GroundAt(M3, X, Z), -.1) + .26 + d.z / TS + (d.z > 0 ? 0 : Math.sin(t * 4 + d.x) * .04), Z);
    S.visible = !(d.age > 840 && Math.floor(t * 8) % 2);
  }
  for (const [d, S] of R3.drops) if (!seen.has(d)) { R3.dyn.remove(S); R3.drops.delete(d); }
}
function r3Projs(M3) {
  const seen = new Set();
  for (const q of RT.projs) {
    seen.add(q); let me = R3.projs.get(q);
    if (!me) {
      let geo, mat;
      if (q.type === 'arrow') { geo = new THREE.CylinderGeometry(.015, .015, .5, 4); geo.rotateX(Math.PI / 2); mat = new THREE.MeshStandardMaterial({ color: 0xc98e4f }); }
      else if (q.type === 'bubble') { geo = new THREE.SphereGeometry(.12, 8, 6); mat = new THREE.MeshStandardMaterial({ color: 0x9fe0f4, transparent: true, opacity: .6, roughness: .05 }); }
      else { geo = new THREE.IcosahedronGeometry(q.type === 'rock' ? .18 : .07, 0); mat = new THREE.MeshStandardMaterial({ color: q.type === 'rock' ? 0x6e6480 : 0x6b4226, flatShading: true }); }
      me = new THREE.Mesh(geo, mat); me.castShadow = R3.q > 0; R3.dyn.add(me); R3.projs.set(q, me);
    }
    const X = q.x / TS, Z = (q.y + 4) / TS; me.position.set(X, Math.max(r3GroundAt(M3, X, Z), 0) + .6, Z); me.visible = true;
    if (q.type === 'arrow') me.rotation.y = Math.atan2(q.vx, q.vy); else me.rotation.set(q.rot || 0, q.rot || 0, 0);
  }
  for (const [q, me] of R3.projs) if (!seen.has(q)) { R3.dyn.remove(me); me.geometry.dispose(); me.material.dispose(); R3.projs.delete(q); }
}
function r3Parts(M3) {
  const P = R3.parts.geometry.attributes.position, C = R3.parts.geometry.attributes.color, n = Math.min(600, RT.parts.length), col = new THREE.Color();
  for (let i = 0; i < n; i++) { const q = RT.parts[i], X = q.x / TS, Z = q.y / TS; P.setXYZ(i, X, Math.max(r3GroundAt(M3, X, Z), 0) + .15 + q.z / TS * 1.2, Z); col.set(q.c); C.setXYZ(i, col.r, col.g, col.b); }
  R3.parts.geometry.setDrawRange(0, n); P.needsUpdate = true; C.needsUpdate = true; R3.parts.visible = true;
}
function r3Marker(M3) {
  const mk = R3.marker, a = RT.act, tg = RT.tg, p = G.p;
  if (R3.ghost) { R3.dyn.remove(R3.ghost); R3.ghost = null; }
  if (!(G.mode === 'play' && a && tg && !p.fishing && (a.place || (a.tgt && tg.o)))) { mk.visible = false; return; }
  const X = tg.x + .5, Z = tg.y + .5, Y = r3GroundAt(M3, X, Z); mk.visible = true; mk.position.set(X, Math.max(Y, 0) + .04, Z);
  const pulse = 1 + Math.sin(RT.clock * 6) * .06; mk.scale.set(pulse, 1, pulse);
  mk.userData.mat.color.set(a.bad ? 0xff5060 : a.place ? 0x7cff9a : 0xffffff);
  if (a.place) { const s = held(), k = s && IT[s.id].place, key = PLACE3[k]; if (key && T3(key)) { const gr = new THREE.Group(); for (const l of T3(key)) gr.add(new THREE.Mesh(l.g, a.bad ? R3.mats.ghostNg : R3.mats.ghostOk)); gr.position.set(X, k === 'raft' ? 0 : Y, Z); R3.ghost = gr; R3.dyn.add(gr); } }
  if (p.pick && p.pickT > .1) mk.userData.mat.color.setRGB(.5 + p.pickT * .5, 1, .6);
}
function r3Tele(M3) {
  for (const t of R3.tele) t.visible = false; let n = 0;
  const get = () => { let me = R3.tele[n]; if (!me) { me = new THREE.Mesh(new THREE.CircleGeometry(1, 32), R3.mats.tele); me.rotation.x = -Math.PI / 2; R3.dyn.add(me); R3.tele.push(me); } n++; me.visible = true; return me; };
  for (const e of G.map.ents) {
    if (e.dead) continue; const X = e.x / TS, Z = (e.y - 2) / TS, Y = Math.max(r3GroundAt(M3, X, Z), 0) + .05;
    if (e.st === 'slamW' || e.st === 'emergeW') { const r = (e.st === 'slamW' ? 50 : 36) / TS, me = get(); me.position.set(X, Y, Z); me.scale.set(r, r, 1); }
    else if (e.st === 'chargeW' && e.cx != null) { for (let k = 1; k <= 6; k++) { const me = get(); me.position.set(X + e.cx * k * 1.2, Y, Z + e.cy * k * 1.2); me.scale.set(.35, .35, 1); } }
  }
  R3.mats.tele.opacity = .25 + Math.abs(Math.sin(RT.clock * 10)) * .2;
}
function r3Rain(r, storm, dt) {
  const R = R3.rain; R.visible = r > .05; if (!R.visible) return;
  R.material.opacity = Math.min(.65, r * .7); const n = R.userData.n, P = R.geometry.attributes.position, rp = R3.rainP, wind = storm ? .35 : .1, sp = storm ? 24 : 18;
  const cx = R3.cx, cy = R3.cy, cz = R3.cz, act = Math.floor(n * Math.min(1, r * 1.2));
  for (let i = 0; i < n; i++) {
    rp[i * 3 + 1] -= sp * dt; rp[i * 3] += wind * sp * dt * .2; if (rp[i * 3 + 1] < -1) { rp[i * 3 + 1] = rand(10, 14); rp[i * 3] = rand(-16, 16); rp[i * 3 + 2] = rand(-16, 16); }
    const x = cx + rp[i * 3], y = cy + rp[i * 3 + 1], z = cz + rp[i * 3 + 2];
    if (i < act) { P.setXYZ(i * 2, x, y, z); P.setXYZ(i * 2 + 1, x - wind * .5, y - .55, z); } else { P.setXYZ(i * 2, 0, -50, 0); P.setXYZ(i * 2 + 1, 0, -50, 0); }
  }
  P.needsUpdate = true;
}
function r3Ship(M3) {
  if (!G.ship || G.mapId !== 'island') { if (R3.shipM) R3.shipM.visible = false; return; }
  if (!R3.shipM) { R3.shipM = new THREE.Group(); layerMeshes('ship', R3.shipM); R3.dyn.add(R3.shipM); }
  const s = G.ship, W = G.maps.island.w * TS, pr = 1 - s.t / s.dur, x = s.dir > 0 ? lerp(-80, W + 80, pr) : lerp(W + 80, -80, pr);
  R3.shipM.visible = true; R3.shipM.position.set(x / TS, Math.sin(RT.clock) * .05, s.y / TS); R3.shipM.rotation.y = s.dir > 0 ? 0 : Math.PI;
}
function r3Treasure(M3) {
  if (!R3.xm) { R3.xm = []; }
  let n = 0;
  if (G.mapId === 'island') for (const tr of G.treasures) if (tr.known && !tr.found) {
    let me = R3.xm[n]; if (!me) { me = new THREE.Group(); const mt = new THREE.MeshBasicMaterial({ color: 0xff3355 }); for (const r of [.78, -.78]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.75, .02, .1), mt); b.rotation.y = r; me.add(b); } R3.dyn.add(me); R3.xm.push(me); }
    me.visible = true; me.position.set(tr.x + .5, r3GroundAt(M3, tr.x + .5, tr.y + .5) + .04, tr.y + .5); n++;
  }
  for (let i = n; i < R3.xm.length; i++) R3.xm[i].visible = false;
}
// 3D表示中の2Dオーバーレイ（数字・HPバー・釣りゲージ・画面効果）
function r3Proj(X, Y, Z) { const v = new THREE.Vector3(X, Y, Z).project(R3.cam); return { x: (v.x * .5 + .5) * window.innerWidth / RT.scale, y: (-v.y * .5 + .5) * window.innerHeight / RT.scale, ok: v.z < 1 }; }
function r3Overlay(ctx) {
  ctx.clearRect(0, 0, RT.vw, RT.vh); const M3 = G.map._r3; if (!M3) return;
  const gyp = (px, py) => Math.max(r3GroundAt(M3, px / TS, py / TS), 0);
  for (const f of RT.floats) { const s = r3Proj(f.x / TS, gyp(f.x, f.y) + 1.1, f.y / TS + .6); if (s.ok) drawNum(ctx, f.txt, Math.round(s.x), Math.round(s.y - f.t * 18), f.col, '#160f1c'); }
  for (const e of G.map.ents) {
    if (e.dead || e.hidden) continue; const top = e.k === 'golem' ? 2.8 : e.k === 'kingcrab' ? 1.3 : e.def.fly ? 1.6 : .9;
    const s = r3Proj(e.x / TS, gyp(e.x, e.y) + top, (e.y - 2) / TS); if (!s.ok) continue;
    if (!e.def.boss && e.hp < e.mhp) { R(ctx, s.x - 7, s.y - 4, 14, 2, '#160f1c'); R(ctx, s.x - 7, s.y - 4, Math.max(1, Math.round(14 * e.hp / e.mhp)), 2, '#ff5a6a'); }
    if (e.st === 'snapW' || (e.st === 'wind' && e.def.ai === 'charger')) drawNum(ctx, '!', Math.round(s.x), Math.round(s.y - 12), '#ff3355', '#160f1c');
  }
  const p = G.p, f = p.fishing;
  if (f) {
    const s = r3Proj(p.x / TS, gyp(p.x, p.y) + 1.7, (p.y - 2) / TS);
    if (f.ph === 'bite') drawNum(ctx, '!', Math.round(s.x), Math.round(s.y - 8), '#ffec27', '#160f1c');
    if (f.ph === 'reel') { const w = 54, x0 = Math.round(s.x - w / 2), sy = Math.round(s.y - 14); R(ctx, x0 - 2, sy - 2, w + 4, 10, '#160f1c'); R(ctx, x0, sy, w, 6, '#1d3550'); R(ctx, x0 + Math.round(f.za * w), sy, Math.max(2, Math.round(f.zw * w)), 6, '#3fd64e'); R(ctx, x0 + Math.round(f.c * (w - 1)), sy - 2, 1, 10, '#ffffff'); for (let i = 0; i < f.need; i++) R(ctx, s.x - f.need * 3 + i * 6, sy + 10, 4, 3, i < f.hits ? '#ffec27' : '#3a3f4a'); for (let i = 0; i < 3; i++) R(ctx, x0 + w + 4, sy + i * 3, 2, 2, i < f.miss ? '#ff3355' : '#3a3f4a'); }
  }
  if (RT.flash > 0) { ctx.fillStyle = 'rgba(255,40,60,' + Math.min(.5, RT.flash * 1.2) + ')'; ctx.fillRect(0, 0, RT.vw, RT.vh); }
  if (RT.lightning > 0) { ctx.fillStyle = 'rgba(235,242,255,' + Math.min(.5, RT.lightning * 1.6) + ')'; ctx.fillRect(0, 0, RT.vw, RT.vh); }
  if (!p.dead && p.hp < 25) { const a = (.18 + Math.sin(RT.clock * 5) * .08); ctx.fillStyle = 'rgba(200,0,30,' + a + ')'; ctx.fillRect(0, 0, RT.vw, 3); ctx.fillRect(0, RT.vh - 3, RT.vw, 3); ctx.fillRect(0, 0, 3, RT.vh); ctx.fillRect(RT.vw - 3, 0, 3, RT.vh); }
}
// ---------- タイトル背景（3D） ----------
function r3RenderDemo() {
  if (!r3On() || !DEMO.m) return false;
  const dt = r3Frame(), M3 = r3Map(DEMO.m); r3ShowOnly(M3);
  const X = (DEMO.x + RT.vw / 2) / TS, Z = (DEMO.y + RT.vh / 2) / TS, gy = Math.max(0, r3GroundAt(M3, X, Z));
  const d = r3CamSetup(X, gy, Z, dt, 44); r3Chunks(M3, X, Z, !M3.built); M3.built = true;
  r3Env(DEMO.h, 0, false, false, new THREE.Vector3(R3.cx, R3.cy, R3.cz), d);
  const cands = []; for (const [, c] of M3.chunks) for (const sp of c.specials) { sp.upd(RT.clock, dt); if (sp.light) cands.push({ c: sp.light.c, i: sp.light.i, d: sp.light.d, x: sp.g.position.x, y: sp.g.position.y + sp.light.y, z: sp.g.position.z, dd: 0 }); }
  r3Lights(cands, X, Z); R3.u.uSee.value = 0;
  R3.dyn.visible = false;
  R3.cvs.style.display = 'block'; R3.ren.render(R3.scene, R3.cam); return true;
}
// ---------- 航海（3D） ----------
function r3RenderVoyage() {
  if (!r3On()) return false;
  const dt = r3Frame(), V = RT.voy; if (!V) return false;
  if (!R3.voy) {
    const g = new THREE.Group(), d = new Uint8Array(4); d[0] = d[1] = d[2] = 0; d[3] = 255; const tex = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat); tex.needsUpdate = true;
    const wg = new THREE.PlaneGeometry(220, 220, [60, 110, 160][R3.q], [60, 110, 160][R3.q]); wg.rotateX(-Math.PI / 2); const water = new THREE.Mesh(wg, r3WaterMat(tex, 1, 1)); water.frustumCulled = false; g.add(water);
    const raft = new THREE.Group(); layerMeshes('raft_base', raft); const sl = new THREE.Group(); layerMeshes('sail', sl); raft.add(sl); const hu = mkHuman(); hu.g.position.set(-.2, .15, .1); hu.g.rotation.y = Math.PI; raft.add(hu.g); g.add(raft);
    const land = new THREE.Group(), lb = new GB(3); lb.add(gBox(60, 1.2, 14), '#3f7d32', M4(0, .3, 0)); lb.add(gBox(62, .6, 16), '#d8c48f', M4(0, .05, 1)); for (let i = 0; i < 30; i++) lb.add(blob(1.2, 0, .1, i, true), '#2f6a28', M4(-28 + i * 2, 1.8, -3 + (i % 3)));
    land.add(new THREE.Mesh(lb.geo(), R3.mats.std)); g.add(land);
    R3.scene.add(g); R3.voy = { g, water, raft, land, obs: new Map(), wu: water.material.uniforms };
  }
  const VV = R3.voy; for (const M3 of R3.list) M3.group.visible = false; VV.g.visible = true;
  const ry = RT.vh * .74, sx = 1 / 16 * 1.25;
  VV.raft.position.set(V.x * sx, .02 + Math.sin(RT.clock * 2) * .06, 0); VV.raft.rotation.z = Math.sin(RT.clock * 1.4) * .05 + V.vx * .0006; VV.raft.visible = !(V.inv > 0 && Math.floor(RT.clock * 16) % 2);
  const seen = new Set();
  for (const o of V.obs) {
    seen.add(o); let me = VV.obs.get(o);
    if (!me) { me = new THREE.Group(); if (o.k === 'rock') layerMeshes('boulder', me); else if (o.k === 'crate') layerMeshes('crate', me); else if (o.k === 'shark') { const b = new GB(3); b.add(gCone(.25, .6, 3), '#5c6169', M4(0, .25, 0, 0, 0, 0, .4, 1, 1.2)); me.add(new THREE.Mesh(b.geo(), R3.mats.std)); } else { const b = new GB(3); b.add(new THREE.TorusGeometry(.9, .14, 6, 16, Math.PI), '#e8f4ff', M4(0, 0, 0, 0, 0, 0)); me.add(new THREE.Mesh(b.geo(), R3.mats.std)); } VV.g.add(me); VV.obs.set(o, me); }
    me.position.set(o.x * sx, o.k === 'wave' ? -.1 : o.k === 'crate' ? Math.sin(RT.clock * 3 + o.x) * .05 : 0, (o.y - ry) * sx);
    if (o.k === 'shark') me.rotation.y = Math.cos(o.ph) * .8;
  }
  for (const [o, me] of VV.obs) if (!seen.has(o)) { VV.g.remove(me); VV.obs.delete(o); }
  VV.land.visible = V.d > .86; VV.land.position.set(0, 0, -40 + (V.d - .86) / .14 * 30);
  const storm = V.d > .4 && V.d < .72;
  R3.cam.position.set(VV.raft.position.x * .5, 6.2, 7.5); R3.cam.lookAt(VV.raft.position.x * .4, 0, -5); R3.cam.updateMatrixWorld();
  const h = storm ? 19.6 : V.d > .85 ? 6.4 : hour();
  r3Env(h, storm ? 1 : 0, false, storm, new THREE.Vector3(0, 0, -4), 14);
  const u = VV.wu, sun = R3.sun; u.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize(); u.uSunCol.value.copy(sun.color).multiplyScalar(Math.min(1.3, sun.intensity * .55)); u.uSky.value.copy(R3.scene.background); u.uAmb.value = .25 + R3.hemi.intensity * .45; u.uFogC.value.copy(R3.scene.background); u.uFogN.value = 14; u.uFogF.value = 60;
  R3.scene.fog.near = 14; R3.scene.fog.far = 60;
  R3.dyn.visible = true; for (const c of R3.dyn.children) c.visible = c === R3.rain;
  R3.cx = 0; R3.cy = 0; R3.cz = 0; r3Rain(storm ? 1 : 0, storm, dt);
  r3Lights([], 0, 0); R3.u.uSee.value = 0;
  R3.cvs.style.display = 'block'; R3.ren.render(R3.scene, R3.cam); return true;
}

// ---------- 切り替え ----------
function r3Hide() { if (R3.cvs) R3.cvs.style.display = 'none'; }
function r3BtnLabel() { const b = document.querySelector('#hud-btns [data-ui="v3d"]'); if (b) b.textContent = OPT.view3d ? '2D' : '3D'; }
function toggle3D(force) {
  const want = force != null ? force : !OPT.view3d;
  if (want) {
    if (!r3Init()) { toast('この端末では3D表示を使えません', 'warn'); OPT.view3d = false; saveOpt(); r3BtnLabel(); return; }
    R3.failed = false; OPT.view3d = true; R3.leaving = false; R3.pitch = 84; R3.pitchT = 52; R3.camInit = false; R3.perf = []; R3.downT = RT.clock + 4;
    notice('3D表示'); sfx('ok');
  } else {
    if (!OPT.view3d) return;
    if (R3.ok && !R3.failed && RT.screen === 'game') { R3.leaving = true; R3.pitchT = 84.5; }
    else { OPT.view3d = false; r3Hide(); }
    notice('2D表示'); sfx('ok');
  }
  saveOpt(); r3BtnLabel(); if (UI.open) renderModal();
}
function r3Tick(dt) { // 2Dへ戻る演出の完了・重さの自動調整
  if (R3.leaving && R3.pitch > 83.5) { R3.leaving = false; OPT.view3d = false; saveOpt(); r3Hide(); r3BtnLabel(); }
  if (!r3On() || R3.noAuto) return;
  R3.perf.push(dt); if (R3.perf.length > 90) R3.perf.shift();
  if (R3.perf.length >= 90 && RT.clock > R3.downT) {
    const avg = R3.perf.reduce((a, b) => a + b, 0) / R3.perf.length;
    if (avg > 1 / 24 && (OPT.q3d | 0) > 0) { OPT.q3d = (OPT.q3d | 0) - 1; saveOpt(); r3Rebuild(); R3.perf = []; R3.downT = RT.clock + 8; toast('動作が重いため、3Dの画質を「' + ['低', '中', '高'][OPT.q3d] + '」に下げました', 'warn'); }
  }
}

// =====================================================================
//  INPUT
// =====================================================================
const KEYMAP = {
  Space: 'A', KeyJ: 'A', KeyZ: 'A', Enter: 'A', NumpadEnter: 'A', ShiftLeft: 'B', ShiftRight: 'B', KeyK: 'B', Backspace: 'B',
  KeyB: 'X', KeyI: 'X', Tab: 'X', KeyC: 'Y', KeyQ: 'LB', KeyE: 'RB', Escape: 'START', KeyP: 'START', KeyM: 'SELECT',
  ArrowUp: 'UP', KeyW: 'UP', ArrowDown: 'DOWN', KeyS: 'DOWN', ArrowLeft: 'LEFT', KeyA: 'LEFT', ArrowRight: 'RIGHT', KeyD: 'RIGHT'
};
const Inp = {
  mode: 'kb', mx: 0, my: 0, cur: {}, prev: {}, kb: {}, tb: {}, tap: {}, joy: { id: null, x: 0, y: 0, bx: 0, by: 0 }, gp: null,
  pr(b) { return !!this.cur[b] && !this.prev[b]; },
  dn(b) { return !!this.cur[b]; },
  eat() { this.prev = Object.assign({}, this.cur); },
  setMode(m, force) {
    if (this.mode === m && !force) return; this.mode = m; document.body.dataset.input = m;
    if (m !== 'touch') this.joyEnd(); UI.last.hhint = null; if (UI.open) renderModal();
  },
  joyEnd() { this.joy.id = null; this.joy.x = this.joy.y = 0; const b = $id('joybase'); if (b) b.classList.remove('on'); const k = $id('joyknob'); if (k) k.style.transform = 'translate(-50%,-50%)'; },
  rumble(s, w, ms) { try { const gp = this.gp; if (this.mode === 'pad' && gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: w }); } catch (e) { } },
  poll() {
    this.prev = this.cur; const c = {};
    for (const b in this.kb) if (this.kb[b]) c[b] = true;
    for (const b in this.tb) if (this.tb[b]) c[b] = true;
    for (const b in this.tap) c[b] = true; this.tap = {};
    let gx = 0, gy = 0, padDir = { x: 0, y: 0 };
    let pads = []; try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { }
    let gp = null; for (const g of pads) if (g && g.connected) { gp = g; break; }
    this.gp = gp;
    if (gp) {
      const B = gp.buttons, prs = i => B[i] && (B[i].pressed || B[i].value > .5);
      const iA = OPT.swapAB ? 1 : 0, iB = OPT.swapAB ? 0 : 1, iX = OPT.swapXY ? 3 : 2, iY = OPT.swapXY ? 2 : 3;
      const map = { A: iA, B: iB, X: iX, Y: iY, LB: 4, RB: 5, START: 9, SELECT: 8 };
      let any = false;
      for (const k in map) if (prs(map[k])) { c[k] = true; any = true; }
      if (prs(6) || prs(7)) { c.B = true; any = true; }
      if (prs(12)) { c.UP = true; padDir.y = -1; any = true; } if (prs(13)) { c.DOWN = true; padDir.y = 1; any = true; }
      if (prs(14)) { c.LEFT = true; padDir.x = -1; any = true; } if (prs(15)) { c.RIGHT = true; padDir.x = 1; any = true; }
      gx = gp.axes[0] || 0; gy = gp.axes[1] || 0;
      if (Math.hypot(gx, gy) < .28) gx = gy = 0; else any = true;
      if (gx < -.55) c.LEFT = true; if (gx > .55) c.RIGHT = true; if (gy < -.55) c.UP = true; if (gy > .55) c.DOWN = true;
      if (any) this.setMode('pad');
    }
    this.cur = c;
    let mx = 0, my = 0;
    if (this.kb.LEFT) mx -= 1; if (this.kb.RIGHT) mx += 1; if (this.kb.UP) my -= 1; if (this.kb.DOWN) my += 1;
    mx += padDir.x + gx; my += padDir.y + gy;
    if (this.joy.id != null) { mx += this.joy.x; my += this.joy.y; }
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    this.mx = mx; this.my = my;
  },
  init() {
    this.setMode((window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 'touch' : 'kb', true);
    const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
    window.addEventListener('keydown', e => {
      if (e.key === 'Control') { if (!e.repeat) { this.ctrlDown = true; this.ctrlCombo = false; } return; }
      if (this.ctrlDown) this.ctrlCombo = true;
      if (typing()) { if (e.code === 'Escape' || e.code === 'Enter') { document.activeElement.blur(); e.preventDefault(); } return; }
      auInit();
      if (/^Digit[1-8]$/.test(e.code) && G && RT.screen === 'game' && G.mode === 'play' && !UI.open && !UI.dlg) { G.sel = +e.code.slice(5) - 1; invChanged(); sfx('tick'); }
      const b = KEYMAP[e.code]; if (b) { this.kb[b] = true; if (!e.repeat) this.tap[b] = true; e.preventDefault(); }
      this.setMode('kb');
    });
    window.addEventListener('keyup', e => {
      if (e.key === 'Control') { if (this.ctrlDown && !this.ctrlCombo && !typing()) toggle3D(); this.ctrlDown = false; return; }
      const b = KEYMAP[e.code]; if (b) { this.kb[b] = false; e.preventDefault(); }
    });
    window.addEventListener('blur', () => { this.kb = {}; this.tb = {}; this.tap = {}; this.ctrlDown = false; this.joyEnd(); });
    window.addEventListener('wheel', e => { if (G && RT.screen === 'game' && G.mode === 'play' && !UI.open && !UI.dlg) { G.sel = (G.sel + (e.deltaY > 0 ? 1 : 7)) % 8; invChanged(); } }, { passive: true });
    document.addEventListener('pointerdown', e => { if (this.ctrlDown) this.ctrlCombo = true; auInit(); if (e.pointerType === 'touch' || e.pointerType === 'pen') this.setMode('touch'); }, true);
    document.addEventListener('mousedown', () => { if (this.mode === 'pad') this.setMode('kb'); }, true);
    // マウスを乗せたらアイテム情報を出す
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return; UI.navTips = false;
      const t = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
      if (t && G) tipShow(t.dataset.tip, e.clientX, e.clientY); else if (tipSrc) tipHide();
    }, { passive: true });
    document.addEventListener('pointerleave', () => tipHide());
    // joystick
    const zone = $id('joyzone'), base = $id('joybase'), knob = $id('joyknob');
    const R = () => 44 * [0.85, 1, 1.2][OPT.touch | 0];
    zone.addEventListener('pointerdown', e => {
      if (this.joy.id != null) return; e.preventDefault(); this.joy.id = e.pointerId; this.joy.bx = e.clientX; this.joy.by = e.clientY; this.joy.x = this.joy.y = 0;
      try { zone.setPointerCapture(e.pointerId); } catch (_) { }
      const zr = zone.getBoundingClientRect(); base.style.left = (e.clientX - zr.left) + 'px'; base.style.top = (e.clientY - zr.top) + 'px'; base.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== this.joy.id) return; e.preventDefault();
      const r = R(); let dx = e.clientX - this.joy.bx, dy = e.clientY - this.joy.by; const d = Math.hypot(dx, dy);
      if (d > r) { dx = dx / d * r; dy = dy / d * r; }
      this.joy.x = dx / r; this.joy.y = dy / r; if (Math.hypot(this.joy.x, this.joy.y) < .18) { this.joy.x = 0; this.joy.y = 0; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    const jend = e => { if (e.pointerId === this.joy.id) this.joyEnd(); };
    zone.addEventListener('pointerup', jend); zone.addEventListener('pointercancel', jend); zone.addEventListener('lostpointercapture', jend);
    $$('#touch [data-b]').forEach(b => {
      const k = b.dataset.b;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.tb[k] = true; this.tap[k] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) { } });
      const up = () => { this.tb[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    });
    window.addEventListener('gamepadconnected', () => { toast('コントローラーが接続されました', 'good'); this.setMode('pad'); });
    window.addEventListener('gamepaddisconnected', () => { toast('コントローラーが切断されました', 'warn'); if (window.matchMedia && matchMedia('(pointer: coarse)').matches) this.setMode('touch'); else this.setMode('kb'); });
    // Safari: 拡大・長押しメニュー・ダブルタップ対策
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
    document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => { if (!typing()) e.preventDefault(); });
    let lastTE = 0;
    document.addEventListener('touchend', e => { auInit(); const now = Date.now(); if (now - lastTE < 330 && !e.target.closest('#modal, #dialog, #title, #death, #ending, #hotbar, #hud-btns, #quest, #mini, input')) e.preventDefault(); lastTE = now; }, { passive: false });
    document.addEventListener('click', () => auInit(), true);
    document.addEventListener('touchmove', e => { if (e.touches.length > 1 || !e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });
    document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.kb = {}; this.tb = {}; this.joyEnd(); if (G && RT.screen === 'game' && G.mode === 'play') saveGame(G.slot, true); if (AU.ctx) try { AU.ctx.suspend(); } catch (e) { } }
      else if (AU.ctx) try { AU.ctx.resume(); } catch (e) { }
    });
  }
};

// ---------- メニューのフォーカス移動 ----------
let navHold = 0, navLast = null;
function navDir(dt) {
  const d = Inp.dn('UP') ? [0, -1] : Inp.dn('DOWN') ? [0, 1] : Inp.dn('LEFT') ? [-1, 0] : Inp.dn('RIGHT') ? [1, 0] : null;
  if (!d) { navHold = 0; navLast = null; return null; }
  const key = d.join(); if (key !== navLast) { navLast = key; navHold = 0; return d; }
  navHold += dt; if (navHold > .36) { navHold -= .1; return d; } return null;
}
function navRoot() {
  if (UI.dlg) return $id('dialog'); if (UI.open) return $id('modal');
  if (!$id('death').classList.contains('hidden')) return $id('death');
  if (!$id('ending').classList.contains('hidden')) return $id('ending');
  if (RT.screen === 'title') return $id('title');
  return null;
}
function navEls(root) { return $$('.nav', root).filter(e => !e.classList.contains('dis') && e.offsetParent !== null); }
function navFocus(el, quiet) {
  $$('.nav.focus').forEach(e => e.classList.remove('focus'));
  if (!el) return; el.classList.add('focus'); UI.focusKey = el.dataset.fk || UI.focusKey;
  if (Inp.mode !== 'touch' || !quiet) try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { }
  // コントローラー／キー操作でカーソルを合わせたらアイテム情報を出す
  if (el.dataset.tip && Inp.mode !== 'touch' && (Inp.mode === 'pad' || UI.navTips)) tipShow(el.dataset.tip, 0, 0, el.getBoundingClientRect());
  else if (Inp.mode !== 'touch') tipHide();
}
function navMove(dx, dy) {
  UI.navTips = true;
  const root = navRoot(); if (!root) return; const els = navEls(root); if (!els.length) return;
  const cur = root.querySelector('.nav.focus');
  if (!cur || !els.includes(cur)) { navFocus(els[0]); return; }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = 1e9;
  for (const e of els) {
    if (e === cur) continue; const b = e.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const vx = bx - ax, vy = by - ay, along = vx * dx + vy * dy; if (along <= 2) continue;
    const perp = Math.abs(vx * dy - vy * dx), s = along + perp * 2.2; if (s < bs) { bs = s; best = e; }
  }
  if (best) { navFocus(best); sfx('tick'); }
}
function navClick() {
  const root = navRoot(); if (!root) return;
  const cur = root.querySelector('.nav.focus');
  if (!cur) { const els = navEls(root); if (els[0]) navFocus(els[0]); return; }
  cur.click();
}
function handleUIInput(dt) {
  if (RT.lock) return true;
  const nd = navDir(dt);
  if (UI.dlg) {
    if (nd && UI.dlg.choices) navMove(nd[0], nd[1]);
    if (Inp.pr('A')) UI.dlgA();
    else if (Inp.pr('B')) { if (UI.dlg.choices) { if (dlgDone()) { const d = UI.dlg; sfx('tick'); nextDlg(); if (d.cb) d.cb(d.choices.length - 1); } else UI.dlgA(); } else UI.dlgA(); }
    return true;
  }
  if (UI.open) {
    if (nd) navMove(nd[0], nd[1]);
    if (Inp.pr('A')) navClick();
    else if (Inp.pr('B') || Inp.pr('START')) { if (UI.moveFrom != null) { UI.moveFrom = null; renderModal(); } else UI.close(); }
    else if (UI.open === 'main' && (Inp.pr('LB') || Inp.pr('RB'))) { const i = MTABS.findIndex(t => t[0] === UI.tab); UI.tab = MTABS[(i + (Inp.pr('RB') ? 1 : MTABS.length - 1)) % MTABS.length][0]; UI.focusKey = null; renderModal(); sfx('tick'); }
    else if (Inp.pr('X')) { if (UI.open === 'main' && UI.tab === 'bag') UI.close(); else if (G && RT.screen === 'game') { UI.open = null; UI.openMain('bag'); } }
    else if (Inp.pr('Y')) { if (UI.open === 'main' && UI.tab === 'craft') UI.close(); else if (G && RT.screen === 'game') { UI.open = null; UI.openMain('craft'); } }
    else if (Inp.pr('SELECT')) { if (UI.open === 'main' && UI.tab === 'map') UI.close(); else if (G && RT.screen === 'game') { UI.open = null; UI.openMain('map'); } }
    return true;
  }
  const root = navRoot();
  if (root) {
    if (nd) navMove(nd[0], nd[1]);
    if (Inp.pr('A')) { if (root.id === 'ending' && UI.endBusy) UI.endSkip(); else navClick(); }
    else if (Inp.pr('B') && root.id === 'title') { if (UI.titleSt === 'diff') renderTitle('new'); else if (UI.titleSt !== 'main') renderTitle('main'); }
    return true;
  }
  if (RT.screen === 'game' && G && G.mode === 'play') {
    if (Inp.pr('X')) UI.openMain('bag'); else if (Inp.pr('Y')) UI.openMain('craft'); else if (Inp.pr('START')) UI.openMain('sys'); else if (Inp.pr('SELECT')) UI.openMain('map');
    else return false;
    return true;
  }
  return false;
}

// =====================================================================
//  AUDIO（すべてWebAudioで合成）
// =====================================================================
const AU = { ctx: null, master: null, bgmG: null, seG: null, nb: null, song: null, name: null, want: 'title', step: 0, next: 0, last: {}, cache: {} };
function auInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended' && !document.hidden) AU.ctx.resume().catch(() => { }); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try {
    AU.ctx = new AC(); const c = AU.ctx;
    AU.master = c.createGain(); AU.master.gain.value = .8; AU.master.connect(c.destination);
    AU.bgmG = c.createGain(); AU.seG = c.createGain(); AU.bgmG.connect(AU.master); AU.seG.connect(AU.master);
    AU.nb = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = AU.nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
    if (c.state === 'suspended') c.resume().catch(() => { });
    setVol(); setInterval(schedule, 25);
    const w = AU.want; AU.name = null; playBgm(w);
  } catch (e) { AU.ctx = null; }
}
function setVol() { if (!AU.ctx) return; AU.bgmG.gain.value = (OPT.bgm / 10) * .55; AU.seG.gain.value = (OPT.se / 10) * .9; }
const NOTE_I = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function nf(tok) { const m = /^([A-G]#?)(\d)$/.exec(tok); if (!m) return 0; const n = NOTE_I[m[1]] + (+m[2] + 1) * 12; return 440 * Math.pow(2, (n - 69) / 12); }
const SONGS = {
  title: { bpm: 88, ch: [
    ['sq', .045, 'E5 - G5 - A5 - G5 E5 | D5 - - - C5 - D5 - | E5 - G5 - A5 - C6 A5 | G5 - - - - - . .'],
    ['tri', .11, 'C3 - - - G3 - - - | A2 - - - E3 - - - | F2 - - - C3 - - - | G2 - - - D3 - - -'],
    ['sq', .018, 'C4 E4 G4 E4 C4 E4 G4 E4 | A3 C4 E4 C4 A3 C4 E4 C4 | F3 A3 C4 A3 F3 A3 C4 A3 | G3 B3 D4 B3 G3 B3 D4 B3']] },
  day: { bpm: 108, ch: [
    ['sq', .04, 'G4 . C5 . E5 . D5 C5 | D5 - . . . . . . | A4 . D5 . F5 . E5 D5 | E5 - . . . . . . | G4 . C5 . E5 . G5 E5 | A5 - . G5 - . E5 . | F5 . E5 . D5 . B4 . | C5 - - - . . . .'],
    ['tri', .11, 'C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | D3 . A3 . D3 . A3 . | C3 . G3 . C3 . G3 . | C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . . .'],
    ['noi', .045, 'k . h . x . h . | k . h . x . h h | k . h . x . h . | k . h . x . h h | k . h . x . h . | k . h . x . h h | k . h . x . h . | k . h . x h x .']] },
  night: { bpm: 70, ch: [
    ['sq', .028, 'A4 - - - C5 - B4 - | A4 - - - E4 - - - | F4 - - - A4 - G4 - | E4 - - - - - . .'],
    ['tri', .1, 'A2 - - - - - - - | E2 - - - - - - - | F2 - - - - - - - | E2 - - - - - - -'],
    ['tri', .04, 'A3 . C4 . E4 . C4 . | G#3 . B3 . E4 . B3 . | F3 . A3 . C4 . A3 . | E3 . G#3 . B3 . G#3 .']] },
  cave: { bpm: 62, ch: [
    ['tri', .11, 'D2 - - - - - - - | D#2 - - - - - - - | D2 - - - - - - - | C#2 - - - - - - -'],
    ['sq', .02, '. . A4 . . . G#4 . | . . . . F4 . . . | . . A4 . . . D5 . | . . C#5 . . . . .'],
    ['noi', .02, 'h . . . . . . . | . . . . h . . . | h . . . . . . . | . . . . . . h .']] },
  boss: { bpm: 150, ch: [
    ['sq', .04, 'E5 . E5 . G5 . E5 D5 | E5 - . . B4 . C5 . | A4 . A4 . C5 . A4 G4 | B4 - - - D#5 - - -'],
    ['saw', .03, 'E2 E3 E2 E3 E2 E3 E2 E3 | E2 E3 E2 E3 G2 G3 G2 G3 | A2 A3 A2 A3 A2 A3 A2 A3 | B2 B3 B2 B3 B2 B3 B2 B3'],
    ['noi', .05, 'k . x . k k x . | k . x . k k x x | k . x . k k x . | k . x . k x x x']] },
  voyage: { bpm: 120, ch: [
    ['sq', .04, 'D5 . D5 E5 F5 - E5 D5 | C5 - A4 - - - . . | D5 . D5 E5 F5 - G5 A5 | G5 - - - F5 - E5 -'],
    ['tri', .11, 'D3 . A3 . D3 . A3 . | F3 . C4 . F3 . C4 . | A#2 . F3 . A#2 . F3 . | C3 . G3 . C3 . G3 .'],
    ['noi', .045, 'k . h . x . h h | k . h . x . h h | k . h . x . h h | k . h . x x h h']] },
  ending: { bpm: 76, ch: [
    ['sq', .04, 'C5 - E5 - G5 - - - | F5 - E5 - D5 - - - | E5 - G5 - C6 - - - | B5 - - - G5 - - - | A5 - - - G5 - E5 - | F5 - E5 - D5 - C5 - | D5 - - - G4 - - - | C5 - - - - - - -'],
    ['tri', .1, 'C3 - - - - - - - | F2 - - - - - - - | C3 - - - - - - - | G2 - - - - - - - | F2 - - - - - - - | D3 - - - - - - - | G2 - - - - - - - | C3 - - - - - - -'],
    ['sq', .016, 'C4 E4 G4 E4 C4 E4 G4 E4 | F3 A3 C4 A3 F3 A3 C4 A3 | C4 E4 G4 E4 C4 E4 G4 E4 | G3 B3 D4 B3 G3 B3 D4 B3 | F3 A3 C4 A3 F3 A3 C4 A3 | D4 F4 A4 F4 D4 F4 A4 F4 | G3 B3 D4 B3 G3 B3 D4 B3 | C4 E4 G4 E4 C4 E4 G4 E4']] },
};
function parseSong(name) {
  if (AU.cache[name]) return AU.cache[name]; const S = SONGS[name]; if (!S) return null;
  const ch = S.ch.map(([w, v, str]) => {
    const tk = str.split(/\s+/).filter(t => t && t !== '|'); const ev = new Array(tk.length).fill(null);
    for (let i = 0; i < tk.length; i++) {
      const t = tk[i]; if (t === '.' || t === '-') continue;
      if (w === 'noi') { ev[i] = { n: t }; continue; }
      let len = 1; while (tk[i + len] === '-') len++;
      ev[i] = { f: nf(t), len };
    }
    return { w, v, ev, len: tk.length };
  });
  return (AU.cache[name] = { bpm: S.bpm, ch });
}
function playBgm(name) {
  AU.want = name; if (AU.name === name) return; AU.name = name;
  if (!AU.ctx) return;
  AU.song = name ? parseSong(name) : null; AU.step = 0; AU.next = AU.ctx.currentTime + .12;
}
function schedule() {
  const S = AU.song, c = AU.ctx; if (!S || !c || c.state !== 'running') return;
  const sd = 60 / S.bpm / 2;
  if (AU.next < c.currentTime - .5) AU.next = c.currentTime + .05;
  while (AU.next < c.currentTime + .15) {
    for (const ch of S.ch) { const ev = ch.ev[AU.step % ch.len]; if (ev) playNote(ch, ev, AU.next, sd); }
    AU.next += sd; AU.step++;
  }
}
function playNote(ch, ev, t, sd) {
  const c = AU.ctx;
  if (ch.w === 'noi') {
    const s = c.createBufferSource(); s.buffer = AU.nb; const f = c.createBiquadFilter(), g = c.createGain();
    const k = ev.n; f.type = k === 'k' ? 'lowpass' : 'highpass'; f.frequency.value = k === 'k' ? 160 : k === 'x' ? 1800 : 6500;
    const dur = k === 'h' ? .035 : k === 'k' ? .12 : .09;
    g.gain.setValueAtTime(ch.v * (k === 'k' ? 2.6 : 1), t); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(AU.bgmG); s.start(t, Math.random() * .5, dur + .02);
    if (k === 'k') { const o = c.createOscillator(), g2 = c.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + .1); g2.gain.setValueAtTime(ch.v * 3, t); g2.gain.exponentialRampToValueAtTime(.0005, t + .12); o.connect(g2); g2.connect(AU.bgmG); o.start(t); o.stop(t + .14); }
    return;
  }
  const o = c.createOscillator(), g = c.createGain();
  o.type = { sq: 'square', tri: 'triangle', saw: 'sawtooth', sin: 'sine' }[ch.w] || 'square';
  o.frequency.setValueAtTime(ev.f, t);
  const d = ev.len * sd, v = ch.v;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .008);
  if (ch.w === 'tri') { g.gain.setValueAtTime(v, t + Math.max(.02, d - .04)); }
  else g.gain.exponentialRampToValueAtTime(Math.max(.0006, v * .45), t + Math.max(.03, d - .03));
  g.gain.linearRampToValueAtTime(0, t + d);
  o.connect(g); g.connect(AU.bgmG); o.start(t); o.stop(t + d + .02);
}
function tone(f0, f1, dur, type, vol, delay) {
  const c = AU.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  o.connect(g); g.connect(AU.seG); o.start(t); o.stop(t + dur + .02);
}
function noi(dur, vol, type, freq, delay, f1) {
  const c = AU.ctx, t = c.currentTime + (delay || 0), s = c.createBufferSource(); s.buffer = AU.nb;
  const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq || 1000, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.seG); s.start(t, Math.random() * .4, dur + .05);
}
const arp = (fs, step, type, vol, len) => fs.forEach((f, i) => tone(f, f, len || .12, type || 'square', vol || .06, i * step));
const SE = {
  swing: () => noi(.08, .1, 'bandpass', 1800, 0, 600),
  chop: () => { noi(.09, .3, 'lowpass', 1200); tone(180, 110, .08, 'square', .08); },
  mine: () => { tone(1300, 900, .06, 'square', .06); noi(.07, .2, 'highpass', 2500); },
  dig: () => noi(.12, .25, 'lowpass', 700, 0, 300),
  thud: () => { tone(120, 70, .1, 'triangle', .2); noi(.06, .1, 'lowpass', 500); },
  clink: () => tone(1800, 1600, .05, 'square', .05),
  fall: () => { noi(.4, .3, 'lowpass', 900, 0, 200); tone(140, 60, .3, 'triangle', .2); },
  crumble: () => noi(.25, .3, 'lowpass', 1500, 0, 300),
  hit: () => { tone(220, 80, .08, 'square', .12); noi(.05, .2, 'highpass', 1500); },
  kill: () => { tone(400, 100, .18, 'square', .1); noi(.15, .15, 'lowpass', 1200, .03); },
  hurt: () => tone(300, 90, .18, 'sawtooth', .13),
  pick: () => tone(880, 1320, .07, 'square', .05),
  item: () => arp([523, 659, 784, 1046], .07),
  craft: () => { arp([392, 523, 659], .06, 'square', .06, .09); noi(.05, .1, 'highpass', 3000); },
  cook: () => { noi(.3, .12, 'highpass', 2500); arp([523, 784], .07, 'triangle', .1, .1); },
  smelt: () => { noi(.25, .2, 'lowpass', 900); tone(220, 440, .2, 'triangle', .1); },
  eat: () => { for (let i = 0; i < 3; i++) noi(.05, .18, 'bandpass', 1400 + i * 200, i * .09); },
  drink: () => { tone(300, 600, .08, 'sine', .15); tone(350, 700, .08, 'sine', .15, .11); },
  heal: () => arp([523, 659, 784], .06, 'sine', .12),
  place: () => { tone(160, 120, .1, 'square', .12); noi(.08, .15, 'lowpass', 800); },
  tick: () => tone(1000, 1000, .025, 'square', .03),
  ok: () => { tone(660, 660, .05, 'square', .05); tone(990, 990, .07, 'square', .05, .05); },
  no: () => tone(180, 140, .12, 'square', .07),
  open: () => tone(500, 800, .06, 'square', .04), close: () => tone(700, 400, .06, 'square', .04),
  equip: () => { tone(400, 600, .06, 'square', .06); tone(600, 900, .06, 'square', .06, .05); },
  splash: () => noi(.2, .25, 'bandpass', 1200, 0, 3000),
  cast: () => noi(.15, .1, 'bandpass', 2000, 0, 800),
  bite: () => { tone(1200, 1200, .06, 'square', .08); tone(1200, 1200, .06, 'square', .08, .1); },
  reel: () => tone(600, 900, .1, 'square', .05), reelhit: () => tone(880, 1200, .06, 'square', .07),
  catch: () => arp([523, 659, 784, 1046, 1318], .07),
  shoot: () => { noi(.1, .15, 'highpass', 2000, 0, 5000); tone(500, 200, .08, 'triangle', .08); },
  throw: () => noi(.1, .1, 'bandpass', 900, 0, 1600),
  page: () => { noi(.12, .1, 'highpass', 3000, 0, 6000); tone(784, 784, .15, 'sine', .08, .1); },
  discover: () => arp([392, 523, 659, 784], .1, 'triangle', .12, .16),
  quest: () => arp([523, 659, 784, 1046], .08),
  ach: () => arp([784, 988, 1175, 1568], .08, 'square', .06, .14),
  levelup: () => arp([523, 659, 784, 1046, 1318], .06),
  ignite: () => noi(.4, .25, 'bandpass', 600, 0, 2400), fuel: () => noi(.2, .15, 'bandpass', 900, 0, 1800),
  crate: () => { noi(.15, .25, 'lowpass', 1200); tone(200, 150, .1, 'square', .08); },
  break: () => { noi(.2, .25, 'highpass', 1500); tone(600, 150, .2, 'square', .08); },
  treasure: () => arp([523, 659, 784, 1046, 1318, 1568], .07),
  grunt: () => tone(120, 90, .25, 'sawtooth', .1),
  gull: () => tone(1400, 900, .15, 'square', .04),
  roar: () => { tone(90, 50, .8, 'sawtooth', .18); noi(.8, .25, 'lowpass', 400, 0, 120); },
  golem: () => tone(70, 50, .3, 'sawtooth', .12),
  boom: () => { noi(.5, .4, 'lowpass', 600, 0, 80); tone(80, 40, .4, 'triangle', .3); },
  bubble: () => { for (let i = 0; i < 4; i++) tone(400 + i * 120, 800 + i * 100, .06, 'sine', .08, i * .05); },
  snap: () => { noi(.06, .3, 'highpass', 3000); tone(900, 300, .06, 'square', .08); },
  bossdie: () => { noi(1.2, .4, 'lowpass', 1500, 0, 60); arp([392, 330, 262, 196], .2, 'square', .08, .3); },
  die: () => arp([392, 349, 294, 220], .22, 'triangle', .14, .3),
  horn: () => { tone(110, 110, 1.2, 'sawtooth', .1); tone(165, 165, 1.2, 'sawtooth', .06); },
  heli: () => { for (let i = 0; i < 10; i++) noi(.06, .2, 'lowpass', 500, i * .09); },
  radio: () => noi(.8, .12, 'bandpass', 1500, 0, 3000),
  thunder: () => noi(1.6, .5, 'lowpass', 800, 0, 60),
  door: () => { noi(1.2, .35, 'lowpass', 300, 0, 80); tone(60, 40, 1, 'triangle', .3); },
  crash: () => { noi(.3, .35, 'lowpass', 1200, 0, 200); tone(150, 60, .2, 'square', .12); },
  morning: () => arp([523, 659, 784, 1046], .12, 'triangle', .1, .25),
};
function sfx(n) {
  if (!AU.ctx || !SE[n] || OPT.se <= 0 || AU.ctx.state !== 'running') return;
  const now = performance.now(); if (AU.last[n] && now - AU.last[n] < 45) return; AU.last[n] = now;
  try { SE[n](); } catch (e) { }
}
function updateMusic(force) {
  if (RT.screen !== 'game' || !G) return;
  let s = 'day';
  if (G.mode === 'voyage') s = 'voyage'; else if (G.mode === 'ending') s = 'ending'; else if (G.mode === 'dead') s = null;
  else if (RT.boss) s = 'boss'; else if (G.mapId === 'cave') s = 'cave'; else if (isNight()) s = 'night';
  playBgm(s);
}

// =====================================================================
//  MAIN
// =====================================================================
let lastT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - lastT) / 1000; lastT = now; if (!(dt > 0)) dt = 0; if (dt > .1) dt = .1;
  Inp.poll();
  if (handleUIInput(dt)) Inp.eat();
  if (RT.screen === 'game' && G) {
    if (!UI.open && !UI.dlg && !RT.lock && G.mode !== 'ending') { try { update(dt); } catch (e) { console.error(e); } }
    else RT.clock += dt;
  } else { RT.clock += dt; updDemo(dt); }
  try { r3Tick(dt); } catch (e) { console.error(e); }
  try { UI.update(dt); } catch (e) { console.error(e); }
  try { render(); } catch (e) { console.error(e); }
}
function boot() {
  buildAllSprites(); setupCanvas(); uiInit(); Inp.init(); initDemo();
  if (OPT.view3d) { if (r3Init()) R3.pitch = 52; else { OPT.view3d = false; saveOpt(); } }
  r3BtnLabel(); UI.title();
  setInterval(() => { if (G && RT.screen === 'game' && G.mode === 'play' && !UI.open && !UI.dlg) saveGame(G.slot, true); }, 120000);
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(loop); });
}
window.__DI = { get G() { return G; }, get R3() { return R3; }, toggle3D, RT, UI, Inp, IT, OB, RC, newGame, update, give, saveGame, loadGame, render, triggerEnding, spawnMob, travel, die, respawn, enterGame, startNew, hourTick, doCraft, useObj, getTarget, actionInfo, consume, cnt, findObj, routes, readPage, startVoyage, SONGS, parseSong, MAPS };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
