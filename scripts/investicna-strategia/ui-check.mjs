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
  if (!keep) await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem("ist-test-keep")) localStorage.removeItem("jsm_investicna_strategia_v1"); } catch { /* nič */ } });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  await page.waitForSelector("#ist-root .ist-hero-value, #ist-root .ist-hero--empty", { timeout: 30000 });
  await sleep(400);
  return page;
};
const txt = (page, sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const all = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
const norm = (s) => (s ?? "").replace(/ /g, " ");
const hero = async (page) => norm(await txt(page, "#ist-root .ist-hero-value"));
const settle = async (page) => { await sleep(350); };
const setValue = async (page, sel, value) => {
  await page.$eval(sel, (el, v) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
  await settle(page);
};
const blur = async (page, sel) => { await page.$eval(sel, (el) => { el.focus(); el.blur(); }); await settle(page); };
const clickText = async (page, scope, text) => {
  const done = await page.evaluate((scope, text) => {
    const el = [...document.querySelectorAll(`${scope} button, ${scope} a`)].find((b) => b.textContent.replace(/\s+/g, " ").trim().startsWith(text));
    if (!el) return false;
    el.click();
    return true;
  }, scope, text);
  await settle(page);
  return done;
};
const fact = async (page, label) => page.evaluate((label) => {
  const row = [...document.querySelectorAll("#ist-root .ist-result > .ist-facts > div")].find((d) => d.querySelector("dt")?.textContent.trim() === label);
  return row ? { value: row.querySelector("dd").textContent.replace(/ /g, " ").trim(), sub: row.querySelector("small").textContent.replace(/ /g, " ").trim() } : null;
}, label);
const expectScenario = async (page, key, name, cur = "€") => {
  const e = E[key];
  ok((await hero(page)) === norm(money(e.final, cur)), `${name}: hodnota ${norm(money(e.final, cur))}`, await hero(page));
  const twr = await fact(page, "Ročný výnos stratégie");
  ok(twr?.value === norm(pct(e.twr, 2)), `${name}: ročný výnos ${norm(pct(e.twr, 2))}`, JSON.stringify(twr));
  const dd = await fact(page, "Najhlbší prepad");
  ok(dd?.value === norm(pct(e.maxDrawdown)), `${name}: prepad ${norm(pct(e.maxDrawdown))}`, JSON.stringify(dd));
};

/* ================================================================== 1. predvolený stav */
console.log("1. Predvolený stav");
let page = await open(1440);
ok((await hero(page)) === "318 908 €", "hodnota účtu 318 908 €", await hero(page));
ok(norm(await txt(page, "#ist-root .ist-hero-unit")) === "z vkladov 109 600 €", "z vkladov 109 600 €");
ok(norm(await txt(page, "#ist-root .ist-kicker")) === "Hodnota účtu k 31. 8. 2026", "nadpis s dátumom konca", await txt(page, "#ist-root .ist-kicker"));
const sub = (await all(page, "#ist-root .ist-hero-sub span")).map(norm);
ok(JSON.stringify(sub) === JSON.stringify(["4. 1. 1999 – 31. 8. 2026", "27 rokov a 7 mesiacov", "332 vkladov", "zisk 209 308 €"]), "podriadok: obdobie, dĺžka, vklady, zisk", JSON.stringify(sub));
ok((await fact(page, "Ročný výnos stratégie"))?.value === "5,94 %", "ročný výnos stratégie 5,94 %");
ok((await fact(page, "Výnos tvojich vkladov"))?.value === "6,36 %", "výnos vkladov 6,36 %");
const dd0 = await fact(page, "Najhlbší prepad");
ok(dd0?.value === "−50,6 %" && dd0?.sub === "7. 9. 2000 – 12. 3. 2003", "najhlbší prepad −50,6 % s dátumami", JSON.stringify(dd0));
const rec0 = await fact(page, "Návrat na maximum");
ok(rec0?.value === "6 r. 8 mes." && rec0?.sub.includes("18. 5. 2007"), "návrat na maximum 6 r. 8 mes., späť 18. 5. 2007", JSON.stringify(rec0));
const verdict0 = norm(await txt(page, "#ist-root .ist-verdict"));
ok(verdict0.includes("−20,7 % namiesto −30,5 %") && verdict0.includes("6. januára 2014") && verdict0.includes("503 081 €") && verdict0.includes("184 173 € viac"), "veta o zmene stratégie", verdict0);
ok((await all(page, "#ist-root .ist-phase")).length === 3, "tri fázy stratégie");
ok(JSON.stringify((await all(page, "#ist-root .ist-phase-mix")).map(norm)) === JSON.stringify(["90 / 10 / 0", "60 / 30 / 10", "30 / 40 / 30"]), "pomery fáz");
ok((await page.$eval("#ist-start", (e) => e.value)) === "1999-01-04" && (await page.$eval("#ist-end", (e) => e.value)) === "2026-08-31", "dátumy od a do");
ok((await page.$eval("#ist-start", (e) => `${e.min}|${e.max}`)) === "1999-01-04|2026-08-31", "rozsah dátumov podľa dát");
const pressed = async (scope) => (await page.$$eval(`${scope} [aria-pressed="true"], ${scope} [aria-selected="true"]`, (els) => els.map((e) => e.textContent.trim())));
ok(JSON.stringify(await pressed("#ist-root .ist-form")) === JSON.stringify(["Svet v eurách", "Celé obdobie", "Životný cyklus", "Postupne"]), "označené voľby vo formulári", JSON.stringify(await pressed("#ist-root .ist-form")));
const blocks = (await all(page, "#ist-root .ist-blocks dd")).map(norm);
ok(JSON.stringify(blocks) === JSON.stringify(["+8,09 % ročne", "+3,23 % ročne", "+1,54 % ročne", "2,17 % ročne"]), "výnosy zložiek a inflácia", JSON.stringify(blocks));
const cta = await page.$eval("#ist-root .ist-cta a", (a) => ({ href: a.href, ev: a.dataset.umamiEvent, slug: a.dataset.umamiEventSlug, target: a.target, rel: a.rel, text: a.textContent.trim() }));
ok(cta.href.startsWith("https://wa.me/421902519328") && cta.ev === "click_konzultacia" && cta.slug === "investicna-strategia" && cta.target === "_blank" && cta.rel.includes("noopener"), "CTA vedie na WhatsApp a meria sa", JSON.stringify(cta));
ok(norm(await txt(page, "#ist-root .ist-foot")).includes("Minulé výnosy nie sú spoľahlivým ukazovateľom budúcich výsledkov") && norm(await txt(page, "#ist-root .ist-foot")).includes("pred poplatkami a daňami"), "upozornenie pod nástrojom");

/* ================================================================== 2. graf */
console.log("2. Graf hodnoty");
const chart = "#ist-root .ist-chart-block .ist-chart-host";
const box = await (await page.$(chart)).boundingBox();
const paths = async () => page.$$eval(`${chart} svg path`, (p) => p.length);
const p0 = await paths();
ok(p0 === 9, "čiary: vklady (plocha + čiara), stratégia (plocha + čiara), bez zmeny, len akcie, 3 vrstvy zloženia", String(p0));
const axis0 = (await all(page, `${chart} svg text.ist-ax`)).map(norm);
ok(axis0.includes("0") && axis0.includes("600 tis.") && axis0.includes("2000") && axis0.includes("2025"), "osi: od nuly po 600 tis., roky 2000 až 2025", JSON.stringify(axis0));
await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "instant" }), chart);
await sleep(200);
const b2 = await (await page.$(chart)).boundingBox();
await page.mouse.move(b2.x + b2.width * 0.4, b2.y + 150);
await sleep(250);
const tip = norm(await txt(page, `${chart} .ist-tip`));
ok(!!tip && /\d{1,2}\. [a-zá-ž]+ 20\d\d/.test(tip) && tip.includes("Hodnota účtu") && tip.includes("Vklady") && tip.includes("Len akcie") && tip.includes("Bez zmeny") && tip.includes("Zloženie"), "bublina pri pohybe myšou", tip);
const tipBox = await page.$eval(`${chart} .ist-tip`, (e) => { const r = e.getBoundingClientRect(); const h = e.parentElement.getBoundingClientRect(); return { l: r.left - h.left, r: h.right - r.right, w: r.width }; });
ok(tipBox.l >= -0.5 && tipBox.r >= -0.5, "bublina ostáva v grafe", JSON.stringify(tipBox));
await page.mouse.move(b2.x + b2.width * 0.97, b2.y + 150);
await sleep(250);
const tipBox2 = await page.$eval(`${chart} .ist-tip`, (e) => { const r = e.getBoundingClientRect(); const h = e.parentElement.getBoundingClientRect(); return { l: r.left - h.left, r: h.right - r.right }; });
ok(tipBox2.l >= -0.5 && tipBox2.r >= -0.5, "bublina ostáva v grafe aj pri pravom okraji", JSON.stringify(tipBox2));
await page.mouse.move(b2.x + b2.width * 0.5, b2.y + b2.height + 200);
await sleep(200);
ok((await page.$(`${chart} .ist-tip`)) === null, "bublina zmizne po odchode myši");
/* deň cez pole */
await setValue(page, "#ist-day", "2009-03-09");
const pinTip = norm(await txt(page, `${chart} .ist-tip`));
ok(pinTip.startsWith("9. marca 2009") && pinTip.includes("Finančná kríza"), "stav ku dňu 9. 3. 2009 s názvom krízy", pinTip);
await setValue(page, "#ist-day", "2009-03-08");
ok(norm(await txt(page, `${chart} .ist-tip`)).startsWith("9. marca 2009"), "nedeľa sa posunie na najbližší obchodný deň");
/* klávesnica */
await page.focus(chart);
await page.keyboard.press("ArrowRight");
await sleep(150);
ok(norm(await txt(page, `${chart} .ist-tip`)).startsWith("10. marca 2009"), "šípka vpravo = ďalší obchodný deň");
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
await sleep(150);
ok(norm(await txt(page, `${chart} .ist-tip`)).startsWith("6. marca 2009"), "šípka vľavo cez víkend = piatok 6. 3. 2009", norm(await txt(page, `${chart} .ist-tip`)));
const aria = await page.$eval(chart, (e) => ({ role: e.getAttribute("role"), text: e.getAttribute("aria-valuetext") }));
ok(aria.role === "slider" && norm(aria.text).startsWith("6. marca 2009, hodnota účtu"), "čítačka obrazovky dostane deň a hodnotu", JSON.stringify(aria));
await page.keyboard.press("Escape");
await sleep(150);
ok((await page.$(`${chart} .ist-tip`)) === null && (await page.$eval("#ist-day", (e) => e.value)) === "", "Esc zruší vybraný deň");
/* legenda */
await clickText(page, "#ist-root .ist-chart-head", "Len akcie");
ok((await paths()) === p0 - 1, "legenda skryje čiaru „Len akcie“");
await clickText(page, "#ist-root .ist-chart-head", "Vklady");
ok((await paths()) === p0 - 3, "legenda skryje vklady");
await clickText(page, "#ist-root .ist-chart-head", "Bez zmeny stratégie");
ok((await paths()) === p0 - 4, "legenda skryje čiaru „Bez zmeny stratégie“");
const axisSmall = (await all(page, `${chart} svg text.ist-ax`)).map(norm);
ok(axisSmall.includes("300 tis.") && !axisSmall.includes("600 tis."), "os sa prispôsobí viditeľným čiaram", JSON.stringify(axisSmall));
for (const t of ["Len akcie", "Vklady", "Bez zmeny stratégie"]) await clickText(page, "#ist-root .ist-chart-head", t);
ok((await paths()) === p0, "legenda čiary vráti");
/* mierka */
await clickText(page, "#ist-root .ist-toolbar", "Logaritmická");
const axisLog = (await all(page, `${chart} svg text.ist-ax`)).map(norm);
ok(axisLog.includes("10 tis.") && axisLog.includes("100 tis.") && axisLog.includes("1 mil.") && !axisLog.includes("0"), "logaritmická mierka", JSON.stringify(axisLog));
await clickText(page, "#ist-root .ist-toolbar", "Lineárna");
ok((await all(page, `${chart} svg text.ist-ax`)).map(norm).includes("0"), "lineárna mierka začína nulou");

