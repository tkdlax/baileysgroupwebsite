"""Crawl www.baileysgroup.com and capture the live site (step 1.1 / 1.2).

Seeds: /sitemap.xml + homepage. Follows every internal <a href> (same host).
For each URL records status, redirect target, title, H1, canonical, robots,
content hash (to spot the same page served at two URLs), first-found source and inlinks.
Saves raw server HTML of every 200 page to baseline/raw/html/<path>.html
(path "/" -> "__.html"; "/" in paths -> "__"; query string appended as "~q~<query>").

Re-run any time: python3 tools/crawl.py   (overwrites baseline/raw/html and baseline/data)
"""
import concurrent.futures as cf, csv, hashlib, json, os, re, sys, time
from urllib.parse import urljoin, urlparse, urldefrag, unquote
import requests
from bs4 import BeautifulSoup

HOST = "www.baileysgroup.com"
BASE = f"https://{HOST}"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "baseline", "raw", "html")
DATA = os.path.join(ROOT, "baseline", "data")
os.makedirs(RAW, exist_ok=True); os.makedirs(DATA, exist_ok=True)
S = requests.Session()
S.headers["User-Agent"] = "Mozilla/5.0 (BaileysGroupMigrationBaseline/1.0)"
MEDIA = re.compile(r"\.(pdf|jpe?g|png|gif|svg|webp|avif|bmp|ico|mp4|webm|mov|mp3|zip|docx?|xlsx?|pptx?|css|js|woff2?|ttf|eot)$", re.I)
MAX_QS_PER_PATH = 60  # safety valve for query-string pagination loops

def norm(u):
    u, _ = urldefrag(u.strip())
    p = urlparse(u)
    if p.scheme not in ("http", "https"): return None
    host = p.netloc.lower()
    if host in ("baileysgroup.com",): host = HOST
    if host != HOST: return None
    path = p.path or "/"
    if MEDIA.search(path): return None
    if path.lower().startswith(("/cdn-cgi/",)): return None
    return path + (("?" + p.query) if p.query else "")

def key(u):  # exact match: the server 301s case variants to lowercase, so /Contact and /contact are different fetches
    return u

def fname(u):
    path, _, q = u.partition("?")
    f = path.strip("/").replace("/", "__") or "__"
    f = unquote(f)
    f = re.sub(r'[<>:"\\|*]', "_", f)
    if q: f += "~q~" + re.sub(r"[^A-Za-z0-9=&_-]", "_", q)
    return f + ".html"

def fetch(u):
    for attempt in range(3):
        try:
            r = S.get(BASE + u, allow_redirects=False, timeout=30)
            return r
        except Exception as e:
            err = e; time.sleep(2 * (attempt + 1))
    return err

def parse(u, r):
    rec = {"url": u, "status": None, "redirect": "", "title": "", "h1": "", "canonical": "",
           "robots": "", "hash": "", "bytes": 0, "file": ""}
    links = []
    if isinstance(r, Exception):
        rec["status"] = "ERR " + type(r).__name__; return rec, links
    rec["status"] = r.status_code
    if r.is_redirect or r.status_code in (301, 302, 303, 307, 308):
        loc = urljoin(BASE + u, r.headers.get("Location", ""))
        rec["redirect"] = loc
        n = norm(loc)
        if n: links.append(n)
        return rec, links
    ctype = r.headers.get("Content-Type", "")
    if r.status_code != 200 or "html" not in ctype:
        return rec, links
    html = r.content
    rec["bytes"] = len(html)
    rec["hash"] = hashlib.sha1(html).hexdigest()[:12]
    f = fname(u); rec["file"] = f
    with open(os.path.join(RAW, f), "wb") as fh: fh.write(html)
    s = BeautifulSoup(html, "html.parser")
    rec["title"] = (s.title.get_text(" ", strip=True) if s.title else "")
    h1 = s.find("h1"); rec["h1"] = h1.get_text(" ", strip=True)[:200] if h1 else ""
    c = s.find("link", rel="canonical"); rec["canonical"] = c.get("href", "") if c else ""
    m = s.find("meta", attrs={"name": re.compile("^robots$", re.I)}); rec["robots"] = m.get("content", "") if m else ""
    for a in s.find_all("a", href=True):
        n = norm(urljoin(BASE + u, a["href"]))
        if n: links.append(n)
    return rec, links

def main():
    sm = S.get(BASE + "/sitemap.xml", timeout=30).text  # baileysgroup.com has none (returns the 404 page)
    # "/404" = Webflow's custom 404 page (linked from nowhere, found by probing)
    seeds = ["/", "/404"] + [norm(x) for x in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", sm)]
    seeds = [x for x in seeds if x]
    json.dump(seeds, open(os.path.join(DATA, "sitemap-urls.json"), "w"), indent=1)
    seen = {}; source = {}; inlinks = {}; recs = {}; graph = {}; qs_count = {}
    queue = []
    def add(u, src):
        k = key(u)
        inlinks[k] = inlinks.get(k, 0) + (1 if src != "sitemap" else 0)
        if k in seen: return
        path = u.split("?")[0].lower()
        if "?" in u:
            qs_count[path] = qs_count.get(path, 0) + 1
            if qs_count[path] > MAX_QS_PER_PATH: return
        seen[k] = u; source[k] = src; queue.append(u)
    for x in seeds: add(x, "sitemap")
    with cf.ThreadPoolExecutor(6) as ex:
        while queue:
            batch, queue[:] = queue[:], []
            for u, r in zip(batch, ex.map(fetch, batch)):
                rec, links = parse(u, r)
                rec["source"] = source[key(u)]
                recs[key(u)] = rec
                graph[u] = sorted(set(links))
                for l in links: add(l, u)
            print(f"done {len(recs)}  queued {len(queue)}", flush=True)
    sm_keys = {key(x) for x in seeds}
    rows = []
    for k, rec in recs.items():
        rec["in_sitemap"] = "y" if k in sm_keys else ""
        rec["inlinks"] = inlinks.get(k, 0)
        rows.append(rec)
    rows.sort(key=lambda r: r["url"].lower())
    cols = ["url", "status", "redirect", "in_sitemap", "inlinks", "title", "h1", "canonical", "robots", "hash", "bytes", "file", "source"]
    with open(os.path.join(DATA, "url-inventory.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore"); w.writeheader(); w.writerows(rows)
    json.dump(graph, open(os.path.join(DATA, "link-graph.json"), "w"), indent=0)
    from collections import Counter
    print(Counter(str(r["status"]) for r in rows))

if __name__ == "__main__":
    main()
