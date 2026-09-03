import type { CSSProperties } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { BONUSY_BASE_PATH } from "@/pages/kalkulacky/kalkulackyConfig";
import type { KalkulackaCalculatorMeta } from "@/pages/kalkulacky/kalkulackyConfig";
import { MAP_PATHS } from "@/components/calculators/shared/slovakiaMap";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Karty bonusov — tóny, tvary (SVG) a karta nástroja. Zdieľané medzi /bonusy
 * a sekciou bonusov na /komunita, aby obe ukazovali to isté.
 * ------------------------------------------------------------------------- */

export type ToneId = "sage" | "lime" | "green" | "sand" | "stone" | "rust" | "clay" | "forest" | "brown";
export type Glyph = "venn" | "arcs" | "coins" | "gauge" | "pie" | "map" | "crescent" | "semafor" | "steps" | "dots" | "ring" | "house" | "euro" | "slice" | "cross" | "sun";

/* tón: povrch karty, hlavná farba tvaru, sekundárna farba tvaru, text, tlmený text */
export const TONES: Record<ToneId, { bg: string; fg: string; fg2: string; text?: string; muted?: string }> = {
  sage: { bg: "#2a6647", fg: "#f3e9dd", fg2: "rgba(243,233,221, 0.44)", text: "#f3e9dd", muted: "rgba(243,233,221, 0.88)" },
  lime: { bg: "#f0e3cf", fg: "#292420", fg2: "rgba(169,157,126,0.55)" },
  green: { bg: "#2a6647", fg: "#f3e9dd", fg2: "rgba(243,233,221, 0.44)", text: "#f3e9dd", muted: "rgba(243,233,221, 0.88)" },
  sand: { bg: "#f0e3cf", fg: "#292420", fg2: "rgba(169,157,126,0.55)" },
  stone: { bg: "#e9e4dc", fg: "#292420", fg2: "rgba(41,36,32,0.22)" },
  rust: { bg: "#ab4132", fg: "#f6d9c8", fg2: "rgba(246,217,200,0.32)", text: "#f8ebe0", muted: "rgba(248,235,224, 0.88)" },
  clay: { bg: "#b35a4d", fg: "#ffffff", fg2: "rgba(255,255,255,0.32)", text: "#ffffff", muted: "#ffffff" },
  forest: { bg: "#0b3d2e", fg: "#f3e9dd", fg2: "rgba(243,233,221, 0.42)", text: "#f3e9dd", muted: "rgba(243,233,221, 0.88)" },
  brown: { bg: "#292420", fg: "#d9b15c", fg2: "rgba(217,177,92,0.3)", text: "#f3e9dd", muted: "rgba(243,233,221, 0.88)" },
};

export const TOOL_META: Record<string, { category: string; tone: ToneId; glyph: Glyph }> = {
  "financny-checkup": { category: "Začni tu", tone: "sage", glyph: "ring" },
  "etf-semafor": { category: "Investovanie", tone: "sage", glyph: "dots" },
  "skoring-bytov": { category: "Nehnuteľnosti", tone: "sand", glyph: "ring" },
  "inteligentna-hypoteka": { category: "Hypotéka", tone: "sand", glyph: "cross" },
  "investicna-kalkulacka": { category: "Investovanie", tone: "green", glyph: "steps" },
  "mzdova-kalkulacka": { category: "Mzda", tone: "stone", glyph: "euro" },
  "uverova-kalkulacka": { category: "Úvery", tone: "sand", glyph: "gauge" },
  "rentova-kalkulacka": { category: "Renta", tone: "brown", glyph: "sun" },
  "investicny-byt": { category: "Nehnuteľnosti", tone: "forest", glyph: "map" },
  "poplatkovy-rontgen": { category: "Poplatky", tone: "clay", glyph: "slice" },
  "bytovy-semafor": { category: "Nehnuteľnosti", tone: "stone", glyph: "semafor" },
  "vynosnost-bytu": { category: "Nehnuteľnosti", tone: "green", glyph: "house" },
};

export const NEW_SLUGS = new Set(["financny-checkup", "skoring-bytov", "vynosnost-bytu", "inteligentna-hypoteka"]);
export const FAVORITE_SLUGS = new Set(["rentova-kalkulacka"]);
export const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
export const toneStyle = (t: ToneId, i = 0) => ({ "--i": i, "--tone-bg": TONES[t].bg, "--tone-fg": TONES[t].fg, "--tone-fg2": TONES[t].fg2, "--tone-text": TONES[t].text ?? "#292420", "--tone-muted": TONES[t].muted ?? "#4a4239" } as CSSProperties);

/* ------------------------------ Tvary (poster, dvojtón) ------------------------------ */

