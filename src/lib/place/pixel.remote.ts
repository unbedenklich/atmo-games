import { command, getRequestEvent } from '$app/server';
import * as v from 'valibot';

export const getPixelInfo = command(
	v.object({
		x: v.number(),
		y: v.number()
	}),
	async (input) => {
		const { platform } = getRequestEvent();
		const db = platform?.env?.PLACE_DB;
		if (!db) return null;

		const row = await db
			.prepare('SELECT did, painted_at FROM pixels WHERE x = ? AND y = ?')
			.bind(input.x, input.y)
			.first<{ did: string; painted_at: number }>();

		return row ? { did: row.did, painted_at: row.painted_at } : null;
	}
);

export const getCooldownInfo = command(
	v.object({
		did: v.string()
	}),
	async (input) => {
		const { platform } = getRequestEvent();
		const db = platform?.env?.PLACE_DB;
		if (!db) return { last_paint_at: 0, whitelisted: false };

		const row = await db
			.prepare('SELECT last_paint_at, whitelisted FROM user_stats WHERE did = ?')
			.bind(input.did)
			.first<{ last_paint_at: number; whitelisted: number }>();

		return {
			last_paint_at: row?.last_paint_at ?? 0,
			whitelisted: row?.whitelisted === 1
		};
	}
);
