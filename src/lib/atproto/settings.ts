import { dev } from '$app/environment';

type Permissions = {
	collections: readonly string[];
	rpc: Record<string, string | string[]>;
	blobs: readonly string[];
};

export const permissions = {
	collections: ['games.atmo.fours.puzzle', 'games.atmo.fours.score', 'games.atmo.fours.puzzleList', 'games.atmo.million.pixel'],
	rpc: {},
	blobs: []
} as const satisfies Permissions;

type ExtractCollectionBase<T extends string> = T extends `${infer Base}?${string}` ? Base : T;

export type AllowedCollection = ExtractCollectionBase<(typeof permissions.collections)[number]>;

// PDS to use for signup (change to preferred PDS)
const devPDS = 'https://bsky.social/';
const prodPDS = 'https://bsky.social/';
export const signUpPDS = dev ? devPDS : prodPDS;

export const REDIRECT_PATH = '/oauth/callback';

export const DOH_RESOLVER = 'https://mozilla.cloudflare-dns.com/dns-query';
