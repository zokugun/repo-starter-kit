import path from 'node:path';
import fse from '@zokugun/fs-extra-plus/async';
import { isNonEmptyRecord } from '@zokugun/is-it-type';
import { err, type Result, stringifyError, type Success } from '@zokugun/xtry';

export async function loadPackage(root: string): Promise<Result<Record<string, unknown>, string>> {
	const content = await fse.readJSON(path.join(root, 'package.json'));
	if(content.fails) {
		return err(`Failed to read package.json: ${stringifyError(content.error)}`);
	}

	if(isNonEmptyRecord(content.value)) {
		return content as Success<Record<string, unknown>>;
	}

	return err('package.json isn\'t a record');
}
