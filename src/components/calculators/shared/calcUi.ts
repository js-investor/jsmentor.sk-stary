/** Zdieľané správanie Calc UI — vyplnená dráha sliderov cez CSS premennú --p. */

function syncSlider(el: HTMLInputElement): void {
  const min = Number(el.min || 0);
  const max = Number(el.max || 100);
  const value = Number(el.value);
  const p = max > min ? ((value - min) / (max - min)) * 100 : 0;
  el.style.setProperty("--p", `${Math.min(100, Math.max(0, p))}%`);
}

/**
 * Inicializuje slidery v koreni kalkulačky. Reaguje na user input; po klikoch
 * (prepnutie variantu nastavuje hodnoty programovo) sa re-synchronizuje v rAF.
 * Vracia cleanup.
 */
export function initCalcSliders(rootId: string): () => void {
  const root = document.getElementById(rootId);
  if (!root) return () => {};

  const syncAll = () =>
    root.querySelectorAll<HTMLInputElement>("input[type='range']").forEach(syncSlider);

  const onInput = (e: Event) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === "range") syncSlider(t);
  };

  let raf = 0;
  const onClick = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(syncAll);
  };

  syncAll();
  root.addEventListener("input", onInput);
  document.addEventListener("click", onClick);

  return () => {
    cancelAnimationFrame(raf);
    root.removeEventListener("input", onInput);
    document.removeEventListener("click", onClick);
  };
}

/** Brandové farby grafov — jednotná téma Chart.js naprieč kalkulačkami. */
export const CALC_CHART_COLORS = {
  /** Lesná zelená — primárna séria (rast, hodnota, výsledok). */
  primary: "#2a6647",
  primaryFill: "rgba(41, 97, 74, 0.16)",
  /** Piesková — vklady, vstupy, sekundárna séria (čiarkovaná). */
  sand: "#a99d7e",
  sandFill: "rgba(168, 149, 110, 0.12)",
  /** Terakota — dlh, náklady, negatívna séria. */
  terra: "#ab4132",
  terraFill: "rgba(193, 83, 60, 0.12)",
  grid: "rgba(0, 0, 0, 0.06)",
  tick: "rgba(0, 0, 0, 0.45)",
} as const;

/**
 * Pulz hero hodnoty pri prepočte — sleduje textContent a pri zmene krátko
 * pridá triedu `is-updating` (CSS animácia). Vracia cleanup.
 */
export function initCalcHeroPulse(valueId: string): () => void {
  const el = document.getElementById(valueId);
  if (!el) return () => {};

  let timer = 0;
  const observer = new MutationObserver(() => {
    el.classList.remove("is-updating");
    // reflow, aby sa animácia reštartovala aj pri rýchlych zmenách
    void el.offsetWidth;
    el.classList.add("is-updating");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => el.classList.remove("is-updating"), 450);
  });

  observer.observe(el, { childList: true, characterData: true, subtree: true });

  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
  };
}

/**
 * Zrkadlenie hodnôt vstupov do textových prvkov: element s data-echo-of="<inputId>"
 * zobrazuje input.value + voliteľný data-echo-suffix. Sync na input + po klikoch
 * (programové zmeny pri prepnutí variantu).
 */
export function initCalcEcho(rootId: string): () => void {
  const root = document.getElementById(rootId);
  if (!root) return () => {};

  const sync = () => {
    root.querySelectorAll<HTMLElement>("[data-echo-of]").forEach((el) => {
      const src = document.getElementById(el.dataset.echoOf || "") as HTMLInputElement | null;
      if (src) el.textContent = src.value + (el.dataset.echoSuffix || "");
    });
  };

  let raf = 0;
  const onEvent = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(sync);
  };

  sync();
  root.addEventListener("input", onEvent);
  document.addEventListener("click", onEvent);

  return () => {
    cancelAnimationFrame(raf);
    root.removeEventListener("input", onEvent);
    document.removeEventListener("click", onEvent);
  };
}
