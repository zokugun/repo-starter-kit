import { logger } from '@zokugun/cli-utils';
import { type AsyncDResult, stringifyError, xtry } from '@zokugun/xtry/async';
import { type Context } from '../types.js';

export async function lockDiscussion({ octokit }: Context, discussionId: string, title: string): AsyncDResult {
	logger.info(`Locking discussion '${title}'`);

	return xtry(octokit.graphql(
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
	), stringifyError);
}
