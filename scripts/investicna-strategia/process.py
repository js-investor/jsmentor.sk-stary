"""Spracovanie historických denných dát pre nástroj Investičná stratégia.

Vstup (priečinok raw/):
  - knižnica K. Frencha (Dartmouth): denné a mesačné výnosy akciového trhu, USA (CRSP) a rozvinuté trhy sveta
  - ECB: kurz USD/EUR, EONIA, €STR, HICP
  - Deutsche Bundesbank: denné bezkupónové výnosy nemeckých štátnych dlhopisov (Svensson), splatnosť 7 až 10 rokov
  - Federálny rezervný systém, tabuľka H.15: denné výnosy amerických štátnych dlhopisov s konštantnou splatnosťou

Výstup: out/series.json s dennými výnosmi troch zložiek pre obe sady a kontrolné ročné výnosy.
"""
import csv
import json
import math
from collections import OrderedDict
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "raw"
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)


def d8(s: str) -> date:
    s = s.strip()
    return date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def iso(s: str) -> date:
    y, m, d = s.strip().split("-")
    return date(int(y), int(m), int(d))


# ------------------------------------------------------------------ akcie: knižnica K. Frencha
def french_daily(path: Path):
    rows = []
    for line in path.read_text(encoding="latin-1").splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 5 and len(parts[0]) == 8 and parts[0].isdigit():
            mkt, rf = float(parts[1]), float(parts[4])
            if mkt <= -99 or rf <= -99:
                continue
            rows.append((d8(parts[0]), mkt / 100.0, rf / 100.0))
    return rows


def french_monthly(path: Path):
    out = {}
    for line in path.read_text(encoding="latin-1").splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 5 and len(parts[0]) == 6 and parts[0].isdigit():
            mkt, rf = float(parts[1]), float(parts[4])
            if mkt <= -99 or rf <= -99:
                continue
            out[(int(parts[0][:4]), int(parts[0][4:6]))] = (mkt / 100.0, rf / 100.0)
        elif line.strip().startswith("Annual"):
            break
    return out


def market_returns(daily, monthly, rf_monthly):
    """Denný celkový výnos trhu = nadvýnos + bezriziková sadzba.

    Denná bezriziková sadzba je v súbore zaokrúhlená na 0,01 %, čo by pri skladaní robilo chybu až 1 % ročne.
    Preto sa berie z mesačného súboru a rozkladá na obchodné dni mesiaca. Denné výnosy sa potom v každom mesiaci
    doladia tak, aby zložený mesačný výnos sedel s mesačným súborom.
    """
    by_month = OrderedDict()
    for dt, ex, _rf in daily:
        by_month.setdefault((dt.year, dt.month), []).append((dt, ex))
    out, rf_out, adj = [], [], []
    for key, days in by_month.items():
        n = len(days)
        rf_m = rf_monthly.get(key)
        if rf_m is None:  # posledný neúplný mesiac: použije sa sadzba predošlého mesiaca
            prev = max(k for k in rf_monthly if k < key)
            rf_m = rf_monthly[prev]
            full = False
        else:
            full = key in monthly
        rf_d = (1 + rf_m) ** (1 / n) - 1
        rets = [ex + rf_d for _dt, ex in days]
        if full:
            target = 1 + monthly[key][0] + rf_m
            prod = 1.0
            for r in rets:
                prod *= 1 + r
            k = (target / prod) ** (1 / n)
            adj.append(abs(k - 1))
            rets = [(1 + r) * k - 1 for r in rets]
        for (dt, _ex), r in zip(days, rets):
            out.append((dt, r))
            rf_out.append((dt, rf_d))
    return out, rf_out, adj


