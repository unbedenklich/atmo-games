<script lang="ts">
	import '../app.css';

	import { ThemeToggle } from '@foxui/core';
	import { AtprotoLoginModal } from '@foxui/social';
	import { login, signup } from '$lib/atproto';

	let { children } = $props();
</script>

{@render children()}

<ThemeToggle class="absolute top-4 left-4" />

<AtprotoLoginModal
	login={async (handle) => {
		await login(handle);
		return true;
	}}
	signup={async () => {
		signup();
		return true;
	}}
/>
