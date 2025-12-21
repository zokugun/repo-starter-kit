import { err, ok, type Result } from '@zokugun/xtry';
import { type RepoReference } from '../types.js';

export function parseRepo(input: string): Result<RepoReference, string> {
	const [owner, repo] = input.split('/');

	if(!owner || !repo) {
		return err('Repository must use OWNER/NAME format.');
	}

	return ok({ owner, repo });
}
