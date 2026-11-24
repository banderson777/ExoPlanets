"""Embed the offline chart files in a standalone Sites Worker module."""
import json
from pathlib import Path


ASSETS = {
    "index.html": "text/html; charset=utf-8",
    "atlas.css": "text/css; charset=utf-8",
    "science.js": "text/javascript; charset=utf-8",
    "atlas.js": "text/javascript; charset=utf-8",
    "catalog.js": "text/javascript; charset=utf-8",
    "constellations.js": "text/javascript; charset=utf-8",
    "atlas.svg": "image/svg+xml",
    "observations.html": "text/html; charset=utf-8",
    "observations.css": "text/css; charset=utf-8",
    "spectrum.html": "text/html; charset=utf-8",
    "spectrum.js": "text/javascript; charset=utf-8",
    "k2-18b-spectrum.csv": "text/csv; charset=utf-8",
    "observations.js": "text/javascript; charset=utf-8",
}


def main():
    """Build the Worker entry point from the current offline chart files.

    The generated module embeds the allowlisted assets with their MIME types.
    Sites packages the module at dist/server/index.js.
    """
    root = Path(__file__).resolve().parent
    dist = root / "dist"
    assets = {f"/{name}": (mime, (dist / name).read_bytes().decode("utf-8"))
              for name, mime in ASSETS.items()}
    source = (root / "worker.mjs").read_text(encoding="utf-8")
    target = dist / "server" / "index.js"
    target.parent.mkdir(exist_ok=True)
    encoded = json.dumps(assets, ensure_ascii=True, separators=(",", ":"))
    target.write_text(f"const assets = {encoded};\n\n{source}", encoding="utf-8")


if __name__ == "__main__":
    main()
