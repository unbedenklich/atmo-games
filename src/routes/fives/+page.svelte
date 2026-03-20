<script lang="ts">
	import { onMount } from 'svelte';
	import FivesGame from '$lib/fives/FivesGame.svelte';
	import { fetchAnswers, fetchValidWords } from '$lib/fives/daily';
	import type { FivesScore } from '$lib/fives/types';

	let answer: string | null = $state(null);
	let validWords: Set<string> | null = $state(null);
	let answers: string[] = [];
	let gameKey = $state(0);
	let gameOver = $state(false);

	onMount(async () => {
		[answers, validWords] = await Promise.all([fetchAnswers(), fetchValidWords()]);
		nextGame();
	});

	function nextGame() {
		answer = answers[Math.floor(Math.random() * answers.length)];
		gameKey++;
		gameOver = false;
	}

	function handleGameEnd(score: FivesScore) {
		gameOver = true;
	}
</script>

<div class="flex min-h-svh flex-col items-center p-4 text-base-900 dark:text-base-100">
	<div class="mt-12 mb-8 text-center">
		<h1 class="text-4xl font-bold">Fives</h1>
	</div>

	{#if answer && validWords}
		{#key gameKey}
			<FivesGame {answer} {validWords} onGameEnd={handleGameEnd} />
		{/key}
	{:else}
		<p class="mt-12 text-base-500 dark:text-base-400">Loading...</p>
	{/if}
</div>

{#if gameOver}
	<button
		onclick={nextGame}
		class="fixed bottom-4 right-4 z-50 rounded-full bg-base-200 px-6 py-2 text-sm font-bold text-base-700 transition-colors hover:bg-base-300 dark:bg-white/20 dark:text-white dark:hover:bg-white/30"
	>
		Next
	</button>
{/if}
