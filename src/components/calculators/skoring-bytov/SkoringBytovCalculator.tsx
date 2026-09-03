import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import "../shared/calculator-toolbar.css";
import "../shared/calc-ui.css";
import "./skoring-bytov.css";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";
import {
  AVG,
  CRIT,
  DEFAULT_BYT,
  DISP,
  FORM_SECTIONS,
  KRAJE,
  MAXB,
  MESTA,
  OPR_OPTIONS,
  RENT_STAV_K,
  STAV,
  STORAGE_KEY,
  TIERN,
  type Byt,
  type FieldDef,
  type OprKey,
} from "./skoringData";
import { f1, fmt, insights, njgOf, popSeries, profil, scoreDeep, scoreMesto, validateByt, verdikt, type Result } from "./skoringModel";
import { MAP_LABELS, MAP_PATHS } from "../shared/slovakiaMap";

/* ------------------------------------------------------------------ kroky */

type StepDef = { id: string; title: string; short: string; keys: (keyof Byt)[]; lead: string };

const STEPS: StepDef[] = [
  { id: "byt", title: "Byt a čísla", short: "Byt", keys: ["n", "mesto", "disp", "stav", "cena", "m2", "najom", "mn", "rn"], lead: "Odpíš čísla z inzerátu. Skóre sa objaví hneď, ako zadáš cenu, výmeru a nájom." },
  { id: "lokalita", title: "Lokalita a trh", short: "Lokalita", keys: ["dopyt", "vyb", "mhd", "rozvoj", "rychlost", "obsad"], lead: "Lokalita je 25 bodov zo 100. Buď úprimný, skóre je pre teba, nie pre predávajúceho." },
  { id: "dom", title: "Dom a právny stav", short: "Dom", keys: ["lv", "fond", "era", "opr", "planOprava", "vytah", "park"], lead: "Tu sa skrývajú najdrahšie prekvapenia: ťarchy na liste vlastníctva a opravy domu." },
  { id: "komfort", title: "Komfort a exit", short: "Komfort", keys: ["podl", "balk", "inv", "orient", "klima", "kur", "likvidita", "horizont"], lead: "Detaily, ktoré rozhodujú o rýchlosti prenájmu a o tom, ako ľahko byt raz predáš." },
];

const FIELD_BY_KEY: Partial<Record<keyof Byt, FieldDef>> = Object.fromEntries(FORM_SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f]));

const loadDb = (): Byt[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? (JSON.parse(raw) as Byt[]) : [];
    return Array.isArray(arr) ? arr.map((b) => ({ ...DEFAULT_BYT, ...b, mesto: MESTA[b.mesto] ? b.mesto : "ine20", opr: Array.isArray(b.opr) ? b.opr : [] })) : [];
  } catch {
    return [];
  }
};

const essentialsOk = (b: Byt) => b.cena > 0 && b.m2 > 0 && b.najom > 0;

