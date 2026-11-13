/**
 * StegoSlop — Main Web Application Controller
 * High-performance WebAssembly Steganography Suite
 */

import init, * as wasm from '../pkg/stegoslop_wasm.js';
import { WavyAudioPlayer } from './audio-player.js';
import { BitplaneViewer } from './bitplane-viewer.js';
import { ZeroWidthHandler } from './zero-width.js';

// Global Application State
const state = {
  wasmReady: false,
  activeTab: 'tab-inject',
  inject: {
    carrierType: null, // 'image' | 'audio'
    carrierName: null,
    carrierBytes: null,
    carrierMeta: null,
    engine: 'lsb', // 'lsb' | 'robust'
    bpu: 2,
    payloadMode: 'text', // 'text' | 'file'
    payloadBytes: null,
    payloadFileName: null,
    encrypt: false,
    stegoBlob: null,
    stegoFilename: null,
  },
  extract: {
    carrierType: null,
    carrierName: null,
    carrierBytes: null,
    engine: 'auto', // 'auto' | 'lsb' | 'robust'
    bpu: 2,
    extractedPayload: null,
    extractedBlobUrl: null,
  },
  players: {
    injectAudio: null,
    extractAudio: null,
  },
  bitplaneViewer: null,
  zeroWidthHandler: null,
};

// ============================================================
// Toast Notification Helper
// ============================================================
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✨' : type === 'error' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fadeout');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ============================================================
// Initialization Entrypoint
// ============================================================
async function initApp() {
  try {
    // 1. Initialize WASM module
    await init();
    state.wasmReady = true;
    console.log('[StegoSlop] WebAssembly engine loaded successfully');

    // 2. Initialize sub-controllers
    state.zeroWidthHandler = new ZeroWidthHandler(wasm);

    const xrayCanvas = document.getElementById('xray-canvas');
    if (xrayCanvas) {
      state.bitplaneViewer = new BitplaneViewer(xrayCanvas, {
        wasm,
        onBitChanged: updateXrayBitInfo,
      });
    }

    const injectWavyCanvas = document.getElementById('inject-wavy-canvas');
    if (injectWavyCanvas) {
      state.players.injectAudio = new WavyAudioPlayer(injectWavyCanvas, {
        onTimeUpdate: (cur, dur) => {
          const el = document.getElementById('inject-audio-duration');
          if (el) el.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
        },
        onEnded: () => {
          const btn = document.getElementById('btn-inject-audio-play');
          if (btn) btn.textContent = '▶';
        },
      });
    }

    const extractWavyCanvas = document.getElementById('extract-wavy-canvas');
    if (extractWavyCanvas) {
      state.players.extractAudio = new WavyAudioPlayer(extractWavyCanvas, {
        onTimeUpdate: (cur, dur) => {
          const el = document.getElementById('extract-audio-time');
          if (el) el.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
        },
        onEnded: () => {
          const btn = document.getElementById('btn-extract-audio-play');
          if (btn) btn.textContent = '▶';
        },
      });
    }

    // 3. Bind UI event listeners
    bindTabNavigation();
    bindInjectTab();
    bindExtractTab();
    bindXrayTab();
    bindZeroWidthTab();
    bindAboutDialog();

    // 4. Preload default sample into X-Ray viewer for instant interactivity
    loadSampleImageIntoXray();
  } catch (err) {
    console.error('Failed to initialize StegoSlop WASM:', err);
    showToast('Failed to initialize: ' + err.message, 'error', 6000);
  }
}