/* ================================================================== 3. záložky */
console.log("3. Pohľad do detailu");
const panel = "#ist-root .ist-panel";
ok(norm(await txt(page, `${panel} .ist-summary`)).includes("−50,6 % pod maximom, dňa 12. marca 2003") && norm(await txt(page, `${panel} .ist-summary`)).includes("najhlbší prepad −56,1 %"), "prepady: zhrnutie", norm(await txt(page, `${panel} .ist-summary`)));
const ddAxis = (await all(page, `${panel} svg text.ist-ax`)).map(norm);
ok(ddAxis.includes("0 %") && ddAxis.includes("−60 %"), "prepady: os 0 až −60 %", JSON.stringify(ddAxis));
await page.click("#ist-tab-roky");
await settle(page);
ok((await page.$$eval(`${panel} svg rect[rx]`, (r) => r.length)) === 28, "roky: 28 stĺpcov");
ok(norm(await txt(page, `${panel} .ist-summary`)) === "V pluse skončilo 20 z 28 rokov. Najlepší bol rok 1999 (+44,7 %), najhorší rok 2008 (−31,9 %).", "roky: zhrnutie", norm(await txt(page, `${panel} .ist-summary`)));
const yb = await (await page.$(`${panel} .ist-chart-host`)).boundingBox();
await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "instant" }), `${panel} .ist-chart-host`);
await sleep(150);
const yb2 = await (await page.$(`${panel} .ist-chart-host`)).boundingBox();
await page.mouse.move(yb2.x + 64 + ((yb2.width - 80) / 28) * 9.5, yb2.y + 100);
await sleep(250);
const yTip = norm(await txt(page, `${panel} .ist-tip`));
ok(yTip.startsWith("2008") && yTip.includes("Tvoja stratégia −31,9 %") && yTip.includes("Akcie −37,0 %") && yTip.includes("Dlhopisy +15,3 %"), "roky: bublina pre rok 2008", yTip);
void yb;
await page.mouse.move(5, 5);
await page.click("#ist-tab-krizy");
await settle(page);
const crises = await page.$$eval(`${panel} .ist-crises li`, (li) => li.map((e) => [e.querySelector(".ist-crisis-head b").textContent, e.querySelector(".ist-crisis-head span").textContent, ...[...e.querySelectorAll(".ist-crisis-bars b")].map((b) => b.textContent)].map((t) => t.replace(/ /g, " "))));
ok(JSON.stringify(crises) === JSON.stringify([["Dotcom bublina", "7. 9. 2000 – 12. 3. 2003", "−56,1 %", "−50,6 %"], ["Finančná kríza", "15. 6. 2007 – 9. 3. 2009", "−52,5 %", "−47,0 %"], ["Covid", "19. 2. 2020 – 23. 3. 2020", "−33,7 %", "−20,7 %"], ["Inflačný šok 2022", "4. 1. 2022 – 20. 6. 2022", "−17,0 %", "−13,1 %"]]), "krízy: štyri riadky s číslami", JSON.stringify(crises));
const bars = await page.$$eval(`${panel} .ist-crises li:first-child .ist-bar`, (b) => b.map((e) => e.style.getPropertyValue("--w")));
ok(bars[0] === "100%" && Math.abs(parseFloat(bars[1]) - 90.2) < 0.5, "krízy: dĺžky pruhov zodpovedajú číslam", JSON.stringify(bars));
await page.click("#ist-tab-zaciatky");
await sleep(900);
const horizons = (await all(page, `${panel} .ist-horizon .calc-pill`)).map(norm);
ok(JSON.stringify(horizons) === JSON.stringify(["1 rok", "5 rokov", "10 rokov", "15 rokov", "20 rokov"]), "každý začiatok: dĺžky pre eurový súbor", JSON.stringify(horizons));
const rollFacts = (await all(page, `${panel} .ist-facts dd`)).map(norm);
ok(JSON.stringify(rollFacts) === JSON.stringify(["−1,4 %", "8,3 %", "14,3 %"]), "každý začiatok: 10 rokov", JSON.stringify(rollFacts));
ok(norm(await txt(page, `${panel} .ist-summary`)).startsWith("Z 212 možných začiatkov skončilo 94 % nad tým, čo si vložil."), "každý začiatok: zhrnutie", norm(await txt(page, `${panel} .ist-summary`)));
await page.click("#ist-tab-prepady");
await settle(page);

