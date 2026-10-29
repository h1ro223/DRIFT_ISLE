'use strict';
/* =========================================================
   無人島サバイバル債務録
   2Dドット / シングルプレイ / セーブ：localStorage
   ========================================================= */
(function () {

/* ---------- 1. 基本設定 ---------- */
const CONFIG = {
  dayLength: 180,   // 1日の長さ（秒）※10日×3分＝約30分
  dayPart: 120,     // 6:00〜20:00 の長さ（秒）。残り60秒が夜
  saveKey: 'mujintou-saimu-save-v1',      // v1の旧セーブ（起動時にスロット1へ移行）
  slotKey: 'mujintou-saimu-save-v2-s',    // + スロット番号
  slots: 3,
  settingsKey: 'mujintou-saimu-settings-v1',
  saveVersion: 5,
  dropLock: 3,      // 捨てた物を拾えるようになるまでの秒数
  placeRange: 5,    // 設置できる範囲（マス）
  hotSize: 8,       // アイテムバーの枠数
  islandSeed: 20261027,
  baseCap: 30,
  queueMax: 30,
  autosaveSec: 60,
};
const TILE = 16;
const PRESETS = [
  { id: 'easy',   label: 'かんたん',   debt: 3000, days: 12, rate: 1 },
  { id: 'normal', label: 'ふつう',     debt: 5000, days: 10, rate: 2 },
  { id: 'hard',   label: 'むずかしい', debt: 8000, days: 9,  rate: 3 },
];
const LIMITS = { debt: [1000, 20000, 500], days: [5, 30, 1], rate: [0, 5, 0.5] };

/* ---------- 2. ユーティリティ ---------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const chance = p => Math.random() < p;
const fmt$ = n => '$' + Math.round(n).toLocaleString('en-US');
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const hexCache = {};
function hexRgb(h) { if (hexCache[h]) return hexCache[h]; const n = parseInt(h.slice(1), 16); return (hexCache[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]); }

/* ---------- 3. タイル ---------- */
const T = { DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, FOREST: 4, ROCK: 5, SPRING: 6, PIER: 7, PATH: 8, CFLOOR: 9, CWALL: 10 };
const WALK = [false, false, true, true, true, true, false, true, true, true, false];
const isWater = v => v === T.DEEP || v === T.SHALLOW;
const isLandT = v => v === T.SAND || v === T.GRASS || v === T.FOREST || v === T.ROCK || v === T.PATH;
const DIRV = [[0, 1], [0, -1], [-1, 0], [1, 0]]; // 下・上・左・右

/* ---------- 4. データ ---------- */
// c: 価格帯（1=日用品 2=中級 3=希少 4=財宝）
const ITEMS = {
  stone:     { n: '石', p: 10, c: 1, d: 'どこにでもある石。道具や設備の材料。' },
  branch:    { n: '木の枝', p: 5, c: 1, d: '燃料や簡単な道具に使える。' },
  fiber:     { n: '繊維', p: 4, c: 1, d: '草から取れる。ロープや帆布の材料。' },
  wood:      { n: '木材', p: 20, c: 1, d: '道具や建築に使う。作業台で板材に加工できる。' },
  driftwood: { n: '流木', p: 12, c: 1, d: '浜辺に流れ着いた木。作業台で木材に加工できる。' },
  plank:     { n: '板材', p: 35, c: 1, d: '木材を加工した板。木材より高く売れる。' },
  rope:      { n: 'ロープ', p: 14, c: 1, d: '繊維をより合わせた丈夫なひも。' },
  coconut:   { n: 'ココナッツ', p: 30, c: 2, d: '売れば現金。食べると空腹と渇きが少し回復する。', food: { h: 15, t: 15 } },
  berry:     { n: 'ベリー', p: 8, c: 1, d: '甘酸っぱい木の実。少しお腹が満たされる。', food: { h: 6, t: 4 } },
  bowl:      { n: '木の器', p: 6, c: 1, d: '泉で水を汲める。雨の日に外にいると雨水がたまる。' },
  rawwater:  { n: '泉の水（生水）', p: 2, c: 1, d: '汲んだままの水。焚き火で15秒ろ過すると、きれいな水になる。そのまま飲むとお腹を壊すかも。', food: { h: 0, t: 12, raw: 1 }, ret: 'bowl', noQuick: 1 },
  cleanwater:{ n: 'きれいな水', p: 10, c: 1, d: 'ろ過した安全な水。飲むと渇きが30回復する（器は手元に残る）。', food: { h: 0, t: 30 }, ret: 'bowl' },
  fish:      { n: 'アジ', p: 22, c: 2, d: 'よく釣れる魚。焚き火で焼くと回復量が増える。生だとお腹を壊すかも。', food: { h: 12, t: 0, raw: 1 } },
  bigfish:   { n: 'タイ', p: 65, c: 3, d: '立派なタイ。高く売れる。焼くと焼き魚2個になる。', food: { h: 18, t: 0, raw: 1 } },
  grilled:   { n: '焼き魚', p: 38, c: 2, d: '香ばしい焼き魚。空腹が大きく回復する。', food: { h: 35, t: 0 } },
  sardine:   { n: 'イワシ', p: 10, c: 1, d: '小さな魚。2匹まとめて焼くと焼き魚になる。', food: { h: 6, t: 0, raw: 1 } },
  katsuo:    { n: 'カツオ', p: 95, c: 3, d: '朝によく釣れる大物。焼くと焼き魚3個になる。', food: { h: 20, t: 0, raw: 1 } },
  octopus:   { n: 'タコ', p: 42, c: 2, d: '夜によく釣れる。焼くと焼き魚になる。', food: { h: 12, t: 0, raw: 1 } },
  fugu:      { n: 'フグ', p: 48, c: 3, d: '高く売れるが猛毒。絶対に食べてはいけない。', food: { h: 8, t: 0, poison: 1 }, noQuick: 1 },
  meat:      { n: '生肉', p: 15, c: 1, d: '動物から取れる肉。焚き火で焼くと焼き肉になる。生だとお腹を壊すかも。', food: { h: 8, t: 0, raw: 1 } },
  steak:     { n: '焼き肉', p: 40, c: 2, d: 'こんがり焼けた肉。空腹が大きく回復する。', food: { h: 38, t: 0 } },
  hide:      { n: '毛皮', p: 35, c: 2, d: '動物の毛皮。ゼニ丸が買い取ってくれる。' },
  claw:      { n: '大きなハサミ', p: 50, c: 3, d: '大ガニのハサミ。珍味として高く売れる。' },
  boot:      { n: '古い長靴', p: 2, c: 2, d: '釣れてしまった。ほとんど価値はない。' },
  shell:     { n: '貝殻', p: 15, c: 2, d: 'きれいな貝殻。お土産として売れる。' },
  rareshell: { n: '珍しい貝殻', p: 60, c: 3, d: '虹色に光る貝殻。加工するともっと高く売れる。' },
  accessory: { n: '貝のアクセサリー', p: 160, c: 3, d: '珍しい貝殻で作った首飾り。高級品。' },
  metal:     { n: '金属片', p: 80, c: 3, d: '難破船の金属。高性能な道具の材料。' },
  ironore:   { n: '鉄鉱石', p: 40, c: 3, d: '炉で精錬すると鉄インゴットになる。' },
  ingot:     { n: '鉄インゴット', p: 110, c: 3, d: '精錬した鉄。鉄の道具の材料。' },
  crystal:   { n: '水晶', p: 65, c: 3, d: '洞窟で光る透明な結晶。' },
  goldore:   { n: '金鉱石', p: 150, c: 3, d: '金を含む鉱石。炉で延べ棒にできる。' },
  goldbar:   { n: '金の延べ棒', p: 420, c: 3, d: 'まばゆい金の延べ棒。超高級品。' },
  coin:      { n: '古代のコイン', p: 100, c: 3, d: '岩の中から出てきた古いコイン。' },
  canned:    { n: '缶詰', p: 20, c: 2, d: 'ゼニ丸から買える保存食。', food: { h: 40, t: 10 } },
  medkit:    { n: '救急キット', p: 30, c: 2, d: '体力を50回復する。', heal: 50 },
  cloth:     { n: '帆布', p: 80, c: 3, d: '繊維を編んだ丈夫な布。いかだの帆になる。' },
  turtle:    { n: '黄金の亀像', p: 1200, c: 4, d: '島の守り神とされる黄金の像。売れば大金になるが……' },
  ledger:    { n: '裏帳簿', p: 0, c: 0, d: '鮫島海運の裏帳簿。沈めた船と保険金の記録。', key: 1 },
};
const DROP = [0, 0.02, 0.035, 0.05, 0]; // 1個売るごとの値下がり幅
const VOYAGE_FOOD = ['coconut', 'grilled', 'canned'];

const TOOLS = {
  stoneAxe:  { n: '石斧', cat: 'axe', lv: 1, dur: 40 },
  ironAxe:   { n: '鉄の斧', cat: 'axe', lv: 2, dur: 150 },
  stonePick: { n: '石のつるはし', cat: 'pick', lv: 1, dur: 40 },
  ironPick:  { n: '鉄のつるはし', cat: 'pick', lv: 2, dur: 120 },
  rod:       { n: '釣り竿', cat: 'rod', lv: 1, dur: 25 },
  torch:     { n: 'たいまつ', cat: 'torch', lv: 1, dur: 0 },
  stoneSword:{ n: '石の剣', cat: 'sword', lv: 1, dur: 50, dmg: 2 },
  ironSword: { n: '鉄の剣', cat: 'sword', lv: 2, dur: 180, dmg: 4 },
};
const BUILD_NAMES = { campfire: '焚き火', workbench: '作業台', bed: '寝床', furnace: '炉' };
const UP_NAMES = { bag: '大きなかばん', cart: '運搬カート', benchUp: '作業台強化', magnet: 'アイテム回収機' };

// st: hand=どこでも / bench=作業台の近く
const RECIPES = [
  { id: 'rope', st: 'hand', out: 'rope', n: 1, cost: { fiber: 3 }, d: '繊維3つから作る。売値も少し上がる。' },
  { id: 'bowl', st: 'hand', out: 'bowl', n: 1, cost: { wood: 1 }, d: '泉で水を汲むための器。焚き火でろ過すると安全な水になる。' },
  { id: 'stoneAxe', st: 'hand', tool: 'stoneAxe', cost: { stone: 2, wood: 2 }, d: '木材の採集量が1回1個→3個に。耐久40回。' },
  { id: 'stonePick', st: 'hand', tool: 'stonePick', cost: { stone: 3, wood: 1 }, d: '岩・鉄鉱脈・水晶が掘れる。耐久40回。' },
  { id: 'stoneSword', st: 'hand', tool: 'stoneSword', cost: { stone: 3, wood: 1, fiber: 2 }, d: '動物や敵を攻撃する武器。攻撃力2（素手は1）。耐久50回。' },
  { id: 'torch', st: 'hand', tool: 'torch', cost: { branch: 2, fiber: 2 }, d: '夜や洞窟を広く照らす。壊れない。' },
  { id: 'campfire', st: 'hand', build: 'campfire', cost: { branch: 4, stone: 4 }, d: '魚を焼ける。近くにいると夜も寒くない。' },
  { id: 'workbench', st: 'hand', build: 'workbench', cost: { wood: 4, stone: 2 }, d: '高度なクラフトと素材の加工ができる。' },
  { id: 'rod', st: 'bench', tool: 'rod', cost: { branch: 3, rope: 2 }, d: '水辺で釣りができる。耐久25回。' },
  { id: 'bed', st: 'bench', build: 'bed', cost: { wood: 4, fiber: 6 }, d: '夕方以降に眠ると朝まで休める。' },
  { id: 'bag', st: 'bench', up: 'bag', bp: 'bag', cost: { fiber: 10, rope: 3 }, d: '持てる量が+30。' },
  { id: 'cart', st: 'bench', up: 'cart', bp: 'cart', cost: { wood: 6, rope: 2 }, d: '持てる量が+60。' },
  { id: 'furnace', st: 'bench', build: 'furnace', bp: 'furnace', cost: { stone: 10, metal: 2 }, d: '鉱石を精錬して高く売れる。' },
  { id: 'benchUp', st: 'bench', up: 'benchUp', bp: 'benchUp', cost: { plank: 4, metal: 2 }, d: '作業台の加工時間が半分になる。' },
  { id: 'ironAxe', st: 'bench', tool: 'ironAxe', bp: 'iron', cost: { ingot: 2, wood: 2 }, d: '木材4個。速くて丈夫（耐久150回）。' },
  { id: 'ironSword', st: 'bench', tool: 'ironSword', bp: 'iron', cost: { ingot: 2, wood: 1 }, d: '攻撃力4の頼れる剣。耐久180回。' },
  { id: 'ironPick', st: 'bench', tool: 'ironPick', bp: 'iron', cost: { ingot: 3, wood: 2 }, d: '金鉱脈と硬い岩も砕ける（耐久120回）。' },
  { id: 'cloth', st: 'bench', out: 'cloth', n: 1, bp: 'raft', cost: { fiber: 12, rope: 2 }, d: 'いかだの帆。' },
  { id: 'magnet', st: 'bench', up: 'magnet', bp: 'magnet', cost: { metal: 1, rope: 2 }, d: '拾える物を、調べるボタンの長押しで連続回収できる。' },
];
const PROCESS = {
  bench: [
    { id: 'plank', in: { wood: 1 }, out: 'plank', n: 1, t: 8 },
    { id: 'dw', in: { driftwood: 1 }, out: 'wood', n: 1, t: 4 },
    { id: 'acc', in: { rareshell: 1, rope: 1 }, out: 'accessory', n: 1, t: 15 },
  ],
  fire: [
    { id: 'grill', in: { fish: 1 }, out: 'grilled', n: 1, t: 6 },
    { id: 'grillBig', in: { bigfish: 1 }, out: 'grilled', n: 2, t: 9 },
    { id: 'water', in: { rawwater: 1 }, out: 'cleanwater', n: 1, t: 15 },
    { id: 'grillS', in: { sardine: 2 }, out: 'grilled', n: 1, t: 6 },
    { id: 'grillO', in: { octopus: 1 }, out: 'grilled', n: 1, t: 7 },
    { id: 'grillK', in: { katsuo: 1 }, out: 'grilled', n: 3, t: 12 },
    { id: 'steak', in: { meat: 1 }, out: 'steak', n: 1, t: 8 },
  ],
  furnace: [
    { id: 'ingot', in: { ironore: 1, branch: 2 }, out: 'ingot', n: 1, t: 12 },
    { id: 'goldbar', in: { goldore: 2, wood: 1 }, out: 'goldbar', n: 1, t: 20 },
  ],
};
const STATION_NAMES = { bench: '作業台', fire: '焚き火', furnace: '炉' };
const RAFT_COST = { wood: 10, plank: 6, rope: 6, cloth: 1 };
// 天気（毎朝きまる）
const WEATHER = { sun: { n: '晴れ' }, cloud: { n: 'くもり' }, rain: { n: '雨' }, storm: { n: '嵐' } };
// 返済の締め日：[期限に対する位置, その日までに必要な累計返済率]
const STAGE_PLAN = [[0.3, 0.15], [0.6, 0.4], [0.85, 0.7]];
const STAGE_PENALTY = 0.1;   // 未達のとき、残りの借金に上乗せされる割合
// 生き物・敵（kind: passive=逃げる / enemy=襲ってくる、at: day/night/any、where: sand/land/cave）
const MOBS = {
  crab:   { n: 'カニ', hp: 2, sp: 22, kind: 'passive', at: 'day', where: 'sand', cap: 3, drops: [['meat', 1, 0.6], ['claw', 1, 0.2]] },
  rabbit: { n: 'ウサギ', hp: 2, sp: 42, kind: 'passive', at: 'day', where: 'land', cap: 3, drops: [['meat', 1], ['hide', 1, 0.35]] },
  dog:    { n: '野犬', hp: 5, sp: 47, kind: 'enemy', at: 'night', where: 'land', cap: 2, dmg: 6, sight: 96, drops: [['meat', 1], ['hide', 1, 0.5]] },
  gcrab:  { n: '大ガニ', hp: 8, sp: 20, kind: 'enemy', at: 'night', where: 'sand', cap: 2, dmg: 10, sight: 64, drops: [['claw', 1], ['claw', 1, 0.5], ['meat', 1]] },
  bat:    { n: 'コウモリ', hp: 3, sp: 38, kind: 'enemy', at: 'any', where: 'cave', cap: 3, dmg: 4, sight: 84, fly: 1, drops: [['coin', 1, 0.15], ['crystal', 1, 0.1]] },
};
const STORAGE_CAP = 300;   // 小屋の倉庫に入る数
// ギャンブル（沈没船カジノ・ゼニ丸の勝負）
const LINER_REPAIR = { metal: 3, rope: 2, wood: 2 };
const BETS = [10, 50, 100, 500];
const SLOT = {   // 還元率 約91%・当たり率 約46%（チェリー1個は掛け金が戻る）
  sym: ['seven', 'bar', 'bell', 'palm', 'shell', 'cherry'], w: [1, 2, 3, 4, 5, 3],
  name: { seven: '7', bar: 'BAR', bell: 'ベル', palm: 'ヤシ', shell: '貝', cherry: 'チェリー' },
  pay: { seven: 150, bar: 40, bell: 12, palm: 6, shell: 4 }, cherry: [0, 1, 3, 15],
};
const ROU_RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const ZENI_BET = { win: 0.45, up: 1.8, down: 0.3, max: 3000 };   // 勝てば1.8倍、負ければ3割（期待値は1未満）

// req: 返済率（初期借金に対する返済額）
const SHOP = [
  { id: 'bp_bag', n: '大きなかばんの設計図', p: 150, bp: 'bag', req: 0, d: '作業台で「大きなかばん」が作れる。' },
  { id: 'bp_magnet', n: 'アイテム回収機の設計図', p: 180, bp: 'magnet', req: 0, d: '作業台で「アイテム回収機」が作れる。拾い物を長押しで連続回収できる。' },
  { id: 'bp_benchUp', n: '作業台強化の設計図', p: 250, bp: 'benchUp', req: 0.25, d: '作業台の加工時間が半分になる。' },
  { id: 'bp_cart', n: '運搬カートの設計図', p: 350, bp: 'cart', req: 0.25, d: '持てる量が大幅に増える。' },
  { id: 'bp_furnace', n: '炉の設計図', p: 300, bp: 'furnace', req: 0.25, d: '鉱石を精錬できる設備。' },
  { id: 'bp_iron', n: '鉄の道具の設計図', p: 450, bp: 'iron', req: 0.5, d: '鉄の斧・鉄のつるはし・鉄の剣が作れる。' },
  { id: 'canned', n: '缶詰', p: 45, item: 'canned', req: 0, d: '空腹+40・渇き+10。' },
  { id: 'medkit', n: '救急キット', p: 80, item: 'medkit', req: 0, d: '体力+50。' },
];

// 採集・設置物の定義
const OBJ = {
  tree:     { n: '木', block: 1, g: { act: '木を切る', cat: 'axe', hits: [6, 3, 2], sfx: 'chop', fx: 'wood', to: 'stump', regrow: 2,
              y: lv => lv === 0 ? [['wood', 1], ['branch', 1, 0.4]] : lv === 1 ? [['wood', 3], ['branch', 1, 0.6]] : [['wood', 4], ['branch', 1, 0.7]] } },
  stump:    { n: '切り株', block: 0, regrowInfo: 1 },
  palm:     { n: 'ヤシの木', block: 1, g: { act: '木をゆする', hits: [1, 1, 1], sfx: 'shake', fx: 'leaf', special: 'palm' } },
  bush:     { n: 'しげみ', block: 1, g: { act: 'ベリーを摘む', instant: 1, sfx: 'pick', fx: 'leaf', special: 'bush' } },
  grass:    { n: '草', block: 0, g: { act: '草を刈る', hits: [1, 1, 1], sfx: 'cut', fx: 'leaf', to: 'grassCut', regrow: 1, y: () => [['fiber', 2], ['fiber', 1, 0.3]] } },
  grassCut: { n: '刈った草', block: 0, regrowInfo: 1 },
  pebble:   { n: '小石', block: 0, g: { act: '拾う', instant: 1, sfx: 'pick', remove: 1, y: () => [['stone', 1]] } },
  twig:     { n: '木の枝', block: 0, g: { act: '拾う', instant: 1, sfx: 'pick', remove: 1, y: () => [['branch', 2]] } },
  driftwood:{ n: '流木', block: 0, g: { act: '拾う', instant: 1, sfx: 'pick', remove: 1, y: () => [['driftwood', 1]] } },
  shell:    { n: '貝殻', block: 0, g: { act: '拾う', instant: 1, sfx: 'pick', remove: 1, special: 'shell' } },
  crate:    { n: '漂着した木箱', block: 1, g: { act: 'こじ開ける', cat: 'axe', hits: [3, 2, 2], sfx: 'chop', fx: 'wood', remove: 1, special: 'crate' } },
  scrap:    { n: '難破船の残骸', block: 1, g: { act: '解体する', cat: 'pick', hits: [8, 4, 2], sfx: 'mine', fx: 'metal', remove: 1, y: lv => [['metal', lv > 0 ? 2 : 1]] } },
  boulder:  { n: '岩', block: 1, g: { act: '岩を砕く', cat: 'pick', need: 1, hits: [0, 4, 2], sfx: 'mine', fx: 'stone', to: 'rubble', regrow: 3,
              y: () => [['stone', 3], ['ironore', 1, 0.15], ['metal', 1, 0.08], ['coin', 1, 0.04]] } },
  rubble:   { n: '砕けた岩', block: 0, regrowInfo: 1 },
  ironVein: { n: '鉄鉱脈', block: 1, g: { act: '鉱石を掘る', cat: 'pick', need: 1, hits: [0, 5, 3], sfx: 'mine', fx: 'iron', to: 'ironVeinD', regrow: 2,
              y: () => [['ironore', 2], ['ironore', 1, 0.3], ['stone', 1, 0.3]] } },
  ironVeinD:{ n: '掘り尽くした鉱脈', block: 1, regrowInfo: 1 },
  crystal:  { n: '水晶', block: 1, g: { act: '水晶を掘る', cat: 'pick', need: 1, hits: [0, 4, 2], sfx: 'crystal', fx: 'crystal', to: 'crystalD', regrow: 2,
              y: () => [['crystal', 1], ['crystal', 1, 0.5]] } },
  crystalD: { n: '掘り尽くした水晶', block: 1, regrowInfo: 1 },
  goldVein: { n: '金鉱脈', block: 1, g: { act: '金を掘る', cat: 'pick', need: 2, hits: [0, 0, 4], sfx: 'mine', fx: 'gold', to: 'goldVeinD', regrow: 3,
              y: () => [['goldore', 2], ['goldore', 1, 0.3]] } },
  goldVeinD:{ n: '掘り尽くした金鉱脈', block: 1, regrowInfo: 1 },
  hardRock: { n: '硬い岩', block: 1, g: { act: '硬い岩を砕く', cat: 'pick', need: 2, hits: [0, 0, 6], sfx: 'mine', fx: 'stone', remove: 1, y: () => [['stone', 2]] } },
  diary:    { n: '古いノート', block: 0, it: 'diary', act: 'ノートを読む' },
  shrine:   { n: '亀の祠', block: 1, it: 'shrine', act: '祠を調べる' },
  shrineEmpty: { n: '空の祠', block: 1, it: 'shrineEmpty', act: '祠を調べる' },
  cave:     { n: '洞窟', block: 1, it: 'cave', act: '洞窟に入る', fp: [[-1, 0], [0, 0], [1, 0], [-1, -1], [0, -1], [1, -1]] },
  exit:     { n: '出口', block: 0, it: 'exit', act: '外に出る' },
  box:      { n: '回収ボックス', block: 1, it: 'shop', act: 'ゼニ丸と取引する' },
  campfire: { n: '焚き火', block: 1, it: 'station', st: 'fire', act: '焚き火を使う' },
  workbench:{ n: '作業台', block: 1, it: 'station', st: 'bench', act: '作業台を使う' },
  furnace:  { n: '炉', block: 1, it: 'station', st: 'furnace', act: '炉を使う' },
  bed:      { n: '寝床', block: 1, it: 'bed', act: '眠る' },
  hut:      { n: '古い小屋', block: 1, it: 'hut', act: '小屋を調べる', fp: [[0, 0], [1, 0]] },
  wreck:    { n: '難破船', block: 1, it: 'wreck', act: '難破船を調べる', fp: [[0, 0], [1, 0], [2, 0], [0, -1], [1, -1], [2, -1]] },
  raft:     { n: 'いかだ置き場', block: 0, it: 'raft', act: 'いかだ置き場' },
  drop:     { n: '落とし物', block: 0, it: 'drop', act: '拾う' },
  liner:    { n: '豪華客船の残骸', block: 1, it: 'liner', act: '客船を調べる', fp: [[0, 0], [1, 0], [2, 0], [0, -1], [1, -1], [2, -1]] },   // 捨てた物・倒れた時に落とした物（id, n, lock）
};
const PLACE_SPR = { campfire: 'fire0', workbench: 'bench', bed: 'bed', furnace: 'furnace' };
const REVERT = { stump: 'tree', grassCut: 'grass', rubble: 'boulder', ironVeinD: 'ironVein', crystalD: 'crystal', goldVeinD: 'goldVein' };

/* ---------- 5. ストーリー ---------- */
const SPEAKERS = {
  me:   { name: () => game ? game.name : 'あなた', col: '#9fd3ff', por: 'me' },
  same: { name: () => '鮫島', col: '#ff8a7a', por: 'same' },
  zeni: { name: () => 'ゼニ丸', col: '#f2c440', por: 'zeni' },
  gen:  { name: () => 'ゲンの日誌', col: '#c8e6a0', por: 'gen' },
  sys:  { name: () => '', col: '#a9b6c8', por: null },
};
const PROLOGUE = [
  '「頼む、保証人になってくれ。\n絶対に迷惑はかけないから」',
  '——親友のその言葉を信じたのが、\n運の尽きだった。',
  '親友は姿を消し、残ったのは {debt} の借金だけ。\n貸主は、悪名高い「鮫島ファイナンス」。',
  '「返せねえなら、船で働いて返してもらうぜ」\n社長の鮫島に連れられ、\nあなたは遠洋漁船に乗せられた。',
  '出港から三日目の夜。\n船は突然の嵐に呑まれ——',
  '……波の音で、目が覚めた。',
];
const TALK = {
  intro: [
    ['me', '……ここは、どこだ？ 島……？'],
    ['me', '船は……みんなは……？'],
    ['sys', 'ポケットの防水無線機が、ザザッと鳴った。'],
    ['same', 'よう、生きてたか、{name}。俺だ、鮫島だ。'],
    ['same', '俺たちは救命ボートで本土に戻った。運が良かったぜ、ハッハッハ！'],
    ['same', 'さて、本題だ。船は沈んでも、お前の借金は沈まねえ。残り {debt}、利息は1日 {rate}% だ。'],
    ['same', 'その島はちょうどウチの社有地でな。島の物は石ころ一つまで買い取ってやる。'],
    ['same', '回収ドローンを送っておいた。拾った物はそいつに売って、その金で返済しろ。'],
    ['zeni', 'ピピッ！ 回収ドローン「ゼニ丸」デス！ 買取ト返済ノ受付ヲ担当シマス。ゼニ！'],
    ['same', '期限は {days}日目が終わるまでだ。返せなきゃ……迎えに行ってやるよ。'],
    ['same', '一生、マグロ船の上で働いてもらうがな。ハッハッハ！　……ブツッ'],
    ['me', '……やるしかない。まずは浜辺の物を拾って、売ってみよう。'],
    ['sys', '{controls}'],
  ],
  firstSale: [
    ['zeni', 'マイドアリ！ 売上ハ「所持金」ニ入リマス。ゼニ！'],
    ['zeni', '同ジ品物ヲ売リ続ケルト、値段ガ下ガリマス。時間ガタツト元ニ戻リマス。毎朝ノ「特需」モ要チェックデス！'],
    ['zeni', '返済ハ「返済」タブカラ。利息ハ毎朝、残リノ借金ニカカリマス。'],
    ['me', 'すぐ返済するか、道具に投資するか……考えどころだな。'],
  ],
  firstRepay: [['zeni', '返済、確カニ受ケ取リマシタ。ゼニ！']],
  firstNight: [
    ['me', '暗くなってきた……。それに、冷える。'],
    ['sys', '夜は焚き火のそばにいないと体力が少しずつ減る。寝床があれば、夕方以降に眠って朝まで休める。'],
  ],
  m25: [
    ['same', 'ほう、ちゃんと返してるじゃねえか。いい心がけだ。'],
    ['same', 'ご褒美だ。運搬カート、炉、作業台強化の設計図を売ってやる。ゼニ丸から買いな。……もちろんタダじゃねえぞ。'],
  ],
  m50: [
    ['same', 'チッ……半分も返しやがったか。'],
    ['same', '鉄の道具の設計図も売ってやる。……それと、北東の洞窟の奥には近づくなよ。崩れやすいからな。'],
    ['me', '（今、少し声が焦っていたような……？）'],
  ],
  m75: [
    ['same', '……おい、{name}。お前、本当に全部返す気か？'],
    ['same', '島の暮らしも悪くねえだろ？ なあ、ずっとそこにいてもいいんだぜ？'],
    ['me', '（なぜか引き止められている気がする……）'],
  ],
  paid: [
    ['zeni', 'ピピーッ！ 借金、完済デス！ オメデトウゴザイマス！ ゼニ！'],
    ['same', '……チッ。完済だ。契約は終わりだよ。'],
    ['me', 'じゃあ、迎えの船を——'],
    ['same', '迎え？ 契約書にそんな項目はねえよ。自力で帰ってきな。……ブツッ'],
    ['me', '……やっぱりな。いかだを作って、この島を出よう。'],
  ],
  paidHint: [['me', 'そういえば、島の西に古い小屋があった。何か手がかりがあるかもしれない。']],
  halfBad: [['same', 'おいおい、もう半分過ぎたぞ。大丈夫かぁ？ ハッハッハ！']],
  halfGood: [['same', '……順調みてえだな。チッ、面白くねえ。']],
  lastDay: [['same', '明日の朝、迎えに行く。せいぜい準備しとけよ、{name}。']],
  diary1: [
    ['sys', '小屋の中に、古びたノートが落ちている。紙はすっかり黄ばんでいる。'],
    ['gen', '「漂流日誌　その1」'],
    ['gen', 'わしの名はゲン。鮫島海運に借金を返すため船に乗り、嵐で沈み、この島に流れ着いた。'],
    ['gen', '無線で社長は言った。「その島はウチの社有地だ」と。だが島の古い石碑には、この島は誰のものでもないと刻まれていた。'],
    ['gen', 'いつか帰る日のために、いかだの作り方を書き残しておく。帆は繊維を編んで作るといい。'],
    ['sys', 'いかだの設計図を手に入れた！（作業台で帆布が作れるようになった）'],
    ['me', '鮫島海運……鮫島ファイナンスの前身か？ この人も、同じ目に……'],
  ],
  diary2: [
    ['sys', '岩陰に、ノートの切れ端がはさまっている。'],
    ['gen', '「漂流日誌　その2」'],
    ['gen', '船が沈んだあの夜、甲板で社長の部下が何かを仕掛けているのを見た。あの沈没は事故ではない。保険金目当てだ。'],
    ['gen', '鮫島は借金を抱えた者を船に乗せて沈め、保険金と島の資源で二重に儲けているのだ。'],
    ['gen', '証拠の裏帳簿は、洞窟の奥の亀の祠に隠した。だが落盤で道がふさがってしまった。硬い岩を砕ける鉄の道具があれば……'],
    ['me', '……！ まさか、俺の乗っていた船も……'],
  ],
  diary3: [
    ['gen', '「漂流日誌　その3」'],
    ['gen', 'わしはもう長くない。これを読む誰かへ。'],
    ['gen', '祠の黄金の亀は、この島の守り神。その台座の下に、裏帳簿を隠してある。'],
    ['gen', 'どうか生きて島を出て、真実を明るみに出してくれ。……家族に、すまなかったと伝えてほしい。'],
  ],
  shrine: [
    ['sys', '黄金の亀像を手に入れた！'],
    ['sys', '台座の下から、古びた帳簿が出てきた。「鮫島海運 裏帳簿」——沈めた船の名前と、受け取った保険金の額がびっしり書かれている。'],
    ['me', 'これがあれば、鮫島の悪事を暴ける……！ 必ず持って帰ろう。'],
    ['sys', '無線機が、ザザッと鳴った。'],
    ['same', '……おい、{name}。今、洞窟で何か見つけたか？　……いや、なんでもねえ。'],
  ],
  cave: [
    ['me', 'ひんやりしている……。奥まで続いているみたいだ。'],
    ['sys', '洞窟の中は暗い。たいまつがあると広く照らせる。天井からの落石に注意！（地面に影が見えたら離れよう）'],
  ],
  hut: [['me', '古びた小屋だ。誰かがここで暮らしていたらしい……。']],
  liner: [
    ['me', 'こんな所に、大きな客船が打ち上げられている……！'],
    ['sys', '船体に、かすれた文字が見える。「鮫島海運　ルナ・マリーナ号」'],
    ['me', '鮫島の船……？ これも保険金のために沈めたのか……。'],
    ['me', '中はカジノになっているみたいだ。でも電源が落ちている。'],
    ['me', '奥の発電機を直せば、動くかもしれない。'],
  ],
  linerOpen: [
    ['sys', '発電機がうなりを上げ、船内にネオンが灯った！'],
    ['me', 'スロットにルーレット……。ここで一発当てれば、借金なんて……。'],
    ['gen', '（日誌の切れ端）賭けは魔物だ。俺はあの船で、帰りの金まで全部すった。'],
  ],
  zeniBet: [
    ['zeni', 'ピピッ！ ゼニ丸ノ「倍々チャンス」デス！ 素材ヲ1種類マルゴト賭ケテ、勝負シマセンカ？'],
    ['zeni', '勝テバ査定額ノ1.8倍デ買イ取リ！ 負ケタラ3割デ買イ叩キマス。1日1回マデ。ゼニ！'],
  ],
  wreck: [['me', '俺が乗っていた船の残骸だ……。使えそうな金属が転がっている。']],
  raftNoBp: [['me', 'ここなら、いかだを組み立てられそうだ。でも、作り方がわからない……。']],
  raftBuilt: [['sys', 'いかだが完成した！'], ['me', 'あとは食料を積んで、海に出るだけだ。']],
  faint: [['sys', '……気を失っていたようだ。気がつくと、浜辺に倒れていた。'], ['sys', '持ち物は倒れた場所に落としてきたらしい。所持金も少しなくしてしまった……。\n取りに戻ろう。']],
};
const ENDINGS = {
  A: { type: 'BAD END', title: '回収の朝', lines: [
    '{days1}日目の朝。水平線に、黒い船が現れた。',
    '「時間切れだぜ、{name}」\n鮫島が、サングラスの奥で笑っていた。',
    'あなたはマグロ船に乗せられ、\n二度と陸を踏むことはなかった——',
  ] },
  B: { type: 'NORMAL END', title: '自由への航海', lines: [
    'いかだは波を越え、三日後、\nあなたは本土の港にたどり着いた。',
    '借金はもうない。\n手元にあるのは、島で鍛えた腕と、日焼けした肌だけ。',
    '時々、あの島の夢を見る。\nゼニ丸は今も、誰かの品物を買い取っているのだろうか。',
  ] },
  C: { type: 'TRUE END', title: '島が教えてくれた真実', lines: [
    'いかだは波を越え、三日後、\nあなたは本土の港にたどり着いた。',
    'あなたはその足で、裏帳簿を警察に届けた。',
    '数日後、ニュースが流れた。\n「鮫島ファイナンス社長を逮捕　保険金目当てに漁船を沈没させた疑い」',
    '不当な借金は無効となり、\nあなたが返した金も戻ってくることになった。',
    'そしてあなたは、ゲンの家族のもとへ、\n一冊の日誌を届けた。',
  ] },
  D: { type: 'BAD END', title: '逃げ切れなかった夜', lines: [
    '借金を残したまま、あなたは夜の海へこぎ出した。',
    '三日後、本土の港にたどり着いた、その時——',
    '「よう、待ってたぜ」\n桟橋で、鮫島が笑っていた。',
    '……ゼニ丸には、GPSが付いていたのだ。',
  ] },
  E: { type: 'SPECIAL END', title: '大逆転の夜逃げ', lines: [
    '借金を残したまま、あなたは夜の海へこぎ出した。',
    '三日後、本土の港。「よう、待ってたぜ」\n桟橋で鮫島が笑っていた。',
    'だがあなたは、黙って裏帳簿を突きつけた。\n鮫島の顔から、みるみる血の気が引いていく。',
    'その日のうちに鮫島は逮捕され、借金は無効になった。\n……少し、ずるい気もするけれど。',
  ] },
};
const ENDING_ORDER = ['B', 'C', 'E', 'A', 'D'];

/* ---------- 6. ドット絵（すべてプログラムで描画） ---------- */
const P = {
  ol: '#1a1626', woodD: '#5a3a22', wood: '#8b5a2b', woodL: '#b07a3f',
  leafD: '#1f5e2e', leaf: '#2f8a3e', leafL: '#57b84a',
  stoneD: '#5d5f6e', stone: '#8a8d99', stoneL: '#b9bcc6',
  gold: '#f2c440', goldD: '#b8860b', goldL: '#fff2a8', iron: '#b9c2ca', ironL: '#eef2f6', ironD: '#7a8590',
};
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function painter(x) {
  return {
    r(X, Y, W, H, col) { x.fillStyle = col; x.fillRect(X, Y, W, H); },
    p(X, Y, col) { x.fillStyle = col; x.fillRect(X, Y, 1, 1); },
    e(cx, cy, rx, ry, col) {
      x.fillStyle = col;
      for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        const dx = (xx + 0.5 - cx) / rx, dy = (yy + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) x.fillRect(xx, yy, 1, 1);
      }
    },
    l(x0, y0, x1, y1, col) {
      x.fillStyle = col; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1; let er = dx + dy;
      for (let i = 0; i < 400; i++) { x.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * er; if (e2 >= dy) { er += dy; x0 += sx; } if (e2 <= dx) { er += dx; y0 += sy; } }
    },
    clear(X, Y, W, H) { x.clearRect(X, Y, W, H); },
  };
}
function addOutline(c, col) {
  const x = c.getContext('2d'), w = c.width, h = c.height, img = x.getImageData(0, 0, w, h), d = img.data, rgb = hexRgb(col), out = [];
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
    const k = (y * w + i) * 4; if (d[k + 3] !== 0) continue;
    if ((i > 0 && d[k - 1] > 0) || (i < w - 1 && d[k + 7] > 0) || (y > 0 && d[k - w * 4 + 3] > 0) || (y < h - 1 && d[k + w * 4 + 3] > 0)) out.push(k);
  }
  for (const k of out) { d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255; }
  x.putImageData(img, 0, 0);
}
function mk(w, h, fn, ol) { const c = mkCanvas(w, h); fn(painter(c.getContext('2d'))); if (ol !== false) addOutline(c, ol || P.ol); return c; }
function flipH(src) { const c = mkCanvas(src.width, src.height), x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }

