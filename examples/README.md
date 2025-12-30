# Examples

The files in this directory show how to structure reusable starter kits before publishing them to npm or referencing the raw files locally.

## Basic example

`examples/basic` bundles labels, an issue template, and a branch ruleset.

Run it locally against a sandbox repository:

```bash
npx @zokugun/repo-starter-kit \
  --repo <owner/name> \
  --package ./examples/basic
```

If you want to publish this folder as `@yourscope/repo-starter-kit-basic`, keep the `repo-starter-kit.yml` file so consumers can simply pass `--package @yourscope/basic`.

## Rulesets-only example

`examples/rulesets-only` demonstrates protecting release branches and enforcing signed tags without touching labels or issue templates.

```bash
npx @zokugun/repo-starter-kit \
  --repo <owner/name> \
  --rulesets ./examples/rulesets-only/rulesets.yml
```

Feel free to copy one of these folders, adjust the YAML/Markdown files, and publish them as your own starter kit packages.
