import { logger } from '@zokugun/cli-utils';
import { type AsyncDResult, stringifyError, xtry } from '@zokugun/xtry/async';
import { type Context, type Issue } from '../types.js';

export async function closeIssue({ octokit }: Context, issueId: string, title: string, close: Exclude<Issue['close'], undefined>): AsyncDResult {
	logger.info(`Closing issue '${title}'`);

	const reason = close === 'completed' ? 'COMPLETED' : 'NOT_PLANNED';

	return xtry(octokit.graphql(
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
	), stringifyError);
}
