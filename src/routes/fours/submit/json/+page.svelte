<script lang="ts">
	import { Button, Textarea } from '@foxui/core';
	import { atProtoLoginModalState } from '@foxui/social';
	import { user } from '$lib/atproto';
	import type { FoursPuzzle } from '$lib/fours/types';
	import { submitPuzzle } from '$lib/fours/submit';

	let jsonInput = $state('');
	let error = $state('');
	let submitting = $state(false);
	let successRkey = $state('');

	function validatePuzzle(data: unknown): data is FoursPuzzle {
		if (!data || typeof data !== 'object') {
			error = 'Invalid JSON: expected an object';
			return false;
		}

		const obj = data as Record<string, unknown>;

		if (!Array.isArray(obj.groups) || obj.groups.length !== 4) {
			error = 'Puzzle must have exactly 4 groups';
			return false;
		}

		for (let i = 0; i < 4; i++) {
			const group = obj.groups[i] as Record<string, unknown>;

			if (!group || typeof group !== 'object') {
				error = `Group ${i + 1} must be an object`;
				return false;
			}

			if (typeof group.category !== 'string' || group.category.trim() === '') {
				error = `Group ${i + 1} must have a non-empty category string`;
				return false;
			}

			if (!Array.isArray(group.words) || group.words.length !== 4) {
				error = `Group ${i + 1} must have exactly 4 words`;
				return false;
			}

			for (let j = 0; j < 4; j++) {
				if (typeof group.words[j] !== 'string' || group.words[j].trim() === '') {
					error = `Group ${i + 1}, word ${j + 1} must be a non-empty string`;
					return false;
				}
			}

			if (![0, 1, 2, 3].includes(group.difficulty as number)) {
				error = `Group ${i + 1} difficulty must be 0, 1, 2, or 3`;
				return false;
			}
		}

		return true;
	}

	async function handleSubmit() {
		error = '';
		successRkey = '';

		let parsed: unknown;
		try {
			parsed = JSON.parse(jsonInput);
		} catch {
			error = 'Invalid JSON: could not parse input';
			return;
		}

		if (!validatePuzzle(parsed)) return;

		submitting = true;

		try {
			successRkey = await submitPuzzle(parsed as FoursPuzzle);
			jsonInput = '';
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
			<p class="text-lg font-medium text-stone-700 dark:text-stone-300">Sign in with your Bluesky account to submit puzzles</p>
			<Button onclick={() => atProtoLoginModalState.show()}>Sign In</Button>
		</div>
	{:else}
		<div class="w-full max-w-lg">
			<label for="puzzle-json" class="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">
				Puzzle JSON
			</label>
			<Textarea
				id="puzzle-json"
				bind:value={jsonInput}
				rows={14}
				variant="secondary"
				placeholder={`{\n  "groups": [\n    { "category": "...", "words": ["a", "b", "c", "d"], "difficulty": 0 },\n    ...\n  ]\n}`}
				class="w-full font-mono"
				disabled={submitting}
			/>

			{#if error}
				<p class="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
			{/if}

			{#if successRkey}
				<div class="mt-4 rounded-md border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/30">
					<p class="text-sm font-medium text-green-800 dark:text-green-300">Puzzle submitted successfully!</p>
					<a
						href="/fours/{user.did}/{successRkey}"
						class="mt-1 inline-block text-sm text-green-700 underline hover:text-green-900 dark:text-green-400 dark:hover:text-green-200"
					>
						View puzzle
					</a>
				</div>
			{/if}

			<div class="mt-4">
				<Button onclick={handleSubmit} disabled={submitting || !jsonInput.trim()}>
					{#if submitting}
						Submitting...
					{:else}
						Submit Puzzle
					{/if}
				</Button>
			</div>
		</div>
	{/if}
</div>
