import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pageMetrics, oneScreenExcluded } from '../public/src/one-screen.mjs';

test('pageMetrics conta le pagine e la pagina corrente', () => {
 assert.deepEqual(pageMetrics(390, 390, 0), { pages: 1, page: 0 });
 assert.deepEqual(pageMetrics(1170, 390, 0), { pages: 3, page: 0 });
 assert.deepEqual(pageMetrics(1170, 390, 395), { pages: 3, page: 1 });
 assert.deepEqual(pageMetrics(1170, 390, 5000), { pages: 3, page: 2 });
 assert.deepEqual(pageMetrics(1176, 390, 0).pages, 3, 'qualche pixel in più non crea una pagina vuota');
 assert.deepEqual(pageMetrics(500, 0, 0), { pages: 1, page: 0 });
});

function fakeDoc({ tabbar = true, hash = '#/bar/oggi', bodyClasses = [], inside = [] } = {}) {
 const classes = new Set(bodyClasses);
 const main = {
  matches: () => false,
  querySelector: selector => inside.some(s => selector.split(',').includes(s)) ? {} : null
 };
 const doc = {
  body: { classList: { contains: c => classes.has(c) } },
  defaultView: { location: { hash } },
  querySelector: s => (s === '#app > .v2-tabbar' && tabbar ? {} : null)
 };
 main.ownerDocument = doc;
 return { doc, main };
}

test('le sezioni normali usano le pagine laterali', () => {
 const { doc, main } = fakeDoc();
 assert.equal(oneScreenExcluded(main, doc), false);
});

test('asta, pagina partita, landing e schermate senza barra restano come prima', () => {
 for (const inside of [['.auction-room'], ['.fanta-asta'], ['.auction-lobby'], ['.auction-wizard-fields'], ['[data-bid-form]'], ['[data-lega-sub="asta"][aria-selected="true"]'], ['.pb-landing']]) {
  const { doc, main } = fakeDoc({ inside });
  assert.equal(oneScreenExcluded(main, doc), true, inside[0]);
 }
 assert.equal(oneScreenExcluded(...Object.values(fakeDoc({ hash: '#/fanta/asta' })).reverse()), true);
 assert.equal(oneScreenExcluded(...Object.values(fakeDoc({ bodyClasses: ['match-page-active'] })).reverse()), true);
 assert.equal(oneScreenExcluded(...Object.values(fakeDoc({ tabbar: false })).reverse()), true);
 assert.equal(oneScreenExcluded(null), true);
});

test('le classi radice della sala d\'asta sono tra le esclusioni', async () => {
 const asta = await readFile(new URL('../public/src/fanta/asta.mjs', import.meta.url), 'utf8');
 const module = await readFile(new URL('../public/src/one-screen.mjs', import.meta.url), 'utf8');
 for (const cls of ['fanta-asta auction-room', 'auction-lobby', 'auction-countdown-overlay']) assert.ok(asta.includes(cls), cls + ' presente in asta.mjs');
 for (const sel of ['.auction-room', '.fanta-asta', '.auction-lobby', '.auction-countdown-overlay']) assert.ok(module.includes("'" + sel + "'"), sel + ' escluso');
});

test('il foglio one-screen.css è caricato in sviluppo e nel bundle', async () => {
 for (const file of ['../public/src/app-styles.mjs', '../scripts/build-ux.mjs']) {
  const text = await readFile(new URL(file, import.meta.url), 'utf8');
  assert.match(text, /'auction-room\.css','one-screen\.css','one-screen-ui\.css'\]/, file);
 }
 const css = await readFile(new URL('../public/one-screen.css', import.meta.url), 'utf8');
 assert.match(css, /html\.os-on/);
 assert.doesNotMatch(css, /auction/, 'nessuna regola tocca l\'asta');
 const ui = await readFile(new URL('../public/one-screen-ui.css', import.meta.url), 'utf8');
 assert.match(ui, /html\.os-on/);
 assert.doesNotMatch(ui, /auction|fanta-asta/, 'nessuna regola tocca l\'asta');
});
