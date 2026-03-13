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

## Current CLI behavior

Most commands can target another repository directly with `--cwd`, so you do not need to change directories before running a scan, fix, doctor check, or skill install.

## Near-term direction

As the tool grows, configuration should stay explicit and repo-local so agents and humans can reason about scan behavior without hidden defaults.
