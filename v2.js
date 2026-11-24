/* COURTS 2.0 — two tracks: Vision (Roboflow) and Community (check-ins). No build step, no API keys needed to run. */
(function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/* ---------- constants ---------- */
const SP = {
  basketball: { icon: '🏀', name: 'Basketball', per: 10 },
  tennis: { icon: '🎾', name: 'Tennis', per: 4 },
  pickleball: { icon: '🏓', name: 'Pickleball', per: 4 },
  soccer: { icon: '⚽', name: 'Soccer', per: 22 },
  volleyball: { icon: '🏐', name: 'Volleyball', per: 12 }
};
const ST = {
  available: { label: 'Open', color: 'var(--green)' },
  busy: { label: 'Busy', color: 'var(--amber)' },
  full: { label: 'Full', color: 'var(--red)' },
  unknown: { label: 'No data', color: 'var(--grey)' }
};
const LEVELS = [
  { n: 1, label: 'Empty', occ: 0.05, color: '#16a34a' },
  { n: 2, label: 'Light', occ: 0.28, color: '#84cc16' },
  { n: 3, label: 'Moderate', occ: 0.55, color: '#f59e0b' },
  { n: 4, label: 'Busy', occ: 0.8, color: '#f97316' },
  { n: 5, label: 'Full', occ: 0.97, color: '#dc2626' }
];
const MODELS = [
  { id: 'basketball-court-ecb9s/2', name: 'Basketball players (YOLOv8n)', count: ['player'] },
  { id: 'pickleball-people-detection/1', name: 'Pickleball people (YOLOv8n)', count: ['people'] },
  { id: 'tennis-court-checker/13', name: 'Tennis court checker (YOLOv5n)', count: ['person', 'tennis-player'] }
];
const COURTS = window.COURTS_DATA;
const FRAMES = window.VISION_FRAMES.map(f => ({ ...f, preds: f.preds.map(p => ({ x: p[0], y: p[1], width: p[2], height: p[3], confidence: p[4], class: p[5] })) }));
const DEFAULT_CENTER = [37.7749, -122.4194];

/* ---------- state ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('courts2.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('courts2.' + k, JSON.stringify(v)); } catch (e) {} }
};
const params = new URLSearchParams(location.search);
const state = {
  track: params.get('track') === 'community' ? 'community' : params.get('track') === 'vision' ? 'vision' : store.get('track', 'vision'),
  view: 'explore', sport: 'all', status: 'all', q: '', sel: null,
  favs: store.get('favs', []), alerts: store.get('alerts', []), premium: store.get('premium', false),
  checkins: store.get('checkins', []), user: store.get('user', { name: 'Guest player', points: 0 }),
  rf: store.get('rf', { key: '', model: MODELS[0].id }),
  demoHour: null, labOv: {}, pos: null, anon: false
};
const save = () => { store.set('track', state.track); store.set('favs', state.favs); store.set('alerts', state.alerts); store.set('premium', state.premium); store.set('checkins', state.checkins); store.set('user', state.user); store.set('rf', state.rf); };
const byId = id => COURTS.find(c => c.id === +id);
const nowHour = () => state.demoHour != null ? state.demoHour : (new Date().getHours() + new Date().getMinutes() / 60);
const cap = c => c.courts * SP[c.sport].per;

/* ---------- deterministic random ---------- */
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hourFactor(h) {
  const pts = [[0, .02], [6, .1], [8, .35], [12, .45], [15, .5], [17, .85], [19, 1], [21, .5], [23, .08], [24, .02]];
  h = ((h % 24) + 24) % 24;
  for (let i = 1; i < pts.length; i++) if (h <= pts[i][0]) { const [a, fa] = pts[i - 1], [b, fb] = pts[i]; return fa + (fb - fa) * (h - a) / (b - a); }
  return .02;
}

/* ---------- community reports ---------- */
let reports = [];  // {court, level, ts, seed, user}
function seedReports() {
  reports = reports.filter(r => !r.seed);
  const now = Date.now();
  COURTS.forEach(c => {
    const r = rng(c.id * 97 + Math.round(nowHour() * 4));
    const n = 2 + Math.round(c.pop * 3 * r());
    for (let i = 0; i < n; i++) {
      const age = 3 + r() * 110;
      const f = Math.min(1, hourFactor(nowHour() - age / 60) * c.pop * (0.8 + r() * 0.4));
      const lv = Math.max(1, Math.min(5, 1 + Math.round(f * 4.2)));
      reports.push({ court: c.id, level: lv, ts: now - age * 60000, seed: true, user: ['Maya', 'Leo', 'Sam', 'Jo', 'Ines', 'Theo'][Math.floor(r() * 6)] });
    }
  });
  state.checkins.forEach(k => { if (!reports.find(r => r.ts === k.ts && r.court === k.court)) reports.push({ court: k.court, level: k.level, ts: k.ts, user: 'You' }); });
}
function commOcc(c) {
  const now = Date.now(); let w = 0, s = 0, n = 0, last = 0;
  reports.filter(r => r.court === c.id).forEach(r => {
    const age = (now - r.ts) / 60000; if (age > 120) return;
    const wt = Math.exp(-age / 35) * (r.user === 'You' ? 1.2 : 1);
    w += wt; s += wt * LEVELS[r.level - 1].occ; n++; last = Math.max(last, r.ts);
  });
  return n ? { occ: s / w, n, ts: last } : null;
}

/* ---------- vision simulation ---------- */
const sim = {};
function simInit() {
  COURTS.filter(c => c.cam).forEach(c => { sim[c.id] = { players: [], count: 0, ts: Date.now() }; simStep(c, true); });
}
function simTarget(c) { const r = Math.random(); return Math.max(0, Math.min(Math.round(cap(c) * 1.1), Math.round(cap(c) * hourFactor(nowHour()) * c.pop * (0.85 + 0.3 * r)))); }
function simStep(c, snap) {
  const s = sim[c.id]; if (!s) return;
  const t = simTarget(c);
  let n = s.count;
  if (snap) n = t; else if (n < t) n += 1 + (Math.random() < .3); else if (n > t) n -= 1 + (Math.random() < .3);
  n = Math.max(0, n);
  while (s.players.length < n) s.players.push({ x: .08 + Math.random() * .84, y: .1 + Math.random() * .8, vx: (Math.random() - .5) * .05, vy: (Math.random() - .5) * .05, conf: .62 + Math.random() * .35, hue: Math.floor(Math.random() * 360) });
  while (s.players.length > n) s.players.splice(Math.floor(Math.random() * s.players.length), 1);
  s.count = n; s.ts = Date.now();
}
function simMove(dt) {
  Object.values(sim).forEach(s => s.players.forEach(p => {
    p.vx += (Math.random() - .5) * .02; p.vy += (Math.random() - .5) * .02;
    p.vx = Math.max(-.07, Math.min(.07, p.vx)); p.vy = Math.max(-.07, Math.min(.07, p.vy));
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < .04 || p.x > .96) { p.vx *= -1; p.x = Math.max(.04, Math.min(.96, p.x)); }
    if (p.y < .06 || p.y > .94) { p.vy *= -1; p.y = Math.max(.06, Math.min(.94, p.y)); }
  }));
}

