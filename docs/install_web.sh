#!/bin/bash
#
# Install Jekyll dependencies
# This script installs the required Ruby dependencies for building the documentation site with Jekyll.
# 
# "bundle" is the command-line tool for Bundler, which manages Ruby gem dependencies.
# Bundler installs the gems specified in the Gemfile (like jekyll, jekyll-remote-theme).
#
# Prerequisites (install via Homebrew if missing):
#   - ruby      : The Ruby interpreter, needed to run Bundler and Jekyll.
#   - bundler   : Ruby gem dependency manager (install with 'gem install bundler' after Ruby is installed).
#
# To install prerequisites on macOS:
#   brew install ruby
#   export PATH="$(brew --prefix ruby)/bin:$PATH"
#   gem install bundler
#
# Then run this script to install Jekyll dependencies locally in vendor/bundle.

# Set up Homebrew Ruby path
export PATH="$(brew --prefix ruby)/bin:$PATH"

if ! command -v bundle >/dev/null 2>&1; then
  echo "Bundler is not installed."
  echo "Install it with: gem install bundler"
  exit 1
fi

# Configure Bundler to install gems in vendor/bundle
bundle config set --local path 'vendor/bundle'

# Install dependencies
bundle install
