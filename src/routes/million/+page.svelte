<script lang="ts">
	import PlaceCanvas from '$lib/place/PlaceCanvas.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Million</title>
</svelte:head>

<PlaceCanvas canvas={data.canvas} cursor={data.cursor} />
