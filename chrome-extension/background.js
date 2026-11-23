// background.js — Service Worker (Manifest V3)
// Fetches images to bypass CORS restrictions in content scripts.
// Content scripts cannot fetch cross-origin images, so we proxy through here.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // ── FETCH_IMAGE ──────────────────────────────────────────────────────
  // Fetch a remote image URL and return it as a base64 data URL.
  // The content script can then use it to create a File/Blob for paste.
  if (msg.type === 'FETCH_IMAGE') {
    const { url } = msg;
    if (!url || typeof url !== 'string') {
      sendResponse({ ok: false, error: 'Invalid URL' });
      return false;
    }

    fetch(url, {
      method: 'GET',
      // No credentials needed for public Supabase storage URLs
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
        return r.blob();
      })
      .then((blob) => {
        const mimeType = blob.type || 'image/jpeg';
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ ok: true, dataUrl: reader.result, mimeType });
        };
        reader.onerror = () => {
          sendResponse({ ok: false, error: 'FileReader error' });
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });

    return true; // Keep the message channel open for async response
  }
});
