/**
 * @module ui/biblioteca
 * Pantalla Biblioteca: manuales operativos, instrucciones, órdenes y enlaces
 * del grupo para consultar desde el móvil (también sin conexión lo ya abierto).
 * El administrador añade y retira documentos (se suben cifrados).
 */

import { Actions } from '../state/store.js';
import {
  CATEGORIES, categoryLabel, filterDocs, topicButtons, fetchIndex, openDoc, isOffline, uploadDoc, addLink, removeDoc, fmtSize, MAX_BYTES,
  readBundle, importBundle
} from '../domain/library.js';
import { formatDMY } from '../domain/rules.js';
import { openSheet, confirmDialog } from './sheet.js';
import { renderMarkdown } from './markdown.js';
import { esc } from './utils.js';
import { emptyStateFor, emptyHTML, bindEmpty } from './emptyStates.js';
import { askGroupPassword } from './onboarding.js';
import { ensureAdminToken } from './pin.js';

let cache = { docs: null, temas: [], at: 0, error: null, offline: false };
// tema: null = topic buttons; '' = «Otros»; key = that topic
let ui = { query: '', tema: null };
let loading = null;

async function load(force = false) {
  if (!force && cache.docs && Date.now() - cache.at < 60000) return cache;
  if (loading) return loading;
  loading = (async () => {
    try {
      const r = await fetchIndex();
      // a missing password or no connection is retried at once next time
      cache = { docs: r.docs || [], temas: r.temas || [], at: r.error || r.offline ? 0 : Date.now(), error: r.error || null, offline: Boolean(r.offline) };
    } catch (err) {
      cache = { docs: cache.docs || [], temas: cache.temas || [], at: 0, error: err.code === 'BAD_PASSWORD' ? 'BAD_PASSWORD' : err.message, offline: false };
    } finally {
      loading = null;
    }
    return cache;
  })();
  return loading;
}

const ICON = { manual: '📘', instruccion: '📋', orden: '📜', formulario: '📝', otro: '📄' };

function itemHTML(d, admin) {
  const ficha = d.tipo === 'ficha';
  const meta = ficha
    ? ['Ficha', d.nota || ''].filter(Boolean).join(' · ')
    : [categoryLabel(d.categoria), d.fecha ? formatDMY(d.fecha.slice(0, 10)) : '', d.tipo === 'enlace' ? 'enlace' : fmtSize(d.tamano)].filter(Boolean).join(' · ');
  return `<li class="lib-item ${ficha ? 'lib-ficha' : ''}">
    <button type="button" class="lib-open" data-doc="${esc(d.id)}">
      <span class="lib-ico" aria-hidden="true">${ficha ? '📑' : d.tipo === 'enlace' ? '🔗' : (ICON[d.categoria] || '📄')}</span>
      <span class="lib-text"><strong>${esc(d.titulo)}</strong><small>${esc(meta)}${d.tipo === 'archivo' ? `<span class="lib-off" data-off="${esc(d.id)}" hidden> · sin conexión ✓</span>` : ''}</small>${!ficha && d.nota ? `<small class="lib-note">${esc(d.nota)}</small>` : ''}</span>
    </button>
    ${admin ? `<button type="button" class="link-btn lib-del" data-del="${esc(d.id)}" aria-label="Retirar ${esc(d.titulo)}">Retirar</button>` : ''}
  </li>`;
}

/**
 * @param {HTMLElement} container
 */
