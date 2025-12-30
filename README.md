[@zokugun/repo-starter-kit](https://github.com/zokugun/repo-starter-kit)
========================================================================

[![MIT licensed](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@zokugun/repo-starter-kit.svg?colorB=green)](https://www.npmjs.com/package/@zokugun/repo-starter-kit)
[![Donation](https://img.shields.io/badge/donate-ko--fi-green)](https://ko-fi.com/daiyam)
[![Donation](https://img.shields.io/badge/donate-liberapay-green)](https://liberapay.com/daiyam/donate)
[![Donation](https://img.shields.io/badge/donate-paypal-green)](https://paypal.me/daiyam99)


Command-line helper to bootstrap and sync repository settings (labels, issues, branch rulesets and basic config) from a reusable package or local files.

Why use this tool?

- Reuse a central `repo-starter-kit` configuration published as an npm package or provide local files to keep repositories consistent.
- Manage issue templates and labels programmatically.
- Lightweight CLI with interactive prompts when needed.

Quick start
-----------

Install globally with npm:

```bash
npm install -g @zokugun/repo-starter-kit
```

Or run directly with npx:

```bash
npx @zokugun/repo-starter-kit --repo owner/name --package @your/package
```

Usage
-----

Basic example:

```bash
repo-starter-kit --repo daiyam/temp --package @daiyam/default --keep-labels
```

Options
-------

- `-r, --repo <owner/name>`: Target repository (OWNER/NAME). Required.
- `-l, --labels <path>`: Path to a labels YAML file to apply to the repository. Supports local files or npm URLs such as `npm:@scope/config/labels.yml`.
- `-i, --issue <path>`: Path to a Markdown file used as an issue template. Supports local files or npm URLs such as `npm:@scope/config/issue.md`.
- `-b, --rulesets <path>`: Path to a YAML/JSON file containing branch rulesets definitions. Supports local files or npm URLs such as `npm:@scope/config/rulesets.yml`.
- `-p, --package <name>`: An npm package or a direct directory that includes a `repo-starter-kit` configuration file to apply.
- `--keep-labels`: Do not delete labels missing from the provided configuration (defaults to `false`).
- `--keep-rulesets`: Do not delete branch rulesets missing from the provided configuration (defaults to `false`).
- `-v, --version`: Show version number.

Examples
--------

- Apply a published starter package to a repository:

```bash
repo-starter-kit -r myuser/myrepo -p @myorg/myconfig
```

- Apply local labels file and an issue template (do not remove existing labels):

```bash
repo-starter-kit -r myuser/myrepo -l labels.yml -i issue.md -k
```

Configuration package
---------------------

The configuration package need to be prefixed:
- `--package @daiyam/default` will load the package `@daiyam/repo-starter-kit-default`

At its root, it needs to have one of the following file:
- `repo-starter-kit.yml`
- `repo-starter-kit.yaml`
- `repo-starter-kit.json`

With its content as:

```yaml
labels: <path to labels file>
issue: <path to issue file>
rulesets: <path to branch rulesets file>
```

Each `<path>` can be either a relative file path inside the package or an npm URL that references another published package (for example `npm:@scope/reusable-kit/labels.yml`).

For reference, please check https://github.com/daiyam/repo-starter-kit-default.

### Branch rulesets

Each ruleset entry mirrors the payload accepted by the [GitHub branch rulesets API](https://docs.github.com/en/rest/repos/rules?apiVersion=2022-11-28#create-a-repository-ruleset). The file must contain an array of objects, for example:

```yaml
- name: Protect main
    enforcement: active
    target: branch
    conditions:
        ref_name:
            include:
                - refs/heads/main
    rules:
        - type: pull_request
            parameters:
                required_approving_review_count: 1
```

Examples
--------

The `examples/` directory in this repository contains ready-to-use folders showing how to bundle labels, issues, and branch rulesets. Use them directly:

```bash
npx @zokugun/repo-starter-kit --repo <owner/name> --package ./examples/basic/
```

or publish one of the folders as an npm package (each folder already includes a `repo-starter-kit.yml` manifest) so you can pass `--package @scope/name`.

Donations
---------

Support this project by becoming a financial contributor.

<table>
    <tr>
        <td><img src="https://raw.githubusercontent.com/daiyam/assets/master/icons/256/funding_kofi.png" alt="Ko-fi" width="80px" height="80px"></td>
        <td><a href="https://ko-fi.com/daiyam" target="_blank">ko-fi.com/daiyam</a></td>
    </tr>
    <tr>
        <td><img src="https://raw.githubusercontent.com/daiyam/assets/master/icons/256/funding_liberapay.png" alt="Liberapay" width="80px" height="80px"></td>
        <td><a href="https://liberapay.com/daiyam/donate" target="_blank">liberapay.com/daiyam/donate</a></td>
    </tr>
    <tr>
        <td><img src="https://raw.githubusercontent.com/daiyam/assets/master/icons/256/funding_paypal.png" alt="PayPal" width="80px" height="80px"></td>
        <td><a href="https://paypal.me/daiyam99" target="_blank">paypal.me/daiyam99</a></td>
    </tr>
</table>

License
-------

Copyright &copy; 2025-present Baptiste Augrain

Licensed under the [MIT license](https://opensource.org/licenses/MIT).
