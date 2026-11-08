import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
const html = fs.readFileSync(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
const source = fs.readFileSync(new URL('../public/src/app.mjs',import.meta.url),'utf8');
test("chat entry is a league tile and the floating launcher is absent",()=>{
 assert.match(source,/hubTile\('chat','Chiacchiere da bar'/);
 assert.doesNotMatch(source,/chatLauncherView|bindSupportDrag/);
});

test('ordinary browser zoom remains available and the installed-PWA viewport module is loaded',()=>{assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1|gesturestart|gesturechange/);assert.match(html,/viewport-fit=cover/);assert.ok(html.includes("/src/pwa-viewport.mjs"));const css=fs.readFileSync(new URL('../public/experience.css',import.meta.url),'utf8');assert.match(css,/touch-action:auto!important/);});
