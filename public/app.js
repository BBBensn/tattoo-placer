import * as db from './db.js';
import { initScene, loadBodyMesh, buildDecalMesh, createTexture, raycastBody } from './scene.js';

const state = {
  images: [],        // { id, blob, name, url }
  decals: [],        // { spec, mesh, texture }
  selectedId: null,
  activeImageId: null,
  placing: false,    // next body click repositions selected decal
  bodyMesh: null,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
};

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const canvas = document.getElementById('canvas');
  const { scene, camera, renderer, controls } = initScene(canvas);
  Object.assign(state, { scene, camera, renderer, controls });

  setStatus('Loading body mesh…');
  state.bodyMesh = await loadBodyMesh(scene);

  const saved = await db.listImages();
  for (const img of saved) {
    state.images.push({ id: img.id, blob: img.blob, name: img.name, url: URL.createObjectURL(img.blob) });
  }

  renderImageGrid();
  renderDecalList();
  renderTransformPanel();
  await renderCompList();
  setupEvents(canvas);
  setStatus('Click body to place · right-click image to remove');
}

// ── Events ───────────────────────────────────────────────────────────────────

function setupEvents(canvas) {
  const dropZone = document.getElementById('drop-zone');

  ['dragover', 'dragenter'].forEach(ev => {
    canvas.addEventListener(ev, e => e.preventDefault());
    dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('over'); });
  });
  ['dragleave', 'dragend'].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.remove('over')));

  canvas.addEventListener('drop', e => { e.preventDefault(); handleFiles(e.dataTransfer.files); });
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('over'); handleFiles(e.dataTransfer.files); });

  document.addEventListener('paste', e => {
    const items = [...e.clipboardData.items].filter(i => i.type.startsWith('image/'));
    if (items.length) handleBlob(items[0].getAsFile(), 'pasted-image.png');
  });

  let pointerMoved = false;
  canvas.addEventListener('pointerdown', () => { pointerMoved = false; });
  canvas.addEventListener('pointermove', () => { pointerMoved = true; });
  canvas.addEventListener('pointerup', e => { if (!pointerMoved) onCanvasClick(e); });

  const sizeSlider = document.getElementById('size-slider');
  const rotSlider = document.getElementById('rot-slider');
  sizeSlider.addEventListener('input', () => {
    document.getElementById('size-val').value = parseFloat(sizeSlider.value).toFixed(2) + 'm';
    const d = getSelected(); if (!d) return;
    d.spec.size = parseFloat(sizeSlider.value);
    rebuildDecal(d);
  });
  rotSlider.addEventListener('input', () => {
    const deg = Math.round((parseFloat(rotSlider.value) * 180) / Math.PI);
    document.getElementById('rot-val').value = deg + '°';
    const d = getSelected(); if (!d) return;
    d.spec.rotation = parseFloat(rotSlider.value);
    rebuildDecal(d);
  });

  document.getElementById('reposition-btn').addEventListener('click', toggleRepositionMode);
  document.getElementById('delete-decal-btn').addEventListener('click', deleteSelected);
  document.getElementById('save-comp-btn').addEventListener('click', saveComposition);
  document.getElementById('screenshot-btn').addEventListener('click', takeScreenshot);
  document.getElementById('export-json-btn').addEventListener('click', exportJSON);
  document.getElementById('import-json-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', e => { importJSON(e.target.files[0]); e.target.value = ''; });
}

function onCanvasClick(event) {
  if (!state.bodyMesh) return;
  const hit = raycastBody(event, state.camera, state.renderer, state.bodyMesh);
  if (!hit) return;

  const worldNormal = hit.face.normal.clone().transformDirection(state.bodyMesh.matrixWorld);

  if (state.placing && state.selectedId) {
    const d = getSelected();
    if (d) {
      d.spec.position = hit.point.toArray();
      d.spec.normal = worldNormal.toArray();
      rebuildDecal(d);
    }
    exitRepositionMode();
    return;
  }

  if (state.activeImageId) {
    placeDecal(hit.point, worldNormal);
  }
}

// ── Decal operations ─────────────────────────────────────────────────────────

function placeDecal(point, normal) {
  const img = state.images.find(i => i.id === state.activeImageId);
  if (!img) return;

  const spec = {
    id: crypto.randomUUID(),
    imageId: state.activeImageId,
    position: point.toArray(),
    normal: normal.toArray(),
    size: parseFloat(document.getElementById('size-slider').value),
    rotation: parseFloat(document.getElementById('rot-slider').value),
  };

  const texture = createTexture(img.url);
  const mesh = buildDecalMesh(state.bodyMesh, spec, texture);
  state.scene.add(mesh);
  state.decals.push({ spec, mesh, texture });
  selectDecal(spec.id);
  renderDecalList();
}

