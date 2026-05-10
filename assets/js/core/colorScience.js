/**
 * ColorScience Module
 * 
 * Pure functions for color space conversions.
 * Supports sRGB, XYZ, CIE LAB, HSL, OKLab, and OKLCH.
 * 
 * @module colorScience
 */

const ColorScience = {
    // ─── sRGB / Linear RGB ──────────────────────────────────────────

    srgbToLinear(c) {
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    },

    linearToSrgb(c) {
        return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    },

    // ─── Hex ↔ RGB ─────────────────────────────────────────────────

    hexToRgb(hex) {
        const cleanHex = hex.replace('#', '');
        const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
        const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
        const b = parseInt(cleanHex.slice(4, 6), 16) / 255;
        return { r, g, b };
    },

    rgbToHex(r, g, b) {
        const toHex = (c) => {
            const hex = Math.round(Math.max(0, Math.min(255, c * 255))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return '#' + toHex(r) + toHex(g) + toHex(b);
    },

    // ─── OKLab (Björn Ottosson) ────────────────────────────────────

    linearRgbToOklab(r, g, b) {
        const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
        const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
        const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

        const l_ = Math.cbrt(l);
        const m_ = Math.cbrt(m);
        const s_ = Math.cbrt(s);

        return {
            L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
        };
    },

    oklabToLinearRgb(L, a, b) {
        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

        const l = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;

        return {
            r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        };
    },

    // ─── OKLCH ─────────────────────────────────────────────────────

    hexToOklch(hex) {
        const rgb = this.hexToRgb(hex);
        const rLin = this.srgbToLinear(rgb.r);
        const gLin = this.srgbToLinear(rgb.g);
        const bLin = this.srgbToLinear(rgb.b);
        const lab = this.linearRgbToOklab(rLin, gLin, bLin);

        const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
        const H = C < 0.0001
            ? 0
            : (Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360;

        return { L: lab.L, C, H };
    },

    oklchToHex(L, C, H) {
        const hRad = H * Math.PI / 180;
        const a = C * Math.cos(hRad);
        const b = C * Math.sin(hRad);
        const lin = this.oklabToLinearRgb(L, a, b);

        const r = this.linearToSrgb(Math.max(0, Math.min(1, lin.r)));
        const g = this.linearToSrgb(Math.max(0, Math.min(1, lin.g)));
        const bOut = this.linearToSrgb(Math.max(0, Math.min(1, lin.b)));

        return this.rgbToHex(r, g, bOut);
    },

    /**
     * Format OKLCH to CSS string.
     * 3 decimal places, trailing zeros dropped, -0 → 0.
     */
    oklchToString(L, C, H) {
        const fmt = (n) => {
            const v = parseFloat(n.toFixed(3));
            return Object.is(v, -0) ? 0 : v;
        };
        return `oklch(${fmt(L)} ${fmt(C)} ${fmt(H)})`;
    },

    // ─── Gamut helpers ─────────────────────────────────────────────

    isInSrgbGamut(L, C, H) {
        const hRad = H * Math.PI / 180;
        const a = C * Math.cos(hRad);
        const b = C * Math.sin(hRad);
        const lin = this.oklabToLinearRgb(L, a, b);

        const EPS = -0.0001;
        const MAX = 1.0001;
        return lin.r >= EPS && lin.r <= MAX &&
               lin.g >= EPS && lin.g <= MAX &&
               lin.b >= EPS && lin.b <= MAX;
    },

    /**
     * Binary-search for the maximum chroma at a given L and H
     * that remains within the sRGB gamut.
     */
    findMaxChroma(L, H, tolerance = 0.001) {
        if (L <= 0.0001 || L >= 0.9999) return 0;

        let low = 0;
        let high = 0.4;

        while (high - low > tolerance) {
            const mid = (low + high) / 2;
            if (this.isInSrgbGamut(L, mid, H)) {
                low = mid;
            } else {
                high = mid;
            }
        }

        return low;
    },

    /**
     * Clamp an OKLCH color into sRGB gamut by reducing chroma.
     */
    clampToSrgb(L, C, H) {
        if (this.isInSrgbGamut(L, C, H)) return { L, C, H };
        const maxC = this.findMaxChroma(L, H);
        return { L, C: Math.min(C, maxC), H };
    },

    // ─── XYZ (D65) — kept for legacy CIE LAB paths ────────────────

    srgbToXyz(r, g, b) {
        const rLin = this.srgbToLinear(r);
        const gLin = this.srgbToLinear(g);
        const bLin = this.srgbToLinear(b);

        const x = rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375;
        const y = rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.0721750;
        const z = rLin * 0.0193339 + gLin * 0.1191920 + bLin * 0.9503041;

        return { x: x * 100, y: y * 100, z: z * 100 };
    },

    xyzToSrgb(x, y, z) {
        x /= 100;
        y /= 100;
        z /= 100;

        let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
        let g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
        let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

        r = this.linearToSrgb(r);
        g = this.linearToSrgb(g);
        b = this.linearToSrgb(b);

        return { r, g, b };
    },

    // ─── CIE LAB — kept for legacy paths ───────────────────────────

    xyzToLab(x, y, z) {
        const xn = 95.047;
        const yn = 100.000;
        const zn = 108.883;

        const fx = this.labF(x / xn);
        const fy = this.labF(y / yn);
        const fz = this.labF(z / zn);

        return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
    },

    labToXyz(L, a, b) {
        const xn = 95.047;
        const yn = 100.000;
        const zn = 108.883;

        const fy = (L + 16) / 116;
        const fx = a / 500 + fy;
        const fz = fy - b / 200;

        return { x: xn * this.labInvF(fx), y: yn * this.labInvF(fy), z: zn * this.labInvF(fz) };
    },

    labF(t) {
        const delta = 6 / 29;
        return t > delta ** 3 ? Math.pow(t, 1 / 3) : t / (3 * delta ** 2) + 4 / 29;
    },

    labInvF(t) {
        const delta = 6 / 29;
        return t > delta ? t ** 3 : 3 * delta ** 2 * (t - 4 / 29);
    },

    hexToLab(hex) {
        const rgb = this.hexToRgb(hex);
        const xyz = this.srgbToXyz(rgb.r, rgb.g, rgb.b);
        return this.xyzToLab(xyz.x, xyz.y, xyz.z);
    },

    labToHex(L, a, b) {
        const xyz = this.labToXyz(L, a, b);
        const rgb = this.xyzToSrgb(xyz.x, xyz.y, xyz.z);
        return this.rgbToHex(rgb.r, rgb.g, rgb.b);
    },

    // ─── HSL — kept for legacy paths ───────────────────────────────

    hexToHsl(hex) {
        const rgb = this.hexToRgb(hex);
        const r = rgb.r, g = rgb.g, b = rgb.b;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return { h: h * 360, s: s * 100, l: l * 100 };
    },

    hslToHex(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return this.rgbToHex(r, g, b);
    },

    // ─── Validation ────────────────────────────────────────────────

    isValidHex(hex) {
        return /^#[0-9A-F]{6}$/i.test(hex);
    }
};

export default ColorScience;