function drawPlayer(g, dir, f) {
  const skin = '#f2c9a0', hair = '#4a2e1f', shirt = '#ece6d6', shirtD = '#c9bfa8', pants = '#3a62b8', pantsD = '#2a4a8c', shoe = '#4a3020';
  if (dir !== 'side') {
    g.r(5, 1, 6, 1, hair); g.r(4, 2, 8, 3, hair);
    if (dir === 'down') {
      g.r(4, 4, 1, 3, hair); g.r(11, 4, 1, 3, hair);
      g.r(5, 4, 6, 4, skin); g.r(5, 4, 3, 1, hair); g.p(9, 4, hair);
      g.r(4, 7, 8, 1, skin); g.r(5, 8, 6, 1, skin);
      g.p(6, 6, P.ol); g.p(9, 6, P.ol); g.p(5, 7, '#f0a090'); g.p(10, 7, '#f0a090');
    } else { g.r(4, 5, 8, 3, hair); g.r(5, 8, 6, 1, '#3a2418'); }
    g.r(4, 9, 8, 3, shirt); g.r(4, 11, 8, 1, shirtD);
    g.r(3, 9 + (f === 1 ? 1 : 0), 1, 3, skin); g.r(12, 9 + (f === 2 ? 1 : 0), 1, 3, skin);
    g.r(5, 12, 6, 2, pants); g.r(7, 13, 2, 1, pantsD);
    if (f === 2) g.r(5, 14, 2, 1, shoe); else { g.r(5, 14, 2, 1, skin); g.r(5, 15, 2, 1, shoe); }
    if (f === 1) g.r(9, 14, 2, 1, shoe); else { g.r(9, 14, 2, 1, skin); g.r(9, 15, 2, 1, shoe); }
  } else {
    g.r(5, 1, 6, 1, hair); g.r(4, 2, 8, 3, hair); g.r(4, 5, 3, 3, hair);
    g.r(7, 5, 5, 3, skin); g.r(8, 4, 3, 1, skin); g.p(12, 6, skin); g.r(7, 8, 4, 1, skin);
    g.p(10, 5, P.ol); g.p(11, 7, '#f0a090');
    g.r(5, 9, 6, 3, shirt); g.r(5, 11, 6, 1, shirtD);
    const ax = f === 1 ? 1 : f === 2 ? -1 : 0; g.r(7 + ax, 9, 2, 3, '#e0b088');
    g.r(5, 12, 6, 2, pants);
    if (f === 0) { g.r(6, 14, 2, 1, skin); g.r(6, 15, 3, 1, shoe); g.r(9, 14, 1, 1, skin); g.r(9, 15, 2, 1, shoe); }
    else if (f === 1) { g.r(5, 14, 2, 1, skin); g.r(4, 15, 3, 1, shoe); g.r(9, 14, 2, 1, skin); g.r(10, 15, 3, 1, shoe); }
    else { g.r(7, 14, 2, 1, skin); g.r(7, 15, 3, 1, shoe); g.r(8, 13, 2, 1, pantsD); }
  }
}

const SPR = {};
const PL = [[], [], [], []]; // [dir][frame]
const ICON = {};      // canvas
const ICON_URL = {};  // dataURL
const POR = {};       // 立ち絵（会話用）

function buildSprites() {
  const S = SPR;
  const trunk = g => { g.r(6, 20, 4, 12, P.wood); g.r(6, 20, 1, 12, P.woodD); g.r(9, 21, 1, 9, P.woodL); g.r(5, 30, 6, 2, P.woodD); };
  S.treeA = mk(16, 32, g => { trunk(g); g.e(8, 12.5, 6.6, 8, P.leafD); g.e(7.6, 11.2, 5.8, 6.6, P.leaf); g.e(6.2, 8.4, 3.2, 2.8, P.leafL);
    for (const [x, y] of [[10, 14], [4, 13], [11, 9], [7, 16], [12, 12]]) g.p(x, y, P.leafD); g.p(9, 6, P.leafL); g.p(4, 9, P.leafL); });
  S.treeB = mk(16, 32, g => { trunk(g); g.e(8, 13, 6.8, 7.2, '#22663a'); g.e(8, 12, 5.8, 6, '#33904a'); g.e(6.5, 9.5, 2.8, 2.4, '#5cc057');
    for (const [x, y] of [[11, 15], [5, 14], [10, 9], [8, 17]]) g.p(x, y, '#22663a'); g.p(10, 7, '#5cc057'); });
  S.stump = mk(16, 16, g => { g.r(5, 10, 6, 5, P.wood); g.r(5, 10, 1, 5, P.woodD); g.e(8, 10.5, 3, 1.5, P.woodL); g.p(8, 10, P.wood); g.r(4, 14, 8, 1, P.woodD); });
  S.palm = mk(16, 32, g => {
    for (let i = 0; i < 21; i++) { const y = 31 - i, x = Math.round(6 + Math.sin(i / 6.5) * 1.6); g.r(x, y, 3, 1, i % 3 === 0 ? '#7a5530' : '#a87a4a'); g.p(x, y, '#7a5530'); }
    for (const [lx, ly] of [[1, 15], [2, 7], [7, 2], [13, 3], [15, 9], [14, 15]]) { g.l(8, 11, lx, ly + 1, '#1f6e2e'); g.l(8, 10, lx, ly, '#3ea24a'); if (ly < 10) g.l(8, 9, lx, ly - 1, '#6cc04a'); }
    g.e(8, 10, 2, 1.6, '#2f8a3e');
  });
  S.coco = mk(4, 4, g => { g.e(2, 2, 1.7, 1.7, '#6b4423'); g.p(1, 1, '#8a5a30'); }, false);
  const bush = g => { g.e(8, 10.5, 6.5, 4.8, P.leafD); g.e(7.6, 9.6, 5.6, 4, P.leaf); g.e(5.6, 8, 2.2, 1.6, P.leafL); g.p(10, 12, P.leafD); g.p(4, 11, P.leafD); };
  S.bush = mk(16, 16, bush);
  S.bushB = mk(16, 16, g => { bush(g); for (const [x, y] of [[5, 10], [9, 8], [11, 11], [7, 12], [12, 8]]) { g.r(x, y, 2, 2, '#d4304a'); g.p(x, y, '#ff8aa0'); } });
  S.grass = mk(16, 16, g => { g.l(4, 15, 2, 9, '#3f8f36'); g.l(5, 15, 6, 7, '#5cb84a'); g.l(7, 15, 8, 6, '#3f8f36'); g.l(9, 15, 10, 8, '#5cb84a'); g.l(10, 15, 13, 9, '#3f8f36'); g.l(12, 15, 14, 11, '#5cb84a'); }, '#24521f');
  S.grassCut = mk(16, 16, g => { for (const x of [4, 6, 8, 10, 12]) g.r(x, 13, 1, 2, '#4a9a3e'); }, '#24521f');
  S.pebble = mk(16, 16, g => { g.e(7, 12, 3, 2, P.stoneD); g.e(6.6, 11.5, 2.4, 1.4, P.stone); g.p(6, 11, P.stoneL); g.e(11, 13, 1.6, 1.1, P.stone); });
  S.twig = mk(16, 16, g => { g.l(3, 12, 12, 10, P.woodD); g.l(3, 11, 12, 9, P.wood); g.l(6, 13, 10, 8, P.wood); g.p(10, 8, P.leafL); });
  S.driftwood = mk(16, 16, g => { g.r(2, 10, 12, 3, '#a8957a'); g.r(2, 10, 12, 1, '#c9b89c'); g.r(2, 12, 12, 1, '#7d6c56'); g.p(6, 11, '#7d6c56'); g.r(13, 9, 2, 2, '#a8957a'); });
  S.shell = mk(16, 16, g => { g.e(8, 11, 3.5, 3, '#f6d6cc'); g.l(8, 13, 5, 9, '#e3a596'); g.l(8, 13, 8, 8, '#e3a596'); g.l(8, 13, 11, 9, '#e3a596'); g.r(7, 13, 3, 1, '#e3a596'); });
  S.crate = mk(16, 16, g => { g.r(3, 5, 10, 10, P.wood); g.r(3, 5, 10, 1, P.woodL); g.r(3, 9, 10, 1, P.woodD); g.r(3, 14, 10, 1, P.woodD); g.r(3, 5, 1, 10, P.woodD); g.r(12, 5, 1, 10, P.woodD); g.l(4, 6, 11, 13, P.woodD); for (const [x, y] of [[3, 5], [12, 5], [3, 14], [12, 14]]) g.p(x, y, '#9aa4ad'); });
  S.scrap = mk(16, 16, g => { g.e(8, 12, 6, 3, '#5c6670'); g.r(4, 7, 5, 6, '#8d98a2'); g.r(9, 6, 4, 7, '#7a8590'); g.r(4, 7, 5, 1, '#c8d0d8'); g.p(6, 10, '#b5643a'); g.p(11, 9, '#b5643a'); g.e(11.5, 11.5, 2, 2, '#a9b3bc'); g.p(11, 11, '#4a525a'); });
  const rock = (g, a, b, c) => { g.e(8, 10, 6.5, 5, a); g.e(7.5, 9, 5.5, 4, b); g.e(6, 7.5, 2.5, 1.5, c); };
  S.boulder = mk(16, 16, g => { rock(g, P.stoneD, P.stone, P.stoneL); g.l(9, 10, 11, 12, P.stoneD); });
  S.rubble = mk(16, 16, g => { g.e(5, 12, 2, 1.5, P.stone); g.e(10, 13, 2.5, 1.5, P.stoneD); g.e(8, 11, 1.5, 1, P.stone); });
  S.ironVein = mk(16, 16, g => { rock(g, '#5a5462', '#7a7280', '#9a92a0'); for (const [x, y] of [[5, 9], [9, 8], [10, 11], [6, 11]]) g.r(x, y, 2, 2, '#d97a3a'); g.p(9, 8, '#f0a060'); });
  S.ironVeinD = mk(16, 16, g => { g.e(8, 11, 5.5, 3.6, '#4a4452'); g.e(7.5, 10.4, 4.5, 2.8, '#5f5868'); g.p(7, 11, '#8a5a3a'); });
  S.crystal = mk(16, 16, g => { g.e(8, 13, 6, 2.5, '#4a4452'); g.r(5, 6, 2, 7, '#5cc8e0'); g.p(5, 5, '#5cc8e0'); g.r(8, 3, 3, 10, '#7fe3f0'); g.r(9, 3, 1, 9, '#c8fbff'); g.p(9, 2, '#7fe3f0'); g.r(11, 7, 2, 6, '#5cc8e0'); g.p(11, 6, '#5cc8e0'); });
  S.crystalD = mk(16, 16, g => { g.e(8, 13, 6, 2.5, '#4a4452'); g.r(6, 11, 2, 2, '#5cc8e0'); g.r(10, 11, 2, 2, '#4aa8c0'); });
  S.goldVein = mk(16, 16, g => { rock(g, '#3e3646', '#564c60', '#6e6478'); for (const [x, y] of [[5, 9], [9, 7], [10, 11], [6, 12]]) g.r(x, y, 2, 2, P.gold); g.p(9, 7, P.goldL); g.p(5, 9, P.goldL); });
  S.goldVeinD = mk(16, 16, g => { g.e(8, 11, 5.5, 3.6, '#3e3646'); g.e(7.5, 10.4, 4.5, 2.8, '#4e4458'); g.p(8, 10, P.goldD); });
  S.hardRock = mk(16, 16, g => { g.e(8, 9, 7.2, 6.6, '#2e2833'); g.e(7.5, 8, 6, 5, '#463e50'); g.e(6, 6, 2.5, 1.5, '#625a6e'); g.l(5, 9, 8, 12, '#1a161e'); g.l(8, 12, 11, 9, '#1a161e'); g.l(10, 5, 11, 8, '#1a161e'); g.p(12, 11, '#8a3a3a'); g.p(4, 7, '#8a3a3a'); });
  S.diary = mk(16, 16, g => { g.r(4, 6, 8, 9, '#f3ead2'); g.r(4, 6, 8, 1, '#fffaf0'); for (const y of [8, 10, 12]) g.r(5, y, 6, 1, '#a89a7a'); g.p(11, 6, '#d0c4a6'); g.r(3, 7, 1, 8, '#c9a46a'); });
  const ped = g => { g.r(2, 15, 12, 8, P.stone); g.r(2, 15, 12, 1, P.stoneL); g.r(2, 22, 12, 1, P.stoneD); g.r(3, 17, 10, 1, P.stoneD); g.p(4, 19, P.stoneD); g.p(11, 20, P.stoneD); };
  S.shrine = mk(16, 24, g => { ped(g); g.e(8, 11.5, 5.2, 3.6, P.goldD); g.e(8, 11, 4.6, 3, P.gold); for (const [x, y] of [[6, 10], [8, 9], [10, 10], [7, 12], [9, 12]]) g.p(x, y, P.goldD); g.e(13.6, 11.5, 1.6, 1.3, P.gold); g.p(14, 11, '#3a2a10'); g.p(4, 14, P.goldD); g.p(11, 14, P.goldD); g.p(6, 9, P.goldL); });
  S.shrineEmpty = mk(16, 24, g => { ped(g); g.r(5, 14, 6, 1, P.stoneD); });
  S.cave = mk(32, 24, g => { g.e(16, 14, 15, 9.6, P.stoneD); g.e(15.5, 12.6, 13.6, 8.2, P.stone); g.e(10, 8, 4, 2, P.stoneL); g.e(22, 9, 3, 1.5, P.stoneL);
    g.p(6, 15, P.stoneD); g.p(25, 13, P.stoneD); g.p(4, 12, '#5a8a3a'); g.p(27, 16, '#5a8a3a'); g.e(16, 16.5, 6, 5.5, '#0d0b12'); g.r(10, 17, 12, 7, '#0d0b12'); });
  S.exit = mk(16, 16, g => { g.r(5, 0, 1, 16, P.woodL); g.r(10, 0, 1, 16, P.woodL); for (let y = 1; y < 16; y += 3) g.r(5, y, 6, 1, P.wood); });
  const fire = g => { g.e(8, 13, 6, 2.4, P.stoneD); g.e(8, 12.6, 4.8, 1.8, '#3a2a1a'); g.l(4, 13, 12, 11, P.woodD); g.l(4, 11, 12, 13, P.wood); for (const [x, y] of [[2, 13], [5, 15], [10, 15], [13, 13]]) g.r(x, y, 2, 1, P.stone); };
  S.fire0 = mk(16, 16, g => { fire(g); g.e(8, 8.5, 3, 4, '#e8602a'); g.e(8, 9.5, 2, 2.6, '#f2c440'); g.p(8, 4, '#e8602a'); g.p(7, 10, '#fff6c0'); });
  S.fire1 = mk(16, 16, g => { fire(g); g.e(7.6, 9, 3.2, 3.6, '#e8602a'); g.e(8, 9.6, 2, 2.4, '#f2c440'); g.p(7, 5, '#e8602a'); g.p(9, 4, '#e8602a'); g.p(8, 10, '#fff6c0'); });
  const bench = g => { g.r(2, 7, 12, 3, P.woodL); g.r(2, 7, 12, 1, '#d09a5a'); g.r(2, 10, 12, 1, P.woodD); g.r(3, 11, 2, 4, P.woodD); g.r(11, 11, 2, 4, P.woodD); g.r(5, 12, 6, 1, P.wood); g.r(8, 5, 5, 2, P.stoneL); g.p(12, 5, P.stoneD); g.r(4, 4, 1, 3, P.wood); g.r(3, 4, 3, 1, P.stoneD); };
  S.bench = mk(16, 16, bench);
  S.bench2 = mk(16, 16, g => { bench(g); g.r(2, 7, 12, 1, '#9aa4ad'); g.r(11, 4, 3, 3, '#6c7680'); g.p(12, 4, '#9aa4ad'); });
  S.bed = mk(16, 16, g => { g.r(1, 6, 14, 9, '#5f8f3a'); g.r(2, 7, 12, 7, '#7fb04a'); g.l(6, 9, 13, 9, '#6a9a40'); g.l(6, 11, 13, 11, '#6a9a40'); g.r(2, 7, 4, 3, '#e8d9b0'); g.p(2, 7, '#fff4d8'); });
  const fur = g => { g.r(10, 1, 3, 5, P.stoneD); g.r(10, 1, 3, 1, P.stone); g.e(8, 10, 6.6, 5.8, P.stoneD); g.e(7.6, 9.4, 5.6, 4.8, P.stone); g.p(5, 7, P.stoneL); g.p(9, 6, P.stoneL); g.r(6, 10, 4, 4, '#2a1a10'); };
  S.furnace = mk(16, 16, fur);
  S.furnaceOn = mk(16, 16, g => { fur(g); g.r(6, 11, 4, 3, '#ff8a2a'); g.r(7, 12, 2, 2, '#ffd060'); });
  S.box = mk(16, 16, g => { g.r(2, 5, 12, 10, '#e3a826'); g.r(2, 5, 12, 2, '#f6d660'); g.r(2, 14, 12, 1, '#a8781a'); g.r(1, 4, 14, 1, '#c58f1e');
    for (let i = 0; i < 12; i += 4) g.r(2 + i, 13, 2, 1, '#2a2010');
    const k = '#2a2010'; g.r(6, 7, 4, 1, k); g.p(6, 8, k); g.r(6, 9, 4, 1, k); g.p(9, 10, k); g.r(6, 11, 4, 1, k); g.r(8, 6, 1, 7, k); });
  const drone = g => { g.r(2, 3, 12, 1, '#6c7680'); g.r(7, 2, 2, 2, '#6c7680'); g.e(8, 7.5, 4.6, 3.6, '#d8d8e4'); g.e(8, 6.6, 3.8, 2.4, '#f4f4fa'); g.e(8, 7.6, 1.8, 1.8, P.gold); g.p(8, 7, '#fff8c0'); g.r(4, 10, 1, 2, '#6c7680'); g.r(11, 10, 1, 2, '#6c7680'); };
  S.drone0 = mk(16, 12, g => { drone(g); g.r(0, 1, 6, 1, '#b9bcc6'); g.r(10, 1, 6, 1, '#b9bcc6'); });
  S.drone1 = mk(16, 12, g => { drone(g); g.r(2, 1, 2, 1, '#b9bcc6'); g.r(12, 1, 2, 1, '#b9bcc6'); });
  S.hut = mk(32, 32, g => {
    g.r(4, 15, 24, 16, P.woodD); g.r(5, 16, 22, 14, P.wood);
    for (let y = 18; y < 30; y += 3) g.r(5, y, 22, 1, P.woodD);
    g.r(13, 20, 6, 11, '#21140c'); g.r(14, 21, 4, 10, '#2e1c10'); g.r(7, 19, 4, 4, '#21140c'); g.p(8, 20, '#4a3a2a');
    for (let y = 3; y < 16; y++) { const hw = Math.round((y - 3) * 1.15) + 2; g.r(16 - hw, y, hw * 2, 1, y % 2 ? '#b58a4a' : '#c9a46a'); }
    g.clear(19, 8, 3, 2); g.clear(20, 10, 2, 1); g.clear(9, 12, 2, 2); g.r(3, 15, 26, 1, '#8a6a3a');
  });
  S.wreck = mk(48, 32, g => {
    g.l(16, 15, 22, 1, P.woodD); g.l(17, 15, 23, 1, P.woodD);
    g.r(20, 4, 9, 6, '#d8d0b8'); g.clear(25, 7, 4, 3);
    for (let y = 14; y < 31; y++) { const x0 = Math.round(2 + (y - 14) * 0.25), x1 = Math.round(46 - (y - 14) * 0.9); g.r(x0, y, x1 - x0, 1, y % 3 === 0 ? '#4a2e1a' : '#6b4423'); }
    g.r(2, 14, 44, 2, '#8b5a2b'); g.r(2, 14, 44, 1, '#a87444'); g.e(31, 22, 4, 3, '#140c08'); g.e(12, 25, 2, 1.5, '#140c08');
    for (const [x, y] of [[8, 20], [38, 18], [20, 27]]) g.p(x, y, '#b5643a');
  });
  S.raftSpot = mk(16, 16, g => { g.r(3, 6, 2, 9, P.wood); g.r(11, 6, 2, 9, P.wood); g.r(3, 6, 2, 1, P.woodL); g.r(11, 6, 2, 1, P.woodL); g.l(5, 8, 10, 8, '#c9a46a'); g.l(5, 10, 10, 9, '#c9a46a'); });
  S.raft = mk(16, 28, g => {
    for (let i = 0; i < 5; i++) g.r(1 + i * 3, 15, 3, 12, i % 2 ? '#a06a35' : '#8b5a2b');
    g.r(1, 18, 15, 1, '#c9a46a'); g.r(1, 24, 15, 1, '#c9a46a');
    g.r(7, 1, 2, 16, P.woodD); for (let y = 2; y < 14; y++) g.r(9, y, Math.round((y - 1) * 0.5), 1, '#f3ead2');
  });
  S.rock = mk(8, 8, g => { g.e(4, 4, 3, 3, P.stoneD); g.e(3.6, 3.6, 2.4, 2.4, P.stone); g.p(3, 3, P.stoneL); });
  S.bob = mk(4, 4, g => { g.r(1, 0, 2, 2, '#e84a4a'); g.r(1, 2, 2, 1, '#f3f3f3'); }, false);
  // プレイヤー
  for (let f = 0; f < 3; f++) {
    PL[0][f] = mk(16, 16, g => drawPlayer(g, 'down', f));
    PL[1][f] = mk(16, 16, g => drawPlayer(g, 'up', f));
    PL[3][f] = mk(16, 16, g => drawPlayer(g, 'side', f));
    PL[2][f] = flipH(PL[3][f]);
  }
}

const ICONDRAW = {
  stone: g => { g.e(8, 9, 5.6, 4.6, P.stoneD); g.e(7.6, 8.4, 4.6, 3.6, P.stone); g.e(6, 7, 2, 1.2, P.stoneL); },
  branch: g => { g.l(3, 13, 13, 3, P.woodD); g.l(3, 12, 12, 3, P.wood); g.l(8, 8, 12, 10, P.wood); g.r(11, 9, 2, 2, P.leafL); },
  fiber: g => { g.l(4, 13, 8, 2, '#7aa84a'); g.l(6, 13, 10, 2, '#9ac46a'); g.l(8, 13, 12, 3, '#7aa84a'); g.l(10, 13, 13, 5, '#9ac46a'); g.r(5, 8, 7, 2, '#c9a46a'); },
  wood: g => { g.r(2, 6, 11, 6, P.wood); g.r(2, 6, 11, 1, P.woodL); g.r(2, 11, 11, 1, P.woodD); g.e(13, 9, 2.4, 3.2, '#d8a868'); g.p(13, 9, P.woodL); g.p(5, 8, P.woodD); g.p(9, 10, P.woodD); },
  driftwood: g => { g.r(2, 7, 12, 4, '#a8957a'); g.r(2, 7, 12, 1, '#c9b89c'); g.r(2, 10, 12, 1, '#7d6c56'); g.p(6, 8, '#7d6c56'); g.p(10, 9, '#7d6c56'); },
  plank: g => { g.r(2, 4, 12, 3, '#c99a5a'); g.r(2, 8, 12, 3, '#b5864a'); g.r(2, 12, 12, 2, '#c99a5a'); g.r(2, 7, 12, 1, '#7a5028'); g.r(2, 11, 12, 1, '#7a5028'); g.p(5, 5, '#9a6a38'); g.p(10, 9, '#9a6a38'); },
  rope: g => { g.e(8, 8, 5.6, 5.6, '#c9a46a'); g.e(8, 8, 3.6, 3.6, '#a8844a'); g.e(8, 8, 1.6, 1.6, '#c9a46a'); g.l(12, 12, 14, 14, '#c9a46a'); },
  coconut: g => { g.e(8, 9, 5.6, 5.2, '#6b4423'); g.e(7, 7.6, 3.4, 2.8, '#8a5a30'); g.p(7, 9, '#2a1a10'); g.p(9, 9, '#2a1a10'); g.p(8, 11, '#2a1a10'); },
  berry: g => { g.e(5.5, 9.5, 2.6, 2.6, '#c8304a'); g.e(10.5, 9.5, 2.6, 2.6, '#c8304a'); g.e(8, 12.5, 2.6, 2.6, '#c8304a'); g.p(5, 8, '#ff8aa0'); g.p(10, 8, '#ff8aa0'); g.p(7, 11, '#ff8aa0'); g.r(7, 4, 3, 2, P.leaf); g.p(8, 6, P.leafD); },
  fish: g => { g.e(7, 8, 5, 3, '#6aa8d0'); g.e(7, 9.4, 4, 1.4, '#cfe6f2'); g.l(11, 8, 14, 5, '#4a88b0'); g.l(11, 8, 14, 11, '#4a88b0'); g.r(13, 5, 1, 7, '#4a88b0'); g.p(4, 7, P.ol); g.p(7, 6, '#9fd0ee'); },
  bigfish: g => { g.e(7, 8, 5.5, 3.6, '#e0607a'); g.e(7, 9.6, 4.4, 1.6, '#f6c0c8'); g.l(12, 8, 15, 4, '#c04a60'); g.l(12, 8, 15, 12, '#c04a60'); g.r(14, 4, 1, 9, '#c04a60'); g.p(3, 7, P.ol); g.p(6, 5, '#ffa0b0'); },
  grilled: g => { g.l(1, 14, 15, 2, P.woodL); g.e(8, 8, 5, 3, '#b5703a'); g.e(8, 7, 4, 1.6, '#d08a4a'); g.l(6, 6, 6, 10, '#5a3a22'); g.l(9, 6, 9, 10, '#5a3a22'); g.p(4, 7, P.ol); },
  boot: g => { g.r(5, 2, 6, 9, '#5a4a3a'); g.r(5, 9, 9, 4, '#5a4a3a'); g.r(5, 13, 10, 1, '#2a2420'); g.r(6, 3, 4, 1, '#7a6a58'); },
  shell: g => { g.e(8, 9, 5, 4.4, '#f6d6cc'); g.l(8, 13, 4, 7, '#e0a090'); g.l(8, 13, 8, 5, '#e0a090'); g.l(8, 13, 12, 7, '#e0a090'); g.r(6, 13, 5, 1, '#e0a090'); },
  rareshell: g => { g.e(8, 9, 5, 4.6, '#f7b7d0'); g.e(7, 8, 2.6, 2.2, '#fde4ee'); g.l(5, 9, 9, 7, '#d06a9a'); g.l(9, 7, 10, 10, '#d06a9a'); g.l(12, 11, 14, 13, '#d06a9a'); g.p(6, 7, '#ffffff'); g.p(11, 6, '#9fe0ff'); },
  accessory: g => { for (let a = 0; a <= Math.PI + 0.01; a += 0.15) g.p(Math.round(8 + Math.cos(a) * 6), Math.round(3 + Math.sin(a) * 6), '#c9a46a'); g.e(8, 11.5, 2.6, 2.2, '#f7b7d0'); g.p(8, 11, '#ffffff'); g.p(4, 7, '#4aa3df'); g.p(12, 7, '#4aa3df'); },
  metal: g => { g.r(3, 5, 10, 7, '#9aa4ad'); g.r(3, 5, 10, 1, '#c8d0d8'); g.r(3, 11, 10, 1, '#6c7680'); g.p(5, 7, '#4a525a'); g.p(10, 7, '#4a525a'); g.p(7, 9, '#b5643a'); g.p(11, 10, '#b5643a'); g.r(12, 3, 2, 3, '#9aa4ad'); },
  ironore: g => { g.e(8, 9, 5.6, 4.6, '#6c6070'); g.e(7.6, 8.4, 4.6, 3.6, '#857a8a'); g.r(5, 7, 2, 2, '#d97a3a'); g.r(9, 9, 2, 2, '#d97a3a'); g.p(10, 6, '#f0a060'); },
  ingot: g => { g.r(3, 8, 10, 4, '#8d98a2'); g.r(4, 7, 8, 1, P.iron); g.r(3, 11, 10, 1, '#5d6670'); g.p(5, 9, '#d8e0e8'); },
  crystal: g => { g.r(4, 6, 2, 8, '#5cc8e0'); g.p(4, 5, '#5cc8e0'); g.r(7, 3, 3, 11, '#7fe3f0'); g.r(8, 3, 1, 10, '#c8fbff'); g.p(8, 2, '#7fe3f0'); g.r(11, 7, 2, 7, '#5cc8e0'); g.p(11, 6, '#5cc8e0'); },
  goldore: g => { g.e(8, 9, 5.6, 4.6, '#5d5466'); g.e(7.6, 8.4, 4.6, 3.6, '#776c80'); g.r(5, 7, 2, 2, P.gold); g.r(9, 9, 2, 2, P.gold); g.p(9, 6, P.goldL); g.p(6, 10, P.gold); },
  goldbar: g => { g.r(2, 8, 12, 4, P.goldD); g.r(3, 7, 10, 1, P.goldL); g.r(2, 8, 12, 3, P.gold); g.r(4, 8, 3, 1, P.goldL); },
  coin: g => { g.e(8, 8, 5.2, 5.2, '#c8961e'); g.e(8, 8, 4.2, 4.2, P.gold); g.r(7, 6, 2, 4, P.goldD); g.p(6, 5, P.goldL); },
  canned: g => { g.r(4, 3, 8, 11, '#b9bcc6'); g.r(4, 3, 8, 1, '#e8e8f0'); g.r(4, 7, 8, 4, '#d94b4b'); g.r(5, 8, 3, 2, '#f3ead2'); g.r(4, 13, 8, 1, '#8a8d99'); },
  medkit: g => { g.r(2, 5, 12, 8, '#f3f3f3'); g.r(2, 12, 12, 1, '#c8c8c8'); g.r(7, 6, 2, 6, '#d94b4b'); g.r(5, 8, 6, 2, '#d94b4b'); g.r(6, 3, 4, 2, '#9aa4ad'); },
  cloth: g => { g.r(3, 4, 10, 9, '#f3ead2'); g.r(3, 8, 10, 1, '#d8ccb0'); g.r(3, 12, 10, 1, '#c8bca0'); g.r(3, 4, 10, 1, '#fffaf0'); },
  turtle: g => { g.e(8, 9, 5.2, 3.6, P.goldD); g.e(8, 8.4, 4.6, 3, P.gold); for (const [x, y] of [[6, 7], [8, 6], [10, 7], [8, 9]]) g.p(x, y, P.goldD); g.e(13.6, 9, 1.6, 1.3, P.gold); g.p(14, 8, '#3a2a10'); g.p(4, 12, P.goldD); g.p(11, 12, P.goldD); g.p(6, 6, P.goldL); },
  ledger: g => { g.r(3, 2, 10, 12, '#4a2a2a'); g.r(4, 3, 8, 10, '#6b3a3a'); g.r(12, 3, 1, 11, '#e8dcc0'); g.r(5, 5, 6, 2, P.gold); g.r(5, 9, 5, 1, '#8a5a5a'); },
  stoneAxe: g => { g.l(4, 14, 10, 5, P.woodD); g.l(5, 14, 11, 5, P.wood); g.e(11, 4.6, 3.2, 3, P.stone); g.e(10, 4, 1.6, 1.4, P.stoneL); },
  ironAxe: g => { g.l(4, 14, 10, 5, P.woodD); g.l(5, 14, 11, 5, P.wood); g.e(11, 4.6, 3.2, 3, P.iron); g.e(10, 4, 1.6, 1.4, P.ironL); g.p(13, 5, P.ironD); },
  stonePick: g => { g.l(4, 14, 10, 4, P.woodD); g.l(5, 14, 11, 4, P.wood); g.l(3, 6, 8, 3, P.stone); g.l(8, 3, 14, 5, P.stone); g.l(3, 5, 8, 2, P.stoneL); g.l(8, 2, 14, 4, P.stoneL); },
  ironPick: g => { g.l(4, 14, 10, 4, P.woodD); g.l(5, 14, 11, 4, P.wood); g.l(3, 6, 8, 3, P.iron); g.l(8, 3, 14, 5, P.iron); g.l(3, 5, 8, 2, P.ironL); g.l(8, 2, 14, 4, P.ironL); },
  rod: g => { g.l(2, 14, 12, 2, P.woodD); g.l(3, 14, 13, 2, P.wood); g.l(13, 2, 13, 11, '#e8e8f0'); g.r(12, 11, 3, 2, '#e84a4a'); },
  torch: g => { g.r(7, 7, 2, 8, P.wood); g.r(7, 7, 2, 1, P.woodD); g.e(8, 5, 2.6, 3.6, '#e8602a'); g.e(8, 6, 1.6, 2, P.gold); },
  bag: g => { g.e(8, 10, 5.6, 4.6, '#c9a46a'); g.r(4, 6, 8, 3, '#a8844a'); g.l(5, 6, 8, 2, '#8a6a3a'); g.l(8, 2, 11, 6, '#8a6a3a'); g.p(8, 8, P.gold); },
  cart: g => { g.r(2, 5, 11, 6, P.wood); g.r(2, 5, 11, 1, P.woodL); g.e(5, 12, 2.2, 2.2, P.woodD); g.e(11, 12, 2.2, 2.2, P.woodD); g.l(13, 6, 15, 3, P.woodD); },
  benchUp: g => { g.drawBench = 1; },
  bowl: g => { g.e(8, 10, 6, 3.6, '#8b5a2b'); g.e(8, 8.6, 5.4, 1.6, '#4a2e1f'); g.r(4, 13, 8, 1, '#6b4423'); g.p(4, 10, '#b07a45'); },
  rawwater: g => { g.e(8, 10, 6, 3.6, '#8b5a2b'); g.e(8, 8.6, 5.4, 1.6, '#6a8a6a'); g.p(6, 8, '#a8c098'); g.p(10, 9, '#4a6a4a'); g.r(4, 13, 8, 1, '#6b4423'); },
  cleanwater: g => { g.e(8, 10, 6, 3.6, '#8b5a2b'); g.e(8, 8.6, 5.4, 1.6, '#4ab0e8'); g.p(6, 8, '#e0f8ff'); g.p(10, 9, '#9fe0ff'); g.r(4, 13, 8, 1, '#6b4423'); },
  sardine: g => { g.e(7, 8, 5, 1.8, '#9fb4c8'); g.e(7, 9, 4, 0.8, '#e0eaf2'); g.r(4, 7, 6, 1, '#5a7090'); g.l(11, 8, 13, 6, '#6a8098'); g.l(11, 8, 13, 10, '#6a8098'); g.p(3, 7, P.ol); },
  katsuo: g => { g.e(7, 8, 6, 3.4, '#2a4a8a'); g.e(7, 9.8, 5, 1.4, '#c8d8e8'); for (const x of [5, 7, 9]) g.r(x, 9, 1, 2, '#4a6a9a'); g.l(12, 8, 15, 4, '#1a3a6a'); g.l(12, 8, 15, 12, '#1a3a6a'); g.r(14, 4, 1, 9, '#1a3a6a'); g.p(3, 7, '#ffffff'); },
  octopus: g => { g.e(8, 6, 4.6, 3.8, '#d0503a'); g.e(7, 4.6, 1.6, 1.2, '#f08a70'); for (let i = 0; i < 4; i++) g.l(4 + i * 2.6, 9, 3 + i * 3, 14, '#b0402a'); g.p(6, 7, '#ffffff'); g.p(10, 7, '#ffffff'); },
  fugu: g => { g.e(8, 8, 5, 4.6, '#d8c070'); g.e(8, 10, 4, 2, '#f6eecc'); for (const [x, y] of [[3, 4], [8, 2], [13, 4], [2, 9], [14, 9], [5, 13], [11, 13]]) g.p(x, y, '#8a7030'); g.p(5, 7, P.ol); g.l(13, 8, 15, 6, '#b8a050'); g.l(13, 8, 15, 10, '#b8a050'); },
  meat: g => { g.e(8, 9, 5.2, 4, '#c8505a'); g.e(7, 8, 3, 2, '#e8808a'); g.r(11, 4, 2, 5, '#f0e8d8'); g.e(12, 3.6, 1.6, 1.4, '#f0e8d8'); },
  steak: g => { g.e(8, 9, 5.4, 4, '#7a4022'); g.e(7, 8, 3.2, 2, '#a8602e'); g.l(5, 8, 10, 10, '#4a2810'); g.r(11, 4, 2, 5, '#f0e8d8'); g.e(12, 3.6, 1.6, 1.4, '#f0e8d8'); },
  hide: g => { g.r(3, 4, 10, 9, '#a07850'); g.r(2, 6, 12, 5, '#a07850'); g.r(4, 5, 8, 1, '#c09a70'); g.p(6, 8, '#7a5838'); g.p(10, 10, '#7a5838'); g.p(8, 7, '#7a5838'); },
  claw: g => { g.e(6, 9, 4, 3.4, '#c83a2a'); g.e(11, 5, 3, 2, '#c83a2a'); g.e(11, 9, 2.6, 1.6, '#c83a2a'); g.p(5, 8, '#f08070'); g.r(2, 11, 3, 2, '#a02a1a'); },
  stoneSword: g => { g.l(3, 13, 12, 4, P.stone); g.l(4, 13, 13, 4, P.stoneL); g.l(3, 10, 6, 13, P.woodD); g.r(2, 13, 2, 2, P.wood); },
  ironSword: g => { g.l(3, 13, 13, 3, P.iron); g.l(4, 13, 14, 3, P.ironL); g.l(3, 10, 6, 13, P.gold); g.r(2, 13, 2, 2, P.woodD); },
  bp: g => { g.r(2, 3, 12, 10, '#3a6fb0'); g.r(2, 3, 12, 1, '#5a8fd0'); for (let i = 4; i < 13; i += 3) g.r(3, i, 10, 1, '#7fa8d8'); g.r(7, 4, 1, 8, '#7fa8d8'); g.r(13, 3, 1, 10, '#e8e8f0'); },
};

