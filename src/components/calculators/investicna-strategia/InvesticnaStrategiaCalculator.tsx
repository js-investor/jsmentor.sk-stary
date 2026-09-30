import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, Check, ChevronDown, Download, Link2, Minus, Plus } from "lucide-react";
import "../shared/calc-ui.css";
import "./investicna-strategia.css";
import {
  ALLOC_PRESETS,
  BRAKES,
  BRAKE_YEARS,
  DEFAULT_INPUTS,
  GOAL_TARGET,
  LIMITS,
  RENT_TARGET,
  adjustWeights,
  compute,
  dayOf,
  decodeScenario,
  decodeSet,
  encodeScenario,
  isoOf,
  resolveRange,
  rowsBetween,
  rowsFor,
  sameWeights,
  sanitize,
  yearsAvailable,
  ymdOf,
  type Brake,
  type Dataset,
  type Inputs,
  type Result,
  type SetId,
  type Weights,
} from "./investicnaStrategiaModel";
import { dateLong, dateShort, mix, money, pct, rokov, signedPct, span, spanShort, vkladov } from "./investicnaStrategiaFormat";
import { BrakeBars, Donut, DrawdownChart, MarketChart, ProfitBars, ValueChart } from "./InvesticnaStrategiaCharts";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/**
 * Investičná stratégia – akcie, dlhopisy a peňažný fond na skutočných denných dátach, s brzdou (zloženie po rokoch).
 * Štruktúra podľa nástroja História investícií (KFP), ktorý Ivan poslal ako vzor: vľavo tri záložky nastavení
 * (Parametre, Alokácia, Brzda), vpravo dlaždice s výsledkom a záložky Vývoj, Zhodnotenie, Trhy, Profit, Riziko.
 * Vzhľad drží jazyk /bonusy 2.0 a Úverovej 3.0: ivory karty s hairline na krémovom plátne, atrament, jedna zelená.
 */

const STORAGE_KEY = "jsm_investicna_strategia_v2";
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const ASSETS = ["Akcie", "Dlhopisy", "Peňažný fond"] as const;
const ASSET_KEYS = ["stock", "bond", "cash"] as const;

const SETS: Record<SetId, { label: string; note: string; stock: string; bond: string; cash: string; inflation: string }> = {
  eur: {
    label: "Svet v eurách",
    note: "Svetové akcie, nemecké štátne dlhopisy a eurový peňažný trh.",
    stock: "všetky akcie rozvinutých trhov sveta vrátane menších firiem, prepočítané na eurá",
    bond: "nemecké štátne dlhopisy so splatnosťou 7 až 10 rokov",
    cash: "eurový peňažný trh (sadzba EONIA, od októbra 2019 €STR)",
    inflation: "HICP eurozóny",
  },
  usd: {
    label: "USA v dolároch",
    note: "Americké akcie, štátne dlhopisy USA a pokladničné poukážky.",
    stock: "celý americký akciový trh vrátane menších firiem",
    bond: "štátne dlhopisy USA so splatnosťou 10 rokov",
    cash: "americké pokladničné poukážky so splatnosťou 1 mesiac",
    inflation: "CPI-U Spojených štátov (október 2025 úrad nezverejnil, je dopočítaný zo susedných mesiacov)",
  },
};

const BRAKE_NOTE: Record<Brake, string> = {
  none: "Zloženie portfólia je každý rok rovnaké.",
  goal: `Posledných ${BRAKE_YEARS} rokov sa portfólio každý rok posúva k ${mix(GOAL_TARGET)}, aby si mal peniaze na konci v bezpečí.`,
  rent: `Posledných ${BRAKE_YEARS} rokov sa portfólio posúva k ${mix(RENT_TARGET)}. Časť ostáva v akciách, lebo peniaze budeš čerpať postupne.`,
  custom: "Zloženie si nastavuješ pre každý rok sám. Šípka pri riadku skopíruje jeho zloženie do všetkých ďalších rokov.",
};

type FormTab = "parametre" | "alokacia" | "brzda";
const FORM_TABS: { id: FormTab; label: string }[] = [
  { id: "parametre", label: "Parametre" },
  { id: "alokacia", label: "Alokácia" },
  { id: "brzda", label: "Brzda" },
];

type Tab = "vyvoj" | "zhodnotenie" | "trhy" | "profit" | "riziko";
const TABS: { id: Tab; label: string }[] = [
  { id: "vyvoj", label: "Vývoj" },
  { id: "zhodnotenie", label: "Zhodnotenie" },
  { id: "trhy", label: "Trhy" },
  { id: "profit", label: "Profit" },
  { id: "riziko", label: "Riziko" },
];

type Sets = Record<SetId, Dataset>;
let setsCache: Promise<Sets> | null = null;
const loadSets = (): Promise<Sets> => {
  if (!setsCache) {
    setsCache = import("./investicnaStrategiaData").then((m) => ({ eur: decodeSet("eur", m.RAW.eur, m.UNIT), usd: decodeSet("usd", m.RAW.usd, m.UNIT) }));
    setsCache.catch(() => {
      setsCache = null;
    });
  }
  return setsCache;
};

const loadInitial = (): Inputs => {
  try {
    const shared = decodeScenario(window.location.search);
    if (shared) return shared;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize({ ...DEFAULT_INPUTS, ...(JSON.parse(raw) as Partial<Inputs>) }) : DEFAULT_INPUTS;
  } catch {
    return DEFAULT_INPUTS;
  }
};

const copyRows = (rows: Weights[]): Weights[] => rows.map((w) => [...w] as Weights);

