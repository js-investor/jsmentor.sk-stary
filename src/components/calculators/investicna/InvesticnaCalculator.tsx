import { useLayoutEffect, type CSSProperties } from "react";
import "../shared/calculator-toolbar.css";
import "../shared/calc-ui.css";
import "./investicna-calculator.css";
import { initCalcEcho, initCalcHeroPulse, initCalcSliders } from "../shared/calcUi";
import { mountInvesticnaCalculator } from "./investicnaMount";

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

/** Poradie vstupnej animácie sekcií (.calc-reveal). */
const reveal = (i: number) => ({ "--i": i }) as CSSProperties;

const InvesticnaCalculator = () => {
  useLayoutEffect(() => {
    const unmountCalc = mountInvesticnaCalculator();
    const unmountSliders = initCalcSliders("inv-calc-root");
    const unmountEcho = initCalcEcho("inv-calc-root");
    const unmountPulse = initCalcHeroPulse("inv-finalValue");
    return () => {
      unmountPulse();
      unmountEcho();
      unmountSliders();
      unmountCalc?.();
    };
  }, []);

  return (
    <div id="inv-calc-root" className="calc-ui w-full font-sans text-foreground">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={reveal(0)}>
            <span className="calc-eyebrow">Investičná kalkulačka</span>
            <h1 className="calc-title">
              Koľko ti zarobí <em>zložené úročenie</em>?
            </h1>
            <p className="calc-subtitle">
              Zadaj vklady, dobu a&nbsp;výnos. Uvidíš hodnotu portfólia, čo z&nbsp;nej ukroja poplatky a&nbsp;daň
              a&nbsp;koľko ti ostane po inflácii.
            </p>
          </header>

          {/* Vstupný dock */}
          <section className="calc-dock calc-reveal" aria-label="Parametre investície" style={reveal(1)}>
            <div className="calc-dock-grid">
              <div className="calc-dock-item">
                <label className="calc-label" htmlFor="inv-initial">Počiatočný vklad</label>
                <div className="calc-input-wrap calc-input-wrap--stepper">
                  <input type="number" id="inv-initial" defaultValue={5000} step={100} min={0} className="calc-input" />
                  <Stepper inputId="inv-initial" step={100} unit="€" />
                </div>
              </div>

              <div className="calc-dock-item">
                <label className="calc-label" htmlFor="inv-monthly">Mesačný vklad</label>
                <div className="calc-input-wrap calc-input-wrap--stepper">
                  <input type="number" id="inv-monthly" defaultValue={200} step={10} min={0} className="calc-input" />
                  <Stepper inputId="inv-monthly" step={10} unit="€" />
                </div>
              </div>

              <div className="calc-dock-item">
                <div className="calc-label">
                  <label htmlFor="inv-duration">Doba investovania</label>
                  <span className="calc-label-value" data-echo-of="inv-duration" data-echo-suffix=" rokov">20 rokov</span>
                </div>
                <input type="range" id="inv-duration" className="calc-slider" min={1} max={50} defaultValue={20} />
              </div>

              <div className="calc-dock-item">
                <div className="calc-label">
                  <label htmlFor="inv-rate">Ročný výnos</label>
                  <span className="calc-input-inline">
                    <input type="number" id="inv-rate" defaultValue={8} step={0.1} min={0} max={100} />
                    <span className="calc-inline-unit" aria-hidden>%</span>
                  </span>
                </div>
                <input
                  type="range"
                  id="inv-rate-slider"
                  aria-label="Ročný výnos"
                  className="calc-slider"
                  min={1}
                  max={15}
                  step={0.1}
                  defaultValue={8}
                />
              </div>
            </div>

            <div className="calc-dock-foot">
              <div
                id="inv-advanced-toggle"
                className="calc-collapse-toggle"
                role="button"
                aria-expanded={false}
                aria-controls="inv-advanced-content"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}
              >
                <span>Inflácia, poplatky a daň</span>
                <span id="inv-arrow-icon" className="calc-collapse-chevron" aria-hidden>▼</span>
              </div>
              <div id="inv-advanced-content" className="pb-4 pt-1" style={{ display: "none" }}>
                <div className="inv-adv-grid">
                  <div className="calc-field">
                    <label className="calc-label" htmlFor="inv-inflation">
                      Odhadovaná inflácia
                      <span className="calc-label-hint">% ročne</span>
                    </label>
                    <div className="calc-input-wrap">
                      <input type="number" id="inv-inflation" defaultValue={2} step={0.1} min={0} className="calc-input calc-input--unit" />
                      <span className="calc-input-unit" aria-hidden>%</span>
                    </div>
                    <p className="calc-stat-sub mt-2">Prepočíta výslednú sumu na dnešnú hodnotu peňazí.</p>
                  </div>

                  <div className="calc-field">
                    <label className="calc-label" htmlFor="inv-entryFee">
                      Vstupný poplatok
                      <span className="calc-label-hint">% z vkladu</span>
                    </label>
                    <div className="calc-input-wrap">
                      <input type="number" id="inv-entryFee" defaultValue={0} step={0.1} min={0} max={100} className="calc-input calc-input--unit" />
                      <span className="calc-input-unit" aria-hidden>%</span>
                    </div>
                    <p className="calc-stat-sub mt-2">Počíta sa len z peňazí, ktoré reálne vložíš.</p>
                  </div>

                  <div className="calc-field">
                    <label className="calc-label" htmlFor="inv-annualFee">
                      Ročný poplatok
                      <span className="calc-label-hint">% p. a. z majetku</span>
                    </label>
                    <div className="calc-input-wrap">
                      <input type="number" id="inv-annualFee" defaultValue={0} step={0.1} min={0} max={100} className="calc-input calc-input--unit" />
                      <span className="calc-input-unit" aria-hidden>%</span>
                    </div>
                    <p className="calc-stat-sub mt-2">Správcovský poplatok / TER. Ukážeme skutočný dopad vrátane ušlého zhodnotenia.</p>
                  </div>

                  <div className="calc-field">
                    <label className="calc-label" htmlFor="inv-perfFee">
                      Výkonnostný poplatok
                      <span className="calc-label-hint">% zo zisku</span>
                    </label>
                    <div className="calc-input-wrap">
                      <input type="number" id="inv-perfFee" defaultValue={0} step={1} min={0} max={100} className="calc-input calc-input--unit" />
                      <span className="calc-input-unit" aria-hidden>%</span>
                    </div>
                    <p className="calc-stat-sub mt-2">Strháva sa z každého kladného zhodnotenia.</p>
                  </div>
                </div>

                <label className="inv-check-row" htmlFor="inv-tax">
                  <span className="inv-check-text">
                    <span className="inv-check-title">Zdaniť výnos daňou 19 %</span>
                    <span className="inv-check-sub">
                      Daň z kapitálového výnosu na konci investovania. ETF na burze držané dlhšie ako rok sú na Slovensku od dane oslobodené.
                    </span>
                  </span>
                  <input type="checkbox" id="inv-tax" className="inv-check-input" />
                </label>
              </div>
            </div>
          </section>

          {/* Výsledok — hviezda stránky */}
          <section className="calc-hero-xl calc-reveal" aria-label="Výsledok" style={reveal(2)}>
            <p className="calc-hero-xl-label">
              Hodnota tvojho portfólia o <span id="inv-durationVal">20 rokov</span>
              <span id="inv-hero-suffix" style={{ display: "none" }}> po poplatkoch a dani</span>
            </p>
            <p className="calc-hero-xl-value" id="inv-finalValue">0 €</p>
            <div className="calc-hero-xl-chips">
              <span className="calc-verdict-chip">
                Čistý výnos&nbsp;<strong id="inv-totalInterest">0 €</strong>
              </span>
              <span className="calc-verdict-chip">
                Zložené úročenie zarobilo&nbsp;<strong id="inv-interestPercent">0 %</strong>&nbsp;zo sumy
              </span>
              <span className="calc-verdict-chip inv-chip-cost" id="inv-cost-chip" style={{ display: "none" }}>
                Poplatky a daň ťa stoja&nbsp;<strong id="inv-costTotalChip">0 €</strong>
              </span>
            </div>
          </section>

          {/* Inline štatistiky */}
          <div className="calc-stats-inline calc-reveal" role="group" aria-label="Súhrn" style={reveal(3)}>
            <div>
              <p className="calc-stat-label">Celkový vklad</p>
              <p className="calc-stat-value" id="inv-totalInvested">0 €</p>
            </div>
            <div>
              <p className="calc-stat-label">Reálna hodnota</p>
              <p className="calc-stat-value" id="inv-realValue">0 €</p>
            </div>
            <div>
              <p className="calc-stat-label">Návratnosť</p>
              <p className="calc-stat-value" id="inv-roi">0×</p>
            </div>
          </div>

          {/* Poplatky a daň — kompaktný súhrn, rozpis na rozkliknutie */}
          <section className="calc-panel calc-tone--blush inv-fees-panel calc-reveal mt-5 md:mt-6" id="inv-fees-panel" aria-label="Poplatky a daň" style={{ ...reveal(4), display: "none" }}>
            <div
              id="inv-fees-toggle"
              className="inv-fees-toggle"
              role="button"
              aria-expanded={false}
              aria-controls="inv-fees-content"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.currentTarget.click();
                }
              }}
            >
              <span className="inv-fees-toggle-main">
                <span className="calc-panel-title">Čo ťa stoja poplatky a daň</span>
                <span className="inv-fees-toggle-sum">
                  <strong className="inv-cost" id="inv-costTotalHead">0 €</strong>
                  <span className="inv-fees-toggle-pct" id="inv-costPctHead" />
                </span>
              </span>
              <span className="inv-fees-toggle-action">
                <span id="inv-fees-toggle-label">Zobraziť rozpis</span>
                <span id="inv-fees-arrow" className="calc-collapse-chevron" aria-hidden>▼</span>
              </span>
            </div>

            <div id="inv-fees-content" style={{ display: "none" }}>
              <p className="calc-panel-sub inv-fees-gross">
                Bez poplatkov a dane by si mal <strong id="inv-grossValue">0 €</strong>
              </p>
              <div className="calc-rows">
                <div className="calc-row" id="inv-row-entry">
                  <span>
                    Vstupný poplatok
                    <span className="inv-row-hint" id="inv-entryHint" />
                  </span>
                  <span className="calc-row-value inv-cost" id="inv-entryFeeVal">0 €</span>
                </div>
                <div className="calc-row" id="inv-row-annual">
                  <span>
                    Ročný poplatok — skutočný dopad
                    <span className="inv-row-hint" id="inv-annualHint" />
                  </span>
                  <span className="calc-row-value inv-cost" id="inv-annualFeeVal">0 €</span>
                </div>
                <div className="calc-row" id="inv-row-perf">
                  <span>
                    Výkonnostný poplatok
                    <span className="inv-row-hint" id="inv-perfHint" />
                  </span>
                  <span className="calc-row-value inv-cost" id="inv-perfFeeVal">0 €</span>
                </div>
                <div className="calc-row" id="inv-row-tax">
                  <span>
                    Daň 19 % z výnosu
                    <span className="inv-row-hint" id="inv-taxHint" />
                  </span>
                  <span className="calc-row-value inv-cost" id="inv-taxVal">0 €</span>
                </div>
                <div className="calc-row calc-row--total">
                  <span>
                    Skutočný dopad spolu
                    <span className="inv-row-hint" id="inv-costHint" />
                  </span>
                  <span className="calc-row-value inv-cost" id="inv-costTotal">0 €</span>
                </div>
              </div>
            </div>
          </section>

          {/* Graf */}
          <section className="calc-panel calc-reveal mt-5 md:mt-6" aria-label="Vývoj v čase" style={reveal(5)}>
            <div className="calc-chart-head">
              <h2 className="calc-panel-title">Vývoj v čase</h2>
              <div className="calc-legend">
                <span className="calc-legend-item">
                  <span className="calc-legend-dot" style={{ background: "#a99d7e" }} aria-hidden />
                  Vklady
                </span>
                <span className="calc-legend-item">
                  <span className="calc-legend-dot" style={{ background: "#2a6647" }} aria-hidden />
                  Zhodnotenie
                </span>
                <span className="calc-legend-item" id="inv-legend-gross" style={{ display: "none" }}>
                  <span className="calc-legend-dot" style={{ background: "#292420" }} aria-hidden />
                  Bez poplatkov
                </span>
              </div>
            </div>
            <div className="calc-chart-body calc-chart-body--tall">
              <canvas id="inv-chart" />
            </div>
          </section>

          <p className="calc-note calc-note--center mt-5 md:mt-6">
            Kalkulačka je orientačná — počíta s konštantným ročným výnosom. Poplatky a daň
            zohľadňuje podľa hodnôt v sekcii „Inflácia, poplatky a daň“; graf zobrazuje hodnotu pred zdanením.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvesticnaCalculator;
