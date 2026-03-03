import { putRecord, createTID, getRecord, user } from '$lib/atproto';
import type { FoursPuzzle } from './types';

export async function submitPuzzle(puzzle: FoursPuzzle): Promise<string> {
	if (!user.did) throw new Error('Not logged in');

	const rkey = createTID();

	// 1. Put the puzzle record
	await putRecord({
		collection: 'games.atmo.fours.puzzle',
		rkey,
		record: puzzle
	});

	// 2. Add to puzzle list
	const uri = `at://${user.did}/games.atmo.fours.puzzle/${rkey}`;

	let puzzles: string[] = [];
	try {
		const existing = await getRecord({
			did: user.did,
			collection: 'games.atmo.fours.puzzleList',
			rkey: 'self'
		});
		if (existing?.value && Array.isArray((existing.value as Record<string, unknown>).puzzles)) {
			puzzles = (existing.value as Record<string, unknown>).puzzles as string[];
		}
	} catch {
		// Record doesn't exist yet
	}

	await putRecord({
		collection: 'games.atmo.fours.puzzleList',
		rkey: 'self',
		record: { puzzles: [...puzzles, uri] }
	});

	return rkey;
}