function bindAboutDialog() {
  const openBtn = document.getElementById('btn-open-about');
  const closeBtn = document.getElementById('btn-close-about');
  const dialog = document.getElementById('about-dialog');
  if (openBtn && dialog) {
    openBtn.addEventListener('click', () => dialog.showModal());
  }
  if (closeBtn && dialog) {
    closeBtn.addEventListener('click', () => dialog.close());
  }
  if (dialog) {
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        dialog.close();
      }
    });
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================
// TAB NAVIGATION
// ============================================================
function bindTabNavigation() {
  const buttons = document.querySelectorAll('.nav-tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      switchTab(targetId);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  // Re-render canvases if needed when tab becomes visible
  if (tabId === 'tab-xray' && state.bitplaneViewer) {
    state.bitplaneViewer.render();
  }
  if (tabId === 'tab-inject' && state.players.injectAudio) {
    state.players.injectAudio.render();
  }
}

// ============================================================
// TAB 1: INJECT SECRET
// ============================================================
function bindInjectTab() {
  const dropzone = document.getElementById('inject-carrier-dropzone');
  const fileInput = document.getElementById('inject-carrier-file');
  const btnSampleImage = document.getElementById('btn-sample-image');
  const btnSampleAudio = document.getElementById('btn-sample-audio');
  const btnClearCarrier = document.getElementById('btn-clear-inject-carrier');

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleInjectCarrierFile(e.target.files[0]);
    }
  });

  setupDropzone(dropzone, (file) => handleInjectCarrierFile(file));

  btnSampleImage.addEventListener('click', async () => {
    const resp = await fetch('samples/sample_carrier.png');
    const blob = await resp.blob();
    const file = new File([blob], 'sample_carrier.png', { type: 'image/png' });
    handleInjectCarrierFile(file);
    showToast('Loaded sample image (256x256)', 'info');
  });

  btnSampleAudio.addEventListener('click', async () => {
    const resp = await fetch('samples/sample_carrier.wav');
    const blob = await resp.blob();
    const file = new File([blob], 'sample_carrier.wav', { type: 'audio/wav' });
    handleInjectCarrierFile(file);
    showToast('Loaded sample audio (3.0s WAV)', 'info');
  });

  btnClearCarrier.addEventListener('click', () => {
    clearInjectCarrier();
  });

  // Audio Play Button
  const btnAudioPlay = document.getElementById('btn-inject-audio-play');
  btnAudioPlay.addEventListener('click', () => {
    if (!state.players.injectAudio) return;
    const isPlaying = state.players.injectAudio.togglePlay();
    btnAudioPlay.textContent = isPlaying ? '⏸' : '▶';
  });

  // Engine Selector (LSB vs Robust)
  const btnEngineLsb = document.getElementById('btn-engine-lsb');
  const btnEngineRobust = document.getElementById('btn-engine-robust');
  const densityWrap = document.getElementById('density-selector-wrap');

  if (btnEngineLsb && btnEngineRobust) {
    btnEngineLsb.addEventListener('click', () => {
      btnEngineLsb.classList.add('active');
      btnEngineRobust.classList.remove('active');
      state.inject.engine = 'lsb';
      if (densityWrap) densityWrap.style.display = 'flex';
      updateInjectCapacity();
    });

    btnEngineRobust.addEventListener('click', () => {
      if (state.inject.carrierType === 'audio') {
        showToast('Robust mode is for images only (survives JPEG/Telegram compression)', 'info');
        return;
      }
      btnEngineRobust.classList.add('active');
      btnEngineLsb.classList.remove('active');
      state.inject.engine = 'robust';
      if (densityWrap) densityWrap.style.display = 'none';
      updateInjectCapacity();
    });
  }

  // BPU Selectors
  const bpuButtons = document.querySelectorAll('#tab-inject .seg-btn[data-bpu]');
  bpuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      bpuButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.inject.bpu = parseInt(btn.getAttribute('data-bpu'), 10);
      
      const descEl = document.getElementById('bpu-description');
      if (state.inject.bpu === 1) descEl.textContent = '1 bpu (Maximum Stealth / Imperceptible)';
      else if (state.inject.bpu === 2) descEl.textContent = '2 bpu (Balanced Stealth & Capacity)';
      else if (state.inject.bpu === 4) descEl.textContent = '4 bpu (High Payload Density)';

      updateInjectCapacity();
    });
  });

  // Payload Mode Switch (Text vs File)
  const btnModeText = document.getElementById('btn-payload-mode-text');
  const btnModeFile = document.getElementById('btn-payload-mode-file');
  const textContainer = document.getElementById('payload-text-container');
  const fileContainer = document.getElementById('payload-file-container');

  btnModeText.addEventListener('click', () => {
    btnModeText.classList.add('active');
    btnModeFile.classList.remove('active');
    textContainer.style.display = 'block';
    fileContainer.style.display = 'none';
    state.inject.payloadMode = 'text';
    updateInjectCapacity();
  });

  btnModeFile.addEventListener('click', () => {
    btnModeFile.classList.add('active');
    btnModeText.classList.remove('active');
    textContainer.style.display = 'none';
    fileContainer.style.display = 'block';
    state.inject.payloadMode = 'file';
    updateInjectCapacity();
  });

  // Secret Text input counter
  const secretTextEl = document.getElementById('inject-secret-text');
  secretTextEl.addEventListener('input', () => {
    const bytes = new TextEncoder().encode(secretTextEl.value).length;
    document.getElementById('secret-char-counter').textContent = formatBytes(bytes);
    updateInjectCapacity();
  });

  // Secret File dropzone
  const payloadDropzone = document.getElementById('inject-payload-dropzone');
  const payloadFileInput = document.getElementById('inject-payload-file');
  payloadDropzone.addEventListener('click', () => payloadFileInput.click());
  payloadFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleInjectPayloadFile(e.target.files[0]);
    }
  });
  setupDropzone(payloadDropzone, (file) => handleInjectPayloadFile(file));

  // AES-256-GCM Encryption Toggle
  const encryptToggle = document.getElementById('inject-encrypt-toggle');
  const cryptoFields = document.getElementById('inject-crypto-fields');
  const btnTogglePwd = document.getElementById('btn-toggle-inject-pwd');
  const pwdInput = document.getElementById('inject-password-input');

  encryptToggle.addEventListener('change', () => {
    state.inject.encrypt = encryptToggle.checked;
    cryptoFields.classList.toggle('active', encryptToggle.checked);
    updateInjectCapacity();
  });

  btnTogglePwd.addEventListener('click', () => {
    pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
  });

  // Primary Action: Execute Inject
  const btnExecute = document.getElementById('btn-execute-inject');
  btnExecute.addEventListener('click', () => executeInject());

  // Result Action Buttons
  document.getElementById('btn-download-stego').addEventListener('click', () => {
    if (!state.inject.stegoBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(state.inject.stegoBlob);
    a.download = state.inject.stegoFilename || 'stego_carrier.png';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('btn-send-to-xray').addEventListener('click', () => {
    if (!state.inject.stegoBlob || state.inject.carrierType !== 'image') {
      showToast('X-Ray is only available for Image carriers', 'info');
      return;
    }
    switchTab('tab-xray');
    state.bitplaneViewer.loadImage(state.inject.stegoBlob);
    showToast('Loaded stego image into X-Ray Inspector', 'success');
  });

  document.getElementById('btn-send-to-extract').addEventListener('click', () => {
    if (!state.inject.stegoBlob) return;
    switchTab('tab-extract');
    const file = new File([state.inject.stegoBlob], state.inject.stegoFilename, {
      type: state.inject.stegoBlob.type,
    });
    handleExtractCarrierFile(file);
    // Autofill password if used
    if (state.inject.encrypt) {
      document.getElementById('extract-password-input').value = pwdInput.value;
    }
    showToast('Loaded stego file into Extract tab', 'info');
  });
}

async function handleInjectCarrierFile(file) {
  const isWav = file.type.includes('wav') || file.name.toLowerCase().endsWith('.wav');
  const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(file.name);

  if (!isWav && !isImage) {
    showToast('Please upload a valid PNG, JPG, WebP image or 16-bit PCM WAV audio', 'error');
    return;
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  state.inject.carrierName = file.name;
  state.inject.carrierBytes = bytes;

  const dropzone = document.getElementById('inject-carrier-dropzone');
  const previewCard = document.getElementById('inject-carrier-preview');
  const previewThumb = document.getElementById('inject-preview-thumb');
  const previewName = document.getElementById('inject-preview-name');
  const previewMeta = document.getElementById('inject-preview-meta');
  const audioWrap = document.getElementById('inject-audio-player-wrap');

  dropzone.style.display = 'none';
  previewCard.style.display = 'flex';
  previewName.textContent = file.name;

  if (isImage) {
    state.inject.carrierType = 'image';
    audioWrap.style.display = 'none';
    const imgUrl = URL.createObjectURL(file);
    previewThumb.src = imgUrl;

    const img = new Image();
    img.src = imgUrl;
    await img.decode();

    state.inject.carrierMeta = {
      width: img.naturalWidth,
      height: img.naturalHeight,
      totalPixels: img.naturalWidth * img.naturalHeight,
    };
    previewMeta.textContent = `${img.naturalWidth} x ${img.naturalHeight} • ${formatBytes(file.size)}`;
  } else if (isWav) {
    state.inject.carrierType = 'audio';
    previewThumb.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🎵</text></svg>';

    try {
      const audioInfo = wasm.parse_audio(bytes);
      state.inject.carrierMeta = audioInfo;
      previewMeta.textContent = `${audioInfo.sample_rate} Hz • ${audioInfo.bits_per_sample}-bit • ${audioInfo.duration_seconds.toFixed(2)}s • ${formatBytes(file.size)}`;

      document.getElementById('audio-chip-format').textContent = `${audioInfo.bits_per_sample}-bit PCM`;
      document.getElementById('audio-chip-rate').textContent = `${(audioInfo.sample_rate / 1000).toFixed(1)} kHz`;
      document.getElementById('audio-chip-channels').textContent = audioInfo.num_channels === 1 ? 'Mono' : 'Stereo';

      audioWrap.style.display = 'block';
      if (state.players.injectAudio) {
        await state.players.injectAudio.loadAudio(arrayBuffer, audioInfo);
      }
    } catch (err) {
      showToast('WAV parse error: ' + err, 'error');
      clearInjectCarrier();
      return;
    }
  }

  updateInjectCapacity();
  showToast(`Loaded ${state.inject.carrierType}: ${file.name}`, 'info');
}

function clearInjectCarrier() {
  state.inject.carrierType = null;
  state.inject.carrierName = null;
  state.inject.carrierBytes = null;
  state.inject.carrierMeta = null;

  document.getElementById('inject-carrier-dropzone').style.display = 'block';
  document.getElementById('inject-carrier-preview').style.display = 'none';
  document.getElementById('inject-audio-player-wrap').style.display = 'none';

  if (state.players.injectAudio) {
    state.players.injectAudio.stop();
  }

  updateInjectCapacity();
}

async function handleInjectPayloadFile(file) {
  const buf = await file.arrayBuffer();
  state.inject.payloadBytes = new Uint8Array(buf);
  state.inject.payloadFileName = file.name;

  document.getElementById('inject-payload-filename').textContent = file.name;
  document.getElementById('secret-file-size').textContent = formatBytes(file.size);

  const fnInput = document.getElementById('inject-filename-input');
  if (!fnInput.value) {
    fnInput.value = file.name;
  }

  updateInjectCapacity();
}

function updateInjectCapacity() {
  const { carrierType, carrierMeta, bpu, payloadMode, payloadBytes, encrypt, engine } = state.inject;
  let maxCapacity = 0;

  if (engine === 'robust') {
    if (carrierType === 'image' && carrierMeta) {
      maxCapacity = wasm.compute_robust_image_capacity(carrierMeta.width, carrierMeta.height, encrypt);
    }
  } else {
    if (carrierType === 'image' && carrierMeta) {
      maxCapacity = wasm.compute_image_capacity(carrierMeta.width, carrierMeta.height, bpu);
    } else if (carrierType === 'audio' && carrierMeta) {
      maxCapacity = (carrierMeta.total_samples * bpu) / 8;
    }
  }

  let payloadSize = 0;
  if (payloadMode === 'text') {
    const text = document.getElementById('inject-secret-text').value;
    payloadSize = new TextEncoder().encode(text).length;
  } else if (payloadBytes) {
    payloadSize = payloadBytes.length;
  }

  let totalRequired = 0;
  if (engine === 'robust') {
    totalRequired = payloadSize;
  } else {
    // Protocol header overhead: 14 bytes base + 28 bytes if encrypted (salt + IV) + filename
    const virtualFilename = document.getElementById('inject-filename-input').value.trim();
    const filenameOverhead = virtualFilename.length > 0 ? 1 + new TextEncoder().encode(virtualFilename).length : 0;
    const headerOverhead = 14 + (encrypt ? 28 : 0) + filenameOverhead;
    totalRequired = payloadSize > 0 ? payloadSize + headerOverhead : 0;
  }

  const meterLabel = document.getElementById('capacity-meter-label');
  const meterBar = document.getElementById('capacity-meter-bar');
  const carrierInfo = document.getElementById('capacity-carrier-info');
  const statusBadge = document.getElementById('capacity-status-badge');

  if (maxCapacity === 0) {
    meterLabel.textContent = '0 B / 0 B (0%)';
    meterBar.style.width = '0%';
    meterBar.className = 'progress-fill';
    carrierInfo.textContent = 'No carrier loaded';
    statusBadge.textContent = 'Awaiting carrier';
    statusBadge.style.color = 'var(--text-secondary)';
    return;
  }

  const ratio = totalRequired / maxCapacity;
  const percent = Math.min(100, Math.round(ratio * 100));

  meterLabel.textContent = `${formatBytes(totalRequired)} / ${formatBytes(maxCapacity)} (${percent}%)`;
  meterBar.style.width = `${percent}%`;

  meterBar.classList.remove('warn', 'danger');
  if (ratio > 1.0) {
    meterBar.classList.add('danger');
    statusBadge.textContent = '⚠️ Capacity Exceeded!';
    statusBadge.style.color = 'var(--rose-error)';
  } else if (ratio > 0.75) {
    meterBar.classList.add('warn');
    statusBadge.textContent = 'Caution: High carrier usage';
    statusBadge.style.color = 'var(--amber-warn)';
  } else {
    statusBadge.textContent = payloadSize > 0 ? '✓ Payload fits safely' : 'Ready for secret payload';
    statusBadge.style.color = 'var(--teal-primary)';
  }

  carrierInfo.textContent = engine === 'robust'
    ? 'Robust DWT (JPEG-Resistant)'
    : `${carrierType === 'image' ? 'Image' : 'Audio'} @ ${bpu} bpu`;
}

async function executeInject() {
  const { carrierType, carrierBytes, bpu, payloadMode, payloadBytes, encrypt } = state.inject;

  if (!carrierBytes) {
    showToast('Please select a carrier image or audio file first', 'error');
    return;
  }

  let rawSecretBytes;
  let payloadTypeCode;
  const virtualFilename = document.getElementById('inject-filename-input').value.trim() || null;

  if (payloadMode === 'text') {
    const text = document.getElementById('inject-secret-text').value;
    if (!text) {
      showToast('Please enter a secret message to hide', 'error');
      return;
    }
    rawSecretBytes = new TextEncoder().encode(text);
    payloadTypeCode = 1; // Text
  } else {
    if (!payloadBytes || payloadBytes.length === 0) {
      showToast('Please upload a secret file to hide', 'error');
      return;
    }
    rawSecretBytes = payloadBytes;
    payloadTypeCode = 4; // File
  }

  const password = encrypt ? document.getElementById('inject-password-input').value : null;
  if (encrypt && (!password || password.length === 0)) {
    showToast('Please enter an encryption password', 'error');
    return;
  }

  try {
    const t0 = performance.now();

    let stegoBytes;
    let mimeType;
    let extension;

    if (state.inject.engine === 'robust') {
      if (carrierType !== 'image') {
        showToast('Robust mode is for images only (survives JPEG/Telegram compression)', 'error');
        return;
      }
      stegoBytes = wasm.embed_robust_image(carrierBytes, rawSecretBytes, password);
      mimeType = 'image/png';
      extension = 'png';
    } else {
      // 1. Pack secret into SLOP binary container
      const packedContainer = wasm.pack(payloadTypeCode, rawSecretBytes, password, bpu, virtualFilename);

      // 2. Embed into carrier
      if (carrierType === 'image') {
        stegoBytes = wasm.embed_image(carrierBytes, packedContainer, bpu);
        mimeType = 'image/png';
        extension = 'png';
      } else if (carrierType === 'audio') {
        stegoBytes = wasm.embed_audio(carrierBytes, packedContainer, bpu);
        mimeType = 'audio/wav';
        extension = 'wav';
      }
    }

    const elapsed = Math.round(performance.now() - t0);
    const blob = new Blob([stegoBytes], { type: mimeType });
    const baseName = state.inject.carrierName.replace(/\.[^/.]+$/, '');
    const stegoFilename = state.inject.engine === 'robust' ? `robust_${baseName}.${extension}` : `stego_${baseName}.${extension}`;

    state.inject.stegoBlob = blob;
    state.inject.stegoFilename = stegoFilename;

    // Display result card
    const resultCard = document.getElementById('inject-result-card');
    resultCard.classList.remove('hidden');

    document.getElementById('result-badge-carrier').textContent = state.inject.engine === 'robust'
      ? `Robust PNG (${formatBytes(blob.size)})`
      : `${extension.toUpperCase()} Stego (${formatBytes(blob.size)})`;
    document.getElementById('inject-result-summary').innerHTML = `
      Successfully injected <strong>${formatBytes(rawSecretBytes.length)}</strong> payload 
      in <strong>${elapsed}ms</strong> at <strong>${bpu} bits/unit</strong>.<br>
      Container size: ${formatBytes(packedContainer.length)} • SLOP v1 header sealed with CRC-32.
    `;

    showToast(`Stego carrier created in ${elapsed}ms!`, 'success');
  } catch (err) {
    console.error('Injection failed:', err);
    showToast(`Injection failed: ${err}`, 'error', 5000);
  }
}

// ============================================================
// TAB 2: EXTRACT SECRET
// ============================================================
function bindExtractTab() {
  const dropzone = document.getElementById('extract-carrier-dropzone');
  const fileInput = document.getElementById('extract-carrier-file');
  const btnClear = document.getElementById('btn-clear-extract-carrier');
  const btnExecute = document.getElementById('btn-execute-extract');
  const btnTogglePwd = document.getElementById('btn-toggle-extract-pwd');
  const pwdInput = document.getElementById('extract-password-input');

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleExtractCarrierFile(e.target.files[0]);
    }
  });

  setupDropzone(dropzone, (file) => handleExtractCarrierFile(file));

  btnClear.addEventListener('click', () => {
    state.extract.carrierBytes = null;
    state.extract.carrierName = null;
    dropzone.style.display = 'block';
    document.getElementById('extract-carrier-preview').style.display = 'none';
  });

  btnTogglePwd.addEventListener('click', () => {
    pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
  });

  // Extract Engine Selectors
  const btnExtAuto = document.getElementById('btn-extract-engine-auto');
  const btnExtLsb = document.getElementById('btn-extract-engine-lsb');
  const btnExtRobust = document.getElementById('btn-extract-engine-robust');
  const extDensityWrap = document.getElementById('extract-density-wrap');

  const setExtractEngine = (mode) => {
    state.extract.engine = mode;
    if (btnExtAuto) btnExtAuto.classList.toggle('active', mode === 'auto');
    if (btnExtLsb) btnExtLsb.classList.toggle('active', mode === 'lsb');
    if (btnExtRobust) btnExtRobust.classList.toggle('active', mode === 'robust');
    if (extDensityWrap) {
      extDensityWrap.style.display = mode === 'robust' ? 'none' : 'flex';
    }
  };

  if (btnExtAuto) btnExtAuto.addEventListener('click', () => setExtractEngine('auto'));
  if (btnExtLsb) btnExtLsb.addEventListener('click', () => setExtractEngine('lsb'));
  if (btnExtRobust) btnExtRobust.addEventListener('click', () => setExtractEngine('robust'));

  // Extract BPU Selector
  const bpuButtons = document.querySelectorAll('.extract-bpu');
  bpuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      bpuButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.extract.bpu = parseInt(btn.getAttribute('data-bpu'), 10);
    });
  });

  btnExecute.addEventListener('click', () => executeExtract());

  // Copy extracted text
  document.getElementById('btn-copy-extracted-text').addEventListener('click', () => {
    const text = document.getElementById('extract-text-display').value;
    navigator.clipboard.writeText(text);
    showToast('Copied decoded message to clipboard', 'success');
  });

  // Extracted Audio Player
  const btnAudioPlay = document.getElementById('btn-extract-audio-play');
  btnAudioPlay.addEventListener('click', () => {
    if (!state.players.extractAudio) return;
    const isPlaying = state.players.extractAudio.togglePlay();
    btnAudioPlay.textContent = isPlaying ? '⏸' : '▶';
  });
}

