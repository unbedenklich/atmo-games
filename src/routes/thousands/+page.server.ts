import { getCanvas } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const kv = platform?.env?.PLACE_KV;

	const [canvasData, blockJson] = await Promise.all([
		kv ? getCanvas(kv) : null,
		kv ? kv.get('block', 'text') : null
	]);

	return {
		canvas: canvasData ? new Uint8Array(canvasData.canvas) : null,
		blocked: blockJson ? (JSON.parse(blockJson) as string[]) : [],
		useBskyLikes: platform?.env?.USE_BSKY_LIKES === 'true'
	};
};
