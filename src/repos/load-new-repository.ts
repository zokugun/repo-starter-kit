import { readFile } from 'node:fs/promises';
import { isBoolean, isRecord } from '@zokugun/is-it-type';
import { err, ok, stringifyError, type Result } from '@zokugun/xtry';
import YAML from 'yaml';
import { type NewRepository } from '../types.js';

export async function loadNewRepository(filename: string): Promise<Result<NewRepository, string>> {
	let content: string;

	try {
		content = await readFile(filename, 'utf8');
	}
	catch (error) {
		return err(`Failed to read ${filename} from package: ${stringifyError(error)}`);
	}

	const data: unknown = YAML.parse(content);

	if(!isRecord(data)) {
		return err(`newRepository file ${filename} must contain a record.`);
	}

	const features = {
		discussions: false,
		issues: true,
		projects: true,
		wiki: true,
	};

	if(isRecord(data.features)) {
		for(const name of ['discussions', 'issues', 'projects', 'wiki']) {
			if(isBoolean(data.features[name])) {
				features[name] = data.features[name];
			}
		}
	}

	return ok({ features });
}
