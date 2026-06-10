#!/bin/bash
# Run this ONCE from your local machine to create the GitHub repo and enable Pages
# Prerequisites: gh CLI installed and authenticated (gh auth login)

set -e

REPO_NAME="ARVIO-scrapers"
GITHUB_USER=$(gh api user --jq '.login')

echo "Creating repo: $GITHUB_USER/$REPO_NAME"

# Create the repo
gh repo create "$REPO_NAME" --public --source=/root/ARVIO/scrapers --push --description "ARVIO embed scrapers for cineby.at, bcine.ru, flixer.su, flickystream.su, rivestream.app, cinevibe.asia, popcornmovies.org"

# Enable GitHub Pages
gh api repos/$GITHUB_USER/$REPO_NAME/pages -X POST -f source[branch]=master -f source[path]=/

echo ""
echo "✅ Done! Your manifest URL (wait ~1 min for Pages deploy):"
echo "https://$GITHUB_USER.github.io/$REPO_NAME/plugins.json"
echo ""
echo "Add this to ARVIO: Settings → Plugins → Add Repository"
echo "Paste: https://$GITHUB_USER.github.io/$REPO_NAME/plugins.json"