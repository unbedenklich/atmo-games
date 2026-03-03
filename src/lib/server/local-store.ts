/**
 * In-memory fallback store for local development (no Cloudflare KV/D1).
 * Data lives only for the lifetime of the dev server process.
 */

const W = 1000;
const H = 1000;

/** Canvas pixel data — 1 byte per pixel (color index), default white (31). */
const canvas = new Uint8Array(W * H).fill(31);

/** Who placed each pixel: key = "x,y", value = { did, painted_at }. */
const pixelOwners = new Map<string, { did: string; painted_at: number }>();

let cursor = 0;

export function getLocalCanvas(): { canvas: ArrayBuffer; cursor: number } {
	return { canvas: canvas.buffer.slice(0), cursor };
}

export function setLocalPixel(x: number, y: number, color: number, did: string): void {
	if (x < 0 || x >= W || y < 0 || y >= H) return;
	if (color < 0 || color > 31) return;
	canvas[y * W + x] = color;
	pixelOwners.set(`${x},${y}`, { did, painted_at: Date.now() * 1000 });
	cursor++;
}

export function getLocalPixel(x: number, y: number): { did: string; painted_at: number } | null {
	return pixelOwners.get(`${x},${y}`) ?? null;
}
