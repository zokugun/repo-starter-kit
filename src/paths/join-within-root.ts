import path from 'node:path';
import { type Result, err, ok } from '@zokugun/xtry';

export function joinWithinRoot(root: string, ...paths: string[]): Result<string, string> {
	const fullPath = path.join(root, ...paths);
	const relative = path.relative(root, fullPath);

	if(relative.startsWith('..')) {
		return err('not-within-root');
	}
	else {
		return ok(fullPath);
	}
}
