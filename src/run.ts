import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { Octokit } from '@octokit/rest';
import { enquirer, logger } from '@zokugun/cli-utils';
import clipboardy from 'clipboardy';
import open from 'open';
import { loadCategories } from './categories/load-categories.js';
import { syncCategories } from './categories/sync-categories.js';
import { loadConfig } from './config/load-package-config.js';
import { createDiscussion } from './discussions/create-discussion.js';
import { loadDiscussion } from './discussions/load-discussion.js';
import { loadEnvironments } from './environments/load-environments.js';
import { syncEnvironments } from './environments/sync-environments.js';
import { createIssue } from './issues/create-issue.js';
import { loadIssue } from './issues/load-issue.js';
import { loadLabels } from './labels/load-labels.js';
import { syncLabels } from './labels/sync-labels.js';
import { ensureRepo } from './repos/ensure-repo.js';
import { loadNewRepository } from './repos/load-new-repository.js';
import { loadSettings } from './repos/load-settings.js';
import { loadRulesets } from './rulesets/load-rulesets.js';
import { syncRulesets } from './rulesets/sync-rulesets.js';
import { type Category, type Context, type Discussion, type NewRepository, type CliOptions, type Issue, type Label, type Ruleset, type OrderItem, type ExpectedFeatures, type Environment, type RepositorySettings } from './types.js';
import { configure } from './utils/configure.js';
import { loadResource } from './utils/load-resource.js';

type VerificationPrompt = {
	verification_uri: string;
	user_code: string;
};

export async function run(options: CliOptions): Promise<void> {
	logger.begin();
	logger.progress('Configuring');

	const settings = await configure(options);
	if(settings.fails) {
		return logger.fatal(settings.error);
	}

	logger.progress('Loading');

	let categories: Category[] | undefined;
	let discussion: Discussion | undefined;
	let environments: Environment[] | undefined;
	let issue: Issue | undefined;
	let labels: Label[] | undefined;
	let newRepository: NewRepository | undefined;
	let repoSettings: RepositorySettings | undefined;
	let rulesets: Ruleset[] | undefined;
	let order: OrderItem[] = ['discussion', 'issue'];
	const expectedFeatures: ExpectedFeatures = {};

	const { configPath, keep, migrate, repo, resources } = settings.value;

	if(configPath) {
		const config = await loadConfig(configPath);
		if(config.fails) {
			return logger.fatal(config.error);
		}

		if(config.value.categories && resources.categories) {
			const result = await loadResource(config.value.categories, loadCategories, { cwd: config.value.root });

			if(result.fails) {
				return logger.fatal(result.error);
			}

			categories = result.value;
			expectedFeatures.discussions = true;
		}

		if(config.value.discussion && resources.discussions) {
			const result = await loadResource(config.value.discussion, loadDiscussion, { cwd: config.value.root });

			if(result.fails) {
				return logger.fatal(result.error);
			}

			discussion = result.value;
			expectedFeatures.discussions = true;
		}

		if(config.value.environments && resources.environments) {
			const result = await loadResource(config.value.environments, loadEnvironments, { cwd: config.value.root });

			if(result.fails) {
				return logger.fatal(result.error);
			}

			environments = result.value;
		}

		if(config.value.issue && resources.issues) {
			const result = await loadResource(config.value.issue, loadIssue, { cwd: config.value.root });

			if(result.fails) {
				return logger.fatal(result.error);
			}

			issue = result.value;
			expectedFeatures.issues = true;
		}

		if(config.value.labels && resources.labels) {
			const result = await loadResource(config.value.labels, loadLabels, { cwd: config.value.root });

			if(result.fails) {
				return logger.fatal(result.error);
			}

			labels = result.value;
			expectedFeatures.issues = true;
		}

		if(config.value.newRepository) {
			const result = await loadResource(config.value.newRepository, loadNewRepository, { cwd: config.value.root });

			if(result.fails) {
				return logger.fatal(result.error);
			}

			newRepository = result.value;
		}

		if(config.value.rulesets && resources.rulesets) {
			rulesets = [];

			for(const ruleset of config.value.rulesets) {
				const result = await loadResource(ruleset, loadRulesets, { cwd: config.value.root });

				if(result.fails) {
					return logger.fatal(result.error);
				}

				if(result.success) {
					rulesets.push(...result.value);
				}
			}
		}

		if(config.value.settings) {
			const result = await loadResource(config.value.settings, loadSettings, { cwd: config.value.root });

			if(result.fails) {
				return logger.fatal(result.error);
			}

			repoSettings = result.value;
		}

		if(config.value.order) {
			order = config.value.order;
		}
	}

	if(options.create || resources.settings || (categories ?? environments ?? discussion ?? labels ?? issue ?? rulesets)) {
		const octokit = new Octokit({
			authStrategy: createOAuthDeviceAuth,
			auth: {
				clientId: 'Ov23lilx93wDQB9QOLFW',
				clientType: 'oauth-app',
				scopes: ['repo'],
				async onVerification({ verification_uri, user_code }: VerificationPrompt) {
					logger.pause();

					logger.info(`Authenticate your account at: ${verification_uri}`);

					await enquirer.prompt({
						type: 'invisible',
						name: 'open',
						message: 'Press ENTER to open in the browser...',
					});

					await open(verification_uri);

					await clipboardy.write(user_code);

					logger.info(`Paste code: ${user_code} (copied to your clipboard)`);

					logger.resume();
				},
			},
			log: {
				debug: () => {},
				info: () => {},
				warn: () => {},
				error: () => {},
			},
			userAgent: 'repo-starter-kit',
		});

		const context: Context = { owner: repo.owner, repositoryName: repo.repo, octokit };

		const result = await ensureRepo(context, options.create, newRepository, expectedFeatures, repoSettings);
		if(result.fails) {
			return logger.fatal(result.error);
		}

		if(labels) {
			logger.progress('Syncing labels');

			const result = await syncLabels(context, labels, migrate?.labels, keep);
			if(result) {
				return logger.fatal(result.error);
			}
		}

		if(categories) {
			logger.progress('Syncing categories');

			const result = await syncCategories(context, categories, keep);
			if(result) {
				return logger.fatal(result.error);
			}
		}

		for(const resource of order) {
			if(resource === 'discussion' && discussion) {
				logger.progress('Creating discussion');

				const result = await createDiscussion(context, discussion);
				if(result) {
					return logger.fatal(result.error);
				}
			}
			else if(resource === 'issue' && issue) {
				logger.progress('Creating issue');

				const result = await createIssue(context, issue);
				if(result) {
					return logger.fatal(result.error);
				}
			}
		}

		if(environments) {
			logger.progress('Syncing environments');

			const result = await syncEnvironments(context, environments, keep);
			if(result) {
				return logger.fatal(result.error);
			}
		}

		if(rulesets) {
			logger.progress('Syncing rulesets');

			const result = await syncRulesets(context, rulesets, keep);
			if(result) {
				return logger.fatal(result.error);
			}
		}

		if(context.browser) {
			logger.progress('Closing browser');

			await context.browser.close().catch(() => undefined);
		}

		logger.info(`Repository bootstrap completed for https://github.com/${repo.owner}/${repo.repo}`);
	}
	else {
		logger.info('Nothing to do!');
	}

	logger.finish();
}
