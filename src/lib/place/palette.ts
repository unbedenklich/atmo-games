/** r/place 2022 palette — 32 colors. */
export const PALETTE = [
	'#6D001A', '#BE0039', '#FF4500', '#FFA800',
	'#FFD635', '#FFF8B8', '#00A368', '#00CC78',
	'#7EED56', '#00756F', '#009EAA', '#00CCC0',
	'#2450A4', '#3690EA', '#51E9F4', '#493AC1',
	'#6A5CFF', '#94B3FF', '#811E9F', '#B44AC0',
	'#E4ABFF', '#DE107F', '#FF3881', '#FF99AA',
	'#6D482F', '#9C6926', '#FFB470', '#000000',
	'#515252', '#898D90', '#D4D7D9', '#FFFFFF',
] as const;

export const PALETTE_NAMES = [
	'Burgundy', 'Dark Red', 'Red', 'Orange',
	'Yellow', 'Pale Yellow', 'Dark Green', 'Green',
	'Lime', 'Dark Teal', 'Teal', 'Light Teal',
	'Dark Blue', 'Blue', 'Light Blue', 'Indigo',
	'Purple', 'Lavender', 'Dark Magenta', 'Magenta',
	'Pink Lace', 'Hot Pink', 'Pink', 'Light Pink',
	'Dark Brown', 'Brown', 'Peach', 'Black',
	'Dark Gray', 'Gray', 'Light Gray', 'White',
] as const;

/** Pre-computed [R, G, B] for fast ImageData writes. */
export const PALETTE_RGB: [number, number, number][] = PALETTE.map((hex) => {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
});
