/* tslint:disable */
/* eslint-disable */

export function bitplane(image_bytes: Uint8Array | number[], bit_index: number): Uint8Array;

export function bitplane_rgba(rgba_pixels: Uint8Array | number[], bit_index: number): Uint8Array;

export function compute_image_capacity(width: number, height: number, bits_per_channel: number): number;

export function embed_audio(wav_bytes: Uint8Array | number[], payload_container: Uint8Array | number[], bits_per_sample: number): Uint8Array;

export function embed_image(image_bytes: Uint8Array | number[], payload_container: Uint8Array | number[], bits_per_channel: number): Uint8Array;

export function embed_image_rgba(rgba_pixels: Uint8Array | number[], payload_container: Uint8Array | number[], bits_per_channel: number): Uint8Array;

export function extract_audio(wav_bytes: Uint8Array | number[], bits_per_sample: number): Uint8Array;

export function extract_image(image_bytes: Uint8Array | number[], bits_per_channel: number): Uint8Array;

export function extract_image_rgba(rgba_pixels: Uint8Array | number[], bits_per_channel: number): Uint8Array;

export function extract_raw_bits_audio(wav_bytes: Uint8Array | number[], bits_per_sample: number, max_bytes: number): Uint8Array;

export function extract_raw_bits_image_rgba(rgba_pixels: Uint8Array | number[], bits_per_channel: number, max_bytes: number): Uint8Array;

export function pack(payload_type: number, data: Uint8Array | number[], password: string | null | undefined, bits_per_unit: number, file_name?: string | null): Uint8Array;

export function parse_audio(wav_bytes: Uint8Array | number[]): any;

export function rgba_to_png(rgba_pixels: Uint8Array | number[], width: number, height: number): Uint8Array;

export function unpack(container: Uint8Array | number[], password?: string | null): any;

export function unpack_forced(container: Uint8Array | number[], password?: string | null): any;

export function zero_width_decode(stego_text: string, password?: string | null): Uint8Array;

export function zero_width_encode(cover_text: string, secret_data: Uint8Array | number[], password?: string | null): string;

export function zero_width_has_hidden(text: string): boolean;

export function zero_width_strip(text: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly bitplane: (a: number, b: number, c: number) => [number, number, number, number];
    readonly bitplane_rgba: (a: number, b: number, c: number) => [number, number];
    readonly compute_image_capacity: (a: number, b: number, c: number) => [number, number, number];
    readonly embed_audio: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly embed_image: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly embed_image_rgba: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly extract_audio: (a: number, b: number, c: number) => [number, number, number, number];
    readonly extract_image: (a: number, b: number, c: number) => [number, number, number, number];
    readonly extract_image_rgba: (a: number, b: number, c: number) => [number, number, number, number];
    readonly extract_raw_bits_audio: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly extract_raw_bits_image_rgba: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly pack: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
    readonly parse_audio: (a: number, b: number) => [number, number, number];
    readonly rgba_to_png: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly unpack: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly unpack_forced: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly zero_width_decode: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly zero_width_encode: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly zero_width_has_hidden: (a: number, b: number) => number;
    readonly zero_width_strip: (a: number, b: number) => [number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