function buildIcons() {
  for (const k in ICONDRAW) if (k !== 'benchUp') ICON[k] = mk(16, 16, ICONDRAW[k]);
  ICON.campfire = SPR.fire0; ICON.workbench = SPR.bench; ICON.bed = SPR.bed; ICON.furnace = SPR.furnaceOn; ICON.benchUp = SPR.bench2;
  ICON.raft = mk(16, 16, g => { for (let i = 0; i < 5; i++) g.r(1 + i * 3, 9, 3, 6, i % 2 ? '#a06a35' : '#8b5a2b'); g.r(7, 1, 2, 9, P.woodD); for (let y = 2; y < 9; y++) g.r(9, y, Math.round(y * 0.6), 1, '#f3ead2'); });
  for (const k in ICON) ICON_URL[k] = ICON[k].toDataURL();
}

function buildPortraits() {
  const skin = '#f2c9a0';
  POR.me = mk(24, 24, g => { g.e(12, 10, 8, 8, '#4a2e1f'); g.e(12, 13, 6.5, 6.5, skin); g.r(5, 5, 14, 4, '#4a2e1f'); g.r(5, 8, 3, 4, '#4a2e1f'); g.r(16, 8, 3, 4, '#4a2e1f');
    g.r(9, 12, 1, 2, P.ol); g.r(14, 12, 1, 2, P.ol); g.p(8, 15, '#f0a090'); g.p(16, 15, '#f0a090'); g.r(11, 17, 3, 1, '#b0604a'); g.r(4, 21, 16, 3, '#ece6d6'); g.r(10, 20, 4, 1, skin); });
  POR.same = mk(24, 24, g => { g.r(3, 20, 18, 4, '#2a2a38'); g.r(10, 20, 4, 4, '#d94b4b'); g.r(8, 21, 8, 1, P.gold); g.e(12, 9, 8, 6, '#3a3a46'); g.e(12, 13, 6.5, 7, '#e0b088'); g.r(5, 5, 14, 3, '#3a3a46'); g.l(6, 6, 17, 4, '#5a5a68');
    g.r(6, 11, 5, 3, '#111'); g.r(13, 11, 5, 3, '#111'); g.r(11, 12, 2, 1, '#111'); g.p(7, 11, '#fff'); g.p(14, 11, '#fff'); g.r(9, 17, 7, 2, '#fff'); g.p(11, 18, '#999'); g.p(13, 18, '#999'); g.l(16, 14, 18, 16, '#b07858'); });
  POR.zeni = mk(24, 24, g => { g.r(1, 4, 9, 1, '#b9bcc6'); g.r(14, 4, 9, 1, '#b9bcc6'); g.r(4, 6, 16, 1, '#6c7680'); g.e(12, 14, 9, 7, '#d8d8e4'); g.e(12, 12.5, 7, 5, '#f4f4fa');
    g.e(12, 14, 3.6, 3.6, P.gold); g.e(12, 14, 1.6, 1.6, '#8a6a1a'); g.p(11, 12, '#fff8c0'); g.r(6, 21, 2, 2, '#6c7680'); g.r(16, 21, 2, 2, '#6c7680'); });
  POR.gen = mk(24, 24, g => { g.r(2, 2, 20, 20, '#efe4c4'); g.r(2, 2, 20, 1, '#fffaf0'); for (let y = 6; y < 20; y += 3) g.r(4, y, 16, 1, '#b8a888'); g.r(2, 2, 2, 20, '#c9a46a'); g.e(16, 15, 3, 3, '#d8c8a0'); g.p(16, 15, '#a89870'); });
}

/* ---------- 7. マップ生成 ---------- */
function genIsland() {
  const W = 72, H = 56, seed = CONFIG.islandSeed, rng = mulberry32(seed);
  const t = new Uint8Array(W * H), D = new Float32Array(W * H), noObj = new Uint8Array(W * H);
  const cx = W / 2, cy = H / 2 + 1;
  const I = (x, y) => y * W + x, inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const land = (x, y) => inb(x, y) && isLandT(t[I(x, y)]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - cx) / (W * 0.36), dy = (y + 0.5 - cy) / (H * 0.36), a = Math.atan2(dy, dx);
    const rad = 1 + 0.10 * Math.sin(3 * a + 0.7) + 0.07 * Math.sin(5 * a + 2.1) + 0.04 * Math.sin(8 * a + 4.0);
    const d = Math.hypot(dx, dy) / rad + (vnoise(x / 5, y / 5, seed) - 0.5) * 0.12;
    D[I(x, y)] = d;
    t[I(x, y)] = d > 1.10 ? T.DEEP : d > 0.99 ? T.SHALLOW : d > 0.86 ? T.SAND : T.GRASS;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t[I(x, y)] === T.GRASS && vnoise(x / 6 + 20, y / 6 + 20, seed + 1) > 0.56) t[I(x, y)] = T.FOREST;
  // 岩山（北東のしっかりした内陸）
  let hill = null, bs = -1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D[I(x, y)] < 0.5 && x > cx && y < cy) { const s = (x - cx) + (cy - y) * 1.3; if (s > bs) { bs = s; hill = { x, y }; } }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = t[I(x, y)]; if (v !== T.GRASS && v !== T.FOREST) continue;
    if (Math.hypot(x - hill.x, y - hill.y) < 6.5 + (vnoise(x / 3, y / 3, seed + 2) - 0.5) * 3) t[I(x, y)] = T.ROCK;
  }
  const cave = { x: hill.x, y: hill.y };
  for (let y = cave.y - 3; y <= cave.y + 2; y++) for (let x = cave.x - 3; x <= cave.x + 3; x++) if (land(x, y)) t[I(x, y)] = T.ROCK;
  // 泉
  let spring = null, bd = 1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D[I(x, y)] < 0.42) { const d = Math.hypot(x - (cx - 3), y - (cy - 3)); if (d < bd) { bd = d; spring = { x, y }; } }
  for (let y = spring.y - 2; y <= spring.y + 3; y++) for (let x = spring.x - 2; x <= spring.x + 3; x++) if (land(x, y)) t[I(x, y)] = T.GRASS;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) t[I(spring.x + x, spring.y + y)] = T.SPRING;
  // 西の小屋
  let hut = null; let bx = 1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D[I(x, y)] < 0.55 && Math.abs(y - (cy - 2)) <= 5 && x < bx) { bx = x; hut = { x, y }; }
  for (let y = hut.y - 2; y <= hut.y + 2; y++) for (let x = hut.x - 1; x <= hut.x + 2; x++) if (land(x, y)) t[I(x, y)] = T.GRASS;
  // 南の浜辺（スタート地点）
  const sx = Math.floor(cx); let sy = Math.floor(cy); while (land(sx, sy + 1)) sy++;
  const spawn = { x: sx, y: sy - 1 };
  let box = { x: sx + 2, y: sy - 2 }; if (!land(box.x, box.y)) box = { x: sx - 2, y: sy - 2 };
  // 桟橋
  const px = sx - 6; let py = Math.floor(cy); while (land(px, py + 1)) py++;
  for (let y = py + 1; y <= py + 5; y++) if (inb(px, y)) t[I(px, y)] = T.PIER;
  const raft = { x: px, y: py + 5 };
  // 難破船
  const wx = sx + 9; let wy = Math.floor(cy); while (land(wx, wy + 1)) wy++;
  for (let y = wy - 1; y <= wy; y++) for (let x = wx; x <= wx + 2; x++) if (inb(x, y)) t[I(x, y)] = T.SAND;
  // 道
  const mark = (x, y, r) => { for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (inb(xx, yy)) noObj[I(xx, yy)] = 1; };
  const carve = (a, b, keepSand) => {
    let x0 = a.x, y0 = a.y; const x1 = b.x, y1 = b.y, dx = Math.abs(x1 - x0), sxx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), syy = y0 < y1 ? 1 : -1; let er = dx + dy;
    for (let i = 0; i < 500; i++) {
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) { const x = x0 + ox, y = y0 + oy; if (!land(x, y)) continue; if (!(keepSand && t[I(x, y)] === T.SAND)) t[I(x, y)] = T.PATH; }
      mark(x0, y0, 1);
      if (x0 === x1 && y0 === y1) break; const e2 = 2 * er; if (e2 >= dy) { er += dy; x0 += sxx; } if (e2 <= dx) { er += dx; y0 += syy; }
    }
  };
  carve(spawn, { x: spring.x, y: spring.y + 3 });
  carve({ x: spring.x - 1, y: spring.y }, { x: hut.x, y: hut.y + 2 });
  carve({ x: spring.x + 2, y: spring.y - 1 }, { x: cave.x, y: cave.y + 1 });
  carve(spawn, { x: px, y: py }, true);
  carve(spawn, { x: wx + 1, y: wy - 2 }, true);
  mark(spawn.x, spawn.y, 3); mark(box.x, box.y, 2); mark(hut.x, hut.y, 2); mark(hut.x + 1, hut.y, 2); mark(cave.x, cave.y, 2); mark(spring.x, spring.y, 2); mark(spring.x + 1, spring.y + 1, 2);
  mark(px, py, 1); mark(wx + 1, wy, 2);
  // 物の配置
  const objs = [];
  const add = (type, x, y, extra) => { const o = Object.assign({ t: type, x, y }, extra || {}); objs.push(o); return o; };
  const nearWater = (x, y) => DIRV.some(([dx, dy]) => inb(x + dx, y + dy) && isWater(t[I(x + dx, y + dy)]));
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (noObj[I(x, y)]) continue; const v = t[I(x, y)], r = rng();
    if (v === T.FOREST) { if (r < 0.30) add('tree', x, y); else if (r < 0.35) add('bush', x, y, { n: 1 }); else if (r < 0.41) add('grass', x, y); else if (r < 0.46) add('twig', x, y); }
    else if (v === T.GRASS) { if (r < 0.05) add('tree', x, y); else if (r < 0.07) add('bush', x, y, { n: 1 }); else if (r < 0.15) add('grass', x, y); else if (r < 0.165) add('pebble', x, y); else if (r < 0.18) add('twig', x, y); }
    else if (v === T.SAND) { const nw = nearWater(x, y); if (!nw && r < 0.04) add('palm', x, y, { n: 1 + Math.floor(rng() * 3) }); else if (r < 0.06) add('shell', x, y); else if (r < 0.075) add('pebble', x, y); else if (nw && r < 0.12) add('driftwood', x, y); }
    else if (v === T.ROCK) { if (r < 0.12) add('boulder', x, y); else if (r < 0.145) add('ironVein', x, y); else if (r < 0.19) add('pebble', x, y); else if (r < 0.21) add('grass', x, y); }
  }
  // スタート地点のヤシ（最低3本）
  const occAt = (x, y) => objs.some(o => o.x === x && o.y === y);
  let palms = objs.filter(o => o.t === 'palm' && Math.hypot(o.x - spawn.x, o.y - spawn.y) < 9).length;
  for (const [ox, oy] of [[-4, -2], [4, -3], [-6, -1], [6, -1], [-3, -4], [3, -5]]) {
    if (palms >= 3) break; const x = spawn.x + ox, y = spawn.y + oy;
    if (inb(x, y) && t[I(x, y)] === T.SAND && !occAt(x, y) && !nearWater(x, y)) { add('palm', x, y, { n: 2 }); palms++; }
  }
  // ランドマーク
  add('box', box.x, box.y); add('hut', hut.x, hut.y); add('diary', hut.x, hut.y + 1, { page: 1 }); add('cave', cave.x, cave.y); add('raft', raft.x, raft.y); add('wreck', wx, wy);
  const lm = { spawn, box, hut, cave, spring, raft, wreck: { x: wx, y: wy }, pier: { x: px, y: py } };
  return { W, H, tiles: t, objs, lm };
}

function genCave() {
  const W = 40, H = 30, t = new Uint8Array(W * H).fill(T.CWALL);
  const set = (x, y) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) t[y * W + x] = T.CFLOOR; };
  const circ = (cx, cy, r) => { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y); };
  const line = (x0, y0, x1, y1, r) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2); for (let i = 0; i <= n; i++) circ(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, r); };
  circ(20, 24, 4); line(20, 24, 20, 27, 1);
  circ(9, 20, 4); line(20, 23, 9, 20, 1.2);
  circ(31, 19, 4); line(20, 23, 31, 19, 1.2);
  circ(20, 14, 4); line(9, 20, 20, 14, 1.2); line(31, 19, 20, 14, 1.2);
  circ(8, 10, 3); line(20, 14, 8, 10, 1.2);
  circ(20, 4, 3.2); circ(13, 4, 2.4); circ(27, 4, 2.4); line(13, 4, 27, 4, 1);
  line(20, 6, 20, 11, 1);
  const objs = []; const add = (type, x, y, extra) => objs.push(Object.assign({ t: type, x, y }, extra || {}));
  for (let y = 8; y <= 9; y++) for (let x = 14; x <= 26; x++) if (t[y * W + x] === T.CFLOOR) add('hardRock', x, y);
  add('exit', 20, 27); add('diary', 17, 24, { page: 2 });
  for (const [x, y] of [[7, 22], [6, 18], [11, 22], [33, 17], [34, 20], [30, 22]]) add('ironVein', x, y);
  for (const [x, y] of [[7, 9], [9, 12], [23, 16], [17, 12], [33, 21]]) add('crystal', x, y);
  for (const [x, y] of [[23, 26], [12, 19], [29, 17]]) add('boulder', x, y);
  for (const [x, y] of [[12, 4], [28, 4], [17, 5], [23, 5]]) add('goldVein', x, y);
  add('shrine', 20, 2); add('diary', 22, 3, { page: 3 });
  return { W, H, tiles: t, objs, lm: { exit: { x: 20, y: 27 } } };
}

/* ---------- 8. 地形の描画（一度だけ） ---------- */
const TC = {
  [T.DEEP]: ['#2b5f9e', '#25558f', '#3a6fae'], [T.SHALLOW]: ['#4aa0d6', '#3f93c9', '#66b6e2'],
  [T.SAND]: ['#ecd9a0', '#dcc589', '#f6e8c0'], [T.GRASS]: ['#63b350', '#559f44', '#78c460'],
  [T.FOREST]: ['#418c3d', '#377a34', '#4f9c48'], [T.ROCK]: ['#a59c8c', '#918877', '#bbb2a2'],
  [T.SPRING]: ['#66c8ec', '#52b6de', '#9ae0f6'], [T.PIER]: ['#a87440', '#7a5028', '#c08a50'],
  [T.PATH]: ['#c8a36a', '#b58f58', '#d6b47e'], [T.CFLOOR]: ['#4b4352', '#40384a', '#575062'],
  [T.CWALL]: ['#2a2430', '#221d28', '#3a3242'],
};
function renderTerrain(map) {
  const { W, H, tiles } = map, c = mkCanvas(W * 16, H * 16), x = c.getContext('2d'), img = x.createImageData(c.width, c.height), d = img.data;
  const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H) ? (map.name === 'cave' ? T.CWALL : T.DEEP) : tiles[ty * W + tx];
  const put = (px, py, col) => { const k = (py * c.width + px) * 4, rgb = hexRgb(col); d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255; };
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const v = at(tx, ty), pal = TC[v];
    const nN = at(tx, ty - 1), nS = at(tx, ty + 1), nW = at(tx - 1, ty), nE = at(tx + 1, ty);
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const gx = tx * 16 + px, gy = ty * 16 + py, h = hash2(gx, gy, 7);
      let col = h < 0.08 ? pal[1] : h > 0.94 ? pal[2] : pal[0];
      const edge = (n, dist) => (n && dist);
      if (isWater(v)) {
        const near = (isLandT(nN) || nN === T.PIER) && py < 3 || (isLandT(nS) && py > 12) || (isLandT(nW) && px < 3) || (isLandT(nE) && px > 12);
        const near2 = (isLandT(nN) && py < 1) || (isLandT(nS) && py > 14) || (isLandT(nW) && px < 1) || (isLandT(nE) && px > 14);
        if (near2 && h < 0.9) col = '#e4f6fb'; else if (near && h < 0.45) col = '#bfe4f2';
        if (v === T.DEEP && (nN === T.SHALLOW || nS === T.SHALLOW || nW === T.SHALLOW || nE === T.SHALLOW) && h < 0.3) col = '#3a7cbc';
      } else if (v === T.SAND) {
        if ((isWater(nN) && py < 2) || (isWater(nS) && py > 13) || (isWater(nW) && px < 2) || (isWater(nE) && px > 13)) col = h < 0.5 ? '#d6be82' : '#cdb478';
      } else if (v === T.GRASS || v === T.FOREST) {
        if (edge(nN === T.SAND || nN === T.PATH, py < 1) || edge(nS === T.SAND || nS === T.PATH, py > 14) || edge(nW === T.SAND || nW === T.PATH, px < 1) || edge(nE === T.SAND || nE === T.PATH, px > 14)) col = '#4c973f';
        else if (h > 0.996) col = hash2(gx, gy, 9) < 0.5 ? '#f6f0a0' : '#f4b0c8';
        else if (v === T.GRASS && (px + py * 3) % 7 === 0 && h > 0.7) col = '#6fbe58';
      } else if (v === T.ROCK) {
        if (edge(nN !== T.ROCK && nN !== T.PATH, py < 1) || edge(nS !== T.ROCK && nS !== T.PATH, py > 14) || edge(nW !== T.ROCK && nW !== T.PATH, px < 1) || edge(nE !== T.ROCK && nE !== T.PATH, px > 14)) col = '#8a8170';
        else if ((px * 7 + py * 13 + tx * 5 + ty * 3) % 23 === 0) col = '#7d7464';
      } else if (v === T.PIER) {
        col = py % 4 === 3 ? '#7a5028' : (h < 0.15 ? '#9a6a38' : '#a87440');
        if (px === 0 || px === 15) col = '#5a3a22';
        if ((px === 2 || px === 13) && py % 4 === 1) col = '#3a2a1a';
      } else if (v === T.SPRING) {
        if ((nN !== T.SPRING && py < 1) || (nS !== T.SPRING && py > 14) || (nW !== T.SPRING && px < 1) || (nE !== T.SPRING && px > 14)) col = '#8a8d99';
      } else if (v === T.CWALL) {
        if (nS === T.CFLOOR) { if (py >= 10) col = py === 10 ? '#4a4054' : py === 15 ? '#1a1520' : (h < 0.15 ? '#332b3c' : '#3d3446'); }
        else if (h < 0.1) col = '#1e1a24';
      } else if (v === T.CFLOOR) {
        if (nN === T.CWALL && py < 2) col = '#2e2834';
        else if (h > 0.985) col = '#6a6274';
      }
      put(gx, gy, col);
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

/* ---------- 9. マップ管理 ---------- */
const maps = {};
function buildMap(name, data, objs) {
  const m = { name, W: data.W, H: data.H, tiles: data.tiles, lm: data.lm, objs, occ: new Array(data.W * data.H).fill(null) };
  m.terrain = typeof document !== 'undefined' ? renderTerrain(m) : null;
  rebuildOcc(m);
  if (name === 'island') buildSpawnLists(m);
  return m;
}
function fpOf(o) { return OBJ[o.t] && OBJ[o.t].fp || [[0, 0]]; }
function rebuildOcc(m) { m.occ.fill(null); for (const o of m.objs) occAdd(m, o); }
function occAdd(m, o) { for (const [dx, dy] of fpOf(o)) { const x = o.x + dx, y = o.y + dy; if (x >= 0 && y >= 0 && x < m.W && y < m.H) m.occ[y * m.W + x] = o; } }
function occDel(m, o) { for (const [dx, dy] of fpOf(o)) { const x = o.x + dx, y = o.y + dy; if (x >= 0 && y >= 0 && x < m.W && y < m.H && m.occ[y * m.W + x] === o) m.occ[y * m.W + x] = null; } }
function addObj(m, o) { m.objs.push(o); occAdd(m, o); return o; }
function removeObj(m, o) { const i = m.objs.indexOf(o); if (i >= 0) m.objs.splice(i, 1); occDel(m, o); }
function tileAt(m, x, y) { if (x < 0 || y < 0 || x >= m.W || y >= m.H) return m.name === 'cave' ? T.CWALL : T.DEEP; return m.tiles[y * m.W + x]; }
function objAt(m, x, y) { if (x < 0 || y < 0 || x >= m.W || y >= m.H) return null; return m.occ[y * m.W + x]; }
function isBlocked(m, x, y) { const v = tileAt(m, x, y); if (!WALK[v]) return true; const o = objAt(m, x, y); return !!(o && OBJ[o.t] && OBJ[o.t].block); }
function buildSpawnLists(m) {
  const L = { sand: [], shore: [], land: [], wreck: [] }, lm = m.lm;
  for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 1; x++) {
    const v = m.tiles[y * m.W + x]; if (!isLandT(v) || v === T.PATH) continue;
    const near = (a, r) => Math.abs(x - a.x) <= r && Math.abs(y - a.y) <= r;
    if (near(lm.spawn, 3) || near(lm.box, 2) || near(lm.cave, 2) || near(lm.hut, 2) || near(lm.spring, 2)) continue;
    L.land.push([x, y]);
    if (v === T.SAND) {
      L.sand.push([x, y]);
      if (DIRV.some(([dx, dy]) => isWater(tileAt(m, x + dx, y + dy)))) L.shore.push([x, y]);
      if (Math.hypot(x - lm.wreck.x - 1, y - lm.wreck.y) < 7) L.wreck.push([x, y]);
    }
  }
  m.spawn = L;
}

/* ---------- 10. 設定（セーブとは別保存） ---------- */
const settings = { swapAB: false, swapXY: false, se: true, vol: 6, touchSize: 1, shake: true, endings: [] };
function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(CONFIG.settingsKey) || '{}'); Object.assign(settings, s); if (!Array.isArray(settings.endings)) settings.endings = []; } catch (e) { /* 破損時は既定値 */ }
}
function saveSettings() { try { localStorage.setItem(CONFIG.settingsKey, JSON.stringify(settings)); } catch (e) { /* 容量不足など */ } }
function applySettings() {
  document.documentElement.style.setProperty('--tb', String(settings.touchSize));
  Sound.setVol();
}

/* ---------- 11. ゲーム状態 ---------- */
let game = null;
const player = { x: 0, y: 0, dir: 0, anim: 0, moving: false, lunge: 0 };
const state = {
  scene: 'boot', target: null, gather: { o: null, prog: 0, hits: 0 }, holdCd: 0, fishing: null,
  rocks: [], rockTimer: 20, particles: [], floats: [], shake: 0, autosave: 0, fading: false, faintLock: false,
  warn: {}, pendingTalks: [], time: 0, titleT: 0, capToast: 0, drinkCd: 0,
  place: null, cam: { x: 0, y: 0 }, konami: 0, konamiGo: false, god: false, hotName: 0,
  stIdle: 0, boltT: 15, flash: 0, conds: [], condHtml: null,
  mobs: [], mobT: 2, atkCd: 0, invuln: 0, swing: 0, noMobs: false,
};
let curSlot = 1;

function newGameData(opt) {
  const isl = genIsland(), cav = genCave();
  const g = {
    v: CONFIG.saveVersion, name: opt.name, contract: { debt: opt.debt, days: opt.days, rate: opt.rate },
    day: 1, time: 8, money: 0, debt: opt.debt, repaid: 0, interestPaid: 0,
    hp: 100, hunger: 85, thirst: 75,
    inv: { coconut: 2, bowl: 1 }, tools: {}, up: {}, bp: {}, market: { m: {}, ev: null },
    map: 'island', px: isl.lm.spawn.x * 16 + 8, py: isl.lm.spawn.y * 16 + 12, dir: 0,
    objs: { island: isl.objs, cave: cav.objs },
    flags: {}, stats: { earned: 0, sold: 0, gathered: 0, crafted: 0, fish: 0, spent: 0 },
    raftBuilt: false, diaries: [], turtleSold: false,
    mode: opt.mode === 'hard' ? 'hard' : 'normal', hot: newHot(['coconut', 'bowl']), hotSel: 0, savedAt: 0,
    stamina: 100, exhaust: false, sick: 0, weather: 'sun', rainAcc: 0, stageI: 0, penalty: 0, storage: {},
    casino: { open: false, net: 0, plays: 0 },
  };
  return g;
}
function newHot(ids) { const a = new Array(CONFIG.hotSize).fill(null); (ids || []).slice(0, CONFIG.hotSize).forEach((k, i) => { a[i] = k; }); return a; }
function setupMaps() {
  const isl = genIsland(), cav = genCave();
  maps.island = buildMap('island', isl, game.objs.island);
  maps.cave = buildMap('cave', cav, game.objs.cave);
  ensureLiner();
  rebuildStations();
}
// 沈没船カジノを浜辺に置く（島の形から毎回同じ場所に決まる。古いセーブにも追加される）
function ensureLiner() {
  const mp = maps.island; if (mp.objs.some(o => o.t === 'liner')) return;
  const rng = mulberry32(CONFIG.islandSeed + 77), c = mp.spawn.sand.slice();
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  const sp = mp.lm.spawn, wr = mp.lm.wreck;
  for (const [x, y] of c) {
    if (Math.hypot(x - sp.x, y - sp.y) < 14 || Math.hypot(x - wr.x, y - wr.y) < 10) continue;
    let ok = true;
    for (const [dx, dy] of OBJ.liner.fp) { const tx = x + dx, ty = y + dy; if (tileAt(mp, tx, ty) !== T.SAND || objAt(mp, tx, ty)) { ok = false; break; } }
    if (ok && (isBlocked(mp, x + 1, y + 1) || isBlocked(mp, x - 1, y) && isBlocked(mp, x + 3, y))) ok = false;
    if (ok) { addObj(mp, { t: 'liner', x, y }); return; }
  }
}
let stations = [];
function rebuildStations() { stations = []; for (const k in maps) for (const o of maps[k].objs) if (OBJ[o.t] && OBJ[o.t].it === 'station') stations.push(o); }
const curMap = () => maps[game.map];

/* ---------- 12. セーブ／ロード ---------- */
const slotKey = n => CONFIG.slotKey + n;
function readSlot(n) { try { const t = localStorage.getItem(slotKey(n)); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
const slotValid = g => !!(g && g.v >= 1 && g.v <= CONFIG.saveVersion && g.objs && g.objs.island);
function slotInfo(n) {
  const g = readSlot(n); if (!slotValid(g)) return null;
  return { name: g.name || '？', day: g.day || 1, days: g.contract ? g.contract.days : 0, debt: Math.max(0, g.debt || 0), mode: g.mode === 'hard' ? 'hard' : 'normal', savedAt: g.savedAt || 0 };
}
function hasSave(n) { if (n) return !!slotInfo(n); for (let i = 1; i <= CONFIG.slots; i++) if (slotInfo(i)) return true; return false; }
// v1の単一セーブをスロット1へ移す（スロット1が空の時だけ）
function migrateLegacySave() {
  try {
    const old = localStorage.getItem(CONFIG.saveKey); if (!old) return;
    if (!localStorage.getItem(slotKey(1))) { localStorage.setItem(slotKey(1), old); localStorage.removeItem(CONFIG.saveKey); }
  } catch (e) { /* noop */ }
}
function saveGame(silent) {
  if (!game || state.scene !== 'play') return false;
  game.px = player.x; game.py = player.y; game.dir = player.dir; game.savedAt = Date.now();
  try {
    localStorage.setItem(slotKey(curSlot), JSON.stringify(game, (k, v) => (k && k[0] === '_') ? undefined : v));
    if (!silent) toast(`スロット${curSlot}にセーブしました`, 'good');
    return true;
  } catch (e) { if (!silent) toast('セーブに失敗しました（容量不足の可能性）', 'bad'); return false; }
}
function loadGame(n) {
  try {
    const g = readSlot(n);
    if (!slotValid(g)) return false;
    g.inv = g.inv || {}; g.tools = g.tools || {}; g.up = g.up || {}; g.bp = g.bp || {}; g.flags = g.flags || {};
    g.market = g.market || { m: {}, ev: null }; g.market.m = g.market.m || {}; g.stats = g.stats || {}; g.diaries = g.diaries || [];
    // v1 → v2 の移行
    g.mode = g.mode === 'hard' ? 'hard' : 'normal';
    if (!Array.isArray(g.hot) || g.hot.length !== CONFIG.hotSize) g.hot = newHot(sortItems(Object.keys(g.inv).filter(k => ITEMS[k] && !ITEMS[k].key && g.inv[k] > 0)));
    g.hot = g.hot.map(k => (k && ITEMS[k] && !ITEMS[k].key) ? k : null);
    g.hotSel = clamp(g.hotSel | 0, 0, CONFIG.hotSize - 1);
    // v2b：スタミナ・天気・締め日・水
    if (g.v < 3 && !g.inv.bowl && !g.inv.rawwater && !g.inv.cleanwater) g.inv.bowl = 1;
    g.stamina = g.stamina != null ? g.stamina : 100; g.exhaust = !!g.exhaust; g.sick = g.sick || 0; g.rainAcc = g.rainAcc || 0; g.penalty = g.penalty || 0;
    if (!WEATHER[g.weather]) g.weather = 'sun';
    g.storage = g.storage || {}; g.stats.kills = g.stats.kills || 0;
    g.casino = g.casino || { open: false, net: 0, plays: 0 };
    if (g.stageI == null) { const st = stagesOf(g.contract); g.stageI = st.findIndex(x => x.day >= g.day); if (g.stageI < 0) g.stageI = st.length; }
    g.v = CONFIG.saveVersion;
    game = g; curSlot = n; setupMaps();
    player.x = g.px; player.y = g.py; player.dir = g.dir || 0;
    if (rectBlocked(player.x, player.y)) { const s = g.map === 'cave' ? maps.cave.lm.exit : maps.island.lm.spawn; player.x = s.x * 16 + 8; player.y = s.y * 16 + 12; }
    return true;
  } catch (e) { console.error(e); return false; }
}
function deleteSave(n) { try { localStorage.removeItem(slotKey(n)); } catch (e) { /* noop */ } }

/* ---------- 13. 効果音（WebAudio） ---------- */
const Sound = {
  ctx: null, master: null, noiseBuf: null, last: {},
  init() {
    try {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf; this.setVol();
    } catch (e) { this.ctx = null; }
  },
  setVol() { if (this.master) this.master.gain.value = settings.se ? (settings.vol / 10) * 0.5 : 0; },
  tone(f, dur, type, vol, slide, delay) {
    const c = this.ctx, t0 = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, vol, freq, type, delay) {
    const c = this.ctx, t0 = c.currentTime + (delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type || 'lowpass'; f.frequency.value = freq || 1200;
    g.gain.setValueAtTime(vol || 0.3, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t0); s.stop(t0 + dur + 0.02);
  },
  play(n) {
    if (!this.ctx || !settings.se) return;
    const now = performance.now(); if (this.last[n] && now - this.last[n] < 40) return; this.last[n] = now;
    switch (n) {
      case 'ui': this.tone(660, 0.04, 'square', 0.08); break;
      case 'pick': this.tone(880, 0.05, 'square', 0.12); this.tone(1320, 0.06, 'square', 0.1, 0, 0.05); break;
      case 'chop': this.noise(0.08, 0.35, 900); this.tone(180, 0.06, 'triangle', 0.25, -60); break;
      case 'mine': this.noise(0.06, 0.3, 3000, 'highpass'); this.tone(420, 0.05, 'square', 0.12, -120); break;
      case 'crystal': this.tone(1760, 0.12, 'sine', 0.15); this.tone(2350, 0.1, 'sine', 0.1, 0, 0.04); break;
      case 'cut': this.noise(0.07, 0.25, 4000, 'highpass'); break;
      case 'shake': this.noise(0.15, 0.25, 700); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.12); this.tone(1319, 0.14, 'square', 0.12, 0, 0.07); break;
      case 'craft': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.08, 'square', 0.1, 0, i * 0.06)); break;
      case 'error': this.tone(150, 0.14, 'square', 0.15); break;
      case 'eat': this.noise(0.05, 0.2, 1500); this.noise(0.05, 0.2, 1500, 'lowpass', 0.09); break;
      case 'drink': this.tone(500, 0.08, 'sine', 0.2, 300); this.tone(600, 0.08, 'sine', 0.18, 300, 0.1); break;
      case 'splash': this.noise(0.2, 0.25, 2500, 'highpass'); break;
      case 'bite': this.tone(1200, 0.06, 'square', 0.16); this.tone(1200, 0.06, 'square', 0.16, 0, 0.1); break;
      case 'catch': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.09, 'square', 0.12, 0, i * 0.07)); break;
      case 'hurt': this.tone(300, 0.2, 'sawtooth', 0.2, -200); break;
      case 'thud': this.noise(0.12, 0.3, 400); break;
      case 'sleep': [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.15, 0, i * 0.2)); break;
      case 'door': this.noise(0.3, 0.2, 600); break;
      case 'unlock': [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.15, 0, i * 0.08)); break;
      case 'talk': this.tone(520 + Math.random() * 80, 0.025, 'square', 0.04); break;
      case 'warn': this.tone(880, 0.1, 'square', 0.12); this.tone(660, 0.12, 'square', 0.12, 0, 0.12); break;
    }
  },
};
function sfx(n) { try { Sound.play(n); } catch (e) { /* noop */ } }

