import { logger } from '@zokugun/cli-utils';
import { type AsyncDResult, OK, stringifyError, xtry } from '@zokugun/xtry/async';
import { type Context, type Issue } from '../types.js';
import { closeIssue } from './close-issue.js';
import { createIssue } from './create-issue.js';
import { lockIssue } from './lock-issue.js';
import { pinIssue } from './pin-issue.js';

type QueryNode = {
	id: string;
	number: string;
	title: string;
	body: string;
	closed: boolean;
	locked: boolean;
	labels: {
		edges: [{
			node: {
				id: string;
				name: string;
			};
		}];
	};
};
type QueryResponse = {
	search: {
		discussionCount: number;
		edges: [{
			node: QueryNode;
		}];
	};
};

export async function syncIssue(context: Context, issue: Issue): AsyncDResult {
	const { octokit, owner, repositoryName } = context;

	const result = await xtry(octokit.graphql(
		`query SearchIssues() {
			search(query: "${issue.title} repo:${owner}/${repositoryName} in:title", type: ISSUE, first: 100) {
				edges {
					node {
						... on Issue {
							id
							number
							title
							body
							closed
							locked

							labels(first: 25) {
								edges {
									node {
										id
										name
									}
								}
							}
						}
					}
				}
			}
		}`,
	), stringifyError);

	if(result.fails) {
		return result;
	}

	const response = result.value as QueryResponse;

	let queryResult: QueryNode | undefined;

	for(const edge of response.search.edges) {
		if(edge.node.title === issue.title) {
			queryResult = edge.node;

			break;
		}
	}

	if(queryResult) {
		return updateIssue(context, issue, queryResult);
	}
	else {
		return createIssue(context, issue);
	}
}

export async function updateIssue(context: Context, expecting: Issue, existing: QueryNode): AsyncDResult {
	const { octokit, owner, repositoryName } = context;

	if(expecting.body !== existing.body) {
		logger.info(`Updating issue '${expecting.title}'`);

		const result = await xtry(octokit.rest.issues.update({
			owner,
			repo: repositoryName,
			issue_number: Number(existing.number),
			body: expecting.body,
			labels: expecting.labels,
		}), stringifyError);

		if(result.fails) {
			return result;
		}
	}

	if(expecting.close && !existing.closed) {
		const result = await closeIssue(context, existing.id, existing.title, expecting.close);
		if(result.fails) {
			return result;
		}
	}

	if(expecting.lock && !existing.locked) {
		const result = await lockIssue(context, existing.id, existing.title);
		if(result.fails) {
			return result;
		}
	}

	if((expecting.close && !existing.closed) || (expecting.lock && !existing.locked)) {
		const result = await pinIssue(context, existing.id, existing.title);
		if(result.fails) {
			return result;
		}
	}

	return OK;
}
