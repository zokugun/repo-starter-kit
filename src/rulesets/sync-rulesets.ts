import logger from '@zokugun/cli-utils/logger';
import { isNonBlankString, isRecord } from '@zokugun/is-it-type';
import { stringifyError, type Failure } from '@zokugun/xtry';
import { xtry } from '@zokugun/xtry/async';
import { type Context, type Ruleset } from '../types.js';

export async function syncRulesets(context: Context, rulesets: Ruleset[], keepExisting = false): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

	if(rulesets.length === 0) {
		logger.warn('No branch rulesets defined; skipping ruleset sync.');
		return;
	}

	const result = await xtry(octokit.rest.repos.getRepoRulesets({
		owner,
		repo: repositoryName,
	}), stringifyError);

	if(result.fails) {
		return result;
	}

	const existingByName = new Map<string, { id: number; name: string }>();

	for(const entry of result.value.data) {
		if(!isRecord(entry)) {
			continue;
		}

		const id = typeof entry.id === 'number' ? entry.id : Number(entry.id);
		const name = isNonBlankString<string>(entry.name) ? entry.name : '';

		if(Number.isFinite(id) && name.length > 0) {
			existingByName.set(name, { id: Number(id), name });
		}
	}

	const desiredNames = new Set<string>();

	for(const desired of rulesets) {
		desiredNames.add(desired.name);

		const existing = existingByName.get(desired.name);

		if(existing) {
			const result = await updateRuleset(context, existing.id, desired);
			if(result) {
				return result;
			}

			logger.info(`Updated ruleset: ${desired.name}`);
		}
		else {
			const result = await createRuleset(context, desired);
			if(result) {
				return result;
			}

			logger.info(`Created ruleset: ${desired.name}`);
		}
	}

	if(keepExisting) {
		logger.info('Keeping existing rulesets that are not in the configuration.');
		return;
	}

	for(const existing of existingByName.values()) {
		if(!desiredNames.has(existing.name)) {
			const result = await deleteRuleset(context, existing.id, existing.name);
			if(result) {
				return result;
			}
		}
	}
} // }}}

async function createRuleset(context: Context, ruleset: Ruleset): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

	const result = await xtry(octokit.rest.repos.createRepoRuleset({
		owner,
		repo: repositoryName,
		...ruleset,
	}), stringifyError);

	if(result.fails) {
		return result;
	}
} // }}}

async function updateRuleset(context: Context, id: number, ruleset: Ruleset): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

	const result = await xtry(octokit.rest.repos.updateRepoRuleset({
		owner,
		repo: repositoryName,
		ruleset_id: id,
		...ruleset,
	}), stringifyError);

	if(result.fails) {
		return result;
	}
} // }}}

async function deleteRuleset(context: Context, id: number, name: string): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

	const result = await xtry(octokit.rest.repos.deleteRepoRuleset({
		owner,
		repo: repositoryName,
		ruleset_id: id,
	}), stringifyError);

	if(result.fails) {
		return result;
	}

	logger.info(`Deleted ruleset: ${name}`);
} // }}}
