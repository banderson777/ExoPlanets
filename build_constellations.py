"""Join constellation line figures to HYG coordinates and NASA host names."""
import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path


# Standard IAU names and abbreviations.
# https://www.iau.org/IAU/Astronomy-FAQs/Constellations.aspx
NAMES = {
    "And": "Andromeda", "Ant": "Antlia", "Aps": "Apus", "Aqr": "Aquarius",
    "Aql": "Aquila", "Ara": "Ara", "Ari": "Aries", "Aur": "Auriga",
    "Boo": "Boötes", "Cae": "Caelum", "Cam": "Camelopardalis", "Cnc": "Cancer",
    "CVn": "Canes Venatici", "CMa": "Canis Major", "CMi": "Canis Minor", "Cap": "Capricornus",
    "Car": "Carina", "Cas": "Cassiopeia", "Cen": "Centaurus", "Cep": "Cepheus",
    "Cet": "Cetus", "Cha": "Chamaeleon", "Cir": "Circinus", "Col": "Columba",
    "Com": "Coma Berenices", "CrA": "Corona Australis", "CrB": "Corona Borealis", "Crv": "Corvus",
    "Crt": "Crater", "Cru": "Crux", "Cyg": "Cygnus", "Del": "Delphinus",
    "Dor": "Dorado", "Dra": "Draco", "Equ": "Equuleus", "Eri": "Eridanus",
    "For": "Fornax", "Gem": "Gemini", "Gru": "Grus", "Her": "Hercules",
    "Hor": "Horologium", "Hya": "Hydra", "Hyi": "Hydrus", "Ind": "Indus",
    "Lac": "Lacerta", "Leo": "Leo", "LMi": "Leo Minor", "Lep": "Lepus",
    "Lib": "Libra", "Lup": "Lupus", "Lyn": "Lynx", "Lyr": "Lyra",
    "Men": "Mensa", "Mic": "Microscopium", "Mon": "Monoceros", "Mus": "Musca",
    "Nor": "Norma", "Oct": "Octans", "Oph": "Ophiuchus", "Ori": "Orion",
    "Pav": "Pavo", "Peg": "Pegasus", "Per": "Perseus", "Phe": "Phoenix",
    "Pic": "Pictor", "Psc": "Pisces", "PsA": "Piscis Austrinus", "Pup": "Puppis",
    "Pyx": "Pyxis", "Ret": "Reticulum", "Sge": "Sagitta", "Sgr": "Sagittarius",
    "Sco": "Scorpius", "Scl": "Sculptor", "Sct": "Scutum", "Ser": "Serpens",
    "Sex": "Sextans", "Tau": "Taurus", "Tel": "Telescopium", "Tri": "Triangulum",
    "TrA": "Triangulum Australe", "Tuc": "Tucana", "UMa": "Ursa Major", "UMi": "Ursa Minor",
    "Vel": "Vela", "Vir": "Virgo", "Vol": "Volans", "Vul": "Vulpecula",
}


def read_lines(path):
    """Return unique Bright Star Catalogue endpoint pairs for each figure."""
    figures = defaultdict(set)
    for row in path.read_text(encoding="utf-8").splitlines():
        if not row.strip() or row.startswith("#"):
            continue
        name, count, *ids = row.split()
        stars = [int(value) for value in ids]
        if len(stars) != int(count):
            raise ValueError(f"Invalid line for {name}.")
        figures[name].update(tuple(sorted(pair)) for pair in zip(stars, stars[1:]))
    return figures


def read_stars(path, endpoints, hosts):
    """Return reference positions in degrees and parsecs keyed by HR number."""
    stars = {}
    with path.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            if not row["hr"] or (hr := int(row["hr"])) not in endpoints:
                continue
            ra, dec, distance = float(row["ra"]) * 15, float(row["dec"]), float(row["dist"])
            # HYG uses 100,000 pc as a sentinel for an unknown distance.
            if not all(map(math.isfinite, (ra, dec, distance))) or not 0 < distance < 100_000:
                continue
            host = hosts.get(f"HIP {row['hip']}", set())
            stars[hr] = [round(ra, 6), round(dec, 6), distance, next(iter(host)) if len(host) == 1 else None]
    return stars


def main():
    """Generate the credited, browser-ready overlay from local data files."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lines", type=Path, help="ConstellationLines.dat by Marc van der Sluys")
    parser.add_argument("hyg", type=Path, help="HYG v4.1 CSV")
    parser.add_argument("hosts", type=Path, help="NASA TAP JSON containing hostname and hip_name")
    args = parser.parse_args()
    figures = read_lines(args.lines)
    edges = sorted(set().union(*figures.values()))
    hosts = defaultdict(set)
    for row in json.loads(args.hosts.read_text(encoding="utf-8")):
        hosts[row["hip_name"]].add(row["hostname"])
    stars = read_stars(args.hyg, {hr for edge in edges for hr in edge}, hosts)
    kept = [(a, b) for a, b in edges if a in stars and b in stars]
    ids = sorted({hr for edge in kept for hr in edge})
    index = {hr: i for i, hr in enumerate(ids)}
    line_index = {pair: i for i, pair in enumerate(kept)}
    data = {
        "stars": [stars[hr] for hr in ids],
        "lines": [[index[a], index[b]] for a, b in kept],
        "figures": [[code, NAMES[code], [line_index[pair] for pair in sorted(figures[code]) if pair in line_index]]
                    for code in sorted(figures, key=NAMES.__getitem__)],
    }
    output = Path(__file__).with_name("dist") / "constellations.js"
    notice = (
        "/* Adapted from ConstellationLines by Marc van der Sluys (CC BY 4.0)\n"
        " * https://github.com/MarcvdSluys/ConstellationLines\n"
        " * Positions from HYG v4.1 by David Nash / Astronexus (CC BY-SA 4.0)\n"
        " * https://github.com/astronexus/HYG-Database\n"
        " * This joined and filtered dataset is CC BY-SA 4.0.\n"
        " * https://creativecommons.org/licenses/by-sa/4.0/ */\n"
    )
    output.write_text(notice + "window.ATLAS_CONSTELLATIONS = " +
                      json.dumps(data, separators=(",", ":")) + ";\n", encoding="utf-8")
    represented = sum(any(a in stars and b in stars for a, b in pairs) for pairs in figures.values())
    print(f"{len(ids)} stars, {len(kept)} lines, {represented} constellations, "
          f"{len(edges) - len(kept)} lines omitted for missing distances.")


if __name__ == "__main__":
    main()
