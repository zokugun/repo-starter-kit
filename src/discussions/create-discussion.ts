import { err, type Failure, stringifyError } from '@zokugun/xtry';
import { type Context, type Discussion } from '../types.js';
import * as logger from '../utils/logger.js';
import { openPage } from '../utils/open-page.js';

type CategoriesResponse = {
	repository: {
		discussionCategories: {
			edges: [{
				node: {
					id: string;
					name: string;
				};
			}];
		};
	};
};

type CreateResponse = {
	createDiscussion: {
		discussion: {
			id: string;
			number: string;
		};
	};
};

export async function createDiscussion(context: Context, { title, body, category, labels, close, pin, lock }: Discussion): Promise<Failure<string> | undefined> {
	const { octokit, owner, repositoryName, repositoryId } = context;

	try {
		logger.log(`Creating discussion '${title}'`);

		const categories: CategoriesResponse = await octokit.graphql(
			`query listCategories($owner: String!, $name: String!) {
				repository(owner: $owner, name: $name) {
					discussionCategories(first: 25) {
						totalCount

						pageInfo {
							startCursor
							endCursor
							hasNextPage
							hasPreviousPage
						}

						edges {
							cursor

							node {
								id
								name
							}
						}
					}
				}
			}`,
			{
				owner,
				name: repositoryName,
			},
		);

		const categoryId = categories.repository.discussionCategories.edges.filter(({ node }) => node.name === category).map(({ node }) => node.id)[0];

		if(!categoryId) {
			return err(`Cannot find category "${category}"`);
		}

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
			logger.log(`Adding labels to discussion '${title}'`);

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
			logger.log(`Closing discussion '${title}'`);

			const reason = close === 'resolved' ? 'RESOLVED' : 'OUTDATED';

			await octokit.graphql(
				`mutation closeDiscussion($discussionId: ID!, $reason: DiscussionCloseReason!) {
					closeDiscussion(input: {discussionId: $discussionId, reason: $reason}) {
						discussion {
							id
							closed
						}
					}
				}`,
				{
					discussionId,
					reason,
				},
			);
		}

		if(lock) {
			logger.log(`Locking discussion '${title}'`);

			await octokit.graphql(
				`mutation lockDiscussion($discussionId: ID!) {
					lockLockable(input: {lockableId: $discussionId}) {
						lockedRecord {
							locked
						}
					}
				}`,
				{
					discussionId,
				},
			);
		}

		if(pin) {
			logger.log(`Pinning discussion '${title}'`);

			const openResult = await openPage(context);
			if(openResult.fails) {
				return openResult;
			}

			const page = openResult.value;

			await page.goto(`https://github.com/${owner}/${repositoryName}/discussions/${discussionNumber}`, {
				waitUntil: 'domcontentloaded',
			});

			await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);

			await page.locator('#dialog-show-discussion-create-spotlight').first().click();

			await page.locator('#discussion_spotlight_preconfigured_color_green').first().check();

			await page.locator('button.Button--primary[type=submit]').getByText('Pin discussion').first().click();

			await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);
		}

		logger.log(`Created discussion '${title}' (#${discussionNumber}).`);
	}
	catch (error) {
		return err(stringifyError(error));
	}
}
