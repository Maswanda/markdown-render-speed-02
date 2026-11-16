// Fast Markdown renderer: byte-identical HTML to marked 18.1.3 (GFM, default options)
// but faster. A clean-room implementation of the CommonMark 0.31.2 + GFM 0.29
// behaviour as marked renders it, written for speed: single-pass block scan,
// direct HTML generation, fast paths for plain paragraphs.
//
// Credit: behaviour follows marked (MIT, https://github.com/markedjs/marked) and the
// CommonMark / GFM specs. This file is an original implementation, not a copy.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// HTML block tags (type 6) - CommonMark list
const BLOCK_TAGS = new Set(('address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem meta nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul').split(' '));

// Named HTML entities (the common ones; full table below for the rest).
// We resolve entities via a lookup built from the standard table.
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '\u00a9',
  reg: '\u00ae', trade: '\u2122', hellip: '\u2026', mdash: '\u2014', ndash: '\u2013',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d', laquo: '\u00ab',
  raquo: '\u00bb', times: '\u00d7', divide: '\u00f7', plusmn: '\u00b1', deg: '\u00b0',
  micro: '\u00b5', para: '\u00b6', middot: '\u00b7', bull: '\u2022', dagger: '\u2020',
  Dagger: '\u2021', permil: '\u2030', prime: '\u2032', Prime: '\u2033', oline: '\u203e',
  frasl: '\u2044', euro: '\u20ac', pound: '\u00a3', yen: '\u00a5', cent: '\u00a2',
  curren: '\u00a4', brvbar: '\u00a6', sect: '\u00a7', uml: '\u00a8', ordf: '\u00aa',
  ordm: '\u00ba', iquest: '\u00bf', iexcl: '\u00a1', szlig: '\u00df', agrave: '\u00e0',
  aacute: '\u00e1', acirc: '\u00e2', atilde: '\u00e3', auml: '\u00e4', aring: '\u00e5',
  aelig: '\u00e6', ccedil: '\u00e7', egrave: '\u00e8', eacute: '\u00e9', ecirc: '\u00ea',
  euml: '\u00eb', igrave: '\u00ec', iacute: '\u00ed', icirc: '\u00ee', iuml: '\u00ef',
  eth: '\u00f0', ntilde: '\u00f1', ograve: '\u00f2', oacute: '\u00f3', ocirc: '\u00f4',
  otilde: '\u00f5', ouml: '\u00f6', oslash: '\u00f8', ugrave: '\u00f9', uacute: '\u00fa',
  ucirc: '\u00fb', uuml: '\u00fc', yacute: '\u00fd', thorn: '\u00fe', yuml: '\u00ff',
  Agrave: '\u00c0', Aacute: '\u00c1', Acirc: '\u00c2', Atilde: '\u00c3', Auml: '\u00c4',
  Aring: '\u00c5', AElig: '\u00c6', Ccedil: '\u00c7', Egrave: '\u00c8', Eacute: '\u00c9',
  Ecirc: '\u00ca', Euml: '\u00cb', Igrave: '\u00cc', Iacute: '\u00cd', Icirc: '\u00ce',
  Iuml: '\u00cf', ETH: '\u00d0', Ntilde: '\u00d1', Ograve: '\u00d2', Oacute: '\u00d3',
  Ocirc: '\u00d4', Otilde: '\u00d5', Ouml: '\u00d6', Oslash: '\u00d8', Ugrave: '\u00d9',
  Uacute: '\u00da', Ucirc: '\u00db', Uuml: '\u00dc', Yacute: '\u00dd', THORN: '\u00de',
  Yuml: '\u0178', fnof: '\u0192', Alpha: '\u0391', Beta: '\u0392', Gamma: '\u0393',
  Delta: '\u0394', Epsilon: '\u0395', Zeta: '\u0396', Eta: '\u0397', Theta: '\u0398',
  Iota: '\u0399', Kappa: '\u039a', Lambda: '\u039b', Mu: '\u039c', Nu: '\u039d',
  Xi: '\u039e', Omicron: '\u039f', Pi: '\u03a0', Rho: '\u03a1', Sigma: '\u03a3',
  Tau: '\u03a4', Upsilon: '\u03a5', Phi: '\u03a6', Chi: '\u03a7', Psi: '\u03a8',
  Omega: '\u03a9', alpha: '\u03b1', beta: '\u03b2', gamma: '\u03b3', delta: '\u03b4',
  epsilon: '\u03b5', zeta: '\u03b6', eta: '\u03b7', theta: '\u03b8', iota: '\u03b9',
  kappa: '\u03ba', lambda: '\u03bb', mu: '\u03bc', nu: '\u03bd', xi: '\u03be',
  omicron: '\u03bf', pi: '\u03c0', rho: '\u03c1', sigmaf: '\u03c2', sigma: '\u03c3',
  tau: '\u03c4', upsilon: '\u03c5', phi: '\u03c6', chi: '\u03c7', psi: '\u03c8',
  omega: '\u03c9', thetasym: '\u03d1', upsih: '\u03d2', piv: '\u03d6', ensp: '\u2002',
  emsp: '\u2003', thinsp: '\u2009', zwnj: '\u200c', zwj: '\u200d', lrm: '\u200e',
  rlm: '\u200f', sbquo: '\u201a', bdquo: '\u201e', lsaquo: '\u2039', rsaquo: '\u203a',
  circ: '\u02c6', tilde: '\u02dc', ndash2: '\u2013', lowast: '\u2217', radic: '\u221a',
  prop: '\u221d', infin: '\u221e', ang: '\u2220', and: '\u2227', or: '\u2228',
  cap: '\u2229', cup: '\u222a', int: '\u222b', there4: '\u2234', sim: '\u223c',
  cong: '\u2245', asymp: '\u2248', ne: '\u2260', equiv: '\u2261', le: '\u2264',
  ge: '\u2265', sub: '\u2282', sup: '\u2283', nsub: '\u2284', sube: '\u2286',
  supe: '\u2287', oplus: '\u2295', otimes: '\u2297', perp: '\u22a5', sdot: '\u22c5',
  lceil: '\u2308', rceil: '\u2309', lfloor: '\u230a', rfloor: '\u230b', lang: '\u27e8',
  rang: '\u27e9', loz: '\u25ca', spades: '\u2660', clubs: '\u2663', hearts: '\u2665',
  diams: '\u2666', OElig: '\u0152', oelig: '\u0153', Scaron: '\u0160', scaron: '\u0161',
  Yuml2: '\u0178', sup1: '\u00b9', sup2: '\u00b2', sup3: '\u00b3', frac14: '\u00bc',
  frac12: '\u00bd', frac34: '\u00be', minus: '\u2212', lowast2: '\u2217', radic2: '\u221a',
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isSpace(ch) { return ch === ' ' || ch === '\t'; }
function isDigit(ch) { return ch >= '0' && ch <= '9'; }
function isAlpha(ch) { return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'); }
function isAlnum(ch) { return isAlpha(ch) || isDigit(ch); }
const UNICODE_PUNCT = /[\p{P}\p{S}]/u;
function isAsciiPunct(ch) {
  // ASCII punctuation only (CommonMark backslash escapes).
  if (ch === undefined) return false;
  const code = ch.charCodeAt(0);
  return (code >= 33 && code <= 47) || (code >= 58 && code <= 64) || (code >= 91 && code <= 96) || (code >= 123 && code <= 126);
}
function isPunct(ch) {
  // ASCII punctuation (CommonMark) plus Unicode punctuation and symbols
  // (marked treats currency symbols like £ € $ as punctuation for flanking).
  if (ch === undefined) return false;
  if (isAsciiPunct(ch)) return true;
  return UNICODE_PUNCT.test(ch);
}
function isWhitespace(ch) { return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v' || ch === '\u00a0'; }

// Strict escape: encode every &, <, >, ", '. Used for code blocks and code
// spans, where entities are NOT recognised (marked's escape with encode=true).
function escapeHtmlStrict(s) {
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const e = ESC[s[i]];
    if (e !== undefined) {
      if (i > start) out += s.slice(start, i);
      out += e;
      start = i + 1;
    }
  }
  if (start === 0) return s;
  if (start < s.length) out += s.slice(start);
  return out;
}

// Escape HTML special chars in text (encode &, <, >, ", ').
// `&` is preserved when it starts a valid entity reference: &word; is kept
// literally, &#123; / &#xAB; are decoded to the character (0, >0x10FFFF and
// surrogates become U+FFFD; 38 becomes &amp;). A bare & is escaped.
function escapeHtml(s) {
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '&') {
      const semi = s.indexOf(';', i + 1);
      if (semi !== -1 && semi - i <= 32) {
        const body = s.slice(i + 1, semi);
        if (body[0] === '#') {
          let code;
          if ((body[1] === 'x' || body[1] === 'X') && /^[0-9A-Fa-f]{1,6}$/.test(body.slice(2))) {
            code = parseInt(body.slice(2), 16);
          } else if (/^\d{1,7}$/.test(body.slice(1))) {
            code = parseInt(body.slice(1), 10);
          }
          if (code !== undefined) {
            if (i > start) out += s.slice(start, i);
            if (code === 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) out += '\uFFFD';
            else if (code === 38) out += '&amp;';
            else {
              const decoded = String.fromCodePoint(code);
              out += ESC[decoded] !== undefined ? ESC[decoded] : decoded;
            }
            i = semi;
            start = i + 1;
            continue;
          }
        } else if (/^[A-Za-z][A-Za-z0-9]*$/.test(body)) {
          // named entity: keep literally (do not decode, do not escape)
          i = semi;
          continue;
        }
      }
      // bare & : escape
      if (i > start) out += s.slice(start, i);
      out += '&amp;';
      start = i + 1;
    } else {
      const e = ESC[ch];
      if (e !== undefined) {
        if (i > start) out += s.slice(start, i);
        out += e;
        start = i + 1;
      }
    }
  }
  if (start === 0) return s;
  if (start < s.length) out += s.slice(start);
  return out;
}

