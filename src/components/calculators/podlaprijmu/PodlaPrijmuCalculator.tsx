import { useLayoutEffect, type CSSProperties } from "react";
import "../shared/calculator-toolbar.css";
import "../shared/calc-ui.css";
import "./podla-prijmu.css";
import { initCalcEcho, initCalcHeroPulse, initCalcSliders } from "../shared/calcUi";
import { mountPodlaPrijmuCalculator } from "./podla-prijmuMount";

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

const PodlaPrijmuCalculator = () => {
  useLayoutEffect(() => {
    const unmountCalc = mountPodlaPrijmuCalculator();
    const unmountSliders = initCalcSliders("dti-calc-root");
    const unmountEcho = initCalcEcho("dti-calc-root");
    const unmountPulse = initCalcHeroPulse("dti-max-mortgage");
    return () => {
      unmountPulse();
      unmountEcho();
      unmountSliders();
      unmountCalc?.();
    };
  }, []);

  return (
    <div id="dti-calc-root" className="calc-ui w-full font-sans text-foreground">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={reveal(0)}>
            <span className="calc-eyebrow">Úverová kalkulačka</span>
            <h1 className="calc-title">
              Koľko ti banka <em>požičia</em>?
            </h1>
            <p className="calc-subtitle">
              Zadaj príjem, záväzky a&nbsp;parametre hypotéky. Uvidíš maximálnu výšku úveru podľa limitov NBS
              a&nbsp;koľko ti po splátke ostane na život.
            </p>
          </header>

          {/* Vstupný dock */}
          <section className="calc-dock calc-reveal" aria-label="Vstupy kalkulačky" style={reveal(1)}>
            <div className="dti-dock-grid">
              <div className="calc-dock-item dti-dock-group" aria-label="Tvoje financie">
                <p className="dti-dock-heading">Tvoje financie</p>

                <div className="calc-field">
                  <label className="calc-label" htmlFor="dti-income">Čistý mesačný príjem</label>
                  <div className="calc-input-wrap calc-input-wrap--stepper">
                    <input type="number" id="dti-income" defaultValue={1500} step={50} min={0} className="calc-input" />
                    <Stepper inputId="dti-income" step={50} unit="€" />
                  </div>
                </div>

                <div className="calc-field">
                  <label className="dti-check-row" htmlFor="dti-partner-toggle">
                    <span className="dti-check-text">
                      <span className="dti-check-title">Spolužiadateľ / partner</span>
                      <span className="dti-check-sub">Spoločný príjem zvýši úverovú kapacitu.</span>
                    </span>
                    <input type="checkbox" id="dti-partner-toggle" className="dti-check-input" />
                  </label>
                </div>

                <div id="dti-partner-input-group" className="calc-field hidden">
                  <label className="calc-label" htmlFor="dti-partner-income">Príjem partnera</label>
                  <div className="calc-input-wrap calc-input-wrap--stepper">
                    <input type="number" id="dti-partner-income" defaultValue={0} step={50} min={0} className="calc-input" />
                    <Stepper inputId="dti-partner-income" step={50} unit="€" />
                  </div>
                </div>
              </div>

              <div className="calc-dock-item dti-dock-group" aria-label="Existujúce záväzky">
                <p className="dti-dock-heading">Existujúce záväzky</p>

                <div className="calc-field">
                  <label className="calc-label" htmlFor="dti-monthly-debt">Mesačné splátky úverov</label>
                  <div className="calc-input-wrap">
                    <input type="number" id="dti-monthly-debt" defaultValue={0} step={10} min={0} className="calc-input calc-input--unit" />
                    <span className="calc-input-unit" aria-hidden>€</span>
                  </div>
                </div>

                <div className="calc-field">
                  <label className="calc-label" htmlFor="dti-total-debt">Celkový zostatok dlhov</label>
                  <div className="calc-input-wrap">
                    <input type="number" id="dti-total-debt" defaultValue={0} step={1000} min={0} className="calc-input calc-input--unit" />
                    <span className="calc-input-unit" aria-hidden>€</span>
                  </div>
                </div>

                <div className="calc-field">
                  <label className="calc-label" htmlFor="dti-credit-limits">
                    Limity kreditiek
                    <span className="calc-label-hint">3 % z limitu = splátka</span>
                  </label>
                  <div className="calc-input-wrap">
                    <input type="number" id="dti-credit-limits" defaultValue={0} step={100} min={0} className="calc-input calc-input--unit" />
                    <span className="calc-input-unit" aria-hidden>€</span>
                  </div>
                </div>
              </div>

              <div className="calc-dock-item dti-dock-group" aria-label="Parametre hypotéky">
                <p className="dti-dock-heading">Parametre hypotéky</p>

                <div className="calc-fieldrow">
                  <div className="calc-field">
                    <label className="calc-label" htmlFor="dti-rate">Úrok</label>
                    <div className="calc-input-wrap">
                      <input type="number" id="dti-rate" defaultValue={4.2} step={0.1} min={0} className="calc-input calc-input--unit" />
                      <span className="calc-input-unit" aria-hidden>%</span>
                    </div>
                  </div>
                  <div className="calc-field">
                    <label className="calc-label" htmlFor="dti-years">Splatnosť</label>
                    <div className="calc-input-wrap">
                      <input type="number" id="dti-years" defaultValue={30} min={1} max={40} className="calc-input calc-input--unit" />
                      <span className="calc-input-unit" aria-hidden>rokov</span>
                    </div>
                  </div>
                </div>

                <div className="calc-field">
                  <label className="dti-check-row" htmlFor="dti-stress-toggle">
                    <span className="dti-check-text">
                      <span className="dti-check-title">Stress test (+2 %)</span>
                      <span className="dti-check-sub">Banka počíta splátku so sadzbou vyššou o 2 %.</span>
                    </span>
                    <input type="checkbox" id="dti-stress-toggle" className="dti-check-input" />
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Výsledok — hviezda stránky */}
          <section className="calc-hero-xl calc-reveal" aria-label="Výsledok" style={reveal(2)}>
            <p className="calc-hero-xl-label">Banka ti požičia maximálne</p>
            <p className="calc-hero-xl-value" id="dti-max-mortgage">0 €</p>
            <div className="calc-hero-xl-chips">
              <span className="calc-verdict-chip">
                Mesačná splátka&nbsp;<strong id="dti-max-payment">0 €</strong>
              </span>
              <span className="calc-verdict-chip calc-verdict-chip--muted">
                <span id="dti-limit-reason" />
              </span>
            </div>
          </section>

          {/* Inline štatistiky */}
          <div className="calc-stats-inline calc-reveal" role="group" aria-label="Súhrn" style={reveal(3)}>
            <div>
              <p className="calc-stat-label">Povinná rezerva</p>
              <p className="calc-stat-value" id="dti-reserve">0 €</p>
            </div>
            <div>
              <p className="calc-stat-label">Limit DTI</p>
              <p className="calc-stat-value">8×</p>
            </div>
            <div>
              <p className="calc-stat-label">Limit DSTI</p>
              <p className="calc-stat-value">60 %</p>
            </div>
          </div>

          {/* Ukazovatele DTI a DSTI */}
          <section className="calc-panel calc-reveal mt-5 md:mt-6" aria-label="Ukazovatele DTI a DSTI" style={reveal(4)}>
            <div className="calc-chart-head">
              <h2 className="calc-panel-title">Ako si na tom s limitmi</h2>
            </div>
            <div className="dti-gauges">
              <div className="dti-gauge">
                <p className="calc-stat-label">DTI</p>
                <p className="dti-gauge-sub">Celkový dlh vs. ročný príjem</p>
                <div className="dti-gauge-canvas">
                  <canvas id="chart-dti" />
                  <span className="dti-gauge-value" id="dti-value-text">0x</span>
                </div>
                <p className="dti-gauge-status" id="dti-status-msg">V bezpečnej zóne</p>
              </div>
              <div className="dti-gauge">
                <p className="calc-stat-label">DSTI</p>
                <p className="dti-gauge-sub">Splátky vs. mesačný príjem</p>
                <div className="dti-gauge-canvas">
                  <canvas id="chart-dsti" />
                  <span className="dti-gauge-value" id="dsti-value-text">0%</span>
                </div>
                <p className="dti-gauge-status" id="dsti-status-msg">V bezpečnej zóne</p>
              </div>
            </div>
          </section>

          {/* Rozloženie príjmu */}
          <section className="calc-panel calc-reveal mt-5 md:mt-6" aria-label="Rozloženie príjmu" style={reveal(5)}>
            <div className="calc-chart-head">
              <h2 className="calc-panel-title">Rozloženie tvojho príjmu</h2>
              <div className="calc-legend">
                <span className="calc-legend-item">
                  <span className="calc-legend-dot" style={{ background: "#ab4132" }} aria-hidden />
                  Dlhy
                </span>
                <span className="calc-legend-item">
                  <span className="calc-legend-dot" style={{ background: "#a99d7e" }} aria-hidden />
                  Rezerva
                </span>
                <span className="calc-legend-item">
                  <span className="calc-legend-dot" style={{ background: "#2a6647" }} aria-hidden />
                  Voľné
                </span>
              </div>
            </div>
            <div className="dti-income-bar" role="img" aria-label="Rozloženie príjmu na dlhy, rezervu a voľné prostriedky">
              <div id="bar-debts" className="dti-bar dti-bar--debts" style={{ width: "20%" }} />
              <div id="bar-reserve" className="dti-bar dti-bar--reserve" style={{ width: "40%" }} />
              <div id="bar-free" className="dti-bar dti-bar--free" style={{ width: "40%" }} />
            </div>
          </section>

          <p className="calc-note calc-note--center mt-5 md:mt-6">
            Kalkulačka je orientačná — vychádza z limitov NBS (DTI 8-násobok ročného príjmu,
            DSTI 60 % s povinnou rezervou 40 %). Konečné posúdenie závisí od konkrétnej banky.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PodlaPrijmuCalculator;
