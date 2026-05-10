/**
 * TwoKit Text Style Importer - Figma Plugin
 * 
 * Main plugin logic for importing text styles from TwoKit JSON
 * 
 * Build: npx tsc
 */

/// <reference types="@figma/plugin-typings" />

// Interface definitions
interface TextStyleData {
    name: string;
    token: string;
    type: string;
    fontFamily: string;
    fontWeight: string;
    fontSize: string;
    lineHeight?: string;
    letterSpacing?: string;
}

interface ImportData {
    styles: {
        textStyles: TextStyleData[];
    };
}

interface ImportResult {
    success: number;
    failed: number;
    errors: string[];
}

// Font weight mapping
const fontWeightMap: { [key: string]: string } = {
    '100': 'Thin',
    '200': 'ExtraLight',
    '300': 'Light',
    '400': 'Regular',
    '500': 'Medium',
    '600': 'SemiBold',
    '700': 'Bold',
    '800': 'ExtraBold',
    '900': 'Black'
};

/**
 * Parse CSS value with unit to number
 */
function parseValue(value: string): number {
    if (!value) return 0;
    const match = value.match(/^(-?[\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
}

/**
 * Get Figma font style name from weight
 */
function getStyleName(weight: string): string {
    if (isNaN(parseInt(weight))) {
        return weight.charAt(0).toUpperCase() + weight.slice(1).toLowerCase();
    }
    return fontWeightMap[weight] || 'Regular';
}

/**
 * Try to load font with fallback
 */
async function loadFont(family: string, weight: string): Promise<FontName> {
    const style = getStyleName(weight);

    // Try exact match first
    try {
        const fontName: FontName = { family, style };
        await figma.loadFontAsync(fontName);
        return fontName;
    } catch (e) {
        // Font style not found
    }

    // Try Regular as fallback
    try {
        const regularFont: FontName = { family, style: 'Regular' };
        await figma.loadFontAsync(regularFont);
        console.log('Font "' + family + ' ' + style + '" not found, using Regular');
        return regularFont;
    } catch (e) {
        // Family not found
    }

    // Ultimate fallback: Inter Regular
    try {
        const interFont: FontName = { family: 'Inter', style: 'Regular' };
        await figma.loadFontAsync(interFont);
        console.log('Font "' + family + '" not available, using Inter');
        return interFont;
    } catch (e) {
        throw new Error('Could not load any font for "' + family + '"');
    }
}

/**
 * Import text styles from TwoKit JSON
 */
async function importTextStyles(data: ImportData): Promise<ImportResult> {
    const result: ImportResult = {
        success: 0,
        failed: 0,
        errors: []
    };

    // Safe access for textStyles
    const textStyles = data && data.styles && data.styles.textStyles
        ? data.styles.textStyles
        : [];

    if (textStyles.length === 0) {
        throw new Error('No text styles found in JSON');
    }

    // Get existing styles (synchronous - works without dynamic-page)
    const existingStyles = figma.getLocalTextStyles();

    for (const styleData of textStyles) {
        try {
            // Load the font
            const fontName = await loadFont(styleData.fontFamily, styleData.fontWeight);

            // Check if style already exists
            let textStyle: TextStyle;
            const existingStyle = existingStyles.find(s => s.name === styleData.name);

            if (existingStyle) {
                textStyle = existingStyle;
            } else {
                // Create new text style (synchronous)
                textStyle = figma.createTextStyle();
            }

            // Set style name
            textStyle.name = styleData.name;

            // Set font
            textStyle.fontName = fontName;

            // Set font size
            textStyle.fontSize = parseValue(styleData.fontSize);

            // Set line height
            if (styleData.lineHeight) {
                const lhValue = parseValue(styleData.lineHeight);
                if (styleData.lineHeight.indexOf('%') !== -1) {
                    textStyle.lineHeight = { value: lhValue, unit: 'PERCENT' };
                } else {
                    textStyle.lineHeight = { value: lhValue, unit: 'PIXELS' };
                }
            }

            // Set letter spacing
            if (styleData.letterSpacing) {
                const lsValue = parseValue(styleData.letterSpacing);
                if (styleData.letterSpacing.indexOf('%') !== -1) {
                    textStyle.letterSpacing = { value: lsValue, unit: 'PERCENT' };
                } else {
                    textStyle.letterSpacing = { value: lsValue, unit: 'PIXELS' };
                }
            }

            result.success++;
        } catch (error) {
            result.failed++;
            result.errors.push(styleData.name + ': ' + String(error));
            console.error('Failed to import "' + styleData.name + '":', error);
        }
    }

    return result;
}

// Show the UI
figma.showUI(__html__, {
    width: 360,
    height: 520,
    title: 'TwoKit Text Style Importer'
});

// Handle messages from UI
figma.ui.onmessage = (msg: { type: string; data?: ImportData }) => {
    if (msg.type === 'import-styles' && msg.data) {
        importTextStyles(msg.data)
            .then((result) => {
                figma.ui.postMessage({
                    type: 'import-complete',
                    success: result.success,
                    failed: result.failed,
                    errors: result.errors
                });

                // Show Figma notification
                if (result.failed === 0) {
                    figma.notify('✓ Imported ' + result.success + ' text styles');
                } else {
                    figma.notify('Imported ' + result.success + ' styles, ' + result.failed + ' failed', {
                        timeout: 5000
                    });
                }
            })
            .catch((error) => {
                figma.ui.postMessage({
                    type: 'import-error',
                    error: String(error)
                });
                figma.notify('Import failed: ' + error, { error: true });
            });
    }
};
