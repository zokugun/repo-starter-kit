import { ok, type Result } from '@zokugun/xtry';
import { type Page } from 'playwright';
import { type Context } from '../types.js';
import { openBrowser } from './browser.js';

export async function openPage(context: Context): Promise<Result<Page, string>> {
	if(context.page) {
		return ok(context.page);
	}

	const result = await openBrowser(context.owner, context.repositoryName);
	if(result.fails) {
		return result;
	}

	context.browser = result.value.browser;
	context.page = result.value.page;

	return ok(context.page);
}
