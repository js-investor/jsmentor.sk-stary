#!/usr/bin/env bash
# Vygeneruje vstupné súbory pre všetky nástroje (standalone/tools.txt), zostaví ich a vloží do jedného HTML každý.
# Použitie: standalone/build-all.sh <výstupný priečinok>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/../.standalone-dist/html}"
mkdir -p "$OUT"
while IFS='|' read -r slug title mod comp; do
  [ -z "$slug" ] && continue
  cat > "$HERE/$slug.html" <<HTML
<!doctype html>
<html lang="sk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>$title | JS Mentor</title>
    <meta name="robots" content="noindex" />
  </head>
  <body>
    <main class="standalone-wrap">
      <div id="root"></div>
    </main>
    <script type="module" src="./$slug.tsx"></script>
  </body>
</html>
HTML
  cat > "$HERE/$slug.tsx" <<TSX
import { createRoot } from "react-dom/client";
import "./standalone.css";
import $comp from "$mod";

createRoot(document.getElementById("root")!).render(<$comp />);
TSX
  echo "=== $slug"
  CALC="$slug" npx vite build --config "$HERE/vite.config.ts" 2>&1 | grep -E "built in|error|Error" || true
  python3 "$HERE/inline.py" "$slug" "$OUT/$slug.html"
done < "$HERE/tools.txt"
