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
