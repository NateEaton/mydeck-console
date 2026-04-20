#!/bin/bash
# Render nginx configs from .template files, substituting vars from .env.
# The rendered .conf files are gitignored; they're the copies you ship to the
# nginx container.
set -e

if [ ! -f .env ]; then
    echo "Error: .env not found. Create it with at least BRAVE_API_KEY set."
    exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "$BRAVE_API_KEY" ]; then
    echo "Warning: BRAVE_API_KEY is empty. Brave Search will return 401."
fi

shopt -s nullglob
templates=(nginx/*.conf.template)
if [ ${#templates[@]} -eq 0 ]; then
    echo "No nginx/*.conf.template files found."
    exit 1
fi

# Prefer envsubst (only touches vars we name); fall back to a sed that
# substitutes just ${BRAVE_API_KEY} so legitimate nginx $vars are preserved.
for template in "${templates[@]}"; do
    out="${template%.template}"
    if command -v envsubst >/dev/null 2>&1; then
        envsubst '${BRAVE_API_KEY}' < "$template" > "$out"
    else
        # Escape sed replacement metacharacters in the value.
        esc=$(printf '%s' "$BRAVE_API_KEY" | sed -e 's/[\/&|]/\\&/g')
        sed "s|\${BRAVE_API_KEY}|${esc}|g" "$template" > "$out"
    fi
    echo "Rendered $out"
done
