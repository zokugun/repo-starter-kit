import process from 'node:process';
import { isNonEmptyString } from '@zokugun/is-it-type';
import { err, ok, stringifyError, type Result } from '@zokugun/xtry';
import pacote from 'pacote';
import { temporaryDirectory } from 'tempy';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const $cache: Record<string, string> = {};

export async function downloadPackage(packageName: string): Promise<Result<string, string>> {
	if($cache[packageName]) {
		return ok($cache[packageName]);
	}

	const dir = temporaryDirectory();

	try {
		const result = await pacote.extract(packageName, dir, { registry: resolveRegistry() });

		if(!result.resolved) {
			return err(result.from);
		}
	}
	catch (error) {
		return err(stringifyError(error));
	}

	$cache[packageName] = dir;

	return ok(dir);
}

function resolveRegistry(): string {
	const registry = process.env.npm_config_registry;

	if(isNonEmptyString<string>(registry)) {
		return registry;
	}

	return DEFAULT_REGISTRY;
}