export const GlyphArt = ({ glyph, tone }: { glyph: Glyph; tone: ToneId }) => {
  const { fg, fg2, bg } = TONES[tone];
  switch (glyph) {
    case "venn":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><circle className="g-a" cx="46" cy="62" r="36" fill={fg2} /><circle className="g-b" cx="78" cy="62" r="36" fill={fg} fillOpacity="0.9" /></svg>
      );
    case "arcs":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><circle className="g-1" cx="30" cy="94" r="13" fill={fg2} /><circle className="g-2" cx="60" cy="68" r="21" fill={fg2} /><circle className="g-3" cx="94" cy="34" r="30" fill={fg} /></svg>
      );
    case "coins":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><rect className="g-1" x="28" y="72" width="64" height="18" rx="9" fill={fg2} /><rect className="g-2" x="28" y="50" width="64" height="18" rx="9" fill={fg} fillOpacity="0.6" /><rect className="g-3" x="28" y="28" width="64" height="18" rx="9" fill={fg} /></svg>
      );
    case "gauge":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><path d="M18 84 A 42 42 0 0 1 102 84" fill="none" stroke={fg2} strokeWidth="16" strokeLinecap="round" /><path className="g-arc" d="M18 84 A 42 42 0 0 1 102 84" pathLength={100} fill="none" stroke={fg} strokeWidth="16" strokeLinecap="round" strokeDasharray="100" strokeDashoffset="42" /><circle cx="60" cy="84" r="8" fill={fg} /></svg>
      );
    case "pie":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><circle cx="60" cy="60" r="42" fill={fg2} /><g className="g-spin"><path d="M60 60 L60 18 A 42 42 0 0 1 102 60 Z" fill={fg} /><path d="M60 60 L102 60 A 42 42 0 0 1 89.7 89.7 Z" fill={fg} fillOpacity="0.55" /></g></svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 1000 498" aria-hidden style={{ overflow: "visible" }}>
          {Object.entries(MAP_PATHS).map(([k, d], i) => (
            <path key={k} className="g-kraj" style={{ transitionDelay: `${i * 55}ms` }} d={d} fill={fg} fillOpacity={k === "BA" || k === "KE" ? 1 : 0.32} stroke={bg} strokeWidth="6" strokeLinejoin="round" />
          ))}
        </svg>
      );
    case "crescent":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><g className="g-spin"><circle cx="60" cy="60" r="42" fill={fg} /><circle cx="82" cy="46" r="34" fill={bg} /><circle cx="82" cy="46" r="34" fill={fg2} /></g></svg>
      );
    case "semafor":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><rect x="38" y="4" width="44" height="118" rx="22" fill={fg2} /><circle className="g-l1" cx="60" cy="28" r="13" fill={fg} fillOpacity="0.3" /><circle className="g-l2" cx="60" cy="63" r="13" fill={fg} fillOpacity="0.55" /><circle className="g-l3" cx="60" cy="98" r="13" fill={fg} /></svg>
      );
    case "steps":
      return (
        <svg viewBox="0 0 120 120" aria-hidden>{[26, 44, 66, 92].map((h, i) => <rect key={i} className={`g-${i + 1}`} x={14 + i * 25} y={106 - h} width="18" height={h} rx="6" fill={fg} fillOpacity={0.35 + i * 0.22} />)}</svg>
      );
    case "house":
      /* byt s grafom: silueta domu a tri rastúce stĺpce (Výnosnosť investičného bytu) */
      return (
        <svg viewBox="0 0 120 120" aria-hidden>
          <path className="g-roof" d="M60 21 L99 51.5 L99 97.5 L21 97.5 L21 51.5 Z" fill={fg2} stroke={fg2} strokeWidth="8.5" strokeLinejoin="round" />
          {[19, 31, 43].map((h, i) => <rect key={i} className={`g-${i + 1}`} x={35.5 + i * 18} y={87 - h} width="13" height={h} rx="4.5" fill={fg} fillOpacity={0.55 + i * 0.22} />)}
        </svg>
      );
    case "euro":
      /* mzda: tri bankovky a minca s € */
      return (
        <svg viewBox="0 0 120 120" aria-hidden>
          <g className="g-coin">
            <circle cx="32" cy="54" r="25" fill={fg} />
            <text x="32" y="66" textAnchor="middle" fontFamily="Calvino, serif" fontWeight="700" fontSize="34" fill={bg}>€</text>
          </g>
          <rect className="g-note g-n1" x="62" y="30" width="44" height="16" rx="8" fill={fg} fillOpacity="0.8" />
          <rect className="g-note g-n2" x="62" y="50" width="44" height="16" rx="8" fill={fg} fillOpacity="0.55" />
          <rect className="g-note g-n3" x="62" y="70" width="44" height="16" rx="8" fill={fg2} />
        </svg>
      );
    case "slice":
      /* poplatkový röntgen: koláč, z ktorého sa pri hoveri odpojí výsek */
      return (
        <svg viewBox="0 0 120 120" aria-hidden>
          <path d="M58 64 L58 22 A42 42 0 1 0 100 64 Z" fill={fg} />
          <path className="g-slice" d="M58 64 L58 22 A42 42 0 0 1 100 64 Z" fill={fg} fillOpacity="0.55" />
        </svg>
      );
    case "cross":
      /* inteligentná hypotéka: klesajúci dlh, rastúca rezerva a bod prieniku */
      return (
        <svg viewBox="0 0 120 120" aria-hidden>
          <path d="M16 26 L104 98" fill="none" stroke={fg2} strokeWidth="9" strokeLinecap="round" />
          <path d="M16 100 L104 24" fill="none" stroke={fg} strokeWidth="9" strokeLinecap="round" />
          <circle className="g-halo" cx="60" cy="62" r="17" fill={fg2} />
          <circle className="g-dot" cx="60" cy="62" r="10" fill={fg} stroke={bg} strokeWidth="4" />
        </svg>
      );
    case "sun":
      /* renta = sloboda: slnko vychádzajúce nad obzor */
      return (
        <svg viewBox="0 0 120 120" aria-hidden>
          <defs><clipPath id="bz-sun-clip"><rect x="0" y="0" width="120" height="82" /></clipPath></defs>
          <line className="g-ray" x1="60" y1="40" x2="60" y2="26" stroke={fg2} strokeWidth="6" strokeLinecap="round" />
          <line className="g-ray" x1="29" y1="53" x2="19" y2="43" stroke={fg2} strokeWidth="6" strokeLinecap="round" />
          <line className="g-ray" x1="91" y1="53" x2="101" y2="43" stroke={fg2} strokeWidth="6" strokeLinecap="round" />
          <circle className="g-sun" cx="60" cy="86" r="34" fill={fg} clipPath="url(#bz-sun-clip)" />
          <line x1="8" y1="82" x2="112" y2="82" stroke={fg2} strokeWidth="8" strokeLinecap="round" />
        </svg>
      );
    case "dots":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><rect x="4" y="38" width="112" height="44" rx="22" fill={fg2} /><circle className="g-1" cx="28" cy="60" r="12" fill={fg} fillOpacity="0.35" /><circle className="g-2" cx="60" cy="60" r="12" fill={fg} fillOpacity="0.6" /><circle className="g-3" cx="92" cy="60" r="12" fill={fg} /></svg>
      );
    case "ring":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><circle cx="60" cy="60" r="40" fill="none" stroke={fg2} strokeWidth="12" /><circle className="g-arc g-rot" cx="60" cy="60" r="40" pathLength={100} fill="none" stroke={fg} strokeWidth="12" strokeLinecap="round" strokeDasharray="100" strokeDashoffset="22" /><text x="60" y="70" textAnchor="middle" fontFamily="Calvino, serif" fontWeight="700" fontSize="30" fill={fg}>84</text></svg>
      );
  }
};