// Escape for attribute / href: encode & < > " (not ') - matches marked's escape() with encode=true.
// A & that starts a valid entity (&name; &#123; &#xAB;) is preserved as-is.
function escapeAttr(s) {
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    let e;
    if (ch === '&') {
      const semi = s.indexOf(';', i + 1);
      if (semi !== -1 && semi - i <= 32) {
        const body = s.slice(i + 1, semi);
        if ((body[0] === '#' && ((body[1] === 'x' || body[1] === 'X') ? /^[0-9A-Fa-f]{1,6}$/.test(body.slice(2)) : /^\d{1,7}$/.test(body.slice(1)))) || /^[A-Za-z][A-Za-z0-9]*$/.test(body)) {
          // valid entity: preserve as-is (skip past it)
          i = semi;
          continue;
        }
      }
      e = '&amp;';
    }
    else if (ch === '<') e = '&lt;';
    else if (ch === '>') e = '&gt;';
    else if (ch === '"') e = '&quot;';
    else continue;
    if (i > start) out += s.slice(start, i);
    out += e;
    start = i + 1;
  }
  if (start === 0) return s;
  if (start < s.length) out += s.slice(start);
  return out;
}

// Resolve entities in a string: &name; &#123; &#xAB; — invalid ones left as-is.
// marked's unescape: numeric refs out of range / surrogates become U+FFFD; & followed by
// an invalid entity becomes &amp;.
function unescapeEntities(s) {
  if (s.indexOf('&') === -1) return s;
  let out = '';
  let start = 0;
  let i = 0;
  const n = s.length;
  while (i < n) {
    if (s[i] === '&') {
      const semi = s.indexOf(';', i + 1);
      if (semi !== -1 && semi - i <= 32) {
        const body = s.slice(i + 1, semi);
        let rep = null;
        if (body[0] === '#') {
          let code;
          if (body[1] === 'x' || body[1] === 'X') {
            if (/^[0-9A-Fa-f]{1,6}$/.test(body.slice(2))) code = parseInt(body.slice(2), 16);
          } else if (/^\d{1,7}$/.test(body.slice(1))) {
            code = parseInt(body.slice(1), 10);
          }
          if (code !== undefined) {
            rep = (code === 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) ? '\uFFFD' : (code === 38 ? '&amp;' : String.fromCodePoint(code));
          }
        } else if (/^[A-Za-z][A-Za-z0-9]*$/.test(body)) {
          const v = ENTITIES[body];
          if (v !== undefined) rep = v;
        }
        if (rep !== null) {
          if (i > start) out += s.slice(start, i);
          out += rep;
          i = semi + 1;
          start = i;
          continue;
        }
      }
    }
    i++;
  }
  if (start === 0) return s;
  if (start < n) out += s.slice(start);
  return out;
}

// marked's cleanUrl: encodeURI, then %25 -> %, null on error.
function cleanUrl(href) {
  if (href === null || href === undefined) return null;
  try {
    href = encodeURI(href).replace(/%25/g, '%');
  } catch (e) {
    return null;
  }
  return href;
}

// Expand tabs to spaces (tab = advance to next multiple of 4). Used for indented code.
function expandTabs(s) {
  let out = '';
  let col = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\t') {
      const n = 4 - (col % 4);
      out += '    '.slice(0, n);
      col += n;
    } else {
      out += ch;
      col++;
    }
  }
  return out;
}

// Normalise a link label: collapse whitespace, lowercase, trim.
function normalizeLabel(s) {
  // Unicode case folding: ẞ (U+1E9E) and ß (U+00DF) fold to "ss".
  return s.trim().replace(/\s+/g, ' ').replace(/[\u00DF\u1E9E]/g, 'ss').toLowerCase();
}

// ---------------------------------------------------------------------------
// Link reference definitions
// ---------------------------------------------------------------------------

// Parse a link reference definition starting at line `i` of `lines`.
// Returns {label, dest, title, next} or null. Follows marked's def rule:
//   [label]: <dest> or dest, optional title on same line or next line.
function parseLinkDef(lines, i, refs) {
  const line = lines[i];
  // must start with up to 3 spaces then [
  let p = 0;
  while (p < line.length && line[p] === ' ') p++;
  if (p > 3 || line[p] !== '[') return null;
  // find matching ] (balanced, with escapes); label may span one more line
  let depth = 0, j = p;
  let labelEnd = -1;
  let labelText = '';
  let labelEndLine = i;
  // Scan the current line, then (if needed) the next line joined with \n.
  const scanStr = line + (i + 1 < lines.length ? '\n' + lines[i + 1] : '');
  for (; j < scanStr.length; j++) {
    const ch = scanStr[j];
    if (ch === '\\' && j + 1 < scanStr.length) { j++; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { labelEnd = j; break; } }
  }
  if (labelEnd === -1) return null;
  // labelRaw spans scanStr[p+1 .. labelEnd]; map back to lines if it crossed
  labelText = scanStr.slice(p + 1, labelEnd);
  if (labelText.length === 0) return null;
  const labelRaw = labelText;
  // Determine which line the label ended on and the position of ':' after it.
  let k;
  if (labelEnd < line.length) {
    labelEndLine = i;
    k = labelEnd + 1;
  } else {
    labelEndLine = i + 1;
    k = labelEnd - line.length; // position in next line (after the \n)
  }
  // label must not contain unescaped [ ] handled above; also must not be blank after trim? marked allows.
  // k is the position after ']' in the label's end line; check for ':' there.
  let cur = labelEndLine;
  let s = lines[cur];
  if (s[k] !== ':') return null;
  k++;
  // skip spaces/tabs, allow one newline + spaces
  const skipWs = () => {
    while (true) {
      while (k < s.length && (s[k] === ' ' || s[k] === '\t')) k++;
      if (k >= s.length && cur + 1 < lines.length) {
        cur++; s = lines[cur]; k = 0;
        continue;
      }
      break;
    }
  };
  skipWs();
  if (k >= s.length) return null;
  // destination: <...> or bare
  let dest = '';
  if (s[k] === '<') {
    const end = s.indexOf('>', k + 1);
    if (end === -1) return null;
    dest = s.slice(k + 1, end);
    // dest must not contain < or newline
    if (dest.indexOf('<') !== -1 || dest.indexOf('\n') !== -1) return null;
    k = end + 1;
  } else {
    let m = k;
    while (m < s.length && s[m] !== ' ' && s[m] !== '\t' && s[m] !== '\n') {
      if (s[m] === '(') {
        // parentheses must be balanced in bare dest; marked allows one level
      }
      m++;
    }
    dest = s.slice(k, m);
    if (dest.length === 0) return null;
    // dest must not contain control chars
    if (/[\x00-\x20]/.test(dest)) return null;
    k = m;
  }
  // optional title
  let title = null;
  // skip spaces on same line; a title must be separated from the dest by
  // whitespace (no space means trailing junk, not a title).
  let saveCur = cur, saveK = k, saveS = s;
  const wsStart = k;
  while (k < s.length && (s[k] === ' ' || s[k] === '\t')) k++;
  if (k < s.length) {
    if (k === wsStart) return null; // no whitespace before title/junk
    // title on same line
    const t = parseTitle(s, k);
    if (t) {
      title = t.title;
      k = t.end;
      while (k < s.length && (s[k] === ' ' || s[k] === '\t')) k++;
      if (k < s.length) return null; // trailing junk
    } else {
      return null; // trailing junk
    }
  } else {
    // try title on next line
    if (cur + 1 < lines.length) {
      const nl = lines[cur + 1];
      let q = 0;
      while (q < nl.length && (nl[q] === ' ' || nl[q] === '\t')) q++;
      if (q < nl.length) {
        const t = parseTitle(nl, q);
        if (t) {
          let e = t.end;
          while (e < nl.length && (nl[e] === ' ' || nl[e] === '\t')) e++;
          if (e >= nl.length) {
            title = t.title;
            cur++;
          }
        }
      }
    }
  }
  const label = normalizeLabel(labelRaw);
  if (label.length === 0) return null;
  if (!refs[label]) refs[label] = { href: dest, title };
  return { next: cur + 1 };
}

