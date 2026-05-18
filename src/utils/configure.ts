import process from 'node:process';
import { logger } from '@zokugun/cli-utils';
import { isArray, isBoolean, isNonBlankString, isNullable, isRecord, isString } from '@zokugun/is-it-type';
import { type AsyncDResult, err, ok } from '@zokugun/xtry';
import { parseRepo } from '../repos/parse-repo.js';
import { type Settings, type CliOptions, type Migrate, type RepoReference } from '../types.js';
import { loadPackage } from '../utils/load-package.js';
import { loadProject } from './load-project.js';

// eslint-disable-next-line unicorn/prefer-set-has
const RESOURCES = ['category', 'discussion', 'environment', 'issue', 'label', 'ruleset', 'setting'];

export async function configure(options: CliOptions): AsyncDResult<Settings> {
	let configPath: string | undefined;
	let { keep } = options;
	let migrate: Migrate | undefined;
	let repo: RepoReference;
	const resources = {
		categories: true,
		discussions: true,
		environments: true,
		issues: true,
		labels: true,
		rulesets: true,
		settings: false,
	};

	if(keep) {
		logger.info(`Argument - keep: ${keep}`);
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
	else {
		const root = process.cwd();

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

		const project = await loadProject(root);
		if(project.fails) {
			return project;
		}

		const { file, settings } = project.value;

		logger.info(`Found ${file}`);

		if(!isString(settings.package)) {
			return err(`Cannot find the "package" property in ${file}`);
		}

		configPath = settings.package;

		logger.info(`Detected - package: ${configPath}`);

		if(isBoolean(settings.keep)) {
			keep = settings.keep;
		}

		logger.info(`Detected - keep: ${keep}`);

		if(isRecord(settings.migrate)) {
			const labels = isRecord<string>(settings.migrate.labels, (_key, value) => isString(value)) ? settings.migrate.labels : {};

			migrate = {
				labels,
			};
		}

		if(isArray(settings.resources, (value) => isString(value) && RESOURCES.includes(value))) {
			const values = settings.resources as string[];

			logger.info(`Detected - resources: ${values.join(',')}`);

			resources.categories = values.includes('category');
			resources.discussions = values.includes('discussion');
			resources.environments = values.includes('environment');
			resources.issues = values.includes('issue');
			resources.labels = values.includes('label');
			resources.rulesets = values.includes('ruleset');
			resources.settings = values.includes('setting');
		}
	}

	if(isNonBlankString<string>(options.only)) {
		const values = options.only.split(',');

		resources.categories = values.includes('category') || values.includes('c');
		resources.discussions = values.includes('discussion') || values.includes('d');
		resources.environments = values.includes('environment') || values.includes('e');
		resources.issues = values.includes('issue') || values.includes('i');
		resources.labels = values.includes('label') || values.includes('l');
		resources.rulesets = values.includes('ruleset') || values.includes('r');
		resources.settings = values.includes('setting') || values.includes('s');

		logger.info(`Argument - only: ${Object.entries(resources).filter(([, enabled]) => enabled).map(([name]) => name).join(', ')}`);
	}

	return ok({
		configPath,
		keep,
		migrate,
		repo,
		resources,
	});
}
