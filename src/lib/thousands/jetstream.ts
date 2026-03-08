/**
 * Jetstream WebSocket client for real-time pixel updates.
 *
 * Connects to the AT Protocol Jetstream firehose and invokes a callback for
 * every relevant commit.
 */

const JETSTREAM_URL = 'wss://jetstream1.us-east.bsky.network/subscribe';
const RECONNECT_MS = 3_000;

export type PixelHandler = (x: number, y: number, color: number, did: string, timeUs: number) => void;
export type StatusHandler = (connected: boolean) => void;
export type RecordMapper = (record: unknown) => { x: number; y: number; color: number } | null;

export class JetstreamClient {
	private ws: WebSocket | null = null;
	private cursor: number;
	private collection: string;
	private onPixel: PixelHandler;
	private mapRecord: RecordMapper;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private destroyed = false;

	onStatusChange: StatusHandler = () => {};

	constructor(cursor: number, collection: string, onPixel: PixelHandler, mapRecord: RecordMapper) {
		this.cursor = cursor;
		this.collection = collection;
		this.onPixel = onPixel;
		this.mapRecord = mapRecord;
	}

	connect() {
		if (this.destroyed) return;

		const url = new URL(JETSTREAM_URL);
		url.searchParams.set('wantedCollections', this.collection);
		if (this.cursor > 0) {
			url.searchParams.set('cursor', this.cursor.toString());
		}

		this.ws = new WebSocket(url);

		this.ws.onopen = () => {
			console.log('[jetstream] connected to', url.toString());
			this.onStatusChange(true);
		};

		this.ws.onmessage = (ev) => {
			try {
				const msg = JSON.parse(ev.data as string);
				if (msg.kind !== 'commit') return;

				const c = msg.commit;
				if (!c || c.collection !== this.collection) return;
				if (c.operation !== 'create') return;

				const pixel = this.mapRecord(c.record);
				if (!pixel) return;

				this.onPixel(pixel.x, pixel.y, pixel.color, msg.did as string, msg.time_us as number);
				this.cursor = msg.time_us as number;
			} catch (e) {
				console.warn('[jetstream] malformed message', e);
			}
		};

		this.ws.onclose = () => {
			this.onStatusChange(false);
			this.scheduleReconnect();
		};

		this.ws.onerror = () => {
			this.ws?.close();
		};
	}

	disconnect() {
		this.destroyed = true;
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		this.ws?.close();
		this.ws = null;
	}

	private scheduleReconnect() {
		if (this.destroyed) return;
		this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_MS);
	}
}

// --- record mappers ---

export function pixelRecordMapper(record: unknown): { x: number; y: number; color: number } | null {
	const r = record as Record<string, unknown>;
	if (typeof r?.x !== 'number' || typeof r?.y !== 'number' || typeof r?.color !== 'number') return null;
	return { x: r.x, y: r.y, color: r.color };
}

function hashStr(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h;
}

export function makeLikeRecordMapper(width: number, height: number, paletteSize: number): RecordMapper {
	return (record: unknown) => {
		const uri = (record as Record<string, unknown>)?.subject as Record<string, unknown>;
		const uriStr = uri?.uri;
		if (typeof uriStr !== 'string') return null;
		const h1 = hashStr(uriStr);
		const h2 = hashStr(uriStr + '\x00');
		return { x: h1 % width, y: h2 % height, color: (h1 ^ (h2 >>> 8)) % paletteSize };
	};
}
