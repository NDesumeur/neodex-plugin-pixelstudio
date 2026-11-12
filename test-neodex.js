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
  return 'crayon, pot, dupliquer, annuler ok';
};
