import { isRecord } from '@zokugun/is-it-type';
import { type DResult, err, ok } from '@zokugun/xtry';
import { type Category } from '../types.js';

export function normalizeCategories(records: unknown[]): DResult<Category[]> {
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
