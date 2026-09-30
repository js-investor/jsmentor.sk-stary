# Investičná stratégia: dáta

Nástroj `/bonusy/investicna-strategia` počíta nad skutočnými dennými dátami. Tento priečinok obsahuje všetko, čím sa dáta
sťahujú, spracujú a zabalia do modulu, ktorý nástroj načíta.

## Obnovenie dát

```bash
scripts/investicna-strategia/download.sh              # stiahne zdroje do raw/ (okolo 9 MB)
python3 scripts/investicna-strategia/process.py       # raw/ → out/series.json + kontrola proti známym ročným výnosom
python3 scripts/investicna-strategia/build_module.py  # out/series.json → dátový modul a kontrolné prípady pre testy
npx vitest run src/components/calculators/investicna-strategia
```

`build_module.py` zapíše do `src/components/calculators/investicna-strategia/` dva generované súbory:

- `investicnaStrategiaData.ts`: denné výnosy oboch súborov (okolo 225 kB, po kompresii 110 kB), nástroj ho načíta až pri otvorení,
- `investicnaStrategia.cases.ts`: kontrolné prípady, ktoré spočítala nezávislá implementácia modelu v Pythone.

Priečinky `raw/` a `out/` sa do repozitára neukladajú.

## Zdroje

| Zložka | Súbor „Svet v eurách“ (od 4. 1. 1999) | Súbor „USA v dolároch“ (od 2. 1. 1962) |
| --- | --- | --- |
| Akcie | rozvinuté trhy sveta, Kenneth R. French Data Library, prepočet na eurá kurzom ECB | celý americký trh (CRSP), Kenneth R. French Data Library |
| Dlhopisy | nemecké štátne dlhopisy 7 až 10 rokov, výnosová krivka Deutsche Bundesbank | štátny dlhopis USA 10 rokov, Federal Reserve H.15 |
| Peňažný fond | EONIA do 30. 9. 2019, potom €STR (ECB) | pokladničné poukážky 1 mesiac (K. R. French) |
| Inflácia | HICP eurozóny (Eurostat cez ECB) | CPI-U (U.S. Bureau of Labor Statistics) |

Indexy MSCI a S&P sa nepoužívajú, ich dáta sa nesmú voľne zverejňovať.

## Ako vznikajú denné výnosy

- **Akcie:** denný nadvýnos trhu plus bezriziková sadzba. Denná sadzba je v zdroji zaokrúhlená, preto sa berie z mesačného
  súboru a rozkladá na obchodné dni. Denné výnosy sa v každom mesiaci doladia tak, aby zložený mesačný výnos sedel
  s mesačným súborom (v priemere o 0,06 bázického bodu na deň).
- **Nemecké dlhopisy:** každý deň sa za nominál kúpia kupónové dlhopisy so splatnosťou 7, 8, 9 a 10 rokov a na druhý deň sa
  ocenia novou krivkou. Výnos je priemer štyroch splatností.
- **Americké dlhopisy:** každý deň sa za nominál kúpi 10-ročný dlhopis s polročným kupónom a na druhý deň sa ocení novým
  výnosom vrátane posunu po krivke.
- **Peňažný fond:** denné úročenie jednodňovou sadzbou (act/360), v USA mesačný výnos poukážok rozložený na obchodné dni.
- **Inflácia:** mesačný index patrí 15. dňu mesiaca, medzi mesiacmi sa počíta lineárne. Október 2025 v americkom indexe
  chýba (úrady ho nezverejnili), dopočítaný je ako geometrický stred susedných mesiacov.

Dáta opisujú celé trhy, nie konkrétny fond. Akciové rady obsahujú aj menšie firmy a sú pred zdanením dividend,
dlhopisové rady sú dopočítané z úradných výnosov. Od konkrétneho fondu sa v jednotlivom roku môžu líšiť o niekoľko
percentuálnych bodov. Pri orientačnom porovnaní s ročnými výnosmi indexu veľkých a stredných firiem rozvinutých trhov
(čistý výnos v eurách, roky 2011 až 2024, hodnoty z verejných prehľadov, nie sú súčasťou dát) bol rozdiel v jednom roku
najviac 2,3 bodu a v priemere 0,25 bodu ročne.

## Kontrola v prehliadači

`ui-check.mjs` prekliká celý nástroj (vyše 200 kontrol: výpočet proti nezávislému výpočtu, graf, záložky, editor stratégie,
oba súbory dát, export, odkaz na scenár, šírky od 320 do 1920 px). Beží len proti lokálnemu serveru:

```bash
mkdir -p /tmp/pptr && cd /tmp/pptr && npm i puppeteer-core
cd /tmp/pptr && node "<cesta k repozitáru>/scripts/investicna-strategia/ui-check.mjs" http://localhost:8080
```

Čísla a texty napísané priamo v kontrolách patria k dátam končiacim 31. 8. 2026, po obnovení dát ich treba upraviť.
