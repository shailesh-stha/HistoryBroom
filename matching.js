// Pure keyword-matching logic, shared by background.js and test_matching.mjs.
// Keyword shape: { text: string, mode: 'substring' | 'word' | 'domain' | 'regex' }

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hostMatches(url, domain) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === domain || h.endsWith('.' + domain);
  } catch {
    return false;
  }
}

export function matches(kw, title, url) {
  const maxLen = 2048;
  const safeTitle = (title || '').slice(0, maxLen);
  const safeUrl = (url || '').slice(0, maxLen);

  switch (kw.mode) {
    case 'word':
      return new RegExp(`\\b${escapeRegex(kw.text)}\\b`, 'i').test(safeTitle + ' ' + safeUrl);
    case 'domain':
      return hostMatches(safeUrl, kw.text);
    case 'regex':
      try {
        const r = new RegExp(kw.text, 'i');
        return r.test(safeTitle) || r.test(safeUrl);
      } catch {
        return false; // invalid pattern never matches
      }
    default: // substring
      return safeTitle.toLowerCase().includes(kw.text) ||
             safeUrl.toLowerCase().includes(kw.text);
  }
}

export function isExcepted(exceptions, title, url) {
  const maxLen = 2048;
  const t = (title || '').slice(0, maxLen).toLowerCase();
  const u = (url || '').slice(0, maxLen).toLowerCase();
  return exceptions.some((e) => t.includes(e) || u.includes(e));
}

export function matchesAny(keywords, exceptions, title, url) {
  return !isExcepted(exceptions, title, url) && keywords.some((k) => matches(k, title, url));
}
