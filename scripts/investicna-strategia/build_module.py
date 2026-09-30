"""Z out/series.json poskladá dátový modul pre nástroj Investičná stratégia (TypeScript) a kontrolné prípady pre testy.

Denné výnosy sa ukladajú ako celé čísla (Int16) v jednotkách:
  akcie 1e-5, dlhopisy 2e-6, peňažný fond 1e-7
a dni ako rozostupy v dňoch (Uint8) od prvého dňa. Všetko v base64, aby bol modul malý.
Kontrolné prípady počíta nezávislá implementácia modelu v Pythone nad rovnakými (zaokrúhlenými) dátami.
"""
import base64
import json
import math
import struct
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).parent
S = json.loads((HERE / "out" / "series.json").read_text(encoding="utf-8"))
RAW = HERE / "raw"
UNIT = {"stock": 1e-5, "bond": 2e-6, "cash": 1e-7}


def iso(s):
    y, m, d = s.split("-")
    return date(int(y), int(m), int(d))


def pack_i16(vals):
    return base64.b64encode(struct.pack("<%dh" % len(vals), *vals)).decode("ascii")


def pack_u8(vals):
    return base64.b64encode(bytes(vals)).decode("ascii")


# ------------------------------------------------------------------ inflácia
hicp = {k: v for k, v in S["hicp"].items()}
cpi_us = json.loads((RAW / "bls_cpi.json").read_text())
if "2025-10" not in cpi_us:  # BLS pre výpadok úradov tento mesiac nezverejnil: geometrický stred susedných mesiacov
    cpi_us["2025-10"] = round(math.sqrt(cpi_us["2025-09"] * cpi_us["2025-11"]), 3)


def fill_tail(cpi, last_month):
    """Index cien vychádza s oneskorením: chýbajúce posledné mesiace dostanú poslednú známu hodnotu."""
    known = sorted(cpi)
    y, m = map(int, known[-1].split("-"))
    while f"{y}-{m:02d}" < last_month:
        m += 1
        if m == 13:
            y, m = y + 1, 1
        cpi[f"{y}-{m:02d}"] = cpi[known[-1]]
        print("  index cien: mesiac", f"{y}-{m:02d}", "ešte nie je zverejnený, použitá posledná známa hodnota")


