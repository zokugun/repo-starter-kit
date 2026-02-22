import { isNonBlankString, isRecord } from '@zokugun/is-it-type';
import { err, stringifyError, type Failure } from '@zokugun/xtry';
import { type Context, type Ruleset } from '../types.js';
import * as logger from '../utils/logger.js';

type RulesetTarget = 'branch' | 'tag' | 'push';
type RulesetEnforcement = 'active' | 'disabled' | 'evaluate';

type RulesetPayload = Record<string, unknown> & {
	name: string;
	target: RulesetTarget;
	enforcement: RulesetEnforcement;
};

export async function syncRulesets(context: Context, rulesets: Ruleset[], keepExisting = false): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

	if(rulesets.length === 0) {
		logger.warn('No branch rulesets defined; skipping ruleset sync.');
		return;
	}

	let existingEntries: unknown[];

	try {
		existingEntries = await octokit.paginate('GET /repos/{owner}/{repo}/rulesets', {
			owner,
			repo: repositoryName,
			per_page: 100,
		});
	}
	catch (error) {
		return err(stringifyError(error));
	}

	const existingByName = new Map<string, { id: number; name: string }>();

	for(const entry of existingEntries) {
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
		const payload = normalizeRulesetPayload(desired);
		const existing = existingByName.get(desired.name);

		if(existing) {
			const result = await updateRuleset(context, existing.id, payload);
			if(result) {
				return result;
			}

			logger.log(`Updated ruleset: ${desired.name}`);
		}
		else {
			const result = await createRuleset(context, payload);
			if(result) {
				return result;
			}

			logger.log(`Created ruleset: ${desired.name}`);
		}
	}

	if(keepExisting) {
		logger.log('Keeping existing rulesets that are not in the configuration.');
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

function normalizeRulesetPayload(ruleset: Ruleset): RulesetPayload { // {{{
	/* eslint-disable @typescript-eslint/naming-convention */
	const {
		name,
		id: _id,
		source: _source,
		source_type: _sourceType,
		created_at: _createdAt,
		updated_at: _updatedAt,
		node_id: _nodeId,
		target,
		enforcement,
		...rest
	} = ruleset;
	/* eslint-enable @typescript-eslint/naming-convention */

	return {
		...rest,
		name,
		target: normalizeTarget(target),
		enforcement: normalizeEnforcement(enforcement),
	};
} // }}}

async function createRuleset(context: Context, payload: RulesetPayload): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

	try {
		await octokit.request('POST /repos/{owner}/{repo}/rulesets', {
			owner,
			repo: repositoryName,
			...payload,
		});
	}
	catch (error) {
		return err(`Failed to create ruleset '${payload.name}': ${stringifyError(error)}`);
	}
} // }}}

async function updateRuleset(context: Context, id: number, payload: RulesetPayload): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

	try {
		await octokit.request('PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
			owner,
			repo: repositoryName,
			ruleset_id: id,
			...payload,
		});
	}
	catch (error) {
		return err(`Failed to update ruleset '${payload.name}': ${stringifyError(error)}`);
	}
} // }}}

async function deleteRuleset(context: Context, id: number, name: string): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

	try {
		await octokit.request('DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
			owner,
			repo: repositoryName,
			ruleset_id: id,
		});
	}
	catch (error) {
		return err(`Failed to delete ruleset '${name}': ${stringifyError(error)}`);
	}

	logger.log(`Deleted ruleset: ${name}`);
} // }}}

function normalizeTarget(value: unknown): RulesetTarget { // {{{
	if(isNonBlankString<string>(value)) {
		const normalized = value.trim().toLowerCase();
		if(normalized === 'branch' || normalized === 'tag' || normalized === 'push') {
			return normalized as RulesetTarget;
		}
	}

	return 'branch';
} // }}}

function normalizeEnforcement(value: unknown): RulesetEnforcement { // {{{
	if(isNonBlankString<string>(value)) {
		const normalized = value.trim().toLowerCase();
		if(normalized === 'active' || normalized === 'disabled' || normalized === 'evaluate') {
			return normalized as RulesetEnforcement;
		}
	}

	return 'active';
} // }}}
