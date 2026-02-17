// Magecomp Chat Auto-Translator — Final
console.log('🌐 Chat Translator loaded');

const cache = new Map(); // text key → {translation, detectedLang} | null
let scanning = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanText(msgEl) {
  const clone = msgEl.cloneNode(true);
  clone.querySelectorAll('.mct-translation, .mct-loader').forEach(e => e.remove());
  let t = clone.textContent.trim();
  t = t.replace(/✷/g, '').trim();
  t = t.replace(/Reply\s+Forward\s+Bookmark\s+Delete/gi, '').trim();
  t = t.replace(/\(Renze\)/gi, '').replace(/\(Bas\)/gi, '').trim();
  t = t.replace(/\(Customer Support A\.\)/gi, '').trim();
  t = t.replace(/\(API\)/gi, '').trim();
  return t.trim();
}

function getBody(msgEl) {
  return msgEl.querySelector(
    '.chat__message_received_body, .chat__message_send_body, ' +
    '.chat__message_received_body_button_body, .chat__message_send_body_button_body'
  );
}

// ── Loader ────────────────────────────────────────────────────────────────────

function showLoader(msgEl) {
  const body = getBody(msgEl);
  if (!body) return;
  if (body.querySelector('.mct-translation, .mct-loader')) return; // already has something
  const loader = document.createElement('div');
  loader.className = 'mct-loader';
  loader.innerHTML = '<span class="mct-loader-dot"></span><span class="mct-loader-dot"></span><span class="mct-loader-dot"></span>';
  body.appendChild(loader);
}

function removeLoader(msgEl) {
  const body = getBody(msgEl);
  if (!body) return;
  const loader = body.querySelector('.mct-loader');
  if (loader) loader.remove();
}

// ── Inject translation from cache (synchronous) ───────────────────────────────

function inject(msgEl) {
  const text = cleanText(msgEl);
  if (text.length < 5) return;
  const key = text.substring(0, 120);
  if (!cache.has(key)) return;
  const result = cache.get(key);

  // Always remove loader first
  removeLoader(msgEl);
  if (!result) return; // null = already English, nothing to show

  const body = getBody(msgEl);
  if (!body) return;
  if (body.querySelector('.mct-translation')) return; // already injected

  const div = document.createElement('div');
  div.className = 'mct-translation';

  const badge = document.createElement('span');
  badge.className = 'mct-lang-badge';
  badge.textContent = result.detectedLang.toUpperCase();

  div.appendChild(badge);
  div.appendChild(document.createTextNode(' ' + result.translation));
  body.appendChild(div);
}

function injectAll(container) {
  container.querySelectorAll(
    '.msg_pos.chat__message_received, .msg_pos.chat__message_send'
  ).forEach(inject);
}

// ── Translation API (via background.js) ───────────────────────────────────────

function fetchTranslation(text) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'translate', text }, response => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      if (response && response.success) {
        const t = response.translation;
        resolve(t.toLowerCase().trim() !== text.toLowerCase().trim()
          ? { translation: t, detectedLang: response.detectedLang }
          : null);
      } else {
        resolve(null);
      }
    });
  });
}

// ── Async scan ────────────────────────────────────────────────────────────────

async function scan() {
  if (scanning) return;
  scanning = true;

  const msgs = document.querySelectorAll(
    '.msg_pos.chat__message_received, .msg_pos.chat__message_send'
  );
  console.log('🔍 Scanning ' + msgs.length + ' messages');

  for (const msg of Array.from(msgs).reverse()) {
    const text = cleanText(msg);
    if (text.length < 5) continue;
    const key = text.substring(0, 120);

    if (cache.has(key)) {
      inject(msg); // already cached — inject (or remove loader if English)
      continue;
    }

    // Show loader while we fetch
    showLoader(msg);

    try {
      const result = await fetchTranslation(text);
      cache.set(key, result);
      if (result) console.log('✅ [' + result.detectedLang + '→en]: ' + text.substring(0, 40));
    } catch(e) {
      console.error('Translation error:', e);
    }

    // Replace loader with translation (or remove loader if English)
    inject(msg);

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('✅ Done. Cached: ' + cache.size);
  scanning = false;
}

// ── Observers ─────────────────────────────────────────────────────────────────

let ulObserver = null;

function attachULObserver(ul) {
  if (ulObserver) ulObserver.disconnect();
  ulObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const msgPos = node.querySelector && node.querySelector('.msg_pos');
        if (!msgPos) return;
        inject(msgPos); // instant re-inject from cache on scroll
        const text = cleanText(msgPos);
        if (text.length >= 5 && !cache.has(text.substring(0, 120))) {
          clearTimeout(ulObserver._debounce);
          ulObserver._debounce = setTimeout(scan, 500);
        }
      });
    });
  });
  ulObserver.observe(ul, { childList: true, subtree: false });
}

function setupObservers() {
  const viewport = document.querySelector('[data-viewport-type="element"]');
  if (!viewport) {
    setTimeout(setupObservers, 1500);
    return;
  }

  // Watches viewport for React replacing the entire UL every ~3 seconds
  const viewportObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const ul = node.tagName === 'UL'
          ? node
          : node.querySelector && node.querySelector('ul.chat-conversation-list');
        if (!ul) return;
        injectAll(ul);       // re-inject all cached translations immediately
        attachULObserver(ul); // re-attach scroll observer to fresh UL
        // Scan for any new uncached messages
        const hasUncached = Array.from(
          ul.querySelectorAll('.msg_pos.chat__message_received, .msg_pos.chat__message_send')
        ).some(msg => !cache.has(cleanText(msg).substring(0, 120)));
        if (hasUncached) setTimeout(scan, 100);
      });
    });
  });

  viewportObserver.observe(viewport, { childList: true, subtree: false });
  console.log('👀 Observers ready');

  const currentUL = document.querySelector('ul.chat-conversation-list');
  if (currentUL) attachULObserver(currentUL);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

setTimeout(() => {
  setupObservers();
  setTimeout(scan, 300);
  setTimeout(scan, 2000);
}, 2000);