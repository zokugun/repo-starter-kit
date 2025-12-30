import { ok, type Result } from '@zokugun/xtry';
import { downloadPackage } from '../npms/download-package.js';
import { normalizePackageName } from '../npms/normalize-package-name.js';
import { splitNpmPath } from '../npms/split-npm-ath.js';
import { joinWithinRoot } from '../paths/join-within-root.js';

export async function resolveNpmPath(value: string): Promise<Result<string, string>> {
	const { packageName, filePath } = splitNpmPath(value);

	let packageDir = await downloadPackage(packageName);
	if(packageDir.fails) {
		const normalizedName = normalizePackageName(packageName);
		if(normalizedName.fails || packageName === normalizedName.value) {
			return packageDir;
		}

		const result = await downloadPackage(packageName);
		if(result.fails) {
			return packageDir;
		}

		packageDir = result;
	}

	if(filePath.length === 0) {
		return ok(packageDir.value);
	}

	return joinWithinRoot(packageDir.value, filePath);
}
