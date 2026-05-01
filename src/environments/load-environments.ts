import { readFile } from 'node:fs/promises';
import { isArray, isBoolean, isNumber, isRecord, isString, isUndefined } from '@zokugun/is-it-type';
import { err, ok, stringifyError, type Result } from '@zokugun/xtry';
import YAML from 'yaml';
import { type BranchPolicy, type Reviewer, type Environment } from '../types.js';

export async function loadEnvironments(filename: string): Promise<Result<Environment[], string>> { // {{{
	let content: string;

	try {
		content = await readFile(filename, 'utf8');
	}
	catch (error) {
		return err(`Failed to read ${filename} from package: ${stringifyError(error)}`);
	}

	const records: unknown = YAML.parse(content);

	if(!Array.isArray(records)) {
		return err(`Label file ${filename} must contain an array.`);
	}

	const environments: Environment[] = [];

	for(const [index, record] of records.entries()) {
		if(!isRecord(record)) {
			return err(`Environment entry at index ${index} must be an object.`);
		}

		const name = String(record.name ?? '').trim();

		if(name.length === 0) {
			return err(`Environment entry at index ${index} must define a non-empty 'name'.`);
		}

		const canAdminsBypass = isBoolean(record.can_admins_bypass) ? record.can_admins_bypass : true;
		const preventSelfReview = isBoolean(record.prevent_self_review) ? record.prevent_self_review : false;
		const protectedBranches = isBoolean(record.protected_branches) ? record.protected_branches : false;

		const reviewers: Reviewer[] = [];

		if(isArray(record.reviewers)) {
			for(const [indexData, data] of record.reviewers.entries()) {
				if(!isRecord(data)) {
					return err(`Environment entry at ${index}/reviewers/${indexData} must be an object.`);
				}

				const { type, id } = data;

				if(type === 'user') {
					if(isNumber(id) || isString(id)) {
						reviewers.push({ type, id });
					}
					else {
						return err(`Environment entry at ${index}/reviewers/${indexData}/id must be a number or a string.`);
					}
				}
				else {
					return err(`Environment entry at ${index}/reviewers/${indexData}/type must be "user" or "team".`);
				}
			}
		}
		else if(!isUndefined(record.reviewers)) {
			return err(`Environment entry at ${index}/reviewers must be an array.`);
		}

		const branchPolicies: BranchPolicy[] = [];

		if(isArray(record.branch_policies)) {
			for(const [indexData, data] of record.branch_policies.entries()) {
				if(!isRecord(data)) {
					return err(`Environment entry at ${index}/branch_policies/${indexData} must be an object.`);
				}

				const { type } = data;

				if(type === 'branch' || type === 'tag') {
					const name = String(data.name ?? '').trim();

					if(name.length === 0) {
						return err(`Environment entry at index ${index}/branch_policies/${indexData}/name must define a non-empty string.`);
					}

					branchPolicies.push({ type, name });
				}
				else {
					return err(`Environment entry at ${index}/branch_policies/${indexData}/type must be "branch" or "tag".`);
				}
			}
		}
		else if(!isUndefined(record.branch_policies)) {
			return err(`Environment entry at ${index}/branch_policies must be an array.`);
		}

		environments.push({
			branchPolicies,
			canAdminsBypass,
			name,
			preventSelfReview,
			protectedBranches,
			reviewers,
		});
	}

	return ok(environments);
} // }}}