/* ================================================================== 4. formulár */
console.log("4. Formulár a výpočet");
await clickText(page, "#ist-root .ist-form", "Vyvážená");
await expectScenario(page, "s3_vyvazena", "Vyvážená 60/20/20");
ok((await all(page, "#ist-root .ist-phase")).length === 1 && (await page.$("#ist-root .ist-transition")) === null, "jedna fáza, bez voľby prechodu");
const v3 = norm(await txt(page, "#ist-root .ist-verdict"));
ok(v3.includes("Najhlbší prepad bol −33,0 %, pri čistých akciách by bol −56,1 %") && v3.includes("557 165 €") && v3.includes("216 008 € viac"), "veta oproti čistým akciám", v3);
ok(!(await all(page, "#ist-root .ist-chart-head .ist-legend-item")).some((t) => t.includes("Bez zmeny")), "legenda bez čiary „Bez zmeny stratégie“");
await page.click("#ist-tab-zaciatky");
await sleep(700);
await clickText(page, `${panel} .ist-horizon`, "5 rokov");
await sleep(700);
ok(JSON.stringify((await all(page, `${panel} .ist-facts dd`)).map(norm)) === JSON.stringify(["−1,6 %", "6,5 %", "13,6 %"]) && norm(await txt(page, `${panel} .ist-summary`)).includes("Z 272 možných začiatkov skončilo 97 %"), "každý začiatok: 5 rokov sedí s kontrolným výpočtom", JSON.stringify(await all(page, `${panel} .ist-facts dd`)));
ok(norm(await txt(page, `${panel} .ist-summary`)).includes("od 25 269 € do 42 346 €, typicky 35 145 € z vložených 28 000 €"), "každý začiatok: sumy", norm(await txt(page, `${panel} .ist-summary`)));
await page.click("#ist-tab-prepady");

