import { type OctokitResponse } from '@octokit/types';
import { isError } from '@zokugun/is-it-type';
import { type Result, ok, err, stringifyError } from '@zokugun/xtry';
import { type Context, type NewRepository } from '../types.js';
import * as logger from '../utils/logger.js';

export async function ensureRepo(context: Context, shouldCreate: boolean, newRepository?: NewRepository): Promise<Result<void, string>> {
	const { octokit, owner, repositoryName } = context;

	try {
		const response = await octokit.rest.repos.get({ owner, repo: repositoryName });

		context.repositoryId = response.data.node_id;

		return ok();
	}
	catch (error) {
		if(isError(error) && 'status' in error && error.status === 404) {
			if(shouldCreate) {
				return createRepository(context, newRepository);
			}
			else {
				return err(`Repository ${owner}/${repositoryName} not found. Pass --create to create it automatically.`);
			}
		}
		else {
			return err(stringifyError(error));
		}
	}
}

async function createRepository(context: Context, newRepository?: NewRepository): Promise<Result<void, string>> {
	const { octokit, owner, repositoryName } = context;
	const { data: viewer } = await octokit.rest.users.getAuthenticated();
	const isUserRepo = viewer.login.toLowerCase() === owner.toLowerCase();

	logger.progress(`Creating repository ${owner}/${repositoryName}`);

	const features: { has_discussions?: boolean; has_issues?: boolean;has_projects?: boolean;has_wiki?: boolean } = {};

	if(newRepository) {
		features.has_discussions = newRepository.features.discussions;
		features.has_issues = newRepository?.features.issues;
		features.has_projects = newRepository?.features.projects;
		features.has_wiki = newRepository?.features.wiki;
	}

	try {
		let response: OctokitResponse<{ node_id: string }>;

		if(isUserRepo) {
			response = await octokit.rest.repos.createForAuthenticatedUser({
				name: repositoryName,
				...features,
			});
		}
		else {
			response = await octokit.rest.repos.createInOrg({
				org: owner,
				name: repositoryName,
				...features,
			});
		}

		context.repositoryId = response.data.node_id;

		return ok();
	}
	catch (error) {
		const message = stringifyError(error);

		return err(`Failed to create repository ${owner}/${repositoryName}: ${message}`);
	}
}
