import { logger } from '@zokugun/cli-utils';
import { type AsyncDResult, stringifyError, xtry } from '@zokugun/xtry/async';
import { type Context } from '../types.js';

export async function pinIssue({ octokit }: Context, issueId: string, title: string): AsyncDResult {
	logger.info(`Pinning issue '${title}'`);

	return xtry(octokit.graphql(
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
	), stringifyError);
}
