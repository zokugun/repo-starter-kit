import { logger } from '@zokugun/cli-utils';
import { type AsyncDResult, OK, stringifyError, xtry } from '@zokugun/xtry/async';
import { getCategoryId } from '../categories/get-category-id.js';
import { type Context, type Discussion } from '../types.js';
import { closeDiscussion } from './close-discussion.js';
import { createDiscussion } from './create-discussion.js';
import { lockDiscussion } from './lock-discussion.js';
import { pinDiscussion } from './pin-discussion.js';

type QueryNode = {
	id: string;
	number: string;
	title: string;
	body: string;
	closed: boolean;
	locked: boolean;
	category: {
		id: string;
		name: string;
	};
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

export async function syncDiscussion(context: Context, discussion: Discussion): AsyncDResult {
	const { octokit, owner, repositoryName } = context;

	const result = await xtry(octokit.graphql(
		`query SearchDiscussions() {
			search(query: "${discussion.title} repo:${owner}/${repositoryName} in:title", type: DISCUSSION, first: 100) {
				edges {
					node {
						... on Discussion {
							id
							number
							title
							body
							closed
							locked

							category {
								id
								name
							}

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
		if(edge.node.title === discussion.title) {
			queryResult = edge.node;

			break;
		}
	}

	if(queryResult) {
		return updateDiscussion(context, discussion, queryResult);
	}
	else {
		return createDiscussion(context, discussion);
	}
}

export async function updateDiscussion(context: Context, expecting: Discussion, existing: QueryNode): AsyncDResult {
	if(expecting.body !== existing.body || expecting.category !== existing.category.name) {
		logger.info(`Updating discussion '${expecting.title}'`);

		const category = await getCategoryId(context, expecting.category);
		if(category.fails) {
			return category;
		}

		const result = await xtry(context.octokit.graphql(
			`mutation updateDiscussion($discussionId: ID!, $categoryId: ID!, $body: String!) {
				updateDiscussion(input: {discussionId: $discussionId, categoryId: $categoryId, body: $body}) {
					discussion {
						id
						number
					}
				}
			}`,
			{
				discussionId: existing.id,
				categoryId: category.value,
				body: expecting.body,
			},
		), stringifyError);

		if(result.fails) {
			return result;
		}
	}

	if(expecting.close && !existing.closed) {
		const result = await closeDiscussion(context, existing.id, existing.title, expecting.close);
		if(result.fails) {
			return result;
		}
	}

	if(expecting.lock && !existing.locked) {
		const result = await lockDiscussion(context, existing.id, existing.title);
		if(result.fails) {
			return result;
		}
	}

	if((expecting.close && !existing.closed) || (expecting.lock && !existing.locked)) {
		const result = await pinDiscussion(context, existing.number, existing.title);
		if(result.fails) {
			return result;
		}
	}

	return OK;
}
