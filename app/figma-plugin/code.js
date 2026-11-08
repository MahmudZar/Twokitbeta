/**
 * TwoKit for Figma: the TwoKit app (ui.html, built from app/) plus this
 * sandbox, which keeps the project with the file and applies it.
 *
 *   Storage        the project is kept per Figma file in clientStorage (this
 *                  user, this machine): one id is written into the file once,
 *                  so autosaves never touch the file or its undo history
 *   Apply          imports a TwoKit Figma package (schema "twokit/figma"):
 *
 *   Variables      collections and modes (Primitives · Theme Light/Dark ·
 *                  Typography and Spacing Desktop/Mobile), aliases, scopes,
 *                  and CSS code syntax (var(--name))
 *   Text styles    bound to the Typography variables (size, line height,
 *                  family), so switching Desktop / Mobile resizes them
 *   Effect styles  shadows; every layer color bound to a Theme variable, so
 *                  one style is right in Light and in Dark
 *   Color styles   optional, bound to the Theme variables
 *
 * Re-importing updates everything in place, matched by name. Items TwoKit
 * created carry plugin data, so "remove what's gone" only touches those.
 * When the plan limits modes, a collection is split into one collection per
 * mode ("Theme · Light", "Theme · Dark") and styles are made per mode.
 *
 * Written without optional chaining, nullish coalescing and object spread,
 * which Figma's plugin sandbox has not always supported.
 */

var OWNER = 'twokit';
var SCHEMA = 'twokit/figma';
var SUPPORTED_VERSION = 1;

figma.showUI(__html__, { width: 1200, height: 780, themeColors: false, title: 'TwoKit' });

/* ------------------------------------------------------------------ */
/* Project storage                                                     */
/* ------------------------------------------------------------------ */

var UI_KEY = 'twokit-ui';

/** One id per Figma file, written once; the project is stored under it. */
function fileId() {
    var id = figma.root.getPluginData('twokit-file');
    if (!id) {
        id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        figma.root.setPluginData('twokit-file', id);
    }
    return id;
}

/** Workspace preferences belong to the user; everything else to the file. */
function storageKey(key) {
    return key === UI_KEY ? 'ui' : 'file:' + fileId() + ':' + key;
}

async function storageLoad() {
    var keys = ['twokit-project-autosave', 'twokit-project-meta', UI_KEY];
    var data = {};
    for (var i = 0; i < keys.length; i++) {
        var value = await figma.clientStorage.getAsync(storageKey(keys[i]));
        if (typeof value === 'string') data[keys[i]] = value;
    }
    return data;
}

function storageSet(key, value) {
    if (typeof key !== 'string' || key.indexOf('twokit-') !== 0) return Promise.resolve();
    return value === null ? figma.clientStorage.deleteAsync(storageKey(key)) : figma.clientStorage.setAsync(storageKey(key), String(value));
}

function post(type, data) {
    figma.ui.postMessage({ type: type, data: data });
}

function progress(label, done, total) {
    post('progress', { label: label, done: done, total: total });
}

figma.ui.onmessage = function (msg) {
    if (!msg || !msg.type) return;
    if (msg.type === 'open-url' && /^https:\/\//.test(msg.url)) {
        figma.openExternal(msg.url);
        return;
    }
    if (msg.type === 'close') {
        figma.closePlugin();
        return;
    }
    if (msg.type === 'storage-load') {
        // `applied`: when TwoKit last wrote this file's variables, so the UI offers an update.
        var applied = figma.root.getPluginData('twokit-applied');
        storageLoad().then(function (data) { post('storage', { store: data, applied: applied }); }, function () { post('storage', { store: {}, applied: applied }); });
        return;
    }
    if (msg.type === 'storage-set') {
        storageSet(msg.key, msg.value).catch(function (error) { console.warn('TwoKit: could not save the project', error); });
        return;
    }
    if (msg.type === 'remove-all') {
        removeAll().then(function (report) {
            figma.closePlugin('TwoKit removed: ' + report.variables + ' variables, ' + report.styles + ' styles, ' + report.collections + ' collections');
        }).catch(function (error) {
            console.error(error);
            post('error', { message: error && error.message ? error.message : String(error) });
        });
        return;
    }
    if (msg.type === 'notify' && typeof msg.message === 'string') {
        figma.notify(msg.message.slice(0, 200));
        return;
    }
    var run = msg.type === 'inspect' ? inspect(msg.pkg) : msg.type === 'import' ? importPackage(msg.pkg, msg.options || {}) : null;
    if (!run) return;
    run.then(function (result) {
        post(msg.type === 'inspect' ? 'inspection' : 'done', result);
    }).catch(function (error) {
        console.error(error);
        post('error', { message: error && error.message ? error.message : String(error) });
    });
};

