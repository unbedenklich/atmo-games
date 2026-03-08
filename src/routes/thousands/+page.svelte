<script lang="ts">
	import ThousandsCanvas from '$lib/thousands/ThousandsCanvas.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>1000s</title>
	<meta property="og:title" content="1000s" />
	<meta property="og:description" content="A collaborative pixel canvas by atmo.games" />
	<meta property="og:image" content="/thousands/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="/thousands/og.png" />
</svelte:head>

<ThousandsCanvas canvas={data.canvas} blocked={data.blocked} useBskyLikes={data.useBskyLikes} />