/* podrobnejšie nastavenie */
await clickText(page, "#ist-root .ist-form", "Podrobnejšie nastavenie");
await clickText(page, "#ist-root .ist-advanced", "Každý mesiac");
await expectScenario(page, "s8_monthly", "mesačné vyvažovanie");
await clickText(page, "#ist-root .ist-advanced", "Raz ročne");
await setValue(page, "#ist-cost", "1");
await expectScenario(page, "s14_cost1", "náklady 1 %");
ok((await fact(page, "Ročný výnos stratégie"))?.sub === "po nákladoch, zložený priemer", "popis výnosu po nákladoch");
await setValue(page, "#ist-cost", "0");
await page.click("#ist-root .ist-switch");
await settle(page);
await expectScenario(page, "s6_real", "po inflácii");
ok(norm(await txt(page, "#ist-root .ist-kicker")) === "Hodnota účtu k 31. 8. 2026, v dnešných cenách" && norm(await txt(page, "#ist-root .ist-hero-unit")) === `z vkladov ${norm(money(E.s6_real.deposits))}`, "po inflácii: nadpis a vklady v dnešných cenách", norm(await txt(page, "#ist-root .ist-hero-unit")));
ok(norm(await txt(page, "#ist-root .ist-blocks-title")).includes("(nad infláciu)"), "po inflácii: výnosy zložiek nad infláciu");
ok(norm(await txt(page, "#ist-root .ist-collapse-meta")) === "po inflácii", "zhrnutie podrobného nastavenia", norm(await txt(page, "#ist-root .ist-collapse-meta")));
await page.click("#ist-root .ist-switch");
await settle(page);
await expectScenario(page, "s3_vyvazena", "späť bez inflácie");

/* vklady */
await setValue(page, "#ist-monthly", "0");
await expectScenario(page, "s15_jednorazovo", "len jednorazový vklad");
const gainFact = await fact(page, "Zhodnotenie vkladu");
ok(gainFact?.value === "+434 %", "bez mesačných vkladov sa ukáže zhodnotenie vkladu", JSON.stringify(gainFact));
await setValue(page, "#ist-initial", "0");
ok(norm(await txt(page, "#ist-root .ist-hero--empty")).startsWith("Zadaj jednorazový alebo mesačný vklad"), "bez vkladov výzva namiesto nuly");
ok((await fact(page, "Ročný výnos stratégie"))?.value === "6,24 %" && (await fact(page, "Najhlbší prepad"))?.value === "−33,0 %", "výnos a prepad stratégie sa počítajú aj bez vkladov", JSON.stringify(await fact(page, "Ročný výnos stratégie")));
await setValue(page, "#ist-initial", "10000");
await setValue(page, "#ist-monthly", "300");
await setValue(page, "#ist-initial", "99999999");
ok((await page.$eval("#ist-initial", (e) => e.value)).replace(/\s/g, "") === "99999999", "počas písania ostáva napísané");
await blur(page, "#ist-initial");
ok(norm(await page.$eval("#ist-initial", (e) => e.value)) === "5 000 000", "vklad nad limit sa oreže na 5 000 000", await page.$eval("#ist-initial", (e) => e.value));
await setValue(page, "#ist-initial", "10000");
await blur(page, "#ist-initial");

/* obdobie */
await clickText(page, "#ist-root .ist-form", "Životný cyklus");
await expectScenario(page, "s1", "späť na životný cyklus").catch(() => {});
await clickText(page, "#ist-root .ist-form", "10 rokov");
ok((await page.$eval("#ist-start", (e) => e.value)) === "2016-08-31", "10 rokov: začiatok 31. 8. 2016", await page.$eval("#ist-start", (e) => e.value));
ok(JSON.stringify((await all(page, "#ist-root .ist-phase-title")).map(norm)) === JSON.stringify(["Od začiatku", "Po 6 rokoch", "Po 8 rokoch"]) && (await pressed("#ist-root .ist-form")).includes("Životný cyklus"), "životný cyklus sa sám prispôsobí 10 rokom", JSON.stringify(await all(page, "#ist-root .ist-phase-title")));
await expectScenario(page, "s4_10rokov", "10 rokov");
/* ručne upravená stratégia sa pri zmene obdobia nemení */
await page.click("#ist-root .ist-phase:nth-child(2) .ist-phase-head");
await settle(page);
await setValue(page, "#ist-from-1", "7");
ok(!(await pressed("#ist-root .ist-form")).includes("Životný cyklus"), "po ručnej úprave už nie je označená predvoľba");
await clickText(page, "#ist-root .ist-form", "5 rokov");
ok(JSON.stringify((await all(page, "#ist-root .ist-phase-title")).map((t) => norm(t).replace("až po konci obdobia", "").trim())) === JSON.stringify(["Od začiatku", "Po 7 rokoch", "Po 8 rokoch"]), "vlastná stratégia ostáva aj po zmene obdobia", JSON.stringify(await all(page, "#ist-root .ist-phase-title")));
await expectScenario(page, "s16_5rokov_vlastna", "5 rokov s vlastnou stratégiou");
const late = (await all(page, "#ist-root .ist-phase-title small")).map(norm);
ok(late.length === 2 && late.every((t) => t === "až po konci obdobia"), "fázy mimo obdobia sú označené", JSON.stringify(late));
ok(norm(await txt(page, "#ist-root .ist-verdict")).includes("Zmena stratégie príde až po konci zvoleného obdobia"), "veta vysvetlí, že zmena sa neprejavila");
await clickText(page, "#ist-root .ist-form", "Celé obdobie");
await clickText(page, "#ist-root .ist-form", "Vyvážená");
await setValue(page, "#ist-start", "2008-03-15");
await setValue(page, "#ist-end", "2020-03-22");
await clickText(page, "#ist-root .ist-form", "Podrobnejšie nastavenie").catch(() => {});
if (!(await page.$("#ist-cost"))) await clickText(page, "#ist-root .ist-form", "Podrobnejšie nastavenie");
await setValue(page, "#ist-cost", "0,5");
ok((await hero(page)) === "76 539 €", "víkendový začiatok a koniec s nákladmi 0,5 %: 76 539 €", await hero(page));
ok(norm(await txt(page, "#ist-root .ist-form .ist-group:nth-child(2) .ist-hint")) === "Počítam od 17. 3. 2008 do 20. 3. 2020, to sú najbližšie dni, keď sa obchodovalo.", "upozornenie na posun na obchodné dni", norm(await txt(page, "#ist-root .ist-form .ist-group:nth-child(2) .ist-hint")));
await blur(page, "#ist-start");
ok((await page.$eval("#ist-start", (e) => e.value)) === "2008-03-15", "napísaný víkendový dátum ostáva v poli");
await setValue(page, "#ist-cost", "0");
await setValue(page, "#ist-start", "0002-01-04");
ok((await hero(page)).length > 0 && norm(await txt(page, "#ist-root .ist-hero-sub span")).startsWith("4. 1. 1999"), "dátum pred začiatkom dát sa počíta od prvého dňa");
await blur(page, "#ist-start");
ok((await page.$eval("#ist-start", (e) => e.value)) === "1999-01-04", "po opustení poľa sa dátum opraví");
await setValue(page, "#ist-end", "1998-05-05");
await blur(page, "#ist-end");
ok((await page.$eval("#ist-end", (e) => e.value)) === "2026-08-31", "koniec pred začiatkom sa vráti na posledný deň dát", await page.$eval("#ist-end", (e) => e.value));
await expectScenario(page, "s3_vyvazena", "celé obdobie po opravách dátumov");