/* ---------- 14. 持ち物・お金 ---------- */
const invCount = () => { let n = 0; for (const k in game.inv) if (ITEMS[k] && !ITEMS[k].key) n += game.inv[k]; return n; };
const capacity = () => CONFIG.baseCap + (game.up.bag ? 30 : 0) + (game.up.cart ? 60 : 0);
const has = (id, n) => (game.inv[id] || 0) >= (n || 1);
const hasAll = cost => Object.keys(cost).every(k => has(k, cost[k]));
function addItem(id, n, force) {
  if (n <= 0) return 0;
  let room = ITEMS[id].key || force ? n : Math.max(0, capacity() - invCount());
  const add = Math.min(n, room);
  if (add > 0) { game.inv[id] = (game.inv[id] || 0) + add; if (!ITEMS[id].key) hotAuto(id); }
  return add;
}
// アイテムバー：新しく手に入れた物を空き枠へ
function hotAuto(id) {
  const hb = game.hot; if (!hb || hb.includes(id)) return;
  const i = hb.findIndex(k => !k || !(game.inv[k] > 0)); if (i >= 0) hb[i] = id;
}
const hotItem = () => { const id = game.hot[game.hotSel]; return id && game.inv[id] > 0 ? id : null; };
function hotSelect(i) { i = ((i % CONFIG.hotSize) + CONFIG.hotSize) % CONFIG.hotSize; if (game.hotSel !== i) { game.hotSel = i; state.hotName = 1.6; sfx('ui'); } }
function hotAssign(id, i) { const hb = game.hot, j = hb.indexOf(id); if (j >= 0 && j !== i) hb[j] = hb[i] && hb[i] !== id ? hb[i] : null; hb[i] = id; }
// 落とし物
function freeDropTile(m, sx, sy, id) {
  for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = sx + dx, y = sy + dy; if (!WALK[tileAt(m, x, y)]) continue;
    const o = objAt(m, x, y);
    if (!o) return { x, y, o: null };
    if (o.t === 'drop' && o.id === id) return { x, y, o };
  }
  return null;
}
function spawnDrop(m, tx, ty, id, n, lock) {
  const sp = freeDropTile(m, tx, ty, id); if (!sp) return false;
  if (sp.o) { sp.o.n += n; sp.o.lock = Math.max(sp.o.lock || 0, lock); } else addObj(m, { t: 'drop', x: sp.x, y: sp.y, id, n, lock });
  return true;
}
function dropItem(id, n) {
  n = Math.min(n, game.inv[id] || 0); if (n <= 0 || ITEMS[id].key) return 0;
  const m = curMap(), [vx, vy] = DIRV[player.dir], ptx = Math.floor(player.x / 16), pty = Math.floor((player.y - 3) / 16);
  let tx = ptx + vx, ty = pty + vy; if (!WALK[tileAt(m, tx, ty)] || isBlocked(m, tx, ty)) { tx = ptx; ty = pty; }
  if (!spawnDrop(m, tx, ty, id, n, CONFIG.dropLock)) { sfx('error'); toast('ここには落とせない', 'bad'); return 0; }
  takeItem(id, n); sfx('pick');
  floatText(tx * 16 + 8, ty * 16 - 2, `-${n} ${ITEMS[id].n}`, '#ffd0c0');
  return n;
}
function pickDrop(o, press) {
  if (o.lock > 0) { if (press) { sfx('error'); toast(`まだ拾えない（あと${Math.ceil(o.lock)}秒）`); } return; }
  const a = addItem(o.id, o.n);
  if (a <= 0) { if (state.capToast <= 0) { state.capToast = 2.5; sfx('error'); toast('持ち物がいっぱい！', 'bad'); } return; }
  floatText(o.x * 16 + 8, o.y * 16 - 2, `+${a} ${ITEMS[o.id].n}`, '#ffffff');
  o.n -= a; if (o.n <= 0) removeObj(curMap(), o); else toast('持ち物がいっぱいで、全部は拾えなかった', 'bad');
  sfx('pick'); state.lastInstant = null;
}
function takeItem(id, n) { game.inv[id] = (game.inv[id] || 0) - n; if (game.inv[id] <= 0) delete game.inv[id]; }
function payCost(cost) { for (const k in cost) takeItem(k, cost[k]); }
function costSize(cost) { let n = 0; for (const k in cost) if (!ITEMS[k].key) n += cost[k]; return n; }
function toolLv(cat) { let lv = 0; for (const k in game.tools) { const t = TOOLS[k]; if (t && t.cat === cat && t.lv > lv) lv = t.lv; } return lv; }
function bestTool(cat) { let best = null; for (const k in game.tools) { const t = TOOLS[k]; if (t && t.cat === cat && (!best || t.lv > TOOLS[best].lv)) best = k; } return best; }
function useTool(cat) {
  const k = bestTool(cat); if (!k || !TOOLS[k].dur) return;
  game.tools[k]--; if (game.tools[k] <= 0) { delete game.tools[k]; toast(`${TOOLS[k].n}が壊れた！`, 'bad'); sfx('error'); }
}
const repaidRatio = () => game.debt <= 0 ? 1 : Math.min(1, game.repaid / game.contract.debt);
function stagesOf(c) {
  const out = [];
  for (const [f, r] of STAGE_PLAN) { const d = Math.max(1, Math.round(c.days * f)); if (d < c.days && !out.some(x => x.day >= d)) out.push({ day: d, need: Math.ceil(c.debt * r) }); }
  return out;
}
const nextStage = () => { if (!game || game.debt <= 0) return null; const st = stagesOf(game.contract); return game.stageI < st.length ? st[game.stageI] : null; };
function price(id) {
  const it = ITEMS[id]; let m = game.market.m[id] != null ? game.market.m[id] : 1; const ev = game.market.ev;
  if (ev && ev.up === id) m *= 1.5; if (ev && ev.dn === id) m *= 0.6;
  return Math.max(1, Math.round(it.p * m));
}
function sellEstimate(id, n) {
  let m = game.market.m[id] != null ? game.market.m[id] : 1, total = 0; const ev = game.market.ev, it = ITEMS[id];
  for (let i = 0; i < n; i++) { let mm = m; if (ev && ev.up === id) mm *= 1.5; if (ev && ev.dn === id) mm *= 0.6; total += Math.max(1, Math.round(it.p * mm)); m = Math.max(0.3, m - DROP[it.c]); }
  return total;
}
function sellItem(id, n) {
  n = Math.min(n, game.inv[id] || 0); if (n <= 0 || ITEMS[id].key) return;
  const total = sellEstimate(id, n), it = ITEMS[id];
  let m = game.market.m[id] != null ? game.market.m[id] : 1; m = Math.max(0.3, m - DROP[it.c] * n); game.market.m[id] = m;
  takeItem(id, n); game.money += total; game.stats.earned += total; game.stats.sold += n;
  if (id === 'turtle') game.turtleSold = true;
  sfx('coin'); toast(`${it.n}×${n} を ${fmt$(total)} で売った`, 'money');
  if (!game.flags.firstSale) { game.flags.firstSale = 1; queueTalk(TALK.firstSale); }
  saveGame(true);
}
function rollMarketEvent() {
  const pool = Object.keys(ITEMS).filter(k => !ITEMS[k].key && !['turtle', 'boot', 'canned', 'medkit', 'bowl', 'rawwater', 'cleanwater'].includes(k));
  const up = pool[Math.floor(Math.random() * pool.length)]; let dn = up;
  while (dn === up) dn = pool[Math.floor(Math.random() * pool.length)];
  game.market.ev = { up, dn };
}

/* ---------- 15. 入力（キーボード／コントローラー／タッチ） ---------- */
const KEYMAP = {
  Space: ['A'], KeyZ: ['A'], KeyJ: ['A'], Enter: ['A'], NumpadEnter: ['A'],
  KeyK: ['B'], KeyX: ['B'], Backspace: ['B'], Escape: ['START'],
  KeyE: ['X', 'TABR'], Tab: ['X'], KeyQ: ['DROP', 'TABL'], KeyF: ['Y'],
  KeyB: ['INV'], KeyI: ['INV'], KeyC: ['CRAFT'], KeyM: ['MAP'], ShiftLeft: ['DASH'], ShiftRight: ['DASH'],
  Digit1: ['H1'], Digit2: ['H2'], Digit3: ['H3'], Digit4: ['H4'], Digit5: ['H5'], Digit6: ['H6'], Digit7: ['H7'], Digit8: ['H8'],
  ArrowUp: ['UP'], KeyW: ['UP'], ArrowDown: ['DOWN'], KeyS: ['DOWN'], ArrowLeft: ['LEFT'], KeyA: ['LEFT'], ArrowRight: ['RIGHT'], KeyD: ['RIGHT'],
};
const Input = {
  mode: 'key', keys: {}, pressed: new Set(), padPrev: {}, pad: {}, padVec: [0, 0],
  touch: { A: false, B: false, X: false, Y: false }, stick: { id: null, ox: 0, oy: 0, vx: 0, vy: 0 }, padIndex: -1,
  down(b) {
    if (this.pad[b] || this.touch[b]) return true;
    for (const code in this.keys) if (this.keys[code] && KEYMAP[code] && KEYMAP[code].includes(b)) return true;
    return false;
  },
  press(b) { return this.pressed.has(b); },
  consume(b) { this.pressed.delete(b); },
  moveVec() {
    let x = 0, y = 0;
    if (this.down('LEFT')) x -= 1; if (this.down('RIGHT')) x += 1; if (this.down('UP')) y -= 1; if (this.down('DOWN')) y += 1;
    if (!this.pad.LEFT && !this.pad.RIGHT && !this.pad.UP && !this.pad.DOWN && (this.padVec[0] || this.padVec[1])) { x = this.padVec[0]; y = this.padVec[1]; }
    if (this.stick.vx || this.stick.vy) { x = this.stick.vx; y = this.stick.vy; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return [x, y];
  },
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null; for (const p of pads) if (p && p.connected) { gp = p; break; }
    const cur = {}; this.padVec = [0, 0];
    if (gp) {
      const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
      cur.A = b(settings.swapAB ? 1 : 0); cur.B = b(settings.swapAB ? 0 : 1);
      cur.X = b(settings.swapXY ? 3 : 2); cur.Y = b(settings.swapXY ? 2 : 3);
      cur.LB = b(4); cur.RB = b(5); cur.TABL = cur.LB; cur.TABR = cur.RB; cur.START = b(9) || b(8);
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, dz = 0.25;
      cur.UP = b(12); cur.DOWN = b(13); cur.LEFT = b(14); cur.RIGHT = b(15);
      const mag = Math.hypot(ax, ay);
      if (mag > dz) { const k = Math.min(1, (mag - dz) / (1 - dz)) / mag; this.padVec = [ax * k, ay * k]; }
      cur.NUP = ay < -0.55; cur.NDOWN = ay > 0.55; cur.NLEFT = ax < -0.55; cur.NRIGHT = ax > 0.55;
      let active = mag > 0.4; for (const k in cur) if (cur[k] && !this.padPrev[k]) active = true;
      if (active) setInputMode('pad');
    }
    for (const k in cur) if (cur[k] && !this.padPrev[k]) {
      if (k[0] === 'N') this.pressed.add(k.slice(1)); else this.pressed.add(k);
    }
    this.pad = { A: cur.A, B: cur.B, X: cur.X, Y: cur.Y, LB: cur.LB, RB: cur.RB, START: cur.START, UP: cur.UP || cur.NUP, DOWN: cur.DOWN || cur.NDOWN, LEFT: cur.LEFT || cur.NLEFT, RIGHT: cur.RIGHT || cur.NRIGHT };
    this.padPrev = cur;
  },
  endFrame() { this.pressed.clear(); },
  clearAll() { this.keys = {}; this.touch = { A: false, B: false, X: false, Y: false }; this.stick.vx = this.stick.vy = 0; this.pressed.clear(); },
};
function setInputMode(m) {
  if (Input.mode === m) return;
  Input.mode = m; const b = document.body;
  b.classList.remove('mode-key', 'mode-pad', 'mode-touch'); b.classList.add('mode-' + m);
  updateTouchVisibility(); state.hintHtml = undefined;
}
function updateTouchVisibility() {
  const el = $('touch'); if (!el) return;
  el.classList.toggle('hidden', !(Input.mode === 'touch' && state.scene === 'play'));
}
function keyLabel(b) {
  if (Input.mode === 'key') return { A: 'Space', B: 'K', X: 'E', Y: 'F', START: 'Esc', DROP: 'Q' }[b] || b;
  return b;
}
const kb = b => `<span class="kb">${keyLabel(b)}</span>`;
function isTyping() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }

function setupInput() {
  window.addEventListener('keydown', e => {
    Sound.init();
    if (isTyping()) { if (e.code === 'Enter' || e.code === 'Escape') document.activeElement.blur(); return; }
    if (konamiKey(e)) { e.preventDefault(); return; }   // 隠しコマンドの B・A はメニュー操作として扱わない
    let m = KEYMAP[e.code]; if (!m) return;
    if (e.code === 'KeyQ' && (e.ctrlKey || e.metaKey)) m = ['DROPALL', 'TABL'];
    e.preventDefault();
    setInputMode('key');
    if (!e.repeat) { Input.keys[e.code] = true; for (const b of m) Input.pressed.add(b); }
    else if (UI.isOpen() || Dialog.active) for (const b of m) if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(b)) Input.pressed.add(b);
  });
  window.addEventListener('keyup', e => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => Input.clearAll());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { Input.clearAll(); saveGame(true); } });
  window.addEventListener('pagehide', () => saveGame(true));
  window.addEventListener('pointerdown', e => {
    Sound.init();
    if (e.pointerType === 'touch') setInputMode('touch'); else if (e.pointerType === 'mouse' && Input.mode === 'touch') setInputMode('key');
  }, true);
  // 長押しメニュー・ダブルタップ拡大・ピンチ拡大を防止
  document.addEventListener('contextmenu', e => { if (!isTyping()) e.preventDefault(); });
  document.addEventListener('selectstart', e => { if (!(e.target && e.target.closest && e.target.closest('input,textarea'))) e.preventDefault(); });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  // マウスホイールでアイテムバーを選ぶ
  let wheelT = 0;
  window.addEventListener('wheel', e => {
    if (state.scene !== 'play' || !game || UI.isOpen() || Dialog.active || state.place) return;
    e.preventDefault(); const now = performance.now(); if (Math.abs(e.deltaY) < 1 || now - wheelT < 70) return;
    wheelT = now; hotSelect(game.hotSel + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
  // 設置モード：画面のマスをクリック／タップ
  const cv = $('game');
  cv.addEventListener('pointermove', e => { if (state.place && e.pointerType === 'mouse') placeCursorFromScreen(e.clientX, e.clientY); });
  cv.addEventListener('pointerdown', e => {
    if (!state.place || state.fading || UI.isOpen() || Dialog.active) return;
    e.preventDefault();
    if (e.button === 2) { cancelPlace(); return; }
    placeCursorFromScreen(e.clientX, e.clientY); confirmPlace();
  });
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouchEnd < 320 && !(e.target.closest && e.target.closest('button,input,.slot,.tbtn,#dialog,.story'))) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  window.addEventListener('gamepadconnected', () => { toast('コントローラーを接続しました'); setInputMode('pad'); });
  window.addEventListener('gamepaddisconnected', () => { toast('コントローラーが切断されました'); if (Input.mode === 'pad') setInputMode(matchMedia('(pointer: coarse)').matches ? 'touch' : 'key'); });

  // スティック
  const zone = $('stick-zone'), base = $('stick-base'), knob = $('stick-knob'), S = Input.stick;
  const R = () => 50 * settings.touchSize;
  const resetStick = () => { S.id = null; S.vx = S.vy = 0; base.classList.remove('active'); base.style.left = ''; base.style.top = ''; base.style.bottom = ''; knob.style.transform = ''; };
  zone.addEventListener('pointerdown', e => {
    e.preventDefault(); setInputMode('touch'); S.id = e.pointerId; S.ox = e.clientX; S.oy = e.clientY;
    try { zone.setPointerCapture(e.pointerId); } catch (er) { /* noop */ }
    const r = zone.getBoundingClientRect(), half = 64 * settings.touchSize;
    base.style.left = (e.clientX - r.left - half) + 'px'; base.style.top = (e.clientY - r.top - half) + 'px'; base.style.bottom = 'auto';
    base.classList.add('active');
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== S.id) return; e.preventDefault();
    let dx = e.clientX - S.ox, dy = e.clientY - S.oy; const l = Math.hypot(dx, dy), r = R();
    if (l > r) { dx *= r / l; dy *= r / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const m = Math.min(1, l / r); if (m < 0.15) { S.vx = S.vy = 0; } else { S.vx = dx / r; S.vy = dy / r; }
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, e => { if (e.pointerId === S.id) resetStick(); });
  // ボタン
  document.querySelectorAll('.tbtn').forEach(el => {
    const b = el.dataset.b;
    el.addEventListener('pointerdown', e => { e.preventDefault(); setInputMode('touch'); try { el.setPointerCapture(e.pointerId); } catch (er) { /* noop */ } Input.touch[b] = true; Input.pressed.add(b); el.classList.add('on'); });
    const up = () => { Input.touch[b] = false; el.classList.remove('on'); };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, up);
  });
  $('hud-menu').addEventListener('click', e => { e.preventDefault(); if (state.scene === 'play' && !UI.isOpen() && !Dialog.active && !state.fading) { if (state.place) cancelPlace(); openMainMenu(); } });
  $('dialog').addEventListener('click', e => { e.preventDefault(); Dialog.advance(); });
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });
}

/* ---------- 16. UI（メニュー層） ---------- */
const $ = id => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k]; if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'style') el.style.cssText = v; else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); }
  return el;
}
function icon(id, sm) { return h('img', { class: 'icon' + (sm ? ' sm' : ''), src: ICON_URL[id] || ICON_URL.bp, alt: '', draggable: 'false' }); }
function btn(label, fn, o) {
  o = o || {};
  const b = h('button', { class: 'btn f ' + (o.cls || '') + (o.disabled ? ' dis' : ''), 'data-k': o.key || (typeof label === 'string' ? label : ''), tabindex: '-1', type: 'button' }, label);
  b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const L = UI.top(); if (L) { const fe = b.closest('.f'); L.focusKey = fe ? fe.dataset.k : b.dataset.k; }
    if (o.disabled) { sfx('error'); if (o.why) toast(o.why, 'bad'); return; }
    if (!o.silent) sfx('ui');
    fn(e);
  });
  return b;
}
const UI = {
  stack: [],
  root: null,
  isOpen() { return this.stack.length > 0; },
  top() { return this.stack[this.stack.length - 1]; },
  open(opts) {
    const el = h('div', { class: 'modal ' + (opts.cls || '') });
    const below = this.top(); if (below) { below.el.classList.add('under'); below.el.querySelectorAll('.focus').forEach(e => e.classList.remove('focus')); }
    this.root.appendChild(el);
    const L = Object.assign({ el, focusKey: null, onBack: () => UI.close() }, opts);
    this.stack.push(L); this.refresh(L); return L;
  },
  close(L) {
    L = L || this.top(); if (!L) return;
    const i = this.stack.indexOf(L); if (i >= 0) this.stack.splice(i, 1);
    L.el.remove();
    if (this.top()) this.top().el.classList.remove('under');
    if (L.onClose) L.onClose();
    if (this.top()) this.applyFocus(this.top());
  },
  closeAll() { while (this.stack.length) this.close(); },
  refresh(L) {
    L = L || this.top(); if (!L) return;
    const body = L.el.querySelector('.win-body'), st = body ? body.scrollTop : 0;
    L.el.innerHTML = ''; L.render(L.el, L);
    const nb = L.el.querySelector('.win-body'); if (nb) nb.scrollTop = st;
    this.applyFocus(L);
  },
  focusables(L) { return [...L.el.querySelectorAll('.f')].filter(e => e.offsetParent !== null); },
  applyFocus(L) {
    const list = this.focusables(L); L.el.querySelectorAll('.focus').forEach(e => e.classList.remove('focus'));
    let el = L.focusKey != null ? list.find(e => e.dataset.k === L.focusKey) : null;
    if (!el) el = list.find(e => e.classList.contains('primary')) || list.find(e => !e.classList.contains('btn-close') && !e.classList.contains('tab')) || list[0];
    if (el) { el.classList.add('focus'); L.focusKey = el.dataset.k; }
  },
  focused(L) { L = L || this.top(); return L ? L.el.querySelector('.f.focus') : null; },
  nav(dir) {
    const L = this.top(); if (!L) return;
    const cur = this.focused(L), list = this.focusables(L); if (!list.length) return;
    if (!cur) { this.applyFocus(L); return; }
    if (cur.dataset.stepper && (dir === 'LEFT' || dir === 'RIGHT')) { const t = cur.querySelector(dir === 'LEFT' ? '.st-dn' : '.st-up'); if (t) t.click(); return; }
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = 1e9;
    for (const e of list) {
      if (e === cur) continue; const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, dx = x - ax, dy = y - ay;
      let main, side;
      if (dir === 'UP') { if (r.bottom > a.top + 2 && dy >= -2) continue; main = -dy; side = Math.abs(dx); }
      else if (dir === 'DOWN') { if (r.top < a.bottom - 2 && dy <= 2) continue; main = dy; side = Math.abs(dx); }
      else if (dir === 'LEFT') { if (dx >= -2) continue; main = -dx; side = Math.abs(dy); if (side > Math.max(a.height, r.height)) continue; }
      else { if (dx <= 2) continue; main = dx; side = Math.abs(dy); if (side > Math.max(a.height, r.height)) continue; }
      const s = main + side * 2.2; if (s < bs) { bs = s; best = e; }
    }
    if (best) { cur.classList.remove('focus'); best.classList.add('focus'); L.focusKey = best.dataset.k; best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); sfx('ui'); }
  },
  update(dt) {
    const L = this.top(); if (!L) return;
    if (L.mainMenu) {
      if (state.konamiGo) { state.konamiGo = false; konamiActivate(L); this.refresh(L); return; }
      const sc = ['INV', 'CRAFT', 'MAP'].find(k => Input.press(k));
      if (sc) { const tab = { INV: 'inv', CRAFT: 'craft', MAP: 'map' }[sc]; sfx('ui'); if (L.tab === tab) L.onBack(); else { L.tab = tab; L.focusKey = 'tab-' + tab; this.refresh(L); } return; }
      for (let i = 1; i <= CONFIG.hotSize; i++) if (Input.press('H' + i)) { hotSelect(i - 1); this.refresh(L); return; }
    }
    for (const d of ['UP', 'DOWN', 'LEFT', 'RIGHT']) if (Input.press(d)) this.nav(d);
    // スティック長押しでの連続移動
    const held = ['UP', 'DOWN', 'LEFT', 'RIGHT'].find(d => Input.pad[d]);
    if (held) { this.rep = (this.rep || 0) + dt; if (this.rep > 0.4) { this.rep = 0.3; this.nav(held); } } else this.rep = 0;
    if (Input.press('A')) { const f = this.focused(L); if (f) { if (f.tagName === 'INPUT') f.focus(); else f.click(); } }
    else if (Input.press('B') || Input.press('START') || (L.toggleX && Input.press('X') && !Input.press('TABR'))) { sfx('ui'); L.onBack(); }
    else if (Input.press('TABL') && L.tabs) this.switchTab(L, -1);
    else if (Input.press('TABR') && L.tabs) this.switchTab(L, 1);
  },
  switchTab(L, d) { const ids = L.tabs.map(t => t.id); let i = ids.indexOf(L.tab); i = (i + d + ids.length) % ids.length; L.tab = ids[i]; L.focusKey = 'tab-' + L.tab; sfx('ui'); this.refresh(L); },
};
function windowEl(L, o) {
  const w = h('div', { class: 'window ' + (o.cls || '') });
  w.appendChild(h('div', { class: 'win-head' }, h('div', { class: 'win-title' }, o.title), o.noClose ? null : btn('×', () => L.onBack(), { key: 'close', cls: 'btn-close' })));
  if (o.tabs) {
    L.tabs = o.tabs; const tb = h('div', { class: 'tabs' });
    for (const t of o.tabs) tb.appendChild(btn(t.label, () => { L.tab = t.id; L.focusKey = 'tab-' + t.id; UI.refresh(L); }, { key: 'tab-' + t.id, cls: 'tab' + (L.tab === t.id ? ' on' : '') }));
    w.appendChild(tb);
  }
  if (o.sub) w.appendChild(o.sub);
  const b = h('div', { class: 'win-body' }); o.body(b); w.appendChild(b);
  if (o.foot && o.foot.length) w.appendChild(h('div', { class: 'win-foot' }, ...o.foot));
  return w;
}
function confirmBox(msg, yes, opt) {
  opt = opt || {};
  UI.open({
    render: (el, L) => el.appendChild(windowEl(L, {
      title: opt.title || '確認', cls: 'small', body: b => b.appendChild(h('p', { class: 'note', style: 'font-size:15px;color:var(--text);white-space:pre-wrap' }, msg)),
      foot: [btn(opt.no || 'やめる', () => UI.close(), { key: 'no' }), btn(opt.yes || 'はい', () => { UI.close(); yes(); }, { key: 'yes', cls: opt.danger ? 'danger' : 'primary' })],
    })),
  });
}
function stepper(key, label, value, onDn, onUp) {
  const wrap = h('div', { class: 'stepper f', 'data-k': key, 'data-stepper': '1' },
    btn('◀', onDn, { key: key + '-dn', cls: 'small st-dn' }), h('span', { class: 'val' }, value), btn('▶', onUp, { key: key + '-up', cls: 'small st-up' }));
  wrap.querySelectorAll('.btn').forEach(b => b.classList.remove('f'));
  return h('div', { class: 'set-row' }, h('div', { class: 'lbl', html: label }), wrap);
}

/* ---------- 17. トースト・ヒント・会話・フェード ---------- */
function toast(text, type) {
  const box = $('toasts'); if (!box) return;
  const el = h('div', { class: 'toast ' + (type || '') }, text); box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 2600);
}
function fmtText(s) {
  const g = game || {}, c = g.contract || {};
  return s.replace(/\{name\}/g, g.name || 'あなた').replace(/\{debt\}/g, fmt$(c.debt || 0)).replace(/\{rate\}/g, String(c.rate != null ? c.rate : 0))
    .replace(/\{days\}/g, String(c.days || 0)).replace(/\{days1\}/g, String((c.days || 0) + 1)).replace(/\{controls\}/g, controlsText());
}
function controlsText() {
  if (Input.mode === 'touch') return '操作：左下のスティックで移動（Bを押したままでダッシュ）、Aで調べる・採集（木や岩は長押し）・攻撃、Xでメニュー、Yで食事。\n下のアイテムバーはタップで選べます。';
  if (Input.mode === 'pad') return '操作：スティックで移動（Bを押したままでダッシュ）、Aで調べる・採集（木や岩は長押し）・攻撃、Xでメニュー、Yで食事、LB/RBでアイテムバー。';
  return '操作：WASD/矢印で移動、Shiftでダッシュ、Spaceで調べる・攻撃・採集（木や岩は長押し）、Eでメニュー、Fで食事。\nB持ち物 Cクラフト M地図、1〜8・ホイールでアイテムバー、Qで落とす。';
}
const Dialog = {
  active: false, lines: [], i: 0, full: '', shown: 0, cb: null, acc: 0,
  start(lines, cb) {
    this.lines = lines.slice(); this.i = 0; this.cb = cb || null; this.active = true;
    $('dialog').classList.remove('hidden'); this.show();
  },
  show() {
    const [who, raw] = this.lines[this.i], sp = SPEAKERS[who] || SPEAKERS.sys;
    this.full = fmtText(raw); this.shown = 0; this.acc = 0;
    const nm = $('dlg-name'); nm.textContent = sp.name(); nm.style.color = sp.col;
    const pc = $('dlg-portrait'), x = pc.getContext('2d');
    if (sp.por && POR[sp.por]) { pc.classList.remove('none'); x.clearRect(0, 0, 24, 24); x.drawImage(POR[sp.por], 0, 0); } else pc.classList.add('none');
    $('dlg-text').textContent = ''; $('dlg-next').style.visibility = 'hidden';
  },
  update(dt) {
    if (!this.active) return;
    if (this.shown < this.full.length) {
      this.acc += dt * 45; const n = Math.floor(this.acc);
      if (n > 0) { this.acc -= n; const before = this.shown; this.shown = Math.min(this.full.length, this.shown + n); $('dlg-text').textContent = this.full.slice(0, this.shown); if (Math.floor(before / 3) !== Math.floor(this.shown / 3)) sfx('talk'); }
      if (this.shown >= this.full.length) $('dlg-next').style.visibility = 'visible';
    }
    if (Input.press('A') || Input.press('B')) this.advance();
  },
  advance() {
    if (!this.active) return;
    if (this.shown < this.full.length) { this.shown = this.full.length; $('dlg-text').textContent = this.full; $('dlg-next').style.visibility = 'visible'; return; }
    this.i++;
    if (this.i >= this.lines.length) { this.active = false; $('dialog').classList.add('hidden'); const cb = this.cb; this.cb = null; Input.clearAll(); if (cb) cb(); }
    else this.show();
  },
};
function queueTalk(lines, cb) { state.pendingTalks.push({ lines, cb }); }
function processTalks() {
  if (Dialog.active || UI.isOpen() || state.fading || !state.pendingTalks.length || state.scene !== 'play') return;
  const t = state.pendingTalks.shift(); Dialog.start(t.lines, t.cb);
}
function fade(mid, after) {
  state.fading = true; const f = $('fade'); f.classList.add('on');
  setTimeout(() => { try { mid && mid(); } catch (e) { console.error(e); } setTimeout(() => { f.classList.remove('on'); setTimeout(() => { state.fading = false; after && after(); }, 450); }, 250); }, 520);
}

