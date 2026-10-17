"""Step 2: media manifest + third-party inventory from the captured live HTML.

  media-manifest.csv               one row per media URL (images, video, fonts, icons): pages, contexts,
                                   rehost_path (decoded path to keep when re-hosting)
  baseline/data/third-party.csv    every external script / stylesheet / iframe / form / outbound link host

Media URLs are found anywhere in the HTML (Webflow puts them in src, srcset, style, data-poster-url,
data-video-urls…), plus media referenced by the site CSS (baseline/data/css-media.csv).

Re-run: python3 tools/inventory.py
"""
import csv, os, re, sys, collections
from urllib.parse import urlparse, unquote
from bs4 import BeautifulSoup
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
from readhtml import read

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "baseline", "raw", "html")
DATA = os.path.join(ROOT, "baseline", "data")
EXT = r"(?:jpe?g|png|gif|svg|webp|avif|ico|mp4|webm|mov|pdf|woff2?|ttf|otf|eot)"
URL = re.compile(r"https?://[^\s\"'<>(),]+?\." + EXT + r"(?=[\s\"'<>(),?#]|$)", re.I)
CTX = re.compile(r"([\w:-]+)=[\"'][^\"']*$")

def mtype(p):
    e = p.rsplit(".", 1)[-1].lower()
    return {"ico": "icon", "mp4": "video", "webm": "video", "mov": "video", "pdf": "document",
            "woff": "font", "woff2": "font", "ttf": "font", "otf": "font", "eot": "font"}.get(e, "image")

def main():
    pages = {r["file"]: r["url"] for r in csv.DictReader(open(os.path.join(DATA, "url-inventory.csv"), encoding="utf-8")) if r["status"] == "200" and r["file"]}
    agg = collections.defaultdict(lambda: {"pages": set(), "ctx": set()})
    tp = collections.defaultdict(set)
    for f, url in pages.items():
        html = read(os.path.join(RAW, f))
        for m in URL.finditer(html):
            c = CTX.search(html[max(0, m.start() - 300):m.start()])
            agg[m.group(0)]["pages"].add(url); agg[m.group(0)]["ctx"].add(c.group(1) if c else "css/inline")
        s = BeautifulSoup(html, "html5lib")
        for t in s.find_all("script", src=True): tp[("script", re.sub(r"\?.*", "", t["src"]))].add(url)
        for t in s.find_all("link", href=True):
            rel = " ".join(t.get("rel") or [])
            if "stylesheet" in rel or "preconnect" in rel: tp[(rel, t["href"])].add(url)
        for t in s.find_all("iframe", src=True): tp[("iframe", t["src"])].add(url)
        for t in s.find_all("form"): tp[("form", t.get("id") or t.get("name") or "")].add(url)
        for t in s.find_all(class_="g-recaptcha"): tp[("recaptcha", t.get("data-sitekey", ""))].add(url)
        for t in s.find_all("script"):
            code = t.decode_contents()
            if "WebFont.load" in code: tp[("inline", "Google WebFont loader: " + ", ".join(re.findall(r'"([^"]+?)(?::[^"]*)?"', code)[:6]))].add(url)
        for a in s.find_all("a", href=True):
            h = urlparse(a["href"]).netloc
            if h and "baileysgroup.com" not in h: tp[("outbound link", h)].add(url)
    for r in csv.DictReader(open(os.path.join(DATA, "css-media.csv"))):
        agg[r["media_url"]]["pages"].add("(css) " + r["css_file"]); agg[r["media_url"]]["ctx"].add("css url()")
    rows = []
    for m, d in sorted(agg.items(), key=lambda x: x[0].lower()):
        p = urlparse(m)
        rows.append({"media_url": m, "type": mtype(p.path), "host": p.netloc,
                     "page_count": len([x for x in d["pages"] if not x.startswith("(")]),
                     "pages": "; ".join(sorted(d["pages"])), "contexts": "; ".join(sorted(d["ctx"])),
                     "rehost_path": unquote(p.path), "status": "hotlinked (Webflow CDN)" if "website-files" in p.netloc else "third-party (left as-is)"})
    with open(os.path.join(ROOT, "media-manifest.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    with open(os.path.join(DATA, "third-party.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh); w.writerow(["kind", "what", "pages"])
        for (k, v), ps in sorted(tp.items()): w.writerow([k, v, "; ".join(sorted(ps))])
    print(len(rows), "media URLs", dict(collections.Counter(r["type"] for r in rows)), "|", len(tp), "third-party rows")

if __name__ == "__main__":
    main()
