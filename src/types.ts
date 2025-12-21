export type CliOptions = {
	repo: string;
	labels?: string;
	issue?: string;
	package?: string;
	keepLabels: boolean;
};

export type RepoReference = {
	owner: string;
	repo: string;
};

export type Label = {
	name: string;
	color: string;
	description?: string;
};

export type Issue = {
	title: string;
	body: string;
	labels: string[];
};