async function handleExtractCarrierFile(file) {
  const isWav = file.type.includes('wav') || file.name.toLowerCase().endsWith('.wav');
  const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(file.name);

  if (!isWav && !isImage) {
    showToast('Unsupported file type. Please upload a PNG image or WAV audio file.', 'error');
    return;
  }

  const arrayBuffer = await file.arrayBuffer();
  state.extract.carrierBytes = new Uint8Array(arrayBuffer);
  state.extract.carrierName = file.name;
  state.extract.carrierType = isWav ? 'audio' : 'image';

  const dropzone = document.getElementById('extract-carrier-dropzone');
  const preview = document.getElementById('extract-carrier-preview');
  const previewThumb = document.getElementById('extract-preview-thumb');
  const previewName = document.getElementById('extract-preview-name');
  const previewMeta = document.getElementById('extract-preview-meta');

  dropzone.style.display = 'none';
  preview.style.display = 'flex';
  previewName.textContent = file.name;
  previewMeta.textContent = `${isWav ? 'WAV Audio' : 'Image'} • ${formatBytes(file.size)}`;

  if (isImage) {
    previewThumb.src = URL.createObjectURL(file);
  } else {
    previewThumb.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🎵</text></svg>';
  }

  showToast(`Carrier ready: ${file.name}`, 'info');
}

