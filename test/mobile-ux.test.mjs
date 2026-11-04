import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
const html = fs.readFileSync(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
const source = fs.readFileSync(new URL('../public/src/app.mjs',import.meta.url),'utf8');
test("floating chat button distinguishes a tap from a drag, clamps above navigation and restores position", () => {
  const listeners = {},
    saved = {};
  const button = {
    isConnected: true,
    dataset: {},
    offsetWidth: 46,
    offsetHeight: 46,
    style: {},
    classList: { add() {}, remove() {} },
    getBoundingClientRect: () => ({ left: 330, top: 500 }),
    setPointerCapture() {},
    addEventListener: (name, fn) => (listeners[name] = fn),
  };
  const context = {
    $: (s) =>
      s === "#open-chat"
        ? button
        : { getBoundingClientRect: () => ({ top: 700 }) },
    window: { innerWidth: 390, innerHeight: 844, addEventListener() {} },
    localStorage: { getItem: () => null, setItem: (k, v) => (saved[k] = v) },
  };
  vm.createContext(context);
  vm.runInContext(
    source.slice(
      source.indexOf("let supportPosition = null;"),
      source.indexOf("function bind(l, r)"),
    ) + ";bindSupportDrag()",
    context,
  );
  listeners.pointerdown({
    pointerId: 1,
    pointerType: "touch",
    clientX: 350,
    clientY: 520,
  });
  listeners.pointerup({ pointerId: 1 });
  let prevented = false;
  listeners.click({
    preventDefault() {
      prevented = true;
    },
    stopImmediatePropagation() {},
  });
  assert.equal(prevented, false);
  listeners.pointerdown({
    pointerId: 2,
    pointerType: "touch",
    clientX: 350,
    clientY: 520,
  });
  listeners.pointermove({
    pointerId: 2,
    clientX: -500,
    clientY: 1000,
    preventDefault() {},
  });
  listeners.pointerup({ pointerId: 2 });
  assert.equal(button.style.left, "8px");
  assert.equal(button.style.top, "642px");
  listeners.click({
    preventDefault() {
      prevented = true;
    },
    stopImmediatePropagation() {},
  });
  assert.equal(prevented, true);
  assert.ok(saved.quasiChatPosition);
  vm.runInContext("bindSupportDrag()", context);
  assert.equal(button.style.top, "642px");
});
test('ordinary browser zoom remains available and the installed-PWA viewport module is loaded',()=>{assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1|gesturestart|gesturechange/);assert.match(html,/viewport-fit=cover/);assert.ok(html.includes("/src/pwa-viewport.mjs"));const css=fs.readFileSync(new URL('../public/experience.css',import.meta.url),'utf8');assert.match(css,/touch-action:auto!important/);});
