import test from "node:test";
import assert from "node:assert/strict";
import { installPwaViewport } from "../public/src/pwa-viewport.mjs";
function fixture(installed) {
  let content;
  const handlers = {};
  const doc = {
      documentElement: { classList: { toggle() {} } },
      querySelector: () => ({ setAttribute: (k, v) => (content = v) }),
      addEventListener: (k, v) => (handlers[k] = v),
    },
    win = {
      matchMedia: () => ({ matches: installed, addEventListener() {} }),
      addEventListener: (k, v) => (handlers[k] = v),
    };
  installPwaViewport({ window: win, document: doc, navigator: {} });
  return {
    handlers,
    get content() {
      return content;
    },
  };
}
test("installed PWA disables gesture zoom while a normal browser retains it", () => {
  for (const installed of [false, true]) {
    const f = fixture(installed);
    assert.equal(f.content.includes("maximum-scale=1"), installed);
    let blocked = false;
    f.handlers.gesturechange({
      preventDefault() {
        blocked = true;
      },
    });
    assert.equal(blocked, installed);
    blocked = false;
    f.handlers.touchmove({
      touches: [{}, {}],
      preventDefault() {
        blocked = true;
      },
    });
    assert.equal(blocked, installed);
  }
});
