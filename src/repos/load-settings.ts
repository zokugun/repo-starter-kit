import { readFile } from 'node:fs/promises';
import { isBoolean, isNumber, isRecord, isUndefined } from '@zokugun/is-it-type';
import { type AsyncDResult, err, ok, stringifyError } from '@zokugun/xtry';
import YAML from 'yaml';
import { type RepositorySettings } from '../types.js';

export async function loadSettings(filename: string): AsyncDResult<RepositorySettings> {
	let content: string;

	try {
		content = await readFile(filename, 'utf8');
	}
	catch (error) {
		return err(`Failed to read ${filename} from package: ${stringifyError(error)}`);
	}

	const data: unknown = YAML.parse(content);

	if(!isRecord(data)) {
		return err(`settings file ${filename} must contain a record.`);
	}

	let autoCloseIssues: boolean | undefined;
	let automatedSecurityFixes: boolean | undefined;
	let immutableReleases: boolean | undefined;
	let maxUpdatesPerPush: number | undefined;
	let vulnerabilityAlerts: boolean | undefined;

	if(!isUndefined(data['auto-close-issues'])) {
		if(!isBoolean(data['auto-close-issues'])) {
			return err('Setting auto-close-issues must be a boolean');
		}

		autoCloseIssues = data['auto-close-issues'];
	}

	if(!isUndefined(data['automated-security-fixes'])) {
		if(!isBoolean(data['automated-security-fixes'])) {
			return err('Setting automated-security-fixes must be a boolean');
		}

		automatedSecurityFixes = data['automated-security-fixes'];
	}

	if(!isUndefined(data['immutable-releases'])) {
		if(!isBoolean(data['immutable-releases'])) {
			return err('Setting immutable-releases must be a boolean');
		}

		immutableReleases = data['immutable-releases'];
	}

	if(!isUndefined(data['max-updates-per-push'])) {
		if(!isNumber(data['max-updates-per-push'])) {
			return err('Setting max-updates-per-push must be a number');
		}

		maxUpdatesPerPush = data['max-updates-per-push'];
	}

	if(!isUndefined(data['vulnerability-alerts'])) {
		if(!isBoolean(data['vulnerability-alerts'])) {
			return err('Setting vulnerability-alerts must be a boolean');
		}

		vulnerabilityAlerts = data['vulnerability-alerts'];
	}

	return ok({
		autoCloseIssues,
		automatedSecurityFixes,
		immutableReleases,
		maxUpdatesPerPush,
		vulnerabilityAlerts,
	});
}
