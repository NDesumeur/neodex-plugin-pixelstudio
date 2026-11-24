// PixelStudio : dessiner et animer des sprites pixel art. Crayon, gomme, pot de peinture, ligne, rectangle, pipette, symétrie ;
// palette de 32 couleurs modifiable ; images d'animation avec pelure d'oignon et lecture ; export PNG, planche et GIF animé
// (l'encodeur GIF, LZW compris, est écrit ici, et le navigateur relit le fichier pour vérifier qu'il est bon).
const CSS = `
.psGrid{display:grid;grid-template-columns:clamp(200px,16vw,280px) minmax(0,1fr) clamp(220px,18vw,320px);gap:clamp(12px,1.2vw,20px)}
@media (max-width:1000px){.psGrid{grid-template-columns:minmax(0,1fr)}.psGrid>:nth-child(2){order:-1}}
.psTools{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.psTools .btn{width:auto;margin:0;padding:8px 0;font-size:22px;line-height:1}
.psPal{display:grid;grid-template-columns:repeat(8,1fr);gap:3px;margin-top:8px}
.psPal button{aspect-ratio:1;border:2px solid #000;padding:0;cursor:var(--cp,pointer)}
.psPal button.on{outline:2px solid #fff;outline-offset:1px}
.psCan{width:100%;max-width:min(820px,66vh);aspect-ratio:1;display:block;margin:0 auto;image-rendering:pixelated;border:2px solid var(--line);touch-action:none;cursor:crosshair;background:#1a1430}
.psRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.psRow .btn{width:auto;margin:0;padding:4px 10px}
.psRow .f{width:auto;flex:1;min-width:0;margin:0}
.psFrames{display:flex;gap:6px;overflow-x:auto;padding:4px 0}
.psFrame{flex:none;border:2px solid var(--line);background:#1a1430;cursor:var(--cp,pointer);position:relative}
.psFrame.on{border-color:var(--magenta)}
.psFrame canvas{display:block;width:56px;height:56px;image-rendering:pixelated}
.psFrame span{position:absolute;left:2px;top:0;font:13px monospace;color:#fff;text-shadow:1px 1px #000}
.psPrev{width:100%;aspect-ratio:1;image-rendering:pixelated;background:#1a1430;border:2px solid var(--line);display:block}
.psRange{-webkit-appearance:none;appearance:none;height:10px;background:var(--bg0);border:2px solid var(--line);outline:none;flex:1;min-width:60px}
.psRange::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:22px;background:var(--magenta);border:2px solid #000;cursor:var(--cp,pointer)}
.psLay{display:flex;gap:4px;align-items:center;margin:3px 0}.psLay .btn{width:auto;margin:0;padding:3px 8px}.psLay .nm{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.psLay.off .nm{opacity:.5}.psLayActs{display:flex;gap:4px;flex-wrap:wrap}.psLayActs .btn{width:auto;margin:0;padding:3px 8px}
.psInfo{font:15px monospace;color:var(--lilac);margin-top:4px}
`;
const PALETTE = ['#000000', '#1a1430', '#3a2a5a', '#5a4a8a', '#8a7aa8', '#c8b8f0', '#ffffff', '#fff6e0',
  '#5a1a2a', '#a02a3a', '#e04a4a', '#ff8a6a', '#7a4a1a', '#c07a2a', '#ffb04f', '#ffd34f',
  '#1a3a1a', '#2a6a3a', '#4aa04a', '#9ae06a', '#1a2a5a', '#2a4aa0', '#4f8aff', '#4fc3ff',
  '#4a1a5a', '#8a2a8a', '#ff4fb0', '#ffa0d0', '#2a2a2a', '#5a5a5a', '#9a9a9a', '#d0d0d0'];
