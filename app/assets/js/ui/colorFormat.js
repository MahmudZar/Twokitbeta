import ColorScience from '../core/colorScience.js';

const FORMATS = ['hex', 'oklch', 'rgb'];

export function formatColor(hex, mode = 'hex') {
    if (!hex || !ColorScience.isValidHex(hex)) return hex || '';
    if (mode === 'rgb') {
        const { r, g, b } = ColorScience.hexToRgb(hex);
        return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
    }
    if (mode === 'oklch') {
        const { L, C, H } = ColorScience.hexToOklch(hex);
        return ColorScience.oklchToString(L, C, H);
    }
    return hex.toUpperCase();
}

export function nextFormat(mode) {
    const i = FORMATS.indexOf(mode);
    return FORMATS[(i + 1) % FORMATS.length];
}

/** Black or white ink, same idea as CSS contrast-color() using WCAG luminance. */
export function inkFor(hex) {
    try {
        const { r, g, b } = ColorScience.hexToRgb(hex);
        const luminance = 0.2126 * ColorScience.srgbToLinear(r)
            + 0.7152 * ColorScience.srgbToLinear(g)
            + 0.0722 * ColorScience.srgbToLinear(b);
        const white = 1.05 / (luminance + 0.05);
        const black = (luminance + 0.05) / 0.05;
        return white >= black ? '#ffffff' : '#111111';
    } catch {
        return '#111111';
    }
}

export function randomBrandHex() {
    const H = Math.random() * 360;
    const L = 0.62;
    const maxC = ColorScience.findMaxChroma(L, H);
    return ColorScience.oklchToHex(L, maxC * 0.72, H);
}
