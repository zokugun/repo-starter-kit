import { err, type Failure, ok, type Result, stringifyError } from '@zokugun/xtry';
import enquirer from 'enquirer';
import { type Browser, chromium, type Page } from 'playwright';
import * as logger from './utils/logger.js';

export type BrowserAction = (page: Page) => Promise<Failure<string> | undefined>;

export async function openBrowser(owner: string, repositoryName: string): Promise<Result<{ browser: Browser; page: Page }, string>> {
	let browser: Browser | undefined;

	try {
		browser = await chromium.launch({
			headless: false,
			channel: 'chrome',
		});

		const page = await browser.newPage();

		await page.goto(`https://github.com/${owner}/${repositoryName}`, {
			waitUntil: 'domcontentloaded',
		});

		await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => undefined);

		const signInExists = await hasSignInButton(page);
		if(signInExists) {
			logger.pause();

			const confirmed = await waitForEnterWithTimeout(300_000, 'GitHub Sign in detected. Please login in Chrome, then press ENTER here within 5 minutes.');
			if(!confirmed) {
				return err('Timed out waiting for login confirmation (5 minutes).');
			}

			logger.resume();

			const signInExists = await hasSignInButton(page);
			if(signInExists) {
				return err('GitHub Sign is still detected');
			}
		}

		return ok({ browser, page });
	}
	catch (error) {
		return err(`Failed to apply browser actions in Chrome (cross-platform): ${stringifyError(error)}`);
	}
}

async function hasSignInButton(page: Page): Promise<boolean> {
	const signInLocators = [
		() => page.getByRole('button', { name: 'Sign in', exact: true }).first(),
		() => page.getByRole('link', { name: 'Sign in', exact: true }).first(),
		() => page.getByText('Sign in', { exact: true }).first(),
	];

	for(const createLocator of signInLocators) {
		try {
			if(await createLocator().count() > 0) {
				return true;
			}
		}
		catch {}
	}

	return false;
}

async function waitForEnterWithTimeout(timeoutMilliseconds: number, message: string): Promise<boolean> {
	let timeoutId: ReturnType<typeof setTimeout>;

	const promptPromise = enquirer
		.prompt({
			type: 'invisible',
			name: 'open',
			message,
		})
		// eslint-disable-next-line promise/prefer-await-to-then
		.then(() => {
			clearTimeout(timeoutId);
			return true;
		})
		// eslint-disable-next-line promise/prefer-await-to-then
		.catch(() => {
			clearTimeout(timeoutId);
			return false;
		});

	const timeoutPromise = new Promise<boolean>((resolve) => {
		timeoutId = setTimeout(() => resolve(false), timeoutMilliseconds);
	});

	return Promise.race([promptPromise, timeoutPromise]);
}

// function resolveChromeUserDataDir(): string | undefined {
// 	if(process.env.CHROME_USER_DATA_DIR) {
// 		return process.env.CHROME_USER_DATA_DIR;
// 	}

// 	if(process.platform === 'darwin') {
// 		return `${process.env.HOME}/Library/Application Support/Google/Chrome`;
// 	}

// 	if(process.platform === 'win32') {
// 		return process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data` : undefined;
// 	}

// 	return `${process.env.HOME}/.config/google-chrome`;
// }
