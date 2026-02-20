import c from 'ansi-colors';
import { type BooleanPromptOptions } from 'enquirer';

export function confirm(data: { name: string; message: string }): BooleanPromptOptions {
	return {
		type: 'confirm',
		format(value) {
			return value ? c.cyan('Yes') : c.cyan('No');
		},
		...data,
	};
}
