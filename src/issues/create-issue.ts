import { err, type Failure, stringifyError } from '@zokugun/xtry';
import { type Context, type Issue } from '../types.js';
import * as logger from '../utils/logger.js';

export async function createIssue(context: Context, { title, body, labels, close, pin, lock }: Issue): Promise<Failure<string> | undefined> {
	const { octokit, owner, repositoryName } = context;

	try {
		const response = await octokit.rest.issues.create({
			owner,
			repo: repositoryName,
			title,
			body,
			labels,
		});

		const issueNumber = response.data.number;
		const issueId = response.data.node_id;

		if(close) {
			logger.log(`Closing issue '${title}'`);

			const reason = close === 'completed' ? 'COMPLETED' : 'NOT_PLANNED';

			await octokit.graphql(
				`mutation closeIssue($issueId: ID!, $reason: IssueClosedStateReason!) {
					closeIssue(input: {issueId: $issueId, stateReason: $reason}) {
						issue {
							id
							closed
							closedAt
							state
							stateReason
						}
					}
				}`,
				{
					issueId,
					reason,
				},
			);
		}

		if(pin) {
			logger.log(`Pinning issue '${title}'`);

			await octokit.graphql(
				`mutation pinIssue($issueId: ID!) {
					pinIssue(input: {issueId: $issueId}) {
						issue {
							id
							isPinned
						}
					}
				}`,
				{
					issueId,
				},
			);
		}

		if(lock) {
			logger.log(`Locking issue '${title}'`);

			await octokit.graphql(
				`mutation lockIssue($issueId: ID!) {
					lockLockable(input: {lockableId: $issueId, lockReason: RESOLVED}) {
						lockedRecord {
							locked
						}
					}
				}`,
				{
					issueId,
				},
			);
		}

		logger.log(`Created issue '${title}' (#${issueNumber}).`);
	}
	catch (error) {
		return err(stringifyError(error));
	}
}
