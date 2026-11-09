/**
 * StegoSlop Material 3 Expressive Wavy Audio Player
 * Features interactive canvas wave scrubber with spring physics and format chips
 */

export class WavyAudioPlayer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = {
      primaryColor: '#00e5c9',
      activeColor: '#00f5d4',
      inactiveColor: 'rgba(255, 255, 255, 0.15)',
      thumbColor: '#ffffff',
      waveAmplitude: 6,
      waveFrequency: 0.04,
      waveSpeed: 4.0,
      ...options
    };

    this.audioContext = null;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseOffset = 0;
    this.duration = 0;
    this.wavePhase = 0;
    this.isDragging = false;
    this.lastFrameTime = performance.now();
    this.animationFrameId = null;

    // Format badge callback
    this.onFormatChanged = options.onFormatChanged || (() => {});
    this.onTimeUpdate = options.onTimeUpdate || (() => {});
    this.onEnded = options.onEnded || (() => {});

    this.initCanvasSize();
    this.bindEvents();
    this.render();
  }

  initCanvasSize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 400;
    this.height = rect.height || 48;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.initCanvasSize();
      this.render();
    });

    const getX = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      return Math.max(0, Math.min(rect.width, clientX - rect.left));
    };

    const handleSeek = (e) => {
      if (!this.duration) return;
      const x = getX(e);
      const ratio = x / this.width;
      const targetTime = ratio * this.duration;
      this.seekTo(targetTime);
    };

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      handleSeek(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        handleSeek(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      this.isDragging = true;
      handleSeek(e);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging) {
        handleSeek(e);
      }
    });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  async loadAudio(arrayBuffer, meta = null) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    this.stop();
    this.pauseOffset = 0;

    try {
      // Decode audio
      const copyBuffer = arrayBuffer.slice(0);
      this.audioBuffer = await this.audioContext.decodeAudioData(copyBuffer);
      this.duration = this.audioBuffer.duration;

      if (meta) {
        this.onFormatChanged(meta);
      } else {
        this.onFormatChanged({
          sample_rate: this.audioBuffer.sampleRate,
          num_channels: this.audioBuffer.numberOfChannels,
          duration_seconds: this.duration,
          bits_per_sample: 16
        });
      }

      this.render();
      return true;
    } catch (err) {
      console.error('Failed to decode audio:', err);
      return false;
    }
  }

  getCurrentTime() {
    if (!this.isPlaying) {
      return this.pauseOffset;
    }
    const elapsed = this.audioContext.currentTime - this.startTime;
    return Math.min(this.duration, this.pauseOffset + elapsed);
  }

  play() {
    if (!this.audioBuffer || this.isPlaying) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    if (this.pauseOffset >= this.duration) {
      this.pauseOffset = 0;
    }

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.audioContext.destination);

    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        const cur = this.getCurrentTime();
        if (cur >= this.duration - 0.05) {
          this.pauseOffset = 0;
          this.isPlaying = false;
          this.onEnded();
          this.render();
        }
      }
    };

    this.startTime = this.audioContext.currentTime;
    this.sourceNode.start(0, this.pauseOffset);
    this.isPlaying = true;
    this.startLoop();
  }

  pause() {
    if (!this.isPlaying) return;
    this.pauseOffset = this.getCurrentTime();
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (_) {}
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.render();
  }

  stop() {
    this.pause();
    this.pauseOffset = 0;
    this.render();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  seekTo(timeInSeconds) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.pauseOffset = Math.max(0, Math.min(this.duration, timeInSeconds));
    if (wasPlaying) {
      this.play();
    } else {
      this.render();
    }
    this.onTimeUpdate(this.pauseOffset, this.duration);
  }

  startLoop() {
    const loop = (now) => {
      const dt = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      if (this.isPlaying) {
        this.wavePhase += dt * this.options.waveSpeed;
        this.onTimeUpdate(this.getCurrentTime(), this.duration);
        this.render();
        this.animationFrameId = requestAnimationFrame(loop);
      }
    };
    this.lastFrameTime = performance.now();
    this.animationFrameId = requestAnimationFrame(loop);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const midY = h / 2;

    ctx.clearRect(0, 0, w, h);

    const currentTime = this.getCurrentTime();
    const progress = this.duration > 0 ? Math.min(1, currentTime / this.duration) : 0;
    const currentX = progress * w;

    // Draw background guide line (inactive part)
    ctx.beginPath();
    ctx.strokeStyle = this.options.inactiveColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.moveTo(Math.max(currentX, 4), midY);
    ctx.lineTo(w - 4, midY);
    ctx.stroke();

    // Draw Material 3 Expressive Wavy line for active part
    if (currentX > 0) {
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Cyberpunk teal gradient for the wave
      const grad = ctx.createLinearGradient(0, 0, currentX, 0);
      grad.addColorStop(0, '#00b4d8');
      grad.addColorStop(0.5, '#00e5c9');
      grad.addColorStop(1, '#00f5d4');
      ctx.strokeStyle = grad;

      ctx.moveTo(0, midY);

      // Draw sinusoidal wave
      const step = 2; // px step for smooth curves
      const amp = this.isPlaying ? this.options.waveAmplitude : Math.min(3, this.options.waveAmplitude * 0.5);

      for (let x = 0; x <= currentX; x += step) {
        // Taper amplitude at beginning and at the thumb head for smooth transitions
        const headTaper = Math.min(1, (currentX - x) / 20);
        const startTaper = Math.min(1, x / 20);
        const taper = headTaper * startTaper;

        const y = midY + Math.sin(x * this.options.waveFrequency - this.wavePhase) * amp * taper;
        ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Glow effect on active wave
      ctx.save();
      ctx.shadowColor = 'rgba(0, 229, 201, 0.4)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }

    // Draw Thumb / Playhead
    if (this.duration > 0) {
      const thumbX = Math.max(6, Math.min(w - 6, currentX));

      // Outer glow ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(thumbX, midY, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 229, 201, 0.25)';
      ctx.fill();

      // Inner solid thumb
      ctx.beginPath();
      ctx.arc(thumbX, midY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    }
  }
}
