import Chart from "chart.js/auto";
import type { Plugin, ScriptableContext } from "chart.js";

/**
 * Rentová kalkulačka — model „sporenie → renta“.
 *
 * Fáza sporenia: mesačné zhodnotenie, vklad na konci mesiaca, vklad môže ročne rásť.
 * Fáza renty: tri spôsoby čerpania (dočerpanie do cieľového veku, večná renta z reálneho
 * výnosu, pravidlo 4 %). Renta je valorizovaná o infláciu; sumy „v dnešných €“ sú
 * deflované na dnešnú kúpnu silu.
 */

type Strategy = "drawdown" | "perpetual" | "rule4";

type Data = {
  currentAge: number;
  retirementAge: number;
  endAge: number;
  currentSavings: number;
  monthlyInvestment: number;
  growthRate: number;
  desiredRent: number;
  otherIncome: number;
  rentRate: number;
  inflation: number;
  contribGrowth: number;
};

type YearRow = {
  age: number;
  phase: "saving" | "rent";
  /** Vklady (+) alebo vyplatená renta (−) v danom roku, nominálne. */
  flow: number;
  /** Výnos v danom roku, nominálne. */
  gain: number;
  /** Majetok na konci roka, nominálne. */
  capital: number;
};

type Accumulation = {
  capital: number;
  invested: number;
  rows: YearRow[];
  /** Kumulatívne vložené na začiatku každého roka (index 0 = dnes). */
  investedSeries: number[];
  capitalSeries: number[];
};

type Drawdown = {
  rows: YearRow[];
  capitalSeries: number[];
  withdrawnSeries: number[];
  endCapital: number;
  runsOutAge: number | null;
};

type StrategyResult = {
  /** Mesačná renta v prvom roku, nominálne. */
  incomeNominal: number;
  /** Mesačná renta v dnešných €. */
  incomeToday: number;
  sim: Drawdown;
};

const STRATEGIES: Strategy[] = ["drawdown", "perpetual", "rule4"];
const RULE4 = 0.04;

