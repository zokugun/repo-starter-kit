import { logger } from '@zokugun/cli-utils';
import { type AsyncDResult, OK } from '@zokugun/xtry/async';
import { type Context } from '../types.js';
import { openPage } from '../utils/open-page.js';

export async function pinDiscussion(context: Context, discussionNumber: string, title: string): AsyncDResult {
	logger.info(`Pinning discussion '${title}'`);

	const { owner, repositoryName } = context;

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

	return OK;
}
