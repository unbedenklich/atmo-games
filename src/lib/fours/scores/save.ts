import { user, putRecord, createTID } from '$lib/atproto';
import type { FoursScore } from '../types';
import type { FoursScoreRecord } from './types';
import { saveScoreLocal } from './idb';

export async function saveScore(puzzleUri: string, score: FoursScore): Promise<void> {
	const rkey = createTID();

	// Deep-copy to strip Svelte $state proxies (IndexedDB can't clone proxied arrays)
	const record: FoursScoreRecord = JSON.parse(
		JSON.stringify({
			puzzle: { uri: puzzleUri },
			guesses: score.guesses,
			state: score.won ? 'won' : 'lost'
		})
	);

	if (user.isLoggedIn) {
		// Save to PDS only
		try {
			await putRecord({
				collection: 'games.atmo.fours.score',
				rkey,
				record
			});
		} catch (e) {
			console.error('Failed to save score to PDS:', e);
		}
	} else {
		// Save to IndexedDB for anonymous users
		try {
			await saveScoreLocal({ rkey, puzzleUri, record, savedAt: Date.now() });
		} catch (e) {
			console.error('Failed to save score locally:', e);
		}
	}
}
