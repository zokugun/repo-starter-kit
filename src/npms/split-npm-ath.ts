export function splitNpmPath(value: string): { packageName: string; filePath: string } {
	value = value.replace(/^npm:/, '');

	if(value.startsWith('@')) {
		const firstSlash = value.indexOf('/', 1);

		if(firstSlash === -1) {
			return { packageName: value, filePath: '' };
		}

		const secondSlash = value.indexOf('/', firstSlash + 1);

		if(secondSlash === -1) {
			return { packageName: value, filePath: '' };
		}

		return {
			packageName: value.slice(0, secondSlash),
			filePath: value.slice(secondSlash + 1),
		};
	}

	const slashIndex = value.indexOf('/');

	if(slashIndex === -1) {
		return { packageName: value, filePath: '' };
	}

	return {
		packageName: value.slice(0, slashIndex),
		filePath: value.slice(slashIndex + 1),
	};
}
