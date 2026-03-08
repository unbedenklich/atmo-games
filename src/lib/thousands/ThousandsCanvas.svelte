<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { PALETTE, PALETTE_RGB, PALETTE_NAMES } from './palette';
	import { JetstreamClient, pixelRecordMapper, makeLikeRecordMapper } from './jetstream';
	import { user, putRecord, createTID } from '$lib/atproto';
	import { atProtoLoginModalState } from '@foxui/social';
	import { toast } from '@foxui/core';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';

	const { trigger: haptic, destroy: destroyHaptics } = createWebHaptics();

	const W = 1000;
	const H = 1000;
	const MIN_SCALE = 0.3;
	const MAX_SCALE = 50;
	const GRID_MIN_SCALE = 8;
	const TOUCH_DRAG_THRESHOLD = 10;
	const MOUSE_DRAG_THRESHOLD = 2;

	interface Props {
		canvas: Uint8Array | null;
		blocked: string[];
		useBskyLikes: boolean;
	}

	let { canvas: initialCanvas, blocked: initialBlocked, useBskyLikes }: Props = $props();

	// Block set — loaded at page load, refreshed every minute
	// svelte-ignore state_referenced_locally
	let blockedSet = $state(new Set(initialBlocked));

	// Reactive UI state
	let selectedColor = $state<number | null>(4); // null = no color selected
	let hoverX = $state(-1);
	let hoverY = $state(-1);
	let connected = $state(false);
	let displayScale = $state(1);
	let loaded = $state(false);
	let devMode = $state(false);

	let listRefreshInterval: ReturnType<typeof setInterval>;
	let spamInterval: ReturnType<typeof setInterval> | null = null;
	let spamming = $state(false);
	let spamRate = $state(5); // pixels per second

	let isTouch = $state(false);

	// DOM
	let containerEl: HTMLDivElement;
	let canvasEl: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	// Audio
	let audioCtx: AudioContext | null = null;

	// Offscreen pixel buffer
	let offCanvas: HTMLCanvasElement;
	let offCtx: CanvasRenderingContext2D;
	let imgData: ImageData;

	// Pixel storage — 1 byte per pixel (color index 0-31), default white (0)
	const pixels = new Uint8Array(W * H);

	// Camera
	let scale = 1;
	let ox = 0;
	let oy = 0;

	// Drag
	let dragging = false;
	let dragged = false;
	let dsx = 0;
	let dsy = 0;
	let dox = 0;
	let doy = 0;

	// Pinch
	let pinchDist = 0;

	// Render batching
	let rafId = 0;

	let resizeObs: ResizeObserver;
	let jetstream: JetstreamClient;

	function canPlace(): boolean {
		if (devMode) return true;
		if (!user.did) return false;
		return !blockedSet.has(user.did);
	}

	/* ------------------------------------------------------------------ */
	/*  Audio                                                              */
	/* ------------------------------------------------------------------ */

	function playPlaceSound() {
		if (!audioCtx) audioCtx = new AudioContext();
		const ac = audioCtx;
		const t = ac.currentTime;

		// Low bubbly oscillator
		const osc = ac.createOscillator();
		const gain = ac.createGain();
		osc.connect(gain);
		gain.connect(ac.destination);
		osc.type = 'sine';
		osc.frequency.setValueAtTime(150, t);
		osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);
		osc.frequency.exponentialRampToValueAtTime(80, t + 0.2);
		gain.gain.setValueAtTime(0.25, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
		osc.start(t);
		osc.stop(t + 0.25);

		// Short high "pop" on top
		const osc2 = ac.createOscillator();
		const gain2 = ac.createGain();
		osc2.connect(gain2);
		gain2.connect(ac.destination);
		osc2.type = 'sine';
		osc2.frequency.setValueAtTime(600, t + 0.03);
		osc2.frequency.exponentialRampToValueAtTime(200, t + 0.12);
		gain2.gain.setValueAtTime(0, t);
		gain2.gain.linearRampToValueAtTime(0.12, t + 0.04);
		gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
		osc2.start(t + 0.03);
		osc2.stop(t + 0.15);
	}

	/* ------------------------------------------------------------------ */
	/*  Pixel placement                                                    */
	/* ------------------------------------------------------------------ */

	let placing = false;
	let rateLimitedUntil = $state(0);
	let rateLimitShown = new SvelteSet<string>(); // which warning thresholds have been toasted this session

	function checkRateLimit(rateLimit: { limit: number; remaining: number; reset: number } | null) {
		if (!rateLimit) return;
		const { limit, remaining, reset } = rateLimit;
		const resetTime = new Date(reset * 1000).toLocaleTimeString();
		console.log(`[rate limit] ${remaining}/${limit} points remaining, resets at ${resetTime}`);
		const used = (limit - remaining) / limit;
		// Each create costs 3 points; show pixels remaining
		const pixelsLeft = Math.floor(remaining / 3);
		const suffix = `(resets at ${resetTime})`;
		if (used >= 0.9 && !rateLimitShown.has('90')) {
			rateLimitShown.add('90');
			toast.warning(`Rate limit: only ~${pixelsLeft} pixels left ${suffix}`);
		} else if (used >= 0.8 && !rateLimitShown.has('80')) {
			rateLimitShown.add('80');
			toast.warning(`Rate limit: ~${pixelsLeft} pixels left ${suffix}`);
		} else if (used >= 0.5 && !rateLimitShown.has('50')) {
			rateLimitShown.add('50');
			toast.warning(`Rate limit: ~${pixelsLeft} pixels left ${suffix}`);
		} else if (used >= 0.2 && !rateLimitShown.has('20')) {
			rateLimitShown.add('20');
			toast.warning(`Rate limit: ~${pixelsLeft} pixels left ${suffix}`);
		}
		if (remaining === 0) rateLimitedUntil = reset;
	}

	function placePixel(x: number, y: number) {
		if (placing) return;
		if (useBskyLikes) return;
		if (selectedColor === null) return;
		if (!user.isLoggedIn) {
			atProtoLoginModalState.show();
			return;
		}
		if (!canPlace()) {
			toast.error("You're blocked from placing pixels");
			return;
		}
		if (rateLimitedUntil > 0 && Date.now() / 1000 < rateLimitedUntil) {
			const mins = Math.ceil((rateLimitedUntil - Date.now() / 1000) / 60);
			toast.error(`Rate limited — resets in ${mins} minute${mins === 1 ? '' : 's'}`);
			return;
		}
		placing = true;
		const c = selectedColor;
		const prevColor = pixels[y * W + x];
		setPixel(x, y, c);
		playPlaceSound();
		haptic([
			{ duration: 30 },
			{ delay: 60, duration: 40, intensity: 1 },
		]);

		const rkey = createTID();
		putRecord({
			collection: 'games.atmo.thousands.pixel',
			rkey,
			record: { x, y, color: c }
		}).then((result) => {
			if (!result.ok && result.rateLimited) {
				setPixel(x, y, prevColor);
				rateLimitedUntil = result.resetAt;
				localStorage.setItem('thousands:ratelimit', String(result.resetAt));
				const mins = Math.ceil((result.resetAt - Date.now() / 1000) / 60);
				toast.error(`Rate limited — resets in ${mins} minute${mins === 1 ? '' : 's'}`);
			} else if (result.ok) {
				checkRateLimit(result.rateLimit);
			}
		}).catch((e) => {
			console.error('[place] putRecord failed', e);
			setPixel(x, y, prevColor);
			toast.error('Failed to place pixel, try to log out and back in');
		}).finally(() => { placing = false; });
	}

	/* ------------------------------------------------------------------ */
	/*  Rendering                                                          */
	/* ------------------------------------------------------------------ */

	let saveViewTimer: ReturnType<typeof setTimeout> | null = null;
	function saveView() {
		if (saveViewTimer) clearTimeout(saveViewTimer);
		saveViewTimer = setTimeout(() => {
			try { localStorage.setItem('thousands:view', JSON.stringify({ ox, oy, scale })); } catch {
				console.error('Failed to save view state');
			}
		}, 200);
	}

	function scheduleRender() {
		if (!rafId) rafId = requestAnimationFrame(render);
		saveView();
	}

	function render() {
		rafId = 0;
		if (!ctx || !offCanvas) return;

		const dpr = devicePixelRatio;
		const cw = canvasEl.width;
		const ch = canvasEl.height;

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, cw, ch);

		// Draw pixel buffer
		ctx.imageSmoothingEnabled = false;
		ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
		ctx.drawImage(offCanvas, 0, 0);

		// Grid lines at high zoom
		if (scale >= GRID_MIN_SCALE) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.strokeStyle = 'rgba(0,0,0,0.12)';
			ctx.lineWidth = 1;

			const x0 = Math.max(0, Math.floor(-ox / scale));
			const y0 = Math.max(0, Math.floor(-oy / scale));
			const x1 = Math.min(W, Math.ceil((cw / dpr - ox) / scale));
			const y1 = Math.min(H, Math.ceil((ch / dpr - oy) / scale));

			ctx.beginPath();
			for (let x = x0; x <= x1; x++) {
				const sx = (x * scale + ox) * dpr;
				ctx.moveTo(sx, Math.max(0, (y0 * scale + oy) * dpr));
				ctx.lineTo(sx, Math.min(ch, (y1 * scale + oy) * dpr));
			}
			for (let y = y0; y <= y1; y++) {
				const sy = (y * scale + oy) * dpr;
				ctx.moveTo(Math.max(0, (x0 * scale + ox) * dpr), sy);
				ctx.lineTo(Math.min(cw, (x1 * scale + ox) * dpr), sy);
			}
			ctx.stroke();
		}

		// Hover highlight + color preview (only when a color is selected)
		if (selectedColor !== null && hoverX >= 0 && hoverX < W && hoverY >= 0 && hoverY < H) {
			ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
			ctx.globalAlpha = 0.4;
			ctx.fillStyle = PALETTE[selectedColor];
			ctx.fillRect(hoverX, hoverY, 1, 1);
			ctx.globalAlpha = 1;
			ctx.strokeStyle = 'rgba(0,0,0,0.7)';
			ctx.lineWidth = 2 / scale;
			ctx.strokeRect(hoverX, hoverY, 1, 1);
			ctx.strokeStyle = 'rgba(255,255,255,0.7)';
			ctx.lineWidth = 1 / scale;
			const inset = 0.5 / scale;
			ctx.strokeRect(hoverX + inset, hoverY + inset, 1 - 2 * inset, 1 - 2 * inset);
		}

		displayScale = scale;
	}

	/* ------------------------------------------------------------------ */
	/*  Pixel data                                                         */
	/* ------------------------------------------------------------------ */

	function rebuildImage() {
		imgData = new ImageData(W, H);
		const d = imgData.data;
		for (let i = 0; i < W * H; i++) {
			const [r, g, b] = PALETTE_RGB[pixels[i]] ?? [255, 255, 255];
			const j = i * 4;
			d[j] = r;
			d[j + 1] = g;
			d[j + 2] = b;
			d[j + 3] = 255;
		}
		offCtx.putImageData(imgData, 0, 0);
	}

	function setPixel(x: number, y: number, c: number) {
		if (x < 0 || x >= W || y < 0 || y >= H) return;
		if (c < 0 || c >= PALETTE.length) return;
		pixels[y * W + x] = c;
		const [r, g, b] = PALETTE_RGB[c];
		const j = (y * W + x) * 4;
		imgData.data[j] = r;
		imgData.data[j + 1] = g;
		imgData.data[j + 2] = b;
		offCtx.putImageData(imgData, 0, 0, x, y, 1, 1);
		scheduleRender();
	}

	/* ------------------------------------------------------------------ */
	/*  Coordinate helpers                                                 */
	/* ------------------------------------------------------------------ */

	function toCanvas(sx: number, sy: number): [number, number] {
		const r = canvasEl.getBoundingClientRect();
		return [Math.floor((sx - r.left - ox) / scale), Math.floor((sy - r.top - oy) / scale)];
	}

	function zoomAt(sx: number, sy: number, next: number) {
		const r = canvasEl.getBoundingClientRect();
		const mx = sx - r.left;
		const my = sy - r.top;
		const cx = (mx - ox) / scale;
		const cy = (my - oy) / scale;
		scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
		ox = mx - cx * scale;
		oy = my - cy * scale;
		scheduleRender();
	}

	function centerCanvas() {
		const cw = containerEl.clientWidth;
		const ch = containerEl.clientHeight;
		scale = Math.min(cw / W, ch / H) * 0.9;
		ox = (cw - W * scale) / 2;
		oy = (ch - H * scale) / 2;
	}

	/* ------------------------------------------------------------------ */
	/*  Mouse events                                                       */
	/* ------------------------------------------------------------------ */

	function onMouseDown(e: MouseEvent) {
		if (e.button !== 0 || isTouch) return;
		dragging = true;
		dragged = false;
		dsx = e.clientX;
		dsy = e.clientY;
		dox = ox;
		doy = oy;
		window.addEventListener('mousemove', onWindowDrag);
		window.addEventListener('mouseup', onWindowDragEnd);
	}

	// Canvas-level: hover only (no drag handling)
	function onMouseMove(e: MouseEvent) {
		if (isTouch || dragging) return;
		const [cx, cy] = toCanvas(e.clientX, e.clientY);
		hoverX = cx;
		hoverY = cy;
		scheduleRender();
	}

	// Window-level: pan + hover during drag
	function onWindowDrag(e: MouseEvent) {
		const dx = e.clientX - dsx;
		const dy = e.clientY - dsy;
		if (Math.abs(dx) > MOUSE_DRAG_THRESHOLD || Math.abs(dy) > MOUSE_DRAG_THRESHOLD)
			dragged = true;
		ox = dox + dx;
		oy = doy + dy;
		const [cx, cy] = toCanvas(e.clientX, e.clientY);
		hoverX = cx;
		hoverY = cy;
		scheduleRender();
	}

	// Window-level: end drag, place pixel on click
	function onWindowDragEnd(e: MouseEvent) {
		window.removeEventListener('mousemove', onWindowDrag);
		window.removeEventListener('mouseup', onWindowDragEnd);
		if (dragging && !dragged) {
			const [cx, cy] = toCanvas(e.clientX, e.clientY);
			if (cx >= 0 && cx < W && cy >= 0 && cy < H) {
				placePixel(cx, cy);
			}
		}
		dragging = false;
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		zoomAt(e.clientX, e.clientY, scale * (e.deltaY > 0 ? 0.9 : 1.1));
	}

	/* ------------------------------------------------------------------ */
	/*  Touch events                                                       */
	/* ------------------------------------------------------------------ */

	function onTouchStart(e: TouchEvent) {
		isTouch = true;
		if (e.touches.length === 1) {
			dragging = true;
			dragged = false;
			dsx = e.touches[0].clientX;
			dsy = e.touches[0].clientY;
			dox = ox;
			doy = oy;
		} else if (e.touches.length === 2) {
			dragging = false;
			pinchDist = Math.hypot(
				e.touches[1].clientX - e.touches[0].clientX,
				e.touches[1].clientY - e.touches[0].clientY,
			);
		}
	}

	function onTouchMove(e: TouchEvent) {
		e.preventDefault();
		if (e.touches.length === 1 && dragging) {
			const dx = e.touches[0].clientX - dsx;
			const dy = e.touches[0].clientY - dsy;
			if (Math.abs(dx) > TOUCH_DRAG_THRESHOLD || Math.abs(dy) > TOUCH_DRAG_THRESHOLD)
				dragged = true;
			ox = dox + dx;
			oy = doy + dy;
			scheduleRender();
		} else if (e.touches.length === 2) {
			const d = Math.hypot(
				e.touches[1].clientX - e.touches[0].clientX,
				e.touches[1].clientY - e.touches[0].clientY,
			);
			const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
			const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
			if (pinchDist > 0) zoomAt(mx, my, scale * (d / pinchDist));
			pinchDist = d;
		}
	}

	function onTouchEnd(e: TouchEvent) {
		if (e.touches.length === 0) {
			if (dragging && !dragged) {
				const [cx, cy] = toCanvas(dsx, dsy);
				if (cx >= 0 && cx < W && cy >= 0 && cy < H) {
					placePixel(cx, cy);
				}
			}
			dragging = false;
			pinchDist = 0;
			hoverX = -1;
			hoverY = -1;
			scheduleRender();
		} else if (e.touches.length === 1) {
			dragging = true;
			dragged = true;
			dsx = e.touches[0].clientX;
			dsy = e.touches[0].clientY;
			dox = ox;
			doy = oy;
			pinchDist = 0;
		}
	}

	/* ------------------------------------------------------------------ */
	/*  Resize                                                             */
	/* ------------------------------------------------------------------ */

	function onResize() {
		const dpr = devicePixelRatio;
		const w = containerEl.clientWidth;
		const h = containerEl.clientHeight;
		canvasEl.width = w * dpr;
		canvasEl.height = h * dpr;
		canvasEl.style.width = w + 'px';
		canvasEl.style.height = h + 'px';
		scheduleRender();
	}

	/* ------------------------------------------------------------------ */
	/*  Keyboard                                                           */
	/* ------------------------------------------------------------------ */

	function onKey(e: KeyboardEvent) {
		if (e.key === '+' || e.key === '=') {
			scale = Math.min(MAX_SCALE, scale * 1.2);
			scheduleRender();
		} else if (e.key === '-') {
			scale = Math.max(MIN_SCALE, scale / 1.2);
			scheduleRender();
		} else if (e.key === '0') {
			centerCanvas();
			scheduleRender();
		}
	}

	/* ------------------------------------------------------------------ */
	/*  Lifecycle                                                          */
	/* ------------------------------------------------------------------ */

	onMount(() => {
		devMode = new URLSearchParams(window.location.search).has('dev');

		ctx = canvasEl.getContext('2d')!;
		offCanvas = document.createElement('canvas');
		offCanvas.width = W;
		offCanvas.height = H;
		offCtx = offCanvas.getContext('2d')!;

		onResize();

		// Restore camera position from localStorage, or center if none saved
		try {
			const saved = localStorage.getItem('thousands:view');
			if (saved) {
				const v = JSON.parse(saved);
				scale = v.scale ?? 1;
				ox = v.ox ?? 0;
				oy = v.oy ?? 0;
			} else {
				centerCanvas();
			}
		} catch {
			centerCanvas();
		}

		// Initialize from server-provided canvas data
		if (initialCanvas) {
			pixels.set(initialCanvas.subarray(0, W * H));
		}
		rebuildImage();
		scheduleRender();
		rateLimitedUntil = parseInt(localStorage.getItem('thousands:ratelimit') ?? '0', 10);
		loaded = true;

		// Refresh block list every minute
		listRefreshInterval = setInterval(async () => {
			try {
				const { getBlockList } = await import('./pixel.remote');
				const { blocked } = await getBlockList({});
				blockedSet = new Set(blocked);
			} catch {
				console.error('Failed to refresh block list');
			}
		}, 600_000);

		const cursor = (Date.now() - 2 * 60 * 1000) * 1000;
		const collection = useBskyLikes ? 'app.bsky.feed.like' : 'games.atmo.thousands.pixel';
		const mapRecord = useBskyLikes ? makeLikeRecordMapper(W, H, PALETTE.length) : pixelRecordMapper;
		jetstream = new JetstreamClient(cursor, collection, (x, y, c, did) => {
			if (blockedSet.has(did)) return;
			setPixel(x, y, c);
		}, mapRecord);
		jetstream.onStatusChange = (s) => (connected = s);
		jetstream.connect();

		canvasEl.addEventListener('wheel', onWheel, { passive: false });
		canvasEl.addEventListener('touchmove', onTouchMove, { passive: false });

		resizeObs = new ResizeObserver(onResize);
		resizeObs.observe(containerEl);
		window.addEventListener('keydown', onKey);
	});

	function startSpam() {
		if (spamInterval) clearInterval(spamInterval);
		spamInterval = setInterval(() => {
			const x = Math.floor(Math.random() * W);
			const y = Math.floor(Math.random() * H);
			const c = Math.floor(Math.random() * PALETTE.length);
			const prevSelectedColor = selectedColor;
			selectedColor = c;
			placePixel(x, y);
			selectedColor = prevSelectedColor;
		}, 1000 / spamRate);
	}

	function toggleSpam() {
		if (spamming) {
			clearInterval(spamInterval!);
			spamInterval = null;
			spamming = false;
		} else {
			spamming = true;
			startSpam();
		}
	}

	onDestroy(() => {
		destroyHaptics();
		jetstream?.disconnect();
		resizeObs?.disconnect();
		if (listRefreshInterval) clearInterval(listRefreshInterval);
		if (spamInterval) clearInterval(spamInterval);
		if (rafId) cancelAnimationFrame(rafId);
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('mousemove', onWindowDrag);
			window.removeEventListener('mouseup', onWindowDragEnd);
		}
	});
