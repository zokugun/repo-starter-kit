import { err, ok, type Result } from '@zokugun/xtry';

export function normalizePackageName(input: string): Result<string, string> {
	if(!input) {
		return err('Package name cannot be empty.');
	}

	if(input.startsWith('@')) {
		const slashIndex = input.indexOf('/');

		if(slashIndex === -1) {
			return err(`Scoped package '${input}' must include a name after '/'.`);
		}

		const scope = input.slice(0, slashIndex);
		const name = input.slice(slashIndex + 1);

		if(name.length === 0) {
			return err(`Scoped package '${input}' is missing the package name.`);
		}

		if(name.startsWith('repo-starter-kit-')) {
			return ok(`${scope}/${name}`);
		}

		return ok(`${scope}/repo-starter-kit-${name}`);
	}

	if(input.startsWith('repo-starter-kit-')) {
		return ok(input);
	}

	return ok(`repo-starter-kit-${input}`);
}
