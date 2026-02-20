import { type Result, yerr, yres, type YResult } from '@zokugun/xtry/async';
import { isNpmUrl } from '../npms/is-npm-url.js';
import { resolveLocalPath } from '../paths/resolve-local-path.js';
import { resolveNpmPath } from '../paths/resolve-npm-path.js';

export async function loadResource<T>(value: string, loader: (value: string) => Promise<Result<T, string>>, { cwd }: { cwd?: string } = {}): Promise<YResult<T, string, 'not-found'>> {
	const filename = resolveLocalPath(value, cwd ? { cwd } : { absolute: true });

	if(!filename && isNpmUrl(value)) {
		const filename = await resolveNpmPath(value);

		if(filename.fails) {
			return filename;
		}
	}

	if(filename) {
		return yres(loader(filename));
	}

	return yerr('not-found');
}
