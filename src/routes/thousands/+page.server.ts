import { getCanvas, getStats } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const kv = platform?.env?.PLACE_KV;
	const db = platform?.env?.PLACE_DB;

	const [canvasData, stats] = await Promise.all([
		kv ? getCanvas(kv) : null,
		kv && db ? getStats(db, kv) : null
	]);

	const cursor = canvasData?.cursor ?? 0;
	console.log('[thousands] load cursor:', cursor);

	return {
		canvas: canvasData ? new Uint8Array(canvasData.canvas) : null,
		cursor,
		stats
	};
};
