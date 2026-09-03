import Chart from "chart.js/auto";
import type { Plugin, ScriptableContext } from "chart.js";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const BRAND = "JS Mentor";

type InvestFormData = {
  initial: number;
  monthly: number;
  duration: number;
  rate: number;
  inflation: number;
  entryFee: number;
  annualFee: number;
  perfFee: number;
  tax: boolean;
};

/** Sadzba dane z kapitálového výnosu (SR). */
const TAX_RATE = 0.19;

type Variant = {
  id: string;
  name: string;
  data: InvestFormData | null;
};

type ScenarioResult = {
  input: InvestFormData;
  finalValue: number;
  totalInvested: number;
  totalInterest: number;
  realValue: number;
  interestPercent: number;
  roi: number;
  labels: string[];
  dataInvested: number[];
  dataTotal: number[];
  /** Vývoj bez akýchkoľvek poplatkov — referenčná krivka. */
  dataGross: number[];
  /** Hodnota bez poplatkov a dane. */
  grossValue: number;
  /** Hodnota po poplatkoch, pred zdanením. */
  finalBeforeTax: number;
  entryPaid: number;
  annualPaid: number;
  /** Skutočný dopad ročného poplatku vrátane ušlého zhodnotenia. */
  annualImpact: number;
  perfPaid: number;
  tax: number;
  /** Celkový skutočný dopad poplatkov a dane (gross − net). */
  costTotal: number;
  costPct: number;
  hasFees: boolean;
  hasCosts: boolean;
};

declare global {
  interface Window {
    invSwitchVariant?: (id: string) => void;
    invAddVariant?: () => void;
    invRenameVariant?: (id: string) => void;
    invDuplicateVariant?: (id: string) => void;
    invDeleteVariant?: (id: string) => void;
    invOpenComparison?: () => void;
    invCloseComparison?: () => void;
    invSendEmail?: () => void;
    invDownloadPDF?: () => Promise<void>;
  }
}

const cloneData = (obj: InvestFormData) => JSON.parse(JSON.stringify(obj)) as InvestFormData;

