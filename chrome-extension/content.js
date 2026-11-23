// content.js — Laplap Cần Thơ · Gửi Sản Phẩm
// Injected into: chat.zalo.me | messenger.com | facebook.com | business.facebook.com
//
// Flow:
//   1. Inject FAB button (fixed, bottom-right)
//   2. Click FAB → open product picker panel
//   3. User searches & selects a product
//   4. background.js fetches image → blob → dataUrl
//   5. content.js dispatches fake ClipboardEvent('paste') with the image
//   6. Fallback: Clipboard API (copy PNG) → toast "Ctrl+V để dán"
//   7. document.execCommand('insertText') inserts the caption

(function () {
  'use strict';

  // ── Guard against double injection ──────────────────────────────────
  if (window.__ll_ext_v1) return;
  window.__ll_ext_v1 = true;

  // ── Constants ────────────────────────────────────────────────────────
  const API       = 'https://laplapcantho.store/api/public/products';
  const STORE_URL = 'https://laplapcantho.store/san-pham';
  const PAGE_SIZE = 10;

  /**
   * Selectors for chat input boxes, ordered from most-specific to generic.
   * We track whichever one the user last focused.
   */
  const INPUT_SELECTORS = [
    '[contenteditable="true"][role="textbox"]',           // FB Messenger, Business (Lexical)
    '[contenteditable="true"][data-lexical-editor]',       // Lexical explicit attr
    '[contenteditable="true"].public-DraftEditor-content', // Draft.js (old FB)
    '[contenteditable="true"]',                            // Zalo Web + generic
  ];

  // ── State ────────────────────────────────────────────────────────────
  let lastInput    = null; // Last focused chat input element
  let panelVisible = false;
  let currentPage  = 1;
  let currentQuery = '';
  let isLoading    = false;
  let totalPages   = 1;
  let debounceTimer = null;
  let toastTimer    = null;

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 1 — Utilities
  // ══════════════════════════════════════════════════════════════════════

  function formatPrice(n) {
    if (!n || n === 0) return 'Liên hệ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(n);
  }

  function formatCaption(p) {
    const lines = [`📦 ${p.name}`];

    if (p.price) lines.push(`💰 ${formatPrice(p.price)}`);

    // Key specs (limit to avoid walls of text)
    if (p.specs && typeof p.specs === 'object') {
      const specKeys = [
        ['cpu',     '⚡ CPU'],
        ['ram',     '🧠 RAM'],
        ['ssd',     '💾 SSD'],
        ['storage', '💾 Lưu trữ'],
        ['gpu',     '🎮 GPU'],
        ['display', '🖥️ Màn hình'],
        ['battery', '🔋 Pin'],
      ];
      let count = 0;
      for (const [key, label] of specKeys) {
        if (p.specs[key] && count < 4) {
          lines.push(`${label}: ${p.specs[key]}`);
          count++;
        }
      }
    }

    lines.push(`🔗 ${STORE_URL}/${p.slug || p.id}`);
    if (p.inStock === false) lines.push('⚠️ Hiện tại đang hết hàng');

    return lines.join('\n');
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 2 — Toast
  // ══════════════════════════════════════════════════════════════════════

  function showToast(msg, duration = 3000) {
    let toast = document.getElementById('ll-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'll-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'll-toast-show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = ''; }, duration);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 3 — Chat input tracking
  // ══════════════════════════════════════════════════════════════════════

  function findChatInput() {
    for (const sel of INPUT_SELECTORS) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (isVisible(el)) return el;
        }
      } catch (_) { /* ignore */ }
    }
    return null;
  }

  function trackInputFocus() {
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (!el || !el.isContentEditable) return;
      // Heuristic: chat inputs are small (< 300px tall), post composers are taller
      const r = el.getBoundingClientRect();
      if (r.height < 300) lastInput = el;
    }, true);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 4 — API
  // ══════════════════════════════════════════════════════════════════════

  async function fetchProducts(query, page = 1) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
    if (query && query.trim()) params.set('q', query.trim());

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`${API}?${params}`, { signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`API trả về lỗi ${res.status}`);
      return res.json();
    } catch (err) {
      clearTimeout(tid);
      throw err;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 5 — Image fetch (via background service worker)
  // ══════════════════════════════════════════════════════════════════════

  function fetchImageAsDataUrl(url) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'FETCH_IMAGE', url }, (resp) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (resp?.ok) {
          resolve({ dataUrl: resp.dataUrl, mimeType: resp.mimeType || 'image/jpeg' });
        } else {
          reject(new Error(resp?.error || 'Không tải được ảnh'));
        }
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 6 — Image paste
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Convert any image blob to PNG (required for Clipboard API).
   * Uses an off-screen canvas.
   */
  function convertToPng(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img  = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (pngBlob) => {
            URL.revokeObjectURL(url);
            if (pngBlob) resolve(pngBlob);
            else reject(new Error('Canvas toBlob failed'));
          },
          'image/png',
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  }

  /**
   * Try to paste an image into the chat input.
   *
   * Strategy (as per user spec):
   *   1. Fake ClipboardEvent('paste') with DataTransfer — no Ctrl+V needed
   *      isTrusted = false, so some editors may ignore it. Test per platform.
   *   2. Clipboard API fallback — copy PNG to system clipboard, show toast.
   *   3. Silent fail — just insert caption text, no image.
   *
   * @returns {Promise<boolean>} true if fake-paste likely worked, false otherwise.
   */
  async function pasteImageToChat(inputEl, dataUrl, mimeType) {
    // ── Method 1: Fake paste event ───────────────────────────────────
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'product.jpg', { type: mimeType });
      const dt   = new DataTransfer();
      dt.items.add(file);

      inputEl.focus();
      const ev = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles:    true,
        cancelable: true,
      });
      inputEl.dispatchEvent(ev);

      // Give the editor a moment to process the paste event
      await new Promise((r) => setTimeout(r, 400));

      // We cannot reliably confirm it worked (isTrusted = false may be ignored),
      // so we return true optimistically and let the toast inform the user.
      return true;
    } catch (err) {
      console.warn('[Laplap] Method 1 (fake paste) failed:', err);
    }

    // ── Method 2: Clipboard API fallback ─────────────────────────────
    try {
      const blob    = await (await fetch(dataUrl)).blob();
      const pngBlob = await convertToPng(blob);
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob }),
      ]);
      showToast('📋 Ảnh đã copy → nhấn Ctrl+V để dán vào chat!', 6000);
      return false;
    } catch (err) {
      console.warn('[Laplap] Method 2 (Clipboard API) failed:', err);
    }

    // ── Method 3: Silent fail ─────────────────────────────────────────
    console.warn('[Laplap] Could not paste image, caption-only fallback.');
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 7 — Caption insertion
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Insert caption text into the chat input.
   * Uses execCommand('insertText') first — this is the most reliable way to
   * trigger onChange in React/Vue/Lexical/Draft.js editors.
   * Falls back to DOM manipulation + synthetic events.
   */
  async function insertCaption(inputEl, caption) {
    inputEl.focus();
    await new Promise((r) => setTimeout(r, 120));

    // Primary: execCommand (deprecated but still works in all major browsers)
    const ok = document.execCommand('insertText', false, caption);

    if (!ok) {
      // Fallback: inject via Selection API
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range    = sel.getRangeAt(0);
        const textNode = document.createTextNode(caption);
        range.deleteContents();
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        // Last resort: set textContent
        inputEl.textContent = caption;
      }
      // Fire events so framework picks up the change
      inputEl.dispatchEvent(new Event('input',  { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 8 — Product selection handler
  // ══════════════════════════════════════════════════════════════════════

  async function onSelectProduct(product) {
    hidePanel();

    const input = lastInput || findChatInput();
    if (!input) {
      showToast('⚠️ Hãy click vào ô chat trước rồi thử lại!', 4000);
      return;
    }

    const caption = formatCaption(product);

    if (product.image) {
      showToast('⏳ Đang tải ảnh sản phẩm…', 12000);
      try {
        const { dataUrl, mimeType } = await fetchImageAsDataUrl(product.image);
        const pasted = await pasteImageToChat(input, dataUrl, mimeType);

        // Insert caption: add leading newline if image was pasted first
        await insertCaption(input, (pasted ? '\n' : '') + caption);

        if (pasted) showToast('✅ Đã gửi ảnh và thông tin sản phẩm!', 3000);
        // else: toast was already shown by pasteImageToChat (Clipboard API msg)

      } catch (err) {
        // Image fetch failed — still send caption
        console.warn('[Laplap] Image error, caption-only:', err);
        await insertCaption(input, caption);
        showToast('✅ Đã điền thông tin sản phẩm (không có ảnh)', 3000);
      }
    } else {
      // No image — just insert caption
      await insertCaption(input, caption);
      showToast('✅ Đã điền thông tin sản phẩm!', 2500);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 9 — Panel UI
  // ══════════════════════════════════════════════════════════════════════

  function buildPanel() {
    const existing = document.getElementById('ll-panel');
    if (existing) return existing;

    const panel = document.createElement('div');
    panel.id = 'll-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Danh sách sản phẩm Laplap');

    panel.innerHTML = `
      <!-- Header -->
      <div class="ll-header">
        <div class="ll-brand">
          <svg class="ll-brand-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="6" width="20" height="14" rx="2.5" stroke="#FF7043" stroke-width="1.8"/>
            <path d="M8 6V4.5A2.5 2.5 0 0 1 10.5 2h3A2.5 2.5 0 0 1 16 4.5V6" stroke="#FF7043" stroke-width="1.8"/>
            <path d="M12 11.5v3M10.5 13h3" stroke="#FF7043" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>Laplap Cần Thơ</span>
        </div>
        <button id="ll-close-btn" class="ll-icon-btn" aria-label="Đóng">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Search -->
      <div class="ll-search-row">
        <svg class="ll-search-ico" viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.8"/>
          <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <input
          id="ll-search-input"
          class="ll-search-input"
          type="text"
          placeholder="Tìm sản phẩm…"
          spellcheck="false"
          autocomplete="off"
          aria-label="Tìm sản phẩm"
        />
        <button id="ll-clear-btn" class="ll-icon-btn ll-clear-btn" aria-label="Xóa tìm kiếm" style="display:none">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Product list -->
      <div id="ll-list" class="ll-list" role="list"></div>

      <!-- Load more -->
      <div id="ll-footer" class="ll-footer" style="display:none">
        <button id="ll-more-btn" class="ll-more-btn">Xem thêm sản phẩm</button>
      </div>
    `;

    document.body.appendChild(panel);
    _attachPanelEvents(panel);
    return panel;
  }

  function _attachPanelEvents(panel) {
    // Close
    document.getElementById('ll-close-btn').addEventListener('click', hidePanel);

    // Search with debounce
    const searchEl = document.getElementById('ll-search-input');
    const clearEl  = document.getElementById('ll-clear-btn');

    searchEl.addEventListener('input', (e) => {
      const q = e.target.value;
      clearEl.style.display = q ? 'flex' : 'none';
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentQuery = q;
        currentPage  = 1;
        doLoadProducts(true);
      }, 300);
    });

    clearEl.addEventListener('click', () => {
      searchEl.value = '';
      clearEl.style.display = 'none';
      currentQuery = '';
      currentPage  = 1;
      doLoadProducts(true);
    });

    // Load more
    document.getElementById('ll-more-btn').addEventListener('click', () => {
      currentPage++;
      doLoadProducts(false);
    });

    // Prevent host-page click handlers from closing the panel
    panel.addEventListener('click',     (e) => e.stopPropagation());
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 10 — Product loading & rendering
  // ══════════════════════════════════════════════════════════════════════

  async function doLoadProducts(reset) {
    if (isLoading) return;
    isLoading = true;

    const listEl   = document.getElementById('ll-list');
    const footerEl = document.getElementById('ll-footer');
    const moreBtnEl = document.getElementById('ll-more-btn');

    if (reset) {
      listEl.innerHTML = `
        <div class="ll-state" role="status" aria-live="polite">
          <div class="ll-spinner" aria-hidden="true"></div>
          <p>Đang tải sản phẩm…</p>
        </div>`;
    } else {
      if (moreBtnEl) moreBtnEl.textContent = 'Đang tải…';
    }

    try {
      const data  = await fetchProducts(currentQuery, currentPage);
      const items = Array.isArray(data.items) ? data.items : [];
      totalPages  = data.totalPages || 1;

      if (reset) {
        listEl.innerHTML = '';
        if (items.length === 0) {
          listEl.innerHTML = `
            <div class="ll-state ll-empty" role="status">
              <svg viewBox="0 0 24 24" fill="none" width="38" height="38" aria-hidden="true">
                <circle cx="11" cy="11" r="8" stroke="#3a3a4a" stroke-width="1.5"/>
                <path d="m21 21-4.35-4.35" stroke="#3a3a4a" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M8 11h6" stroke="#3a3a4a" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <p>Không tìm thấy sản phẩm nào</p>
              <small>Thử từ khóa khác</small>
            </div>`;
        }
      }

      _appendProductCards(items, listEl);

      // Show/hide load more
      if (currentPage < totalPages) {
        footerEl.style.display = 'flex';
        if (moreBtnEl) moreBtnEl.textContent = 'Xem thêm sản phẩm';
      } else {
        footerEl.style.display = 'none';
      }

    } catch (err) {
      console.error('[Laplap]', err);
      if (reset) {
        listEl.innerHTML = `
          <div class="ll-state ll-error" role="alert">
            <svg viewBox="0 0 24 24" fill="none" width="38" height="38" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="#c0392b" stroke-width="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>Lỗi tải dữ liệu</p>
            <small>${escHtml(err.message)}</small>
            <button id="ll-retry" class="ll-retry-btn">Thử lại</button>
          </div>`;
        document.getElementById('ll-retry')
          ?.addEventListener('click', () => doLoadProducts(true));
      }
    }

    isLoading = false;
  }

  function _appendProductCards(items, container) {
    for (const p of items) {
      const card = document.createElement('div');
      card.className = 'll-card' + (p.inStock === false ? ' ll-oos' : '');
      card.setAttribute('role', 'listitem');

      const hasImg = !!p.image;
      const badgeHtml = p.inStock === false
        ? '<span class="ll-badge ll-badge-oos">Hết hàng</span>'
        : (p.isNew ? '<span class="ll-badge ll-badge-new">Mới</span>' : '');

      const specHtml = p.specs?.cpu
        ? `<div class="ll-spec">${escHtml(p.specs.cpu)}</div>`
        : (p.specs?.ram ? `<div class="ll-spec">${escHtml(p.specs.ram)}</div>` : '');

      card.innerHTML = `
        <div class="ll-thumb">
          ${hasImg
            ? `<img src="${escHtml(p.image)}" alt="" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />`
            : ''}
          <div class="ll-no-img" ${hasImg ? 'style="display:none"' : ''} aria-hidden="true">📷</div>
          ${badgeHtml}
        </div>
        <div class="ll-info">
          <div class="ll-name">${escHtml(p.name)}</div>
          <div class="ll-price">${formatPrice(p.price)}</div>
          ${specHtml}
        </div>
        <button class="ll-pick-btn" aria-label="Gửi sản phẩm ${escHtml(p.name)}">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true">
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Gửi
        </button>
      `;

      card.querySelector('.ll-pick-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectProduct(p);
      });

      container.appendChild(card);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 11 — Panel show / hide
  // ══════════════════════════════════════════════════════════════════════

  function showPanel() {
    const panel = buildPanel();
    // Trigger transition on next frame
    requestAnimationFrame(() => panel.classList.add('ll-open'));
    panelVisible = true;

    // Load products if list is empty
    const listEl = document.getElementById('ll-list');
    if (!listEl || !listEl.hasChildNodes()) {
      doLoadProducts(true);
    }

    // Auto-focus search
    setTimeout(() => document.getElementById('ll-search-input')?.focus(), 160);
  }

  function hidePanel() {
    document.getElementById('ll-panel')?.classList.remove('ll-open');
    panelVisible = false;
  }

  function togglePanel() {
    if (panelVisible) hidePanel(); else showPanel();
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 12 — FAB (Floating Action Button)
  // ══════════════════════════════════════════════════════════════════════

  function buildFAB() {
    if (document.getElementById('ll-fab')) return;

    const fab = document.createElement('button');
    fab.id = 'll-fab';
    fab.setAttribute('aria-label', 'Mở danh sách sản phẩm Laplap (Ctrl+Shift+P)');
    fab.title = 'Laplap – Gửi Sản Phẩm  •  Ctrl+Shift+P';
    fab.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" width="22" height="22" aria-hidden="true">
        <rect x="2" y="6" width="20" height="14" rx="2.5" stroke="white" stroke-width="1.8"/>
        <path d="M8 6V4.5A2.5 2.5 0 0 1 10.5 2h3A2.5 2.5 0 0 1 16 4.5V6"
              stroke="white" stroke-width="1.8"/>
        <path d="M12 11.5v3M10.5 13h3"
              stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;

    fab.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      togglePanel();
    });

    document.body.appendChild(fab);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 13 — Global event listeners
  // ══════════════════════════════════════════════════════════════════════

  // Keyboard shortcut: Ctrl+Shift+P to toggle panel; Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
      e.preventDefault();
      togglePanel();
    }
    if (e.key === 'Escape' && panelVisible) {
      hidePanel();
    }
  });

  // Click outside panel + FAB to close
  document.addEventListener('click', (e) => {
    if (!panelVisible) return;
    if (!e.target.closest('#ll-panel') && !e.target.closest('#ll-fab')) {
      hidePanel();
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 14 — SPA navigation detection
  // ══════════════════════════════════════════════════════════════════════

  let _prevUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== _prevUrl) {
      _prevUrl = location.href;
      hidePanel();
      // Re-detect chat input after the new page renders
      setTimeout(() => { lastInput = findChatInput(); }, 1500);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 15 — Init
  // ══════════════════════════════════════════════════════════════════════

  function init() {
    buildFAB();
    trackInputFocus();
    lastInput = findChatInput();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
