'use strict';

const byId = (id) => document.getElementById(id);
const canvas = byId('observation-map');
const context = canvas.getContext('2d');
const contrast = byId('contrast');
const fileInput = byId('model-file');
const layerList = byId('observation-layers');
const status = byId('model-status');
const format = (value) => Number(value.toPrecision(5)).toString();
let model, bounds, frame, drag;
let hits = [];
let yaw, pitch, zoom;
let importRequest = 0;

function demoModel() {
  const bands = [[.002, 'X-ray example'], [.55, 'Visible example'], [2, 'Near-infrared example'], [10, 'Mid-infrared example']];
  const layers = bands.map(([wavelength_um, observatory], index) => {
    const points = [];
    for (let north = -25; north <= 25; north++) {
      for (let east = -25; east <= 25; east++) {
        const radius = Math.hypot(east * .8, north * 1.3);
        const angle = Math.atan2(north, east);
        const ring = Math.exp(-((radius - 6 - index * 3) ** 2) / 9);
        const intensity = ring * (.65 + .35 * Math.cos(2 * angle + index)) +
          Math.exp(-(radius ** 2) / (4 + index * 4)) * (1 - index * .2);
        if (intensity > .08) points.push([east, north, intensity]);
      }
    }
    return {wavelength_um, observatory, source:'Generated example', unit:'arbitrary units', points};
  });
  return {version:1, target:'Illustrative disk', synthetic:true, layers};
}

function validate(data) {
  if (data?.version !== 1 || typeof data.target !== 'string' || !Array.isArray(data.layers) ||
      !data.layers.length || data.layers.length > 64) throw new Error('Expected a version 1 observation model with 1–64 layers.');
  let count = 0;
  for (const layer of data.layers) {
    if (!layer || !Number.isFinite(layer.wavelength_um) || layer.wavelength_um <= 0 ||
        !Array.isArray(layer.points) || !layer.points.length ||
        ['source', 'observatory', 'unit'].some((key) => typeof layer[key] !== 'string')) {
      throw new Error('Each layer needs a positive wavelength, provenance, an intensity unit field, and samples.');
    }
    count += layer.points.length;
    if (count > 60000 || layer.points.some((point) => !Array.isArray(point) || point.length !== 3 ||
        !point.every(Number.isFinite) || Math.abs(point[0]) > 18000 || Math.abs(point[1]) > 18000)) {
      throw new Error('Use up to 60,000 finite [east, north, intensity] samples within five degrees of center.');
    }
  }
  return count;
}

function loadModel(data) {
  const count = validate(data);
  const layers = [...data.layers].sort((first, second) => first.wavelength_um - second.wavelength_um);
  const minWave = Math.log10(layers[0].wavelength_um);
  const maxWave = Math.log10(layers.at(-1).wavelength_um);
  let minEast = Infinity, maxEast = -Infinity, minNorth = Infinity, maxNorth = -Infinity;
  for (const layer of layers) {
    for (const [east, north] of layer.points) {
      minEast = Math.min(minEast, east);
      maxEast = Math.max(maxEast, east);
      minNorth = Math.min(minNorth, north);
      maxNorth = Math.max(maxNorth, north);
    }
  }
  bounds = {east:(minEast + maxEast) / 2, north:(minNorth + maxNorth) / 2,
    span:Math.max(maxEast - minEast, maxNorth - minNorth, .001)};
  model = layers.map((layer) => {
    const share = maxWave === minWave ? .5 : (Math.log10(layer.wavelength_um) - minWave) / (maxWave - minWave);
    return {...layer, depth:(share - .5) * .8, hue:230 - 205 * share, visible:true,
      points:[...layer.points].sort((first, second) => second[2] - first[2])};
  });
  byId('model-kind').textContent = data.synthetic === true ? 'SYNTHETIC DEMO' : 'IMPORTED MODEL';
  byId('target-title').textContent = data.target;
  const knownCenter = Array.isArray(data.center_icrs_deg) && data.center_icrs_deg.length === 2 &&
    data.center_icrs_deg.every(Number.isFinite);
  const center = knownCenter ? ' · ICRS center ' + data.center_icrs_deg.map(format).join('°, ') + '°' : '';
  byId('view-range').textContent = `${format(layers[0].wavelength_um)}–${format(layers.at(-1).wavelength_um)} μm · ` +
    `${format(maxEast - minEast)}″ east × ${format(maxNorth - minNorth)}″ north${center}`;
  layerList.replaceChildren(...model.map((layer) => {
    const item = document.createElement('li');
    const label = document.createElement('label');
    const toggle = document.createElement('input');
    const caption = document.createElement('span');
    const detail = document.createElement('small');
    toggle.type = 'checkbox';
    toggle.checked = true;
    toggle.addEventListener('change', () => {
      layer.visible = toggle.checked;
      scheduleDraw();
    });
    caption.textContent = `${format(layer.wavelength_um)} μm · ${layer.observatory}`;
    caption.style.color = `hsl(${layer.hue} 90% 78%)`;
    detail.textContent = `${layer.source}${Number.isInteger(layer.plane) ? ` · plane ${layer.plane}` : ''}` +
      ` · ${layer.points.length.toLocaleString()} samples`;
    label.append(toggle, caption);
    item.append(label, detail);
    return item;
  }));
  contrast.value = '100';
  byId('contrast-value').textContent = '100%';
  const cutoff = Number.isFinite(data.percentile) ? ` · FITS cutoff P${format(data.percentile)}` : '';
  status.textContent = `${model.length} layers · ${count.toLocaleString()} samples${cutoff}`;
  byId('sample-info').textContent = 'Click or tap a point to read its coordinates and intensity.';
  resetView();
}

