/**
 * StegoSlop Zero-Width Unicode Steganography Module
 * Hides arbitrary data inside plain text using invisible zero-width Unicode characters
 */

export class ZeroWidthHandler {
  constructor(wasm) {
    this.wasm = wasm;
  }

  setWasm(wasm) {
    this.wasm = wasm;
  }

  encode(coverText, secretText, password = null) {
    if (!this.wasm) throw new Error('WASM engine not initialized');
    const secretBytes = new TextEncoder().encode(secretText);
    return this.wasm.zero_width_encode(coverText, secretBytes, password || null);
  }

  decode(stegoText, password = null) {
    if (!this.wasm) throw new Error('WASM engine not initialized');
    const bytes = this.wasm.zero_width_decode(stegoText, password || null);
    return new TextDecoder().decode(bytes);
  }

  hasHiddenData(text) {
    if (!this.wasm) return false;
    return this.wasm.zero_width_has_hidden(text);
  }

  stripHidden(text) {
    if (!this.wasm) return text;
    return this.wasm.zero_width_strip(text);
  }

  /**
   * Generates HTML markup that reveals invisible characters with glowing Cyberpunk tags
   */
  visualize(text) {
    let result = '';
    for (const char of text) {
      if (char === '\uFEFF') {
        result += '<span class="zw-chip zw-bom" title="Header BOM (\\uFEFF)">[BOM]</span>';
      } else if (char === '\u200C') {
        result += '<span class="zw-chip zw-zero" title="Bit 0: ZWNJ (\\u200C)">0</span>';
      } else if (char === '\u200D') {
        result += '<span class="zw-chip zw-one" title="Bit 1: ZWJ (\\u200D)">1</span>';
      } else if (char === '\u2060') {
        result += '<span class="zw-chip zw-delim" title="Delimiter: Word Joiner (\\u2060)">[END]</span>';
      } else if (char === '\n') {
        result += '<br>';
      } else if (char === '<') {
        result += '&lt;';
      } else if (char === '>') {
        result += '&gt;';
      } else if (char === '&') {
        result += '&amp;';
      } else {
        result += char;
      }
    }
    return result;
  }

  analyze(text) {
    let bomCount = 0;
    let zeroCount = 0;
    let oneCount = 0;
    let delimCount = 0;
    let visibleCount = 0;

    for (const char of text) {
      if (char === '\uFEFF') bomCount++;
      else if (char === '\u200C') zeroCount++;
      else if (char === '\u200D') oneCount++;
      else if (char === '\u2060') delimCount++;
      else visibleCount++;
    }

    const hiddenBits = zeroCount + oneCount;
    const hiddenBytes = Math.floor(hiddenBits / 8);

    return {
      hasHidden: bomCount > 0 && (zeroCount > 0 || oneCount > 0),
      bomCount,
      zeroCount,
      oneCount,
      delimCount,
      visibleCount,
      hiddenBits,
      hiddenBytes
    };
  }
}