export function renderBiblioteca(container) {
  container.innerHTML = `
    <div class="lib-view">
      <div class="lib-head">
        <h1>Biblioteca</h1>
        <p class="sheet-hint">Fichas prácticas, manuales, instrucciones y órdenes del grupo. Lo que abras queda guardado para consultarlo sin conexión.</p>
        <input type="search" class="lib-search" id="lib-q" placeholder="Buscar en todo…" value="${esc(ui.query)}" aria-label="Buscar en la biblioteca">
      </div>
      <div id="lib-body"><p class="sheet-hint">Cargando…</p></div>
      <div class="lib-admin" id="lib-admin" hidden>
        <button type="button" class="btn btn-primary" id="lib-add">＋ Añadir documento</button>
        <button type="button" class="btn" id="lib-link">＋ Añadir enlace</button>
        <label class="btn" id="lib-pack">⬆ Importar paquete<input type="file" id="lib-pack-file" accept=".json,application/json" hidden></label>
        <p class="sheet-hint muted">Se sube cifrado con la contraseña del grupo: sin ella no se puede leer (ni el título). Aun así, no subas documentos clasificados.</p>
      </div>
    </div>`;

  const body = container.querySelector('#lib-body');
  let admin = false;
  const docsAll = () => cache.docs || [];
  const paint = () => {
    const empty = cache.error ? emptyStateFor('biblioteca', { error: cache.error }) : null;
    if (empty) {
      body.innerHTML = emptyHTML(empty);
    } else {
      const topics = topicButtons(docsAll(), cache.temas);
      const searching = ui.query.trim().length > 0;
      const showTopics = !searching && ui.tema === null && topics.length > 0;
      const offline = cache.offline ? '<p class="sheet-hint">Sin conexión: se muestra lo último que se descargó.</p>' : '';
      if (showTopics) {
        body.innerHTML = `${offline}<div class="lib-temas">${topics.map(t => `
          <button type="button" class="lib-tema" data-tema="${esc(t.key)}"><span class="lib-tema-ico" aria-hidden="true">${esc(t.icono)}</span><span class="lib-tema-name">${esc(t.nombre)}</span><small>${t.n}</small></button>`).join('')}</div>`;
      } else {
        const tema = searching ? null : ui.tema;
        const docs = filterDocs(docsAll(), { query: ui.query, tema, temas: cache.temas });
        const t = topics.find(x => x.key === tema);
        body.innerHTML = `${offline}
          ${!searching && tema !== null ? `<div class="lib-tema-head"><button type="button" class="link-btn" data-back="1">‹ Temas</button><h2>${esc(t?.icono || '')} ${esc(t?.nombre || 'Otros')}</h2></div>` : ''}
          ${docs.length ? `<ul class="lib-list">${docs.map(d => itemHTML(d, admin)).join('')}</ul>`
            : docsAll().length ? '<div class="empty-state"><p>Nada coincide con la búsqueda.</p></div>' : emptyHTML(emptyStateFor('biblioteca', { docs: 0 }))}`;
        for (const d of docs.filter(x => x.tipo === 'archivo')) {
          isOffline(d).then(ok => { const el = body.querySelector(`[data-off="${CSS.escape(d.id)}"]`); if (el) el.hidden = !ok; });
        }
      }
      body.querySelectorAll('[data-tema]').forEach(b => b.addEventListener('click', () => { ui.tema = b.dataset.tema; paint(); window.scrollTo?.(0, 0); }));
      body.querySelector('[data-back]')?.addEventListener('click', () => { ui.tema = null; paint(); });
      body.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => openItem(docsAll().find(d => d.id === b.dataset.doc))));
      body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => retire(docsAll().find(d => d.id === b.dataset.del))));
    }
    bindEmpty(body, {
      password: async () => { if (await askGroupPassword()) { await load(true); paint(); } },
      retry: async () => { body.innerHTML = '<p class="sheet-hint">Cargando…</p>'; await load(true); paint(); }
    });
  };

  container.querySelector('#lib-q').addEventListener('input', e => { ui.query = e.target.value; paint(); });
  // acciones de administrador: el token va cifrado con el PIN y puede hacer falta pedirlo
  container.querySelector('#lib-add').addEventListener('click', async () => { if (await ensureAdminToken()) openUpload(async () => { await load(true); paint(); }); });
  container.querySelector('#lib-link').addEventListener('click', async () => { if (await ensureAdminToken()) openAddLink(async () => { await load(true); paint(); }); });
  container.querySelector('#lib-pack-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) await importPack(f, async () => { await load(true); paint(); });
  });

  import('./flows.js').then(async ({ canPublish }) => {
    admin = await canPublish();
    const el = container.querySelector('#lib-admin');
    if (el) el.hidden = !admin;
    if (cache.docs) paint();
  });
  if (cache.docs) paint();
  load().then(paint);

  async function retire(doc) {
    if (!(await ensureAdminToken())) return;
    if (!doc) return;
    if (!(await confirmDialog({ title: 'Retirar de la biblioteca', message: `«${doc.titulo}» dejará de verse para todos.`, confirmLabel: 'Retirar' }))) return;
    Actions.setBusy('Retirando…');
    try {
      cache.docs = await removeDoc({ doc, docs: docsAll(), temas: cache.temas });
      Actions.showToast('Retirado. Los demás lo dejarán de ver en 1–2 minutos.');
    } catch (err) {
      Actions.showToast('No se pudo retirar el documento.', { level: 'error', detail: err.message });
    } finally {
      Actions.setBusy(null);
      paint();
    }
  }
}