async function executeExtract() {
  const { carrierBytes, carrierType, bpu } = state.extract;
  if (!carrierBytes) {
    showToast('Please upload a stego carrier first', 'error');
    return;
  }

  const password = document.getElementById('extract-password-input').value || null;

  try {
    let unpacked = null;
    let isRobust = false;

    if (carrierType === 'image' && (state.extract.engine === 'robust' || state.extract.engine === 'auto')) {
      try {
        const raw = wasm.extract_robust_image(carrierBytes, password);
        unpacked = {
          payload_type: 1,
          payload_type_name: 'Robust Text',
          data: raw,
          is_encrypted: !!password,
          bits_per_unit: 0,
          file_name: null,
          is_corrupted: false,
        };
        isRobust = true;
      } catch (err) {
        if (state.extract.engine === 'robust') {
          throw err;
        }
      }
    }

    if (!unpacked) {
      let containerBytes;
      if (carrierType === 'image') {
        containerBytes = wasm.extract_image(carrierBytes, bpu);
      } else {
        containerBytes = wasm.extract_audio(carrierBytes, bpu);
      }
      unpacked = wasm.unpack(containerBytes, password);
    }

    // Hide empty state, show result
    document.getElementById('extract-empty-state').style.display = 'none';
    document.getElementById('extract-result-content').style.display = 'block';

    // Update chips
    document.getElementById('extract-chip-type').textContent = isRobust ? 'Robust DWT' : `Type: ${unpacked.payload_type_name}`;
    document.getElementById('extract-chip-crypto').textContent = unpacked.is_encrypted ? 'AES-256-GCM Verified' : 'Unencrypted';
    document.getElementById('extract-chip-crypto').className = unpacked.is_encrypted ? 'badge-chip green' : 'badge-chip purple';
    document.getElementById('extract-chip-crc').textContent = unpacked.is_corrupted ? 'CRC Check Failed' : 'CRC-32 Valid';
    document.getElementById('extract-chip-crc').className = unpacked.is_corrupted ? 'badge-chip red' : 'badge-chip green';
    document.getElementById('extract-chip-size').textContent = `Size: ${formatBytes(unpacked.data.length)}`;

    // Filename box
    const fnBox = document.getElementById('extract-filename-box');
    if (unpacked.file_name) {
      fnBox.style.display = 'flex';
      document.getElementById('extract-filename-text').textContent = unpacked.file_name;
      document.getElementById('extract-filesize-text').textContent = formatBytes(unpacked.data.length);
      
      const downloadBtn = document.getElementById('btn-download-extracted-file');
      downloadBtn.onclick = () => {
        downloadBuffer(unpacked.data, unpacked.file_name, 'application/octet-stream');
      };
    } else {
      fnBox.style.display = 'none';
    }

    // Hide all viewports first
    const textBoxWrap = document.getElementById('extract-text-box-wrap');
    const audioWrap = document.getElementById('extract-audio-player-wrap');
    const imageWrap = document.getElementById('extract-image-box-wrap');
    textBoxWrap.style.display = 'none';
    audioWrap.style.display = 'none';
    imageWrap.style.display = 'none';

    if (unpacked.payload_type === 1) {
      // Text
      textBoxWrap.style.display = 'block';
      const decodedText = new TextDecoder().decode(unpacked.data);
      document.getElementById('extract-text-display').value = decodedText;
    } else if (unpacked.payload_type === 3) {
      // Audio
      audioWrap.style.display = 'block';
      if (state.players.extractAudio) {
        await state.players.extractAudio.loadAudio(unpacked.data.buffer);
      }
      document.getElementById('btn-download-extracted-audio').onclick = () => {
        downloadBuffer(unpacked.data, unpacked.file_name || 'extracted_audio.wav', 'audio/wav');
      };
    } else if (unpacked.payload_type === 2) {
      // Image
      imageWrap.style.display = 'block';
      const imgBlob = new Blob([unpacked.data], { type: 'image/png' });
      document.getElementById('extract-image-preview').src = URL.createObjectURL(imgBlob);
      document.getElementById('btn-download-extracted-image').onclick = () => {
        downloadBuffer(unpacked.data, unpacked.file_name || 'extracted_image.png', 'image/png');
      };
    } else {
      // Binary file
      if (!unpacked.file_name) {
        fnBox.style.display = 'flex';
        document.getElementById('extract-filename-text').textContent = 'extracted_payload.bin';
        document.getElementById('extract-filesize-text').textContent = formatBytes(unpacked.data.length);
        document.getElementById('btn-download-extracted-file').onclick = () => {
          downloadBuffer(unpacked.data, 'extracted_payload.bin', 'application/octet-stream');
        };
      }
    }

    showToast(`Successfully extracted ${unpacked.payload_type_name} payload!`, 'success');
  } catch (err) {
    console.error('Extract failed:', err);
    showToast(`Extraction failed: ${err}`, 'error', 6000);
  }
}