/* ---------- 18. メニュー画面 ---------- */
const ITEM_ORDER = Object.keys(ITEMS);
const sortItems = ids => ids.sort((a, b) => ITEM_ORDER.indexOf(a) - ITEM_ORDER.indexOf(b));
function sec(title, ...kids) { return h('div', { class: 'sec' }, h('div', { class: 'sec-title' }, title), ...kids); }
function statusSub(extra) {
  return h('div', { class: 'win-sub' }, h('span', null, '所持金 ', h('b', null, fmt$(game.money))), h('span', null, '借金 ', h('b', null, fmt$(game.debt))),
    h('span', null, '持ち物 ', h('b', null, `${invCount()}/${capacity()}`)), extra || null);
}
function costEls(cost, mult) {
  return h('div', { class: 'costs' }, ...Object.keys(cost).map(k => { const need = cost[k] * (mult || 1), hv = game.inv[k] || 0; return h('span', { class: hv >= need ? 'ok' : 'ng' }, icon(k, true), ` ${ITEMS[k].n} ${hv}/${need}`); }));
}
function nearStation(st) {
  const m = curMap(); for (const o of m.objs) { const d = OBJ[o.t]; if (d && d.st === st && Math.hypot(o.x * 16 + 8 - player.x, o.y * 16 + 10 - player.y) < 44) return o; } return null;
}
function openMainMenu(tab) {
  sfx('ui'); stopFishing();
  if (state.lastTab === 'debug' && !settings.debug) state.lastTab = 'inv';
  UI.open({ tab: tab || state.lastTab || 'inv', toggleX: true, mainMenu: true, render: (el, L) => {
    if (L.tab === 'debug' && !settings.debug) L.tab = 'set';
    state.lastTab = L.tab;
    el.appendChild(windowEl(L, {
      title: 'メニュー', sub: statusSub(),
      tabs: [{ id: 'inv', label: '持ち物' }, { id: 'craft', label: 'クラフト' }, { id: 'map', label: '地図' }, { id: 'log', label: '記録' }, { id: 'set', label: '設定' }].concat(settings.debug ? [{ id: 'debug', label: 'デバッグ' }] : []),
      body: b => ({ inv: renderInv, craft: renderCraft, map: renderMap, log: renderLog, set: renderSettings, debug: renderDebug })[L.tab](b, L),
    }));
  } });
}
function renderInv(b, L) {
  // アイテムバー（クリックで枠を選ぶ）
  const hb = h('div', { class: 'inv-hot' });
  game.hot.forEach((id, i) => {
    const ok = id && game.inv[id] > 0;
    const sl = h('button', { class: 'hslot f' + (i === game.hotSel ? ' on' : ''), 'data-k': 'hs-' + i, tabindex: '-1', type: 'button' }, h('span', { class: 'hn' }, String(i + 1)), ok ? icon(id) : null, ok ? h('span', { class: 'hc' }, String(game.inv[id])) : null);
    sl.addEventListener('click', e => { e.preventDefault(); hotSelect(i); L.focusKey = 'hs-' + i; UI.refresh(L); });
    hb.appendChild(sl);
  });
  b.appendChild(sec('アイテムバー（選んだ枠に下のアイテムを登録できます）', hb));
  const ids = sortItems(Object.keys(game.inv).filter(k => game.inv[k] > 0 && ITEMS[k]));
  if (!ids.length) b.appendChild(h('p', { class: 'note' }, '持ち物はありません。島で素材を集めよう。'));
  else {
    const grid = h('div', { class: 'inv-grid' });
    for (const id of ids) {
      const s = h('button', { class: 'slot f' + (L.sel === id ? ' sel' : ''), 'data-k': 'it-' + id, tabindex: '-1', type: 'button' }, icon(id), h('span', { class: 'nm' }, ITEMS[id].n), h('span', { class: 'cnt' }, '×' + game.inv[id]));
      s.addEventListener('click', e => { e.preventDefault(); L.sel = id; L.focusKey = 'it-' + id; sfx('ui'); UI.refresh(L); });
      grid.appendChild(s);
    }
    b.appendChild(grid);
    if (L.sel && game.inv[L.sel]) b.appendChild(itemDetail(L.sel, L));
  }
  const tl = Object.keys(game.tools);
  b.appendChild(sec('道具', tl.length ? h('div', null, ...tl.map(k => {
    const t = TOOLS[k], d = game.tools[k];
    return h('div', { class: 'row-item' }, icon(k), h('div', { class: 'grow' }, h('div', { class: 'name' }, t.n),
      t.dur ? h('div', null, h('div', { class: 'desc' }, `耐久 ${d}/${t.dur}`), h('div', { class: 'dur' }, h('i', { style: `width:${Math.round(d / t.dur * 100)}%` }))) : h('div', { class: 'desc' }, '壊れない')));
  })) : h('p', { class: 'note' }, 'まだ道具がありません。「クラフト」で作ろう。')));
  const ups = [];
  for (const k in UP_NAMES) if (game.up[k]) ups.push(UP_NAMES[k]);
  const bps = [];
  const BPN = { bag: '大きなかばん', magnet: 'アイテム回収機', cart: '運搬カート', furnace: '炉', iron: '鉄の道具', benchUp: '作業台強化', raft: 'いかだ' };
  for (const k in BPN) if (game.bp[k]) bps.push(BPN[k]);
  b.appendChild(sec('強化・設計図', h('p', { class: 'note' }, '強化：' + (ups.join('、') || 'なし')), h('p', { class: 'note' }, '設計図：' + (bps.join('、') || 'なし'))));
}
function itemDetail(id, L) {
  const it = ITEMS[id], d = h('div', { class: 'detail' });
  d.appendChild(h('div', { class: 'hd' }, icon(id), h('div', null, h('div', { class: 'name' }, `${it.n} ×${game.inv[id]}`), h('div', { class: 'note' }, it.key ? '大切なもの（売れない）' : `今の買取価格 ${fmt$(price(id))}`))));
  d.appendChild(h('div', { class: 'note' }, it.d));
  if (it.food) d.appendChild(h('div', { class: it.food.poison ? 'note ng' : 'note ok' }, it.food.poison ? '食べると毒で体力-30（売る専用）' : [it.food.h ? `空腹+${it.food.h}` : '', it.food.t ? `渇き+${it.food.t}` : ''].filter(Boolean).join('　') + (it.food.raw ? '（生：お腹を壊すことも）' : '') + (it.ret ? '（器は残る）' : '')));
  const bs = h('div', { class: 'btns' });
  if (it.food || it.heal) bs.appendChild(btn(it.food ? (it.food.h ? '食べる' : '飲む') : '使う', () => { consume(id); if (!game.inv[id]) L.sel = null; UI.refresh(L); }, { key: 'use', cls: 'primary', silent: true }));
  if (!it.key) {
    const inSel = game.hot[game.hotSel] === id;
    bs.appendChild(btn(inSel ? `バー${game.hotSel + 1}番に登録中` : `バー${game.hotSel + 1}番に登録`, () => { hotAssign(id, game.hotSel); UI.refresh(L); }, { key: 'hotset', cls: inSel ? 'gold' : '' }));
    bs.appendChild(btn('1個捨てる', () => { dropItem(id, 1); if (!game.inv[id]) L.sel = null; UI.refresh(L); }, { key: 'drop1', silent: true }));
    bs.appendChild(btn('全部捨てる', () => confirmBox(`${it.n}を${game.inv[id]}個すべて足元に捨てますか？\n（${CONFIG.dropLock}秒たつと拾い直せます）`, () => { dropItem(id, game.inv[id] || 0); L.sel = null; UI.refresh(L); }, { danger: true, yes: '捨てる' }), { key: 'dropall', cls: 'danger' }));
  }
  d.appendChild(bs); return d;
}
const recipeName = r => r.tool ? TOOLS[r.tool].n : r.build ? BUILD_NAMES[r.build] : r.up ? UP_NAMES[r.up] : ITEMS[r.out].n + (r.n > 1 ? '×' + r.n : '');
const recipeIcon = r => r.tool || r.build || r.up || r.out;
function recipeState(r, nearBench) {
  if (r.bp && !game.bp[r.bp]) return { ok: false, label: '設計図が必要', why: '設計図を持っていません' };
  if (r.st === 'bench' && !nearBench) return { ok: false, label: '作業台で作る', why: '作業台の近くで作れます' };
  if (r.up && game.up[r.up]) return { ok: false, label: '作成済み', why: 'すでに持っています' };
  if (r.tool) { const t = TOOLS[r.tool]; if (game.tools[r.tool] != null && (!t.dur || game.tools[r.tool] >= t.dur)) return { ok: false, label: '所持済み', why: 'すでに持っています' }; }
  if (r.build && game.map !== 'island') return { ok: false, label: 'ここでは不可', why: '洞窟の中には設置できません' };
  if (!hasAll(r.cost)) return { ok: false, label: '素材不足', why: '素材が足りません' };
  return { ok: true, label: r.tool && game.tools[r.tool] != null ? '作り直す' : r.build ? '設置する' : '作る' };
}
function renderCraft(b, L, atBench) {
  const nb = atBench || !!nearStation('bench');
  const rowOf = r => {
    const s = recipeState(r, nb), locked = r.bp && !game.bp[r.bp];
    return h('div', { class: 'row-item' + (locked ? ' locked' : '') }, icon(recipeIcon(r)),
      h('div', { class: 'grow' }, h('div', { class: 'name' }, recipeName(r)), h('div', { class: 'desc' }, r.d), costEls(r.cost)),
      h('div', { class: 'btns' }, btn(s.label, () => { craft(r); UI.refresh(L); }, { key: 'cr-' + r.id, cls: s.ok ? 'primary' : '', disabled: !s.ok, why: s.why, silent: true })));
  };
  b.appendChild(sec('手作り（どこでも）', ...RECIPES.filter(r => r.st === 'hand').map(rowOf)));
  b.appendChild(sec('作業台', nb ? null : h('p', { class: 'note warn' }, '作業台の近くにいる時だけ作れます。'), ...RECIPES.filter(r => r.st === 'bench').map(rowOf)));
}
function renderMap(b) {
  const m = curMap(), s = m.name === 'cave' ? 6 : 4, c = mkCanvas(m.W * s, m.H * s), x = c.getContext('2d');
  for (let y = 0; y < m.H; y++) for (let xx = 0; xx < m.W; xx++) { const v = m.tiles[y * m.W + xx]; x.fillStyle = v === T.CWALL ? '#15121a' : TC[v][0]; x.fillRect(xx * s, y * s, s, s); }
  const dot = (o, col, sz) => { x.fillStyle = col; x.fillRect(o.x * s + (s - sz) / 2, o.y * s + (s - sz) / 2, sz, sz); };
  for (const o of m.objs) {
    if (o.t === 'tree' || o.t === 'palm') dot(o, '#1f5e2e', s - 1);
    else if (o.t === 'boulder' || o.t === 'ironVein' || o.t === 'hardRock') dot(o, '#4a4452', s - 1);
    else if (o.t === 'goldVein') dot(o, P.gold, s - 1);
    else if (o.t === 'crystal') dot(o, '#7fe3f0', s - 1);
  }
  const mark = (o, col) => { if (!o) return; x.fillStyle = P.ol; x.fillRect(o.x * s - 2, o.y * s - 2, s + 4, s + 4); x.fillStyle = col; x.fillRect(o.x * s - 1, o.y * s - 1, s + 2, s + 2); };
  for (const o of m.objs) {
    if (o.t === 'box') mark(o, P.gold); else if (o.t === 'workbench' || o.t === 'furnace' || o.t === 'campfire' || o.t === 'bed') mark(o, '#f08a3c');
    else if (o.t === 'cave' || o.t === 'exit') mark(o, '#c040c0'); else if (o.t === 'hut') mark(o, '#c8a36a'); else if (o.t === 'raft') mark(o, '#ffffff'); else if (o.t === 'liner') mark(o, '#ff5ac8');
    else if (o.t === 'diary') mark(o, '#c8e6a0'); else if (o.t === 'shrine') mark(o, P.gold);
  }
  const px = Math.floor(player.x / 16), py = Math.floor((player.y - 4) / 16);
  x.fillStyle = '#ffffff'; x.fillRect(px * s - 3, py * s - 3, s + 6, s + 6); x.fillStyle = '#e2574c'; x.fillRect(px * s - 1, py * s - 1, s + 2, s + 2);
  c.className = 'map-canvas';
  b.appendChild(h('div', { class: 'map-wrap' }, c));
  const lg = (col, t) => h('span', null, h('i', { style: 'background:' + col }), t);
  b.appendChild(h('div', { class: 'legend' }, lg('#e2574c', '現在地'), lg(P.gold, '回収ボックス'), lg('#f08a3c', '設備'), lg('#c040c0', '洞窟'), lg('#c8a36a', '古い小屋'), lg('#ff5ac8', 'カジノ船'), lg('#ffffff', 'いかだ置き場'), lg('#c8e6a0', 'ノート')));
}
function renderLog(b) {
  b.appendChild(sec('いまの目標', h('p', { class: 'note', style: 'color:var(--text);font-size:15px' }, objectiveText())));
  const left = game.contract.days - game.day + 1;
  const stl = stagesOf(game.contract);
  b.appendChild(sec('返済の締め日', stl.length ? h('div', null, ...stl.map((x, i) => h('p', { class: 'note' + (i < game.stageI ? '' : game.repaid >= x.need ? ' ok' : i === game.stageI ? ' warn' : '') },
    `${x.day}日目の終わりまでに 累計 ${fmt$(x.need)}${i < game.stageI ? '（判定済み）' : game.repaid >= x.need ? '（達成）' : `（あと ${fmt$(x.need - game.repaid)}）`}`)),
    h('p', { class: 'note' }, `届かないと、残りの借金の${Math.round(STAGE_PENALTY * 100)}%が遅延損害金として上乗せされます。これまでの損害金：${fmt$(game.penalty || 0)}`)) : h('p', { class: 'note' }, '締め日はありません。')));
  b.appendChild(sec('契約', h('p', { class: 'note' }, `借金 ${fmt$(game.debt)}（初期 ${fmt$(game.contract.debt)}）／利息 1日${game.contract.rate}%／期限 ${game.contract.days}日目の終わりまで（${game.debt > 0 ? (left > 0 ? 'あと' + left + '日' : '今日まで') : '完済済み'}）`),
    h('p', { class: 'note' }, `返済済み ${fmt$(game.repaid)}（${Math.floor(repaidRatio() * 100)}%）／支払った利息 ${fmt$(game.interestPaid)}`)));
  const dl = [1, 2, 3].filter(n => game.diaries.includes(n));
  b.appendChild(sec('ゲンの日誌', dl.length ? h('div', { class: 'btns', style: 'display:flex;gap:6px;flex-wrap:wrap' }, ...dl.map(n => btn(`その${n}を読む`, () => { UI.closeAll(); queueTalk(TALK['diary' + n].filter(l => l[0] === 'gen')); }, { key: 'dia' + n }))) : h('p', { class: 'note' }, 'まだ見つけていない。')));
  const st = game.stats;
  b.appendChild(sec('記録', h('p', { class: 'note' }, `総売上 ${fmt$(st.earned || 0)}／売った数 ${st.sold || 0}／採集 ${st.gathered || 0}／クラフト ${st.crafted || 0}／釣果 ${st.fish || 0}／たおした数 ${st.kills || 0}／ギャンブル収支 ${fmtNet(st.gamble || 0)}`)));
  b.appendChild(sec(`エンディング ${settings.endings.length}/5`, h('p', { class: 'note' }, ENDING_ORDER.map(k => settings.endings.includes(k) ? `【${ENDINGS[k].type}】${ENDINGS[k].title}` : '？？？？').join('\n')), ));
  b.lastChild.querySelector('.note').style.whiteSpace = 'pre-wrap';
}
function renderSettings(b, L, fromTitle) {
  const tg = (key, label, sub) => h('div', { class: 'set-row' }, h('div', { class: 'lbl', html: label + (sub ? `<small>${sub}</small>` : '') }),
    btn(settings[key] ? 'ON' : 'OFF', () => { settings[key] = !settings[key]; saveSettings(); applySettings(); UI.refresh(L); }, { key: 'set-' + key, cls: settings[key] ? 'gold' : '' }));
  b.appendChild(sec('コントローラー', tg('swapAB', 'A/Bボタンの入れ替え', '決定とキャンセルを入れ替えます（Switch配置など）'), tg('swapXY', 'X/Yボタンの入れ替え', 'メニューと食事を入れ替えます')));
  const sizes = [0.85, 1, 1.2], sizeName = ['小', '中', '大'], si = Math.max(0, sizes.indexOf(settings.touchSize));
  b.appendChild(sec('サウンド・画面', tg('se', '効果音'),
    stepper('vol', '音量', String(settings.vol), () => { settings.vol = clamp(settings.vol - 1, 0, 10); saveSettings(); applySettings(); sfx('ui'); UI.refresh(L); }, () => { settings.vol = clamp(settings.vol + 1, 0, 10); saveSettings(); applySettings(); sfx('ui'); UI.refresh(L); }),
    stepper('tsize', 'タッチボタンの大きさ', sizeName[si], () => { settings.touchSize = sizes[Math.max(0, si - 1)]; saveSettings(); applySettings(); UI.refresh(L); }, () => { settings.touchSize = sizes[Math.min(2, si + 1)]; saveSettings(); applySettings(); UI.refresh(L); }),
    tg('shake', '画面のゆれ')));
  b.appendChild(sec('操作方法', h('div', { class: 'keys', html:
    '<b>キーボード</b>：移動 WASD/矢印　ダッシュ Shift　調べる・採集・攻撃 Space（木や岩は長押し）　メニュー E　食事 F　ポーズ Esc<br>' +
    '　持ち物 B　クラフト C　地図 M　アイテムバー 1〜8／マウスホイール　落とす Q（Ctrl+Qで全部）　メニュー内タブ切替 Q/E<br>' +
    '　設置：マウスで置き場所を選んでクリック（右クリックでやめる）<br>' +
    '<b>コントローラー</b>：移動 左スティック/十字キー　A 調べる　B 戻る（押したまま移動でダッシュ）　X メニュー　Y 食事　LB/RB アイテムバー（メニュー内はタブ切替）　START メニュー<br>' +
    '<b>スマホ</b>：左下スティックで移動、右下のA/B/X/Yボタン（Bを押したまま移動でダッシュ）。アイテムバーはタップで選択、設置は置きたいマスをタップ。コントローラー接続中はタッチボタンを隠します。' })));
  if (fromTitle) {
    b.appendChild(sec('データ', h('p', { class: 'note' }, 'セーブデータの削除は、タイトルの「つづきから」で各スロットごとに行えます。')));
  } else {
    b.appendChild(sec('データ', h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
      btn(`スロット${curSlot}にセーブ`, () => saveGame(false), { key: 'save', cls: 'primary' }),
      btn('セーブしてタイトルへ', () => { saveGame(true); showTitle(); }, { key: 'totitle' })),
      h('p', { class: 'note' }, '※ 朝・売買・クラフト時などに自動でセーブされます。')));
  }
}
/* デバッグ（メニューで ↑↑↓↓←→←→BA） */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
// キーボードの ↑ ↑ ↓ ↓ ← → ← → B A だけを受け付ける（コントローラー・WASD・K/Spaceなどでは開かない）。
// メインメニューを開いている間だけ判定し、最後の B・A は持ち物ショートカット／左移動として扱わない。
function konamiKey(e) {
  const top = UI.top();
  if (!top || !top.mainMenu) { state.konami = 0; return false; }
  if (e.repeat || ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(e.code)) return false;
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) { state.konami = 0; return false; }
  if (e.code === KONAMI[state.konami]) {
    state.konami++;
    if (state.konami >= KONAMI.length) { state.konami = 0; state.konamiGo = true; }
    return e.code === 'KeyB' || e.code === 'KeyA';   // B・Aは「持ち物」「左移動」として働かせない
  }
  state.konami = e.code === KONAMI[0] ? 1 : 0;      // 順番を間違えたら最初から（↑から始め直しはOK）
  return false;
}
function konamiActivate(L) {
  if (!settings.debug) { settings.debug = true; saveSettings(); sfx('unlock'); toast('デバッグメニューを表示しました（設定の右）', 'good'); }
  L.tab = 'debug'; L.focusKey = 'tab-debug';
}
function hourToTime(hr) { return hr >= 6 && hr < 20 ? (hr - 6) / 14 * CONFIG.dayPart : CONFIG.dayPart + ((hr - 20 + 24) % 24) / 10 * (CONFIG.dayLength - CONFIG.dayPart); }
function renderDebug(b, L) {
  const g = game, ok = msg => { toast('[DEBUG] ' + msg, 'good'); UI.refresh(L); };
  const row = (...bs) => h('div', { class: 'dbg-row' }, ...bs);
  b.appendChild(h('p', { class: 'note warn' }, '開発用の機能です。セーブデータの内容が変わります。'));
  b.appendChild(sec('お金・借金', row(
    btn('+$1,000', () => { g.money += 1000; ok('所持金+$1,000'); }, { key: 'd-m1' }),
    btn('+$10,000', () => { g.money += 10000; ok('所持金+$10,000'); }, { key: 'd-m2' }),
    btn('借金-$1,000', () => { const a = Math.min(1000, g.debt); g.debt -= a; g.repaid += a; checkMilestones(); ok('借金-$1,000'); }, { key: 'd-d1' }),
    btn('借金を完済', () => { g.repaid += Math.max(0, g.debt); g.debt = 0; checkMilestones(); ok('完済しました'); }, { key: 'd-d2' }))));
  b.appendChild(sec('持ち物', row(
    btn('素材を各10個', () => { for (const k of ['stone', 'branch', 'fiber', 'wood', 'plank', 'rope', 'metal', 'ingot', 'ironore', 'goldore', 'cloth', 'coconut', 'grilled']) addItem(k, 10, true); ok('素材を追加'); }, { key: 'd-i1' }),
    btn('全部の道具', () => { for (const k in TOOLS) g.tools[k] = TOOLS[k].dur || 1; ok('道具と武器を追加'); }, { key: 'd-i2' }),
    btn('全部の設計図', () => { for (const k of ['bag', 'magnet', 'cart', 'furnace', 'iron', 'benchUp', 'raft']) g.bp[k] = true; ok('設計図を追加'); }, { key: 'd-i3' }),
    btn('全部の強化', () => { for (const k in UP_NAMES) g.up[k] = true; ok('強化を追加'); }, { key: 'd-i4' }))));
  b.appendChild(sec('状態・時間', row(
    btn('全回復', () => { g.hp = g.hunger = g.thirst = g.stamina = 100; g.sick = 0; g.exhaust = false; ok('全回復'); }, { key: 'd-s1' }),
    btn(state.god ? '無敵：ON' : '無敵：OFF', () => { state.god = !state.god; ok('無敵 ' + (state.god ? 'ON' : 'OFF')); }, { key: 'd-s2', cls: state.god ? 'gold' : '' }),
    btn('17時にする', () => { g.time = hourToTime(17); ok('17時'); }, { key: 'd-t1' }),
    btn('22時にする', () => { g.time = hourToTime(22); ok('22時'); }, { key: 'd-t2' }),
    btn('翌朝にする', () => { UI.closeAll(); newDay('sleep'); }, { key: 'd-t3' }))));
  b.appendChild(sec('天気（今日だけ変更）', row(...Object.keys(WEATHER).map(k => btn(WEATHER[k].n, () => { g.weather = k; g.rainAcc = 0; ok('天気：' + WEATHER[k].n); }, { key: 'd-w' + k, cls: g.weather === k ? 'gold' : '' })))));
  const spawnNear = t => { const d = MOBS[t]; for (let a = 0; a < 20; a++) { const x = player.x + rnd(-48, 48), y = player.y + rnd(-48, 48); if (Math.hypot(x - player.x, y - player.y) > 24 && !mobBlocked(curMap(), d, x, y)) { spawnMob(t, x, y); return true; } } return false; };
  b.appendChild(sec('生き物・敵', row(...Object.keys(MOBS).map(t => btn(MOBS[t].n + 'を出す', () => { UI.closeAll(); if (!spawnNear(t)) toast('出せる場所がない', 'bad'); }, { key: 'd-m' + t })),
    btn(state.noMobs ? '自然に出る：OFF' : '自然に出る：ON', () => { state.noMobs = !state.noMobs; ok('モブの出現 ' + (state.noMobs ? 'OFF' : 'ON')); }, { key: 'd-mn', cls: state.noMobs ? '' : 'gold' }),
    btn('全部消す', () => { state.mobs = []; ok('モブを全部消した'); }, { key: 'd-mc', cls: 'danger' }))));
  b.appendChild(sec('カジノ', row(
    btn('カジノ船の前へ', () => { const o = maps.island.objs.find(x => x.t === 'liner'); if (!o) return; UI.closeAll(); if (game.map !== 'island') { state.mobs = []; game.map = 'island'; } player.x = o.x * 16 + 24; player.y = (o.y + 1) * 16 + 12; player.dir = 1; }, { key: 'd-c1' }),
    btn('発電機を直す', () => { g.flags.linerSeen = 1; g.casino.open = true; ok('カジノを開けた'); }, { key: 'd-c2' }),
    btn('ゼニ丸の勝負をリセット', () => { g.flags.zeniDay = 0; ok('今日の勝負をリセット'); }, { key: 'd-c3' }))));
  b.appendChild(sec('移動', row(
    btn('スタート地点へ', () => { UI.closeAll(); const sp = maps.island.lm.spawn; game.map = 'island'; player.x = sp.x * 16 + 8; player.y = sp.y * 16 + 12; state.rocks = []; }, { key: 'd-w1' }),
    btn('洞窟に入る', () => { UI.closeAll(); if (game.map !== 'cave') enterCave(); }, { key: 'd-w2' }))));
  b.appendChild(sec('エンディング', row(
    ...ENDING_ORDER.map(k => btn(k + ' を見る', () => { UI.closeAll(); endGame(k); }, { key: 'd-e' + k })),
    btn('記録を全部解放', () => { settings.endings = ENDING_ORDER.slice(); saveSettings(); ok('エンディング記録を全解放'); }, { key: 'd-e1' }),
    btn('記録をリセット', () => { settings.endings = []; saveSettings(); ok('エンディング記録をリセット'); }, { key: 'd-e2', cls: 'danger' }))));
  b.appendChild(sec('表示', row(btn('デバッグタブを隠す', () => { settings.debug = false; saveSettings(); L.tab = 'set'; L.focusKey = 'tab-set'; UI.refresh(L); }, { key: 'd-h' }))));
}
function openSettingsLayer() { UI.open({ render: (el, L) => el.appendChild(windowEl(L, { title: '設定', body: b => renderSettings(b, L, true) })) }); }

/* 作業台・焚き火・炉 */
const findProc = (st, id) => PROCESS[st].find(r => r.id === id);
const procTime = (st, rec) => rec.t * (st === 'bench' && game.up.benchUp ? 0.5 : 1);
function openStation(o) {
  const st = OBJ[o.t].st; collectOutput(o);
  UI.open({ tab: st === 'bench' ? 'craft' : 'proc', onClose: () => saveGame(true), render: (el, L) => {
    el.appendChild(windowEl(L, {
      title: STATION_NAMES[st] + (st === 'bench' && game.up.benchUp ? '（強化済み）' : ''), sub: statusSub(),
      tabs: st === 'bench' ? [{ id: 'craft', label: 'クラフト' }, { id: 'proc', label: '加工' }] : null,
      body: b => { if (L.tab === 'craft') renderCraft(b, L, true); else renderProcess(b, L, o, st); },
    }));
  } });
}
function renderProcess(b, L, o, st) {
  if (st === 'fire') b.appendChild(h('p', { class: 'note' }, '焚き火の近くにいると、夜でも体が冷えません。'));
  const out = o.out && Object.keys(o.out).filter(k => o.out[k] > 0);
  if (out && out.length) b.appendChild(sec('できあがり', h('div', { class: 'row-item' }, h('div', { class: 'grow' }, ...out.map(k => h('span', { style: 'margin-right:10px' }, icon(k, true), ` ${ITEMS[k].n}×${o.out[k]}`))),
    btn('受け取る', () => { collectOutput(o); UI.refresh(L); }, { key: 'collect', cls: 'primary' }))));
  if (o.q && o.q.length) {
    const job = o.q[0], rec = findProc(st, job.id), tt = procTime(st, rec), pr = clamp(1 - job.left / tt, 0, 1);
    b.appendChild(sec('加工中（メニューを閉じると進みます）', h('div', { class: 'row-item' }, icon(rec.out), h('div', { class: 'grow' }, h('div', { class: 'name' }, `${ITEMS[rec.out].n}　残り${o.q.length}個`), h('div', { class: 'qbar' }, h('i', { style: `width:${Math.round(pr * 100)}%` }))),
      btn('キャンセル', () => { cancelQueue(o, st); UI.refresh(L); }, { key: 'cancelq', cls: 'danger' }))));
  }
  b.appendChild(sec('加工する', ...PROCESS[st].map(rec => {
    const maxN = Math.min(...Object.keys(rec.in).map(k => Math.floor((game.inv[k] || 0) / rec.in[k])));
    const outV = ITEMS[rec.out].p * (rec.n || 1), inV = Object.keys(rec.in).reduce((s, k) => s + ITEMS[k].p * rec.in[k], 0);
    return h('div', { class: 'row-item' }, icon(rec.out), h('div', { class: 'grow' },
      h('div', { class: 'name' }, `${ITEMS[rec.out].n}${rec.n > 1 ? '×' + rec.n : ''}`),
      h('div', { class: 'desc' }, `1個 ${procTime(st, rec)}秒　基本価値 ${fmt$(inV)} → ${fmt$(outV)}`), costEls(rec.in)),
      h('div', { class: 'btns' },
        btn('+1', () => { enqueue(o, st, rec, 1); UI.refresh(L); }, { key: 'q1-' + rec.id, disabled: maxN < 1, why: '素材が足りません', silent: true }),
        btn('+5', () => { enqueue(o, st, rec, 5); UI.refresh(L); }, { key: 'q5-' + rec.id, disabled: maxN < 1, why: '素材が足りません', silent: true }),
        btn('最大', () => { enqueue(o, st, rec, 999); UI.refresh(L); }, { key: 'qm-' + rec.id, cls: maxN > 0 ? 'primary' : '', disabled: maxN < 1, why: '素材が足りません', silent: true })));
  })));
}
function enqueue(o, st, rec, n) {
  const maxN = Math.min(...Object.keys(rec.in).map(k => Math.floor((game.inv[k] || 0) / rec.in[k])));
  o.q = o.q || []; n = Math.min(n, maxN, CONFIG.queueMax - o.q.length);
  if (n <= 0) { sfx('error'); toast(o.q.length >= CONFIG.queueMax ? '予約がいっぱいです' : '素材が足りません', 'bad'); return; }
  for (const k in rec.in) takeItem(k, rec.in[k] * n);
  for (let i = 0; i < n; i++) o.q.push({ id: rec.id, left: procTime(st, rec) });
  sfx('craft'); toast(`${ITEMS[rec.out].n}の加工を${n}個予約した`, 'good');
}
function cancelQueue(o, st) {
  if (!o.q) return;
  for (const job of o.q) { const rec = findProc(st, job.id); for (const k in rec.in) addItem(k, rec.in[k], true); }
  o.q = []; toast('加工をキャンセルして素材を戻した');
}
function collectOutput(o) {
  if (!o.out) return; const got = [];
  for (const k of Object.keys(o.out)) { const n = addItem(k, o.out[k]); if (n > 0) { o.out[k] -= n; got.push(`${ITEMS[k].n}×${n}`); } if (o.out[k] <= 0) delete o.out[k]; }
  if (got.length) { sfx('pick'); toast('受け取った：' + got.join('、'), 'good'); }
  if (Object.keys(o.out).length) toast('持ち物がいっぱいで受け取れない分があります', 'bad');
}

/* 回収ボックス（ショップ） */
function openShop() {
  UI.open({ tab: 'sell', onClose: () => saveGame(true), render: (el, L) => {
    const ev = game.market.ev;
    const sub = statusSub(ev ? h('span', null, '本日の特需 ', h('b', { class: 'ok' }, ITEMS[ev.up].n + '×1.5'), '　値崩れ ', h('b', { class: 'ng' }, ITEMS[ev.dn].n + '×0.6')) : null);
    el.appendChild(windowEl(L, {
      title: '回収ボックス（ゼニ丸）', sub, tabs: [{ id: 'sell', label: '売る' }, { id: 'repay', label: '返済' }, { id: 'buy', label: '購入' }, { id: 'bet', label: '勝負' }],
      body: b => ({ sell: renderSell, repay: renderRepay, buy: renderBuy, bet: renderZeniBet })[L.tab](b, L),
    }));
  } });
}
function renderSell(b, L) {
  const ids = sortItems(Object.keys(game.inv).filter(k => game.inv[k] > 0 && ITEMS[k] && !ITEMS[k].key));
  if (!ids.length) { b.appendChild(h('p', { class: 'note' }, '売れる物を持っていません。')); return; }
  b.appendChild(h('p', { class: 'note', style: 'margin-bottom:8px' }, '同じ物を売り続けると値下がりします（時間で回復）。'));
  for (const id of ids) {
    const it = ITEMS[id], n = game.inv[id], m = game.market.m[id] != null ? game.market.m[id] : 1, ev = game.market.ev;
    const tags = [];
    if (ev && ev.up === id) tags.push(h('span', { class: 'tag trend-up' }, '特需'));
    if (ev && ev.dn === id) tags.push(h('span', { class: 'tag trend-dn' }, '値崩れ'));
    if (m < 0.95) tags.push(h('span', { class: 'trend-dn' }, ` ↓${Math.round((1 - m) * 100)}%`));
    b.appendChild(h('div', { class: 'row-item' }, icon(id), h('div', { class: 'grow' }, h('div', { class: 'name' }, `${it.n} ×${n}`, ...tags), h('div', { class: 'desc' }, '1個 ', h('span', { class: 'price' }, fmt$(price(id))), `（基本 ${fmt$(it.p)}）`)),
      h('div', { class: 'btns' }, btn(`1個 ${fmt$(price(id))}`, () => { sellItem(id, 1); UI.refresh(L); }, { key: 'sell1-' + id, silent: true }),
        btn(`全部 ${fmt$(sellEstimate(id, n))}`, () => { sellItem(id, n); UI.refresh(L); }, { key: 'sella-' + id, cls: 'gold', silent: true }))));
  }
}
function renderRepay(b, L) {
  if (game.debt <= 0) { b.appendChild(h('p', { class: 'note ok', style: 'font-size:16px' }, '借金は完済済みです！ いかだを作って島を脱出しよう。')); return; }
  const max = Math.min(game.money, game.debt);
  if (L.amt == null || L.amt > max) L.amt = max;
  const set = v => { L.amt = clamp(v, 0, max); UI.refresh(L); };
  b.appendChild(h('div', { class: 'set-row' }, h('div', { class: 'lbl' }, '返済額', h('small', null, `所持金 ${fmt$(game.money)}／借金 ${fmt$(game.debt)}`)), h('div', { class: 'val price', style: 'font-size:22px' }, fmt$(L.amt))));
  b.appendChild(h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:10px' },
    btn('-1000', () => set(L.amt - 1000), { key: 'm1000' }), btn('-100', () => set(L.amt - 100), { key: 'm100' }),
    btn('+100', () => set(L.amt + 100), { key: 'p100' }), btn('+1000', () => set(L.amt + 1000), { key: 'p1000' }), btn('最大', () => set(max), { key: 'pmax', cls: 'gold' })));
  b.appendChild(h('p', { class: 'note', style: 'text-align:center;margin-bottom:10px' }, `返済後の借金：${fmt$(game.debt - L.amt)}　／　明朝の利息（見込み）：${fmt$(Math.ceil((game.debt - L.amt) * game.contract.rate / 100))}`));
  b.appendChild(h('div', { style: 'display:flex;justify-content:center' }, btn('返済する', () => { repay(L.amt); L.amt = null; UI.refresh(L); }, { key: 'dorepay', cls: 'primary', disabled: L.amt <= 0, why: '返済額を選んでください', silent: true })));
  const r = repaidRatio(), next = r < 0.25 ? 25 : r < 0.5 ? 50 : null;
  b.appendChild(h('p', { class: 'note', style: 'margin-top:12px' }, `返済率 ${Math.floor(r * 100)}%` + (next ? `　→ ${next}%で新しい設計図が解禁` : '')));
}
function renderBuy(b, L) {
  const r = repaidRatio();
  for (const s of SHOP) {
    const locked = r < s.req, owned = s.bp && game.bp[s.bp], can = !locked && !owned && game.money >= s.p;
    const label = owned ? '購入済み' : locked ? `返済${Math.round(s.req * 100)}%で解禁` : `${fmt$(s.p)}`;
    b.appendChild(h('div', { class: 'row-item' + (locked ? ' locked' : '') }, icon(s.item || 'bp'), h('div', { class: 'grow' }, h('div', { class: 'name' }, s.n), h('div', { class: 'desc' }, s.d)),
      h('div', { class: 'btns' }, btn(label, () => { buy(s); UI.refresh(L); }, { key: 'buy-' + s.id, cls: can ? 'gold' : '', disabled: !can, why: owned ? 'すでに持っています' : locked ? 'まだ解禁されていません' : 'お金が足りません', silent: true }))));
  }
}

/* いかだ */
const voyageFood = () => VOYAGE_FOOD.reduce((s, k) => s + (game.inv[k] || 0), 0);
function openRaft() {
  if (!game.bp.raft) { queueTalk(TALK.raftNoBp.concat(game.flags.diary1 ? [] : TALK.paidHint)); return; }
  UI.open({ render: (el, L) => el.appendChild(windowEl(L, { title: 'いかだ置き場', cls: 'small', body: b => {
    if (!game.raftBuilt) {
      b.appendChild(h('p', { class: 'note', style: 'color:var(--text);margin-bottom:8px' }, 'ゲンの設計図どおりに、いかだを組み立てよう。'));
      b.appendChild(h('div', { class: 'row-item' }, icon('raft'), h('div', { class: 'grow' }, h('div', { class: 'name' }, 'いかだ'), costEls(RAFT_COST)),
        h('div', { class: 'btns' }, btn('組み立てる', () => { buildRaft(); UI.close(L); }, { key: 'build', cls: hasAll(RAFT_COST) ? 'primary' : '', disabled: !hasAll(RAFT_COST), why: '素材が足りません' }))));
    } else {
      const f = voyageFood();
      b.appendChild(h('p', { class: 'note', style: 'color:var(--text)' }, '出航の準備'));
      b.appendChild(h('p', { class: game.debt > 0 ? 'note ng' : 'note ok' }, game.debt > 0 ? `借金が ${fmt$(game.debt)} 残っている` : '借金は完済済み'));
      b.appendChild(h('p', { class: f >= 3 ? 'note ok' : 'note ng' }, `航海用の食料（ココナッツ・焼き魚・缶詰）${f}/3`));
      b.appendChild(h('div', { style: 'display:flex;justify-content:center;margin-top:10px' }, btn('出航する', () => depart(), { key: 'depart', cls: f >= 3 ? 'primary' : '', disabled: f < 3, why: '食料が3個必要です' })));
    }
  } })) });
}

/* タイトル・はじめから・プロローグ・エンディング */
let titleMap = null;
function showTitle() {
  state.scene = 'title'; UI.closeAll(); Dialog.active = false; $('dialog').classList.add('hidden');
  $('hud').classList.add('hidden'); $('hint').classList.add('hidden'); updateTouchVisibility();
  if (!titleMap) { const d = genIsland(); titleMap = buildMap('island', d, d.objs); }
  UI.open({ cls: 'screen', onBack: () => {}, render: el => {
    const can = hasSave(), nEnd = settings.endings.length;
    el.appendChild(h('div', { class: 'title-wrap' },
      h('div', { class: 'logo' }, h('small', null, 'SURVIVAL × DEBT'), '無人島', h('br'), 'サバイバル債務録'),
      h('div', { class: 'title-sub' }, '島の物はすべて換金できる。売るか、投資するか。'),
      h('div', { class: 'title-menu' },
        btn('つづきから', () => openSlots('load'), { key: 'cont', cls: can ? 'primary' : '', disabled: !can, why: 'セーブデータがありません' }),
        btn('はじめから', () => openSlots('new'), { key: 'new', cls: can ? '' : 'primary' }),
        btn(`エンディング（${nEnd}/5）`, () => openEndings(), { key: 'end', disabled: !nEnd, why: 'まだエンディングを見ていません' }),
        btn('設定', () => openSettingsLayer(), { key: 'set' })),
      h('div', { class: 'title-foot' }, 'ver 2.0')));
  } });
}
function fmtDate(t) { if (!t) return ''; const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; }
// セーブスロット（kind: load=つづきから / new=はじめから）
function openSlots(kind) {
  UI.open({ onClose: () => { const t = UI.top(); if (t && state.scene === 'title') UI.refresh(t); }, render: (el, L) => el.appendChild(windowEl(L, {
    title: kind === 'load' ? 'つづきから' : 'はじめから：スロットを選ぶ', cls: 'small',
    body: b => {
      for (let n = 1; n <= CONFIG.slots; n++) {
        const inf = slotInfo(n);
        const info = inf
          ? h('div', { class: 'grow' }, h('div', { class: 'name' }, `${inf.name}　${inf.day}日目`),
            h('div', { class: 'desc' }, `${inf.mode === 'hard' ? 'ハード' : 'ノーマル'}／借金 ${fmt$(inf.debt)}${inf.debt <= 0 ? '（完済）' : ''}`), inf.savedAt ? h('div', { class: 'desc' }, '保存 ' + fmtDate(inf.savedAt)) : null)
          : h('div', { class: 'grow' }, h('div', { class: 'name', style: 'color:var(--muted)' }, 'データなし'));
        const act = kind === 'load'
          ? btn('ロード', () => continueGame(n), { key: 'sl' + n, cls: inf ? 'primary' : '', disabled: !inf, why: 'このスロットにはデータがありません' })
          : btn(inf ? '上書き' : 'ここで始める', () => { if (inf) confirmBox(`スロット${n}のデータは消えて、新しいゲームになります。\nよろしいですか？`, () => openNewGame(n), { yes: '上書きする', danger: true }); else openNewGame(n); }, { key: 'sl' + n, cls: inf ? 'danger' : 'primary' });
        const del = inf && kind === 'load' ? btn('削除', () => confirmBox(`スロット${n}のデータを削除します。\n元に戻せません。よろしいですか？`, () => { deleteSave(n); toast(`スロット${n}を削除しました`); UI.refresh(L); }, { yes: '削除する', danger: true }), { key: 'del' + n, cls: 'small danger' }) : null;
        b.appendChild(h('div', { class: 'row-item slot-row' }, h('div', { class: 'slot-no' }, String(n)), info, h('div', { class: 'btns' }, act, del)));
      }
    },
    foot: [btn('もどる', () => UI.close(L), { key: 'back' })],
  })) });
}
// 見たエンディングを読み返す
function openEndings() {
  UI.open({ render: (el, L) => el.appendChild(windowEl(L, {
    title: `エンディング ${settings.endings.length}/5`, cls: 'small',
    body: b => {
      for (const k of ENDING_ORDER) {
        const seen = settings.endings.includes(k), E = ENDINGS[k];
        b.appendChild(h('div', { class: 'row-item' + (seen ? '' : ' locked') }, h('div', { class: 'grow' }, h('div', { class: 'desc' }, seen ? E.type : '？？？'), h('div', { class: 'name' }, seen ? E.title : '？？？？')),
          h('div', { class: 'btns' }, btn('見る', () => showEndingText(k), { key: 'e' + k, cls: seen ? 'primary' : '', disabled: !seen, why: 'まだ見ていないエンディングです' }))));
      }
    },
    foot: [btn('もどる', () => UI.close(L), { key: 'back' })],
  })) });
}
function showEndingText(k) {
  const E = ENDINGS[k];
  UI.open({ cls: 'dark', render: (el, L) => {
    const e = h('div', { class: 'ending' }); let dl = 0;
    for (const t of E.lines) { e.appendChild(h('p', { style: `animation-delay:${dl}s` }, fmtText(t.replace(/\{days1\}日目の朝/g, '返済期限の翌朝')))); dl += 0.6; }
    e.appendChild(h('div', { style: `opacity:0;animation:fadeIn .8s ease-out ${dl}s forwards` }, h('div', { class: 'etype' }, E.type), h('div', { class: 'etitle' }, E.title),
      btn('もどる', () => UI.close(L), { key: 'back', cls: 'primary' })));
    el.appendChild(e);
  } });
}
function openNewGame(slot) {
  const o = { name: 'カイ', preset: 'normal', debt: 5000, days: 10, rate: 2, mode: 'normal' };
  const custom = settings.endings.length > 0;
  UI.open({ render: (el, L) => {
    el.appendChild(windowEl(L, { title: 'はじめから', body: b => {
      const inp = h('input', { class: 'name-input', type: 'text', maxlength: '8', value: o.name, autocomplete: 'off', spellcheck: 'false' });
      inp.addEventListener('input', () => { o.name = inp.value; });
      const nameWrap = h('div', { class: 'f', 'data-k': 'name' }, inp);
      nameWrap.addEventListener('click', () => inp.focus());
      b.appendChild(sec('主人公の名前', h('div', { class: 'set-row' }, h('div', { class: 'lbl' }, '名前', h('small', null, '8文字まで')), nameWrap)));
      b.appendChild(sec('難易度', h('div', { class: 'preset-row' }, ...PRESETS.map(p => btn(p.label, () => { Object.assign(o, { preset: p.id, debt: p.debt, days: p.days, rate: p.rate }); UI.refresh(L); }, { key: 'pre-' + p.id, cls: o.preset === p.id ? 'on' : '' })))));
      b.appendChild(sec('モード', h('div', { class: 'preset-row' },
        btn('ノーマル', () => { o.mode = 'normal'; UI.refresh(L); }, { key: 'mode-n', cls: o.mode === 'normal' ? 'on' : '' }),
        btn('ハード', () => { o.mode = 'hard'; UI.refresh(L); }, { key: 'mode-h', cls: o.mode === 'hard' ? 'on' : '' })),
        h('p', { class: 'note' + (o.mode === 'hard' ? ' warn' : '') }, o.mode === 'hard' ? 'ハード：体力が0になるとゲームオーバー。最後にセーブしたところからやり直せます。' : 'ノーマル：倒れても翌朝に浜辺で目覚めます。持ち物は倒れた場所に落とし、所持金を少し失います。')));
      const adj = (k, d) => { const [a, z, s] = LIMITS[k]; o[k] = Math.round(clamp(o[k] + d * s, a, z) * 10) / 10; o.preset = 'custom'; UI.refresh(L); };
      const playTime = h('p', { class: 'note' }, `想定プレイ時間：約${Math.round(o.days * CONFIG.dayLength / 60)}分（1日＝${CONFIG.dayLength / 60}分）。おすすめは「ふつう」です。`);
      if (custom) b.appendChild(sec('借金の契約（自由に変更できます）',
        stepper('debt', '借金額', fmt$(o.debt), () => adj('debt', -1), () => adj('debt', 1)),
        stepper('days', '返済期限', `${o.days}日`, () => adj('days', -1), () => adj('days', 1)),
        stepper('rate', '利息（1日あたり）', `${o.rate}%`, () => adj('rate', -1), () => adj('rate', 1)),
        playTime));
      else b.appendChild(sec('借金の契約',
        h('div', { class: 'set-row' }, h('div', { class: 'lbl' }, '借金額'), h('div', { class: 'val-fixed' }, fmt$(o.debt))),
        h('div', { class: 'set-row' }, h('div', { class: 'lbl' }, '返済期限'), h('div', { class: 'val-fixed' }, `${o.days}日`)),
        h('div', { class: 'set-row' }, h('div', { class: 'lbl' }, '利息（1日あたり）'), h('div', { class: 'val-fixed' }, `${o.rate}%`)),
        playTime, h('p', { class: 'note warn' }, 'どれかのエンディングを1回見ると、契約を自由に変更できるようになります。')));
    }, foot: [btn('もどる', () => UI.close(L), { key: 'back' }), btn('スタート', () => {
      let nm = (o.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 8); if (!nm) nm = 'カイ';
      game = newGameData({ name: nm, debt: o.debt, days: o.days, rate: o.rate, mode: o.mode }); curSlot = slot || 1;
      setupMaps(); player.x = game.px; player.y = game.py; player.dir = 0;
      respawn(maps.island, true); rollMarketEvent();
      UI.closeAll(); playPrologue();
    }, { key: 'start', cls: 'primary' })] }));
  } });
}
function playPrologue() {
  state.scene = 'story';
  const finish = () => { UI.closeAll(); startPlay(true); };
  UI.open({ cls: 'dark', onBack: finish, render: (el, L) => {
    L.i = L.i || 0;
    const d = h('div', { class: 'story f', 'data-k': 'story' }, h('p', null, fmtText(PROLOGUE[L.i])), h('div', { class: 'next' }, '▼'));
    d.addEventListener('click', () => { sfx('ui'); L.i++; if (L.i >= PROLOGUE.length) finish(); else UI.refresh(L); });
    el.appendChild(h('div', { style: 'display:flex;flex-direction:column;align-items:center' }, d, btn('スキップ ▶▶', finish, { key: 'skip', cls: 'small' })));
  } });
}
function continueGame(n) {
  if (!loadGame(n)) { toast('セーブデータを読み込めませんでした', 'bad'); return; }
  UI.closeAll(); startPlay(false);
}
function startPlay(isNew) {
  state.scene = 'play'; state.rocks = []; state.particles = []; state.floats = []; state.fishing = null; state.pendingTalks = []; state.gather = { o: null, prog: 0, hits: 0 }; state.warn = {};
  $('hud').classList.remove('hidden'); updateTouchVisibility(); Input.clearAll();
  state.place = null; document.body.classList.remove('placing'); state.konami = 0; state.mobs = []; state.mobT = 3; state.invuln = 0;
  if (isNew) {
    queueTalk(TALK.intro);
    const st = stagesOf(game.contract);
    if (st.length) queueTalk([['same', 'それと、返済には「締め日」がある。' + st.map(x => `${x.day}日目までに累計${fmt$(x.need)}`).join('、') + 'だ。'], ['same', '届かなけりゃ、遅延損害金を上乗せさせてもらうぜ。ハッハッハ！'], ['sys', '締め日はメニューの「記録」で確認できる。']]);
    saveGame(true);
  }
  else toast(`スロット${curSlot}：${game.day}日目から再開`);
}
function endGame(id) {
  const E = ENDINGS[id], g = game;
  state.scene = 'ending'; Dialog.active = false; $('dialog').classList.add('hidden'); UI.closeAll();
  $('hud').classList.add('hidden'); $('hint').classList.add('hidden'); updateTouchVisibility(); stopFishing();
  // クリアしてもセーブは消さない（最後にセーブした所から遊び直せる）
  if (!settings.endings.includes(id)) { settings.endings.push(id); saveSettings(); }
  const lines = E.lines.slice();
  if (id === 'C' && has('turtle')) lines.push('黄金の亀像は博物館に寄贈され、\n「漂流者の守り神」として今も人々を見守っている。');
  const good = id === 'B' || id === 'C' || id === 'E', ratio = g.day / g.contract.days;
  let score = id === 'C' ? 3 : good ? 2 : 0; if (good) score += ratio <= 0.6 ? 2 : ratio <= 0.8 ? 1 : 0;
  const rank = score >= 5 ? 'S' : score >= 4 ? 'A' : score >= 2 ? 'B' : 'C';
  sfx(good ? 'unlock' : 'hurt');
  UI.open({ cls: 'dark', onBack: () => {}, render: el => {
    const e = h('div', { class: 'ending' }); let dl = 0;
    for (const t of lines) { e.appendChild(h('p', { style: `animation-delay:${dl}s` }, fmtText(t))); dl += 1.2; }
    const tail = h('div', { style: `opacity:0;animation:fadeIn 1s ease-out ${dl}s forwards` },
      h('div', { class: 'etype' }, E.type), h('div', { class: 'etitle' }, E.title),
      h('div', { class: 'stats' }, `経過日数：${g.day}日 / ${g.contract.days}日`, h('br'), `総売上：${fmt$(g.stats.earned || 0)}`, h('br'), `支払った利息：${fmt$(g.interestPaid)}`, h('br'),
        `採集した数：${g.stats.gathered || 0}　クラフト：${g.stats.crafted || 0}`, h('br'), `ギャンブル収支：${fmtNet(g.stats.gamble || 0)}`, h('br'), `残った借金：${fmt$(Math.max(0, g.debt))}`),
      h('div', null, 'RANK'), h('div', { class: 'rank' }, rank),
      h('div', { style: 'margin-top:14px' }, btn('タイトルへ', () => showTitle(), { key: 'title', cls: 'primary' })));
    e.appendChild(tail); el.appendChild(e);
    setTimeout(() => { if (e.isConnected) e.scrollTo({ top: e.scrollHeight, behavior: 'smooth' }); }, (dl + 1.1) * 1000);
  } });
}