export function mountInvesticnaCalculator(): () => void {
  let disposed = false;
  let chartInstance: Chart | null = null;
  let variantCounter = 1;
  let activeVariantId = "v1";
  let variants: Variant[] = [{ id: "v1", name: "Variant 1", data: null }];
  const toggleBtn = document.getElementById("inv-advanced-toggle");
  const contentDiv = document.getElementById("inv-advanced-content");
  const arrowIcon = document.getElementById("inv-arrow-icon");
  const comparisonModal = document.getElementById("inv-comparison-modal");
  const comparisonTable = document.getElementById("inv-compare-table");
  const variantTabsEl = document.getElementById("inv-variant-tabs");
  const addVariantBtn = document.getElementById("inv-add-variant");
  const rateInput = document.getElementById("inv-rate") as HTMLInputElement | null;
  const rateSlider = document.getElementById("inv-rate-slider") as HTMLInputElement | null;

  const advancedToggleHandler = () => {
    if (!contentDiv || !arrowIcon) return;
    const isHidden = window.getComputedStyle(contentDiv).display === "none";
    contentDiv.style.display = isHidden ? "block" : "none";
    arrowIcon.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
    toggleBtn?.setAttribute("aria-expanded", String(isHidden));
  };
  toggleBtn?.addEventListener("click", advancedToggleHandler);

  const feesToggle = document.getElementById("inv-fees-toggle");
  const feesContent = document.getElementById("inv-fees-content");
  const feesToggleHandler = () => {
    if (!feesContent) return;
    const isHidden = window.getComputedStyle(feesContent).display === "none";
    feesContent.style.display = isHidden ? "block" : "none";
    const arrow = document.getElementById("inv-fees-arrow");
    if (arrow) arrow.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
    setText("fees-toggle-label", isHidden ? "Skryť rozpis" : "Zobraziť rozpis");
    feesToggle?.setAttribute("aria-expanded", String(isHidden));
  };
  feesToggle?.addEventListener("click", feesToggleHandler);

  const modalBackdropHandler = (e: MouseEvent) => {
    if (e.target === comparisonModal) window.invCloseComparison?.();
  };
  comparisonModal?.addEventListener("click", modalBackdropHandler);

  const docClickCloseDropdowns = () => {
    document.querySelectorAll("#inv-calc-root .ml-dropdown-menu").forEach((m) => m.classList.remove("open"));
  };
  document.addEventListener("click", docClickCloseDropdowns);

  const formatCurrency = (value: unknown) =>
    new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

  const setText = (idSuffix: string, txt: string) => {
    const el = document.getElementById("inv-" + idSuffix);
    if (el) el.textContent = txt;
  };

  function sanitizeData(data: Partial<InvestFormData> | InvestFormData | null | undefined): InvestFormData {
    const n = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
    return {
      initial: Math.max(0, n(data?.initial, 5000)),
      monthly: Math.max(0, n(data?.monthly, 200)),
      duration: Math.max(1, Math.min(50, Math.round(n(data?.duration, 20)))),
      rate: Math.max(0, n(data?.rate, 8)),
      inflation: Math.max(0, n(data?.inflation, 2)),
      entryFee: Math.max(0, Math.min(100, n(data?.entryFee, 0))),
      annualFee: Math.max(0, Math.min(100, n(data?.annualFee, 0))),
      perfFee: Math.max(0, Math.min(100, n(data?.perfFee, 0))),
      tax: Boolean(data?.tax),
    };
  }

  function getFormData(): InvestFormData {
    const getVal = (id: string): number =>
      parseFloat((document.getElementById("inv-" + id) as HTMLInputElement | null)?.value || "0") || 0;
    return sanitizeData({
      initial: getVal("initial"),
      monthly: getVal("monthly"),
      duration: getVal("duration"),
      rate: getVal("rate"),
      inflation: getVal("inflation"),
      entryFee: getVal("entryFee"),
      annualFee: getVal("annualFee"),
      perfFee: getVal("perfFee"),
      tax: Boolean((document.getElementById("inv-tax") as HTMLInputElement | null)?.checked),
    });
  }

  function setFormData(data: Partial<InvestFormData> | null | undefined): void {
    const d = sanitizeData(data ?? {});
    const setVal = (id: string, value: number) => {
      const el = document.getElementById("inv-" + id) as HTMLInputElement | null;
      if (el) el.value = String(value);
    };
    setVal("initial", d.initial);
    setVal("monthly", d.monthly);
    setVal("duration", d.duration);
    setVal("rate", d.rate);
    setVal("inflation", d.inflation);
    setVal("entryFee", d.entryFee);
    setVal("annualFee", d.annualFee);
    setVal("perfFee", d.perfFee);
    const taxEl = document.getElementById("inv-tax") as HTMLInputElement | null;
    if (taxEl) taxEl.checked = d.tax;
    if (rateSlider) rateSlider.value = String(Math.min(15, Math.max(1, d.rate)));
  }

  function getActiveVariant(): Variant {
    return variants.find((v) => v.id === activeVariantId) ?? variants[0];
  }

  function saveActiveVariant(): void {
    const active = getActiveVariant();
    active.data = getFormData();
  }

  function renderVariantTabs(): void {
    if (!variantTabsEl) return;
    variantTabsEl.innerHTML = "";
    variants.forEach((v) => {
      const wrap = document.createElement("div");
      wrap.className = "ml-dropdown";

      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "ml-variant-tab " + (v.id === activeVariantId ? "active" : "inactive");
      tab.onclick = () => window.invSwitchVariant?.(v.id);

      const label = document.createElement("span");
      label.textContent = v.name;
      tab.appendChild(label);

      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.innerHTML = "⋮";
      menuBtn.setAttribute("aria-label", "Možnosti variantu");
      menuBtn.style.cssText =
        "background:none;border:none;cursor:pointer;padding:2px 4px;color:inherit;font-size:16px;line-height:1;";
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        toggleDropdown(v.id);
      };
      tab.appendChild(menuBtn);

      const menu = document.createElement("div");
      menu.className = "ml-dropdown-menu";
      menu.id = "inv-menu-" + v.id;
      menu.addEventListener("click", (e) => e.stopPropagation());

      const addItem = (text: string, danger: boolean, fn: () => void) => {
        const item = document.createElement("div");
        item.className = "ml-dropdown-item" + (danger ? " danger" : "");
        item.textContent = text;
        item.onclick = (e) => {
          e.stopPropagation();
          fn();
          document.querySelectorAll("#inv-calc-root .ml-dropdown-menu").forEach((m) => m.classList.remove("open"));
        };
        menu.appendChild(item);
      };

      addItem("Premenovať", false, () => window.invRenameVariant?.(v.id));
      addItem("Duplikovať", false, () => window.invDuplicateVariant?.(v.id));
      if (variants.length > 1) addItem("Zmazať", true, () => window.invDeleteVariant?.(v.id));

      wrap.appendChild(tab);
      wrap.appendChild(menu);
      variantTabsEl.appendChild(wrap);
    });
    if (addVariantBtn) addVariantBtn.style.display = variants.length >= 4 ? "none" : "";
  }

  function toggleDropdown(id: string): void {
    document.querySelectorAll("#inv-calc-root .ml-dropdown-menu").forEach((m) => {
      if (m.id === "inv-menu-" + id) m.classList.toggle("open");
      else m.classList.remove("open");
    });
  }

  type FeeSet = { entry: number; annual: number; perf: number };

  type SimResult = {
    final: number;
    series: number[];
    entryPaid: number;
    annualPaid: number;
    perfPaid: number;
  };

  /**
   * Mesačná simulácia portfólia s poplatkami.
   * - vstupný poplatok sa strháva z každého reálne vloženého eura (aj z počiatočného vkladu),
   * - výkonnostný poplatok z každého kladného mesačného zhodnotenia,
   * - ročný poplatok z aktuálnej hodnoty majetku (rozložený na 12 mesiacov).
   * Bez poplatkov dáva rovnaký výsledok ako pôvodný vzorec zloženého úročenia.
   */
  function simulate(d: InvestFormData, fees: FeeSet): SimResult {
    const monthlyRate = (d.rate / 100) / 12;
    const entry = fees.entry / 100;
    const annualM = fees.annual / 100 / 12;
    const perf = fees.perf / 100;

    let value = d.initial * (1 - entry);
    let entryPaid = d.initial * entry;
    let annualPaid = 0;
    let perfPaid = 0;
    const series: number[] = [value];

    for (let m = 1; m <= d.duration * 12; m++) {
      const gain = value * monthlyRate;
      const perfFee = gain > 0 ? gain * perf : 0;
      value += gain - perfFee;
      perfPaid += perfFee;

      const annualFee = value * annualM;
      value -= annualFee;
      annualPaid += annualFee;

      value += d.monthly * (1 - entry);
      entryPaid += d.monthly * entry;

      if (m % 12 === 0) series.push(value);
    }

    return { final: value, series, entryPaid, annualPaid, perfPaid };
  }

  function calculateScenario(data: InvestFormData | null | undefined): ScenarioResult {
    const d = sanitizeData(data ?? {});
    const months = d.duration * 12;
    const inflationRate = d.inflation / 100;

    // Postupné pridávanie poplatkov → dopad každého z nich vrátane ušlého zhodnotenia
    const gross = simulate(d, { entry: 0, annual: 0, perf: 0 });
    const withEntry = simulate(d, { entry: d.entryFee, annual: 0, perf: 0 });
    const withAnnual = simulate(d, { entry: d.entryFee, annual: d.annualFee, perf: 0 });
    const net = simulate(d, { entry: d.entryFee, annual: d.annualFee, perf: d.perfFee });

    const totalInvested = d.initial + d.monthly * months;
    const finalBeforeTax = net.final;
    const gainBeforeTax = finalBeforeTax - totalInvested;
    const tax = d.tax && gainBeforeTax > 0 ? gainBeforeTax * TAX_RATE : 0;
    const finalValue = finalBeforeTax - tax;

    const totalInterest = finalValue - totalInvested;
    const realValue = finalValue / Math.pow(1 + inflationRate, d.duration);
    const interestPercent = finalValue > 0 ? (totalInterest / finalValue) * 100 : 0;
    const roi = totalInvested > 0 ? finalValue / totalInvested : 0;

    const costTotal = gross.final - finalValue;
    const costPct = gross.final > 0 ? (costTotal / gross.final) * 100 : 0;
    const hasFees = d.entryFee > 0 || d.annualFee > 0 || d.perfFee > 0;

    const labels: string[] = [];
    const dataInvested: number[] = [];
    for (let i = 0; i <= d.duration; i++) {
      labels.push("Rok " + i);
      dataInvested.push(d.initial + d.monthly * 12 * i);
    }

    return {
      input: d,
      finalValue,
      totalInvested,
      totalInterest,
      realValue,
      interestPercent,
      roi,
      labels,
      dataInvested,
      dataTotal: net.series,
      dataGross: gross.series,
      grossValue: gross.final,
      finalBeforeTax,
      entryPaid: net.entryPaid,
      annualPaid: withAnnual.annualPaid,
      annualImpact: withEntry.final - withAnnual.final,
      perfPaid: net.perfPaid,
      tax,
      costTotal,
      costPct,
      hasFees,
      hasCosts: hasFees || tax > 0,
    };
  }

  /** Zvislá vodiaca čiara pod kurzorom (crosshair). */
  const hoverLinePlugin: Plugin<"line"> = {
    id: "invHoverLine",
    afterDatasetsDraw(chart) {
      const active = chart.tooltip?.getActiveElements();
      if (!active || active.length === 0) return;
      const x = active[0].element.x;
      const { top, bottom } = chart.chartArea;
      const c = chart.ctx;
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

  /** Koncový bod série zvýrazníme — posledná hodnota je pointa grafu. */
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

  function updateChart(s: ScenarioResult | null): void {
    const canvas = document.getElementById("inv-chart") as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !s || disposed) {
      chartInstance?.destroy();
      chartInstance = null;
      return;
    }

    // Plynulé morfovanie existujúceho grafu namiesto zničenia a prekreslenia
    if (chartInstance) {
      chartInstance.data.labels = s.labels;
      chartInstance.data.datasets[0].data = s.dataTotal;
      chartInstance.data.datasets[1].data = s.dataInvested;
      chartInstance.data.datasets[2].data = s.dataGross;
      chartInstance.data.datasets[2].hidden = !s.hasFees;
      chartInstance.update();
      return;
    }

    // Gradientová výplň podľa aktuálnej plochy grafu (vzor Výnosnosť bytu).
    const gradient = areaGradient("47, 107, 78", 0.28);

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: s.labels,
        datasets: [
          {
            type: "line",
            label: "Hodnota portfólia",
            data: s.dataTotal,
            borderColor: "#2a6647",
            backgroundColor: gradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: lastPointRadius,
            pointHoverRadius: 6,
            pointBackgroundColor: "#2a6647",
            pointBorderColor: "#fffcf7",
            pointBorderWidth: 2,
          },
          {
            type: "line",
            label: "Vklady",
            data: s.dataInvested,
            borderColor: "rgb(169, 157, 126)",
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: "#a99d7e",
            pointBorderColor: "#fffcf7",
            pointBorderWidth: 2,
          },
          {
            type: "line",
            label: "Bez poplatkov",
            data: s.dataGross,
            hidden: !s.hasFees,
            borderColor: "rgb(41, 36, 32)",
            backgroundColor: "transparent",
            borderWidth: 1.5,
            borderDash: [2, 4],
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: "#292420",
            pointBorderColor: "#fffcf7",
            pointBorderWidth: 2,
          },
        ],
      },
      plugins: [hoverLinePlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        interaction: { mode: "index", intersect: false },
        plugins: {
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
              label: (context) => {
                let label = context.dataset.label || "";
                if (label) label += ": ";
                if (context.parsed.y !== null) label += formatCurrency(context.parsed.y);
                return label;
              },
              footer: (items) => {
                const total = items.find((it) => it.datasetIndex === 0)?.parsed.y;
                const invested = items.find((it) => it.datasetIndex === 1)?.parsed.y;
                if (typeof total !== "number" || typeof invested !== "number") return "";
                return "Zisk: +" + formatCurrency(Math.max(0, total - invested));
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
              maxTicksLimit: 8,
              color: "rgba(41, 36, 32, 0.5)",
              font: { family: "Matter, sans-serif", size: 12 },
            },
          },
        },
      },
    });
  }

  function updateUi(s: ScenarioResult): void {
    setText("durationVal", s.input.duration + " rokov");
    setText("finalValue", formatCurrency(s.finalValue));
    setText("totalInterest", formatCurrency(s.totalInterest));
    setText("totalInvested", formatCurrency(s.totalInvested));
    setText("realValue", formatCurrency(s.realValue));
    setText("interestPercent", Math.max(0, s.interestPercent).toFixed(0) + "%");
    setText("roi", (Number.isFinite(s.roi) ? s.roi : 0).toFixed(1) + "x");
    updateFeesUi(s);
    if (rateSlider && document.activeElement !== rateSlider && document.activeElement !== rateInput) {
      rateSlider.value = String(Math.min(15, Math.max(1, s.input.rate)));
    }
    updateChart(s);
  }

  const fmtPct = (v: number, digits = 1) => v.toFixed(digits).replace(".", ",") + " %";

  const show = (idSuffix: string, visible: boolean, display = "") => {
    const el = document.getElementById("inv-" + idSuffix);
    if (el) el.style.display = visible ? display : "none";
  };

  function updateFeesUi(s: ScenarioResult): void {
    const d = s.input;
    show("fees-panel", s.hasCosts);
    show("cost-chip", s.hasCosts);
    show("hero-suffix", s.hasCosts);
    show("legend-gross", s.hasFees);
    if (!s.hasCosts) return;

    setText("grossValue", formatCurrency(s.grossValue));
    setText("costTotalChip", formatCurrency(s.costTotal));
    setText("costTotal", formatCurrency(s.costTotal));
    setText("costTotalHead", formatCurrency(s.costTotal));
    setText("costPctHead", `${fmtPct(s.costPct)} z portfólia bez poplatkov a dane`);
    setText("costHint", `${fmtPct(s.costPct)} z portfólia bez poplatkov a dane`);

    show("row-entry", d.entryFee > 0);
    setText("entryFeeVal", formatCurrency(s.entryPaid));
    setText("entryHint", `${fmtPct(d.entryFee)} z ${formatCurrency(s.totalInvested)}, ktoré reálne vložíš`);

    show("row-annual", d.annualFee > 0);
    setText("annualFeeVal", formatCurrency(s.annualImpact));
    setText(
      "annualHint",
      `${fmtPct(d.annualFee)} p. a.: zaplatené ${formatCurrency(s.annualPaid)} + ušlé zhodnotenie ${formatCurrency(Math.max(0, s.annualImpact - s.annualPaid))}`,
    );

    show("row-perf", d.perfFee > 0);
    setText("perfFeeVal", formatCurrency(s.perfPaid));
    setText("perfHint", `${fmtPct(d.perfFee, 0)} z každého kladného zhodnotenia`);

    show("row-tax", s.tax > 0);
    setText("taxVal", formatCurrency(s.tax));
    setText("taxHint", `19 % zo zisku ${formatCurrency(Math.max(0, s.finalBeforeTax - s.totalInvested))} po poplatkoch`);
  }

  function inv_calculate(): ScenarioResult | null {
    if (disposed) return null;
    saveActiveVariant();
    const active = getActiveVariant();
    const s = calculateScenario(active.data ?? getFormData());
    updateUi(s);
    return s;
  }

  function getAllVariantScenarios(): { variant: Variant; scenario: ScenarioResult }[] {
    saveActiveVariant();
    return variants.map((variant) => ({
      variant,
      scenario: calculateScenario(variant.data ?? getFormData()),
    }));
  }

  function renderComparisonTable(): void {
    if (!comparisonTable) return;
    const rows = getAllVariantScenarios();
    let html = "<thead><tr><th>Ukazovateľ</th>";
    rows.forEach(({ variant }) => {
      html += `<th>${variant.name}</th>`;
    });
    html += "</tr></thead><tbody>";
    const defs: [string, (s: ScenarioResult) => string][] = [
      ["Počiatočný vklad", (s) => formatCurrency(s.input.initial)],
      ["Mesačný vklad", (s) => formatCurrency(s.input.monthly)],
      ["Doba investovania", (s) => `${s.input.duration} rokov`],
      ["Ročný výnos", (s) => `${s.input.rate.toFixed(1).replace(".", ",")} %`],
      ["Inflácia", (s) => `${s.input.inflation.toFixed(1).replace(".", ",")} %`],
      ["Vstupný poplatok", (s) => fmtPct(s.input.entryFee)],
      ["Ročný poplatok", (s) => fmtPct(s.input.annualFee)],
      ["Výkonnostný poplatok", (s) => fmtPct(s.input.perfFee, 0)],
      ["Daň 19 %", (s) => (s.input.tax ? "áno" : "nie")],
      ["Celkový vklad", (s) => formatCurrency(s.totalInvested)],
      ["Poplatky a daň spolu", (s) => formatCurrency(s.costTotal)],
      ["Hodnota portfólia", (s) => formatCurrency(s.finalValue)],
      ["Čistý výnos", (s) => formatCurrency(s.totalInterest)],
      ["Reálna hodnota", (s) => formatCurrency(s.realValue)],
      ["Návratnosť", (s) => `${s.roi.toFixed(2).replace(".", ",")}x`],
      ["Podiel zhodnotenia", (s) => `${Math.max(0, s.interestPercent).toFixed(0)}%`],
    ];
    defs.forEach(([label, fn]) => {
      html += `<tr><td>${label}</td>`;
      rows.forEach(({ scenario }) => {
        html += `<td>${fn(scenario)}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody>";
    comparisonTable.innerHTML = html;
  }

  function buildEmailBody(): string {
    const rows = getAllVariantScenarios();
    const active = rows.find((r) => r.variant.id === activeVariantId) ?? rows[0];
    const date = new Date().toLocaleDateString("sk-SK");
    let body = `Dobrý deň,\n\nTu je prehľad z investičnej kalkulačky (${BRAND}).\nDátum: ${date}\n\n`;

    if (active) {
      const s = active.scenario;
      body += `AKTÍVNA VARIANTA: ${active.variant.name}\n`;
      body += `- Počiatočný vklad: ${formatCurrency(s.input.initial)}\n`;
      body += `- Mesačný vklad: ${formatCurrency(s.input.monthly)}\n`;
      body += `- Doba investovania: ${s.input.duration} rokov\n`;
      body += `- Ročný výnos: ${s.input.rate.toFixed(1).replace(".", ",")} %\n`;
      body += `- Inflácia: ${s.input.inflation.toFixed(1).replace(".", ",")} %\n`;
      body += `- Vstupný poplatok: ${fmtPct(s.input.entryFee)}\n`;
      body += `- Ročný poplatok: ${fmtPct(s.input.annualFee)}\n`;
      body += `- Výkonnostný poplatok: ${fmtPct(s.input.perfFee, 0)}\n`;
      body += `- Daň 19 % z výnosu: ${s.input.tax ? "áno" : "nie"}\n\n`;
      body += `VÝSLEDKY\n`;
      body += `- Celkový vklad: ${formatCurrency(s.totalInvested)}\n`;
      if (s.hasCosts) {
        body += `- Hodnota bez poplatkov a dane: ${formatCurrency(s.grossValue)}\n`;
        body += `- Poplatky a daň spolu (skutočný dopad): ${formatCurrency(s.costTotal)}\n`;
      }
      body += `- Hodnota portfólia: ${formatCurrency(s.finalValue)}\n`;
      body += `- Čistý výnos: ${formatCurrency(s.totalInterest)}\n`;
      body += `- Reálna hodnota (po inflácii): ${formatCurrency(s.realValue)}\n`;
      body += `- Návratnosť: ${s.roi.toFixed(2).replace(".", ",")}x\n`;
      body += `- Podiel zhodnotenia: ${Math.max(0, s.interestPercent).toFixed(0)}%\n\n`;
    }

    if (rows.length > 1) {
      body += `POROVNANIE VARIANTOV\n`;
      rows.forEach(({ variant, scenario }) => {
        body += `- ${variant.name}: portfólio ${formatCurrency(scenario.finalValue)}, čistý výnos ${formatCurrency(scenario.totalInterest)}, ROI ${scenario.roi.toFixed(2).replace(".", ",")}x\n`;
      });
      body += "\n";
    }

    body += `Vygenerované na webe ${BRAND}`;
    return body;
  }

  window.invSwitchVariant = function (id: string): void {
    if (id === activeVariantId) return;
    saveActiveVariant();
    activeVariantId = id;
    const active = getActiveVariant();
    setFormData(active.data ?? getFormData());
    renderVariantTabs();
    inv_calculate();
  };

  window.invAddVariant = function (): void {
    saveActiveVariant();
    if (variants.length >= 4) {
      alert("Maximálny počet variantov je 4.");
      return;
    }
    variantCounter += 1;
    const src = getActiveVariant();
    const data = cloneData(src?.data ?? getFormData());
    const v: Variant = { id: "v" + variantCounter, name: "Variant " + variantCounter, data };
    variants.push(v);
    activeVariantId = v.id;
    setFormData(v.data);
    renderVariantTabs();
    inv_calculate();
  };

  window.invRenameVariant = function (id: string): void {
    const v = variants.find((x) => x.id === id);
    if (!v) return;
    const name = prompt("Nový názov variantu:", v.name);
    if (!name || !name.trim()) return;
    v.name = name.trim();
    renderVariantTabs();
  };

  window.invDuplicateVariant = function (id: string): void {
    if (variants.length >= 4) {
      alert("Maximálny počet variantov je 4.");
      return;
    }
    saveActiveVariant();
    const src = variants.find((x) => x.id === id);
    if (!src) return;
    variantCounter += 1;
    const v: Variant = {
      id: "v" + variantCounter,
      name: src.name + " (kópia)",
      data: cloneData(src.data ?? getFormData()),
    };
    variants.push(v);
    activeVariantId = v.id;
    setFormData(v.data);
    renderVariantTabs();
    inv_calculate();
  };

  window.invDeleteVariant = function (id: string): void {
    if (variants.length <= 1) return;
    if (!confirm("Zmazať tento variant?")) return;
    const wasActive = id === activeVariantId;
    variants = variants.filter((x) => x.id !== id);
    if (!variants.length) return;
    if (wasActive) {
      activeVariantId = variants[0].id;
      setFormData(variants[0].data ?? getFormData());
      renderVariantTabs();
      inv_calculate();
    } else {
      renderVariantTabs();
    }
  };

  window.invOpenComparison = function (): void {
    renderComparisonTable();
    comparisonModal?.classList.add("open");
  };

  window.invCloseComparison = function (): void {
    comparisonModal?.classList.remove("open");
  };

  window.invSendEmail = function (): void {
    const subject = encodeURIComponent(`Investičná kalkulačka — ${BRAND} (${new Date().toLocaleDateString("sk-SK")})`);
    const body = encodeURIComponent(buildEmailBody());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  window.invDownloadPDF = async function (): Promise<void> {
    const wrapper = document.getElementById("inv-calc-root");
    const btn = document.getElementById("inv-btn-pdf");
    if (!wrapper || !btn) return;
    if (btn.getAttribute("data-busy") === "1") return;

    btn.setAttribute("data-busy", "1");
    (btn as HTMLButtonElement).disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = "Pripravujem...";

    const hiddenEls = Array.from(wrapper.querySelectorAll<HTMLElement>(".inv-no-export"));
    const previousDisplays = hiddenEls.map((el) => el.style.display);
    const modalWasOpen = comparisonModal?.classList.contains("open");
    if (modalWasOpen) comparisonModal?.classList.remove("open");

    try {
      inv_calculate();
      hiddenEls.forEach((el) => {
        el.style.display = "none";
      });
      await new Promise((r) => setTimeout(r, 120));

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: "hsl(36 25% 92%)",
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.clientWidth,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageCanvas = document.createElement("canvas");
      const pageCtx = pageCanvas.getContext("2d");
      if (!pageCtx) throw new Error("Canvas context nie je dostupný.");

      const pageHeightPx = Math.floor((canvas.width * pageHeight) / pageWidth);
      let offsetY = 0;
      let pageIndex = 0;

      while (offsetY < canvas.height) {
        const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
        const imgHeightMm = (sliceHeight * pageWidth) / canvas.width;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, imgHeightMm);
        offsetY += sliceHeight;
        pageIndex += 1;
      }

      pdf.save(`${BRAND.replace(/\s+/g, "_")}_investicna_kalkulacka.pdf`);
    } catch (e) {
      console.error(e);
      alert("Nepodarilo sa vygenerovať PDF.");
    } finally {
      hiddenEls.forEach((el, i) => {
        el.style.display = previousDisplays[i];
      });
      if (modalWasOpen) comparisonModal?.classList.add("open");
      btn.innerHTML = oldHtml;
      (btn as HTMLButtonElement).disabled = false;
      btn.removeAttribute("data-busy");
    }
  };

  const inputIds = [
    "inv-initial",
    "inv-monthly",
    "inv-duration",
    "inv-rate",
    "inv-inflation",
    "inv-entryFee",
    "inv-annualFee",
    "inv-perfFee",
    "inv-tax",
  ];
  const inputHandlers: Array<{ el: Element; fn: () => void }> = [];
  inputIds.forEach((id) => {
    const el = document.getElementById(id);
    const fn = () => {
      inv_calculate();
    };
    if (el) {
      el.addEventListener("input", fn);
      el.addEventListener("change", fn);
      inputHandlers.push({ el, fn });
    }
  });

  const rateSliderHandler = function (this: HTMLInputElement): void {
    if (rateInput) rateInput.value = this.value;
    inv_calculate();
  };
  const rateInputHandler = function (this: HTMLInputElement): void {
    if (rateSlider) rateSlider.value = this.value;
  };

  rateSlider?.addEventListener("input", rateSliderHandler);
  rateInput?.addEventListener("input", rateInputHandler);

  variants[0].data = getFormData();
  renderVariantTabs();
  inv_calculate();

  return () => {
    disposed = true;
    toggleBtn?.removeEventListener("click", advancedToggleHandler);
    feesToggle?.removeEventListener("click", feesToggleHandler);
    comparisonModal?.removeEventListener("click", modalBackdropHandler);
    document.removeEventListener("click", docClickCloseDropdowns);
    inputHandlers.forEach(({ el, fn }) => {
      el.removeEventListener("input", fn);
      el.removeEventListener("change", fn);
    });
    rateSlider?.removeEventListener("input", rateSliderHandler);
    rateInput?.removeEventListener("input", rateInputHandler);
    chartInstance?.destroy();
    chartInstance = null;

    delete window.invSwitchVariant;
    delete window.invAddVariant;
    delete window.invRenameVariant;
    delete window.invDuplicateVariant;
    delete window.invDeleteVariant;
    delete window.invOpenComparison;
    delete window.invCloseComparison;
    delete window.invSendEmail;
    delete window.invDownloadPDF;
  };
}
