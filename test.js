import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('--- Running StegoSlop WASM Verification Suite ---');
  const wasmModule = await import('./pkg/stegoslop_wasm.js');
  const wasmBuffer = fs.readFileSync(path.join(__dirname, 'pkg/stegoslop_wasm_bg.wasm'));
  wasmModule.initSync({ module: wasmBuffer });

  // 1. Test Zero-Width
  const secretText = 'CLASSIFIED_TOP_SECRET_COORDINATES_2026';
  const cover = 'Just a standard weather forecast for tomorrow morning.';
  const encodedZW = wasmModule.zero_width_encode(cover, new TextEncoder().encode(secretText), 'secretPass');
  if (!wasmModule.zero_width_has_hidden(encodedZW)) {
    throw new Error('Zero-width detection failed');
  }
  const decodedZW = wasmModule.zero_width_decode(encodedZW, 'secretPass');
  const decodedText = new TextDecoder().decode(decodedZW);
  if (decodedText !== secretText) {
    throw new Error(`ZW mismatch: expected "${secretText}", got "${decodedText}"`);
  }
  console.log('✓ Zero-width Unicode encode/decode test passed');

  // 2. Test Image LSB Embed & Extract
  const pngPath = path.join(__dirname, 'samples/sample_carrier.png');
  const pngBytes = fs.readFileSync(pngPath);
  const payloadMsg = 'Quantum entanglement telemetry data';
  const packedImgPayload = wasmModule.pack(1, new TextEncoder().encode(payloadMsg), 'aes_password_key', 2, 'telemetry.log');
  const stegoPng = wasmModule.embed_image(pngBytes, packedImgPayload, 2);
  const extractedImg = wasmModule.extract_image(stegoPng, 2);
  const unpackedImg = wasmModule.unpack(extractedImg, 'aes_password_key');
  if (new TextDecoder().decode(unpackedImg.data) !== payloadMsg || unpackedImg.file_name !== 'telemetry.log') {
    throw new Error('Image LSB embed/extract roundtrip failed');
  }
  console.log('✓ Image LSB embed/extract roundtrip passed');

  // 3. Test Bit Plane Slicing
  const bp0 = wasmModule.bitplane(stegoPng, 0);
  if (!bp0 || bp0.length === 0) {
    throw new Error('Bitplane generation failed');
  }
  console.log(`✓ Bitplane 0 rendered (${bp0.length} PNG bytes)`);

  // 4. Test Audio LSB Embed & Extract
  const wavPath = path.join(__dirname, 'samples/sample_carrier.wav');
  const wavBytes = fs.readFileSync(wavPath);
  const audioInfo = wasmModule.parse_audio(wavBytes);
  if (audioInfo.bits_per_sample !== 16 || audioInfo.sample_rate !== 44100) {
    throw new Error('Audio header parsing failed');
  }
  const stegoWav = wasmModule.embed_audio(wavBytes, packedImgPayload, 2);
  const extractedWav = wasmModule.extract_audio(stegoWav, 2);
  const unpackedWav = wasmModule.unpack(extractedWav, 'aes_password_key');
  if (new TextDecoder().decode(unpackedWav.data) !== payloadMsg) {
    throw new Error('Audio LSB roundtrip failed');
  }
  console.log('✓ Audio 16-bit PCM WAV embed/extract roundtrip passed');

  console.log('--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
