import { isError } from '@zokugun/is-it-type';
import { err, stringifyError, xtry, type Failure } from '@zokugun/xtry/async';
import { type Context, type Label } from '../types.js';
import * as logger from '../utils/logger.js';

export async function syncLabels(context: Context, labels: Label[], keepExisting = false): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

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
				owner,
				repo: repositoryName,
				name: label.name,
				color,
				description: label.description,
			});

			logger.log(`Created label: ${label.name}`);
		}
		catch (error) {
			if(isError(error) && 'status' in error && error.status === 422) {
				const result = await xtry(octokit.rest.issues.updateLabel({
					owner,
					repo: repositoryName,
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

	await deleteMissingLabels(context, desiredNames);
} // }}}

async function deleteMissingLabels(context: Context, desiredNames: Set<string>): Promise<void> { // {{{
	const { octokit, owner, repositoryName } = context;
	const existingLabels = await octokit.paginate(octokit.rest.issues.listLabelsForRepo, {
		owner,
		repo: repositoryName,
		per_page: 100,
	});

	for(const existing of existingLabels) {
		if(!desiredNames.has(existing.name)) {
			try {
				await octokit.rest.issues.deleteLabel({ owner, repo: repositoryName, name: existing.name });

				logger.log(`Deleted label: ${existing.name}`);
			}
			catch (error) {
				logger.warn(`Failed to delete label '${existing.name}': ${stringifyError(error)}`);
			}
		}
	}
} // }}}
