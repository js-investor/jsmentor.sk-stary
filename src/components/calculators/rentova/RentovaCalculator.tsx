import { useLayoutEffect } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import "../shared/calculator-toolbar.css";
import "../shared/calc-ui.css";
import "./rentova-calculator.css";
import { initCalcEcho, initCalcHeroPulse, initCalcSliders } from "../shared/calcUi";
import { mountRentovaCalculator } from "./rentovaMount";

/** −/+ stepper pre číselný vstup; zmenu hodnoty vždy ohlási input eventom pre mount. */
const Stepper = ({ inputId, step, unit }: { inputId: string; step: number; unit: string }) => {
  const nudge = (dir: "up" | "down") => {
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    if (!el) return;
    if (dir === "up") el.stepUp();
    else el.stepDown();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return (
    <span className="calc-stepper">
      <span className="calc-stepper-unit" aria-hidden>{unit}</span>
      <button type="button" aria-label={`Znížiť o ${step} ${unit}`} onClick={() => nudge("down")}>−</button>
      <button type="button" aria-label={`Zvýšiť o ${step} ${unit}`} onClick={() => nudge("up")}>+</button>
    </span>
  );
};

/** Rozklikávací prvok (Enter / medzerník = klik) — logiku rieši mount. */
const collapseKeys = (e: KeyboardEvent<HTMLDivElement>) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.currentTarget.click();
  }
};

/** Číselné pole s jednotkou a −/+ stepperom. */
const MoneyField = ({
  id,
  label,
  hint,
  defaultValue,
  step,
}: {
  id: string;
  label: string;
  hint?: string;
  defaultValue: number;
  step: number;
}) => (
  <div className="rn-field">
    <label className="calc-label" htmlFor={id}>
      {label}
      {hint ? <span className="calc-label-hint">{hint}</span> : null}
    </label>
    <div className="calc-input-wrap calc-input-wrap--stepper">
      <input type="number" id={id} defaultValue={defaultValue} step={step} min={0} className="calc-input" />
      <Stepper inputId={id} step={step} unit="€" />
    </div>
  </div>
);

/** Percento: číselné pole v hlavičke + slider. */
const RateField = ({
  id,
  label,
  defaultValue,
  max,
}: {
  id: string;
  label: string;
  defaultValue: number;
  max: number;
}) => (
  <div className="rn-field">
    <div className="calc-label">
      <label htmlFor={id}>{label}</label>
      <span className="calc-input-inline">
        <input type="number" id={id} defaultValue={defaultValue} step={0.1} min={0} max={30} />
        <span className="calc-inline-unit" aria-hidden>%</span>
      </span>
    </div>
    <input
      type="range"
      id={`${id}-slider`}
      aria-label={label}
      className="calc-slider"
      min={0}
      max={max}
      step={0.1}
      defaultValue={defaultValue}
    />
  </div>
);

const StrategyTab = ({ id, title, selected = false }: { id: "drawdown" | "perpetual" | "rule4"; title: string; selected?: boolean }) => (
  <button type="button" className="rn-strat" data-strategy={id} aria-pressed={selected}>
    <span className="rn-strat-title">{title}</span>
    <span className="rn-strat-value" id={`rn-strat-${id}`}>0 €</span>
  </button>
);

/** Poradie vstupnej animácie sekcií (.calc-reveal). */
const reveal = (i: number) => ({ "--i": i }) as CSSProperties;

