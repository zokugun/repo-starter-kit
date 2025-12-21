import path from 'node:path';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { Octokit } from '@octokit/rest';
import clipboardy from 'clipboardy';
import enquirer from 'enquirer';
import open from 'open';
import { loadPackageConfig } from './config/load-package-config.js';
import { createIssue } from './issues/create-issue.js';
import { loadIssue } from './issues/load-issue.js';
import { loadLabels } from './labels/load-labels.js';
import { syncLabels } from './labels/sync-labels.js';
import { existsRepo } from './repos/exists-repo.js';
import { parseRepo } from './repos/parse-repo.js';
import { type CliOptions, type Issue, type Label } from './types.js';
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

	let labelsPath = options.labels ? path.resolve(options.labels) : undefined;
	let issuePath = options.issue ? path.resolve(options.issue) : undefined;

	logger.progress('Loading');

	if(options.package) {
		const packagePaths = await loadPackageConfig(options.package);
		if(packagePaths.fails) {
			return logger.error(packagePaths.error);
		}

		labelsPath ??= packagePaths.value.labelsPath;
		issuePath ??= packagePaths.value.issuePath;
	}

	let labels: Label[] | undefined;
	let issue: Issue | undefined;

	if(labelsPath) {
		const result = await loadLabels(labelsPath);
		if(result.fails) {
			return logger.error(result.error);
		}

		labels = result.value;
	}

	if(issuePath) {
		const result = await loadIssue(issuePath);
		if(result.fails) {
			return logger.error(result.error);
		}

		issue = result.value;
	}

	if(labels ?? issue) {
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

		logger.log(`Repository bootstrap completed for ${repo.value.owner}/${repo.value.repo}`);
	}
	else {
		logger.log('Nothing to do!');
	}

	const duration = Math.ceil((Date.now() - start) / 1000);

	logger.finish(duration);
}