/* kríza → začiatok na vrchole */
await page.click("#ist-tab-krizy");
await settle(page);
await clickText(page, `${panel} .ist-crises li:first-child`, "Čo keby som začal práve na vrchole");
ok((await page.$eval("#ist-start", (e) => e.value)) === "2000-09-07", "začiatok na vrchole dotcom bubliny");
await expectScenario(page, "s11_dotcom_start", "začiatok 7. 9. 2000");
await page.click("#ist-tab-prepady");
await clickText(page, "#ist-root .ist-form", "Celé obdobie");

/* editor stratégie */
console.log("5. Editor stratégie");
await clickText(page, "#ist-root .ist-form", "Konzervatívna");
await expectScenario(page, "s12_konzervativna", "Konzervatívna 30/40/30");
await clickText(page, "#ist-root .ist-form", "Dynamická");
await expectScenario(page, "s13_dynamicka", "Dynamická 90/10/0");
if (!(await page.$("#ist-w-0-0"))) await page.click("#ist-root .ist-phase-head");
await settle(page);
await setValue(page, "#ist-w-0-0", "100");
ok(norm(await txt(page, "#ist-root .ist-phase-mix")) === "100 / 0 / 0", "akcie 100 → ostatné 0", norm(await txt(page, "#ist-root .ist-phase-mix")));
ok((await hero(page)) === "557 165 €", "čisté akcie: 557 165 €", await hero(page));
ok(norm(await txt(page, "#ist-root .ist-verdict")).startsWith("Čisté akcie: najhlbší prepad −56,1 %, návrat na maximum trval 12 rokov a 5 mesiacov."), "veta pre čisté akcie", norm(await txt(page, "#ist-root .ist-verdict")));
ok(!(await all(page, "#ist-root .ist-chart-head .ist-legend-item")).some((t) => t.includes("Len akcie")), "legenda bez čiary „Len akcie“");
ok((await paths()) === 7, "graf bez porovnávacích čiar", String(await paths()));
await setValue(page, "#ist-root .ist-asset:nth-of-type(3) input[type=range]", "20");
ok(norm(await txt(page, "#ist-root .ist-phase-mix")) === "80 / 0 / 20", "peňažný fond 20 berie z akcií", norm(await txt(page, "#ist-root .ist-phase-mix")));
await setValue(page, "#ist-w-0-1", "20");
ok(norm(await txt(page, "#ist-root .ist-phase-mix")) === "60 / 20 / 20", "dlhopisy 20 berú z akcií, peňažný fond ostáva", norm(await txt(page, "#ist-root .ist-phase-mix")));
await expectScenario(page, "s3_vyvazena", "ručne nastavené 60/20/20");
ok(JSON.stringify(await pressed("#ist-root .ist-form .ist-group:nth-child(4) .ist-pills")) === JSON.stringify(["Vyvážená"]), "predvoľba Vyvážená sa označí sama");
await setValue(page, "#ist-w-0-0", "150");
ok(norm(await txt(page, "#ist-root .ist-phase-mix")) === "100 / 0 / 0", "hodnota nad 100 sa oreže");
await setValue(page, "#ist-w-0-0", "");
const sumOk = await page.$$eval("#ist-root .ist-asset-value input", (i) => i.reduce((s, e) => s + Number(e.value), 0));
ok(sumOk === 100, "súčet je vždy 100", String(sumOk));
/* fázy */
await clickText(page, "#ist-root .ist-form", "Dynamická");
await clickText(page, "#ist-root .ist-form", "Pridať zmenu stratégie");
ok(JSON.stringify((await all(page, "#ist-root .ist-phase-title")).map(norm)) === JSON.stringify(["Od začiatku", "Po 17 rokoch"]) && JSON.stringify((await all(page, "#ist-root .ist-phase-mix")).map(norm)) === JSON.stringify(["90 / 10 / 0", "60 / 30 / 10"]), "nová fáza po 17 rokoch, o krok opatrnejšia", JSON.stringify(await all(page, "#ist-root .ist-phase-title")));
ok((await page.$("#ist-from-1")) !== null && (await page.$("#ist-root .ist-transition")) !== null, "nová fáza je otvorená a pribudla voľba prechodu");
await clickText(page, "#ist-root .ist-form", "Pridať zmenu stratégie");
await clickText(page, "#ist-root .ist-form", "Pridať zmenu stratégie");
ok((await all(page, "#ist-root .ist-phase")).length === 4 && !(await all(page, "#ist-root .ist-form button")).some((t) => t.includes("Pridať zmenu stratégie")), "najviac štyri fázy");
ok(JSON.stringify((await all(page, "#ist-root .ist-phase-title")).map((t) => norm(t).replace("až po konci obdobia", "").trim())) === JSON.stringify(["Od začiatku", "Po 17 rokoch", "Po 22 rokoch", "Po 27 rokoch"]), "ďalšie fázy po 5 rokoch", JSON.stringify(await all(page, "#ist-root .ist-phase-title")));
await setValue(page, "#ist-from-3", "5");
await blur(page, "#ist-from-3");
ok(norm(await txt(page, "#ist-root .ist-phase:nth-child(4) .ist-phase-title")).startsWith("Po 23 rokoch"), "fáza nemôže predbehnúť predchádzajúcu", norm(await txt(page, "#ist-root .ist-phase:nth-child(4) .ist-phase-title")));
await clickText(page, "#ist-root .ist-phase:nth-child(4)", "Odstrániť túto zmenu");
ok((await all(page, "#ist-root .ist-phase")).length === 3 && (await page.$("#ist-from-2")) !== null, "po odstránení fázy sa otvorí predchádzajúca");
await clickText(page, "#ist-root .ist-phase:nth-child(3)", "Odstrániť túto zmenu");
ok((await all(page, "#ist-root .ist-phase")).length === 2 && (await all(page, "#ist-root .ist-form button")).some((t) => t.includes("Pridať zmenu stratégie")), "fázy sa dajú odstrániť a znova pridať");
await clickText(page, "#ist-root .ist-form", "Životný cyklus");
await clickText(page, "#ist-root .ist-transition", "Naraz");
await expectScenario(page, "s9_naraz", "zmena naraz");
ok((await page.$("#ist-transition")) === null, "pri zmene naraz nie je dĺžka prechodu");
await clickText(page, "#ist-root .ist-transition", "Postupne");
ok((await hero(page)) === "318 908 €", "postupne 3 roky = predvolený výsledok", await hero(page));