function draw() {
  frame = 0;
  const {width, height} = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const scale = Math.min(width, height) * .76 * zoom;
  const [cosYaw, sinYaw, cosPitch, sinPitch] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  function project(east, north, spectral) {
    const across = east * cosYaw + spectral * sinYaw;
    const depth = spectral * cosYaw - east * sinYaw;
    return [width / 2 + across * scale, height / 2 - (north * cosPitch - depth * sinPitch) * scale,
      north * sinPitch + depth * cosPitch];
  }
  const percentage = Number(contrast.value) / 100;
  hits = [];
  for (const layer of model) {
    if (!layer.visible) continue;
    const count = Math.ceil(layer.points.length * percentage);
    for (let index = 0; index < count; index++) {
      const point = layer.points[index];
      const [screenX, screenY, depth] = project((point[0] - bounds.east) / bounds.span,
        (point[1] - bounds.north) / bounds.span, layer.depth);
      if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
        hits.push({screenX, screenY, depth, point, layer, brightness:1 - index / Math.max(1, count - 1)});
      }
    }
  }
  hits.sort((first, second) => first.depth - second.depth);
  for (const hit of hits) {
    context.fillStyle = `hsla(${hit.layer.hue} 90% ${50 + 30 * hit.brightness}% / ${.2 + .7 * hit.brightness})`;
    const size = 1.5 + 1.7 * hit.brightness;
    context.fillRect(hit.screenX - size / 2, hit.screenY - size / 2, size, size);
  }
  context.fillStyle = '#a2acc6';
  context.font = '12px system-ui';
  context.fillText('East / North / log wavelength', 16, 24);
  if (!hits.length) context.fillText('No samples in view. Enable layers or reset the view.', 16, 48);
}

function scheduleDraw() {
  if (!frame) frame = requestAnimationFrame(draw);
}

function resetView() {
  yaw = -.56;
  pitch = .39;
  zoom = 1;
  scheduleDraw();
}

function changeZoom(multiplier) {
  zoom = Math.max(.25, Math.min(12, zoom * multiplier));
  scheduleDraw();
}

function inspect(event) {
  const {left, top} = canvas.getBoundingClientRect();
  let distance = 8;
  let best;
  for (let index = hits.length - 1; index >= 0; index--) {
    const hit = hits[index];
    const delta = Math.hypot(hit.screenX - event.clientX + left, hit.screenY - event.clientY + top);
    if (delta < distance) {
      best = hit;
      distance = delta;
    }
  }
  if (!best) return;
  const {layer, point:[east, north, intensity]} = best;
  byId('sample-info').textContent = `${layer.observatory} · ${layer.source} · ${format(layer.wavelength_um)} μm · ` +
    `East ${format(east)}″ · North ${format(north)}″ · Intensity ${format(intensity)} ${layer.unit || '(unit unavailable)'}`;
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || drag) return;
  canvas.setPointerCapture(event.pointerId);
  drag = {id:event.pointerId, x:event.clientX, y:event.clientY, startX:event.clientX, startY:event.clientY, moved:false};
});
canvas.addEventListener('pointermove', (event) => {
  if (drag?.id !== event.pointerId) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
  yaw += (event.clientX - drag.x) * .009;
  pitch += (event.clientY - drag.y) * .009;
  Object.assign(drag, {x:event.clientX, y:event.clientY, moved:true});
  scheduleDraw();
});
canvas.addEventListener('pointerup', (event) => {
  if (drag?.id !== event.pointerId) return;
  if (!drag.moved) inspect(event);
  drag = null;
});
canvas.addEventListener('lostpointercapture', (event) => {
  if (drag?.id === event.pointerId) drag = null;
});
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  changeZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
}, {passive:false});
canvas.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowLeft': yaw -= .12; break;
    case 'ArrowRight': yaw += .12; break;
    case 'ArrowUp': pitch -= .12; break;
    case 'ArrowDown': pitch += .12; break;
    case '+': case '=': changeZoom(1.16); break;
    case '-': changeZoom(1 / 1.16); break;
    case 'Home': resetView(); break;
    default: return;
  }
  event.preventDefault();
  scheduleDraw();
});

byId('reset-view').addEventListener('click', resetView);
byId('show-all-layers').addEventListener('click', () => {
  for (const layer of model) layer.visible = true;
  for (const toggle of layerList.querySelectorAll('input')) toggle.checked = true;
  scheduleDraw();
});
contrast.addEventListener('input', () => {
  byId('contrast-value').textContent = `${contrast.value}%`;
  scheduleDraw();
});
byId('demo').addEventListener('click', () => {
  importRequest++;
  fileInput.value = '';
  loadModel(demoModel());
});
fileInput.addEventListener('change', async () => {
  const request = ++importRequest;
  const [file] = fileInput.files;
  if (!file) return;
  try {
    if (file.size > 12 * 1024 ** 2) throw new Error('Choose a JSON model smaller than 12 MiB.');
    const data = JSON.parse(await file.text());
    if (request === importRequest) loadModel(data);
  } catch (error) {
    if (request === importRequest) status.textContent = `Could not open model. ${error.message}`;
  } finally {
    if (request === importRequest) fileInput.value = '';
  }
});

loadModel(demoModel());
new ResizeObserver(scheduleDraw).observe(canvas);
