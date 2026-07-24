#!/bin/bash
# Varnar (blockerar INTE) när disken är kritiskt låg -- den här sessionen har upprepat
# fyllt disken till <1GB fritt via Playwright-cache/modellnedladdningar. Körs efter varje
# Bash-anrop (PostToolUse); exit 1 + stderr = icke-blockerande varning, syns för både
# användaren och Claude utan att stoppa nästa verktygsanrop.
AVAILABLE_KB=$(df -k "${CLAUDE_PROJECT_DIR:-.}" | tail -1 | awk '{print $4}')
THRESHOLD_KB=1048576   # 1 GB

if [ -n "$AVAILABLE_KB" ] && [ "$AVAILABLE_KB" -lt "$THRESHOLD_KB" ]; then
  AVAILABLE_MB=$((AVAILABLE_KB / 1024))
  echo "⚠️  Diskutrymme kritiskt lågt: ${AVAILABLE_MB}MB fritt. Överväg att städa Playwright-cachen (~/Library/Caches/ms-playwright) eller uppackade zip-filer i Models/ innan fler stora nedladdningar/installs." >&2
  exit 1
fi
exit 0
