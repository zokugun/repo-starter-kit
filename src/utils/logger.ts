import c from 'ansi-colors';
import cliSpinners from 'cli-spinners';
import logUpdate from 'log-update';

export type IndicatorLoading = ReturnType<typeof setInterval>;
const { dots } = cliSpinners;

let $loading: IndicatorLoading | undefined;

export function check(message: string): void {
	logUpdate.persist(`${c.green(c.symbols.check)} ${message}`);
}

export function error(message: string): void {
	clearInterval($loading);

	logUpdate(`${c.red(c.symbols.cross)} ${c.bold('Error!')}`);

	console.log(message);
}

export function finish(duration: number): void {
	clearInterval($loading);

	logUpdate(`🏁 ${c.bold('Done')} (in ${duration}s).`);
}

export function log(message: string): void {
	logUpdate.persist(`${c.cyan(c.symbols.bullet)} ${message}`);
}

export function newLine(): void {
	logUpdate.persist('');
}

export function progress(label: string): void {
	clearInterval($loading);

	let index = 0;

	$loading = setInterval(() => {
		logUpdate(`${c.cyan(dots.frames[index = ++index % dots.frames.length])} ${label}`);
	}, cliSpinners.dots.interval);
}

export function step(label: string): () => void {
	progress(c.bold(label) + c.dim('...'));

	return () => {
		check(c.bold(`${label}:`) + c.dim(' done'));
	};
}

export function warn(message: string): void {
	logUpdate.persist(`${c.magenta(c.symbols.warning)} ${message}`);
}
