import path from 'node:path';
import fse from '@zokugun/fs-extra-plus/async';
import { err, ok, stringifyError, xtry, type Result, yerr, yres, type YResult } from '@zokugun/xtry/sync';
import YAML from 'yaml';
import { downloadPackage } from '../npms/download-package.js';
import { normalizePackageName } from '../npms/normalize-package-name.js';
import { splitNpmPath } from '../npms/split-npm-ath.js';
import { joinWithinRoot } from '../paths/join-within-root.js';
import { resolveLocalPath } from '../paths/resolve-local-path.js';
import { isRecord } from '../utils/is-record.js';

type Config = {
	root: string;
	labels?: string;
	issue?: string;
	rulesets?: string[];
};

const CONFIG_FILES: Array<{ name: string; type?: 'yaml' | 'json' }> = [
	{
		name: 'repo-starter-kit.yml',
		type: 'yaml',
	},
	{
		name: 'repo-starter-kit.yaml',
		type: 'yaml',
	},
	{
		name: 'repo-starter-kit.json',
		type: 'json',
	},
	{
		name: 'repo-starter-kit',
	},
];

export async function loadConfig(value: string): Promise<Result<Config, string>> { // {{{
	let filePath = resolveLocalPath(value, { absolute: true });

	if(filePath) {
		return readConfigFromLocal(filePath);
	}
	else {
		const packageSpec = splitNpmPath(value);

		const normalizedName = normalizePackageName(packageSpec.packageName);
		if(normalizedName.fails) {
			return normalizedName;
		}

		const packageRoot = await downloadPackage(normalizedName.value);
		if(packageRoot.fails) {
			return packageRoot;
		}

		if(packageSpec.filePath) {
			const result = joinWithinRoot(packageRoot.value, packageSpec.filePath);
			if(result.fails) {
				return err(`"${packageSpec.filePath}" must reference a file in the package`);
			}

			filePath = result.value;
		}
		else {
			filePath = packageRoot.value;
		}

		return readConfigFromPackage(filePath, packageSpec.packageName);
	}
} // }}}

async function readConfigFromPackage(packageRoot: string, packageName: string): Promise<Result<Config, string>> { // {{{
	const stat = await fse.stat(packageRoot);
	if(stat.fails) {
		return err(stringifyError(stat.error));
	}

	if(stat.value.isFile()) {
		const result = await tryReadConfigFile(packageRoot, path.dirname(packageRoot), path.basename(packageRoot));

		if(result.fails || result.success) {
			return result;
		}

		return err(`Failed to read: ${packageRoot}`);
	}

	for(const { name, type } of CONFIG_FILES) {
		const filename = path.join(packageRoot, name);
		const result = await tryReadConfigFile(filename, packageRoot, name, type);

		if(result.fails || result.success) {
			return result;
		}
	}

	return err(`Package ${packageName} must include one of ${CONFIG_FILES.map(({ name }) => name).join(', ')} at its root.`);
} // }}}

async function tryReadConfigFile(filename: string, root: string, name: string, type?: 'yaml' | 'json'): Promise<YResult<Config, string, 'not-found'>> { // {{{
	const { fails, error, value: content } = await fse.readFile(filename, 'utf8');

	if(fails) {
		if(error.code === 'ENOENT') {
			return yerr('not-found');
		}

		return err(`Failed to read ${name} from package: ${stringifyError(error)}`);
	}
	else {
		const parsed = parseConfigContent(content, type);

		if(parsed.fails) {
			return err(`Failed to parse ${name} from package: ${parsed.error}`);
		}

		return yres(normalizeConfig(parsed.value, root, name));
	}
} // }}}

async function readConfigFromLocal(fileRoot: string): Promise<Result<Config, string>> { // {{{
	const stat = await fse.stat(fileRoot);
	if(stat.fails) {
		return err(stringifyError(stat.error));
	}

	if(stat.value.isFile()) {
		const result = await tryReadConfigFile(fileRoot, path.dirname(fileRoot), path.basename(fileRoot));

		if(result.fails || result.success) {
			return result;
		}

		return err(`Failed to read: ${fileRoot}`);
	}

	for(const { name, type } of CONFIG_FILES) {
		const filename = path.join(fileRoot, name);
		const result = await tryReadConfigFile(filename, fileRoot, name, type);

		if(result.fails || result.success) {
			return result;
		}
	}

	return err(`Directory ${fileRoot} must include one of ${CONFIG_FILES.map(({ name }) => name).join(', ')} at its root.`);
} // }}}

function parseConfigContent(content: string, type?: 'json' | 'yaml'): Result<unknown, string> { // {{{
	if(type === 'json') {
		return xtry(() => JSON.parse(content) as unknown, stringifyError);
	}

	if(type === 'yaml') {
		return xtry(() => YAML.parse(content) as unknown, stringifyError);
	}

	let result = xtry(() => JSON.parse(content) as unknown, stringifyError);

	if(result.fails) {
		result = xtry(() => YAML.parse(content) as unknown, stringifyError);
	}

	return result;
} // }}}

function normalizeConfig(data: unknown, root: string, source: string): Result<Config, string> { // {{{
	if(!isRecord(data)) {
		return err(`Config file ${source} must export an object.`);
	}

	const labels = typeof data.labels === 'string' ? data.labels : undefined;
	const issue = typeof data.issue === 'string' ? data.issue : undefined;
	let rulesets: string[] | undefined;

	if(typeof data.rulesets === 'string') {
		rulesets = [data.rulesets];
	}
	else if(Array.isArray(data.rulesets) && data.rulesets.every((ruleset) => typeof ruleset === 'string')) {
		rulesets = data.rulesets;
	}

	return ok({
		root,
		labels,
		issue,
		rulesets,
	});
} // }}}