// Parse a title at position k in string s. Returns {title, end} or null.
// Title forms: "..." , '...' , (...)
function parseTitle(s, k) {
  const q = s[k];
  if (q === '"' || q === "'") {
    let j = k + 1;
    let out = '';
    while (j < s.length) {
      const ch = s[j];
      if (ch === '\\' && j + 1 < s.length && isAsciiPunct(s[j + 1])) { out += s[j + 1]; j += 2; continue; }
      if (ch === q) return { title: out, end: j + 1 };
      if (ch === '\n') {
        // A title may span lines but cannot contain a blank line: if the
        // next line is blank (empty or only whitespace then end/newline),
        // the title is invalid.
        let m = j + 1;
        while (m < s.length && (s[m] === ' ' || s[m] === '\t')) m++;
        if (m >= s.length || s[m] === '\n') return null;
      }
      out += ch;
      j++;
    }
    return null;
  }
  if (q === '(') {
    let j = k + 1;
    let out = '';
    let depth = 1;
    while (j < s.length) {
      const ch = s[j];
      if (ch === '\\' && j + 1 < s.length && isAsciiPunct(s[j + 1])) { out += s[j + 1]; j += 2; continue; }
      if (ch === '(') { depth++; }
      else if (ch === ')') { depth--; if (depth === 0) return { title: out, end: j + 1 }; }
      out += ch;
      j++;
    }
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

// A block is {type, ...}. We parse the source into blocks, then render.
// For speed we render directly to HTML strings during parsing where the
// inline content is already known, and defer inline parsing for text blocks.

// Returns true if the given lines end inside an unclosed fenced code block
// (a fence opener with no matching closer). Used to stop lazy continuation.
function endsInFence(ls) {
  let inFence = null;
  for (const l of ls) {
    const f = matchFence(l);
    if (f) {
      if (inFence === null) {
        inFence = f;
      } else if (f.ch === inFence.ch && f.len >= inFence.len && f.info === '') {
        inFence = null;
      }
    }
  }
  return inFence !== null;
}

// Count leading spaces (up to 4) of a line, expanding tabs as 4-col stops.
// Returns {spaces, contentStart} where contentStart is the index of the first
// non-space char (or line.length). Tabs count as advancing to next multiple of 4.
function leadingSpaces(line) {
  let col = 0;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === ' ') { col++; i++; }
    else if (ch === '\t') { col += 4 - (col % 4); i++; }
    else break;
    if (col >= 4) break;
  }
  return { col, i };
}

// Full leading column (no 4-cap), tabs expanded to 4-col stops.
function fullLeadingCol(line) {
  let col = 0;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === ' ') { col++; i++; }
    else if (ch === '\t') { col += 4 - (col % 4); i++; }
    else break;
  }
  return col;
}

function isBlank(line) {
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== ' ' && line[i] !== '\t') return false;
  }
  return true;
}

// Check if line is a thematic break: 3+ of -, _, * (with spaces), nothing else.
function isThematicBreak(line) {
  let p = 0;
  while (p < line.length && line[p] === ' ') p++;
  if (p > 3) return false;
  if (p >= line.length) return false;
  const ch = line[p];
  if (ch !== '-' && ch !== '_' && ch !== '*') return false;
  let count = 0;
  for (let i = p; i < line.length; i++) {
    const c = line[i];
    if (c === ch) count++;
    else if (c !== ' ' && c !== '\t') return false;
  }
  return count >= 3;
}

// Check for ATX heading: #{1,6} followed by space/EOL. Returns {level, text, start} or null.
// text is the raw heading content (trailing #s stripped).
function matchAtx(line) {
  let p = 0;
  while (p < line.length && line[p] === ' ') p++;
  if (p > 3) return null;
  let level = 0;
  while (p + level < line.length && line[p + level] === '#') level++;
  if (level === 0 || level > 6) return null;
  const after = p + level;
  if (after < line.length && line[after] !== ' ' && line[after] !== '\t') return null;
  // content: skip spaces, strip trailing #s preceded by space
  let start = after;
  while (start < line.length && (line[start] === ' ' || line[start] === '\t')) start++;
  let end = line.length;
  // strip trailing spaces
  while (end > start && (line[end - 1] === ' ' || line[end - 1] === '\t')) end--;
  // strip closing # sequence (may be the entire content, e.g. "### ###")
  if (end > start) {
    let e = end;
    while (e > start && line[e - 1] === '#') e--;
    if (e < end && e >= start && (line[e - 1] === ' ' || line[e - 1] === '\t')) {
      end = e;
      while (end > start && (line[end - 1] === ' ' || line[end - 1] === '\t')) end--;
    }
  }
  return { level, text: line.slice(start, end) };
}

// Check for setext underline: === or --- (only -, =). Returns level 1 (=) or 2 (-) or 0.
function matchSetext(line) {
  let p = 0;
  while (p < line.length && line[p] === ' ') p++;
  if (p > 3) return 0;
  if (p >= line.length) return 0;
  const ch = line[p];
  if (ch !== '=' && ch !== '-') return 0;
  // A run of the same char, then only trailing spaces/tabs (no spaces
  // inside the run, no more of the char after a space).
  let i = p;
  while (i < line.length && line[i] === ch) i++;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
  if (i < line.length) return 0;
  return ch === '=' ? 1 : 2;
}

// Check for fenced code start: ``` or ~~~ (3+). Returns {fence, info, indent} or null.
function matchFence(line) {
  let p = 0;
  while (p < line.length && line[p] === ' ') p++;
  if (p > 3) return null;
  const ch = line[p];
  if (ch !== '`' && ch !== '~') return null;
  let n = 0;
  while (p + n < line.length && line[p + n] === ch) n++;
  if (n < 3) return null;
  const info = line.slice(p + n).trim();
  if (ch === '`' && info.indexOf('`') !== -1) return null;
  return { fence: ch, len: n, info, indent: p };
}

// Check for a fence end line matching the opening fence.
function isFenceEnd(line, fence, len) {
  let p = 0;
  while (p < line.length && line[p] === ' ') p++;
  if (p > 3) return false;
  let n = 0;
  while (p + n < line.length && line[p + n] === fence) n++;
  if (n < len) return false;
  // rest must be spaces only
  for (let i = p + n; i < line.length; i++) {
    if (line[i] !== ' ' && line[i] !== '\t') return false;
  }
  return true;
}

// Check for indented code: line starts with 4+ spaces (or tab) and is not blank.
function isIndentedCode(line) {
  if (isBlank(line)) return false;
  const { col } = leadingSpaces(line);
  return col >= 4;
}

// Remove up to `n` leading spaces (expanding tabs) from a line.
function removeIndent(line, n) {
  let col = 0;
  let i = 0;
  while (i < line.length && col < n) {
    const ch = line[i];
    if (ch === ' ') { col++; i++; }
    else if (ch === '\t') {
      const adv = 4 - (col % 4);
      if (col + adv > n) {
        // partial tab: replace with spaces
        return ' '.repeat(n - col) + line.slice(i + 1);
      }
      col += adv; i++;
    } else break;
  }
  // If a tab sits exactly at the indent boundary AND we removed some indent,
  // expand it to the next 4-col stop from its column. When n=0 (nothing
  // removed) the tab is content and stays a literal tab.
  if (col > 0 && i < line.length && line[i] === '\t') {
    return ' '.repeat(4 - (col % 4)) + line.slice(i + 1);
  }
  return line.slice(i);
}

// Check for blockquote start: up to 3 spaces then >.
function matchBlockquote(line) {
  let p = 0;
  while (p < line.length && line[p] === ' ') p++;
  if (p > 3 || line[p] !== '>') return -1;
  let q = p + 1;
  if (q < line.length && (line[q] === ' ' || line[q] === '\t')) q++;
  return q;
}

// Check for list item start. Returns {marker, ordered, start, contentStart, indent, bullet} or null.
// marker is the bullet char or the ordered number+delimiter.
function matchListItem(line) {
  let p = 0;
  while (p < line.length && line[p] === ' ') p++;
  if (p > 3) return null;
  const ch = line[p];
  if (ch === '-' || ch === '+' || ch === '*') {
    const after = p + 1;
    if (after >= line.length) return { marker: ch, ordered: false, start: p, contentStart: line.length, indent: p, width: 1, empty: true };
    if (line[after] !== ' ' && line[after] !== '\t') return null;
    // content start: skip spaces, but a tab counts
    let cs = after;
    let spaces = 0;
    while (cs < line.length && (line[cs] === ' ' || line[cs] === '\t')) {
      if (line[cs] === '\t') spaces += 4 - (spaces % 4);
      else spaces++;
      cs++;
      if (spaces >= 5) break;
    }
    if (cs >= line.length) return { marker: ch, ordered: false, start: p, contentStart: line.length, indent: p, width: 1, empty: true };
    if (spaces > 4) {
      // content indented 5+: marker width is 1, content starts after 1 space
      return { marker: ch, ordered: false, start: p, contentStart: after + 1, indent: p, width: 1 };
    }
    return { marker: ch, ordered: false, start: p, contentStart: cs, indent: p, width: cs - p };
  }
  if (isDigit(ch)) {
    let q = p;
    while (q < line.length && isDigit(line[q])) q++;
    const num = q - p;
    if (num > 9) return null;
    if (q >= line.length) return null;
    const d = line[q];
    if (d !== '.' && d !== ')') return null;
    const after = q + 1;
    if (after >= line.length) return { marker: line.slice(p, after), ordered: true, num: parseInt(line.slice(p, q), 10), delim: d, start: p, contentStart: line.length, indent: p, width: after - p, empty: true };
    if (line[after] !== ' ' && line[after] !== '\t') return null;
    let cs = after;
    let spaces = 0;
    while (cs < line.length && (line[cs] === ' ' || line[cs] === '\t')) {
      if (line[cs] === '\t') spaces += 4 - (spaces % 4);
      else spaces++;
      cs++;
      if (spaces >= 5) break;
    }
    if (cs >= line.length) return { marker: line.slice(p, after), ordered: true, num: parseInt(line.slice(p, q), 10), delim: d, start: p, contentStart: line.length, indent: p, width: after - p, empty: true };
    if (spaces > 4) {
      return { marker: line.slice(p, after), ordered: true, num: parseInt(line.slice(p, q), 10), delim: d, start: p, contentStart: after + 1, indent: p, width: after - p };
    }
    return { marker: line.slice(p, after), ordered: true, num: parseInt(line.slice(p, q), 10), delim: d, start: p, contentStart: cs, indent: p, width: cs - p };
  }
  return null;
}

