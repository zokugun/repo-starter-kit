import process from 'node:process';
import { logger } from '@zokugun/cli-utils';
import { isArray, isBoolean, isNonBlankString, isNullable, isRecord, isString } from '@zokugun/is-it-type';
import { type AsyncDResult, err, ok } from '@zokugun/xtry';
import { normalizeCategories } from '../categories/normalize-categories.js';
import { normalizeLabels } from '../labels/normalize-labels.js';
import { parseRepo } from '../repos/parse-repo.js';
import { type Settings, type CliOptions, type RepoReference } from '../types.js';
import { loadPackage } from '../utils/load-package.js';
import { loadProject } from './load-project.js';

// eslint-disable-next-line unicorn/prefer-set-has
const RESOURCES = ['categories', 'discussions', 'environments', 'issues', 'labels', 'rulesets', 'settings'];

export async function configure(options: CliOptions): AsyncDResult<Settings> {
	let configPath: string | undefined;
	let { keep } = options;
	let migrate: Settings['migrate'];
	let repo: RepoReference | undefined;
	const resources = {
		categories: true,
		discussions: true,
		environments: true,
		issues: true,
		labels: true,
		rulesets: true,
		settings: true,
	};
	const extend: Settings['extend'] = {
		categories: [],
		labels: [],
	};

	if(keep) {
		logger.info(`Argument - keep: ${keep}`);
	}

	const root = process.cwd();

	const project = await loadProject(root);
	if(project.fails) {
		return project;
	}

	if(project.value) {
		const { file, settings } = project.value;

		logger.info(`Found ${file}`);

		if(isString(settings.repository)) {
			const match = /\/\/github\.com\/([\w._-]+?)\/([\w._-]+?)(\.git)?$/.exec(settings.repository);

			if(!match) {
				return err(`Cannot detect github repository in ${project.value.file}`);
			}

			repo = {
				owner: match[1],
				repo: match[2],
			};

			logger.info(`Detected - owner: ${repo.owner}, repo: ${repo.repo}`);
		}

		if(isString(settings.package)) {
			configPath = settings.package;

			logger.info(`Detected - package: ${configPath}`);
		}

		if(isBoolean(settings.keep)) {
			keep = settings.keep;

			logger.info(`Detected - keep: ${keep}`);
		}

		if(isArray(settings.resources, (value) => isString(value) && RESOURCES.includes(value))) {
			const values = settings.resources as string[];

			logger.info(`Detected - resources: ${values.join(',')}`);

			resources.categories = values.includes('categories');
			resources.discussions = values.includes('discussions');
			resources.environments = values.includes('environments');
			resources.issues = values.includes('issues');
			resources.labels = values.includes('labels');
			resources.rulesets = values.includes('rulesets');
			resources.settings = values.includes('settings');
		}

		if(isRecord(settings.migrate)) {
			const labels = resources.labels && isRecord<string>(settings.migrate.labels, (_key, value) => isString(value)) ? settings.migrate.labels : {};

			migrate = {
				labels,
			};
		}

		if(isRecord(settings.extend)) {
			if(resources.categories && isArray(settings.extend.categories)) {
				const result = normalizeCategories(settings.extend.categories);
				if(result.fails) {
					return result;
				}

				extend.categories = result.value;
			}

			if(resources.labels && isArray(settings.extend.labels)) {
				const result = normalizeLabels(settings.extend.labels);
				if(result.fails) {
					return result;
				}

				extend.labels = result.value;
			}
		}
	}

	if(options.repo) {
		const result = parseRepo(options.repo);
		if(result.fails) {
			return result;
		}

		repo = result.value;

		if(options.package) {
			configPath = options.package;
		}
	}
	else if(!repo) {
		const packageResult = await loadPackage(root);
		if(packageResult.fails) {
			return packageResult;
		}

		logger.info('Found package.json');

		const packageJson = packageResult.value as { repository?: string | { type: string; url: string } };

		if(isNullable(packageJson.repository)) {
			return err('Cannot read "repository" property in package.json');
		}

		const url = isString(packageJson.repository) ? packageJson.repository : packageJson.repository.url;
		const match = /\/\/github\.com\/([\w._-]+?)\/([\w._-]+?)\.git/.exec(url);

		if(!match) {
			return err('Cannot detect github repository in package.json');
		}

		repo = {
			owner: match[1],
			repo: match[2],
		};

		logger.info(`Detected - owner: ${repo.owner}, repo: ${repo.repo}`);
	}

	if(!configPath) {
		if(project.value) {
			return err(`Cannot find the "package" property in ${project.value.file}`);
		}
		else {
			return err('Cannot find the "package" option');
		}
	}

	if(isNonBlankString<string>(options.only)) {
		const values = options.only.split(',');

		resources.categories = values.includes('categories') || values.includes('c');
		resources.discussions = values.includes('discussions') || values.includes('d');
		resources.environments = values.includes('environments') || values.includes('e');
		resources.issues = values.includes('issues') || values.includes('i');
		resources.labels = values.includes('labels') || values.includes('l');
		resources.rulesets = values.includes('rulesets') || values.includes('r');
		resources.settings = values.includes('settings') || values.includes('s');

		logger.info(`Argument - only: ${Object.entries(resources).filter(([, enabled]) => enabled).map(([name]) => name).join(', ')}`);
	}

	return ok({
		configPath,
		extend,
		keep,
		migrate,
		repo,
		resources,
	});
}