/* ------------------------------------------------------------------ */
/* Package                                                             */
/* ------------------------------------------------------------------ */

function list(value) {
    return Array.isArray(value) ? value : [];
}

function validate(pkg) {
    if (!pkg || pkg.$schema !== SCHEMA) throw new Error('This is not a TwoKit Figma package.');
    if (Number(pkg.version) > SUPPORTED_VERSION) throw new Error('This package was made by a newer TwoKit. Update the plugin, then import it again.');
    return {
        meta: pkg.meta || {},
        fonts: list(pkg.fonts),
        collections: list(pkg.collections).filter(function (c) { return c && c.name && list(c.modes).length; }),
        textStyles: list(pkg.textStyles),
        effectStyles: list(pkg.effectStyles),
        paintStyles: list(pkg.paintStyles)
    };
}

/** Figma variable names can't contain . { } — replace them, trim empty segments. */
function cleanName(name) {
    return String(name || '')
        .replace(/[.{}$]/g, '-')
        .split('/')
        .map(function (s) { return s.trim(); })
        .filter(Boolean)
        .join('/') || 'unnamed';
}

function color(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3 || h.length === 4) h = h.split('').map(function (c) { return c + c; }).join('');
    if (h.length === 6) h += 'FF';
    var n = function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; };
    var c = { r: n(0), g: n(2), b: n(4), a: n(6) };
    if (!isFinite(c.r) || !isFinite(c.g) || !isFinite(c.b)) return { r: 0, g: 0, b: 0, a: 1 };
    if (!isFinite(c.a)) c.a = 1;
    return c;
}

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

var WEIGHTS = [
    [100, ['thin', 'hairline']],
    [200, ['extralight', 'ultralight']],
    [300, ['light']],
    [400, ['regular', 'normal', 'book', 'roman', '']],
    [500, ['medium']],
    [600, ['semibold', 'demibold']],
    [700, ['bold']],
    [800, ['extrabold', 'ultrabold']],
    [900, ['black', 'heavy']]
];

/** "SemiBold Italic" → { weight: 600, italic: true }. Unknown names → null weight. */
function describeStyle(style) {
    var s = String(style).toLowerCase();
    var italic = /italic|oblique/.test(s);
    var core = s.replace(/italic|oblique/g, '').replace(/[\s_-]+/g, '');
    for (var i = 0; i < WEIGHTS.length; i++) {
        if (WEIGHTS[i][1].indexOf(core) >= 0) return { weight: WEIGHTS[i][0], italic: italic };
    }
    return { weight: null, italic: italic };
}

var fontIndex = null;

/** family (lowercase) → { family, styles: [{ style, weight, italic }] } */
async function fonts() {
    if (fontIndex) return fontIndex;
    var available = await figma.listAvailableFontsAsync();
    fontIndex = {};
    for (var i = 0; i < available.length; i++) {
        var f = available[i].fontName;
        var key = f.family.toLowerCase();
        if (!fontIndex[key]) fontIndex[key] = { family: f.family, styles: [] };
        var d = describeStyle(f.style);
        fontIndex[key].styles.push({ style: f.style, weight: d.weight, italic: d.italic });
    }
    return fontIndex;
}

