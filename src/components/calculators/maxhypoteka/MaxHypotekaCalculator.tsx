import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { ArrowRight, BadgeCheck, Briefcase, Building2, Landmark, Lightbulb, ShieldCheck, Sparkles, User, Users, Wrench } from "lucide-react";
import "../shared/calc-ui.css";
import "./max-hypoteka.css";
import ivanRolak from "@/assets/images/komunita-ivan-rolak.jpg";
import { DEFAULT_INPUTS, LIMITS, STRESS, TYPE_LABEL, ZM, compute, sanitize, type Inputs, type NumKey, type Range, type Result } from "./maxHypotekaModel";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/**
 * Maximálna hypotéka 2.1 – otázky zhora nadol s háčikmi (živé „čo keby“ čísla pod každou otázkou), priebežný odhad,
 * ktorý sa mení s každou odpoveďou, a prémiový výsledok: tmavá karta so zlatým číslom, rebríček bánk s animovanými
 * pásmi, tri „čo keby“ karty a konzultácia s tvárou. Referencie (Refero): Slash (tmavý finančný luxus, zlatý akcent),
 * 601 Inc. (veľké číslo v tlmenom zlate na tmavej), Wealthsimple (editoriálny minimalizmus zvyšku stránky).
 */

const STORAGE_KEY = "jsm_maxhypo_v2";
const st = (i: number) => ({ "--i": i }) as CSSProperties;
const dl = (i: number) => ({ "--d": i }) as CSSProperties;

const fmt = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK")}\u00a0€`;
const fmt2 = (n: number) => `${(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0€`;
const f1 = (n: number) => n.toLocaleString("sk-SK", { maximumFractionDigits: 2 });
const rokov = (y: number) => (y === 1 ? "rok" : y >= 2 && y <= 4 ? "roky" : "rokov");
const deti = (n: number) => (n === 1 ? "dieťa" : n >= 2 && n <= 4 ? "deti" : "detí");
const same = (r: Range) => Math.round(r[0]) === Math.round(r[1]);
const rangeTxt = (r: Range) => (same(r) ? fmt(r[0]) : `${Math.round(r[0]).toLocaleString("sk-SK")} až ${fmt(r[1])}`);

/* ------------------------------------------------------------------ háčiky: čo keby */

type Hooks = {
  /** o koľko viac pri +100 € čistého (zamestnanec) alebo +10 000 € tržieb (podnikanie) */
  incomeDelta: number;
  /** o koľko viac s partnerom s príjmom 1 500 € (len ak žiada sám) */
  partnerDelta: number | null;
  /** o koľko viac pridáva zadaný príjem partnera */
  partnerAdds: number | null;
  /** o koľko viac pri splatnosti 40 rokov (len ak je kratšia) */
  years40Delta: number | null;
  /** koľko stoja limity kreditiek: zadané, alebo hypotetická karta 2 000 € */
  cardsDelta: number;
  /** o koľko viac bez zostatku existujúcich dlhov */
  debtDelta: number | null;
  /** rozdiel medzi najlepšou a najhoršou bankou */
  spread: number | null;
};

const topOf = (x: Inputs): number => {
  const c = compute(x);
  return x.incomeType === 0 ? c.main.max : (c.overall?.[1] ?? 0);
};

const computeHooks = (D: Inputs, r: Result): Hooks => {
  const base = D.incomeType === 0 ? r.main.max : (r.overall?.[1] ?? 0);
  const incomeDelta = (D.incomeType === 0 ? topOf({ ...D, income: D.income + 100 }) : topOf({ ...D, turnover: D.turnover + 10000 })) - base;
  const partnerDelta = D.partner === 0 ? topOf({ ...D, partner: 1, partnerIncome: 1500 }) - base : null;
  const partnerAdds = D.partner === 1 ? base - topOf({ ...D, partner: 0 }) : null;
  const years40Delta = D.years < 40 ? topOf({ ...D, years: 40 }) - base : null;
  const cardsDelta = D.creditLimits > 0 ? topOf({ ...D, creditLimits: 0 }) - base : base - topOf({ ...D, creditLimits: 2000 });
  const debtDelta = D.totalDebt > 0 ? topOf({ ...D, totalDebt: 0 }) - base : null;
  const spread = r.overall ? r.overall[1] - r.overall[0] : null;
  return { incomeDelta, partnerDelta, partnerAdds, years40Delta, cardsDelta, debtDelta, spread };
};

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
  options?: { value: number; label: string; sub: string; icon: ReactNode }[];
  when?: (a: Inputs) => boolean;
  show: (a: Inputs) => string;
  /** háčik: živá veta pod otázkou */
  fact?: (a: Inputs, r: Result, h: Hooks) => string | null;
};

