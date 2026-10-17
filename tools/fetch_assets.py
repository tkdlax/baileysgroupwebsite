"""Step 1.3: copy the live site's CODE assets (Webflow CSS/JS, jQuery) into public/.

baileysgroup.com is a Webflow site: its CSS and JS live on Webflow's CDN (cdn.prod.website-files.com)
and jQuery on Webflow's CloudFront. Those are site code, so they are copied into the repo:
  https://cdn.prod.website-files.com/<site>/css/x.css  → public/_webflow/<site>/css/x.css
  https://d3e54v103j8qbb.cloudfront.net/js/jquery…js    → public/_webflow/js/jquery…js
Originals: baseline/assets/. Map of live URL → local path: baseline/data/asset-map.json
(tools/extract.py rewrites references with it). Media referenced inside CSS stays hotlinked and is
listed in baseline/data/css-media.csv (merged into media-manifest.csv by tools/inventory.py).

Re-run: python3 tools/fetch_assets.py
"""
import csv, json, os, re, sys
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
from readhtml import read

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "baseline", "raw", "html")
ORIG = os.path.join(ROOT, "baseline", "assets")
PUB = os.path.join(ROOT, "public")
DATA = os.path.join(ROOT, "baseline", "data")
CODE_HOSTS = {"cdn.prod.website-files.com": "/_webflow", "d3e54v103j8qbb.cloudfront.net": "/_webflow"}
S = requests.Session(); S.headers["User-Agent"] = "Mozilla/5.0 (BaileysGroupMigrationBaseline/1.0)"

def local_path(u):
    p = urlparse(u)
    pre = CODE_HOSTS.get(p.netloc.lower())
    return (pre + p.path) if pre else None

def main():
    wanted = []
    for f in sorted(os.listdir(RAW)):
        s = BeautifulSoup(read(os.path.join(RAW, f)), "html5lib")
        for l in s.find_all("link", href=True):
            if "stylesheet" in [x.lower() for x in (l.get("rel") or [])] and local_path(l["href"]): wanted.append(l["href"])
        for t in s.find_all("script", src=True):
            if local_path(t["src"]): wanted.append(t["src"])
    amap, css_media, done = {}, [], set()
    for u in wanted:
        if u in done: continue
        done.add(u)
        r = S.get(u, timeout=30)
        if r.status_code != 200: print("MISSING", r.status_code, u); continue
        lp = local_path(u)
        o = os.path.join(ORIG, urlparse(u).netloc, urlparse(u).path.lstrip("/")); os.makedirs(os.path.dirname(o), exist_ok=True)
        open(o, "wb").write(r.content)
        out = r.content
        if lp.endswith(".css"):
            txt = r.content.decode("utf-8", errors="replace")
            def rep(m):
                q, ref = m.group(1), m.group(2).strip()
                if ref.startswith(("data:", "#")) or not ref: return m.group(0)
                full = urljoin(u, ref)
                css_media.append({"media_url": full, "css_file": lp, "original_ref": ref})
                return f"url({q}{full}{q})"  # make absolute: the CSS no longer sits next to its images
            txt = re.sub(r"url\(\s*(['\"]?)([^'\")]*)\1\s*\)", rep, txt)
            out = txt.encode("utf-8")
        d = os.path.join(PUB, lp.lstrip("/")); os.makedirs(os.path.dirname(d), exist_ok=True)
        open(d, "wb").write(out)
        amap[u] = lp
        print("ok", lp, len(r.content))
    json.dump(amap, open(os.path.join(DATA, "asset-map.json"), "w"), indent=1)
    with open(os.path.join(DATA, "css-media.csv"), "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["media_url", "css_file", "original_ref"]); w.writeheader(); w.writerows(css_media)
    print(len(amap), "assets;", len(css_media), "css media refs")

if __name__ == "__main__":
    main()
