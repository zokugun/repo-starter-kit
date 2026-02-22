import { Command } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import { run } from './run.js';

const program = new Command();

program
	.version(pkg.version, '-v, --version')
	.description(pkg.description)
	.requiredOption('-r, --repo <owner/name>', 'Target repository (OWNER/NAME)')
	.option('-c, --create', 'Create the repository if it does not exist', false)
	.option('-p, --package <name>', 'NPM package that includes a repo-starter-kit config file')
	.option('-k, --keep', 'Do not delete missing items (labels, categories, rulesets)', false)
	.action(run);

program.parse();
