#!/bin/bash

# Set up Homebrew Ruby path
export PATH="$(brew --prefix ruby)/bin:$PATH"

# Filter out Sass deprecation warnings (from theme, not our code)
bundle exec jekyll serve --incremental --watch --port 8000 --host 0.0.0.0