// ---------- GIF animé : palette commune, LZW, transparence ----------
function encodeGIF(frames, w, h, delayCs, scale) {
  const W = w * scale, H = h * scale, cols = new Map(); cols.set(-1, 0);  // indice 0 = transparent
  for (const f of frames) for (const c of f) if (c >= 0 && !cols.has(c) && cols.size < 256) cols.set(c, cols.size);
  let bits = 1; while ((1 << bits) < cols.size) bits++; bits = Math.max(2, bits);
  const out = [], b = v => out.push(v & 255), w16 = v => { b(v); b(v >> 8); }, str = s => [...s].forEach(c => b(c.charCodeAt(0)));
  str('GIF89a'); w16(W); w16(H); b(0xf0 | (bits - 1)); b(0); b(0);
  for (let i = 0; i < 1 << bits; i++) { const c = [...cols].find(([, k]) => k === i)?.[0] ?? 0, v = c < 0 ? 0 : c; b(v >> 16); b(v >> 8); b(v); }
  b(0x21); b(0xff); b(11); str('NETSCAPE2.0'); b(3); b(1); w16(0); b(0);  // boucle infinie
  for (const f of frames) {
    b(0x21); b(0xf9); b(4); b(0x09); w16(delayCs); b(0); b(0);  // effacer jusqu'au fond, couleur 0 transparente
    b(0x2c); w16(0); w16(0); w16(W); w16(H); b(0);
    const px = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px[y * W + x] = cols.get(f[Math.floor(y / scale) * w + Math.floor(x / scale)]) ?? 0;
    b(bits); lzw(px, bits).forEach(v => out.push(v));
  }
  b(0x3b); return Uint8Array.from(out);
}
function lzw(px, minBits) {
  const clear = 1 << minBits, eoi = clear + 1, out = []; let dict = new Map(), next = eoi + 1, size = minBits + 1, acc = 0, n = 0, blk = [];
  const emit = code => { acc |= code << n; n += size; while (n >= 8) { blk.push(acc & 255); acc >>>= 8; n -= 8; if (blk.length === 255) { out.push(255, ...blk); blk = []; } } };
  emit(clear); let cur = px[0];
  for (let i = 1; i < px.length; i++) { const k = cur * 4096 + px[i]; if (dict.has(k)) { cur = dict.get(k); continue; }
    emit(cur); if (next < 4096) { dict.set(k, next++); if (next > 1 << size && size < 12) size++; } else { emit(clear); dict = new Map(); next = eoi + 1; size = minBits + 1; } cur = px[i]; }
  emit(cur); emit(eoi); if (n > 0) blk.push(acc & 255); if (blk.length) out.push(blk.length, ...blk); out.push(0); return out;
}
const hex2i = h => parseInt(h.slice(1), 16), i2hex = v => '#' + v.toString(16).padStart(6, '0');
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el, toast } = ctx.host;
  ctx.host.addStyle(CSS);
  let data = null; try { data = await ctx.folder.read('pixelstudio'); } catch {}
  // une image = un tableau de couleurs entières, -1 pour transparent
  const st = {w: data?.w || 32, h: data?.h || 32, frames: data?.frames?.length ? data.frames : null, cur: 0, fps: data?.fps || 8, pal: data?.pal || [...PALETTE], color: data?.color ?? 6, tool: 'pen', mirror: false, onion: data?.onion ?? true, grid: data?.grid ?? true};
  if (!st.frames) { st.frames = [Array(st.w * st.h).fill(-1)]; drawStarter(st.frames[0]); }
  // les calques : [{name, vis, frames}], du fond vers le dessus ; un ancien dessin devient le calque 1
  st.stack = data?.stack?.length ? data.stack : [{name: 'Calque 1', vis: true, frames: st.frames}]; st.li = Math.min(data?.li ?? 0, st.stack.length - 1);
  Object.defineProperty(st, 'frames', {get: () => st.stack[st.li].frames, set: v => { st.stack[st.li].frames = v; }});
  const nFrames = () => st.stack[0].frames.length;
  function comp(fi, over) {  // l'image fondue des calques visibles ; over : l'image en cours de tracé du calque actif
    const o = Array(st.w * st.h).fill(-1);
    st.stack.forEach((L, li) => { if (!L.vis) return; const f = li === st.li && over ? over : L.frames[fi]; if (f) for (let i = 0; i < o.length; i++) if (f[i] >= 0) o[i] = f[i]; });
    return o;
  }
  const comps = () => Array.from({length: nFrames()}, (_, i) => comp(i));
  function drawStarter(f) {  // un petit slime pour ne pas commencer devant une page vide
    const S = ['....######....', '..##ffffff##..', '.#ffffffffff#.', '#ffffffffffff#', '#fff#ffff#fff#', '#fff#ffff#fff#', '#ffffffffffff#', '#ffff####ffff#', '.#ffffffffff#.', '..##########..'];
    const c = {'#': hex2i('#2a6a3a'), f: hex2i('#9ae06a')}, ox = Math.floor((st.w - 14) / 2), oy = st.h - 12;
    S.forEach((r, y) => [...r].forEach((ch, x) => { if (c[ch] !== undefined && oy + y >= 0) f[(oy + y) * st.w + ox + x] = c[ch]; }));
  }
  let saveT = 0; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => ctx.folder.write('pixelstudio', {w: st.w, h: st.h, stack: st.stack, li: st.li, fps: st.fps, pal: st.pal, color: st.color, onion: st.onion, grid: st.grid}).catch(() => {}), 600); };
  // ---------- l'interface ----------
  view.innerHTML = '';
  const wrap = el('div', 'appWrap wide'), head = el('div', 'agHead'), lay = el('div', 'psGrid'), left = el('div', 'sysCard px'), mid = el('div'), right = el('div', 'sysCard px');
  head.append(el('span', 'label', 'PixelStudio · sprites et animations')); lay.append(left, mid, right); wrap.append(head, lay); view.append(wrap);
  const tools = el('div', 'psTools'), pal = el('div', 'psPal'), picker = el('input'), opts = el('div');
  picker.type = 'color'; picker.title = 'Changer la couleur choisie';
  left.append(el('span', 'label', 'Outils'), tools, el('span', 'label', 'Palette'), pal, el('div', 'psRow'), opts);
  left.children[4].append(el('span', 'hint', 'Modifier'), picker);
  const can = el('canvas', 'psCan'), g = can.getContext('2d'), frameBar = el('div', 'psRow'), frames = el('div', 'psFrames'), info = el('div', 'psInfo');
  can.id = 'ps_canvas'; info.id = 'ps_info';
  mid.append(can, info, frameBar, frames);
  const prev = el('canvas', 'psPrev'), pg = prev.getContext('2d'), fps = el('input', 'psRange'), fpsL = el('span', 'hint'), exp = el('div');
  fps.type = 'range'; fps.min = 1; fps.max = 24; fps.value = st.fps; fps.title = 'Images par seconde';
  const fpsRow = el('div', 'psRow'); fpsRow.append(fps, fpsL);
  right.append(el('span', 'label', 'Aperçu'), prev, fpsRow, el('span', 'label', 'Taille'), sizeRow(), el('span', 'label', 'Exporter'), exp);
  function sizeRow() { const r = el('div', 'psRow'), s = el('select', 'f'); for (const n of [8, 16, 24, 32, 48, 64]) { const o = el('option', '', n + ' × ' + n); o.value = n; o.selected = n === st.w; s.append(o); }
    s.onchange = async () => { const n = +s.value; if (!(await ctx.host.confirm?.('Changer la taille ? Le dessin est gardé en haut à gauche (coupé s\'il dépasse).') ?? true)) { s.value = st.w; return; }
      pushUndo(); for (const L of st.stack) L.frames = L.frames.map(f => { const o = Array(n * n).fill(-1); for (let y = 0; y < Math.min(n, st.h); y++) for (let x = 0; x < Math.min(n, st.w); x++) o[y * n + x] = f[y * st.w + x]; return o; }); st.w = st.h = n; save(); all(); };
    r.append(s); return r; }
  const TOOLS = [['pen', '✏', 'Crayon (B)'], ['eraser', '⌫', 'Gomme (E)'], ['fill', '▧', 'Pot de peinture (G)'], ['pick', '⊙', 'Pipette (I) · ou clic droit'], ['line', '╱', 'Ligne (L)'], ['rect', '▭', 'Rectangle (R)'], ['frect', '■', 'Rectangle plein (Maj+R)'], ['move', '✥', 'Déplacer l\'image (M)']];
  function drawTools() {
    tools.replaceChildren(...TOOLS.map(([k, ic, t]) => { const b = el('button', 'btn px' + (st.tool === k ? ' main' : ''), ic); b.title = t; b.dataset.tool = k; b.onclick = () => { st.tool = k; drawTools(); }; return b; }));
    opts.replaceChildren(...[['mirror', '⇋ Symétrie'], ['onion', 'Pelure d\'oignon'], ['grid', 'Grille']].map(([k, t]) => { const b = el('button', 'btn px' + (st[k] ? ' main' : ''), t); b.style.cssText = 'width:100%;margin:3px 0'; b.onclick = () => { st[k] = !st[k]; save(); drawTools(); draw(); }; return b; }));
    const u = el('div', 'psRow'); u.append(btn('↶', undoDo, 'Annuler (Ctrl+Z)'), btn('↷', redoDo, 'Refaire (Ctrl+Y)'), btn('⇋', () => transform((f, x, y) => f[y * st.w + st.w - 1 - x]), 'Retourner l\'image'), btn('⟳', () => transform((f, x, y) => f[(st.h - 1 - x) * st.w + y]), 'Tourner d\'un quart')); opts.append(u);
  }
  function drawPal() { pal.replaceChildren(...st.pal.map((c, i) => { const b = el('button', i === st.color ? 'on' : ''); b.style.background = c; b.title = c; b.dataset.i = i; b.onclick = () => { st.color = i; picker.value = c; save(); drawPal(); }; return b; })); picker.value = st.pal[st.color]; }
  picker.oninput = () => { const old = hex2i(st.pal[st.color]), nw = hex2i(picker.value); st.pal[st.color] = picker.value; st.stack.forEach(L => L.frames.forEach(f => f.forEach((c, i) => { if (c === old) f[i] = nw; }))); save(); drawPal(); draw(); drawFrames(); };  // changer une couleur la change partout
  const btn = (t, f, title) => { const b = el('button', 'btn px', t); b.onclick = f; if (title) b.title = title; return b; };
  // ---------- le dessin ----------
  let overlay = null;  // aperçu d'une ligne ou d'un rectangle en cours
  function paintFrame(c2, f, alpha) { c2.globalAlpha = alpha; f.forEach((c, i) => { if (c >= 0) { c2.fillStyle = i2hex(c); c2.fillRect(i % st.w, Math.floor(i / st.w), 1, 1); } }); c2.globalAlpha = 1; }
  function draw() {
    const Z = Math.max(1, Math.floor(560 / st.w)); can.width = st.w * Z; can.height = st.h * Z;
    g.save(); g.scale(Z, Z);
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) { g.fillStyle = (x + y) % 2 ? '#241c40' : '#1a1430'; g.fillRect(x, y, 1, 1); }  // damier = transparent
    if (st.onion && st.cur > 0) paintFrame(g, comp(st.cur - 1), .25);
    paintFrame(g, comp(st.cur, overlay), 1);
    g.restore();
    if (st.grid && Z >= 6) { g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < st.w; i++) g.fillRect(i * Z, 0, 1, can.height); for (let i = 1; i < st.h; i++) g.fillRect(0, i * Z, can.width, 1); }
    if (st.mirror) { g.fillStyle = '#ff4fb0'; g.fillRect(can.width / 2 - 1, 0, 2, can.height); }
    const used = new Set(st.stack.flatMap(L => L.frames.flat()).filter(c => c >= 0)).size;
    info.replaceChildren(st.w + '×' + st.h + ' · ' + (st.cur + 1) + '/' + nFrames() + ' · ' + used + ' ', el('span', '', 'couleurs'), ' · ' + st.stack[st.li].name);
  }
  const cellAt = e => { const r = can.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * st.w), Math.floor((e.clientY - r.top) / r.height * st.h)]; };
  const inside = (x, y) => x >= 0 && y >= 0 && x < st.w && y < st.h;
  function plot(f, x, y, c) { if (inside(x, y)) f[y * st.w + x] = c; if (st.mirror) { const mx = st.w - 1 - x; if (inside(mx, y)) f[y * st.w + mx] = c; } }
  function line(f, x0, y0, x1, y1, c) { const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (;;) { plot(f, x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
  function rect(f, x0, y0, x1, y1, c, full) { const [a, b2] = [Math.min(x0, x1), Math.max(x0, x1)], [cc, d] = [Math.min(y0, y1), Math.max(y0, y1)]; for (let y = cc; y <= d; y++) for (let x = a; x <= b2; x++) if (full || x === a || x === b2 || y === cc || y === d) plot(f, x, y, c); }
  function fill(f, x, y, c) { const t = f[y * st.w + x]; if (t === c) return; const stack = [[x, y]]; while (stack.length) { const [px, py] = stack.pop(); if (!inside(px, py) || f[py * st.w + px] !== t) continue; f[py * st.w + px] = c; stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]); } }
  let down = null;
  can.oncontextmenu = e => e.preventDefault();
  can.onpointerdown = e => {
    const [x, y] = cellAt(e), f = st.frames[st.cur], col = hex2i(st.pal[st.color]); if (!inside(x, y)) return;
    if (e.button === 2 || st.tool === 'pick') { const c = f[y * st.w + x]; if (c >= 0) { let i = st.pal.indexOf(i2hex(c)); if (i < 0) { st.pal[st.color] = i2hex(c); i = st.color; } st.color = i; drawPal(); save(); } return; }
    pushUndo(); try { can.setPointerCapture(e.pointerId); } catch {}
    down = {x, y, lx: x, ly: y, base: f.slice()};
    if (st.tool === 'pen' || st.tool === 'eraser') plot(f, x, y, st.tool === 'eraser' ? -1 : col);
    else if (st.tool === 'fill') { fill(f, x, y, col); down = null; changed(); return; }
    draw();
  };
  can.onpointermove = e => {
    if (!down) return; const [x, y] = cellAt(e), f = st.frames[st.cur], col = hex2i(st.pal[st.color]);
    if (st.tool === 'pen' || st.tool === 'eraser') { line(f, down.lx, down.ly, x, y, st.tool === 'eraser' ? -1 : col); down.lx = x; down.ly = y; draw(); }
    else if (st.tool === 'move') { const dx = x - down.x, dy = y - down.y; for (let yy = 0; yy < st.h; yy++) for (let xx = 0; xx < st.w; xx++) { const sx = xx - dx, sy = yy - dy; f[yy * st.w + xx] = inside(sx, sy) ? down.base[sy * st.w + sx] : -1; } draw(); }
    else { overlay = down.base.slice(); if (st.tool === 'line') line(overlay, down.x, down.y, x, y, col); else rect(overlay, down.x, down.y, x, y, col, st.tool === 'frect'); down.lx = x; down.ly = y; draw(); }
  };
  can.onpointerup = () => { if (!down) return; if (overlay) { st.frames[st.cur] = overlay; overlay = null; } down = null; changed(); };
  // ---------- annuler / refaire : l'état complet des images ----------
  const undo = [], redo = [];
  const snapS = () => JSON.stringify([st.w, st.h, st.cur, st.stack, st.li]);
  function pushUndo() { undo.push(snapS()); if (undo.length > 60) undo.shift(); redo.length = 0; }
  function restore(s) { const [w, h, cur, stack, li] = JSON.parse(s); st.w = w; st.h = h; st.stack = stack; st.li = Math.min(li, stack.length - 1); st.cur = Math.min(cur, nFrames() - 1); save(); all(); }
  function undoDo() { const s = undo.pop(); if (!s) return; redo.push(snapS()); restore(s); }
  function redoDo() { const s = redo.pop(); if (!s) return; undo.push(snapS()); restore(s); }
  function transform(fn) { pushUndo(); const f = st.frames[st.cur], o = f.slice(); for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) o[y * st.w + x] = fn(f, x, y); st.frames[st.cur] = o; changed(); }
  // ---------- les images de l'animation ----------
  function drawFrames() {
    frameBar.replaceChildren(el('span', 'label', 'Images'), btn('+ Nouvelle', () => { pushUndo(); for (const L of st.stack) L.frames.splice(st.cur + 1, 0, Array(st.w * st.h).fill(-1)); st.cur++; changed(true); }),
      btn('⧉ Dupliquer', () => { pushUndo(); for (const L of st.stack) L.frames.splice(st.cur + 1, 0, L.frames[st.cur].slice()); st.cur++; changed(true); }),
      btn('◀', () => moveFrame(-1), 'Avancer cette image'), btn('▶', () => moveFrame(1), 'Reculer cette image'),
      btn('✕', () => { if (nFrames() < 2) return; pushUndo(); for (const L of st.stack) L.frames.splice(st.cur, 1); st.cur = Math.max(0, st.cur - 1); changed(true); }, 'Supprimer cette image'));
    frames.replaceChildren(...comps().map((f, i) => { const d = el('div', 'psFrame' + (i === st.cur ? ' on' : '')), c = el('canvas'); c.width = st.w; c.height = st.h; paintFrame(c.getContext('2d'), f, 1); d.append(c, el('span', '', String(i + 1))); d.onclick = () => { st.cur = i; drawFrames(); draw(); }; return d; }));
  }
  function moveFrame(d) { const j = st.cur + d; if (j < 0 || j >= nFrames()) return; pushUndo(); for (const L of st.stack) [L.frames[st.cur], L.frames[j]] = [L.frames[j], L.frames[st.cur]]; st.cur = j; changed(true); }
  // ---------- les calques ----------
  const layBox = el('div');
  function drawLayers() {
    const rows = st.stack.map((L, i) => [L, i]).reverse().map(([L, i]) => {  // le calque du dessus en haut
      const r = el('div', 'psLay' + (L.vis ? '' : ' off')), eye = btn(L.vis ? '◉' : '○', () => { pushUndo(); L.vis = !L.vis; changed(true); drawLayers(); }, L.vis ? 'Cacher ce calque' : 'Montrer ce calque');
      const nm = btn(L.name, () => { st.li = i; save(); drawLayers(); draw(); }, 'Clic : dessiner sur ce calque · double-clic : le renommer'); nm.classList.add('nm'); if (i === st.li) nm.classList.add('main');
      nm.ondblclick = async () => { const v = await ctx.host.ask?.('Nom du calque', L.name); if (v?.trim()) { L.name = v.trim().slice(0, 24); save(); drawLayers(); } };
      r.append(eye, nm); return r; });
    const acts = el('div', 'psLayActs');
    acts.append(btn('+', () => addLayer(), 'Nouveau calque transparent'), btn('⧉', () => addLayer(true), 'Dupliquer le calque'), btn('▲', () => moveLayer(1), 'Monter le calque'), btn('▼', () => moveLayer(-1), 'Descendre le calque'),
      btn('⤓', mergeDown, 'Fusionner avec le calque du dessous'), btn('✕', () => { if (st.stack.length < 2) return toast('Il faut garder au moins un calque'); pushUndo(); st.stack.splice(st.li, 1); st.li = Math.max(0, st.li - 1); changed(true); drawLayers(); }, 'Supprimer le calque'));
    layBox.replaceChildren(el('span', 'label', 'Calques (' + st.stack.length + ')'), ...rows, acts);
  }
  function addLayer(dup) { pushUndo(); const A = st.stack[st.li]; st.stack.splice(st.li + 1, 0, {name: dup ? A.name + ' (copie)' : 'Calque ' + (st.stack.length + 1), vis: true, frames: dup ? A.frames.map(f => f.slice()) : A.frames.map(() => Array(st.w * st.h).fill(-1))}); st.li++; changed(true); drawLayers(); }
  function moveLayer(d) { const j = st.li + d; if (j < 0 || j >= st.stack.length) return; pushUndo(); [st.stack[st.li], st.stack[j]] = [st.stack[j], st.stack[st.li]]; st.li = j; changed(true); drawLayers(); }
  function mergeDown() { if (!st.li) return toast('Pas de calque en dessous'); pushUndo(); const A = st.stack[st.li], B = st.stack[st.li - 1];
    if (A.vis) B.frames.forEach((f, fi) => A.frames[fi].forEach((c, i) => { if (c >= 0) f[i] = c; })); st.stack.splice(st.li, 1); st.li--; changed(true); drawLayers(); }
  // ---------- l'aperçu animé ----------
  let pi = 0, last = 0, raf = 0;
  function anim(t) { if (!view.isConnected) return; if (t - last > 1000 / st.fps) { last = t; pi = (pi + 1) % nFrames(); prev.width = st.w; prev.height = st.h; pg.clearRect(0, 0, st.w, st.h); paintFrame(pg, comp(pi), 1); } raf = requestAnimationFrame(anim); }
  fps.oninput = () => { st.fps = +fps.value; fpsL.replaceChildren(st.fps + ' ', el('span', '', 'img/s')); save(); };
  // ---------- les exports ----------
  const download = (href, name) => { const a = el('a'); a.href = href; a.download = name; document.body.append(a); a.click(); a.remove(); };
  const toCanvas = (list, scale, cols) => { const c = document.createElement('canvas'), n = list.length, rows = Math.ceil(n / cols); c.width = st.w * scale * Math.min(n, cols); c.height = st.h * scale * rows; const x2 = c.getContext('2d');
    list.forEach((f, i) => { x2.save(); x2.translate((i % cols) * st.w * scale, Math.floor(i / cols) * st.h * scale); x2.scale(scale, scale); paintFrame(x2, f, 1); x2.restore(); }); return c; };
  let scaleOut = 4;
  function drawExport() {
    const sc = el('select', 'f'); for (const n of [1, 2, 4, 8, 16]) { const o = el('option', '', '× ' + n); o.value = n; o.selected = n === scaleOut; sc.append(o); } sc.onchange = () => scaleOut = +sc.value; sc.title = 'Agrandissement à l\'export';
    const r = el('div', 'psRow'); r.append(el('span', 'hint', 'Échelle'), sc);
    const b1 = btn('PNG (cette image)', () => download(toCanvas([comp(st.cur)], scaleOut, 1).toDataURL('image/png'), 'sprite.png'));
    const b2 = btn('Planche PNG', () => download(toCanvas(comps(), scaleOut, nFrames()).toDataURL('image/png'), 'planche-' + nFrames() + '.png'));
    const b3 = btn('GIF animé', () => { const gif = encodeGIF(comps(), st.w, st.h, Math.round(100 / st.fps), scaleOut); download(URL.createObjectURL(new Blob([gif], {type: 'image/gif'})), 'animation.gif'); });
    b3.id = 'ps_gif'; [b1, b2, b3].forEach(b => b.style.cssText = 'width:100%;margin:3px 0');
    exp.replaceChildren(r, b1, b2, b3, el('p', 'hint', 'Le GIF garde la transparence ; 256 couleurs au plus.'));
  }
  // ---------- le clavier ----------
  const KEYS = {b: 'pen', e: 'eraser', g: 'fill', i: 'pick', l: 'line', r: 'rect', m: 'move'};
  const onKey = e => { if (!view.isConnected) { document.removeEventListener('keydown', onKey); return; } if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.shiftKey ? redoDo() : undoDo(); e.preventDefault(); } else if ((e.ctrlKey || e.metaKey) && k === 'y') { redoDo(); e.preventDefault(); }
    else if (!e.ctrlKey && KEYS[k]) { st.tool = k === 'r' && e.shiftKey ? 'frect' : KEYS[k]; drawTools(); }
    else if (e.key === ',' || e.key === '.') { st.cur = (st.cur + (e.key === '.' ? 1 : -1) + nFrames()) % nFrames(); drawFrames(); draw(); } };
  document.addEventListener('keydown', onKey);
  ctx.onClose?.(() => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); });
  function changed(framesToo) { save(); draw(); if (framesToo) drawFrames(); else { const c = frames.children[st.cur]?.firstChild; if (c) { const x2 = c.getContext('2d'); x2.clearRect(0, 0, st.w, st.h); paintFrame(x2, comp(st.cur), 1); } } }
  function all() { drawTools(); drawPal(); drawFrames(); drawLayers(); drawExport(); draw(); }
  right.insertBefore(layBox, right.firstChild);
  view.__ps = {st, comp, addLayer, mergeDown, moveLayer, undo: undoDo, encodeGIF};  // pour le test « local »
  fpsL.replaceChildren(st.fps + ' ', el('span', '', 'img/s')); all(); raf = requestAnimationFrame(anim);
  // vérification : un GIF de 2 images fabriqué ici est relu par le navigateur, qui doit retrouver les bonnes couleurs
  (async () => { const f1 = Array(16).fill(-1), f2 = Array(16).fill(hex2i('#ff4fb0')); f1[5] = hex2i('#4fc3ff');
    const url = URL.createObjectURL(new Blob([encodeGIF([f1, f2], 4, 4, 10, 1)], {type: 'image/gif'})), im = new Image(); im.src = url;
    try { await im.decode(); const c = document.createElement('canvas'); c.width = c.height = 4; const x2 = c.getContext('2d'); x2.drawImage(im, 0, 0); const d = x2.getImageData(0, 0, 4, 4).data;
      console.assert(d[3] === 0 && d[5 * 4] === 0x4f && d[5 * 4 + 1] === 0xc3 && d[5 * 4 + 3] === 255, 'pixelstudio : GIF relu'); } catch (e) { console.assert(false, 'pixelstudio : GIF illisible ' + e); } finally { URL.revokeObjectURL(url); } })();
}
