import { ImageResponse } from '@ethercorps/sveltekit-og';
import ThousandsOg from '$lib/thousands/og.svelte';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return new ImageResponse(ThousandsOg, {
		width: 1200,
		height: 630,
		headers: {
			'Cache-Control': 'public, max-age=300, s-maxage=300'
		}
	});
};