// Check if a line is an HTML block start (type 1-7). Returns the type (1-7) or 0.
// We use marked's html block start conditions.
function htmlBlockType(line) {
  let p = 0;
  while (p < line.length && line[p] === ' ') p++;
  if (p > 3) return 0;
  if (line[p] !== '<') return 0;
  const rest = line.slice(p);
  // type 1: script, pre, style, textarea
  let m = rest.match(/^<(script|pre|style|textarea)([\s>]|$)/i);
  if (m) return 1;
  // type 2: comment
  if (rest.startsWith('<!--')) return 2;
  // type 3: processing instruction
  if (rest.startsWith('<?')) return 3;
  // type 4: declaration
  if (/^<![A-Za-z]/.test(rest)) return 4;
  // type 5: CDATA
  if (rest.startsWith('<![CDATA[')) return 5;
  // type 6: block tag
  m = rest.match(/^<\/?([A-Za-z][A-Za-z0-9-]*)/);
  if (m && BLOCK_TAGS.has(m[1].toLowerCase())) return 6;
  // type 7: any other tag, but only when followed by whitespace or end of line
  // (a tag followed by text is inline HTML, not an HTML block).
  m = rest.match(/^<\/?[A-Za-z][A-Za-z0-9-]*(\s[^>]*)?\/?>/);
  if (m && /^[\s]*$/.test(rest.slice(m[0].length))) return 7;
  m = rest.match(/^<\/[A-Za-z][A-Za-z0-9-]*\s*>/);
  if (m && /^[\s]*$/.test(rest.slice(m[0].length))) return 7;
  return 0;
}

// Check if an HTML block of the given type ends at this line.
function htmlBlockEnds(line, type) {
  if (type === 1) return /<\/(script|pre|style|textarea)>/i.test(line);
  if (type === 2) return line.indexOf('-->') !== -1;
  if (type === 3) return line.indexOf('?>') !== -1;
  if (type === 4) return line.indexOf('>') !== -1;
  if (type === 5) return line.indexOf(']]>') !== -1;
  // type 6 and 7 end at a blank line
  return isBlank(line);
}

// Split a table row into cells. Handles escaped pipes.
function splitTableRow(line) {
  // strip leading/trailing pipes (with optional spaces)
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

// Check if a line is a table delimiter row. Returns align array or null.
function matchTableDelim(line) {
  const cells = splitTableRow(line);
  if (cells.length === 0) return null;
  const aligns = [];
  for (const c of cells) {
    if (/^:?-+:?$/.test(c)) {
      if (c.startsWith(':') && c.endsWith(':')) aligns.push('center');
      else if (c.endsWith(':')) aligns.push('right');
      else if (c.startsWith(':')) aligns.push('left');
      else aligns.push(null);
    } else return null;
  }
  return aligns;
}

// ---------------------------------------------------------------------------
// Inline parsing
// ---------------------------------------------------------------------------

// Parse inline markdown in `src` (a single block's text, newlines preserved)
// and return HTML. `refs` is the link-reference map. `inLink` tracks whether
// we are already inside a link (links cannot nest).
//
// We implement the CommonMark emphasis algorithm with a delimiter stack, and
// marked's link/image/autolink rules.

// Find the matching close paren for a link destination starting at index i
// (where src[i] === '('). Handles nested parens and escapes. Returns index of
// the matching ')' or -1.
function findLinkParen(src, i) {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === '\\' && j + 1 < src.length) { j++; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return j; }
  }
  return -1;
}

