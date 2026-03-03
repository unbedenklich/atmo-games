<script lang="ts">
	import { Button } from '@foxui/core';
	import { atProtoLoginModalState } from '@foxui/social';
	import { user, logout } from '$lib/atproto';
</script>

<div class="min-h-svh flex flex-col items-center justify-center p-4">
	<h1 class="text-4xl font-bold text-stone-900 dark:text-stone-100 mb-12">atmo games</h1>

	<div class="flex flex-col gap-4 w-full max-w-sm mb-16">
		<a
			href="/fours/"
			class="block border dark:border-base-800 rounded-xl bg-stone-100 dark:bg-stone-950/50 p-6 text-center transition-colors hover:bg-stone-200 dark:hover:bg-stone-950/40 inset-shadow-sm dark:inset-shadow-black/30"
		>
			<span class="block text-xl font-bold text-stone-900 dark:text-stone-100">Fours</span>
			<span class="block mt-1 text-sm text-stone-500 dark:text-stone-400">Find four groups of four!</span>
		</a>

		<a
			href="/fours/submit"
			class="block rounded-xl border border-stone-300 dark:border-stone-600 p-4 text-center text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
		>
			Create a Puzzle
		</a>
	</div>

	<div class="text-center">
		{#if user.isLoggedIn}
			<p class="text-sm text-stone-500 dark:text-stone-400 mb-3">
				Signed in as {user.profile?.handle ?? user.did}
			</p>
			<Button onclick={() => logout()}>Sign Out</Button>
		{:else}
			<p class="text-sm text-stone-500 dark:text-stone-400 mb-3 max-w-xs">
				Sign in to save scores online or submit your own puzzles
			</p>
			<Button onclick={() => atProtoLoginModalState.show()}>Sign In</Button>
		{/if}
	</div>
</div>