function downloadBuffer(data, filename, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ============================================================
// TAB 3: X-RAY BIT PLANE INSPECTOR
// ============================================================
function bindXrayTab() {
  const slider = document.getElementById('xray-bit-slider');
  const btnUploadTrigger = document.getElementById('btn-xray-upload-trigger');
  const fileInput = document.getElementById('xray-file-input');
  const btnSample = document.getElementById('btn-xray-sample');
  const btnCycle = document.getElementById('btn-xray-cycle');
  const btnInvert = document.getElementById('btn-xray-invert');
  const btnSplit = document.getElementById('btn-xray-split');
  const btnDownload = document.getElementById('btn-xray-download');

  slider.addEventListener('input', (e) => {
    if (state.bitplaneViewer) {
      state.bitplaneViewer.setBit(parseInt(e.target.value, 10));
    }
  });

  btnUploadTrigger.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      state.bitplaneViewer.loadImage(e.target.files[0]);
      showToast('Loaded image into X-Ray Inspector', 'info');
    }
  });

  btnSample.addEventListener('click', () => loadSampleImageIntoXray());

  btnCycle.addEventListener('click', () => {
    if (!state.bitplaneViewer) return;
    const isCycling = state.bitplaneViewer.toggleAutoCycle(550);
    btnCycle.textContent = isCycling ? '⏸ Pause Cycle' : '▶ Auto-Cycle (0..7)';
  });

  btnInvert.addEventListener('click', () => {
    if (state.bitplaneViewer) {
      state.bitplaneViewer.toggleInvert();
    }
  });

  btnSplit.addEventListener('click', () => {
    if (state.bitplaneViewer) {
      const isSplit = state.bitplaneViewer.toggleSplitMode();
      btnSplit.classList.toggle('active', isSplit);
    }
  });

  btnDownload.addEventListener('click', () => {
    if (state.bitplaneViewer) {
      state.bitplaneViewer.downloadCurrentPlane();
      showToast('Bit plane PNG exported', 'success');
    }
  });
}

