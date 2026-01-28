#!/bin/bash

# GitHub Secrets Setup Script
# This script adds all environment variables to GitHub repository secrets
# Usage: ./scripts/setup-github-secrets.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}GitHub Secrets Setup Script${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it with: sudo apt install gh"
    echo "Or visit: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Please authenticate with GitHub CLI:${NC}"
    gh auth login
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo -e "${GREEN}Setting up secrets for repository: $REPO${NC}"
echo ""

# Read .env.local file
if [ ! -f .env.local ]; then
    echo -e "${RED}Error: .env.local file not found${NC}"
    exit 1
fi

# Function to set secret
set_secret() {
    local name=$1
    local value=$2
    
    if [ -z "$value" ]; then
        echo -e "${YELLOW}⚠ Skipping $name (empty value)${NC}"
        return
    fi
    
    echo -e "${GREEN}✓ Setting secret: $name${NC}"
    echo "$value" | gh secret set "$name"
}

# Parse .env.local and set secrets
while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
    
    # Trim whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    
    # Skip GITHUB_ prefixed variables (GitHub doesn't allow them as secrets)
    if [[ "$key" =~ ^GITHUB_ ]]; then
        echo -e "${YELLOW}⚠ Skipping $key (GitHub doesn't allow secrets starting with GITHUB_)${NC}"
        continue
    fi
    
    # Set secret
    set_secret "$key" "$value"
done < .env.local

# Additional required secrets
echo ""
echo -e "${YELLOW}Setting additional required secrets...${NC}"

# GROQ_API_KEY (same as NEXT_PUBLIC_GROK_API_KEY)
GROK_KEY=$(grep "NEXT_PUBLIC_GROK_API_KEY" .env.local | cut -d '=' -f2 | xargs)
if [ -n "$GROK_KEY" ]; then
    set_secret "GROQ_API_KEY" "$GROK_KEY"
fi

# TWELVE_DATA_API_KEY (same as NEXT_PUBLIC_TWELVEDATA_API_KEY)
TWELVE_KEY=$(grep "NEXT_PUBLIC_TWELVEDATA_API_KEY" .env.local | cut -d '=' -f2 | xargs)
if [ -n "$TWELVE_KEY" ]; then
    set_secret "TWELVE_DATA_API_KEY" "$TWELVE_KEY"
fi

# TAVILY_API_KEY (same as NEXT_PUBLIC_TAVILY_API_KEY)
TAVILY_KEY=$(grep "NEXT_PUBLIC_TAVILY_API_KEY" .env.local | cut -d '=' -f2 | xargs)
if [ -n "$TAVILY_KEY" ]; then
    set_secret "TAVILY_API_KEY" "$TAVILY_KEY"
fi

# NEWS_API_KEY (same as NEXT_PUBLIC_NEWSAPI_KEY)
NEWS_KEY=$(grep "NEXT_PUBLIC_NEWSAPI_KEY" .env.local | cut -d '=' -f2 | xargs)
if [ -n "$NEWS_KEY" ]; then
    set_secret "NEWS_API_KEY" "$NEWS_KEY"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All secrets have been set!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Go to: https://github.com/$REPO/settings/secrets/actions"
echo "2. Verify all secrets are listed"
echo "3. Re-run failed GitHub Actions workflows"
echo "4. Dependabot PRs will now auto-merge after tests pass!"
echo ""