/** Plynulé dobehnutie čísla k cieľovej hodnote (skóre „žije“ pri každej zmene). */
function useCountUp(target: number, ms = 650): number {
  const [v, setV] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = Math.round(from + (target - from) * e);
      setV(cur);
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

const STEP_TONES = ["sand", "mint", "ink", "forest"] as const;

/** Mini mapa Slovenska so zvýrazneným krajom a bodom mesta. */
const MiniMap = ({ kr, city }: { kr: string; city: string }) => {
  const key = kr.toUpperCase();
  const pos = MAP_LABELS[key];
  return (
    <svg viewBox="0 0 1000 498" className="sb-map" role="img" aria-label={`Mapa: ${city}`}>
      {Object.entries(MAP_PATHS).map(([k, d]) => (
        <path key={k} d={d} className={`sb-map-kraj${k === key ? " is-active" : ""}`} />
      ))}
      {pos ? (
        <g>
          <circle cx={pos.x} cy={pos.y} r={26} className="sb-map-pulse" />
          <circle cx={pos.x} cy={pos.y} r={11} className="sb-map-dot" />
        </g>
      ) : null}
    </svg>
  );
};

/* ------------------------------------------------------------------ páky: čo by zmenilo skóre */

type Lever = { id: string; label: string; delta: number };

function levers(b: Byt, r: Result): Lever[] {
  const cands: { id: string; label: string; when: boolean; mod: Partial<Byt> }[] = [
    { id: "fair", label: `Vyjednaj cenu na ${fmt(r.fair)} (férová pre benchmark výnos)`, when: r.fair > 0 && b.cena > r.fair * 1.02, mod: { cena: Math.round(r.fair) } },
    { id: "cena5", label: "Vyjednaj 5 % z ceny", when: !(r.fair > 0 && b.cena > r.fair * 1.02), mod: { cena: Math.round(b.cena * 0.95) } },
    { id: "lv", label: "Over list vlastníctva na katastri (čistý)", when: b.lv === "neviem", mod: { lv: "cisty" } },
    { id: "najom", label: `Nájom na typickú úroveň ${fmt(r.rentB)} (ak je inzerát optimistický)`, when: r.rr > 1.1, mod: { najom: Math.round(r.rentB) } },
    { id: "obsad", label: "Počítaj s 11 mesiacmi obsadenosti", when: b.obsad === 12, mod: { obsad: 11 } },
    { id: "fond", label: "Zisti stav fondu opráv (primeraný)", when: b.fond === "neviem", mod: { fond: "primerany" } },
    { id: "klima", label: "Doplň klimatizáciu (~1 500 €)", when: b.orient === "slnecna" && b.klima !== "ano", mod: { klima: "ano" } },
    { id: "horizont", label: "Drž byt aspoň 5 rokov", when: b.horizont === "menej", mod: { horizont: "5plus" } },
  ];
  return cands
    .filter((c) => c.when)
    .map((c) => ({ id: c.id, label: c.label, delta: scoreDeep({ ...b, ...c.mod }).total - r.total }))
    .filter((l) => l.delta !== 0)
    .sort((a, b2) => b2.delta - a.delta)
    .slice(0, 4);
}

/* ------------------------------------------------------------------ pomocné prvky */

const Ring = ({ value, size = 56, stroke = 6, color, label }: { value: number; size?: number; stroke?: number; color: string; label?: string }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="sb-ring" style={{ width: size, height: size }} role="img" aria-label={`Skóre ${value} zo 100`}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.2,0.7,0.2,1)" }} />
      </svg>
      <span style={{ color, fontSize: size * 0.32 }}>{value}</span>
      {label ? <small>{label}</small> : null}
    </div>
  );
};

const verdictColor = (c: "g" | "y" | "r") => (c === "g" ? "#2a6647" : c === "y" ? "#a99d7e" : "#ab4132");
/** Farby kruhu na tmavom hnedom paneli živej analýzy (zlatá len na tmavej). */
const verdictColorDark = (c: "g" | "y" | "r") => (c === "g" ? "#d9b15c" : c === "y" ? "#d9b15c" : "#e9a27e");

