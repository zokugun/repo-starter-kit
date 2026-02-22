import { readFile } from 'node:fs/promises';
import { isRecord } from '@zokugun/is-it-type';
import { err, ok, stringifyError, type Result } from '@zokugun/xtry';
import YAML from 'yaml';
import { type Category } from '../types.js';

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

	const categories: Category[] = [];

	for(const [index, record] of records.entries()) {
		if(!isRecord(record)) {
			return err(`Category entry at index ${index} must be an object.`);
		}

		const name = String(record.name ?? '').trim();
		const description = String(record.description ?? '').trim();
		const emoji = String(record.emoji ?? '').trim();
		const format = record.format === 'announcement' || record.format === 'answer' || record.format === 'poll' ? record.format : 'open';

		if(name.length === 0) {
			return err(`Category entry at index ${index} must define a non-empty 'name'.`);
		}

		categories.push({ name, description, emoji, format });
	}

	return ok(categories);
}