/* ================================================================== 6. súbor USA */
console.log("6. Súbor USA v dolároch");
await clickText(page, "#ist-root .ist-form", "USA v dolároch");
await sleep(500);
ok((await hero(page)) === norm(money(E.s2_usd.final, "$")), `životný cyklus v USA: ${norm(money(E.s2_usd.final, "$"))}`, await hero(page));
ok(JSON.stringify((await all(page, "#ist-root .ist-phase-title")).map(norm)) === JSON.stringify(["Od začiatku", "Po 36 rokoch", "Po 52 rokoch"]), "životný cyklus sa prispôsobí 64 rokom", JSON.stringify(await all(page, "#ist-root .ist-phase-title")));
ok((await page.$eval("#ist-start", (e) => `${e.value}|${e.min}`)) === "1962-01-02|1962-01-02", "dáta od 2. 1. 1962");
ok(norm(await txt(page, "#ist-root .ist-form .ist-group:first-child .ist-hint")).includes("Denné dáta od 2. 1. 1962 do 31. 8. 2026"), "popis súboru");
ok(norm(await page.$eval("#ist-initial", (e) => e.parentElement.textContent)).includes("$"), "mena pri vkladoch je dolár");
const pills = (await all(page, "#ist-root .ist-form .ist-group:nth-child(2) .calc-pill")).map(norm);
ok(JSON.stringify(pills) === JSON.stringify(["Celé obdobie", "30 rokov", "20 rokov", "10 rokov", "5 rokov"]), "skratky obdobia vrátane 30 rokov", JSON.stringify(pills));
await clickText(page, "#ist-root .ist-form", "Vyvážená");
await expectScenario(page, "s10_usd_vyvazena", "USA 60/20/20", "$");
await page.click("#ist-tab-krizy");
await settle(page);
const usCrises = (await all(page, `${panel} .ist-crisis-head b`)).map(norm);
ok(JSON.stringify(usCrises) === JSON.stringify(["Ropná kríza", "Čierny pondelok 1987", "Dotcom bublina", "Finančná kríza", "Covid", "Inflačný šok 2022"]), "šesť kríz v americkom súbore", JSON.stringify(usCrises));
await page.click("#ist-tab-zaciatky");
await sleep(1200);
ok(JSON.stringify((await all(page, `${panel} .ist-horizon .calc-pill`)).map(norm)) === JSON.stringify(["1 rok", "5 rokov", "10 rokov", "15 rokov", "20 rokov", "30 rokov"]), "dĺžky vrátane 30 rokov");
await page.click("#ist-tab-roky");
await settle(page);
ok((await page.$$eval(`${panel} svg rect[rx]`, (r) => r.length)) === 65, "65 rokov v grafe");
await page.click("#ist-tab-prepady");