us_daily = french_daily(RAW / "ff_us" / "F-F_Research_Data_Factors_daily.csv")
us_monthly = french_monthly(RAW / "ff_us_m" / "F-F_Research_Data_Factors.csv")
dev_daily = french_daily(RAW / "ff_dev" / "Developed_3_Factors_Daily.csv")
dev_monthly = french_monthly(RAW / "ff_dev_m" / "Developed_3_Factors.csv")
rf_monthly = {k: v[1] for k, v in us_monthly.items()}
us_stock, us_cash, us_adj = market_returns(us_daily, us_monthly, rf_monthly)
dev_stock_usd, _dev_rf, dev_adj = market_returns(dev_daily, dev_monthly, {k: v[1] for k, v in dev_monthly.items()})
print("akcie USA:", us_stock[0][0], "→", us_stock[-1][0], len(us_stock), "dní; priemerné doladenie na mesačný výnos", f"{sum(us_adj) / len(us_adj) * 1e4:.3f} bp/deň, max {max(us_adj) * 1e4:.2f} bp")
print("akcie svet (USD):", dev_stock_usd[0][0], "→", dev_stock_usd[-1][0], len(dev_stock_usd), "dní; doladenie", f"{sum(dev_adj) / len(dev_adj) * 1e4:.3f} bp/deň, max {max(dev_adj) * 1e4:.2f} bp")


# ------------------------------------------------------------------ ECB
def ecb_series(path: Path):
    out = {}
    with path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            v = row["OBS_VALUE"].strip()
            if v:
                out[row["TIME_PERIOD"].strip()] = float(v)
    return out


fx = {iso(k): v for k, v in ecb_series(RAW / "ecb_eurusd.csv").items()}
eonia = {iso(k): v for k, v in ecb_series(RAW / "ecb_eonia.csv").items()}
estr = {iso(k): v for k, v in ecb_series(RAW / "ecb_estr.csv").items()}
hicp = ecb_series(RAW / "ecb_hicp_new.csv")  # HICP eurozóny, všetky položky, 2025 = 100
print("kurz USD/EUR:", min(fx), "→", max(fx), len(fx), "| EONIA:", min(eonia), "→", max(eonia), "| €STR:", min(estr), "→", max(estr), "| HICP:", min(hicp), "→", max(hicp))


# ------------------------------------------------------------------ Bundesbank: bezkupónové výnosy
def buba(path: Path):
    out = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        parts = line.split(",")
        if len(parts) >= 2 and len(parts[0]) == 10 and parts[0][4] == "-":
            v = parts[1].strip()
            if v and v != ".":
                try:
                    out[iso(parts[0])] = float(v)
                except ValueError:
                    pass
    return out


bund = {m: buba(RAW / f"buba_zero_{m:02d}y.csv") for m in range(1, 11)}
print("Bundesbank:", {m: (min(s), max(s), len(s)) for m, s in bund.items()}[10])


# ------------------------------------------------------------------ Fed H.15: výnosy s konštantnou splatnosťou
def h15(path: Path):
    out = {}
    with path.open(encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) >= 10 and len(row[0]) == 10 and row[0][4] == "-":
                def num(x):
                    try:
                        return float(x)
                    except ValueError:
                        return None
                # stĺpce: 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y
                out[iso(row[0])] = {"y5": num(row[7]), "y7": num(row[8]), "y10": num(row[9])}
    return out


tcm = h15(RAW / "fed_h15_tcm.csv")
tcm10 = {d: v for d, v in tcm.items() if v["y10"] is not None}
print("Fed H.15 10-ročný výnos:", min(tcm10), "→", max(tcm10), len(tcm10))


# ------------------------------------------------------------------ pomocné
def ffill(series: dict, days: list):
    """Hodnota platná v daný deň: posledná známa hodnota k tomuto dňu (vrátane)."""
    keys = sorted(series)
    out, i, last = {}, 0, None
    for d in days:
        while i < len(keys) and keys[i] <= d:
            last = series[keys[i]]
            i += 1
        out[d] = last
    return out


def yearly(rets):
    """Ročné výnosy zo zoznamu (deň, denný výnos)."""
    out = OrderedDict()
    for d, r in rets:
        out[d.year] = out.get(d.year, 1.0) * (1 + r)
    return {y: v - 1 for y, v in out.items()}


def annualised(rets):
    prod = 1.0
    for _d, r in rets:
        prod *= 1 + r
    years = (rets[-1][0] - rets[0][0]).days / 365.25
    return prod ** (1 / years) - 1, prod


