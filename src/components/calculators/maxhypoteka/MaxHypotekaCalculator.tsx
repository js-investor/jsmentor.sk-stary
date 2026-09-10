import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { ArrowRight } from "lucide-react";
import "../shared/calc-ui.css";
import "./max-hypoteka.css";
import { DEFAULT_INPUTS, LIMITS, STRESS, TYPE_LABEL, ZM, compute, sanitize, type Inputs, type NumKey, type Range } from "./maxHypotekaModel";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/**
 * Maximálna hypotéka 2.0 – otázky zhora nadol (vzor Rentová a Inteligentná hypotéka), potom výsledok.
 * Typ príjmu rozhoduje: zamestnanec dostane jedno číslo, živnostník a spoločník s.r.o. rozpätie podľa bánk
 * a zoznam, ktorá banka uzná z tržieb najviac. Pravidlá NBS (DSTI, DTI, životné minimum, stres test) sú rovnaké pre všetky.
 */

const STORAGE_KEY = "jsm_maxhypo_v2";
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const fmt = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK")}\u00a0€`;
const fmt2 = (n: number) => `${(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0€`;
const f1 = (n: number) => n.toLocaleString("sk-SK", { maximumFractionDigits: 2 });
const rokov = (y: number) => (y === 1 ? "rok" : y >= 2 && y <= 4 ? "roky" : "rokov");
const deti = (n: number) => (n === 1 ? "dieťa" : n >= 2 && n <= 4 ? "deti" : "detí");
const same = (r: Range) => Math.round(r[0]) === Math.round(r[1]);
const rangeTxt = (r: Range) => (same(r) ? fmt(r[0]) : `${Math.round(r[0]).toLocaleString("sk-SK")} až ${fmt(r[1])}`);

/* ------------------------------------------------------------------ otázky */

type Field = { key: NumKey; label: string; unit: string; chips?: number[] };
type Step = {
  id: string;
  q: string;
  help: string;
  kind: "value" | "pair" | "choice";
  field?: Field;
  fields?: Field[];
  choiceKey?: NumKey;
  options?: { value: number; label: string; sub: string }[];
  when?: (a: Inputs) => boolean;
  show: (a: Inputs) => string;
};

const isSzco = (a: Inputs) => a.incomeType === 1;
const isSro = (a: Inputs) => a.incomeType === 2;