/* ---------- unified reading ---------- */
function statusOf(occ) { return occ == null ? 'unknown' : occ < .4 ? 'available' : occ < .85 ? 'busy' : 'full'; }
function reading(c) {
  const k = cap(c);
  if (state.track === 'vision') {
    const ov = state.labOv[c.id];
    if (ov) return { src: 'lab', count: ov.count, occ: Math.min(1, ov.count / k), ts: ov.ts, cap: k };
    if (c.cam && sim[c.id]) { const s = sim[c.id]; return { src: 'camera', count: s.count, occ: Math.min(1, s.count / k), ts: s.ts, cap: k }; }
  }
  const m = commOcc(c);
  if (m) return { src: 'community', occ: m.occ, n: m.n, ts: m.ts, cap: k, count: null };
  return { src: 'none', occ: null, cap: k };
}
const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
function srcBadge(r) {
  if (r.src === 'camera') return '<span class="src vis">📷 Camera · live</span>';
  if (r.src === 'lab') return '<span class="src vis">🧪 Roboflow lab · ' + ago(r.ts) + '</span>';
  if (r.src === 'community') return '<span class="src">👥 ' + r.n + ' report' + (r.n > 1 ? 's' : '') + ' · ' + ago(r.ts) + '</span>';
  return '<span class="src">No reports yet</span>';
}
const pill = st => '<span class="pill" style="background:' + ST[st].color + '">' + ST[st].label + '</span>';
function waitEst(r) { if (r.occ == null || r.occ < .85) return 0; return Math.max(5, Math.round(((r.count != null ? r.count : r.occ * r.cap) - r.cap * .8) * 4)); }
function dist(c) {
  const p = state.pos || { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
  const R = 6371, dLat = (c.lat - p.lat) * Math.PI / 180, dLng = (c.lng - p.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * Math.PI / 180) * Math.cos(c.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a)) * 0.621371;
}

/* ---------- toast / modal ---------- */
function toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; $('#toasts').appendChild(d); setTimeout(() => d.remove(), 3400); }
function modal(html) { const m = $('#modal'); m.innerHTML = '<div class="modal"><div class="sheet">' + html + '</div></div>'; $('.modal', m).addEventListener('click', e => { if (e.target.classList.contains('modal')) closeModal(); }); }
function closeModal() { $('#modal').innerHTML = ''; }

/* ---------- map ---------- */
let map, markers = {};
function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap contributors © CARTO' }).addTo(map);
  COURTS.forEach(c => {
    const m = L.marker([c.lat, c.lng], { icon: pinIcon(c) }).addTo(map);
    m.on('click', () => openCourt(c.id));
    markers[c.id] = m;
  });
  fitAll();
}
function pinIcon(c) {
  const r = reading(c), st = statusOf(r.occ);
  const lbl = r.count != null ? r.count : (r.occ == null ? '?' : LEVELS[Math.min(4, Math.floor(r.occ * 5))].n);
  return L.divIcon({ className: '', html: '<div class="pin s-' + st + (state.sel === c.id ? ' sel' : '') + '"><span>' + lbl + '</span></div>', iconSize: [34, 34], iconAnchor: [17, 34] });
}
function updatePins() {
  COURTS.forEach(c => {
    const vis = matches(c);
    const m = markers[c.id]; if (!m) return;
    m.setIcon(pinIcon(c));
    if (vis && !map.hasLayer(m)) m.addTo(map);
    if (!vis && map.hasLayer(m)) map.removeLayer(m);
  });
}
function fitAll() { const v = COURTS.filter(matches); if (v.length) map.fitBounds(L.latLngBounds(v.map(c => [c.lat, c.lng])), { padding: [40, 40], maxZoom: 14 }); }

/* ---------- filters / list ---------- */
function matches(c) {
  if (state.sport !== 'all' && c.sport !== state.sport) return false;
  if (state.status !== 'all' && statusOf(reading(c).occ) !== state.status) return false;
  if (state.q) { const q = state.q.toLowerCase(); if (!(c.name + ' ' + c.address + ' ' + c.sport).toLowerCase().includes(q)) return false; }
  return true;
}
function cardHTML(c) {
  const r = reading(c), st = statusOf(r.occ), fav = state.favs.includes(c.id);
  return '<div class="card court" data-open="' + c.id + '"><div class="ico">' + SP[c.sport].icon + '</div><div class="meta"><div class="nm">' + esc(c.name) + '</div>' +
    '<div class="sub">' + pill(st) + (r.count != null ? '<b>' + r.count + '/' + r.cap + ' players</b>' : '') + srcBadge(r) + '<span>' + dist(c).toFixed(1) + ' mi</span></div>' +
    '<div class="bar"><i style="width:' + Math.round((r.occ || 0) * 100) + '%;background:' + ST[st].color + '"></i></div></div>' +
    '<button class="fav ' + (fav ? 'on' : '') + '" data-fav="' + c.id + '" aria-label="Favorite">' + (fav ? '♥' : '♡') + '</button></div>';
}
function renderPanel() {
  const p = $('#panel');
  if (state.sel) { renderDetail(); return; }
  const list = COURTS.filter(matches).sort((a, b) => dist(a) - dist(b));
  const favs = COURTS.filter(c => state.favs.includes(c.id));
  p.innerHTML =
    '<div class="search"><input id="q" placeholder="Search courts, sports, neighborhoods" value="' + esc(state.q) + '"><button class="btn primary" id="addUpd">+ Report</button></div>' +
    '<div class="chips" id="sportChips">' + ['all', ...Object.keys(SP)].map(s => '<button class="chip ' + (state.sport === s ? 'on' : '') + '" data-sport="' + s + '">' + (s === 'all' ? 'All sports' : SP[s].icon + ' ' + SP[s].name) + '</button>').join('') + '</div>' +
    '<div class="chips">' + ['all', 'available', 'busy', 'full'].map(s => '<button class="chip ' + (state.status === s ? 'on' : '') + '" data-status="' + s + '">' + (s === 'all' ? 'Any status' : ST[s].label) + '</button>').join('') + '</div>' +
    (state.track === 'vision' ? '<div class="note vio">Vision track: courts with a camera show live player counts from computer vision; others fall back to community reports.</div>' : '<div class="note ok">Community track: status comes from player check-ins, weighted by how recent they are.</div>') +
    (favs.length ? '<div class="h2">Favorites</div><div id="favs">' + favs.map(cardHTML).join('') + '</div>' : '') +
    '<div class="h2">Nearby courts · ' + list.length + '</div><div id="cards">' + (list.map(cardHTML).join('') || '<div class="card muted">No courts match those filters.</div>') + '</div>';
}
function refreshCards() {
  if (state.sel) { updateDetail(); return; }
  const c = $('#cards'); if (!c) return;
  const list = COURTS.filter(matches).sort((a, b) => dist(a) - dist(b));
  c.innerHTML = list.map(cardHTML).join('') || '<div class="card muted">No courts match those filters.</div>';
  const f = $('#favs'); if (f) f.innerHTML = COURTS.filter(x => state.favs.includes(x.id)).map(cardHTML).join('');
}

