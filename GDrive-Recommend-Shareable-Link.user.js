// ==UserScript==
// @name         GDrive: Recommend shareable link
// @namespace    https://wpnaji.ir
// @version      1.2
// @description  ساخت خودکار لینک پیشنهادی گوگل‌درایو + اعمال فونت وزیرمتن روی صفحات هشدار
// @author       Mohammad Yamini
// @match        https://drive.google.com/*
// @match        https://drive.usercontent.google.com/*
// @run-at       document-start
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @homepageURL  https://github.com/mohammad021/gdrive-recommend-shareable-link
// @supportURL   https://github.com/mohammad021/gdrive-recommend-shareable-link/issues
// @downloadURL  https://raw.githubusercontent.com/mohammad021/gdrive-recommend-shareable-link/main/GDrive-Recommend-Shareable-Link.user.js
// @updateURL    https://raw.githubusercontent.com/mohammad021/gdrive-recommend-shareable-link/main/GDrive-Recommend-Shareable-Link.user.js
// ==/UserScript==

(function () {
  'use strict';

  // اعمال فونت وزیرمتن روی صفحه هشدار
  function shouldApplyVazirmatn() {
    const h = location.host;
    const p = location.pathname;
    return h.endsWith('usercontent.google.com') ||
           (h === 'drive.google.com' && (p.startsWith('/uc') || p.startsWith('/open') || p.startsWith('/file/')));
  }

  function applyVazirmatn() {
    if (!shouldApplyVazirmatn()) return;

    const head = document.head || document.documentElement;
    if (!head) {
      document.addEventListener('DOMContentLoaded', applyVazirmatn, { once: true });
      return;
    }
    if (document.getElementById('tm-vazirmatn-link')) return;

    const pre1 = document.createElement('link');
    pre1.rel = 'preconnect';
    pre1.href = 'https://fonts.googleapis.com';

    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';

    const link = document.createElement('link');
    link.id = 'tm-vazirmatn-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap';

    const style = document.createElement('style');
    style.id = 'tm-vazirmatn-style';
    style.textContent = `
      html, body, .uc-main, #uc-text, .uc-warning-caption, .uc-warning-subcaption, .uc-footer,
      input, button, textarea, select, .jfk-button, .goog-inline-block, #gdrive-suggested-link-box {
        font-family: 'Vazirmatn', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, Tahoma, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
    `;

    head.append(pre1, pre2, link, style);
  }
  applyVazirmatn();

  // ——— Parsers ———
  function parseIdFromUrl(u) {
    try {
      const url = new URL(u);
      const m1 = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (m1) return m1[1];
      const idQ = url.searchParams.get('id');
      if (idQ) return idQ;
      const m2 = url.href.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (m2) return m2[1];
    } catch {}
    return '';
  }

  function parseIdFromText(any) {
    if (!any) return '';
    if (/^[a-zA-Z0-9_-]{10,}$/.test(any.trim())) return any.trim();
    return parseIdFromUrl(any.trim()) || '';
  }

  function getIdFromPage() {
    const inputId = document.querySelector('input[name="id"]');
    if (inputId?.value) return inputId.value.trim();

    const idFromUrl = parseIdFromUrl(location.href);
    if (idFromUrl) return idFromUrl;

    const a = document.querySelector('#uc-text a[href*="id="]');
    if (a) {
      const aid = parseIdFromUrl(a.href);
      if (aid) return aid;
    }
    return '';
  }

  // ——— Builders ———
  function buildLinks(id) {
    const enc = encodeURIComponent(id);
    const file = `https://drive.google.com/file/d/${enc}/view`;
    const uc   = `https://drive.google.com/uc?export=download&id=${enc}`;
    const open = `https://drive.google.com/open?id=${enc}`;
    const recommended = file; // مناسب RapidLeech
    return { id, recommended, file, uc, open };
  }

  // ——— UI ———
  function makeRow(title, value) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = '8px';
    row.style.alignItems = 'center';

    const label = document.createElement('span');
    label.textContent = title;
    label.style.minWidth = '190px';
    label.style.fontWeight = '500';

    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.dir = 'ltr';
    input.value = value || '';
    input.style.flex = '1';
    input.style.minWidth = '320px';
    input.style.padding = '6px 8px';
    input.style.border = '1px solid #dadce0';
    input.style.borderRadius = '6px';
    input.style.background = '#fff';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 کپی';
    copyBtn.className = 'goog-inline-block jfk-button';
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!input.value) return;
      try {
        if (typeof GM_setClipboard === 'function') {
          GM_setClipboard(input.value, 'text');
        } else if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(input.value);
        }
      } catch {}
      const old = copyBtn.textContent;
      copyBtn.textContent = '✅ کپی شد';
      setTimeout(() => (copyBtn.textContent = old), 1200);
    });

    row.append(label, input, copyBtn);
    return row;
  }

  function injectUI(links) {
    if (!links?.id) return;
    if (document.getElementById('gdrive-suggested-link-box')) return;

    const host = document.querySelector('#uc-text') || document.body;

    const box = document.createElement('div');
    box.id = 'gdrive-suggested-link-box';
    box.style.marginTop = '12px';
    box.style.padding = '10px';
    box.style.border = '1px solid #dadce0';
    box.style.borderRadius = '8px';
    box.style.background = '#f8f9fa';
    box.style.display = 'grid';
    box.style.gap = '8px';
    box.style.maxWidth = '820px';
    box.style.marginInline = 'auto';

    const title = document.createElement('div');
    title.textContent = 'لینک‌های اشتراک (بر اساس ID)';
    title.style.fontWeight = '700';

    const note = document.createElement('div');
    note.style.fontSize = '12px';
    note.style.color = '#5f6368';
    note.textContent =
      'پیشنهادی برای RapidLeech: لینک اول (file/d/ID). مطمئن شو فایل روی «Anyone with the link = Viewer» باشد.';

    const r0 = makeRow('ID فایل:', links.id);
    const r1 = makeRow('پیشنهادی (file/d/ID/view):', links.recommended);
    const r2 = makeRow('جایگزین (uc?export=download):', links.uc);
    const r3 = makeRow('جایگزین (open?id=ID):', links.open);

    box.append(title, r0, r1, r2, r3, note);
    host.appendChild(box);
  }

  // ——— Menu Commands ———
  function registerMenus() {
    if (typeof GM_registerMenuCommand !== 'function') return;

    GM_registerMenuCommand('ساخت لینک پیشنهادی از ID/URL…', () => {
      const input = prompt('ID یا لینک گوگل‌درایو را وارد کن:', '');
      if (!input) return;
      const id = parseIdFromText(input);
      if (!id) return alert('ID پیدا نشد. ورودی را بررسی کن.');
      const { recommended, file, uc, open } = buildLinks(id);
      try { GM_setClipboard(recommended, 'text'); } catch {}
      alert(
        'ساخته شد و لینک پیشنهادی کپی شد:\n' +
        `ID: ${id}\n\n` +
        `Recommended (file): ${recommended}\n` +
        `UC: ${uc}\n` +
        `Open: ${open}`
      );
    });

    GM_registerMenuCommand('کپی لینک پیشنهادی از همین صفحه', () => {
      const id = getIdFromPage();
      if (!id) return alert('روی این صفحه نتونستم ID پیدا کنم.');
      const { recommended } = buildLinks(id);
      try { GM_setClipboard(recommended, 'text'); } catch {}
      alert('لینک پیشنهادی کپی شد:\n' + recommended);
    });
  }

  // ——— Boot ———
  function init() {
    registerMenus();
    const id = getIdFromPage();
    if (id) {
      const links = buildLinks(id);
      injectUI(links);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();