"""Step 5.3: side-by-side visual check, live site vs local build, in a real browser.

For each URL: full-page screenshots of live and local at desktop (1440) and mobile (390) widths,
visible-text comparison (document.body.innerText), page height, pixel-difference %, plus console
errors and failed requests on the local build (ignoring blocked trackers).

Needs the build served locally first:  npx astro preview --port 4322
Run:  python3 tools/visual.py [--shots] [url ...]     (default: one URL per page type)
Screenshots → baseline/rendered/shots/ (gitignored). Report → baseline/data/visual-report.json
"""
import json, os, re, sys, difflib
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE = "https://www.baileysgroup.com"
LOCAL = "http://localhost:4322"
SHOTS = os.path.join(ROOT, "baseline", "rendered", "shots")
DEFAULT = ["/", "/contact", "/404"]
NOISE = re.compile(r"googletagmanager|google-analytics|doubleclick|recaptcha|gstatic", re.I)
FREEZE = """*{animation:none!important;transition:none!important;caret-color:transparent!important}"""

def shot(page, url, path):
    page.goto(url, wait_until="networkidle", timeout=60000)
    page.add_style_tag(content=FREEZE)
    page.wait_for_timeout(1500)
    txt = page.evaluate("document.body ? document.body.innerText : ''")
    h = page.evaluate("document.documentElement.scrollHeight")
    if path: page.screenshot(path=path, full_page=True)
    return txt, h

def pixdiff(a, b):
    A, B = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    w, h = min(A.width, B.width), min(A.height, B.height)
    d = ImageChops.difference(A.crop((0, 0, w, h)), B.crop((0, 0, w, h))).convert("L").point(lambda x: 255 if x > 40 else 0)
    return round(100 * d.histogram()[255] / (w * h), 2)

def main():
    urls = [a for a in sys.argv[1:] if a.startswith("/")] or DEFAULT
    os.makedirs(SHOTS, exist_ok=True)
    report = []
    with sync_playwright() as p:
        br = p.chromium.launch()
        for width, label in ((1440, "desktop"), (390, "mobile")):
            ctx = br.new_context(viewport={"width": width, "height": 900}, device_scale_factor=1)
            for u in urls:
                safe = re.sub(r"[^A-Za-z0-9]+", "_", u).strip("_") or "home"
                lp, bp = os.path.join(SHOTS, f"{safe}.{label}.live.png"), os.path.join(SHOTS, f"{safe}.{label}.local.png")
                page = ctx.new_page(); errs, fails = [], []
                page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
                page.on("requestfailed", lambda r: fails.append(r.url[:160]) if not NOISE.search(r.url) else None)
                page.on("response", lambda r: fails.append(f"{r.status} {r.url[:160]}") if r.status >= 400 and not NOISE.search(r.url) else None)
                try:
                    bt, bh = shot(page, LOCAL + u, bp)
                    local_errs, local_fails = list(errs), list(fails)
                    lt, lh = shot(page, LIVE + u, lp)
                except Exception as ex:
                    report.append({"url": u, "view": label, "error": str(ex)[:200]}); page.close(); continue
                page.close()
                norm = lambda t: [x.strip() for x in t.splitlines() if x.strip()]
                tdiff = [l for l in difflib.unified_diff(norm(lt), norm(bt), lineterm="", n=0) if l[:1] in "+-" and l[:3] not in ("+++", "---")]
                r = {"url": u, "view": label, "height_live": lh, "height_local": bh, "pixel_diff_pct": pixdiff(lp, bp),
                     "text_diff_lines": tdiff[:12], "local_console_errors": sorted(set(local_errs))[:8],
                     "local_failed_requests": sorted(set(local_fails))[:8]}
                report.append(r)
                print(f"{label:7} {u[:70]:70} h {lh}/{bh}  px {r['pixel_diff_pct']:5}%  text±{len(tdiff)}  err {len(r['local_console_errors'])}  fail {len(r['local_failed_requests'])}", flush=True)
            ctx.close()
        br.close()
    json.dump(report, open(os.path.join(ROOT, "baseline", "data", "visual-report.json"), "w"), indent=1)

if __name__ == "__main__":
    main()