/* ---------- court detail ---------- */
function ringSVG(occ, st) {
  const R = 40, C = 2 * Math.PI * R, v = occ == null ? 0 : occ;
  return '<svg width="92" height="92" viewBox="0 0 92 92"><circle cx="46" cy="46" r="' + R + '" fill="none" stroke="#e2e8f0" stroke-width="9"/><circle id="ringArc" cx="46" cy="46" r="' + R + '" fill="none" stroke="' + ST[st].color + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + C * (1 - v) + '" style="transition:stroke-dashoffset .6s"/></svg>';
}
function busyData(c) {
  const out = []; for (let h = 6; h <= 22; h++) out.push({ h, v: Math.min(1, hourFactor(h) * c.pop) }); return out;
}
function chartHTML(c) {
  const d = busyData(c), nh = Math.floor(nowHour());
  const best = d.filter(x => x.h >= 8 && x.h <= 20).sort((a, b) => a.v - b.v)[0];
  const bars = d.map(x => '<i class="' + (x.v < .4 ? 'l0' : x.v < .75 ? 'l1' : 'l2') + (x.h === nh ? ' now' : '') + '" style="height:' + Math.max(4, x.v * 100) + '%" title="' + x.h + ':00"></i>').join('');
  const fmt = h => (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
  return { best: fmt(best.h), html: '<div class="chart">' + bars + '</div><div class="chartx"><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>10 PM</span></div>' };
}
function renderDetail() {
  const c = byId(state.sel), r = reading(c), st = statusOf(r.occ), ch = chartHTML(c), fav = state.favs.includes(c.id), alerted = state.alerts.includes(c.id);
  const hasCam = state.track === 'vision' && (c.cam || state.labOv[c.id]);
  const recent = reports.filter(x => x.court === c.id).sort((a, b) => b.ts - a.ts).slice(0, 5);
  $('#panel').innerHTML =
    '<button class="back" id="backBtn">← All courts</button>' +
    '<div class="card"><div class="dh"><div class="ring" id="ring">' + ringSVG(r.occ, st) + '<b id="ringTxt">' + (r.occ == null ? '–' : Math.round(r.occ * 100) + '%') + '<small>full</small></b></div>' +
    '<div><div style="font-size:19px;font-weight:800;font-family:\'Space Grotesk\',Inter,sans-serif">' + esc(c.name) + '</div><div class="muted">' + esc(c.address) + '</div><div class="row" style="margin-top:8px" id="dStat">' + pill(st) + srcBadge(r) + '</div></div></div>' +
    '<div class="kv"><div>Players now<b id="dPlayers">' + (r.count != null ? r.count + ' / ' + r.cap : '≈ ' + (r.occ != null ? Math.round(r.occ * r.cap) : '–') + ' / ' + r.cap) + '</b></div><div>Est. wait<b id="dWait">' + (waitEst(r) ? '~' + waitEst(r) + ' min' : 'None') + '</b></div>' +
    '<div>Courts<b>' + c.courts + ' · ' + SP[c.sport].name + '</b></div><div>Hours<b style="font-size:13px">' + esc(c.hours) + '</b></div></div>' +
    '<div class="row" style="margin-top:12px"><button class="btn primary" style="flex:1" id="ciBtn">Check in</button><button class="btn" id="favBtn">' + (fav ? '♥ Saved' : '♡ Save') + '</button><button class="btn" id="alBtn">' + (alerted ? '🔔 Alert on' : '🔕 Alert me') + '</button></div></div>' +
    (hasCam ? '<div class="card"><div class="h2" style="margin-top:0">Live vision' + (state.labOv[c.id] ? ' (lab frame)' : ' (simulated feed)') + '</div><div class="cam"><canvas id="camMain"></canvas><span class="tag"><i></i>LIVE · ROBOFLOW</span><span class="hud" id="camHud"></span></div><div class="muted" style="margin-top:6px">Only the player count leaves the camera. No video is stored or shown to users; detections are anonymous boxes.</div></div>' : '') +
    '<div class="card"><div class="h2" style="margin-top:0">Busy hours</div><div class="row"><b>Quietest: ' + ch.best + '</b><span class="muted">· now highlighted</span></div>' +
    '<div class="lock">' + ch.html + (state.premium ? '' : '<div class="veil"><div><b>Premium analytics</b><div class="muted" style="margin:4px 0 8px">Hourly traffic, trends and predictions</div><button class="btn primary sm" id="premBtn">Unlock · $3.99/mo</button></div></div>') + '</div></div>' +
    '<div class="card"><div class="h2" style="margin-top:0">Recent check-ins</div>' + (recent.length ? recent.map(x => '<div class="rep"><span class="lv" style="background:' + LEVELS[x.level - 1].color + '">' + x.level + '</span><div style="flex:1"><b>' + LEVELS[x.level - 1].label + '</b> <span class="muted">by ' + esc(x.user) + '</span></div><span class="muted">' + ago(x.ts) + '</span></div>').join('') : '<div class="muted">No check-ins yet. Be the first.</div>') + '</div>';
  if (hasCam) registerCam($('#camMain'), c.id, true);
}
function updateDetail() {
  const c = byId(state.sel); if (!c) return;
  const r = reading(c), st = statusOf(r.occ);
  const set = (id, h) => { const e = $(id); if (e) e.innerHTML = h; };
  set('#dStat', pill(st) + srcBadge(r));
  set('#dPlayers', r.count != null ? r.count + ' / ' + r.cap : '≈ ' + (r.occ != null ? Math.round(r.occ * r.cap) : '–') + ' / ' + r.cap);
  set('#dWait', waitEst(r) ? '~' + waitEst(r) + ' min' : 'None');
  const t = $('#ringTxt'); if (t) t.firstChild.textContent = r.occ == null ? '–' : Math.round(r.occ * 100) + '%';
  const a = $('#ringArc'); if (a) { a.setAttribute('stroke', ST[st].color); const C = 2 * Math.PI * 40; a.setAttribute('stroke-dashoffset', C * (1 - (r.occ || 0))); }
}
function openCourt(id) {
  state.sel = +id; cams.length = 0; go('explore', true); renderPanel(); updatePins();
  const c = byId(id); map.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 14), { duration: .6 });
  $('#panel').scrollTop = 0;
}
function closeCourt() { state.sel = null; cams.length = 0; renderPanel(); updatePins(); }

