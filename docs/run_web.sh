#!/bin/bash

# Set up Homebrew Ruby path
export PATH="$(brew --prefix ruby)/bin:$PATH"

# Run the web server (without livereload to avoid port conflicts)
# Filter out Sass deprecation warnings (from theme, not our code)
bundle exec jekyll serve --incremental --watch --port 8000 --host 0.0.0.0 2>&1 | \
  awk '
    # Skip deprecation warning blocks
    /DEPRECATION WARNING|Deprecation Warning/ { in_warning=1; next }
    in_warning && /done in.*seconds/ { in_warning=0; print; next }
    in_warning { next }
    # Skip repetitive warning messages
    /Warning:.*repetitive|Run in verbose mode/ { next }
    # Print everything else
    { print }
  '