/**
 * @module ui/markdown
 * Fichas de la Biblioteca: un Markdown sencillo convertido en HTML seguro para
 * leer en el móvil (todo el texto se escapa; solo se generan las etiquetas de
 * abajo y enlaces http(s), mailto: y tel:).
 *
 *   # / ## / ###  títulos          - o *  lista (dos espacios: sublista)
 *   1.  lista numerada            > aviso destacado
 *   | a | b |  tabla (la 1.ª fila es la cabecera; |---| se ignora)
 *   ---  separador                **negrita**  *cursiva*  `código`
 *   [texto](https://… | mailto:… | tel:…)   correos sueltos → enlace
 */

import { esc } from './utils.js';

const SAFE_URL = /^(https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|tel:\+?[\d\s.-]+)$/i;

/** Inline marks on an already escaped line. */
function inline(text) {
  let s = esc(text);
  // [label](url): only safe schemes; the url was escaped with the rest
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const raw = url.replaceAll('&amp;', '&');
    if (!SAFE_URL.test(raw)) return label;
    const ext = /^https?:/i.test(raw);
    return `<a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
  // bare e-mail addresses (not already inside a link)
  s = s.replace(/(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?=$|[\s),.;:])/g, '$1<a href="mailto:$2">$2</a>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=$|[\s).,;:])/g, '$1<em>$2</em>');
  return s;
}

const cells = row => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

/**
 * @param {string} md
 * @returns {string} HTML
 */
export function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null;          // {type: 'ul'|'ol', items: [{html, sub: []}]}
  let table = null;         // rows
  let quote = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map(i => `<li>${i.html}${i.sub.length ? `<ul>${i.sub.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  const flushTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    out.push(`<div class="md-table"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    table = null;
  };
  const flushQuote = () => { if (quote.length) { out.push(`<div class="md-note">${quote.map(inline).join('<br>')}</div>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushTable(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushAll(); continue; }
    let m;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
      flushAll();
      const level = m[1].length + 2; // h3–h5 inside a sheet
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara(); flushList(); flushQuote();
      if (/^[\s|:-]+$/.test(line)) continue; // |---|---| separator
      (table ||= []).push(cells(line));
      continue;
    }
    if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); flushList(); flushTable(); quote.push(m[1]); continue; }
    if ((m = /^(\s*)([-*]|\d+[.)])\s+(.*)$/.exec(line))) {
      flushPara(); flushTable(); flushQuote();
      const type = /\d/.test(m[2]) ? 'ol' : 'ul';
      const nested = m[1].length >= 2;
      if (nested && list?.items.length) { list.items[list.items.length - 1].sub.push(inline(m[3])); continue; }
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push({ html: inline(m[3]), sub: [] });
      continue;
    }
    flushList(); flushTable(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}
