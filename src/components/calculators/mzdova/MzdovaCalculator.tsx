import { useLayoutEffect, type CSSProperties } from "react";
import "../shared/calc-ui.css";
import "./mzdova-calculator.css";
import { initCalcEcho, initCalcHeroPulse, initCalcSliders } from "../shared/calcUi";
import { mountMzdovaCalculator } from "./mzdovaMount";

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

const MzdovaCalculator = () => {
  useLayoutEffect(() => {
    const unmountCalc = mountMzdovaCalculator();
    const unmountSliders = initCalcSliders("mzv3-w");
    const unmountEcho = initCalcEcho("mzv3-w");
    const unmountPulse = initCalcHeroPulse("mzv3-net");
    return () => {
      unmountPulse();
      unmountEcho();
      unmountSliders();
      unmountCalc?.();
    };
  }, []);

  return (
    <div id="mzv3-w" className="calc-ui w-full font-sans text-foreground">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={reveal(0)}>
            <span className="calc-eyebrow">Mzdová kalkulačka</span>
            <h1 className="calc-title">
              Koľko ti ostane <em>na ruku</em>?
            </h1>
            <p className="calc-subtitle">
              Hrubá aj čistá mzda, odvody, daň a&nbsp;náklady zamestnávateľa podľa legislatívy SR 2026. Pre zamestnancov
              aj SZČO.
            </p>
          </header>

          {/* Prepínač režimu — mení celý výpočet, preto stojí nad dockom */}
          <div className="mzv3-type-switch-row calc-reveal" style={reveal(1)}>
            <div className="calc-pills mzv3-type-switch" role="group" aria-label="Typ pracovného pomeru">
              <button type="button" id="mzv3-t-emp" onClick={() => window.mzv3SetType?.("emp")} className="calc-pill sel" aria-pressed={true}>
                Zamestnanec
              </button>
              <button type="button" id="mzv3-t-szco" aria-pressed={false} onClick={() => window.mzv3SetType?.("szco")} className="calc-pill">
                SZČO / Živnostník
              </button>
            </div>
          </div>

          {/* Vstupný dock */}
          <section className="calc-dock calc-reveal" aria-label="Vstupné údaje" style={reveal(2)}>
            <div className="calc-dock-grid">
              <div className="calc-dock-item">
                <label id="mzv3-salary-label" className="calc-label" htmlFor="mzv3-salary">
                  Hrubá mesačná mzda
                </label>
                <div className="calc-input-wrap calc-input-wrap--stepper">
                  <input type="number" id="mzv3-salary" defaultValue={2000} step={50} min={0} className="calc-input" />
                  <Stepper inputId="mzv3-salary" step={50} unit="€" />
                </div>
              </div>

              <div className="calc-dock-item" id="mzv3-dir-wrap">
                <span className="calc-label">Smer výpočtu</span>
                <div id="mzv3-seg-wrap" className="calc-segment">
                  <button type="button" id="mzv3-d-gross" onClick={() => window.mzv3SetDir?.("gross")} className="sel" aria-pressed={true}>
                    Hrubá → Čistá
                  </button>
                  <button type="button" id="mzv3-d-net" aria-pressed={false} onClick={() => window.mzv3SetDir?.("net")}>
                    Čistá → Hrubá
                  </button>
                </div>
              </div>

              <div id="mzv3-emp-opts" className="mzv3-dock-group">
                <div className="calc-dock-item">
                  <span className="calc-label">Uplatnenie NČZD</span>
                  <div className="calc-segment">
                    <button type="button" id="mzv3-nczd-yes" onClick={() => window.mzv3SetNczd?.(true)} className="sel" aria-pressed={true}>
                      Áno
                    </button>
                    <button type="button" id="mzv3-nczd-no" aria-pressed={false} onClick={() => window.mzv3SetNczd?.(false)}>
                      Nie
                    </button>
                  </div>
                  <p className="calc-stat-sub mt-2">NČZD 2026: 497,23 €/mes — kráti sa nad 26 083,13 €/rok.</p>
                </div>

                <div className="calc-dock-item">
                  <span className="calc-label">Daňový bonus na deti</span>
                  <div className="mzv3-mini-row">
                    <div>
                      <label className="calc-label calc-label--sub" htmlFor="mzv3-ch15">
                        Do 15 r.
                        <span className="calc-label-hint">100 €</span>
                      </label>
                      <input type="number" id="mzv3-ch15" defaultValue={0} min={0} max={10} className="calc-input" />
                    </div>
                    <div>
                      <label className="calc-label calc-label--sub" htmlFor="mzv3-ch18">
                        15 – 18 r.
                        <span className="calc-label-hint">50 €</span>
                      </label>
                      <input type="number" id="mzv3-ch18" defaultValue={0} min={0} max={10} className="calc-input" />
                    </div>
                  </div>
                </div>
              </div>

              <div id="mzv3-szco-opts" className="mzv3-dock-group hidden">
                <div className="calc-dock-item">
                  <span className="calc-label">Minimálne odvody</span>
                  <div className="mzv3-check">
                    <input type="checkbox" id="mzv3-szco-minbase" />
                    <label htmlFor="mzv3-szco-minbase">
                      Platiť iba minimálne odvody
                      <span className="mzv3-check-hint">Bez ohľadu na výšku príjmu</span>
                    </label>
                  </div>
                </div>

                <div className="calc-dock-item">
                  <span className="calc-label">Výdavky</span>
                  <div className="mzv3-check">
                    <input type="checkbox" id="mzv3-szco-pausch" />
                    <label htmlFor="mzv3-szco-pausch">
                      Paušálne výdavky
                      <span className="mzv3-check-hint">60 %, max 20 000 €/rok</span>
                    </label>
                  </div>
                </div>

                <div className="calc-dock-item mzv3-minima">
                  <span className="calc-label">Minimá SZČO 2026</span>
                  <p className="mzv3-minima-text">
                    Min. VZ sociálne <strong>914,40 €</strong>
                    <br />
                    Sociálne odvody min. <strong>303,11 €</strong> (33,15 %)
                    <br />
                    Zdravotné odvody min. <strong>121,92 €</strong> (16 %)
                  </p>
                </div>
              </div>
            </div>

            <div className="calc-dock-foot mzv3-dock-foot">
              <div className="mzv3-check">
                <input type="checkbox" id="mzv3-ztpp" />
                <label htmlFor="mzv3-ztpp">
                  Osoba so zdravotným postihnutím (ZŤP)
                  <span className="mzv3-check-hint">Zdravotné poistenie 2,5 % / 8 % namiesto 5 % / 16 %</span>
                </label>
              </div>

              <div className="mzv3-foot-note hidden" id="mzv3-szco-income-wrap">
                <p className="mzv3-infobox-title">Základ dane SZČO</p>
                <p className="mzv3-infobox-text">
                  Zadaj mesačný základ dane (príjmy mínus výdavky / paušálne výdavky). Odvody sa platia z vymeriavacieho
                  základu = ½ základu dane.
                </p>
              </div>
            </div>
          </section>

          {/* Výsledok — hviezda stránky */}
          <section className="calc-hero-xl calc-reveal" aria-label="Výsledok" style={reveal(3)}>
            <p className="calc-hero-xl-label">
              <span id="mzv3-hero-label">Čistá mzda</span>
            </p>
            <p className="calc-hero-xl-value" id="mzv3-net">0 €</p>
            <div className="calc-hero-xl-chips">
              <span className="calc-verdict-chip">
                <span id="mzv3-second-label">Náklady zamestnávateľa</span>&nbsp;
                <strong id="mzv3-super">0 €</strong>
              </span>
              <span className="calc-verdict-chip">Legislatíva SR 2026</span>
            </div>
            <p className="mzv3-hero-sub" id="mzv3-net-sub" />
            <p className="mzv3-hero-foot" id="mzv3-super-sub">Superhrubá mzda</p>
          </section>

          {/* Ročný prehľad — inline štatistiky */}
          <div className="calc-stats-inline calc-reveal" role="group" aria-label="Ročný prehľad" style={reveal(4)}>
            <div>
              <p className="calc-stat-label">Hrubá za rok</p>
              <p className="calc-stat-value" id="mzv3-gross-yr">0 €</p>
            </div>
            <div>
              <p className="calc-stat-label">Čistá za rok</p>
              <p className="calc-stat-value" id="mzv3-net-yr">0 €</p>
            </div>
            <div>
              <p className="calc-stat-label">Odvody za rok</p>
              <p className="calc-stat-value" id="mzv3-odvody-yr">0 €</p>
            </div>
            <div>
              <p className="calc-stat-label">Daň za rok</p>
              <p className="calc-stat-value" id="mzv3-tax-yr">0 €</p>
            </div>
          </div>

          {/* Rozklad + graf */}
          <div className="mzv3-panels">
            <section className="calc-panel calc-reveal" aria-label="Rozklad výpočtu" style={reveal(5)}>
              <h2 className="calc-panel-title">Rozklad výpočtu</h2>
              <div id="mzv3-breakdown" className="calc-rows mt-3" />
            </section>

            <section className="calc-panel calc-reveal" aria-label="Štruktúra príjmu" style={reveal(6)}>
              <div className="calc-chart-head">
                <h2 className="calc-panel-title">Štruktúra príjmu</h2>
              </div>
              <div className="calc-chart-body mzv3-chart-body">
                <canvas id="mzv3-chart" />
              </div>
            </section>
          </div>

          <p className="calc-note calc-note--center mt-5 md:mt-6">
            Kalkulačka je orientačná — sadzby pre rok 2026 (SR). SZČO: odvody sa platia mesačne ako preddavky, ročné
            zúčtovanie v daňovom priznaní.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MzdovaCalculator;
