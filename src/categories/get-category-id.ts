import { type AsyncDResult, err, ok, stringifyError, xtry } from '@zokugun/xtry/async';
import { type Context } from '../types.js';

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

export async function getCategoryId(context: Context, name: string): AsyncDResult<string> {
	const { octokit, owner, repositoryName } = context;

	const result = await xtry(octokit.graphql(
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
	), stringifyError);

	if(result.fails) {
		return result;
	}

	for(const { node } of (result.value as CategoriesResponse).repository.discussionCategories.edges) {
		if(node.name === name) {
			return ok(node.id);
		}
	}

	return err(`Cannot find category "${name}"`);
}
