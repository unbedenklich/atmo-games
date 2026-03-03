import { getStats } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const kv = platform?.env?.PLACE_KV;
	const db = platform?.env?.PLACE_DB;

	if (!kv || !db) return { stats: null };

	const stats = await getStats(db, kv);
	return { stats };
};
