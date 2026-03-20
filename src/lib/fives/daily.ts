const START_DATE = '2026-03-20';

let answersCache: string[] | null = null;
let validCache: Set<string> | null = null;

export function getTodayPuzzleNumber(): number {
	const start = new Date(START_DATE);
	const now = new Date();
	const diff = now.getTime() - start.getTime();
	return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

export async function fetchAnswers(): Promise<string[]> {
	if (answersCache) return answersCache;
	const res = await fetch('/fives/answers.json');
	answersCache = await res.json();
	return answersCache!;
}

export async function fetchValidWords(): Promise<Set<string>> {
	if (validCache) return validCache;
	const [answers, validRes] = await Promise.all([
		fetchAnswers(),
		fetch('/fives/valid.json').then((r) => r.json() as Promise<string[]>)
	]);
	// Ensure all words are uppercase for consistent lookup
	validCache = new Set([
		...validRes.map((w) => w.toUpperCase()),
		...answers.map((w) => w.toUpperCase())
	]);
	return validCache;
}

export async function getTodayAnswer(): Promise<string> {
	const answers = await fetchAnswers();
	const num = getTodayPuzzleNumber();
	const index = ((num - 1) % answers.length);
	return answers[index];
}

export function getMillisUntilMidnight(): number {
	const now = new Date();
	const midnight = new Date(now);
	midnight.setHours(24, 0, 0, 0);
	return midnight.getTime() - now.getTime();
}
