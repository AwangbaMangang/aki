// assets/app.js
// Requires: assets/config.js (or config.example.js renamed to config.js and edited by you)
// The config file should export TRANSLATION_ENDPOINT and optionally DEFAULT_TARGET

(function () {
  // config.js provides TRANSLATION_ENDPOINT and DEFAULT_TARGET
  if (typeof TRANSLATION_ENDPOINT === 'undefined') {
    console.error('TRANSLATION_ENDPOINT not set. Copy config.example.js → config.js and configure it.');
  }

  // --- helpers ---
  const byId = id => document.getElementById(id);
  const articleInput = byId('article');
  const fetchBtn = byId('fetchBtn');
  const translateBtn = byId('translateBtn');
  const clearBtn = byId('clearBtn');
  const sourceTA = byId('source');
  const translatedTA = byId('translated');
  const bar = byId('bar');
  const status = byId('status');
  const engineSel = byId('engine');
  const downloadBtn = byId('downloadBtn');
  const copyBtn = byId('copyBtn');
  const help = byId('help');

  function setProgress(p) { bar.style.width = Math.max(0, Math.min(100, p)) + '%'; }
  function setStatus(s) { status.textContent = s; }

  // Fetch article plaintext via MediaWiki API (CORS-friendly)
  async function fetchWikipediaArticle(titleOrUrl) {
    let title = titleOrUrl.trim();
    try {
      // if it looks like a URL, try to extract /wiki/Article_Title
      try {
        const u = new URL(titleOrUrl);
        if (u.hostname.includes('wikipedia.org')) {
          const path = u.pathname || '';
          const prefix = '/wiki/';
          if (path.startsWith(prefix)) title = decodeURIComponent(path.slice(prefix.length)).replace(/\s+/g, '_');
        }
      } catch (e) { /* not a URL */ }

      title = title.replace(/\s+/g, '_');
      const api = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&format=json&origin=*&redirects=1&titles=${encodeURIComponent(title)}`;
      setStatus('Fetching article...');
      setProgress(10);
      const res = await fetch(api, { method: 'GET' });
      const json = await res.json();
      const pages = json.query && json.query.pages;
      if (!pages) throw new Error('No pages returned.');
      const page = Object.values(pages)[0];
      if (page.missing) throw new Error('Article not found on English Wikipedia.');
      setProgress(40);
      setStatus('Fetched: ' + (page.title || ''));
      return { title: page.title, text: page.extract || '' };
    } catch (err) {
      setStatus('Fetch error');
      setProgress(0);
      throw err;
    }
  }

  // Chunk text safely by characters (approx)
  function chunkText(text, maxChars = 3000) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxChars) {
      chunks.push(text.slice(i, i + maxChars));
    }
    return chunks;
  }

  // Translate chunk by calling TRANSLATION_ENDPOINT
  // The endpoint must accept JSON: { text: "...", source: "en", target: "mni", engine: "mint" }
  // and return JSON: { text: "translated text" } OR { translated_text: "..." }
  async function translateChunk(chunk, opts = {}) {
    const body = {
      text: chunk,
      source: opts.source || 'en',
      target: opts.target || (typeof DEFAULT_TARGET !== 'undefined' ? DEFAULT_TARGET : 'mni'),
      engine: opts.engine || 'mint'
    };
    const resp = await fetch(TRANSLATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      mode: 'cors'
    });
    if (!resp.ok) {
      let txt = await resp.text();
      throw new Error(`Translation API error: ${resp.status} ${resp.statusText} - ${txt}`);
    }
    const json = await resp.json();
    // flexible parsing
    return json.text || json.translated_text || json.translation || json.result || '';
  }

  // High-level translate function
  async function translateText(fullText, engine) {
    const chunks = chunkText(fullText, 3000);
    let translated = '';
    for (let i = 0; i < chunks.length; i++) {
      setStatus(`Translating chunk ${i+1}/${chunks.length}...`);
      setProgress(20 + Math.round((i / chunks.length) * 70));
      try {
        const out = await translateChunk(chunks[i], { engine });
        translated += (translated ? '\n' : '') + out;
      } catch (err) {
        throw err;
      }
    }
    setProgress(100);
    setStatus('Translation complete');
    return translated;
  }

  // --- UI wiring ---
  fetchBtn.addEventListener('click', async () => {
    const q = articleInput.value.trim();
    if (!q) return alert('Enter Wikipedia URL or title.');
    try {
      fetchBtn.disabled = true;
      setStatus('Starting fetch...');
      const page = await fetchWikipediaArticle(q);
      sourceTA.value = page.text;
      document.title = 'Translate: ' + page.title;
    } catch (err) {
      alert('Error fetching article: ' + err.message);
    } finally {
      fetchBtn.disabled = false;
    }
  });

  translateBtn.addEventListener('click', async () => {
    const txt = sourceTA.value.trim();
    if (!txt) return alert('Source text empty. Fetch an article or paste text.');
    translateBtn.disabled = true;
    translatedTA.value = '';
    setProgress(5);
    try {
      const engine = engineSel.value;
      const out = await translateText(txt, engine);
      translatedTA.value = out;
    } catch (err) {
      alert('Translation failed: ' + err.message);
      setStatus('Error');
      setProgress(0);
    } finally {
      translateBtn.disabled = false;
    }
  });

  clearBtn.addEventListener('click', () => {
    articleInput.value = ''; sourceTA.value = ''; translatedTA.value = '';
    setProgress(0); setStatus('Idle'); document.title = 'English → Meetei Mayek Translator';
  });

  downloadBtn.addEventListener('click', () => {
    const text = translatedTA.value.trim();
    if (!text) return alert('Nothing to download.');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'translated_meetei.txt';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  copyBtn.addEventListener('click', async () => {
    const t = translatedTA.value.trim();
    if (!t) return alert('Nothing to copy.');
    try { await navigator.clipboard.writeText(t); alert('Copied to clipboard'); }
    catch (err) { alert('Clipboard write failed: ' + err.message); }
  });

  help.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Publishing tips:\n1) Create an account on mni.wikipedia.org\n2) Translate in small sections and verify.\n3) Add attribution: "Translated with assistance from [tool]" and list source.\n4) Ask the Meetei Wikipedia community if unsure before mass publishing.');
  });

  // initial
  setProgress(0); setStatus('Idle');

})();
