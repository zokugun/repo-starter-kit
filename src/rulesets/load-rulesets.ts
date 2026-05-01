import { readFile } from 'node:fs/promises';
import { isArray, isBoolean, isNonBlankString, isNumber, isRecord, isString, isUndefined } from '@zokugun/is-it-type';
import { type DResult, err, ok, stringifyError, type Result } from '@zokugun/xtry';
import YAML from 'yaml';
import { type Ruleset, type Rule, type RulesetActor, type PullRequestMethod } from '../types.js';

export async function loadRulesets(filename: string): Promise<Result<Ruleset[], string>> { // {{{
	let content: string;

	try {
		content = await readFile(filename, 'utf8');
	}
	catch (error) {
		return err(`Failed to read ${filename} from package: ${stringifyError(error)}`);
	}

	let records: unknown;

	try {
		records = YAML.parse(content);
	}
	catch (error) {
		return err(`Failed to parse rulesets file ${filename}: ${stringifyError(error)}`);
	}

	if(!Array.isArray(records)) {
		return err(`Rulesets file ${filename} must contain an array.`);
	}

	const rulesets: Ruleset[] = [];

	for(const [index, record] of records.entries()) {
		if(!isRecord(record)) {
			return err(`Ruleset entry at index ${index} must be an object.`);
		}

		const ruleset = normalizeRuleset(record);

		if(ruleset.fails) {
			return ruleset;
		}

		rulesets.push(ruleset.value);
	}

	return ok(rulesets);
} // }}}

export function normalizeRuleset(data: Record<string, unknown>): DResult<Ruleset> { // {{{
	if(!isRecord(data)) {
		return err('Ruleset must be an object');
	}

	const name = isNonBlankString<string>(data.name) ? data.name.trim() : '';

	if(name.length === 0) {
		return err('Ruleset must define a non-empty name');
	}

	if(data.enforcement !== 'active' && data.enforcement !== 'disabled' && data.enforcement !== 'evaluate') {
		return err(`Invalid ruleset enforcement: ${String(data.enforcement)}`);
	}

	const { enforcement } = data;

	if(data.target !== 'branch' && data.target !== 'push' && data.target !== 'tag') {
		return err(`Invalid ruleset target: ${String(data.target)}`);
	}

	const { target } = data;

	let conditions: Ruleset['conditions'];

	if(isRecord(data.conditions)) {
		if(!isRecord(data.conditions.ref_name)) {
			return err('Ruleset conditions/ref_name must be an object');
		}

		let { include, exclude } = data.conditions.ref_name;

		if(include) {
			if(!isArray<string>(include, isString)) {
				return err('Ruleset conditions/ref_name/include must be an array of string');
			}
		}
		else {
			include = [];
		}

		if(exclude) {
			if(!isArray<string>(exclude, isString)) {
				return err('Ruleset conditions/ref_name/exclude must be an array of string');
			}
		}
		else {
			exclude = [];
		}

		conditions = {
			ref_name: {
				include: include as string[],
				exclude: exclude as string[],
			},
		};
	}

	const rules: Rule[] = [];

	if(data.rules) {
		if(!isArray(data.rules)) {
			return err('rules must be an array');
		}

		for(const [index, rule] of data.rules.entries()) {
			if(!isRecord(rule)) {
				return err(`rule at index ${index} must be an object`);
			}

			const result = normalizeRule(rule);

			if(result.fails) {
				return result;
			}

			rules.push(result.value);
		}
	}

	let bypassActors: Ruleset['bypass_actors'];

	if(data.bypass_actors) {
		if(!isArray(data.bypass_actors)) {
			return err('bypass_actors must be an array');
		}

		bypassActors = [];

		for(const [index, actor] of data.bypass_actors.entries()) {
			if(!isRecord(actor)) {
				return err(`bypass_actor at index ${index} must be an object`);
			}

			if(!isNumber(actor.actor_id)) {
				return err('Bypass_actor actor_id must be a number');
			}

			const actorId = actor.actor_id;

			let actorType: RulesetActor['actor_type'];

			if(actor.actor_type === 'DeployKey' || actor.actor_type === 'deploykey') {
				actorType = 'DeployKey';
			}
			else if(actor.actor_type === 'Integration' || actor.actor_type === 'integration') {
				actorType = 'Integration';
			}
			else if(actor.actor_type === 'OrganizationAdmin' || actor.actor_type === 'organization-admin') {
				actorType = 'OrganizationAdmin';
			}
			else if(actor.actor_type === 'RepositoryRole' || actor.actor_type === 'repository-role') {
				actorType = 'RepositoryRole';
			}
			else if(actor.actor_type === 'Team' || actor.actor_type === 'team') {
				actorType = 'Team';
			}
			else {
				return err(`Invalid bypass_actors/${index}/actor_type: ${String(actor.actor_type)}`);
			}

			if(actor.bypass_mode !== 'pull_request' && actor.bypass_mode !== 'always' && actor.bypass_mode !== 'exempt') {
				return err(`Invalid bypass_actors/${index}/bypass_mode: ${String(actor.bypass_mode)}`);
			}

			bypassActors.push({
				actor_id: actorId,
				actor_type: actorType,
				bypass_mode: actor.bypass_mode,
			});
		}
	}

	return ok({
		name,
		enforcement,
		target,
		conditions,
		rules,
		bypass_actors: bypassActors,
	});
} // }}}

