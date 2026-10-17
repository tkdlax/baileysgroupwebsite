"""Read captured HTML. Live pages are UTF-8 but some contain stray Windows-1252 bytes
(e.g. 0x92 curly apostrophe pasted into the CMS). Invalid UTF-8 bytes are decoded as cp1252,
which is what browsers effectively show for those characters."""
import codecs

def _cp1252_fallback(err):
    bad = err.object[err.start:err.end]
    return (bad.decode("cp1252", errors="replace"), err.end)

codecs.register_error("cp1252fallback", _cp1252_fallback)

def read(path):
    with open(path, "rb") as fh:
        b = fh.read()
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        return b.decode("utf-8", errors="cp1252fallback")
