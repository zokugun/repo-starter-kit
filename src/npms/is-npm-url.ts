export function isNpmUrl(value: string): boolean {
	return /^npm:@?\w+$/.test(value);
}
