/**
 * StegoSlop Interactive X-Ray Bit Plane Inspector
 * Analyzes RGB bit slices 0..7 to reveal hidden LSB noise and steganographic payload structures.
 */

export class BitplaneViewer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.wasm = options.wasm;
    this.currentBit = 0;
    this.originalRgba = null;
    this.width = 0;
    this.height = 0;
    this.invert = false;
    this.isAutoCycling = false;
    this.cycleInterval = null;
    this.splitMode = false; // Split side-by-side comparison
    this.splitPos = 0.5;

    this.onBitChanged = options.onBitChanged || (() => {});
  }

  setWasm(wasmInstance) {
    this.wasm = wasmInstance;
  }

  async loadImage(imageSource) {
    let img;
    if (imageSource instanceof HTMLImageElement) {
      img = imageSource;
    } else if (imageSource instanceof Blob || imageSource instanceof File) {
      img = await this.blobToImage(imageSource);
    } else if (imageSource instanceof Uint8Array) {
      const blob = new Blob([imageSource], { type: 'image/png' });
      img = await this.blobToImage(blob);
    } else if (typeof imageSource === 'string') {
      img = await this.urlToImage(imageSource);
    } else {
      throw new Error('Unsupported image source');
    }

    this.width = img.naturalWidth || img.width;
    this.height = img.naturalHeight || img.height;

    // Downscale for bitplane preview if enormous (> 2048px) to keep 60fps responsiveness
    const maxDim = 2048;
    let targetW = this.width;
    let targetH = this.height;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = targetW;
    offscreen.height = targetH;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(img, 0, 0, targetW, targetH);

    const imgData = offCtx.getImageData(0, 0, targetW, targetH);
    this.originalRgba = new Uint8Array(imgData.data.buffer);
    this.width = targetW;
    this.height = targetH;

    this.canvas.width = targetW;
    this.canvas.height = targetH;

    this.render();
    return { width: targetW, height: targetH };
  }

  blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  urlToImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  setBit(bitIndex) {
    this.currentBit = Math.max(0, Math.min(7, bitIndex));
    this.render();
    this.onBitChanged(this.currentBit);
  }

  toggleInvert() {
    this.invert = !this.invert;
    this.render();
    return this.invert;
  }

  toggleSplitMode() {
    this.splitMode = !this.splitMode;
    this.render();
    return this.splitMode;
  }

  toggleAutoCycle(speedMs = 600) {
    if (this.isAutoCycling) {
      this.stopAutoCycle();
    } else {
      this.startAutoCycle(speedMs);
    }
    return this.isAutoCycling;
  }

  startAutoCycle(speedMs = 600) {
    if (this.isAutoCycling) return;
    this.isAutoCycling = true;
    this.cycleInterval = setInterval(() => {
      const nextBit = (this.currentBit + 1) % 8;
      this.setBit(nextBit);
    }, speedMs);
  }

  stopAutoCycle() {
    if (!this.isAutoCycling) return;
    clearInterval(this.cycleInterval);
    this.cycleInterval = null;
    this.isAutoCycling = false;
  }

  render() {
    if (!this.originalRgba || !this.wasm) return;

    // Use WASM for ultra-fast bitplane computation
    const bitplaneBuffer = this.wasm.bitplane_rgba(this.originalRgba, this.currentBit);

    // Apply inversion if enabled
    if (this.invert) {
      for (let i = 0; i < bitplaneBuffer.length; i += 4) {
        bitplaneBuffer[i] = 255 - bitplaneBuffer[i];
        bitplaneBuffer[i + 1] = 255 - bitplaneBuffer[i + 1];
        bitplaneBuffer[i + 2] = 255 - bitplaneBuffer[i + 2];
      }
    }

    const imgData = new ImageData(new Uint8ClampedArray(bitplaneBuffer.buffer), this.width, this.height);

    if (!this.splitMode) {
      this.ctx.putImageData(imgData, 0, 0);
    } else {
      // Split mode: left side is original, right side is bit plane
      const splitX = Math.round(this.width * this.splitPos);
      const combined = new Uint8ClampedArray(this.originalRgba.length);

      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const idx = (y * this.width + x) * 4;
          if (x < splitX) {
            combined[idx] = this.originalRgba[idx];
            combined[idx + 1] = this.originalRgba[idx + 1];
            combined[idx + 2] = this.originalRgba[idx + 2];
            combined[idx + 3] = this.originalRgba[idx + 3];
          } else {
            combined[idx] = bitplaneBuffer[idx];
            combined[idx + 1] = bitplaneBuffer[idx + 1];
            combined[idx + 2] = bitplaneBuffer[idx + 2];
            combined[idx + 3] = bitplaneBuffer[idx + 3];
          }
        }
      }

      this.ctx.putImageData(new ImageData(combined, this.width, this.height), 0, 0);

      // Draw split divider line
      this.ctx.save();
      this.ctx.strokeStyle = '#00f5d4';
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = 'rgba(0, 245, 212, 0.8)';
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.moveTo(splitX, 0);
      this.ctx.lineTo(splitX, this.height);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  downloadCurrentPlane() {
    if (!this.canvas) return;
    const a = document.createElement('a');
    a.download = `stegoslop_bitplane_${this.currentBit}.png`;
    a.href = this.canvas.toDataURL('image/png');
    a.click();
  }
}
