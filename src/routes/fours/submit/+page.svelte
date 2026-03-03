<script lang="ts">
	import { onMount } from 'svelte';
	import { Input, Button } from '@foxui/core';
	import { atProtoLoginModalState } from '@foxui/social';
	import { user } from '$lib/atproto';
	import type { FoursPuzzle } from '$lib/fours/types';
	import { submitPuzzle } from '$lib/fours/submit';

	const STORAGE_KEY = 'fours-draft';
	const difficultyLabels = ['Yellow', 'Green', 'Blue', 'Purple'] as const;
	const borderColors = [
		'border-yellow-400',
		'border-green-400',
		'border-blue-400',
		'border-purple-400'
	] as const;

	let categories = $state(['', '', '', '']);
	let words = $state([
		['', '', '', ''],
		['', '', '', ''],
		['', '', '', ''],
		['', '', '', '']
	]);
	let error = $state('');
	let submitting = $state(false);
	let successRkey = $state('');

	onMount(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const data = JSON.parse(saved);
				if (data.categories) categories = data.categories;
				if (data.words) words = data.words;
			}
		} catch {}
	});

	function saveDraft() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ categories, words }));
	}

	function clearDraft() {
		categories = ['', '', '', ''];
		words = [
			['', '', '', ''],
			['', '', '', ''],
			['', '', '', ''],
			['', '', '', '']
		];
		error = '';
		successRkey = '';
		localStorage.removeItem(STORAGE_KEY);
	}

	$effect(() => {
		// track all fields for auto-save
		categories.forEach(() => {});
		words.forEach((row) => row.forEach(() => {}));
		saveDraft();
	});

	function validate(): boolean {
		for (let i = 0; i < 4; i++) {
			if (categories[i].trim() === '') {
				error = `Group ${i + 1} category cannot be empty`;
				return false;
			}
			for (let j = 0; j < 4; j++) {
				if (words[i][j].trim() === '') {
					error = `Group ${i + 1}, word ${j + 1} cannot be empty`;
					return false;
				}
			}
		}
		return true;
	}

	async function handleSubmit() {
		error = '';
		successRkey = '';

		if (!validate()) return;

		submitting = true;

		try {
			const puzzle: FoursPuzzle = {
				groups: [0, 1, 2, 3].map((i) => ({
					category: categories[i].trim(),
					words: [
						words[i][0].trim().toUpperCase(),
						words[i][1].trim().toUpperCase(),
						words[i][2].trim().toUpperCase(),
						words[i][3].trim().toUpperCase()
					] as [string, string, string, string],
					difficulty: i as 0 | 1 | 2 | 3
				})) as FoursPuzzle['groups']
			};

			successRkey = await submitPuzzle(puzzle);
			clearDraft();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to submit puzzle';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="flex min-h-svh flex-col items-center justify-center p-4">
	<h1 class="mb-6 text-2xl font-bold text-stone-800 dark:text-stone-200">Submit Puzzle</h1>

	{#if !user.isLoggedIn}
		<div class="flex flex-col items-center gap-6 rounded-2xl bg-stone-100 p-8 dark:bg-stone-800">
			<p class="text-lg font-medium text-stone-700 dark:text-stone-300">
				Sign in with your Bluesky account to submit puzzles
			</p>
			<Button onclick={() => atProtoLoginModalState.show()}>Sign In</Button>
		</div>
	{:else}
		<div class="w-full max-w-2xl space-y-6">
			{#each [0, 1, 2, 3] as i (i)}
				<div class="border-l-4 {borderColors[i]} rounded-lg bg-stone-50 p-4 dark:bg-stone-800/50">
					<p class="mb-3 text-sm font-semibold text-stone-700 dark:text-stone-300">
						Group {i + 1} ({difficultyLabels[i]})
					</p>

					<div class="mb-3">
						<Input
							variant="secondary"
							sizeVariant="sm"
							placeholder="Category name"
							bind:value={categories[i]}
							disabled={submitting}
							class="w-full"
						/>
					</div>

					<div class="grid grid-cols-4 gap-2">
						{#each [0, 1, 2, 3] as j (j)}
							<Input
								variant="secondary"
								sizeVariant="sm"
								placeholder="Word {j + 1}"
								bind:value={words[i][j]}
								disabled={submitting}
							/>
						{/each}
					</div>
				</div>
			{/each}

			{#if error}
				<p class="text-sm text-red-600 dark:text-red-400">{error}</p>
			{/if}

			{#if successRkey}
				<div
					class="rounded-md border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/30"
				>
					<p class="text-sm font-medium text-green-800 dark:text-green-300">
						Puzzle submitted successfully!
					</p>
					<a
						href="/fours/{user.did}/{successRkey}"
						class="mt-1 inline-block text-sm text-green-700 underline hover:text-green-900 dark:text-green-400 dark:hover:text-green-200"
					>
						View puzzle
					</a>
				</div>
			{/if}

			<div class="flex flex-col items-center gap-2">
				<div class="flex gap-2">
					<Button onclick={handleSubmit} disabled={submitting}>
						{#if submitting}
							Submitting...
						{:else}
							Submit Puzzle
						{/if}
					</Button>
					<Button variant="secondary" onclick={clearDraft} disabled={submitting}>
						Clear
					</Button>
				</div>
				<a
					href="/fours/submit/json"
					class="text-xs text-stone-500 underline hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
				>
					or paste JSON
				</a>
			</div>
		</div>
	{/if}
</div>
