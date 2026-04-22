"""
Extract MTB-relevant POIs around the Falcon's Paths race corridor from
OpenStreetMap via the Overpass API, filter to within a buffer of the
routes, and save as a compact GeoJSON-ish file (_pois.json) that
map.html loads at startup.

Categories chosen for MTB riders and spectators:
    water      — drinking water, springs
    food       — restaurants, cafes, bars, fast food, pubs
    fuel       — gas stations (for support vehicles)
    bike       — bicycle shops (emergency repair / spares)
    lodging    — hotels, guest houses, hostels, chalets, alpine huts,
                 campsites, wilderness huts
    medical    — pharmacies, clinics, hospitals, first-aid
    shelter    — alpine huts, shelters, picnic sites
    toilet     — public toilets
    viewpoint  — viewpoints, tourist information, attractions
    nature     — peaks, waterfalls, cave entrances
    culture    — historic monuments, churches, ruins

The extract is static — it reflects the OSM snapshot at fetch time.
Re-run the script to refresh.

Usage:
    pip install requests
    python _fetch_pois.py
"""
import json, math, time, sys, os
try:
    import requests
except ImportError:
    print("pip install requests"); sys.exit(1)

# ── Buffer around route in degrees (roughly 5 km at this latitude) ─
BUFFER_DEG   = 0.05
# ── Max distance from route in metres ─────────────────────────────
CORRIDOR_M   = 5000
# ── Proper User-Agent (Overpass rejects requests/py default with 406) ─
UA = "Bozmaps/1.0 (semir@bozmaps.com)"

# ── OSM tag → our category. First-match wins. ────────────────────
def classify(tags):
    am = tags.get("amenity")
    sh = tags.get("shop")
    tr = tags.get("tourism")
    nt = tags.get("natural")
    hi = tags.get("historic")
    wh = tags.get("wheelchair")  # unused, retained for future

    if am in ("drinking_water",) or nt == "spring":
        return "water"
    if am in ("restaurant", "cafe", "fast_food", "bar", "pub", "biergarten"):
        return "food"
    if am == "fuel":
        return "fuel"
    if sh == "bicycle":
        return "bike"
    if tr in ("hotel", "guest_house", "hostel", "chalet", "motel",
              "apartment", "camp_site", "caravan_site"):
        return "lodging"
    if tr in ("alpine_hut", "wilderness_hut"):
        return "shelter"
    if am in ("pharmacy", "clinic", "hospital", "doctors", "first_aid"):
        return "medical"
    if am in ("shelter", "picnic_site", "bbq"):
        return "shelter"
    if am == "toilets":
        return "toilet"
    if tr in ("viewpoint", "attraction", "information", "museum"):
        return "viewpoint"
    if nt in ("peak", "waterfall", "cave_entrance"):
        return "nature"
    if hi in ("castle", "ruins", "monument", "memorial", "fort",
              "church", "archaeological_site", "tomb"):
        return "culture"
    if am in ("place_of_worship",):
        return "culture"
    return None

# ── Geometry helpers ─────────────────────────────────────────────
def hav(a, b):
    R = 6371000.0
    lon1, lat1 = math.radians(a[0]), math.radians(a[1])
    lon2, lat2 = math.radians(b[0]), math.radians(b[1])
    dlon, dlat = lon2 - lon1, lat2 - lat1
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(h))

def point_to_segment_m(p, a, b):
    lr = (a[1]+b[1])/2 * math.pi/180
    mx = 111320 * math.cos(lr)
    my = 110540
    ax, ay = a[0]*mx, a[1]*my
    bx, by = b[0]*mx, b[1]*my
    px, py = p[0]*mx, p[1]*my
    dx, dy = bx-ax, by-ay
    L = dx*dx + dy*dy
    t = max(0.0, min(1.0, ((px-ax)*dx + (py-ay)*dy) / L)) if L else 0
    qx, qy = ax + t*dx, ay + t*dy
    return math.hypot(px-qx, py-qy)

def min_dist_to_route(pt, coords):
    best = float("inf")
    for i in range(1, len(coords)):
        d = point_to_segment_m(pt, coords[i-1], coords[i])
        if d < best: best = d
    return best

def bbox_of(coords, pad):
    x0, y0 = float("inf"), float("inf")
    x1, y1 = -float("inf"), -float("inf")
    for c in coords:
        if c[0] < x0: x0 = c[0]
        if c[0] > x1: x1 = c[0]
        if c[1] < y0: y0 = c[1]
        if c[1] > y1: y1 = c[1]
    return [x0-pad, y0-pad, x1+pad, y1+pad]

# ── Overpass query ───────────────────────────────────────────────
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# Split the query into small, independent groups. If one group fails we
# still keep the rest — public Overpass mirrors are flaky and this gives
# us partial-success behaviour.
QUERY_GROUPS = {
    "hospitality": '''
node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|biergarten|fuel)$"];
node["shop"="bicycle"];
''',
    "water": '''
node["amenity"="drinking_water"];
node["natural"="spring"];
''',
    "lodging": '''
node["tourism"~"^(hotel|guest_house|hostel|chalet|motel|apartment|camp_site|caravan_site|alpine_hut|wilderness_hut)$"];
''',
    "medical": '''
node["amenity"~"^(pharmacy|clinic|hospital|doctors|first_aid)$"];
''',
    "utilities": '''
node["amenity"~"^(shelter|picnic_site|toilets)$"];
''',
    "tourism": '''
node["tourism"~"^(viewpoint|attraction|information|museum)$"];
node["natural"~"^(peak|waterfall|cave_entrance)$"];
''',
    "culture": '''
node["historic"];
node["amenity"="place_of_worship"];
''',
}