const STEPS: Step[] = [
  {
    id: "type",
    kind: "choice",
    choiceKey: "incomeType",
    q: "Ako zarábaš?",
    help: "Od toho závisí, ako banka uzná tvoj príjem. Zamestnancovi počíta čistú mzdu, pri živnosti a s.r.o. má každá banka iné pravidlá.",
    options: [
      { value: 0, label: "Zamestnanec", sub: "príjem zo mzdy" },
      { value: 1, label: "Živnostník", sub: "SZČO, daňové priznanie typ B" },
      { value: 2, label: "Spoločník s.r.o.", sub: "konateľ alebo majiteľ firmy" },
    ],
    show: (a) => TYPE_LABEL[a.incomeType],
  },
  { id: "income", kind: "value", when: (a) => a.incomeType === 0, q: "Aký je tvoj čistý mesačný príjem?", help: "Priemer za posledných 6 až 12 mesiacov, po odvodoch a dani.", field: { key: "income", label: "Čistý príjem", unit: "€ / mes.", chips: [1200, 1500, 2000, 2500, 3000] }, show: (a) => `${fmt(a.income)} / mes.` },
  {
    id: "szco",
    kind: "pair",
    when: isSzco,
    q: "Aké máš ročné tržby?",
    help: "Príjmy z posledného daňového priznania, nie zisk. Základ dane po odpočítaní dane je voliteľný, používa ho UniCredit.",
    fields: [
      { key: "turnover", label: "Ročné tržby", unit: "€", chips: [20000, 35000, 50000, 80000] },
      { key: "taxBase", label: "Základ dane − daň (voliteľné)", unit: "€", chips: [0, 8000, 15000, 25000] },
    ],
    show: (a) => `tržby ${fmt(a.turnover)}${a.taxBase > 0 ? `, ZD − daň ${fmt(a.taxBase)}` : ""}`,
  },
  {
    id: "free",
    kind: "choice",
    choiceKey: "freelance",
    when: isSzco,
    q: "Je to slobodné povolanie alebo komorová činnosť?",
    help: "Lekár, advokát, notár, architekt, daňový poradca a podobne. Niektoré banky im uznajú z tržieb viac.",
    options: [
      { value: 1, label: "Áno", sub: "komorová činnosť alebo slobodné povolanie" },
      { value: 0, label: "Nie", sub: "bežná živnosť" },
    ],
    show: (a) => (a.freelance === 1 ? "áno" : "nie"),
  },
  {
    id: "sro",
    kind: "pair",
    when: isSro,
    q: "Aké má firma ročné tržby?",
    help: "Tržby z posledného daňového priznania firmy. Čistý zisk po zdanení je voliteľný, používajú ho mBank, Prima a UniCredit.",
    fields: [
      { key: "turnover", label: "Tržby firmy za rok", unit: "€", chips: [50000, 100000, 200000, 500000] },
      { key: "taxBase", label: "Čistý zisk firmy (voliteľné)", unit: "€", chips: [0, 10000, 25000, 50000] },
    ],
    show: (a) => `tržby ${fmt(a.turnover)}${a.taxBase > 0 ? `, zisk ${fmt(a.taxBase)}` : ""}`,
  },
  { id: "share", kind: "value", when: isSro, q: "Aký podiel v s.r.o. vlastníš?", help: "Banka ti uzná príjem z tržieb firmy len podľa tvojho podielu.", field: { key: "share", label: "Podiel", unit: "%", chips: [100, 50, 33, 25] }, show: (a) => `${a.share} %` },
  {
    id: "partner",
    kind: "choice",
    choiceKey: "partner",
    q: "Žiadaš sám alebo s partnerom?",
    help: "Spoločný príjem zvýši, koľko môžeš dostať. Životné minimum partnera sa odpočíta.",
    options: [
      { value: 0, label: "Sám", sub: "jeden žiadateľ" },
      { value: 1, label: "S partnerom", sub: "spolužiadateľ s vlastným príjmom" },
    ],
    show: (a) => (a.partner === 1 ? "s partnerom" : "sám"),
  },
  { id: "pincome", kind: "value", when: (a) => a.partner === 1, q: "Aký je čistý mesačný príjem partnera?", help: "Ak je partner živnostník alebo má s.r.o., zadaj odhad, koľko mu banka uzná.", field: { key: "partnerIncome", label: "Príjem partnera", unit: "€ / mes.", chips: [1000, 1500, 2000, 2500] }, show: (a) => `${fmt(a.partnerIncome)} / mes.` },
  {
    id: "age",
    kind: "pair",
    q: "Koľko máš rokov a koľko detí živíš?",
    help: "Vek najstaršieho žiadateľa. Nad 40 rokov klesá strop dlhu, ak by úver presahoval 65. rok. Za každé dieťa sa odpočíta životné minimum.",
    fields: [
      { key: "age", label: "Vek", unit: "rokov", chips: [25, 30, 35, 40, 45] },
      { key: "children", label: "Deti", unit: "", chips: [0, 1, 2, 3] },
    ],
    show: (a) => `${a.age} ${rokov(a.age)}, ${a.children} ${deti(a.children)}`,
  },
  {
    id: "debts",
    kind: "pair",
    q: "Splácaš už niečo?",
    help: "Splátky existujúcich úverov, ich zostatok a limity kreditných kariet či povoleného prečerpania. Z limitu banka počíta 3 % ako splátku.",
    fields: [
      { key: "monthlyDebt", label: "Mesačné splátky", unit: "€", chips: [0, 100, 200, 400] },
      { key: "totalDebt", label: "Zostatok dlhov", unit: "€", chips: [0, 5000, 10000, 20000] },
      { key: "creditLimits", label: "Limity kreditiek", unit: "€", chips: [0, 1000, 2000, 5000] },
    ],
    show: (a) => (a.monthlyDebt + a.totalDebt + a.creditLimits > 0 ? `splátky ${fmt(a.monthlyDebt)}, dlhy ${fmt(a.totalDebt)}, limity ${fmt(a.creditLimits)}` : "nič"),
  },
  {
    id: "loan",
    kind: "pair",
    q: "Na koľko rokov a s akým úrokom?",
    help: `Banka počíta splátku so sadzbou vyššou o ${STRESS} p. b., je to stres test NBS.`,
    fields: [
      { key: "years", label: "Splatnosť", unit: "rokov", chips: [20, 25, 30, 35, 40] },
      { key: "rate", label: "Úrok", unit: "% p. a.", chips: [3, 3.5, 4, 4.5] },
    ],
    show: (a) => `${a.years} ${rokov(a.years)}, ${f1(a.rate)} %`,
  },
];

