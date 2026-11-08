/**
 * TypeMeter: what a line-height formula or letter spacing really computes to,
 * measured with the role's font in this document (fonts are loaded here too).
 * ex-based formulas depend on the font's x-height, so they can't be worked out
 * on paper. One hidden probe, reused; synchronous, cheap enough for slider drags.
 *
 * @module typeMeter
 */

let probe = null;

function el(stack, weight, sizePx) {
    if (!probe?.isConnected) {
        probe = document.createElement('span');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;display:block';
        probe.textContent = 'Hxg';
        document.body.append(probe);
    }
    probe.style.fontFamily = stack || 'sans-serif';
    probe.style.fontWeight = String(weight || 400);
    probe.style.fontSize = `${sizePx}px`;
    probe.style.lineHeight = '';
    probe.style.letterSpacing = '';
    probe.style.width = '';
    return probe;
}

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

const TypeMeter = {
    /** The font's x-height in px at `sizePx` (1ex). */
    exPx(stack, weight, sizePx) {
        const p = el(stack, weight, sizePx);
        p.style.width = '100ex';
        const w = p.getBoundingClientRect().width / 100;
        return w > 0 ? w : sizePx * 0.5;
    },

    /** Line height / font size for `formula` at `sizePx`, or null when the formula is invalid CSS. */
    lineRatio(formula, stack, weight, sizePx) {
        const p = el(stack, weight, sizePx);
        p.style.lineHeight = formula;
        if (!p.style.lineHeight) return null; // the browser rejected it
        const px = parseFloat(getComputedStyle(p).lineHeight);
        return Number.isFinite(px) ? round(px / sizePx) : null;
    },

    /** Letter spacing in em at `sizePx` (px values, calc() …), or null when invalid. */
    letterEm(value, stack, weight, sizePx) {
        const p = el(stack, weight, sizePx);
        p.style.letterSpacing = value;
        if (!p.style.letterSpacing) return null;
        const px = parseFloat(getComputedStyle(p).letterSpacing);
        return Number.isFinite(px) ? round(px / sizePx, 4) : 0; // "normal" → 0
    },

    /** True when `value` is valid CSS for `property` on its own. */
    valid(property, value) {
        return CSS.supports(property, value);
    }
};

export default TypeMeter;
