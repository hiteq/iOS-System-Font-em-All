async function main() {
  // Total number of layers to be processed
  let totalLayers = 0;
  // Number of layers processed so far
  let processedLayers = 0;
  // Number of characters changed
  let changedCharacters = 0;

  // Preload only the fonts used in the current page's text nodes
  async function preloadFonts() {
    const textNodesCriteria = {
      types: ["TEXT"] as Array<"TEXT">, // 'as const' 제거
    };
    const textNodes = figma.currentPage.findAllWithCriteria(textNodesCriteria);
    const fonts = new Set();
    textNodes.forEach(node => {
      if ("characters" in node) {
        for (let i = 0; i < node.characters.length; i++) {
          const fontName = node.getRangeFontName(i, i + 1);
          if (fontName !== figma.mixed) {
            fonts.add(fontName);
          }
        }
      }
    });
    try {
      await Promise.all(Array.from(fonts).map(font => {
        if (font && typeof font === 'object' && 'family' in font && 'style' in font) {
          try {
            return figma.loadFontAsync(font as FontName);
          } catch (error) {
            figma.closePlugin(`❌ Failed to load fonts. Please check if the ${(font as FontName).family} is installed and try again.`);
            throw error;
          }
        }
      }));
    } catch (error) {
      console.error('Error loading fonts:', error);
      throw error;
    }
  }

  // Function to map CSS fontWeight to Apple SD Gothic Neo or SF Pro font style
  function getFontStyle(cssWeight: number, isKorean: boolean) {
    if (isKorean) {
      const styles = [
        { max: 149, style: 'Thin' },
        { max: 249, style: 'UltraLight' },
        { max: 349, style: 'Light' },
        { max: 449, style: 'Regular' },
        { max: 549, style: 'Medium' },
        { max: 649, style: 'SemiBold' },
        { max: 749, style: 'Bold' },
        { max: 849, style: 'ExtraBold' },
        { max: Infinity, style: 'Heavy' }
      ];
      const styleObj = styles.find(s => cssWeight <= s.max);
      const style = styleObj ? styleObj.style : 'Regular';
      return { family: 'Apple SD Gothic Neo', style };
    } else {
      const sfProStyles = [
        { max: 149, style: 'Ultralight' },
        { max: 249, style: 'Thin' },
        { max: 349, style: 'Light' },
        { max: 449, style: 'Regular' },
        { max: 549, style: 'Medium' },
        { max: 649, style: 'Semibold' },
        { max: 749, style: 'Bold' },
        { max: 849, style: 'Heavy' },
        { max: Infinity, style: 'Black' }
      ];
      const sfProStyleObj = sfProStyles.find(s => cssWeight <= s.max);
      const sfProStyle = sfProStyleObj ? sfProStyleObj.style : 'Regular';
      return { family: 'SF Pro', style: sfProStyle };
    }
  }

  // Load all fonts used in a node and its children, and change them to Apple SD Gothic Neo or SF Pro
  async function loadFontsAndChange(node: SceneNode) {
    if (node.type === 'TEXT' && node.visible && !node.locked && !node.removed) {
      totalLayers++;
      const fontPromises = [];
      for (let i = 0; i < node.characters.length; i++) {
        const char = node.characters[i];
        const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(char);
        const fontWeight = node.getRangeFontWeight(i, i + 1);
        const newFont = getFontStyle(fontWeight as number, isKorean);

        fontPromises.push(figma.loadFontAsync(newFont).then(() => {
          node.setRangeFontName(i, i + 1, newFont);
          changedCharacters++; // Increment the changed characters count

          // Apply tracking value based on font size
          const fontSize = node.getRangeFontSize(i, i + 1);
          const trackingValues: { [key: number]: number } = {
            6: 0.24,
            7: 0.23,
            8: 0.21,
            9: 0.17,
            10: 0.12,
            11: 0.06,
            12: 0,
            13: -0.08,
            14: -0.15,
            15: -0.23,
            16: -0.31,
            17: -0.43,
            18: -0.44,
            19: -0.45,
            20: -0.45,
            21: -0.36,
            22: -0.26,
            23: -0.10,
            24: 0.07,
            25: 0.15,
            26: 0.22,
            27: 0.29,
            28: 0.38,
            29: 0.40,
            30: 0.40,
            31: 0.39,
            32: 0.41,
            33: 0.40,
            34: 0.40,
            35: 0.38,
            36: 0.37,
            37: 0.36,
            38: 0.37,
            39: 0.38,
            40: 0.37,
            41: 0.36,
            42: 0.37,
            43: 0.38,
            44: 0.37,
            45: 0.35,
            46: 0.36,
            47: 0.37,
            48: 0.35,
            49: 0.33,
            50: 0.34,
            51: 0.35,
            52: 0.33,
            53: 0.31,
            54: 0.32,
            56: 0.30,
            58: 0.28,
            60: 0.26,
            62: 0.24,
            64: 0.22,
            66: 0.19,
            68: 0.17,
            70: 0.14,
            72: 0.14,
            76: 0.07,
            80: 0,
            84: 0,
            88: 0,
            92: 0,
            96: 0
          };
          const tracking = trackingValues[fontSize as number];
          if (tracking !== undefined && !isKorean) {
            node.setRangeLetterSpacing(i, i + 1, { value: tracking, unit: 'PIXELS' });
          }
        }));
      }
      await Promise.all(fontPromises);
      processedLayers++;
    } else if ("children" in node) {
      for (const child of node.children) {
        await loadFontsAndChange(child);
      }
    }
  }

  // If no layer is selected, notify the user and terminate the plugin.
  if (figma.currentPage.selection.length === 0) {
    figma.notify("Please select one or more layers", { timeout: 1500 });
    figma.closePlugin();
    return;
  }
  // Preload all fonts.
  figma.notify("Plugin execution started");
  await preloadFonts();

  // Process all selected nodes and their descendants
  for (const node of figma.currentPage.selection) {
    await loadFontsAndChange(node);
  }

  figma.closePlugin(`Layers changed: ${processedLayers}, Characters changed: ${changedCharacters}`);
}

main();