</script>

<div
	class="fixed inset-0 select-none touch-none bg-base-200 dark:bg-base-900"
	bind:this={containerEl}
>
	<canvas
		bind:this={canvasEl}
		class="block"
		style="image-rendering: pixelated; cursor: crosshair;"
		onmousedown={onMouseDown}
		onmousemove={onMouseMove}
		onmouseleave={() => {
			if (!dragging) {
				hoverX = -1;
				hoverY = -1;
				scheduleRender();
			}
		}}
		ontouchstart={onTouchStart}
		ontouchend={onTouchEnd}
	></canvas>

	{#if !loaded}
		<div
			class="absolute inset-0 flex items-center justify-center bg-base-200/80 dark:bg-base-900/80"
		>
			<p class="text-lg text-base-600 dark:text-base-400">Loading canvas&hellip;</p>
		</div>
	{/if}

	<!-- Back link -->
	<a
		href={resolve("/")}
		class="absolute left-2 top-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm transition-colors hover:bg-black/80 sm:left-4 sm:top-4 sm:text-sm"
	>
		&larr; back
	</a>

	<!-- Download button -->
	<button
		onclick={() => {
			const a = document.createElement('a');
			a.href = offCanvas.toDataURL('image/png');
			a.download = '1000s.png';
			a.click();
		}}
		class="absolute right-2 top-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm transition-colors hover:bg-black/80 sm:right-4 sm:top-4 sm:text-sm"
	>
		&#8595; download
	</button>

	{#if devMode}
		<div class="absolute left-2 top-12 flex items-center gap-1.5 sm:left-4 sm:top-14">
			<button
				onclick={toggleSpam}
				class="rounded-lg px-3 py-1.5 text-xs text-white backdrop-blur-sm transition-colors sm:text-sm {spamming ? 'bg-red-600/80 hover:bg-red-600' : 'bg-black/60 hover:bg-black/80'}"
			>
				{spamming ? 'stop spam' : 'spam pixels'}
			</button>
			<input
				type="number"
				min="1"
				max="100"
				bind:value={spamRate}
				onchange={() => { if (spamming) startSpam(); }}
				class="w-16 rounded-lg bg-black/60 px-2 py-1.5 text-xs text-white backdrop-blur-sm sm:text-sm"
			/>
			<span class="text-xs text-white/70">/s</span>
		</div>
	{/if}

	<!-- Bottom chrome -->
	<div
		class="pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center gap-1.5 p-2 sm:gap-2 sm:p-3"
		style="padding-bottom: max(env(safe-area-inset-bottom, 0px), 0.5rem);"
	>
		{#if useBskyLikes}
			<div class="rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm">
				canvas driven by bluesky likes
			</div>
		{:else}
			<div
				class="pointer-events-auto grid grid-cols-8 gap-1.5 rounded-xl bg-black/60 p-2 backdrop-blur-sm sm:grid-cols-16 sm:gap-2 sm:p-2.5"
			>
				{#each PALETTE as color, i (i)}
					<button
						class="size-6 sm:size-7 rounded-lg transition-transform hover:scale-105 cursor-pointer
							{selectedColor === i ? 'scale-105' : ''}"
						style="background-color:{color};{selectedColor === i ? `outline:2px solid ${color};outline-offset:1.5px` : ''}"
						onclick={() => (selectedColor = selectedColor === i ? null : i)}
						title={PALETTE_NAMES[i]}
					></button>
				{/each}
			</div>
		{/if}
	</div>
</div>