/** Best installed style for a family, weight and italic: exact, else nearest weight. */
function pickStyle(entry, weight, italic) {
    var pool = entry.styles.filter(function (s) { return s.italic === italic && s.weight != null; });
    if (!pool.length) pool = entry.styles.filter(function (s) { return s.weight != null; });
    if (!pool.length) return entry.styles.length ? { style: entry.styles[0].style, exact: false } : null;
    pool.sort(function (a, b) { return Math.abs(a.weight - weight) - Math.abs(b.weight - weight) || b.weight - a.weight; });
    return { style: pool[0].style, exact: pool[0].weight === weight && pool[0].italic === italic };
}

/**
 * FontName for a family + weight. Falls back to Inter (always in Figma).
 * @returns {{ fontName, status: 'exact'|'nearest'|'fallback' }}
 */
async function resolveFont(family, weight, italic) {
    var index = await fonts();
    var w = Number(weight) || 400;
    var entry = index[String(family || '').toLowerCase()];
    if (entry) {
        var pick = pickStyle(entry, w, Boolean(italic));
        if (pick) return { fontName: { family: entry.family, style: pick.style }, status: pick.exact ? 'exact' : 'nearest' };
    }
    var inter = index.inter;
    var fallback = inter ? pickStyle(inter, w, Boolean(italic)) : null;
    return { fontName: { family: 'Inter', style: fallback ? fallback.style : 'Regular' }, status: 'fallback' };
}

/* ------------------------------------------------------------------ */
/* Inspect: what will happen, before anything is written               */
/* ------------------------------------------------------------------ */

/** How many modes a collection may have on this plan (tries, then cleans up). */
async function modeLimit(needed) {
    if (needed <= 1) return needed;
    var probe = figma.variables.createVariableCollection('TwoKit · checking modes');
    var count = 1;
    try {
        for (var i = 1; i < needed; i++) {
            probe.addMode('Mode ' + (i + 1));
            count++;
        }
    } catch (e) {
        // Plan limit reached.
    }
    probe.remove();
    return count;
}

