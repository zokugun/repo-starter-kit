import { type Octokit } from '@octokit/rest';
import { err, stringifyError, xatry, type Failure } from '@zokugun/xtry';
import { type Label, type RepoReference } from '../types.js';
import { isRecord } from '../utils/is-record.js';
import * as logger from '../utils/logger.js';

export async function syncLabels(octokit: Octokit, repo: RepoReference, labels: Label[], keepExisting = false): Promise<Failure<string> | undefined> { // {{{
	if(labels.length === 0) {
		logger.warn('No labels defined; skipping label sync.');
		return;
	}

	const desiredNames = new Set<string>();

	for(const label of labels) {
		const color = label.color.replace(/^#/, '').toLowerCase();
		if(!color) {
			logger.warn(`Skipping label '${label.name}' because it lacks a color.`);
			continue;
		}

		if(label.description && label.description.length > 100) {
			logger.warn(`Skipping label '${label.name}' because its description is too long (100 max).`);
			continue;
		}

		desiredNames.add(label.name);

		try {
			await octokit.rest.issues.createLabel({
				...repo,
				name: label.name,
				color,
				description: label.description,
			});

			logger.log(`Created label: ${label.name}`);
		}
		catch (error) {
			if(isRecord(error) && 'status' in error && (error as any).status === 422) {
				const result = await xatry(octokit.rest.issues.updateLabel({
					...repo,
					name: label.name,
					new_name: label.name,
					color,
					description: label.description,
				}), stringifyError);

				if(result.fails) {
					return result;
				}

				logger.log(`Updated label: ${label.name}`);
			}
			else {
				return err(stringifyError(error));
			}
		}
	}

	if(keepExisting) {
		logger.log('Keeping existing labels that are not in the configuration.');
		return;
	}

	await deleteMissingLabels(octokit, repo, desiredNames);
} // }}}

async function deleteMissingLabels(octokit: Octokit, repo: RepoReference, desiredNames: Set<string>): Promise<void> { // {{{
	const existingLabels = await octokit.paginate(octokit.rest.issues.listLabelsForRepo, {
		...repo,
		per_page: 100,
	});

	for(const existing of existingLabels) {
		if(!desiredNames.has(existing.name)) {
			try {
				await octokit.rest.issues.deleteLabel({ ...repo, name: existing.name });

				logger.log(`Deleted label: ${existing.name}`);
			}
			catch (error) {
				logger.warn(`Failed to delete label '${existing.name}': ${stringifyError(error)}`);
			}
		}
	}
} // }}}
