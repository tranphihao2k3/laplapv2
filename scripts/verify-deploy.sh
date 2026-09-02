#!/bin/sh
echo "=== Searching for nameToSlug in deployed bundle ==="
grep -rl "nameToSlug" /app/.next/ 2>/dev/null | head -3
echo "=== Check shopsService logic ==="
grep -l "ilike.*code.*slug\|slug.*-1" /app/.next/server/app/api/v1/shops/*.js 2>/dev/null | head -3
echo "=== Done ==="