async function inspect(raw) {
    var pkg = validate(raw);
    var collections = await figma.variables.getLocalVariableCollectionsAsync();
    var variables = await figma.variables.getLocalVariablesAsync();
    var names = function (styles) { return styles.map(function (s) { return s.name; }); };
    var text = names(await figma.getLocalTextStylesAsync());
    var effects = names(await figma.getLocalEffectStylesAsync());
    var paints = names(await figma.getLocalPaintStylesAsync());

    var needed = pkg.collections.reduce(function (m, c) { return Math.max(m, c.modes.length); }, 1);
    var limit = await modeLimit(needed);

    var collectionReport = pkg.collections.map(function (c) {
        var existing = collections.find(function (x) { return x.name === c.name; });
        var have = existing ? variables.filter(function (v) { return v.variableCollectionId === existing.id; }).map(function (v) { return v.name; }) : [];
        var update = list(c.variables).filter(function (v) { return have.indexOf(cleanName(v.name)) >= 0; }).length;
        return {
            id: c.id || c.name,
            name: c.name,
            modes: c.modes,
            count: list(c.variables).length,
            update: update,
            split: c.modes.length > limit
        };
    });

    // Fonts: every family the text styles use, with the weights they need.
    var needs = {};
    pkg.textStyles.forEach(function (s) {
        var key = String(s.fontFamily || 'Inter');
        needs[key] = needs[key] || {};
        needs[key][Number(s.fontWeight) || 400] = true;
    });
    var fontReport = [];
    for (var family in needs) {
        var weights = Object.keys(needs[family]).map(Number).sort(function (a, b) { return a - b; });
        var missing = [];
        var status = 'exact';
        var used = null;
        for (var i = 0; i < weights.length; i++) {
            var r = await resolveFont(family, weights[i], false);
            used = r.fontName.family;
            if (r.status === 'fallback') status = 'fallback';
            else if (r.status === 'nearest' && status === 'exact') status = 'nearest';
            if (r.status !== 'exact') missing.push(weights[i]);
        }
        var info = pkg.fonts.find(function (f) { return f.family === family; }) || {};
        fontReport.push({ family: family, weights: weights, missing: missing, status: status, usedFamily: used, source: info.source || 'system', url: info.url || null, roles: list(info.roles) });
    }

    var styleReport = function (items, existing) {
        var update = items.filter(function (s) { return existing.indexOf(s.name) >= 0; }).length;
        return { count: items.length, update: update };
    };

    return {
        meta: pkg.meta,
        modeLimit: limit,
        collections: collectionReport,
        textStyles: styleReport(pkg.textStyles, text),
        effectStyles: styleReport(pkg.effectStyles, effects),
        paintStyles: styleReport(pkg.paintStyles, paints),
        fonts: fontReport
    };
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

function owned(node) {
    try { node.setPluginData(OWNER, '1'); } catch (e) { /* not supported */ }
}

function isOwned(node) {
    try { return node.getPluginData(OWNER) === '1'; } catch (e) { return false; }
}

/**
 * Collections with their modes. Returns id → target:
 *   { split: false, collection, modes: { name: modeId } }
 *   { split: true,  perMode: { name: { collection, modeId } } }
 */
async function setupCollections(pkg, selected, report) {
    var existing = await figma.variables.getLocalVariableCollectionsAsync();
    var find = function (name) { return existing.find(function (c) { return c.name === name; }); };
    var targets = {};

    for (var i = 0; i < pkg.collections.length; i++) {
        var def = pkg.collections[i];
        var id = def.id || def.name;
        if (!selected[id]) continue;
        var collection = find(def.name);
        var created = false;
        if (!collection) {
            collection = figma.variables.createVariableCollection(def.name);
            created = true;
        }
        owned(collection);
        try {
            targets[id] = { split: false, collection: collection, modes: ensureModes(collection, def.modes, created) };
            report.collections[created ? 'created' : 'updated']++;
        } catch (e) {
            // Plan limit on modes: one collection per mode instead.
            if (created) collection.remove();
            var perMode = {};
            for (var m = 0; m < def.modes.length; m++) {
                var mode = def.modes[m];
                var name = def.name + ' · ' + mode;
                var single = find(name);
                var isNew = !single;
                if (!single) { single = figma.variables.createVariableCollection(name); owned(single); }
                owned(single);
                if (isNew || single.modes[0].name !== mode) single.renameMode(single.modes[0].modeId, mode);
                perMode[mode] = { collection: single, modeId: single.modes[0].modeId };
                report.collections[isNew ? 'created' : 'updated']++;
            }
            targets[id] = { split: true, perMode: perMode };
            report.warnings.push(def.name + ': your plan allows fewer modes, so it was split into ' + def.modes.map(function (mm) { return '"' + def.name + ' · ' + mm + '"'; }).join(' and ') + '.');
        }
    }
    return targets;
}

/** Makes the collection's modes match `names`; throws when the plan limit is reached. */
function ensureModes(collection, names, created) {
    var ids = {};
    names.forEach(function (name, i) {
        var hit = collection.modes.find(function (m) { return m.name === name; });
        if (hit) {
            ids[name] = hit.modeId;
            return;
        }
        // The first wanted mode takes over a fresh collection's "Mode 1".
        var first = collection.modes[0];
        var unused = names.indexOf(first.name) < 0;
        if (i === 0 && unused && (created || isOwned(collection) || /^Mode \d+$/.test(first.name))) {
            collection.renameMode(first.modeId, name);
            ids[name] = first.modeId;
            return;
        }
        ids[name] = collection.addMode(name);
    });
    return ids;
}

/** Each physical place a variable lives: [{ collection, modes: { name: modeId }, suffix }]. */
function places(target) {
    if (!target.split) return [{ collection: target.collection, modes: target.modes, only: null }];
    return Object.keys(target.perMode).map(function (mode) {
        var p = target.perMode[mode];
        var modes = {};
        modes[mode] = p.modeId;
        return { collection: p.collection, modes: modes, only: mode };
    });
}

async function importVariables(pkg, targets, report) {
    var all = await figma.variables.getLocalVariablesAsync();
    var index = {};
    all.forEach(function (v) { index[v.variableCollectionId + '/' + v.name] = v; });
    var map = {}; // "collectionId:variable/name" → { mode → Variable } (key "*" when not split)
    var jobs = [];

    // Pass 1: every variable exists, with type, scopes, code syntax and description.
    var total = 0;
    pkg.collections.forEach(function (c) { if (targets[c.id || c.name]) total += list(c.variables).length; });
    var done = 0;
    for (var i = 0; i < pkg.collections.length; i++) {
        var def = pkg.collections[i];
        var target = targets[def.id || def.name];
        if (!target) continue;
        var spots = places(target);
        var vars = list(def.variables);
        for (var j = 0; j < vars.length; j++) {
            var v = vars[j];
            var name = cleanName(v.name);
            var ref = (def.id || def.name) + ':' + v.name;
            map[ref] = {};
            for (var k = 0; k < spots.length; k++) {
                var spot = spots[k];
                var key = spot.collection.id + '/' + name;
                var variable = index[key];
                if (variable && variable.resolvedType !== v.type) {
                    variable.name = name + ' (old ' + variable.resolvedType.toLowerCase() + ')';
                    report.warnings.push(name + ' changed type, so a new variable was made; the old one was renamed.');
                    variable = null;
                }
                if (!variable) {
                    variable = figma.variables.createVariable(name, spot.collection, v.type);
                    index[key] = variable;
                    report.variables.created++;
                } else {
                    report.variables.updated++;
                }
                owned(variable);
                if (v.description != null) variable.description = String(v.description);
                if (Array.isArray(v.scopes) && v.scopes.length) {
                    try { variable.scopes = v.scopes; } catch (e) { /* scope not valid for type */ }
                }
                if (v.css) {
                    try { variable.setVariableCodeSyntax('WEB', 'var(--' + v.css + ')'); } catch (e) { /* ignore */ }
                }
                map[ref][spot.only || '*'] = variable;
                jobs.push({ variable: variable, def: v, spot: spot });
            }
            done++;
            if (done % 25 === 0) progress('Creating variables', done, total);
        }
    }

    // Pass 2: values, now that every alias target exists.
    var lookup = function (ref, mode) {
        var m = map[ref];
        if (!m) return null;
        return m['*'] || m[mode] || m[Object.keys(m)[0]] || null;
    };
    for (var n = 0; n < jobs.length; n++) {
        var job = jobs[n];
        var values = job.def.values || {};
        for (var mode in job.spot.modes) {
            var value = values[mode] || values[Object.keys(values)[0]];
            if (!value) continue;
            try {
                job.variable.setValueForMode(job.spot.modes[mode], toFigmaValue(value, job.def.type, lookup, mode));
            } catch (e) {
                report.errors.push(job.def.name + ' (' + mode + '): ' + (e && e.message ? e.message : e));
            }
        }
        if (n % 50 === 0) progress('Setting values', n, jobs.length);
    }
    return lookup;
}

function toFigmaValue(value, type, lookup, mode) {
    if (value.alias) {
        var target = lookup(value.alias, mode);
        if (target && target.resolvedType === type) return figma.variables.createVariableAlias(target);
        // Target not imported (collection unchecked): use the value the package carries.
    }
    if (type === 'COLOR') return color(value.color || '#000000');
    if (type === 'FLOAT') return Number(value.number) || 0;
    if (type === 'STRING') return String(value.string == null ? '' : value.string);
    if (type === 'BOOLEAN') return Boolean(value.boolean);
    throw new Error('Unknown variable type ' + type);
}

/** The Variable a style should bind to, per mode when that collection was split. */
function bindingFor(lookup, ref, mode) {
    if (!ref || !lookup) return null;
    return lookup(ref, mode);
}

/** Which mode names styles are duplicated for (split collections), else [null]. */
function styleModes(targets, id) {
    var t = targets[id];
    return t && t.split ? Object.keys(t.perMode) : [null];
}

async function importTextStyles(pkg, targets, lookup, report, fontWarnings) {
    var existing = await figma.getLocalTextStylesAsync();
    var byName = {};
    existing.forEach(function (s) { byName[s.name] = s; });
    var modes = styleModes(targets, 'typography');
    var items = pkg.textStyles;
    for (var i = 0; i < items.length; i++) {
        var def = items[i];
        var resolved = await resolveFont(def.fontFamily, def.fontWeight, def.italic);
        if (resolved.status !== 'exact') {
            fontWarnings[def.fontFamily + '|' + def.fontWeight] = def.fontFamily + ' ' + def.fontWeight + (resolved.status === 'fallback' ? ' is not installed: ' : ' is not installed at that weight: ') + resolved.fontName.family + ' ' + resolved.fontName.style + ' used instead.';
        }
        await figma.loadFontAsync(resolved.fontName);
        for (var m = 0; m < modes.length; m++) {
            var mode = modes[m];
            var name = mode ? mode + '/' + def.name : def.name;
            var style = byName[name];
            if (style) {
                try { await figma.loadFontAsync(style.fontName); } catch (e) { /* its old font is gone; replaced below */ }
                report.textStyles.updated++;
            } else {
                style = figma.createTextStyle();
                style.name = name;
                byName[name] = style;
                report.textStyles.created++;
            }
            owned(style);
            try {
                style.fontName = resolved.fontName;
                style.fontSize = Math.max(1, Number(def.fontSize) || 16);
                if (def.lineHeight && def.lineHeight.unit === 'AUTO') style.lineHeight = { unit: 'AUTO' };
                else if (def.lineHeight) style.lineHeight = { unit: def.lineHeight.unit === 'PERCENT' ? 'PERCENT' : 'PIXELS', value: Number(def.lineHeight.value) || 0 };
                if (def.letterSpacing) style.letterSpacing = { unit: def.letterSpacing.unit === 'PIXELS' ? 'PIXELS' : 'PERCENT', value: Number(def.letterSpacing.value) || 0 };
                if (def.textCase) style.textCase = def.textCase;
                if (def.description != null) style.description = String(def.description);
                if (def.textWrap) { try { style.textWrapStyle = def.textWrap; } catch (e) { /* older Figma */ } }
                // Vertical trim: cap height to baseline, so text boxes hug the letters
                // (like CSS text-box: trim-both cap alphabetic). Font is loaded above.
                // Figma takes the string ('CAP_HEIGHT' | 'NONE'); the docs' { type } form is tried as a fallback.
                var trim = def.leadingTrim === 'NONE' ? 'NONE' : 'CAP_HEIGHT';
                try { style.leadingTrim = trim; } catch (e) {
                    try { style.leadingTrim = { type: trim }; } catch (e2) { /* Figma without vertical trim */ }
                }
            } catch (e) {
                report.errors.push(name + ': ' + (e && e.message ? e.message : e));
                continue;
            }
            var bind = def.bind || {};
            var fields = ['fontSize', 'lineHeight', 'letterSpacing'];
            // Family binding only when the family is installed; otherwise Figma would show a missing font.
            if (resolved.status !== 'fallback') fields.push('fontFamily');
            for (var f = 0; f < fields.length; f++) {
                var variable = bindingFor(lookup, bind[fields[f]], mode);
                if (!variable) continue;
                try { style.setBoundVariable(fields[f], variable); } catch (e) {
                    report.warnings.push(name + ': could not bind ' + fields[f] + ' (' + (e && e.message ? e.message : e) + ')');
                }
            }
        }
        progress('Text styles', i + 1, items.length);
    }
}

async function importEffectStyles(pkg, targets, lookup, report) {
    var existing = await figma.getLocalEffectStylesAsync();
    var byName = {};
    existing.forEach(function (s) { byName[s.name] = s; });
    var modes = styleModes(targets, 'theme');
    var items = pkg.effectStyles;
    for (var i = 0; i < items.length; i++) {
        var def = items[i];
        for (var m = 0; m < modes.length; m++) {
            var mode = modes[m];
            var name = mode ? def.name.replace(/^([^/]+)\//, '$1/' + mode + '/') : def.name;
            var effects = [];
            list(def.effects).forEach(function (e) {
                var variable = bindingFor(lookup, e.bind && e.bind.color, mode);
                var base = {
                    type: e.type === 'INNER_SHADOW' ? 'INNER_SHADOW' : 'DROP_SHADOW',
                    color: color(e.color),
                    offset: { x: Number(e.x) || 0, y: Number(e.y) || 0 },
                    radius: Math.max(0, Number(e.blur) || 0),
                    spread: Number(e.spread) || 0,
                    visible: true,
                    blendMode: 'NORMAL'
                };
                if (base.type === 'DROP_SHADOW') base.showShadowBehindNode = false;
                if (variable) {
                    try { base = figma.variables.setBoundVariableForEffect(base, 'color', variable); } catch (err) {
                        report.warnings.push(name + ': a shadow color could not be bound to its variable.');
                    }
                }
                effects.push(base);
            });
            var style = byName[name];
            if (style) report.effectStyles.updated++;
            else {
                style = figma.createEffectStyle();
                style.name = name;
                byName[name] = style;
                report.effectStyles.created++;
            }
            owned(style);
            try {
                style.effects = effects;
                if (def.description != null) style.description = String(def.description);
            } catch (e) {
                report.errors.push(name + ': ' + (e && e.message ? e.message : e));
            }
        }
        progress('Shadows', i + 1, items.length);
    }
}

async function importPaintStyles(pkg, targets, lookup, report) {
    var existing = await figma.getLocalPaintStylesAsync();
    var byName = {};
    existing.forEach(function (s) { byName[s.name] = s; });
    var modes = styleModes(targets, 'theme');
    var items = pkg.paintStyles;
    for (var i = 0; i < items.length; i++) {
        var def = items[i];
        for (var m = 0; m < modes.length; m++) {
            var mode = modes[m];
            var name = mode ? def.name.replace(/^([^/]+)\//, '$1/' + mode + '/') : def.name;
            var c = color(def.color || '#000000');
            var paint = { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a };
            var variable = bindingFor(lookup, def.bind, mode);
            if (variable) {
                try { paint = figma.variables.setBoundVariableForPaint(paint, 'color', variable); } catch (e) { /* keep the raw color */ }
            }
            var style = byName[name];
            if (style) report.paintStyles.updated++;
            else {
                style = figma.createPaintStyle();
                style.name = name;
                byName[name] = style;
                report.paintStyles.created++;
            }
            owned(style);
            style.paints = [paint];
            if (def.description != null) style.description = String(def.description);
        }
        if (i % 10 === 0) progress('Color styles', i + 1, items.length);
    }
}

/** Removes TwoKit-made variables and styles that this package no longer has. */
async function prune(pkg, targets, options, report) {
    var keep = {};
    pkg.collections.forEach(function (c) {
        var t = targets[c.id || c.name];
        if (!t) return;
        places(t).forEach(function (p) {
            list(c.variables).forEach(function (v) { keep[p.collection.id + '/' + cleanName(v.name)] = true; });
        });
    });
    var collectionIds = {};
    Object.keys(targets).forEach(function (id) { places(targets[id]).forEach(function (p) { collectionIds[p.collection.id] = true; }); });
    var vars = await figma.variables.getLocalVariablesAsync();
    vars.forEach(function (v) {
        if (collectionIds[v.variableCollectionId] && isOwned(v) && !keep[v.variableCollectionId + '/' + v.name]) {
            v.remove();
            report.removed++;
        }
    });
    var styleNames = function (items, kind) {
        var names = {};
        var modes = kind === 'text' ? styleModes(targets, 'typography') : styleModes(targets, 'theme');
        items.forEach(function (s) {
            modes.forEach(function (mode) {
                var n = !mode ? s.name : kind === 'text' ? mode + '/' + s.name : s.name.replace(/^([^/]+)\//, '$1/' + mode + '/');
                names[n] = true;
            });
        });
        return names;
    };
    var sweep = async function (enabled, getter, items, kind) {
        if (!enabled) return;
        var names = styleNames(items, kind);
        var styles = await getter();
        styles.forEach(function (s) {
            if (isOwned(s) && !names[s.name]) {
                s.remove();
                report.removed++;
            }
        });
    };
    await sweep(options.textStyles, function () { return figma.getLocalTextStylesAsync(); }, pkg.textStyles, 'text');
    await sweep(options.effectStyles, function () { return figma.getLocalEffectStylesAsync(); }, pkg.effectStyles, 'effect');
    await sweep(options.paintStyles, function () { return figma.getLocalPaintStylesAsync(); }, pkg.paintStyles, 'paint');
}

/**
 * Project → Remove TwoKit from this file: every variable, style and collection
 * TwoKit created (marked with its plugin data), and the project saved for this
 * file. The user's own variables and styles are never touched; a collection
 * goes only when TwoKit made it, or it is one of TwoKit's (split) collections
 * that is now empty.
 */
async function removeAll() {
    var report = { variables: 0, styles: 0, collections: 0 };
    var vars = await figma.variables.getLocalVariablesAsync();
    vars.forEach(function (v) {
        if (isOwned(v)) { v.remove(); report.variables++; }
    });
    var getters = [
        function () { return figma.getLocalTextStylesAsync(); },
        function () { return figma.getLocalEffectStylesAsync(); },
        function () { return figma.getLocalPaintStylesAsync(); }
    ];
    for (var g = 0; g < getters.length; g++) {
        var styles = await getters[g]();
        styles.forEach(function (s) {
            if (isOwned(s)) { s.remove(); report.styles++; }
        });
    }
    var left = {};
    (await figma.variables.getLocalVariablesAsync()).forEach(function (v) { left[v.variableCollectionId] = true; });
    var collections = await figma.variables.getLocalVariableCollectionsAsync();
    collections.forEach(function (c) {
        var ours = isOwned(c) || (!left[c.id] && /^(Primitives|Theme|Typography|Spacing)( · .+)?$/.test(c.name));
        if (ours && !left[c.id]) {
            try { c.remove(); report.collections++; } catch (e) { /* in use elsewhere */ }
        }
    });
    figma.root.setPluginData('twokit-applied', '');
    var keys = ['twokit-project-autosave', 'twokit-project-meta'];
    for (var k = 0; k < keys.length; k++) await figma.clientStorage.deleteAsync(storageKey(keys[k]));
    return report;
}

async function importPackage(raw, options) {
    var pkg = validate(raw);
    var selected = options.collections || {};
    var report = {
        collections: { created: 0, updated: 0 },
        variables: { created: 0, updated: 0 },
        textStyles: { created: 0, updated: 0 },
        effectStyles: { created: 0, updated: 0 },
        paintStyles: { created: 0, updated: 0 },
        removed: 0,
        warnings: [],
        errors: []
    };
    var fontWarnings = {};

    progress('Preparing collections', 0, 1);
    var targets = await setupCollections(pkg, selected, report);
    var lookup = await importVariables(pkg, targets, report);
    if (options.textStyles && pkg.textStyles.length) await importTextStyles(pkg, targets, lookup, report, fontWarnings);
    if (options.effectStyles && pkg.effectStyles.length) await importEffectStyles(pkg, targets, lookup, report);
    if (options.paintStyles && pkg.paintStyles.length) await importPaintStyles(pkg, targets, lookup, report);
    if (options.prune) {
        progress('Removing what is gone', 0, 1);
        await prune(pkg, targets, options, report);
    }
    for (var k in fontWarnings) report.warnings.push(fontWarnings[k]);
    figma.root.setPluginData('twokit-applied', new Date().toISOString());

    var made = report.variables.created + report.textStyles.created + report.effectStyles.created + report.paintStyles.created;
    var updated = report.variables.updated + report.textStyles.updated + report.effectStyles.updated + report.paintStyles.updated;
    figma.notify('TwoKit: ' + made + ' created, ' + updated + ' updated' + (report.errors.length ? ', ' + report.errors.length + ' failed' : ''), { error: report.errors.length > 0 });
    return report;
}
