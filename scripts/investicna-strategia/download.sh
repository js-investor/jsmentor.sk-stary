#!/usr/bin/env bash
# Stiahne zdrojové dáta pre nástroj Investičná stratégia do priečinka raw/ (okolo 8,5 MB).
# Použitie: scripts/investicna-strategia/download.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$HERE/raw/bls" && cd "$HERE/raw"
export LC_ALL=C
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
get() { curl -sS -L --max-time 180 -A "$UA" -o "$1" -w "%{http_code} %{size_download} B  $1\n" "$2"; }

# akcie: knižnica Kennetha R. Frencha (Dartmouth College)
FRENCH="https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp"
get ff_us_daily.zip "$FRENCH/F-F_Research_Data_Factors_daily_CSV.zip"
get ff_us_monthly.zip "$FRENCH/F-F_Research_Data_Factors_CSV.zip"
get ff_developed_daily.zip "$FRENCH/Developed_3_Factors_Daily_CSV.zip"
get ff_developed_monthly.zip "$FRENCH/Developed_3_Factors_CSV.zip"
unzip -o -q ff_us_daily.zip -d ff_us
unzip -o -q ff_us_monthly.zip -d ff_us_m
unzip -o -q ff_developed_daily.zip -d ff_dev
unzip -o -q ff_developed_monthly.zip -d ff_dev_m

# Európska centrálna banka: kurz USD/EUR, EONIA, €STR, HICP eurozóny (2025 = 100)
ECB="https://data-api.ecb.europa.eu/service/data"
get ecb_eurusd.csv "$ECB/EXR/D.USD.EUR.SP00.A?format=csvdata"
get ecb_eonia.csv "$ECB/EON/D.EONIA_TO.RATE?format=csvdata"
get ecb_estr.csv "$ECB/EST/B.EU000A2X2A25.WT?format=csvdata"
get ecb_hicp_new.csv "$ECB/HICP/M.U2.N.000000.4D0.INX?format=csvdata"

# Deutsche Bundesbank: bezkupónová výnosová krivka nemeckých štátnych dlhopisov (Svensson), splatnosť 1 až 10 rokov
for m in 01 02 03 04 05 06 07 08 09 10; do
  get "buba_zero_${m}y.csv" "https://api.statistiken.bundesbank.de/rest/download/BBSIS/D.I.ZST.ZI.EUR.S1311.B.A604.R${m}XX.R.A.A._Z._Z.A?format=csv&lang=en"
done

# Federálny rezervný systém, tabuľka H.15: výnosy štátnych dlhopisov USA s konštantnou splatnosťou
get fed_h15_tcm.csv "https://www.federalreserve.gov/datadownload/Output.aspx?rel=H15&series=bf17364827e38702b42a58cf8eaa3f78&lastobs=&from=&to=&filetype=csv&label=include&layout=seriescolumn&type=package"

# U.S. Bureau of Labor Statistics: CPI-U, všetky položky, sezónne neočistený (najviac 10 rokov na jednu požiadavku)
THIS_YEAR="$(date +%Y)"
for y in 1961 1971 1981 1991 2001 2011 2021 2031; do
  [ "$y" -gt "$THIS_YEAR" ] && break
  e=$((y + 9))
  curl -sS -L --max-time 60 -A "$UA" -H "Content-Type: application/json" -X POST \
    -d "{\"seriesid\":[\"CUUR0000SA0\"],\"startyear\":\"$y\",\"endyear\":\"$e\"}" \
    -o "bls/cpi_$y.json" -w "%{http_code} %{size_download} B  bls/cpi_$y.json\n" "https://api.bls.gov/publicAPI/v1/timeseries/data/"
  sleep 1
done
python3 - <<'PY'
import glob
import json

cpi = {}
for f in sorted(glob.glob("bls/cpi_*.json")):
    d = json.load(open(f))
    if d.get("status") != "REQUEST_SUCCEEDED":
        print(f, d.get("status"), d.get("message"))
        continue
    for s in d["Results"]["series"]:
        for o in s["data"]:
            if o["period"].startswith("M") and o["period"] != "M13" and o["value"] not in ("-", ""):
                cpi[f'{o["year"]}-{o["period"][1:]}'] = float(o["value"])
keys = sorted(cpi)
print("CPI USA:", len(keys), "mesiacov,", keys[0], "→", keys[-1])
json.dump(cpi, open("bls_cpi.json", "w"))
PY
ls -la
