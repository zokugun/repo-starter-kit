export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	if(!error || typeof error !== 'object') {
		return false;
	}

	return 'code' in error;
}
