use std::io::Cursor;
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use stegoslop_core::{
    audio, image as stego_image, protocol, zero_width,
    PayloadType,
};

#[derive(Serialize, Deserialize)]
pub struct UnpackedResult {
    pub payload_type: u8,
    pub payload_type_name: String,
    #[serde(with = "serde_bytes")]
    pub data: Vec<u8>,
    pub is_encrypted: bool,
    pub bits_per_unit: usize,
    pub file_name: Option<String>,
    pub is_corrupted: bool,
}

#[derive(Serialize, Deserialize)]
pub struct AudioMetadata {
    pub num_channels: u16,
    pub sample_rate: u32,
    pub bits_per_sample: u16,
    pub data_size: usize,
    pub duration_seconds: f64,
    pub total_samples: usize,
    pub capacity_1bpu: usize,
    pub capacity_2bpu: usize,
    pub capacity_4bpu: usize,
}

#[derive(Serialize, Deserialize)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub capacity_1bpu: usize,
    pub capacity_2bpu: usize,
    pub capacity_4bpu: usize,
}

fn err_to_js(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

fn encode_png_buffer(rgba_pixels: &[u8], width: u32, height: u32) -> Result<Vec<u8>, JsValue> {
    use image::codecs::png::PngEncoder;
    use image::ImageEncoder;

    let mut out = Cursor::new(Vec::new());
    let encoder = PngEncoder::new(&mut out);
    encoder
        .write_image(rgba_pixels, width, height, image::ExtendedColorType::Rgba8)
        .map_err(err_to_js)?;
    Ok(out.into_inner())
}

#[wasm_bindgen]
pub fn pack(
    payload_type: u8,
    data: &[u8],
    password: Option<String>,
    bits_per_unit: usize,
    file_name: Option<String>,
) -> Result<Vec<u8>, JsValue> {
    let p_type = PayloadType::from_code(payload_type).map_err(err_to_js)?;
    let pwd = password.as_deref().filter(|s| !s.is_empty());
    let fn_ref = file_name.as_deref().filter(|s| !s.is_empty());

    protocol::pack_payload(p_type, data, pwd, bits_per_unit, fn_ref).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn unpack(container: &[u8], password: Option<String>) -> Result<JsValue, JsValue> {
    let pwd = password.as_deref().filter(|s| !s.is_empty());
    let unpacked = protocol::unpack_payload(container, pwd).map_err(err_to_js)?;

    let type_name = match unpacked.payload_type {
        PayloadType::Text => "Text",
        PayloadType::Image => "Image",
        PayloadType::Audio => "Audio",
        PayloadType::File => "File",
    };

    let result = UnpackedResult {
        payload_type: unpacked.payload_type.code(),
        payload_type_name: type_name.to_string(),
        data: unpacked.data,
        is_encrypted: unpacked.is_encrypted,
        bits_per_unit: unpacked.bits_per_unit,
        file_name: unpacked.file_name,
        is_corrupted: unpacked.is_corrupted,
    };

    let serializer = serde_wasm_bindgen::Serializer::new().serialize_bytes_as_arrays(false);
    result.serialize(&serializer).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn unpack_forced(container: &[u8], password: Option<String>) -> Result<JsValue, JsValue> {
    let pwd = password.as_deref().filter(|s| !s.is_empty());
    let unpacked = protocol::unpack_payload_forced(container, pwd).map_err(err_to_js)?;

    let type_name = match unpacked.payload_type {
        PayloadType::Text => "Text",
        PayloadType::Image => "Image",
        PayloadType::Audio => "Audio",
        PayloadType::File => "File",
    };

    let result = UnpackedResult {
        payload_type: unpacked.payload_type.code(),
        payload_type_name: type_name.to_string(),
        data: unpacked.data,
        is_encrypted: unpacked.is_encrypted,
        bits_per_unit: unpacked.bits_per_unit,
        file_name: unpacked.file_name,
        is_corrupted: unpacked.is_corrupted,
    };

    let serializer = serde_wasm_bindgen::Serializer::new().serialize_bytes_as_arrays(false);
    result.serialize(&serializer).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn compute_image_capacity(width: u32, height: u32, bits_per_channel: usize) -> Result<usize, JsValue> {
    stego_image::compute_capacity(width, height, bits_per_channel).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn embed_image_rgba(
    rgba_pixels: &[u8],
    payload_container: &[u8],
    bits_per_channel: usize,
) -> Result<Vec<u8>, JsValue> {
    let mut modified = rgba_pixels.to_vec();
    stego_image::embed_in_rgba(&mut modified, payload_container, bits_per_channel).map_err(err_to_js)?;
    Ok(modified)
}

#[wasm_bindgen]
pub fn extract_image_rgba(
    rgba_pixels: &[u8],
    bits_per_channel: usize,
) -> Result<Vec<u8>, JsValue> {
    stego_image::extract_from_rgba(rgba_pixels, bits_per_channel).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn extract_raw_bits_image_rgba(
    rgba_pixels: &[u8],
    bits_per_channel: usize,
    max_bytes: usize,
) -> Result<Vec<u8>, JsValue> {
    stego_image::extract_raw_bits_from_rgba(rgba_pixels, bits_per_channel, max_bytes).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn bitplane_rgba(rgba_pixels: &[u8], bit_index: usize) -> Vec<u8> {
    stego_image::generate_bit_plane(rgba_pixels, bit_index)
}

#[wasm_bindgen]
pub fn embed_image(
    image_bytes: &[u8],
    payload_container: &[u8],
    bits_per_channel: usize,
) -> Result<Vec<u8>, JsValue> {
    let img = image::load_from_memory(image_bytes).map_err(err_to_js)?.to_rgba8();
    let (width, height) = img.dimensions();
    let mut raw = img.into_raw();
    stego_image::embed_in_rgba(&mut raw, payload_container, bits_per_channel).map_err(err_to_js)?;
    encode_png_buffer(&raw, width, height)
}

#[wasm_bindgen]
pub fn extract_image(
    image_bytes: &[u8],
    bits_per_channel: usize,
) -> Result<Vec<u8>, JsValue> {
    let img = image::load_from_memory(image_bytes).map_err(err_to_js)?.to_rgba8();
    stego_image::extract_from_rgba(img.as_raw(), bits_per_channel).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn bitplane(image_bytes: &[u8], bit_index: usize) -> Result<Vec<u8>, JsValue> {
    let img = image::load_from_memory(image_bytes).map_err(err_to_js)?.to_rgba8();
    let (width, height) = img.dimensions();
    let plane_rgba = stego_image::generate_bit_plane(img.as_raw(), bit_index);
    encode_png_buffer(&plane_rgba, width, height)
}

#[wasm_bindgen]
pub fn rgba_to_png(rgba_pixels: &[u8], width: u32, height: u32) -> Result<Vec<u8>, JsValue> {
    encode_png_buffer(rgba_pixels, width, height)
}

#[wasm_bindgen]
pub fn embed_audio(
    wav_bytes: &[u8],
    payload_container: &[u8],
    bits_per_sample: usize,
) -> Result<Vec<u8>, JsValue> {
    audio::embed_in_wav(wav_bytes, payload_container, bits_per_sample).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn extract_audio(
    wav_bytes: &[u8],
    bits_per_sample: usize,
) -> Result<Vec<u8>, JsValue> {
    audio::extract_from_wav(wav_bytes, bits_per_sample).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn extract_raw_bits_audio(
    wav_bytes: &[u8],
    bits_per_sample: usize,
    max_bytes: usize,
) -> Result<Vec<u8>, JsValue> {
    audio::extract_raw_bits_from_wav(wav_bytes, bits_per_sample, max_bytes).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn parse_audio(wav_bytes: &[u8]) -> Result<JsValue, JsValue> {
    let info = audio::parse_wav(wav_bytes).map_err(err_to_js)?;
    let meta = AudioMetadata {
        num_channels: info.num_channels,
        sample_rate: info.sample_rate,
        bits_per_sample: info.bits_per_sample,
        data_size: info.data_size,
        duration_seconds: info.duration_seconds(),
        total_samples: info.total_samples(),
        capacity_1bpu: info.capacity(1),
        capacity_2bpu: info.capacity(2),
        capacity_4bpu: info.capacity(4),
    };
    serde_wasm_bindgen::to_value(&meta).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn zero_width_encode(
    cover_text: &str,
    secret_data: &[u8],
    password: Option<String>,
) -> Result<String, JsValue> {
    let pwd = password.as_deref().filter(|s| !s.is_empty());
    zero_width::encode(cover_text, secret_data, pwd).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn zero_width_decode(
    stego_text: &str,
    password: Option<String>,
) -> Result<Vec<u8>, JsValue> {
    let pwd = password.as_deref().filter(|s| !s.is_empty());
    zero_width::decode(stego_text, pwd).map_err(err_to_js)
}

#[wasm_bindgen]
pub fn zero_width_has_hidden(text: &str) -> bool {
    zero_width::has_hidden_data(text)
}

#[wasm_bindgen]
pub fn zero_width_strip(text: &str) -> String {
    zero_width::strip_hidden_data(text)
}

#[wasm_bindgen]
pub fn compute_robust_image_capacity(width: u32, height: u32, is_encrypted: bool) -> usize {
    stegoslop_core::compute_robust_capacity(width, height, is_encrypted)
}

#[wasm_bindgen]
pub fn embed_robust_image(
    image_bytes: &[u8],
    secret_data: &[u8],
    password: Option<String>,
) -> Result<Vec<u8>, JsValue> {
    let img = image::load_from_memory(image_bytes).map_err(err_to_js)?.to_rgba8();
    let (width, height) = img.dimensions();
    let mut raw = img.into_raw();
    let pwd = password.as_deref().filter(|s| !s.is_empty());

    stegoslop_core::embed_robust_in_rgba(&mut raw, width, height, secret_data, pwd)
        .map_err(err_to_js)?;

    encode_png_buffer(&raw, width, height)
}

#[wasm_bindgen]
pub fn extract_robust_image(
    image_bytes: &[u8],
    password: Option<String>,
) -> Result<Vec<u8>, JsValue> {
    let img = image::load_from_memory(image_bytes).map_err(err_to_js)?.to_rgba8();
    let (width, height) = img.dimensions();
    let pwd = password.as_deref().filter(|s| !s.is_empty());

    stegoslop_core::extract_robust_from_rgba(img.as_raw(), width, height, pwd)
        .map_err(err_to_js)
}
