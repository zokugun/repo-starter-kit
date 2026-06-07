import { logger } from '@zokugun/cli-utils';
import { type AsyncDResult, stringifyError, xtry } from '@zokugun/xtry/async';
import { type Context } from '../types.js';

export async function lockIssue({ octokit }: Context, issueId: string, title: string): AsyncDResult {
	logger.info(`Locking issue '${title}'`);

	return xtry(octokit.graphql(
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
	), stringifyError);
}