const Field = ({ def, value, onChange, error }: { def: FieldDef; value: Byt[keyof Byt]; onChange: (v: Byt[keyof Byt]) => void; error?: boolean }) => {
  const id = `sb-${def.key}`;
  if (def.kind === "checks") {
    const arr = (value as OprKey[]) ?? [];
    return (
      <div className="sb-field sb-field--wide">
        <span className="calc-label">{def.label}</span>
        <div className="sb-checks" role="group" aria-label={def.label}>
          {OPR_OPTIONS.map((o) => {
            const on = arr.includes(o.value);
            return (
              <button key={o.value} type="button" className="sb-check" aria-pressed={on} onClick={() => onChange((on ? arr.filter((x) => x !== o.value) : [...arr, o.value]) as Byt[keyof Byt])}>
                <Check className="h-3.5 w-3.5" aria-hidden /> {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (def.kind === "select") {
    const isCity = def.key === "mesto";
    const numeric = typeof value === "number";
    // Krátke voľby (do 4 možností, krátke texty) ako segment, inak select
    const opts = def.options ?? [];
    const asSegment = !isCity && opts.length > 0 && opts.length <= 4 && opts.every((o) => o.label.length <= 26);
    return (
      <div className={`sb-field${def.wide ? " sb-field--wide" : ""}`}>
        <label className="calc-label" htmlFor={id}>{def.label}{def.hint ? <span className="calc-label-hint">{def.hint}</span> : null}</label>
        {asSegment ? (
          <div className="sb-seg" role="group" aria-label={def.label}>
            {opts.map((o) => (
              <button key={String(o.value)} type="button" aria-pressed={String(value) === String(o.value)} onClick={() => onChange((numeric ? Number(o.value) : String(o.value)) as Byt[keyof Byt])}>{o.label}</button>
            ))}
          </div>
        ) : (
          <select id={id} className="calc-input sb-select" value={String(value)} onChange={(e) => onChange((numeric ? Number(e.target.value) : e.target.value) as Byt[keyof Byt])}>
            {isCity
              ? Object.entries(KRAJE).map(([kr, name]) => (
                  <optgroup key={kr} label={name}>
                    {Object.entries(MESTA).filter(([, m]) => m.kr === kr).map(([k, m]) => <option key={k} value={k}>{m.n}</option>)}
                  </optgroup>
                ))
              : opts.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
          </select>
        )}
      </div>
    );
  }
  return (
    <div className={`sb-field${def.wide ? " sb-field--wide" : ""}${error ? " is-error" : ""}`}>
      <label className="calc-label" htmlFor={id}>{def.label}{def.hint ? <span className="calc-label-hint">{def.hint}</span> : null}</label>
      <div className={def.unit ? "calc-input-wrap" : undefined}>
        <input id={id} type={def.kind === "number" ? "number" : "text"} inputMode={def.kind === "number" ? "decimal" : undefined} className={`calc-input${def.unit ? " calc-input--unit" : ""}`} placeholder={def.placeholder} min={def.min} value={def.kind === "number" ? (value === 0 ? "" : String(value)) : String(value ?? "")} onChange={(e) => onChange((def.kind === "number" ? Number(e.target.value) || 0 : e.target.value) as Byt[keyof Byt])} />
        {def.unit ? <span className="calc-input-unit" aria-hidden>{def.unit}</span> : null}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ mesto (kompakt) */

const CityStrip = ({ mesto }: { mesto: string }) => {
  const M = MESTA[mesto] ?? MESTA.ine20;
  const ms = scoreMesto(M);
  const pts = popSeries(M);
  const vMin = Math.min(...pts.map((p) => p.v));
  const vMax = Math.max(...pts.map((p) => p.v));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${(4 + i * (92 / 9)).toFixed(1)},${(30 - ((p.v - vMin) / Math.max(1, vMax - vMin)) * 24).toFixed(1)}`).join(" ");
  const col = M.tr < 0 ? "#ab4132" : "#2a6647";
  return (
    <div className="sb-city">
      <MiniMap kr={M.kr} city={M.n} />
      <div className="sb-city-main">
        <div className="sb-city-name"><strong>{M.n}</strong><span className="sb-tag">{TIERN[M.t]}</span>{M.uni === 2 ? <span className="sb-tag">Univerzita</span> : M.uni === 1 ? <span className="sb-tag">Fakulta VŠ</span> : null}</div>
        <div className="sb-city-score"><span>Skóre mesta</span><b>{Math.round(ms)}</b><span>/15</span><span className="sb-city-bar"><span style={{ width: `${(ms / 15) * 100}%` }} /></span></div>
      </div>
      <div className="sb-city-stats">
        <div><svg viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden><path d={line} fill="none" stroke={col} strokeWidth={2} vectorEffect="non-scaling-stroke" /></svg><span className="sb-city-label">Obyvatelia</span><b>~{M.pop.toLocaleString("sk-SK")}</b><small style={{ color: col }}>{M.tr >= 0 ? "+" : ""}{M.tr} % / 10 r.</small></div>
        <div><span className="sb-city-label">Nezamestn. okresu</span><b style={{ color: M.nez >= 9 ? "#ab4132" : undefined }}>~{f1(M.nez)} %</b><small>priemer miest ~{f1(AVG.nez)} %</small></div>
        <div><span className="sb-city-label">Nájom 2-izb.</span><b>~{Math.round(M.nj)} €</b><small>+{njgOf(M)} %/rok</small></div>
        <div><span className="sb-city-label">Benchmark</span><b>~{M.m2.toLocaleString("sk-SK")} €/m²</b><small>výnos ~{f1(M.y)} %</small></div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ živá analýza */

const Analysis = ({ b, r, compact = false }: { b: Byt; r: Result; compact?: boolean }) => {
  const v = verdikt(r.total);
  const pr = profil(r);
  const notes = insights(b, r);
  const lv = levers(b, r);
  const [showAll, setShowAll] = useState(false);
  const color = verdictColorDark(v.c);
  const shown = useCountUp(r.total);
  const crits = r.flags.filter((f) => f.sev === "crit");
  const warns = r.flags.filter((f) => f.sev === "warn");
  const visibleNotes = showAll ? notes : notes.slice(0, 2);
  return (
    <div className="sb-analysis">
      <div className={`sb-analysis-top sb-tone-${v.c}`}>
        <Ring value={shown} size={compact ? 72 : 104} stroke={compact ? 7 : 9} color={color} label="zo 100" />
        <div className="sb-analysis-verdict">
          <span className={`sb-verdict sb-v-${v.c}`}>{v.e} {v.t}</span>
          <span className={`sb-profile sb-p-${pr.c || "n"}`}>{pr.e} {pr.n}</span>
          {r.capped ? <span className="sb-capban">Kritická výstraha stropuje skóre na 54. Najprv vyrieš červené body.</span> : null}
        </div>
      </div>

      <div className="sb-kpis">
        <div className={`sb-kpi ${r.yRatio >= 1.1 ? "is-good" : r.yRatio >= 0.9 ? "is-mid" : "is-bad"}`}><span>Čistý výnos</span><b>{f1(r.y)} %</b><small>trh {r.M.n} ~{f1(r.M.y)} %</small></div>
        <div className={`sb-kpi ${r.d <= -0.05 ? "is-good" : r.d < 0.05 ? "is-mid" : "is-bad"}`}><span>Cena za m²</span><b>{fmt(r.m2c)}</b><small>{r.d >= 0 ? "+" : ""}{Math.round(r.d * 100)} % vs. benchmark ~{fmt(r.benchM2)}</small></div>
        <div className={`sb-kpi ${r.rr <= 1.1 ? "is-good" : r.rr <= 1.25 ? "is-mid" : "is-bad"}`}><span>Nájom vs. typický</span><b>{r.rr >= 1 ? "+" : ""}{Math.round((r.rr - 1) * 100)} %</b><small>typický ~{fmt(r.rentB)} / mes.</small></div>
        <div className="sb-kpi is-mid"><span>Férová cena</span><b>{r.fair > 0 ? fmt(r.fair) : "—"}</b><small>{r.fair > 0 ? `${Math.round((r.fair / b.cena - 1) * 100)} % od ceny` : "benchmark výnos"}</small></div>
      </div>

      {lv.length ? (
        <div className="sb-levers">
          <p className="sb-block-title">Čo by zmenilo skóre</p>
          <ul>
            {lv.map((l) => (
              <li key={l.id}><span>{l.label}</span><b className={l.delta > 0 ? "is-up" : "is-down"}>{l.delta > 0 ? "+" : ""}{l.delta} b.</b></li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="sb-crits">
        <p className="sb-block-title">Kritériá</p>
        <ul>
          {CRIT.map((c) => {
            const pct = (r.p[c.key] / r.max[c.key]) * 100;
            return (
              <li key={c.key}><span className="sb-crit-label">{c.label}</span><span className="sb-crit-track"><span style={{ width: `${pct}%`, background: pct >= 70 ? "#2a6647" : pct >= 40 ? "#a99d7e" : "#ab4132" }} /></span><span className="sb-crit-val">{r.p[c.key]}/{r.max[c.key]}</span></li>
            );
          })}
        </ul>
      </div>

      {crits.length || warns.length ? (
        <div className="sb-flags">
          <p className="sb-block-title">Výstrahy <em>{r.flags.length}</em></p>
          <ul>
            {crits.map((f, i) => <li key={`c${i}`} className="is-crit"><span dangerouslySetInnerHTML={{ __html: f.t }} /></li>)}
            {(showAll ? warns : warns.slice(0, 2)).map((f, i) => <li key={`w${i}`} className="is-warn"><span dangerouslySetInnerHTML={{ __html: f.t }} /></li>)}
          </ul>
        </div>
      ) : null}

      <div className="sb-notes">
        <p className="sb-block-title">Postrehy</p>
        <ul>
          {visibleNotes.map((n, i) => <li key={i} className={n.cls ? `is-${n.cls}` : ""}><span dangerouslySetInnerHTML={{ __html: n.t }} /></li>)}
        </ul>
        {(notes.length > 2 || warns.length > 2) ? (
          <button type="button" className="sb-more" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Skryť detail" : `Zobraziť všetko (${notes.length + warns.length})`} <ChevronDown className="h-3.5 w-3.5" style={{ transform: showAll ? "rotate(180deg)" : undefined }} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ komponent */

const SkoringBytovCalculator = () => {
  const [db, setDb] = useState<Byt[]>(loadDb);
  const [form, setForm] = useState<Byt>(DEFAULT_BYT);
  const [editId, setEditId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [errField, setErrField] = useState<"cena" | "m2" | "najom" | null>(null);
  const [editorOpen, setEditorOpen] = useState<boolean>(() => loadDb().length === 0);
  const editorRef = useRef<HTMLElement>(null);
  const savedRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* súkromný režim */
    }
  }, [db]);

  const results = useMemo(() => db.map((b) => ({ b, r: scoreDeep(b) })), [db]);
  const best = results.length >= 2 ? Math.max(...results.map((x) => x.r.total)) : null;
  const live = useMemo(() => (essentialsOk(form) ? scoreDeep(form) : null), [form]);
  const setF = (k: keyof Byt, v: Byt[keyof Byt]) => setForm((f) => ({ ...f, [k]: v }));

  // Inline benchmarky pre krok 1
  const M = MESTA[form.mesto] ?? MESTA.ine20;
  const benchM2 = M.m2 * DISP[form.disp].k * STAV[form.stav].k;
  const rentB = M.nj * DISP[form.disp].rk * RENT_STAV_K[form.stav];

  const openNew = () => {
    setForm({ ...DEFAULT_BYT, mesto: form.mesto });
    setEditId(null);
    setStep(0);
    setErrField(null);
    setEditorOpen(true);
    window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const save = () => {
    const val = validateByt(form);
    if (!val.ok) {
      setErrField(val.field ?? null);
      setStep(0);
      window.setTimeout(() => document.getElementById(`sb-${val.field}`)?.focus(), 50);
      return;
    }
    setErrField(null);
    if (editId) setDb((d) => d.map((x) => (x.id === editId ? { ...form, id: editId } : x)));
    else {
      if (db.length >= MAXB) {
        window.alert(`Maximum je ${MAXB} bytov. Zmaž niektorý.`);
        return;
      }
      setDb((d) => [...d, { ...form, id: Date.now().toString(36), n: form.n.trim() || `Byt ${d.length + 1}` }]);
    }
    setEditorOpen(false);
    setEditId(null);
    window.setTimeout(() => savedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const edit = (b: Byt) => {
    setForm({ ...DEFAULT_BYT, ...b });
    setEditId(b.id);
    setStep(0);
    setErrField(null);
    setEditorOpen(true);
    window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const del = (id: string) => {
    if (!window.confirm("Zmazať tento byt z porovnania?")) return;
    setDb((d) => d.filter((x) => x.id !== id));
    if (editId === id) {
      setEditId(null);
      setEditorOpen(false);
    }
  };

  // Prečo víťaz vyhráva
  const winnerNote = useMemo(() => {
    if (results.length < 2 || best === null) return null;
    const sorted = [...results].sort((a, b) => b.r.total - a.r.total);
    const [w, s] = sorted;
    if (w.r.total === s.r.total) return `${w.b.n} a ${s.b.n} majú rovnaké skóre. Rozhodni podľa výstrah a výnosu.`;
    const diffs = CRIT.map((c) => ({ c, d: w.r.p[c.key] / w.r.max[c.key] - s.r.p[c.key] / s.r.max[c.key] })).sort((a, b) => b.d - a.d);
    const top = diffs[0];
    const weak = diffs[diffs.length - 1];
    return `${w.b.n} vedie o ${w.r.total - s.r.total} b., najmä vďaka kritériu „${top.c.label}“.${weak.d < -0.1 ? ` ${s.b.n} je lepší v „${weak.c.label}“.` : ""}`;
  }, [results, best]);

  const current = STEPS[step];
  const stepDone = (s: StepDef) => (s.id === "byt" ? essentialsOk(form) : true);

  return (
    <div id="sb-root" className="calc-ui sb w-full font-sans text-foreground">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={{ "--i": 0 } as React.CSSProperties}>
            <span className="calc-eyebrow">Skóring investičných bytov</span>
          </header>

          <section className="sb-hero calc-reveal" style={{ "--i": 1 } as React.CSSProperties}>
            <div className="sb-hero-main">
              <p className="sb-hero-kicker">Až 6 bytov · 10 kritérií · 72 miest</p>
              <h2 className="sb-hero-title">Ktorý byt dáva zmysel? Rozhodnú čísla, <em>nie pocit.</em></h2>
              <p className="sb-hero-lede">Zadaj byty, ktoré zvažuješ. Každý dostane skóre 0 až 100, výstrahy, férovú cenu a porovnanie s dátami slovenských miest. Skóre vidíš hneď po troch číslach.</p>
              <p className="sb-hero-pill">Benchmark cien: 1Q 2026 · NBS + Realitná únia SR · Dáta miest: ŠÚ SR + ÚPSVaR</p>
            </div>
            <div className="sb-hero-actions">
              {!editorOpen ? <button type="button" className="btn-primary sb-btn" onClick={openNew}><Plus className="h-4 w-4" aria-hidden /> Pridať byt</button> : null}
              <button type="button" className="sb-print" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden /> PDF</button>
            </div>
          </section>

          {/* ------------------------------------------------------------ Editor + živá analýza */}
          {editorOpen ? (
            <section ref={editorRef} className="sb-workspace calc-reveal" style={{ "--i": 2 } as React.CSSProperties} aria-label={editId ? "Upraviť byt" : "Pridať byt"}>
              <div className="sb-editor">
                <div className="sb-editor-head">
                  <h3 className="calc-panel-title">{editId ? "Upraviť byt" : "Nový byt"}</h3>
                  <span className="calc-panel-sub">{db.length} / {MAXB} bytov</span>
                </div>
                <ol className="sb-steps" aria-label="Kroky">
                  {STEPS.map((s, i) => (
                    <li key={s.id}>
                      <button type="button" className={`sb-step sb-step--${STEP_TONES[i]}${i === step ? " is-current" : ""}${i < step || stepDone(s) && i !== step ? " is-done" : ""}`} aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)}>
                        <span className="sb-step-n">{i < step ? <Check className="h-3 w-3" aria-hidden /> : i + 1}</span>
                        <span className="sb-step-t">{s.short}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="sb-lead">{current.lead}</p>
                <h4 className="sb-step-title">{current.title}</h4>

                <div className="sb-grid" key={current.id}>
                  {current.keys.map((k) => {
                    const def = FIELD_BY_KEY[k];
                    if (!def) return null;
                    return (
                      <Fragment key={k}>
                        <div className={`sb-cell${def.wide || def.kind === "checks" ? " sb-cell--wide" : ""}`}>
                          <Field def={def} value={form[k]} onChange={(v) => setF(k, v)} error={errField === k} />
                          {k === "cena" ? <p className="sb-bench">Benchmark segmentu ~{fmt(benchM2)}/m²{form.m2 > 0 ? ` → ~${fmt(benchM2 * form.m2)} za ${form.m2} m²` : ""}</p> : null}
                          {k === "najom" ? <p className="sb-bench">Typický nájom pre tento segment v {M.n} ~{fmt(rentB)} / mes. bez energií</p> : null}
                        </div>
                        {k === "mesto" ? <div className="sb-cell sb-cell--wide"><CityStrip mesto={form.mesto} /></div> : null}
                      </Fragment>
                    );
                  })}
                </div>
                {errField ? <p className="sb-error">Doplň prosím {errField === "cena" ? "cenu bytu" : errField === "m2" ? "výmeru" : "mesačný nájom"}.</p> : null}

                <div className="sb-editor-actions">
                  <div className="sb-editor-nav">
                    {step > 0 ? <button type="button" className="sb-btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" aria-hidden /> Späť</button> : <button type="button" className="sb-btn-ghost" onClick={() => setEditorOpen(false)}>Zrušiť</button>}
                    {step < STEPS.length - 1 ? (
                      <button type="button" className="btn-primary sb-btn" onClick={() => setStep(step + 1)}>Ďalej <ArrowRight className="h-4 w-4" aria-hidden /></button>
                    ) : (
                      <button type="button" className="btn-primary sb-btn" onClick={save}>{editId ? "Uložiť zmeny" : "Uložiť do porovnania"} <Check className="h-4 w-4" aria-hidden /></button>
                    )}
                  </div>
                  {step < STEPS.length - 1 && live ? <button type="button" className="sb-save-now" onClick={save}>Uložiť už teraz, zvyšok doplním neskôr</button> : null}
                </div>
              </div>

              <aside className="sb-live" aria-label="Živá analýza">
                {live ? (
                  <Analysis b={form} r={live} />
                ) : (
                  <div className="sb-live-empty">
                    <Ring value={0} size={104} stroke={9} color="rgba(0,0,0,0.15)" label="zo 100" />
                    <p><b>Skóre sa objaví hneď,</b> ako zadáš cenu, výmeru a mesačný nájom. Ostatné kroky ho spresnia.</p>
                  </div>
                )}
              </aside>
            </section>
          ) : null}

          {/* ------------------------------------------------------------ Uložené byty */}
          <section ref={savedRef} className="sb-saved calc-reveal" style={{ "--i": 3 } as React.CSSProperties} aria-label="Porovnávané byty">
            <div className="calc-chart-head sb-saved-head">
              <div>
                <h2 className="calc-panel-title">Tvoje porovnanie <em>{db.length}/{MAXB}</em></h2>
                {winnerNote ? <p className="calc-panel-sub sb-winner-note">{winnerNote}</p> : null}
              </div>
              {db.length > 0 && db.length < MAXB && !editorOpen ? <button type="button" className="sb-btn-ghost" onClick={openNew}><Plus className="h-4 w-4" aria-hidden /> Pridať ďalší byt</button> : null}
            </div>
            {results.length === 0 ? (
              <div className="sb-empty"><span aria-hidden>🏢</span><p>Zatiaľ žiadne byty. Otvor si inzerát, odpíš čísla a o dve minúty vidíš skóre.</p></div>
            ) : (
              <div className="sb-cards">
                {results.map(({ b, r }) => {
                  const v = verdikt(r.total);
                  const win = best !== null && r.total === best;
                  return (
                    <article key={b.id} className={`sb-card${win ? " is-win" : ""}${editId === b.id ? " is-editing" : ""}`}>
                      {win ? <span className="sb-winb">Najlepšia voľba</span> : null}
                      <button type="button" className="sb-card-main" onClick={() => edit(b)} title="Otvoriť analýzu">
                        <Ring value={r.total} size={56} stroke={6} color={verdictColor(v.c)} />
                        <span className="sb-card-title"><strong>{b.n}</strong><small>{r.M.n} · {r.D.n} · {fmt(b.cena)}</small></span>
                      </button>
                      <p className={`sb-verdict sb-v-${v.c}`}>{v.e} {v.t}</p>
                      <div className="sb-card-stats">
                        <span><b>{f1(r.y)} %</b><small>čistý výnos</small></span>
                        <span><b>{r.d >= 0 ? "+" : ""}{Math.round(r.d * 100)} %</b><small>vs. trh €/m²</small></span>
                        <span><b className={r.flags.some((f) => f.sev === "crit") ? "is-crit" : ""}>{r.flags.length}</b><small>výstrah</small></span>
                      </div>
                      <div className="sb-card-actions">
                        <button type="button" onClick={() => edit(b)}><Pencil className="h-3.5 w-3.5" aria-hidden /> Upraviť</button>
                        <button type="button" onClick={() => del(b.id)} aria-label="Zmazať"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* ------------------------------------------------------------ Porovnanie */}
          {results.length >= 2 ? (
            <section className="calc-panel sb-table-panel" aria-label="Porovnanie">
              <div className="calc-chart-head">
                <h2 className="calc-panel-title">Porovnanie kritérií</h2>
                <span className="calc-panel-sub">% naplnenia kritéria · najlepšia hodnota zvýraznená</span>
              </div>
              <div className="sb-table-wrap">
                <table className="sb-table">
                  <thead><tr><th>Kritérium</th>{results.map(({ b, r }) => <th key={b.id} className={r.total === best ? "is-win" : ""}>{b.n}</th>)}</tr></thead>
                  <tbody>
                    <tr className="sb-tot"><td>Skóre spolu</td>{results.map(({ b, r }) => <td key={b.id} className={r.total === best ? "is-win" : ""}>{r.total}</td>)}</tr>
                    {CRIT.map((c) => {
                      const vals = results.map(({ r }) => Math.round((r.p[c.key] / r.max[c.key]) * 100));
                      const mx = Math.max(...vals);
                      return <tr key={c.key}><td>{c.label}</td>{vals.map((v, i) => <td key={i} className={v === mx ? "is-win" : ""}>{v} %</td>)}</tr>;
                    })}
                    <tr><td>Výstrahy</td>{results.map(({ b, r }) => <td key={b.id}>{r.flags.length}</td>)}</tr>
                    <tr><td>Čistý výnos p. a.</td>{results.map(({ b, r }) => <td key={b.id}>{f1(r.y)} %</td>)}</tr>
                    <tr><td>€/m² vs. benchmark</td>{results.map(({ b, r }) => <td key={b.id}>{r.d >= 0 ? "+" : ""}{Math.round(r.d * 100)} %</td>)}</tr>
                    <tr><td>Férová cena</td>{results.map(({ b, r }) => <td key={b.id}>{r.fair > 0 ? fmt(r.fair) : "—"}</td>)}</tr>
                  </tbody>
                </table>
              </div>
              <p className="calc-stat-sub mt-3">Výnos sa počíta s tebou zvolenou obsadenosťou. Férová cena = cena, pri ktorej byt zarába benchmark výnos svojho mesta.</p>
            </section>
          ) : null}

          {results.length ? (
            <section className="sb-cta calc-reveal" style={{ "--i": 4 } as React.CSSProperties} aria-label="Ďalší krok">
              <div>
                <h2 className="sb-cta-title">Vybral si byt?</h2>
                <p className="sb-cta-text">Skóre hodnotí byt a lokalitu, nepovie ti, ako kúpu financovať a poskladať. Hypotéka, štruktúra a cashflow sú stratégia. Preber to s Ivanom predtým, než podpíšeš rezervačku.</p>
              </div>
              <a href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" className="btn-primary sb-btn" data-umami-event="click_konzultacia" data-umami-event-section="skoring-bytov">{BONUSY_CTA_LABEL}</a>
            </section>
          ) : null}

          <p className="calc-note calc-note--center mt-5 md:mt-6">
            Skóring má informatívny charakter a nie je investičným odporúčaním. Benchmarky vychádzajú z verejných dát (NBS, Realitná únia SR, 1Q 2026) a priemerov, konkrétny byt vždy posudzuj individuálne. Dáta miest sú orientačné (ŠÚ SR 2024, ÚPSVaR 2026). Právny stav nehnuteľnosti si vždy over na katastri a s právnikom. Byty sa ukladajú iba v tvojom prehliadači.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SkoringBytovCalculator;
