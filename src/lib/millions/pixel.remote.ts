import { command, getRequestEvent } from '$app/server';
import * as v from 'valibot';

/** Get the block list — 1 KV read. */
export const getBlockList = command(
	v.object({}),
	async () => {
		const { platform } = getRequestEvent();
		const kv = platform?.env?.PLACE_KV;
		if (!kv) return { blocked: [] as string[] };

		const json = await kv.get('block', 'text');
		return { blocked: json ? (JSON.parse(json) as string[]) : [] };
	}
);
