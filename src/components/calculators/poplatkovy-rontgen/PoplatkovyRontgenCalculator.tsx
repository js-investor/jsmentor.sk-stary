import { useState, useMemo, useRef, useCallback } from "react";
import type { CSSProperties } from "react";
import { ArrowRight, Building2, Handshake, Info, Landmark, Lightbulb, Receipt, Scale, type LucideIcon } from "lucide-react";
import "../shared/calc-ui.css";
import "./poplatkovy-rontgen.css";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/* ── constants ── */
const G = 10;
const ETF_TER = 0.35;

const PROVIDERS = {
  banka:   { name: "🏦 Fondy banky",                    ter: 2.5,  tax: true  },
  poradca: { name: "🤝 Fondy cez poradcu",              ter: 1.0,  tax: false },
  sprav:   { name: "🏢 Správcovská spoločnosť",         ter: 1.20, tax: false },
} as const;

type ProvKey = keyof typeof PROVIDERS;

/* ── vizuál: ikony lucide namiesto emoji, popisky kariet poskytovateľov ── */
const PROV_UI: Record<ProvKey, { Icon: LucideIcon; title: string; sub: string }> = {
  banka:   { Icon: Landmark,  title: "Cez banku",              sub: "podielové fondy banky" },
  poradca: { Icon: Handshake, title: "Cez poradcu",            sub: "sprostredkovateľ / agent" },
  sprav:   { Icon: Building2, title: "Správcovská spoločnosť", sub: "fondy priamo" },
};
/** Názov bez úvodného emoji (emoji ostáva v dátach, v UI používame ikony). */
const stripEmoji = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "");
const st = (i: number) => ({ "--i": i }) as CSSProperties;

/* ── simulation ── */
function sim(V0: number, M: number, years: number, g: number, ter: number) {
  const rm = Math.pow(1 + g / 100, 1 / 12) - 1;
  const fm = ter / 100 / 12;
  let v = V0;
  let fees = 0;
  const series: number[] = [v];
  for (let t = 1; t <= years * 12; t++) {
    v = (v + M) * (1 + rm);
    const f = v * fm;
    fees += f;
    v -= f;
    if (t % 12 === 0) series.push(v);
  }
  return { end: v, fees, series, invested: V0 + M * years * 12 };
}

function taxAdjSeries(series: number[], V0: number, M: number): number[] {
  return series.map((v, i) => {
    const inv = V0 + M * 12 * i;
    const gain = v - inv;
    return gain > 0 ? inv + gain * 0.81 : v;
  });
}

const fmt = (n: number) =>
  new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 0 }).format(Math.round(n)) + "\u00a0€";
const fmtPct = (n: number) =>
  n.toLocaleString("sk-SK", { maximumFractionDigits: 1 }) + "\u00a0%";

/* ── chart geometry ── */
const W = 1100;
const H = 420;
const PAD = { l: 110, r: 24, t: 16, b: 44 };

function cx(i: number, n: number) {
  return PAD.l + (W - PAD.l - PAD.r) * (i / (n - 1));
}
function cy(v: number, maxV: number) {
  return H - PAD.b - (H - PAD.t - PAD.b) * (v / maxV);
}
function toPath(series: number[], maxV: number): string {
  return series
    .map((v, i) => `${i === 0 ? "M" : "L"}${cx(i, series.length).toFixed(1)},${cy(v, maxV).toFixed(1)}`)
    .join("");
}
function toArea(sA: number[], sB: number[], maxV: number): string {
  const n = sA.length;
  let p = sA.map((v, i) => `${i === 0 ? "M" : "L"}${cx(i, n).toFixed(1)},${cy(v, maxV).toFixed(1)}`).join("");
  for (let i = n - 1; i >= 0; i--) {
    p += `L${cx(i, n).toFixed(1)},${cy(sB[i], maxV).toFixed(1)}`;
  }
  return p + "Z";
}