def run_overpass_group(name, group_q, bbox_str):
    header = f"[out:json][timeout:20][bbox:{bbox_str}];"
    q = header + "(" + group_q.strip() + ");out tags center;"
    last_err = None
    for attempt in range(2):
        for url in OVERPASS_ENDPOINTS:
            try:
                print(f"    [{name}/{attempt+1}] {url.split('/')[2]} ...", end=" ", flush=True)
                r = requests.post(url, data={"data": q}, timeout=35,
                                  headers={"User-Agent": UA, "Accept": "application/json"})
                if r.status_code != 200:
                    last_err = f"HTTP {r.status_code}"
                    print(f"{last_err}")
                    continue
                d = r.json()
                n = len(d.get("elements", []))
                print(f"ok · {n}")
                return d
            except Exception as e:
                last_err = type(e).__name__
                print(f"{last_err}")
                continue
        time.sleep(1)  # brief cooldown between retries
    print(f"    [{name}] all endpoints failed: {last_err}")
    return None

def run_overpass(bbox_str):
    """Returns merged elements from all successful groups (partial OK)."""
    merged = {"elements": []}
    seen_ids = set()
    any_ok = False
    for name, q in QUERY_GROUPS.items():
        print(f"  group: {name}")
        d = run_overpass_group(name, q, bbox_str)
        if d is None: continue
        any_ok = True
        for el in d.get("elements", []):
            key = (el.get("type"), el.get("id"))
            if key in seen_ids: continue
            seen_ids.add(key)
            merged["elements"].append(el)
    if not any_ok:
        raise RuntimeError("All Overpass groups failed — check network / endpoints.")
    return merged

# ── Main ─────────────────────────────────────────────────────────
def main():
    with open("_routes.json", "r", encoding="utf-8") as f:
        routes = json.load(f)

    # Union bbox across both routes
    all_coords = []
    for r in routes.values():
        all_coords.extend(r["coords"])
    bb = bbox_of(all_coords, BUFFER_DEG)
    # Overpass wants S,W,N,E order
    bbox_str = f"{bb[1]},{bb[0]},{bb[3]},{bb[2]}"
    print(f"Union bbox: {bbox_str}")

    print("Fetching POIs from Overpass ...")
    data = run_overpass(bbox_str)
    elements = data.get("elements", [])
    print(f"  got {len(elements)} raw elements")

    seen = set()
    out = []
    for el in elements:
        if el.get("type") != "node": continue
        lon = el.get("lon"); lat = el.get("lat")
        if lon is None or lat is None: continue
        tags = el.get("tags", {}) or {}
        cat = classify(tags)
        if not cat: continue

        # Filter to corridor around either route (use nearest)
        pt = (lon, lat)
        near_km = min(
            min_dist_to_route(pt, routes["velika"]["coords"]),
            min_dist_to_route(pt, routes["mala"]["coords"]),
        )
        if near_km > CORRIDOR_M: continue

        key = f"{round(lon,5)},{round(lat,5)},{cat}"
        if key in seen: continue
        seen.add(key)

        name = tags.get("name") or tags.get("ref") or ""
        # Short OSM type fragment for description
        type_bits = []
        for k in ("amenity","shop","tourism","natural","historic"):
            if k in tags: type_bits.append(f"{k}={tags[k]}")
        osm_type = "; ".join(type_bits[:2])

        out.append({
            "id": el["id"],
            "lon": round(lon, 5),
            "lat": round(lat, 5),
            "cat": cat,
            "name": name,
            "osm_type": osm_type,
            "dist_m": round(near_km),
            # Useful extras if present
            "phone": tags.get("phone") or tags.get("contact:phone") or "",
            "website": tags.get("website") or tags.get("contact:website") or "",
            "opening_hours": tags.get("opening_hours") or "",
            "wheelchair": tags.get("wheelchair") or "",
            "description": tags.get("description") or "",
        })

    # Sort by distance from route, then by name
    out.sort(key=lambda x: (x["dist_m"], x["name"] or "~"))

    # Stats
    cat_counts = {}
    for p in out:
        cat_counts[p["cat"]] = cat_counts.get(p["cat"], 0) + 1
    print("\nPOIs kept (within {} m of either route):".format(CORRIDOR_M))
    for c in sorted(cat_counts, key=lambda k: -cat_counts[k]):
        print(f"  {c:10} {cat_counts[c]}")
    print(f"\n  total: {len(out)}")

    with open("_pois.json", "w", encoding="utf-8") as f:
        json.dump({
            "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "corridor_m": CORRIDOR_M,
            "bbox": bb,
            "counts": cat_counts,
            "pois": out,
        }, f, separators=(",", ":"))
    print(f"\nWrote _pois.json ({os.path.getsize('_pois.json')/1024:.0f} KB)")

if __name__ == "__main__":
    main()