# ================================================================== sada EUR (od 4. 1. 1999)
EUR_START = date(1999, 1, 4)
eur_days = [d for d, _r in dev_stock_usd if d >= EUR_START]
END = min(eur_days[-1], us_stock[-1][0])
eur_days = [d for d in eur_days if d <= END]
fx_f = ffill(fx, eur_days)
dev_map = dict(dev_stock_usd)

eur_stock = []
for i, d in enumerate(eur_days):
    if i == 0:
        eur_stock.append((d, 0.0))  # prvý deň je východisko
        continue
    prev = eur_days[i - 1]
    # kurz je v USD za 1 EUR: výnos v eurách = (1 + výnos v USD) × kurz včera / kurz dnes − 1
    eur_stock.append((d, (1 + dev_map[d]) * fx_f[prev] / fx_f[d] - 1))

# dlhopisy: nemecké štátne dlhopisy s ročným kupónom a splatnosťou 7, 8, 9 a 10 rokov, každý deň kúpené za nominál
# (kupón = výnos do splatnosti z bezkupónovej krivky) a na druhý deň ocenené novou krivkou. Priemer štyroch splatností.
bund_f = {m: ffill(bund[m], eur_days) for m in bund}


def zero_rate(curve: dict, t: float) -> float:
    """Bezkupónový výnos pre splatnosť t rokov: lineárne medzi celými rokmi, pod 1 rok a nad 10 rokov predĺženie sklonu."""
    if t <= 1:
        return curve[1] + (curve[2] - curve[1]) * (t - 1)
    if t >= 10:
        return curve[10] + (curve[10] - curve[9]) * (t - 10)
    lo = int(math.floor(t))
    return curve[lo] + (curve[lo + 1] - curve[lo]) * (t - lo)


def disc(curve: dict, t: float) -> float:
    return (1 + zero_rate(curve, t)) ** (-t)


eur_bond = []
for i, d in enumerate(eur_days):
    if i == 0:
        eur_bond.append((d, 0.0))
        continue
    prev = eur_days[i - 1]
    dt = (d - prev).days / 365.25
    c0 = {m: bund_f[m][prev] / 100.0 for m in bund_f}
    c1 = {m: bund_f[m][d] / 100.0 for m in bund_f}
    total = 0.0
    for m in (7, 8, 9, 10):
        annuity = sum(disc(c0, k) for k in range(1, m + 1))
        coupon = (1 - disc(c0, m)) / annuity  # kupón, pri ktorom je cena presne 1
        price = sum(coupon * disc(c1, k - dt) for k in range(1, m + 1)) + disc(c1, m - dt)
        total += price - 1
    eur_bond.append((d, total / 4))

# peňažný fond: EONIA do 30. 9. 2019, potom €STR; úročenie act/360
cash_rate = {}
for d, v in eonia.items():
    if d <= date(2019, 9, 30):
        cash_rate[d] = v
for d, v in estr.items():
    cash_rate[d] = v
cash_f = ffill(cash_rate, eur_days)
eur_cash, eur_cash_rate = [], []
for i, d in enumerate(eur_days):
    if i == 0:
        eur_cash.append((d, 0.0))
        eur_cash_rate.append((d, cash_f[d]))
        continue
    prev = eur_days[i - 1]
    eur_cash.append((d, cash_f[prev] / 100.0 * (d - prev).days / 360.0))
    eur_cash_rate.append((d, cash_f[d]))

# ================================================================== sada USD (od 2. 1. 1962)
USD_START = date(1962, 1, 2)
usd_days = [d for d, _r in us_stock if USD_START <= d <= END]
us_map = dict(us_stock)
us_cash_map = dict(us_cash)
usd_stock = [(d, 0.0 if i == 0 else us_map[d]) for i, d in enumerate(usd_days)]
usd_cash = [(d, 0.0 if i == 0 else us_cash_map[d]) for i, d in enumerate(usd_days)]

