<script lang="ts">
	import { atProtoLoginModalState } from '@foxui/social';
	import { user, logout } from '$lib/atproto';

</script>

<div class="flex min-h-svh flex-col items-center justify-center p-4">
	<h1 class="mb-12 text-4xl font-bold text-base-900 dark:text-base-100">atmo games</h1>

	<div class="mb-16 grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
		<a
			href="/fours/"
			class="game-card flex flex-col justify-between rounded-3xl bg-[#00c8ff] p-8 text-white"
		>
			<div>
				<div class="mb-6 flex items-center gap-3">
					<svg class="h-12 w-12" viewBox="0 0 40 40" fill="none">
						<rect x="2" y="2" width="16" height="16" rx="4" fill="white" opacity="0.95" />
						<rect x="22" y="2" width="16" height="16" rx="4" fill="white" opacity="0.7" />
						<rect x="2" y="22" width="16" height="16" rx="4" fill="white" opacity="0.7" />
						<rect x="22" y="22" width="16" height="16" rx="4" fill="white" opacity="0.45" />
					</svg>
					<span class="text-3xl font-black tracking-tight">Fours</span>
				</div>
				<p class="min-h-[3rem] text-base font-semibold leading-snug text-white">
					Find four groups of four.
				</p>
			</div>
			<div class="mt-8">
				<span class="play-btn inline-block rounded-full bg-white/20 px-6 py-2 text-sm font-bold text-white transition-all">
					Play now
				</span>
			</div>
		</a>

		<a
			href="/fives/"
			class="game-card flex flex-col justify-between rounded-3xl bg-[#7c3aed] p-8 text-white"
		>
			<div>
				<div class="mb-6 flex items-center gap-3">
					<svg class="h-12 w-[52px]" viewBox="0 0 52 10" fill="none">
						<rect x="0" y="0" width="9.2" height="10" rx="1.5" fill="#16a34a" />
						<rect x="10.7" y="0" width="9.2" height="10" rx="1.5" fill="#eab308" />
						<rect x="21.4" y="0" width="9.2" height="10" rx="1.5" fill="#787c7e" />
						<rect x="32.1" y="0" width="9.2" height="10" rx="1.5" fill="#16a34a" />
						<rect x="42.8" y="0" width="9.2" height="10" rx="1.5" fill="#eab308" />
					</svg>
					<span class="text-3xl font-black tracking-tight">Fives</span>
				</div>
				<p class="min-h-[3rem] text-base font-semibold leading-snug text-white">
					Guess the five-letter word in six tries.
				</p>
			</div>
			<div class="mt-8">
				<span class="play-btn inline-block rounded-full bg-white/20 px-6 py-2 text-sm font-bold text-white transition-all">
					Play now
				</span>
			</div>
		</a>

		<a
			href="/millions/"
			class="game-card flex flex-col justify-between rounded-3xl bg-[#ff2d55] p-8 text-white"
		>
			<div>
				<div class="mb-6 flex items-center gap-3">
					<svg class="h-12 w-12" viewBox="0 0 34 34" fill="none">
						<rect x="0" y="0" width="10" height="10" rx="2" fill="#FFFFFF" />
						<rect x="12" y="0" width="10" height="10" rx="2" fill="#898D90" />
						<rect x="24" y="0" width="10" height="10" rx="2" fill="#FF99AA" />
						<rect x="0" y="12" width="10" height="10" rx="2" fill="#B44AC0" />
						<rect x="12" y="12" width="10" height="10" rx="2" fill="#6A5CFF" />
						<rect x="24" y="12" width="10" height="10" rx="2" fill="#3690EA" />
						<rect x="0" y="24" width="10" height="10" rx="2" fill="#009EAA" />
						<rect x="12" y="24" width="10" height="10" rx="2" fill="#7EED56" />
						<rect x="24" y="24" width="10" height="10" rx="2" fill="#FFD635" />
					</svg>
					<span class="text-3xl font-black tracking-tight">Millions</span>
				</div>
				<p class="min-h-[3rem] text-base font-semibold leading-snug text-white">
					A collaborative pixel canvas. Place colors and create art together.
				</p>
			</div>
			<div class="mt-8">
				<span class="play-btn inline-block rounded-full bg-white/20 px-6 py-2 text-sm font-bold text-white transition-all">
					Play now
				</span>
			</div>
		</a>
	</div>

	</div>

<div class="fixed bottom-4 left-4 z-50">
	{#if user.isLoggedIn}
		<button
			onclick={() => logout()}
			class="rounded-full bg-base-200 px-6 py-2 text-sm font-bold text-base-700 transition-all hover:bg-base-300 dark:bg-white/20 dark:text-white dark:hover:bg-white/30"
		>
			Sign Out
		</button>
	{:else}
		<button
			onclick={() => atProtoLoginModalState.show()}
			class="rounded-full bg-base-200 px-6 py-2 text-sm font-bold text-base-700 transition-all hover:bg-base-300 dark:bg-white/20 dark:text-white dark:hover:bg-white/30"
		>
			Sign In
		</button>
	{/if}
</div>

<style>
	.game-card:hover .play-btn {
		transform: scale(1.05);
		opacity: 0.85;
	}
</style>
