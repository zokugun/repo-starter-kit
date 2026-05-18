import path from 'node:path';
import fse from '@zokugun/fs-extra-plus/async';
import { isNonEmptyRecord } from '@zokugun/is-it-type';
import { type AsyncDResult, type DResult, err, OK_NULL, stringifyError, xtry, yerr, yok, type YResult } from '@zokugun/xtry';
import YAML from 'yaml';
import { type ProjectConfig } from '../types.js';

const CONFIG_FILES: Array<{ name: string; type?: 'yaml' | 'json' }> = [
	{
		name: path.join('.github', 'repo-starter-kit.yml'),
		type: 'yaml',
	},
	{
		name: path.join('.github', 'repo-starter-kit.yaml'),
		type: 'yaml',
	},
	{
		name: path.join('.github', 'repo-starter-kit.json'),
		type: 'json',
	},
	{
		name: path.join('.github', 'repo-starter-kit'),
	},
];

export async function loadProject(root: string): AsyncDResult<ProjectConfig | null> {
	for(const { name, type } of CONFIG_FILES) {
		const filename = path.join(root, name);
		const result = await tryReadConfigFile(filename, root, name, type);

		if(result.fails || result.success) {
			return result;
		}
	}

	return OK_NULL;
}

async function tryReadConfigFile(filename: string, root: string, file: string, type?: 'yaml' | 'json'): Promise<YResult<ProjectConfig, string, 'not-found'>> { // {{{
	const { fails, error, value: content } = await fse.readFile(filename, 'utf8');

	if(fails) {
		if(error.code === 'ENOENT') {
			return yerr('not-found');
		}

		return err(`Failed to read ${file}: ${stringifyError(error)}`);
	}
	else {
		const parsed = parseConfigContent(content, type);

		if(parsed.fails) {
			return err(`Failed to parse ${file}: ${parsed.error}`);
		}

		if(isNonEmptyRecord(parsed.value)) {
			return yok({
				file,
				settings: parsed.value,
			});
		}

		return err(`Config file ${file} must export an object.`);
	}
} // }}}

function parseConfigContent(content: string, type?: 'json' | 'yaml'): DResult<unknown> { // {{{
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
