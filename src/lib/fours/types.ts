export type FoursGroup = {
	category: string;
	words: [string, string, string, string];
	difficulty: 0 | 1 | 2 | 3;
};

export type FoursPuzzle = {
	groups: [FoursGroup, FoursGroup, FoursGroup, FoursGroup];
};

export type FoursScore = {
	guesses: [string, string, string, string][];
	won: boolean;
};
