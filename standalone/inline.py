"""Vloží app.js a app.css do HTML → jeden prenosný súbor. Použitie: python3 standalone/inline.py <calc> <out.html>"""
import io, re, sys, os
calc, out = sys.argv[1], sys.argv[2]
d = os.path.join(os.path.dirname(__file__), "..", ".standalone-dist", calc)
html = io.open(os.path.join(d, f"{calc}.html"), encoding="utf-8").read()
js = io.open(os.path.join(d, "app.js"), encoding="utf-8").read().replace("</script", "<\\/script")
css = io.open(os.path.join(d, "app.css"), encoding="utf-8").read()
html, n1 = re.subn(r'<script type="module"[^>]*src="[^"]*app\.js"[^>]*></script>', lambda m: "<script type=\"module\">" + js + "</script>", html)
html, n2 = re.subn(r'<link[^>]*rel="stylesheet"[^>]*href="[^"]*app\.css"[^>]*>', lambda m: "<style>" + css + "</style>", html)
assert n1 == 1 and n2 == 1, (n1, n2)
io.open(out, "w", encoding="utf-8").write(html)
print(out, len(html) // 1024, "KB")