/* ---------- 19. ゲームの処理 ---------- */
function hourOf(t) { return t < CONFIG.dayPart ? 6 + t * (14 / CONFIG.dayPart) : 20 + (t - CONFIG.dayPart) * (10 / (CONFIG.dayLength - CONFIG.dayPart)); }
function clockText(t) { const h = hourOf(t) % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10; return `${hh}:${String(mm).padStart(2, '0')}`; }
function darkness(h) {
  h = h % 24;
  if (h >= 7 && h < 17.5) return 0;
  if (h >= 17.5 && h < 20) return (h - 17.5) / 2.5 * 0.82;
  if (h >= 20 || h < 5) return 0.82;
  return 0.82 * (1 - (h - 5) / 2);
}
const duskAmt = h => clamp(1 - Math.abs((h % 24) - 18.2) / 1.6, 0, 1);
const isNight = () => darkness(hourOf(game.time)) > 0.5;

function rectBlocked(x, y) {
  const m = curMap(), l = x - 5, r = x + 5, t = y - 5, b = y;
  for (let ty = Math.floor(t / 16); ty <= Math.floor((b - 0.01) / 16); ty++) for (let tx = Math.floor(l / 16); tx <= Math.floor((r - 0.01) / 16); tx++) if (isBlocked(m, tx, ty)) return true;
  return false;
}
function tryMove(dx, dy) {
  if (dx) { const nx = player.x + dx; if (!rectBlocked(nx, player.y)) player.x = nx; else if (!dy) { for (const s of [3, -3, 6, -6]) if (!rectBlocked(player.x, player.y + s) && !rectBlocked(nx, player.y + s)) { player.y += Math.sign(s) * Math.min(Math.abs(dx), 1.5); break; } } }
  if (dy) { const ny = player.y + dy; if (!rectBlocked(player.x, ny)) player.y = ny; else if (!dx) { for (const s of [3, -3, 6, -6]) if (!rectBlocked(player.x + s, player.y) && !rectBlocked(player.x + s, ny)) { player.x += Math.sign(s) * Math.min(Math.abs(dy), 1.5); break; } } }
}

function findTarget() {
  const m = curMap(), [vx, vy] = DIRV[player.dir];
  const fx = player.x + vx * 11, fy = player.y - 4 + vy * 11, ftx = Math.floor(fx / 16), fty = Math.floor(fy / 16);
  const ptx = Math.floor(player.x / 16), pty = Math.floor((player.y - 3) / 16);
  const usable = o => o && (OBJ[o.t].g || OBJ[o.t].it || OBJ[o.t].regrowInfo);
  let o = objAt(m, ftx, fty); if (usable(o)) return { kind: 'obj', o };
  o = objAt(m, ptx, pty); if (usable(o) && !OBJ[o.t].block) return { kind: 'obj', o };
  const v = tileAt(m, ftx, fty);
  if (v === T.SPRING) return { kind: 'spring' };
  if (isWater(v) && game.map === 'island') return { kind: 'water', tx: ftx, ty: fty };
  // 近くの拾える物（タッチ操作の補助）
  let best = null, bd = 15;
  for (let ty = pty - 1; ty <= pty + 1; ty++) for (let tx = ptx - 1; tx <= ptx + 1; tx++) {
    const c = objAt(m, tx, ty); if (!usable(c) || OBJ[c.t].block) continue;
    const d = Math.hypot(c.x * 16 + 8 - fx, c.y * 16 + 10 - fy); if (d < bd) { bd = d; best = c; }
  }
  return best ? { kind: 'obj', o: best } : null;
}
function targetHint(tg) {
  if (!tg) return null;
  if (tg.kind === 'mob') { const wk = bestTool('sword'); return { act: `${MOBS[tg.m.type].n}を攻撃`, sub: wk ? TOOLS[wk].n : '素手' }; }
  if (tg.kind === 'spring') return has('bowl') ? { act: '泉の水を汲む', sub: `木の器×${game.inv.bowl}` } : { act: null, info: '泉：木の器があれば水を汲める（クラフトで作れる）' };
  if (tg.kind === 'water') return !game.tools.rod ? null : game.weather === 'storm' ? { act: null, info: '嵐で海が荒れていて、釣りができない' } : { act: '釣りをする' };
  const o = tg.o, d = OBJ[o.t];
  if (d.it === 'drop') { const nm = `${ITEMS[o.id].n}×${o.n}`; return o.lock > 0 ? { act: null, info: `${nm}（あと${Math.ceil(o.lock)}秒で拾える）` } : { act: `${nm}を拾う`, sub: game.up.magnet ? '長押しで連続' : null }; }
  if (d.regrowInfo) { const n = Math.max(1, (o.r || game.day + 1) - game.day); return { act: null, info: `${d.n}（${n}日後に回復）` }; }
  if (d.g) {
    const g = d.g;
    if (g.special === 'palm' && !(o.n > 0)) return { act: null, info: 'ヤシの実はまだない（毎日実る）' };
    if (g.special === 'bush' && !(o.n > 0)) return { act: null, info: 'ベリーはまだない（明日また実る）' };
    const lv = g.cat ? toolLv(g.cat) : 0;
    if (g.need && lv < g.need) return { act: g.act, ng: g.need >= 2 ? '鉄のつるはしが必要' : 'つるはしが必要' };
    const tool = g.cat ? bestTool(g.cat) : null;
    return { act: g.act, sub: tool ? TOOLS[tool].n : g.instant && game.up.magnet ? '長押しで連続' : null, gather: !g.instant };
  }
  if (d.it === 'station') { const q = o.q && o.q.length, out = o.out && Object.keys(o.out).length; return { act: d.act, sub: out ? 'できあがり！' : q ? `加工中 残り${q}` : null }; }
  if (d.it === 'raft') return { act: game.raftBuilt ? 'いかだに乗る' : 'いかだを作る' };
  if (d.it === 'bed') return { act: '眠る', sub: isNight() || hourOf(game.time) >= 17 ? null : '夕方から眠れる' };
  return { act: d.act };
}

function gameUpdate(dt) {
  const g = game, inCave = g.map === 'cave';
  // 時間
  g.time += dt;
  if (g.time >= CONFIG.dayLength) { g.time = 0; newDay('natural'); if (state.scene !== 'play') return; }
  const hr = hourOf(g.time), dk = darkness(hr);
  if (!g.flags.firstNight && dk > 0.4 && !inCave) { g.flags.firstNight = 1; queueTalk(TALK.firstNight); }
  // 生存（天気・健康状態）
  const mul = inCave ? 1.2 : 1, nf = !inCave && nearFire();
  const raining = !inCave && (g.weather === 'rain' || g.weather === 'storm');
  const hot = !inCave && g.weather === 'sun' && hr >= 11 && hr < 15;
  const shel = !inCave && nearHut();
  const wet = raining && !nf && !shel;
  g.sick = Math.max(0, (g.sick || 0) - dt);
  g.hunger = Math.max(0, g.hunger - 0.385 * dt * mul * (g.sick > 0 ? 1.5 : 1)); g.thirst = Math.max(0, g.thirst - 0.5 * dt * mul * (hot ? 1.35 : 1));
  let hpd = 0; if (g.hunger <= 0) hpd -= 0.6; if (g.thirst <= 0) hpd -= 0.6;
  const cold = !inCave && dk > 0.5 && !nf && !shel;
  if (cold) hpd -= wet ? 0.3 : 0.15;
  if (hpd === 0 && g.hunger > 40 && g.thirst > 40) hpd = 0.12;
  g.hp = clamp(g.hp + hpd * dt, 0, 100);
  if (state.god) { g.hp = 100; g.hunger = Math.max(g.hunger, 80); g.thirst = Math.max(g.thirst, 80); }
  survivalWarnings(cold);
  updateWeather(dt, inCave);
  state.conds = conditions(cold, wet, hot);
  if (g.hp <= 0) { faint(); return; }
  // 移動
  const weak = g.hunger < 20 || g.thirst < 20;
  let [mx, my] = Input.moveVec(); const ml = Math.hypot(mx, my);
  player.moving = false;
  if (ml > 0.12) {
    if (state.fishing) stopFishing('moved');
    player.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 3 : 2) : (my > 0 ? 0 : 1);
    if (g.stamina <= 0) g.exhaust = true;
    const dashing = (Input.down('DASH') || Input.down('B')) && !g.exhaust;
    const sp = 72 * (weak ? 0.8 : 1) * (g.hp < 25 ? 0.85 : 1) * (dashing ? 1.55 : 1);
    tryMove(mx * sp * dt, my * sp * dt); player.moving = true; player.anim += dt * 7 * Math.min(1, ml) * (dashing ? 1.4 : 1);
    if (dashing) { g.stamina = Math.max(0, g.stamina - 20 * dt); state.stIdle = 0; }
  }
  // スタミナの回復（少し休むと戻る）
  if (g.exhaust && g.stamina >= 25) g.exhaust = false;
  state.stIdle += dt;
  if (state.stIdle > 0.6) g.stamina = Math.min(100, g.stamina + 16 * dt * (wet ? 0.6 : 1) * (g.sick > 0 ? 0.5 : 1) * (weak ? 0.5 : 1));
  // 操作
  if (Input.press('X') || Input.press('START')) { openMainMenu(); return; }
  if (Input.press('INV')) { openMainMenu('inv'); return; }
  if (Input.press('CRAFT')) { openMainMenu('craft'); return; }
  if (Input.press('MAP')) { openMainMenu('map'); return; }
  for (let i = 1; i <= CONFIG.hotSize; i++) if (Input.press('H' + i)) hotSelect(i - 1);
  if (Input.press('LB')) hotSelect(g.hotSel - 1);
  if (Input.press('RB')) hotSelect(g.hotSel + 1);
  if (Input.press('DROPALL') || Input.press('DROP')) {
    const id = hotItem();
    if (!id) { sfx('error'); toast(`アイテムバー${g.hotSel + 1}番は空です`); }
    else if (ITEMS[id].key) { sfx('error'); toast('大切なものは捨てられない'); }
    else dropItem(id, Input.press('DROPALL') ? g.inv[id] : 1);
  }
  if (Input.press('Y')) useSelected();
  if (state.fishing) updateFishing(dt);
  else updateInteraction(dt);
  // 設備の加工
  for (const o of stations) if (o.q && o.q.length) {
    o.q[0].left -= dt;
    if (o.q[0].left <= 0) { const job = o.q.shift(), rec = findProc(OBJ[o.t].st, job.id); o.out = o.out || {}; o.out[rec.out] = (o.out[rec.out] || 0) + (rec.n || 1); }
  }
  // 生き物・敵
  state.invuln = Math.max(0, state.invuln - dt); state.swing = Math.max(0, state.swing - dt);
  updateMobs(dt);
  // 落とし物：拾えるまでの待ち時間
  for (const k in maps) for (const o of maps[k].objs) if (o.t === 'drop' && o.lock > 0) o.lock = Math.max(0, o.lock - dt);
  if (state.hotName > 0) state.hotName -= dt;
  // 相場の回復
  const rec = 1 - Math.exp(-dt * 0.0115);
  for (const k in g.market.m) { g.market.m[k] += (1 - g.market.m[k]) * rec; if (g.market.m[k] > 0.995) delete g.market.m[k]; }
  // 洞窟の落石
  if (inCave) {
    state.rockTimer -= dt;
    if (state.rockTimer <= 0) { state.rockTimer = rnd(12, 26); state.rocks.push({ x: player.x, y: player.y - 3, t: 1.2 }); sfx('warn'); }
  }
  for (let i = state.rocks.length - 1; i >= 0; i--) {
    const r = state.rocks[i]; r.t -= dt;
    if (r.t <= 0) {
      state.rocks.splice(i, 1); burst(r.x, r.y, P.stone, 8); sfx('thud');
      if (Math.hypot(player.x - r.x, player.y - 3 - r.y) < 11) { g.hp = Math.max(0, g.hp - 10); state.shake = 0.3; sfx('hurt'); toast('落石が当たった！ 体力-10', 'bad'); }
      const m = curMap(), tx = Math.floor(r.x / 16), ty = Math.floor(r.y / 16);
      if (g.map === 'cave' && !objAt(m, tx, ty) && tileAt(m, tx, ty) === T.CFLOOR && chance(0.5)) addObj(m, { t: 'pebble', x: tx, y: ty });
    }
  }
  if (g.flags.diary2 && !g.flags.objShown) g.flags.objShown = 1;
  // 返済状況のイベント
  checkMilestones();
  // オートセーブ
  state.autosave += dt; if (state.autosave > CONFIG.autosaveSec) { state.autosave = 0; saveGame(true); }
}
function nearFire() { const m = curMap(); for (const o of stations) if (o.t === 'campfire' && m.objs.includes(o) && Math.hypot(o.x * 16 + 8 - player.x, o.y * 16 + 10 - player.y) < 60) return true; return false; }
// 健康状態（HUDに表示）
function conditions(cold, wet, hot) {
  const g = game, c = [];
  if (g.hp < 25) c.push(['重傷', 'bad']);
  if (cold) c.push(['寒い', 'bad']);
  if (wet) c.push(['濡れ', 'bad']);
  if (hot) c.push(['暑い', 'warn']);
  if (g.sick > 0) c.push(['腹痛', 'bad']);
  if (g.hunger < 20) c.push(['空腹', 'bad']);
  if (g.thirst < 20) c.push(['脱水', 'bad']);
  if (g.exhaust) c.push(['息切れ', 'warn']);
  return c.length ? c : [['快適', 'ok']];
}
// 天気：雨水・雷
function updateWeather(dt, inCave) {
  const g = game, w = g.weather;
  if (inCave || (w !== 'rain' && w !== 'storm')) return;
  g.rainAcc = (g.rainAcc || 0) + dt;
  if (g.rainAcc >= (w === 'storm' ? 12 : 20)) {
    g.rainAcc = 0;
    if (has('bowl')) { takeItem('bowl', 1); addItem('cleanwater', 1, true); sfx('drink'); toast('木の器に雨水がたまった（きれいな水）', 'good'); }
  }
  if (w === 'storm') {
    state.boltT -= dt;
    if (state.boltT <= 0) {
      state.boltT = rnd(10, 22); state.flash = 0.35; sfx('thud');
      if (chance(0.1)) { g.hp = Math.max(0, g.hp - 12); state.shake = 0.4; sfx('hurt'); toast('雷に打たれた！ 体力-12', 'bad'); }
    }
  }
}
function survivalWarnings(cold) {
  const g = game, w = state.warn;
  const chk = (key, cond, reset, msg) => { if (cond && !w[key]) { w[key] = 1; toast(msg, 'bad'); sfx('warn'); } else if (reset) w[key] = 0; };
  chk('hunger', g.hunger < 25, g.hunger > 40, `お腹が空いてきた……（${keyLabel('Y')}で食事）`);
  chk('thirst', g.thirst < 25, g.thirst > 40, '喉が渇いた……泉の水を汲んで、焚き火でろ過しよう');
  chk('stamina', g.exhaust, !g.exhaust, '息が切れた……少し休もう');
  chk('hp', g.hp < 30, g.hp > 45, '体力が危ない！ 休むか、食事をとろう');
  chk('cold', cold && g.hp < 90, !cold, '体が冷える……焚き火のそばへ行こう');
}
function updateInteraction(dt) {
  const tg = findTarget(); state.target = tg;
  state.holdCd = Math.max(0, state.holdCd - dt); state.drinkCd = Math.max(0, state.drinkCd - dt); state.capToast = Math.max(0, state.capToast - dt);
  const aDown = Input.down('A'), aPress = Input.press('A');
  state.atkCd = Math.max(0, state.atkCd - dt);
  const mob = mobInFront();
  if (mob) { state.target = { kind: 'mob', m: mob }; state.gather.o = null; if ((aPress || aDown) && state.atkCd <= 0) attackMob(mob); return; }
  if (!tg) { state.gather.o = null; return; }
  if (tg.kind === 'spring') { if (aPress) drink(); return; }
  if (tg.kind === 'water') { if (aPress && game.tools.rod) startFishing(tg); return; }
  const o = tg.o, d = OBJ[o.t];
  if (d.g) {
    const g = d.g;
    // 拾い物は1回押すごとに1つ。アイテム回収機があれば長押しで連続回収
    if (g.instant) { if (aPress || (game.up.magnet && aDown && state.holdCd <= 0)) { state.holdCd = 0.22; if (aPress || state.lastInstant !== o) gatherDone(o, g, 0); } return; }
    const lv = g.cat ? toolLv(g.cat) : 0;
    if (g.need && lv < g.need) { state.gather.o = null; if (aPress) { sfx('error'); toast(g.need >= 2 ? '鉄のつるはしが必要だ' : 'つるはしが必要だ（クラフトで作れる）', 'bad'); } return; }
    if (g.special === 'palm' && !(o.n > 0)) { if (aPress) { sfx('error'); toast('ヤシの実はまだなっていない'); } return; }
    if (!aDown) { state.gather.o = null; return; }
    if (invCount() >= capacity()) { state.gather.o = null; if (state.capToast <= 0) { state.capToast = 2.5; sfx('error'); toast('持ち物がいっぱい！ ボックスで売るか、メニューで捨てよう', 'bad'); } return; }
    const interval = (lv >= 2 ? 0.25 : lv === 1 ? 0.3 : 0.42) * ((game.hunger < 20 || game.thirst < 20) ? 1.4 : 1) * (game.stamina <= 0 ? 1.6 : 1);
    const gs = state.gather;
    if (gs.o !== o) { gs.o = o; gs.prog = interval * 0.6; gs.hits = 0; }
    gs.prog += dt;
    if (gs.prog >= interval) {
      gs.prog -= interval; gs.hits++;
      game.stamina = Math.max(0, game.stamina - (lv > 0 ? 2 : 3)); state.stIdle = 0;
      o._shake = 0.15; player.lunge = 0.12; sfx(g.sfx || 'chop'); burst(o.x * 16 + 8, o.y * 16 + 8, fxColor(g.fx), 4);
      if (gs.hits >= g.hits[lv]) { gs.o = null; gatherDone(o, g, lv); }
    }
    return;
  }
  if (d.it === 'drop') { if (aPress || (game.up.magnet && aDown && state.holdCd <= 0)) { state.holdCd = 0.22; pickDrop(o, aPress); } return; }
  if (aPress && d.it) interact(o);
}
function fxColor(fx) { return { wood: P.woodL, leaf: P.leafL, stone: P.stoneL, metal: '#c8d0d8', iron: '#d97a3a', crystal: '#9fe8f6', gold: P.gold }[fx] || '#ffffff'; }
function gatherDone(o, g, lv) {
  const m = curMap();
  if (g.instant && invCount() >= capacity()) { if (state.capToast <= 0) { state.capToast = 2.5; sfx('error'); toast('持ち物がいっぱい！', 'bad'); } return; }
  let ys;
  if (g.special === 'palm') { ys = [['coconut', o.n]]; o.n = 0; }
  else if (g.special === 'bush') { if (!(o.n > 0)) { state.lastInstant = o; return; } ys = [['berry', 2], ['fiber', 1, 0.3]]; o.n = 0; }
  else if (g.special === 'shell') ys = [[chance(0.12) ? 'rareshell' : 'shell', 1]];
  else if (g.special === 'crate') { ys = [['wood', 2]]; const r = Math.random(); ys.push(r < 0.3 ? ['rope', 2] : r < 0.55 ? ['metal', 1] : r < 0.75 ? ['canned', 1] : r < 0.87 ? ['coin', 1] : ['cloth', 1]); }
  else ys = g.y(lv);
  const got = []; let lost = false, total = 0;
  for (const [id, n, p] of ys) { if (p != null && !chance(p)) continue; const a = addItem(id, n); if (a < n) lost = true; if (a > 0) { got.push(`+${a} ${ITEMS[id].n}`); total += a; } }
  if (g.cat && lv > 0) useTool(g.cat);
  if (g.remove) removeObj(m, o); else if (g.to) { o.t = g.to; o.r = game.day + g.regrow; }
  state.lastInstant = o;
  game.stats.gathered += total;
  if (g.instant) sfx(g.sfx || 'pick'); else sfx('pick');
  got.forEach((s, i) => floatText(o.x * 16 + 8, o.y * 16 - 2 - i * 9, s, '#ffffff'));
  if (lost) toast('持ち物がいっぱいで、入りきらなかった分は捨てた', 'bad');
  if (!game.flags.g5 && game.stats.gathered >= 5) game.flags.g5 = 1;
}
function interact(o) {
  const d = OBJ[o.t];
  switch (d.it) {
    case 'shop': openShop(); break;
    case 'station': openStation(o); break;
    case 'bed': trySleep(); break;
    case 'diary': readDiary(o); break;
    case 'shrine': takeShrine(o); break;
    case 'shrineEmpty': toast('祠は空っぽだ'); break;
    case 'cave': enterCave(); break;
    case 'exit': exitCave(); break;
    case 'liner': openLiner(); break;
    case 'hut':
      if (!game.flags.hutSeen) { game.flags.hutSeen = 1; queueTalk(TALK.hut.concat([['sys', '小屋の中には、物をしまっておける棚がある。ここで眠ることもできそうだ。']]), openHut); }
      else openHut();
      break;
    case 'wreck': queueTalk(TALK.wreck); break;
    case 'raft': openRaft(); break;
  }
}
// 泉：木の器で水を汲む（そのままでは飲まず、焚き火でろ過する）
function drink() {
  if (!has('bowl')) { sfx('error'); toast('木の器がない（クラフトで木材1つから作れる）', 'bad'); return; }
  takeItem('bowl', 1); addItem('rawwater', 1, true); state.drinkCd = 0.4; sfx('drink');
  floatText(player.x, player.y - 20, '+1 泉の水', '#9fd3ff');
  if (!game.flags.water1) { game.flags.water1 = 1; toast('焚き火の「加工」でろ過すると、きれいな水になる', 'good'); }
}
function consume(id) {
  const it = ITEMS[id]; if (!has(id)) return;
  if (it.heal) { if (game.hp >= 100) { toast('体力は満タンだ'); return; } takeItem(id, 1); game.hp = Math.min(100, game.hp + it.heal); sfx('eat'); toast(`${it.n}を使った（体力+${it.heal}）`, 'good'); return; }
  const f = it.food; if (!f) return;
  const drinkOnly = !f.h;
  if (drinkOnly && game.thirst >= 99) { toast('喉は渇いていない'); return; }
  if (!drinkOnly && game.hunger >= 99 && (game.thirst >= 99 || !f.t)) { toast('もうお腹いっぱいだ'); return; }
  takeItem(id, 1); game.hunger = Math.min(100, game.hunger + f.h); game.thirst = Math.min(100, game.thirst + (f.t || 0));
  if (it.ret) addItem(it.ret, 1, true);
  sfx(drinkOnly ? 'drink' : 'eat');
  let msg = `${it.n}を${drinkOnly ? '飲んだ' : '食べた'}（` + [f.h ? '空腹+' + f.h : '', f.t ? '渇き+' + f.t : ''].filter(Boolean).join(' ') + '）';
  if (f.poison) { game.hp = Math.max(1, game.hp - 30); game.sick = Math.max(game.sick || 0, 60); msg += '……毒だ！ 体力-30'; toast(msg, 'bad'); sfx('hurt'); }
  else if (f.raw && chance(0.25)) { game.hp = Math.max(1, game.hp - 8); game.sick = Math.max(game.sick || 0, 40); msg += '……お腹を壊した！ 体力-8'; toast(msg, 'bad'); } else toast(msg, 'good');
}
function quickEat() {
  const g = game; const foods = Object.keys(g.inv).filter(k => ITEMS[k] && ITEMS[k].food && !ITEMS[k].noQuick && g.inv[k] > 0);
  if (!foods.length) { sfx('error'); toast('食べ物を持っていない', 'bad'); return; }
  const thirsty = g.thirst + 10 < g.hunger;
  const order = thirsty ? ['cleanwater', 'coconut', 'canned', 'berry', 'grilled', 'fish', 'sardine', 'octopus', 'bigfish', 'katsuo'] : ['grilled', 'canned', 'berry', 'coconut', 'fish', 'sardine', 'octopus', 'bigfish', 'katsuo', 'cleanwater'];
  const id = order.find(k => foods.includes(k)) || foods[0];
  consume(id);
}
// 食事ボタン：選んでいる枠が食べ物・救急キットならそれを使い、違えば自動で選ぶ
function useSelected() {
  const id = hotItem();
  if (id && (ITEMS[id].food || ITEMS[id].heal)) consume(id); else quickEat();
}
function craft(r) {
  const s = recipeState(r, true); if (!s.ok) return;
  if (r.out && invCount() - costSize(r.cost) + r.n > capacity()) { sfx('error'); toast('持ち物がいっぱいです', 'bad'); return; }
  if (r.build) { startPlace(r); return; }   // 設置物は置き場所を選んでから素材を使う
  else {
    payCost(r.cost);
    if (r.tool) game.tools[r.tool] = TOOLS[r.tool].dur || 1;
    if (r.up) game.up[r.up] = true;
    if (r.out) addItem(r.out, r.n);
  }
  game.stats.crafted++; sfx('craft'); toast(`${recipeName(r)}を${r.build ? '設置した' : '作った'}！`, 'good');
  saveGame(true);
}
function findBuildSpot() {
  const m = curMap(), ptx = Math.floor(player.x / 16), pty = Math.floor((player.y - 3) / 16), [vx, vy] = DIRV[player.dir];
  const ok = (x, y) => { const v = tileAt(m, x, y); if (!WALK[v] || v === T.PIER || objAt(m, x, y)) return false;
    const l = player.x - 5, r = player.x + 5, t = player.y - 5, b = player.y; return !(l < x * 16 + 16 && r > x * 16 && t < y * 16 + 16 && b > y * 16); };
  const cands = [[ptx + vx, pty + vy]];
  for (let rr = 1; rr <= 2; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) cands.push([ptx + dx, pty + dy]);
  return cands.find(([x, y]) => ok(x, y)) || null;
}
/* 設置モード（半径CONFIG.placeRangeマス以内をクリック／タップ） */
const playerTile = () => [Math.floor(player.x / 16), Math.floor((player.y - 3) / 16)];
function placeOk(x, y) {
  const m = curMap(), [ptx, pty] = playerTile();
  if (game.map !== 'island' || Math.hypot(x - ptx, y - pty) > CONFIG.placeRange) return false;
  const v = tileAt(m, x, y); if (!WALK[v] || v === T.PIER || objAt(m, x, y)) return false;
  const l = player.x - 5, r = player.x + 5, t = player.y - 5, b = player.y;
  return !(l < x * 16 + 16 && r > x * 16 && t < y * 16 + 16 && b > y * 16);
}
function startPlace(r) {
  const sp = findBuildSpot(), [ptx, pty] = playerTile(), [vx, vy] = DIRV[player.dir];
  UI.closeAll(); stopFishing(); state.gather.o = null;
  state.place = { r, tx: sp ? sp[0] : ptx + vx, ty: sp ? sp[1] : pty + vy };
  document.body.classList.add('placing'); state.hintHtml = undefined; sfx('ui');
}
function cancelPlace(silent) {
  if (!state.place) return; state.place = null; document.body.classList.remove('placing'); state.hintHtml = undefined;
  if (!silent) { sfx('ui'); toast('設置をやめた'); }
}
function placeCursorFromScreen(cx, cy) {
  const rc = canvas.getBoundingClientRect(); if (!rc.width) return;
  const wx = (cx - rc.left) * (canvas.width / rc.width) / zoom + state.cam.x, wy = (cy - rc.top) * (canvas.height / rc.height) / zoom + state.cam.y;
  state.place.tx = Math.floor(wx / 16); state.place.ty = Math.floor(wy / 16);
}
function confirmPlace() {
  const pl = state.place; if (!pl) return; const r = pl.r;
  if (!placeOk(pl.tx, pl.ty)) { sfx('error'); toast(`そこには置けない（自分から${CONFIG.placeRange}マス以内の空いた地面）`, 'bad'); return; }
  if (!hasAll(r.cost)) { sfx('error'); toast('素材が足りません', 'bad'); cancelPlace(true); return; }
  payCost(r.cost); const o = addObj(curMap(), { t: r.build, x: pl.tx, y: pl.ty });
  if (OBJ[r.build].it === 'station') stations.push(o);
  burst(pl.tx * 16 + 8, pl.ty * 16 + 8, P.woodL, 10);
  cancelPlace(true);
  game.stats.crafted++; sfx('craft'); toast(`${recipeName(r)}を設置した！`, 'good');
  saveGame(true);
}
function updatePlace() {
  const pl = state.place, [ptx, pty] = playerTile(), R = CONFIG.placeRange;
  if (Input.press('B') || Input.press('START') || Input.press('X')) { cancelPlace(); return; }
  const mv = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };
  for (const d in mv) if (Input.press(d)) { pl.tx = clamp(pl.tx + mv[d][0], ptx - R, ptx + R); pl.ty = clamp(pl.ty + mv[d][1], pty - R, pty + R); sfx('ui'); }
  if (Input.press('A')) confirmPlace();
}

