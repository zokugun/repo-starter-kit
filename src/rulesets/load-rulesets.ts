import { readFile } from 'node:fs/promises';
import { err, ok, stringifyError, type Result } from '@zokugun/xtry';
import YAML from 'yaml';
import { type Ruleset } from '../types.js';
import { isRecord } from '../utils/is-record.js';

export async function loadRulesets(filename: string): Promise<Result<Ruleset[], string>> {
	let content: string;

	try {
		content = await readFile(filename, 'utf8');
	}
	catch (error) {
		return err(`Failed to read ${filename} from package: ${stringifyError(error)}`);
	}

	let records: unknown;

	try {
		records = YAML.parse(content);
	}
	catch (error) {
		return err(`Failed to parse rulesets file ${filename}: ${stringifyError(error)}`);
	}

	if(!Array.isArray(records)) {
		return err(`Rulesets file ${filename} must contain an array.`);
	}

	const rulesets: Ruleset[] = [];

	for(const [index, record] of records.entries()) {
		if(!isRecord(record)) {
			return err(`Ruleset entry at index ${index} must be an object.`);
		}

		const name = typeof record.name === 'string' ? record.name.trim() : '';

		if(name.length === 0) {
			return err(`Ruleset entry at index ${index} must define a non-empty 'name'.`);
		}

		rulesets.push({ ...record, name });
	}

	return ok(rulesets);
}