/* ================================================================== 7. tabuľka, export, zdroje */
console.log("7. Tabuľka, export a zdroje");
await clickText(page, "#ist-root .ist-result", "Tabuľka rok po roku");
const rows = await page.$$eval("#ist-root .ist-table tbody tr", (r) => r.map((e) => [...e.children].map((c) => c.textContent.replace(/ /g, " ").trim())));
ok(rows.length === 65 && rows[0][0] === "1962" && rows[64][0].startsWith("2026") && rows[64][0].includes("neúplný"), "65 riadkov, posledný rok neúplný", JSON.stringify([rows.length, rows[0], rows[64]]));
const r2008 = rows.find((r) => r[0] === "2008");
ok(r2008[2] === "−36,7 %" && r2008[3] === "+22,2 %" && /^\d+ \/ \d+ \/ \d+$/.test(r2008[5]), "rok 2008: akcie −36,7 %, dlhopisy +22,2 %", JSON.stringify(r2008));
ok(rows[64][7] === (await hero(page)), "posledná hodnota v tabuľke = hodnota účtu");
await page.evaluate(() => {
  window.__csv = null;
  const orig = URL.createObjectURL;
  URL.createObjectURL = (blob) => { blob.text().then((t) => { window.__csv = t; }); blob.arrayBuffer().then((b) => { window.__bom = [...new Uint8Array(b.slice(0, 3))]; }); return orig.call(URL, blob); };
  HTMLAnchorElement.prototype.click = function () { window.__csvName = this.download; };
});
await clickText(page, "#ist-root .ist-result", "Stiahnuť denný priebeh (CSV)");
await sleep(500);
const csv = await page.evaluate(() => ({ name: window.__csvName, bom: window.__bom, head: window.__csv?.slice(0, 200), lines: window.__csv?.split("\r\n").length, last: window.__csv?.split("\r\n").pop() }));
ok(csv.name === "investicna-strategia-1962-01-02-2026-08-31.csv" && csv.lines === 16275 && JSON.stringify(csv.bom) === "[239,187,191]" && csv.head.startsWith("datum;hodnota_uctu;vklady;akcie_%;dlhopisy_%;penazny_fond_%;len_akcie\r\n1962-01-02;10300,00;10300,00;60,00;20,00;20,00;10300,00"), "export CSV: značka kódovania pre Excel, hlavička, prvý deň a počet riadkov", JSON.stringify(csv));
ok(csv.last.startsWith("2026-08-31;15240777,34;242800,00;"), "export CSV: posledný deň sedí s výsledkom", csv.last);
await clickText(page, "#ist-root .ist-result", "Odkiaľ sú dáta a ako počítam");
const src = norm(await txt(page, "#ist-root .ist-sources"));
ok(src.includes("Dáta v súbore „USA v dolároch“") && src.includes("Kenneth R. French Data Library") && src.includes("Federal Reserve, tabuľka H.15") && src.includes("U.S. Bureau of Labor Statistics") && src.includes("Posledný deň dát je 31. augusta 2026") && src.includes("neráta s daňou zo zisku") && src.includes("pred poplatkami fondov"), "zdroje a metodika pre USA");
await clickText(page, "#ist-root .ist-form", "Svet v eurách");
await sleep(400);
const src2 = norm(await txt(page, "#ist-root .ist-sources"));
ok(src2.includes("Dáta v súbore „Svet v eurách“") && src2.includes("Deutsche Bundesbank") && src2.includes("Európska centrálna banka") && src2.includes("Eurostat"), "zdroje a metodika pre eurový súbor");

/* ================================================================== 8. odkaz, uloženie, reset */
console.log("8. Odkaz na scenár, uloženie a reset");
await clickText(page, "#ist-root .ist-form", "Životný cyklus");
await setValue(page, "#ist-monthly", "450");
await setValue(page, "#ist-start", "2003-03-12");
await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } }); });
await clickText(page, "#ist-root .ist-form-foot", "Kopírovať odkaz na scenár");
const copied = await page.evaluate(() => window.__copied);
ok(copied === `${origin}/bonusy/investicna-strategia?s=eur&od=2003-03-12&v=10000&m=450&f=0-90-10-0_13-60-30-10_19-30-40-30&p=3`, "odkaz obsahuje celý scenár", copied);
ok(norm(await txt(page, "#ist-root .ist-link")) === "Odkaz je skopírovaný", "potvrdenie skopírovania");
const heroShared = await hero(page);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("jsm_investicna_strategia_v1")));
ok(saved.monthly === 450 && saved.start === "2003-03-12" && saved.phases.length === 3, "nastavenie sa ukladá v prehliadači", JSON.stringify(saved));
await page.close();
page = await open(1440, 1000, copied);
ok((await hero(page)) === heroShared && (await page.$eval("#ist-monthly", (e) => e.value)) === "450" && (await page.$eval("#ist-start", (e) => e.value)) === "2003-03-12", "odkaz otvorí ten istý scenár", await hero(page));
await page.evaluate(() => sessionStorage.setItem("ist-test-keep", "1"));
await page.goto(URL_TOOL, { waitUntil: "networkidle2" });
await page.waitForSelector("#ist-root .ist-hero-value");
await sleep(400);
ok((await hero(page)) === heroShared, "po návrate bez odkazu ostáva uložené nastavenie", await hero(page));
await clickText(page, "#ist-root .ist-form-foot", "Začať odznova");
ok((await hero(page)) === "318 908 €" && (await page.$eval("#ist-monthly", (e) => e.value)) === "300", "„Začať odznova“ vráti predvolený stav", await hero(page));
await page.evaluate(() => localStorage.setItem("jsm_investicna_strategia_v1", "{nezmysel"));
await page.reload({ waitUntil: "networkidle2" });
await page.waitForSelector("#ist-root .ist-hero-value");
await sleep(400);
ok((await hero(page)) === "318 908 €", "poškodené uložené nastavenie nástroj nezhodí", await hero(page));
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
  await p.waitForSelector("#ist-root .ist-hero-value", { timeout: 20000 });
  ok(true, "výpadok dát: „Skúsiť znova“ nástroj načíta");
  await p.close();
}

