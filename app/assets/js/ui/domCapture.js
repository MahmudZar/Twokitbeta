/**
 * Capture a color ramp as it appears on screen.
 * Builds a real SVG (rects + text) from live layout so the viewBox
 * matches the browser box, then rasterizes that SVG for PNG.
 */

function escapeXml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function rel(el, root) {
    const a = el.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    return {
        x: a.left - b.left,
        y: a.top - b.top,
        w: a.width,
        h: a.height
    };
}

function round(n) {
    return Math.round(n * 100) / 100;
}

function parseRadius(style, fallback = 4) {
    const value = parseFloat(style.borderRadius);
    return Number.isFinite(value) ? value : fallback;
}

function measureLines(text, maxWidth, font) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    const width = Math.max(8, maxWidth);
    const lines = [];
    let line = '';
    for (const ch of String(text)) {
        if (ctx.measureText(line + ch).width > width && line) {
            lines.push(line);
            line = ch;
        } else {
            line += ch;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function textSvg(el, root) {
    const box = rel(el, root);
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize) || 12;
    const fontFamily = style.fontFamily || 'Inter, sans-serif';
    const fontWeight = style.fontWeight || '400';
    const fill = style.color || '#fff';
    const opacity = style.opacity === '1' ? '' : ` opacity="${style.opacity}"`;
    const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const lines = measureLines(el.textContent.trim(), box.w, font);
    const lineHeight = fontSize * 1.15;
    const startY = box.y + (box.h - lineHeight * (lines.length - 1)) / 2;
    const badge = el.classList.contains('ramp__base')
        ? `<rect x="${round(box.x)}" y="${round(box.y)}" width="${round(box.w)}" height="${round(box.h)}" rx="${round(Math.min(parseRadius(style, 999), box.h / 2))}" fill="${escapeXml(style.backgroundColor)}"/>`
        : '';
    const nodes = lines.map((line, i) => (
        `<text x="${round(box.x + box.w / 2)}" y="${round(startY + i * lineHeight)}" text-anchor="middle" dominant-baseline="central" fill="${escapeXml(fill)}" font-size="${fontSize}" font-family="${escapeXml(fontFamily)}" font-weight="${escapeXml(fontWeight)}"${opacity}>${escapeXml(line)}</text>`
    )).join('');
    return `${badge}${nodes}`;
}

export function rampToSvg(ramp) {
    const box = ramp.getBoundingClientRect();
    const width = round(box.width);
    const height = round(box.height);
    if (width < 2 || height < 2) throw new Error('Ramp is not visible');

    const radius = parseRadius(getComputedStyle(ramp));
    const clipId = `ramp-clip-${Math.random().toString(36).slice(2, 8)}`;
    const shades = [...ramp.querySelectorAll('.ramp__shade')];

    const columns = shades.map((shade) => {
        const r = rel(shade, ramp);
        const fill = shade.dataset.hex || getComputedStyle(shade).backgroundColor;
        const labels = [...shade.querySelectorAll('.ramp__base, .ramp__step, .ramp__value')]
            .map((node) => textSvg(node, ramp))
            .join('');
        return `<rect x="${round(r.x)}" y="${round(r.y)}" width="${round(r.w)}" height="${round(r.h)}" fill="${escapeXml(fill)}"/>${labels}`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><clipPath id="${clipId}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}"/></clipPath></defs>
  <g clip-path="url(#${clipId})">${columns}</g>
</svg>`;
}

export function svgToPngBlob(svg, width, height) {
    const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
    return new Promise((resolve, reject) => {
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('Could not create PNG'))), 'image/png');
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not rasterize SVG'));
        };
        img.src = url;
    });
}

export async function copyRampImage(ramp) {
    const svg = rampToSvg(ramp);
    const { width, height } = ramp.getBoundingClientRect();
    const png = await svgToPngBlob(svg, width, height);
    if (!navigator.clipboard?.write || !window.ClipboardItem) {
        throw new Error('Image clipboard is not available');
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

export async function copyRampSvg(ramp) {
    const svg = rampToSvg(ramp);
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard is not available');
    await navigator.clipboard.writeText(svg);
}

export function findRamp(from) {
    return from?.closest('[data-preview-palette]')?.querySelector('.ramp')
        || from?.closest('.preview-card')?.querySelector('.ramp');
}
