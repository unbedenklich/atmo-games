<script lang="ts">
	import { page } from '$app/state';
	import { Avatar } from '@foxui/core';
	import FoursGame from '$lib/fours/FoursGame.svelte';
	import type { FoursPuzzle } from '$lib/fours/types';

	let handle = $derived(page.data.handle as string);
	let avatar = $derived(page.data.avatar as string | undefined);
	let rkey = $derived(page.data.rkey as string);
	let puzzle = $derived(page.data.puzzle as FoursPuzzle);
	let shuffledWords = $derived(page.data.shuffledWords as string[]);
	let puzzleIndex = $derived(page.data.puzzleIndex as number | undefined);
	let puzzleCount = $derived(page.data.puzzleCount as number | undefined);
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
				{rkey}
			{/if}
		</span>
	</div>

	<div class="w-full max-w-lg">
		<FoursGame {puzzle} {shuffledWords} />
	</div>
</div>
