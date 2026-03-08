<script>
	let { canvasDataUrl } = $props();
</script>

<div
	style="width: 1200px; height: 630px; background: #0f0f0f; display: flex; flex-direction: row; align-items: center; padding: 48px 48px 48px 0px; gap: 64px; color: transparent;"
>
	.
	<img
		src={canvasDataUrl}
		style="width: 534px; height: 534px; border-radius: 20px; flex-shrink: 0;"
		alt=""
	/>

	<div style="display: flex; flex-direction: column; justify-content: center; gap: 12px;">
		<span style="color: white; font-size: 88px; font-weight: 700; letter-spacing: -2px;">1000s</span
		>
		<span style="color: rgba(255,255,255,0.6); font-size: 28px;">A collaborative pixel canvas</span>
		<span style="color: rgba(255,255,255,0.4); font-size: 22px;">atmo.games</span>
	</div>
</div>