/** Administrator: a package of topics, fichas and documents, encrypted and uploaded. */
async function importPack(file, onDone) {
  if (!(await ensureAdminToken())) return;
  let bundle;
  try {
    bundle = readBundle(await file.text());
  } catch (err) {
    Actions.showToast('Ese archivo no es un paquete válido.', { level: 'error', detail: err.message });
    return;
  }
  const parts = [
    bundle.temas.length ? `${bundle.temas.length} temas` : '',
    bundle.fichas ? `${bundle.fichas} fichas` : '',
    bundle.archivos ? `${bundle.archivos} documentos (${fmtSize(bundle.bytes)})` : '',
    bundle.enlaces ? `${bundle.enlaces} enlaces` : ''
  ].filter(Boolean).join(', ');
  const ok = await confirmDialog({
    title: 'Importar paquete',
    message: `${parts}.\n\nSe cifra todo en este móvil con la contraseña del grupo y se sube. Lo que ya estuviera con la misma clave se sustituye.`,
    confirmLabel: 'Cifrar y subir'
  });
  if (!ok) return;
  Actions.setBusy('Cifrando y subiendo…');
  try {
    const r = await importBundle({
      bundle, docs: cache.docs || [], temas: cache.temas || [],
      onProgress: (n, total, titulo) => Actions.setBusy(`Subiendo documento ${n} de ${total}: ${titulo}`)
    });
    cache.docs = r.docs;
    cache.temas = r.temas;
    Actions.showToast(`Biblioteca actualizada: ${r.added} nuevos${r.replaced ? `, ${r.replaced} sustituidos` : ''}. Tus compañeros lo verán en 1–2 minutos.`, { duration: 9000 });
    await onDone?.();
  } catch (err) {
    Actions.showToast('No se pudo importar el paquete.', { level: 'error', detail: err.message });
  } finally {
    Actions.setBusy(null);
  }
}

/** A ficha: text written for the phone, rendered here. */
function openFicha(doc) {
  openSheet({
    title: doc.titulo,
    // the sheet already shows the title: drop the ficha's own first heading
    body: `<article class="ficha">${renderMarkdown(String(doc.md || '').replace(/^\s*#\s+[^\n]*\n/, ''))}</article>
      ${doc.nota ? `<p class="sheet-hint muted">${esc(doc.nota)}</p>` : ''}`
  });
}

async function openItem(doc) {
  if (!doc) return;
  if (doc.tipo === 'ficha') { openFicha(doc); return; }
  if (doc.tipo === 'enlace') { window.open(doc.url, '_blank', 'noopener'); return; }
  Actions.setBusy('Abriendo…');
  let blob;
  try {
    blob = await openDoc(doc);
  } catch (err) {
    Actions.setBusy(null);
    Actions.showToast('No se pudo abrir el documento.', { level: 'error', detail: err.message });
    return;
  }
  Actions.setBusy(null);
  document.querySelector(`[data-off="${CSS.escape(doc.id)}"]`)?.removeAttribute('hidden');
  const file = new File([blob], doc.nombre || `${doc.titulo}.pdf`, { type: blob.type });
  const isPdf = /pdf/i.test(blob.type) || /\.pdf$/i.test(doc.nombre || '');
  const isImg = /^image\//.test(blob.type);
  const canShare = Boolean(navigator.canShare?.({ files: [file] }));
  openSheet({
    title: doc.titulo,
    body: `
      ${doc.nota ? `<p class="sheet-hint">${esc(doc.nota)}</p>` : ''}
      <div class="doc-view" id="doc-view">${isPdf || isImg ? '<p class="sheet-hint">Preparando…</p>' : `<p class="sheet-hint">${esc(doc.nombre || '')} · ${fmtSize(doc.tamano)}. Este tipo de archivo se abre con otra aplicación.</p>`}</div>`,
    footer: `
      ${canShare ? '<button type="button" class="btn" data-act="share">Compartir / abrir con…</button>' : ''}
      <button type="button" class="btn ${isPdf || isImg ? '' : 'btn-primary'}" data-act="save">Guardar en el móvil</button>`,
    async onMount(root) {
      root.querySelector('[data-act="share"]')?.addEventListener('click', async () => {
        try { await navigator.share({ files: [file], title: doc.titulo }); } catch { /* cancelled */ }
      });
      root.querySelector('[data-act="save"]').addEventListener('click', () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      });
      const view = root.querySelector('#doc-view');
      if (isImg) {
        const reader = new FileReader();
        reader.onload = () => { view.innerHTML = `<img class="doc-img" alt="${esc(doc.titulo)}" src="${reader.result}">`; };
        reader.readAsDataURL(blob);
      } else if (isPdf) {
        try { await renderPdf(view, blob); } catch (err) {
          view.innerHTML = `<p class="sheet-hint">No se pudo mostrar aquí (${esc(err.message)}). Usa «Compartir / abrir con…» o «Guardar».</p>`;
        }
      }
    }
  });
}