def month_list(first, last):
    y, m = map(int, first.split("-"))
    out = []
    while f"{y}-{m:02d}" <= last:
        out.append(f"{y}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


sets = {}
for key, cur, cpi in (("eur", "€", hicp), ("usd", "$", cpi_us)):
    raw = S[key]
    days = [iso(d) for d in raw["days"]]
    q = {}
    for a in ("stock", "bond", "cash"):
        vals = [int(round(r / UNIT[a])) for r in raw[a]]
        assert max(abs(v) for v in vals) < 32767, (key, a, max(abs(v) for v in vals))
        q[a] = vals
    gaps = [0] + [(days[i] - days[i - 1]).days for i in range(1, len(days))]
    assert max(gaps) < 256 and min(gaps[1:]) >= 1
    first_m = f"{days[0].year - 1}-12" if days[0].month == 1 else f"{days[0].year}-{days[0].month - 1:02d}"
    fill_tail(cpi, f"{days[-1].year}-{days[-1].month:02d}")
    months = month_list(first_m, f"{days[-1].year}-{days[-1].month:02d}")
    assert all(m in cpi for m in months), [m for m in months if m not in cpi][:5]
    sets[key] = {"days": days, "q": q, "gaps": gaps, "cpi_first": first_m, "cpi": [cpi[m] for m in months], "cur": cur}
    print(key, days[0], "→", days[-1], len(days), "dní; max |akcie|", max(abs(v) for v in q["stock"]), "max |dlhopisy|", max(abs(v) for v in q["bond"]), "max |peňažný fond|", max(abs(v) for v in q["cash"]), "| CPI", first_m, "→", months[-1])


# ------------------------------------------------------------------ krízy: vrchol a dno akciového indexu v danom okne
def stock_index(st):
    idx, v = [], 1.0
    for r in st["q"]["stock"]:
        v *= 1 + r * UNIT["stock"]
        idx.append(v)
    return idx


CRISES = {
    "usd": [
        ("ropna", "Ropná kríza", "1972-12-01", "1974-12-31"),
        ("pondelok", "Čierny pondelok 1987", "1987-08-01", "1987-12-31"),
        ("dotcom", "Dotcom bublina", "2000-01-01", "2002-12-31"),
        ("financna", "Finančná kríza", "2007-06-01", "2009-06-30"),
        ("covid", "Covid", "2020-01-15", "2020-06-30"),
        ("inflacia", "Inflačný šok 2022", "2021-11-01", "2022-12-31"),
    ],
    "eur": [
        ("dotcom", "Dotcom bublina", "2000-01-01", "2003-06-30"),
        ("financna", "Finančná kríza", "2007-04-01", "2009-06-30"),
        ("covid", "Covid", "2020-01-15", "2020-06-30"),
        ("inflacia", "Inflačný šok 2022", "2021-11-01", "2022-12-31"),
    ],
}
for key, st in sets.items():
    idx = stock_index(st)
    out = []
    for cid, name, a, b in CRISES[key]:
        ia = next(i for i, d in enumerate(st["days"]) if d >= iso(a))
        ib = max(i for i, d in enumerate(st["days"]) if d <= iso(b))
        # najhlbší prepad v okne: dvojica vrchol → dno
        best, peak_i, res = 0.0, ia, (ia, ia)
        for i in range(ia, ib + 1):
            if idx[i] > idx[peak_i]:
                peak_i = i
            dd = idx[i] / idx[peak_i] - 1
            if dd < best:
                best, res = dd, (peak_i, i)
        out.append({"id": cid, "name": name, "peak": st["days"][res[0]].isoformat(), "trough": st["days"][res[1]].isoformat(), "drop": round(best, 4)})
        print(f"  {key} {name:22s} vrchol {st['days'][res[0]]}  dno {st['days'][res[1]]}  akcie {best * 100:6.1f} %")
    st["crises"] = out


# ================================================================== nezávislý kontrolný výpočet modelu
def add_months(d: date, k: int) -> date:
    y = d.year + (d.month - 1 + k) // 12
    m = (d.month - 1 + k) % 12 + 1
    last = (date(y + (m == 12), (m % 12) + 1, 1) - timedelta(days=1)).day
    return date(y, m, min(d.day, last))


def first_on_or_after(days, target):
    lo, hi = 0, len(days)
    while lo < hi:
        mid = (lo + hi) // 2
        if days[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo  # môže byť len(days)


def last_on_or_before(days, target):
    return first_on_or_after(days, target + timedelta(days=1)) - 1


def cpi_at(st, d: date) -> float:
    """Cenová hladina v daný deň: lineárne medzi stredmi mesiacov (mesačný index patrí 15. dňu mesiaca)."""
    fy, fm = map(int, st["cpi_first"].split("-"))
    pos = (d.year - fy) * 12 + (d.month - fm) + (d.day - 15) / 30.0
    pos = max(0.0, min(len(st["cpi"]) - 1.0, pos))
    lo = int(math.floor(pos))
    hi = min(len(st["cpi"]) - 1, lo + 1)
    return st["cpi"][lo] + (st["cpi"][hi] - st["cpi"][lo]) * (pos - lo)


GOAL_TARGET = (20, 40, 40)
RENT_TARGET = (50, 30, 20)
BRAKE_YEARS = 10


def normalize(w):
    """Tri celé čísla so súčtom 100: celé časti a zvyšné body podľa najväčších zvyškov (pri zhode nižší index)."""
    total = sum(w)
    scaled = [x / total * 100 for x in w]
    out = [int(math.floor(x + 1e-9)) for x in scaled]
    rest = 100 - sum(out)
    for i in sorted(range(3), key=lambda i: (-(scaled[i] - out[i]), i)):
        if rest <= 0:
            break
        out[i] += 1
        rest -= 1
    return tuple(out)


def rows_for(inp, n_rows):
    """Zloženie portfólia pre každý rok investovania (1..n_rows), v percentách.
    brzda none = stále rovnaké; goal/rent = posledných BRAKE_YEARS rokov lineárne k cieľu; custom = vlastné riadky."""
    alloc = tuple(inp["alloc"])
    brake = inp.get("brake", "none")
    if brake == "custom":
        rows = [tuple(r) for r in inp["custom"]] or [alloc]
        rows = rows[:n_rows] + [rows[-1]] * max(0, n_rows - len(rows))
        return [normalize(r) for r in rows]
    if brake in ("goal", "rent"):
        target = GOAL_TARGET if brake == "goal" else RENT_TARGET
        L = min(BRAKE_YEARS, n_rows)
        out = []
        for k in range(n_rows):
            if k < n_rows - L:
                out.append(alloc)
            else:
                x = (k - (n_rows - L) + 1) / L
                out.append(normalize([alloc[j] + (target[j] - alloc[j]) * x for j in range(3)]))
        return out
    return [alloc] * n_rows


def n_rows_of(start, end):
    return max(1, math.ceil((end - start).days / 365.25 - 0.02))


def simulate(st, inp, rows=None, i0=None, i1=None):
    days = st["days"]
    if i0 is None:
        i0 = first_on_or_after(days, iso(inp["start"]))
        i1 = last_on_or_before(days, iso(inp["end"]))
    assert 0 <= i0 < i1 < len(days)
    start, end = days[i0], days[i1]
    n_rows = n_rows_of(start, end)
    rows = rows if rows is not None else rows_for(inp, n_rows)
    rows = [tuple(x / 100 for x in r) for r in rows]
    ret = {a: [v * UNIT[a] for v in st["q"][a]] for a in ("stock", "bond", "cash")}
    dep_days = {}
    k = 0
    while True:
        i = first_on_or_after(days, add_months(start, k))
        if i >= i1:
            break
        dep_days[i] = (k, (inp["initial"] if k == 0 else 0) + inp["monthly"])
        k += 1
    every = 1 if inp["rebalance"] == "monthly" else 12
    notional = 0 if inp["initial"] + inp["monthly"] > 0 else 1
    h = [0.0, 0.0, 0.0]
    unit, units, values, deposits, dep_sum = 1.0, [], [], [], 0.0
    flows = []
    cpi0, cpi1 = cpi_at(st, start), cpi_at(st, end)
    for i in range(i0, i1 + 1):
        d = days[i]
        if i > i0:
            before = sum(h)
            fee = 1 - inp["cost"] / 100 * (d - days[i - 1]).days / 365.25
            h = [h[0] * (1 + ret["stock"][i]) * fee, h[1] * (1 + ret["bond"][i]) * fee, h[2] * (1 + ret["cash"][i]) * fee]
            if before > 0:
                unit *= sum(h) / before
        if i in dep_days:
            kk, amount = dep_days[i]
            w = rows[min(len(rows) - 1, kk // 12)]
            amount_in = amount + (notional if kk == 0 else 0)
            if amount_in > 0:
                h = [h[j] + amount_in * w[j] for j in range(3)]
            if amount > 0 and not notional:
                real_amount = amount * (cpi1 / cpi_at(st, d)) if inp["real"] else amount
                dep_sum += real_amount
                flows.append(((end - d).days / 365.25, real_amount))
            if kk % every == 0:
                total = sum(h)
                h = [total * w[j] for j in range(3)]
        units.append(unit * (cpi0 / cpi_at(st, d)) if inp["real"] else unit)
        values.append(0.0 if notional else (sum(h) * (cpi1 / cpi_at(st, d)) if inp["real"] else sum(h)))
        deposits.append(dep_sum)
    years = (end - start).days / 365.25
    final = values[-1]

    def npv(r):
        return sum(a * (1 + r) ** t for t, a in flows) - final
    irr = None
    if flows:
        lo, hi = -0.99, 10.0
        for _ in range(200):
            mid = (lo + hi) / 2
            if npv(mid) > 0:
                hi = mid
            else:
                lo = mid
        irr = (lo + hi) / 2
    peak_i, best, res = 0, 0.0, (0, 0)
    for j, u in enumerate(units):
        if u > units[peak_i]:
            peak_i = j
        dd = u / units[peak_i] - 1
        if dd < best:
            best, res = dd, (peak_i, j)
    rec = next((j for j in range(res[1], len(units)) if units[j] >= units[res[0]]), None) if best < 0 else None
    logs = [math.log(units[j] / units[j - 1]) for j in range(1, len(units))]
    mean = sum(logs) / len(logs)
    vol = math.sqrt(sum((x - mean) ** 2 for x in logs) / (len(logs) - 1)) * math.sqrt(252) if len(logs) > 1 else 0.0
    yearly, profit = {}, {}
    prev, prev_value, prev_dep = 1.0, values[0] - deposits[0], 0.0
    for j, u in enumerate(units):
        y = days[i0 + j].year
        if j + 1 == len(units) or days[i0 + j + 1].year != y:
            yearly[str(y)] = u / prev - 1
            profit[str(y)] = values[j] - prev_value - (deposits[j] - prev_dep)
            prev, prev_value, prev_dep = u, values[j], deposits[j]
    return {
        "start": start.isoformat(), "end": end.isoformat(), "days": i1 - i0 + 1, "rows": n_rows, "final": final, "deposits": dep_sum, "unit": units[-1],
        "twr": units[-1] ** (1 / years) - 1, "irr": irr, "maxDrawdown": best, "ddPeak": days[i0 + res[0]].isoformat(), "ddTrough": days[i0 + res[1]].isoformat(),
        "ddRecovery": days[i0 + rec].isoformat() if rec is not None else None, "volatility": vol, "yearly": yearly, "profit": profit,
        "depositCount": len([1 for v in dep_days.values() if v[1] > 0]), "allocation": [list(r) for r in rows_for(inp, n_rows)],
        "_units": units, "_i0": i0,
    }


def crises_of(st, inp, run, stock_run):
    out = []
    days = st["days"]
    for c in st["crises"]:
        ip, it = days.index(iso(c["peak"])), days.index(iso(c["trough"]))
        if ip < run["_i0"] or it > run["_i0"] + len(run["_units"]) - 1:
            continue
        a, b = ip - run["_i0"], it - run["_i0"]
        out.append({"id": c["id"], "strategy": run["_units"][b] / run["_units"][a] - 1, "stocks": stock_run["_units"][b] / stock_run["_units"][a] - 1})
    return out


def rolling(st, inp, horizon):
    days = st["days"]
    rows = []
    seen = set()
    for i, d in enumerate(days):
        ym = (d.year, d.month)
        if ym in seen:
            continue
        seen.add(ym)
        target = add_months(d, 12 * horizon)
        if target > days[-1]:
            break
        i1 = last_on_or_before(days, target)
        r = simulate(st, inp, i0=i, i1=i1)
        rows.append({"start": d.isoformat(), "ann": r["twr"], "final": r["final"], "deposits": r["deposits"]})

    def med(v):
        v = sorted(v)
        n = len(v)
        return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2
    ann = [r["ann"] for r in rows]
    fin = [r["final"] for r in rows]
    worst = min(rows, key=lambda r: r["ann"])
    best = max(rows, key=lambda r: r["ann"])
    return {"horizon": horizon, "count": len(rows), "annMin": min(ann), "annMedian": med(ann), "annMax": max(ann), "finalMin": min(fin), "finalMedian": med(fin), "finalMax": max(fin),
            "positive": sum(1 for r in rows if r["final"] >= r["deposits"]) / len(rows), "worstStart": worst["start"], "bestStart": best["start"], "firstStart": rows[0]["start"], "lastStart": rows[-1]["start"]}


BASE = {"initial": 10000, "monthly": 300, "alloc": [60, 20, 20], "brake": "none", "custom": [], "rebalance": "yearly", "cost": 0, "real": False, "years": 20}
LIFE = [[90, 10, 0]] * 15 + [[60, 30, 10]] * 7 + [[30, 40, 30]] * 6
CASES = [
    {"name": "EUR celé obdobie, 80/15/5 bez brzdy", "set": "eur", "start": "1999-01-04", "end": "2026-08-31", "alloc": [80, 15, 5], "rolling": 10},
    {"name": "EUR len akcie, jednorazovo", "set": "eur", "start": "1999-01-04", "end": "2026-08-31", "initial": 10000, "monthly": 0, "alloc": [100, 0, 0]},
    {"name": "EUR len dlhopisy, jednorazovo", "set": "eur", "start": "1999-01-04", "end": "2026-08-31", "initial": 10000, "monthly": 0, "alloc": [0, 100, 0]},
    {"name": "EUR len peňažný fond, jednorazovo", "set": "eur", "start": "1999-01-04", "end": "2026-08-31", "initial": 10000, "monthly": 0, "alloc": [0, 0, 100]},
    {"name": "EUR od vrcholu 2000, brzda na cieľ", "set": "eur", "start": "2000-03-27", "end": "2026-08-31", "alloc": [90, 10, 0], "brake": "goal"},
    {"name": "EUR od vrcholu 2000, brzda na rentu, mesačné vyvažovanie", "set": "eur", "start": "2000-03-27", "end": "2026-08-31", "alloc": [90, 10, 0], "brake": "rent", "rebalance": "monthly"},
    {"name": "EUR vlastné riadky (životný cyklus 15/22), celé obdobie", "set": "eur", "start": "1999-01-04", "end": "2026-08-31", "alloc": [90, 10, 0], "brake": "custom", "custom": LIFE},
    {"name": "EUR vlastné riadky kratšie ako obdobie (posledný riadok sa opakuje)", "set": "eur", "start": "2005-01-03", "end": "2026-08-31", "alloc": [70, 20, 10], "brake": "custom", "custom": [[70, 20, 10], [70, 20, 10], [50, 30, 20]]},
    {"name": "EUR víkendový začiatok a koniec, náklady 0,5 %", "set": "eur", "start": "2008-03-15", "end": "2020-03-22", "cost": 0.5},
    {"name": "EUR po inflácii", "set": "eur", "start": "2010-06-01", "end": "2026-08-31", "real": True},
    {"name": "EUR len mesačné vklady, začiatok 31. v mesiaci", "set": "eur", "start": "2015-01-31", "end": "2025-12-31", "initial": 0, "monthly": 500, "alloc": [70, 20, 10]},
    {"name": "EUR predvolené nastavenie nástroja (20 rokov, 60/20/20, bez brzdy)", "set": "eur", "start": "2006-08-31", "end": "2026-08-31"},
    {"name": "EUR 20 rokov, brzda na cieľ", "set": "eur", "start": "2006-08-31", "end": "2026-08-31", "brake": "goal"},
    {"name": "EUR 5 rokov, brzda na cieľ (kratšie ako 10 rokov)", "set": "eur", "start": "2021-08-31", "end": "2026-08-31", "alloc": [100, 0, 0], "brake": "goal"},
    {"name": "USD celé obdobie, 60/20/20", "set": "usd", "start": "1962-01-02", "end": "2026-08-31", "rolling": 15},
    {"name": "USD 40 rokov, brzda na rentu po inflácii s nákladmi", "set": "usd", "start": "1986-08-31", "end": "2026-08-31", "alloc": [80, 15, 5], "brake": "rent", "real": True, "cost": 0.3, "rebalance": "monthly", "rolling": 20},
    {"name": "USD len akcie, jednorazovo", "set": "usd", "start": "1962-01-02", "end": "2026-08-31", "initial": 10000, "monthly": 0, "alloc": [100, 0, 0]},
    {"name": "USD pred čiernym pondelkom, vlastné riadky", "set": "usd", "start": "1987-08-25", "end": "2026-08-31", "alloc": [100, 0, 0], "brake": "custom", "custom": [[100, 0, 0]] * 15 + [[70, 25, 5]] * 10 + [[50, 35, 15]] * 10 + [[25, 40, 35]] * 5},
    {"name": "USD po inflácii s nákladmi, 1973 až 1983", "set": "usd", "start": "1973-01-11", "end": "1983-01-11", "real": True, "cost": 1, "initial": 50000, "monthly": 0, "alloc": [50, 30, 20]},
    {"name": "USD krátke obdobie covid", "set": "usd", "start": "2020-02-19", "end": "2020-12-31", "initial": 20000, "monthly": 1000, "alloc": [80, 20, 0]},
]
cases = []
for c in CASES:
    inp = {**BASE, **{k: v for k, v in c.items() if k not in ("name", "rolling")}}
    st = sets[inp["set"]]
    res = simulate(st, inp)
    stocks = simulate(st, inp, rows=[(100, 0, 0)])
    other = simulate(st, {**inp, "real": not inp["real"]})
    exp = {k: v for k, v in res.items() if not k.startswith("_")}
    exp["stocksFinal"], exp["stocksTwr"], exp["stocksMaxDrawdown"] = stocks["final"], stocks["twr"], stocks["maxDrawdown"]
    exp["otherModeFinal"], exp["otherModeDeposits"], exp["otherModeTwr"], exp["otherModeProfit"] = other["final"], other["deposits"], other["twr"], other["profit"]
    exp["crises"] = crises_of(st, inp, res, stocks)
    if "rolling" in c:
        exp["rolling"] = rolling(st, inp, c["rolling"])
    cases.append({"name": c["name"], "inputs": inp, "expected": exp})
    extra = f"  | {exp['rolling']['count']} začiatkov na {c['rolling']} r.: {exp['rolling']['annMin'] * 100:.2f} / {exp['rolling']['annMedian'] * 100:.2f} / {exp['rolling']['annMax'] * 100:.2f} % p. a." if "rolling" in c else ""
    print(f"{c['name'][:60]:60s} riadkov {res['rows']:2d} konečná {res['final']:13.2f} vklady {res['deposits']:10.2f} ročne {res['twr'] * 100:6.2f} % prepad {res['maxDrawdown'] * 100:6.1f} % | len akcie {stocks['final']:13.2f}{extra}")

# ------------------------------------------------------------------ výstup
(HERE / "out" / "cases.json").write_text(json.dumps(cases, ensure_ascii=False, indent=1), encoding="utf-8")

lines = [
    "/**",
    " * Investičná stratégia – historické denné dáta (generovaný súbor, neupravovať ručne).",
    f" * Vygenerované {date.today().isoformat()} skriptom scripts/investicna-strategia/build_module.py; posledný deň dát {S['end']}.",
    " *",
    " * Zdroje:",
    " *  - akcie: Kenneth R. French Data Library (Dartmouth College). USA = celý americký akciový trh (CRSP), svet = rozvinuté trhy.",
    " *    Denný celkový výnos vrátane dividend; svetové akcie prepočítané z USD na EUR referenčným kurzom ECB.",
    " *  - dlhopisy EUR: Deutsche Bundesbank, denná výnosová krivka nemeckých štátnych dlhopisov (Svensson). Výnos rebríka kupónových",
    " *    dlhopisov so splatnosťou 7 až 10 rokov je dopočítaný z krivky.",
    " *  - dlhopisy USD: Board of Governors of the Federal Reserve System, tabuľka H.15, 10-ročný štátny dlhopis s konštantnou splatnosťou.",
    " *    Celkový výnos je dopočítaný z denných výnosov do splatnosti.",
    " *  - peňažný fond EUR: ECB, sadzba EONIA do 30. 9. 2019, potom €STR. USD: 1-mesačné pokladničné poukážky (K. R. French).",
    " *  - inflácia: HICP eurozóny (ECB/Eurostat), CPI-U USA (U.S. Bureau of Labor Statistics; október 2025 dopočítaný).",
    " *",
    " * Kódovanie: denné výnosy sú celé čísla Int16 (little endian) v base64; jednotky v UNIT. Dni sú rozostupy v dňoch (Uint8).",
    " */",
    "",
    "export type SetId = \"eur\" | \"usd\";",
    "",
    "export type RawCrisis = { id: string; name: string; peak: string; trough: string; drop: number };",
    "",
    "export type RawSet = {",
    "  start: string;",
    "  end: string;",
    "  n: number;",
    "  currency: string;",
    "  gaps: string;",
    "  stock: string;",
    "  bond: string;",
    "  cash: string;",
    "  cpiFirst: string;",
    "  cpi: number[];",
    "  crises: RawCrisis[];",
    "};",
    "",
    "export const UNIT = { stock: 1e-5, bond: 2e-6, cash: 1e-7 } as const;",
    "",
    f"export const DATA_END = \"{S['end']}\";",
    "",
    "export const RAW: Record<SetId, RawSet> = {",
]
for key, st in sets.items():
    lines += [
        f"  {key}: {{",
        f"    start: \"{st['days'][0].isoformat()}\",",
        f"    end: \"{st['days'][-1].isoformat()}\",",
        f"    n: {len(st['days'])},",
        f"    currency: \"{st['cur']}\",",
        f"    gaps: \"{pack_u8(st['gaps'])}\",",
        f"    stock: \"{pack_i16(st['q']['stock'])}\",",
        f"    bond: \"{pack_i16(st['q']['bond'])}\",",
        f"    cash: \"{pack_i16(st['q']['cash'])}\",",
        f"    cpiFirst: \"{st['cpi_first']}\",",
        f"    cpi: {json.dumps(st['cpi'])},",
        f"    crises: {json.dumps(st['crises'], ensure_ascii=False)},",
        "  },",
    ]
lines += ["};", ""]
module = "\n".join(lines)
(HERE / "out" / "investicnaStrategiaData.ts").write_text(module, encoding="utf-8")
print("\nmodul:", round(len(module.encode("utf-8")) / 1024), "kB; kontrolných prípadov:", len(cases))

# ------------------------------------------------------------------ kontrolné prípady ako modul pre testy
fixture = [
    "/**",
    " * Investičná stratégia – kontrolné prípady pre testy (generovaný súbor, neupravovať ručne).",
    " * Očakávané hodnoty spočítala nezávislá implementácia modelu v Pythone (scripts/investicna-strategia/build_module.py) nad rovnakými dátami.",
    " */",
    "",
    'import type { Inputs } from "./investicnaStrategiaModel";',
    "",
    "export type Expected = {",
    "  start: string;",
    "  end: string;",
    "  days: number;",
    "  final: number;",
    "  deposits: number;",
    "  unit: number;",
    "  twr: number;",
    "  irr: number | null;",
    "  maxDrawdown: number;",
    "  ddPeak: string;",
    "  ddTrough: string;",
    "  ddRecovery: string | null;",
    "  volatility: number;",
    "  yearly: Record<string, number>;",
    "  profit: Record<string, number>;",
    "  rows: number;",
    "  allocation: number[][];",
    "  depositCount: number;",
    "  stocksFinal: number;",
    "  stocksTwr: number;",
    "  stocksMaxDrawdown: number;",
    "  otherModeFinal: number;",
    "  otherModeDeposits: number;",
    "  otherModeTwr: number;",
    "  otherModeProfit: Record<string, number>;",
    "  crises: { id: string; strategy: number; stocks: number }[];",
    "  rolling?: {",
    "    horizon: number;",
    "    count: number;",
    "    annMin: number;",
    "    annMedian: number;",
    "    annMax: number;",
    "    finalMin: number;",
    "    finalMedian: number;",
    "    finalMax: number;",
    "    positive: number;",
    "    worstStart: string;",
    "    bestStart: string;",
    "    firstStart: string;",
    "    lastStart: string;",
    "  };",
    "};",
    "",
    "export type Case = { name: string; inputs: Inputs; expected: Expected };",
    "",
    "export const CASES: Case[] = " + json.dumps(cases, ensure_ascii=False, indent=2) + ";",
    "",
]
(HERE / "out" / "investicnaStrategia.cases.ts").write_text("\n".join(fixture), encoding="utf-8")
print("kontrolné prípady pre testy zapísané")

# ------------------------------------------------------------------ očakávané hodnoty pre kontrolu v prehliadači (ui-check.mjs)
UI_BASE = {**BASE, "initial": 5000, "monthly": 150, "set": "eur", "start": "2006-08-31", "end": S["end"]}
UI = {
    "s1_default": {},
    "s2_goal": {"brake": "goal"},
    "s3_rent": {"brake": "rent"},
    "s4_dynamicka": {"alloc": [100, 0, 0]},
    "s5_konzervativna": {"alloc": [30, 40, 30]},
    "s6_real": {"real": True},
    "s7_30rokov_usd": {"set": "usd", "start": "1996-08-31"},
    "s8_usd_40": {"set": "usd", "start": "1986-08-31"},
    "s9_cost1": {"cost": 1},
    "s10_monthly": {"rebalance": "monthly"},
    "s11_jednorazovo": {"monthly": 0},
    "s12_10rokov": {"start": "2016-08-31"},
    "s13_eur_max": {"start": "1999-01-04"},
    "s14_custom_row5": {"brake": "custom", "custom": [[60, 20, 20]] * 4 + [[30, 20, 50]] * 16},
    "s15_dotcom": {"start": "2000-09-07"},
}
ui_expected = {}
for key, change in UI.items():
    inp = {**UI_BASE, **change}
    res = simulate(sets[inp["set"]], inp)
    ui_expected[key] = {k: res[k] for k in ("start", "end", "rows", "final", "deposits", "twr", "irr", "maxDrawdown", "ddPeak", "ddTrough", "ddRecovery", "depositCount", "allocation", "profit")}
(HERE / "out" / "ui_expected.json").write_text(json.dumps(ui_expected, indent=1), encoding="utf-8")
print("očakávané hodnoty pre kontrolu v prehliadači zapísané:", len(ui_expected))

# ------------------------------------------------------------------ kópia do zdrojového kódu nástroja
TARGET = HERE.parent.parent / "src" / "components" / "calculators" / "investicna-strategia"
if TARGET.is_dir():
    for name in ("investicnaStrategiaData.ts", "investicnaStrategia.cases.ts"):
        (TARGET / name).write_text((HERE / "out" / name).read_text(encoding="utf-8"), encoding="utf-8")
    print("skopírované do", TARGET)