/** Plynulé dobehnutie čísla k cieľu. */
function useCountUp(target: number, ms = 500): number {
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

/* ------------------------------------------------------------------ polia */

type StepperProps = {
  id: string;
  label?: string;
  hint?: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  compact?: boolean;
  ariaLabel?: string;
  onChange: (v: number) => void;
};

/** Číslo s tlačidlami mínus a plus, do poľa sa dá aj písať. */
const Stepper = ({ id, label, hint, unit, value, min, max, step, decimals = 0, compact = false, ariaLabel, onChange }: StepperProps) => {
  const [text, setText] = useState<string | null>(null);
  const clamp = (v: number) => Number(Math.max(min, Math.min(max, Number.isFinite(v) ? v : min)).toFixed(decimals));
  const shown = text ?? value.toLocaleString("sk-SK", { maximumFractionDigits: decimals });
  const bump = (dir: 1 | -1) => onChange(clamp(Math.round((value + dir * step) / step) * step));
  return (
    <div className={`ist-stepper${compact ? " is-compact" : ""}`}>
      {label ? (
        <label className="calc-label" htmlFor={id}>
          {label}
          {hint ? <span className="calc-label-hint">{hint}</span> : null}
        </label>
      ) : null}
      <div className="ist-step">
        <button type="button" aria-label={`${ariaLabel ?? label ?? ""}: menej`} disabled={value <= min} onClick={() => bump(-1)}>
          <Minus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          aria-label={label ? undefined : ariaLabel}
          value={shown}
          onFocus={() => setText(String(value).replace(".", ","))}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value.replace(/\s/g, "").replace(",", "."));
            if (e.target.value.trim() !== "" && Number.isFinite(v)) onChange(clamp(v));
          }}
          onBlur={() => setText(null)}
        />
        {unit ? <span className="ist-step-unit" aria-hidden>{unit}</span> : null}
        <button type="button" aria-label={`${ariaLabel ?? label ?? ""}: viac`} disabled={value >= max} onClick={() => bump(1)}>
          <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </div>
  );
};

const Collapse = ({ title, meta, open, onToggle, children }: { title: string; meta: string; open: boolean; onToggle: () => void; children: ReactNode }) => (
  <>
    <button type="button" className="ist-collapse" aria-expanded={open} onClick={onToggle}>
      <span>{title}</span>
      <span className="ist-collapse-meta">{meta}</span>
      <ChevronDown className={`h-4 w-4 ist-chev${open ? " is-open" : ""}`} aria-hidden />
    </button>
    {open ? <div className="ist-advanced">{children}</div> : null}
  </>
);

/* ------------------------------------------------------------------ komponent */

