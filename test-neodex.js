// lancé par le test « local » de NeoDex : un trait au crayon, le pot de peinture, une image dupliquée, annuler, la symétrie
module.exports = async ({ pj, sleep }) => {
  const info = () => pj(`document.getElementById('ps_info').textContent`);
  const at = (ev, x, y, button = 0) => `c.dispatchEvent(new PointerEvent('${ev}', {clientX: r.left + (${x} + .5) * r.width / 32, clientY: r.top + (${y} + .5) * r.height / 32, button: ${button}, bubbles: true, pointerId: 1}));`;
  const run = s => pj(`(() => { const c = document.getElementById('ps_canvas'), r = c.getBoundingClientRect(); ${s} })(), 0`);
  await sleep(600);
  if (!/32×32 · 1\/1 · 2 couleurs/.test(await info())) throw new Error('au départ : ' + await info());
  await pj(`document.querySelector('.psPal [data-i="10"]').click(), 0`);
  await run(at('pointerdown', 2, 2) + at('pointermove', 10, 2) + at('pointerup', 10, 2)); await sleep(100);
  if (!/3 couleurs/.test(await info())) throw new Error('trait : ' + await info());
  await pj(`document.querySelector('.psPal [data-i="22"]').click(), document.querySelector('[data-tool=fill]').click(), 0`);
  await run(at('pointerdown', 0, 0) + at('pointerup', 0, 0)); await sleep(100);
  const px = await pj(`(() => { const c = document.getElementById('ps_canvas'), d = c.getContext('2d').getImageData(c.width / 32 * 30.5, c.height / 32 * .5, 1, 1).data; return [...d].slice(0, 3).join(); })()`);
  if (px !== '79,138,255') throw new Error('pot de peinture : ' + px);
  await pj(`[...document.querySelectorAll('button')].find(b => b.textContent === '⧉ Dupliquer').click(), 0`); await sleep(100);
  if (!/2\/2/.test(await info())) throw new Error('dupliquer : ' + await info());
  await pj(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'z', ctrlKey: true})), 0`); await sleep(100);
  if (!/1\/1/.test(await info())) throw new Error('annuler : ' + await info());
  await pj(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'z', ctrlKey: true})), 0`); await sleep(100);
  await pj(`document.querySelector('[data-tool=pen]').click(), 0`);
  const over = await pj(`[...document.querySelectorAll('.appWrap *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length`);
  if (over) throw new Error(over + ' élément(s) débordent à droite');
  // les calques : un pixel sur le calque 2 couvre le calque 1, se cache, se fusionne ; une nouvelle image arrive dans tous les calques
  const ly = await pj(`(() => { const P = document.querySelector('.psGrid').closest('.appWrap').parentNode.__ps, st = P.st, i0 = 0;
    const below = st.stack[0].frames[st.cur][i0]; P.addLayer(); if (st.stack.length !== 2 || st.li !== 1) return {err: 'nouveau calque'};
    st.frames[st.cur][i0] = 0xff0000; if (P.comp(st.cur)[i0] !== 0xff0000) return {err: 'le calque du dessus ne couvre pas'};
    st.stack[1].vis = false; if (P.comp(st.cur)[i0] !== below) return {err: 'calque caché encore visible'}; st.stack[1].vis = true;
    [...document.querySelectorAll('.psFrames ~ *, button')].find(b => b.textContent === '+ Nouvelle').click(); if (st.stack[0].frames.length !== st.stack[1].frames.length) return {err: 'images désaccordées'};
    P.mergeDown(); if (st.stack.length !== 1 || st.stack[0].frames[st.cur - 1][i0] !== 0xff0000) return {err: 'fusion : ' + st.stack.length};
    P.undo(); if (st.stack.length !== 2) return {err: 'annuler la fusion'};
    const rows = [...document.querySelectorAll('.psLay')].map(r => r.textContent).join('|'); return {rows, gif: P.encodeGIF(st.stack.map(() => P.comp(0)), st.w, st.h, 10, 1).length}; })()`);
  if (ly.err) throw new Error(ly.err);
  return 'calques (' + ly.rows + ') · crayon, pot, dupliquer, annuler ok';
};
