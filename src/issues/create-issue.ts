import { type Octokit } from '@octokit/rest';
import { err, type Failure, stringifyError } from '@zokugun/xtry';
import { type Issue, type RepoReference } from '../types.js';
import * as logger from '../utils/logger.js';

export async function createIssue(octokit: Octokit, repo: RepoReference, { title, body, labels }: Issue): Promise<Failure<string> | undefined> {
	try {
		const response = await octokit.rest.issues.create({
			...repo,
			title,
			body,
			labels,
		});

		const issueNumber = response.data.number;

		await octokit.rest.issues.lock({
			...repo,
			issue_number: issueNumber,
		});

		logger.log(`Created issue '${title}'.`);
	}
	catch (error) {
		return err(stringifyError(error));
	}
}
