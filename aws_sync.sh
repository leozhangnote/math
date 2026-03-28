#!/usr/bin/env bash
set -euo pipefail

aws s3 sync ~/dev/math s3://www.funchildren.org/math/ \
  --profile note \
  --region us-east-1 \
  --exclude ".DS_Store" \
  --exclude ".claude/*" \
  --exclude ".git/*" \
  --exclude ".gitignore" \
  --exclude ".spechub/*"
