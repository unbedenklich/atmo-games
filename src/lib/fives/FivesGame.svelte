<script lang="ts">
	import { fade } from 'svelte/transition';
	import { FivesGame } from './game.svelte';
	import type { FivesScore, LetterResult } from './types';

	const MAX_GUESSES = 6;
	const WORD_LENGTH = 5;

	const KEYBOARD_ROWS = [
		['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
		['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
		['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
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

	let revealedCols: boolean[] = $state([false, false, false, false, false]);

	$effect(() => {
		if (game.gameState !== 'playing' && !hasNotifiedEnd) {
			hasNotifiedEnd = true;
			onGameEnd?.(game.score);
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
	<div class="flex w-full max-w-[500px] flex-col items-center gap-[6px] px-1">
		{#each KEYBOARD_ROWS as row, rowIdx (rowIdx)}
			<div class="flex w-full justify-center gap-[6px]">
				{#each row as key (key)}
					<button
						class="flex h-[58px] cursor-pointer items-center justify-center rounded-md font-bold
							{key === 'ENTER' || key === '⌫' ? 'min-w-[65px] px-2 text-xs' : 'min-w-[44px] text-sm'}
							{keyColorClass(key)}"
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