export function normalizeRule(data: Record<string, unknown>): DResult<Rule> { // {{{
	if(!isNonBlankString(data.type)) {
		return err('Rule must define a non-empty type');
	}

	const { type } = data;

	switch(type) {
		case 'creation': {
			return ok({ type: 'creation' });
		}

		case 'deletion': {
			return ok({ type: 'deletion' });
		}

		case 'non_fast_forward':
		case 'non-fast-forward': {
			return ok({ type: 'non_fast_forward' });
		}

		case 'pull_request':
		case 'pull-request': {
			if(isUndefined(data.parameters)) {
				return ok({
					type: 'pull_request',
				});
			}
			else if(!isRecord(data.parameters)) {
				return err('Ruleset rule/parameters must be an object');
			}

			const allowedMergeMethods: PullRequestMethod[] = [];

			if(isArray(data.parameters.allowed_merge_methods)) {
				for(const method of data.parameters.allowed_merge_methods) {
					if(method === 'merge' || method === 'squash' || method === 'rebase') {
						allowedMergeMethods.push(method);
					}
					else {
						return err('Ruleset rule/parameters/allowed_merge_methods must be an array of merge methods');
					}
				}
			}
			else if(!isUndefined(data.parameters.allowed_merge_methods)) {
				return err('Ruleset rule/parameters/allowed_merge_methods must be an array of merge methods');
			}

			if(!isUndefined(data.parameters.automatic_copilot_code_review_enabled) && !isBoolean(data.parameters.automatic_copilot_code_review_enabled)) {
				return err('Ruleset rule/parameters/automatic_copilot_code_review_enabled must be a boolean');
			}

			const automaticCopilotCodeReviewEnabled = data.parameters.automatic_copilot_code_review_enabled ?? false;

			if(!isUndefined(data.parameters.dismiss_stale_reviews_on_push) && !isBoolean(data.parameters.dismiss_stale_reviews_on_push)) {
				return err('Ruleset rule/parameters/dismiss_stale_reviews_on_push must be a boolean');
			}

			const dismissStaleReviewsOnPush = data.parameters.dismiss_stale_reviews_on_push ?? false;

			if(!isUndefined(data.parameters.require_code_owner_review) && !isBoolean(data.parameters.require_code_owner_review)) {
				return err('Ruleset rule/parameters/require_code_owner_review must be a boolean');
			}

			const requireCodeOwnerReview = data.parameters.require_code_owner_review ?? false;

			if(!isUndefined(data.parameters.require_last_push_approval) && !isBoolean(data.parameters.require_last_push_approval)) {
				return err('Ruleset rule/parameters/require_last_push_approval must be a boolean');
			}

			const requireLastPushApproval = data.parameters.require_last_push_approval ?? false;

			if(!isUndefined(data.parameters.required_approving_review_count) && !isNumber(data.parameters.required_approving_review_count)) {
				return err('Ruleset rule/parameters/required_approving_review_count must be a boolean');
			}

			const requiredApprovingReviewCount = data.parameters.required_approving_review_count ?? 1;

			if(!isUndefined(data.parameters.required_review_thread_resolution) && !isBoolean(data.parameters.required_review_thread_resolution)) {
				return err('Ruleset rule/parameters/required_review_thread_resolution must be a boolean');
			}

			const requiredReviewThreadResolution = data.parameters.required_review_thread_resolution ?? false;

			return ok({
				type: 'pull_request',
				parameters: {
					allowed_merge_methods: allowedMergeMethods,
					automatic_copilot_code_review_enabled: automaticCopilotCodeReviewEnabled,
					dismiss_stale_reviews_on_push: dismissStaleReviewsOnPush,
					require_code_owner_review: requireCodeOwnerReview,
					require_last_push_approval: requireLastPushApproval,
					required_approving_review_count: requiredApprovingReviewCount,
					required_review_thread_resolution: requiredReviewThreadResolution,

				},
			});
		}

		case 'required_linear_history':
		case 'required-linear-history': {
			return ok({ type: 'required_linear_history' });
		}

		case 'required_signatures':
		case 'required-signatures': {
			return ok({ type: 'required_signatures' });
		}

		case 'update': {
			if(isUndefined(data.parameters)) {
				return ok({
					type: 'update',
				});
			}
			else if(!isRecord(data.parameters)) {
				return err('Ruleset rule/parameters must be an object');
			}

			if(!isUndefined(data.parameters.update_allows_fetch_and_merge) && !isBoolean(data.parameters.update_allows_fetch_and_merge)) {
				return err('Ruleset rule/parameters/update_allows_fetch_and_merge must be a boolean');
			}

			const updateAllowsFetchAndMerge = data.parameters.update_allows_fetch_and_merge ?? false;

			return ok({
				type: 'update',
				parameters: {
					update_allows_fetch_and_merge: updateAllowsFetchAndMerge,
				},
			});
		}

		case 'required_deployments': {
			if(isUndefined(data.parameters)) {
				return ok({
					type: 'required_deployments',
				});
			}
			else if(!isRecord(data.parameters)) {
				return err('Ruleset rule/parameters must be an object');
			}

			if(!isArray<string>(data.parameters.required_deployment_environments, isString)) {
				return err('Ruleset rule/parameters must be an object');
			}

			return ok({
				type: 'required_deployments',
				parameters: {
					required_deployment_environments: data.parameters.required_deployment_environments,
				},
			});
		}

		case 'merge_queue': {
			if(isUndefined(data.parameters)) {
				return ok({
					type: 'merge_queue',
				});
			}
			else if(!isRecord(data.parameters)) {
				return err('Ruleset rule/parameters must be an object');
			}

			if(!isUndefined(data.parameters.check_response_timeout_minutes) && !isNumber(data.parameters.check_response_timeout_minutes)) {
				return err('Ruleset rule/parameters/check_response_timeout_minutes must be a number');
			}

			const checkResponseTimeoutMinutes = data.parameters.check_response_timeout_minutes ?? 0;

			let groupingStrategy: 'ALLGREEN' | 'HEADGREEN';

			if(!isString(data.parameters.grouping_strategy)) {
				return err('Ruleset rule/parameters/grouping_strategy must be a string');
			}
			else if(data.parameters.grouping_strategy.toLowerCase() === 'allgreen') {
				groupingStrategy = 'ALLGREEN';
			}
			else if(data.parameters.grouping_strategy.toLowerCase() === 'headgreen') {
				groupingStrategy = 'HEADGREEN';
			}
			else {
				return err(`Invalid rule/parameters/grouping_strategy: ${data.parameters.grouping_strategy}`);
			}

			if(!isUndefined(data.parameters.max_entries_to_build) && !isNumber(data.parameters.max_entries_to_build)) {
				return err('Ruleset rule/parameters/max_entries_to_build must be a number');
			}

			const maxEntriesToBuild = data.parameters.max_entries_to_build ?? 0;

			if(!isUndefined(data.parameters.max_entries_to_merge) && !isNumber(data.parameters.max_entries_to_merge)) {
				return err('Ruleset rule/parameters/max_entries_to_merge must be a number');
			}

			const maxEntriesToMerge = data.parameters.max_entries_to_merge ?? 0;

			let mergeMethod: 'MERGE' | 'REBASE' | 'SQUASH';

			if(isUndefined(data.parameters.merge_method)) {
				mergeMethod = 'MERGE';
			}
			else if(!isString(data.parameters.merge_method)) {
				return err('Ruleset rule/parameters/merge_method must be a string');
			}
			else if(data.parameters.merge_method.toLowerCase() === 'merge') {
				mergeMethod = 'MERGE';
			}
			else if(data.parameters.merge_method.toLowerCase() === 'rebase') {
				mergeMethod = 'REBASE';
			}
			else if(data.parameters.merge_method.toLowerCase() === 'squash') {
				mergeMethod = 'SQUASH';
			}
			else {
				return err(`Invalid rule/parameters/merge_method: ${data.parameters.merge_method}`);
			}

			if(!isUndefined(data.parameters.min_entries_to_merge) && !isNumber(data.parameters.min_entries_to_merge)) {
				return err('Ruleset rule/parameters/min_entries_to_merge must be a number');
			}

			const minEntriesToMerge = data.parameters.min_entries_to_merge ?? 0;

			if(!isUndefined(data.parameters.min_entries_to_merge_wait_minutes) && !isNumber(data.parameters.min_entries_to_merge_wait_minutes)) {
				return err('Ruleset rule/parameters/min_entries_to_merge_wait_minutes must be a number');
			}

			const minEntriesToMergeWaitMinutes = data.parameters.min_entries_to_merge_wait_minutes ?? 0;

			return ok({
				type: 'merge_queue',
				parameters: {
					check_response_timeout_minutes: checkResponseTimeoutMinutes,
					grouping_strategy: groupingStrategy,
					max_entries_to_build: maxEntriesToBuild,
					max_entries_to_merge: maxEntriesToMerge,
					merge_method: mergeMethod,
					min_entries_to_merge: minEntriesToMerge,
					min_entries_to_merge_wait_minutes: minEntriesToMergeWaitMinutes,
				},
			});
		}

		default: {
			return err(`Unsupported rule type: ${String(type)}`);
		}
	}
} // }}}
