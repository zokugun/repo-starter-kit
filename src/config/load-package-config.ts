import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { err, ok, stringifyError, type Result } from '@zokugun/xtry';
import pacote from 'pacote';
import { temporaryDirectory } from 'tempy';
import YAML from 'yaml';
import { isNodeError } from '../utils/is-node-error.js';
import { isRecord } from '../utils/is-record.js';

type PackageFileConfig = {
	labels?: string;
	issue?: string;
};

const CONFIG_FILENAMES = ['repo-starter-kit.yml', 'repo-starter-kit.yaml', 'repo-starter-kit.json'] as const;
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

export async function loadPackageConfig(packageName: string): Promise<Result<{ labelsPath?: string; issuePath?: string }, string>> {
	const normalizedName = normalizePackageName(packageName);
	if(normalizedName.fails) {
		return normalizedName;
	}

	const packageRoot = await downloadPackage(normalizedName.value);
	if(packageRoot.fails) {
		return packageRoot;
	}

	const fileConfig = await readConfigFile(packageRoot.value, packageName);
	if(fileConfig.fails) {
		return fileConfig;
	}

	const labelsPath = typeof fileConfig.value.labels === 'string' ? path.resolve(packageRoot.value, fileConfig.value.labels) : undefined;
	const issuePath = typeof fileConfig.value.issue === 'string' ? path.resolve(packageRoot.value, fileConfig.value.issue) : undefined;

	return ok({ labelsPath, issuePath });
}

function normalizePackageName(input: string): Result<string, string> {
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

async function downloadPackage(packageName: string): Promise<Result<string, string>> {
	const registry = resolveRegistry();
	const dir = temporaryDirectory();
	const result = await pacote.extract(packageName, dir, { registry });

	if(!result.resolved) {
		return err(result.from);
	}

	return ok(dir);
}

function resolveRegistry(): string {
	const registry = process.env.npm_config_registry;
	if(typeof registry === 'string' && registry.trim().length > 0) {
		return registry;
	}

	return DEFAULT_REGISTRY;
}

async function readConfigFile(packageRoot: string, packageName: string): Promise<Result<PackageFileConfig, string>> {
	for(const filename of CONFIG_FILENAMES) {
		const candidate = path.join(packageRoot, filename);

		let content: string;

		try {
			content = await readFile(candidate, 'utf8');
		}
		catch (error) {
			if(isNodeError(error) && error.code === 'ENOENT') {
				continue;
			}

			return err(`Failed to read ${filename} from package: ${stringifyError(error)}`);
		}

		const extension = path.extname(filename).toLowerCase();
		const data: unknown = extension === '.json' ? JSON.parse(content) : YAML.parse(content);

		if(!isRecord(data)) {
			return err(`Config file ${filename} must export an object.`);
		}

		return ok({
			labels: typeof data.labels === 'string' ? data.labels : undefined,
			issue: typeof data.issue === 'string' ? data.issue : undefined,
		});
	}

	return err(`Package ${packageName} must include one of ${CONFIG_FILENAMES.join(', ')} at its root.`);
}