const RentovaCalculator = () => {
  useLayoutEffect(() => {
    const unmountCalc = mountRentovaCalculator();
    const unmountSliders = initCalcSliders("rentova-calc-root");
    const unmountEcho = initCalcEcho("rentova-calc-root");
    const unmountPulse = initCalcHeroPulse("rn-income");
    return () => {
      unmountPulse();
      unmountEcho();
      unmountSliders();
      unmountCalc?.();
    };
  }, []);

  return (
    <div id="rentova-calc-root" className="calc-ui w-full font-sans text-foreground">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={reveal(0)}>
            <span className="calc-eyebrow">Rentová kalkulačka</span>
            <h1 className="calc-title">
              Aká <em>renta</em> ti môže chodiť z&nbsp;majetku?
            </h1>
            <p className="calc-subtitle">
              Zadaj, koľko máš a&nbsp;koľko mesačne odkladáš. Uvidíš rentu v&nbsp;dnešných peniazoch, potrebný kapitál
              a&nbsp;tri cesty, ako cieľ dosiahnuť.
            </p>
          </header>

          <div className="rn-layout">
            {/* ---------------------------------------------------------------- Vstupy */}
            <aside className="rn-inputs calc-reveal" aria-label="Tvoje čísla" style={reveal(1)}>
              <div className="rn-inputs-head">
                <h2 className="calc-panel-title">Tvoje čísla</h2>
                <p className="calc-panel-sub">Výsledok sa prepočíta hneď, ako niečo zmeníš.</p>
              </div>

              <section className="rn-group" aria-label="Ty">
                <p className="rn-group-title">Ty</p>
                <div className="rn-fields-2">
                  <div className="rn-field">
                    <label className="calc-label" htmlFor="rn-currentAge">Vek dnes</label>
                    <input type="number" id="rn-currentAge" defaultValue={35} min={16} max={90} className="calc-input" />
                  </div>
                  <div className="rn-field">
                    <label className="calc-label" htmlFor="rn-retirementAge">Renta od veku</label>
                    <input type="number" id="rn-retirementAge" defaultValue={65} min={17} max={100} className="calc-input" />
                  </div>
                </div>
                <div className="rn-field">
                  <div className="calc-label">
                    <label htmlFor="rn-endAge">Renta do veku</label>
                    <span className="calc-label-value" data-echo-of="rn-endAge" data-echo-suffix=" rokov">90 rokov</span>
                  </div>
                  <input type="range" id="rn-endAge" className="calc-slider" min={60} max={100} defaultValue={90} />
                  <p className="rn-field-note" id="rn-durationNote">25 rokov poberania renty</p>
                </div>
              </section>

              <section className="rn-group" aria-label="Majetok">
                <p className="rn-group-title">Majetok</p>
                <MoneyField id="rn-currentSavings" label="Úspory a investície dnes" defaultValue={10000} step={1000} />
                <MoneyField id="rn-monthlyInvestment" label="Investujem mesačne" defaultValue={300} step={50} />
                <RateField id="rn-growthRate" label="Výnos počas sporenia" defaultValue={7} max={12} />
              </section>

              <section className="rn-group" aria-label="Renta">
                <p className="rn-group-title">Renta</p>
                <MoneyField id="rn-desiredRent" label="Chcem mesačnú rentu" hint="v dnešných €" defaultValue={1500} step={50} />
                <RateField id="rn-rentRate" label="Výnos počas renty" defaultValue={5} max={10} />
              </section>

              <div
                id="rn-advanced-toggle"
                className="calc-collapse-toggle"
                role="button"
                aria-expanded={false}
                aria-controls="rn-advanced-content"
                tabIndex={0}
                onKeyDown={collapseKeys}
              >
                <span>Viac nastavení</span>
                <span id="rn-arrow-icon" className="calc-collapse-chevron" aria-hidden>▼</span>
              </div>
              <div id="rn-advanced-content" className="rn-advanced" style={{ display: "none" }}>
                <MoneyField id="rn-otherIncome" label="Iný príjem v rente" hint="dôchodok, prenájom" defaultValue={0} step={50} />
                <div className="rn-fields-2">
                  <div className="rn-field">
                    <label className="calc-label" htmlFor="rn-inflation">Inflácia</label>
                    <div className="calc-input-wrap">
                      <input type="number" id="rn-inflation" defaultValue={2.5} step={0.1} min={0} max={20} className="calc-input calc-input--unit" />
                      <span className="calc-input-unit" aria-hidden>%</span>
                    </div>
                  </div>
                  <div className="rn-field">
                    <label className="calc-label" htmlFor="rn-contribGrowth">Rast vkladu ročne</label>
                    <div className="calc-input-wrap">
                      <input type="number" id="rn-contribGrowth" defaultValue={0} step={0.5} min={0} max={20} className="calc-input calc-input--unit" />
                      <span className="calc-input-unit" aria-hidden>%</span>
                    </div>
                  </div>
                </div>
                <p className="rn-field-note">Renta sa každý rok valorizuje o infláciu. Iný príjem znižuje, čo musí utiahnuť majetok.</p>
              </div>

              <p className="rn-warning" id="rn-warning" style={{ display: "none" }} />
            </aside>

            {/* ---------------------------------------------------------------- Výsledok */}
            <section className="rn-result calc-reveal" aria-label="Výsledok" style={reveal(2)}>
              <p className="rn-result-eyebrow">Tvoja renta</p>
              <p className="rn-result-label">
                Z majetku <strong id="rn-heroCapital">0 €</strong> ti od <span id="rn-heroAge">65</span> rokov môže chodiť
              </p>
              <p className="rn-result-value">
                <span className="calc-hero-xl-value" id="rn-income">0 €</span>
                <span className="rn-result-unit">mesačne</span>
              </p>
              <p className="rn-result-sub" id="rn-heroSub">v dnešných peniazoch</p>

              {/* Ukazovateľ cieľa */}
              <div className="rn-meter" id="rn-meter" role="group" aria-label="Plnenie cieľa">
                <div className="rn-meter-head">
                  <span>
                    Cieľ <strong id="rn-meterGoal">1 500 €</strong> mesačne
                    <span className="rn-meter-other" id="rn-otherNote" style={{ display: "none" }} />
                  </span>
                  <span className="rn-meter-gap" id="rn-gapText" />
                </div>
                <div className="rn-meter-track" aria-hidden>
                  <div className="rn-meter-fill" id="rn-meterFill" />
                  <div className="rn-meter-goalmark" />
                </div>
                <div className="rn-meter-foot">
                  <span id="rn-meterPct">0 %</span>
                  <span>100 % = cieľ</span>
                </div>
              </div>

              {/* Spôsob čerpania */}
              <div className="rn-strats-head">
                <span className="rn-strats-title">Spôsob čerpania</span>
                <span className="rn-strats-desc" id="rn-stratDesc" />
              </div>
              <div className="rn-strats" id="rn-strategies" role="group" aria-label="Spôsob čerpania">
                <StrategyTab id="drawdown" title="Dočerpať majetok" selected />
                <StrategyTab id="perpetual" title="Večná renta" />
                <StrategyTab id="rule4" title="Pravidlo 4 %" />
              </div>

              {/* Graf */}
              <div className="rn-chart-head">
                <span className="rn-strats-title">Sporenie a renta v čase</span>
                <div className="calc-legend">
                  <span className="calc-legend-item">
                    <span className="calc-legend-dot" style={{ background: "#2a6647" }} aria-hidden />
                    Majetok
                  </span>
                  <span className="calc-legend-item">
                    <span className="calc-legend-dot" style={{ background: "#a99d7e" }} aria-hidden />
                    Vložené
                  </span>
                  <span className="calc-legend-item">
                    <span className="calc-legend-dot" style={{ background: "#ab4132" }} aria-hidden />
                    Vyplatená renta
                  </span>
                </div>
              </div>
              <div className="rn-chart">
                <canvas id="rn-chart" />
              </div>

              {/* Kľúčové čísla */}
              <div className="rn-kpis" role="group" aria-label="Kľúčové čísla">
                <div>
                  <p className="calc-stat-label">Majetok vo veku <span id="rn-statRetAge">65</span></p>
                  <p className="calc-stat-value" id="rn-projectedCapital">0 €</p>
                </div>
                <div>
                  <p className="calc-stat-label">Potrebný kapitál</p>
                  <p className="calc-stat-value" id="rn-requiredCapital">0 €</p>
                </div>
                <div>
                  <p className="calc-stat-label" id="rn-gapLabel">Chýba</p>
                  <p className="calc-stat-value" id="rn-capitalGap">0 €</p>
                </div>
                <div>
                  <p className="calc-stat-label">Majetok vo veku <span id="rn-statEndAge">90</span></p>
                  <p className="calc-stat-value" id="rn-endCapital">0 €</p>
                </div>
              </div>
            </section>
          </div>

          {/* ---------------------------------------------------------------- Ako dosiahnuť cieľ */}
          <section className="calc-panel calc-reveal mt-5 md:mt-6" aria-label="Ako dosiahnuť cieľ" id="rn-plan-panel" style={reveal(3)}>
            <div className="calc-chart-head">
              <h2 className="calc-panel-title" id="rn-planTitle">Ako dosiahnuť cieľ</h2>
              <span className="calc-panel-sub" id="rn-planSub" />
            </div>
            <div className="calc-statbar rn-plan">
              <div>
                <p className="calc-stat-label" id="rn-plan1-label" />
                <p className="calc-stat-value" id="rn-plan1-value" />
                <p className="calc-stat-sub" id="rn-plan1-sub" />
              </div>
              <div>
                <p className="calc-stat-label" id="rn-plan2-label" />
                <p className="calc-stat-value" id="rn-plan2-value" />
                <p className="calc-stat-sub" id="rn-plan2-sub" />
              </div>
              <div>
                <p className="calc-stat-label" id="rn-plan3-label" />
                <p className="calc-stat-value" id="rn-plan3-value" />
                <p className="calc-stat-sub" id="rn-plan3-sub" />
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------- Rozpis po rokoch */}
          <section className="calc-panel calc-reveal mt-5 md:mt-6" aria-label="Rozpis po rokoch" style={reveal(4)}>
            <div
              id="rn-table-toggle"
              className="rn-table-toggle"
              role="button"
              aria-expanded={false}
              aria-controls="rn-table-content"
              tabIndex={0}
              onKeyDown={collapseKeys}
            >
              <span className="rn-table-toggle-main">
                <span className="calc-panel-title">Rozpis po rokoch</span>
                <span className="calc-panel-sub">Vklady, výnosy a renta rok po roku, od dnes až do konca renty.</span>
              </span>
              <span className="rn-table-toggle-action">
                <span id="rn-table-toggle-label">Zobraziť rozpis</span>
                <span id="rn-table-arrow" className="calc-collapse-chevron" aria-hidden>▼</span>
              </span>
            </div>
            <div id="rn-table-content" style={{ display: "none" }}>
              <div className="rn-table-wrap">
                <table className="rn-table" id="rn-table" />
              </div>
            </div>
          </section>

          <p className="calc-note calc-note--center mt-5 md:mt-6">
            Kalkulačka je orientačná — počíta s konštantným výnosom a infláciou, renta je valorizovaná
            o infláciu a sumy „v dnešných €“ sú prepočítané na dnešnú kúpnu silu. Nezohľadňuje dane
            ani poplatky konkrétnych produktov.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RentovaCalculator;
