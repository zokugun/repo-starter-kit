import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { Octokit } from '@octokit/rest';
import clipboardy from 'clipboardy';
import enquirer from 'enquirer';
import open from 'open';
import { loadConfig } from './config/load-package-config.js';
import { createIssue } from './issues/create-issue.js';
import { loadIssue } from './issues/load-issue.js';
import { loadLabels } from './labels/load-labels.js';
import { syncLabels } from './labels/sync-labels.js';
import { existsRepo } from './repos/exists-repo.js';
import { parseRepo } from './repos/parse-repo.js';
import { loadRulesets } from './rulesets/load-rulesets.js';
import { syncRulesets } from './rulesets/sync-rulesets.js';
import { type CliOptions, type Issue, type Label, type Ruleset } from './types.js';
import { loadResource } from './utils/load-resource.js';
import * as logger from './utils/logger.js';

type VerificationPrompt = {
	verification_uri: string;
	user_code: string;
};

export async function run(options: CliOptions) {
	const start = Date.now();

	logger.progress('Configuring');

	const repo = parseRepo(options.repo);
	if(repo.fails) {
		return logger.error(repo.error);
	}

	logger.progress('Loading');

	let labels: Label[] | undefined;
	let issue: Issue | undefined;
	let rulesets: Ruleset[] | undefined;

	if(options.labels) {
		const result = await loadResource(options.labels, loadLabels);

		if(result.fails) {
			return logger.error(result.error);
		}

		labels = result.value;
	}

	if(options.issue) {
		const result = await loadResource(options.issue, loadIssue);

		if(result.fails) {
			return logger.error(result.error);
		}

		issue = result.value;
	}

	if(options.rulesets) {
		const result = await loadResource(options.rulesets, loadRulesets);
		if(result.fails) {
			return logger.error(result.error);
		}

		rulesets = result.value;
	}

	if(!labels && !issue && !rulesets && options.package) {
		const config = await loadConfig(options.package);
		if(config.fails) {
			return logger.error(config.error);
		}

		if(!labels && config.value.labels) {
			const result = await loadResource(config.value.labels, loadLabels, { cwd: config.value.root });

			if(result.fails) {
				return logger.error(result.error);
			}

			labels = result.value;
		}

		if(!issue && config.value.issue) {
			const result = await loadResource(config.value.issue, loadIssue, { cwd: config.value.root });

			if(result.fails) {
				return logger.error(result.error);
			}

			issue = result.value;
		}

		if(!rulesets && config.value.rulesets) {
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
	}

	if(labels ?? issue ?? rulesets) {
		const octokit = new Octokit({
			authStrategy: createOAuthDeviceAuth,
			auth: {
				clientId: 'Ov23lilx93wDQB9QOLFW',
				clientType: 'oauth-app',
				scopes: ['repo'],
				async onVerification({ verification_uri, user_code }: VerificationPrompt) {
					logger.log('Authenticate your account at:');
					logger.log(verification_uri);
					logger.log('Press ENTER to open in the browser...');

					await enquirer.prompt({
						type: 'invisible',
						name: 'open',
						message: '',
					});

					await open(verification_uri);

					await clipboardy.write(user_code);

					logger.log(`Paste code: ${user_code} (copied to your clipboard)`);
				},
			},
			userAgent: 'repo-starter-kit',
		});

		const exists = await existsRepo(octokit, repo.value);
		if(exists.fails) {
			return logger.error(exists.error);
		}
		else if(!exists.value) {
			return logger.error(`The repository ${repo.value.owner}/${repo.value.repo} can't be found!`);
		}

		if(labels) {
			logger.progress('Syncing labels');

			const result = await syncLabels(octokit, repo.value, labels, options.keepLabels);
			if(result) {
				return logger.error(result.error);
			}
		}

		if(issue) {
			logger.progress('Creating issue');

			const result = await createIssue(octokit, repo.value, issue);
			if(result) {
				return logger.error(result.error);
			}
		}

		if(rulesets) {
			logger.progress('Syncing branch rulesets');

			const result = await syncRulesets(octokit, repo.value, rulesets, options.keepRulesets);
			if(result) {
				return logger.error(result.error);
			}
		}

		logger.log(`Repository bootstrap completed for ${repo.value.owner}/${repo.value.repo}`);
	}
	else {
		logger.log('Nothing to do!');
	}

	const duration = Math.ceil((Date.now() - start) / 1000);

	logger.finish(duration);
}
