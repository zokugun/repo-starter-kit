import { readFile } from 'node:fs/promises';
import { err, ok, stringifyError, type Result } from '@zokugun/xtry';
import matter from 'gray-matter';
import { type Issue } from '../types.js';

export async function loadIssue(filename: string): Promise<Result<Issue, string>> {
	let content: string;

	try {
		content = await readFile(filename, 'utf8');
	}
	catch (error) {
		return err(`Failed to read ${filename} from package: ${stringifyError(error)}`);
	}

	const parsed = matter(content);

	const title = typeof parsed.data.title === 'string' ? parsed.data.title.trim() : '';

	const rawLabels = Array.isArray(parsed.data.labels) ? parsed.data.labels : [];
	const labels = rawLabels.map((label: unknown) => String(label).trim()).filter((label) => label.length > 0);

	const body = parsed.content;

	return ok({ title, body, labels });
}
