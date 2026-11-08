/**
 * Tiny syntax highlighter for the app's code blocks (CSS and JSON).
 * Returns escaped HTML with <span class="tok-*"> wrappers; textContent of
 * the result is the original code, so copy buttons keep working.
 *
 * @module highlight
 */

import { esc } from './components.js';

const span = (cls, text) => `<span class="tok-${cls}">${esc(text)}</span>`;

/* ---------------- CSS ---------------- */

const CSS_TOKEN = new RegExp([
    /(\/\*[\s\S]*?(?:\*\/|$))/.source, // 1 comment
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/.source, // 2 string
    /(@[\w-]+)/.source, // 3 at-rule
    /(--[\w-]+)/.source, // 4 custom property
    /(#[0-9a-fA-F]{3,8}\b)/.source, // 5 hex color
    /([\w-]+(?=\())/.source, // 6 function
    /(-?(?:\d+\.?\d*|\.\d+)(?:[a-zA-Z%]+)?)/.source, // 7 number + unit
    /([\w-]+)/.source, // 8 word
    /([{}();:,])/.source, // 9 punctuation
    /(\s+|.)/.source // 10 anything else
].join('|'), 'g');

/** Next of { ; } after `from`, skipping comments and strings. */
function nextDelimiter(code, from) {
    for (let i = from; i < code.length; i++) {
        const c = code[i];
        if (c === '/' && code[i + 1] === '*') {
            const end = code.indexOf('*/', i + 2);
            if (end < 0) return null;
            i = end + 1;
        } else if (c === '"' || c === "'") {
            const end = code.indexOf(c, i + 1);
            if (end < 0) return null;
            i = end;
        } else if (c === '{' || c === ';' || c === '}') return c;
    }
    return null;
}

export function highlightCss(code) {
    let out = '';
    // sel: selector or at-rule prelude · prop: declaration name · val: value
    let mode = null;
    let parens = 0;
    const statement = (at) => (nextDelimiter(code, at) === '{' ? 'sel' : 'prop');
    CSS_TOKEN.lastIndex = 0;
    let m;
    while ((m = CSS_TOKEN.exec(code))) {
        const [text, comment, string, at, custom, hex, fn, num, word, punct] = m;
        if (comment) { out += span('comment', text); continue; }
        if (!mode && !/^\s+$/.test(text)) mode = statement(m.index);
        if (string) { out += span('str', text); continue; }
        if (mode === 'sel') {
            if (at) out += span('at', text);
            else if (punct === '{') { out += span('punc', text); mode = null; }
            else if (mode === 'sel' && /^\s+$/.test(text)) out += text;
            else out += span('sel', text);
            continue;
        }
        if (punct === '{' || punct === '}' || (punct === ';' && parens === 0)) {
            out += span('punc', text);
            mode = null;
            parens = 0;
            continue;
        }
        if (mode === 'prop') {
            if (punct === ':') { out += span('punc', text); mode = 'val'; }
            else if (custom) out += span('var', text);
            else if (word || fn) out += span('prop', text);
            else out += esc(text);
            continue;
        }
        // value
        if (punct === '(') parens++;
        if (punct === ')') parens = Math.max(0, parens - 1);
        if (custom) out += span('var', text);
        else if (hex) out += span('num', text);
        else if (fn) out += span('fn', text);
        else if (num) out += span('num', text);
        else if (at) out += span('at', text);
        else if (word) out += span(/^!?important$/.test(text) ? 'at' : 'kw', text);
        else if (punct) out += span('punc', text);
        else out += esc(text);
    }
    // One span per selector run instead of one per fragment.
    return out.replace(/<\/span><span class="tok-sel">/g, '').replace(/(<span class="tok-sel">[^<]*)<\/span>(\s+)<span class="tok-sel">/g, '$1$2');
}

/* ---------------- JSON ---------------- */

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])|(\s+|.)/g;

export function highlightJson(code) {
    let out = '';
    JSON_TOKEN.lastIndex = 0;
    let m;
    while ((m = JSON_TOKEN.exec(code))) {
        const [text, str, colon, lit, num, punct] = m;
        if (str) {
            out += colon ? `${span('key', str)}${esc(colon)}` : span('str', str);
            // CSS inside a string (Bricks class CSS) stays a plain string.
        } else if (lit) out += span('kw', text);
        else if (num) out += span('num', text);
        else if (punct) out += span('punc', text);
        else out += esc(text);
    }
    return out;
}

/** Highlight by content: JSON when it starts with { or [ and has quoted keys, CSS otherwise. */
export function highlight(code, lang) {
    const text = String(code ?? '');
    const kind = lang || (/^\s*[[{]\s*"/.test(text) ? 'json' : 'css');
    if (kind === 'json') return highlightJson(text);
    if (kind === 'text') return esc(text);
    return highlightCss(text);
}

export default highlight;