/* ---------- camera canvases (simulated feeds) ---------- */
const cams = [];  // {canvas, id, big}
function registerCam(canvas, id, big) { if (canvas) cams.push({ canvas, id, big }); }
function courtLines(ctx, w, h, c) {
  ctx.fillStyle = { basketball: '#b9824f', tennis: '#3f7f5f', pickleball: '#3c6fa8', soccer: '#3f8f46', volleyball: '#d9b36a' }[c.sport];
  ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, w / 320);
  const k = Math.min(c.courts, 4), cols = k > 1 ? 2 : 1, rows = Math.ceil(k / cols), tw = w / cols, th = h / rows;
  for (let i = 0; i < k; i++) {
    const x = (i % cols) * tw + tw * .05, y = Math.floor(i / cols) * th + th * .06, ww = tw * .9, hh = th * .88;
    ctx.strokeRect(x, y, ww, hh); ctx.beginPath(); ctx.moveTo(x + ww / 2, y); ctx.lineTo(x + ww / 2, y + hh); ctx.stroke();
    if (c.sport === 'basketball' || c.sport === 'soccer') { ctx.beginPath(); ctx.arc(x + ww / 2, y + hh / 2, hh * .14, 0, 7); ctx.stroke(); }
    if (c.sport === 'basketball') { ctx.strokeRect(x, y + hh * .35, ww * .18, hh * .3); ctx.strokeRect(x + ww * .82, y + hh * .35, ww * .18, hh * .3); }
    if (c.sport === 'tennis') { ctx.strokeRect(x + ww * .15, y + hh * .12, ww * .7, hh * .76); ctx.beginPath(); ctx.moveTo(x + ww * .25, y + hh * .12); ctx.lineTo(x + ww * .25, y + hh * .88); ctx.moveTo(x + ww * .75, y + hh * .12); ctx.lineTo(x + ww * .75, y + hh * .88); ctx.stroke(); }
    if (c.sport === 'pickleball') { ctx.beginPath(); ctx.moveTo(x + ww * .3, y); ctx.lineTo(x + ww * .3, y + hh); ctx.moveTo(x + ww * .7, y); ctx.lineTo(x + ww * .7, y + hh); ctx.stroke(); }
    if (c.sport === 'volleyball') { ctx.beginPath(); ctx.moveTo(x + ww * .33, y); ctx.lineTo(x + ww * .33, y + hh); ctx.moveTo(x + ww * .67, y); ctx.lineTo(x + ww * .67, y + hh); ctx.stroke(); }
  }
}
function drawCam(cm) {
  const cv = cm.canvas; if (!cv.isConnected) return false;
  const c = byId(cm.id), W = cv.clientWidth || 300, H = cv.clientHeight || 190;
  if (cv.width !== W * 2) { cv.width = W * 2; cv.height = H * 2; }
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
  courtLines(ctx, w, h, c);
  let players = [];
  if (state.labOv[c.id]) { const n = state.labOv[c.id].count; const r = rng(c.id); players = Array.from({ length: n }, () => ({ x: .1 + r() * .8, y: .12 + r() * .76, conf: .7 + r() * .27, hue: r() * 360 })); }
  else if (sim[c.id]) players = sim[c.id].players;
  const bw = Math.max(16, w * (cm.big ? .045 : .06)), bh = bw * 1.6;
  ctx.font = Math.max(9, w / (cm.big ? 70 : 36)) + 'px Inter,sans-serif'; ctx.textBaseline = 'bottom';
  players.forEach(p => {
    const x = p.x * w, y = p.y * h;
    ctx.fillStyle = 'hsl(' + p.hue + ',70%,55%)'; ctx.beginPath(); ctx.arc(x, y, bw * .28, 0, 7); ctx.fill();
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2; ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
    if (cm.big || w > 500) { const t = 'Player ' + p.conf.toFixed(2); const tw = ctx.measureText(t).width + 6; ctx.fillStyle = '#7c3aed'; ctx.fillRect(x - bw / 2, y - bh / 2 - 14, tw, 14); ctx.fillStyle = '#fff'; ctx.fillText(t, x - bw / 2 + 3, y - bh / 2 - 1); }
  });
  const r = reading(c), st = statusOf(r.occ);
  if (cm.big) { const hud = $('#camHud'); if (hud) hud.textContent = (r.count != null ? r.count : '–') + ' players · ' + Math.round((r.occ || 0) * 100) + '% · ' + ST[st].label; }
  else { const e = cv.parentElement.querySelector('.hud'); if (e) e.innerHTML = (r.count != null ? r.count : '–') + ' / ' + r.cap + ' · ' + ST[st].label; }
  return true;
}
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(.1, (t - lastT) / 1000); lastT = t;
  simMove(dt * 4);
  for (let i = cams.length - 1; i >= 0; i--) if (!drawCam(cams[i])) cams.splice(i, 1);
  labFrame();
  requestAnimationFrame(frame);
}

/* ---------- check-in ---------- */
function openCheckIn(preId) {
  const c = preId ? byId(preId) : null;
  modal('<h3>' + (c ? 'Check in · ' + esc(c.name) : 'Report a court') + '</h3><div class="muted">How busy is it right now?</div>' +
    (c ? '' : '<div class="field" style="margin-top:10px">Court<select id="ciCourt">' + COURTS.map(x => '<option value="' + x.id + '">' + esc(x.name) + '</option>').join('') + '</select></div>') +
    '<div class="lvls" id="lvls">' + LEVELS.map(l => '<button data-lv="' + l.n + '"><i style="background:' + l.color + '"></i>' + l.label + '</button>').join('') + '</div>' +
    '<div class="field">Photo (optional)<input type="file" id="ciPhoto" accept="image/*" capture="environment"></div><div id="ciAI"></div>' +
    '<div class="field">How long will you play? (min)<input type="number" id="ciDur" min="0" placeholder="60"></div>' +
    '<div class="field">Comment<input id="ciCom" placeholder="Courts 2 and 3 are free"></div>' +
    '<div class="row"><button class="btn" id="ciCancel">Cancel</button><button class="btn primary" style="flex:1" id="ciSubmit" disabled>Submit check-in</button></div>');
  let lv = 0, verified = false, photoAI = false;
  const sync = () => { $$('#lvls button').forEach(b => b.classList.toggle('on', +b.dataset.lv === lv)); $('#ciSubmit').disabled = !lv; };
  $('#lvls').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { lv = +b.dataset.lv; sync(); } });
  $('#ciCancel').onclick = closeModal;
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => { state.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; const cc = c || byId($('#ciCourt').value); verified = dist(cc) < .2; }, () => {}, { timeout: 4000 });
  $('#ciPhoto').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const box = $('#ciAI');
    if (!state.rf.key) { box.innerHTML = '<div class="note">Add your Roboflow key in the Vision Lab and this photo will be counted automatically.</div>'; return; }
    box.innerHTML = '<div class="note vio">Counting players with Roboflow…</div>';
    try {
      const dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
      const cc = c || byId($('#ciCourt').value), d = await rfInfer({ b64: dataUrl.split(',')[1] });
      const n = countOf(d.predictions, state.rf.model, 0.4), occ = Math.min(1, n / cap(cc));
      lv = Math.max(1, Math.min(5, 1 + Math.floor(occ * 4.99))); photoAI = true; sync();
      box.innerHTML = '<div class="note ok">Roboflow counted <b>' + n + '</b> players → suggested level <b>' + LEVELS[lv - 1].label + '</b>. Change it if it looks wrong.</div>';
    } catch (err) { box.innerHTML = '<div class="note">' + esc(err.message) + '</div>'; }
  };
  $('#ciSubmit').onclick = () => {
    const id = c ? c.id : +$('#ciCourt').value, ts = Date.now();
    state.checkins.unshift({ court: id, level: lv, ts, comment: $('#ciCom').value, dur: +$('#ciDur').value || 0 });
    reports.push({ court: id, level: lv, ts, user: 'You' });
    const pts = 10 + (verified ? 5 : 0) + (photoAI ? 5 : 0); state.user.points += pts; save(); closeModal();
    toast('+' + pts + ' pts · ' + byId(id).name + ' updated'); refreshAll(); if (state.sel) renderDetail(); if (state.view === 'profile') renderProfile();
  };
}

