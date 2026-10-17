"""Step 3/4: turn the captured live HTML into the Astro project's data.

baileysgroup.com is a 3-page Webflow site (/, /contact, /404). Output:
  src/chrome/head.json        <head> items shared by every page (in live order)
  src/chrome/tail.json        (empty) end-of-body scripts stay per page — their order differs by page
  src/chrome/nav.html         the navigation bar (live marks the current page with w--current;
                              src/components/Nav.astro re-applies that per page)
  src/chrome/footer.html      the two footer blocks (identical on every page that has them)
  src/content/pages/*.json    per page: <html>/<body> attributes, page-only head items, main content,
                              which shared pieces it has (the 404 page has no nav/footer)
  baseline/data/extract-report.json

Transforms (no visible change): tracking stripped if present; internal absolute links → relative;
Webflow CDN CSS/JS + jQuery → the local copies in public/_webflow (baseline/data/asset-map.json).
Media stays on Webflow's CDN; src/lib/media.ts can repoint it later.

Re-run: python3 tools/extract.py   (overwrites src/content and src/chrome — don't re-run after hand edits)
"""
import csv, json, os, re, sys, collections, shutil
from bs4 import BeautifulSoup, Comment
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
from readhtml import read

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "baseline", "raw", "html")
DATA = os.path.join(ROOT, "baseline", "data")
SRC = os.path.join(ROOT, "src")
AMAP = json.load(open(os.path.join(DATA, "asset-map.json")))
REPORT = collections.Counter()

TRACK_SRC = re.compile(r"googletagmanager\.com|google-analytics\.com|googleadservices\.com|connect\.facebook\.net|hotjar|clarity\.ms|callrail", re.I)
TRACK_INLINE = re.compile(r"gtm\.start|gtag\(|fbq\(|hjSettings|clarity\(", re.I)
INTERNAL = re.compile(r"^https?://(www\.)?baileysgroup\.com(?=/|$)", re.I)

def ws(s): return re.sub(r"\s+", " ", s).strip()
def tags(n): return [c for c in n.children if getattr(c, "name", None)]

def prep(html):
    s = BeautifulSoup(html, "html5lib")  # browser-accurate tree
    for t in s.find_all("script"):
        src = t.get("src") or ""
        # decode_contents(), not get_text(): BeautifulSoup leaves <script> contents out of get_text()
        if (src and TRACK_SRC.search(src)) or (not src and TRACK_INLINE.search(t.decode_contents())):
            REPORT["stripped:" + (src or "inline")[:60]] += 1; t.decompose()
    for t in s.find_all("noscript"):
        if "googletagmanager" in str(t): t.decompose(); REPORT["stripped:noscript"] += 1
    for a in s.find_all("a", href=True):
        if INTERNAL.match(a["href"].strip()):
            a["href"] = INTERNAL.sub("", a["href"].strip()) or "/"; REPORT["internal-link-made-relative"] += 1
    for tag, attr in (("link", "href"), ("script", "src")):
        for t in s.find_all(tag, attrs={attr: True}):
            if t[attr] in AMAP: t[attr] = AMAP[t[attr]]; REPORT["asset-local"] += 1
    return s

def safe_name(url): return "index" if url == "/" else re.sub(r"[^A-Za-z0-9_-]", "_", url.strip("/"))

def main():
    for d in ("content", "chrome"): shutil.rmtree(os.path.join(SRC, d), ignore_errors=True)
    os.makedirs(os.path.join(SRC, "chrome")); os.makedirs(os.path.join(SRC, "content", "pages"))
    rows = [r for r in csv.DictReader(open(os.path.join(DATA, "url-inventory.csv"), encoding="utf-8")) if r["status"] == "200" and r["file"]]
    soups = {r["url"]: prep(read(os.path.join(RAW, r["file"]))) for r in rows}
    N = len(soups)
    # shared head items / tail scripts = present on every page
    hc = collections.Counter(); bc = collections.Counter()
    for s in soups.values():
        for t in set(str(x) for x in tags(s.head)): hc[t] += 1
        for t in set(str(x) for x in tags(s.body) if x.name == "script"): bc[t] += 1
    ref = soups["/"]
    head = [str(t) for t in tags(ref.head) if hc[str(t)] == N]
    tail = []  # body scripts stay per page: shared ones sit between page-only ones on live, and order matters
    # nav (current marker removed) + footer, from pages that have them
    nav = ref.find("div", class_="navigation-bar")
    nav_clean = BeautifulSoup(str(nav), "html5lib").find("div", class_="navigation-bar")
    for a in nav_clean.find_all("a"):
        if "w--current" in (a.get("class") or []): a["class"].remove("w--current")
        if a.get("aria-current"): del a["aria-current"]
    footers = [t for t in tags(ref.body) if "footer" in (t.get("class") or [])]
    footer_html = "\n".join(str(t) for t in footers)
    json.dump(head, open(os.path.join(SRC, "chrome", "head.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(tail, open(os.path.join(SRC, "chrome", "tail.json"), "w"), ensure_ascii=False, indent=1)
    open(os.path.join(SRC, "chrome", "nav.html"), "w").write(str(nav_clean) + "\n")
    open(os.path.join(SRC, "chrome", "footer.html"), "w").write(footer_html + "\n")
    for url, s in soups.items():
        body = tags(s.body)
        page_nav = next((t for t in body if "navigation-bar" in (t.get("class") or [])), None)
        page_footers = [t for t in body if "footer" in (t.get("class") or [])]
        if page_footers and "\n".join(str(t) for t in page_footers) != footer_html: REPORT["footer-differs:" + url] += 1
        main, page_tail = [], []
        seen_footer = False
        for t in body:
            if t is page_nav or t in page_footers: seen_footer = seen_footer or t in page_footers; continue
            if t.name == "script" and str(t) in tail: continue
            # page-only body scripts go after the shared ones (they depend on jQuery/webflow.js), as on live
            (page_tail if t.name == "script" else main).append(str(t))
        entry = {
            "url": url,
            "htmlAttrs": dict(s.html.attrs),
            "bodyAttrs": {k: (" ".join(v) if isinstance(v, list) else v) for k, v in s.body.attrs.items()},
            "headPage": [str(t) for t in tags(s.head) if str(t) not in head],
            "hasNav": page_nav is not None,
            "hasFooter": bool(page_footers),
            "main": "\n".join(main),
            "tailPage": page_tail,
        }
        if page_nav is not None:
            cur = [a.get("href") for a in page_nav.find_all("a") if "w--current" in (a.get("class") or [])]
            entry["navCurrent"] = cur
        json.dump(entry, open(os.path.join(SRC, "content", "pages", safe_name(url) + ".json"), "w"), ensure_ascii=False, indent=1)
        REPORT["pages"] += 1
    json.dump(dict(REPORT), open(os.path.join(DATA, "extract-report.json"), "w"), indent=1)
    print(json.dumps(dict(REPORT), indent=1))

if __name__ == "__main__":
    main()
