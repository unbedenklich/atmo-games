import { PALETTE } from './palette';

const W = 1000;
const H = 1000;

function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc ^= byte;
		for (let i = 0; i < 8; i++) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const typeBytes = new Uint8Array(4);
	for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);

	const lenBuf = new Uint8Array(4);
	new DataView(lenBuf.buffer).setUint32(0, data.length, false);

	const crcInput = new Uint8Array(4 + data.length);
	crcInput.set(typeBytes);
	crcInput.set(data, 4);
	const crcVal = new Uint8Array(4);
	new DataView(crcVal.buffer).setUint32(0, crc32(crcInput), false);

	const out = new Uint8Array(4 + 4 + data.length + 4);
	out.set(lenBuf, 0);
	out.set(typeBytes, 4);
	out.set(data, 8);
	out.set(crcVal, 8 + data.length);
	return out;
}

function uint8ToBase64(arr: Uint8Array): string {
	// Process in chunks to avoid stack overflow with large arrays
	let binary = '';
	const CHUNK = 8192;
	for (let i = 0; i < arr.length; i += CHUNK) {
		binary += String.fromCharCode(...arr.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/**
 * Convert canvas pixel indices to a downsampled PNG and return as a base64 data URL.
 * @param pixels  Raw canvas data (1 byte per pixel = color index, W*H = 1_000_000 bytes)
 * @param scale   Downsampling factor (4 = 250×250, 5 = 200×200). Defaults to 4.
 */
export async function canvasToPngDataUrl(pixels: Uint8Array, scale = 2): Promise<string> {
	const dstW = Math.floor(W / scale);
	const dstH = Math.floor(H / scale);

	// Pre-parse palette hex → [r, g, b]
	const rgb = PALETTE.map((hex) => {
		const n = parseInt(hex.slice(1), 16);
		return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] as [number, number, number];
	});

	// Build raw image rows: 1 filter byte (0) + RGB per pixel per row
	const rowStride = 1 + dstW * 3;
	const raw = new Uint8Array(dstH * rowStride);
	for (let y = 0; y < dstH; y++) {
		raw[y * rowStride] = 0; // None filter
		for (let x = 0; x < dstW; x++) {
			const idx = pixels[Math.floor(y * scale) * W + Math.floor(x * scale)] ?? 0;
			const [r, g, b] = rgb[idx] ?? [255, 255, 255];
			const base = y * rowStride + 1 + x * 3;
			raw[base] = r;
			raw[base + 1] = g;
			raw[base + 2] = b;
		}
	}

	// Zlib-compress (deflate with zlib header — required for PNG IDAT)
	const cs = new CompressionStream('deflate');
	const writer = cs.writable.getWriter();
	writer.write(raw);
	writer.close();
	const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());

	// Build PNG
	const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

	const ihdr = new Uint8Array(13);
	const ihdrView = new DataView(ihdr.buffer);
	ihdrView.setUint32(0, dstW, false);
	ihdrView.setUint32(4, dstH, false);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // RGB color type

	const ihdrChunk = pngChunk('IHDR', ihdr);
	const idatChunk = pngChunk('IDAT', compressed);
	const iendChunk = pngChunk('IEND', new Uint8Array(0));

	const png = new Uint8Array(
		sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length
	);
	let off = 0;
	png.set(sig, off); off += sig.length;
	png.set(ihdrChunk, off); off += ihdrChunk.length;
	png.set(idatChunk, off); off += idatChunk.length;
	png.set(iendChunk, off);

	return `data:image/png;base64,${uint8ToBase64(png)}`;
}
