import { type OctokitResponse } from '@octokit/types';
import logger from '@zokugun/cli-utils/logger';
import { isError } from '@zokugun/is-it-type';
import { type Result, ok, err, stringifyError } from '@zokugun/xtry';
import { type ExpectedFeatures, type Context, type NewRepository } from '../types.js';

export async function ensureRepo(context: Context, shouldCreate: boolean, newRepository: NewRepository | undefined, expectedFeatures: ExpectedFeatures): Promise<Result<void, string>> {
	const { octokit, owner, repositoryName } = context;

	try {
		const response = await octokit.rest.repos.get({ owner, repo: repositoryName });

		context.repositoryId = response.data.node_id;

		const features: { has_discussions?: boolean; has_issues?: boolean;has_projects?: boolean;has_wiki?: boolean } = {};

		if(expectedFeatures.discussions) {
			features.has_discussions = true;
		}

		if(expectedFeatures.issues) {
			features.has_issues = true;
		}

		await octokit.rest.repos.update({
			owner,
			repo: repositoryName,
			...features,
		});

		return ok();
	}
	catch (error) {
		if(isError(error) && 'status' in error && error.status === 404) {
			if(shouldCreate) {
				return createRepository(context, newRepository, expectedFeatures);
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

async function createRepository(context: Context, newRepository: NewRepository | undefined, expectedFeatures: ExpectedFeatures): Promise<Result<void, string>> {
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

	if(expectedFeatures.discussions) {
		features.has_discussions = true;
	}

	if(expectedFeatures.issues) {
		features.has_issues = true;
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
