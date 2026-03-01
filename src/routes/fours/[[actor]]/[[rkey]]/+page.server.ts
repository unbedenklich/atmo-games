import type { PageServerLoad } from './$types';
import { getDetailedProfile, getRecord, resolveHandle, parseUri } from '$lib/atproto/methods';
import type { Did, Handle } from '@atcute/lexicons';
import type { FoursPuzzle } from '$lib/fours/types';
import { shuffleWords } from '$lib/fours/daily';
import { error } from '@sveltejs/kit';

const DEFAULT_HANDLE = 'flo-bit.dev';
const EPOCH = new Date('2026-01-01T00:00:00Z').getTime();

export const load: PageServerLoad = async ({ params }) => {
	const actor = params.actor || DEFAULT_HANDLE;

	let did: Did;
	if (actor.startsWith('did:')) {
		did = actor as Did;
	} else {
		did = await resolveHandle({ handle: actor as Handle });
	}

	const profile = await getDetailedProfile({ did });

	let rkey = params.rkey;
	let puzzleIndex: number | undefined;
	let puzzleCount: number | undefined;

	if (!rkey) {
		const listRecord = await getRecord({
			did,
			collection: 'games.atmo.fours.puzzleList',
			rkey: 'self'
		}).catch(() => null);

		if (!listRecord?.value) {
			error(404, 'No puzzle list found');
		}

		const puzzles = (listRecord.value as { puzzles: string[] }).puzzles;
		if (!puzzles.length) {
			error(404, 'Puzzle list is empty');
		}

		puzzleCount = puzzles.length;
		const daysSinceEpoch = Math.floor((Date.now() - EPOCH) / (1000 * 60 * 60 * 24));
		puzzleIndex = ((daysSinceEpoch % puzzleCount) + puzzleCount) % puzzleCount;

		const parsed = parseUri(puzzles[puzzleIndex]);
		if (!parsed) {
			error(500, 'Invalid puzzle URI');
		}
		rkey = parsed.rkey;
	}

	const record = await getRecord({
		did,
		collection: 'games.atmo.fours.puzzle',
		rkey
	}).catch(() => null);

	if (!record) {
		error(404, 'Puzzle not found');
	}

	return {
		did,
		handle: profile?.handle ?? actor,
		avatar: profile?.avatar as string | undefined,
		rkey,
		puzzle: record.value as FoursPuzzle,
		shuffledWords: shuffleWords(record.value as FoursPuzzle),
		puzzleIndex: puzzleIndex !== undefined ? puzzleIndex + 1 : undefined,
		puzzleCount
	};
};
