import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {config} from '../netlify/functions/operational-dispatch.mjs';
test('prebuilt releases retain the dispatcher schedule in function metadata',()=>{assert.equal(config.schedule,'* * * * *');});
test('public scores are published before fallible downstream vote calculations',async()=>{const s=await fs.readFile(new URL('../lib/operations/workflows.mjs',import.meta.url),'utf8'),p=s.indexOf('const saved=await patchSports'),tail=s.slice(p);assert.ok(tail.indexOf('publishMatches(saved.matches)')<tail.indexOf('await ingestFixture('));assert.equal((tail.match(/publishMatches\(saved.matches\)/g)||[]).length,1);});
