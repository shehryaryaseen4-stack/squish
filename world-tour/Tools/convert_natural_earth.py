"""Convert a Natural Earth admin-0 countries GeoJSON into the compact
countries.json the game loads.

Usage: python3 -I convert_natural_earth.py ne_110m_admin_0_countries.geojson out.json

Source data: Natural Earth (public domain), https://www.naturalearthdata.com
"""
import json
import sys


def ring_out(ring):
    out = []
    for lon, lat in ring:
        out.extend([round(lon, 2), round(lat, 2)])
    # drop consecutive duplicate points created by rounding
    dedup = out[:2]
    for i in range(2, len(out), 2):
        if out[i:i + 2] != dedup[-2:]:
            dedup.extend(out[i:i + 2])
    return dedup


def main(src, dst):
    with open(src, encoding="utf-8") as f:
        data = json.load(f)
    countries = []
    for feat in data["features"]:
        p = feat["properties"]
        geom = feat["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        rings = [ring_out(r) for poly in polys for r in poly]
        rings = [r for r in rings if len(r) >= 6]
        iso = p.get("ADM0_A3") or p.get("ISO_A3")
        countries.append({
            "id": iso,
            "name": p.get("NAME") or p.get("ADMIN"),
            "continent": p.get("CONTINENT"),
            "labelLon": round(p.get("LABEL_X", 0), 2),
            "labelLat": round(p.get("LABEL_Y", 0), 2),
            "rings": rings,
        })
    countries.sort(key=lambda c: c["name"])
    out = {
        "source": "Natural Earth 1:110m Admin 0 - Countries (public domain), naturalearthdata.com",
        "countries": countries,
    }
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{len(countries)} countries -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
