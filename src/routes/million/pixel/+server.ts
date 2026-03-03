import { getPixel } from '$lib/server/queries';
import { getLocalPixel, setLocalPixel } from '$lib/server/local-store';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	const x = parseInt(url.searchParams.get('x') ?? '');
	const y = parseInt(url.searchParams.get('y') ?? '');
	if (isNaN(x) || isNaN(y)) return new Response(null, { status: 400 });

	const db = platform?.env?.PLACE_DB;
	const info = db ? await getPixel(db, x, y) : getLocalPixel(x, y);

	if (!info) return Response.json({ did: null, painted_at: null });
	return Response.json(info);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const { x, y, color, did } = await request.json();

	if (typeof x !== 'number' || typeof y !== 'number' || typeof color !== 'number') {
		return new Response(null, { status: 400 });
	}

	const db = platform?.env?.PLACE_DB;
	if (db) {
		// Production: write to D1
		await db
			.prepare('INSERT OR REPLACE INTO pixels (x, y, did, painted_at) VALUES (?, ?, ?, ?)')
			.bind(x, y, did, Date.now() * 1000)
			.run();
	} else {
		// Local dev: in-memory
		setLocalPixel(x, y, color, did ?? 'local-dev');
	}

	return Response.json({ ok: true });
};
