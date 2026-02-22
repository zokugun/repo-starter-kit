import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { Octokit } from '@octokit/rest';
import clipboardy from 'clipboardy';
import enquirer from 'enquirer';
import open from 'open';
import { loadCategories } from './categories/load-categories.js';
import { syncCategories } from './categories/sync-categories.js';
import { loadConfig } from './config/load-package-config.js';
import { createDiscussion } from './discussions/create-discussion.js';
import { loadDiscussion } from './discussions/load-discussion.js';
import { createIssue } from './issues/create-issue.js';
import { loadIssue } from './issues/load-issue.js';
import { loadLabels } from './labels/load-labels.js';
import { syncLabels } from './labels/sync-labels.js';
import { ensureRepo } from './repos/ensure-repo.js';
import { loadNewRepository } from './repos/load-new-repository.js';
import { parseRepo } from './repos/parse-repo.js';
import { loadRulesets } from './rulesets/load-rulesets.js';
import { syncRulesets } from './rulesets/sync-rulesets.js';
import { type Category, type Context, type Discussion, type NewRepository, type CliOptions, type Issue, type Label, type Ruleset, type OrderItem } from './types.js';
import { loadResource } from './utils/load-resource.js';
import * as logger from './utils/logger.js';

type VerificationPrompt = {
	verification_uri: string;
	user_code: string;
};

export async function run(options: CliOptions): Promise<void> {
	const start = Date.now();

	logger.progress('Configuring');

	const repo = parseRepo(options.repo);
	if(repo.fails) {
		return logger.error(repo.error);
	}

	logger.progress('Loading');

	let categories: Category[] | undefined;
	let discussion: Discussion | undefined;
	let issue: Issue | undefined;
	let labels: Label[] | undefined;
	let newRepository: NewRepository | undefined;
	let rulesets: Ruleset[] | undefined;
	let order: OrderItem[] = ['discussion', 'issue'];

	const { keep } = options;

	if(options.package) {
		const config = await loadConfig(options.package);
		if(config.fails) {
			return logger.error(config.error);
		}

		if(config.value.categories) {
			const result = await loadResource(config.value.categories, loadCategories, { cwd: config.value.root });

			if(result.fails) {
				return logger.error(result.error);
			}

			categories = result.value;
		}

		if(config.value.discussion) {
			const result = await loadResource(config.value.discussion, loadDiscussion, { cwd: config.value.root });

			if(result.fails) {
				return logger.error(result.error);
			}

			discussion = result.value;
		}

		if(config.value.issue) {
			const result = await loadResource(config.value.issue, loadIssue, { cwd: config.value.root });

			if(result.fails) {
				return logger.error(result.error);
			}

			issue = result.value;
		}

		if(config.value.labels) {
			const result = await loadResource(config.value.labels, loadLabels, { cwd: config.value.root });

			if(result.fails) {
				return logger.error(result.error);
			}

			labels = result.value;
		}

		if(config.value.newRepository) {
			const result = await loadResource(config.value.newRepository, loadNewRepository, { cwd: config.value.root });

			if(result.fails) {
				return logger.error(result.error);
			}

			newRepository = result.value;
		}

		if(config.value.rulesets) {
			rulesets = [];

			for(const ruleset of config.value.rulesets) {
				const result = await loadResource(ruleset, loadRulesets, { cwd: config.value.root });

				if(result.fails) {
					return logger.error(result.error);
				}

				if(result.success) {
					rulesets.push(...result.value);
				}
			}
		}

		if(config.value.order) {
			order = config.value.order;
		}
	}

	if(options.create || (categories ?? discussion ?? labels ?? issue ?? rulesets)) {
		const octokit = new Octokit({
			authStrategy: createOAuthDeviceAuth,
			auth: {
				clientId: 'Ov23lilx93wDQB9QOLFW',
				clientType: 'oauth-app',
				scopes: ['repo'],
				async onVerification({ verification_uri, user_code }: VerificationPrompt) {
					logger.pause();

					logger.log(`Authenticate your account at: ${verification_uri}`);

					await enquirer.prompt({
						type: 'invisible',
						name: 'open',
						message: 'Press ENTER to open in the browser...',
					});

					await open(verification_uri);

					await clipboardy.write(user_code);

					logger.log(`Paste code: ${user_code} (copied to your clipboard)`);

					logger.resume();
				},
			},
			userAgent: 'repo-starter-kit',
		});

		const context: Context = { owner: repo.value.owner, repositoryName: repo.value.repo, octokit };

		const result = await ensureRepo(context, options.create, newRepository);
		if(result.fails) {
			return logger.error(result.error);
		}

		if(labels) {
			logger.progress('Syncing labels');

			const result = await syncLabels(context, labels, keep);
			if(result) {
				return logger.error(result.error);
			}
		}

		if(categories) {
			logger.progress('Syncing categories');

			const result = await syncCategories(context, categories, keep);
			if(result) {
				return logger.error(result.error);
			}
		}

		for(const resource of order) {
			if(resource === 'discussion' && discussion) {
				logger.progress('Creating discussion');

				const result = await createDiscussion(context, discussion);
				if(result) {
					return logger.error(result.error);
				}
			}
			else if(resource === 'issue' && issue) {
				logger.progress('Creating issue');

				const result = await createIssue(context, issue);
				if(result) {
					return logger.error(result.error);
				}
			}
		}

		if(rulesets) {
			logger.progress('Syncing branch rulesets');

			const result = await syncRulesets(context, rulesets, keep);
			if(result) {
				return logger.error(result.error);
			}
		}

		if(context.browser) {
			await context.browser.close().catch(() => undefined);
		}

		logger.log(`Repository bootstrap completed for https://github.com/${repo.value.owner}/${repo.value.repo}`);
	}
	else {
		logger.log('Nothing to do!');
	}

	const duration = Math.ceil((Date.now() - start) / 1000);

	logger.finish(duration);
}
