import { JetstreamSubscription } from '@atcute/jetstream';

type PixelHandler = (x: number, y: number, color: number, did: string, timeUs: number) => void;
type StatusHandler = (connected: boolean) => void;
type RecordMapper = (record: unknown) => { x: number; y: number; color: number } | null;

const JETSTREAM_URLS = [
	'wss://jetstream1.us-east.bsky.network',
	'wss://jetstream2.us-east.bsky.network',
	'wss://jetstream1.us-west.bsky.network',
	'wss://jetstream2.us-west.bsky.network',
];

export class JetstreamClient {
	private iter: AsyncIterator<unknown> | null = null;
	private destroyed = false;
	private eventCount = 0;
	private statsTimer: ReturnType<typeof setInterval> | null = null;

	onStatusChange: StatusHandler = () => {};

	constructor(
		private cursor: number,
		private collection: string,
		private onPixel: PixelHandler,
		private mapRecord: RecordMapper
	) {}

	connect() {
		if (this.destroyed) return;

		const subscription = new JetstreamSubscription({
			url: JETSTREAM_URLS,
			wantedCollections: [this.collection],
			cursor: this.cursor,
			onConnectionOpen: () => this.onStatusChange(true),
			onConnectionClose: () => this.onStatusChange(false),
		});

		this.iter = subscription[Symbol.asyncIterator]();
		this.statsTimer = setInterval(() => {
			console.log(`[jetstream] ${(this.eventCount / 10).toFixed(1)} events/s`);
			this.eventCount = 0;
		}, 10_000);
		this.run(this.iter);
	}

	private async run(iter: AsyncIterator<unknown>) {
		while (!this.destroyed) {
			const { value: event, done } = await iter.next();
			if (done || this.destroyed) break;

			const e = event as { kind: string; commit?: { operation: string; record: unknown }; did: string; time_us: number };
			if (e.kind !== 'commit' || e.commit?.operation !== 'create') continue;

			const pixel = this.mapRecord(e.commit.record);
			if (!pixel) continue;

			this.eventCount++;
			this.onPixel(pixel.x, pixel.y, pixel.color, e.did, e.time_us);
		}
	}

	disconnect() {
		this.destroyed = true;
		if (this.statsTimer) clearInterval(this.statsTimer);
		this.iter?.return?.();
		this.iter = null;
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
		const uri = ((record as Record<string, unknown>)?.subject as Record<string, unknown>)?.uri;
		if (typeof uri !== 'string') return null;
		const h1 = hashStr(uri);
		const h2 = hashStr(uri + '\x00');
		return { x: h1 % width, y: h2 % height, color: (h1 ^ (h2 >>> 8)) % paletteSize };
	};
}
