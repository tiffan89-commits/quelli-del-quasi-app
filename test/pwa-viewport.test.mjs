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

test("the mobile navigation is hidden only while the software keyboard takes up space", () => {
  const classes=new Set(), handlers={};
  const viewport={height:844,scale:1,addEventListener(name,fn){handlers["viewport:"+name]=fn;}};
  const doc={documentElement:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}},
    querySelector:()=>null,addEventListener(name,fn){handlers[name]=fn;}};
  const win={innerHeight:844,visualViewport:viewport,matchMedia:query=>({matches:query==="(pointer: coarse)"}),
    addEventListener(){},requestAnimationFrame:fn=>fn()};
  installPwaViewport({window:win,document:doc,navigator:{}});
  doc.activeElement={matches:()=>true};handlers.focusin();
  assert.equal(classes.has("qdq-keyboard-open"),false);
  viewport.scale=2;viewport.height=422;handlers["viewport:resize"]();
  assert.equal(classes.has("qdq-keyboard-open"),false);
  viewport.height=245;handlers["viewport:resize"]();
  assert.equal(classes.has("qdq-keyboard-open"),true);
  doc.activeElement=null;handlers.focusout();
  assert.equal(classes.has("qdq-keyboard-open"),true);
  viewport.height=422;handlers["viewport:resize"]();
  assert.equal(classes.has("qdq-keyboard-open"),false);
});
