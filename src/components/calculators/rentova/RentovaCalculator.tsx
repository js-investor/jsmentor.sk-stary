import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { ArrowRight } from "lucide-react";
import "../shared/calc-ui.css";
import "./rentova-calculator.css";
import {
  COSTS_GROWTH,
  DEFAULT_INPUTS,
  LIMITS,
  RENT_GROWTH,
  STRATEGIES,
  compute,
  mortgagePayment,
  niceStep,
  sanitize,
  type Inputs,
  type Strategy,
} from "./rentovaModel";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/**
 * Rentová kalkulačka 2.0 – otázky zhora nadol (vzor Inteligentná hypotéka), potom výsledok.
 * Voliteľná vetva „investičný byt“: hodnota, hypotéka s úrokom, rast ceny, nájom a náklady.
 * Farby: atrament, krém, hairline a jedna zelená.
 */

const STORAGE_KEY = "jsm_rentova_v2";
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const fmt = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK")}\u00a0€`;
const fmtS = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n)).toLocaleString("sk-SK")}\u00a0€`;
const f1 = (n: number) => n.toLocaleString("sk-SK", { maximumFractionDigits: 2 });
const rokov = (y: number) => (y === 1 ? "rok" : y >= 2 && y <= 4 ? "roky" : "rokov");
const pct = (n: number) => `${Math.round(Math.min(999, Math.max(0, n)))}\u00a0%`;

/* ------------------------------------------------------------------ otázky */

type Field = { key: keyof Inputs; label: string; unit: string; chips?: number[] };
type Step = {
  id: string;
  q: string;
  help: string;
  kind: "value" | "pair" | "choice";
  field?: Field;
  fields?: Field[];
  options?: { value: number; label: string; sub: string }[];
  when?: (a: Inputs) => boolean;
  show: (a: Inputs) => string;
};

const isFlat = (a: Inputs) => a.hasFlat === 1;

const STEPS: Step[] = [
  { id: "age", kind: "value", q: "Koľko máš rokov?", help: "Od toho závisí, koľko rokov má tvoj majetok na rast.", field: { key: "currentAge", label: "Vek dnes", unit: "rokov", chips: [25, 30, 35, 40, 45, 50] }, show: (a) => `${a.currentAge} ${rokov(a.currentAge)}` },
  { id: "ret", kind: "value", q: "Od koľkých rokov chceš poberať rentu?", help: "Vek, od ktorého nechceš byť závislý od výplaty.", field: { key: "retirementAge", label: "Renta od veku", unit: "rokov", chips: [50, 55, 60, 65] }, show: (a) => `od ${a.retirementAge} rokov` },
  { id: "sav", kind: "value", q: "Koľko máš dnes odložené alebo zainvestované?", help: "Úspory, ETF, fondy, dôchodkové sporenie. Stačí približne.", field: { key: "currentSavings", label: "Úspory a investície dnes", unit: "€", chips: [0, 10000, 25000, 50000] }, show: (a) => fmt(a.currentSavings) },
  { id: "inv", kind: "value", q: "Koľko vieš mesačne investovať?", help: "Suma, ktorú pravidelne posielaš do investícií.", field: { key: "monthlyInvestment", label: "Investujem mesačne", unit: "€ / mes.", chips: [100, 200, 300, 500] }, show: (a) => `${fmt(a.monthlyInvestment)} / mes.` },
  { id: "yield", kind: "value", q: "Aký ročný výnos počas sporenia očakávaš?", help: "Dlhodobý priemer svetových akcií je okolo 7 % ročne. Radšej počítaj konzervatívne.", field: { key: "growthRate", label: "Výnos počas sporenia", unit: "% p. a.", chips: [4, 6, 7, 9] }, show: (a) => `${f1(a.growthRate)} % p. a.` },
  { id: "rent", kind: "value", q: "Akú mesačnú rentu chceš?", help: "V dnešných peniazoch. Kalkulačka ju každý rok valorizuje o infláciu.", field: { key: "desiredRent", label: "Chcem mesačnú rentu", unit: "€ / mes.", chips: [1000, 1500, 2000, 3000] }, show: (a) => `${fmt(a.desiredRent)} / mes.` },
  {
    id: "flat",
    kind: "choice",
    q: "Máš investičný byt?",
    help: "Ak áno, započítame nájom, náklady, hypotéku aj rast ceny. Pri odchode do renty sa byt predá a výnos ide do renty.",
    options: [
      { value: 1, label: "Áno, mám", sub: "započítame ho do majetku aj renty" },
      { value: 0, label: "Nie", sub: "počítame len úspory a investície" },
    ],
    show: (a) => (isFlat(a) ? "áno" : "nie"),
  },
  { id: "fval", kind: "value", when: isFlat, q: "Aká je dnešná hodnota bytu?", help: "Trhová cena, za ktorú by si ho dnes predal.", field: { key: "flatValue", label: "Hodnota bytu", unit: "€", chips: [120000, 150000, 200000, 250000] }, show: (a) => fmt(a.flatValue) },
  { id: "floan", kind: "value", when: isFlat, q: "Koľko ti ostáva splatiť na hypotéke k bytu?", help: "Zostatok dnes. Ak byt nemáš na hypotéku, daj nulu.", field: { key: "flatLoan", label: "Zostatok hypotéky", unit: "€", chips: [0, 60000, 90000, 120000] }, show: (a) => (a.flatLoan > 0 ? fmt(a.flatLoan) : "bez hypotéky") },
  {
    id: "fmort",
    kind: "pair",
    when: (a) => isFlat(a) && a.flatLoan > 0,
    q: "Aký máš úrok a koľko rokov ešte splácaš?",
    help: "Sadzba z aktuálnej fixácie a zostávajúca splatnosť.",
    fields: [
      { key: "flatRate", label: "Úrok", unit: "% p. a.", chips: [3, 3.5, 4, 4.5] },
      { key: "flatYears", label: "Zostávajúca splatnosť", unit: "rokov", chips: [10, 15, 20, 25] },
    ],
    show: (a) => `${f1(a.flatRate)} %, ${a.flatYears} ${rokov(a.flatYears)}`,
  },
  { id: "fgrowth", kind: "value", when: isFlat, q: "Aký ročný rast ceny bytu očakávaš?", help: "Dlhodobo rastú ceny bytov zhruba s infláciou a niečo navyše. Počítaj skôr opatrne.", field: { key: "flatGrowth", label: "Rast ceny bytu", unit: "% p. a.", chips: [2, 3, 4, 5] }, show: (a) => `${f1(a.flatGrowth)} % p. a.` },
  {
    id: "fcash",
    kind: "pair",
    when: isFlat,
    q: "Aký je mesačný nájom a náklady na byt?",
    help: `Náklady: fond opráv, poistenie, daň, údržba, neobsadenosť. Nájom rastie ${RENT_GROWTH} % ročne, náklady ${COSTS_GROWTH} % ročne.`,
    fields: [
      { key: "flatRent", label: "Nájom", unit: "€ / mes.", chips: [500, 650, 800, 1000] },
      { key: "flatCosts", label: "Náklady", unit: "€ / mes.", chips: [100, 150, 200, 300] },
    ],
    show: (a) => `nájom ${fmt(a.flatRent)}, náklady ${fmt(a.flatCosts)}`,
  },
];

type Saved = { answers: Inputs; done: boolean; strategy: Strategy };

const loadSaved = (): Saved => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { answers: DEFAULT_INPUTS, done: false, strategy: "drawdown" };
    const parsed = JSON.parse(raw) as Partial<Saved>;
    const strategy = STRATEGIES.includes(parsed.strategy as Strategy) ? (parsed.strategy as Strategy) : "drawdown";
    return { answers: sanitize({ ...DEFAULT_INPUTS, ...(parsed.answers ?? {}) }), done: Boolean(parsed.done), strategy };
  } catch {
    return { answers: DEFAULT_INPUTS, done: false, strategy: "drawdown" };
  }
};

/** Plynulé dobehnutie čísla k cieľu. */
function useCountUp(target: number, ms = 600): number {
  const [v, setV] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = target;
    };
  }, [target, ms]);
  return v;
}

/* ------------------------------------------------------------------ vstup: číslo + slider + čipy */

type ValueFieldProps = {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  chips?: number[];
  compact?: boolean;
  onChange: (v: number) => void;
  onEnter?: () => void;
};

const ValueField = ({ label, unit, value, min, max, step, chips, compact, onChange, onEnter }: ValueFieldProps) => {
  const [editing, setEditing] = useState(false);
  const decimals = Math.max(0, (String(step).split(".")[1] ?? "").length);
  const clamp = (v: number) => Number(Math.max(min, Math.min(max, Number.isFinite(v) ? v : min)).toFixed(decimals));
  const shown = editing ? String(value).replace(".", ",") : value.toLocaleString("sk-SK", { maximumFractionDigits: decimals });
  const p = `${((value - min) / (max - min)) * 100}%`;
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
      onEnter?.();
    }
  };
  return (
    <div className={`rn-answer${compact ? " is-compact" : ""}`}>
      {compact ? <span className="rn-answer-label">{label}</span> : null}
      <div className="rn-answer-row">
        <input
          className="rn-answer-input"
          type="text"
          inputMode="decimal"
          value={shown}
          aria-label={label}
          size={Math.max(3, shown.length)}
          onFocus={() => setEditing(true)}
          onBlur={(e) => {
            setEditing(false);
            onChange(clamp(Number(e.target.value.replace(/\s/g, "").replace(",", "."))));
          }}
          onChange={(e) => {
            const v = Number(e.target.value.replace(/[^0-9.,-]/g, "").replace(",", "."));
            if (Number.isFinite(v)) onChange(clamp(v));
          }}
          onKeyDown={onKey}
        />
        <span className="rn-answer-unit">{unit}</span>
      </div>
      <input
        type="range"
        className="calc-slider rn-slider"
        style={{ "--p": p } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${label} (posuvník)`}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <div className="rn-scale">
        <span>{min.toLocaleString("sk-SK")}</span>
        <span>{max.toLocaleString("sk-SK")}</span>
      </div>
      {chips ? (
        <div className="rn-chips" role="group" aria-label="Rýchly výber">
          {chips.map((c) => (
            <button key={c} type="button" className={`rn-chip${value === c ? " is-on" : ""}`} aria-pressed={value === c} onClick={() => onChange(c)}>
              {c.toLocaleString("sk-SK")} {unit}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ graf */

const W = 940;
const H = 400;
const PL = 66;
const PR = W - 28;
const PT = 40;
const PB = H - 40;

const STRATEGY_LABEL: Record<Strategy, string> = { drawdown: "Dočerpať majetok", perpetual: "Večná renta", rule4: "Pravidlo 4 %" };

/* ------------------------------------------------------------------ komponent */

const RentovaCalculator = () => {
  const [saved] = useState(loadSaved);
  const [A, setA] = useState<Inputs>(saved.answers);
  const [done, setDone] = useState(saved.done);
  const [strategy, setStrategy] = useState<Strategy>(saved.strategy);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; k: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const drawnRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: A, done, strategy } satisfies Saved));
    } catch {
      /* súkromný režim */
    }
  }, [A, done, strategy]);

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setA((s) => ({ ...s, [k]: v }));
  const D = useMemo(() => sanitize(A), [A]);
  const r = useMemo(() => compute(D, strategy), [D, strategy]);

  const steps = useMemo(() => STEPS.filter((s) => !s.when || s.when(D)), [D]);
  const activeIndex = Math.min(editing ?? step, steps.length - 1);
  const current = steps[activeIndex];
  const showQuestion = !done || editing !== null;
  const progress = done ? 100 : (step / steps.length) * 100;
  const answered = done ? steps : steps.slice(0, Math.min(step, steps.length));

  const shownIncome = useCountUp(r.sel.incomeToday);
  const shownC = useCountUp(r.C);

  const next = () => {
    if (editing !== null) {
      setEditing(null);
      return;
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    setDone(true);
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const back = () => {
    if (editing !== null) setEditing(null);
    else if (step > 0) setStep(step - 1);
  };
  const restart = () => {
    setA(DEFAULT_INPUTS);
    setDone(false);
    setEditing(null);
    setStep(0);
    drawnRef.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const choose = (v: number) => {
    set("hasFlat", v);
    if (editing !== null) {
      setEditing(null);
      return;
    }
    // zoznam otázok sa touto odpoveďou mení (vetva bytu), preto ho prepočítame z novej odpovede
    const nextSteps = STEPS.filter((s) => !s.when || s.when(sanitize({ ...A, hasFlat: v })));
    if (step < nextSteps.length - 1) {
      setStep(step + 1);
      return;
    }
    setDone(true);
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  /* geometria grafu: vek na osi x, majetok na osi y */
  const G = useMemo(() => {
    const K = r.ages.length - 1;
    const yMax = Math.max(...r.yearWealth, 1) * 1.1;
    const xS = (k: number) => PL + (k / Math.max(1, K)) * (PR - PL);
    const yS = (v: number) => PB - (v / yMax) * (PB - PT);
    const line = (arr: (number | null)[]) =>
      arr.map((v, k) => (v === null ? null : `${k === 0 || arr[k - 1] === null ? "M" : "L"}${xS(k).toFixed(1)} ${yS(v).toFixed(1)}`)).filter(Boolean).join(" ");
    const area = `${line(r.yearWealth)} L${PR.toFixed(1)} ${PB.toFixed(1)} L${PL.toFixed(1)} ${PB.toFixed(1)} Z`;
    const stepV = niceStep(yMax / 4);
    const grid: number[] = [];
    for (let v = 0; v <= yMax; v += stepV) grid.push(v);
    const stepYr = K <= 20 ? 5 : 10;
    const ticks: number[] = [];
    for (let k = 0; k < K; k += stepYr) ticks.push(k);
    ticks.push(K);
    return { K, yMax, xS, yS, line, area, grid, ticks };
  }, [r]);

  /* dokreslenie čiar pri prvom zobrazení výsledku */
  useEffect(() => {
    if (!done || drawnRef.current) return;
    drawnRef.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const paths = svgRef.current?.querySelectorAll<SVGPathElement>(".rn-ln");
    if (!paths?.length) return;
    const timers: number[] = [];
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      p.getBoundingClientRect();
      p.style.transition = `stroke-dashoffset 1.1s cubic-bezier(0.22, 0.61, 0.36, 1) ${200 + i * 150}ms`;
      p.style.strokeDashoffset = "0";
      timers.push(
        window.setTimeout(() => {
          p.style.transition = "";
          p.style.strokeDasharray = "";
          p.style.strokeDashoffset = "";
        }, 1600 + i * 150),
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [done]);

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    const host = hostRef.current;
    if (!svg || !host) return;
    const rect = svg.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const scale = rect.width / W;
    const lx = (clientX - rect.left) / scale;
    const k = Math.max(0, Math.min(G.K, Math.round(((lx - PL) / (PR - PL)) * G.K)));
    setTip({ x: G.xS(k) * scale + (rect.left - hr.left), y: G.yS(r.yearWealth[k]) * scale + (rect.top - hr.top), k });
  };

  const retX = G.xS(r.retirementIndex);
  const retY = G.yS(r.yearWealth[r.retirementIndex]);
  const labelLeft = retX > (PL + PR) / 2;
  const tipK = tip?.k ?? 0;
  const goalOk = r.goalPct >= 99.5;
  const infinite = !Number.isFinite(r.required);
  const flat = D.hasFlat === 1;
  const payment = flat && D.flatLoan > 0 ? mortgagePayment(D.flatLoan, D.flatRate, D.flatYears) : 0;

  /* živá nápoveda pod otázkou */
  const hint = (() => {
    if (!current) return null;
    if (current.id === "ret") return `Do renty ti ostáva ${D.retirementAge - D.currentAge} ${rokov(D.retirementAge - D.currentAge)}.`;
    if (current.id === "fmort") return `Splátka pri týchto číslach: ${fmt(payment)} mesačne.`;
    if (current.id === "fcash") {
      const cf = D.flatRent - D.flatCosts - payment;
      return `Cashflow dnes: nájom − náklady${payment > 0 ? " − splátka" : ""} = ${fmtS(cf)} mesačne. ${cf > 0 ? "Investuje sa do renty." : "Do majetku sa počíta, až keď bude kladný."}`;
    }
    return null;
  })();

  const renderField = (f: Field, compact = false) => (
    <ValueField
      key={f.key}
      label={f.label}
      unit={f.unit}
      value={A[f.key]}
      {...LIMITS[f.key]}
      chips={f.chips}
      compact={compact}
      onChange={(v) => set(f.key, v)}
      onEnter={next}
    />
  );

  return (
    <div id="rn-root" className="calc-ui rn w-full font-sans">
      <div className="calc-body-shell">
        <div className="calc-page rn-page">
          <header className="calc-header calc-reveal" style={st(0)}>
            <span className="calc-eyebrow">Rentová kalkulačka</span>
            <h1 className="calc-title">
              Aká renta ti môže chodiť<br />
              <em>z majetku?</em>
            </h1>
            <p className="calc-subtitle">
              Pár otázok, žiadna registrácia. Úspory, investície a prípadne investičný byt, ktorý sa pri odchode do renty predá.
              Uvidíš rentu v dnešných peniazoch a tri cesty, ako cieľ dosiahnuť.
            </p>
          </header>

          {/* ═══ Otázky zhora nadol ═══ */}
          <section className="rn-flow calc-reveal" aria-label="Otázky" style={st(1)}>
            <div className="rn-progress" aria-hidden>
              <span className="rn-progress-label">{done && editing === null ? "Hotovo" : `Otázka ${activeIndex + 1} z ${steps.length}`}</span>
              <span className="rn-progress-track"><span className="rn-progress-fill" style={{ width: `${progress}%` }} /></span>
            </div>

            {answered.length > 0 ? (
              <ol className="rn-done">
                {answered.map((s, i) => (
                  <li key={s.id} className={editing === i ? "is-editing" : ""}>
                    <span className="rn-done-q">{s.q}</span>
                    <span className="rn-done-v">{s.show(D)}</span>
                    <button type="button" className="rn-done-edit" onClick={() => setEditing(i)} disabled={editing === i}>
                      Upraviť
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}

            {showQuestion && current ? (
              <div key={`${current.id}-${editing}`} className="rn-q">
                <h2 className="rn-q-title">{current.q}</h2>
                <p className="rn-q-help">{current.help}</p>

                {current.kind === "choice" ? (
                  <div className="rn-choice" role="group" aria-label={current.q}>
                    {current.options?.map((o) => (
                      <button key={o.value} type="button" className={`rn-option${A.hasFlat === o.value ? " is-on" : ""}`} aria-pressed={A.hasFlat === o.value} onClick={() => choose(o.value)}>
                        <b>{o.label}</b>
                        <small>{o.sub}</small>
                      </button>
                    ))}
                  </div>
                ) : current.kind === "pair" ? (
                  <div className="rn-pair">{current.fields?.map((f) => renderField(f, true))}</div>
                ) : current.field ? (
                  renderField(current.field)
                ) : null}

                {hint ? <p className="rn-q-hint">{hint}</p> : null}
                <div className="rn-q-actions">
                  {activeIndex > 0 || editing !== null ? (
                    <button type="button" className="rn-back" onClick={back}>
                      {editing !== null ? "Zrušiť" : "Späť"}
                    </button>
                  ) : (
                    <span />
                  )}
                  <button type="button" className="btn-primary rn-next" onClick={next}>
                    {editing !== null ? "Hotovo" : activeIndex < steps.length - 1 ? "Ďalej" : "Ukázať výsledok"}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              </div>
            ) : (
              <div className="rn-flow-foot">
                <button type="button" className="rn-back" onClick={restart}>Začať odznova</button>
              </div>
            )}
          </section>

          {/* ═══ Výsledok ═══ */}
          {done ? (
            <section ref={resultRef} className="rn-result" aria-label="Výsledok">
              <div className="rn-verdict calc-reveal" style={st(0)}>
                <span className="rn-kicker">Tvoja renta · {STRATEGY_LABEL[strategy].toLowerCase()}</span>
                <h2 className="rn-verdict-title">
                  Od {D.retirementAge} rokov ti môže chodiť <em>{fmt(shownIncome)} mesačne</em>.
                </h2>
                <p className="rn-verdict-text">
                  V dnešných peniazoch{r.N > 0 ? `, v roku ${new Date().getFullYear() + r.N} to bude ${fmt(r.sel.incomeNominal)}` : ""}. Majetok vo veku {D.retirementAge} bude{" "}
                  <strong>{fmt(shownC)}</strong>
                  {flat ? (
                    <>
                      , z toho predaj bytu <strong>{fmt(r.acc.proceeds)}</strong>
                    </>
                  ) : null}
                  .{" "}
                  {D.otherIncome > 0 ? `Spolu s iným príjmom ${fmt(D.otherIncome)} je to ${fmt(r.totalIncomeToday)} mesačne. ` : ""}
                  {infinite
                    ? "Večná renta pri výnose pod infláciou nefunguje, skús iný spôsob čerpania."
                    : goalOk
                      ? `Cieľ ${fmt(D.desiredRent)} je splnený na ${pct(r.goalPct)}.`
                      : `Cieľ ${fmt(D.desiredRent)} to pokrýva na ${pct(r.goalPct)}, chýba ${fmt(r.incomeGapToday)} mesačne. Nižšie sú tri cesty, ako to dobehnúť.`}
                </p>
              </div>

              <div className="rn-stats calc-reveal" style={st(1)}>
                <div>
                  <span className="rn-stat-label">Majetok vo veku {D.retirementAge}</span>
                  <strong>{fmt(r.C)}</strong>
                  <small>{flat ? `portfólio ${fmt(r.acc.portfolio[r.acc.n])} + byt ${fmt(r.acc.proceeds)}` : `vložíš ${fmt(r.acc.invested[r.acc.n])}, zvyšok je výnos`}</small>
                </div>
                <div>
                  <span className="rn-stat-label">Potrebný kapitál</span>
                  <strong>{infinite ? "∞" : fmt(r.required)}</strong>
                  <small>na rentu {fmt(r.targetToday)} do {D.endAge} rokov</small>
                </div>
                <div>
                  <span className="rn-stat-label">{infinite ? "Rozdiel" : r.gap > 0 ? "Chýba" : "Rezerva"}</span>
                  <strong className={!infinite && r.gap <= 0 ? "is-accent" : ""}>{infinite ? "—" : fmt(Math.abs(r.gap))}</strong>
                  <small>{infinite ? "výnos počas renty je pod infláciou" : r.gap > 0 ? "kapitálu vo veku " + D.retirementAge : "nad rámec potrebného kapitálu"}</small>
                </div>
              </div>

              {/* spôsob čerpania */}
              <div className="rn-strats calc-reveal" style={st(2)} role="group" aria-label="Spôsob čerpania">
                {STRATEGIES.map((s) => (
                  <button key={s} type="button" className={`rn-strat${strategy === s ? " is-on" : ""}`} aria-pressed={strategy === s} onClick={() => setStrategy(s)}>
                    <span>{STRATEGY_LABEL[s]}</span>
                    <b>{fmt(r.results[s].incomeToday)}</b>
                  </button>
                ))}
              </div>
              <p className="rn-strat-desc">
                {strategy === "drawdown"
                  ? `Renta chodí do ${D.endAge} rokov a majetok sa postupne minie.`
                  : strategy === "perpetual"
                    ? "Čerpáš len reálny výnos, majetok si drží hodnotu a ostane rodine."
                    : "Prvý rok 4 % z majetku, potom valorizované o infláciu."}{" "}
                {strategy !== "drawdown" && r.sel.sim.runsOutAge !== null ? `Majetok sa minie vo veku ${r.sel.sim.runsOutAge}.` : `Majetok vo veku ${D.endAge}: ${fmt(r.sel.sim.endCapital)}.`}
              </p>

              {/* graf */}
              <div className="rn-chart-block calc-reveal" style={st(3)}>
                <div className="rn-chart-head">
                  <h3>Majetok od dnes po koniec renty</h3>
                  <div className="rn-legend">
                    <span><i className="rn-legend-accent" />Majetok{flat ? " (vrátane bytu)" : ""}</span>
                    <span><i className="rn-legend-ink" />Vložené</span>
                  </div>
                </div>
                <div
                  className="rn-chart-host"
                  ref={hostRef}
                  onMouseMove={(e) => onMove(e.clientX)}
                  onMouseLeave={() => setTip(null)}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    onMove(e.touches[0].clientX);
                  }}
                  onTouchEnd={() => setTip(null)}
                >
                  <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="rn-chart" aria-hidden>
                    <defs>
                      <linearGradient id="rn-gW" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#2a6647" stopOpacity="0.16" />
                        <stop offset="1" stopColor="#2a6647" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {G.grid.map((v) => (
                      <g key={v}>
                        <line className="rn-grid" x1={PL} x2={PR} y1={G.yS(v)} y2={G.yS(v)} />
                        <text className="rn-ax" x={PL - 10} y={G.yS(v) + 4} textAnchor="end">
                          {v >= 1000000 ? `${f1(Math.round(v / 100000) / 10)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
                        </text>
                      </g>
                    ))}
                    <path d={G.area} fill="url(#rn-gW)" />
                    <path className="rn-ln" d={G.line(r.yearInvested)} fill="none" stroke="#292420" strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" />
                    <path className="rn-ln" d={G.line(r.yearWealth)} fill="none" stroke="#2a6647" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    <g>
                      <line x1={retX} x2={retX} y1={PT} y2={PB} stroke="#292420" strokeWidth={1} strokeDasharray="2 4" opacity={0.4} />
                      <circle className="rn-pulse" cx={retX} cy={retY} r={6} fill="none" stroke="#2a6647" strokeWidth={1.5} />
                      <circle cx={retX} cy={retY} r={5.5} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                      <text className="rn-cross-t" x={labelLeft ? retX - 14 : retX + 14} y={PT + 14} textAnchor={labelLeft ? "end" : "start"}>
                        renta od {D.retirementAge}
                      </text>
                      <text className="rn-cross-s" x={labelLeft ? retX - 14 : retX + 14} y={PT + 30} textAnchor={labelLeft ? "end" : "start"}>
                        {flat ? `predaj bytu ${fmtS(r.acc.proceeds)}` : `majetok ${fmt(r.C)}`}
                      </text>
                    </g>
                    {G.ticks.map((k) => (
                      <text key={k} className="rn-ax" x={G.xS(k)} y={PB + 24} textAnchor="middle">
                        {k === 0 ? "dnes" : `${r.ages[k]} r.`}
                      </text>
                    ))}
                    {tip ? (
                      <g>
                        <line x1={G.xS(tipK)} x2={G.xS(tipK)} y1={PT} y2={PB} stroke="rgba(41,36,32,0.3)" strokeWidth={1} />
                        <circle cx={G.xS(tipK)} cy={G.yS(r.yearWealth[tipK])} r={5} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                      </g>
                    ) : null}
                  </svg>
                  {tip ? (
                    <div
                      className="rn-tooltip"
                      style={{
                        left: tip.x > (hostRef.current?.offsetWidth ?? 0) - 220 ? tip.x - 210 : tip.x + 14,
                        top: Math.max(0, tip.y - 84),
                      }}
                    >
                      <div className="rn-tt-d">{tipK === 0 ? "dnes" : `vek ${r.ages[tipK]} · ${tipK <= r.retirementIndex ? "sporenie" : "renta"}`}</div>
                      <div>Majetok <b>{fmt(r.yearWealth[tipK])}</b></div>
                      {tipK <= r.retirementIndex ? (
                        <>
                          {flat ? <div>Byt (čistá hodnota) <b>{fmt(r.yearFlat[tipK])}</b></div> : null}
                          <div>Vložené <b>{fmt(r.yearInvested[tipK] ?? 0)}</b></div>
                        </>
                      ) : (
                        <div>Renta v tomto roku <b>{fmt((r.yearPaid[tipK] ?? 0) / 12)} / mes.</b></div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* investičný byt */}
              {flat ? (
                <div className="rn-flat calc-reveal" style={st(4)}>
                  <h3>Tvoj investičný byt v čísle</h3>
                  <ol className="rn-rows">
                    <li>
                      <div>
                        <span className="rn-row-t">Cashflow dnes</span>
                        <span className="rn-row-s">nájom {fmt(D.flatRent)} − náklady {fmt(D.flatCosts)}{payment > 0 ? ` − splátka ${fmt(payment)}` : ""} · do majetku sa počíta, len keď je kladný</span>
                      </div>
                      <b className={r.cashflowToday >= 0 ? "is-accent" : ""}>{fmtS(r.cashflowToday)} / mes.</b>
                    </li>
                    <li>
                      <div>
                        <span className="rn-row-t">Kladný cashflow investovaný do renty</span>
                        <span className="rn-row-s">za {r.N} {rokov(r.N)} sporenia, nájom +{RENT_GROWTH} % a náklady +{COSTS_GROWTH} % ročne</span>
                      </div>
                      <b>{fmt(r.acc.cfInvested)}</b>
                    </li>
                    {D.flatLoan > 0 ? (
                      <li>
                        <div>
                          <span className="rn-row-t">Hypotéka k bytu</span>
                          <span className="rn-row-s">{r.payoffAge !== null ? `splatená vo veku ${r.payoffAge}` : `v čase renty ostáva ${fmt(r.acc.flatDebt[r.acc.n])}, odpočíta sa z predaja`}</span>
                        </div>
                        <b>{fmt(payment)} / mes.</b>
                      </li>
                    ) : null}
                    <li className="is-total">
                      <div>
                        <span className="rn-row-t">Predaj bytu vo veku {D.retirementAge}</span>
                        <span className="rn-row-s">hodnota {fmt(r.acc.flatVal[r.acc.n])} pri raste {f1(D.flatGrowth)} % ročne{r.acc.flatDebt[r.acc.n] > 0 ? ` − zostatok hypotéky ${fmt(r.acc.flatDebt[r.acc.n])}` : ""}</span>
                      </div>
                      <b className="is-accent">{fmt(r.acc.proceeds)}</b>
                    </li>
                  </ol>
                </div>
              ) : null}

              {/* plán */}
              <div className="rn-plan calc-reveal" style={st(5)}>
                {r.targetToday === 0 ? (
                  <>
                    <h3>Cieľ je pokrytý iným príjmom</h3>
                    <p className="rn-plan-sub">Renta z majetku {fmt(r.sel.incomeToday)} mesačne je celá navyše.</p>
                  </>
                ) : infinite ? (
                  <>
                    <h3>Večná renta pri tomto výnose nefunguje</h3>
                    <p className="rn-plan-sub">Výnos počas renty {f1(D.rentRate)} % je nižší alebo rovný inflácii {f1(D.inflation)} %, reálny výnos je nula. Zvýš výnos počas renty alebo zvoľ dočerpanie či pravidlo 4 %.</p>
                  </>
                ) : r.gap > 0 ? (
                  <>
                    <h3>Ako dosiahnuť cieľ</h3>
                    <p className="rn-plan-sub">Na rentu {fmt(r.targetToday)} z majetku chýba {fmt(r.gap)} kapitálu. Tri cesty:</p>
                    <ol className="rn-rows">
                      <li>
                        <div>
                          <span className="rn-row-t">Investuj mesačne</span>
                          <span className="rn-row-s">{r.requiredMonthly !== null && r.N > 0 ? `namiesto ${fmt(D.monthlyInvestment)}, o ${fmt(r.requiredMonthly - D.monthlyInvestment)} viac` : "do renty už nezostáva čas na sporenie"}</span>
                        </div>
                        <b>{r.requiredMonthly !== null && r.N > 0 ? `${fmt(r.requiredMonthly)} / mes.` : "—"}</b>
                      </li>
                      <li>
                        <div>
                          <span className="rn-row-t">Alebo choď do renty neskôr</span>
                          <span className="rn-row-s">{r.goalAge !== null && r.goalAge > D.retirementAge ? `o ${r.goalAge - D.retirementAge} ${rokov(r.goalAge - D.retirementAge)} neskôr` : `cieľ nedosiahneš ani do ${D.endAge} rokov`}</span>
                        </div>
                        <b>{r.goalAge !== null && r.goalAge > D.retirementAge ? `vo veku ${r.goalAge}` : "—"}</b>
                      </li>
                      <li>
                        <div>
                          <span className="rn-row-t">Alebo uprav cieľ</span>
                          <span className="rn-row-s">toľko dnes majetok reálne utiahne</span>
                        </div>
                        <b>{fmt(r.totalIncomeToday)} / mes.</b>
                      </li>
                    </ol>
                  </>
                ) : (
                  <>
                    <h3>Cieľ je splnený</h3>
                    <p className="rn-plan-sub">Majetok pokryje rentu {fmt(r.targetToday)} a ešte ostáva rezerva {fmt(-r.gap)}.</p>
                    <ol className="rn-rows">
                      <li>
                        <div>
                          <span className="rn-row-t">Do renty môžeš ísť</span>
                          <span className="rn-row-s">{r.goalAge !== null && r.goalAge < D.retirementAge ? `o ${D.retirementAge - r.goalAge} ${rokov(D.retirementAge - r.goalAge)} skôr, než plánuješ` : "presne podľa plánu"}</span>
                        </div>
                        <b className="is-accent">{r.goalAge !== null && r.goalAge < D.retirementAge ? `vo veku ${r.goalAge}` : `vo veku ${D.retirementAge}`}</b>
                      </li>
                      <li>
                        <div>
                          <span className="rn-row-t">Alebo investuj len</span>
                          <span className="rn-row-s">{r.requiredMonthly !== null && r.N > 0 ? `namiesto ${fmt(D.monthlyInvestment)} a cieľ stále dosiahneš` : "renta je pokrytá aj bez ďalšieho sporenia"}</span>
                        </div>
                        <b>{r.requiredMonthly !== null && r.N > 0 ? `${fmt(r.requiredMonthly)} / mes.` : "0 €"}</b>
                      </li>
                    </ol>
                  </>
                )}
              </div>

              {/* predpoklady */}
              <p className="rn-assume calc-reveal" style={st(6)}>
                Predpoklady: renta do
                <span className="rn-seg" role="group" aria-label="Koniec renty">
                  {[85, 90, 95].map((v) => (
                    <button key={v} type="button" aria-pressed={D.endAge === v} onClick={() => set("endAge", v)}>{v}</button>
                  ))}
                </span>
                rokov, inflácia
                <span className="rn-seg" role="group" aria-label="Inflácia">
                  {[2, 2.5, 3].map((v) => (
                    <button key={v} type="button" aria-pressed={D.inflation === v} onClick={() => set("inflation", v)}>{f1(v)} %</button>
                  ))}
                </span>
                výnos počas renty
                <span className="rn-seg" role="group" aria-label="Výnos počas renty">
                  {[3, 4, 5, 6].map((v) => (
                    <button key={v} type="button" aria-pressed={D.rentRate === v} onClick={() => set("rentRate", v)}>{v} %</button>
                  ))}
                </span>
                iný príjem v rente (dôchodok, prenájom)
                <span className="rn-seg" role="group" aria-label="Iný príjem v rente">
                  {[0, 300, 500, 800].map((v) => (
                    <button key={v} type="button" aria-pressed={D.otherIncome === v} onClick={() => set("otherIncome", v)}>{v} €</button>
                  ))}
                </span>
                mesačne. Bez daní a poplatkov, konštantné výnosy{flat ? ", predaj bytu bez dane a provízie" : ""}. Výnosy nie sú garantované.
              </p>

              <div className="rn-cta calc-reveal" style={st(7)}>
                <p>Chceš to prebrať na svojich číslach? Prejdeme portfólio, byt aj to, kedy sa renta reálne dá dosiahnuť.</p>
                <a className="btn-primary rn-cta-btn" href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" data-umami-event="click_konzultacia" data-umami-event-section="rentova">
                  {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </a>
              </div>

              <p className="calc-note calc-note--center rn-foot">
                Orientačný prepočet, nie investičné ani daňové odporúčanie. Odpovede sa ukladajú iba v tvojom prehliadači.
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RentovaCalculator;