function rebuildDecal(d) {
  state.scene.remove(d.mesh);
  d.mesh.geometry.dispose();
  d.mesh.material.dispose();
  d.mesh = buildDecalMesh(state.bodyMesh, d.spec, d.texture);
  state.scene.add(d.mesh);
}

function removeDecalEntry(d) {
  state.scene.remove(d.mesh);
  d.mesh.geometry.dispose();
  d.mesh.material.dispose();
  d.texture.dispose();
}

function deleteSelected() {
  const d = getSelected();
  if (!d) return;
  removeDecalEntry(d);
  state.decals = state.decals.filter(x => x.spec.id !== state.selectedId);
  state.selectedId = null;
  renderDecalList();
  renderTransformPanel();
}

function selectDecal(id) {
  state.selectedId = id;
  const d = getSelected();
  if (d) {
    const sizeSlider = document.getElementById('size-slider');
    const rotSlider = document.getElementById('rot-slider');
    sizeSlider.value = d.spec.size;
    rotSlider.value = d.spec.rotation;
    document.getElementById('size-val').value = parseFloat(d.spec.size).toFixed(2) + 'm';
    const deg = Math.round((d.spec.rotation * 180) / Math.PI);
    document.getElementById('rot-val').value = deg + '°';
  }
  renderDecalList();
  renderTransformPanel();
}

function getSelected() {
  return state.decals.find(d => d.spec.id === state.selectedId) || null;
}

// ── Reposition mode ───────────────────────────────────────────────────────────

function toggleRepositionMode() {
  if (state.placing) { exitRepositionMode(); return; }
  state.placing = true;
  state.controls.enabled = false;
  document.getElementById('reposition-btn').textContent = 'Click body…';
  document.getElementById('reposition-btn').classList.add('active-mode');
  setStatus('Click on body to reposition selected decal');
}

function exitRepositionMode() {
  state.placing = false;
  state.controls.enabled = true;
  document.getElementById('reposition-btn').textContent = 'Reposition';
  document.getElementById('reposition-btn').classList.remove('active-mode');
  setStatus('Click body to place · right-click image to remove');
}

// ── Image handling ────────────────────────────────────────────────────────────

async function handleFiles(files) {
  for (const file of files) {
    if (file.type.startsWith('image/')) await handleBlob(file, file.name);
  }
}

async function handleBlob(blob, name) {
  const id = crypto.randomUUID();
  await db.saveImage(id, blob, name);
  const url = URL.createObjectURL(blob);
  state.images.push({ id, blob, name, url });
  state.activeImageId = id;
  renderImageGrid();
  setStatus(`Image loaded: ${name}`);
}

// ── Render UI ─────────────────────────────────────────────────────────────────

function renderImageGrid() {
  const grid = document.getElementById('image-grid');
  grid.innerHTML = '';
  if (state.images.length === 0) {
    grid.innerHTML = '<p class="empty">No images yet</p>';
    return;
  }
  for (const img of state.images) {
    const el = document.createElement('div');
    el.className = 'img-thumb' + (img.id === state.activeImageId ? ' active' : '');
    el.style.backgroundImage = `url(${img.url})`;
    el.title = img.name;
    el.addEventListener('click', () => { state.activeImageId = img.id; renderImageGrid(); });
    el.addEventListener('contextmenu', async e => {
      e.preventDefault();
      if (!confirm(`Delete "${img.name}"?`)) return;
      await db.deleteImage(img.id);
      URL.revokeObjectURL(img.url);
      const victims = state.decals.filter(d => d.spec.imageId === img.id);
      victims.forEach(removeDecalEntry);
      state.decals = state.decals.filter(d => d.spec.imageId !== img.id);
      state.images = state.images.filter(i => i.id !== img.id);
      if (state.activeImageId === img.id) state.activeImageId = state.images[0]?.id || null;
      if (state.selectedId && !state.decals.find(d => d.spec.id === state.selectedId)) state.selectedId = null;
      renderImageGrid();
      renderDecalList();
      renderTransformPanel();
    });
    grid.appendChild(el);
  }
}

function renderDecalList() {
  const list = document.getElementById('decal-list');
  list.innerHTML = '';
  if (state.decals.length === 0) { list.innerHTML = '<p class="empty">No decals placed</p>'; return; }
  for (const d of state.decals) {
    const img = state.images.find(i => i.id === d.spec.imageId);
    const el = document.createElement('div');
    el.className = 'decal-item' + (d.spec.id === state.selectedId ? ' active' : '');
    el.innerHTML = `
      <div class="thumb" style="background-image:url(${img?.url || ''})"></div>
      <span class="name">${img?.name || 'Unknown'}</span>
    `;
    el.addEventListener('click', () => selectDecal(d.spec.id));
    list.appendChild(el);
  }
}

