---
title: Changelog
description: Lightweight release notes for user-visible Wayweft changes.
slug: docs/changelog
---

This changelog is intentionally lightweight. Record user-visible features, fixes, docs changes, and workflow updates here when they land.

## 2026-03-13

### Fixed

- Added broader built-in ignore defaults for generated output and vendored assets, including `build`, `.next`, `vendor`, and `*.min.js`.
- Documented how to extend built-in ignore defaults with `defaultIgnorePatterns` or override them completely with `ignore: []`.

### Added

- Added scan coverage that proves generated and vendored files stay out of the default inventory unless a repo opts back in.
- Introduced a self-hosted Astro + Starlight documentation site under `docs/`.
- Added a branded landing page at `/` and moved the documentation to `/docs/`.
- Added starter documentation for setup, CLI usage, configuration, CI, roadmap, and branding direction.
- Added CLI `--cwd` support and basic `--help` output for the primary commands.
- Added a dedicated `doctor` CLI reference page with sample setup-debugging output.

### Changed

- Added project guidance requiring documentation updates alongside feature and fix work.
- Expanded `wayweft doctor` to report config resolution, package and tsconfig discovery, active ignore patterns, and skill bundle installation status.