/* ---------- alerts ---------- */
function renderAlerts() {
  const favs = COURTS.filter(c => state.favs.includes(c.id) || state.alerts.includes(c.id));
  $('#v-alerts').innerHTML = '<div class="page"><h1>Alerts</h1><p class="lead">Get pinged the moment a court you care about goes from Full or Busy to Open. Save a court with ♡ to add it here.</p>' +
    '<div class="card">' + (favs.length ? favs.map(c => { const r = reading(c), on = state.alerts.includes(c.id); return '<div class="tog"><div><b>' + esc(c.name) + '</b><div class="muted">' + pill(statusOf(r.occ)) + '</div></div><button class="sw ' + (on ? 'on' : '') + '" data-alert="' + c.id + '" aria-label="Toggle alert"></button></div>'; }).join('') : '<div class="muted">No saved courts yet. Open a court and tap ♡ Save.</div>') + '</div>' +
    '<div class="row"><button class="btn dark" id="notifBtn">Enable push notifications</button><button class="btn" id="demoAlert">Trigger demo alert</button></div></div>';
}
const lastStatus = {};
function checkAlerts() {
  COURTS.forEach(c => {
    const s = statusOf(reading(c).occ), prev = lastStatus[c.id]; lastStatus[c.id] = s;
    if (prev && prev !== 'available' && prev !== 'unknown' && s === 'available' && state.alerts.includes(c.id)) fireAlert(c);
  });
}
function fireAlert(c) {
  toast('🔔 ' + c.name + ' just opened up'); try { if (window.Notification && Notification.permission === 'granted') new Notification('COURTS', { body: c.name + ' is open now' }); } catch (e) {}
}

/* ---------- profile ---------- */
function renderProfile() {
  const n = state.checkins.length, pts = state.user.points;
  const badges = [['First check-in', n >= 1], ['Regular (5)', n >= 5], ['Court scout (50 pts)', pts >= 50], ['Early bird', state.checkins.some(k => new Date(k.ts).getHours() < 8)], ['Night owl', state.checkins.some(k => new Date(k.ts).getHours() >= 21)]];
  $('#v-profile').innerHTML = '<div class="page"><h1>' + esc(state.user.name) + '</h1><p class="lead">Your check-ins power the Community track and calibrate the Vision track. Data stays in this browser in the prototype.</p>' +
    '<div class="grid2"><div><div class="card"><div class="stats"><div><b>' + n + '</b>Check-ins</div><div><b>' + pts + '</b>Points</div><div><b>' + badges.filter(b => b[1]).length + '</b>Badges</div></div><div style="margin-top:10px">' + badges.map(b => '<span class="badge ' + (b[1] ? '' : 'off') + '">' + b[0] + '</span>').join('') + '</div></div>' +
    '<div class="card"><div class="h2" style="margin-top:0">My check-ins</div>' + (n ? state.checkins.slice(0, 15).map(k => '<div class="rep"><span class="lv" style="background:' + LEVELS[k.level - 1].color + '">' + k.level + '</span><div style="flex:1"><b>' + esc(byId(k.court).name) + '</b><div class="muted">' + esc(k.comment || LEVELS[k.level - 1].label) + '</div></div><span class="muted">' + ago(k.ts) + '</span></div>').join('') : '<div class="muted">Nothing yet.</div>') + '</div></div>' +
    '<div><div class="card"><div class="h2" style="margin-top:0">Plan</div><b>' + (state.premium ? 'Premium (demo)' : 'Free') + '</b><div class="muted" style="margin:4px 0 10px">Premium: busy-hour analytics, predictions, history.</div><button class="btn ' + (state.premium ? '' : 'primary') + ' block" id="premToggle">' + (state.premium ? 'Switch to Free' : 'Unlock Premium · $3.99/mo') + '</button></div>' +
    '<div class="card"><div class="h2" style="margin-top:0">Privacy</div><div class="muted">Camera data is counted, not stored. <a href="#" id="privLink">How COURTS handles data</a></div></div></div></div></div>';
}
function openPrivacy() {
  modal('<h3>Privacy by design</h3><div class="muted">How COURTS treats camera and check-in data. Written against the GDPR principles (lawfulness, purpose limitation, data minimisation, storage limitation, transparency). Not legal advice; have counsel review before any real camera pilot.</div>' +
    '<div style="margin:12px 0;font-size:14px;line-height:1.5"><b>Cameras</b><ul style="margin:4px 0 10px;padding-left:18px"><li>Frames are processed to a <b>player count</b> and discarded. No faces, no identity, no video stored or shown.</li><li>Court operators sign a data-processing agreement and post on-site signage before any camera goes live.</li><li>EU/UK deployments need a DPIA first, since this is systematic monitoring of a public area.</li></ul>' +
    '<b>Check-ins</b><ul style="margin:4px 0 10px;padding-left:18px"><li>Location is used once to verify you are at the court and is not stored.</li><li>Photos are optional; if you attach one, only the count is kept.</li><li>You can export or delete your history from Profile.</li></ul>' +
    '<b>Retention</b><ul style="margin:4px 0;padding-left:18px"><li>Counts are aggregated to hourly averages after 30 days.</li></ul></div><button class="btn primary block" id="privOk">Got it</button>');
  $('#privOk').onclick = closeModal;
}

/* =====================================================================
   VISION LAB  (Roboflow)
   ===================================================================== */