/* ═══════════════════════════════════════════════════════════ */
export default function PoplatkovyRontgenCalculator() {
  const [prov, setProv] = useState<ProvKey>("banka");
  const [v0, setV0] = useState(10000);
  const [monthly, setMonthly] = useState(200);
  const [years, setYears] = useState(20);

  /* tooltip state */
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  /* ── compute ── */
  const { sA, sB, E, F, diff, fEndNet, taxPaid, eaten } = useMemo(() => {
    const E = sim(v0, monthly, years, G, ETF_TER);
    const F = sim(v0, monthly, years, G, PROVIDERS[prov].ter);
    const taxOn = PROVIDERS[prov].tax;
    const sA = E.series;
    const sB = taxOn ? taxAdjSeries(F.series, v0, monthly) : F.series;
    const fEndNet = sB[sB.length - 1];
    const taxPaid = taxOn ? F.end - fEndNet : 0;
    const diff = E.end - fEndNet;
    const profitE = E.end - E.invested;
    const eaten = profitE > 0 ? (diff / profitE) * 100 : 0;
    return { sA, sB, E, F, diff, fEndNet, taxPaid, eaten };
  }, [prov, v0, monthly, years]);

  const maxV = Math.max(...sA) * 1.05;
  const taxOn = PROVIDERS[prov].tax;
  const n = sA.length;

  /* ── chart hover ── */
  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!chartWrapRef.current) return;
      const r = chartWrapRef.current.getBoundingClientRect();
      const svgW = r.width;
      const sx = (clientX - r.left) / svgW * W;
      const i = Math.max(0, Math.min(n - 1, Math.round((sx - PAD.l) / (W - PAD.l - PAD.r) * (n - 1))));
      setTip({ x: clientX - r.left, y: clientY - r.top, i });
    },
    [n]
  );

  const onLeave = useCallback(() => setTip(null), []);

  /* ── chart markup ── */
  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const v = (maxV * i) / 4;
    const yy = cy(v, maxV);
    return (
      <g key={i}>
        <line className="pr-ch-grid" x1={PAD.l} x2={W - PAD.r} y1={yy} y2={yy} />
        <text className="pr-ch-txt" x={PAD.l - 10} y={yy + 5} textAnchor="end">
          {Math.round(v / 1000)}k €
        </text>
      </g>
    );
  });

  const step = years <= 12 ? 2 : 5;
  const xLabels = Array.from({ length: n }, (_, i) => {
    if (i % step !== 0) return null;
    return (
      <text key={i} className="pr-ch-txt" x={cx(i, n)} y={H - 12} textAnchor="middle">
        {i === 0 ? "dnes" : `+${i}\u00a0r.`}
      </text>
    );
  });

  const cursorX = tip !== null ? cx(tip.i, n) : 0;
  const baseline = sB.map(() => 0);
  const sliderP = `${((years - 5) / 35) * 100}%`;

  return (
    <div className="section-container pr-outer">
      <div id="pr-root" className="calc-ui pr-root w-full font-sans">
        <div className="calc-body-shell">
          <div className="calc-page">
            <header className="calc-header calc-reveal" style={st(0)}>
              <span className="calc-eyebrow">Poplatkový röntgen</span>
              <h1 className="calc-title">
                Zisti, koľko ťa stoja<br />
                <em>skryté poplatky</em>
              </h1>
              <p className="calc-subtitle">
                Tri kliky a uvidíš, koľko z tvojho budúceho majetku potichu zmizne v poplatkoch.
                V eurách, nie v percentách.
              </p>
            </header>

            {/* ═══ VÝSLEDOK: jeden plochý hnedý panel ═══ */}
            <section className="pr-hero calc-reveal" aria-label="Výsledok röntgenu" style={st(1)}>
              <div className="pr-hero-main">
                <p className="pr-kicker">Výsledok röntgenu</p>
                <p className="pr-hero-value">
                  <span>{fmt(Math.abs(diff))}</span>
                  <em>o toľko prichádzaš za {years}&nbsp;rokov</em>
                </p>
                <p className="pr-hero-sub">
                  Pri vklade <strong>{fmt(v0)}</strong> + <strong>{fmt(monthly)}&nbsp;mesačne</strong> si
                  poplatky{taxOn ? " a daň" : ""} vezmú{" "}
                  <strong>{fmtPct(Math.max(0, eaten))} z tvojho možného zisku</strong>.
                </p>
              </div>

              {/* porovnanie: oddelené hairline, nie box v boxe */}
              <div className="pr-versus">
                <div className="pr-vcard">
                  <span className="pr-tag is-good">Lepšie riešenie</span>
                  <span className="pr-vcard-nm">Nízkonákladové ETF portfólio</span>
                  <span className="pr-vcard-big is-good">{fmt(E.end)}</span>
                  <span className="pr-vcard-sm">
                    poplatky spolu <strong>{fmt(E.fees)}</strong> · daň pri predaji{" "}
                    <strong>0&nbsp;€</strong> (časový test)
                    <br />
                    ročný poplatok: <strong>0,35&nbsp;%</strong>
                  </span>
                </div>
                <div className="pr-vcard">
                  <span className="pr-tag is-bad">Tvoje súčasné</span>
                  <span className="pr-vcard-nm">{stripEmoji(PROVIDERS[prov].name)}</span>
                  <span className="pr-vcard-big is-bad">{fmt(fEndNet)}</span>
                  <span className="pr-vcard-sm">
                    poplatky spolu <strong>{fmt(F.fees)}</strong>
                    {taxOn ? (
                      <>
                        {" "}· daň z výnosu 19&nbsp;% <strong>{fmt(taxPaid)}</strong>
                      </>
                    ) : null}
                    <br />
                    priemerný ročný poplatok:{" "}
                    <strong>
                      {PROVIDERS[prov].ter.toLocaleString("sk-SK", { minimumFractionDigits: 2 })}&nbsp;%
                    </strong>
                  </span>
                </div>
              </div>
            </section>

            <div className="pr-layout">
              {/* ═══ VSTUPY ═══ */}
              <aside className="pr-inputs calc-panel calc-reveal" aria-label="Vstupy" style={st(2)}>
                <h2 className="calc-panel-title pr-panel-title">Cez koho investuješ?</h2>

                {/* provider cards */}
                <div className="pr-provs" role="group" aria-label="Poskytovateľ">
                  {(Object.keys(PROVIDERS) as ProvKey[]).map((key) => {
                    const l = PROV_UI[key];
                    const active = prov === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`pr-prov${active ? " is-active" : ""}`}
                        aria-pressed={active}
                        onClick={() => setProv(key)}
                      >
                        <span className="pr-prov-icon"><l.Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                        <span className="pr-prov-body">
                          <strong>{l.title}</strong>
                          <span>{l.sub}</span>
                        </span>
                        <span className="pr-prov-ter">{PROVIDERS[key].ter.toLocaleString("sk-SK", { minimumFractionDigits: 1 })}&nbsp;% p.&nbsp;a.</span>
                      </button>
                    );
                  })}
                </div>

                {taxOn && (
                  <p className="pr-tax">
                    <Receipt className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    <span>
                      Pri fondoch banky ťa čaká pri predaji aj <strong>19&nbsp;% daň z výnosu</strong>.
                      V tvojom prípade: <b>{fmt(taxPaid)}</b>
                    </span>
                  </p>
                )}

                {/* inputs */}
                <div className="pr-group">
                  <div className="pr-field">
                    <label className="calc-label" htmlFor="pr-v0"><span>Koľko tam máš</span></label>
                    <div className="pr-lg-row">
                      <input
                        id="pr-v0"
                        type="number"
                        inputMode="decimal"
                        value={v0}
                        min={0}
                        step={500}
                        onChange={(e) => setV0(Math.max(0, +e.target.value || 0))}
                      />
                      <span className="pr-lg-unit" aria-hidden>€</span>
                    </div>
                  </div>
                  <div className="pr-field">
                    <label className="calc-label" htmlFor="pr-monthly"><span>Koľko tam dávaš mesačne</span></label>
                    <div className="pr-lg-row">
                      <input
                        id="pr-monthly"
                        type="number"
                        inputMode="decimal"
                        value={monthly}
                        min={0}
                        step={50}
                        onChange={(e) => setMonthly(Math.max(0, +e.target.value || 0))}
                      />
                      <span className="pr-lg-unit" aria-hidden>€ / mes.</span>
                    </div>
                  </div>
                  <div className="pr-field pr-field--range">
                    <div className="pr-range-head">
                      <label className="calc-label" htmlFor="pr-years"><span>Ako dlho ešte plánuješ investovať</span></label>
                      <output className="pr-range-val" htmlFor="pr-years">{years}&nbsp;rokov</output>
                    </div>
                    <input
                      id="pr-years"
                      type="range"
                      className="calc-slider"
                      style={{ "--p": sliderP } as CSSProperties}
                      min={5}
                      max={40}
                      step={1}
                      value={years}
                      onChange={(e) => setYears(+e.target.value)}
                    />
                    <div className="calc-slider-scale"><span>5 r.</span><span>20 r.</span><span>40 r.</span></div>
                  </div>
                </div>

                <div className="pr-notes">
                  <p>
                    <Info className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    <span>
                      <strong>Röntgen ráta ročné poplatky</strong> — tie, ktoré platíš každý rok z celej
                      hodnoty investície. Väčšina ľudí netuší, koľko ich investovanie ročne stojí, lebo
                      poplatok nikdy nevidia na výpise — strháva sa potichu z hodnoty fondu.
                    </span>
                  </p>
                  <p>
                    <Scale className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    <span>
                      Porovnávame dynamické (akciové) investície — všade rátame s historickým výnosom{" "}
                      <strong>10&nbsp;% ročne</strong>.
                    </span>
                  </p>
                </div>
              </aside>

              {/* ═══ GRAF ═══ */}
              <section className="pr-chart calc-panel calc-reveal" aria-label="Graf" style={st(3)}>
                <div className="pr-chart-head">
                  <h2 className="calc-panel-title">Ako sa nožnice roztvárajú</h2>
                  <span className="pr-chart-sub">prejdi prstom po grafe</span>
                </div>

                <div
                  className="pr-chart-wrap"
                  ref={chartWrapRef}
                  onMouseMove={(e) => onMove(e.clientX, e.clientY)}
                  onMouseLeave={onLeave}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    onMove(e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  onTouchEnd={onLeave}
                >
                  <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="pr-chart-svg"
                    aria-hidden
                  >
                    <defs>
                      <linearGradient id="pr-keep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="rgb(42,102,71)" stopOpacity="0.24" />
                        <stop offset="1" stopColor="rgb(42,102,71)" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {gridLines}
                    {xLabels}

                    {/* čo ti ostane: zelený gradient pod krivkou fondu */}
                    <path d={toArea(sB, baseline, maxV)} fill="url(#pr-keep)" />
                    {/* medzera medzi krivkami = strata (červený tint) */}
                    <path d={toArea(sA, sB, maxV)} fill="rgba(171,65,50,0.16)" />

                    {/* fund line */}
                    <path
                      d={toPath(sB, maxV)}
                      fill="none"
                      stroke="#ab4132"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {/* ETF line */}
                    <path
                      d={toPath(sA, maxV)}
                      fill="none"
                      stroke="#2a6647"
                      strokeWidth={3}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />

                    {/* hover cursor */}
                    {tip !== null && (
                      <>
                        <line
                          x1={cursorX}
                          x2={cursorX}
                          y1={PAD.t}
                          y2={H - PAD.b}
                          stroke="rgba(41,36,32,0.35)"
                          strokeWidth={1.5}
                          strokeDasharray="5 4"
                        />
                        <circle
                          cx={cursorX}
                          cy={cy(sA[tip.i], maxV)}
                          r={6}
                          fill="#2a6647"
                          stroke="#fffcf7"
                          strokeWidth={2.5}
                        />
                        <circle
                          cx={cursorX}
                          cy={cy(sB[tip.i], maxV)}
                          r={6}
                          fill="#ab4132"
                          stroke="#fffcf7"
                          strokeWidth={2.5}
                        />
                      </>
                    )}
                  </svg>

                  {/* tooltip */}
                  {tip !== null && (
                    <div
                      className="pr-tooltip"
                      style={{
                        left: tip.x > (chartWrapRef.current?.offsetWidth ?? 0) - 200
                          ? tip.x - 190
                          : tip.x + 16,
                        top: Math.max(0, tip.y - 70),
                      }}
                    >
                      <div className="pr-tt-d">
                        {tip.i === 0 ? "dnes" : `o ${tip.i} r.`}
                      </div>
                      <div className="pr-tt-green">● ETF: {fmt(sA[tip.i])}</div>
                      <div className="pr-tt-red">● Fond: {fmt(sB[tip.i])}</div>
                      <div className="pr-tt-amber">Δ {fmt(sA[tip.i] - sB[tip.i])}</div>
                    </div>
                  )}
                </div>

                <div className="calc-legend pr-legend">
                  <span className="calc-legend-item">
                    <span className="calc-legend-dot" style={{ background: "#2a6647" }} />
                    Nízkonákladové ETF portfólio
                  </span>
                  <span className="calc-legend-item">
                    <span className="calc-legend-dot" style={{ background: "#ab4132" }} />
                    Tvoje súčasné investovanie
                  </span>
                  <span className="calc-legend-item">
                    <span className="calc-legend-dot pr-legend-area" />
                    medzera = tvoja strata
                  </span>
                </div>

                <div className="pr-why">
                  <span className="pr-why-icon"><Lightbulb className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                  <p>
                    <strong>Prečo to robí taký rozdiel?</strong> Poplatok sa strháva každý rok z{" "}
                    <strong>celej hodnoty</strong> portfólia — nielen z toho, čo si vložil. A každé euro,
                    ktoré odíde na poplatkoch, ti zároveň prestane zarábať. Strata sa tak úročí rovnako ako
                    majetok — z pár percent ročne vyrastú za 20 rokov desaťtisíce eur.
                  </p>
                </div>
              </section>
            </div>

            {/* ═══ CTA ═══ */}
            <div className="pr-cta calc-reveal" style={st(4)}>
              <a
                className="btn-primary pr-btn"
                href={KONZULTACIA_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-umami-event="click_konzultacia"
                data-umami-event-section="poplatkovy-rontgen"
              >
                {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </a>
              <span className="pr-micro">Priprav si svoje portfólio — audit dostaneš zadarmo</span>
            </div>

            {/* ═══ FOOTER NOTE ═══ */}
            <p className="calc-note calc-note--center pr-foot">
              Modelový prepočet: porovnávame dynamické (akciové) investície — oba varianty rastú
              rovnakým hrubým výnosom 10&nbsp;% ročne (historický priemer akciových trhov), líšia sa
              ročnými poplatkami aplikovanými mesačne (1/12 ročnej sadzby) na aktuálnu hodnotu:
              nízkonákladové ETF portfólio 0,35&nbsp;% p.a.; fondy banky 2,5&nbsp;% p.a.; fondy cez
              poradcu 1,0&nbsp;% p.a.; fondy správcovskej spoločnosti 1,2&nbsp;% p.a. (typické
              hodnoty). Pri fondoch banky je zohľadnená 19&nbsp;% daň z výnosu pri predaji; ETF
              obchodované na burze sú po viac ako 1&nbsp;roku držania od dane oslobodené (časový
              test). Graf zobrazuje hodnotu po zdanení pri predaji v danom roku. Nejde o investičné
              ani daňové odporúčanie.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
