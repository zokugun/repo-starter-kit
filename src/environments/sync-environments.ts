import logger from '@zokugun/cli-utils/logger';
import { isNumber } from '@zokugun/is-it-type';
import { type AsyncDResult, ok, stringifyError, xtry, type Failure } from '@zokugun/xtry/async';
import { type Reviewer, type Context, type Environment } from '../types.js';

export async function syncEnvironments(context: Context, environments: Environment[], keepExisting = false): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

	if(environments.length === 0) {
		logger.warn('No environments defined; skipping environment sync.');
		return;
	}

	const desiredNames = new Set<string>();

	for(const environment of environments) {
		desiredNames.add(environment.name);

		const existing = await xtry(octokit.rest.repos.getEnvironment({
			owner,
			repo: repositoryName,
			environment_name: environment.name,
		}), stringifyError);

		if(existing.fails) {
			const result = await createEnvironment(environment, context);
			if(result) {
				return result;
			}
		}
		else {
			const result = await updateEnvironment(environment, context);
			if(result) {
				return result;
			}
		}
	}

	if(keepExisting) {
		logger.info('Keeping existing environments that are not in the configuration.');
		return;
	}

	return deleteMissingEnvironments(context, desiredNames);
} // }}}

async function deleteMissingEnvironments(context: Context, desiredNames: Set<string>): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;
	const existingEnvironments = await xtry(octokit.rest.repos.getAllEnvironments({
		owner,
		repo: repositoryName,
	}), stringifyError);

	if(existingEnvironments.fails) {
		return existingEnvironments;
	}

	if(!existingEnvironments.value.data.environments) {
		return;
	}

	for(const existing of existingEnvironments.value.data.environments) {
		if(!desiredNames.has(existing.name)) {
			try {
				await octokit.rest.repos.deleteAnEnvironment({ owner, repo: repositoryName, environment_name: existing.name });

				logger.info(`Deleted environment: ${existing.name}`);
			}
			catch (error) {
				logger.warn(`Failed to delete environment '${existing.name}': ${stringifyError(error)}`);
			}
		}
	}
} // }}}

async function createEnvironment(environment: Environment, context: Context): Promise<Failure<string> | undefined> { // {{{
	const reviewers = await getReviewers(environment.reviewers, context);
	if(reviewers.fails) {
		return reviewers;
	}

	const result = await xtry(context.octokit.rest.repos.createOrUpdateEnvironment({
		owner: context.owner,
		repo: context.repositoryName,
		environment_name: environment.name,
		can_admins_bypass: environment.canAdminsBypass,
		prevent_self_review: environment.preventSelfReview,
		reviewers: reviewers.value,
		deployment_branch_policy: {
			protected_branches: environment.protectedBranches,
			custom_branch_policies: environment.branchPolicies.length > 0,
		},
	}), stringifyError);

	if(result.fails) {
		return result;
	}

	for(const { name, type } of environment.branchPolicies) {
		const result = await xtry(context.octokit.rest.repos.createDeploymentBranchPolicy({
			owner: context.owner,
			repo: context.repositoryName,
			environment_name: environment.name,
			type,
			name,
		}), stringifyError);

		if(result.fails) {
			return result;
		}
	}

	logger.info(`Created environment: ${environment.name}`);
} // }}}

async function updateEnvironment(environment: Environment, context: Context): Promise<Failure<string> | undefined> { // {{{
	const reviewers = await getReviewers(environment.reviewers, context);
	if(reviewers.fails) {
		return reviewers;
	}

	const result = await xtry(context.octokit.rest.repos.createOrUpdateEnvironment({
		owner: context.owner,
		repo: context.repositoryName,
		environment_name: environment.name,
		can_admins_bypass: environment.canAdminsBypass,
		prevent_self_review: environment.preventSelfReview,
		reviewers: reviewers.value,
		deployment_branch_policy: {
			protected_branches: environment.protectedBranches,
			custom_branch_policies: environment.branchPolicies.length > 0,
		},
	}), stringifyError);

	if(result.fails) {
		return result;
	}

	const listResult = await xtry(context.octokit.rest.repos.listDeploymentBranchPolicies({
		owner: context.owner,
		repo: context.repositoryName,
		environment_name: environment.name,
	}), stringifyError);

	if(listResult.fails) {
		return listResult;
	}

	const existing = new Map<string, number>();

	for(const { type, name, id } of listResult.value.data.branch_policies) {
		existing.set(`${type}: ${name}`, id!);
	}

	for(const { name, type } of environment.branchPolicies) {
		const hash = `${type}: ${name}`;

		if(existing.has(hash)) {
			existing.delete(hash);
		}
		else {
			const result = await xtry(context.octokit.rest.repos.createDeploymentBranchPolicy({
				owner: context.owner,
				repo: context.repositoryName,
				environment_name: environment.name,
				type,
				name,
			}), stringifyError);

			if(result.fails) {
				return result;
			}
		}
	}

	for(const id of existing.values()) {
		const result = await xtry(context.octokit.rest.repos.deleteDeploymentBranchPolicy({
			owner: context.owner,
			repo: context.repositoryName,
			environment_name: environment.name,
			branch_policy_id: id,
		}), stringifyError);

		if(result.fails) {
			return result;
		}
	}

	logger.info(`Updated environment: ${environment.name}`);
} // }}}

async function getReviewers(reviewers: Reviewer[], context: Context): AsyncDResult<Array<{ type: 'User' | 'Team'; id: number }>> { // {{{
	const result: Array<{ type: 'User' | 'Team'; id: number }> = [];

	for(const reviewer of reviewers) {
		const type = reviewer.type === 'team' ? 'Team' : 'User';

		if(isNumber(reviewer.id)) {
			result.push({ type, id: reviewer.id });
		}
		else {
			if(reviewer.id === 'self') {
				const user = await xtry(context.octokit.rest.users.getAuthenticated(), stringifyError);

				if(user.fails) {
					return user;
				}

				result.push({ type, id: user.value.data.id });
			}
			else {
				const user = await xtry(context.octokit.rest.users.getByUsername({ username: reviewer.id }), stringifyError);

				if(user.fails) {
					return user;
				}

				result.push({ type, id: user.value.data.id });
			}
		}
	}

	return ok(result);
} // }}}
