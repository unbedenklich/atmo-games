<script lang="ts">
	import { fade } from 'svelte/transition';
	import { FivesGame } from './game.svelte';
	import type { FivesScore, LetterResult } from './types';

	const MAX_GUESSES = 6;
	const WORD_LENGTH = 5;

	const KEYBOARD_ROWS = [
		['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
		['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '⌫'],
		['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'ENTER']
	];

	const {
		answer,
		validWords,
		score,
		onGameEnd
	}: {
		answer: string;
		validWords: Set<string>;
		score?: FivesScore;
		onGameEnd?: (score: FivesScore) => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	const game = new FivesGame(answer, { score, validWords });

	// svelte-ignore state_referenced_locally
	let hasNotifiedEnd = $state(!!score);
	let showEndScreen = $state(!!score);
	let copied = $state(false);

	let revealedCols: boolean[] = $state([false, false, false, false, false]);

	// Stats from localStorage
	function loadStats() {
		try {
			const saved = localStorage.getItem('fives-stats');
			if (saved) return JSON.parse(saved);
		} catch {}
		return { played: 0, won: 0, streak: 0, maxStreak: 0, guessDistribution: [0, 0, 0, 0, 0, 0] };
	}

	function saveStats(stats: ReturnType<typeof loadStats>) {
		localStorage.setItem('fives-stats', JSON.stringify(stats));
	}

	let stats = $state(loadStats());

	function generateShareText(): string {
		const rows = game.guessResults.map((g) =>
			g.results.map((r) => (r === 'correct' ? '🟩' : r === 'present' ? '🟨' : '⬛')).join('')
		);
		const result = game.gameState === 'won' ? `${game.guessResults.length}/6` : 'X/6';
		return `Fives ${result}\n\n${rows.join('\n')}`;
	}

	async function shareResult() {
		const text = generateShareText();
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {}
	}

	$effect(() => {
		if (game.gameState !== 'playing' && !hasNotifiedEnd) {
			hasNotifiedEnd = true;
			onGameEnd?.(game.score);

			// Update stats
			stats.played++;
			if (game.gameState === 'won') {
				stats.won++;
				stats.streak++;
				stats.guessDistribution[game.guessResults.length - 1]++;
			} else {
				stats.streak = 0;
			}
			stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
			saveStats(stats);

			// Show end screen after a short delay
			setTimeout(() => (showEndScreen = true), 500);
		}
	});

	$effect(() => {
		const row = game.revealRow;
		const timeouts: ReturnType<typeof setTimeout>[] = [];
		if (row >= 0) {
			revealedCols = [false, false, false, false, false];
			for (let col = 0; col < WORD_LENGTH; col++) {
				timeouts.push(
					setTimeout(() => {
						revealedCols[col] = true;
					}, col * 300 + 250)
				);
			}
		} else {
			revealedCols = [true, true, true, true, true];
		}
		return () => timeouts.forEach(clearTimeout);
	});

	$effect(() => {
		function handleKeydown(e: KeyboardEvent) {
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			const key = e.key;
			if (key === 'Backspace') {
				game.removeLetter();
			} else if (key === 'Enter') {
				game.submitGuess();
			} else if (/^[a-zA-Z]$/.test(key)) {
				game.addLetter(key);
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	function tileColorClass(result: LetterResult): string {
		switch (result) {
			case 'correct':
				return 'bg-green-600 text-white border-green-600';
			case 'present':
				return 'bg-yellow-500 text-white border-yellow-500';
			case 'absent':
				return 'bg-base-600 text-white border-base-600 dark:bg-base-700';
		}
	}

	function keyColorClass(letter: string): string {
		const state = game.letterStates.get(letter);
		if (!state) return 'bg-base-200 text-base-800 dark:bg-base-700 dark:text-white';
		switch (state) {
			case 'correct':
				return 'bg-green-600 text-white';
			case 'present':
				return 'bg-yellow-500 text-white';
			case 'absent':
				return 'bg-base-700 text-base-400 dark:bg-base-800 dark:text-base-600';
		}
	}
</script>

<div class="flex flex-col items-center gap-4 py-4">
	<!-- Feedback toast -->
	{#if game.feedback}
		<div
			class="pointer-events-none absolute top-16 z-10 flex justify-center"
			transition:fade={{ duration: 200 }}
		>
			<span
				class="rounded-full bg-base-800 px-4 py-2 text-sm font-bold text-white shadow-lg dark:bg-base-200 dark:text-base-900"
			>
				{game.feedback}
			</span>
		</div>
	{/if}

	<!-- Grid -->
	<div class="grid w-full max-w-[350px] gap-[5px]" style="grid-template-rows: repeat(6, 1fr);">
		{#each Array(MAX_GUESSES) as _, rowIndex (rowIndex)}
			{@const isSubmitted = rowIndex < game.guessResults.length}
			{@const isCurrent = rowIndex === game.guessResults.length && game.gameState === 'playing'}
			{@const isRevealing = game.revealRow === rowIndex}
			{@const isShaking = game.shakeRow === rowIndex}
			<div
				class="flex justify-center gap-[5px] {isShaking ? 'shake' : ''}"
			>
				{#each Array(WORD_LENGTH) as _, colIndex (colIndex)}
					{@const submittedResult = isSubmitted ? game.guessResults[rowIndex] : null}
					{@const letter = isSubmitted
						? submittedResult?.word[colIndex] ?? ''
						: isCurrent
							? game.currentGuess[colIndex] ?? ''
							: ''}
					{@const result = submittedResult?.results[colIndex] ?? null}
					{@const showColor = isSubmitted && (!isRevealing || revealedCols[colIndex])}
					<div
						class="flex h-[62px] w-[62px] items-center justify-center rounded-lg text-2xl font-bold uppercase
							{showColor && result
								? tileColorClass(result)
								: letter
									? 'bg-base-200 dark:bg-base-700'
									: 'bg-base-100 dark:bg-base-800'}
							{isRevealing ? 'flip-tile' : ''}"
						style={isRevealing ? `animation-delay: ${colIndex * 0.3}s;` : ''}
					>
						{letter}
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<!-- Keyboard -->
	{#if !showEndScreen}
		<div class="flex w-full max-w-[500px] flex-col items-center gap-[6px] px-1">
			{#each KEYBOARD_ROWS as row, rowIdx (rowIdx)}
				<div class="flex w-full justify-center gap-[6px]">
					{#each row as key (key)}
						<button
							class="flex h-[58px] cursor-pointer items-center justify-center rounded-md font-bold
								{key === 'ENTER' ? 'min-w-[100px] px-3 text-base bg-base-800 text-base-100 dark:bg-base-200 dark:text-base-800' : key === '⌫' ? 'min-w-[50px] px-2 text-lg ' + keyColorClass(key) : 'min-w-[44px] text-lg ' + keyColorClass(key)}"
							onclick={() => {
								if (key === 'ENTER') {
									game.submitGuess();
								} else if (key === '⌫') {
									game.removeLetter();
								} else {
									game.addLetter(key);
								}
							}}
						>
							{key}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	<!-- End Screen -->
	{#if showEndScreen}
		<div
			class="mt-4 flex w-full max-w-[350px] flex-col items-center gap-6 rounded-2xl bg-base-100 p-6 dark:bg-base-800"
			transition:fade={{ duration: 300 }}
		>
			<h2 class="text-2xl font-bold text-base-900 dark:text-base-100">
				{game.gameState === 'won' ? 'Nice!' : 'Better luck next time'}
			</h2>

			<p class="text-lg font-semibold text-base-600 dark:text-base-400">
				The word was <span class="font-black text-base-900 dark:text-base-100">{answer}</span>
			</p>

			<!-- Stats -->
			<div class="grid w-full grid-cols-4 gap-3 text-center">
				<div>
					<p class="text-2xl font-black text-base-900 dark:text-base-100">{stats.played}</p>
					<p class="text-xs text-base-500 dark:text-base-400">Played</p>
				</div>
				<div>
					<p class="text-2xl font-black text-base-900 dark:text-base-100">
						{stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0}%
					</p>
					<p class="text-xs text-base-500 dark:text-base-400">Win %</p>
				</div>
				<div>
					<p class="text-2xl font-black text-base-900 dark:text-base-100">{stats.streak}</p>
					<p class="text-xs text-base-500 dark:text-base-400">Streak</p>
				</div>
				<div>
					<p class="text-2xl font-black text-base-900 dark:text-base-100">{stats.maxStreak}</p>
					<p class="text-xs text-base-500 dark:text-base-400">Best</p>
				</div>
			</div>

			<!-- Guess Distribution -->
			<div class="w-full">
				<p class="mb-2 text-sm font-semibold text-base-600 dark:text-base-400">Guess Distribution</p>
				<div class="flex flex-col gap-1">
					{#each stats.guessDistribution as count, i (i)}
						{@const maxCount = Math.max(...stats.guessDistribution, 1)}
						<div class="flex items-center gap-2">
							<span class="w-3 text-xs font-bold text-base-500 dark:text-base-400">{i + 1}</span>
							<div
								class="flex h-5 items-center justify-end rounded-sm px-1.5 text-xs font-bold text-white
									{game.gameState === 'won' && game.guessResults.length === i + 1
										? 'bg-green-600'
										: 'bg-base-500 dark:bg-base-600'}"
								style="width: {Math.max((count / maxCount) * 100, 8)}%"
							>
								{count}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Share -->
			<button
				onclick={shareResult}
				class="w-full rounded-lg bg-green-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-green-500"
			>
				{copied ? 'Copied!' : 'Share'}
			</button>
		</div>
	{/if}
</div>

<style>
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-4px);
		}
		40% {
			transform: translateX(4px);
		}
		60% {
			transform: translateX(-4px);
		}
		80% {
			transform: translateX(2px);
		}
	}
	.shake {
		animation: shake 0.5s ease-in-out;
	}

	@keyframes flip {
		0% {
			transform: rotateX(0);
		}
		50% {
			transform: rotateX(90deg);
		}
		100% {
			transform: rotateX(0);
		}
	}
	.flip-tile {
		animation: flip 0.5s ease;
		animation-fill-mode: both;
	}
</style>
