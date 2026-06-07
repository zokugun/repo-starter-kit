import { logger } from '@zokugun/cli-utils';
import { type AsyncDResult, stringifyError, xtry } from '@zokugun/xtry/async';
import { type Context, type Discussion } from '../types.js';

export async function closeDiscussion({ octokit }: Context, discussionId: string, title: string, close: Exclude<Discussion['close'], undefined>): AsyncDResult {
	logger.info(`Closing discussion '${title}'`);

	const reason = close === 'resolved' ? 'RESOLVED' : 'OUTDATED';

	return xtry(octokit.graphql(
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
	), stringifyError);
}