/* ================================================================== 9. šírky */
console.log("9. Šírky obrazovky");
for (const w of [320, 360, 393, 430, 600, 768, 1024, 1280, 1440, 1920]) {
  const p = await open(w, 900);
  for (const id of ["roky", "krizy", "zaciatky", "prepady"]) { await p.click(`#ist-tab-${id}`); await sleep(id === "zaciatky" ? 600 : 120); }
  await clickText(p, "#ist-root .ist-result", "Tabuľka rok po roku");
  await clickText(p, "#ist-root .ist-result", "Odkiaľ sú dáta a ako počítam");
  const m = await p.evaluate(() => {
    const root = document.getElementById("ist-root");
    const over = document.documentElement.scrollWidth - window.innerWidth;
    const rr = root.getBoundingClientRect();
    const wide = [...root.querySelectorAll("*")].filter((e) => { if (e.closest(".ist-table-wrap") || e.closest("svg")) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > rr.right + 0.5 || r.left < rr.left - 0.5); }).map((e) => e.className || e.tagName).slice(0, 5);
    const svgs = [...root.querySelectorAll(".ist-chart-host")].map((h) => ({ host: Math.round(h.getBoundingClientRect().width), svg: Math.round(h.querySelector("svg")?.getBoundingClientRect().width ?? 0) }));
    const labels = [...root.querySelectorAll(".ist-chart-block svg text.ist-ax")].filter((t) => /^\d{4}$/.test(t.textContent)).map((t) => t.getBoundingClientRect());
    let gap = Infinity;
    for (let i = 1; i < labels.length; i++) gap = Math.min(gap, labels[i].left - labels[i - 1].right);
    const font = parseFloat(getComputedStyle(root.querySelector(".ist-chart-block svg text.ist-ax")).fontSize);
    const hero = root.querySelector(".ist-hero-value").getBoundingClientRect();
    const res = root.querySelector(".ist-result").getBoundingClientRect();
    return { over, wide, svgs, gap, font, heroFits: hero.right <= res.right - 8 };
  });
  ok(m.over <= 0 && m.wide.length === 0, `${w} px: nič nepretŕča`, JSON.stringify([m.over, m.wide]));
  ok(m.svgs.every((s) => s.svg === s.host && s.svg > 200), `${w} px: grafy vyplnia šírku`, JSON.stringify(m.svgs));
  ok(m.gap >= 12 && m.font >= 11 && m.heroFits, `${w} px: popisky osi sa neprekrývajú (medzera ${Math.round(m.gap)} px), písmo ${m.font} px, hlavné číslo sa zmestí`, JSON.stringify(m));
  await p.close();
}

/* najväčšie sumy na najužšej obrazovke */
{
  const p = await open(320, 900, `${URL_TOOL}?s=usd&v=5000000&m=50000&f=0-100-0-0&p=0`);
  const m = await p.evaluate(() => { const r = document.querySelector("#ist-root .ist-result").getBoundingClientRect(); const h = document.querySelector("#ist-root .ist-hero-value").getBoundingClientRect(); return { over: document.documentElement.scrollWidth - innerWidth, fits: h.right <= r.right, text: h.width, hero: document.querySelector("#ist-root .ist-hero-value").textContent }; });
  ok(m.over <= 0 && m.fits, `320 px s najväčšími sumami (${norm(m.hero)}): nič nepretŕča`, JSON.stringify(m));
  await p.close();
}

/* dotyk */
{
  const p = await open(393, 850);
  await p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "instant" }), chart);
  await sleep(200);
  const b = await (await p.$(chart)).boundingBox();
  await p.touchscreen.tap(b.x + b.width * 0.55, b.y + 120);
  await sleep(300);
  const t = norm(await txt(p, `${chart} .ist-tip`));
  ok(!!t && t.includes("Hodnota účtu") && (await p.$eval("#ist-day", (e) => e.value)) !== "", "dotyk pripne deň a ukáže bublinu", t);
  const tb = await p.$eval(`${chart} .ist-tip`, (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: window.innerWidth - r.right }; });
  ok(tb.l >= 0 && tb.r >= 0, "bublina na mobile ostáva na obrazovke", JSON.stringify(tb));
  await p.close();
}

/* ================================================================== 10. prehľad bonusov */
console.log("10. Prehľad bonusov a navigácia");
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 1000 });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${origin}/bonusy`, { waitUntil: "networkidle2" });
  await sleep(500);
  const d = await p.evaluate(() => {
    const card = document.querySelector('a.bz-card[href="/bonusy/investicna-strategia"]');
    const lib = [...document.querySelectorAll('[aria-labelledby="bonusy-library-heading"] a.bz-card')].map((a) => a.getAttribute("href").split("/").pop());
    return {
      eyebrow: document.querySelector(".bz-eyebrow")?.textContent,
      card: card ? { cat: card.querySelector(".bz-cat").textContent, badge: card.querySelector(".bz-new")?.textContent, title: card.querySelector(".bz-card-title").textContent, text: card.querySelector(".bz-card-text").textContent, glyph: !!card.querySelector(".bz-glyph svg path"), bg: getComputedStyle(card).backgroundColor } : null,
      lib,
      count: document.querySelector("#bonusy-library-heading small")?.textContent,
      nav: [...document.querySelectorAll("header a")].map((a) => a.getAttribute("href")).filter((h) => h?.includes("investicna-strategia")).length,
    };
  });
  ok(d.eyebrow === "Bonusy · 14 nástrojov zadarmo", "prehľad: 14 nástrojov", d.eyebrow);
  ok(d.card && d.card.cat === "Investovanie" && d.card.badge === "Nové" && d.card.title === "Investičná stratégia" && d.card.glyph && d.card.bg === "rgb(41, 36, 32)", "karta nástroja na prehľade", JSON.stringify(d.card));
  ok(d.lib.indexOf("investicna-strategia") === d.lib.indexOf("investicna-kalkulacka") + 1 && d.count === "11", "karta je hneď za investičnou kalkulačkou, knižnica má 11 nástrojov", JSON.stringify([d.lib, d.count]));
  await p.click('a.bz-card[href="/bonusy/investicna-strategia"]');
  await p.waitForSelector("#ist-root .ist-hero-value", { timeout: 20000 });
  ok(p.url().endsWith("/bonusy/investicna-strategia"), "karta otvorí nástroj");
  await p.close();
}

console.log(`\n${pass} kontrol prešlo, ${fail} zlyhalo`, errors.length ? `| chyby v konzole: ${[...new Set(errors)].join(" | ")}` : "| konzola bez chýb");
await browser.close();
process.exit(fail || errors.length ? 1 : 0);
