import { readFile } from 'node:fs/promises';
import { err, ok, stringifyError, type Result } from '@zokugun/xtry';
import YAML from 'yaml';
import { type Label } from '../types.js';
import { isRecord } from '../utils/is-record.js';

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

	const labels: Label[] = [];

	for(const [index, record] of records.entries()) {
		if(!isRecord(record)) {
			return err(`Label entry at index ${index} must be an object.`);
		}

		const name = String(record.name ?? '').trim();
		const color = String(record.color ?? '').trim();
		const description = String(record.description ?? '').trim();

		if(name.length === 0) {
			return err(`Label entry at index ${index} must define a non-empty 'name'.`);
		}

		labels.push({ name, color, description });
	}

	return ok(labels);
}
