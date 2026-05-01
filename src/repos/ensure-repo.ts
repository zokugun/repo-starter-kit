import { type OctokitResponse } from '@octokit/types';
import logger from '@zokugun/cli-utils/logger';
import { isEmptyRecord, isError, isNumber, isUndefined } from '@zokugun/is-it-type';
import { ok, err, stringifyError, type AsyncDResult } from '@zokugun/xtry';
import { xtry } from '@zokugun/xtry/async';
import { type ExpectedFeatures, type Context, type NewRepository, type RepositorySettings } from '../types.js';
import { openPage } from '../utils/open-page.js';

export async function ensureRepo(context: Context, shouldCreate: boolean, newRepository: NewRepository | undefined, expectedFeatures: ExpectedFeatures, settings?: RepositorySettings): AsyncDResult { // {{{
	const { octokit, owner, repositoryName } = context;

	try {
		const response = await octokit.rest.repos.get({ owner, repo: repositoryName });

		context.repositoryId = response.data.node_id;

		const features: { has_discussions?: boolean; has_issues?: boolean; has_projects?: boolean; has_wiki?: boolean } = {};

		if(expectedFeatures.discussions) {
			features.has_discussions = true;
		}

		if(expectedFeatures.issues) {
			features.has_issues = true;
		}

		if(isEmptyRecord(features)) {
			if(settings) {
				return updateSettings(context, settings);
			}

			return ok();
		}

		await octokit.rest.repos.update({
			owner,
			repo: repositoryName,
			...features,
		});

		logger.info('Updated repository');
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

	if(settings) {
		return updateSettings(context, settings);
	}

	return ok();
} // }}}

async function createRepository(context: Context, newRepository: NewRepository | undefined, expectedFeatures: ExpectedFeatures): AsyncDResult { // {{{
	const { octokit, owner, repositoryName } = context;
	const { data: viewer } = await octokit.rest.users.getAuthenticated();
	const isUserRepo = viewer.login.toLowerCase() === owner.toLowerCase();

	logger.showProgress(`Creating repository ${owner}/${repositoryName}`);

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
				private: newRepository?.private ?? false,
				...features,
			});
		}
		else {
			response = await octokit.rest.repos.createInOrg({
				org: owner,
				name: repositoryName,
				private: newRepository?.private ?? false,
				...features,
			});
		}

		context.repositoryId = response.data.node_id;

		logger.info(`Created repository ${owner}/${repositoryName}`);

		return ok();
	}
	catch (error) {
		const message = stringifyError(error);

		return err(`Failed to create repository ${owner}/${repositoryName}: ${message}`);
	}
} // }}}

async function updateSettings(context: Context, settings: RepositorySettings): AsyncDResult { // {{{
	const { octokit, owner, repositoryName } = context;

	const immutableReleases = await xtry(octokit.rest.repos.checkImmutableReleases({
		owner,
		repo: repositoryName,
	}), stringifyError);

	if(immutableReleases.fails) {
		return immutableReleases;
	}

	if(immutableReleases.value.data.enabled) {
		if(!settings.immutableReleases) {
			const result = await xtry(octokit.rest.repos.disableImmutableReleases({
				owner,
				repo: repositoryName,
			}), stringifyError);

			if(result.fails) {
				return result;
			}
		}
	}
	else {
		if(settings.immutableReleases) {
			const result = await xtry(octokit.rest.repos.enableImmutableReleases({
				owner,
				repo: repositoryName,
			}), stringifyError);

			if(result.fails) {
				return result;
			}
		}
	}

	const vulnerabilityAlerts = await xtry(octokit.rest.repos.checkVulnerabilityAlerts({
		owner,
		repo: repositoryName,
	}));

	if(vulnerabilityAlerts.value?.status === 204) {
		if(!settings.vulnerabilityAlerts) {
			const result = await xtry(octokit.rest.repos.disableVulnerabilityAlerts({
				owner,
				repo: repositoryName,
			}), stringifyError);

			if(result.fails) {
				return result;
			}
		}
	}
	else {
		if(settings.vulnerabilityAlerts) {
			const result = await xtry(octokit.rest.repos.enableVulnerabilityAlerts({
				owner,
				repo: repositoryName,
			}), stringifyError);

			if(result.fails) {
				return result;
			}
		}
	}

	const automatedSecurityFixes = await xtry(octokit.rest.repos.checkAutomatedSecurityFixes({
		owner,
		repo: repositoryName,
	}), stringifyError);

	if(automatedSecurityFixes.fails) {
		return automatedSecurityFixes;
	}

	if(automatedSecurityFixes.value.data.enabled) {
		if(!settings.automatedSecurityFixes) {
			const result = await xtry(octokit.rest.repos.disableAutomatedSecurityFixes({
				owner,
				repo: repositoryName,
			}), stringifyError);

			if(result.fails) {
				return result;
			}
		}
	}
	else {
		if(settings.automatedSecurityFixes) {
			const result = await xtry(octokit.rest.repos.enableAutomatedSecurityFixes({
				owner,
				repo: repositoryName,
			}), stringifyError);

			if(result.fails) {
				return result;
			}
		}
	}

	const openResult = await openPage(context);
	if(openResult.fails) {
		return openResult;
	}

	const page = openResult.value;

	await page.goto(`https://github.com/${context.owner}/${context.repositoryName}/settings`, {
		waitUntil: 'domcontentloaded',
	});

	await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);

	const autoCloseIssues = page.locator('input[type=checkbox][name=auto_close_issues]').first();

	if(await autoCloseIssues.isChecked()) {
		if(settings.autoCloseIssues === false) {
			await autoCloseIssues.uncheck();

			await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);
		}
	}
	else {
		if(settings.autoCloseIssues !== false) {
			await autoCloseIssues.check();

			await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);
		}
	}

	const maxPushes = page.locator('input[type=checkbox][name=enable_max_pushes]').first();

	if(await maxPushes.isChecked()) {
		if(isUndefined(settings.maxUpdatesPerPush)) {
			await maxPushes.uncheck();

			await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);
		}
		else {
			const input = page.locator('#max_pushes_count_text_field').first();

			await input.fill(`${settings.maxUpdatesPerPush}`);

			await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);

			await input.press('Enter');

			await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);
		}
	}
	else {
		if(isNumber(settings.maxUpdatesPerPush)) {
			await maxPushes.check();

			await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);

			const input = page.locator('#max_pushes_count_text_field').first();

			await input.fill(`${settings.maxUpdatesPerPush}`);

			await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);

			await input.press('Enter');

			await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);
		}
	}

	logger.info('Updated settings');

	return ok();
} // }}}
