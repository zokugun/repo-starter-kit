import { Command } from '@zokugun/cli-utils/commander';
import pkg from '../package.json' with { type: 'json' };
import { run } from './run.js';

const program = new Command();

program
	.version(pkg.version, '-v, --version')
	.description(pkg.description)
	.option('-r, --repo <owner/name>', 'Target repository (OWNER/NAME)')
	.option('-c, --create', 'Create the repository if it does not exist', false)
	.option('-p, --package <name>', 'NPM package that includes a repo-starter-kit config file')
	.option('-k, --keep', 'Do not delete missing resources', false)
	.option('-o, --only <resources>', 'List of resources to only sync (categories,discussions,environments,issues,labels,rulesets,settings)')
	.action(run);

program.parse();
