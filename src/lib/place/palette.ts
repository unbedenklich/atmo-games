/** r/place 2022 palette — 32 colors. Index 0 = white (blank canvas). */
export const PALETTE = [
	'#FFFFFF', '#D4D7D9', '#898D90', '#515252',
	'#000000', '#FFB470', '#9C6926', '#6D482F',
	'#FF99AA', '#FF3881', '#DE107F', '#E4ABFF',
	'#B44AC0', '#811E9F', '#94B3FF', '#6A5CFF',
	'#493AC1', '#51E9F4', '#3690EA', '#2450A4',
	'#00CCC0', '#009EAA', '#00756F', '#7EED56',
	'#00CC78', '#00A368', '#FFF8B8', '#FFD635',
	'#FFA800', '#FF4500', '#BE0039', '#6D001A',
] as const;

export const PALETTE_NAMES = [
	'White', 'Light Gray', 'Gray', 'Dark Gray',
	'Black', 'Peach', 'Brown', 'Dark Brown',
	'Light Pink', 'Pink', 'Hot Pink', 'Pink Lace',
	'Magenta', 'Dark Magenta', 'Lavender', 'Purple',
	'Indigo', 'Light Blue', 'Blue', 'Dark Blue',
	'Light Teal', 'Teal', 'Dark Teal', 'Lime',
	'Green', 'Dark Green', 'Pale Yellow', 'Yellow',
	'Orange', 'Red', 'Dark Red', 'Burgundy',
] as const;

/** Pre-computed [R, G, B] for fast ImageData writes. */
export const PALETTE_RGB: [number, number, number][] = PALETTE.map((hex) => {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
});
