import { err, type Failure, stringifyError } from '@zokugun/xtry';
import { type Context, type PagedContext, type Category } from '../types.js';
import * as logger from '../utils/logger.js';
import { openPage } from '../utils/open-page.js';

type QueryNode = {
	id: string;
	name: string;
	description: string;
	emoji: string;
	format?: Category['format'];
};
type QueryResponse = {
	repository: {
		discussionCategories: {
			edges: [{
				node: QueryNode;
			}];
		};
	};
};

export async function syncCategories(context: Context, categories: Category[], keepExisting = false): Promise<Failure<string> | undefined> { // {{{
	if(categories.length === 0) {
		logger.warn('No categories defined; skipping category sync.');
		return;
	}

	try {
		const response: QueryResponse = await context.octokit.graphql(
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
								name
								description
								emoji
							}
						}
					}
				}
			}`,
			{
				owner: context.owner,
				name: context.repositoryName,
			},
		);

		const currentCategories: QueryNode[] = [];

		for(const edge of response.repository.discussionCategories.edges) {
			currentCategories.push(edge.node);
		}

		const openResult = await openPage(context);
		if(openResult.fails) {
			return openResult;
		}

		const page = openResult.value;

		await page.goto(`https://github.com/${context.owner}/${context.repositoryName}/discussions/categories`, {
			waitUntil: 'domcontentloaded',
		});

		await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);

		const items = await page.locator('li[data-view-component=true]').all();

		for(const item of items) {
			const header = item.locator('h2').first();
			const title = await header.textContent();
			if(!title) {
				continue;
			}

			const name = title.trim();
			const match = currentCategories.filter((category) => name === category.name);

			if(match) {
				const icons = await header.locator('svg[aria-label="Restricted"]').count();
				if(icons === 0) {
					const answers = await item.getByText('Answers enabled').count();
					if(answers === 0) {
						match[0].format = 'open';
					}
					else {
						match[0].format = 'answer';
					}
				}
				else {
					match[0].format = 'announcement';
				}

				const href = await item.locator('a').first().getAttribute('href');
				if(!href) {
					continue;
				}

				const result = /\/(\d+)\/edit/.exec(href);
				if(result) {
					match[0].id = result[1];
				}
			}
		}

		const desiredNames = new Set<string>();

		for(const category of categories) {
			desiredNames.add(category.name);

			const match = currentCategories.filter(({ name }) => name === category.name);

			if(match.length === 0) {
				await createCategory(context as PagedContext, category);
			}
			else {
				const current = match[0];

				if(category.description !== current.description || category.emoji !== current.emoji || category.format !== current.format) {
					await updateCategory(context as PagedContext, category, current.id);
				}
			}
		}

		if(keepExisting) {
			logger.log('Keeping existing categories that are not in the configuration.');
			return;
		}

		await deleteMissings(context as PagedContext, currentCategories, desiredNames);
	}
	catch (error) {
		logger.error(stringifyError(error));
		console.log(error);

		return err(stringifyError(error));
	}
} // }}}

async function deleteMissings(context: PagedContext, existings: QueryNode[], desiredNames: Set<string>): Promise<void> { // {{{
	for(const existing of existings) {
		if(!desiredNames.has(existing.name)) {
			await deleteCategory(context, existing);
		}
	}
} // }}}

async function createCategory({ page, owner, repositoryName }: PagedContext, category: Category): Promise<void> {
	logger.log(`Creating category: ${category.name}`);

	await page.goto(`https://github.com/${owner}/${repositoryName}/discussions/categories/new`, {
		waitUntil: 'domcontentloaded',
	});

	await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);

	await page.locator('#category\\[name\\]').first().fill(category.name);
	await page.locator('#category\\[description\\]').first().fill(category.description ?? '');

	if(category.emoji) {
		await page.locator('input[type=hidden][name*=emoji]').evaluate((element, value) => {
			element.value = value;
		}, category.emoji);
	}

	if(category.format === 'announcement') {
		await page.locator('#supports_announcements_true_discussion_category').first().check();
	}
	else if(category.format === 'answer') {
		await page.locator('#supports_mark_as_answer_true_discussion_category').first().check();
	}
	else if(category.format === 'poll') {
		await page.locator('#supports_polls_true_discussion_category').first().check();
	}
	else {
		await page.locator('#supports_mark_as_answer_false_discussion_category').first().check();
	}

	await page.locator('button.Button--primary[type=submit]').first().click();

	await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);
}

async function updateCategory({ page, owner, repositoryName }: PagedContext, category: Category, id: string): Promise<void> {
	logger.log(`Updating category: ${category.name}`);

	await page.goto(`https://github.com/${owner}/${repositoryName}/discussions/categories/${id}/edit`, {
		waitUntil: 'domcontentloaded',
	});

	await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);

	await page.locator('#category\\[name\\]').first().fill(category.name);
	await page.locator('#category\\[description\\]').first().fill(category.description ?? '');

	if(category.emoji) {
		await page.locator('input[type=hidden][name*=emoji]').evaluate((element, value) => {
			element.value = value;
		}, category.emoji);
	}

	if(category.format === 'announcement') {
		await page.locator(`#supports_announcements_true_discussion_category_${id}`).first().check();
	}
	else if(category.format === 'answer') {
		await page.locator(`#supports_mark_as_answer_true_discussion_category_${id}`).first().check();
	}
	else if(category.format === 'poll') {
		await page.locator(`#supports_polls_true_discussion_category_${id}`).first().check();
	}
	else {
		await page.locator(`#supports_mark_as_answer_false_discussion_category_${id}`).first().check();
	}

	await page.locator('button.Button--primary[type=submit]').first().click();

	await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);
}

async function deleteCategory({ page, owner, repositoryName }: PagedContext, category: QueryNode): Promise<void> {
	logger.log(`Deleting category: ${category.name}`);

	await page.goto(`https://github.com/${owner}/${repositoryName}/discussions/categories`, {
		waitUntil: 'domcontentloaded',
	});

	await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);

	const form = page.locator(`form[action="/${owner}/${repositoryName}/discussions/categories/${category.id}"]`).first();

	await form.locator('button.Button--link').first().click();

	await form.locator('button.btn-danger').first().click();

	await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);
}