y10_f = ffill({d: v["y10"] for d, v in tcm10.items()}, usd_days)
y7_f = ffill({d: v["y7"] for d, v in tcm.items() if v["y7"] is not None}, usd_days)
y5_f = ffill({d: v["y5"] for d, v in tcm.items() if v["y5"] is not None}, usd_days)


def par_price(coupon: float, y: float, m: float) -> float:
    """Cena dlhopisu s polročným kupónom (bez naakumulovaného úroku) pri výnose y a zostatkovej splatnosti m rokov."""
    if abs(y) < 1e-9:
        return 1 + coupon * m
    disc = (1 + y / 2) ** (-2 * m)
    return coupon / y * (1 - disc) + disc


usd_bond = []
for i, d in enumerate(usd_days):
    if i == 0:
        usd_bond.append((d, 0.0))
        continue
    prev = usd_days[i - 1]
    dt = (d - prev).days / 365.25
    c = y10_f[prev] / 100.0  # včera kúpený 10-ročný dlhopis za nominál, kupón = včerajší výnos
    y1 = y10_f[d] / 100.0
    if y7_f[d] is not None:
        slope = (y1 - y7_f[d] / 100.0) / 3.0
    elif y5_f[d] is not None:
        slope = (y1 - y5_f[d] / 100.0) / 5.0
    else:
        slope = 0.0
    y1_roll = y1 - slope * dt
    usd_bond.append((d, par_price(c, y1_roll, 10 - dt) + c * dt - 1))

# ================================================================== kontrola a výstup
KNOWN = {
    "usd_stock": {1987: 0.0166, 2008: -0.3670, 2013: 0.3530, 2022: -0.1950, 1974: -0.2780},  # CRSP celý trh, približne
    "usd_bond": {1982: 0.3281, 1994: -0.0804, 2008: 0.2010, 2009: -0.1112, 2013: -0.0910, 2022: -0.1783},  # Damodaran, 10-ročný štátny dlhopis
    "eur_stock": {2008: -0.3770, 2013: 0.2120, 2019: 0.3000, 2022: -0.1280},  # MSCI World v eurách, čistý výnos, približne
    "eur_bond": {2008: 0.1230, 2011: 0.1390, 2014: 0.1390, 2021: -0.0270, 2022: -0.1780},  # nemecké štátne 7–10 r., približne (z pamäti, len orientačne)
}
sets = {
    "eur_stock": eur_stock, "eur_bond": eur_bond, "eur_cash": eur_cash,
    "usd_stock": usd_stock, "usd_bond": usd_bond, "usd_cash": usd_cash,
}
print()
for name, rets in sets.items():
    ann, prod = annualised(rets)
    yr = yearly(rets)
    worst = min(yr, key=yr.get)
    best = max(yr, key=yr.get)
    line = f"{name:10s} {rets[0][0]} → {rets[-1][0]}  {len(rets):6d} dní  ročne {ann * 100:6.2f} %  násobok {prod:9.2f}  najhorší rok {worst} {yr[worst] * 100:6.1f} %  najlepší {best} {yr[best] * 100:6.1f} %"
    print(line)
    if name in KNOWN:
        print("           porovnanie so známymi ročnými výnosmi:", "  ".join(f"{y}: {yr[y] * 100:.1f} % (známe {k * 100:.1f} %)" for y, k in sorted(KNOWN[name].items())))

out = {
    "end": END.isoformat(),
    "eur": {"days": [d.isoformat() for d in eur_days], "stock": [r for _d, r in eur_stock], "bond": [r for _d, r in eur_bond], "cash": [r for _d, r in eur_cash]},
    "usd": {"days": [d.isoformat() for d in usd_days], "stock": [r for _d, r in usd_stock], "bond": [r for _d, r in usd_bond], "cash": [r for _d, r in usd_cash]},
    "hicp": {k: v for k, v in sorted(hicp.items())},
    "yearly": {name: {str(y): round(v, 6) for y, v in yearly(rets).items()} for name, rets in sets.items()},
}
(OUT / "series.json").write_text(json.dumps(out), encoding="utf-8")
print("\nuložené", OUT / "series.json", round((OUT / "series.json").stat().st_size / 1e6, 2), "MB")
