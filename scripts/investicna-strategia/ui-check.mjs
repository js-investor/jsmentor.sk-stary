// Funkčná kontrola nástroja Investičná stratégia v prehliadači. Spúšťa sa len proti lokálnemu serveru, nikdy proti ostrej stránke.
//
//   mkdir -p /tmp/pptr && cd /tmp/pptr && npm i puppeteer-core     (raz; projekt puppeteer medzi závislosťami nemá)
//   cd /tmp/pptr && node "<repo>/scripts/investicna-strategia/ui-check.mjs" http://localhost:8080
//
// Očakávané hodnoty scenárov číta z out/ui_expected.json (vytvorí ho build_module.py). Texty a čísla napísané priamo
// v kontrolách patria k dátam končiacim 31. 8. 2026; po obnovení dát ich treba upraviť.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const puppeteer = createRequire(join(process.cwd(), "x.js"))("puppeteer-core");
const HERE = dirname(fileURLToPath(import.meta.url));
const [origin = "http://localhost:8080", expectedPath = join(HERE, "out", "ui_expected.json")] = process.argv.slice(2);
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
  console.error("Kontrola kliká a píše do formulárov, preto beží len proti lokálnemu serveru.");
  process.exit(2);
}
const E = JSON.parse(readFileSync(expectedPath, "utf8"));
const URL_TOOL = `${origin}/bonusy/investicna-strategia`;
const NB = " ";
const money = (n, cur = "€") => `${Math.round(n).toLocaleString("sk-SK")}${NB}${cur}`;
const pct = (x, d = 1) => `${(x * 100).toLocaleString("sk-SK", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−")}${NB}%`;
const norm = (s) => (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

let pass = 0, fail = 0;
const ok = (cond, name, detail = "") => { if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, detail); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-first-run", "--hide-scrollbars"] });
const errors = [];
const open = async (width, height = 1000, url = URL_TOOL, keep = false) => {
  const page = await browser.newPage();
  const mobile = width < 700;
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  if (!keep) await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem("ist-test-keep")) localStorage.removeItem("jsm_investicna_strategia_v2"); } catch { /* nič */ } });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  await page.waitForSelector("#ist-root .ist-band", { timeout: 30000 });
  await sleep(400);
  return page;
};
const txt = (page, sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const all = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
const settle = async () => { await sleep(350); };
const setValue = async (page, sel, value) => {
  await page.$eval(sel, (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
  await settle();
};
const blur = async (page, sel) => { await page.$eval(sel, (el) => { el.focus(); el.blur(); }); await settle(); };
const clickText = async (page, scope, text) => {
  const done = await page.evaluate((scope, text) => {
    const el = [...document.querySelectorAll(`${scope} button, ${scope} a`)].find((b) => b.textContent.replace(/\s+/g, " ").trim().startsWith(text));
    if (!el) return false;
    el.click();
    return true;
  }, scope, text);
  await settle();
  return done;
};
const step = async (page, id, dir, times = 1) => {
  for (let i = 0; i < times; i++) await page.evaluate((id, dir) => { const box = document.getElementById(id).closest(".ist-step"); box.querySelectorAll("button")[dir === "+" ? 1 : 0].click(); }, id, dir);
  await settle();
};
const kpi = async (page, label) => page.evaluate((label) => {
  const box = [...document.querySelectorAll("#ist-root .ist-band dt")].find((d) => d.textContent.trim().startsWith(label))?.parentElement;
  return box ? { value: box.querySelector("dd").textContent.replace(/ /g, " ").trim(), sub: box.querySelector("small").textContent.replace(/ /g, " ").replace(/\s+/g, " ").trim() } : null;
}, label);
const pressed = (page, scope) => page.$$eval(`${scope} [aria-pressed="true"], ${scope} [aria-selected="true"]`, (els) => els.map((e) => e.textContent.trim()));
const stepperValue = (page, id) => page.$eval(`#${id}`, (e) => e.value.replace(/\s/g, ""));
const expectScenario = async (page, key, name, cur = "€") => {
  const e = E[key];
  const final = await kpi(page, "Výsledná");
  const twr = await kpi(page, "Výnos p. a.");
  const dd = await kpi(page, "Najhlbší prepad");
  const dep = await kpi(page, "Suma vkladov");
  ok(final?.value === norm(money(e.final, cur)), `${name}: výsledná čiastka ${norm(money(e.final, cur))}`, JSON.stringify(final));
  ok(dep?.value === norm(money(e.deposits, cur)) && dep?.sub.startsWith(`${e.depositCount} vklad`), `${name}: vklady ${norm(money(e.deposits, cur))}, ${e.depositCount} vkladov`, JSON.stringify(dep));
  ok(twr?.value === norm(pct(e.twr, 2)), `${name}: výnos p. a. ${norm(pct(e.twr, 2))}`, JSON.stringify(twr));
  ok(dd?.value === norm(pct(e.maxDrawdown)) && dd?.sub.includes(e.ddPeak.split("-")[0]), `${name}: prepad ${norm(pct(e.maxDrawdown))}`, JSON.stringify(dd));
};
const dateSk = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d}. ${m}. ${y}`; };

/* ================================================================== 1. predvolený stav */
console.log("1. Predvolený stav");
let page = await open(1440);
await expectScenario(page, "s1_default", "predvolené (5 000 + 150 mesačne, 20 rokov, 60/20/20)");
ok((await kpi(page, "Celkový zisk"))?.value === norm(money(E.s1_default.final - E.s1_default.deposits)), "celkový zisk = čiastka mínus vklady");
ok((await kpi(page, "Výsledná"))?.sub === "k 31. 8. 2026", "pod čiastkou je dátum", JSON.stringify(await kpi(page, "Výsledná")));
ok(JSON.stringify(await all(page, "#ist-root .ist-chips .ist-chip")) === JSON.stringify(["Svet v eurách", "20 rokov · 2006–2026", "5 000 € + 150 € mesačne", "Vyvážená 60 / 20 / 20", "Brzda: bez brzdy", "Nominálne výnosy"]), "riadok so scenárom zhŕňa nastavenie", JSON.stringify(await all(page, "#ist-root .ist-chips .ist-chip")));
ok(JSON.stringify(await all(page, "#ist-root #ist-panel-vyvoj .ist-legend-item")) === JSON.stringify(["Vložené celkom", "Zisk", "Strata", "Hodnota"]), "legenda grafu má aj stratu (2008 bola pod vkladmi)", JSON.stringify(await all(page, "#ist-root #ist-panel-vyvoj .ist-legend-item")));
ok(JSON.stringify(await pressed(page, "#ist-root .ist-form-tabs")) === JSON.stringify(["Parametre"]), "otvorená záložka Parametre");
ok((await stepperValue(page, "ist-initial")) === "5000" && (await stepperValue(page, "ist-monthly")) === "150" && (await stepperValue(page, "ist-years")) === "20", "steppery ukazujú 5 000, 150 a 20");
ok((await page.$eval("#ist-start", (e) => e.value)) === "2006-08-31" && (await page.$eval("#ist-end", (e) => e.value)) === "2026-08-31", "dátumy od a do sú posledných 20 rokov");
ok((await page.$eval("#ist-start", (e) => `${e.min}|${e.max}`)) === "1999-01-04|2026-08-31", "rozsah dátumov podľa dát");
ok(JSON.stringify(await pressed(page, "#ist-root .ist-fpanel")) === JSON.stringify(["Svet v eurách", "Nominálne"]), "označené voľby: Svet v eurách, Nominálne", JSON.stringify(await pressed(page, "#ist-root .ist-fpanel")));
ok(JSON.stringify(await all(page, '#ist-root [role="tablist"][aria-label="Pohľad na výsledok"] [role="tab"]')) === JSON.stringify(["Vývoj", "Zhodnotenie", "Trhy", "Profit", "Riziko"]), "päť záložiek výsledku");
const cta = await page.$eval("#ist-root .ist-cta a", (a) => ({ href: a.href, ev: a.dataset.umamiEvent, slug: a.dataset.umamiEventSlug, target: a.target, rel: a.rel }));
ok(cta.href.startsWith("https://wa.me/421902519328") && cta.ev === "click_konzultacia" && cta.slug === "investicna-strategia" && cta.target === "_blank" && cta.rel.includes("noopener"), "CTA vedie na WhatsApp a meria sa", JSON.stringify(cta));
ok(norm(await txt(page, "#ist-root .ist-foot")).includes("Minulé výnosy nie sú spoľahlivým ukazovateľom budúcich výsledkov") && norm(await txt(page, "#ist-root .ist-foot")).includes("pred poplatkami a daňami"), "upozornenie pod nástrojom");

/* ================================================================== 2. parametre */
console.log("2. Parametre");
await step(page, "ist-years", "+");
ok((await stepperValue(page, "ist-years")) === "21" && (await page.$eval("#ist-start", (e) => e.value)) === "2005-08-31", "plus pri rokoch posunie začiatok o rok späť");
await step(page, "ist-years", "-");
await setValue(page, "#ist-years", "30");
await blur(page, "#ist-years");
ok((await stepperValue(page, "ist-years")) === "27" && (await page.$eval("#ist-start", (e) => e.value)) === "1999-08-31", "eurové dáta: najviac 27 rokov", `${await stepperValue(page, "ist-years")} ${await page.$eval("#ist-start", (e) => e.value)}`);
ok(norm(await txt(page, "#ist-root .ist-fpanel .ist-hint:nth-of-type(2), #ist-root .ist-fpanel > .ist-hint")).includes("najviac 27 rokov") || (await all(page, "#ist-root .ist-hint")).some((t) => t.includes("najviac 27 rokov")), "upozornenie na dosah eurových dát");
await setValue(page, "#ist-years", "20");
await blur(page, "#ist-years");
await clickText(page, "#ist-root .ist-fpanel", "USA v dolároch");
await setValue(page, "#ist-years", "30");
await blur(page, "#ist-years");
ok((await page.$eval("#ist-start", (e) => e.value)) === "1996-09-03", "USA: 30 rokov = od 31. 8. 1996, prvý obchodný deň 3. 9. 1996", await page.$eval("#ist-start", (e) => e.value));
await expectScenario(page, "s7_30rokov_usd", "USA 30 rokov", "$");
await setValue(page, "#ist-years", "40");
await blur(page, "#ist-years");
await expectScenario(page, "s8_usd_40", "USA 40 rokov", "$");
await clickText(page, "#ist-root .ist-fpanel", "Svet v eurách");
ok((await stepperValue(page, "ist-years")) === "27", "návrat na eurá skráti obdobie na dostupných 27 rokov", await stepperValue(page, "ist-years"));
await setValue(page, "#ist-years", "20");
await blur(page, "#ist-years");
await expectScenario(page, "s1_default", "späť na 20 rokov v eurách");
/* dátumy */
await setValue(page, "#ist-start", "2016-08-31");
await blur(page, "#ist-start");
ok((await stepperValue(page, "ist-years")) === "10", "začiatok 2016 = 10 rokov", await stepperValue(page, "ist-years"));
await expectScenario(page, "s12_10rokov", "10 rokov");
await setValue(page, "#ist-start", "2008-03-15");
ok((await all(page, "#ist-root .ist-hint")).some((t) => norm(t).startsWith("Počítam od 17. 3. 2008")), "víkend: hint s najbližším obchodným dňom");
await blur(page, "#ist-start");
ok((await page.$eval("#ist-start", (e) => e.value)) === "2008-03-15" && (await stepperValue(page, "ist-years")) === "19", "napísaný víkendový dátum ostáva, roky sa dopočítajú (19)", await stepperValue(page, "ist-years"));
await setValue(page, "#ist-start", "0002-01-04");
await blur(page, "#ist-start");
ok((await page.$eval("#ist-start", (e) => e.value)) === "1999-01-04", "dátum pred začiatkom dát sa opraví na prvý deň");
await setValue(page, "#ist-end", "1998-05-05");
await blur(page, "#ist-end");
ok((await page.$eval("#ist-end", (e) => e.value)) === "2026-08-31", "koniec pred začiatkom sa vráti na posledný deň dát", await page.$eval("#ist-end", (e) => e.value));
await expectScenario(page, "s13_eur_max", "celé eurové obdobie od 4. 1. 1999");
await setValue(page, "#ist-start", "2000-09-07");
await blur(page, "#ist-start");
await expectScenario(page, "s15_dotcom", "začiatok na vrchole dotcom bubliny");
await setValue(page, "#ist-years", "20");
await blur(page, "#ist-years");
await expectScenario(page, "s1_default", "stepper rokov vráti posledných 20 rokov");
/* typ výnosov */
await clickText(page, "#ist-root .ist-fpanel", "Reálne");
await expectScenario(page, "s6_real", "reálne výnosy");
ok((await kpi(page, "Výsledná"))?.sub.endsWith("· reálne, v dnešných cenách") && (await kpi(page, "Výnos p. a."))?.sub.startsWith("reálne") && (await all(page, "#ist-root .ist-chips .ist-chip")).includes("Reálne výnosy"), "pás aj čipy hlásia reálne výnosy", JSON.stringify(await kpi(page, "Výsledná")));
await clickText(page, "#ist-root .ist-fpanel", "Nominálne");
/* ďalšie nastavenia */
await clickText(page, "#ist-root .ist-fpanel", "Ďalšie nastavenia");
await setValue(page, "#ist-cost", "1");
await blur(page, "#ist-cost");
await expectScenario(page, "s9_cost1", "náklady 1 %");
ok(norm(await txt(page, "#ist-root .ist-collapse-meta")) === "náklady 1 %", "zhrnutie ďalších nastavení", norm(await txt(page, "#ist-root .ist-collapse-meta")));
await setValue(page, "#ist-cost", "0");
await blur(page, "#ist-cost");
await clickText(page, "#ist-root .ist-advanced", "Každý mesiac");
await expectScenario(page, "s10_monthly", "mesačné vyvažovanie");
await clickText(page, "#ist-root .ist-advanced", "Raz ročne");
await setValue(page, "#ist-monthly", "0");
await blur(page, "#ist-monthly");
await expectScenario(page, "s11_jednorazovo", "len jednorazový vklad");
await setValue(page, "#ist-monthly", "150");
await blur(page, "#ist-monthly");
await setValue(page, "#ist-initial", "99999999");
await blur(page, "#ist-initial");
ok((await stepperValue(page, "ist-initial")) === "5000000", "vklad nad limit sa oreže na 5 000 000", await stepperValue(page, "ist-initial"));
await setValue(page, "#ist-initial", "0");
await setValue(page, "#ist-monthly", "0");
await blur(page, "#ist-monthly");
ok(norm(await txt(page, "#ist-root .ist-empty")).startsWith("Zadaj jednorazový alebo mesačný vklad") && (await kpi(page, "Výnos p. a."))?.value === norm(pct(E.s11_jednorazovo.twr, 2)), "bez vkladov výzva, výnos stratégie sa ráta ďalej (ako jednorazový vklad)", JSON.stringify(await kpi(page, "Výnos p. a.")));
await setValue(page, "#ist-initial", "5000");
await setValue(page, "#ist-monthly", "150");
await blur(page, "#ist-monthly");
await expectScenario(page, "s1_default", "späť na predvolené vklady");

/* ================================================================== 3. alokácia */
console.log("3. Alokácia");
await page.click("#ist-ftab-alokacia");
await settle();
ok(JSON.stringify(await pressed(page, "#ist-root .ist-fpanel .ist-pills")) === JSON.stringify(["Vyvážená"]), "označená predvoľba Vyvážená");
ok(norm(await txt(page, "#ist-root .ist-donut-text b")) === "Vyvážená" && norm(await txt(page, "#ist-root .ist-donut-text span")) === "Bez brzdy", "prstenec: názov a brzda", norm(await txt(page, "#ist-root .ist-donut-text")));
await clickText(page, "#ist-root .ist-fpanel", "Dynamická");
await expectScenario(page, "s4_dynamicka", "Dynamická 100/0/0");
ok((await stepperValue(page, "ist-w-0")) === "100" && (await stepperValue(page, "ist-w-1")) === "0", "steppery zloženia 100/0/0");
await clickText(page, "#ist-root .ist-fpanel", "Konzervatívna");
await expectScenario(page, "s5_konzervativna", "Konzervatívna 30/40/30");
await clickText(page, "#ist-root .ist-fpanel", "Vyvážená");
await step(page, "ist-w-0", "+");
ok([await stepperValue(page, "ist-w-0"), await stepperValue(page, "ist-w-1"), await stepperValue(page, "ist-w-2")].join("/") === "65/20/15", "plus pri akciách uberie z peňažného fondu", [await stepperValue(page, "ist-w-0"), await stepperValue(page, "ist-w-1"), await stepperValue(page, "ist-w-2")].join("/"));
ok(JSON.stringify(await pressed(page, "#ist-root .ist-fpanel .ist-pills")) === JSON.stringify(["Vlastná"]) && norm(await txt(page, "#ist-root .ist-donut-text b")) === "Vlastná", "ručná zmena = Vlastná");
await setValue(page, "#ist-w-1", "40");
await blur(page, "#ist-w-1");
ok([await stepperValue(page, "ist-w-0"), await stepperValue(page, "ist-w-1"), await stepperValue(page, "ist-w-2")].join("/") === "60/40/0", "dlhopisy 40: rozdiel vyrovná fond (najdávnejšie dotknutý), potom akcie", [await stepperValue(page, "ist-w-0"), await stepperValue(page, "ist-w-1"), await stepperValue(page, "ist-w-2")].join("/"));
await setValue(page, "#ist-w-0", "150");
await blur(page, "#ist-w-0");
ok([await stepperValue(page, "ist-w-0"), await stepperValue(page, "ist-w-1"), await stepperValue(page, "ist-w-2")].join("/") === "100/0/0", "hodnota nad 100 sa oreže");
await clickText(page, "#ist-root .ist-fpanel", "Vyvážená");
await expectScenario(page, "s1_default", "späť Vyvážená");

/* ================================================================== 4. brzda */
console.log("4. Brzda");
await page.click("#ist-ftab-brzda");
await settle();
ok(JSON.stringify(await pressed(page, "#ist-root .ist-fpanel .ist-pills")) === JSON.stringify(["Bez brzdy"]) && (await all(page, "#ist-root .ist-brake-row")).length === 20, "Bez brzdy, 20 riadkov");
await clickText(page, "#ist-root .ist-fpanel", "Na cieľ");
await expectScenario(page, "s2_goal", "brzda na cieľ");
const row = async (k) => [await stepperValue(page, `ist-r-${k}-0`), await stepperValue(page, `ist-r-${k}-1`), await stepperValue(page, `ist-r-${k}-2`)].join("/");
ok((await row(9)) === "60/20/20" && (await row(10)) === "56/22/22" && (await row(19)) === "20/40/40", "riadky brzdy: 10. rok 60/20/20, 11. rok 56/22/22, 20. rok 20/40/40", `${await row(9)} ${await row(10)} ${await row(19)}`);
ok(norm(await txt(page, "#ist-root .ist-fpanel .ist-hint")).startsWith("Posledných 10 rokov sa portfólio každý rok posúva k 20 / 40 / 40"), "vysvetlenie brzdy na cieľ");
await clickText(page, "#ist-root .ist-fpanel", "Na rentu");
await expectScenario(page, "s3_rent", "brzda na rentu");
ok((await row(19)) === "50/30/20", "na rentu končí na 50/30/20");
await clickText(page, "#ist-root .ist-fpanel", "Bez brzdy");
await setValue(page, "#ist-r-4-0", "30");
await blur(page, "#ist-r-4-0");
ok((await row(4)) === "30/20/50" && JSON.stringify(await pressed(page, "#ist-root .ist-fpanel .ist-pills")) === JSON.stringify(["Vlastná"]), "úprava riadka = vlastná brzda, rozdiel ide do peňažného fondu", await row(4));
await page.click("#ist-root .ist-brake-row:nth-child(6) .ist-fill");
await settle();
ok((await row(5)) === "30/20/50" && (await row(19)) === "30/20/50" && (await row(3)) === "60/20/20", "šípka skopíruje riadok do všetkých ďalších rokov");
await expectScenario(page, "s14_custom_row5", "vlastné riadky od 5. roka 30/20/50");
await page.click("#ist-ftab-alokacia");
await settle();
ok(norm(await txt(page, "#ist-root .ist-donut-text b")) === "Vyvážená" && norm(await txt(page, "#ist-root .ist-donut-text span")) === "Vlastná" && (await stepperValue(page, "ist-w-0")) === "60", "alokácia = 1. rok, brzda Vlastná");
await page.click("#ist-ftab-brzda");
await settle();
await clickText(page, "#ist-root .ist-fpanel", "Vlastná");
ok((await row(19)) === "30/20/50", "vlastné riadky ostali uložené");
await clickText(page, "#ist-root .ist-fpanel", "Bez brzdy");
await expectScenario(page, "s1_default", "bez brzdy = predvolené");
await page.click("#ist-ftab-parametre");
await settle();

/* ================================================================== 5. graf a záložky výsledku */
console.log("5. Graf a záložky");
const chart = "#ist-root .ist-panel .ist-chart-host";
await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "instant" }), chart);
await sleep(200);
const b2 = await (await page.$(chart)).boundingBox();
await page.mouse.move(b2.x + b2.width * 0.4, b2.y + 150);
await sleep(250);
const tip = norm(await txt(page, `${chart} .ist-tip`));
ok(/\d{1,2}\. [a-zá-ž]+ 20\d\d/.test(tip) && tip.includes("Vložené celkom") && tip.includes("Zisk") && tip.includes("Hodnota") && /Zloženie \d+ \/ \d+ \/ \d+/.test(tip), "bublina: dátum, vložené, zisk, hodnota, zloženie", tip);
const tipBox = await page.$eval(`${chart} .ist-tip`, (e) => { const r = e.getBoundingClientRect(); const h = e.parentElement.getBoundingClientRect(); return { l: r.left - h.left, r: h.right - r.right }; });
ok(tipBox.l >= -0.5 && tipBox.r >= -0.5, "bublina ostáva v grafe", JSON.stringify(tipBox));
await page.mouse.move(b2.x + b2.width * 0.5, b2.y + b2.height + 200);
await sleep(200);
ok((await page.$(`${chart} .ist-tip`)) === null, "bublina zmizne po odchode myši");
await page.focus(chart);
await page.keyboard.press("End");
await page.keyboard.press("ArrowLeft");
await sleep(150);
ok(norm(await txt(page, `${chart} .ist-tip`)).startsWith("28. augusta 2026"), "šípka vľavo od konca = predchádzajúci obchodný deň", norm(await txt(page, `${chart} .ist-tip`)));
const aria = await page.$eval(chart, (e) => ({ role: e.getAttribute("role"), text: e.getAttribute("aria-valuetext") }));
ok(aria.role === "slider" && norm(aria.text).startsWith("28. augusta 2026, hodnota"), "čítačka obrazovky dostane deň a hodnotu", JSON.stringify(aria));
await page.keyboard.press("Escape");
await sleep(150);
ok((await page.$(`${chart} .ist-tip`)) === null, "Esc zruší pripnutý deň");
const paths0 = await page.$$eval(`${chart} svg path`, (p) => p.length);
ok(paths0 === 9, "vývoj: vklady (plocha + čiara), hodnota (plocha + čiara), zisk nad nulou + strata pod nulou, 3 vrstvy zloženia", String(paths0));
/* zhodnotenie */
await page.click("#ist-tab-zhodnotenie");
await settle();
const bars = await page.$$eval("#ist-root .ist-hbar", (els) => els.map((e) => [e.querySelector(".ist-hbar-label").textContent, e.querySelector(".ist-hbar-value").textContent.replace(/ /g, " ")]));
ok(JSON.stringify(bars) === JSON.stringify([["Tvoja stratégia", "6,58 %"], ["Akcie", "9,42 %"], ["Dlhopisy", "2,57 %"], ["Peňažný fond", "0,97 %"], ["Inflácia", "2,17 %"]]), "zhodnotenie: stratégia, akcie, dlhopisy, peňažný fond, inflácia", JSON.stringify(bars));
ok(norm(await txt(page, "#ist-root .ist-panel .ist-summary")).startsWith("Tvoja stratégia zarobila 6,58 % ročne, tvoje vklady sa zhodnocovali 7,32 % ročne."), "zhodnotenie: zhrnutie", norm(await txt(page, "#ist-root .ist-panel .ist-summary")));
/* trhy */
await page.click("#ist-tab-trhy");
await settle();
ok((await page.$$eval(`${chart} svg path`, (p) => p.length)) === 4, "trhy: štyri čiary");
const axisT = (await all(page, `${chart} svg text.ist-ax`)).map(norm);
ok(axisT.includes("1×") && axisT.includes("2×") && axisT.includes("5×"), "trhy: násobky na osi", JSON.stringify(axisT));
await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "instant" }), chart);
await sleep(200);
const b3 = await (await page.$(chart)).boundingBox();
await page.mouse.move(b3.x + b3.width * 0.97, b3.y + 120);
await sleep(250);
const tipT = norm(await txt(page, `${chart} .ist-tip`));
ok(/Akcie \d+,\d+× \(\+\d+ %\)/.test(tipT) && tipT.includes("Dlhopisy") && tipT.includes("Peňažný fond") && /Inflácia 1,5\d×/.test(tipT), "trhy: bublina s násobkami", tipT);
await page.mouse.move(5, 5);
/* profit */
await page.click("#ist-tab-profit");
await settle();
ok((await page.$$eval(`${chart} svg rect[rx]`, (r) => r.length)) === 42, "profit: 21 rokov × 2 stĺpce");
ok(norm(await txt(page, "#ist-root .ist-panel .ist-summary")).startsWith("V pluse skončilo 18 z 21 rokov. Najlepší bol rok 2019 (+17,2 %, 7 483 €), najhorší rok 2008 (−19,5 %, −1 706 €)."), "profit: zhrnutie", norm(await txt(page, "#ist-root .ist-panel .ist-summary")));
await clickText(page, "#ist-root .ist-panel", "%");
ok(norm(await txt(page, "#ist-root .ist-panel h3")) === "Výnos v jednotlivých rokoch" && (await all(page, `${chart} svg text.ist-ax`)).map(norm).includes("10 %"), "profit: prepnutie na percentá");
await clickText(page, "#ist-root .ist-panel", "€");
/* riziko */
await page.click("#ist-tab-riziko");
await settle();
ok(norm(await txt(page, "#ist-root .ist-panel .ist-summary")).includes("−29,7 % pod maximom, dňa 9. marca 2009") && norm(await txt(page, "#ist-root .ist-panel .ist-summary")).includes("najhlbší prepad −52,5 %"), "riziko: zhrnutie prepadu", norm(await txt(page, "#ist-root .ist-panel .ist-summary")));
const crises = await page.$$eval("#ist-root .ist-crises li", (li) => li.map((e) => [e.querySelector(".ist-crisis-head b").textContent, e.querySelector(".ist-crisis-head span").textContent, ...[...e.querySelectorAll(".ist-crisis-bars b")].map((b) => b.textContent)].map((t) => t.replace(/ /g, " "))));
ok(JSON.stringify(crises) === JSON.stringify([["Finančná kríza", "15. 6. 2007 – 9. 3. 2009", "−52,5 %", "−29,7 %"], ["Covid", "19. 2. 2020 – 23. 3. 2020", "−33,7 %", "−21,6 %"], ["Inflačný šok 2022", "4. 1. 2022 – 20. 6. 2022", "−17,0 %", "−13,1 %"]]), "riziko: tri krízy v období", JSON.stringify(crises));
/* šípky na záložkách */
await page.focus("#ist-tab-riziko");
await page.keyboard.press("ArrowRight");
await sleep(200);
ok(JSON.stringify(await pressed(page, '#ist-root [aria-label="Pohľad na výsledok"]')) === JSON.stringify(["Vývoj"]), "šípka na záložkách prejde dokola na Vývoj");

/* ================================================================== 6. zdroje, export, odkaz, uloženie */
console.log("6. Zdroje, export, odkaz a uloženie");
await clickText(page, "#ist-root .ist-result", "Odkiaľ sú dáta a ako počítam");
const src = norm(await txt(page, "#ist-root .ist-sources"));
ok(src.includes("Dáta v súbore „Svet v eurách“") && src.includes("Deutsche Bundesbank") && src.includes("Brzda určuje zloženie") && src.includes("Posledný deň dát je 31. augusta 2026"), "zdroje a metodika");
await page.evaluate(() => {
  window.__csv = null;
  const orig = URL.createObjectURL;
  URL.createObjectURL = (blob) => { blob.text().then((t) => { window.__csv = t; }); blob.arrayBuffer().then((b) => { window.__bom = [...new Uint8Array(b.slice(0, 3))]; }); return orig.call(URL, blob); };
  HTMLAnchorElement.prototype.click = function () { window.__csvName = this.download; };
});
await clickText(page, "#ist-root .ist-sources", "Stiahnuť denný priebeh (CSV)");
await sleep(500);
const csv = await page.evaluate(() => ({ name: window.__csvName, bom: window.__bom, head: window.__csv?.slice(0, 120), lines: window.__csv?.split("\r\n").length, last: window.__csv?.split("\r\n").pop() }));
ok(csv.name === "investicna-strategia-2006-08-31-2026-08-31.csv" && JSON.stringify(csv.bom) === "[239,187,191]" && csv.head.startsWith("datum;hodnota;vlozene;zisk;akcie_%;dlhopisy_%;penazny_fond_%\r\n2006-08-31;5150,00;5150,00;0,00;60,00;20,00;20,00"), "export CSV: hlavička a prvý deň", JSON.stringify(csv));
ok(csv.last.startsWith("2026-08-31;100018,85;41000,00;59018,85;"), "export CSV: posledný deň sedí s výsledkom", csv.last);
await page.click("#ist-ftab-brzda");
await settle();
await clickText(page, "#ist-root .ist-fpanel", "Na cieľ");
await page.click("#ist-ftab-parametre");
await settle();
await setValue(page, "#ist-monthly", "450");
await blur(page, "#ist-monthly");
await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } }); });
await clickText(page, "#ist-root .ist-form-foot", "Kopírovať odkaz na scenár");
const copied = await page.evaluate(() => window.__copied);
ok(copied === `${origin}/bonusy/investicna-strategia?s=eur&y=20&v=5000&m=450&a=60-20-20&b=goal`, "odkaz obsahuje celý scenár", copied);
ok(norm(await txt(page, "#ist-root .ist-link")) === "Odkaz je skopírovaný", "potvrdenie skopírovania");
const finalShared = (await kpi(page, "Výsledná"))?.value;
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("jsm_investicna_strategia_v2")));
ok(saved.monthly === 450 && saved.brake === "goal" && saved.years === 20, "nastavenie sa ukladá v prehliadači", JSON.stringify(saved));
await page.close();
page = await open(1440, 1000, copied);
ok((await kpi(page, "Výsledná"))?.value === finalShared && (await stepperValue(page, "ist-monthly")) === "450", "odkaz otvorí ten istý scenár", (await kpi(page, "Výsledná"))?.value);
await page.evaluate(() => sessionStorage.setItem("ist-test-keep", "1"));
await page.goto(URL_TOOL, { waitUntil: "networkidle2" });
await page.waitForSelector("#ist-root .ist-band");
await sleep(400);
ok((await kpi(page, "Výsledná"))?.value === finalShared, "po návrate bez odkazu ostáva uložené nastavenie");
await clickText(page, "#ist-root .ist-form-foot", "Začať odznova");
await expectScenario(page, "s1_default", "„Začať odznova“ vráti predvolený stav");
await page.evaluate(() => localStorage.setItem("jsm_investicna_strategia_v2", "{nezmysel"));
await page.reload({ waitUntil: "networkidle2" });
await page.waitForSelector("#ist-root .ist-band");
await sleep(400);
ok((await kpi(page, "Výsledná"))?.value === norm(money(E.s1_default.final)), "poškodené uložené nastavenie nástroj nezhodí");
await page.close();

/* výpadok pri načítaní dát */
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.setRequestInterception(true);
  let block = true;
  p.on("request", (req) => (block && req.url().includes("investicnaStrategiaData") ? req.abort() : req.continue()));
  await p.goto(URL_TOOL, { waitUntil: "networkidle2" });
  await sleep(600);
  const state = norm(await txt(p, "#ist-root .ist-state"));
  ok(state.includes("Historické dáta sa nepodarilo načítať") && state.includes("Skúsiť znova") && (await p.$("#ist-root .ist-form")) !== null, "výpadok dát: hláška, formulár ostáva", state);
  block = false;
  await Promise.all([p.waitForNavigation({ waitUntil: "networkidle2" }), clickText(p, "#ist-root .ist-state", "Skúsiť znova")]);
  await p.waitForSelector("#ist-root .ist-band", { timeout: 20000 });
  ok(true, "výpadok dát: „Skúsiť znova“ nástroj načíta");
  await p.close();
}

/* ================================================================== 7. šírky */
console.log("7. Šírky obrazovky");
for (const w of [320, 360, 393, 430, 600, 768, 1024, 1280, 1440, 1920]) {
  const p = await open(w, 900);
  for (const id of ["zhodnotenie", "trhy", "profit", "riziko", "vyvoj"]) { await p.click(`#ist-tab-${id}`); await sleep(150); }
  await clickText(p, "#ist-root .ist-result", "Odkiaľ sú dáta a ako počítam");
  for (const id of ["alokacia", "brzda"]) { await p.click(`#ist-ftab-${id}`); await sleep(150); }
  const m = await p.evaluate(() => {
    const root = document.getElementById("ist-root");
    const over = document.documentElement.scrollWidth - window.innerWidth;
    const rr = root.getBoundingClientRect();
    const wide = [...root.querySelectorAll("*")].filter((e) => { if (e.closest("svg") || e.closest(".ist-chips")) return false; /* čipy sú na mobile posuvný riadok */ const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > rr.right + 0.5 || r.left < rr.left - 0.5); }).map((e) => e.className || e.tagName).slice(0, 5);
    const svgs = [...root.querySelectorAll(".ist-chart-host")].map((h) => ({ host: Math.round(h.getBoundingClientRect().width), svg: Math.round(h.querySelector("svg")?.getBoundingClientRect().width ?? 0) }));
    const kpis = [...root.querySelectorAll(".ist-band dd")].every((d) => d.scrollWidth <= d.clientWidth + 1);
    const chips = root.querySelector(".ist-chips"); const chipsOk = chips && (innerWidth >= 640 ? chips.scrollWidth <= chips.clientWidth + 1 : getComputedStyle(chips).overflowX === "auto");
    const steps = [...root.querySelectorAll(".ist-brake-row .ist-step input")].slice(0, 3).map((i) => i.getBoundingClientRect().width);
    return { over, wide, svgs, kpis, chipsOk, steps };
  });
  ok(m.over <= 0 && m.wide.length === 0, `${w} px: nič nepretŕča`, JSON.stringify([m.over, m.wide]));
  ok(m.svgs.every((s) => s.svg === s.host && s.svg > 200) && m.kpis && m.chipsOk, `${w} px: graf vyplní šírku, čísla v páse sa zmestia, čipy nepretŕčajú`, JSON.stringify(m));
  ok(m.steps.every((x) => x >= 24), `${w} px: steppery brzdy majú miesto na číslo`, JSON.stringify(m.steps));
  await p.close();
}
{
  const p = await open(320, 900, `${URL_TOOL}?s=usd&y=64&v=5000000&m=50000&a=100-0-0`);
  const m = await p.evaluate(() => { const d = document.querySelector("#ist-root .ist-band-main dd"); const r = document.querySelector("#ist-root .ist-result").getBoundingClientRect(); const b = d.getBoundingClientRect(); return { over: document.documentElement.scrollWidth - innerWidth, fits: b.right <= r.right, text: d.textContent }; });
  ok(m.over <= 0 && m.fits, `320 px s najväčšími sumami (${norm(m.text)}): nič nepretŕča`, JSON.stringify(m));
  await p.close();
}
{
  const p = await open(393, 850);
  await p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "instant" }), chart);
  await sleep(200);
  const b = await (await p.$(chart)).boundingBox();
  await p.touchscreen.tap(b.x + b.width * 0.55, b.y + 120);
  await sleep(300);
  const t = norm(await txt(p, `${chart} .ist-tip`));
  ok(!!t && t.includes("Hodnota"), "dotyk pripne deň a ukáže bublinu", t);
  await p.close();
}

