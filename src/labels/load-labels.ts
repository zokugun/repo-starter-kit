import { readFile } from 'node:fs/promises';
import { err, stringifyError, type Result } from '@zokugun/xtry';
import YAML from 'yaml';
import { type Label } from '../types.js';
import { normalizeLabels } from './normalize-labels.js';

export async function loadLabels(filename: string): Promise<Result<Label[], string>> {
	let content: string;

	try {
		content = await readFile(filename, 'utf8');
	}
	catch (error) {
		return err(`Failed to read ${filename} from package: ${stringifyError(error)}`);
	}

	const records: unknown = YAML.parse(content);

	if(!Array.isArray(records)) {
		return err(`Label file ${filename} must contain an array.`);
	}

	return normalizeLabels(records);
}
