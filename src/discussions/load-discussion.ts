import { readFile } from 'node:fs/promises';
import { isArray, isBoolean, isEquals, isNonBlankString } from '@zokugun/is-it-type';
import { err, ok, stringifyError, type Result } from '@zokugun/xtry';
import matter from 'gray-matter';
import { type Discussion } from '../types.js';

export async function loadDiscussion(filename: string): Promise<Result<Discussion, string>> {
	let content: string;

	try {
		content = await readFile(filename, 'utf8');
	}
	catch (error) {
		return err(`Failed to read ${filename} from package: ${stringifyError(error)}`);
	}

	const parsed = matter(content);

	const title = isNonBlankString<string>(parsed.data.title) ? parsed.data.title.trim() : '';
	const category = isNonBlankString<string>(parsed.data.category) ? parsed.data.category.trim() : '';

	if(title.length === 0) {
		return err(`Missing title in ${filename}`);
	}

	if(category.length === 0) {
		return err(`Missing category in ${filename}`);
	}

	const rawLabels = isArray(parsed.data.labels) ? parsed.data.labels : [];
	const labels = rawLabels.map((label) => String(label).trim()).filter((label) => label.length > 0);
	const close = isEquals(parsed.data.close, 'resolved', 'outdated') ? parsed.data.close : undefined;
	const pin = isBoolean(parsed.data.pin) ? parsed.data.pin : undefined;
	const lock = isBoolean(parsed.data.lock) ? parsed.data.lock : undefined;

	const body = parsed.content;

	return ok({ title, body, category, labels, close, pin, lock });
}
