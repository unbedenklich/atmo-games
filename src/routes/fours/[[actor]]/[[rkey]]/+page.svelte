<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Avatar } from '@foxui/core';
	import FoursGame from '$lib/fours/FoursGame.svelte';
	import type { FoursPuzzle, FoursScore } from '$lib/fours/types';
	import { getScoreLocal } from '$lib/fours/scores/idb';
	import { saveScore } from '$lib/fours/scores/save';

	let handle = $derived(page.data.handle as string);
	let avatar = $derived(page.data.avatar as string | undefined);
	let puzzle = $derived(page.data.puzzle as FoursPuzzle);
	let shuffledWords = $derived(page.data.shuffledWords as string[]);
	let puzzleUri = $derived(page.data.puzzleUri as string);
	let puzzleIndex = $derived(page.data.puzzleIndex as number | undefined);
	let puzzleCount = $derived(page.data.puzzleCount as number | undefined);

	// Server-provided score (for signed-in users)
	let serverScore = $derived(page.data.score as FoursScore | null);

	// Client-side score from IndexedDB (for anonymous users)
	let localScore: FoursScore | undefined = $state(undefined);

	let existingScore = $derived(serverScore ?? localScore ?? undefined);

	onMount(async () => {
		if (!serverScore) {
			try {
				const entry = await getScoreLocal(puzzleUri);
				if (entry) localScore = { guesses: entry.record.guesses, won: entry.record.state === 'won' };
			} catch {}
		}
	});

	function handleGameEnd(score: FoursScore) {
		saveScore(puzzleUri, score);
	}
</script>

<div class="flex min-h-svh flex-col items-center justify-center p-4">
	<div class="mb-4 flex flex-col items-center">
		<h1 class="flex items-center gap-2 text-2xl font-bold text-stone-800 dark:text-stone-200">
			Fours by <Avatar src={avatar} alt={handle} class="size-8" /> {handle}
		</h1>
		<span class="mt-1 text-xs text-stone-400 dark:text-stone-500">
			{#if puzzleIndex != null && puzzleCount != null}
				puzzle {puzzleIndex}/{puzzleCount}
			{:else}
				{puzzleUri}
			{/if}
		</span>
	</div>

	<div class="w-full max-w-lg">
		{#key existingScore}
			<FoursGame {puzzle} score={existingScore} {shuffledWords} onGameEnd={handleGameEnd} />
		{/key}
	</div>
</div>
