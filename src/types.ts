import { type Octokit } from '@octokit/rest';
import { type Browser, type Page } from 'playwright';

export type Category = {
	name: string;
	description?: string;
	emoji?: string;
	format: 'announcement' | 'answer' | 'open' | 'poll';
};

export type CliOptions = {
	repo: string;
	create: boolean;
	package?: string;
	keep: boolean;
};

export type Config = {
	root: string;
	categories?: string;
	discussion?: string;
	labels?: string;
	newRepository?: string;
	issue?: string;
	rulesets?: string[];
	order?: OrderItem[];
};

export type Context = {
	owner: string;
	repositoryName: string;
	repositoryId?: string;
	octokit: Octokit;
	browser?: Browser;
	page?: Page;
};

export type PagedContext = Context & {
	browser: Browser;
	page: Page;
};

export type Discussion = {
	title: string;
	body: string;
	category: string;
	labels: string[];
	close?: 'resolved' | 'outdated';
	pin?: boolean;
	lock?: boolean;
};

export type Issue = {
	title: string;
	body: string;
	labels: string[];
	close?: 'completed' | 'stale';
	pin?: boolean;
	lock?: boolean;
};

export type Label = {
	name: string;
	color: string;
	description?: string;
};

export type NewRepository = {
	features: {
		discussions: boolean;
		issues: boolean;
		projects: boolean;
		wiki: boolean;
	};
};

export type OrderItem = 'discussion' | 'issue';

export type RepoReference = {
	owner: string;
	repo: string;
};

export type Ruleset = Record<string, unknown> & {
	name: string;
};
