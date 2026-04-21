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

if [ -z "$READECK_UPSTREAM" ]; then
    echo "Error: READECK_UPSTREAM not set in .env (e.g. READECK_UPSTREAM=http://readeck:8000)."
    exit 1
fi

shopt -s nullglob
templates=(nginx/*.conf.template)
if [ ${#templates[@]} -eq 0 ]; then
    echo "No nginx/*.conf.template files found."
    exit 1
fi

# Prefer envsubst (only touches vars we name); fall back to a sed that
# substitutes just ${BRAVE_API_KEY} so legitimate nginx $vars are preserved.
escape_sed() {
    printf '%s' "$1" | sed -e 's/[\/&|]/\\&/g'
}

for template in "${templates[@]}"; do
    out="${template%.template}"
    if command -v envsubst >/dev/null 2>&1; then
        envsubst '${BRAVE_API_KEY} ${READECK_UPSTREAM}' < "$template" > "$out"
    else
        brave_esc=$(escape_sed "$BRAVE_API_KEY")
        upstream_esc=$(escape_sed "$READECK_UPSTREAM")
        sed -e "s|\${BRAVE_API_KEY}|${brave_esc}|g" \
            -e "s|\${READECK_UPSTREAM}|${upstream_esc}|g" \
            "$template" > "$out"
    fi
    echo "Rendered $out"
done
