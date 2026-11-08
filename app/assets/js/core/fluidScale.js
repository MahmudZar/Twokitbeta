/**
 * Core Framework fluid scale.
 *
 * size = base * ratio ^ (stepIndex - baseScaleIndex)
 * slope = (max - min) / (maxVw - minVw)
 * clamp(round(smaller), calc(round(slope*100)vw + round(intercept)), round(larger))
 */

export const SIZES = [
    '25xs', '24xs', '23xs', '21xs', '20xs', '19xs', '18xs', '17xs', '16xs',
    '15xs', '14xs', '13xs', '12xs', '11xs', '10xs', '9xs', '8xs', '7xs',
    '6xs', '5xs', '4xs', '3xs', '2xs', 'xs', 's', 'm', 'l', 'xl',
    '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl', '10xl',
    '11xl', '12xl', '13xl', '14xl', '15xl', '16xl', '17xl', '18xl',
    '19xl', '20xl', '21xl', '22xl', '23xl', '24xl', '25xl'
];

export const TYPE_RATIOS = [
    { value: 1.125, label: 'Major Second' },
    { value: 1.2, label: 'Minor Third' },
    { value: 1.25, label: 'Major Third' },
    { value: 1.333, label: 'Perfect Fourth' },
    { value: 1.414, label: 'Augmented Fourth' },
    { value: 1.5, label: 'Perfect Fifth' }
];

export const SPACING_RATIOS = TYPE_RATIOS;

export const CORE_TYPE_RATIOS = { mobile: 1.2, desktop: 1.333 };
export const CORE_SPACING_RATIOS = { mobile: 1.25, desktop: 1.414 };

export const DEFAULT_TYPE_STEPS = 'xs,s,m,l,xl,2xl,3xl,4xl';
export const DEFAULT_TYPE_BASE = 2;
export const DEFAULT_SPACING_STEPS = '4xs,3xs,2xs,xs,s,m,l,xl,2xl,3xl,4xl';
export const DEFAULT_SPACING_BASE = 5;

export function round(value) {
    return Number(Number(value).toFixed(2));
}

export function pxToRem(px, rootFontSize = 16) {
    return `${round(px / rootFontSize)}rem`;
}

export function parseSteps(steps) {
    return String(steps || '')
        .split(',')
        .map((step) => step.trim())
        .filter(Boolean);
}

export function stepLabel(step) {
    return String(step || '').toUpperCase();
}

export function incrementSizeSuffix(steps, direction) {
    const list = parseSteps(steps);
    if (!list.length) return steps;
    if (direction === 'DOWN') {
        const added = SIZES[SIZES.indexOf(list[list.length - 1]) + 1];
        return added ? [...list, added].join(',') : list.join(',');
    }
    const added = SIZES[SIZES.indexOf(list[0]) - 1];
    return added ? [added, ...list].join(',') : list.join(',');
}

export function nextStep(steps, edge) {
    const list = parseSteps(steps);
    if (!list.length) return null;
    if (edge === 'after') return SIZES[SIZES.indexOf(list[list.length - 1]) + 1] || null;
    return SIZES[SIZES.indexOf(list[0]) - 1] || null;
}

export function addStepBefore(steps, baseScaleIndex) {
    const next = incrementSizeSuffix(steps, 'UP');
    if (next === parseSteps(steps).join(',')) return { steps: next, baseScaleIndex };
    return {
        steps: next,
        baseScaleIndex: Math.min(baseScaleIndex + 1, parseSteps(steps).length)
    };
}

export function addStepAfter(steps, baseScaleIndex) {
    const next = incrementSizeSuffix(steps, 'DOWN');
    if (next === parseSteps(steps).join(',')) return { steps: next, baseScaleIndex };
    return {
        steps: next,
        baseScaleIndex: Math.min(baseScaleIndex, parseSteps(next).length - 1)
    };
}

export function removeStepBefore(steps, baseScaleIndex) {
    const list = parseSteps(steps);
    if (list.length <= 1) return { steps: list.join(','), baseScaleIndex };
    const selected = list[baseScaleIndex];
    const next = list.slice(1);
    const found = next.indexOf(selected);
    return {
        steps: next.join(','),
        baseScaleIndex: Math.max(Math.min(found === -1 ? 0 : found, next.length - 1), 0)
    };
}

export function removeStepAfter(steps, baseScaleIndex) {
    const list = parseSteps(steps);
    if (list.length <= 1) return { steps: list.join(','), baseScaleIndex };
    const selected = list[baseScaleIndex];
    const next = list.slice(0, -1);
    const found = next.indexOf(selected);
    return {
        steps: next.join(','),
        baseScaleIndex: Math.max(Math.min(found === -1 ? 0 : found, next.length - 1), 0)
    };
}

export function calculateClamp(minSize, maxSize, minVw, maxVw, rootFontSize = 16) {
    const slope = (maxSize - minSize) / (maxVw - minVw);
    const intercept = minSize - slope * minVw;
    // Steps below the base can be smaller on desktop (max ratio > min ratio). clamp()
    // with a lower bound above the upper one always returns the lower bound, so the
    // bounds go smallest first and the size still shrinks along the slope.
    const low = pxToRem(round(Math.min(minSize, maxSize)), rootFontSize);
    const high = pxToRem(round(Math.max(minSize, maxSize)), rootFontSize);
    const preferred = `${round(slope * 100)}vw + ${pxToRem(round(intercept), rootFontSize)}`;
    return `clamp(${low}, calc(${preferred}), ${high})`;
}

export function generateFluidScale({
    steps,
    baseScaleIndex,
    minBase,
    maxBase,
    minRatio,
    maxRatio,
    minViewport,
    maxViewport,
    nameOf,
    rootFontSize = 16
}) {
    return parseSteps(steps).map((step, index) => {
        const exponent = index - Number(baseScaleIndex);
        const minSize = Number(minBase) * Math.pow(Number(minRatio), exponent);
        const maxSize = Number(maxBase) * Math.pow(Number(maxRatio), exponent);
        const minSizePx = round(minSize);
        const maxSizePx = round(maxSize);
        const name = nameOf ? nameOf(step) : step;
        return {
            name,
            step,
            label: stepLabel(step),
            exponent,
            isBase: index === Number(baseScaleIndex),
            minSizePx,
            maxSizePx,
            minSizeRem: pxToRem(minSizePx, rootFontSize),
            maxSizeRem: pxToRem(maxSizePx, rootFontSize),
            clamp: calculateClamp(minSize, maxSize, minViewport, maxViewport, rootFontSize)
        };
    });
}
