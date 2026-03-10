<script lang="ts">
	import { Button } from '@foxui/core';
	import { atProtoLoginModalState } from '@foxui/social';
	import { user, logout } from '$lib/atproto';
</script>

<div class="flex min-h-svh flex-col items-center justify-center p-4">
	<h1 class="mb-12 text-4xl font-bold text-base-900 dark:text-base-100">atmo games</h1>

	<div class="mb-16 flex w-full max-w-sm flex-col gap-4">
		<!-- <a
			href="/fours/"
			class="block border dark:border-base-800 rounded-xl bg-base-100 dark:bg-base-950/50 p-6 text-center transition-colors hover:bg-base-200 dark:hover:bg-base-950/40 inset-shadow-sm dark:inset-shadow-black/30"
		>
			<span class="block text-xl font-bold text-base-900 dark:text-base-100">Fours</span>
			<span class="block mt-1 text-sm text-base-500 dark:text-base-400">Find four groups of four!</span>
		</a> -->

		<a
			href="/millions/"
			class="dark:border-base-800 bg-base-200 block border-base-400/50 rounded-xl border p-6 text-center inset-shadow-sm transition-colors hover:bg-base-200 dark:bg-base-950/50 dark:inset-shadow-black/30 dark:hover:bg-base-950/40"
		>
			<span class="block text-xl font-bold text-base-900 dark:text-base-100">Millions</span>
			<span class="mt-1 block text-sm text-base-500 dark:text-base-400"
				>Collaborative pixel canvas</span
			>
		</a>
	</div>

	<div class="text-center">
		{#if user.isLoggedIn}
			<p class="mb-3 text-sm text-base-500 dark:text-base-400">
				Signed in as {user.profile?.handle ?? user.did}
			</p>
			<Button onclick={() => logout()}>Sign Out</Button>
		{:else}
			<p class="mb-3 max-w-xs text-sm text-base-500 dark:text-base-400">
				Sign in to save scores online or submit your own puzzles
			</p>
			<Button onclick={() => atProtoLoginModalState.show()}>Sign In</Button>
		{/if}
	</div>
</div>
