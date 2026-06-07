import { isRecord } from '@zokugun/is-it-type';
import { type DResult, err, ok } from '@zokugun/xtry';
import { type Label } from '../types.js';

export function normalizeLabels(records: unknown[]): DResult<Label[]> {
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
