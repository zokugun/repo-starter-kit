import { type Octokit } from '@octokit/rest';
import { type Result, ok, err, stringifyError } from '@zokugun/xtry';
import { type RepoReference } from '../types.js';
import { isRecord } from '../utils/is-record.js';
import * as logger from '../utils/logger.js';

export async function ensureRepo(octokit: Octokit, { owner, repo }: RepoReference, shouldCreate: boolean): Promise<Result<void, string>> {
	try {
		await octokit.rest.repos.get({ owner, repo });

		return ok();
	}
	catch (error) {
		if(isRecord(error) && 'status' in error && (error as any).status === 404) {
			if(shouldCreate) {
				return createRepository(octokit, owner, repo);
			}
			else {
				return err(`Repository ${owner}/${repo} not found. Pass --create to create it automatically.`);
			}
		}
		else {
			return err(stringifyError(error));
		}
	}
}

async function createRepository(octokit: Octokit, owner: string, repo: string): Promise<Result<void, string>> {
	const { data: viewer } = await octokit.rest.users.getAuthenticated();
	const isUserRepo = viewer.login.toLowerCase() === owner.toLowerCase();

	logger.progress(`Creating repository ${owner}/${repo}`);

	try {
		if(isUserRepo) {
			await octokit.rest.repos.createForAuthenticatedUser({ name: repo });
		}
		else {
			await octokit.rest.repos.createInOrg({ org: owner, name: repo });
		}

		return ok();
	}
	catch (error) {
		const message = stringifyError(error);

		return err(`Failed to create repository ${owner}/${repo}: ${message}`);
	}
}
