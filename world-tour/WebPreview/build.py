"""Builds the single-file browser preview from template.html and the Unity data files.

Usage: python3 -I build.py OUT.html [--standalone]

--standalone adds a viewport meta for opening the file directly (the artifact host adds its own).
"""
import json
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
data_dir = here.parent / "Assets" / "WorldTour" / "Resources" / "WorldTourData"
data = {name: json.loads((data_dir / f"{name}.json").read_text(encoding="utf-8"))
        for name in ("countries", "airports", "destinations", "economy")}
template = (here / "template.html").read_text(encoding="utf-8")
marker = "/*__DATA__*/null"
assert template.count(marker) == 1
blob = json.dumps(data, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
html = template.replace(marker, blob)
if "--standalone" in sys.argv:
    html = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + html
pathlib.Path(sys.argv[1]).write_text(html, encoding="utf-8")
print("wrote", sys.argv[1])
