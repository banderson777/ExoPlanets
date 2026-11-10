# Orbital Atlas

Orbital Atlas is a buildless star chart for the confirmed planets in the NASA Exoplanet Archive's Planetary Systems Composite Parameters table. Open `dist/index.html` in a modern browser. The bundled snapshot also works offline.

Drag to rotate and scroll or pinch to zoom. Hold Shift while dragging to pan. The canvas accepts the arrow keys, plus, minus, and Home. Use the catalog to search and select a host, including systems missing a 3D position. Click a planet in the system panel for details and hover over stars or planets for measurements.

Use **Copy view link** below the chart to capture the filters, chart view, selected system, and comparison. Links to the hosted atlas use its existing access controls. Links created from the offline copy refer to that file on your computer.

Turn on **Constellations** in the chart to see white lines between their reference stars. The endpoints use stellar distances and rotate with the chart. Zoom out in Sol view to see longer figures. The layer is independent of the exoplanet filters and is included in copied view links.

## Refresh the NASA catalog

Run `python3 refresh_catalog.py --check` with Python 3.9 or later and internet access. It lists added and removed names and changed fields for both hosts and planets without writing the snapshot. Run `python3 refresh_catalog.py` to replace `dist/catalog.js` after review. To check and apply the same previously saved TAP JSON response, pass `--input PATH --date YYYY-MM-DD` to both commands.

The Data guide in the app explains the filter thresholds, the coverage of water-vapor detections, and how to read the map and orbit diagrams. The NASA table's [column definitions](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html) document the original measurements.

## Build the hosted version

Run `python3 build_worker.py` after refreshing the catalog. It embeds the chart assets in `dist/server/index.js` for Sites. The Worker sets HTTP security headers and serves only the chart files. The offline entry point is still `dist/index.html`.

## Source layout

| File | Purpose |
| --- | --- |
| [`dist/index.html`](dist/index.html) and [`dist/atlas.css`](dist/atlas.css) | Browser entry point, controls, dialogs, and styling. |
| [`dist/atlas.js`](dist/atlas.js) | Catalog decoding, filters, Canvas star chart, SVG orbits, comparisons, and saved views. |
| [`refresh_catalog.py`](refresh_catalog.py) | Fetches, validates, and compares NASA data before generating `dist/catalog.js`. |
| [`build_constellations.py`](build_constellations.py) | Joins line figures, stellar positions, and NASA host cross-identifiers into `dist/constellations.js`. |
| [`build_worker.py`](build_worker.py) and [`worker.mjs`](worker.mjs) | Embed and serve the chart assets for the hosted build. |

The generated catalog stores ordered field names alongside compact host and planet rows. Catalog fields retain their NASA names and units. The browser converts host positions to light-years and uses AU for orbit sizes. It keeps projected separations separate from usable orbital axes.

The JavaScript uses [JSDoc](https://jsdoc.app/about-getting-started) for data shapes, units, and function contracts. The Python scripts use [PEP 257 docstrings](https://peps.python.org/pep-0257/) for command and data-processing behavior.

## Constellation data

The bundled overlay adapts [ConstellationLines](https://github.com/MarcvdSluys/ConstellationLines) by Marc van der Sluys ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) and [HYG v4.1](https://github.com/astronexus/HYG-Database) by David Nash / Astronexus ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)). The build joins the Bright Star Catalogue identifiers, converts right ascension to degrees, deduplicates segments, omits endpoints without usable distances, and links unique NASA Hipparcos matches to their atlas hosts. The combined dataset is distributed under CC BY-SA 4.0.

To regenerate it, pass the line figure DAT file, HYG v4.1 CSV, and NASA TAP JSON to `python3 build_constellations.py LINES_DAT HYG_CSV HOSTS_JSON`. Query NASA with `select distinct hostname,hip_name from pscomppars where hip_name is not null order by hostname`.

## Check a change locally

- Open `dist/index.html` in a browser. Search for TRAPPIST‑1, enable the Habitable zone filter, and confirm that e, f, and g have green orbit paths while the other planets stay visible in gray.
- Search for OGLE‑2014‑BLG‑0676L and confirm that the dashed placeholder opens the planet details and lists projected separation separately.
- Add two planets to Compare, copy the view link, and open it in a fresh tab to confirm the comparison and filters restore.
- After changing the hosting code or assets, run `python3 build_worker.py` and check `dist/server/index.js` with `node --check` using Node.js 22 or later.
