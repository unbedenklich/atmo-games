import { getCanvas } from '$lib/server/queries';
import { getLocalCanvas } from '$lib/server/local-store';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const kv = platform?.env?.PLACE_KV;

	const data = kv ? await getCanvas(kv) : getLocalCanvas();
	if (!data) return new Response(null, { status: 404 });

	return new Response(data.canvas, {
		headers: {
			'Content-Type': 'application/octet-stream',
			'X-Canvas-Cursor': data.cursor.toString(),
		},
	});
};
