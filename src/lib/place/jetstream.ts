/**
 * Jetstream WebSocket client for real-time pixel updates.
 *
 * Connects to the AT Protocol Jetstream firehose, filters for the
 * `games.atmo.place.pixel` collection, and invokes a callback for
 * every pixel-placement commit.
 */

const JETSTREAM_URL = 'wss://jetstream1.us-east.bsky.network/subscribe';
const COLLECTION = 'games.atmo.place.pixel';
const RECONNECT_MS = 3_000;

export type PixelHandler = (x: number, y: number, color: number, did: string) => void;
export type StatusHandler = (connected: boolean) => void;

export class JetstreamClient {
	private ws: WebSocket | null = null;
	private cursor: number;
	private onPixel: PixelHandler;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private destroyed = false;

	onStatusChange: StatusHandler = () => {};

	constructor(cursor: number, onPixel: PixelHandler) {
		this.cursor = cursor;
		this.onPixel = onPixel;
	}

	connect() {
		if (this.destroyed) return;

		const url = new URL(JETSTREAM_URL);
		url.searchParams.set('wantedCollections', COLLECTION);
		if (this.cursor > 0) {
			url.searchParams.set('cursor', this.cursor.toString());
		}

		this.ws = new WebSocket(url);

		this.ws.onopen = () => this.onStatusChange(true);

		this.ws.onmessage = (ev) => {
			try {
				const msg = JSON.parse(ev.data as string);
				if (msg.kind !== 'commit') return;

				const c = msg.commit;
				if (!c || c.collection !== COLLECTION) return;

				const op = c.operation as string;
				const rec = c.record;
				if (!rec || typeof rec.x !== 'number' || typeof rec.y !== 'number') return;

				const color = op === 'delete' ? 31 : (rec.color as number); // 31 = white on delete
				this.onPixel(rec.x, rec.y, color, msg.did as string);
				this.cursor = msg.time_us as number;
			} catch {
				// ignore malformed messages
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
