import logger from '@zokugun/cli-utils/logger';
import { type AsyncDResult, OK, stringifyError, xtry } from '@zokugun/xtry/async';
import { type Context, type Issue } from '../types.js';
import { closeIssue } from './close-issue.js';
import { lockIssue } from './lock-issue.js';
import { pinIssue } from './pin-issue.js';

export async function createIssue(context: Context, { title, body, labels, close, pin, lock }: Issue): AsyncDResult {
	const { octokit, owner, repositoryName } = context;

	const result = await xtry(octokit.rest.issues.create({
		owner,
		repo: repositoryName,
		title,
		body,
		labels,
	}), stringifyError);

	if(result.fails) {
		return result;
	}

	const issueNumber = result.value.data.number;
	const issueId = result.value.data.node_id;

	if(close) {
		const result = await closeIssue(context, issueId, title, close);
		if(result.fails) {
			return result;
		}
	}

	if(lock) {
		const result = await lockIssue(context, issueId, title);
		if(result.fails) {
			return result;
		}
	}

	if(pin) {
		const result = await pinIssue(context, issueId, title);
		if(result.fails) {
			return result;
		}
	}

	logger.info(`Created issue '${title}' (#${issueNumber}).`);

	return OK;
}
