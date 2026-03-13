# Wayweft

Wayweft is a codebase intelligence layer for AI-assisted development. It helps teams review changes after a Claude or Codex session, detect duplication and refactor drift, preserve codebase context, and carry knowledge forward across sessions.

Today, Wayweft includes a TypeScript-first CLI for changed-scope review, refactoring opportunity detection, safe cleanup workflows, and agent-facing skill bundles for Codex and Claude.

## Status

This repository now includes:

- a TypeScript CLI and programmatic API
- workspace and monorepo discovery
- AST-based analysis with `ts-morph`
- text, JSON, Markdown, and SARIF reporting
- safe codemod scaffolding with dry-run/apply flow
- portable skill bundles for Codex and Claude
- root guidance templates for `AGENTS.md` and `CLAUDE.md`

## Commands

```bash
npm install
npm run build
npm run test

wayweft --help
wayweft scan --cwd /path/to/repo --scope workspace --format text
wayweft scan --cwd /path/to/repo --scope package:<name> --format json --output .tmp/wayweft.json
wayweft fix --cwd /path/to/repo --dry-run
wayweft skill install --cwd /path/to/repo
wayweft doctor --cwd /path/to/repo
```

## Run locally on a project

Build the tool once from this repository:

```bash
npm install
npm run build
```

Then scan a target project from any working directory by pointing the CLI at the repo:

```bash
node /absolute/path/to/wayweft/dist/cli.js --help
node /absolute/path/to/wayweft/dist/cli.js scan --cwd /path/to/project --scope workspace --format text
node /absolute/path/to/wayweft/dist/cli.js scan --cwd /path/to/project --scope package:web --format json --output .tmp/wayweft.json
node /absolute/path/to/wayweft/dist/cli.js fix --cwd /path/to/project --dry-run
```

If you want `wayweft` available as a normal shell command, link it globally from this repo:

```bash
npm link
```

Then use it from anywhere:

```bash
wayweft scan --cwd /path/to/project --scope workspace --format text
wayweft skill install --cwd /path/to/project
wayweft doctor --cwd /path/to/project
```

`doctor` is intended as a setup-debugging command. A typical run shows the resolved workspace root, config status, discovery assumptions, active ignore patterns, and skill bundle installation state:

```text
Workspace root: /path/to/project
Config: /path/to/project/wayweft.config.ts
Discovery markers: pnpm-workspace.yaml, turbo.json, nx.json, rush.json, package.json, .git
Package globs: apps/*, packages/*, services/*, libs/*
Packages discovered: 3
  - root (., tsconfig)
  - web (apps/web, tsconfig)
  - shared (packages/shared, no tsconfig)
Tsconfig files: 2
Files in scan inventory: 84
Ignore patterns (from config):
  - **/dist/**
  - **/coverage/**
Skill bundles:
  - root bundle files: 3/3 installed
  - package-local bundles: 2/3 packages
Doctor checks: ok
```

## Install the skill in a target repo

Install the skill bundle into a target repository with the built CLI:

```bash
node /absolute/path/to/wayweft/dist/cli.js skill install --cwd /path/to/project
```

If you already linked the package globally with `npm link`, use:

```bash
wayweft skill install --cwd /path/to/project
```

This writes the portable skill bundle and guidance files into the target repo, including:

- `tools/wayweft-skill`
- `.agents/skills/wayweft`
- `.claude/skills/wayweft`
- `AGENTS.md`
- `CLAUDE.md`

For monorepos, it also writes package-local copies under each discovered workspace package.

## Documentation site

This repo includes a minimal self-hosted docs site built with Astro + Starlight in [`docs/`](/Users/pratimbhosale/.codex/worktrees/0ac1/refactor-scout/docs).

Install dependencies for both apps:

```bash
npm install
npm --prefix docs install
```

Run the docs locally:

```bash
npm run docs:dev
```

Build the static site:

```bash
npm run docs:build
```

Preview the built output:

```bash
npm run docs:preview
```

The generated static files are written to `docs/dist`. Self-hosting is just serving that directory from any static file host or web server.

## Implemented v1 rules

- `long-function`
- `deep-nesting`
- `too-many-params`
- `boolean-param`
- `cross-package-duplication`
- `import-cycle`
- `boundary-violation`
- safe rewrite opportunities for direct boolean returns, nullish coalescing, and optional chaining