const isSzco = (a: Inputs) => a.incomeType === 1;
const isSro = (a: Inputs) => a.incomeType === 2;
const ic = (node: ReactNode) => node;

const STEPS: Step[] = [
  {
    id: "type",
    kind: "choice",
    choiceKey: "incomeType",
    q: "Ako zarábaš?",
    help: "Od toho závisí, ako banka uzná tvoj príjem. Zamestnancovi počíta čistú mzdu, pri živnosti a s.r.o. má každá banka iné pravidlá.",
    options: [
      { value: 0, label: "Zamestnanec", sub: "príjem zo mzdy", icon: ic(<Briefcase className="h-5 w-5" strokeWidth={1.75} aria-hidden />) },
      { value: 1, label: "Živnostník", sub: "SZČO, daňové priznanie typ B", icon: ic(<Wrench className="h-5 w-5" strokeWidth={1.75} aria-hidden />) },
      { value: 2, label: "Spoločník s.r.o.", sub: "konateľ alebo majiteľ firmy", icon: ic(<Building2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />) },
    ],
    show: (a) => TYPE_LABEL[a.incomeType],
    fact: () => "Tá istá živnosť, iná banka: uznaný príjem sa líši aj 3,5-násobne. Preto sa oplatí vybrať banku najprv podľa príjmu, až potom podľa úroku.",
  },
  {
    id: "income",
    kind: "value",
    when: (a) => a.incomeType === 0,
    q: "Aký je tvoj čistý mesačný príjem?",
    help: "Priemer za posledných 6 až 12 mesiacov, po odvodoch a dani.",
    field: { key: "income", label: "Čistý príjem", unit: "€ / mes.", chips: [1200, 1500, 2000, 2500, 3000] },
    show: (a) => `${fmt(a.income)} / mes.`,
    fact: (_a, _r, h) => (h.incomeDelta > 0 ? `Každých 100 € čistého navyše je zhruba ${fmt(h.incomeDelta)} hypotéky navyše.` : null),
  },
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
    fact: (_a, r) => {
      const withNum = r.banks.filter((b) => b.income);
      if (withNum.length < 2) return null;
      const best = withNum[0];
      const worst = withNum[withNum.length - 1];
      return `Z týchto tržieb uzná ${best.name} až ${fmt(best.income![1])} mesačne, ${worst.name} len ${fmt(worst.income![0])}. Rovnaká živnosť, iný príjem na papieri.`;
    },
  },
  {
    id: "free",
    kind: "choice",
    choiceKey: "freelance",
    when: isSzco,
    q: "Je to slobodné povolanie alebo komorová činnosť?",
    help: "Lekár, advokát, notár, architekt, daňový poradca a podobne. Niektoré banky im uznajú z tržieb viac.",
    options: [
      { value: 1, label: "Áno", sub: "komorová činnosť alebo slobodné povolanie", icon: ic(<BadgeCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden />) },
      { value: 0, label: "Nie", sub: "bežná živnosť", icon: ic(<Wrench className="h-5 w-5" strokeWidth={1.75} aria-hidden />) },
    ],
    show: (a) => (a.freelance === 1 ? "áno" : "nie"),
    fact: () => "365.bank uzná slobodným povolaniam 60 % z tržieb bez limitu, Tatra banka komorovým činnostiam až 50 % namiesto 20 %.",
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
    fact: () => "mBank a Prima banka pozerajú pri s.r.o. len na vyplatený zisk, ostatné banky na tržby. Firma s tržbami a nulovým ziskom tak môže mať uznaný príjem tisíce eur mesačne.",
  },
  {
    id: "share",
    kind: "value",
    when: isSro,
    q: "Aký podiel v s.r.o. vlastníš?",
    help: "Banka ti uzná príjem z tržieb firmy len podľa tvojho podielu.",
    field: { key: "share", label: "Podiel", unit: "%", chips: [100, 50, 33, 25] },
    show: (a) => `${a.share} %`,
    fact: (a) => (a.share < 100 ? "UniCredit počíta s.r.o. len pri jednoosobovej firme. Ostatné banky ti uznajú tržby krát podiel." : null),
  },
  {
    id: "partner",
    kind: "choice",
    choiceKey: "partner",
    q: "Žiadaš sám alebo s partnerom?",
    help: "Spoločný príjem zvýši, koľko môžeš dostať. Životné minimum partnera sa odpočíta.",
    options: [
      { value: 0, label: "Sám", sub: "jeden žiadateľ", icon: ic(<User className="h-5 w-5" strokeWidth={1.75} aria-hidden />) },
      { value: 1, label: "S partnerom", sub: "spolužiadateľ s vlastným príjmom", icon: ic(<Users className="h-5 w-5" strokeWidth={1.75} aria-hidden />) },
    ],
    show: (a) => (a.partner === 1 ? "s partnerom" : "sám"),
    fact: (_a, _r, h) => (h.partnerDelta !== null && h.partnerDelta > 0 ? `Partner s príjmom 1 500 € by pridal približne ${fmt(h.partnerDelta)}.` : null),
  },
  {
    id: "pincome",
    kind: "value",
    when: (a) => a.partner === 1,
    q: "Aký je čistý mesačný príjem partnera?",
    help: "Ak je partner živnostník alebo má s.r.o., zadaj odhad, koľko mu banka uzná.",
    field: { key: "partnerIncome", label: "Príjem partnera", unit: "€ / mes.", chips: [1000, 1500, 2000, 2500] },
    show: (a) => `${fmt(a.partnerIncome)} / mes.`,
    fact: (_a, _r, h) => (h.partnerAdds !== null && h.partnerAdds > 0 ? `Príjem partnera pridáva ${fmt(h.partnerAdds)} k maximálnej hypotéke.` : null),
  },
  {
    id: "age",
    kind: "pair",
    q: "Koľko máš rokov a koľko detí živíš?",
    help: "Vek najstaršieho žiadateľa. Za každé dieťa sa z príjmu odpočíta životné minimum.",
    fields: [
      { key: "age", label: "Vek", unit: "rokov", chips: [25, 30, 35, 40, 45] },
      { key: "children", label: "Deti", unit: "", chips: [0, 1, 2, 3] },
    ],
    show: (a) => `${a.age} ${rokov(a.age)}, ${a.children} ${deti(a.children)}`,
    fact: (a, r) =>
      r.dtiLimit < 8
        ? `Po štyridsiatke ti banka za každý rok uberie 0,25 z násobku príjmu. Pri ${a.age} rokoch a splatnosti ${a.years} rokov je strop ${f1(r.dtiLimit)}× namiesto 8×.`
        : "Do 40 rokov máš plný strop 8-násobku ročného príjmu. Deti ho neznížia, znížia však splátku, ktorú ti banka dovolí.",
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
    fact: (a, _r, h) =>
      a.creditLimits > 0
        ? `Bez kreditiek a prečerpaní by si dostal o ${fmt(h.cardsDelta)} viac. Banka počíta 3 % z limitu ako splátku, aj keď kartu nepoužívaš.`
        : `Kreditka s limitom 2 000 € by ťa stála zhruba ${fmt(h.cardsDelta)} hypotéky, aj keby si ju nikdy nepoužil.`,
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
    fact: (a, r, h) =>
      h.years40Delta !== null && h.years40Delta > 0
        ? `Splatnosť 40 rokov namiesto ${a.years} by pridala ${fmt(h.years40Delta)}, ak to dovolí vek.`
        : `Banka počíta splátku so sadzbou ${f1(r.stressRate)} %, aj keď ti ponúkne ${f1(a.rate)} %.`,
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
  const [drawn, setDrawn] = useState(false);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: A, done } satisfies Saved));
    } catch {
      /* súkromný režim */
    }
  }, [A, done]);

  /* pásy vo výsledku sa dokreslia až po zobrazení */
  useEffect(() => {
    if (!done) {
      setDrawn(false);
      return;
    }
    const t = window.setTimeout(() => setDrawn(true), 120);
    return () => window.clearTimeout(t);
  }, [done]);

  const set = (k: NumKey, v: number) => setA((s) => ({ ...s, [k]: v }));
  const D = useMemo(() => sanitize(A), [A]);
  const r = useMemo(() => compute(D), [D]);
  const hooks = useMemo(() => computeHooks(D, r), [D, r]);

  const steps = useMemo(() => STEPS.filter((s) => !s.when || s.when(D)), [D]);
  const activeIndex = Math.min(editing ?? step, steps.length - 1);
  const current = steps[activeIndex];
  const showQuestion = !done || editing !== null;
  const progress = done ? 100 : (step / steps.length) * 100;
  const answered = done ? steps : steps.slice(0, Math.min(step, steps.length));
  const answeredIds = answered.map((s) => s.id);

  const emp = D.incomeType === 0;
  const shownMax = useCountUp(r.main.max);
  const shownLo = useCountUp(r.overall?.[0] ?? 0);
  const shownHi = useCountUp(r.overall?.[1] ?? 0);

  /* priebežný odhad počas otázok: od chvíle, keď poznáme príjem */
  const liveKnown = !done && (answeredIds.includes("income") || answeredIds.includes("szco") || answeredIds.includes("sro"));
  const liveHi = emp ? r.main.max : (r.overall?.[1] ?? 0);
  const liveLo = emp ? r.main.max : (r.overall?.[0] ?? 0);
  const shownLiveHi = useCountUp(liveHi, 500);
  const shownLiveLo = useCountUp(liveLo, 500);

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

  /* živá nápoveda a háčik pod otázkou */
  const hint = (() => {
    if (!current) return null;
    if ((current.id === "szco" || current.id === "sro" || current.id === "share" || current.id === "free") && r.incomeRange) {
      return `Banky z toho uznajú príjem ${same(r.incomeRange) ? fmt(r.incomeRange[0]) : `od ${fmt(r.incomeRange[0])} do ${fmt(r.incomeRange[1])}`} mesačne.`;
    }
    if (current.id === "age") return `Životné minimum domácnosti ${fmt2(r.living)} sa odpočíta z príjmu. Strop dlhu ${f1(r.dtiLimit)}× ročného príjmu.`;
    if (current.id === "debts" && r.main.obligations > 0) return `Existujúce záväzky znížia priestor na novú splátku o ${fmt(r.main.obligations)} mesačne.`;
    return null;
  })();
  const fact = current?.fact ? current.fact(D, r, hooks) : null;

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
  const topBank = r.overall?.[1] ?? 1;

  /* rozloženie príjmu (zamestnanec) */
  const share = (() => {
    const t = Math.max(1, r.main.total);
    const living = Math.min(t, r.living);
    const obl = Math.min(t - living, r.main.obligations);
    const pay = Math.min(t - living - obl, r.main.payment);
    const left = Math.max(0, t - living - obl - pay);
    return { living: (living / t) * 100, obl: (obl / t) * 100, pay: (pay / t) * 100, left: (left / t) * 100, leftAbs: left };
  })();

  /* „čo keby“ karty: kandidáti podľa priority, len tie, ktoré reálne pomôžu, najviac tri */
  const candidates: { label: string; value: number | null; sub: string }[] = emp
    ? [
        { label: "+100 € čistého mesačne", value: hooks.incomeDelta, sub: "každá stovka navyše sa ráta" },
        { label: "S partnerom (1 500 €)", value: hooks.partnerDelta, sub: "spoločná žiadosť" },
        { label: "Splatnosť 40 rokov", value: hooks.years40Delta, sub: `namiesto ${D.years} rokov, ak dovolí vek` },
        { label: "Bez kreditiek a prečerpaní", value: D.creditLimits > 0 ? hooks.cardsDelta : null, sub: "zrušiť limity pred žiadosťou" },
        { label: "Bez zostatku dlhov", value: hooks.debtDelta, sub: `splatiť ${fmt(D.totalDebt)} pred žiadosťou` },
        { label: "Kreditka 2 000 € by stála", value: D.creditLimits === 0 ? hooks.cardsDelta : null, sub: "3 % z limitu je pre banku splátka" },
      ]
    : [
        { label: "Správna banka", value: hooks.spread, sub: "rozdiel medzi najlepšou a najhoršou" },
        { label: "+10 000 € tržieb", value: hooks.incomeDelta, sub: "pri najlepšej banke" },
        { label: "S partnerom (1 500 €)", value: hooks.partnerDelta, sub: "spoločná žiadosť, najlepšia banka" },
        { label: "Splatnosť 40 rokov", value: hooks.years40Delta, sub: `namiesto ${D.years} rokov, ak dovolí vek` },
        { label: "Bez kreditiek a prečerpaní", value: D.creditLimits > 0 ? hooks.cardsDelta : null, sub: "zrušiť limity pred žiadosťou" },
        { label: "Bez zostatku dlhov", value: hooks.debtDelta, sub: `splatiť ${fmt(D.totalDebt)} pred žiadosťou` },
      ];
  const whatIf = candidates.filter((c) => c.value !== null && c.value >= 500).slice(0, 3);

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
              Zamestnanec, živnostník aj majiteľ s.r.o. Za minútu vieš, koľko ti banky požičajú podľa pravidiel NBS. Pri podnikaní aj to,
              ktorá banka ti z tržieb uzná najviac, lebo rozdiel medzi bankami býva aj trojnásobný.
            </p>
            <ul className="mh-proof" aria-label="Čo dostaneš">
              <li><ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />Pravidlá NBS 2026</li>
              <li><Landmark className="h-4 w-4" strokeWidth={1.75} aria-hidden />8 bánk v porovnaní</li>
              <li><Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />Bez registrácie, do minúty</li>
            </ul>
          </header>

          {/* ═══ Otázky zhora nadol ═══ */}
          <section className="mh-flow calc-reveal" aria-label="Otázky" style={st(1)}>
            <div className="mh-progress">
              <span className="mh-progress-label">{done && editing === null ? "Hotovo" : `Otázka ${activeIndex + 1} z ${steps.length}`}</span>
              <span className="mh-progress-track" aria-hidden><span className="mh-progress-fill" style={{ width: `${progress}%` }} /></span>
              {liveKnown ? (
                <span key={Math.round(liveHi / 500)} className="mh-live" aria-live="polite">
                  <small>predbežne</small>
                  <b>{emp || same([liveLo, liveHi]) ? `≈ ${fmt(shownLiveHi)}` : `${fmt(shownLiveLo)} až ${fmt(shownLiveHi)}`}</b>
                </span>
              ) : null}
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
                          <span className="mh-option-ic">{o.icon}</span>
                          <span className="mh-option-t">
                            <b>{o.label}</b>
                            <small>{o.sub}</small>
                          </span>
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
                {fact ? (
                  <div className="mh-fact" key={fact}>
                    <span className="mh-fact-ic"><Lightbulb className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                    <span>
                      <b>Dobré vedieť.</b> {fact}
                    </span>
                  </div>
                ) : null}
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
              {/* tmavá karta */}
              <div className="mh-card calc-reveal" style={st(0)}>
                <div className="mh-card-top">
                  <span className="mh-card-kicker">Maximálna hypotéka · {TYPE_LABEL[D.incomeType]}</span>
                  <span className="mh-card-tag">pravidlá NBS</span>
                </div>
                {emp ? (
                  <>
                    <p className="mh-card-value">{fmt(shownMax)}</p>
                    <p className="mh-card-line">
                      Pri úroku {f1(D.rate)} % je to splátka <strong>{fmt(r.main.payment)}</strong> mesačne{D.partner === 1 ? ` z príjmu domácnosti ${fmt(r.main.total)}` : ""}. {limitText}
                    </p>
                  </>
                ) : r.overall ? (
                  <>
                    <p className="mh-card-value">
                      {same(r.overall) ? (
                        fmt(shownHi)
                      ) : (
                        <>
                          <small>od</small> {fmt(shownLo)} <small>do</small> {fmt(shownHi)}
                        </>
                      )}
                    </p>
                    <p className="mh-card-line">
                      Z ročných tržieb {fmt(D.turnover)}{D.incomeType === 2 && D.share < 100 ? ` pri podiele ${D.share} %` : ""} banky uznajú príjem{" "}
                      <strong>{r.incomeRange && same(r.incomeRange) ? fmt(r.incomeRange[0]) : `${fmt(r.incomeRange?.[0] ?? 0)} až ${fmt(r.incomeRange?.[1] ?? 0)}`}</strong> mesačne
                      {D.partner === 1 ? `, k tomu príjem partnera ${fmt(D.partnerIncome)}` : ""}. {bestNames ? `Najviac uzná ${bestNames}.` : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mh-card-value is-small">Doplň tržby</p>
                    <p className="mh-card-line">Bez tržieb, základu dane alebo zisku nevieme uznaný príjem vypočítať. Uprav odpovede vyššie.</p>
                  </>
                )}
                <ul className="mh-card-facts">
                  {emp ? (
                    <>
                      <li><span>Splátka</span><b>{fmt(r.main.payment)}</b></li>
                      <li><span>Ostane ti po splátke</span><b>{fmt(r.main.leftover)}</b></li>
                      <li><span>Strop dlhu</span><b>{f1(r.dtiLimit)}× príjmu</b></li>
                    </>
                  ) : (
                    <>
                      <li><span>Uznaný príjem mesačne</span><b>{r.incomeRange ? rangeTxt(r.incomeRange) : "—"}</b></li>
                      <li><span>Strop dlhu</span><b>{f1(r.dtiLimit)}× príjmu</b></li>
                      <li><span>Stres test</span><b>{f1(r.stressRate)} %</b></li>
                    </>
                  )}
                </ul>
              </div>

              {emp ? (
                <div className="mh-block calc-reveal" style={st(1)}>
                  <h3>Kam pôjde tvoj príjem</h3>
                  <p className="mh-block-sub">Z {fmt(r.main.total)} mesačne pri maximálnej hypotéke.</p>
                  <div className="mh-share" aria-hidden>
                    <i className="is-living" style={{ width: drawn ? `${share.living}%` : 0 }} />
                    <i className="is-obl" style={{ width: drawn ? `${share.obl}%` : 0 }} />
                    <i className="is-pay" style={{ width: drawn ? `${share.pay}%` : 0 }} />
                    <i className="is-left" style={{ width: drawn ? `${share.left}%` : 0 }} />
                  </div>
                  <ul className="mh-share-legend">
                    <li><i className="is-living" />Životné minimum <b>{fmt(r.living)}</b></li>
                    {r.main.obligations > 0 ? <li><i className="is-obl" />Existujúce splátky <b>{fmt(r.main.obligations)}</b></li> : null}
                    <li><i className="is-pay" />Splátka hypotéky <b>{fmt(r.main.payment)}</b></li>
                    <li><i className="is-left" />Voľné nad životné minimum <b>{fmt(share.leftAbs)}</b></li>
                  </ul>
                  <ol className="mh-rows mh-rows--calc">
                    <li>
                      <div>
                        <span className="mh-row-t">Max. mesačná splátka podľa NBS</span>
                        <span className="mh-row-s">60 % z príjmu po odpočítaní životného minima{r.main.obligations > 0 ? " a existujúcich splátok" : ""}</span>
                      </div>
                      <b>{fmt(r.main.availPay)}</b>
                    </li>
                    <li>
                      <div>
                        <span className="mh-row-t">Strop celkového dlhu</span>
                        <span className="mh-row-s">{f1(r.dtiLimit)}× ročného príjmu{D.totalDebt > 0 ? ` mínus zostatok dlhov ${fmt(D.totalDebt)}` : ""}</span>
                      </div>
                      <b>{fmt(r.main.availDebt)}</b>
                    </li>
                    <li className="is-total">
                      <div>
                        <span className="mh-row-t">Maximálna hypotéka</span>
                        <span className="mh-row-s">na {D.years} {rokov(D.years)}, splátka posúdená pri {f1(r.stressRate)} %, {limitShort}</span>
                      </div>
                      <b className="is-accent">{fmt(r.main.max)}</b>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="mh-block calc-reveal" style={st(1)}>
                  <h3>Rebríček bánk</h3>
                  <p className="mh-block-sub">Uznaný mesačný príjem z tvojich tržieb a maximálna hypotéka pri rovnakých pravidlách NBS. Svetlejší pás znamená, že banka rozhoduje podľa segmentu alebo odvetvia.</p>
                  <ol className="mh-ladder">
                    {r.banks.map((b, i) => {
                      const best = r.best.some((x) => x.id === b.id);
                      const lo = b.mortgage ? (b.mortgage[0] / topBank) * 100 : 0;
                      const hi = b.mortgage ? (b.mortgage[1] / topBank) * 100 : 0;
                      return (
                        <li key={b.id} className={best ? "is-best" : !b.mortgage ? "is-na" : ""} style={dl(i)}>
                          <div className="mh-ladder-head">
                            <span className="mh-ladder-name">
                              {b.name}
                              {best ? <i className="mh-badge">najviac</i> : null}
                            </span>
                            <b>{b.mortgage ? rangeTxt(b.mortgage) : b.needs}</b>
                          </div>
                          <div className="mh-ladder-track" aria-hidden>
                            <i className="mh-ladder-fill" style={{ width: drawn ? `${lo}%` : 0 }} />
                            {hi > lo ? <i className="mh-ladder-range" style={{ left: `${lo}%`, width: drawn ? `${hi - lo}%` : 0 }} /> : null}
                          </div>
                          <span className="mh-ladder-note">
                            {b.income ? `príjem ${rangeTxt(b.income)} / mes. · ` : ""}
                            {b.note}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {/* čo keby */}
              {whatIf.length ? (
              <div className="mh-block calc-reveal" style={st(2)}>
                <h3>Čo by to zmenilo</h3>
                <div className="mh-whatif">
                  {whatIf.map((w, i) => (
                    <div key={w.label} className="mh-whatif-card" style={dl(i)}>
                      <span className="mh-whatif-label">{w.label}</span>
                      <b>+{fmt(w.value ?? 0)}</b>
                      <small>{w.sub}</small>
                    </div>
                  ))}
                </div>
              </div>
              ) : null}

              {/* presnejší výpočet */}
              <div className="mh-precise calc-reveal" style={st(3)}>
                <img src={ivanRolak} alt="Ivan Jašík" className="mh-precise-avatar" width={96} height={96} loading="lazy" />
                <div className="mh-precise-body">
                  <span className="mh-precise-kicker">Presnejší výpočet zadarmo</span>
                  <h3>{emp ? "Ktorá banka ti dá najviac?" : "Ktorá banka ti uzná najviac?"}</h3>
                  <ul className="mh-precise-list">
                    <li>{emp ? "prejdeme typ zmluvy, skúšobnú dobu, príplatky a bonusy" : "prejdeme všetkých 8 bánk na tvojich tržbách a segmente"}</li>
                    <li>aké dokumenty budeš potrebovať a čo banky neuznajú</li>
                    <li>{emp ? "ako zvýšiť strop ešte pred žiadosťou" : "ako zvýšiť uznaný príjem ešte pred žiadosťou"}</li>
                  </ul>
                  <a className="btn-primary mh-cta-btn" href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" data-umami-event="click_konzultacia" data-umami-event-section="maximalna-hypoteka">
                    {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </a>
                </div>
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