export function mountRentovaCalculator(): () => void {
  const root = document.getElementById("rentova-calc-root");
  if (!root) return () => {};

  let chartInstance: Chart | null = null;
  let strategy: Strategy = "drawdown";

  const fmt = (v: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
      Number.isFinite(v) ? v : 0,
    );
  const fmtPct = (v: number, d = 0) => `${(Number(v) || 0).toFixed(d).replace(".", ",")} %`;
  const el = (idSuffix: string) => document.getElementById("rn-" + idSuffix);
  const setTxt = (idSuffix: string, txt: string) => {
    const e = el(idSuffix);
    if (e) e.textContent = txt;
  };
  const show = (idSuffix: string, visible: boolean, display = "") => {
    const e = el(idSuffix);
    if (e) e.style.display = visible ? display : "none";
  };
  const setCls = (idSuffix: string, cls: string, on: boolean) => el(idSuffix)?.classList.toggle(cls, on);
  const yearsWord = (n: number) => (n === 1 ? "rok" : n >= 2 && n <= 4 ? "roky" : "rokov");

  // ------------------------------------------------------------------ vstupy

  const sanitize = (x: Partial<Data>): Data => {
    const n = (v: unknown, fb: number) => (Number.isFinite(Number(v)) ? Number(v) : fb);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const currentAge = clamp(Math.round(n(x.currentAge, 35)), 16, 90);
    const retirementAge = clamp(Math.round(n(x.retirementAge, 65)), currentAge, 100);
    const endAge = clamp(Math.round(n(x.endAge, 90)), retirementAge + 1, 105);
    return {
      currentAge,
      retirementAge,
      endAge,
      currentSavings: Math.max(0, n(x.currentSavings, 10000)),
      monthlyInvestment: Math.max(0, n(x.monthlyInvestment, 300)),
      growthRate: clamp(n(x.growthRate, 7), 0, 30),
      desiredRent: Math.max(0, n(x.desiredRent, 1500)),
      otherIncome: Math.max(0, n(x.otherIncome, 0)),
      rentRate: clamp(n(x.rentRate, 5), 0, 30),
      inflation: clamp(n(x.inflation, 2.5), 0, 20),
      contribGrowth: clamp(n(x.contribGrowth, 0), 0, 20),
    };
  };

  const readForm = (): { data: Data; raw: Partial<Data> } => {
    const g = (id: string) => parseFloat((el(id) as HTMLInputElement | null)?.value || "0") || 0;
    const raw: Partial<Data> = {
      currentAge: g("currentAge"),
      retirementAge: g("retirementAge"),
      endAge: g("endAge"),
      currentSavings: g("currentSavings"),
      monthlyInvestment: g("monthlyInvestment"),
      growthRate: g("growthRate"),
      desiredRent: g("desiredRent"),
      otherIncome: g("otherIncome"),
      rentRate: g("rentRate"),
      inflation: g("inflation"),
      contribGrowth: g("contribGrowth"),
    };
    return { data: sanitize(raw), raw };
  };

  // ------------------------------------------------------------------ model

  /** Sporenie od súčasného veku do veku `toAge` (vrátane). */
  function accumulate(d: Data, toAge: number): Accumulation {
    const gm = d.growthRate / 100 / 12;
    const years = Math.max(0, toAge - d.currentAge);
    let capital = d.currentSavings;
    let invested = d.currentSavings;
    let contrib = d.monthlyInvestment;
    const rows: YearRow[] = [];
    const investedSeries: number[] = [invested];
    const capitalSeries: number[] = [capital];

    for (let y = 0; y < years; y++) {
      const start = capital;
      let flow = 0;
      for (let m = 0; m < 12; m++) {
        capital = capital * (1 + gm) + contrib;
        flow += contrib;
      }
      invested += flow;
      rows.push({ age: d.currentAge + y + 1, phase: "saving", flow, gain: capital - start - flow, capital });
      investedSeries.push(invested);
      capitalSeries.push(capital);
      contrib *= 1 + d.contribGrowth / 100;
    }
    return { capital, invested, rows, investedSeries, capitalSeries };
  }

  /** Mesačné sadzby počas renty: nominálna, inflačná a reálna. */
  function rentRates(d: Data) {
    const rm = d.rentRate / 100 / 12;
    const im = Math.pow(1 + d.inflation / 100, 1 / 12) - 1;
    const mr = (1 + rm) / (1 + im) - 1;
    return { rm, im, mr };
  }

  /** Mesačná renta (nominálna, prvý rok) z kapitálu `C` pri danej stratégii. */
  function incomeFor(s: Strategy, C: number, d: Data): number {
    const { mr } = rentRates(d);
    const M = (d.endAge - d.retirementAge) * 12;
    if (C <= 0) return 0;
    if (s === "drawdown") return Math.abs(mr) < 1e-12 ? C / M : (C * mr) / (1 - Math.pow(1 + mr, -M));
    if (s === "perpetual") return mr > 0 ? C * mr : 0;
    return (C * RULE4) / 12;
  }

  /** Kapitál potrebný na nominálnu mesačnú rentu `target` pri danej stratégii. */
  function requiredFor(s: Strategy, target: number, d: Data): number {
    const { mr } = rentRates(d);
    const M = (d.endAge - d.retirementAge) * 12;
    if (target <= 0) return 0;
    if (s === "drawdown") return Math.abs(mr) < 1e-12 ? target * M : (target * (1 - Math.pow(1 + mr, -M))) / mr;
    if (s === "perpetual") return mr > 0 ? target / mr : Infinity;
    return (target * 12) / RULE4;
  }

  /** Čerpanie renty od veku začiatku po koncový vek; renta valorizovaná mesačne o infláciu. */
  function drawdown(C: number, income0: number, d: Data): Drawdown {
    const { rm, im } = rentRates(d);
    let capital = C;
    let withdraw = income0;
    let withdrawn = 0;
    let runsOutAge: number | null = null;
    const rows: YearRow[] = [];
    const capitalSeries: number[] = [];
    const withdrawnSeries: number[] = [];

    for (let y = 0; y < d.endAge - d.retirementAge; y++) {
      const age = d.retirementAge + y + 1;
      const start = capital;
      let flow = 0;
      for (let m = 0; m < 12; m++) {
        // Renta sa valorizuje od prvého mesiaca — `income0` je renta v peniazoch roku začiatku renty.
        withdraw *= 1 + im;
        capital *= 1 + rm;
        const w = Math.min(withdraw, Math.max(0, capital));
        capital -= w;
        flow += w;
        if (capital <= 0.5 && runsOutAge === null) runsOutAge = age;
      }
      capital = Math.max(0, capital);
      withdrawn += flow;
      rows.push({ age, phase: "rent", flow: -flow, gain: capital - start + flow, capital });
      capitalSeries.push(capital);
      withdrawnSeries.push(withdrawn);
    }
    return { rows, capitalSeries, withdrawnSeries, endCapital: capital, runsOutAge };
  }

  function calc(d: Data) {
    const years = d.retirementAge - d.currentAge;
    const duration = d.endAge - d.retirementAge;
    const deflator = Math.pow(1 + d.inflation / 100, years);
    const acc = accumulate(d, d.retirementAge);
    const C = acc.capital;

    const results = {} as Record<Strategy, StrategyResult>;
    STRATEGIES.forEach((s) => {
      const incomeNominal = incomeFor(s, C, d);
      results[s] = { incomeNominal, incomeToday: incomeNominal / deflator, sim: drawdown(C, incomeNominal, d) };
    });
    const sel = results[strategy];

    const targetToday = Math.max(0, d.desiredRent - d.otherIncome);
    const required = requiredFor(strategy, targetToday * deflator, d);
    const gap = required - C;
    const totalIncomeToday = sel.incomeToday + d.otherIncome;
    const goalPct = d.desiredRent > 0 ? (totalIncomeToday / d.desiredRent) * 100 : 100;
    const incomeGapToday = d.desiredRent - totalIncomeToday;

    // Mesačný vklad, ktorým by si presne dosiahol potrebný kapitál (kapitál je lineárny vo vklade)
    const base = accumulate({ ...d, monthlyInvestment: 0 }, d.retirementAge).capital;
    const perEuro = accumulate({ ...d, monthlyInvestment: 1 }, d.retirementAge).capital - base;
    const requiredMonthly =
      !Number.isFinite(required) ? null : perEuro > 1e-9 ? Math.max(0, (required - base) / perEuro) : null;

    // Vek, v ktorom je cieľ dosiahnuteľný (najskorší) — hľadáme od dnes po koncový vek
    let goalAge: number | null = null;
    if (targetToday > 0 && Number.isFinite(required)) {
      for (let a = d.currentAge; a < d.endAge; a++) {
        const dd: Data = { ...d, retirementAge: a };
        const Ca = accumulate(dd, a).capital;
        const reqA = requiredFor(strategy, targetToday * Math.pow(1 + d.inflation / 100, a - d.currentAge), dd);
        if (Ca >= reqA) {
          goalAge = a;
          break;
        }
      }
    } else if (targetToday === 0) {
      goalAge = d.currentAge;
    }

    // Série pre graf: vek od dnes po koniec renty
    const labels: number[] = [];
    for (let a = d.currentAge; a <= d.endAge; a++) labels.push(a);
    const dataCapital = [...acc.capitalSeries, ...sel.sim.capitalSeries];
    const dataInvested: (number | null)[] = [...acc.investedSeries, ...sel.sim.capitalSeries.map(() => null)];
    const dataWithdrawn: (number | null)[] = [
      ...acc.investedSeries.map((_, i) => (i === acc.investedSeries.length - 1 ? 0 : null)),
      ...sel.sim.withdrawnSeries,
    ];

    return {
      d,
      years,
      duration,
      deflator,
      acc,
      C,
      results,
      sel,
      targetToday,
      required,
      gap,
      totalIncomeToday,
      goalPct,
      incomeGapToday,
      requiredMonthly,
      goalAge,
      labels,
      dataCapital,
      dataInvested,
      dataWithdrawn,
      retirementIndex: years,
      rows: [...acc.rows, ...sel.sim.rows],
    };
  }

  type Result = ReturnType<typeof calc>;

  // ------------------------------------------------------------------ graf

  /** Zvislá čiara pod kurzorom + deliaca čiara medzi sporením a rentou. */
  const phasePlugin: Plugin<"line"> = {
    id: "rnPhases",
    afterDatasetsDraw(chart) {
      const { top, bottom } = chart.chartArea;
      const c = chart.ctx;
      const retIdx = (chart.config.options?.plugins as { rnRetirementIndex?: number } | undefined)?.rnRetirementIndex;
      const meta = chart.getDatasetMeta(0);
      if (typeof retIdx === "number" && meta.data[retIdx]) {
        const x = meta.data[retIdx].x;
        c.save();
        c.beginPath();
        c.moveTo(x, top);
        c.lineTo(x, bottom);
        c.lineWidth = 1.5;
        c.setLineDash([6, 4]);
        c.strokeStyle = "rgba(42,102,71, 0.55)";
        c.stroke();
        c.setLineDash([]);
        c.font = "600 11px Matter, sans-serif";
        c.fillStyle = "rgba(42,102,71, 0.9)";
        c.textBaseline = "top";
        c.textAlign = "right";
        c.fillText("SPORENIE", x - 8, top + 2);
        c.textAlign = "left";
        c.fillText("RENTA", x + 8, top + 2);
        c.restore();
      }
      const active = chart.tooltip?.getActiveElements();
      if (!active || active.length === 0) return;
      const x = active[0].element.x;
      c.save();
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, bottom);
      c.lineWidth = 1;
      c.setLineDash([4, 4]);
      c.strokeStyle = "rgba(41, 36, 32, 0.35)";
      c.stroke();
      c.restore();
    },
  };

  const lastPointRadius = (ctx: ScriptableContext<"line">) =>
    ctx.dataIndex === ctx.dataset.data.length - 1 ? 5 : 0;

  /** Zvislý gradient výplne od farby série (alpha `top`) do priehľadna cez aktuálnu plochu grafu — drží aj po resize. */
  const areaGradient = (rgb: string, top: number) => (c2: ScriptableContext<"line">) => {
    const area = c2.chart.chartArea;
    if (!area) return "transparent";
    const g = c2.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, `rgba(${rgb}, ${top})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    return g;
  };

  function updateChart(r: Result): void {
    const canvas = el("chart") as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (chartInstance) {
      chartInstance.data.labels = r.labels;
      chartInstance.data.datasets[0].data = r.dataCapital;
      chartInstance.data.datasets[1].data = r.dataInvested;
      chartInstance.data.datasets[2].data = r.dataWithdrawn;
      (chartInstance.options.plugins as { rnRetirementIndex?: number }).rnRetirementIndex = r.retirementIndex;
      chartInstance.update();
      return;
    }

    // Gradientová výplň podľa aktuálnej plochy grafu (vzor Výnosnosť bytu).
    const gradient = areaGradient("47, 107, 78", 0.28);

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: r.labels,
        datasets: [
          {
            label: "Majetok",
            data: r.dataCapital,
            borderColor: "#2a6647",
            backgroundColor: gradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: lastPointRadius,
            pointHoverRadius: 6,
            pointBackgroundColor: "#2a6647",
            pointBorderColor: "#fffcf7",
            pointBorderWidth: 2,
          },
          {
            label: "Vložené spolu",
            data: r.dataInvested,
            borderColor: "rgb(169, 157, 126)",
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: "#a99d7e",
            pointBorderColor: "#fffcf7",
            pointBorderWidth: 2,
            spanGaps: false,
          },
          {
            label: "Vyplatená renta spolu",
            data: r.dataWithdrawn,
            borderColor: "rgb(171,65,50)",
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: "#ab4132",
            pointBorderColor: "#fffcf7",
            pointBorderWidth: 2,
            spanGaps: false,
          },
        ],
      },
      plugins: [phasePlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 18 } },
        plugins: {
          ...({ rnRetirementIndex: r.retirementIndex } as object),
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(41, 36, 32, 0.96)",
            titleColor: "#f3e9dd",
            bodyColor: "rgba(243, 233, 221, 0.9)",
            footerColor: "#d9b15c",
            borderWidth: 0,
            padding: 12,
            cornerRadius: 12,
            caretSize: 6,
            usePointStyle: true,
            boxPadding: 5,
            titleFont: { family: "Matter, sans-serif", size: 13, weight: 600 },
            bodyFont: { family: "Matter, sans-serif", size: 13 },
            footerFont: { family: "Matter, sans-serif", size: 13, weight: 600 },
            callbacks: {
              title: (items) => {
                if (!items.length) return "";
                const idx = items[0].dataIndex;
                const phase = idx <= (lastResult?.retirementIndex ?? 0) ? "sporenie" : "renta";
                return `Vek ${items[0].label} · ${phase}`;
              },
              label: (context) => {
                if (context.parsed.y === null) return "";
                return `${context.dataset.label}: ${fmt(context.parsed.y)}`;
              },
              footer: (items) => {
                if (!items.length || !lastResult) return "";
                const row = lastResult.rows[items[0].dataIndex - 1];
                if (!row) return "";
                return row.phase === "rent"
                  ? `Renta v tomto roku: ${fmt(-row.flow / 12)} / mes`
                  : `Vložené v tomto roku: ${fmt(row.flow)}`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: "rgba(41, 36, 32, 0.08)" },
            ticks: {
              maxTicksLimit: 5,
              color: "rgba(41, 36, 32, 0.5)",
              font: { family: "Matter, sans-serif", size: 12 },
              callback(value) {
                const v = Number(value);
                return v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + "M €" : (v / 1000).toFixed(0) + "k €";
              },
            },
          },
          x: {
            border: { display: false },
            grid: { display: false },
            ticks: {
              maxTicksLimit: 10,
              color: "rgba(41, 36, 32, 0.5)",
              font: { family: "Matter, sans-serif", size: 12 },
            },
          },
        },
      },
    });
  }

  // ------------------------------------------------------------------ UI

  let lastResult: Result | null = null;

  const STRATEGY_DESC: Record<Strategy, (r: Result) => string> = {
    drawdown: (r) => `Renta chodí do ${r.d.endAge} rokov a majetok sa postupne minie.`,
    perpetual: () => "Čerpáš len reálny výnos, majetok si drží hodnotu a zostane rodine.",
    rule4: () => "Prvý rok 4 % z majetku, potom valorizované o infláciu.",
  };

  function updateStrategies(r: Result): void {
    STRATEGIES.forEach((s) => {
      const res = r.results[s];
      setTxt(`strat-${s}`, fmt(res.incomeToday));
      const tab = root?.querySelector<HTMLElement>(`.rn-strat[data-strategy="${s}"]`);
      tab?.setAttribute("aria-pressed", String(s === strategy));
      tab?.classList.toggle("is-warn", s !== "drawdown" && res.sim.runsOutAge !== null);
    });
    const sel = r.results[strategy];
    const meta =
      strategy !== "drawdown" && sel.sim.runsOutAge !== null
        ? `Majetok sa minie vo veku ${sel.sim.runsOutAge}.`
        : `Majetok vo veku ${r.d.endAge}: ${fmt(sel.sim.endCapital)}.`;
    setTxt("stratDesc", `${STRATEGY_DESC[strategy](r)} ${meta}`);
  }

  function updatePlan(r: Result): void {
    const d = r.d;
    const plan = (i: number, label: string, value: string, sub: string) => {
      setTxt(`plan${i}-label`, label);
      setTxt(`plan${i}-value`, value);
      setTxt(`plan${i}-sub`, sub);
    };
    const infinite = !Number.isFinite(r.required);

    if (r.targetToday === 0) {
      setTxt("planTitle", "Cieľ je pokrytý iným príjmom");
      setTxt("planSub", "Renta z majetku je celá navyše.");
      plan(1, "Renta z majetku navyše", `${fmt(r.sel.incomeToday)} / mes`, "v dnešných peniazoch");
      plan(2, "Majetok vo veku " + d.retirementAge, fmt(r.C), "nominálne");
      plan(3, "Vložíš spolu", fmt(r.acc.invested), `za ${r.years} ${yearsWord(r.years)}`);
      return;
    }

    if (infinite) {
      setTxt("planTitle", "Večná renta pri tomto výnose nefunguje");
      setTxt("planSub", "Výnos počas renty je nižší alebo rovný inflácii, reálny výnos je nula.");
      plan(1, "Zvýš výnos počas renty", `nad ${fmtPct(d.inflation, 1)}`, "aby ostal reálny výnos na čerpanie");
      plan(2, "Alebo zvoľ dočerpanie", `${fmt(r.results.drawdown.incomeToday)} / mes`, `renta do ${d.endAge} rokov`);
      plan(3, "Alebo pravidlo 4 %", `${fmt(r.results.rule4.incomeToday)} / mes`, "v dnešných peniazoch");
      return;
    }

    if (r.gap > 0) {
      setTxt("planTitle", "Ako dosiahnuť cieľ");
      setTxt("planSub", `Na rentu ${fmt(r.targetToday)} z majetku chýba ${fmt(r.gap)} kapitálu. Tri cesty:`);
      if (r.requiredMonthly !== null && r.years > 0) {
        plan(
          1,
          "Investuj mesačne",
          fmt(r.requiredMonthly),
          `namiesto ${fmt(d.monthlyInvestment)}, o ${fmt(r.requiredMonthly - d.monthlyInvestment)} viac`,
        );
      } else {
        plan(1, "Investuj mesačne", "—", "do renty už nezostáva čas na sporenie");
      }
      if (r.goalAge !== null && r.goalAge > d.retirementAge) {
        plan(2, "Alebo choď do renty neskôr", `vo veku ${r.goalAge}`, `o ${r.goalAge - d.retirementAge} ${yearsWord(r.goalAge - d.retirementAge)} neskôr`);
      } else {
        plan(2, "Alebo choď do renty neskôr", "—", `cieľ nedosiahneš ani do ${d.endAge} rokov`);
      }
      plan(3, "Alebo uprav cieľ na", `${fmt(r.totalIncomeToday)} / mes`, "toľko dnes majetok reálne utiahne");
      return;
    }

    setTxt("planTitle", "Cieľ je splnený");
    setTxt("planSub", `Majetok pokryje rentu ${fmt(r.targetToday)} a ešte ostáva rezerva.`);
    plan(1, "Rezerva kapitálu", fmt(-r.gap), `nad rámec potrebných ${fmt(r.required)}`);
    if (r.goalAge !== null && r.goalAge < d.retirementAge) {
      plan(2, "Do renty môžeš ísť už", `vo veku ${r.goalAge}`, `o ${d.retirementAge - r.goalAge} ${yearsWord(d.retirementAge - r.goalAge)} skôr`);
    } else {
      plan(2, "Do renty môžeš ísť", `vo veku ${d.retirementAge}`, "presne podľa plánu");
    }
    if (r.requiredMonthly !== null && r.years > 0) {
      plan(3, "Alebo investuj len", `${fmt(r.requiredMonthly)} / mes`, `namiesto ${fmt(d.monthlyInvestment)} a cieľ stále dosiahneš`);
    } else {
      plan(3, "Renta z majetku", `${fmt(r.sel.incomeToday)} / mes`, "v dnešných peniazoch");
    }
  }

  function updateTable(r: Result): void {
    const table = el("table");
    if (!table) return;
    let html =
      "<thead><tr><th>Vek</th><th>Fáza</th><th>Vklady / renta</th><th>Výnos</th><th>Majetok na konci roka</th></tr></thead><tbody>";
    r.rows.forEach((row) => {
      const isRent = row.phase === "rent";
      html += `<tr class="${isRent ? "is-rent" : ""}"><td>${row.age}</td><td>${isRent ? "Renta" : "Sporenie"}</td>` +
        `<td class="${isRent ? "rn-neg" : "rn-pos"}">${isRent ? "−" : "+"}${fmt(Math.abs(row.flow))}</td>` +
        `<td>${row.gain >= 0 ? "+" : "−"}${fmt(Math.abs(row.gain))}</td><td><strong>${fmt(row.capital)}</strong></td></tr>`;
    });
    html += "</tbody>";
    table.innerHTML = html;
  }

  function updateUI(r: Result, raw: Partial<Data>): void {
    const d = r.d;

    // Upozornenie na upravené veky
    const clamped =
      Math.round(Number(raw.retirementAge)) !== d.retirementAge || Math.round(Number(raw.endAge)) !== d.endAge;
    show("warning", clamped);
    setTxt(
      "warning",
      `Vek renty musí byť aspoň súčasný vek a koniec renty neskôr než jej začiatok — počítame s rentou od ${d.retirementAge} do ${d.endAge} rokov.`,
    );

    setTxt("durationNote", `${r.duration} ${yearsWord(r.duration)} poberania renty`);

    // Hero
    setTxt("heroCapital", fmt(r.C));
    setTxt("heroAge", String(d.retirementAge));
    setTxt("income", fmt(r.sel.incomeToday));
    const year = new Date().getFullYear() + r.years;
    setTxt(
      "heroSub",
      r.years > 0
        ? `v dnešných peniazoch · v roku ${year} to bude ${fmt(r.sel.incomeNominal)} mesačne`
        : "v dnešných peniazoch",
    );

    const goalOk = r.goalPct >= 99.5;
    setTxt("meterGoal", fmt(d.desiredRent));
    setTxt("meterPct", `${fmtPct(Math.min(999, r.goalPct))} cieľa`);
    setTxt("gapText", goalOk ? `Rezerva +${fmt(Math.max(0, -r.incomeGapToday))} / mes` : `Chýba ${fmt(r.incomeGapToday)} / mes`);
    setCls("meter", "is-good", goalOk);
    setCls("meter", "is-bad", !goalOk);
    const fill = el("meterFill");
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, r.goalPct))}%`;
    show("otherNote", d.otherIncome > 0);
    setTxt("otherNote", `renta ${fmt(r.sel.incomeToday)} + iný príjem ${fmt(d.otherIncome)} = ${fmt(r.totalIncomeToday)}`);

    // Štatistiky
    setTxt("statRetAge", String(d.retirementAge));
    setTxt("statEndAge", String(d.endAge));
    setTxt("projectedCapital", fmt(r.C));
    setTxt("requiredCapital", Number.isFinite(r.required) ? fmt(r.required) : "∞");
    const gapEl = el("capitalGap");
    if (Number.isFinite(r.gap)) {
      setTxt("gapLabel", r.gap > 0 ? "Chýba" : "Rezerva");
      setTxt("capitalGap", fmt(Math.abs(r.gap)));
    } else {
      setTxt("gapLabel", "Chýba");
      setTxt("capitalGap", "—");
    }
    gapEl?.classList.toggle("rn-neg", Number.isFinite(r.gap) && r.gap > 0);
    gapEl?.classList.toggle("rn-pos", Number.isFinite(r.gap) && r.gap <= 0);
    setTxt("endCapital", fmt(r.sel.sim.endCapital));

    updateStrategies(r);
    updatePlan(r);
    updateChart(r);
    updateTable(r);
  }

  const calculate = () => {
    const { data, raw } = readForm();
    const r = calc(data);
    lastResult = r;
    updateUI(r, raw);
    return r;
  };

  // ------------------------------------------------------------------ udalosti

  const listeners: Array<{ el: Element; type: string; fn: EventListener }> = [];
  const on = (target: Element | null, type: string, fn: EventListener) => {
    if (!target) return;
    target.addEventListener(type, fn);
    listeners.push({ el: target, type, fn });
  };

  const inputIds = [
    "currentAge",
    "retirementAge",
    "endAge",
    "currentSavings",
    "monthlyInvestment",
    "growthRate",
    "desiredRent",
    "otherIncome",
    "rentRate",
    "inflation",
    "contribGrowth",
  ];
  inputIds.forEach((id) => on(el(id), "input", () => calculate()));

  // Slider ↔ číselné pole pre výnosy
  const bindRateSlider = (inputId: string) => {
    const input = el(inputId) as HTMLInputElement | null;
    const slider = el(`${inputId}-slider`) as HTMLInputElement | null;
    if (!input || !slider) return;
    on(slider, "input", () => {
      input.value = slider.value;
      calculate();
    });
    on(input, "input", () => {
      const v = Number(input.value);
      if (Number.isFinite(v)) slider.value = String(Math.max(Number(slider.min), Math.min(Number(slider.max), v)));
    });
  };
  bindRateSlider("growthRate");
  bindRateSlider("rentRate");

  // Voľba stratégie
  on(el("strategies"), "click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".rn-strat");
    const s = btn?.dataset.strategy as Strategy | undefined;
    if (!s || !STRATEGIES.includes(s)) return;
    strategy = s;
    calculate();
  });

  // Rozbaľovacie sekcie
  const bindCollapse = (toggleId: string, contentId: string, arrowId: string, labelId?: string) => {
    const toggle = el(toggleId);
    const content = el(contentId);
    on(toggle, "click", () => {
      if (!content) return;
      const isHidden = window.getComputedStyle(content).display === "none";
      content.style.display = isHidden ? "block" : "none";
      const arrow = el(arrowId);
      if (arrow) arrow.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
      if (labelId) setTxt(labelId, isHidden ? "Skryť rozpis" : "Zobraziť rozpis");
      toggle?.setAttribute("aria-expanded", String(isHidden));
    });
  };
  bindCollapse("advanced-toggle", "advanced-content", "arrow-icon");
  bindCollapse("table-toggle", "table-content", "table-arrow", "table-toggle-label");

  calculate();

  return () => {
    chartInstance?.destroy();
    chartInstance = null;
    listeners.forEach(({ el: target, type, fn }) => target.removeEventListener(type, fn));
  };
}
