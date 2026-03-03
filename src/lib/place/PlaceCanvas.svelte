<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { PALETTE, PALETTE_RGB, PALETTE_NAMES } from './palette';
	import { JetstreamClient } from './jetstream';
	import { user } from '$lib/atproto';
	import { atProtoLoginModalState } from '@foxui/social';

	const W = 1000;
	const H = 1000;
	const MIN_SCALE = 0.3;
	const MAX_SCALE = 50;
	const GRID_MIN_SCALE = 8;
	const COOLDOWN_MS = 60_000;
	const TOUCH_DRAG_THRESHOLD = 10;
	const MOUSE_DRAG_THRESHOLD = 2;

	interface Props {
		initialCursor?: number;
	}

	let { initialCursor = 0 }: Props = $props();

	// Reactive UI state
	let selectedColor = $state(0);
	let hoverX = $state(-1);
	let hoverY = $state(-1);
	let connected = $state(false);
	let displayScale = $state(1);
	let loaded = $state(false);
	let devMode = $state(false);

	// Cooldown
	let lastPlaceTime = $state(0);
	let cooldownRemaining = $state(0);
	let cooldownInterval: ReturnType<typeof setInterval>;

	// Confirm flow
	let isTouch = $state(false);
	let pendingPlace: { x: number; y: number } | null = $state(null);
	let pixelAuthor: string | null = $state(null);
	let pixelAuthorLoading = $state(false);

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

	// Pixel storage — 1 byte per pixel (color index 0-31), default white (31)
	const pixels = new Uint8Array(W * H).fill(31);

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

	/* ------------------------------------------------------------------ */
	/*  Cooldown                                                           */
	/* ------------------------------------------------------------------ */

	function canPlace(): boolean {
		if (devMode) return true;
		return cooldownRemaining <= 0;
	}

	function startCooldown() {
		lastPlaceTime = Date.now();
		cooldownRemaining = COOLDOWN_MS;
		if (cooldownInterval) clearInterval(cooldownInterval);
		cooldownInterval = setInterval(() => {
			const elapsed = Date.now() - lastPlaceTime;
			cooldownRemaining = Math.max(0, COOLDOWN_MS - elapsed);
			if (cooldownRemaining <= 0) clearInterval(cooldownInterval);
		}, 100);
	}

	function formatCooldown(ms: number): string {
		const s = Math.ceil(ms / 1000);
		const min = Math.floor(s / 60);
		const sec = s % 60;
		return `${min}:${sec.toString().padStart(2, '0')}`;
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
	/*  Pixel info                                                         */
	/* ------------------------------------------------------------------ */

	async function fetchPixelAuthor(x: number, y: number) {
		pixelAuthor = null;
		pixelAuthorLoading = true;
		try {
			const res = await fetch(`/million/pixel?x=${x}&y=${y}`);
			if (!res.ok) { pixelAuthorLoading = false; return; }
			const info = await res.json();
			if (!info.did) { pixelAuthorLoading = false; return; }
			// Try to resolve handle
			try {
				const profile = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${info.did}`);
				if (profile.ok) {
					const data = await profile.json();
					pixelAuthor = `@${data.handle}`;
				} else {
					pixelAuthor = info.did.slice(0, 16) + '\u2026';
				}
			} catch {
				pixelAuthor = info.did.slice(0, 16) + '\u2026';
			}
		} catch {
			/* offline */
		}
		pixelAuthorLoading = false;
	}

	/* ------------------------------------------------------------------ */
	/*  Pixel placement                                                    */
	/* ------------------------------------------------------------------ */

	function placePixel(x: number, y: number) {
		if (!user.isLoggedIn) {
			atProtoLoginModalState.show();
			return;
		}
		if (!canPlace()) return;
		const c = selectedColor;
		setPixel(x, y, c);
		playPlaceSound();
		if (!devMode) startCooldown();

		// Persist to server
		fetch('/million/pixel', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ x, y, color: c, did: user.did ?? 'anonymous' }),
		}).catch(() => {});
	}

	function confirmPlace() {
		if (!pendingPlace) return;
		placePixel(pendingPlace.x, pendingPlace.y);
		pendingPlace = null;
		scheduleRender();
	}

	function cancelPlace() {
		pendingPlace = null;
		pixelAuthor = null;
		pixelAuthorLoading = false;
		scheduleRender();
	}

	/* ------------------------------------------------------------------ */
	/*  Rendering                                                          */
	/* ------------------------------------------------------------------ */

	function scheduleRender() {
		if (!rafId) rafId = requestAnimationFrame(render);
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

		// Pending placement highlight
		if (pendingPlace) {
			const { x, y } = pendingPlace;
			ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
			ctx.globalAlpha = 0.7;
			ctx.fillStyle = PALETTE[selectedColor];
			ctx.fillRect(x, y, 1, 1);
			ctx.globalAlpha = 1;
			ctx.strokeStyle = 'white';
			ctx.lineWidth = 3 / scale;
			ctx.strokeRect(x, y, 1, 1);
			ctx.strokeStyle = 'black';
			ctx.lineWidth = 1.5 / scale;
			ctx.strokeRect(x, y, 1, 1);
		}
		// Hover highlight + preview (desktop)
		else if (hoverX >= 0 && hoverX < W && hoverY >= 0 && hoverY < H) {
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

	// Window-level: end drag, optionally select pixel for placement
	function onWindowDragEnd(e: MouseEvent) {
		window.removeEventListener('mousemove', onWindowDrag);
		window.removeEventListener('mouseup', onWindowDragEnd);
		if (dragging && !dragged) {
			const [cx, cy] = toCanvas(e.clientX, e.clientY);
			if (cx >= 0 && cx < W && cy >= 0 && cy < H) {
				pendingPlace = { x: cx, y: cy };
				fetchPixelAuthor(cx, cy);
				scheduleRender();
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
					pendingPlace = { x: cx, y: cy };
					fetchPixelAuthor(cx, cy);
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
	/*  Data loading                                                       */
	/* ------------------------------------------------------------------ */

	async function loadCanvas() {
		let cursor = initialCursor;
		try {
			const res = await fetch('/million/canvas');
			if (res.ok) {
				const buf = await res.arrayBuffer();
				pixels.set(new Uint8Array(buf).subarray(0, W * H));
				cursor = parseInt(res.headers.get('X-Canvas-Cursor') ?? '0', 10) || initialCursor;
			}
		} catch {
			/* backend unavailable — blank canvas */
		}
		rebuildImage();
		scheduleRender();
		loaded = true;

		jetstream = new JetstreamClient(cursor, (x, y, c) => setPixel(x, y, c));
		jetstream.onStatusChange = (s) => (connected = s);
		jetstream.connect();
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
		centerCanvas();
		loadCanvas();

		canvasEl.addEventListener('wheel', onWheel, { passive: false });
		canvasEl.addEventListener('touchmove', onTouchMove, { passive: false });

		resizeObs = new ResizeObserver(onResize);
		resizeObs.observe(containerEl);
		window.addEventListener('keydown', onKey);
	});

	onDestroy(() => {
		jetstream?.disconnect();
		resizeObs?.disconnect();
		if (cooldownInterval) clearInterval(cooldownInterval);
		if (rafId) cancelAnimationFrame(rafId);
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('mousemove', onWindowDrag);
			window.removeEventListener('mouseup', onWindowDragEnd);
		}
	});
</script>

<div
	class="fixed inset-0 select-none touch-none bg-stone-200 dark:bg-stone-900"
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
			class="absolute inset-0 flex items-center justify-center bg-stone-200/80 dark:bg-stone-900/80"
		>
			<p class="text-lg text-stone-600 dark:text-stone-400">Loading canvas&hellip;</p>
		</div>
	{/if}

	<!-- Top-right info badge -->
	<div
		class="pointer-events-none absolute right-2 top-2 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 font-mono text-xs text-white backdrop-blur-sm sm:right-4 sm:top-4 sm:text-sm"
	>
		{#if hoverX >= 0 && hoverX < W && hoverY >= 0 && hoverY < H}
			<span>({hoverX}, {hoverY})</span>
			<span class="opacity-40">|</span>
		{/if}
		<span>{displayScale.toFixed(1)}x</span>
		{#if devMode}
			<span class="rounded bg-amber-500/80 px-1 py-0.5 text-[10px] font-bold leading-none"
				>DEV</span
			>
		{/if}
		<span
			class="ml-1 inline-block h-2 w-2 rounded-full {connected ? 'bg-green-400' : 'bg-red-400'}"
		></span>
	</div>

	<!-- Back link -->
	<a
		href="/"
		class="absolute left-12 top-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm transition-colors hover:bg-black/80 sm:left-14 sm:top-4 sm:text-sm"
	>
		&larr; Million
	</a>

	<!-- Bottom chrome -->
	<div
		class="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-1.5 p-2 sm:gap-2 sm:p-3"
		style="padding-bottom: max(env(safe-area-inset-bottom, 0px), 0.5rem);"
	>
		{#if cooldownRemaining > 0 && !devMode}
			<div
				class="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm sm:text-sm"
			>
				<div class="h-1.5 w-24 overflow-hidden rounded-full bg-white/20 sm:w-32">
					<div
						class="h-full rounded-full bg-white/70 transition-all duration-100"
						style="width: {((COOLDOWN_MS - cooldownRemaining) / COOLDOWN_MS) * 100}%"
					></div>
				</div>
				<span>Next pixel in {formatCooldown(cooldownRemaining)}</span>
			</div>
		{/if}

		{#if pendingPlace}
			<div
				class="flex flex-col items-center gap-1 rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm"
			>
				<div class="flex items-center gap-2 text-xs text-white sm:text-sm">
					<span
						class="inline-block h-5 w-5 rounded border border-white/30"
						style="background-color: {PALETTE[selectedColor]}"
					></span>
					<span class="font-mono">({pendingPlace.x}, {pendingPlace.y})</span>
					<button
						class="rounded bg-white/20 px-3 py-1 font-medium transition-colors hover:bg-white/30 disabled:opacity-40"
						onclick={confirmPlace}
						disabled={!canPlace()}
					>
						{#if canPlace()}
							Place
						{:else}
							{formatCooldown(cooldownRemaining)}
						{/if}
					</button>
					<button
						class="rounded bg-white/10 px-2 py-1 transition-colors hover:bg-white/20"
						onclick={cancelPlace}
					>
						&times;
					</button>
				</div>
			</div>
		{/if}

		{#if pixelAuthorLoading}
			<span
				class="rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] text-white/50 backdrop-blur-sm sm:text-xs"
				>loading…</span
			>
		{:else if pixelAuthor}
			<span
				class="rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] text-white/80 backdrop-blur-sm sm:text-xs"
				>placed by {pixelAuthor}</span
			>
		{/if}

		<div
			class="flex max-w-sm flex-wrap justify-center gap-0.5 rounded-xl bg-black/60 p-1.5 backdrop-blur-sm sm:max-w-md sm:gap-1 sm:p-2"
		>
			{#each PALETTE as color, i (i)}
				<button
					class="h-6 w-6 rounded-sm border-2 transition-transform hover:scale-110 sm:h-7 sm:w-7
						{selectedColor === i ? 'border-white scale-110 ring-2 ring-black/60' : 'border-transparent'}"
					style="background-color:{color};{color === '#FFFFFF' ||
					color === '#D4D7D9' ||
					color === '#FFF8B8'
						? 'box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)'
						: ''}"
					onclick={() => (selectedColor = i)}
					title={PALETTE_NAMES[i]}
				></button>
			{/each}
		</div>
	</div>
</div>
