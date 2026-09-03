import Chart from "chart.js/auto";
import type { Plugin, ScriptableContext } from "chart.js";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

type Variant = {
  id: number;
  name: string;
  mortgageEnabled: boolean;
  investEnabled: boolean;
  mortgage: { amount: number; years: number; rate: number };
  invest: { initial: number; monthly: number; rate: number };
  events: Array<{ id: number; type: string; year: number; value: number; label: string; valText: string }>;
};

type RunCalcResult = {
  labels: number[];
  dataM: (number | null)[];
  dataI: (number | null)[];
  curM: number;
  curI: number;
  totalInterest: number;
  totalPrincipalInvested: number;
  crossFound: boolean;
  crossYear: number;
  curPMT: number;
  mAmount: number;
  mYears: number;
  mRateInit: number;
  iInitial: number;
  iMonthly: number;
  iRate: number;
};

declare global {
  interface Window {
    _hypoCalcEvents?: Array<{ id: number; type: string; year: number; value: number; label: string; valText: string }>;
    mlSendEmail?: () => void;
    mlOpenComparison?: () => void;
    mlCloseComparison?: () => void;
    mlDownloadPDF?: () => void;
    mlToggleMortgage?: (enabled: boolean) => void;
    mlToggleInvest?: (enabled: boolean) => void;
    mlAddVariant?: () => void;
    mlRenameVariant?: (id: number) => void;
    mlDuplicateVariant?: (id: number) => void;
    mlDeleteVariant?: (id: number) => void;
    mlUpdateComparison?: (yearVal: string) => void;
    addEvent?: () => void;
    removeEvent?: (id: number) => void;
  }
}

const BRAND_SITE = "JS Mentor";

