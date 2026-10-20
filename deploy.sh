#!/usr/bin/env bash
# One-shot deploy of ResumeKit to Trinity (resume.kavilabs.dev)
set -euo pipefail
HOST=trinity
KEY=$HOME/.ssh/trinity_sandbox_ed25519
DEST=/opt/resumekit

rsync -az --delete --exclude venv --exclude .git --exclude __pycache__ \
  -e "ssh -i $KEY" ./ "$HOST:$DEST/"

ssh -i "$KEY" "$HOST" "cd $DEST && [ -d venv ] || python3 -m venv venv; ./venv/bin/pip -q install -r requirements.txt; systemctl restart resumekit"

sleep 2
curl -fsS https://resume.kavilabs.dev/api/health
