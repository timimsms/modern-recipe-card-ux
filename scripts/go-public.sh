#!/usr/bin/env bash
# The launch button. HELD until Tim runs it by hand — nothing in the repo or CI calls this.
#
# Everything before this point is done: history is clean by construction (this repo only ever
# received scrubbed objects), licensing and provenance are in place, and the Pages workflow is
# committed. This script only flips the switches, in the safe order: visibility first, because
# enabling Pages needs it on a free plan; deploy last, because it publishes the site.
set -euo pipefail

REPO=timimsms/modern-recipe-card-ux

echo "This will make $REPO PUBLIC and deploy the showcase site."
read -r -p "Type 'go' to continue: " answer
[ "$answer" = "go" ] || { echo "aborted"; exit 1; }

gh repo edit "$REPO" --visibility public --accept-visibility-change-consequences
echo "→ public"

# Pages, served by the Actions workflow (not a branch).
gh api -X POST "repos/$REPO/pages" -f build_type=workflow 2>/dev/null \
  || gh api -X PUT "repos/$REPO/pages" -f build_type=workflow >/dev/null
echo "→ Pages enabled (Actions build)"

gh workflow run pages.yml --repo "$REPO" --ref main
echo "→ deploy started; watch with: gh run watch --repo $REPO"
echo
echo "Site will be at: https://timimsms.github.io/modern-recipe-card-ux/"
