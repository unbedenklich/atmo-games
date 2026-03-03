/** Shared types for the atplace AT Protocol backend and SvelteKit frontend. */

/** A single pixel on the canvas. */
export interface Pixel {
  x: number;
  y: number;
  did: string;
  painted_at: number; // microsecond epoch
}

/** User stats row from D1. */
export interface UserStats {
  did: string;
  last_paint_at: number; // microsecond epoch
  total_pixels: number;
}

/** Canvas data returned to the frontend. */
export interface CanvasData {
  canvas: ArrayBuffer;
  cursor: number;
}

/** Pixel metadata returned by getPixel. */
export interface PixelInfo {
  did: string;
  painted_at: number;
}

/** Cooldown info returned by getCooldown. */
export interface CooldownInfo {
  did: string;
  last_paint_at: number;
  cooldown_remaining_ms: number;
  whitelisted: boolean;
}

/** Leaderboard entry returned by getLeaderboard. */
export interface LeaderboardEntry {
  did: string;
  total_pixels: number;
}

/** General stats returned by getStats. */
export interface StatsInfo {
  unique_painters: number;
  total_pixels: number;
  canvas_width: number;
  canvas_height: number;
  cursor: number | null;
}

/** A pixel placement event from Jetstream. */
export interface PixelEvent {
  did: string;
  x: number;
  y: number;
  color: number;
  time_us: number;
  operation: "create" | "update" | "delete";
}