const lab = { mode: 'sample', fi: 0, el: null, w: 640, h: 360, preds: [], conf: .5, courts: 1, per: 10, assign: '1', raw: null, tainted: false, srcUrl: null, auto: false, last: 0, live: false, busy: false, stream: null };
function modelMeta(id) { return MODELS.find(m => m.id === id) || { id, name: id, count: ['player', 'people', 'person', 'tennis-player'] }; }
function countOf(preds, modelId, conf) { const cls = modelMeta(modelId).count; return preds.filter(p => p.confidence >= conf && cls.includes(String(p.class).toLowerCase())).length; }
async function rfInfer(src) {
  const key = state.rf.key; if (!key) throw new Error('Add a Roboflow API key first.');
  const url = 'https://serverless.roboflow.com/' + state.rf.model + '?api_key=' + encodeURIComponent(key) + '&confidence=25&overlap=50';
  let res;
  if (src.url) res = await fetch(url + '&image=' + encodeURIComponent(src.url), { method: 'POST' });
  else res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: src.b64 });
  if (!res.ok) throw new Error(res.status === 403 ? 'Roboflow rejected the key (403).' : res.status === 404 ? 'Model not found (404). Check the model id.' : 'Roboflow error ' + res.status);
  return res.json();
}
function loadSample(i) {
  lab.mode = 'sample'; lab.fi = i; stopStream();
  const f = FRAMES[i]; lab.w = f.w; lab.h = f.h; lab.srcUrl = f.url; lab.courts = f.courts; lab.per = SP[f.sport].per; lab.raw = null;
  state.rf.model = f.model; lab.preds = f.preds.slice(); lab.live = false; lab.tainted = false;
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => { lab.el = img; renderLabStats(); };
  img.onerror = () => { const i2 = new Image(); i2.onload = () => { lab.el = i2; lab.tainted = true; renderLabStats(); }; i2.onerror = () => { lab.el = null; renderLabStats(); }; i2.src = f.url; };
  img.src = f.url;
  renderLabStats();
}
function stopStream() { if (lab.stream) { lab.stream.getTracks().forEach(t => t.stop()); lab.stream = null; } lab.auto = false; if (lab.el && lab.el.tagName === 'VIDEO') { lab.el.pause(); } }
function useFile(file, kind) {
  stopStream(); lab.preds = []; lab.raw = null; lab.tainted = false; lab.srcUrl = null; lab.live = true;
  const url = URL.createObjectURL(file);
  if (kind === 'image') { const img = new Image(); img.onload = () => { lab.el = img; lab.w = img.naturalWidth; lab.h = img.naturalHeight; renderLabStats(); labRun(); }; img.src = url; lab.mode = 'upload'; }
  else { const v = document.createElement('video'); v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.onloadedmetadata = () => { lab.w = v.videoWidth; lab.h = v.videoHeight; lab.el = v; v.play(); lab.auto = true; renderLabStats(); }; lab.mode = 'video'; }
}
async function useWebcam() {
  try { stopStream(); const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); lab.stream = s; const v = document.createElement('video'); v.srcObject = s; v.muted = true; v.playsInline = true; await v.play(); lab.el = v; lab.w = v.videoWidth; lab.h = v.videoHeight; lab.mode = 'webcam'; lab.live = true; lab.preds = []; lab.auto = true; renderLabStats(); }
  catch (e) { toast('Camera not available: ' + e.message); }
}
async function labRun() {
  if (lab.busy) return;
  if (lab.mode === 'sample' && !state.rf.key) { lab.preds = FRAMES[lab.fi].preds.slice(); lab.raw = { recorded: true, model: FRAMES[lab.fi].model, image: { width: lab.w, height: lab.h }, predictions: FRAMES[lab.fi].preds }; lab.live = false; renderLabStats(); toast('Showing recorded Roboflow output. Add a key to run live.'); return; }
  if (!state.rf.key) { toast('Add your Roboflow key above to run live inference.'); return; }
  if (!lab.el) { toast('Pick a frame first.'); return; }
  lab.busy = true; const btn = $('#labRun'); if (btn) btn.textContent = 'Running…';
  try {
    let src;
    if (lab.mode === 'sample' && lab.tainted) src = { url: lab.srcUrl };
    else { const cv = document.createElement('canvas'); const sc = Math.min(1, 960 / lab.w); cv.width = lab.w * sc; cv.height = lab.h * sc; cv.getContext('2d').drawImage(lab.el, 0, 0, cv.width, cv.height); src = { b64: cv.toDataURL('image/jpeg', .8).split(',')[1], sc }; }
    const d = await rfInfer(src), k = src.sc ? 1 / src.sc : 1;
    lab.preds = d.predictions.map(p => ({ ...p, x: p.x * k, y: p.y * k, width: p.width * k, height: p.height * k }));
    lab.raw = d; lab.live = true;
  } catch (e) { toast(e.message); }
  lab.busy = false; if ($('#labRun')) $('#labRun').textContent = 'Run Roboflow'; renderLabStats();
}
function labCounts() { const n = countOf(lab.preds, state.rf.model, lab.conf), k = lab.courts * lab.per, occ = Math.min(1, n / k); return { n, k, occ, st: statusOf(occ), wait: waitEst({ occ, count: n, cap: k }) }; }
function renderLabStats() {
  const s = labCounts(), set = (id, h) => { const e = $(id); if (e) e.innerHTML = h; };
  set('#plFrame', lab.mode === 'sample' ? 'Sample photo' : lab.mode === 'webcam' ? 'Webcam' : lab.mode === 'video' ? 'Video' : 'Image'); set('#plFrameS', lab.w + '×' + lab.h);
  set('#plModel', esc(modelMeta(state.rf.model).name)); set('#plModelS', lab.live ? 'live inference' : 'recorded output');
  set('#plCount', s.n + ' player' + (s.n === 1 ? '' : 's')); set('#plCountS', 'conf ≥ ' + lab.conf.toFixed(2));
  set('#plOcc', Math.round(s.occ * 100) + '% of ' + s.k); set('#plOccS', s.wait ? '~' + s.wait + ' min wait' : 'no wait');
  set('#plStat', pill(s.st)); set('#labBig', '<b style="font-size:38px;font-family:\'Space Grotesk\',Inter,sans-serif">' + s.n + '</b> players · ' + pill(s.st));
  set('#confV', lab.conf.toFixed(2)); const j = $('#labJson'); if (j) j.textContent = JSON.stringify(lab.raw ? { ...lab.raw, predictions: lab.raw.predictions.slice(0, 6).concat(lab.raw.predictions.length > 6 ? ['… +' + (lab.raw.predictions.length - 6) + ' more'] : []) } : { note: 'Run Roboflow to see the raw response' }, null, 1);
}
const BOXCOL = { player: '#a78bfa', people: '#a78bfa', person: '#a78bfa', 'tennis-player': '#a78bfa', ref: '#94a3b8', hoop: '#fb923c', court: '#38bdf8' };
function labFrame() {
  const cv = $('#labCanvas'); if (!cv) return;
  const W = cv.clientWidth || 640, H = Math.round(W * lab.h / lab.w); if (cv.width !== W * 2 || cv.height !== H * 2) { cv.width = W * 2; cv.height = H * 2; cv.style.height = H + 'px'; }
  const ctx = cv.getContext('2d'), sc = cv.width / lab.w; ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, cv.width, cv.height);
  const ready = lab.el && (lab.el.tagName !== 'VIDEO' || lab.el.readyState >= 2) && (lab.el.complete !== false);
  if (ready) { try { ctx.drawImage(lab.el, 0, 0, cv.width, cv.height); } catch (e) {} } else { ctx.fillStyle = '#94a3b8'; ctx.font = '26px Inter'; ctx.fillText(lab.mode === 'sample' ? 'Loading frame…' : 'Pick a source', 30, 50); }
  const counted = modelMeta(state.rf.model).count;
  lab.preds.filter(p => p.confidence >= lab.conf || !counted.includes(String(p.class).toLowerCase())).forEach(p => {
    const cl = String(p.class).toLowerCase(), isP = counted.includes(cl), x = (p.x - p.width / 2) * sc, y = (p.y - p.height / 2) * sc, w = p.width * sc, h = p.height * sc;
    if (isP && state.anon && ready) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); if ('filter' in ctx) { ctx.filter = 'blur(14px)'; try { ctx.drawImage(lab.el, 0, 0, cv.width, cv.height); } catch (e) {} } else { ctx.fillStyle = 'rgba(30,30,50,.9)'; ctx.fillRect(x, y, w, h); } ctx.restore(); }
    ctx.strokeStyle = BOXCOL[cl] || '#fff'; ctx.lineWidth = isP ? 3 : 2; if (!isP) ctx.setLineDash([10, 8]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    if (isP || cl === 'ref') { const t = p.class + ' ' + p.confidence.toFixed(2); ctx.font = '600 ' + Math.max(18, cv.width / 48) + 'px Inter'; const tw = ctx.measureText(t).width + 10, th = Math.max(22, cv.width / 40); ctx.fillStyle = BOXCOL[cl] || '#fff'; ctx.fillRect(x, y - th, tw, th); ctx.fillStyle = '#0b1220'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 5, y - th / 2); ctx.textBaseline = 'alphabetic'; }
  });
  if (lab.auto && !lab.busy && state.rf.key && performance.now() - lab.last > 2500) { lab.last = performance.now(); labRun(); }
  if (lab.auto && !state.rf.key && lab.el && lab.el.tagName === 'VIDEO') { /* video plays; add key to analyse */ }
  if (performance.now() % 500 < 40) renderLabStats();
}
function renderLab() {
  const v = $('#v-lab');
  v.innerHTML = '<div class="page"><h1>Vision Lab</h1><p class="lead">This is how COURTS will read a real camera over a court. A frame goes to a Roboflow model, players are detected, counted against court capacity, and the result drives the map. Everything below runs on real Roboflow output; the camera wall further down is simulated until a camera is connected.</p>' +
    '<div class="pipe"><div class="st"><small>1 · Camera</small><b id="plFrame"></b><span class="muted" id="plFrameS"></span></div><div class="st"><small>2 · Roboflow model</small><b id="plModel"></b><span class="muted" id="plModelS"></span></div><div class="st"><small>3 · Players</small><b id="plCount"></b><span class="muted" id="plCountS"></span></div><div class="st"><small>4 · Occupancy</small><b id="plOcc"></b><span class="muted" id="plOccS"></span></div><div class="st"><small>5 · Map status</small><b id="plStat"></b><span class="muted">pushed to app</span></div></div>' +
    '<div class="grid2"><div><div class="card"><div class="row" style="margin-bottom:10px"><div id="labBig"></div></div><canvas id="labCanvas" class="labcanvas"></canvas>' +
    '<div class="h2">Source</div><div class="chips" id="srcChips"><button class="chip" data-src="sample">Sample photos</button><button class="chip" data-src="upload">Upload image</button><button class="chip" data-src="video">Upload video</button><button class="chip" data-src="webcam">Webcam</button></div>' +
    '<div class="thumbs" id="thumbs">' + FRAMES.map((f, i) => '<img src="' + f.url + '" data-fi="' + i + '" alt="' + esc(f.label) + '" title="' + esc(f.label) + '" class="' + (i === lab.fi && lab.mode === 'sample' ? 'on' : '') + '">').join('') + '</div>' +
    '<input type="file" id="fImg" accept="image/*" class="hidden"><input type="file" id="fVid" accept="video/*" class="hidden">' +
    '<div class="row" style="margin-top:10px"><button class="btn primary" id="labRun">Run Roboflow</button><label class="row" style="gap:6px;font-size:13px;font-weight:600"><span class="sw ' + (state.anon ? 'on' : '') + '" id="anonSw" role="switch"></span>Anonymise players</label></div>' +
    '<details style="margin-top:10px"><summary class="muted" style="cursor:pointer">Raw Roboflow response</summary><pre class="json" id="labJson"></pre></details></div></div>' +
    '<div><div class="card"><div class="h2" style="margin-top:0">Connect Roboflow</div>' +
    '<div class="field">Model<select id="rfModel">' + MODELS.map(m => '<option value="' + m.id + '" ' + (m.id === state.rf.model ? 'selected' : '') + '>' + esc(m.name) + '</option>').join('') + '</select></div>' +
    '<div class="field">Model id (custom)<input id="rfModelId" value="' + esc(state.rf.model) + '"></div>' +
    '<div class="field">Roboflow API / publishable key<input id="rfKey" type="password" placeholder="Paste key to run live" value="' + esc(state.rf.key) + '"></div>' +
    '<div class="note vio">No key? Sample photos still show real Roboflow output we recorded. With a key, “Run Roboflow” calls the model live, including on your own photos, videos and webcam.</div>' +
    '<div class="field">Confidence ≥ <span id="confV"></span><input id="conf" type="range" min="0.2" max="0.95" step="0.01" value="' + lab.conf + '"></div>' +
    '<div class="row"><div class="field" style="flex:1">Courts in view<input id="labCourts" type="number" min="1" value="' + lab.courts + '"></div><div class="field" style="flex:1">Players per court<input id="labPer" type="number" min="1" value="' + lab.per + '"></div></div></div>' +
    '<div class="card"><div class="h2" style="margin-top:0">Publish to the map</div><div class="field">Court this camera watches<select id="labAssign">' + COURTS.map(c => '<option value="' + c.id + '" ' + (+lab.assign === c.id ? 'selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div><button class="btn dark block" id="labPub">Send reading to map</button><div class="muted" style="margin-top:6px">In production this happens automatically every few seconds per camera.</div></div></div></div>' +
    '<div class="h2">Camera wall · simulated until real cameras are connected</div><div class="row" style="margin-bottom:8px"><span class="muted">Demo clock</span><input type="range" id="demoClock" min="6" max="22" step="0.5" value="' + Math.round(nowHour() * 2) / 2 + '" style="flex:1;max-width:320px"><b id="demoClockV"></b><button class="btn sm" id="demoLive">Live time</button></div>' +
    '<div class="wall" id="wall">' + COURTS.filter(c => c.cam).map(c => '<div class="cam" data-open="' + c.id + '"><canvas></canvas><span class="tag"><i></i>LIVE</span><span class="nm">' + esc(c.name) + '</span><span class="hud"></span></div>').join('') + '</div></div>';
  cams.length = 0; $$('#wall .cam').forEach((d, i) => registerCam($('canvas', d), COURTS.filter(c => c.cam)[i].id, false));
  const dc = () => { const h = nowHour(); $('#demoClockV').textContent = (Math.floor(h) % 12 || 12) + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); }; dc();
  $('#demoClock').oninput = e => { state.demoHour = +e.target.value; dc(); seedReports(); COURTS.filter(c => c.cam).forEach(c => simStep(c, true)); refreshAll(); };
  $('#demoLive').onclick = () => { state.demoHour = null; $('#demoClock').value = nowHour(); dc(); seedReports(); COURTS.filter(c => c.cam).forEach(c => simStep(c, true)); refreshAll(); };
  $('#thumbs').onclick = e => { const i = e.target.dataset.fi; if (i == null) return; loadSample(+i); $$('#thumbs img').forEach(im => im.classList.toggle('on', im.dataset.fi === i)); $('#rfModel').value = state.rf.model; $('#rfModelId').value = state.rf.model; $('#labCourts').value = lab.courts; $('#labPer').value = lab.per; };
  $('#srcChips').onclick = e => { const s = e.target.dataset.src; if (!s) return; if (s === 'sample') loadSample(lab.fi); if (s === 'upload') $('#fImg').click(); if (s === 'video') $('#fVid').click(); if (s === 'webcam') useWebcam(); };
  $('#fImg').onchange = e => e.target.files[0] && useFile(e.target.files[0], 'image');
  $('#fVid').onchange = e => e.target.files[0] && useFile(e.target.files[0], 'video');
  $('#labRun').onclick = labRun;
  $('#anonSw').onclick = e => { state.anon = !state.anon; e.currentTarget.classList.toggle('on', state.anon); };
  $('#rfModel').onchange = e => { state.rf.model = e.target.value; $('#rfModelId').value = state.rf.model; save(); renderLabStats(); };
  $('#rfModelId').onchange = e => { state.rf.model = e.target.value.trim(); save(); renderLabStats(); };
  $('#rfKey').onchange = e => { state.rf.key = e.target.value.trim(); save(); toast(state.rf.key ? 'Key saved in this browser' : 'Key cleared'); };
  $('#conf').oninput = e => { lab.conf = +e.target.value; renderLabStats(); };
  $('#labCourts').oninput = e => { lab.courts = Math.max(1, +e.target.value || 1); renderLabStats(); };
  $('#labPer').oninput = e => { lab.per = Math.max(1, +e.target.value || 1); renderLabStats(); };
  $('#labAssign').onchange = e => { lab.assign = e.target.value; };
  $('#labPub').onclick = () => { const id = +$('#labAssign').value, s = labCounts(), c = byId(id); state.labOv[id] = { count: Math.round(s.n * (cap(c) / s.k)), ts: Date.now() }; toast(c.name + ' now reads ' + state.labOv[id].count + '/' + cap(c) + ' from camera'); refreshAll(); };
  if (!lab.el) loadSample(lab.fi); else renderLabStats();
}

/* ---------- navigation / refresh ---------- */
function navItems() { return [['explore', '🗺️', 'Map'], ...(state.track === 'vision' ? [['lab', '🔬', 'Lab']] : []), ['alerts', '🔔', 'Alerts'], ['profile', '👤', 'Profile']]; }
function renderNav() {
  const items = navItems();
  $('#navtop').innerHTML = items.map(i => '<button data-view="' + i[0] + '" class="' + (state.view === i[0] ? 'on' : '') + '">' + i[2] + '</button>').join('');
  $('#navbot').innerHTML = items.map(i => '<button data-view="' + i[0] + '" class="' + (state.view === i[0] ? 'on' : '') + '"><span class="ic">' + i[1] + '</span>' + i[2] + '</button>').join('');
  $$('#trackSeg button').forEach(b => b.classList.toggle('on', b.dataset.track === state.track));
  document.body.dataset.track = state.track;
  const lg = $('#legend'); if (lg && !lg.querySelector('.lgn')) lg.insertAdjacentHTML('beforeend', '<span class="lgn muted"></span>'); if (lg) lg.querySelector('.lgn').textContent = state.track === 'vision' ? 'Pin = players seen' : 'Pin = crowd level 1–5';
}
function go(view, keepSel) {
  if (view === 'lab' && state.track !== 'vision') view = 'explore';
  state.view = view; if (view !== 'explore' && !keepSel) { /* keep selection */ }
  $$('.view').forEach(v => v.classList.toggle('hidden', v.id !== 'v-' + view));
  cams.length = 0;
  if (view === 'explore') { renderPanel(); setTimeout(() => map && map.invalidateSize(), 50); }
  if (view === 'lab') renderLab();
  if (view === 'alerts') renderAlerts();
  if (view === 'profile') renderProfile();
  renderNav();
}
function setTrack(t) {
  state.track = t; save(); if (t !== 'vision' && state.view === 'lab') state.view = 'explore';
  const u = new URL(location.href); u.searchParams.set('track', t); history.replaceState(null, '', u);
  go(state.view); updatePins(); toast(t === 'vision' ? 'Vision track: camera + Roboflow' : 'Community track: player check-ins');
}
function refreshAll() { updatePins(); if (state.view === 'explore') refreshCards(); if (state.view === 'alerts') renderAlerts(); checkAlerts(); }

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-fav]'))) { e.stopPropagation(); const id = +el.dataset.fav; state.favs = state.favs.includes(id) ? state.favs.filter(x => x !== id) : [...state.favs, id]; save(); refreshCards(); return; }
  if ((el = t.closest('[data-open]'))) { openCourt(el.dataset.open); return; }
  if ((el = t.closest('#trackSeg button'))) { setTrack(el.dataset.track); return; }
  if ((el = t.closest('[data-view]'))) { go(el.dataset.view); return; }
  if ((el = t.closest('[data-sport]'))) { state.sport = el.dataset.sport; renderPanel(); updatePins(); fitAll(); return; }
  if ((el = t.closest('[data-status]'))) { state.status = el.dataset.status; renderPanel(); updatePins(); return; }
  if ((el = t.closest('[data-alert]'))) { const id = +el.dataset.alert; state.alerts = state.alerts.includes(id) ? state.alerts.filter(x => x !== id) : [...state.alerts, id]; save(); renderAlerts(); return; }
  switch (t.id) {
    case 'backBtn': closeCourt(); break;
    case 'ciBtn': openCheckIn(state.sel); break;
    case 'addUpd': openCheckIn(); break;
    case 'favBtn': { const id = state.sel; state.favs = state.favs.includes(id) ? state.favs.filter(x => x !== id) : [...state.favs, id]; save(); renderDetail(); break; }
    case 'alBtn': { const id = state.sel; state.alerts = state.alerts.includes(id) ? state.alerts.filter(x => x !== id) : [...state.alerts, id]; if (state.alerts.includes(id) && !state.favs.includes(id)) state.favs.push(id); save(); renderDetail(); toast(state.alerts.includes(id) ? 'You will be alerted when it opens' : 'Alert removed'); break; }
    case 'premBtn': case 'premToggle': state.premium = !state.premium; save(); if (state.view === 'profile') renderProfile(); else renderDetail(); toast(state.premium ? 'Premium unlocked (demo, no charge)' : 'Back to Free'); break;
    case 'locBtn': navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => { state.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; map.flyTo([state.pos.lat, state.pos.lng], 13); refreshCards(); }, () => toast('Location blocked. Showing San Francisco.')) : toast('Location unavailable'); break;
    case 'fitBtn': fitAll(); break;
    case 'notifBtn': window.Notification ? Notification.requestPermission().then(p => toast('Notifications ' + p)) : toast('Notifications not supported here'); break;
    case 'demoAlert': fireAlert(COURTS[4]); break;
    case 'privLink': e.preventDefault(); openPrivacy(); break;
  }
});
document.addEventListener('input', e => { if (e.target.id === 'q') { state.q = e.target.value; refreshCards(); updatePins(); } });

/* ---------- boot ---------- */
function boot() {
  seedReports(); simInit(); initMap(); go('explore');
  setInterval(() => { COURTS.filter(c => c.cam).forEach(c => simStep(c)); refreshAll(); }, 4000);
  setInterval(seedReports, 5 * 60000);
  requestAnimationFrame(frame);
  Object.keys(sim).forEach(id => lastStatus[id] = statusOf(reading(byId(id)).occ));
}
boot();
window.COURTS_APP = { state, reading, lab };
})();