/** Draw every page of a PDF into the container (vendored pdf.js, offline). */
async function renderPdf(view, blob) {
  const mod = await import('../../vendor/pdf.min.mjs');
  const pdfjs = mod.default || mod;
  pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  view.innerHTML = `<p class="sheet-hint muted">${pdf.numPages} ${pdf.numPages === 1 ? 'página' : 'páginas'}</p>`;
  const width = Math.max(280, view.clientWidth || 340);
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  for (let n = 1; n <= pdf.numPages; n++) {
    if (!view.isConnected) return; // sheet closed
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (width / base.width) * ratio });
    const canvas = document.createElement('canvas');
    canvas.className = 'doc-page';
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
    view.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  }
}

function categorySelect(id) {
  return `<select id="${id}">${CATEGORIES.map(c => `<option value="${c.key}">${esc(c.label)}</option>`).join('')}</select>`;
}

function temaSelect(id) {
  const temas = [...(cache.temas || [])].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  if (!temas.length) return '';
  return `<label class="field"><span>Tema</span><select id="${id}"><option value="">—</option>${temas.map(t => `<option value="${esc(t.key)}" ${ui.tema === t.key ? 'selected' : ''}>${esc(t.icono)} ${esc(t.nombre)}</option>`).join('')}</select></label>`;
}

function openUpload(onDone) {
  openSheet({
    title: 'Añadir documento',
    body: `
      <label class="field"><span>Archivo (PDF, imagen, Word…; hasta ${Math.round(MAX_BYTES / 1048576)} MB)</span><input type="file" id="up-file" accept=".pdf,image/*,.doc,.docx,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.txt"></label>
      <label class="field"><span>Título</span><input type="text" id="up-title" maxlength="120" placeholder="Ej.: Manual de inspección ocular"></label>
      <label class="field"><span>Categoría</span>${categorySelect('up-cat')}</label>
      ${temaSelect('up-tema')}
      <label class="field"><span>Nota (opcional)</span><input type="text" id="up-note" maxlength="160" placeholder="Ej.: versión de marzo 2026"></label>
      <p class="sheet-hint muted">Se cifra en este móvil antes de subirlo. Tus compañeros lo verán en 1–2 minutos.</p>`,
    footer: `<button type="button" class="btn" data-act="cancel">Cancelar</button><button type="button" class="btn btn-primary" data-act="ok">Subir cifrado</button>`,
    onMount(root, close) {
      const file = root.querySelector('#up-file');
      file.addEventListener('change', () => {
        const f = file.files?.[0];
        const t = root.querySelector('#up-title');
        if (f && !t.value) t.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      });
      root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      root.querySelector('[data-act="ok"]').addEventListener('click', async () => {
        const f = file.files?.[0];
        if (!f) { Actions.showToast('Elige un archivo'); return; }
        Actions.setBusy('Cifrando y subiendo…');
        try {
          cache.docs = await uploadDoc({ file: f, titulo: root.querySelector('#up-title').value, categoria: root.querySelector('#up-cat').value, nota: root.querySelector('#up-note').value, tema: root.querySelector('#up-tema')?.value || '', docs: cache.docs || [], temas: cache.temas || [] });
          close();
          Actions.showToast('Subido y cifrado. Tus compañeros lo verán en 1–2 minutos.');
          await onDone?.();
        } catch (err) {
          Actions.showToast('No se pudo subir el documento.', { level: 'error', detail: err.message });
        } finally {
          Actions.setBusy(null);
        }
      });
    }
  });
}

function openAddLink(onDone) {
  openSheet({
    title: 'Añadir enlace',
    body: `
      <label class="field"><span>Título</span><input type="text" id="ln-title" maxlength="120" placeholder="Ej.: Intranet · Normativa"></label>
      <label class="field"><span>Dirección</span><input type="url" id="ln-url" placeholder="https://…"></label>
      <label class="field"><span>Categoría</span>${categorySelect('ln-cat')}</label>
      ${temaSelect('ln-tema')}
      <label class="field"><span>Nota (opcional)</span><input type="text" id="ln-note" maxlength="160"></label>`,
    footer: `<button type="button" class="btn" data-act="cancel">Cancelar</button><button type="button" class="btn btn-primary" data-act="ok">Añadir</button>`,
    onMount(root, close) {
      root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      root.querySelector('[data-act="ok"]').addEventListener('click', async () => {
        Actions.setBusy('Guardando…');
        try {
          cache.docs = await addLink({ titulo: root.querySelector('#ln-title').value, url: root.querySelector('#ln-url').value, categoria: root.querySelector('#ln-cat').value, nota: root.querySelector('#ln-note').value, tema: root.querySelector('#ln-tema')?.value || '', docs: cache.docs || [], temas: cache.temas || [] });
          close();
          Actions.showToast('Enlace añadido');
          await onDone?.();
        } catch (err) {
          Actions.showToast('No se pudo añadir el enlace.', { level: 'error', detail: err.message });
        } finally {
          Actions.setBusy(null);
        }
      });
    }
  });
}
