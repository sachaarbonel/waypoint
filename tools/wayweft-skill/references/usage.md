# Usage

- Workspace scan: `wayweft scan --scope workspace --format text`
- Package scan: `wayweft scan --scope package:<name> --format markdown`
- Changed files: `wayweft scan --scope changed --since origin/main --format json`
- Safe fixes: `wayweft fix --dry-run`
