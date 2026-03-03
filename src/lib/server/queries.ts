/**
 * Read-only query functions for the SvelteKit frontend.
 *
 * Each function takes Cloudflare bindings (D1/KV) and returns typed data.
 * Copy this file + types.ts to the SvelteKit project's $lib/server/ directory.
 */
import type {
  CanvasData,
  PixelInfo,
  CooldownInfo,
  LeaderboardEntry,
  StatsInfo,
} from "./types";

/** Canvas blob + cursor for initial page load. */
export async function getCanvas(
  kv: KVNamespace,
): Promise<CanvasData | null> {
  const result = await kv.getWithMetadata<{ cursor: string }>("canvas:latest", "arrayBuffer");

  if (!result.value) return null;

  // Prefer cursor from metadata (new format), fall back to legacy key
  let cursor = 0;
  if (result.metadata?.cursor) {
    cursor = parseInt(result.metadata.cursor, 10);
  } else {
    const legacyCursor = await kv.get("cursor:latest", "text");
    if (legacyCursor) cursor = parseInt(legacyCursor, 10);
  }

  return { canvas: result.value, cursor };
}

/** Who placed a specific pixel and when. */
export async function getPixel(
  db: D1Database,
  x: number,
  y: number,
): Promise<PixelInfo | null> {
  const row = await db
    .prepare("SELECT did, painted_at FROM pixels WHERE x = ? AND y = ?")
    .bind(x, y)
    .first<{ did: string; painted_at: number }>();

  return row ? { did: row.did, painted_at: row.painted_at } : null;
}

/** Rate limit check — returns cooldown remaining in ms (0 = can paint). Whitelisted users always have 0 cooldown. */
export async function getCooldown(
  db: D1Database,
  did: string,
  cooldownMs: number = 60_000,
): Promise<CooldownInfo> {
  const row = await db
    .prepare("SELECT last_paint_at, whitelisted FROM user_stats WHERE did = ?")
    .bind(did)
    .first<{ last_paint_at: number; whitelisted: number }>();

  const lastPaintAt = row ? row.last_paint_at : 0;
  const whitelisted = row ? row.whitelisted === 1 : false;

  let remaining = 0;
  if (!whitelisted) {
    const lastPaintMs = Math.floor(lastPaintAt / 1000);
    const elapsed = Date.now() - lastPaintMs;
    remaining = Math.max(0, cooldownMs - elapsed);
  }

  return {
    did,
    last_paint_at: lastPaintAt,
    cooldown_remaining_ms: remaining,
    whitelisted,
  };
}

/** Top painters by pixel count. */
export async function getLeaderboard(
  db: D1Database,
  limit: number = 50,
): Promise<LeaderboardEntry[]> {
  const clampedLimit = Math.min(Math.max(1, limit), 100);
  const result = await db
    .prepare(
      "SELECT did, total_pixels FROM user_stats ORDER BY total_pixels DESC LIMIT ?",
    )
    .bind(clampedLimit)
    .all<{ did: string; total_pixels: number }>();

  return result.results ?? [];
}

/** General stats: unique painters, total pixels placed, canvas info. */
export async function getStats(
  db: D1Database,
  kv: KVNamespace,
  canvasWidth: number = 1000,
  canvasHeight: number = 1000,
): Promise<StatsInfo> {
  const [dbStats, kvResult] = await Promise.all([
    db
      .prepare(
        "SELECT COUNT(*) as unique_painters, COALESCE(SUM(total_pixels), 0) as total_pixels FROM user_stats",
      )
      .first<{ unique_painters: number; total_pixels: number }>(),
    kv.getWithMetadata<{ cursor: string }>("canvas:latest"),
  ]);

  let cursor: number | null = null;
  if (kvResult.metadata?.cursor) {
    cursor = parseInt(kvResult.metadata.cursor, 10);
  } else {
    const legacyCursor = await kv.get("cursor:latest", "text");
    if (legacyCursor) cursor = parseInt(legacyCursor, 10);
  }

  return {
    unique_painters: dbStats?.unique_painters ?? 0,
    total_pixels: dbStats?.total_pixels ?? 0,
    canvas_width: canvasWidth,
    canvas_height: canvasHeight,
    cursor,
  };
}
