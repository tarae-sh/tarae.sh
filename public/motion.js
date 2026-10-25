// Before the first paint: the page is written by its sessions only where motion is welcome; else it stands as it is.
try {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const root = document.documentElement;
    root.classList.add("anim");
    // If weave.js hasn't taken the page (`.woven`) soon after it's there — it didn't load, or it threw — the page
    // stands as written rather than hidden for good. Counted from when the page is in view: a tab opened behind
    // doesn't play till it's looked at.
    const failsafe = () => {
      if (document.hidden) {
        document.addEventListener("visibilitychange", failsafe, { once: true });
        return;
      }
      setTimeout(() => {
        if (!root.classList.contains("woven")) root.classList.remove("anim");
      }, 1500);
    };
    document.addEventListener("DOMContentLoaded", failsafe);
  }
} catch (_) {
  // no matchMedia: the page stands as written
}
