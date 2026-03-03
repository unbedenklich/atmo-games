const CONSTELLATION_BASE = 'https://constellation.microcosm.blue';

type BacklinkResult = {
	total: number;
	records: { did: string; collection: string; rkey: string }[];
	cursor?: string | null;
};

export async function getScoreBacklink(
	puzzleUri: string,
	userDid: string
): Promise<{ collection: string; rkey: string } | null> {
	const params = new URLSearchParams({
		subject: puzzleUri,
		source: 'games.atmo.fours.score:puzzle.uri',
		did: userDid,
		limit: '1'
	});

	const res = await fetch(
		`${CONSTELLATION_BASE}/xrpc/blue.microcosm.links.getBacklinks?${params}`
	);

	if (!res.ok) return null;

	const data: BacklinkResult = await res.json();
	if (data.records.length === 0) return null;

	return {
		collection: data.records[0].collection,
		rkey: data.records[0].rkey
	};
}