function renderTransformPanel() {
  document.getElementById('transform-panel').style.display = state.selectedId ? 'block' : 'none';
}

// ── Compositions ──────────────────────────────────────────────────────────────

async function renderCompList() {
  const list = document.getElementById('comp-list');
  const comps = await db.listCompositions();
  list.innerHTML = '';
  if (comps.length === 0) { list.innerHTML = '<p class="empty">No compositions saved</p>'; return; }
  for (const c of comps) {
    const el = document.createElement('div');
    el.className = 'comp-item';
    el.innerHTML = `
      <span class="comp-name">${c.name}</span>
      <div class="comp-actions">
        <button class="load-btn">Load</button>
        <button class="del-btn danger">✕</button>
      </div>
    `;
    el.querySelector('.load-btn').addEventListener('click', () => loadComposition(c.name));
    el.querySelector('.del-btn').addEventListener('click', async () => {
      await db.deleteComposition(c.name);
      renderCompList();
    });
    list.appendChild(el);
  }
}

async function saveComposition() {
  const name = document.getElementById('comp-name').value.trim();
  if (!name) return;
  await db.saveComposition({ schemaVersion: 1, name, decals: state.decals.map(d => ({ ...d.spec })) });
  renderCompList();
  setStatus(`Composition "${name}" saved`);
}

async function loadComposition(name) {
  const comp = await db.getComposition(name);
  if (!comp) return;
  state.decals.forEach(removeDecalEntry);
  state.decals = [];
  state.selectedId = null;
  for (const spec of comp.decals) {
    const img = state.images.find(i => i.id === spec.imageId);
    if (!img) continue;
    const texture = createTexture(img.url);
    const mesh = buildDecalMesh(state.bodyMesh, spec, texture);
    state.scene.add(mesh);
    state.decals.push({ spec: { ...spec }, mesh, texture });
  }
  renderDecalList();
  renderTransformPanel();
  setStatus(`Loaded "${name}"`);
}

// ── Export / Import ───────────────────────────────────────────────────────────

function takeScreenshot() {
  state.renderer.render(state.scene, state.camera);
  const a = Object.assign(document.createElement('a'), {
    href: state.renderer.domElement.toDataURL('image/png'),
    download: 'tattoo-placer.png',
  });
  a.click();
}

async function exportJSON() {
  const images = {};
  for (const img of state.images) {
    images[img.id] = { name: img.name, data: await blobToDataURL(img.blob) };
  }
  const json = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    images,
    decals: state.decals.map(d => ({ ...d.spec })),
  };
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'tattoo-composition.json' }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importJSON(file) {
  if (!file) return;
  let json;
  try { json = JSON.parse(await file.text()); } catch { alert('Invalid JSON file'); return; }
  if (json.schemaVersion !== 1) { alert('Unsupported schema version: ' + json.schemaVersion); return; }

  state.decals.forEach(removeDecalEntry);
  state.decals = [];
  state.selectedId = null;

  const idMap = {};
  for (const [oldId, imgData] of Object.entries(json.images || {})) {
    const existing = state.images.find(i => i.id === oldId);
    if (existing) { idMap[oldId] = oldId; continue; }
    const blob = dataURLToBlob(imgData.data);
    const newId = crypto.randomUUID();
    idMap[oldId] = newId;
    await db.saveImage(newId, blob, imgData.name);
    state.images.push({ id: newId, blob, name: imgData.name, url: URL.createObjectURL(blob) });
  }

  for (const spec of json.decals || []) {
    const newImageId = idMap[spec.imageId];
    const img = newImageId && state.images.find(i => i.id === newImageId);
    if (!img) continue;
    const newSpec = { ...spec, id: crypto.randomUUID(), imageId: newImageId };
    const texture = createTexture(img.url);
    const mesh = buildDecalMesh(state.bodyMesh, newSpec, texture);
    state.scene.add(mesh);
    state.decals.push({ spec: newSpec, mesh, texture });
  }

  renderImageGrid();
  renderDecalList();
  renderTransformPanel();
  setStatus('Composition imported');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataURL) {
  const [header, b64] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function setStatus(msg) {
  document.getElementById('status-bar').textContent = msg;
}

// ── Start ─────────────────────────────────────────────────────────────────────

init().catch(err => {
  console.error(err);
  document.getElementById('status-bar').textContent = 'Error: ' + err.message;
});