function repay(amt) {
  amt = Math.min(Math.floor(amt), game.money, game.debt); if (amt <= 0) return;
  game.money -= amt; game.debt -= amt; game.repaid += amt; sfx('coin'); toast(`${fmt$(amt)} を返済した（残り ${fmt$(game.debt)}）`, 'money');
  if (!game.flags.firstRepay) { game.flags.firstRepay = 1; queueTalk(TALK.firstRepay); }
  checkMilestones(); saveGame(true);
}
function checkMilestones() {
  const g = game, r = repaidRatio(), f = g.flags;
  if (!f.m25 && r >= 0.25) { f.m25 = 1; sfx('unlock'); queueTalk(TALK.m25); if (!f.linerSeen) queueTalk([['zeni', `ソウイエバ……島ノ${linerDir()}ノ浜ニ、デッカイ客船ガ打チ上ガッテマス。鮫島海運ノ船デス。ゼニ！`]]); }
  if (!f.m50 && r >= 0.5) { f.m50 = 1; sfx('unlock'); queueTalk(TALK.m50); }
  if (!f.m75 && r >= 0.75 && g.debt > 0) { f.m75 = 1; queueTalk(TALK.m75); }
  if (!f.paid && g.debt <= 0) { f.paid = 1; f.m25 = f.m50 = f.m75 = 1; sfx('unlock'); queueTalk(TALK.paid.concat(g.bp.raft ? [] : TALK.paidHint)); }
}
function buy(s) {
  if (repaidRatio() < s.req || (s.bp && game.bp[s.bp]) || game.money < s.p) return;
  if (s.item && invCount() >= capacity()) { sfx('error'); toast('持ち物がいっぱいです', 'bad'); return; }
  game.money -= s.p; game.stats.spent = (game.stats.spent || 0) + s.p;
  if (s.bp) { game.bp[s.bp] = true; sfx('unlock'); toast(`${s.n}を手に入れた！`, 'good'); } else { addItem(s.item, 1); sfx('coin'); toast(`${s.n}を買った`, 'good'); }
  saveGame(true);
}
function readDiary(o) {
  const n = o.page, m = curMap(); removeObj(m, o);
  if (!game.diaries.includes(n)) game.diaries.push(n);
  game.flags['diary' + n] = 1; sfx('unlock');
  if (n === 1) game.bp.raft = true;
  queueTalk(TALK['diary' + n]); saveGame(true);
}
function takeShrine(o) {
  o.t = 'shrineEmpty'; addItem('turtle', 1, true); addItem('ledger', 1, true); game.flags.turtle = 1; sfx('unlock');
  burst(o.x * 16 + 8, o.y * 16, P.gold, 20); queueTalk(TALK.shrine); saveGame(true);
}
function enterCave() {
  sfx('door'); stopFishing();
  fade(() => { state.mobs = []; game.map = 'cave'; const e = maps.cave.lm.exit; player.x = e.x * 16 + 8; player.y = (e.y - 1) * 16 + 12; player.dir = 1; state.rockTimer = 18; state.rocks = []; },
    () => { if (!game.flags.cave) { game.flags.cave = 1; queueTalk(TALK.cave); } saveGame(true); });
}
function exitCave() {
  sfx('door');
  fade(() => { state.mobs = []; game.map = 'island'; const c = maps.island.lm.cave; player.x = c.x * 16 + 8; player.y = (c.y + 1) * 16 + 12; player.dir = 0; state.rocks = []; }, () => saveGame(true));
}
/* ---------- ギャンブル ---------- */
function linerDir() {
  const o = maps.island.objs.find(x => x.t === 'liner'); if (!o) return '';
  const dx = o.x - maps.island.W / 2, dy = o.y - maps.island.H / 2, a = Math.atan2(dy, dx) * 180 / Math.PI;
  return ['東', '南東', '南', '南西', '西', '北西', '北', '北東'][Math.round(((a + 360) % 360) / 45) % 8];
}
function gambleLog(bet, win) { const c = game.casino; c.net += win - bet; c.plays++; game.stats.gamble = (game.stats.gamble || 0) + win - bet; }
const fmtNet = n => (n >= 0 ? '+' : '-') + fmt$(Math.abs(n));
function openLiner() {
  const g = game;
  if (!g.flags.linerSeen) { g.flags.linerSeen = 1; queueTalk(TALK.liner, openLiner); return; }
  if (g.casino.open) { openCasino(); return; }
  UI.open({ render: (el, L) => el.appendChild(windowEl(L, { title: '豪華客船の残骸', cls: 'small', body: b => {
    b.appendChild(h('p', { class: 'note', style: 'color:var(--text);font-size:14px' }, '船内のカジノは電源が落ちている。発電機を直せば動きそうだ。'));
    b.appendChild(sec('修理に必要な素材', costEls(LINER_REPAIR)));
    b.appendChild(h('div', { style: 'display:flex;justify-content:center;margin-top:8px' }, btn('発電機を直す', () => {
      if (!hasAll(LINER_REPAIR)) { sfx('error'); toast('素材が足りません', 'bad'); return; }
      payCost(LINER_REPAIR); g.casino.open = true; sfx('unlock'); UI.close(L); saveGame(true);
      const o = maps.island.objs.find(x => x.t === 'liner'); if (o) burst(o.x * 16 + 24, o.y * 16, '#ff5ac8', 24);
      queueTalk(TALK.linerOpen, openCasino);
    }, { key: 'repair', cls: hasAll(LINER_REPAIR) ? 'primary' : '', disabled: !hasAll(LINER_REPAIR), why: '素材が足りません' })));
  } })) });
}
// カジノ（スロット・ルーレット）
let slotRun = null, rouRun = null;
function openCasino() {
  sfx('door');
  UI.open({ tab: 'slot', bet: 10, rouType: 'red', rouNum: 7, smsg: '', rmsg: '', onClose: () => { finishSlot(); finishRoulette(); saveGame(true); }, render: (el, L) => el.appendChild(windowEl(L, {
    title: 'カジノ「ルナ・マリーナ」', cls: 'casino',
    sub: statusSub(h('span', null, '今回の収支 ', h('b', { class: game.casino.net >= 0 ? 'ok' : 'ng' }, fmtNet(game.casino.net)))),
    tabs: [{ id: 'slot', label: 'スロット' }, { id: 'rou', label: 'ルーレット' }],
    body: b => {
      const busy = !!(slotRun || rouRun);
      b.appendChild(sec('かけ金', h('div', { class: 'preset-row' }, ...BETS.map(v => btn(fmt$(v), () => { L.bet = v; UI.refresh(L); }, { key: 'bet' + v, cls: L.bet === v ? 'on' : '', disabled: busy, why: '回っている間は変えられません' })))));
      (L.tab === 'slot' ? renderSlot : renderRoulette)(b, L);
      b.appendChild(h('p', { class: 'note warn', style: 'margin-top:8px' }, 'カジノは長く続けるほど負ける仕組みです。借金の返済は計画的に。'));
    },
  })) });
}
const pickSym = () => { let r = Math.random() * SLOT.w.reduce((a, b) => a + b, 0); for (let i = 0; i < SLOT.sym.length; i++) { r -= SLOT.w[i]; if (r <= 0) return SLOT.sym[i]; } return 'shell'; };
function slotPay(res, bet) { if (res[0] === res[1] && res[1] === res[2] && res[0] !== 'cherry') return bet * SLOT.pay[res[0]]; return bet * SLOT.cherry[res.filter(x => x === 'cherry').length]; }
function renderSlot(b, L) {
  const reels = h('div', { class: 'slot-machine' }, ...[0, 1, 2].map(i => {
    const st = slotRun ? slotRun.stopped > i : true, sym = slotRun ? (st ? slotRun.res[i] : SLOT.sym[i]) : (L.last ? L.last[i] : SLOT.sym[i]);
    return h('div', { class: 'reel' + (st && slotRun ? ' stop' : ''), id: 'reel' + i }, h('img', { src: SLOT_URL[sym], alt: SLOT.name[sym], draggable: 'false' }));
  }));
  b.appendChild(reels);
  b.appendChild(h('div', { class: 'slot-msg', id: 'slot-msg' }, L.smsg || 'レバーを引いて、ストップを3回押そう'));
  b.appendChild(h('div', { style: 'display:flex;justify-content:center;margin:6px 0 10px' }, btn(slotRun ? `ストップ（${slotRun.stopped + 1}）` : `レバーを引く（${fmt$(L.bet)}）`, () => slotLever(L), { key: 'lever', cls: 'primary big', silent: true })));
  const pt = SLOT.sym.filter(k => k !== 'cherry').map(k => h('span', null, h('img', { class: 'icon sm', src: SLOT_URL[k], alt: '' }), `×3 → ${SLOT.pay[k]}倍`));
  b.appendChild(sec('配当', h('div', { class: 'paytable' }, ...pt, h('span', null, h('img', { class: 'icon sm', src: SLOT_URL.cherry, alt: '' }), `1個→${SLOT.cherry[1]}倍／2個→${SLOT.cherry[2]}倍／3個→${SLOT.cherry[3]}倍`))));
}
function slotLever(L) {
  const g = game;
  if (!slotRun) {
    if (g.money < L.bet) { sfx('error'); toast('所持金が足りません', 'bad'); return; }
    g.money -= L.bet; sfx('ui'); L.smsg = '';
    slotRun = { L, bet: L.bet, res: [pickSym(), pickSym(), pickSym()], stopped: 0, iv: setInterval(() => {
      for (let i = slotRun ? slotRun.stopped : 3; i < 3; i++) { const im = document.querySelector(`#reel${i} img`); if (im) im.src = SLOT_URL[SLOT.sym[Math.floor(Math.random() * SLOT.sym.length)]]; }
    }, 70) };
    UI.refresh(L); return;
  }
  slotRun.stopped++; sfx('ui');
  if (slotRun.stopped >= 3) finishSlot(); else UI.refresh(L);
}
function finishSlot() {
  if (!slotRun) return;
  const r = slotRun, win = slotPay(r.res, r.bet); clearInterval(r.iv); slotRun = null;
  game.money += win; gambleLog(r.bet, win); r.L.last = r.res;
  const big = r.res[0] === r.res[1] && r.res[1] === r.res[2] && r.res[0] !== 'cherry';
  r.L.smsg = win > 0 ? `${big ? SLOT.name[r.res[0]] + 'がそろった！ ' : ''}${fmt$(win)} 獲得！` : 'はずれ……';
  sfx(win >= r.bet * 10 ? 'unlock' : win > 0 ? 'coin' : 'error');
  if (r.res.every(x => x === 'seven')) { state.shake = 0.5; toast('★ 777 大当たり！ ★', 'money'); }
  if (UI.top() === r.L) UI.refresh(r.L);
}
const rouColor = n => n === 0 ? 'green' : ROU_RED.includes(n) ? 'red' : 'black';
function renderRoulette(b, L) {
  const types = [['red', '赤（2倍）'], ['black', '黒（2倍）'], ['even', '偶数（2倍）'], ['odd', '奇数（2倍）'], ['num', '数字1つ（36倍）']], busy = !!rouRun;
  b.appendChild(sec('どこに賭ける？', h('div', { class: 'preset-row' }, ...types.map(([k, t]) => btn(t, () => { L.rouType = k; UI.refresh(L); }, { key: 'rt-' + k, cls: L.rouType === k ? 'on' : '', disabled: busy, why: '回っている間は変えられません' })))));
  if (L.rouType === 'num') b.appendChild(stepper('rnum', '数字（0〜36）', String(L.rouNum), () => { if (!rouRun) { L.rouNum = (L.rouNum + 36) % 37; UI.refresh(L); } }, () => { if (!rouRun) { L.rouNum = (L.rouNum + 1) % 37; UI.refresh(L); } }));
  const n = rouRun ? rouRun.show : L.rouLast;
  b.appendChild(h('div', { class: 'rou-ball ' + (n == null ? '' : rouColor(n)), id: 'rou-ball' }, n == null ? '?' : String(n)));
  b.appendChild(h('div', { class: 'slot-msg', id: 'rou-msg' }, rouRun ? '回っています……' : (L.rmsg || '0は親の総取り（どの賭けも負け）')));
  b.appendChild(h('div', { style: 'display:flex;justify-content:center;margin:6px 0' }, btn(rouRun ? '……' : `回す（${fmt$(L.bet)}）`, () => rouSpin(L), { key: 'spin', cls: 'primary big', disabled: busy, why: '回っています', silent: true })));
}
function rouSpin(L) {
  const g = game; if (rouRun) return;
  if (g.money < L.bet) { sfx('error'); toast('所持金が足りません', 'bad'); return; }
  g.money -= L.bet; sfx('ui'); L.rmsg = '';
  rouRun = { L, bet: L.bet, type: L.rouType, num: L.rouNum, res: Math.floor(Math.random() * 37), show: 0, t: 0 };
  rouRun.iv = setInterval(() => {
    const r = rouRun; if (!r) return; r.t += 70; r.show = Math.floor(Math.random() * 37);
    const el = document.getElementById('rou-ball'); if (el) { el.textContent = String(r.show); el.className = 'rou-ball ' + rouColor(r.show); }
    if (r.t % 210 === 0) sfx('talk');
    if (r.t >= 1600) finishRoulette();
  }, 70);
  UI.refresh(L);
}
function finishRoulette() {
  if (!rouRun) return;
  const r = rouRun, n = r.res; clearInterval(r.iv); rouRun = null;
  const hit = r.type === 'num' ? n === r.num : n === 0 ? false : r.type === 'red' ? rouColor(n) === 'red' : r.type === 'black' ? rouColor(n) === 'black' : r.type === 'even' ? n % 2 === 0 : n % 2 === 1;
  const win = hit ? r.bet * (r.type === 'num' ? 36 : 2) : 0;
  game.money += win; gambleLog(r.bet, win); r.L.rouLast = n;
  r.L.rmsg = `${n}（${{ red: '赤', black: '黒', green: '緑' }[rouColor(n)]}）… ` + (win ? `${fmt$(win)} 獲得！` : 'はずれ');
  sfx(win ? (r.type === 'num' ? 'unlock' : 'coin') : 'error');
  if (UI.top() === r.L) UI.refresh(r.L);
}
// ゼニ丸の倍々チャンス（回収ボックスの「勝負」タブ）
function renderZeniBet(b, L) {
  const g = game;
  b.appendChild(h('div', { class: 'zeni-say' }, ...TALK.zeniBet.map(l => h('p', null, l[1]))));
  b.appendChild(h('p', { class: 'note', style: 'color:var(--text)' }, `素材を1種類まるごと賭けて勝負！ 勝てば査定額の${ZENI_BET.up}倍、負ければ${Math.round(ZENI_BET.down * 10)}割で買い取られます（1日1回、査定${fmt$(ZENI_BET.max)}まで）。`));
  if (L.zmsg) b.appendChild(h('div', { class: 'slot-msg' }, L.zmsg));
  if (g.flags.zeniDay === g.day) { b.appendChild(h('p', { class: 'note warn' }, '今日の勝負はもう終わりました。また明日。')); return; }
  const ids = sortItems(Object.keys(g.inv).filter(k => ITEMS[k] && !ITEMS[k].key && g.inv[k] > 0 && ITEMS[k].p > 0));
  if (!ids.length) { b.appendChild(h('p', { class: 'note' }, '賭けられる物を持っていません。')); return; }
  for (const id of ids) {
    const n = g.inv[id], val = sellEstimate(id, n), ok = val <= ZENI_BET.max;
    b.appendChild(h('div', { class: 'row-item' }, icon(id), h('div', { class: 'grow' }, h('div', { class: 'name' }, `${ITEMS[id].n} ×${n}`), h('div', { class: 'desc' }, `査定 ${fmt$(val)} → 勝ち ${fmt$(Math.round(val * ZENI_BET.up))}／負け ${fmt$(Math.round(val * ZENI_BET.down))}`)),
      h('div', { class: 'btns' }, btn('勝負する', () => confirmBox(`${ITEMS[id].n}×${n}（査定${fmt$(val)}）を賭けますか？`, () => zeniGamble(id, L), { yes: '勝負！', danger: true }), { key: 'zb-' + id, cls: ok ? 'gold' : '', disabled: !ok, why: '査定額が高すぎて受けられません' }))));
  }
}
function zeniGamble(id, L) {
  const g = game, n = g.inv[id] || 0; if (!n || g.flags.zeniDay === g.day) return;
  const val = sellEstimate(id, n), it = ITEMS[id], win = Math.random() < ZENI_BET.win, pay = Math.round(val * (win ? ZENI_BET.up : ZENI_BET.down));
  let m = g.market.m[id] != null ? g.market.m[id] : 1; g.market.m[id] = Math.max(0.3, m - DROP[it.c] * n);
  takeItem(id, n); g.money += pay; g.stats.earned += pay; g.stats.sold += n; g.flags.zeniDay = g.day; gambleLog(val, pay);
  L.zmsg = win ? `ピピーッ！ アタリ！ ${fmt$(pay)} デ買イ取リマス！` : `ザンネン……ハズレ。${fmt$(pay)} デ買イ叩キマス。ゼニ！`;
  sfx(win ? 'unlock' : 'error'); toast(`${it.n}×${n}：${win ? '勝ち' : '負け'}（${fmt$(pay)}）`, win ? 'money' : 'bad');
  saveGame(true); if (UI.top() === L) UI.refresh(L);
}
// 眠る（寝床・小屋）
function trySleep() {
  if (!(isNight() || hourOf(game.time) >= 17)) { toast('まだ明るい。夕方（17時）から眠れる'); sfx('error'); return; }
  if (enemyNear(7 * 16)) { toast('近くに危険な生き物がいる。眠れない', 'bad'); sfx('error'); return; }
  confirmBox('朝まで眠りますか？\n（体力が回復します。空腹と渇きは少し減ります）', () => { UI.closeAll(); sleep(); }, { yes: '眠る' });
}
/* 古い小屋：倉庫と休憩 */
const storeCount = () => Object.values(game.storage).reduce((a, b) => a + b, 0);
function openHut() {
  sfx('door');
  UI.open({ tab: 'store', onClose: () => saveGame(true), render: (el, L) => el.appendChild(windowEl(L, {
    title: '古い小屋', sub: statusSub(h('span', null, '倉庫 ', h('b', null, `${storeCount()}/${STORAGE_CAP}`))),
    tabs: [{ id: 'store', label: '倉庫' }, { id: 'rest', label: '休む' }],
    body: b => (L.tab === 'store' ? renderStore : renderRest)(b, L),
  })) });
}
function storeMove(id, n, toStore) {
  if (toStore) {
    n = Math.min(n, game.inv[id] || 0, STORAGE_CAP - storeCount());
    if (n <= 0) { sfx('error'); toast(storeCount() >= STORAGE_CAP ? '倉庫がいっぱいです' : '持っていません', 'bad'); return; }
    takeItem(id, n); game.storage[id] = (game.storage[id] || 0) + n;
  } else {
    n = Math.min(n, game.storage[id] || 0); const a = addItem(id, n);
    if (a <= 0) { sfx('error'); toast('持ち物がいっぱいです', 'bad'); return; }
    game.storage[id] -= a; if (game.storage[id] <= 0) delete game.storage[id];
  }
  sfx('pick');
}
function renderStore(b, L) {
  const row = (id, n, toStore) => h('div', { class: 'row-item' }, icon(id), h('div', { class: 'grow' }, h('div', { class: 'name' }, `${ITEMS[id].n} ×${n}`)),
    h('div', { class: 'btns' }, btn(toStore ? '1個しまう' : '1個出す', () => { storeMove(id, 1, toStore); UI.refresh(L); }, { key: (toStore ? 'in1-' : 'out1-') + id, silent: true }),
      btn(toStore ? '全部しまう' : '全部出す', () => { storeMove(id, 9999, toStore); UI.refresh(L); }, { key: (toStore ? 'inA-' : 'outA-') + id, silent: true, cls: 'primary' })));
  const inv = sortItems(Object.keys(game.inv).filter(k => ITEMS[k] && !ITEMS[k].key && game.inv[k] > 0));
  const st = sortItems(Object.keys(game.storage).filter(k => ITEMS[k] && game.storage[k] > 0));
  b.appendChild(h('p', { class: 'note' }, `倉庫の中身は持ち物の数に入りません（最大${STORAGE_CAP}個）。倒れても失いません。`));
  b.appendChild(sec('倉庫の中', st.length ? h('div', null, ...st.map(k => row(k, game.storage[k], false))) : h('p', { class: 'note' }, '空っぽです。')));
  b.appendChild(sec('持ち物', inv.length ? h('div', null, ...inv.map(k => row(k, game.inv[k], true))) : h('p', { class: 'note' }, '持ち物はありません。')));
}
function renderRest(b) {
  b.appendChild(h('p', { class: 'note', style: 'color:var(--text);font-size:14px' }, '小屋のそばでは雨に濡れず、夜も冷えません。焚き火と同じように、獣も近寄ってきません。'));
  b.appendChild(h('p', { class: 'note' }, '夕方（17時）から、朝までぐっすり眠れます。'));
  b.appendChild(h('div', { style: 'margin-top:10px' }, btn('朝まで眠る', () => trySleep(), { key: 'sleep', cls: 'primary' })));
}
function buildRaft() {
  if (!hasAll(RAFT_COST)) return;
  payCost(RAFT_COST); game.raftBuilt = true; game.stats.crafted++; sfx('craft');
  const r = maps.island.lm.raft; burst(r.x * 16 + 8, r.y * 16 + 20, P.woodL, 16);
  queueTalk(TALK.raftBuilt); saveGame(true);
}
function depart() {
  if (voyageFood() < 3) { sfx('error'); toast('航海用の食料が3個必要です', 'bad'); return; }
  const go = () => {
    let need = 3; for (const k of VOYAGE_FOOD) { const n = Math.min(need, game.inv[k] || 0); if (n) { takeItem(k, n); need -= n; } }
    const led = has('ledger'), id = game.debt > 0 ? (led ? 'E' : 'D') : (led ? 'C' : 'B');
    UI.closeAll(); fade(() => endGame(id));
  };
  if (game.debt > 0) confirmBox(`借金が ${fmt$(game.debt)} 残っています。\nこのまま夜逃げしますか？`, go, { yes: '夜逃げする', danger: true });
  else confirmBox('食料を3個積んで出航します。\nもう島には戻れません。よろしいですか？', go, { yes: '出航する' });
}
function sleep() {
  sfx('sleep'); stopFishing();
  fade(() => {
    const g = game; g.hp = Math.min(100, g.hp + 45); g.hunger = Math.max(5, g.hunger - 15); g.thirst = Math.max(5, g.thirst - 20); g.stamina = 100; g.exhaust = false;
    newDay('sleep');
  }, () => { if (state.scene === 'play') toast('ぐっすり眠った。体力が回復した', 'good'); });
}
function faint() {
  if (state.faintLock) return; state.faintLock = true; sfx('hurt'); stopFishing(); cancelPlace(true);
  if (game.mode === 'hard') { gameOver(); return; }
  fade(() => {
    const g = game, m = curMap(), [tx, ty] = playerTile();
    // 持ち物は倒れた場所に落とす（大切なもの・黄金の亀像は手元に残る）
    for (const k of sortItems(Object.keys(g.inv))) { if (!ITEMS[k] || ITEMS[k].key || k === 'turtle') continue; const n = g.inv[k]; if (n > 0 && spawnDrop(m, tx, ty, k, n, 0)) takeItem(k, n); }
    g.money = Math.floor(g.money * 0.9);
    g.map = 'island'; const s = maps.island.lm.spawn; player.x = s.x * 16 + 8; player.y = s.y * 16 + 12; player.dir = 0;
    g.hp = 40; g.hunger = Math.max(g.hunger, 35); g.thirst = Math.max(g.thirst, 35); g.stamina = 100; g.exhaust = false; g.sick = 0;
    newDay('faint');
  }, () => { state.faintLock = false; if (state.scene === 'play') queueTalk(TALK.faint); });
}
// ハードモード：体力0でゲームオーバー（セーブは消さない）
function gameOver() {
  const g = game;
  fade(() => {
    state.scene = 'gameover'; state.faintLock = false; Dialog.active = false; $('dialog').classList.add('hidden'); UI.closeAll();
    $('hud').classList.add('hidden'); $('hint').classList.add('hidden'); updateTouchVisibility();
    UI.open({ cls: 'dark', onBack: () => {}, render: el => {
      el.appendChild(h('div', { class: 'ending' },
        h('div', { class: 'etype', style: 'color:var(--red)' }, 'GAME OVER'), h('div', { class: 'etitle' }, '力尽きた……'),
        h('p', { style: 'animation-delay:.3s' }, `${g.day}日目。${g.name}は、島で倒れたまま動けなくなった。`),
        h('p', { style: 'animation-delay:.9s' }, 'ハードモードでは、倒れるとその冒険は終わりです。\n「つづきから」で、最後にセーブした所からやり直せます。'),
        h('div', { style: 'opacity:0;animation:fadeIn .8s ease-out 1.4s forwards' }, btn('タイトルへ', () => showTitle(), { key: 'title', cls: 'primary' }))));
    } });
  });
}
function newDay(kind) {
  const g = game; g.day++; g.time = 0; state.warn = {}; state.mobs = []; state.mobT = 4;
  let interest = 0;
  if (g.debt > 0) { interest = Math.ceil(g.debt * g.contract.rate / 100); g.debt += interest; g.interestPaid += interest; }
  // 締め日のチェック（前日が締め日なら判定）
  const st = stagesOf(g.contract), stTalk = [];
  while (g.stageI < st.length && st[g.stageI].day <= g.day - 1) {
    const sg = st[g.stageI]; g.stageI++;
    if (g.debt <= 0) continue;
    if (g.repaid >= sg.need) stTalk.push(['same', `${sg.day}日目の締め日、累計 ${fmt$(sg.need)} の返済は確かに受け取ったぜ。……チッ、やるじゃねえか。`]);
    else {
      const pen = Math.ceil(g.debt * STAGE_PENALTY); g.debt += pen; g.penalty = (g.penalty || 0) + pen;
      stTalk.push(['same', `${sg.day}日目の締め日だぜ、{name}。約束の累計 ${fmt$(sg.need)} に届いてねえな。`], ['same', `遅延損害金として ${fmt$(pen)} 上乗せだ。次の締め日は守れよ？`], ['sys', `借金に ${fmt$(pen)} が加算された。`]);
    }
  }
  if (g.debt > 0 && g.day > g.contract.days) { endGame('A'); return false; }
  const prevW = g.weather; g.weather = rollWeather(prevW);
  regrowAll(); respawn(maps.island, false, prevW === 'storm');
  if (prevW === 'storm') setTimeout(() => { if (state.scene === 'play') toast('嵐のあと、浜辺にたくさんの物が流れ着いた'); }, 1800);
  for (const k in g.market.m) g.market.m[k] = lerp(g.market.m[k], 1, 0.5);
  rollMarketEvent();
  const left = g.contract.days - g.day + 1;
  toast(`${g.day}日目の朝（${WEATHER[g.weather].n}）` + (interest ? `　利息 ${fmt$(interest)} が加算された` : ''), interest ? 'bad' : '');
  if (stTalk.length) queueTalk(stTalk);
  const ev = g.market.ev; if (ev) setTimeout(() => toast(`本日の特需：${ITEMS[ev.up].n}　値崩れ：${ITEMS[ev.dn].n}`, 'money'), 900);
  if (g.debt > 0) {
    const half = Math.ceil(g.contract.days / 2) + 1;
    if (left === 1) queueTalk(TALK.lastDay);
    else if (g.day === half && !g.flags.half) { g.flags.half = 1; queueTalk(repaidRatio() < 0.5 ? TALK.halfBad : TALK.halfGood); }
  }
  state.autosave = 0; saveGame(true);
  return true;
}
function rollWeather(prev) {
  const r = Math.random(); let w = r < 0.45 ? 'sun' : r < 0.7 ? 'cloud' : r < 0.9 ? 'rain' : 'storm';
  if (w === 'storm' && prev === 'storm') w = 'rain';
  return w;
}
function regrowAll() {
  for (const k in maps) {
    const m = maps[k];
    for (const o of m.objs) {
      if (o.t === 'palm') o.n = Math.min(3, (o.n || 0) + 1);
      else if (o.t === 'bush') o.n = 1;
      else if (REVERT[o.t] && o.r && game.day >= o.r) {
        const to = REVERT[o.t];
        if (OBJ[to].block && k === game.map && Math.floor(player.x / 16) === o.x && Math.floor((player.y - 3) / 16) === o.y) continue;
        o.t = to; o.r = 0;
      }
    }
  }
}
function respawn(m, initial, bonus) {
  const L = m.spawn, want = { pebble: 22, twig: 14, driftwood: 7 + (bonus ? 6 : 0), shell: 9, scrap: 3, crate: 2 + (bonus ? 1 : 0) };
  const cnt = {}; for (const o of m.objs) cnt[o.t] = (cnt[o.t] || 0) + 1;
  const ptx = Math.floor(player.x / 16), pty = Math.floor(player.y / 16);
  const place = (type, list, n, blocking) => {
    for (let i = 0; i < n; i++) for (let a = 0; a < 40; a++) {
      const [x, y] = list[Math.floor(Math.random() * list.length)];
      if (objAt(m, x, y)) continue; if (blocking && Math.abs(x - ptx) <= 2 && Math.abs(y - pty) <= 2) continue;
      addObj(m, { t: type, x, y }); break;
    }
  };
  place('pebble', L.land, Math.max(0, want.pebble - (cnt.pebble || 0)), false);
  place('twig', L.land, Math.max(0, want.twig - (cnt.twig || 0)), false);
  place('driftwood', L.shore, Math.max(0, want.driftwood - (cnt.driftwood || 0)), false);
  place('shell', L.sand, Math.max(0, want.shell - (cnt.shell || 0)), false);
  place('scrap', L.wreck.length ? L.wreck : L.sand, Math.max(0, want.scrap - (cnt.scrap || 0)), true);
  place('crate', L.shore, Math.min(initial || bonus ? 2 : 1, Math.max(0, want.crate - (cnt.crate || 0))), true);
}

/* 釣り */
function startFishing(tg) {
  if (game.weather === 'storm') { sfx('error'); toast('嵐で海が荒れていて、釣りができない', 'bad'); return; }
  const wm = game.weather === 'rain' ? 0.8 : game.weather === 'cloud' ? 0.9 : 1;
  state.fishing = { phase: 'wait', t: rnd(2.5, 5.5) * wm, bx: tg.tx * 16 + 8, by: tg.ty * 16 + 8 };
  state.gather.o = null; sfx('splash'); burst(tg.tx * 16 + 8, tg.ty * 16 + 8, '#dff3fa', 6);
}
function stopFishing(why) { if (!state.fishing) return; state.fishing = null; if (why === 'moved') toast('釣りをやめた'); }
function updateFishing(dt) {
  const f = state.fishing; f.t -= dt;
  if (Input.press('B')) { stopFishing(); return; }
  if (f.phase === 'wait') {
    if (Input.press('A')) { state.fishing = null; sfx('error'); toast('早すぎた！ 魚に逃げられた', 'bad'); return; }
    if (f.t <= 0) { f.phase = 'bite'; f.t = 0.9; sfx('bite'); }
  } else if (f.phase === 'bite') {
    if (Input.press('A')) {
      state.fishing = null;
      if (invCount() >= capacity()) { sfx('error'); toast('持ち物がいっぱい！', 'bad'); return; }
      const id = rollFish();
      addItem(id, 1); useTool('rod'); game.stats.fish = (game.stats.fish || 0) + 1; game.stats.gathered++;
      sfx('catch'); floatText(player.x, player.y - 22, `+1 ${ITEMS[id].n}`, '#ffffff'); burst(f.bx, f.by, '#dff3fa', 10);
      return;
    }
    if (f.t <= 0) { state.fishing = null; toast('逃げられた……（「！」が出たらA）'); }
  }
}

