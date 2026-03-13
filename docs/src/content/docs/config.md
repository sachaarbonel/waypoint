---
title: Configuration
description: Current config surface and practical expectations.
slug: docs/config
---

Wayweft is intentionally light on configuration in its current form.

## What exists today

- scope selection through CLI flags
- output format selection through CLI flags
- changed-scope scanning relative to a Git reference
- repo-local ignore patterns for generated and vendored files

## Current CLI behavior

Most commands can target another repository directly with `--cwd`, so you do not need to change directories before running a scan, fix, doctor check, or skill install.

## Default ignore categories

Built-in defaults keep obvious scan noise out of the file inventory:

- generated output such as `dist`, `build`, and `.next`
- coverage reports and `__snapshots__`
- generated source files matching `*.generated.*`
- vendored assets such as `vendor/`, `vendors/`, and `*.min.js`

Wayweft also reads root and nested `.gitignore` and `.ignore` files while it walks the workspace, so repo-local ignore rules prune the scan inventory before analysis runs.

## Extending or overriding ignores

Use repo-local config when you want to scan something Wayweft would normally skip or when your repo has extra generated paths:

```ts
import { defaultIgnorePatterns, defineConfig } from "wayweft";

export default defineConfig({
  ignore: [...defaultIgnorePatterns, "**/custom-generated/**"],
});
```

If you need to opt back in completely, replace the defaults:

```ts
import { defineConfig } from "wayweft";

export default defineConfig({
  ignore: [],
});
```

## Near-term direction

As the tool grows, configuration should stay explicit and repo-local so agents and humans can reason about scan behavior without hidden defaults.