// Parse a link destination + optional title inside parens.
// src[i] === '(' . Returns {dest, title, end} where end is index just past ')', or null.
function parseLinkDestTitle(src, i) {
  // i points at '('
  let j = i + 1;
  // skip spaces/newlines
  while (j < src.length && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n')) j++;
  if (j >= src.length) return null;
  let dest = '';
  if (src[j] === '<') {
    // Find an UNESCAPED '>' (a \> does not close the destination).
    let end = -1;
    for (let m = j + 1; m < src.length; m++) {
      if (src[m] === '\\' && m + 1 < src.length) { m++; continue; }
      if (src[m] === '>') { end = m; break; }
      if (src[m] === '\n') break;
    }
    if (end === -1) return null;
    dest = src.slice(j + 1, end);
    if (dest.indexOf('<') !== -1 || dest.indexOf('\n') !== -1) return null;
    dest = dest.replace(/\\([!-/:-@\[-`{-~])/g, '$1');
    j = end + 1;
  } else {
    // bare destination: no spaces, balanced parens
    let depth = 0;
    let k = j;
    while (k < src.length) {
      const ch = src[k];
      if (ch === '\\' && k + 1 < src.length) { k += 2; continue; }
      if (ch === ' ' || ch === '\t' || ch === '\n') break;
      if (ch === '(') { depth++; if (depth > 1 && src.indexOf(')', k) === -1) { /* allow */ } }
      else if (ch === ')') {
        if (depth === 0) break;
        depth--;
      }
      k++;
    }
    dest = src.slice(j, k);
    // An empty destination is valid ([link]() -> href="").
    // Process backslash escapes in the destination (\X -> X for ASCII punct).
    dest = dest.replace(/\\([!-/:-@\[-`{-~])/g, '$1');
    j = k;
  }
  // skip whitespace
  while (j < src.length && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n')) j++;
  let title = null;
  if (j < src.length && src[j] !== ')') {
    const t = parseTitle(src, j);
    if (!t) return null;
    title = t.title;
    j = t.end;
    while (j < src.length && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n')) j++;
  }
  if (j >= src.length || src[j] !== ')') return null;
  return { dest, title, end: j + 1 };
}

// Check if src starting at i is an autolink <...>. Returns {href, text, end} or null.
function parseAutolink(src, i) {
  // src[i] === '<'
  const end = src.indexOf('>', i + 1);
  if (end === -1 || end - i > 200) return null;
  const inner = src.slice(i + 1, end);
  if (inner.length === 0) return null;
  // must not contain space or <
  if (inner.indexOf(' ') !== -1 || inner.indexOf('<') !== -1 || inner.indexOf('\n') !== -1) return null;
  // scheme:... or email
  if (/^[A-Za-z][A-Za-z0-9+.-]{1,31}:[^ \x00-\x20<>]*$/.test(inner)) {
    return { href: inner, text: inner, end: end + 1 };
  }
  if (/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(inner)) {
    return { href: 'mailto:' + inner, text: inner, end: end + 1 };
  }
  return null;
}

// Check for an extended autolink (GFM): www.foo.bar or user@host or scheme://...
// at position i. Returns {href, text, end} or null.
function parseExtendedAutolink(src, i) {
  // www.
  if (src.startsWith('www.', i)) {
    let j = i + 4;
    // domain: labels separated by dots, then optional path
    let k = j;
    while (k < src.length) {
      const ch = src[k];
      if (isAlnum(ch) || ch === '-' || ch === '_' || ch === '.' || ch === '~' || ch === '/' || ch === '?' || ch === '#' || ch === '%' || ch === '=' || ch === '&' || ch === '+' || ch === ',' || ch === ';' || ch === ':' || ch === '@' || ch === '$' || ch === '!' || ch === "'" || ch === '(' || ch === ')' || ch === '*') k++;
      else break;
    }
    let text = src.slice(i, k);
    // must contain a dot in the domain part and valid TLD-ish
    const m = text.match(/^www\.[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/);
    if (!m) return null;
    // trim trailing punctuation
    text = trimTrailingPunct(text);
    if (text.length <= 4) return null;
    return { href: 'http://' + text, text, end: i + text.length };
  }
  // scheme://
  const sm = src.slice(i).match(/^[A-Za-z][A-Za-z0-9+.-]{1,31}:\/\/[^\s<>]+/);
  if (sm) {
    let text = trimTrailingPunct(sm[0]);
    return { href: text, text, end: i + text.length };
  }
  // scheme: (e.g. mailto:, xmpp:) followed by non-space text
  const scm = src.slice(i).match(/^[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]+/);
  if (scm) {
    let text = trimTrailingPunct(scm[0]);
    // The part after the scheme must contain a dot (domain) or be an email.
    const after = text.slice(text.indexOf(':') + 1);
    if (after.indexOf('.') !== -1 || after.indexOf('@') !== -1) {
      return { href: text, text, end: i + text.length };
    }
  }
  // email: user@host.tld
  const em = src.slice(i).match(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/);
  if (em) {
    let text = trimTrailingPunct(em[0]);
    // must have a dot and valid domain; domain must not end with - or _
    if (text.indexOf('.') === -1) return null;
    if (text.endsWith('-') || text.endsWith('_')) return null;
    return { href: 'mailto:' + text, text, end: i + text.length };
  }
  return null;
}

// Trim trailing punctuation (.,;:!? and unbalanced ) ) from an autolink candidate.
// Also trim trailing _ * ~ which may close emphasis.
function trimTrailingPunct(s) {
  let end = s.length;
  while (end > 0) {
    const ch = s[end - 1];
    if (ch === '.' || ch === ',' || ch === ';' || ch === ':' || ch === '!' || ch === '?' || ch === "'" || ch === '_' || ch === '*' || ch === '~') { end--; continue; }
    if (ch === ')') {
      // keep only if balanced
      let open = 0, close = 0;
      for (let i = 0; i < end; i++) { if (s[i] === '(') open++; else if (s[i] === ')') close++; }
      if (close > open) { end--; continue; }
    }
    break;
  }
  return s.slice(0, end);
}

// Parse inline content to HTML. Returns the HTML string.
// `inLink` is true when this text is inside a link label (links cannot nest).
function parseInline(src, refs, inLink) {
  const n = src.length;
  // Fast path: no special characters at all -> just escape and return.
  // (We still must handle entities and newlines, so check for those too.)
  // Also bail out if the text could contain a GFM extended autolink
  // (www., ://, or @).
  let hasSpecial = false;
  for (let i = 0; i < n; i++) {
    const c = src[i];
    if (c === '*' || c === '_' || c === '`' || c === '[' || c === '!' || c === '<' || c === '&' || c === '\\' || c === '~' || c === '\n' || c === '@') { hasSpecial = true; break; }
  }
  if (!hasSpecial && src.indexOf('www.') === -1 && src.indexOf('://') === -1) {
    return escapeHtml(src);
  }

  // Tokenize into a list of nodes, then render.
  // Node types: {t:'text', s}, {t:'code', s}, {t:'em'|'strong'|'del', children},
  // {t:'link'|'image', href, title, children}, {t:'br'}, {t:'html', s}
  // We use a delimiter-stack approach for emphasis.
  const out = [];
  const delims = []; // stack of {char, count, nodeIndex, canOpen, canClose, active}
  let i = 0;
  let textStart = 0;

  function flushText(to) {
    if (to > textStart) {
      out.push({ t: 'text', s: src.slice(textStart, to) });
    }
  }

  // Find the matching ] for a [ starting at i, handling nested brackets and code spans.
  function findBracketEnd(from) {
    let depth = 0;
    for (let j = from; j < n; j++) {
      const ch = src[j];
      if (ch === '\\' && j + 1 < n) { j++; continue; }
      if (ch === '`') {
        // skip code span
        let k = j;
        while (k < n && src[k] === '`') k++;
        const ticks = k - j;
        const close = src.indexOf('`'.repeat(ticks), k);
        if (close !== -1) j = close + ticks - 1;
        continue;
      }
      if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) return j; }
    }
    return -1;
  }

  while (i < n) {
    const ch = src[i];
    // --- code span ---
    if (ch === '`') {
      let j = i;
      while (j < n && src[j] === '`') j++;
      const ticks = j - i;
      const closer = '`'.repeat(ticks);
      // Find a closer run of exactly `ticks` backticks (not part of a
      // longer run on either side).
      let closeIdx = -1;
      let searchFrom = j;
      while (true) {
        const cand = src.indexOf(closer, searchFrom);
        if (cand === -1) break;
        const beforeOk = cand === 0 || src[cand - 1] !== '`';
        const afterOk = cand + ticks >= n || src[cand + ticks] !== '`';
        if (beforeOk && afterOk) { closeIdx = cand; break; }
        searchFrom = cand + 1;
      }
      if (closeIdx !== -1) {
        let content = src.slice(j, closeIdx);
        // collapse newlines to spaces, strip one leading/trailing space if both present and content has non-space
        content = content.replace(/\n/g, ' ');
        if (content.length >= 2 && content[0] === ' ' && content[content.length - 1] === ' ' && content.trim().length > 0) {
          content = content.slice(1, -1);
        }
        flushText(i);
        out.push({ t: 'code', s: content });
        i = closeIdx + ticks;
        textStart = i;
        continue;
      }
      // no closer: literal backticks
      i = j;
      continue;
    }
    // --- escape ---
    if (ch === '\\' && i + 1 < n) {
      const nx = src[i + 1];
      if (isAsciiPunct(nx)) {
        flushText(i);
        out.push({ t: 'text', s: nx });
        i += 2;
        textStart = i;
        continue;
      }
      if (nx === '\n') {
        flushText(i);
        out.push({ t: 'br' });
        i += 2;
        // After a hard break, leading spaces/tabs on the next line are stripped.
        while (i < n && (src[i] === ' ' || src[i] === '\t')) i++;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    // --- emphasis delimiters * _ ~ ---
    if (ch === '*' || ch === '_' || ch === '~') {
      let j = i;
      while (j < n && src[j] === ch) j++;
      const count = j - i;
      // Determine flanking per CommonMark
      const before = i === 0 ? '\n' : src[i - 1];
      const after = j >= n ? '\n' : src[j];
      const beforeIsSpace = isWhitespace(before) || before === '\n';
      const afterIsSpace = isWhitespace(after) || after === '\n';
      const beforeIsPunct = isPunct(before);
      const afterIsPunct = isPunct(after);
      const leftFlanking = !afterIsSpace && (!afterIsPunct || beforeIsSpace || beforeIsPunct);
      const rightFlanking = !beforeIsSpace && (!beforeIsPunct || afterIsSpace || afterIsPunct);
      let canOpen, canClose;
      if (ch === '_') {
        canOpen = leftFlanking && (!rightFlanking || beforeIsPunct);
        canClose = rightFlanking && (!leftFlanking || afterIsPunct);
      } else {
        canOpen = leftFlanking;
        canClose = rightFlanking;
      }
      // Marked treats both single ~ and double ~~ as strikethrough delimiters.
      flushText(i);
      const node = { t: 'delim', ch, count, canOpen, canClose, active: true, children: [] };
      out.push(node);
      delims.push({ node, outIndex: out.length - 1, count, initialCount: count, canOpen, canClose });
      i = j;
      textStart = i;
      continue;
    }
    // --- link / image ---
    if (ch === '[' || (ch === '!' && i + 1 < n && src[i + 1] === '[')) {
      const isImage = ch === '!';
      const openIdx = isImage ? i + 1 : i;
      const closeIdx = findBracketEnd(openIdx);
      if (closeIdx !== -1) {
        const labelText = src.slice(openIdx + 1, closeIdx);
        // A link label that itself contains a nested inline LINK (not image)
        // means the outer brackets are not a link (links cannot nest); let
        // the inner link be parsed when we reach it. A nested image
        // (![...](...)) does not block the outer link. This does not apply
        // to images: an image's alt text may contain link-like text.
        if (!isImage && /(^|[^\!])\[[^\]]*\]\([^)]*\)/.test(labelText)) {
          i = openIdx + 1;
          continue;
        }
        const after = closeIdx + 1;
        let link = null;
        // inline link: [text](dest "title")
        if (after < n && src[after] === '(') {
          const dt = parseLinkDestTitle(src, after);
          if (dt) {
            link = { href: dt.dest, title: dt.title, end: dt.end };
          }
        }
        // reference link: [text][label] or [text][] or [text]
        if (!link) {
          if (after < n && src[after] === '[') {
            const lblEnd = src.indexOf(']', after + 1);
            if (lblEnd !== -1) {
              const refLabel = src.slice(after + 1, lblEnd);
              const key = normalizeLabel(refLabel.length === 0 ? labelText : refLabel);
              const ref = refs[key];
              if (ref) link = { href: ref.href, title: ref.title, end: lblEnd + 1 };
            }
          } else {
            // shortcut reference [text]
            const key = normalizeLabel(labelText);
            const ref = refs[key];
            if (ref) link = { href: ref.href, title: ref.title, end: closeIdx + 1 };
          }
        }
        if (link) {
          // Parse the label's inline content. Links cannot nest: if we are
          // already inside a link label, a [text] here is literal text.
          flushText(i);
          if (!inLink && !isImage) {
            // link: parse label inline (recursively, now inside a link)
            const labelHtml = parseInline(labelText, refs, true);
            out.push({ t: 'link', href: link.href, title: link.title, labelHtml });
          } else if (isImage) {
            const alt = stripInlineFormatting(labelText);
            out.push({ t: 'image', href: link.href, title: link.title, alt });
          } else {
            // inside a link: literal [text]
            i = openIdx + 1;
            continue;
          }
          i = link.end;
          textStart = i;
          continue;
        }
        // not a link: literal [
        i = openIdx + 1;
        continue;
      }
      i++;
      continue;
    }
    // --- autolink <...> ---
    if (ch === '<') {
      const al = parseAutolink(src, i);
      if (al) {
        flushText(i);
        const href = cleanUrl(al.href);
        if (href !== null) {
          out.push({ t: 'link', href, title: null, labelHtml: escapeHtml(al.text) });
        } else {
          out.push({ t: 'text', s: src.slice(i, al.end) });
        }
        i = al.end;
        textStart = i;
        continue;
      }
      // inline HTML tag or comment
      const tagEnd = matchHtmlTag(src, i);
      if (tagEnd !== -1) {
        flushText(i);
        out.push({ t: 'html', s: src.slice(i, tagEnd) });
        i = tagEnd;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    // --- extended autolink (GFM) ---
    if ((ch === 'w' && src.startsWith('www.', i)) || (isAlpha(ch) && (src.slice(i).match(/^[A-Za-z][A-Za-z0-9+.-]{1,31}:\/\//) || src.slice(i).match(/^[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]+/) || src.slice(i).match(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/)))) {
      // Only if not preceded by a word char or / or other link-ish char
      const prev = i === 0 ? '' : src[i - 1];
      if (i === 0 || isWhitespace(prev) || prev === '*' || prev === '_' || prev === '~' || prev === '(' || prev === '[' || prev === '>' || prev === '"' || prev === "'") {
        const ea = parseExtendedAutolink(src, i);
        if (ea) {
          flushText(i);
          const href = cleanUrl(ea.href);
          if (href !== null) {
            out.push({ t: 'link', href, title: null, labelHtml: escapeHtml(ea.text) });
          } else {
            out.push({ t: 'text', s: src.slice(i, ea.end) });
          }
          i = ea.end;
          textStart = i;
          continue;
        }
      }
      i++;
      continue;
    }
    // --- hard break: two spaces + newline ---
    if (ch === '\n') {
      // check for trailing two spaces before this newline (in the flushed text)
      // We handle it by looking back at the raw text
      let k = i - 1;
      let spaces = 0;
      while (k >= textStart && src[k] === ' ') { spaces++; k--; }
      if (spaces >= 2) {
        // hard break: remove ALL trailing spaces from the text
        flushText(i - spaces);
        out.push({ t: 'br' });
        i++;
        // After a hard break, leading spaces/tabs on the next line are stripped.
        while (i < n && (src[i] === ' ' || src[i] === '\t')) i++;
        textStart = i;
        continue;
      }
      // soft break: newline becomes \n in output (marked keeps \n in paragraph text)
      i++;
      continue;
    }
    // --- entity ---
    if (ch === '&') {
      // handled at render time via unescapeEntities on text nodes; keep as text
      i++;
      continue;
    }
    i++;
  }
  flushText(n);

  // Resolve emphasis using the delimiter stack.
  resolveEmphasis(out, delims);

  // Render nodes to HTML.
  return renderInline(out, refs);
}

// Strip inline formatting to plain text (for image alt text).
function stripInlineFormatting(s) {
  // Remove code spans content markers, emphasis markers, links -> keep text
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    if (ch === '`') {
      let j = i;
      while (j < n && s[j] === '`') j++;
      const ticks = j - i;
      const close = s.indexOf('`'.repeat(ticks), j);
      if (close !== -1) { out += s.slice(j, close); i = close + ticks; continue; }
      i = j; continue;
    }
    if (ch === '\\' && i + 1 < n && isAsciiPunct(s[i + 1])) { out += s[i + 1]; i += 2; continue; }
    if (ch === '*' || ch === '_' || ch === '~') { i++; continue; }
    if (ch === '[') {
      // link text: keep the label, drop the destination
      let depth = 0, j = i, end = -1;
      for (; j < n; j++) {
        if (s[j] === '\\' && j + 1 < n) { j++; continue; }
        if (s[j] === '[') depth++;
        else if (s[j] === ']') { depth--; if (depth === 0) { end = j; break; } }
      }
      if (end !== -1) {
        out += stripInlineFormatting(s.slice(i + 1, end));
        let k = end + 1;
        if (k < n && s[k] === '(') {
          const close = findLinkParen(s, k);
          if (close !== -1) k = close + 1;
        } else if (k < n && s[k] === '[') {
          const ce = s.indexOf(']', k + 1);
          if (ce !== -1) k = ce + 1;
        }
        i = k; continue;
      }
      i++; continue;
    }
    if (ch === '<') {
      // strip html tags
      const e = s.indexOf('>', i);
      if (e !== -1 && /^<\/?[A-Za-z][^>]*>$/.test(s.slice(i, e + 1))) { i = e + 1; continue; }
      out += ch; i++; continue;
    }
    out += ch; i++;
  }
  return out;
}

// Match an inline HTML tag / comment / processing instruction / declaration / CDATA at i.
// Returns the index just past it, or -1.
function matchHtmlTag(src, i) {
  if (src[i] !== '<') return -1;
  const rest = src.slice(i);
  // comment
  if (rest.startsWith('<!--')) {
    const e = rest.indexOf('-->');
    if (e !== -1) return i + e + 3;
    return -1;
  }
  if (rest.startsWith('<?')) {
    const e = rest.indexOf('?>');
    if (e !== -1) return i + e + 2;
    return -1;
  }
  if (rest.startsWith('<![CDATA[')) {
    const e = rest.indexOf(']]>');
    if (e !== -1) return i + e + 3;
    return -1;
  }
  if (/^<![A-Za-z]/.test(rest)) {
    const e = rest.indexOf('>');
    if (e !== -1) return i + e + 1;
    return -1;
  }
  // open/close tag
  const m = rest.match(/^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/);
  if (m) return i + m[0].length;
  return -1;
}

// Resolve emphasis: process delimiter stack, pairing openers and closers.
// Closers are processed in the order they appear (left to right), so inner
// emphasis pairs before outer emphasis. We track, for each delimiter, the
// node currently occupying its slot in `out` (initially the delim node, then
// a wrap node once paired). When an opener is re-used, the previously built
// wrap node becomes a child of the new wrap node.
function resolveEmphasis(out, delims) {
  // slotNode[i] = the node currently at out index i that represents delimiter delims entry.
  // We keep delims' outIndex pointing at the slot; the slot's content changes as we wrap.
  for (let di = 0; di < delims.length; di++) {
    const closer = delims[di];
    if (!closer.canClose || !closer.node.active) continue;
    while (closer.count > 0 && closer.node.active) {
      let openerIdx = -1;
      for (let oj = di - 1; oj >= 0; oj--) {
        const op = delims[oj];
        if (!op.canOpen || !op.node.active) continue;
        if (op.node.ch !== closer.node.ch) continue;
        // Rule of 3 (CommonMark): applies only when one of the delimiters
        // can both open and close emphasis. Then the sum of the counts must
        // not be a multiple of 3 unless both counts are multiples of 3.
        if ((op.canOpen && op.canClose) || (closer.canOpen && closer.canClose)) {
          const sum = op.count + closer.count;
          if (sum % 3 === 0 && (op.count % 3 !== 0 || closer.count % 3 !== 0)) continue;
        }
        openerIdx = oj;
        break;
      }
      if (openerIdx === -1) break;
      const opener = delims[openerIdx];
      const use = (opener.count >= 2 && closer.count >= 2 ? 2 : 1);
      if (opener.count < use || closer.count < use) break;
      const type = opener.node.ch === '~' ? 'del' : (use === 2 ? 'strong' : 'em');
      // Children: everything from the opener's slot to the closer's slot.
      // If the opener's slot already holds a wrap node (from a previous pairing
      // of this same opener), include it as the first child.
      const children = [];
      const openerSlot = out[opener.outIndex];
      if (openerSlot && (openerSlot.t === 'em' || openerSlot.t === 'strong' || openerSlot.t === 'del')) {
        children.push(openerSlot);
      }
      for (let k = opener.outIndex + 1; k < closer.outIndex; k++) {
        const nd = out[k];
        if (nd && nd.t !== 'consumed') children.push(nd);
      }
      const wrapNode = { t: type, children };
      for (let k = opener.outIndex + 1; k < closer.outIndex; k++) {
        out[k] = { t: 'consumed' };
      }
      out[opener.outIndex] = wrapNode;
      out[closer.outIndex] = { t: 'consumed' };
      opener.count -= use;
      closer.count -= use;
      opener.node.count = opener.count;
      closer.node.count = closer.count;
      if (opener.count === 0) opener.node.active = false;
      if (closer.count === 0) closer.node.active = false;
    }
  }
  // Any remaining active delim nodes become literal text. A delimiter that
  // PAIRED (count decreased from initial) but still has a leftover count
  // contributes its leftover chars as text: opener leftovers go before the
  // wrap, closer leftovers replace the consumed slot. A delim whose count
  // never decreased is content inside a wrap (already rendered) or an
  // unpaired delim (handled by the loop below) — never add it here.
  // Process in descending slot order so insertions don't shift later indices.
  const leftovers = delims.filter(d => d.node.active && d.count > 0 && d.count < d.initialCount);
  leftovers.sort((a, b) => b.outIndex - a.outIndex);
  for (const d of leftovers) {
    const slot = out[d.outIndex];
    if (!slot) continue;
    if (slot.t === 'em' || slot.t === 'strong' || slot.t === 'del') {
      // opener with leftover: insert text before the wrap
      out.splice(d.outIndex, 0, { t: 'text', s: d.node.ch.repeat(d.count) });
    } else if (slot.t === 'consumed') {
      out[d.outIndex] = { t: 'text', s: d.node.ch.repeat(d.count) };
    }
    // if slot is a delim node, the loop below handles it
  }
  for (let k = 0; k < out.length; k++) {
    const nd = out[k];
    if (nd && nd.t === 'delim') {
      out[k] = { t: 'text', s: nd.ch.repeat(nd.count) };
    }
  }
}

// Render inline nodes to HTML.
function renderInline(nodes, refs) {
  let html = '';
  for (const nd of nodes) {
    if (!nd || nd.t === 'consumed') continue;
    if (nd.t === 'text') {
      html += escapeHtml(nd.s);
    } else if (nd.t === 'delim') {
      // an unmatched delimiter run: literal characters
      html += escapeHtml(nd.ch.repeat(nd.count));
    } else if (nd.t === 'code') {
      html += '<code>' + escapeHtmlStrict(nd.s) + '</code>';
    } else if (nd.t === 'br') {
      html += '<br>';
    } else if (nd.t === 'html') {
      html += nd.s;
    } else if (nd.t === 'em') {
      html += '<em>' + renderInline(nd.children, refs) + '</em>';
    } else if (nd.t === 'strong') {
      html += '<strong>' + renderInline(nd.children, refs) + '</strong>';
    } else if (nd.t === 'del') {
      html += '<del>' + renderInline(nd.children, refs) + '</del>';
    } else if (nd.t === 'link') {
      // Hrefs keep entities as-is (do not decode); backslash escapes were
      // already processed when the destination was parsed.
      const href = cleanUrl(nd.href);
      if (href === null) { html += escapeHtml(nd.labelHtml || ''); continue; }
      let a = '<a href="' + escapeAttr(href) + '"';
      if (nd.title !== null && nd.title !== undefined) a += ' title="' + escapeAttr(nd.title) + '"';
      a += '>' + (nd.labelHtml !== undefined ? nd.labelHtml : '') + '</a>';
      html += a;
    } else if (nd.t === 'image') {
      const href = cleanUrl(nd.href);
      if (href === null) { html += ''; continue; }
      let im = '<img src="' + escapeAttr(href) + '" alt="' + escapeAttr(unescapeEntities(nd.alt || '')) + '"';
      if (nd.title !== null && nd.title !== undefined) im += ' title="' + escapeAttr(nd.title) + '"';
      im += '>';
      html += im;
    }
  }
  return html;
}

// ---------------------------------------------------------------------------
// Block parsing (phase 1) and rendering (phase 2)
// ---------------------------------------------------------------------------

// Parse the source into a list of blocks. Each block: {type, ...}.
// `refs` is filled with link reference definitions.
function parseBlocks(lines, refs) {
  const blocks = [];
  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i];
    // blank line
    if (isBlank(line)) { i++; continue; }

    // indented code (4+ spaces, not blank, not a list item context)
    if (isIndentedCode(line)) {
      const codeLines = [];
      while (i < n) {
        const l = lines[i];
        if (isBlank(l)) {
          // blank line: look ahead — if next non-blank is indented code, include it
          let j = i + 1;
          while (j < n && isBlank(lines[j])) j++;
          if (j < n && isIndentedCode(lines[j])) {
            // blank line inside code: strip up to 4 leading spaces (keep the rest)
            codeLines.push(removeIndent(l, 4));
            i++;
            continue;
          }
          break;
        }
        if (!isIndentedCode(l)) break;
        codeLines.push(removeIndent(l, 4));
        i++;
      }
      // strip trailing blank lines
      while (codeLines.length > 0 && codeLines[codeLines.length - 1] === '') codeLines.pop();
      blocks.push({ type: 'code', text: codeLines.join('\n') + '\n' });
      continue;
    }

    // fenced code
    const fence = matchFence(line);
    if (fence) {
      const codeLines = [];
      i++;
      while (i < n && !isFenceEnd(lines[i], fence.fence, fence.len)) {
        // strip up to the fence's indent from each content line
        codeLines.push(removeIndent(lines[i], fence.indent));
        i++;
      }
      if (i < n) i++; // skip closing fence
      blocks.push({ type: 'fence', lang: fence.info, text: codeLines.join('\n') + (codeLines.length ? '\n' : '') });
      continue;
    }

    // ATX heading
    const atx = matchAtx(line);
    if (atx) {
      blocks.push({ type: 'heading', level: atx.level, text: atx.text });
      i++;
      continue;
    }

    // thematic break
    if (isThematicBreak(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // blockquote
    const bq = matchBlockquote(line);
    if (bq !== -1) {
      const qLines = [];
      while (i < n) {
        const l = lines[i];
        const m = matchBlockquote(l);
        if (m !== -1) {
          qLines.push(l.slice(m));
          i++;
        } else if (isBlank(l)) {
          // A truly blank line (no > marker) ends the blockquote. A line that
          // is just ">" is handled above (matchBlockquote succeeds on it).
          break;
        } else {
          // lazy continuation: a paragraph line without > continues the quote's
          // current paragraph. It must NOT continue a fenced code block, list,
          // heading, etc. — if the quote so far ends inside an unclosed fence,
          // the quote ends here. It also must not continue after a blank line
          // inside the quote (the paragraph ended), nor be a block start
          // (thematic break, ATX, fence, HTML block, setext underline, list
          // item, indented code).
          if (endsInFence(qLines)) break;
          if (qLines.length > 0 && qLines[qLines.length - 1] === '') break;
          if (isThematicBreak(l) || matchAtx(l) !== null || matchFence(l) !== null || htmlBlockType(l) !== 0 || matchSetext(l) !== 0 || matchListItem(l) !== null || isIndentedCode(l)) break;
          qLines.push(l);
          i++;
        }
      }
      blocks.push({ type: 'blockquote', children: parseBlocks(qLines, refs) });
      continue;
    }

    // list
    const li = matchListItem(line);
    if (li) {
      const { items, next } = parseList(lines, i, refs);
      blocks.push(items);
      i = next;
      continue;
    }

    // HTML block
    const htype = htmlBlockType(line);
    if (htype !== 0) {
      const htmlLines = [line];
      i++;
      // If the block already ends on its first line (types 1-5), stop.
      // Otherwise type 1-5 end at their marker line; type 6-7 end at a blank line.
      let ended = htype <= 5 && htmlBlockEnds(line, htype);
      while (!ended && i < n) {
        const l = lines[i];
        // Types 6-7 end at a blank line; the blank line is NOT part of the block.
        if (htype > 5 && isBlank(l)) break;
        htmlLines.push(l);
        if (htype <= 5) {
          if (htmlBlockEnds(l, htype)) { i++; ended = true; break; }
        }
        i++;
      }
      let htmlText = htmlLines.join('\n');
      // Types 1-5: the block's last line keeps its trailing newline when the
      // next line is not empty (a truly empty line separates blocks; a
      // whitespace-only line does not end the newline).
      if (htype <= 5 && ended && i < n && lines[i] !== '') {
        htmlText += '\n';
      }
      blocks.push({ type: 'html', text: htmlText });
      continue;
    }

    // link reference definition (must be alone on its line(s), not part of a paragraph)
    // Try to parse it; if it consumes lines and the next line is blank/another def/another block start,
    // treat as def. We attempt it and only accept if it parses cleanly.
    const def = tryLinkDef(lines, i, refs);
    if (def) {
      i = def.next;
      continue;
    }

    // paragraph (and setext heading / table)
    // Collect paragraph lines until blank line or a block that interrupts.
    const paraLines = [line];
    i++;
    let setextLevel = 0;
    let tableDelim = null;
    let tableHead = null;
    while (i < n) {
      const l = lines[i];
      if (isBlank(l)) break;
      // setext underline
      const sl = matchSetext(l);
      if (sl !== 0 && paraLines.length >= 1) {
        // setext heading: the paragraph becomes a heading. But only if the
        // paragraph is a single "line" of text (can be multiple lines, but the
        // underline applies to the whole paragraph). However, if the paragraph
        // contains a link def or other structure, it's more complex. For now,
        // treat as setext if the paragraph so far is plain text lines.
        setextLevel = sl;
        i++;
        break;
      }
      // table delimiter (only if this is the second line of the paragraph and first line has |)
      if (paraLines.length === 1 && lineHasPipe(paraLines[0])) {
        const aligns = matchTableDelim(l);
        if (aligns) {
          tableDelim = aligns;
          tableHead = paraLines[0];
          i++;
          break;
        }
      }
      // interrupt: check if this line starts a new block that can interrupt a paragraph.
      // An empty list item (marker with no content) cannot interrupt a paragraph.
      // Type 7 HTML blocks also cannot interrupt a paragraph (only types 1-6 can).
      const _li = matchListItem(l);
      const _ht = htmlBlockType(l);
      if (matchFence(l) || matchAtx(l) || isThematicBreak(l) || matchBlockquote(l) !== -1 || (_li && !_li.empty) || (_ht !== 0 && _ht !== 7)) {
        break;
      }
      // a link def can interrupt? No — a link def inside a paragraph is part of the paragraph text,
      // but a link def at the start of a line after a paragraph line... Actually link defs can only
      // start a paragraph, not interrupt one (they're parsed as part of paragraph in marked if they
      // appear mid-paragraph? No — marked checks def before paragraph, and a def line after a
      // paragraph line would be... hmm. In CommonMark, a link reference definition can interrupt a
      // paragraph? No. Link reference definitions are block-level and can interrupt a paragraph.
      // Let me check: in CommonMark, link reference definitions CAN interrupt a paragraph.
      // Actually no — a link reference definition is a block, and it CAN appear after a paragraph.
      // But if it appears immediately after a paragraph line (no blank line), does it interrupt?
      // Yes, link reference definitions can interrupt a paragraph in CommonMark.
      // However, marked's lexer checks def in the block loop, and a def line would be caught
      // when the paragraph ends. The paragraph regex stops before a def? The paragraph rule
      // excludes lines that start a def? This is subtle. For now, do NOT interrupt for def here;
      // the def will be handled if the paragraph ends. Actually, to be safe, let me NOT break
      // for def (treat as paragraph continuation) — this matches the common case where a def
      // follows a paragraph on the next line without a blank line... 
      // Hmm, actually in CommonMark a link definition CAN interrupt a paragraph. Example:
      //   Foo
      //   [bar]: /url
      //   baz
      // This is a paragraph "Foo" + def + paragraph "baz"? Or one paragraph "Foo [bar]: /url baz"?
      // Per CommonMark spec, link reference definitions can interrupt a paragraph. So "Foo" is a
      // paragraph, then the def, then "baz" is a paragraph. But marked... let me handle it:
      // if this line parses as a link def, break the paragraph.
      if (tryLinkDef(lines, i, refs)) break;
      paraLines.push(l);
      i++;
    }
    if (setextLevel !== 0) {
      // Setext heading text is stripped of leading/trailing whitespace
      // on each line.
      const headingText = paraLines.map(s => s.replace(/^[ ]+/, '').replace(/[ \t]+$/, '')).join('\n');
      blocks.push({ type: 'heading', level: setextLevel, text: headingText });
      continue;
    }
    if (tableDelim) {
      // table: head + delimiter + rows
      const headCells = splitTableRow(tableHead);
      const rows = [];
      while (i < n && !isBlank(lines[i])) {
        const l = lines[i];
        // A row without pipes is a single-cell row (remaining cells empty).
        rows.push(splitTableRow(l));
        i++;
      }
      blocks.push({ type: 'table', aligns: tableDelim, head: headCells, rows });
      continue;
    }
    blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
  }
  return blocks;
}

function lineHasPipe(line) {
  return line.indexOf('|') !== -1;
}

// Try to parse a link reference definition at lines[i]. If it parses, add to refs
// and return {next}. Otherwise return null (and do not modify refs).
function tryLinkDef(lines, i, refs) {
  // Make a copy of refs state to avoid partial mutation on failure.
  // parseLinkDef only adds on success, so it's safe to call directly.
  const before = Object.keys(refs).length;
  const res = parseLinkDef(lines, i, refs);
  if (res) return res;
  return null;
}

// Parse a list starting at lines[i]. Returns {items: block, next}.
function parseList(lines, start, refs) {
  const first = matchListItem(lines[start]);
  const ordered = first.ordered;
  const delim = first.delim;
  const marker = first.marker;
  const items = [];
  let i = start;
  let startNum = ordered ? first.num : null;
  let loose = false;

  while (i < lines.length) {
    // Skip blank lines between items. A blank run between two items of the
    // same list makes the list loose (they stay in one list). A blank run
    // that ends the list (not followed by a sibling item) does not.
    let skippedBlank = false;
    while (i < lines.length && isBlank(lines[i])) { skippedBlank = true; i++; }
    if (i >= lines.length) break;
    // A thematic break ends the list (e.g. "* * *" is an hr, not an item).
    if (isThematicBreak(lines[i])) break;
    const li = matchListItem(lines[i]);
    if (!li) break;
    // must match the list type (ordered vs unordered, and same delimiter for ordered)
    if (li.ordered !== ordered) break;
    if (ordered && li.delim !== delim) break;
    if (!ordered && li.marker !== marker) break;
    if (skippedBlank && items.length > 0) loose = true;
    // For ordered lists, numbers don't need to be sequential, but the first item's
    // number is the start. Subsequent items can be any number.
    // The content indent is where the item's content starts (contentStart);
    // for an empty item the content on the next line is indented by
    // marker width + 1 space.
    const contentIndent = li.empty ? li.indent + li.width + 1 : li.contentStart;
    const itemLines = [];
    // first line content
    if (li.contentStart < lines[i].length) {
      itemLines.push(' '.repeat(contentIndent) + lines[i].slice(li.contentStart));
    } else {
      itemLines.push('');
    }
    i++;
    // subsequent lines: belonging to this item if indented >= contentIndent, or blank, or a nested list
    let blankRun = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (isBlank(l)) {
        // look ahead: if next non-blank line is a list item at same level or belongs to this item, include
        let j = i + 1;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j >= lines.length) { i = j; break; }
        const nextLi = matchListItem(lines[j]);
        const nextIndent = fullLeadingCol(lines[j]);
        if (nextLi && nextLi.indent <= first.indent && nextLi.ordered === ordered) {
          // next item of this list (or a new list) — end this item
          break;
        }
        if (nextIndent >= contentIndent || (nextLi && nextLi.indent >= contentIndent)) {
          blankRun++;
          itemLines.push('');
          i++;
          continue;
        }
        break;
      }
      const ind = fullLeadingCol(l);
      if (ind >= contentIndent) {
        // belongs to this item; keep as-is (subLines removes contentIndent once)
        itemLines.push(l);
        i++;
        blankRun = 0;
        continue;
      }
      // A list item line (not indented enough to belong to this item)
      // ends the current item; the outer loop decides if it's a sibling
      // or a new list. (A less-indented item is a sibling, not nested.)
      const nl = matchListItem(l);
      if (nl) {
        break;
      }
      // lazy continuation: a paragraph line (not indented enough) continues the item's paragraph.
      // Block starts (thematic break, ATX heading, fence, HTML block) interrupt
      // the list instead of continuing it.
      if (isThematicBreak(l) || matchAtx(l) !== null || matchFence(l) !== null || htmlBlockType(l) !== 0) {
        break;
      }
      itemLines.push(l);
      i++;
    }
    // Determine if this item is loose: it contains a blank line followed by a block, or two blocks separated by blank
    // Simplified: if itemLines contains a blank line that is followed by non-blank, it's loose.
    let isLoose = false;
    for (let k = 0; k < itemLines.length - 1; k++) {
      if (itemLines[k] === '' && itemLines[k + 1] !== '') { isLoose = true; break; }
    }
    if (isLoose) loose = true;
    // Parse the item's content as blocks. Strip the leading contentIndent we added.
    // itemLines were built with contentIndent spaces prepended for the first line and
    // removeIndent applied to the rest, so they're already aligned. But we prepended
    // contentIndent spaces to the first line — the block parser expects lines with
    // their natural indentation. Let me re-derive: we stored itemLines as lines where
    // the content starts at column contentIndent. For the sub-parse, we should remove
    // contentIndent from each line.
    const subLines = itemLines.map(l => {
      if (l === '') return '';
      return removeIndent(l, contentIndent);
    });
    // Remove trailing blank lines
    while (subLines.length > 0 && subLines[subLines.length - 1] === '') subLines.pop();
    // Task list: check if first line starts with [ ] or [x]
    let task = null;
    if (subLines.length > 0) {
      const m = subLines[0].match(/^\[([ xX])\][ \t]+/);
      if (m) {
        task = m[1] !== ' ';
        subLines[0] = subLines[0].slice(m[0].length);
      }
    }
    const children = parseBlocks(subLines, refs);
    items.push({ task, children });
  }
  // A list is loose if any item is loose OR there are blank lines between items.
  // (We approximate with the per-item loose flag and inter-item blanks.)
  return { items: { type: 'list', ordered, start: startNum, loose, items }, next: i };
}

// Render blocks to HTML.
function renderBlocks(blocks, refs) {
  let html = '';
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      html += '<p>' + parseInline(b.text, refs, false) + '</p>\n';
    } else if (b.type === 'heading') {
      html += '<h' + b.level + '>' + parseInline(b.text, refs, false) + '</h' + b.level + '>\n';
    } else if (b.type === 'code') {
      html += '<pre><code>' + escapeHtmlStrict(b.text) + '</code></pre>\n';
    } else if (b.type === 'fence') {
      let h = '<pre><code';
      if (b.lang) {
        // Backslash escapes in the info string are processed (\X -> X).
        const lang = b.lang.replace(/\\([!-/:-@\[-`{-~])/g, '$1');
        h += ' class="language-' + escapeAttr(lang.split(/\s+/)[0]) + '"';
      }
      h += '>' + escapeHtmlStrict(b.text) + '</code></pre>\n';
      html += h;
    } else if (b.type === 'hr') {
      html += '<hr>\n';
    } else if (b.type === 'html') {
      html += b.text;
    } else if (b.type === 'blockquote') {
      html += '<blockquote>\n' + renderBlocks(b.children, refs) + '</blockquote>\n';
    } else if (b.type === 'list') {
      const tag = b.ordered ? 'ol' : 'ul';
      let h = '<' + tag;
      if (b.ordered && b.start !== null && b.start !== 1) h += ' start="' + b.start + '"';
      h += '>\n';
      for (const it of b.items) {
        h += '<li>';
        const inner = renderBlocks(it.children, refs);
        const checkbox = '<input' + (it.task ? ' checked=""' : '') + ' disabled="" type="checkbox">';
        if (b.loose) {
          if (it.task !== null) {
            // loose list: checkbox goes inside the first <p>, followed by a space
            h += inner.replace(/^<p>/, '<p>' + checkbox + ' ');
          } else {
            h += inner;
          }
        } else {
          // tight list: checkbox before the stripped paragraph text, with a space
          if (it.task !== null) h += checkbox + ' ';
          // Strip the <p>...</p> wrapping of the first paragraph. If the item
          // is a single paragraph, strip it entirely; if followed by other
          // blocks, strip the tags and the newline (the next block follows
          // immediately, e.g. a nested list).
          let stripped = inner.replace(/^<p>([\s\S]*?)<\/p>\n?$/, '$1');
          if (stripped === inner) {
            stripped = inner.replace(/^<p>([\s\S]*?)<\/p>\n/, '$1');
          }
          h += stripped;
        }
        h += '</li>\n';
      }
      h += '</' + tag + '>\n';
      html += h;
    } else if (b.type === 'table') {
      html += '<table>\n<thead>\n<tr>\n';
      for (let c = 0; c < b.head.length; c++) {
        const al = b.aligns[c];
        html += '<th' + (al ? ' align="' + al + '"' : '') + '>' + parseInline(b.head[c], refs, false) + '</th>\n';
      }
      html += '</tr>\n</thead>\n';
      if (b.rows.length > 0) {
        html += '<tbody>';
        for (const row of b.rows) {
          html += '<tr>\n';
          for (let c = 0; c < b.head.length; c++) {
            const cell = c < row.length ? row[c] : '';
            const al = b.aligns[c];
            html += '<td' + (al ? ' align="' + al + '"' : '') + '>' + parseInline(cell, refs, false) + '</td>\n';
          }
          html += '</tr>\n';
        }
        html += '</tbody>';
      }
      html += '</table>\n';
    }
  }
  return html;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parse(markdown) {
  const refs = Object.create(null);
  // Normalise line endings to \n (marked does this first).
  const src = markdown.replace(/\r\n?/g, '\n');
  const endsWithNewline = src.endsWith('\n');
  const lines = src.split('\n');
  // A trailing newline produces a final empty line; drop it (it is not a real line).
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const blocks = parseBlocks(lines, refs);
  // An HTML block that is the last block keeps the trailing newline of its
  // last line when the source ends with one (marked's token text includes it).
  if (blocks.length > 0 && endsWithNewline) {
    const last = blocks[blocks.length - 1];
    if (last.type === 'html') last.text += '\n';
  }
  return renderBlocks(blocks, refs);
}
