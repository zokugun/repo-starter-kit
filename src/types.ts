import { type Octokit } from '@octokit/rest';
import { type Browser, type Page } from 'playwright';

export type Category = {
	name: string;
	description?: string;
	emoji?: string;
	format: 'announcement' | 'answer' | 'open' | 'poll';
};

export type CliOptions = {
	create: boolean;
	keep: boolean;
	only?: string;
	package?: string;
	repo?: string;
};

export type Settings = {
	configPath?: string;
	extend: {
		categories: Category[];
		labels: Label[];
	};
	keep: boolean;
	migrate?: {
		labels: Record<string, string>;
	};
	repo: RepoReference;
	resources: {
		categories: boolean;
		discussions: boolean;
		environments: boolean;
		issues: boolean;
		labels: boolean;
		rulesets: boolean;
		settings: boolean;
	};
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

export type ExpectedFeatures = {
	discussions?: true;
	issues?: true;
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
	private: boolean;
};

export type OrderItem = 'discussion' | 'issue';

export type PackageConfig = {
	root: string;
	categories?: string;
	discussion?: string;
	environments?: string;
	labels?: string;
	newRepository?: string;
	issue?: string;
	rulesets?: string[];
	settings?: string;
	order?: OrderItem[];
};

export type ProjectConfig = {
	file: string;
	settings: Record<string, unknown>;
};

export type RepoReference = {
	owner: string;
	repo: string;
};

export type Environment = {
	branchPolicies: BranchPolicy[];
	canAdminsBypass: boolean;
	name: string;
	preventSelfReview: boolean;
	protectedBranches: boolean;
	reviewers: Reviewer[];
};

export type Reviewer = {
	type: 'user' | 'team';
	id: number | string;
};

export type BranchPolicy = {
	type: 'branch' | 'tag';
	name: string;
};

export type Ruleset = {
	name: string;
	enforcement: 'active' | 'disabled' | 'evaluate';
	target?: 'branch' | 'push' | 'tag';
	bypass_actors?: RulesetActor[];
	conditions?: {
		ref_name: {
			include: string[];
			exclude: string[];
		};
	};
	rules?: Rule[];
};

export type RulesetActor = {
	actor_id: number;
	actor_type: 'DeployKey' | 'Integration' | 'OrganizationAdmin' | 'RepositoryRole' | 'Team';
	bypass_mode: 'always' | 'exempt' | 'pull_request';
};

export type Rule =
	| CreationRule
	| DeletionRule
	| MergeQueueRule
	| NonFastForwardRule
	| PullRequestRule
	| RequiredDeploymentsRule
	| RequiredLinearHistoryRule
	| RequiredSignaturesRule
	| UpdateRule;

export type PullRequestRule = {
	type: 'pull_request';
	parameters?: {
		allowed_merge_methods: PullRequestMethod[];
		automatic_copilot_code_review_enabled: boolean;
		dismiss_stale_reviews_on_push: boolean;
		require_code_owner_review: boolean;
		require_last_push_approval: boolean;
		required_approving_review_count: number;
		required_review_thread_resolution: boolean;
	};
};

export type PullRequestMethod = 'merge' | 'squash' | 'rebase';

export type CreationRule = {
	type: 'creation';
};

export type DeletionRule = {
	type: 'deletion';
};

export type UpdateRule = {
	type: 'update';
	parameters?: {
		update_allows_fetch_and_merge: boolean;
	};
};

export type NonFastForwardRule = {
	type: 'non_fast_forward';
};

export type RequiredDeploymentsRule = {
	type: 'required_deployments';
	parameters?: {
		required_deployment_environments: string[];
	};
};

export type RequiredLinearHistoryRule = {
	type: 'required_linear_history';
};

export type RequiredSignaturesRule = {
	type: 'required_signatures';
};

export type MergeQueueRule = {
	type: 'merge_queue';
	parameters?: {
		check_response_timeout_minutes: number;
		grouping_strategy: 'ALLGREEN' | 'HEADGREEN';
		max_entries_to_build: number;
		max_entries_to_merge: number;
		merge_method: 'MERGE' | 'REBASE' | 'SQUASH';
		min_entries_to_merge: number;
		min_entries_to_merge_wait_minutes: number;
	};
};

export type RepositorySettings = {
	autoCloseIssues?: boolean;
	automatedSecurityFixes?: boolean;
	immutableReleases?: boolean;
	maxUpdatesPerPush?: number;
	vulnerabilityAlerts?: boolean;
};
