import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const json = async path => JSON.parse(await read(path));

test('Release Please keeps the package, public app and PWA cache on the same version', async () => {
 const [manifest, config, pkg, lock, publicApp, serviceWorker] = await Promise.all([
  json('.release-please-manifest.json'), json('release-please-config.json'), json('package.json'),
  json('package-lock.json'), json('public/version.json'), read('public/sw.js'),
 ]);
 const version = manifest['.'];
 assert.match(version, /^\d+\.\d+\.\d+$/);
 assert.deepEqual([pkg.version, lock.version, lock.packages[''].version, publicApp.version], Array(4).fill(version));
 assert.equal(serviceWorker.split(/\r?\n/)[0], `const CACHE = "quellidelquasi-shell-v${version}"; // x-release-please-version`);
 assert.equal(config.packages['.']['release-type'], 'node');
 assert.equal(config.packages['.']['include-component-in-tag'], false);
 assert.deepEqual(config.packages['.']['extra-files'], [
  {type: 'json', path: 'public/version.json', jsonpath: '$.version'},
  {type: 'generic', path: 'public/sw.js'},
 ]);
});