async function loadSampleImageIntoXray() {
  try {
    const resp = await fetch('samples/sample_carrier.png');
    const blob = await resp.blob();
    if (state.bitplaneViewer) {
      await state.bitplaneViewer.loadImage(blob);
    }
  } catch (err) {
    console.error('Failed to load sample image for X-ray:', err);
  }
}

function updateXrayBitInfo(bitIndex) {
  const nameEl = document.getElementById('xray-bit-name');
  const weightEl = document.getElementById('xray-bit-weight');
  const slider = document.getElementById('xray-bit-slider');
  if (slider) slider.value = bitIndex;

  const names = [
    'Bit 0 (LSB — Stego Carrier Plane)',
    'Bit 1 (Secondary LSB Plane)',
    'Bit 2 (Tertiary Plane)',
    'Bit 3 (Mid-Tone Texture Plane)',
    'Bit 4 (Coarse Gradient Plane)',
    'Bit 5 (Image Silhouette Plane)',
    'Bit 6 (Luminance Contour Plane)',
    'Bit 7 (MSB — Dominant Visual Edge)',
  ];

  const weight = Math.pow(2, bitIndex);
  const percent = ((weight / 255) * 100).toFixed(2);

  if (nameEl) nameEl.textContent = names[bitIndex];
  if (weightEl) weightEl.textContent = `Weight: 2^${bitIndex} = ${weight} (${percent}%)`;
}

