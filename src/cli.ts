import { Command } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import { run } from './run.js';

const program = new Command();

program
	.version(pkg.version, '-v, --version')
	.description(pkg.description)
	.requiredOption('-r, --repo <owner/name>', 'Target repository (OWNER/NAME)')
	.option('-c, --create', 'Create the repository if it does not exist', false)
	.option('-l, --labels <path>', 'Path to labels YAML')
	.option('-i, --issue <path>', 'Path to issue Markdown template')
	.option('-b, --rulesets <path>', 'Path to branch rulesets YAML/JSON file')
	.option('-p, --package <name>', 'NPM package that includes a repo-starter-kit config file')
	.option('--keep-labels', 'Do not delete labels missing from the configuration', false)
	.option('--keep-rulesets', 'Do not delete rulesets missing from the configuration', false)
	.action(run);

program.parse();