/* ================================================================== 8. prehľad bonusov */
console.log("8. Prehľad bonusov");
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 1000 });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${origin}/bonusy`, { waitUntil: "networkidle2" });
  await sleep(500);
  const d = await p.evaluate(() => {
    const card = document.querySelector('a.bz-card[href="/bonusy/investicna-strategia"]');
    return { eyebrow: document.querySelector(".bz-eyebrow")?.textContent, card: card ? { cat: card.querySelector(".bz-cat").textContent, badge: card.querySelector(".bz-new")?.textContent, title: card.querySelector(".bz-card-title").textContent } : null, nav: [...document.querySelectorAll("header a")].some((a) => a.getAttribute("href") === "/bonusy/investicna-strategia") };
  });
  ok(d.eyebrow === "Bonusy · 14 nástrojov zadarmo" && d.card?.title === "Investičná stratégia" && d.card?.badge === "Nové" && d.nav, "prehľad: 14 nástrojov, karta a položka v menu", JSON.stringify(d));
  await p.close();
}

console.log(`\n${pass} kontrol prešlo, ${fail} zlyhalo`, errors.length ? `| chyby v konzole: ${[...new Set(errors)].join(" | ")}` : "| konzola bez chýb");
await browser.close();
process.exit(fail || errors.length ? 1 : 0);