// ============================================================
// TAB 4: ZERO-WIDTH TEXT STEGANOGRAPHY
// ============================================================
function bindZeroWidthTab() {
  const coverTextEl = document.getElementById('zw-cover-text');
  const secretTextEl = document.getElementById('zw-secret-text');
  const encryptToggle = document.getElementById('zw-encrypt-toggle');
  const cryptoFields = document.getElementById('zw-crypto-fields');
  const passwordInput = document.getElementById('zw-password-input');
  const btnEncode = document.getElementById('btn-zw-encode');
  const btnCopy = document.getElementById('btn-copy-zw');

  encryptToggle.addEventListener('change', () => {
    cryptoFields.classList.toggle('active', encryptToggle.checked);
  });

  // Preset buttons
  document.getElementById('btn-zw-sample1').addEventListener('click', () => {
    coverTextEl.value = 'Quarterly financial report is finalized. Please review the attached spreadsheet before the audit.';
    secretTextEl.value = 'Offshore account ledger balance: $4,850,200 (BVI Trust)';
  });

  document.getElementById('btn-zw-sample2').addEventListener('click', () => {
    coverTextEl.value = 'Deployment completed smoothly to production clusters. All latency metrics green.';
    secretTextEl.value = 'Root SSH private key fingerprint: SHA256:d8a9f20e4b7c';
  });

  btnEncode.addEventListener('click', () => {
    const cover = coverTextEl.value;
    const secret = secretTextEl.value;
    if (!cover) {
      showToast('Please enter cover text', 'error');
      return;
    }
    if (!secret) {
      showToast('Please enter secret text to hide', 'error');
      return;
    }

    const password = encryptToggle.checked ? passwordInput.value : null;
    if (encryptToggle.checked && (!password || password.length === 0)) {
      showToast('Please enter an encryption password', 'error');
      return;
    }

    try {
      const stegoText = state.zeroWidthHandler.encode(cover, secret, password);
      document.getElementById('zw-result-card').classList.remove('hidden');
      document.getElementById('zw-output-plain').value = stegoText;

      // Render Visualizer
      const visualHtml = state.zeroWidthHandler.visualize(stegoText);
      document.getElementById('zw-output-visual').innerHTML = visualHtml;

      const stats = state.zeroWidthHandler.analyze(stegoText);
      document.getElementById('zw-stat-visible').textContent = `Visible chars: ${stats.visibleCount}`;
      document.getElementById('zw-stat-hidden').textContent = `Hidden bits: ${stats.hiddenBits} (${stats.hiddenBytes} B)`;

      showToast('Zero-width stego generated!', 'success');
    } catch (err) {
      showToast('Encoding failed: ' + err, 'error');
    }
  });

  btnCopy.addEventListener('click', () => {
    const text = document.getElementById('zw-output-plain').value;
    navigator.clipboard.writeText(text);
    showToast('Copied invisible stego text to clipboard!', 'success');
  });

  // Decode Section
  const decodeInput = document.getElementById('zw-decode-input');
  const btnPasteEncoded = document.getElementById('btn-zw-paste-encoded');
  const btnDecode = document.getElementById('btn-zw-decode');
  const decodePassword = document.getElementById('zw-decode-password');

  btnPasteEncoded.addEventListener('click', () => {
    const text = document.getElementById('zw-output-plain').value;
    if (text) {
      decodeInput.value = text;
      inspectZeroWidthInput(text);
    }
  });

  decodeInput.addEventListener('input', () => {
    inspectZeroWidthInput(decodeInput.value);
  });

  btnDecode.addEventListener('click', () => {
    const text = decodeInput.value;
    if (!text) {
      showToast('Please enter text to decode', 'error');
      return;
    }

    const password = decodePassword.value || null;
    try {
      const revealed = state.zeroWidthHandler.decode(text, password);
      document.getElementById('zw-revealed-card').classList.remove('hidden');
      document.getElementById('zw-revealed-text').value = revealed;
      showToast('Secret payload decrypted!', 'success');
    } catch (err) {
      showToast('Decoding failed: ' + err, 'error', 4000);
    }
  });

  document.getElementById('btn-copy-zw-revealed').addEventListener('click', () => {
    const text = document.getElementById('zw-revealed-text').value;
    navigator.clipboard.writeText(text);
    showToast('Copied revealed secret!', 'success');
  });
}

function inspectZeroWidthInput(text) {
  const icon = document.getElementById('zw-detector-icon');
  const label = document.getElementById('zw-detector-text');
  const bitsChip = document.getElementById('zw-detector-bits');

  if (!state.zeroWidthHandler || !text) {
    icon.textContent = '⚪';
    label.textContent = 'No text entered';
    bitsChip.textContent = '0 bits';
    bitsChip.className = 'badge-chip';
    return;
  }

  const analysis = state.zeroWidthHandler.analyze(text);
  if (analysis.hasHidden) {
    icon.textContent = '🟢';
    label.textContent = `SLOP Zero-Width Payload Detected!`;
    bitsChip.textContent = `${analysis.hiddenBits} bits (${analysis.hiddenBytes} B)`;
    bitsChip.className = 'badge-chip green';
  } else {
    icon.textContent = '⚪';
    label.textContent = 'No hidden zero-width steganography found';
    bitsChip.textContent = '0 bits';
    bitsChip.className = 'badge-chip';
  }
}

// ============================================================
// DRAG AND DROP UTILITY
// ============================================================
function setupDropzone(element, onFileDropped) {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.add('dragover');
  });

  element.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.remove('dragover');
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDropped(e.dataTransfer.files[0]);
    }
  });
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
