"""Step 5: parity check — every live page vs the built page in dist/.

Live capture gets the same transforms as the build (tools/extract.py:prep). The built page has the
mockup-only form guard script removed (the one intended addition). Then:
  HTML/BODY attributes must match; BODY structure + attributes + visible text must match
  (whitespace-normalised); HEAD must contain the same set of elements (order may differ).

Run after `npm run build`:  python3 tools/parity.py [url ...]
"""
import csv, os, re, sys, difflib, collections
sys.path.insert(0, os.path.dirname(__file__))
import extract as E
from bs4 import BeautifulSoup, NavigableString, Comment

DIST = os.path.join(E.ROOT, "dist")

def sig(node):
    out = []
    for el in node.descendants:
        if getattr(el, "name", None):
            out.append("<" + el.name + " " + " ".join(f'{k}={E.ws(" ".join(v) if isinstance(v, list) else v)}' for k, v in sorted(el.attrs.items())) + ">")
        elif isinstance(el, NavigableString) and not isinstance(el, Comment):
            t = E.ws(str(el))
            if t: out.append(t)
    return out

def attrs(t): return sorted((k, " ".join(v) if isinstance(v, list) else v) for k, v in t.attrs.items())

def main():
    only = [a for a in sys.argv[1:] if a.startswith("/")]
    rows = [r for r in csv.DictReader(open(os.path.join(E.DATA, "url-inventory.csv"), encoding="utf-8")) if r["status"] == "200" and r["file"]]
    bad = 0
    for r in rows:
        u = r["url"]
        if only and u not in only: continue
        bp = os.path.join(DIST, "index.html" if u == "/" else u.lstrip("/") + ".html")
        if not os.path.exists(bp): print("MISSING", u); bad += 1; continue
        live = BeautifulSoup(str(E.prep(E.read(os.path.join(E.RAW, r["file"])))), "html5lib")
        built = BeautifulSoup(open(bp, encoding="utf-8").read(), "html5lib")
        for sc in built.find_all("script"):
            if "MOCKUP ONLY" in sc.decode_contents(): sc.decompose()
        problems = []
        if attrs(live.html) != attrs(built.html): problems.append(f"<html> attrs {attrs(live.html)} vs {attrs(built.html)}")
        if attrs(live.body) != attrs(built.body): problems.append(f"<body> attrs {attrs(live.body)} vs {attrs(built.body)}")
        lb, bb = sig(live.body), sig(built.body)
        if lb != bb: problems.append("body: " + " | ".join(l[:160] for l in list(difflib.unified_diff(lb, bb, lineterm="", n=0))[2:10]))
        lh = collections.Counter(E.ws(str(t)) for t in E.tags(live.head)); bh = collections.Counter(E.ws(str(t)) for t in E.tags(built.head))
        if lh != bh: problems.append(f"head only-live {[x[:80] for x in lh - bh]} only-built {[x[:80] for x in bh - lh]}")
        print(("OK      " if not problems else "DIFFERS ") + u)
        for p in problems: print("   ", p)
        bad += bool(problems)
    print(f"{len(rows) if not only else len(only)} checked, {bad} with differences")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
