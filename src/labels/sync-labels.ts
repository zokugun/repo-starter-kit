import logger from '@zokugun/cli-utils/logger';
import { isString } from '@zokugun/is-it-type';
import { stringifyError, xtry, type Failure } from '@zokugun/xtry/async';
import { type Context, type Label } from '../types.js';

export async function syncLabels(context: Context, labels: Label[], migrate?: Record<string, string>, keepExisting = false): Promise<Failure<string> | undefined> { // {{{
	const { octokit, owner, repositoryName } = context;

	if(labels.length === 0) {
		logger.warn('No labels defined; skipping label sync.');
		return;
	}

	const newToOld: Record<string, string> = {};
	if(migrate) {
		for(const [oldName, newName] of Object.entries(migrate)) {
			newToOld[newName] = oldName;
		}
	}

	const desiredNames = new Set<string>();

	for(const label of labels) {
		label.color = label.color.replace(/^#/, '').toLowerCase();

		if(!label.color) {
			logger.warn(`Skipping label '${label.name}' because it lacks a color.`);
			continue;
		}

		if(label.description && label.description.length > 100) {
			logger.warn(`Skipping label '${label.name}' because its description is too long (100 max).`);
			continue;
		}

		desiredNames.add(label.name);

		const existing = await xtry(octokit.rest.issues.getLabel({
			owner,
			repo: repositoryName,
			name: label.name,
		}), stringifyError);

		let oldie = false;
		const oldName = newToOld[label.name];

		if(oldName) {
			const result = await xtry(octokit.rest.issues.getLabel({
				owner,
				repo: repositoryName,
				name: oldName,
			}), stringifyError);

			oldie = !result.fails;
		}

		if(existing.fails) {
			if(oldie) {
				const result = await updateLabel(oldName, label, context);
				if(result) {
					return result;
				}
			}
			else {
				const result = await createLabel(label, context);
				if(result) {
					return result;
				}
			}
		}
		else {
			const result = await updateLabel(label.name, label, context);
			if(result) {
				return result;
			}

			if(oldie) {
				const items = await listItemsWithLabel(oldName, context);
				if(items.fails) {
					return items;
				}

				for(const item of items.value) {
					const issueNumber = item.number;
					const currentLabelNames = item.labels.map((label) => isString(label) ? label : label.name).filter(Boolean) as string[];
					const filtered = currentLabelNames.filter((name) => name !== oldName);

					if(!filtered.includes(label.name)) {
						filtered.push(label.name);
					}

					const result = await xtry(octokit.rest.issues.update({
						owner,
						repo: repositoryName,
						issue_number: issueNumber,
						labels: filtered,
					}), stringifyError);

					if(result.fails) {
						return result;
					}

					logger.info(`Updated #${issueNumber}: [${currentLabelNames.join(', ')}] -> [${filtered.join(', ')}]`);
				}
			}
		}
	}

	if(keepExisting) {
		logger.info('Keeping existing labels that are not in the configuration.');
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

				logger.info(`Deleted label: ${existing.name}`);
			}
			catch (error) {
				logger.warn(`Failed to delete label '${existing.name}': ${stringifyError(error)}`);
			}
		}
	}
} // }}}

async function createLabel(label: Label, context: Context): Promise<Failure<string> | undefined> { // {{{
	const result = await xtry(context.octokit.rest.issues.createLabel({
		owner: context.owner,
		repo: context.repositoryName,
		name: label.name,
		color: label.color,
		description: label.description,
	}), stringifyError);

	if(result.fails) {
		return result;
	}

	logger.info(`Created label: ${label.name}`);
} // }}}

async function updateLabel(oldName: string, label: Label, context: Context): Promise<Failure<string> | undefined> { // {{{
	const result = await xtry(context.octokit.rest.issues.updateLabel({
		owner: context.owner,
		repo: context.repositoryName,
		name: oldName,
		new_name: label.name,
		color: label.color,
		description: label.description,
	}), stringifyError);

	if(result.fails) {
		return result;
	}

	logger.info(`Updated label: ${label.name}`);
} // }}}

async function listItemsWithLabel(label: string, context: Context) { // {{{
	const page = xtry(context.octokit.paginate(context.octokit.rest.issues.listForRepo, {
		owner: context.owner,
		repo: context.repositoryName,
		labels: label,
		state: 'all',
		per_page: 100,
	}), stringifyError);

	return page;
} // }}}
