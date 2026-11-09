# 🛡️ StegoSlop — Client-Side WebAssembly Steganography Suite

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-Rust-teal.svg)](https://webassembly.org/)
[![Client-Side Privacy](https://img.shields.io/badge/Privacy-100%25%20In--Browser-brightgreen.svg)](#100-client-side-privacy-guarantee)

**StegoSlop** is a client-side WebAssembly steganography web suite. It allows you to conceal, inspect, and extract encrypted data inside images, audio files, and plain text without sending a single byte to an external server.

---

## ✨ Features

- **🖼️ Image LSB Steganography:**
  - Embed arbitrary text or confidential files into PNG, JPEG, and WebP images.
  - Sequential distribution across R, G, B channels with 100% intact Alpha channel protection.
  - Selectable bit densities: `1 bpu` (Maximum stealth / Imperceptible), `2 bpu` (Balanced), and `4 bpu` (Maximum payload).
  - Live carrier capacity meter with visual color-coded utilization gauge.

- **🎵 Audio 16-bit PCM WAV Steganography:**
  - Embed hidden payloads into little-endian 16-bit PCM RIFF WAV audio samples.
  - Built-in Web Audio API player with **Material 3 Expressive animated wavy progress scrubber**.
  - Interactive scrubbing with spring physics and format badge chips (`16-bit PCM`, `44.1 kHz`, `Channels`, `Duration`).

- **🔬 Interactive X-Ray Bit Plane Inspector:**
  - Canvas-based hardware-accelerated bit plane slicer (Bits 0 through 7).
  - Isolate Bit 0 (LSB) to inspect steganographic carrier noise and ciphertext entropy.
  - Features: Auto-Cycle animation (`0..7`), Invert Polarity, Split Comparison View (Original vs Bit Plane), and 1-click PNG export.

- **👻 Zero-Width Unicode Text Steganography:**
  - Conceal secret messages inside ordinary plain text using invisible Unicode characters:
    - `\uFEFF` (Byte Order Mark / Header)
    - `\u200C` (Zero Width Non-Joiner — Bit 0)
    - `\u200D` (Zero Width Joiner — Bit 1)
    - `\u2060` (Word Joiner — Delimiter)
  - Live real-time detector: detects hidden payloads as you type or paste.
  - **Visualizer Mode:** renders invisible characters as glowing Cyberpunk chips for visual inspection.
  - One-click copy-to-clipboard with toast notifications.

- **🔐 Authenticated Encryption (AES-256-GCM):**
  - Optional military-grade encryption for all media modes.
  - Key derivation: `PBKDF2-HMAC-SHA256` with 100,000 iterations and 16-byte cryptographically secure random salt.
  - Nonce/IV: 12-byte random IV via OS CSPRNG (`getrandom` / Web Crypto).
  - Integrity: 16-byte GCM authentication tag + CRC-32 checksum to protect against tampering or bit-rot.

- **🛡️ 100% Client-Side Privacy:**
  - Powered by a Rust core compiled directly to WebAssembly (`wasm32-unknown-unknown`).
  - Zero server uploads. You can disconnect your network or run it completely offline.

---

## 📐 Binary Protocol Specification (`SLOP` v1)

All binary steganography containers share a unified cross-platform format:

```text
+-------------------+----------------+---------------+-------------------+
| Field             | Offset (Bytes) | Size (Bytes)  | Description       |
+-------------------+----------------+---------------+-------------------+
| MAGIC_BYTES       | 0..3           | 4             | "SLOP" (0x534C4F50)|
| PAYLOAD_TYPE      | 4              | 1             | 0x01:Text, 0x02:Img|
|                   |                |               | 0x03:Aud, 0x04:File|
| FLAGS             | 5              | 1             | Bit 0: Encrypted  |
|                   |                |               | Bit 1-2: BPU code |
|                   |                |               | Bit 3: HasFilename|
| PAYLOAD_LEN       | 6..9           | 4             | Big-Endian uint32 |
| CRC32_CHECKSUM    | 10..13         | 4             | Big-Endian uint32 |
| [SALT] (optional) | 14..29         | 16            | PBKDF2 Salt       |
| [IV] (optional)   | 30..41         | 12            | AES-GCM Nonce/IV  |
| [FILENAME] (opt)  | variable       | 1 + N (<=255) | Length + UTF-8    |
| PAYLOAD_DATA      | variable       | N             | Secret Ciphertext |
+-------------------+----------------+---------------+-------------------+
```

---

## 🚀 Quick Start & Development

### Prerequisites

- Rust (with `wasm32-unknown-unknown` target):
  ```bash
  rustup target add wasm32-unknown-unknown
  ```
- Node.js (v18+)

### Building WebAssembly

To compile the `stegoslop-wasm` crate into `./pkg`:

```bash
npm run build:wasm
```

### Running Automated Test Suite

```bash
# Test Rust core crate
cargo test --manifest-path crates/stegoslop-core/Cargo.toml

# Test WebAssembly bindings & roundtrips in Node.js
npm run test:wasm
```

### Local Preview

Start any static HTTP server (e.g., Python or Node):

```bash
npm start
# or: python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser.

---

## 📁 Repository Structure

```text
stegoslop-web/
├── Cargo.toml                     # Rust workspace root
├── package.json                   # NPM package scripts & configuration
├── index.html                     # Responsive web app entrypoint
├── css/
│   └── style.css                  # Material 3 Expressive + Cyberpunk styles
├── js/
│   ├── app.js                     # Main application controller
│   ├── audio-player.js            # Web Audio API + MD3 wavy progress canvas
│   ├── bitplane-viewer.js         # Interactive X-Ray bit plane renderer
│   └── zero-width.js              # Zero-width Unicode steganography engine
├── crates/
│   ├── stegoslop-core/            # Core Rust steganography engine
│   └── stegoslop-wasm/            # wasm-bindgen bindings & serialization
├── pkg/                           # Compiled WebAssembly bundle (.wasm + .js)
├── samples/                       # Sample carrier assets (PNG & WAV)
└── .github/workflows/deploy.yml   # GitHub Pages deployment workflow
```

---

## 📜 License

Licensed under the [GNU General Public License v3.0](LICENSE).
