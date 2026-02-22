import c from 'ansi-colors';
import cliSpinners from 'cli-spinners';
import logUpdate from 'log-update';

export type IndicatorLoading = ReturnType<typeof setInterval>;
const { dots } = cliSpinners;

let $loading: IndicatorLoading | undefined;
let $progessFn: (() => void) | undefined;

export function check(message: string): void {
	logUpdate.persist(`${c.green(c.symbols.check)} ${message}`);
}

export function error(message: string): void {
	stop(`${c.red(c.symbols.cross)} ${c.bold('Error!')}`);

	console.log(message);
}

export function finish(duration: number): void {
	stop(`🏁 ${c.bold('Done')} (in ${duration}s).`);
}

export function log(message: string): void {
	logUpdate.persist(`${c.cyan(c.symbols.bullet)} ${message}`);
}

export function newLine(): void {
	logUpdate.persist('');
}

export function pause(): void {
	clearInterval($loading);
	logUpdate('');
}

export function progress(label: string): void {
	clearInterval($loading);

	let index = 0;

	$progessFn = () => {
		if(!$loading) {
			return;
		}

		logUpdate(`${c.cyan(dots.frames[index = ++index % dots.frames.length])} ${label}`);
	};

	$loading = setInterval($progessFn, cliSpinners.dots.interval);
}

export function resume(): void {
	if($progessFn) {
		$loading = setInterval($progessFn, cliSpinners.dots.interval);
	}
}

export function step(label: string): () => void {
	progress(c.bold(label) + c.dim('...'));

	return () => {
		check(c.bold(`${label}:`) + c.dim(' done'));
	};
}

export function stop(message: string = ''): void {
	clearInterval($loading);
	$loading = undefined;
	$progessFn = undefined;

	logUpdate(message);
}

export function warn(message: string): void {
	logUpdate.persist(`${c.magenta(c.symbols.warning)} ${message}`);
}