type Saved = { answers: Inputs; done: boolean };

const loadSaved = (): Saved => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { answers: DEFAULT_INPUTS, done: false };
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return { answers: sanitize({ ...DEFAULT_INPUTS, ...(parsed.answers ?? {}) }), done: Boolean(parsed.done) };
  } catch {
    return { answers: DEFAULT_INPUTS, done: false };
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
    <div className={`mh-answer${compact ? " is-compact" : ""}`}>
      {compact ? <span className="mh-answer-label">{label}</span> : null}
      <div className="mh-answer-row">
        <input
          className="mh-answer-input"
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
        {unit ? <span className="mh-answer-unit">{unit}</span> : null}
      </div>
      <input
        type="range"
        className="calc-slider mh-slider"
        style={{ "--p": p } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${label} (posuvník)`}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <div className="mh-scale">
        <span>{min.toLocaleString("sk-SK")}</span>
        <span>{max.toLocaleString("sk-SK")}</span>
      </div>
      {chips ? (
        <div className="mh-chips" role="group" aria-label="Rýchly výber">
          {chips.map((c) => (
            <button key={c} type="button" className={`mh-chip${value === c ? " is-on" : ""}`} aria-pressed={value === c} onClick={() => onChange(c)}>
              {c.toLocaleString("sk-SK")}
              {unit ? ` ${unit}` : ""}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ komponent */

const MaxHypotekaCalculator = () => {
  const [saved] = useState(loadSaved);
  const [A, setA] = useState<Inputs>(saved.answers);
  const [done, setDone] = useState(saved.done);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: A, done } satisfies Saved));
    } catch {
      /* súkromný režim */
    }
  }, [A, done]);

  const set = (k: NumKey, v: number) => setA((s) => ({ ...s, [k]: v }));
  const D = useMemo(() => sanitize(A), [A]);
  const r = useMemo(() => compute(D), [D]);

  const steps = useMemo(() => STEPS.filter((s) => !s.when || s.when(D)), [D]);
  const activeIndex = Math.min(editing ?? step, steps.length - 1);
  const current = steps[activeIndex];
  const showQuestion = !done || editing !== null;
  const progress = done ? 100 : (step / steps.length) * 100;
  const answered = done ? steps : steps.slice(0, Math.min(step, steps.length));

  const emp = D.incomeType === 0;
  const shownMax = useCountUp(r.main.max);
  const shownLo = useCountUp(r.overall?.[0] ?? 0);
  const shownHi = useCountUp(r.overall?.[1] ?? 0);

  const finish = () => {
    setDone(true);
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const next = () => {
    if (editing !== null) {
      setEditing(null);
      return;
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    finish();
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const choose = (key: NumKey, v: number) => {
    const nextA = { ...A, [key]: v };
    setA(nextA);
    // zoznam otázok sa touto odpoveďou môže zmeniť (vetva príjmu, partner), preto ho prepočítame z novej odpovede
    const nextSteps = STEPS.filter((s) => !s.when || s.when(sanitize(nextA)));
    if (editing !== null) {
      const prevIds = steps.map((s) => s.id);
      const firstNew = nextSteps.findIndex((s) => !prevIds.includes(s.id));
      setEditing(null);
      if (firstNew >= 0) {
        setDone(false);
        setStep(firstNew);
      }
      return;
    }
    if (step < nextSteps.length - 1) {
      setStep(step + 1);
      return;
    }
    finish();
  };

  /* živá nápoveda pod otázkou */
  const hint = (() => {
    if (!current) return null;
    if ((current.id === "szco" || current.id === "sro" || current.id === "share" || current.id === "free") && r.incomeRange) {
      return `Banky z toho uznajú príjem ${same(r.incomeRange) ? fmt(r.incomeRange[0]) : `od ${fmt(r.incomeRange[0])} do ${fmt(r.incomeRange[1])}`} mesačne.`;
    }
    if (current.id === "age") return `Životné minimum domácnosti ${fmt2(r.living)} sa odpočíta z príjmu. Strop dlhu ${f1(r.dtiLimit)}× ročného príjmu.`;
    if (current.id === "debts" && r.main.obligations > 0) return `Existujúce záväzky znížia priestor na novú splátku o ${fmt(r.main.obligations)} mesačne.`;
    if (current.id === "loan") return `Banka počíta splátku so sadzbou ${f1(r.stressRate)} %.`;
    return null;
  })();

  const renderField = (f: Field, compact = false) => (
    <ValueField key={f.key} label={f.label} unit={f.unit} value={A[f.key]} {...LIMITS[f.key]} chips={f.chips} compact={compact} onChange={(v) => set(f.key, v)} onEnter={next} />
  );

  const limitText =
    r.main.limitedBy === "stop"
      ? "Existujúce splátky už vyčerpali priestor na novú splátku."
      : r.main.limitedBy === "dti"
        ? `Limituje ťa strop celkového dlhu ${f1(r.dtiLimit)}× ročného príjmu.`
        : "Limituje ťa mesačná splátka: po odpočítaní životného minima smie ísť na splátky najviac 60 % príjmu.";
  const limitShort = r.main.limitedBy === "stop" ? "existujúce splátky vyčerpali priestor" : r.main.limitedBy === "dti" ? `strop je celkový dlh, DTI ${f1(r.dtiLimit)}×` : "strop je mesačná splátka, DSTI 60 %";
  const bestNames = r.best.map((b) => b.name).join(" a ");

  return (
    <div id="mh-root" className="calc-ui mh w-full font-sans">
      <div className="calc-body-shell">
        <div className="calc-page mh-page">
          <header className="calc-header calc-reveal" style={st(0)}>
            <span className="calc-eyebrow">Maximálna hypotéka</span>
            <h1 className="calc-title">
              Koľko ti banka <em>požičia</em>?
            </h1>
            <p className="calc-subtitle">
              Pár otázok, žiadna registrácia. Podľa toho, či si zamestnanec, živnostník alebo máš s.r.o., uvidíš maximálnu hypotéku podľa pravidiel NBS
              a pri podnikaní aj to, ktorá banka ti z tržieb uzná najviac.
            </p>
          </header>

          {/* ═══ Otázky zhora nadol ═══ */}
          <section className="mh-flow calc-reveal" aria-label="Otázky" style={st(1)}>
            <div className="mh-progress" aria-hidden>
              <span className="mh-progress-label">{done && editing === null ? "Hotovo" : `Otázka ${activeIndex + 1} z ${steps.length}`}</span>
              <span className="mh-progress-track"><span className="mh-progress-fill" style={{ width: `${progress}%` }} /></span>
            </div>

            {answered.length > 0 ? (
              <ol className="mh-done">
                {answered.map((s, i) => (
                  <li key={s.id} className={editing === i ? "is-editing" : ""}>
                    <span className="mh-done-q">{s.q}</span>
                    <span className="mh-done-v">{s.show(D)}</span>
                    <button type="button" className="mh-done-edit" onClick={() => setEditing(i)} disabled={editing === i}>
                      Upraviť
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}

            {showQuestion && current ? (
              <div key={`${current.id}-${editing}`} className="mh-q">
                <h2 className="mh-q-title">{current.q}</h2>
                <p className="mh-q-help">{current.help}</p>

                {current.kind === "choice" && current.choiceKey ? (
                  <div className={`mh-choice${(current.options?.length ?? 0) > 2 ? " is-3" : ""}`} role="group" aria-label={current.q}>
                    {current.options?.map((o) => {
                      const on = A[current.choiceKey!] === o.value;
                      return (
                        <button key={o.value} type="button" className={`mh-option${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => choose(current.choiceKey!, o.value)}>
                          <b>{o.label}</b>
                          <small>{o.sub}</small>
                        </button>
                      );
                    })}
                  </div>
                ) : current.kind === "pair" ? (
                  <div className={`mh-pair${(current.fields?.length ?? 0) > 2 ? " is-3" : ""}`}>{current.fields?.map((f) => renderField(f, true))}</div>
                ) : current.field ? (
                  renderField(current.field)
                ) : null}

                {hint ? <p className="mh-q-hint">{hint}</p> : null}
                <div className="mh-q-actions">
                  {activeIndex > 0 || editing !== null ? (
                    <button type="button" className="mh-back" onClick={back}>
                      {editing !== null ? "Zrušiť" : "Späť"}
                    </button>
                  ) : (
                    <span />
                  )}
                  {current.kind !== "choice" || editing !== null ? (
                    <button type="button" className="btn-primary mh-next" onClick={next}>
                      {editing !== null ? "Hotovo" : activeIndex < steps.length - 1 ? "Ďalej" : "Ukázať výsledok"}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mh-flow-foot">
                <button type="button" className="mh-back" onClick={restart}>Začať odznova</button>
              </div>
            )}
          </section>

          {/* ═══ Výsledok ═══ */}
          {done ? (
            <section ref={resultRef} className="mh-result" aria-label="Výsledok">
              <div className="mh-verdict calc-reveal" style={st(0)}>
                <span className="mh-kicker">Maximálna hypotéka · {TYPE_LABEL[D.incomeType]}</span>
                {emp ? (
                  <>
                    <h2 className="mh-verdict-title">
                      Banka ti požičia maximálne <em>{fmt(shownMax)}</em>.
                    </h2>
                    <p className="mh-verdict-text">
                      Pri úroku {f1(D.rate)} % je to splátka <strong>{fmt(r.main.payment)}</strong> mesačne{D.partner === 1 ? ` z príjmu domácnosti ${fmt(r.main.total)}` : ""}. {limitText}
                    </p>
                  </>
                ) : r.overall ? (
                  <>
                    <h2 className="mh-verdict-title">
                      Podľa banky ti požičia <em>{fmt(shownLo)}</em> až <em>{fmt(shownHi)}</em>.
                    </h2>
                    <p className="mh-verdict-text">
                      Z ročných tržieb {fmt(D.turnover)}{D.incomeType === 2 && D.share < 100 ? ` pri podiele ${D.share} %` : ""} banky uznajú príjem{" "}
                      <strong>{r.incomeRange && same(r.incomeRange) ? fmt(r.incomeRange[0]) : `${fmt(r.incomeRange?.[0] ?? 0)} až ${fmt(r.incomeRange?.[1] ?? 0)}`}</strong> mesačne
                      {D.partner === 1 ? `, k tomu príjem partnera ${fmt(D.partnerIncome)}` : ""}. {bestNames ? `Najviac uzná ${bestNames}. ` : ""}Pri podnikaní rozhoduje výber banky viac než úrok.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="mh-verdict-title">Na výpočet potrebujeme tvoje tržby.</h2>
                    <p className="mh-verdict-text">Uprav odpoveď o tržbách, prípadne doplň základ dane alebo zisk firmy.</p>
                  </>
                )}
              </div>

              <div className="mh-stats calc-reveal" style={st(1)}>
                {emp ? (
                  <>
                    <div>
                      <span className="mh-stat-label">Max. mesačná splátka</span>
                      <strong>{fmt(r.main.availPay)}</strong>
                      <small>60 % príjmu po odpočítaní životného minima a splátok</small>
                    </div>
                    <div>
                      <span className="mh-stat-label">Strop celkového dlhu</span>
                      <strong>{fmt(r.main.availDebt)}</strong>
                      <small>{f1(r.dtiLimit)}× ročného príjmu{D.totalDebt > 0 ? " mínus dlhy" : ""}</small>
                    </div>
                    <div>
                      <span className="mh-stat-label">Ostane ti mesačne</span>
                      <strong className={r.main.leftover >= r.living ? "is-accent" : ""}>{fmt(r.main.leftover)}</strong>
                      <small>po splátke maximálnej hypotéky</small>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="mh-stat-label">Uznaný príjem</span>
                      <strong>{r.incomeRange ? rangeTxt(r.incomeRange) : "—"}</strong>
                      <small>mesačne, podľa banky</small>
                    </div>
                    <div>
                      <span className="mh-stat-label">Strop dlhu</span>
                      <strong>{f1(r.dtiLimit)}×</strong>
                      <small>ročného uznaného príjmu</small>
                    </div>
                    <div>
                      <span className="mh-stat-label">Stres test</span>
                      <strong>{f1(r.stressRate)} %</strong>
                      <small>sadzba pre výpočet splátky</small>
                    </div>
                  </>
                )}
              </div>

              {emp ? (
                <div className="mh-block calc-reveal" style={st(2)}>
                  <h3>Ako sme to vypočítali</h3>
                  <ol className="mh-rows">
                    <li>
                      <div>
                        <span className="mh-row-t">Čistý príjem domácnosti</span>
                        <span className="mh-row-s">{D.partner === 1 ? `ty ${fmt(D.income)} + partner ${fmt(D.partnerIncome)}` : "tvoj čistý mesačný príjem"}</span>
                      </div>
                      <b>{fmt(r.main.total)}</b>
                    </li>
                    <li>
                      <div>
                        <span className="mh-row-t">Životné minimum</span>
                        <span className="mh-row-s">žiadateľ {fmt2(ZM.adult)}{D.partner === 1 ? ` + partner ${fmt2(ZM.adult2)}` : ""}{D.children > 0 ? ` + ${D.children} ${deti(D.children)} × ${fmt2(ZM.child)}` : ""}</span>
                      </div>
                      <b>−{fmt(r.living)}</b>
                    </li>
                    <li>
                      <div>
                        <span className="mh-row-t">Existujúce záväzky</span>
                        <span className="mh-row-s">{r.main.obligations > 0 ? "splátky úverov + 3 % z limitov kreditiek" : "žiadne"}</span>
                      </div>
                      <b>{r.main.obligations > 0 ? `−${fmt(r.main.obligations)}` : "0 €"}</b>
                    </li>
                    <li>
                      <div>
                        <span className="mh-row-t">Splátka novej hypotéky</span>
                        <span className="mh-row-s">pri {f1(D.rate)} %, banka ju posudzuje pri {f1(r.stressRate)} %</span>
                      </div>
                      <b>{fmt(r.main.payment)}</b>
                    </li>
                    <li className="is-total">
                      <div>
                        <span className="mh-row-t">Maximálna hypotéka</span>
                        <span className="mh-row-s">na {D.years} {rokov(D.years)}, {limitShort}</span>
                      </div>
                      <b className="is-accent">{fmt(r.main.max)}</b>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="mh-block calc-reveal" style={st(2)}>
                  <h3>Koľko ti uzná ktorá banka</h3>
                  <p className="mh-block-sub">Uznaný mesačný príjem z tvojich tržieb a maximálna hypotéka pri rovnakých pravidlách NBS. Rozpätie znamená, že banka rozhoduje podľa segmentu alebo odvetvia.</p>
                  <ol className="mh-rows">
                    {r.banks.map((b) => {
                      const best = r.best.some((x) => x.id === b.id);
                      return (
                        <li key={b.id} className={best ? "is-best" : !b.mortgage ? "is-na" : ""}>
                          <div>
                            <span className="mh-row-t">
                              {b.name}
                              {best ? <i className="mh-badge">najviac</i> : null}
                            </span>
                            <span className="mh-row-s">{b.note}</span>
                          </div>
                          <div className="mh-row-nums">
                            <small>{b.income ? `príjem ${rangeTxt(b.income)} / mes.` : b.needs}</small>
                            <b>{b.mortgage ? rangeTxt(b.mortgage) : "—"}</b>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              <div className="mh-precise calc-reveal" style={st(3)}>
                <div>
                  <h3>Chceš presnejší výpočet?</h3>
                  <p>
                    {emp
                      ? "Banky sa líšia v tom, ako posudzujú typ zmluvy, skúšobnú dobu, príplatky a bonusy. Na konzultácii ti poviem, kde dostaneš najviac a za akých podmienok."
                      : "Každá banka posudzuje živnosť a s.r.o. inak: segment, história, dokumenty, výnimky. Na konzultácii ti poviem, ktorá banka ti uzná najviac a čo na to potrebuješ."}
                  </p>
                </div>
                <a className="btn-primary mh-cta-btn" href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" data-umami-event="click_konzultacia" data-umami-event-section="maximalna-hypoteka">
                  {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </a>
              </div>

              <p className="calc-note calc-note--center mh-foot">
                Orientačný prepočet podľa pravidiel NBS: DSTI 60 % z príjmu po odpočítaní životného minima ({fmt2(ZM.adult)} žiadateľ, {fmt2(ZM.adult2)} partner, {fmt2(ZM.child)} dieťa, platí od {ZM.validFrom}),
                DTI 8× ročného príjmu (nad 40 rokov klesá o 0,25 za rok, ak úver presahuje 65. rok veku, najmenej 3×) a stres test +{STRESS} p. b. Koeficienty bánk pre živnosť a s.r.o. sú orientačné,
                platné k septembru 2026, banky ich menia a posudzujú aj segment, históriu a dokumenty. Odpovede sa ukladajú iba v tvojom prehliadači.
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MaxHypotekaCalculator;
