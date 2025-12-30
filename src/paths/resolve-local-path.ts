import path from 'node:path';
import untildify from 'untildify';
import { joinWithinRoot } from './join-within-root.js';

export function resolveLocalPath(value: string, { absolute, cwd }: { absolute?: boolean; cwd?: string } = {}): string | undefined {
	if(typeof value !== 'string' || value.length === 0) {
		return;
	}

	if(path.isAbsolute(value)) {
		if(!absolute) {
			return;
		}

		if(!cwd) {
			return value;
		}

		const relative = path.relative(cwd, value);

		if(relative.startsWith('..')) {
			return;
		}

		return value;
	}

	if(!/^..?|(?:..?|~)\/|[^@].*[/\\].*$/.test(value)) {
		return;
	}

	if(!cwd) {
		if(value.startsWith('~')) {
			return untildify(value);
		}
		else {
			return value;
		}
	}

	if(value.startsWith('~')) {
		value = untildify(value);

		const relative = path.relative(cwd, value);

		if(relative.startsWith('..')) {
			return;
		}

		return value;
	}
	else {
		const result = joinWithinRoot(cwd, value);
		if(result.fails) {
			return;
		}

		return result.value;
	}
}
