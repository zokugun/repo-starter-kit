import { type Octokit } from '@octokit/rest';
import { err, ok, type Result, stringifyError } from '@zokugun/xtry';
import { type RepoReference } from '../types.js';
import { isRecord } from '../utils/is-record.js';

export async function existsRepo(octokit: Octokit, { owner, repo }: RepoReference): Promise<Result<boolean, string>> {
	try {
		await octokit.repos.get({ owner, repo });

		return ok(true);
	}
	catch (error) {
		if(isRecord(error) && 'status' in error && (error as any).status === 404) {
			return ok(false);
		}

		return err(stringifyError(error));
	}
}
