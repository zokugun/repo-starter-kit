import { readFile } from 'node:fs/promises';
import { err, stringifyError, type Result } from '@zokugun/xtry';
import YAML from 'yaml';
import { type Category } from '../types.js';
import { normalizeCategories } from './normalize-categories.js';

export async function loadCategories(filename: string): Promise<Result<Category[], string>> {
	let content: string;

	try {
		content = await readFile(filename, 'utf8');
	}
	catch (error) {
		return err(`Failed to read ${filename} from package: ${stringifyError(error)}`);
	}

	const records: unknown = YAML.parse(content);

	if(!Array.isArray(records)) {
		return err(`Category file ${filename} must contain an array.`);
	}

	return normalizeCategories(records);
}
