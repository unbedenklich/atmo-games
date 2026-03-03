export type FoursScoreRecord = {
	puzzle: { uri: string };
	guesses: [string, string, string, string][];
	state: 'won' | 'lost';
};

export type LocalScoreEntry = {
	rkey: string;
	puzzleUri: string;
	record: FoursScoreRecord;
	savedAt: number;
};
