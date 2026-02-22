import { type Octokit } from '@octokit/rest';
import { isError } from '@zokugun/is-it-type';
import { err, ok, type Result, stringifyError } from '@zokugun/xtry';
import { type RepoReference } from '../types.js';

export async function existsRepo(octokit: Octokit, { owner, repo }: RepoReference): Promise<Result<boolean, string>> {
	try {
		await octokit.repos.get({ owner, repo });

		return ok(true);
	}
	catch (error) {
		if(isError(error) && 'status' in error && error.status === 404) {
			return ok(false);
		}

		return err(stringifyError(error));
	}
}