/* ------------------------------ Karta nástroja ------------------------------ */

export const ToolCard = ({ meta, index = 0, locked = false }: { meta: KalkulackaCalculatorMeta; index?: number; locked?: boolean }) => {
  const info = TOOL_META[meta.slug] ?? { category: "Nástroj", tone: "stone" as ToneId, glyph: "arcs" as Glyph };
  const inner = (
    <>
      <span className={cn("bz-glyph", info.glyph === "map" && "bz-glyph--map")} aria-hidden><GlyphArt glyph={info.glyph} tone={info.tone} /></span>
      <span className="bz-card-head">
        <span className="bz-cat">{info.category}</span>
        {locked ? (
          <span className="bz-new bz-lock"><Lock className="h-3 w-3" strokeWidth={2.25} aria-hidden />Bonus</span>
        ) : (
          <>
            {NEW_SLUGS.has(meta.slug) ? <span className="bz-new">Nové</span> : null}
            {FAVORITE_SLUGS.has(meta.slug) ? <span className="bz-new bz-fav">Obľúbené</span> : null}
          </>
        )}
      </span>
      <span className="bz-card-body">
        <span className="bz-card-title">{meta.title}</span>
        <span className="bz-card-text">{meta.description}</span>
        {locked ? (
          <span className="bz-card-cta"><Lock className="h-4 w-4" strokeWidth={2} aria-hidden /> Odomkne sa po pripojení</span>
        ) : (
          <span className="bz-card-cta">Otvoriť <ArrowRight className="h-4 w-4" aria-hidden /></span>
        )}
      </span>
    </>
  );
  if (locked) {
    return (
      <div className="bz-card bz-reveal bz-card--locked" style={toneStyle(info.tone, index)} aria-label={`${meta.title} – bonus po pripojení do komunity`}>
        {inner}
      </div>
    );
  }
  return (
    <Link to={`${BONUSY_BASE_PATH}/${meta.slug}`} className={cn("bz-card bz-reveal", focusClass)} style={toneStyle(info.tone, index)} data-umami-event="click_bonus_tool" data-umami-event-slug={meta.slug}>
      {inner}
    </Link>
  );
};
