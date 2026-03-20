import type { LetterResult, FivesGuessResult, FivesScore } from './types';

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

export function evaluateGuess(guess: string, answer: string): FivesGuessResult {
	const results: LetterResult[] = Array(WORD_LENGTH).fill('absent');
	const answerLetters = answer.split('');
	const guessLetters = guess.split('');

	// First pass: mark correct letters
	for (let i = 0; i < WORD_LENGTH; i++) {
		if (guessLetters[i] === answerLetters[i]) {
			results[i] = 'correct';
			answerLetters[i] = '';
			guessLetters[i] = '';
		}
	}

	// Second pass: mark present letters
	for (let i = 0; i < WORD_LENGTH; i++) {
		if (guessLetters[i] === '') continue;
		const idx = answerLetters.indexOf(guessLetters[i]);
		if (idx !== -1) {
			results[i] = 'present';
			answerLetters[idx] = '';
		}
	}

	return {
		word: guess,
		results: results as FivesGuessResult['results']
	};
}

export class FivesGame {
	answer: string;
	guessResults: FivesGuessResult[] = $state([]);
	currentGuess: string = $state('');
	gameState: 'playing' | 'won' | 'lost' = $state('playing');
	shakeRow: number = $state(-1);
	revealRow: number = $state(-1);
	feedback: string | null = $state(null);
	validWords: Set<string> | null = null;

	// Keyboard state: tracks best result per letter
	letterStates: Map<string, LetterResult> = $state(new Map());

	constructor(answer: string, options?: { score?: FivesScore; validWords?: Set<string> }) {
		this.answer = answer.toUpperCase();
		this.validWords = options?.validWords ?? null;

		if (options?.score) {
			this.restoreFromScore(options.score);
		}
	}

	private restoreFromScore(score: FivesScore) {
		for (const guess of score.guesses) {
			const result = evaluateGuess(guess, this.answer);
			this.guessResults.push(result);
			this.updateLetterStates(result);
		}
		this.gameState = score.won ? 'won' : 'lost';
	}

	private updateLetterStates(result: FivesGuessResult) {
		for (let i = 0; i < WORD_LENGTH; i++) {
			const letter = result.word[i];
			const current = this.letterStates.get(letter);
			const next = result.results[i];
			// Priority: correct > present > absent
			if (!current || next === 'correct' || (next === 'present' && current === 'absent')) {
				this.letterStates.set(letter, next);
			}
		}
		// Trigger reactivity
		this.letterStates = new Map(this.letterStates);
	}

	get remainingGuesses() {
		return MAX_GUESSES - this.guessResults.length;
	}

	get score(): FivesScore {
		return {
			guesses: this.guessResults.map((r) => r.word),
			won: this.gameState === 'won'
		};
	}

	addLetter(letter: string) {
		if (this.gameState !== 'playing') return;
		if (this.currentGuess.length >= WORD_LENGTH) return;
		this.currentGuess += letter.toUpperCase();
	}

	removeLetter() {
		if (this.gameState !== 'playing') return;
		this.currentGuess = this.currentGuess.slice(0, -1);
	}

	private showFeedback(msg: string) {
		this.feedback = msg;
		setTimeout(() => {
			this.feedback = null;
		}, 1500);
	}

	async submitGuess(): Promise<boolean> {
		if (this.gameState !== 'playing') return false;
		if (this.currentGuess.length !== WORD_LENGTH) {
			this.shakeCurrentRow();
			this.showFeedback('Not enough letters');
			return false;
		}

		const guess = this.currentGuess.toUpperCase();

		// Validate word
		if (this.validWords && !this.validWords.has(guess)) {
			this.shakeCurrentRow();
			this.showFeedback('Not in word list');
			return false;
		}

		const result = evaluateGuess(guess, this.answer);
		this.revealRow = this.guessResults.length;
		this.guessResults.push(result);
		this.updateLetterStates(result);
		this.currentGuess = '';

		// Check win/loss after reveal animation
		await new Promise((r) => setTimeout(r, 1600));
		this.revealRow = -1;

		if (guess === this.answer) {
			this.gameState = 'won';
			this.showFeedback(['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][this.guessResults.length - 1]);
		} else if (this.guessResults.length >= MAX_GUESSES) {
			this.gameState = 'lost';
			this.showFeedback(this.answer);
		}

		return true;
	}

	private shakeCurrentRow() {
		this.shakeRow = this.guessResults.length;
		setTimeout(() => {
			this.shakeRow = -1;
		}, 600);
	}
}
