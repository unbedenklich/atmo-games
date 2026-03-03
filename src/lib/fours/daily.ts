import { base } from '$app/paths';
import type { FoursPuzzle } from './types';

export function shuffleWords(puzzle: FoursPuzzle): string[] {
	const words = puzzle.groups.flatMap((g) => g.words);
	for (let i = words.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[words[i], words[j]] = [words[j], words[i]];
	}
	return words;
}

export const START_DATE = '2026-01-01';
export const TOTAL_PUZZLES = 113;

export function getTodayPuzzleNumber(): number {
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const start = new Date(START_DATE + 'T00:00:00');
	const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
	return Math.max(1, Math.min(diffDays + 1, TOTAL_PUZZLES));
}

export async function fetchPuzzle(puzzleNumber: number): Promise<FoursPuzzle> {
	const res = await fetch(`${base}/fours/puzzles/${puzzleNumber}.json`);
	return res.json();
}

export function getMillisUntilMidnight(): number {
	const now = new Date();
	const tomorrow = new Date(now);
	tomorrow.setDate(tomorrow.getDate() + 1);
	tomorrow.setHours(0, 0, 0, 0);
	return tomorrow.getTime() - now.getTime();
}