/** Mount calculator logic — DOM nodes must exist (ids from HypotekarnaCalculator.tsx). Returns cleanup for SPA. */
export function mountHypotekarnaCalculator(): () => void {
  let chartInstance: Chart | null = null;
  let disposed = false;

  let variants: Variant[] = [
    {
      id: 1,
      name: "Variant 1",
      mortgageEnabled: true,
      investEnabled: true,
      mortgage: { amount: 150_000, years: 20, rate: 4.9 },
      invest: { initial: 5000, monthly: 250, rate: 6.0 },
      events: [],
    },
  ];
  let activeId = 1;
  let nextId = 2;
  const cachedResults: Record<number, RunCalcResult> = {};

  const fmtCur = (v: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

  const elCurrentDate = document.getElementById("hypo-current-date");
  if (elCurrentDate) elCurrentDate.textContent = new Date().toLocaleDateString("sk-SK");

  const comparisonModal = document.getElementById("hypo-comparison-modal");
  const onModalBackdrop = (e: MouseEvent) => {
    if (e.target === comparisonModal) window.mlCloseComparison?.();
  };
  comparisonModal?.addEventListener("click", onModalBackdrop);

  function renderTabs() {
    const container = document.getElementById("hypo-variant-tabs");
    if (!container) return;
    container.innerHTML = "";
    variants.forEach((v) => {
      const wrap = document.createElement("div");
      wrap.className = "ml-dropdown";
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "ml-variant-tab " + (v.id === activeId ? "active" : "inactive");
      tab.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>${v.name}`;
      tab.onclick = () => {
        saveCurrentVariant();
        switchVariant(v.id);
      };
      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.setAttribute("aria-label", "Možnosti variantu");
      menuBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:2px 4px;color:inherit;font-size:16px;line-height:1;";
      menuBtn.innerHTML = "⋮";
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        toggleDropdown(v.id);
      };
      const menu = document.createElement("div");
      menu.className = "ml-dropdown-menu";
      menu.id = "hypo-menu-" + v.id;
      menu.innerHTML = `<div class="ml-dropdown-item" data-action="rename" data-id="${v.id}">Premenovať</div><div class="ml-dropdown-item" data-action="dup" data-id="${v.id}">Duplikovať</div>${variants.length > 1 ? `<div class="ml-dropdown-item danger" data-action="del" data-id="${v.id}">Zmazať</div>` : ""}`;
      menu.addEventListener("click", (e) => e.stopPropagation());
      menu.querySelectorAll(".ml-dropdown-item").forEach((item) => {
        item.addEventListener("click", (ev) => {
          const t = ev.currentTarget as HTMLElement;
          const id = Number(t.dataset.id);
          const action = t.dataset.action;
          if (action === "rename") window.mlRenameVariant?.(id);
          if (action === "dup") window.mlDuplicateVariant?.(id);
          if (action === "del") window.mlDeleteVariant?.(id);
          document.querySelectorAll(".ml-dropdown-menu").forEach((m) => m.classList.remove("open"));
        });
      });
      tab.appendChild(menuBtn);
      wrap.appendChild(tab);
      wrap.appendChild(menu);
      container.appendChild(wrap);
    });
    if (variants.length < 4) {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "ml-add-variant";
      addBtn.innerHTML = "+";
      addBtn.title = "Pridať variant";
      addBtn.onclick = () => window.mlAddVariant?.();
      container.appendChild(addBtn);
    }
  }

  function toggleDropdown(id: number) {
    document.querySelectorAll(".ml-dropdown-menu").forEach((m) => {
      if (m.id === "hypo-menu-" + id) m.classList.toggle("open");
      else m.classList.remove("open");
    });
  }

  const onDocClick = () => document.querySelectorAll(".ml-dropdown-menu").forEach((m) => m.classList.remove("open"));
  document.addEventListener("click", onDocClick);

  window.mlAddVariant = function () {
    if (variants.length >= 4) return alert("Maximálny počet variantov je 4.");
    saveCurrentVariant();
    const newV: Variant = {
      id: nextId++,
      name: "Variant " + (variants.length + 1),
      mortgageEnabled: true,
      investEnabled: true,
      mortgage: { amount: 150_000, years: 20, rate: 4.9 },
      invest: { initial: 5000, monthly: 250, rate: 6.0 },
      events: [],
    };
    variants.push(newV);
    switchVariant(newV.id);
  };

  window.mlRenameVariant = function (id: number) {
    const v = variants.find((x) => x.id === id);
    if (!v) return;
    const name = prompt("Nový názov variantu:", v.name);
    if (name && name.trim()) {
      v.name = name.trim();
      renderTabs();
    }
  };

  window.mlDuplicateVariant = function (id: number) {
    if (variants.length >= 4) return alert("Maximálny počet variantov je 4.");
    saveCurrentVariant();
    const src = variants.find((x) => x.id === id);
    if (!src) return;
    const newV = JSON.parse(JSON.stringify(src)) as Variant;
    newV.id = nextId++;
    newV.name = src.name + " (kópia)";
    variants.push(newV);
    switchVariant(newV.id);
  };

  window.mlDeleteVariant = function (id: number) {
    if (variants.length <= 1) return;
    if (!confirm("Zmazať tento variant?")) return;
    variants = variants.filter((x) => x.id !== id);
    delete cachedResults[id];
    if (activeId === id) switchVariant(variants[0].id);
    else renderTabs();
  };

  function saveCurrentVariant() {
    const v = variants.find((x) => x.id === activeId);
    if (!v) return;
    const mt = document.getElementById("hypo-mortgage-toggle") as HTMLInputElement | null;
    const it = document.getElementById("hypo-invest-toggle") as HTMLInputElement | null;
    if (mt) v.mortgageEnabled = mt.checked;
    if (it) v.investEnabled = it.checked;
    v.mortgage.amount = parseFloat((document.getElementById("c-mortgage-amount") as HTMLInputElement)?.value || "0") || 0;
    v.mortgage.years = parseFloat((document.getElementById("c-mortgage-years") as HTMLInputElement)?.value || "0") || 0;
    v.mortgage.rate = parseFloat((document.getElementById("c-mortgage-rate") as HTMLInputElement)?.value || "0") || 0;
    v.invest.initial = parseFloat((document.getElementById("c-invest-initial") as HTMLInputElement)?.value || "0") || 0;
    v.invest.monthly = parseFloat((document.getElementById("c-invest-monthly") as HTMLInputElement)?.value || "0") || 0;
    v.invest.rate = parseFloat((document.getElementById("c-invest-rate") as HTMLInputElement)?.value || "0") || 0;
  }

  function loadVariant(id: number) {
    const v = variants.find((x) => x.id === id);
    if (!v) return;
    activeId = id;
    const mt = document.getElementById("hypo-mortgage-toggle") as HTMLInputElement | null;
    const it = document.getElementById("hypo-invest-toggle") as HTMLInputElement | null;
    if (mt) mt.checked = v.mortgageEnabled;
    if (it) it.checked = v.investEnabled;
    const gamount = document.getElementById("c-mortgage-amount") as HTMLInputElement | null;
    const gyears = document.getElementById("c-mortgage-years") as HTMLInputElement | null;
    const grate = document.getElementById("c-mortgage-rate") as HTMLInputElement | null;
    const gi0 = document.getElementById("c-invest-initial") as HTMLInputElement | null;
    const gim = document.getElementById("c-invest-monthly") as HTMLInputElement | null;
    const gir = document.getElementById("c-invest-rate") as HTMLInputElement | null;
    if (gamount) gamount.value = String(v.mortgage.amount);
    if (gyears) gyears.value = String(v.mortgage.years);
    if (grate) grate.value = String(v.mortgage.rate);
    if (gi0) gi0.value = String(v.invest.initial);
    if (gim) gim.value = String(v.invest.monthly);
    if (gir) gir.value = String(v.invest.rate);
    applyToggleUI(v.mortgageEnabled, v.investEnabled);
    window._hypoCalcEvents = v.events;
    renderEvents();
  }

  function switchVariant(id: number) {
    activeId = id;
    loadVariant(id);
    renderTabs();
    calculateAll();
  }

  window.mlToggleMortgage = function (enabled: boolean) {
    applyToggleUI(enabled, !!(document.getElementById("hypo-invest-toggle") as HTMLInputElement)?.checked);
    calculateAll();
  };

  window.mlToggleInvest = function (enabled: boolean) {
    applyToggleUI(!!(document.getElementById("hypo-mortgage-toggle") as HTMLInputElement)?.checked, enabled);
    calculateAll();
  };

  function applyToggleUI(mEnabled: boolean, iEnabled: boolean) {
    const mFields = document.getElementById("hypo-mortgage-fields");
    const iFields = document.getElementById("hypo-invest-fields");
    if (mFields) {
      mFields.style.opacity = mEnabled ? "1" : "0.4";
      mFields.style.pointerEvents = mEnabled ? "" : "none";
    }
    if (iFields) {
      iFields.style.opacity = iEnabled ? "1" : "0.4";
      iFields.style.pointerEvents = iEnabled ? "" : "none";
    }
  }

  const evtToggle = document.getElementById("hypo-evt-accordion-toggle");
  const accordionHandler = () => {
    const c = document.getElementById("hypo-evt-accordion-content");
    const icon = document.getElementById("hypo-evt-accordion-icon");
    if (!c || !icon) return;
    const isClosed = window.getComputedStyle(c).display === "none";
    c.style.display = isClosed ? "block" : "none";
    icon.style.transform = isClosed ? "rotate(180deg)" : "rotate(0deg)";
    evtToggle?.setAttribute("aria-expanded", String(isClosed));
  };
  evtToggle?.addEventListener("click", accordionHandler);

  window._hypoCalcEvents = variants[0].events;

  window.addEvent = function () {
    const sel = document.getElementById("evt-type") as HTMLSelectElement | null;
    const yEl = document.getElementById("evt-year") as HTMLInputElement | null;
    const vEl = document.getElementById("evt-value") as HTMLInputElement | null;
    if (!sel || !yEl || !vEl) return;
    const type = sel.value;
    const year = parseInt(yEl.value, 10);
    const value = parseFloat(vEl.value);
    if (!year || Number.isNaN(value)) return;
    const labels: Record<string, string> = {
      hypo_extra: "Hypo: Mimoriadna splátka",
      hypo_rate: "Hypo: Zmena úroku",
      invest_deposit: "Invest: Mimoriadny vklad",
      invest_withdraw: "Invest: Výber",
    };
    const valTexts: Record<string, string> = {
      hypo_extra: "- " + fmtCur(value),
      hypo_rate: value + " %",
      invest_deposit: "+ " + fmtCur(value),
      invest_withdraw: "- " + fmtCur(value),
    };
    const ev = window._hypoCalcEvents ?? [];
    ev.push({ id: Date.now(), type, year, value, label: labels[type] ?? type, valText: valTexts[type] ?? "" });
    ev.sort((a, b) => a.year - b.year);
    window._hypoCalcEvents = ev;
    const v = variants.find((x) => x.id === activeId);
    if (v) v.events = ev;
    renderEvents();
    calculateAll();
  };

  window.removeEvent = function (id: number) {
    const ev = (window._hypoCalcEvents ?? []).filter((e) => e.id !== id);
    window._hypoCalcEvents = ev;
    const v = variants.find((x) => x.id === activeId);
    if (v) v.events = ev;
    renderEvents();
    calculateAll();
  };

  function renderEvents() {
    const list = document.getElementById("hypo-events-list");
    const badge = document.getElementById("hypo-event-count-badge");
    if (!list || !badge) return;
    list.innerHTML = "";
    const evts = window._hypoCalcEvents ?? [];
    if (evts.length === 0) {
      list.innerHTML =
        '<p class="hypo-evt-empty">Zatiaľ žiadne pridané udalosti.</p>';
      badge.style.display = "none";
    } else {
      badge.textContent = String(evts.length);
      badge.style.display = "inline-block";
      evts.forEach((evt) => {
        const div = document.createElement("div");
        div.className = "hypo-evt-item";
        div.innerHTML = `<div class="hypo-evt-item-main"><span class="hypo-evt-year">${evt.year}.</span><span class="hypo-evt-label">${evt.label}</span></div><div class="hypo-evt-item-side"><span class="hypo-evt-val">${evt.valText}</span><button type="button" class="hypo-evt-remove" data-remove="${evt.id}" aria-label="Odstrániť udalosť">✕</button></div>`;
        div.querySelector("button[data-remove]")?.addEventListener("click", () => window.removeEvent?.(evt.id));
        list.appendChild(div);
      });
    }
  }

  function calcPMT(p: number, r: number, n: number) {
    if (p <= 0 || n <= 0) return 0;
    if (r === 0) return p / n;
    return (p * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
  }

  function runCalc(v: Variant, atMonth: number | null): RunCalcResult {
    const mEnabled = v.mortgageEnabled;
    const iEnabled = v.investEnabled;
    const mAmount = v.mortgage.amount;
    const mYears = v.mortgage.years;
    const mRateInit = v.mortgage.rate;
    const iInitial = v.invest.initial;
    const iMonthly = v.invest.monthly;
    const iRate = v.invest.rate;
    const totalMonths = mYears * 12;
    let curM = mAmount;
    let curI = iInitial;
    let curHRate = mRateInit;
    let totalInterest = 0;
    let totalPrincipalInvested = iInitial;
    let curMR = (curHRate / 100) / 12;
    let curPMT = mEnabled ? calcPMT(curM, curMR, totalMonths) : 0;
    const labels: number[] = [0];
    const dataM: (number | null)[] = [mEnabled ? mAmount : null];
    const dataI: (number | null)[] = [iEnabled ? iInitial : null];
    let crossFound = false;
    let crossYear = 0;
    const maxM = atMonth ?? totalMonths;
    for (let m = 1; m <= maxM; m++) {
      const yr = Math.ceil(m / 12);
      if (m % 12 === 1) {
        v.events
          .filter((e) => e.year === yr)
          .forEach((evt) => {
            if (mEnabled) {
              if (evt.type === "hypo_extra") {
                curM -= evt.value;
                if (curM < 0) curM = 0;
                curPMT = calcPMT(curM, curMR, totalMonths - m + 1);
              }
              if (evt.type === "hypo_rate") {
                curHRate = evt.value;
                curMR = (curHRate / 100) / 12;
                curPMT = calcPMT(curM, curMR, totalMonths - m + 1);
              }
            }
            if (iEnabled) {
              if (evt.type === "invest_deposit") {
                curI += evt.value;
                totalPrincipalInvested += evt.value;
              }
              if (evt.type === "invest_withdraw") curI -= evt.value;
            }
          });
      }
      if (mEnabled && curM > 0) {
        const interest = curM * curMR;
        let principal = curPMT - interest;
        if (principal > curM) principal = curM;
        totalInterest += interest;
        curM -= principal;
      }
      if (iEnabled) {
        curI = curI * (1 + (iRate / 100) / 12) + iMonthly;
        totalPrincipalInvested += iMonthly;
      }
      if (m % 12 === 0) {
        labels.push(yr);
        dataM.push(mEnabled ? curM : null);
        dataI.push(iEnabled ? curI : null);
        if (!crossFound && mEnabled && iEnabled && curI >= curM) {
          crossFound = true;
          crossYear = yr;
        }
      }
    }
    return {
      labels,
      dataM,
      dataI,
      curM,
      curI,
      totalInterest,
      totalPrincipalInvested,
      crossFound,
      crossYear,
      curPMT: mEnabled ? calcPMT(mAmount, (mRateInit / 100) / 12, totalMonths) : 0,
      mAmount,
      mYears,
      mRateInit,
      iInitial,
      iMonthly,
      iRate,
    };
  }

  function calculateAll() {
    if (disposed) return;
    const v = variants.find((x) => x.id === activeId);
    if (!v) return;
    const mt = document.getElementById("hypo-mortgage-toggle") as HTMLInputElement | null;
    const it = document.getElementById("hypo-invest-toggle") as HTMLInputElement | null;
    if (mt) v.mortgageEnabled = mt.checked;
    if (it) v.investEnabled = it.checked;
    v.mortgage.amount = parseFloat((document.getElementById("c-mortgage-amount") as HTMLInputElement)?.value || "0") || 0;
    v.mortgage.years = parseFloat((document.getElementById("c-mortgage-years") as HTMLInputElement)?.value || "0") || 0;
    v.mortgage.rate = parseFloat((document.getElementById("c-mortgage-rate") as HTMLInputElement)?.value || "0") || 0;
    v.invest.initial = parseFloat((document.getElementById("c-invest-initial") as HTMLInputElement)?.value || "0") || 0;
    v.invest.monthly = parseFloat((document.getElementById("c-invest-monthly") as HTMLInputElement)?.value || "0") || 0;
    v.invest.rate = parseFloat((document.getElementById("c-invest-rate") as HTMLInputElement)?.value || "0") || 0;
    const evSrc = window._hypoCalcEvents ?? [];
    v.events = [...evSrc];

    const r = runCalc(v, null);
    cachedResults[v.id] = r;

    const setTxt = (id: string, t: string) => {
      const e = document.getElementById(id);
      if (e) e.textContent = t;
    };
    setTxt("c-monthly-payment", v.mortgageEnabled ? fmtCur(r.curPMT) : "—");
    setTxt("c-total-paid", v.mortgageEnabled ? fmtCur(v.mortgage.amount + r.totalInterest) : "—");
    setTxt("c-invest-final", v.investEnabled ? fmtCur(r.curI) : "—");
    setTxt("c-invest-profit", v.investEnabled ? "+" + fmtCur(r.curI - r.totalPrincipalInvested) : "—");
    setTxt("res-mortgage-total", v.mortgageEnabled ? fmtCur(v.mortgage.amount + r.totalInterest) : "—");
    setTxt("res-invest-principal", v.investEnabled ? fmtCur(r.totalPrincipalInvested) : "—");
    setTxt("res-net-worth", fmtCur((v.investEnabled ? r.curI : 0) - (v.mortgageEnabled ? r.curM : 0)));
    const cInfo = document.getElementById("hypo-crossover-info");
    if (cInfo) {
      cInfo.style.display = r.crossFound ? "block" : "none";
      if (r.crossFound) setTxt("crossover-year", r.crossYear + ". roku");
    }
    updateChart(r.labels, r.dataM, r.dataI, v.mortgageEnabled, v.investEnabled, false);
  }

  /** Zvislá vodiaca čiara pod kurzorom (crosshair). */
  const hoverLinePlugin: Plugin<"line"> = {
    id: "hypoHoverLine",
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

  function updateChart(
    labels: number[],
    dataM: (number | null)[],
    dataI: (number | null)[],
    mEnabled: boolean,
    iEnabled: boolean,
    isStatic = false,
  ) {
    const canvas = document.getElementById("compareChart") as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || disposed) {
      chartInstance?.destroy();
      chartInstance = null;
      return;
    }

    const chartLabels = labels.map((y) => "Rok " + y);

    // Plynulé morfovanie existujúceho grafu namiesto zničenia a prekreslenia
    if (chartInstance) {
      chartInstance.data.labels = chartLabels;
      chartInstance.data.datasets[0].data = dataM;
      chartInstance.data.datasets[1].data = dataI;
      chartInstance.setDatasetVisibility(0, mEnabled);
      chartInstance.setDatasetVisibility(1, iEnabled);
      const tooltipOpts = chartInstance.options.plugins?.tooltip;
      if (tooltipOpts) tooltipOpts.enabled = !isStatic;
      chartInstance.update();
      return;
    }

    // Gradientové výplne podľa aktuálnej plochy grafu (vzor Výnosnosť bytu).
    const gM = areaGradient("201, 87, 63", 0.12);
    const gI = areaGradient("47, 107, 78", 0.28);

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: chartLabels,
        datasets: [
          {
            type: "line",
            label: "Zostatok hypotéky",
            data: dataM,
            borderColor: "#ab4132",
            backgroundColor: gM,
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: lastPointRadius,
            pointHoverRadius: 6,
            pointBackgroundColor: "#ab4132",
            pointBorderColor: "#fffcf7",
            pointBorderWidth: 2,
            hidden: !mEnabled,
          },
          {
            type: "line",
            label: "Hodnota investície",
            data: dataI,
            borderColor: "#2a6647",
            backgroundColor: gI,
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: lastPointRadius,
            pointHoverRadius: 6,
            pointBackgroundColor: "#2a6647",
            pointBorderColor: "#fffcf7",
            pointBorderWidth: 2,
            hidden: !iEnabled,
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
            enabled: !isStatic,
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
                if (context.parsed.y !== null) label += fmtCur(context.parsed.y);
                return label;
              },
              footer: (items) => {
                const mortgage = items.find((it) => it.datasetIndex === 0)?.parsed.y;
                const invest = items.find((it) => it.datasetIndex === 1)?.parsed.y;
                if (typeof mortgage !== "number" && typeof invest !== "number") return "";
                const net =
                  (typeof invest === "number" ? invest : 0) -
                  (typeof mortgage === "number" ? mortgage : 0);
                return "Čistý majetok: " + fmtCur(net);
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

  window.mlOpenComparison = function () {
    variants.forEach((v) => {
      saveCurrentVariant();
      cachedResults[v.id] = runCalc(v, null);
    });
    const maxYears = Math.max(...variants.map((v) => v.mortgage.years));
    const slider = document.getElementById("ml-compare-slider") as HTMLInputElement | null;
    if (slider) {
      slider.max = String(maxYears);
      slider.value = "0";
    }
    const maxEl = document.getElementById("ml-slider-max");
    const labEl = document.getElementById("ml-slider-label");
    if (maxEl) maxEl.textContent = String(maxYears);
    if (labEl) labEl.textContent = "0";
    window.mlUpdateComparison?.("0");
    document.getElementById("hypo-comparison-modal")?.classList.add("open");
  };

  window.mlCloseComparison = function () {
    document.getElementById("hypo-comparison-modal")?.classList.remove("open");
  };

  window.mlUpdateComparison = function (yearVal: string) {
    const yr = parseInt(yearVal, 10);
    const lab = document.getElementById("ml-slider-label");
    if (lab) lab.textContent = String(yr);
    const snapshots = variants.map((v) => ({ v, r: runCalc(v, yr * 12) }));
    const table = document.getElementById("ml-compare-table");
    if (!table) return;
    let html = "<thead><tr><th>Ukazovateľ</th>";
    variants.forEach((v) => {
      html += `<th>${v.name}</th>`;
    });
    html += "</tr></thead><tbody>";
    html += `<tr class="section-header"><td colspan="${variants.length + 1}">Hypotéka</td></tr>`;
    const mRows: [string, (v: Variant, r: RunCalcResult) => string][] = [
      ["Výška úveru", (v) => (v.mortgageEnabled ? fmtCur(v.mortgage.amount) : "—")],
      ["Doba splácania", (v) => (v.mortgageEnabled ? v.mortgage.years + " rokov" : "—")],
      ["Úroková sadzba", (v) => (v.mortgageEnabled ? v.mortgage.rate + " %" : "—")],
      ["Mesačná splátka", (v, r) => (v.mortgageEnabled ? fmtCur(r.curPMT) : "—")],
      ["Zostatok úveru", (v, r) => (v.mortgageEnabled ? fmtCur(r.curM) : "—")],
      ["Zaplatené na úrokoch", (v, r) => (v.mortgageEnabled ? fmtCur(r.totalInterest) : "—")],
    ];
    mRows.forEach(([label, fn]) => {
      html += `<tr><td style="color:var(--fg3);">${label}</td>`;
      snapshots.forEach(({ v, r }) => {
        html += `<td>${fn(v, r)}</td>`;
      });
      html += "</tr>";
    });
    html += `<tr class="section-header"><td colspan="${variants.length + 1}">Investícia</td></tr>`;
    const iRows: [string, (v: Variant, r: RunCalcResult) => string][] = [
      ["Jednorazový vklad", (v) => (v.investEnabled ? fmtCur(v.invest.initial) : "—")],
      ["Mesačná investícia", (v) => (v.investEnabled ? fmtCur(v.invest.monthly) : "—")],
      ["Zhodnotenie p.a.", (v) => (v.investEnabled ? v.invest.rate + " %" : "—")],
      ["Hodnota investície", (v, r) => (v.investEnabled ? fmtCur(r.curI) : "—")],
      ["Vložené celkom", (v, r) => (v.investEnabled ? fmtCur(r.totalPrincipalInvested) : "—")],
      ["Čistý výnos", (v, r) => (v.investEnabled ? fmtCur(r.curI - r.totalPrincipalInvested) : "—")],
    ];
    iRows.forEach(([label, fn]) => {
      html += `<tr><td style="color:var(--fg3);">${label}</td>`;
      snapshots.forEach(({ v, r }) => {
        html += `<td>${fn(v, r)}</td>`;
      });
      html += "</tr>";
    });
    html += `<tr class="section-header"><td colspan="${variants.length + 1}">Výsledok</td></tr>`;
    html += '<tr class="highlight"><td>Čistý majetok</td>';
    snapshots.forEach(({ v, r }) => {
      const net = (v.investEnabled ? r.curI : 0) - (v.mortgageEnabled ? r.curM : 0);
      html += `<td style="color:${net >= 0 ? "#2a6647" : "#ab4132"}">${fmtCur(net)}</td>`;
    });
    html += "</tr></tbody>";
    table.innerHTML = html;
  };

  window.mlSendEmail = function () {
    const v = variants.find((x) => x.id === activeId);
    if (!v) return;
    const r = cachedResults[activeId] ?? runCalc(v, null);
    const date = new Date().toLocaleDateString("sk-SK");
    const subject = encodeURIComponent(`Finančný report: Hypotéka vs. investovanie (${date})`);
    const body = encodeURIComponent(`Dobrý deň,

tu je detailný prehľad finančnej simulácie z ${BRAND_SITE}.
VARIANTA: ${v.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HYPOTÉKA ${v.mortgageEnabled ? "" : "(vypnutá)"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Výška úveru:        ${fmtCur(v.mortgage.amount)}
Doba splácania:     ${v.mortgage.years} rokov
Úroková sadzba:     ${v.mortgage.rate} %
Mesačná splátka:    ${v.mortgageEnabled ? fmtCur(r.curPMT) : "—"}
Celkovo zaplatíte:  ${v.mortgageEnabled ? fmtCur(v.mortgage.amount + r.totalInterest) : "—"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVESTÍCIA ${v.investEnabled ? "" : "(vypnutá)"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Jednorazový vklad:  ${fmtCur(v.invest.initial)}
Mesačná investícia: ${fmtCur(v.invest.monthly)}
Zhodnotenie p.a.:   ${v.invest.rate} %
Hodnota na konci:   ${v.investEnabled ? fmtCur(r.curI) : "—"}
Čistý zisk:         ${v.investEnabled ? fmtCur(r.curI - r.totalPrincipalInvested) : "—"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VÝSLEDOK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Čistý majetok na konci: ${fmtCur((v.investEnabled ? r.curI : 0) - (v.mortgageEnabled ? r.curM : 0))}
${r.crossFound ? "Bod zlomu: Investícia presiahne hypotéku v " + r.crossYear + ". roku" : ""}
${v.events.length > 0 ? "\nUDALOSTI:\n" + v.events.map((e) => `  • Rok ${e.year}: ${e.label} (${e.valText})`).join("\n") : ""}
Vygenerované dňa ${date} — ${BRAND_SITE}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  window.mlDownloadPDF = function () {
    const btns = [document.getElementById("btn-pdf-top"), document.getElementById("btn-pdf-bottom")];
    const oldHtml = btns.map((b) => (b ? b.innerHTML : ""));
    btns.forEach((b) => {
      if (b) b.innerHTML = "Pripravujem...";
    });
    saveCurrentVariant();
    const originalActiveId = activeId;
    let selectedVariantId = activeId;
    if (variants.length > 1) {
      const options = variants
        .map((v, i) => `${i + 1}. ${v.name}${v.id === activeId ? " (aktuálna)" : ""}`)
        .join("\n");
      const picked = prompt(`Vyber variant pre PDF (zadaj číslo):\n${options}`, String(variants.findIndex((v) => v.id === activeId) + 1));
      if (picked === null) {
        btns.forEach((b, i) => {
          if (b) b.innerHTML = oldHtml[i] ?? "";
        });
        return;
      }
      const idx = parseInt(picked, 10) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= variants.length) {
        alert("Neplatný výber variantu.");
        btns.forEach((b, i) => {
          if (b) b.innerHTML = oldHtml[i] ?? "";
        });
        return;
      }
      selectedVariantId = variants[idx].id;
    }
    if (selectedVariantId !== activeId) switchVariant(selectedVariantId);
    const v = variants.find((x) => x.id === selectedVariantId);
    if (!v) {
      btns.forEach((b, i) => {
        if (b) b.innerHTML = oldHtml[i] ?? "";
      });
      return;
    }
    const r = cachedResults[selectedVariantId] ?? runCalc(v, null);
    updateChart(r.labels, r.dataM, r.dataI, v.mortgageEnabled, v.investEnabled, true);

    setTimeout(() => {
      const liveCanvas = document.querySelector("#compareChart") as HTMLCanvasElement | null;
      const chartDataUrl = liveCanvas ? liveCanvas.toDataURL("image/png", 1.0) : null;
      const sourceEl = document.querySelector(".hypo-print-container");
      if (!sourceEl) {
        btns.forEach((b, i) => {
          if (b) b.innerHTML = oldHtml[i] ?? "";
        });
        return;
      }
      const clone = sourceEl.cloneNode(true) as HTMLElement;
      if (chartDataUrl) {
        const cc = clone.querySelector("canvas");
        if (cc) {
          const liveC = document.querySelector("#compareChart") as HTMLCanvasElement;
          const ar = liveC.width / liveC.height;
          const imgW = 840;
          const imgH = Math.round(imgW / ar);
          const img = document.createElement("img");
          img.src = chartDataUrl;
          img.style.cssText = `width:100%;height:${imgH}px;display:block;object-fit:fill;`;
          const parent = cc.parentElement;
          if (parent) {
            parent.style.height = imgH + "px";
            parent.replaceChild(img, cc);
          }
        }
      }
      document.querySelectorAll("#hypo-compare-wrapper input, #hypo-compare-wrapper select").forEach((inp) => {
        if (!(inp instanceof HTMLInputElement) && !(inp instanceof HTMLSelectElement)) return;
        const id = inp.id;
        if (!id) return;
        const twin = clone.querySelector(`#${CSS.escape(id)}`);
        if (twin instanceof HTMLInputElement || twin instanceof HTMLSelectElement) twin.value = inp.value;
      });
      const savedScroll = window.scrollY;
      window.scrollTo(0, 0);
      const pdfWrapper = document.createElement("div");
      // Klon nesie triedy koreňa, aby preň platili tokeny a štýly nástroja (bez vstupnej animácie a závoja).
      pdfWrapper.className = "calc-ui hypo-calc hypo-pdf-export";
      pdfWrapper.style.cssText =
        "position:absolute;top:0;left:0;width:900px;background:#f3eee8;padding:30px;box-sizing:border-box;z-index:99999;";
      pdfWrapper.appendChild(clone);
      document.body.appendChild(pdfWrapper);

      const finishPdf = () => {
        if (document.body.contains(pdfWrapper)) document.body.removeChild(pdfWrapper);
        window.scrollTo(0, savedScroll);
        if (selectedVariantId !== originalActiveId) switchVariant(originalActiveId);
        else updateChart(r.labels, r.dataM, r.dataI, v.mortgageEnabled, v.investEnabled, false);
        btns.forEach((b, i) => {
          if (b) b.innerHTML = oldHtml[i] ?? "";
        });
      };

      setTimeout(() => {
        const totalHeight = pdfWrapper.offsetHeight;
        html2canvas(pdfWrapper, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: 900,
          height: totalHeight,
          windowWidth: 1200,
          windowHeight: totalHeight + 200,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
        })
          .then((canvas) => {
            const imgData = canvas.toDataURL("image/jpeg", 0.98);
            const pdfW = 595;
            const pdfH = (canvas.height / canvas.width) * pdfW;
            const pdf = new jsPDF({ unit: "px", format: [pdfW, pdfH], orientation: "portrait", hotfixes: ["px_scaling"] });
            pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
            pdf.save(`${BRAND_SITE.replace(/\s+/g, "_")}_hypoteka_report.pdf`);
            finishPdf();
          })
          .catch((err) => {
            console.error(err);
            finishPdf();
          });
      }, 300);
    }, 700);
  };

  const inputIds = [
    "c-mortgage-amount",
    "c-mortgage-years",
    "c-mortgage-rate",
    "c-invest-initial",
    "c-invest-monthly",
    "c-invest-rate",
  ];
  const inputListeners: Array<{ el: Element; fn: () => void }> = [];
  inputIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      const fn = () => calculateAll();
      el.addEventListener("input", fn);
      inputListeners.push({ el, fn });
    }
  });

  renderTabs();
  const t = window.setTimeout(() => {
    if (!disposed) calculateAll();
  }, 500);

  return () => {
    disposed = true;
    window.clearTimeout(t);
    comparisonModal?.removeEventListener("click", onModalBackdrop);
    document.removeEventListener("click", onDocClick);
    evtToggle?.removeEventListener("click", accordionHandler);
    inputListeners.forEach(({ el, fn }) => el.removeEventListener("input", fn));
    chartInstance?.destroy();
    chartInstance = null;

    delete window.mlSendEmail;
    delete window.mlOpenComparison;
    delete window.mlCloseComparison;
    delete window.mlDownloadPDF;
    delete window.mlToggleMortgage;
    delete window.mlToggleInvest;
    delete window.mlAddVariant;
    delete window.mlRenameVariant;
    delete window.mlDuplicateVariant;
    delete window.mlDeleteVariant;
    delete window.mlUpdateComparison;
    delete window.addEvent;
    delete window.removeEvent;
    delete window._hypoCalcEvents;
  };
}
