export type LetterResult = 'correct' | 'present' | 'absent';

export interface FivesGuessResult {
	word: string;
	results: [LetterResult, LetterResult, LetterResult, LetterResult, LetterResult];
}

export interface FivesScore {
	guesses: string[];
	won: boolean;
}
