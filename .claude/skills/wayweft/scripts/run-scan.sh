#!/usr/bin/env bash
set -euo pipefail

wayweft scan --format json --output .tmp/wayweft.json "$@"
