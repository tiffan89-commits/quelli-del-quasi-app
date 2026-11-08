// Lock gesture zoom only in the installed app; ordinary browser accessibility
// zoom remains available. The OS may still apply its own accessibility settings.
export function installPwaViewport({
  window: win = window,
  document: doc = document,
  navigator: nav = navigator,
} = {}) {
  const standalone = () =>
    win.matchMedia?.("(display-mode: standalone)").matches ||
    nav.standalone === true;
  const update = () => {
    const installed = !!standalone();
    doc.documentElement.classList.toggle("pwa-fixed-viewport", installed);
    doc
      .querySelector('meta[name="viewport"]')
      ?.setAttribute(
        "content",
        "width=device-width,initial-scale=1,viewport-fit=cover" +
          (installed ? ",maximum-scale=1,user-scalable=no" : ""),
      );
  };
  update();
  win
    .matchMedia?.("(display-mode: standalone)")
    .addEventListener?.("change", update);
  const viewport = win.visualViewport;
  if (viewport && win.matchMedia?.("(pointer: coarse)").matches) {
    const visibleHeight = () => viewport.height * viewport.scale;
    let fullHeight = visibleHeight();
    let keyboardOpen = false;
    const updateKeyboard = () => {
      const active = doc.activeElement;
      const editing = !active?.readOnly && !active?.disabled &&
        active?.matches?.('textarea,input:not([type]),input[type=text],input[type=search],input[type=email],input[type=password],input[type=url],input[type=tel],input[type=number],[contenteditable]:not([contenteditable=false])');
      const reduced = Math.max(fullHeight, win.innerHeight) - visibleHeight() > 100;
      keyboardOpen = (editing || keyboardOpen) && reduced;
      if (!editing && !keyboardOpen) fullHeight = visibleHeight();
      doc.documentElement.classList.toggle("qdq-keyboard-open", !!keyboardOpen);
    };
    viewport.addEventListener("resize", updateKeyboard);
    win.addEventListener("resize", updateKeyboard);
    win.addEventListener("orientationchange", () => {
      fullHeight = visibleHeight();
      keyboardOpen = false;
      updateKeyboard();
    });
    for (const event of ["focusin", "focusout"])
      doc.addEventListener(event, () => win.requestAnimationFrame(updateKeyboard));
  }
  for (const event of ["gesturestart", "gesturechange"])
    doc.addEventListener(
      event,
      (e) => {
        if (standalone()) e.preventDefault();
      },
      { passive: false },
    );
  doc.addEventListener(
    "touchmove",
    (e) => {
      if (standalone() && e.touches?.length > 1) e.preventDefault();
    },
    { passive: false },
  );
  win.addEventListener(
    "wheel",
    (e) => {
      if (standalone() && e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
}
if (typeof window !== "undefined") installPwaViewport();
