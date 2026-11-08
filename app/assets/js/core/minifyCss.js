/**
 * Small, safe CSS minifier for TwoKit's own output (the WordPress plugin's
 * closed-mode files). Strings and url() are kept byte for byte; comments go;
 * whitespace collapses; spaces around { } ; , > and after : are dropped.
 * Spaces around + and - stay (calc() needs them), and so does the space
 * before ":" (it is a descendant combinator in `a :is(b)`).
 *
 * @module minifyCss
 */

export function minifyCss(css) {
    const source = String(css);
    let out = '';
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        // Strings: copy as is.
        if (ch === '"' || ch === "'") {
            let j = i + 1;
            while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
            out += source.slice(i, j + 1);
            i = j + 1;
            continue;
        }
        // Comments: drop.
        if (ch === '/' && source[i + 1] === '*') {
            const end = source.indexOf('*/', i + 2);
            i = end === -1 ? source.length : end + 2;
            continue;
        }
        // url(...) without quotes: copy as is.
        if (/url\($/i.test(source.slice(Math.max(0, i - 3), i + 1)) && source[i + 1] !== '"' && source[i + 1] !== "'") {
            const end = source.indexOf(')', i);
            out += source.slice(i, end === -1 ? source.length : end + 1);
            i = end === -1 ? source.length : end + 1;
            continue;
        }
        // Whitespace: one space at most, none next to punctuation.
        if (/\s/.test(ch)) {
            while (i < source.length && /\s/.test(source[i])) i++;
            const prev = out[out.length - 1];
            const next = source[i];
            if (!prev || /[{};,>(]/.test(prev) || next === undefined || /[{};,>)!]/.test(next)) continue;
            out += ' ';
            continue;
        }
        if (ch === ':' && /\s/.test(source[i + 1] || '') && /[\w-]$/.test(out) && /[;{]\s*-*[a-z][\w-]*$/i.test(out.slice(-80))) {
            // property: value → property:value
            out += ':';
            i++;
            while (i < source.length && /\s/.test(source[i])) i++;
            continue;
        }
        out += ch;
        i++;
    }
    return out.replace(/;}/g, '}').trim();
}
