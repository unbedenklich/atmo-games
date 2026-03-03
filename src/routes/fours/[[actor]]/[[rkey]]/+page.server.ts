import type { PageServerLoad } from './$types';
import { getDetailedProfile, getRecord, resolveHandle, parseUri } from '$lib/atproto/methods';
import type { Did, Handle } from '@atcute/lexicons';
import type { FoursPuzzle, FoursScore } from '$lib/fours/types';
import type { FoursScoreRecord } from '$lib/fours/scores/types';
import { getScoreBacklink } from '$lib/fours/scores/backlinks';
import { shuffleWords } from '$lib/fours/daily';
import { error } from '@sveltejs/kit';

const DEFAULT_HANDLE = 'flo-bit.dev';
const EPOCH = new Date('2026-01-01T00:00:00Z').getTime();

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const actor = params.actor || DEFAULT_HANDLE;

	let did: Did;
	if (actor.startsWith('did:')) {
		did = actor as Did;
	} else {
		did = await resolveHandle({ handle: actor as Handle, fetch });
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

	const puzzleUri = `at://${did}/games.atmo.fours.puzzle/${rkey}`;

	// Load existing score server-side if user is signed in
	let score: FoursScore | null = null;
	if (locals.did) {
		try {
			const backlink = await getScoreBacklink(puzzleUri, locals.did);
			if (backlink) {
				const scoreRecord = await getRecord({
					did: locals.did,
					collection: 'games.atmo.fours.score',
					rkey: backlink.rkey
				}).catch(() => null);
				if (scoreRecord?.value) {
					const val = scoreRecord.value as FoursScoreRecord;
					score = { guesses: val.guesses, won: val.state === 'won' };
				}
			}
		} catch (e) {
			// Non-fatal — user just starts fresh
		}
	}

	return {
		authorDid: did,
		handle: profile?.handle ?? actor,
		avatar: profile?.avatar as string | undefined,
		rkey,
		puzzleUri,
		puzzle: record.value as FoursPuzzle,
		shuffledWords: shuffleWords(record.value as FoursPuzzle),
		puzzleIndex: puzzleIndex !== undefined ? puzzleIndex + 1 : undefined,
		puzzleCount,
		score
	};
};