const InvesticnaStrategiaCalculator = () => {
  const [A, setA] = useState<Inputs>(loadInitial);
  const [sets, setSets] = useState<Sets | null>(null);
  const [failed, setFailed] = useState(false);
  const [formTab, setFormTab] = useState<FormTab>("parametre");
  const [tab, setTab] = useState<Tab>("vyvoj");
  const [profitMode, setProfitMode] = useState<"money" | "pct">("money");
  const [advOpen, setAdvOpen] = useState(() => A.cost > 0 || A.rebalance === "monthly");
  const [pinned, setPinned] = useState<number | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const orderRef = useRef<number[]>([2, 1, 0]);
  const rowOrderRef = useRef<number[][]>([]);

  useEffect(() => {
    let alive = true;
    loadSets()
      .then((loaded) => alive && setSets(loaded))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(A));
    } catch {
      /* súkromný režim */
    }
  }, [A]);

  /* výpočet beží nad odloženou kópiou vstupov, aby ovládanie ostalo plynulé */
  const D = useDeferredValue(A);
  const ds = sets ? sets[D.set] : null;
  const r: Result | null = useMemo(() => (ds ? compute(ds, D) : null), [ds, D]);
  const rangeKey = r ? `${D.set}-${r.i0}-${r.i1}` : "";
  useEffect(() => setPinned(null), [rangeKey]);

  const dsNow = sets ? sets[A.set] : null;
  const maxYears = dsNow ? yearsAvailable(dsNow) : LIMITS.years.max;
  /* riadky brzdy pre práve nastavené obdobie (formulár nesmie čakať na odložený výpočet) */
  const rowsNow = useMemo(() => {
    if (!dsNow) return Math.max(1, A.years);
    const rg = resolveRange(dsNow, A);
    return rowsBetween(dsNow.day[rg.i0], dsNow.day[rg.i1]);
  }, [dsNow, A]);
  const rows = useMemo(() => rowsFor(A, rowsNow), [A, rowsNow]);
  const cur = r?.currency ?? (A.set === "usd" ? "$" : "€");
  const shownFinal = useCountUp(r ? r.strategy.final : 0);
  const allocPreset = ALLOC_PRESETS.find((p) => sameWeights(p.w, A.alloc));

  const set = (patch: Partial<Inputs>) => setA((s) => ({ ...s, ...patch }));
  const setYears = (v: number) => set({ years: Math.round(Math.max(1, Math.min(maxYears, v))), start: "" });
  const setDataset = (id: SetId) => {
    const limit = sets ? yearsAvailable(sets[id]) : LIMITS.years.max;
    set({ set: id, years: Math.min(A.years, limit) });
  };
  const setAlloc = (next: Weights) => {
    setA((s) => {
      const custom = s.brake === "custom" ? [next, ...copyRows(s.custom).slice(1)] : s.custom;
      return { ...s, alloc: next, custom };
    });
  };
  const setAllocAsset = (asset: number, value: number) => {
    const order = orderRef.current;
    orderRef.current = [...order.filter((x) => x !== asset), asset];
    setAlloc(adjustWeights(A.alloc, asset, value, order));
  };
  const setBrake = (brake: Brake) => {
    if (brake === "custom") set({ brake, custom: copyRows(rows) });
    else set({ brake });
  };
  const setRowAsset = (k: number, asset: number, value: number) => {
    const order = rowOrderRef.current[k] ?? [2, 1, 0];
    rowOrderRef.current[k] = [...order.filter((x) => x !== asset), asset];
    const next = copyRows(rows);
    next[k] = adjustWeights(next[k], asset, value, order);
    set({ brake: "custom", custom: next, alloc: next[0] });
  };
  const fillDown = (k: number) => {
    const next = copyRows(rows);
    for (let i = k + 1; i < next.length; i++) next[i] = [...next[k]] as Weights;
    set({ brake: "custom", custom: next, alloc: next[0] });
  };
  const reset = () => {
    orderRef.current = [2, 1, 0];
    rowOrderRef.current = [];
    setAdvOpen(false);
    setPinned(null);
    setFormTab("parametre");
    setA(DEFAULT_INPUTS);
  };
  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?${encodeScenario(A)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Skopíruj si odkaz na tento scenár:", url);
    }
  };

  /* dátumy: pole ukazuje, čo je napísané; ak nič, deň, s ktorým sa počíta */
  const firstIso = dsNow ? isoOf(dsNow.day[0]) : "";
  const lastIso = dsNow ? isoOf(dsNow.day[dsNow.n - 1]) : "";
  const shownStart = A.start || (dsNow ? isoOf(dsNow.day[resolveRange(dsNow, A).i0]) : "");
  const shownEnd = A.end || lastIso;
  /* po opustení poľa nahradí dátum mimo dát (alebo koniec pred začiatkom) dňom, s ktorým sa naozaj počíta */
  const tidyDates = () => {
    if (!dsNow) return;
    const clean = sanitize(A);
    const range = resolveRange(dsNow, clean);
    const first = dsNow.day[0];
    const last = dsNow.day[dsNow.n - 1];
    const startDay = dsNow.day[range.i0];
    const endDay = dsNow.day[range.i1];
    const s = dayOf(A.start);
    const e = dayOf(A.end);
    const patch: Partial<Inputs> = {};
    if (A.start && !Number.isFinite(s)) patch.start = isoOf(first);
    else if (A.start && !(s >= first && s <= last && startDay >= s && startDay - s <= 10)) patch.start = isoOf(startDay);
    if (A.end && !(e >= first && e < last && endDay <= e && e - endDay <= 10)) patch.end = range.i1 === dsNow.n - 1 ? "" : isoOf(endDay);
    if (A.start) patch.years = rowsBetween(startDay, endDay);
    if (Object.keys(patch).length) set(patch);
  };

  const downloadCsv = () => {
    if (!ds || !r) return;
    const n2 = (v: number) => v.toFixed(2).replace(".", ",");
    const lines = ["datum;hodnota;vlozene;zisk;akcie_%;dlhopisy_%;penazny_fond_%"];
    for (let j = 0; j < r.n; j++) {
      const s = r.shareStock[j] * 100;
      const b = r.shareBond[j] * 100;
      lines.push([isoOf(ds.day[r.i0 + j]), n2(r.strategy.value[j]), n2(r.strategy.paid[j]), n2(r.strategy.value[j] - r.strategy.paid[j]), n2(s), n2(b), n2(Math.max(0, 100 - s - b))].join(";"));
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `investicna-strategia-${r.inputs.start}-${r.inputs.end}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const dayAt = (j: number) => (ds && r ? ds.day[r.i0 + j] : 0);
  /* počet znakov čísla v páse: podľa neho sa písmo zmenší, aby sa číslo zmestilo do svojho stĺpca */
  const nStyle = (...texts: string[]) => ({ "--n": Math.max(...texts.map((x) => x.length)) }) as CSSProperties;
  const low = r?.strategy.drawdown ?? null;
  /* bola hodnota niekedy pod vkladmi? potom má legenda grafu aj stratu */
  const hadLoss = useMemo(() => {
    if (!r) return false;
    for (let j = 0; j < r.n; j++) if (r.strategy.value[j] < r.strategy.paid[j] - 1e-9) return true;
    return false;
  }, [r]);
  const yearsShown = A.start ? rowsNow : A.years;
  const brakeLabel = BRAKES.find((b) => b.id === A.brake)?.label ?? "";
  const returnsLabel = A.real ? "reálne" : "nominálne";

  const keyTabs = (ids: readonly string[], current: string, pick: (id: string) => void, prefix: string) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = ids[(ids.indexOf(current) + step + ids.length) % ids.length];
    pick(next);
    document.getElementById(`${prefix}-${next}`)?.focus();
  };

  /* riadok so scenárom: na prvý pohľad vidno, čo je nastavené; klik otvorí príslušnú časť nastavení */
  const goTo = (tabId: FormTab) => {
    setFormTab(tabId);
    if (window.innerWidth < 1024) document.querySelector("#ist-root .ist-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const chips: { label: string; tab: FormTab }[] = r
    ? [
        { label: SETS[A.set].label, tab: "parametre" },
        { label: `${span(r.startDay, r.endDay)} · ${ymdOf(r.startDay).y}–${ymdOf(r.endDay).y}`, tab: "parametre" },
        { label: `${money(A.initial, cur)} + ${money(A.monthly, cur)} mesačne`, tab: "parametre" },
        { label: `${allocPreset?.label ?? "Vlastné zloženie"} ${mix(A.alloc)}`, tab: "alokacia" },
        { label: `Brzda: ${brakeLabel.toLowerCase()}`, tab: "brzda" },
        { label: A.real ? "Reálne výnosy" : "Nominálne výnosy", tab: "parametre" },
      ]
    : [];

  return (
    <div id="ist-root" className="calc-ui ist w-full font-sans">
      <div className="ist-wrap">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={st(0)}>
            <span className="calc-eyebrow">Investičná stratégia</span>
            <h1 className="calc-title">
              Čo by tvoja stratégia urobila <em>naozaj</em>?
            </h1>
            <p className="calc-subtitle">
              Nastav vklady, čas a pomer akcií, dlhopisov a peňažného fondu. Pridaj brzdu a pozri, čo by sa s tvojimi peniazmi stalo
              podľa skutočných denných dát.
            </p>
          </header>

          <div className="ist-layout">
            {/* ---------------------------------------------------------------- Nastavenia */}
            <aside className="ist-form calc-reveal" aria-label="Nastavenie" style={st(1)}>
              <div className="calc-segment ist-segment ist-form-tabs" role="tablist" aria-label="Časti nastavenia" onKeyDown={keyTabs(FORM_TABS.map((t) => t.id), formTab, (id) => setFormTab(id as FormTab), "ist-ftab")}>
                {FORM_TABS.map((t) => (
                  <button key={t.id} type="button" role="tab" id={`ist-ftab-${t.id}`} aria-selected={formTab === t.id} aria-pressed={formTab === t.id} aria-controls={`ist-fpanel-${t.id}`} tabIndex={formTab === t.id ? 0 : -1} onClick={() => setFormTab(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>

              {formTab === "parametre" ? (
                <div role="tabpanel" id="ist-fpanel-parametre" aria-labelledby="ist-ftab-parametre" className="ist-fpanel">
                  <div className="ist-field">
                    <p className="calc-label">Dáta</p>
                    <div className="calc-segment ist-segment" role="group" aria-label="Súbor dát">
                      {(Object.keys(SETS) as SetId[]).map((id) => (
                        <button key={id} type="button" aria-pressed={A.set === id} onClick={() => setDataset(id)}>
                          {SETS[id].label}
                        </button>
                      ))}
                    </div>
                    <p className="ist-hint">
                      {SETS[A.set].note}
                      {dsNow ? ` Denné dáta od ${dateShort(dsNow.day[0])} do ${dateShort(dsNow.day[dsNow.n - 1])}.` : ""}
                    </p>
                  </div>
                  <Stepper id="ist-initial" label="Jednorazový vklad" hint="na začiatku" unit={cur} value={A.initial} {...LIMITS.initial} onChange={(v) => set({ initial: v })} />
                  <Stepper id="ist-monthly" label="Pravidelná mesačná investícia" unit={cur} value={A.monthly} {...LIMITS.monthly} onChange={(v) => set({ monthly: v })} />
                  <Stepper id="ist-years" label="Čas investície" unit={rokov(yearsShown)} value={yearsShown} min={1} max={maxYears} step={1} onChange={setYears} />
                  <div className="ist-row">
                    <div className="ist-field is-compact">
                      <label className="calc-label" htmlFor="ist-start">Od</label>
                      <input id="ist-start" type="date" className="calc-input ist-date" value={shownStart} min={firstIso} max={lastIso} onChange={(e) => set({ start: e.target.value })} onBlur={tidyDates} />
                    </div>
                    <div className="ist-field is-compact">
                      <label className="calc-label" htmlFor="ist-end">Do</label>
                      <input id="ist-end" type="date" className="calc-input ist-date" value={shownEnd} min={firstIso} max={lastIso} onChange={(e) => set({ end: e.target.value })} onBlur={tidyDates} />
                    </div>
                  </div>
                  {r && (r.startMoved || r.endMoved) ? (
                    <p className="ist-hint">Počítam od {dateShort(r.startDay)} do {dateShort(r.endDay)}, to sú najbližšie dni, keď sa obchodovalo.</p>
                  ) : A.years > maxYears - 1 && !A.start && dsNow ? (
                    <p className="ist-hint">
                      {A.set === "eur" ? `Eurové dáta siahajú do januára 1999, teda najviac ${maxYears} rokov. Pre dlhšie obdobie prepni na USA v dolároch.` : `Americké dáta siahajú do januára 1962, teda najviac ${maxYears} rokov.`}
                    </p>
                  ) : null}
                  <div className="ist-field">
                    <p className="calc-label">Typ výnosov</p>
                    <div className="calc-segment ist-segment" role="group" aria-label="Typ výnosov">
                      <button type="button" aria-pressed={!A.real} onClick={() => set({ real: false })}>Nominálne</button>
                      <button type="button" aria-pressed={A.real} onClick={() => set({ real: true })}>Reálne</button>
                    </div>
                    <p className="ist-hint">{A.real ? "Po odpočítaní inflácie, sumy v cenách z konca obdobia." : "Bez odpočítania inflácie, sumy tak, ako by boli na účte."}</p>
                  </div>
                  <Collapse title="Ďalšie nastavenia" meta={[A.rebalance === "monthly" ? "mesačné vyvažovanie" : "", A.cost > 0 ? `náklady ${A.cost.toLocaleString("sk-SK")} %` : ""].filter(Boolean).join(", ") || "voliteľné"} open={advOpen} onToggle={() => setAdvOpen((o) => !o)}>
                    <p className="calc-label">Vyvažovanie na cieľové zloženie</p>
                    <div className="calc-segment ist-segment" role="group" aria-label="Vyvažovanie portfólia">
                      <button type="button" aria-pressed={A.rebalance === "yearly"} onClick={() => set({ rebalance: "yearly" })}>Raz ročne</button>
                      <button type="button" aria-pressed={A.rebalance === "monthly"} onClick={() => set({ rebalance: "monthly" })}>Každý mesiac</button>
                    </div>
                    <Stepper id="ist-cost" label="Ročné náklady" hint="fondy a správa" unit="%" value={A.cost} {...LIMITS.cost} decimals={1} onChange={(v) => set({ cost: v })} />
                  </Collapse>
                </div>
              ) : null}

              {formTab === "alokacia" ? (
                <div role="tabpanel" id="ist-fpanel-alokacia" aria-labelledby="ist-ftab-alokacia" className="ist-fpanel">
                  <div className="calc-pills ist-pills" role="group" aria-label="Predvolené zloženie">
                    {ALLOC_PRESETS.map((p) => (
                      <button key={p.id} type="button" className="calc-pill" aria-pressed={allocPreset?.id === p.id} onClick={() => setAlloc([...p.w] as Weights)}>
                        {p.label}
                      </button>
                    ))}
                    <button type="button" className="calc-pill" aria-pressed={!allocPreset} onClick={() => setFormTab("alokacia")}>Vlastná</button>
                  </div>
                  <Donut w={A.alloc} title={allocPreset?.label ?? "Vlastná"} sub={brakeLabel} />
                  <div className="ist-assets">
                    {ASSETS.map((a, k) => (
                      <div key={a} className="ist-asset">
                        <span className="ist-asset-name"><i className={`ist-dot ist-dot--${ASSET_KEYS[k]}`} aria-hidden />{a}</span>
                        <Stepper id={`ist-w-${k}`} ariaLabel={`${a}, podiel v percentách`} unit="%" value={A.alloc[k]} min={0} max={100} step={5} compact onChange={(v) => setAllocAsset(k, v)} />
                      </div>
                    ))}
                  </div>
                  <p className="ist-hint">Súčet je vždy 100 %. Keď zmeníš jednu zložku, rozdiel vyrovná tá, ktorej si sa dotkol najdávnejšie.</p>
                </div>
              ) : null}

              {formTab === "brzda" ? (
                <div role="tabpanel" id="ist-fpanel-brzda" aria-labelledby="ist-ftab-brzda" className="ist-fpanel">
                  <div className="calc-pills ist-pills" role="group" aria-label="Brzda">
                    {BRAKES.map((b) => (
                      <button key={b.id} type="button" className="calc-pill" aria-pressed={A.brake === b.id} onClick={() => setBrake(b.id)}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <p className="ist-hint">{BRAKE_NOTE[A.brake]}</p>
                  <BrakeBars rows={rows} />
                  <div className="ist-keys" aria-hidden>
                    {ASSETS.map((a, k) => (
                      <span key={a}><i className={`ist-dot ist-dot--${ASSET_KEYS[k]}`} />{a}</span>
                    ))}
                  </div>
                  <div className="ist-brake-table" role="table" aria-label="Zloženie portfólia po rokoch">
                    <div className="ist-brake-head" role="row">
                      <span role="columnheader">Rok</span>
                      <span role="columnheader">Akcie</span>
                      <span role="columnheader">Dlhopisy</span>
                      <span role="columnheader">Peň. fond</span>
                      <span role="columnheader" className="sr-only">Skopírovať nižšie</span>
                    </div>
                    {rows.map((w, k) => (
                      <div key={k} className="ist-brake-row" role="row">
                        <span className="ist-brake-year" role="rowheader">{k + 1}.</span>
                        {ASSETS.map((a, i) => (
                          <span key={a} role="cell">
                            <Stepper id={`ist-r-${k}-${i}`} ariaLabel={`${k + 1}. rok, ${a.toLowerCase()} v percentách`} value={w[i]} min={0} max={100} step={5} compact onChange={(v) => setRowAsset(k, i, v)} />
                          </span>
                        ))}
                        <span role="cell">
                          {k < rows.length - 1 ? (
                            <button type="button" className="ist-fill" aria-label={`Skopírovať zloženie ${k + 1}. roka do všetkých ďalších rokov`} title="Do všetkých ďalších rokov" onClick={() => fillDown(k)}>
                              <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                            </button>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="ist-form-foot">
                <button type="button" className="ist-link" onClick={copyLink}>
                  {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden /> : <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
                  {copied ? "Odkaz je skopírovaný" : "Kopírovať odkaz na scenár"}
                </button>
                <button type="button" className="ist-reset" onClick={reset}>Začať odznova</button>
              </div>
            </aside>

            {/* ---------------------------------------------------------------- Výsledok */}
            <section className="ist-result calc-reveal" aria-label="Výsledok" style={st(2)} aria-busy={!r}>
              {failed ? (
                <div className="ist-state">
                  <p>Historické dáta sa nepodarilo načítať. Skontroluj pripojenie a skús to znova.</p>
                  <button type="button" className="btn-primary ist-cta-btn" onClick={() => window.location.reload()}>Skúsiť znova</button>
                </div>
              ) : !r || !ds ? (
                <div className="ist-state" role="status">
                  <span className="ist-spinner" aria-hidden />
                  <p>Načítavam historické dáta…</p>
                </div>
              ) : (
                <>
                  <div className="ist-chips" aria-label="Nastavený scenár">
                    {chips.map((c) => (
                      <button key={c.label} type="button" className="ist-chip" onClick={() => goTo(c.tab)}>{c.label}</button>
                    ))}
                  </div>
                  <dl className="ist-band">
                    <div className="ist-band-main">
                      <dt>Výsledná čiastka</dt>
                      <dd style={nStyle(money(r.strategy.final, cur))}>{r.strategy.deposits > 0 ? money(shownFinal, cur) : "–"}</dd>
                      <small>k {dateShort(r.endDay)}{A.real ? " · reálne, v dnešných cenách" : ""}</small>
                    </div>
                    <div className="ist-band-stats" style={nStyle(...[money(r.strategy.deposits, cur), money(r.strategy.gain, cur), pct(r.strategy.twr, 2), low && low.depth < 0 ? pct(low.depth) : "žiadny"])}>
                      <div>
                        <dt>Suma vkladov</dt>
                        <dd>{money(r.strategy.deposits, cur)}</dd>
                        <small>{r.depositCount} {vkladov(r.depositCount)}</small>
                      </div>
                      <div>
                        <dt>Celkový {r.strategy.gain >= 0 ? "zisk" : "výsledok"}</dt>
                        <dd className={r.strategy.gain >= 0 ? "is-gain" : "is-loss"}>{money(r.strategy.gain, cur)}</dd>
                        <small>{r.strategy.deposits > 0 ? `${signedPct(r.strategy.final / r.strategy.deposits - 1, 0)} z vkladov` : "bez vkladov"}</small>
                      </div>
                      <div>
                        <dt>Výnos p. a.</dt>
                        <dd className={r.strategy.twr < 0 ? "is-loss" : undefined}>{pct(r.strategy.twr, 2)}</dd>
                        <small>{returnsLabel}, zložený priemer</small>
                      </div>
                      <div>
                        <dt>Najhlbší prepad</dt>
                        <dd className={low && low.depth < 0 ? "is-loss" : undefined}>{low && low.depth < 0 ? pct(low.depth) : "žiadny"}</dd>
                        <small>{low && low.depth < 0 ? `${dateShort(dayAt(low.peak))} – ${dateShort(dayAt(low.trough))}` : "stratégia len rástla"}</small>
                      </div>
                    </div>
                  </dl>
                  {r.strategy.deposits <= 0 ? <p className="ist-empty">Zadaj jednorazový alebo mesačný vklad a uvidíš, na koľko by narástol.</p> : null}

                  <div className="calc-pills ist-tabs" role="tablist" aria-label="Pohľad na výsledok" onKeyDown={keyTabs(TABS.map((t) => t.id), tab, (id) => setTab(id as Tab), "ist-tab")}>
                    {TABS.map((t) => (
                      <button key={t.id} type="button" role="tab" id={`ist-tab-${t.id}`} aria-controls={`ist-panel-${t.id}`} className="calc-pill" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {tab === "vyvoj" ? (
                    <div role="tabpanel" id="ist-panel-vyvoj" aria-labelledby="ist-tab-vyvoj" className="ist-panel">
                      <div className="ist-chart-head">
                        <h3>Vývoj hodnoty investície</h3>
                        <div className="ist-legend">
                          <span className="ist-legend-item"><i className="ist-legend-line ist-legend-paid" />Vložené celkom</span>
                          <span className="ist-legend-item"><i className="ist-legend-line ist-legend-soft" />Zisk</span>
                          {hadLoss ? <span className="ist-legend-item"><i className="ist-legend-line ist-legend-softred" />Strata</span> : null}
                          <span className="ist-legend-item"><i className="ist-legend-line ist-legend-accent" />Hodnota</span>
                        </div>
                      </div>
                      <ValueChart ds={ds} r={r} pinned={pinned} onPin={setPinned} />
                      <div className="ist-under">
                        <div className="ist-keys ist-keys--chart">
                          <b>Zloženie portfólia</b>
                          {ASSETS.map((a, k) => (
                            <span key={a}><i className={`ist-dot ist-dot--${ASSET_KEYS[k]}`} aria-hidden />{a}</span>
                          ))}
                        </div>
                        <span className="ist-hintline">Prejdi po grafe kurzorom alebo prstom: uvidíš stav v ktorýkoľvek deň.</span>
                      </div>
                    </div>
                  ) : null}

                  {tab === "zhodnotenie" ? (
                    <div role="tabpanel" id="ist-panel-zhodnotenie" aria-labelledby="ist-tab-zhodnotenie" className="ist-panel">
                      <div className="ist-chart-head">
                        <h3>Priemerné ročné zhodnotenie</h3>
                        <span className="ist-head-note">{dateShort(r.startDay)} – {dateShort(r.endDay)}, {returnsLabel}</span>
                      </div>
                      <HBars
                        rows={[
                          { label: "Tvoja stratégia", value: r.strategy.twr, cls: "ist-bar--accent" },
                          { label: "Akcie", value: r.strategy.assets.stock, cls: "ist-bar--ink" },
                          { label: "Dlhopisy", value: r.strategy.assets.bond, cls: "ist-bar--taupe" },
                          { label: "Peňažný fond", value: r.strategy.assets.cash, cls: "ist-bar--beige" },
                          { label: "Inflácia", value: r.nominal.assets.inflation, cls: "ist-bar--red" },
                        ]}
                      />
                      <p className="ist-summary">
                        Tvoja stratégia zarobila <strong>{pct(r.strategy.twr, 2)} ročne</strong>
                        {r.strategy.irr !== null && A.monthly > 0 ? `, tvoje vklady sa zhodnocovali ${pct(r.strategy.irr, 2)} ročne` : ""}. Samotné akcie
                        {" "}{pct(r.strategy.assets.stock, 2)}, dlhopisy {pct(r.strategy.assets.bond, 2)}, peňažný fond {pct(r.strategy.assets.cash, 2)}
                        {A.real ? " (všetko po odpočítaní inflácie)" : `, inflácia bola ${pct(r.nominal.assets.inflation, 2)} ročne`}.
                      </p>
                    </div>
                  ) : null}

                  {tab === "trhy" ? (
                    <div role="tabpanel" id="ist-panel-trhy" aria-labelledby="ist-tab-trhy" className="ist-panel ist-panel--trhy">
                      <div className="ist-chart-head">
                        <h3>Vývoj finančných trhov</h3>
                        <div className="ist-legend">
                          <span className="ist-legend-item"><i className="ist-legend-line ist-legend-ink" />Akcie</span>
                          <span className="ist-legend-item"><i className="ist-legend-line ist-legend-taupe" />Dlhopisy</span>
                          <span className="ist-legend-item"><i className="ist-legend-line ist-legend-beige" />Peňažný fond</span>
                          <span className="ist-legend-item"><i className="ist-legend-line ist-legend-red" />Inflácia</span>
                        </div>
                      </div>
                      <MarketChart ds={ds} r={r} />
                      <span className="ist-hintline">Na čo by narástol 1 {cur} vložený na začiatku do každej zložky, bez poplatkov. Mierka je logaritmická, každé zdvojnásobenie má rovnakú výšku.</span>
                    </div>
                  ) : null}

                  {tab === "profit" ? (
                    <div role="tabpanel" id="ist-panel-profit" aria-labelledby="ist-tab-profit" className="ist-panel">
                      <div className="ist-chart-head">
                        <h3>{profitMode === "money" ? `Zisk v jednotlivých rokoch v ${cur}` : "Výnos v jednotlivých rokoch"}</h3>
                        <div className="calc-segment ist-segment ist-segment--small" role="group" aria-label="Jednotky">
                          <button type="button" aria-pressed={profitMode === "money"} onClick={() => setProfitMode("money")}>{cur}</button>
                          <button type="button" aria-pressed={profitMode === "pct"} onClick={() => setProfitMode("pct")}>%</button>
                        </div>
                      </div>
                      <div className="ist-legend ist-legend--static">
                        <span className="ist-legend-item"><i className="ist-legend-box ist-legend-accent" />Nominálne</span>
                        <span className="ist-legend-item"><i className="ist-legend-box ist-legend-forest" />Reálne (po inflácii)</span>
                        <span className="ist-legend-item"><i className="ist-legend-box ist-legend-redbox" />Strata</span>
                      </div>
                      <ProfitBars r={r} mode={profitMode} />
                      {r.bestYear && r.worstYear && r.yearly.length > 1 ? (
                        <p className="ist-summary">
                          V pluse skončilo <strong>{r.yearly.filter((y) => y.strategy > 0).length} z {r.yearly.length}</strong> rokov. Najlepší bol rok {r.bestYear.year} ({signedPct(r.bestYear.strategy)},
                          {" "}{money(r.bestYear.profitNominal, cur)}), najhorší rok {r.worstYear.year} ({signedPct(r.worstYear.strategy)}, {money(r.worstYear.profitNominal, cur)}). Neúplné roky na okrajoch obdobia sú vyblednuté.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {tab === "riziko" ? (
                    <div role="tabpanel" id="ist-panel-riziko" aria-labelledby="ist-tab-riziko" className="ist-panel">
                      <div className="ist-chart-head">
                        <h3>Prepady pod predchádzajúce maximum</h3>
                        <div className="ist-legend">
                          <span className="ist-legend-item"><i className="ist-legend-line ist-legend-red" />Tvoja stratégia</span>
                          {A.alloc[0] < 100 || A.brake !== "none" ? <span className="ist-legend-item"><i className="ist-legend-line ist-legend-dash" />Len akcie</span> : null}
                        </div>
                      </div>
                      <DrawdownChart ds={ds} r={r} withStocks={A.alloc[0] < 100 || A.brake !== "none"} />
                      <span className="ist-hintline">O koľko bola stratégia v daný deň pod svojím dovtedajším maximom. Nové vklady do toho nerátam, ide o samotnú stratégiu.</span>
                      {low && low.depth < 0 ? (
                        <p className="ist-summary">
                          Najhlbšie bola stratégia <strong>{pct(low.depth)}</strong> pod maximom, dňa {dateLong(dayAt(low.trough))}. Pokles z vrcholu trval {span(dayAt(low.peak), dayAt(low.trough))}
                          {low.recovery !== null ? ` a na pôvodnú hodnotu sa vrátila ${dateLong(dayAt(low.recovery))} (${spanShort(dayAt(low.peak), dayAt(low.recovery))} od vrcholu).` : " a do konca obdobia sa na pôvodnú hodnotu nevrátila."}
                          {A.alloc[0] < 100 || A.brake !== "none" ? ` Čisté akcie mali v tom istom období najhlbší prepad ${pct(r.stocks.drawdown.depth)}.` : ""}
                        </p>
                      ) : null}
                      {r.crises.length ? (
                        <>
                          <h4 className="ist-h4">Veľké krízy v tomto období</h4>
                          <ul className="ist-crises">
                            {r.crises.map((c) => {
                              const worst = Math.min(c.stocks, c.strategy, -0.01);
                              return (
                                <li key={c.id}>
                                  <div className="ist-crisis-head">
                                    <b>{c.name}</b>
                                    <span>{dateShort(dayAt(c.peak))} – {dateShort(dayAt(c.trough))}</span>
                                  </div>
                                  <div className="ist-crisis-bars">
                                    <span>Akcie</span>
                                    <i className="ist-bar ist-bar--ink" style={{ "--w": `${Math.max(0, (c.stocks / worst) * 100)}%` } as CSSProperties} />
                                    <b>{signedPct(c.stocks)}</b>
                                    <span>Tvoja stratégia</span>
                                    <i className="ist-bar ist-bar--red" style={{ "--w": `${Math.max(0, (c.strategy / worst) * 100)}%` } as CSSProperties} />
                                    <b>{signedPct(c.strategy)}</b>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <button type="button" className="ist-collapse ist-collapse--result" aria-expanded={sourcesOpen} onClick={() => setSourcesOpen((o) => !o)}>
                    <span>Odkiaľ sú dáta a ako počítam</span>
                    <span className="ist-collapse-meta">{sourcesOpen ? "skryť" : "zobraziť"}</span>
                    <ChevronDown className={`h-4 w-4 ist-chev${sourcesOpen ? " is-open" : ""}`} aria-hidden />
                  </button>
                  {sourcesOpen ? (
                    <div className="ist-sources">
                      <h4>Dáta v súbore „{SETS[A.set].label}“</h4>
                      <ul>
                        <li><b>Akcie:</b> {SETS[A.set].stock}. Denný celkový výnos vrátane dividend. Zdroj: Kenneth R. French Data Library (Dartmouth College){A.set === "eur" ? ", kurz dolára k euru podľa Európskej centrálnej banky" : ""}.</li>
                        <li>
                          <b>Dlhopisy:</b> {SETS[A.set].bond}. Denný výnos vrátane kupónov je dopočítaný z úradných výnosov do splatnosti. Zdroj:{" "}
                          {A.set === "eur" ? "Deutsche Bundesbank, výnosová krivka štátnych dlhopisov" : "Federal Reserve, tabuľka H.15"}.
                        </li>
                        <li><b>Peňažný fond:</b> {SETS[A.set].cash}. Zdroj: {A.set === "eur" ? "Európska centrálna banka" : "Kenneth R. French Data Library"}.</li>
                        <li><b>Inflácia:</b> {SETS[A.set].inflation}. Zdroj: {A.set === "eur" ? "Eurostat cez Európsku centrálnu banku" : "U.S. Bureau of Labor Statistics"}.</li>
                      </ul>
                      <h4>Ako počítam</h4>
                      <ul>
                        <li>Čas investície znamená posledných N rokov dát; dátumy Od a Do môžeš nastaviť aj na presný deň. Prvý vklad investujem v deň začiatku, mesačné vklady v rovnaký deň každého mesiaca, ak sa neobchodovalo, v najbližší obchodný deň.</li>
                        <li>Brzda určuje zloženie portfólia pre každý rok investovania. Nový vklad rozdelím podľa zloženia daného roka a celé portfólio naň vraciam {A.rebalance === "monthly" ? "každý mesiac" : "raz ročne, vždy na výročie začiatku"}.</li>
                        <li><b>Výnos p. a.</b> meria samotnú stratégiu bez vplyvu toho, kedy prišli vklady. Zisk v roku = zmena hodnoty mínus vklady v tom roku.</li>
                        <li>Ročné náklady strhávam denne z hodnoty. Reálne výnosy sú po odpočítaní inflácie, sumy sú v cenách z posledného dňa obdobia.</li>
                      </ul>
                      <h4>Na čo si dať pozor</h4>
                      <ul>
                        <li>Dáta opisujú celé trhy, nie konkrétny fond. Fond na užší index (napríklad len veľké firmy) alebo iný dlhopisový fond sa môže v jednotlivom roku líšiť o niekoľko percentuálnych bodov.</li>
                        <li>Výnosy sú pred poplatkami fondov a pred zdanením dividend. Výsledok po nákladoch uvidíš, keď v ďalších nastaveniach zadáš ročné náklady.</li>
                        <li>Výpočet neráta s daňou zo zisku ani s poplatkami za nákup a predaj. Posledný deň dát je {dateLong(ds.day[ds.n - 1])}.</li>
                      </ul>
                      <button type="button" className="ist-add" onClick={downloadCsv}>
                        <Download className="h-4 w-4" strokeWidth={2} aria-hidden /> Stiahnuť denný priebeh (CSV)
                      </button>
                    </div>
                  ) : null}

                  <div className="ist-cta">
                    <p>Chceš stratégiu postavenú na tvojich cieľoch, príjme a čase, ktorý máš? Prejdeme ju spolu na tvojich číslach.</p>
                    <a className="btn-primary ist-cta-btn" href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" data-umami-event="click_konzultacia" data-umami-event-section="investicna-strategia" data-umami-event-slug="investicna-strategia">
                      {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </a>
                  </div>
                </>
              )}
            </section>
          </div>

          <p className="calc-note calc-note--center ist-foot">
            Nástroj ukazuje, čo sa stalo v minulosti. Minulé výnosy nie sú spoľahlivým ukazovateľom budúcich výsledkov a hodnota investície môže aj
            klesnúť. Výnosy sú pred poplatkami a daňami, kým nezadáš ročné náklady. Nejde o investičné odporúčanie. Nastavenie sa ukladá iba
            v tvojom prehliadači.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};

/** Vodorovné pruhy s ročným zhodnotením; dĺžka podľa najväčšej hodnoty, záporné hodnoty idú doľava od nuly. */
const HBars = ({ rows }: { rows: { label: string; value: number; cls: string }[] }) => {
  const max = Math.max(0.01, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="ist-hbars" role="img" aria-label={rows.map((r) => `${r.label} ${pct(r.value, 2)}`).join(", ")}>
      {rows.map((r) => (
        <div key={r.label} className="ist-hbar">
          <span className="ist-hbar-label">{r.label}</span>
          <span className="ist-hbar-track">
            <i className={`ist-bar ${r.value < 0 ? "ist-bar--red" : r.cls}${r.value < 0 ? " is-negative" : ""}`} style={{ "--w": `${(Math.abs(r.value) / max) * 100}%` } as CSSProperties} />
          </span>
          <b className={`ist-hbar-value${r.value < 0 ? " is-loss" : ""}`}>{pct(r.value, 2)}</b>
        </div>
      ))}
    </div>
  );
};

export default InvesticnaStrategiaCalculator;
