---
title: "CLI: doctor"
description: Inspect workspace discovery, config resolution, ignores, and skill bundle status.
slug: docs/cli/doctor
---

`wayweft doctor` is the setup-debugging command for a target repository. It prints what Wayweft detected, which defaults it used, and whether the local skill bundles are installed.

## Example

```bash
wayweft doctor --cwd /path/to/repo
```

## Sample output

```text
Workspace root: /path/to/repo
Config: /path/to/repo/wayweft.config.ts
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
  - **/build/**
  - **/coverage/**
  - **/*.generated.*
  - **/*.min.js
Skill bundles:
  - root bundle files: 3/3 installed
  - package-local bundles: 2/3 packages
Doctor checks: ok
```

## What to look for

- A missing config line means Wayweft is using built-in defaults.
- Discovery markers and package globs show the assumptions used to resolve the workspace.
- Package and tsconfig counts confirm whether monorepo structure was detected correctly.
- Skill bundle counts show whether `wayweft skill install` has already been run for the repo.
