#!/bin/bash
set -e

WIKI_URL="https://github.com/shteynu/aaet.wiki.git"
WIKI_DIR="../aaet.wiki"
LOCAL_WIKI_DIR=".github_wiki"

echo "Checking if remote Wiki repository exists..."
if ! git ls-remote "$WIKI_URL" &> /dev/null; then
  echo "Error: The Wiki repository does not exist on GitHub yet."
  echo "Please go to https://github.com/shteynu/aaet/wiki in your browser,"
  echo "click 'Create the first page', and click 'Save page' at the bottom to initialize it."
  exit 1
fi

echo "Cleaning up any old clone..."
rm -rf "$WIKI_DIR"

echo "Cloning the Wiki repository..."
git clone "$WIKI_URL" "$WIKI_DIR"

echo "Copying local wiki pages into the repository..."
cp -R "$LOCAL_WIKI_DIR/"* "$WIKI_DIR/"

cd "$WIKI_DIR"

# Check if there are any changes
if [[ -z "$(git status --porcelain)" ]]; then
  echo "No changes to push."
  exit 0
fi

echo "Staging changes..."
git add -A

echo "Committing pages..."
git commit -m "docs: import project documentation as wiki pages"

echo "Pushing wiki to GitHub..."
# Try to push to main or master depending on the default branch of the cloned repo
BRANCH=$(git branch --show-current)
git push origin "$BRANCH"

echo "Cleaning up..."
cd - > /dev/null
rm -rf "$WIKI_DIR"

echo "Success! The Wiki has been successfully updated on GitHub."
