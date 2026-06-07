import logger from '@zokugun/cli-utils/logger';
import { type AsyncDResult, err, OK, stringifyError } from '@zokugun/xtry/async';
import { getCategoryId } from '../categories/get-category-id.js';
import { type Context, type Discussion } from '../types.js';
import { closeDiscussion } from './close-discussion.js';
import { lockDiscussion } from './lock-discussion.js';
import { pinDiscussion } from './pin-discussion.js';

type CreateResponse = {
	createDiscussion: {
		discussion: {
			id: string;
			number: string;
		};
	};
};

export async function createDiscussion(context: Context, { title, body, category, labels, close, pin, lock }: Discussion): AsyncDResult {
	const { octokit, owner, repositoryName, repositoryId } = context;

	logger.info(`Creating discussion '${title}'`);

	const categoryResult = await getCategoryId(context, category);
	if(categoryResult.fails) {
		return categoryResult;
	}

	const categoryId = categoryResult.value;

	try {
		const response: CreateResponse = await octokit.graphql(
			`mutation createDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
				createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body}) {
					discussion {
						id
						number
					}
				}
			}`,
			{
				repositoryId,
				categoryId,
				title,
				body,
			},
		);

		const discussionId = response.createDiscussion.discussion.id;
		const discussionNumber = response.createDiscussion.discussion.number;

		if(labels.length > 0) {
			logger.info(`Adding labels to discussion '${title}'`);

			const labelsForRepo = await octokit.rest.issues.listLabelsForRepo({
				owner,
				repo: repositoryName,
			});

			const labelIds: string[] = [];

			for(const name of labels) {
				const label = labelsForRepo.data.filter((label) => label.name === name);

				if(label.length > 0) {
					labelIds.push(label[0].node_id);
				}
			}

			await octokit.graphql(
				`mutation addLabels($discussionId: ID!, $labelIds: [ID!]!) {
					addLabelsToLabelable(input: {labelableId: $discussionId, labelIds: $labelIds}) {
						labelable {
							... on Discussion {
								id
							}
						}
					}
				}`,
				{
					discussionId,
					labelIds,
				},
			);
		}

		if(close) {
			const result = await closeDiscussion(context, discussionId, title, close);
			if(result.fails) {
				return result;
			}
		}

		if(lock) {
			const result = await lockDiscussion(context, discussionId, title);
			if(result.fails) {
				return result;
			}
		}

		if(pin) {
			const result = await pinDiscussion(context, discussionNumber, title);
			if(result.fails) {
				return result;
			}
		}

		logger.info(`Created discussion '${title}' (#${discussionNumber}).`);

		return OK;
	}
	catch (error) {
		return err(stringifyError(error));
	}
}
