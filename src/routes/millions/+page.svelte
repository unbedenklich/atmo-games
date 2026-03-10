<script lang="ts">
	import MillionsCanvas from '$lib/millions/MillionsCanvas.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>1000s</title>
	<meta property="og:title" content="1000s" />
	<meta property="og:description" content="A collaborative pixel canvas by atmo.games" />
	<meta property="og:image" content="/millions/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="/millions/og.png" />
</svelte:head>

<MillionsCanvas canvas={data.canvas} blocked={data.blocked} useBskyLikes={data.useBskyLikes} />
