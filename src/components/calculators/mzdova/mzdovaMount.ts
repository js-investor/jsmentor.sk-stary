import Chart from "chart.js/auto";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

declare global {
  interface Window {
    mzv3SetType?: (t: "emp" | "szco") => void;
    mzv3SetDir?: (d: "gross" | "net") => void;
    mzv3SetNczd?: (v: boolean) => void;
    mzv3Email?: () => void;
    mzv3PDF?: () => void;
  }
}

export function mountMzdovaCalculator(): () => void {
  /** Legislatíva SR 2026 — zladené s Webflow embedom */
  void 5966.73; // NCZD_YEAR (kept for reference)
  const NCZD_MONTH = 497.23;
  const NCZD_FULL_LIMIT_YEAR = 26083.13;
  const NCZD_PHASE_OUT_COEF = 14661.11;
  const NCZD_ZERO_LIMIT_YEAR = 43983.32;
  const BONUS_U15 = 100;
  const BONUS_U18 = 50;
  const TAX1 = 0.19;
  const TAX2 = 0.25;
  const TAX3 = 0.3;
  const TAX4 = 0.35;
  const TAX_THRESHOLD_1 = 3665.28;
  const TAX_THRESHOLD_2 = 5029.1;
  const TAX_THRESHOLD_3 = 6250.86;
  const SOC_MAX_BASE = 16764;
  const EMP_SOC = 0.094;
  const EMP_HEALTH = 0.05;
  const EMP_HEALTH_ZTP = 0.025;
  const EMPR_SOC_CAPPED = 0.244;
  const EMPR_ACCIDENT = 0.008;
  const EMPR_HEALTH = 0.11;
  const EMPR_HEALTH_ZTP = 0.055;
  const SZCO_SOC_RATE = 0.3315;
  const SZCO_HEALTH_RATE = 0.16;
  const SZCO_HEALTH_ZTP = 0.08;
  const SZCO_SOC_MIN_BASE = 914.4;
  const SZCO_HEALTH_MIN_BASE = 762;
  const SZCO_MIN_SOC = 303.11;
  const SZCO_MAX_SOC = 5557.26;
  const SZCO_MIN_HEALTH = 121.92;
  const SZCO_MIN_HEALTH_ZTP = 60.96;

  let disposed = false;
  let chart: Chart | null = null;
  let empType: "emp" | "szco" = "emp";
  let dir: "gross" | "net" = "gross";
  let useNczd = true;

  const root = document.getElementById("mzv3-w");
  if (!root) return () => {};

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const fmt = (v: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      Number.isFinite(v) ? v : 0,
    );
  const fmt0 = (v: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number.isFinite(v) ? v : 0);

  const setText = (id: string, t: string) => {
    const el = $(id);
    if (el) el.textContent = t;
  };

  const pct = (rate: number) =>
    new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 1 }).format(rate * 100);

  const calcTaxMonthly = (taxableBase: number) => {
    const base = Math.max(0, taxableBase);
    if (base <= TAX_THRESHOLD_1) return base * TAX1;
    if (base <= TAX_THRESHOLD_2) {
      return TAX_THRESHOLD_1 * TAX1 + (base - TAX_THRESHOLD_1) * TAX2;
    }
    if (base <= TAX_THRESHOLD_3) {
      return (
        TAX_THRESHOLD_1 * TAX1 +
        (TAX_THRESHOLD_2 - TAX_THRESHOLD_1) * TAX2 +
        (base - TAX_THRESHOLD_2) * TAX3
      );
    }
    return (
      TAX_THRESHOLD_1 * TAX1 +
      (TAX_THRESHOLD_2 - TAX_THRESHOLD_1) * TAX2 +
      (TAX_THRESHOLD_3 - TAX_THRESHOLD_2) * TAX3 +
      (base - TAX_THRESHOLD_3) * TAX4
    );
  };

  const resolveNczdMonthly = (taxBase: number, applyNczd: boolean) => {
    if (!applyNczd) return 0;
    const annualTaxBase = taxBase * 12;
    if (annualTaxBase <= NCZD_FULL_LIMIT_YEAR) return NCZD_MONTH;
    if (annualTaxBase < NCZD_ZERO_LIMIT_YEAR) {
      return Math.max(0, (NCZD_PHASE_OUT_COEF - annualTaxBase / 3) / 12);
    }
    return 0;
  };

  const calcEmp = (gross: number, c15: number, c18: number, ztp: boolean, applyNczd: boolean) => {
    const healthRate = ztp ? EMP_HEALTH_ZTP : EMP_HEALTH;
    const socBase = Math.min(gross, SOC_MAX_BASE);
    const empSoc = socBase * EMP_SOC;
    const empHealth = gross * healthRate;
    const empTotal = empSoc + empHealth;
    const taxBase = gross - empTotal;
    const nczd = resolveNczdMonthly(taxBase, applyNczd);
    const taxableBase = Math.max(0, taxBase - nczd);
    const tax = calcTaxMonthly(taxableBase);
    const bonus = c15 * BONUS_U15 + c18 * BONUS_U18;
    const taxAfterBonus = Math.max(0, tax - bonus);
    const bonusApplied = Math.min(tax, bonus);
    const net = gross - empTotal - taxAfterBonus;

    const emprSocBase = Math.min(gross, SOC_MAX_BASE);
    const emprSoc = emprSocBase * EMPR_SOC_CAPPED + gross * EMPR_ACCIDENT;
    const emprHealthRate = ztp ? EMPR_HEALTH_ZTP : EMPR_HEALTH;
    const emprHealth = gross * emprHealthRate;
    const emprTotal = emprSoc + emprHealth;
    const superGross = gross + emprTotal;
    return {
      gross,
      net,
      empSoc,
      empHealth,
      empTotal,
      taxBase,
      nczd,
      taxableBase,
      tax,
      taxAfterBonus,
      bonusApplied,
      emprSoc,
      emprHealth,
      emprTotal,
      superGross,
      healthRate,
      emprHealthRate,
    };
  };

  const calcEmpFromNet = (net: number, c15: number, c18: number, ztp: boolean, applyNczd: boolean) => {
    let g = net * 1.3;
    for (let i = 0; i < 80; i++) {
      const r = calcEmp(Math.max(0, g), c15, c18, ztp, applyNczd);
      const diff = r.net - net;
      if (Math.abs(diff) < 0.005) break;
      g -= diff * 0.85;
    }
    return calcEmp(Math.max(0, g), c15, c18, ztp, applyNczd);
  };

  const calcSZCO = (income: number, ztp: boolean, useMinBase: boolean, usePausch: boolean) => {
    const healthRate = ztp ? SZCO_HEALTH_ZTP : SZCO_HEALTH_RATE;
    const minHealth = ztp ? SZCO_MIN_HEALTH_ZTP : SZCO_MIN_HEALTH;

    const taxableIncome = usePausch
      ? Math.max(0, income - Math.min(income * 0.6, 20000 / 12))
      : income;

    const rawVmz = taxableIncome * 0.5;
    let socVmz = useMinBase ? SZCO_SOC_MIN_BASE : Math.max(rawVmz, SZCO_SOC_MIN_BASE);
    socVmz = Math.min(socVmz, SOC_MAX_BASE);
    const healthVmz = useMinBase ? SZCO_HEALTH_MIN_BASE : Math.max(rawVmz, SZCO_HEALTH_MIN_BASE);

    const socOdvod =
      socVmz <= SZCO_SOC_MIN_BASE
        ? SZCO_MIN_SOC
        : socVmz >= SOC_MAX_BASE
          ? SZCO_MAX_SOC
          : socVmz * SZCO_SOC_RATE;
    const healthOdvod = healthVmz <= SZCO_HEALTH_MIN_BASE ? minHealth : healthVmz * healthRate;
    const odvodyTotal = socOdvod + healthOdvod;

    const danBase = Math.max(0, taxableIncome - odvodyTotal - NCZD_MONTH);
    const dan = calcTaxMonthly(danBase);
    const net = income - odvodyTotal - dan;

    return {
      income,
      net,
      gross: income,
      vmz: rawVmz,
      socVmz,
      healthVmz,
      socOdvod,
      healthOdvod,
      odvodyTotal,
      taxableIncome,
      danBase,
      dan,
      superGross: odvodyTotal,
      usePausch,
      healthRate,
    };
  };

  const renderChart = (labels: string[], values: number[], colors: string[]) => {
    const canvas = $("mzv3-chart") as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    chart?.destroy();
    chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: "#fffcf7", hoverOffset: 6 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "right",
            labels: {
              font: { family: "Matter, sans-serif", size: 12 },
              color: "#4a4239",
              padding: 12,
              boxWidth: 8,
              boxHeight: 8,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: "rgba(41, 36, 32, 0.96)",
            titleColor: "#f3e9dd",
            bodyColor: "rgba(243, 233, 221, 0.9)",
            borderWidth: 0,
            padding: 12,
            cornerRadius: 12,
            caretSize: 6,
            usePointStyle: true,
            boxPadding: 5,
            titleFont: { family: "Matter, sans-serif", size: 13, weight: 600 },
            bodyFont: { family: "Matter, sans-serif", size: 13 },
            callbacks: {
              label: (c) => {
                const total = (c.dataset.data as number[]).reduce((a, b) => a + b, 0);
                return ` ${fmt(c.raw as number)} (${(((c.raw as number) / total) * 100).toFixed(1)}%)`;
              },
            },
          },
        },
      },
    });
  };

  type BreakdownRow =
    | { sep: string }
    | { total: true; label: string; val: string }
    | { label: string; val: string; cls?: string };

  const renderBreakdownHtml = (rows: BreakdownRow[]) => {
    const bd = $("mzv3-breakdown");
    if (!bd) return;
    bd.innerHTML = rows
      .map((row) => {
        if ("sep" in row) return `<div class="bd-sep">${row.sep}</div>`;
        if ("total" in row) {
          return `<div class="bd-row bd-total"><span class="bd-label">${row.label}</span><span class="bd-val">${row.val}</span></div>`;
        }
        return `<div class="bd-row"><span class="bd-label ${row.cls ?? ""}">${row.label}</span><span class="bd-val ${row.cls ?? ""}">${row.val}</span></div>`;
      })
      .join("");
  };

  const renderBreakdownEmp = (r: ReturnType<typeof calcEmp>) => {
    const rows: BreakdownRow[] = [
      { label: "Hrubá mzda", val: fmt(r.gross) },
      { sep: "Zamestnanec – odvody" },
      { label: `Zdravotné poistenie (${pct(r.healthRate)}%)`, val: `-${fmt(r.empHealth)}`, cls: "bd-neg" },
      { label: "Sociálne poistenie (9,4%)", val: `-${fmt(r.empSoc)}`, cls: "bd-neg" },
      { label: "Základ dane (po odvodoch)", val: fmt(r.taxBase), cls: "text-muted-foreground text-xs" },
      { sep: "Daň z príjmu" },
    ];
    if (r.nczd > 0) rows.push({ label: "Nezdaniteľná časť (NČZD)", val: `-${fmt(r.nczd)}`, cls: "bd-pos" });
    rows.push(
      { label: "Zdaniteľný základ", val: fmt(r.taxableBase), cls: "text-muted-foreground text-xs" },
      { label: "Daň z príjmu (19–35%)", val: `-${fmt(r.tax)}`, cls: "bd-neg" },
    );
    if (r.bonusApplied > 0) {
      rows.push({ label: "Daňový bonus na deti", val: `+${fmt(r.bonusApplied)}`, cls: "bd-pos" });
    }
    rows.push(
      { label: "Čistá daň", val: `-${fmt(r.taxAfterBonus)}`, cls: "bd-neg" },
      { total: true, label: "ČISTÁ MZDA", val: fmt(r.net) },
      { sep: "Zamestnávateľ (navyše)" },
      { label: `Zdravotné poistenie zamestnávateľa (${pct(r.emprHealthRate)}%)`, val: `+${fmt(r.emprHealth)}`, cls: "text-muted-foreground" },
      { label: "Sociálne poistenie zamestnávateľa (24,4% + 0,8%)", val: `+${fmt(r.emprSoc)}`, cls: "text-muted-foreground" },
      { label: "Celkové náklady zamestnávateľa", val: fmt(r.superGross), cls: "font-semibold text-muted-foreground" },
    );
    renderBreakdownHtml(rows);
  };

  const renderBreakdownSzco = (r: ReturnType<typeof calcSZCO>) => {
    const rows: BreakdownRow[] = [{ label: "Hrubý príjem", val: fmt(r.income) }];
    if (r.usePausch) {
      const exp = Math.min(r.income * 0.6, 20000 / 12);
      rows.push(
        { label: "Paušálne výdavky (60%)", val: `-${fmt(exp)}`, cls: "bd-neg" },
        { label: "Základ dane (príjmy – výdavky)", val: fmt(r.taxableIncome), cls: "text-muted-foreground text-xs" },
      );
    }
    rows.push({
      label: "Vymeriavací základ (soc. / zdrav.)",
      val: `${fmt(r.socVmz)} / ${fmt(r.healthVmz)}`,
      cls: "text-muted-foreground text-xs",
    });
    rows.push(
      { sep: "Odvody SZČO" },
      { label: "Sociálne poistenie (33,15%)", val: `-${fmt(r.socOdvod)}`, cls: "bd-neg" },
      { label: `Zdravotné poistenie (${pct(r.healthRate)}%)`, val: `-${fmt(r.healthOdvod)}`, cls: "bd-neg" },
      { label: "Odvody spolu", val: `-${fmt(r.odvodyTotal)}`, cls: "bd-neg font-semibold" },
      { sep: "Daň z príjmu SZČO" },
      { label: "Nezdaniteľná časť (NČZD, 497,23 €)", val: `-${fmt(NCZD_MONTH)}`, cls: "bd-pos" },
      { label: "Zdaniteľný základ", val: fmt(r.danBase), cls: "text-muted-foreground text-xs" },
      { label: "Daň z príjmu (19–35%)", val: `-${fmt(r.dan)}`, cls: "bd-neg" },
      { total: true, label: "ČISTÝ PRÍJEM", val: fmt(r.net) },
    );
    renderBreakdownHtml(rows);
  };

  const calc = () => {
    if (disposed) return;
    const salary = parseFloat(($("mzv3-salary") as HTMLInputElement | null)?.value || "0") || 0;
    const ztp = ($("mzv3-ztpp") as HTMLInputElement | null)?.checked ?? false;

    if (empType === "emp") {
      const c15 = parseInt(($("mzv3-ch15") as HTMLInputElement | null)?.value || "0", 10) || 0;
      const c18 = parseInt(($("mzv3-ch18") as HTMLInputElement | null)?.value || "0", 10) || 0;
      const r = dir === "gross" ? calcEmp(salary, c15, c18, ztp, useNczd) : calcEmpFromNet(salary, c15, c18, ztp, useNczd);
      setText("mzv3-hero-label", dir === "gross" ? "Čistá mzda" : "Zodpovedajúca hrubá mzda");
      setText("mzv3-net", fmt(dir === "gross" ? r.net : r.gross));
      setText("mzv3-net-sub", dir === "gross" ? "" : `Hrubá: ${fmt(r.gross)} / Čistá: ${fmt(r.net)}`);
      setText("mzv3-super", fmt(r.superGross));
      setText("mzv3-second-label", "Náklady zamestnávateľa");
      setText("mzv3-super-sub", "Superhrubá mzda (hrubá + odvody zamestnávateľa)");
      renderBreakdownEmp(r);
      renderChart(
        ["Čistá mzda", "Zdravotné", "Sociálne", "Daň", "Odvody zamestnávateľa"],
        [Math.max(0, r.net), r.empHealth, r.empSoc, r.taxAfterBonus, r.emprTotal],
        ["#2a6647", "#a99d7e", "#ebe4d3", "#ab4132", "#e9e4dc"],
      );
      setText("mzv3-gross-yr", fmt0(r.gross * 12));
      setText("mzv3-net-yr", fmt0(r.net * 12));
      setText("mzv3-odvody-yr", fmt0(r.empTotal * 12));
      setText("mzv3-tax-yr", fmt0(r.taxAfterBonus * 12));
    } else {
      const useMinBase = ($("mzv3-szco-minbase") as HTMLInputElement | null)?.checked ?? false;
      const usePausch = ($("mzv3-szco-pausch") as HTMLInputElement | null)?.checked ?? false;
      const r = calcSZCO(salary, ztp, useMinBase, usePausch);
      setText("mzv3-hero-label", "Čistý príjem SZČO");
      setText("mzv3-net", fmt(r.net));
      setText("mzv3-net-sub", "Po odvodoch a dani z príjmu");
      setText("mzv3-super", fmt(r.odvodyTotal));
      setText("mzv3-second-label", "Celkové odvody SZČO");
      setText("mzv3-super-sub", "Sociálne + zdravotné poistenie / mes.");
      renderBreakdownSzco(r);
      renderChart(
        ["Čistý príjem", "Sociálne odvody", "Zdravotné odvody", "Daň"],
        [Math.max(0, r.net), r.socOdvod, r.healthOdvod, r.dan],
        ["#2a6647", "#a99d7e", "#ebe4d3", "#ab4132"],
      );
      setText("mzv3-gross-yr", fmt0(salary * 12));
      setText("mzv3-net-yr", fmt0(r.net * 12));
      setText("mzv3-odvody-yr", fmt0(r.odvodyTotal * 12));
      setText("mzv3-tax-yr", fmt0(r.dan * 12));
    }
  };

  window.mzv3SetType = (t) => {
    empType = t;
    $("mzv3-t-emp")?.classList.toggle("sel", t === "emp");
    $("mzv3-t-emp")?.setAttribute("aria-pressed", String(t === "emp"));
    $("mzv3-t-szco")?.classList.toggle("sel", t === "szco");
    $("mzv3-t-szco")?.setAttribute("aria-pressed", String(t === "szco"));
    $("mzv3-dir-wrap")?.classList.toggle("hidden", t === "szco");
    $("mzv3-emp-opts")?.classList.toggle("hidden", t === "szco");
    $("mzv3-szco-opts")?.classList.toggle("hidden", t === "emp");
    $("mzv3-szco-income-wrap")?.classList.toggle("hidden", t === "emp");
    const label = $("mzv3-salary-label");
    if (label) label.textContent = t === "emp" ? (dir === "gross" ? "Hrubá mesačná mzda" : "Požadovaná čistá mzda") : "Hrubý mesačný príjem (pred odvodmi)";
    if (t === "szco") window.mzv3SetDir?.("gross");
    calc();
  };

  window.mzv3SetDir = (d) => {
    dir = d;
    $("mzv3-d-gross")?.classList.toggle("sel", d === "gross");
    $("mzv3-d-gross")?.setAttribute("aria-pressed", String(d === "gross"));
    $("mzv3-d-net")?.classList.toggle("sel", d === "net");
    $("mzv3-d-net")?.setAttribute("aria-pressed", String(d === "net"));
    const label = $("mzv3-salary-label");
    if (label) label.textContent = empType === "emp" ? (d === "gross" ? "Hrubá mesačná mzda" : "Požadovaná čistá mzda") : "Hrubý mesačný príjem (pred odvodmi)";
    calc();
  };

  window.mzv3SetNczd = (v) => {
    useNczd = v;
    $("mzv3-nczd-yes")?.classList.toggle("sel", v);
    $("mzv3-nczd-yes")?.setAttribute("aria-pressed", String(v));
    $("mzv3-nczd-no")?.classList.toggle("sel", !v);
    $("mzv3-nczd-no")?.setAttribute("aria-pressed", String(!v));
    calc();
  };

  window.mzv3Email = () => {
    const salary = parseFloat(($("mzv3-salary") as HTMLInputElement | null)?.value || "0") || 0;
    const net = $("mzv3-net")?.textContent || "";
    const superCost = $("mzv3-super")?.textContent || "";
    const type = empType === "emp" ? "Zamestnanec" : "SZČO";
    const body = encodeURIComponent(
      `Mzdová kalkulačka 2026\n\nTyp: ${type}\nHrubá: ${fmt(salary)}\nČistá: ${net}\nNáklady/Odvody: ${superCost}`,
    );
    window.location.href = `mailto:?subject=Mzdová kalkulačka 2026&body=${body}`;
  };

  window.mzv3PDF = () => {
    const ne = root.querySelectorAll<HTMLElement>(".mzv3-ne");
    ne.forEach((e) => (e.style.display = "none"));
    html2canvas(root, { scale: 2, useCORS: true, backgroundColor: "#fcf7ef" })
      .then((c) => {
        const p = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const img = c.toDataURL("image/png");
        const w = p.internal.pageSize.getWidth();
        p.addImage(img, "PNG", 0, 0, w, Math.min((c.height * w) / c.width, 297));
        p.save("mzdova-kalkulacka-2026.pdf");
      })
      .finally(() => ne.forEach((e) => (e.style.display = "")));
  };

  const listen = (selector: string, event: string, fn: EventListener) => {
    const els = Array.from(root.querySelectorAll(selector));
    els.forEach((el) => el.addEventListener(event, fn));
    return () => els.forEach((el) => el.removeEventListener(event, fn));
  };

  const unsubs = [
    listen("input[type=number]", "input", () => calc()),
    listen("input[type=checkbox]", "change", () => calc()),
  ];

  calc();

  return () => {
    disposed = true;
    chart?.destroy();
    unsubs.forEach((u) => u());
    delete window.mzv3SetType;
    delete window.mzv3SetDir;
    delete window.mzv3SetNczd;
    delete window.mzv3Email;
    delete window.mzv3PDF;
  };
}

