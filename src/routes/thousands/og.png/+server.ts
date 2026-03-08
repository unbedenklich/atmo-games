import { ImageResponse } from '@ethercorps/sveltekit-og';
import ThousandsOg from '$lib/thousands/og.svelte';
import { getCanvas } from '$lib/server/queries';
import { canvasToPngDataUrl } from '$lib/thousands/png';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ platform }) => {
	const kv = platform?.env?.PLACE_KV;

	let canvasDataUrl = '';
	try {
		if (kv) {
			const canvasData = await getCanvas(kv);
			if (canvasData) {
				canvasDataUrl = await canvasToPngDataUrl(new Uint8Array(canvasData.canvas));
			}
		}
	} catch (e) {
		console.error('[og] canvas encoding failed:', e);
	}

	return new ImageResponse(
		ThousandsOg,
		{
			width: 1200,
			height: 630,
			headers: {
				'Cache-Control': 'public, max-age=300, s-maxage=300'
			}
		},
		{ canvasDataUrl }
	);
};