// 釣れる物：時間帯と天気で変わる
function rollFish() {
  const hr = hourOf(game.time) % 24, w = game.weather, wet = w === 'rain' || w === 'storm';
  const tbl = [['sardine', 28], ['fish', 30], ['bigfish', 10 * (wet ? 1.4 : w === 'cloud' ? 1.2 : 1)], ['katsuo', (hr >= 5 && hr < 9 ? 9 : 3) * (wet ? 1.4 : 1)],
    ['octopus', hr >= 19 || hr < 5 ? 12 : 3], ['fugu', 6], ['boot', 7 * (wet ? 1.3 : 1)], ['rareshell', 5]];
  let r = Math.random() * tbl.reduce((a, b) => a + b[1], 0);
  for (const [id, wt] of tbl) { r -= wt; if (r <= 0) return id; }
  return 'fish';
}
/* ---------- 生き物・敵 ---------- */
const MOBSPR = {};
function buildMobSprites() {
  const D = {
    crab: (g, f) => { g.e(7, 6, 5, 3, '#e0503a'); g.e(7, 5, 3.6, 1.6, '#f07a5a'); g.e(2, 3.4, 1.8, 1.6, '#e0503a'); g.e(12, 3.4, 1.8, 1.6, '#e0503a'); g.p(5, 3, '#ffffff'); g.p(9, 3, '#ffffff'); for (let i = 0; i < 3; i++) { g.p(2 + i * 2 + f, 9, '#a03020'); g.p(8 + i * 2 - f, 9, '#a03020'); } },
    gcrab: (g, f) => { g.e(9, 8, 7, 4, '#9a2a2a'); g.e(9, 7, 5, 2, '#c04a3a'); g.e(2.4, 4, 2.4, 2.2, '#b03a2a'); g.e(15.6, 4, 2.4, 2.2, '#b03a2a'); g.p(7, 3, '#ffd040'); g.p(11, 3, '#ffd040'); g.p(5, 5, '#6a1a1a'); g.p(13, 5, '#6a1a1a'); for (let i = 0; i < 3; i++) { g.p(3 + i * 2 + f, 12, '#6a1a1a'); g.p(10 + i * 2 - f, 12, '#6a1a1a'); } },
    rabbit: (g, f) => { g.e(5, 7, 4.6, 3.4, '#e8e0d0'); g.e(10, 5, 2.8, 2.4, '#e8e0d0'); g.r(9, 0, 1, 3, '#e8e0d0'); g.r(11, 0, 1, 3, '#e8e0d0'); g.p(11, 1, '#f0a0a0'); g.p(11, 5, P.ol); g.p(12, 6, '#f08090'); g.p(0, 6, '#ffffff'); g.r(f ? 3 : 6, 10, 2, 1, '#c8c0b0'); },
    dog: (g, f) => { g.r(3, 4, 10, 4, '#6e665e'); g.r(3, 4, 10, 1, '#8a827a'); g.e(14, 4, 2.8, 2.4, '#6e665e'); g.r(15, 5, 2, 2, '#5a524a'); g.r(13, 1, 2, 2, '#5a524a'); g.p(15, 3, '#ffd040'); g.l(3, 4, 0, 1, '#6e665e'); const c = '#5a524a'; if (f) { g.r(5, 8, 1, 3, c); g.r(10, 8, 1, 3, c); } else { g.r(4, 8, 1, 3, c); g.r(11, 8, 1, 3, c); } },
    bat: (g, f) => { g.e(7, 4, 2, 2.6, '#4a3058'); g.p(6, 1, '#4a3058'); g.p(8, 1, '#4a3058'); g.p(6, 3, '#ff4a4a'); g.p(8, 3, '#ff4a4a'); const c = '#5a3a6a'; if (f) { g.r(0, 4, 5, 3, c); g.r(10, 4, 5, 3, c); } else { g.r(0, 1, 5, 3, c); g.r(10, 1, 5, 3, c); } },
  };
  const SZ = { crab: [14, 10], gcrab: [18, 13], rabbit: [13, 11], dog: [17, 12], bat: [15, 9] };
  for (const k in D) { const [w, hh] = SZ[k], fr = [0, 1].map(f => mk(w, hh, g => D[k](g, f))); MOBSPR[k] = [fr, fr.map(flipH)]; }
  buildCasinoSprites();
}
// 沈没船カジノとスロットの絵柄
const SLOT_URL = {};
function buildCasinoSprites() {
  const liner = lit => g => {
    g.r(2, 22, 44, 10, '#e8e4dc'); g.r(2, 22, 44, 1, '#ffffff'); g.r(2, 29, 44, 1, '#c03a3a'); g.r(2, 30, 44, 4, '#2a3a5a');
    g.r(0, 24, 2, 8, '#d8d4cc'); g.r(46, 24, 2, 6, '#d8d4cc');
    for (let x = 5; x < 44; x += 5) g.e(x + 0.5, 25.5, 1, 1, lit ? '#ffe08a' : '#4a5a6a');
    g.r(8, 12, 30, 10, '#f3efe6'); g.r(8, 12, 30, 1, '#ffffff'); g.r(8, 21, 30, 1, '#c8c0b0');
    for (let x = 10; x < 36; x += 4) g.r(x, 15, 2, 3, lit ? '#ffd860' : '#3a4a5a');
    g.r(31, 3, 6, 9, '#c03a3a'); g.r(31, 3, 6, 2, '#2a2a2a'); g.r(32, 6, 4, 1, '#e8e4dc');
    g.r(11, 6, 16, 5, '#2a1a3a'); for (let x = 12; x < 26; x += 2) g.p(x, 8, lit ? (x % 4 ? '#ff5ac8' : '#5ae0ff') : '#5a3a5a');
    g.l(20, 22, 23, 33, '#8a7a6a'); g.l(23, 33, 26, 30, '#8a7a6a'); g.p(14, 27, '#b0703a'); g.p(38, 26, '#b0703a'); g.p(40, 27, '#b0703a');
    g.r(3, 32, 3, 2, '#3a6a3a'); g.r(40, 32, 4, 2, '#3a6a3a');
  };
  SPR.liner = mk(48, 36, liner(false)); SPR.linerLit = mk(48, 36, liner(true));
  const D = {
    seven: g => { g.r(4, 3, 9, 3, '#e83a3a'); g.l(12, 5, 7, 14, '#e83a3a'); g.l(11, 5, 6, 14, '#e83a3a'); g.p(5, 4, '#ff9a9a'); },
    bar: g => { g.r(1, 5, 14, 7, '#2a2a3a'); g.r(2, 6, 12, 5, '#f2c440'); g.r(3, 8, 10, 1, '#2a2a3a'); },
    bell: g => { g.e(8, 8, 4.6, 5, '#f2c440'); g.r(3, 11, 10, 2, '#f2c440'); g.p(8, 14, '#c8961e'); g.p(6, 6, '#fff3a0'); g.r(7, 2, 2, 2, '#c8961e'); },
    palm: g => { g.r(7, 6, 2, 9, '#8b5a2b'); g.l(8, 5, 2, 3, '#3a9a4a'); g.l(8, 5, 14, 3, '#3a9a4a'); g.l(8, 5, 3, 8, '#5ab05a'); g.l(8, 5, 13, 8, '#5ab05a'); g.e(8, 6, 1.6, 1.4, '#6b4423'); },
    shell: ICONDRAW.shell,
    cherry: g => { g.e(5, 11, 2.8, 2.8, '#e0303a'); g.e(11, 11, 2.8, 2.8, '#e0303a'); g.l(5, 9, 9, 3, '#3a8a3a'); g.l(11, 9, 9, 3, '#3a8a3a'); g.r(9, 2, 3, 2, '#5ab05a'); g.p(4, 10, '#ff9aa0'); g.p(10, 10, '#ff9aa0'); },
  };
  for (const k in D) SLOT_URL[k] = mk(16, 16, D[k]).toDataURL();
}
function mobBlocked(mp, d, x, y) {
  if (d.fly) { const v = tileAt(mp, Math.floor(x / 16), Math.floor(y / 16)); return v === T.CWALL || !WALK[v]; }
  for (const [ox, oy] of [[-4, -3], [4, -3], [-4, 0], [4, 0]]) if (isBlocked(mp, Math.floor((x + ox) / 16), Math.floor((y + oy - 0.01) / 16))) return true;
  return false;
}
function moveMob(mp, d, m, ax, ay) {
  if (ax) { if (!mobBlocked(mp, d, m.x + ax, m.y)) m.x += ax; else m.vx = -m.vx; }
  if (ay) { if (!mobBlocked(mp, d, m.x, m.y + ay)) m.y += ay; else m.vy = -m.vy; }
}
function spawnMob(type, x, y) {
  const m = { mob: 1, type, x, y, hp: MOBS[type].hp, dir: 1, vx: 0, vy: 0, t: 0, an: 0, atkCd: 1, hurt: 0, flee: 0, lunge: 0, map: game.map, seed: Math.random() * 6 };
  state.mobs.push(m); return m;
}
function caveFloor(mp) { const a = []; for (let y = 1; y < mp.H - 1; y++) for (let x = 1; x < mp.W - 1; x++) if (mp.tiles[y * mp.W + x] === T.CFLOOR) a.push([x, y]); return a; }
// 焚き火・小屋のまわりは安全地帯（敵が近寄らない）
function safePoints() { return curMap().objs.filter(o => o.t === 'campfire' || o.t === 'hut').map(o => o.t === 'hut' ? [o.x * 16 + 16, o.y * 16 + 8, 64] : [o.x * 16 + 8, o.y * 16 + 10, 60]); }
const inSafe = (pts, x, y) => pts.some(([sx, sy, r]) => Math.hypot(sx - x, sy - y) < r);
function nearHut() { if (game.map !== 'island') return false; const hu = maps.island.objs.find(o => o.t === 'hut'); return !!hu && Math.hypot(hu.x * 16 + 16 - player.x, hu.y * 16 + 8 - player.y) < 44; }
const enemyNear = r => state.mobs.some(m => m.map === game.map && MOBS[m.type].kind === 'enemy' && Math.hypot(m.x - player.x, m.y - player.y) < r);
function trySpawnMobs() {
  const mp = curMap(), cave = game.map === 'cave', night = isNight(), [ptx, pty] = playerTile(), pts = safePoints();
  for (const type in MOBS) {
    const d = MOBS[type];
    if (cave !== (d.where === 'cave')) continue;
    if ((d.at === 'day' && night) || (d.at === 'night' && !night)) continue;
    const cap = d.cap + (d.kind === 'enemy' && game.mode === 'hard' ? 1 : 0);
    if (state.mobs.filter(m => m.type === type && m.map === game.map).length >= cap) continue;
    const list = cave ? (mp.floor || (mp.floor = caveFloor(mp))) : d.where === 'sand' ? mp.spawn.sand : mp.spawn.land;
    if (!list || !list.length) continue;
    for (let a = 0; a < 12; a++) {
      const [tx, ty] = list[Math.floor(Math.random() * list.length)], dd = Math.hypot(tx - ptx, ty - pty);
      if (dd < (cave ? 7 : 10) || dd > 24) continue;
      const x = tx * 16 + 8, y = ty * 16 + 12;
      if (mobBlocked(mp, d, x, y) || (d.kind === 'enemy' && inSafe(pts, x, y))) continue;
      spawnMob(type, x, y);
      if (d.kind === 'enemy' && !cave && !game.flags.firstEnemy) { game.flags.firstEnemy = 1; toast('どこかで獣の遠吠えが聞こえる……焚き火や小屋のそばは安全だ', 'bad'); sfx('warn'); }
      break;
    }
  }
}
function updateMobs(dt) {
  const mp = curMap(), night = isNight(), pts = safePoints(), playerSafe = inSafe(pts, player.x, player.y), px = player.x, py = player.y - 4;
  state.mobT -= dt; if (state.mobT <= 0) { state.mobT = 3; if (!state.noMobs) trySpawnMobs(); }
  for (let i = state.mobs.length - 1; i >= 0; i--) {
    const m = state.mobs[i];
    if (m.map !== game.map) { state.mobs.splice(i, 1); continue; }
    const d = MOBS[m.type], dx = px - m.x, dy = py - (m.y - 4), dist = Math.hypot(dx, dy) || 0.01;
    const wrongTime = (d.at === 'day' && night) || (d.at === 'night' && !night);
    if (dist > 30 * 16 || (wrongTime && dist > 12 * 16)) { state.mobs.splice(i, 1); continue; }
    m.hurt = Math.max(0, m.hurt - dt); m.atkCd = Math.max(0, m.atkCd - dt); m.flee = Math.max(0, m.flee - dt); m.lunge = Math.max(0, m.lunge - dt); m.t -= dt;
    let vx = 0, vy = 0, sp = d.sp;
    const wander = () => { if (m.t <= 0) { m.t = rnd(1.2, 3); if (chance(0.4)) m.vx = m.vy = 0; else { const a = rnd(0, Math.PI * 2); m.vx = Math.cos(a); m.vy = Math.sin(a); } } vx = m.vx; vy = m.vy; sp *= 0.5; };
    if (d.kind === 'passive') {
      if (m.flee > 0 || dist < 34) { vx = -dx / dist; vy = -dy / dist; sp *= 1.3; } else wander();
    } else if (dist < d.sight && !playerSafe && !wrongTime && game.hp > 0) {
      vx = dx / dist; vy = dy / dist;
      if (dist < 13) { vx = vy = 0; if (m.atkCd <= 0) { m.atkCd = 1.3; m.lunge = 0.2; m.dir = dx < 0 ? -1 : 1; hurtPlayer(d.dmg, m); } }
    } else if (inSafe(pts, m.x, m.y - 4) || (playerSafe && dist < 90)) { vx = -dx / dist; vy = -dy / dist; }
    else wander();
    if (d.fly && (vx || vy)) { vx += Math.sin(state.time * 7 + m.seed) * 0.6; vy += Math.cos(state.time * 5 + m.seed) * 0.6; }
    if (m.hurt > 0.12) vx = vy = 0;
    if (vx || vy) { const l = Math.hypot(vx, vy); moveMob(mp, d, m, vx / l * sp * dt, vy / l * sp * dt); if (Math.abs(vx) > 0.1) m.dir = vx < 0 ? -1 : 1; m.an += dt * 8; }
  }
}
function hurtPlayer(dmg, m) {
  if (state.invuln > 0 || state.god) return;
  const g = game; dmg = Math.round(dmg * (g.mode === 'hard' ? 1.25 : 1));
  g.hp = Math.max(0, g.hp - dmg); state.invuln = 0.8; state.shake = 0.3; sfx('hurt'); stopFishing(); state.gather.o = null;
  floatText(player.x, player.y - 20, `-${dmg}`, '#ff6a5a');
  const dx = player.x - m.x, dy = player.y - m.y, l = Math.hypot(dx, dy) || 1;
  tryMove(dx / l * 10, 0); tryMove(0, dy / l * 10);
  if (!g.flags.firstHurt) { g.flags.firstHurt = 1; toast(`${MOBS[m.type].n}に襲われた！ 向き合って${keyLabel('A')}で反撃（剣があると強い）`, 'bad'); }
}
function mobInFront() {
  const [vx, vy] = DIRV[player.dir], px = player.x, py = player.y - 4; let best = null, bd = 24;
  for (const m of state.mobs) {
    if (m.map !== game.map) continue;
    const dx = m.x - px, dy = (m.y - 4) - py, d = Math.hypot(dx, dy);
    if (d > 24 || (d > 8 && (dx * vx + dy * vy) / d < 0.3)) continue;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}
function attackMob(m) {
  const g = game, wk = bestTool('sword'), dmg = wk ? TOOLS[wk].dmg : 1, d = MOBS[m.type];
  state.atkCd = (wk === 'ironSword' ? 0.32 : 0.42) * (g.stamina <= 0 ? 1.6 : 1); state.swing = 0.15; player.lunge = 0.12;
  g.stamina = Math.max(0, g.stamina - 5); state.stIdle = 0;
  if (wk) useTool('sword');
  m.hp -= dmg; m.hurt = 0.25; m.flee = 3; sfx('chop');
  const dx = m.x - player.x, dy = m.y - player.y, l = Math.hypot(dx, dy) || 1;
  moveMob(curMap(), d, m, dx / l * 12, dy / l * 12);
  floatText(m.x, m.y - 18, `-${dmg}`, '#ffffff'); burst(m.x, m.y - 6, '#ffffff', 5);
  if (m.hp <= 0) killMob(m);
}
function killMob(m) {
  const i = state.mobs.indexOf(m); if (i >= 0) state.mobs.splice(i, 1);
  const d = MOBS[m.type], mp = curMap(), tx = Math.floor(m.x / 16), ty = Math.floor((m.y - 3) / 16);
  for (const [id, n, p] of d.drops) if (p == null || chance(p)) spawnDrop(mp, tx, ty, id, n, 0);
  burst(m.x, m.y - 6, '#e8e0d0', 12); sfx('thud'); game.stats.kills = (game.stats.kills || 0) + 1;
  toast(`${d.n}をたおした！`, 'good');
}
function drawMob(m, time) {
  const fr = MOBSPR[m.type]; if (!fr) return;
  const d = MOBS[m.type], spr = fr[m.dir < 0 ? 1 : 0][Math.floor(m.an) % 2];
  let x = Math.round(m.x - spr.width / 2), y = Math.round(m.y - spr.height);
  if (d.fly) y -= 6 + Math.round(Math.sin(time * 6 + m.seed) * 2);
  if (m.lunge > 0) x += m.dir * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(Math.round(m.x) - 4, Math.round(m.y) - 1, 8, 2);
  if (m.hurt > 0 && Math.floor(time * 30) % 2) ctx.globalAlpha = 0.4;
  ctx.drawImage(spr, x, y); ctx.globalAlpha = 1;
  if (m.hp < d.hp) { ctx.fillStyle = P.ol; ctx.fillRect(Math.round(m.x) - 6, y - 4, 12, 3); ctx.fillStyle = d.kind === 'enemy' ? '#ff5a4a' : '#9fe09a'; ctx.fillRect(Math.round(m.x) - 5, y - 3, Math.max(1, Math.round(10 * m.hp / d.hp)), 1); }
}

/* 演出 */
function burst(x, y, col, n) { for (let i = 0; i < n; i++) state.particles.push({ x, y, vx: rnd(-40, 40), vy: rnd(-70, -10), life: rnd(0.3, 0.6), col }); }
function floatText(x, y, text, col) { state.floats.push({ x, y, text, col, life: 1.1 }); }
function updateFx(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) { const p = state.particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; if (p.life <= 0) state.particles.splice(i, 1); }
  for (let i = state.floats.length - 1; i >= 0; i--) { const f = state.floats[i]; f.life -= dt; f.y -= 14 * dt; if (f.life <= 0) state.floats.splice(i, 1); }
  for (const k in maps) for (const o of maps[k].objs) if (o._shake > 0) o._shake -= dt;
  state.shake = Math.max(0, state.shake - dt); player.lunge = Math.max(0, player.lunge - dt); state.flash = Math.max(0, state.flash - dt);
}

/* 目標とHUD */
function objectiveText() {
  const g = game, f = g.flags;
  if (g.debt <= 0) { if (!g.bp.raft) return '島の西にある古い小屋を調べよう'; if (!g.raftBuilt) return '南の桟橋の先で、いかだを組み立てよう'; return '食料を3個持って、いかだで出航しよう'; }
  if (!f.firstSale) return f.g5 ? '回収ボックスのゼニ丸に素材を売ろう' : '浜辺の小石・流木・ヤシの実などを集めよう';
  if (!g.tools.stoneAxe && !g.tools.ironAxe) return 'メニューの「クラフト」で石斧を作ろう';
  if (!maps.island.objs.some(o => o.t === 'workbench')) return '作業台を設置しよう（クラフト）';
  if (!f.firstRepay) return 'ゼニ丸に借金を返済しよう（利息は毎朝つく）';
  if (!f.diary1) return '島の西にある古い小屋を調べてみよう';
  if (!g.tools.stonePick && !g.tools.ironPick) return 'つるはしを作って岩や鉱脈を掘ろう';
  if (!f.diary2) return '北東の岩山にある洞窟を探索しよう';
  if (!f.m50) return `借金を半分まで返そう（返済率 ${Math.floor(repaidRatio() * 100)}%）`;
  if (!f.turtle) { if (!g.bp.furnace) return 'ゼニ丸から炉の設計図を買おう'; if (!g.bp.iron) return 'ゼニ丸から鉄の道具の設計図を買おう'; if (!g.tools.ironPick) return '炉で鉄インゴットを作り、鉄のつるはしを作ろう'; return '洞窟の奥の硬い岩を砕いて、祠を探そう'; }
  return `借金を完済しよう（残り ${fmt$(g.debt)}）`;
}
const hudCache = {};
function setHud(id, v, prop) { if (hudCache[id + (prop || '')] === v) return; hudCache[id + (prop || '')] = v; const el = $(id); if (!el) return; if (prop) el.style[prop] = v; else el.textContent = v; }
function updateHud() {
  const g = game, left = g.contract.days - g.day + 1;
  setHud('hud-day', `${g.day}日目` + (g.map === 'cave' ? '（洞窟）' : `・${WEATHER[g.weather].n}`));
  setHud('hud-clock', clockText(g.time));
  setHud('hud-money', fmt$(g.money)); setHud('hud-debt', fmt$(Math.max(0, g.debt)));
  setHud('hud-debtbar-fill', Math.round(repaidRatio() * 100) + '%', 'width');
  const dl = $('hud-deadline');
  setHud('hud-deadline', g.debt <= 0 ? '完済！ いかだで脱出しよう' : left <= 1 ? '今日が返済期限！' : `期限まであと${left}日（今日を含む）`);
  dl.classList.toggle('warn', g.debt > 0 && left <= 2);
  const ns = nextStage(), sEl = $('hud-stage');
  setHud('hud-stage', ns ? `締め日 ${ns.day}日目：累計${fmt$(ns.need)}` + (g.repaid >= ns.need ? '（達成）' : `（あと${fmt$(ns.need - g.repaid)}）`) : '');
  if (sEl) sEl.classList.toggle('warn', !!ns && g.repaid < ns.need && ns.day - g.day <= 0);
  const ch = state.conds.map(([t, c]) => `<span class="${c}">${t}</span>`).join(' ');
  if (ch !== state.condHtml) { state.condHtml = ch; const ce = $('hud-cond'); if (ce) ce.innerHTML = ch; }
  for (const [id, v] of [['g-hp', g.hp], ['g-hunger', g.hunger], ['g-thirst', g.thirst], ['g-st', g.stamina]]) {
    const el = $(id), fill = el.querySelector('.g-fill'), w = Math.round(v) + '%';
    if (fill.style.width !== w) fill.style.width = w; el.classList.toggle('low', v < 25);
  }
  const cap = $('hud-cap'), c = invCount(), cp = capacity(); setHud('hud-cap', `持ち物 ${c}/${cp}`); cap.classList.toggle('full', c >= cp);
  setHud('hud-objective', '目標：' + objectiveText());
  updateHotbar();
  // ヒント
  const hint = $('hint');
  if (UI.isOpen() || Dialog.active || state.fading) { hint.classList.add('hidden'); return; }
  let html = null;
  if (state.place) html = `${kb('A')}ここに設置　${kb('B')}やめる<br><span class="sub">${Input.mode === 'touch' ? '置きたいマスをタップ' : Input.mode === 'pad' ? '十字キーで場所を選ぶ' : 'マウスで場所を選んでクリック（右クリックでやめる）'}／自分から${CONFIG.placeRange}マス以内</span>`;
  else if (state.fishing) html = state.fishing.phase === 'bite' ? `<span class="ng">！ 今だ！</span> ${kb('A')}` : `釣り中…「！」が出たら ${kb('A')}　<span class="sub">${kb('B')}やめる</span>`;
  else {
    const th = targetHint(state.target);
    if (th) {
      if (th.info) html = `<span class="sub">${th.info}</span>`;
      else if (th.ng) html = `${kb('A')}${th.act}　<span class="ng">${th.ng}</span>`;
      else if (th.act) {
        html = `${kb('A')}${th.act}` + (th.sub ? ` <span class="sub">(${th.sub})</span>` : '') + (th.gather ? ' <span class="sub">長押し</span>' : '');
        const gs = state.gather; if (th.gather && gs.o && state.target && gs.o === state.target.o) { const gd = OBJ[gs.o.t].g, need = gd.hits[gd.cat ? toolLv(gd.cat) : 0] || 1; html += `<div class="hold"><i style="width:${Math.round(gs.hits / need * 100)}%"></i></div>`; }
      }
    }
  }
  if (html !== state.hintHtml) { state.hintHtml = html; if (html) { hint.innerHTML = html; hint.classList.remove('hidden'); } else hint.classList.add('hidden'); }
}

/* ---------- 20. 描画 ---------- */
let canvas = null, ctx = null, zoom = 4, lightC = null, lightX = null, viewW = 0, viewH = 0;
// アイテムバー（HUD）
let hotEls = null;
function buildHotbar() {
  const bar = $('hotbar'); if (!bar) return; bar.innerHTML = ''; hotEls = [];
  for (let i = 0; i < CONFIG.hotSize; i++) {
    const ic = h('img', { class: 'icon', alt: '', draggable: 'false' }), cnt = h('span', { class: 'hc' }), sl = h('div', { class: 'hslot' }, h('span', { class: 'hn' }, String(i + 1)), ic, cnt);
    sl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (state.scene === 'play' && game && !UI.isOpen() && !state.place) hotSelect(i); });
    bar.appendChild(sl); hotEls.push({ sl, ic, cnt, sig: '' });
  }
  bar.appendChild(h('div', { class: 'hot-name', id: 'hot-name' }));
}
function updateHotbar() {
  if (!hotEls) buildHotbar(); if (!hotEls) return;
  for (let i = 0; i < CONFIG.hotSize; i++) {
    let id = game.hot[i]; if (id && !(game.inv[id] > 0)) { game.hot[i] = null; id = null; }
    const n = id ? game.inv[id] : 0, sel = i === game.hotSel, sig = `${id}|${n}|${sel}`, e = hotEls[i];
    if (e.sig === sig) continue; e.sig = sig;
    e.sl.classList.toggle('on', sel); e.sl.classList.toggle('empty', !id);
    if (id) { e.ic.src = ICON_URL[id] || ICON_URL.bp; e.ic.style.visibility = 'visible'; e.cnt.textContent = n > 1 ? String(n) : ''; }
    else { e.ic.removeAttribute('src'); e.ic.style.visibility = 'hidden'; e.cnt.textContent = ''; }
  }
  const id = hotItem();
  setHud('hot-name', state.hotName > 0 ? (id ? ITEMS[id].n : `${game.hotSel + 1}番：空き`) : '');
}
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3), w = window.innerWidth, hh = window.innerHeight;
  canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(hh * dpr));
  zoom = Math.max(2, Math.floor(Math.min(canvas.width, canvas.height) / (TILE * 11.5)));
}
function drawObj(o, time) {
  let spr = SPR[o.t], x, y, oy = 0;
  switch (o.t) {
    case 'tree': spr = ((o.x * 7 + o.y * 13) % 3 === 0) ? SPR.treeB : SPR.treeA; break;
    case 'bush': spr = o.n > 0 ? SPR.bushB : SPR.bush; break;
    case 'campfire': spr = Math.floor(time * 6) % 2 ? SPR.fire1 : SPR.fire0; break;
    case 'workbench': spr = game && game.up.benchUp ? SPR.bench2 : SPR.bench; break;
    case 'furnace': spr = o.q && o.q.length ? SPR.furnaceOn : SPR.furnace; break;
    case 'raft': spr = game && game.raftBuilt ? SPR.raft : SPR.raftSpot; break;
    case 'diary': oy = Math.round(Math.sin(time * 3)) - 2; break;
    case 'drop': {
      const ic = ICON[o.id]; if (!ic) return; const bob = Math.round(Math.sin(time * 3 + o.x * 0.7));
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(o.x * 16 + 4, o.y * 16 + 13, 8, 2);
      if (o.lock > 0) ctx.globalAlpha = 0.55;
      ctx.drawImage(ic, o.x * 16 + 2, o.y * 16 + 1 + bob, 12, 12); ctx.globalAlpha = 1;
      if (o.n > 1) { ctx.fillStyle = P.ol; ctx.fillRect(o.x * 16 + 10, o.y * 16 + 9 + bob, 6, 5); ctx.fillStyle = '#fff'; ctx.font = '5px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.n > 9 ? '+' : String(o.n), o.x * 16 + 13, o.y * 16 + 11.5 + bob); }
      return;
    }
  }
  if (!spr) return;
  if (o.t === 'liner' && game && game.casino && game.casino.open) spr = SPR.linerLit;
  if (o.t === 'hut' || o.t === 'wreck' || o.t === 'liner') x = o.x * 16; else x = o.x * 16 + Math.floor((16 - spr.width) / 2);
  y = o.y * 16 + 16 - spr.height + oy;
  if (o.t === 'raft' && game && game.raftBuilt) y = o.y * 16 + 2;
  if (o._shake > 0) x += Math.round(Math.sin(o._shake * 80));
  ctx.drawImage(spr, x, y);
  if (o.t === 'palm' && o.n > 0) { const cs = [[5, 10], [9, 11], [7, 12]]; for (let i = 0; i < Math.min(3, o.n); i++) ctx.drawImage(SPR.coco, x + cs[i][0], y + cs[i][1]); }
  if (state.scene === 'play' && OBJ[o.t].it === 'station') {
    if (o.q && o.q.length) { const rec = findProc(OBJ[o.t].st, o.q[0].id), fr = clamp(1 - o.q[0].left / procTime(OBJ[o.t].st, rec), 0, 1); ctx.fillStyle = P.ol; ctx.fillRect(x + 1, y - 4, 14, 3); ctx.fillStyle = P.gold; ctx.fillRect(x + 2, y - 3, Math.round(12 * fr), 1); }
    if (o.out && Object.keys(o.out).length) { const b = Math.round(Math.sin(time * 5) * 1.5); ctx.fillStyle = P.ol; ctx.fillRect(x + 5, y - 13 + b, 6, 8); ctx.fillStyle = P.gold; ctx.fillRect(x + 6, y - 12 + b, 4, 6); ctx.fillStyle = P.ol; ctx.fillRect(x + 7, y - 11 + b, 2, 3); ctx.fillRect(x + 7, y - 7 + b, 2, 1); }
  }
}
function objTop(o) { const spr = o.t === 'tree' ? SPR.treeA : o.t === 'raft' ? SPR.raftSpot : SPR[o.t] || SPR.pebble; return o.y * 16 + 16 - spr.height; }
function render(time) {
  const cw = canvas.width, ch = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  viewW = cw / zoom; viewH = ch / zoom;
  let m, camX, camY;
  if (state.scene === 'title' && titleMap) {
    m = titleMap; const t = state.titleT;
    camX = m.W * 8 + Math.sin(t * 0.05) * m.W * 4 - viewW / 2; camY = m.H * 8 + Math.cos(t * 0.037) * m.H * 3 - viewH / 2;
  } else if (state.scene === 'play' && game) {
    m = curMap(); const mw = m.W * 16, mh = m.H * 16;
    camX = mw <= viewW ? (mw - viewW) / 2 : clamp(player.x - viewW / 2, 0, mw - viewW);
    camY = mh <= viewH ? (mh - viewH) / 2 : clamp(player.y - 8 - viewH / 2, 0, mh - viewH);
    if (state.shake > 0 && settings.shake) { camX += rnd(-2, 2); camY += rnd(-2, 2); }
  } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch); return; }
  camX = Math.round(camX * zoom) / zoom; camY = Math.round(camY * zoom) / zoom;
  state.cam.x = camX; state.cam.y = camY;
  const cave = m.name === 'cave';
  ctx.fillStyle = cave ? '#0d0b12' : '#2b5f9e'; ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
  ctx.drawImage(m.terrain, 0, 0);
  // 波のきらめき
  const tx0 = Math.max(0, Math.floor(camX / 16)), ty0 = Math.max(0, Math.floor(camY / 16)), tx1 = Math.min(m.W - 1, Math.ceil((camX + viewW) / 16)), ty1 = Math.min(m.H - 1, Math.ceil((camY + viewH) / 16));
  if (!cave) for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const v = m.tiles[ty * m.W + tx]; if (!isWater(v) && v !== T.SPRING) continue;
    const h1 = hash2(tx, ty, 3), s = Math.sin(time * 1.3 + h1 * 6.28);
    if (s > 0.55) { ctx.fillStyle = `rgba(255,255,255,${((s - 0.55) * (v === T.SPRING ? 1.6 : 0.9)).toFixed(2)})`; const ox = 2 + Math.floor(h1 * 9), oy = 3 + Math.floor(hash2(ty, tx, 5) * 10); ctx.fillRect(tx * 16 + ox, ty * 16 + oy, 4, 1); ctx.fillRect(tx * 16 + ox + 1, ty * 16 + oy - 1, 2, 1); }
  }
  // 物と人を奥から順に
  const list = [], x0 = camX - 40, x1 = camX + viewW + 40, y0 = camY - 16, y1 = camY + viewH + 48;
  for (const o of m.objs) { const px = o.x * 16, py = o.y * 16; if (px < x0 || px > x1 || py < y0 || py > y1) continue; list.push([OBJ[o.t].block || o.t === 'raft' ? py + 15 : py + 3, o]); }
  if (state.scene === 'play') { list.push([player.y, 'player']); for (const mb of state.mobs) if (mb.map === game.map && mb.x > x0 && mb.x < x1 && mb.y > y0 && mb.y < y1) list.push([mb.y, mb]); }
  const box = m.objs.find(o => o.t === 'box'); if (box) list.push([box.y * 16 + 17, 'drone']);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, it] of list) {
    if (it === 'player') drawPlayerNow(time);
    else if (it.mob) drawMob(it, time);
    else if (it === 'drone') {
      const bx = box.x * 16 + Math.sin(time * 0.8) * 7, by = box.y * 16 - 14 + Math.sin(time * 2.4) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(Math.round(bx) + 4, box.y * 16 + 15, 8, 2);
      ctx.drawImage(Math.floor(time * 12) % 2 ? SPR.drone1 : SPR.drone0, Math.round(bx), Math.round(by));
    } else drawObj(it, time);
  }
  if (state.scene === 'play') drawWorldFx(time);
  // 明かり
  const hr = state.scene === 'play' ? hourOf(game.time) : 12, dark = cave ? 0.93 : darkness(hr);
  if (!cave && state.scene === 'play') { const du = duskAmt(hr); if (du > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,110,40,${(0.12 * du).toFixed(3)})`; ctx.fillRect(0, 0, cw, ch); } }
  if (dark > 0.01) {
    const lw = Math.ceil(viewW / 2) + 2, lh = Math.ceil(viewH / 2) + 2;
    if (lightC.width !== lw || lightC.height !== lh) { lightC.width = lw; lightC.height = lh; }
    lightX.globalCompositeOperation = 'source-over'; lightX.clearRect(0, 0, lw, lh);
    lightX.fillStyle = `rgba(6,8,24,${dark})`; lightX.fillRect(0, 0, lw, lh);
    lightX.globalCompositeOperation = 'destination-out';
    const light = (wx, wy, r) => { const sx = (wx - camX) / 2, sy = (wy - camY) / 2, rr = r / 2; if (sx < -rr || sy < -rr || sx > lw + rr || sy > lh + rr) return; const gr = lightX.createRadialGradient(sx, sy, 0, sx, sy, rr); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); lightX.fillStyle = gr; lightX.beginPath(); lightX.arc(sx, sy, rr, 0, Math.PI * 2); lightX.fill(); };
    const torch = game && game.tools.torch;
    light(player.x, player.y - 8, cave ? (torch ? 84 : 36) : (torch ? 78 : 34));
    const fl = Math.sin(time * 9) * 3 + Math.sin(time * 13) * 2;
    for (const o of m.objs) {
      if (o.t === 'campfire') light(o.x * 16 + 8, o.y * 16 + 8, 72 + fl);
      else if (o.t === 'furnace' && o.q && o.q.length) light(o.x * 16 + 8, o.y * 16 + 10, 40 + fl);
      else if (o.t === 'box') light(o.x * 16 + 8, o.y * 16, 30);
      else if (o.t === 'liner' && game && game.casino && game.casino.open) light(o.x * 16 + 24, o.y * 16, 64);
      else if (o.t === 'diary') light(o.x * 16 + 8, o.y * 16 + 8, 20);
      else if (o.t === 'exit') light(o.x * 16 + 8, o.y * 16 + 8, 56);
      else if (o.t === 'shrine') light(o.x * 16 + 8, o.y * 16, 34);
      else if (o.t === 'crystal') light(o.x * 16 + 8, o.y * 16 + 8, 22);
      else if (o.t === 'goldVein') light(o.x * 16 + 8, o.y * 16 + 8, 14);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lightC, 0, 0, lw, lh, 0, 0, lw * 2 * zoom, lh * 2 * zoom);
    ctx.imageSmoothingEnabled = false;
    if (dark > 0.3) {
      ctx.globalCompositeOperation = 'lighter';
      for (const o of m.objs) if (o.t === 'campfire') { const sx = (o.x * 16 + 8 - camX) * zoom, sy = (o.y * 16 + 8 - camY) * zoom, r = (40 + fl) * zoom; if (sx < -r || sy < -r || sx > cw + r || sy > ch + r) continue; const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, 'rgba(255,140,40,0.22)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = gr; ctx.fillRect(sx - r, sy - r, r * 2, r * 2); }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  if (state.scene === 'play' && !cave) drawWeather(time, cw, ch);
  if (state.scene === 'play' && game.hp < 25) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); const a = 0.25 + Math.sin(time * 4) * 0.1, gr = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    gr.addColorStop(0, 'rgba(180,0,0,0)'); gr.addColorStop(1, `rgba(180,0,0,${a.toFixed(2)})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
  }
  // 夜の敵の目（暗闇でも光る）
  if (state.scene === 'play' && dark > 0.4 && state.mobs.length) {
    ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom); ctx.fillStyle = 'rgba(255,215,80,0.9)';
    for (const mb of state.mobs) if (mb.map === game.map && MOBS[mb.type].kind === 'enemy') { const ey = Math.round(mb.y) - (MOBS[mb.type].fly ? 15 : 9), ex = Math.round(mb.x) + mb.dir * 4; ctx.fillRect(ex, ey, 1, 1); ctx.fillRect(ex - mb.dir * 2, ey, 1, 1); }
  }
  // 設置モードの表示（暗闇の上）
  if (state.scene === 'play' && state.place) {
    const pl = state.place, [ptx, pty] = playerTile(), R = CONFIG.placeRange;
    ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
    for (let y = pty - R; y <= pty + R; y++) for (let x = ptx - R; x <= ptx + R; x++) {
      if (Math.hypot(x - ptx, y - pty) > R) continue;
      ctx.fillStyle = placeOk(x, y) ? 'rgba(160,255,160,0.13)' : 'rgba(0,0,0,0.12)'; ctx.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
    }
    const okp = placeOk(pl.tx, pl.ty), spr = SPR[PLACE_SPR[pl.r.build]];
    if (spr) { ctx.globalAlpha = 0.6 + Math.sin(time * 6) * 0.15; ctx.drawImage(spr, pl.tx * 16 + Math.floor((16 - spr.width) / 2), pl.ty * 16 + 16 - spr.height); ctx.globalAlpha = 1; }
    ctx.strokeStyle = okp ? '#7dff8a' : '#ff6a5a'; ctx.lineWidth = 1; ctx.strokeRect(pl.tx * 16 + 0.5, pl.ty * 16 + 0.5, 15, 15);
  }
  // 文字（暗闇の上に表示）
  if (state.scene === 'play' && state.floats.length) {
    ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
    ctx.font = '8px "DotGothic16", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    for (const f of state.floats) { ctx.globalAlpha = clamp(f.life * 2, 0, 1); ctx.strokeStyle = P.ol; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
  }
}
// 天気の表示（画面座標）
function drawWeather(time, cw, ch) {
  const w = game.weather; ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (w === 'cloud' || w === 'rain' || w === 'storm') { ctx.fillStyle = `rgba(30,40,60,${w === 'storm' ? 0.28 : w === 'rain' ? 0.16 : 0.1})`; ctx.fillRect(0, 0, cw, ch); }
  if (w === 'rain' || w === 'storm') {
    const n = w === 'storm' ? 150 : 85, len = ch * 0.025, slant = w === 'storm' ? 0.35 : 0.12;
    ctx.strokeStyle = 'rgba(190,210,240,0.45)'; ctx.lineWidth = Math.max(1, zoom * 0.35); ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = (0.7 + hash2(i, 3, 9) * 0.5) * ch * 1.5, y = ((hash2(i, 2, 7) * (ch + 60) + time * sp) % (ch + 60)) - 30;
      const x = ((hash2(i, 1, 7) * cw - y * slant) % cw + cw) % cw;
      ctx.moveTo(x, y); ctx.lineTo(x - len * slant, y + len);
    }
    ctx.stroke();
  }
  if (state.flash > 0) { ctx.fillStyle = `rgba(235,240,255,${Math.min(0.55, state.flash * 1.6).toFixed(2)})`; ctx.fillRect(0, 0, cw, ch); }
}
function drawPlayerNow(time) {
  const fr = player.moving ? [1, 0, 2, 0][Math.floor(player.anim) % 4] : 0, spr = PL[player.dir][fr];
  let lx = 0, ly = 0; if (player.lunge > 0) { lx = DIRV[player.dir][0]; ly = DIRV[player.dir][1]; }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(player.x) - 5, Math.round(player.y) - 1, 10, 2);
  if (!(state.invuln > 0 && Math.floor(time * 20) % 2)) ctx.drawImage(spr, Math.round(player.x) - 8 + lx, Math.round(player.y) - 16 + ly);
  if (state.swing > 0) {
    const [vx, vy] = DIRV[player.dir], a0 = Math.atan2(vy, vx), k = 1 - state.swing / 0.15;
    ctx.strokeStyle = `rgba(255,255,255,${(0.9 - k * 0.6).toFixed(2)})`; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.arc(player.x + vx * 4, player.y - 7 + vy * 4, 10, a0 - 1.1 + k * 0.6, a0 + 0.4 + k * 0.6); ctx.stroke();
  }
  const f = state.fishing;
  if (f) {
    const hx = player.x + DIRV[player.dir][0] * 6, hy = player.y - 9, by = f.by + Math.round(Math.sin(time * 4) * (f.phase === 'bite' ? 2 : 0.6));
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(f.bx, by); ctx.stroke();
    ctx.drawImage(SPR.bob, Math.round(f.bx) - 2, Math.round(by) - 2);
    if (f.phase === 'bite') { ctx.fillStyle = P.ol; ctx.fillRect(Math.round(player.x) - 2, Math.round(player.y) - 30, 5, 10); ctx.fillStyle = '#ff5a4a'; ctx.fillRect(Math.round(player.x) - 1, Math.round(player.y) - 29, 3, 5); ctx.fillRect(Math.round(player.x) - 1, Math.round(player.y) - 23, 3, 2); }
  }
}
function drawWorldFx(time) {
  // 対象マーカー
  const tg = state.target;
  if (tg && !state.fishing && !UI.isOpen() && !Dialog.active) {
    let cx, top;
    if (tg.kind === 'mob') { cx = Math.round(tg.m.x); top = Math.round(tg.m.y) - (MOBS[tg.m.type].fly ? 22 : 14); }
    else if (tg.kind === 'obj') { const o = tg.o, fp = OBJ[o.t].fp; cx = o.x * 16 + 8 + (o.t === 'hut' ? 8 : o.t === 'wreck' || o.t === 'liner' ? 16 : 0); top = objTop(o) + (o.t === 'diary' ? -2 : 0); if (fp && o.t === 'cave') top = o.y * 16 - 8; }
    else if (tg.kind === 'spring' || tg.kind === 'water') { const [vx, vy] = DIRV[player.dir]; const tx = Math.floor((player.x + vx * 11) / 16), ty = Math.floor((player.y - 4 + vy * 11) / 16); cx = tx * 16 + 8; top = ty * 16 + 4; if (tg.kind === 'water' && !game.tools.rod) cx = null; }
    if (cx != null) { const b = Math.round(Math.sin(time * 6) * 1.5), y = top - 7 + b; ctx.fillStyle = P.ol; ctx.fillRect(cx - 4, y - 1, 9, 2); ctx.fillRect(cx - 3, y + 1, 7, 1); ctx.fillRect(cx - 2, y + 2, 5, 1); ctx.fillRect(cx - 1, y + 3, 3, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 3, y, 7, 1); ctx.fillRect(cx - 2, y + 1, 5, 1); ctx.fillRect(cx - 1, y + 2, 3, 1); }
  }
  for (const r of state.rocks) {
    const k = clamp(1 - r.t / 1.2, 0, 1); ctx.fillStyle = `rgba(0,0,0,${(0.2 + k * 0.35).toFixed(2)})`;
    const w = Math.round(4 + k * 6); ctx.fillRect(Math.round(r.x - w / 2), Math.round(r.y) - 1, w, 3);
    ctx.drawImage(SPR.rock, Math.round(r.x) - 4, Math.round(r.y - r.t * 80) - 6);
  }
  for (const p of state.particles) { ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
}

/* ---------- 21. メインループ ---------- */
let lastT = 0;
function frame(ts) {
  const now = ts / 1000, dt = Math.min(0.05, Math.max(0, now - (lastT || now))); lastT = now;
  try {
    state.time += dt;
    Input.poll();
    if (state.scene === 'title') state.titleT += dt;
    if (Dialog.active) Dialog.update(dt);
    else if (UI.isOpen()) UI.update(dt);
    else if (state.scene === 'play' && !state.fading) { if (state.place) updatePlace(); else gameUpdate(dt); }
    if (state.scene === 'play' && game) { processTalks(); updateFx(dt); updateHud(); }
    render(now);
  } catch (e) { console.error(e); }
  Input.endFrame();
  requestAnimationFrame(frame);
}
function init() {
  canvas = $('game'); ctx = canvas.getContext('2d'); lightC = mkCanvas(8, 8); lightX = lightC.getContext('2d');
  UI.root = $('modal-root');
  loadSettings();
  buildSprites(); buildIcons(); buildPortraits(); buildMobSprites();
  setupInput(); applySettings(); migrateLegacySave(); buildHotbar();
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) setInputMode('touch');
  resize(); window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  showTitle();
  requestAnimationFrame(frame);
  window.__mujintou = { get game() { return game; }, get slot() { return curSlot; }, maps, state, player, newDay, endGame, saveGame, loadGame, isBlocked, objAt, dropItem, spawnDrop, startPlace, confirmPlace, placeOk, rollFish, stagesOf, consume, spawnMob, attackMob, openHut, storeMove, openLiner, openCasino, slotPay, zeniGamble };
}
if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
else if (typeof module !== 'undefined') module.exports = { genIsland, genCave, T, WALK, OBJ, isLandT, isWater };
})();
