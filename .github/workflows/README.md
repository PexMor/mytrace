# GitHub Actions Workflows

## Jekyll Deployment (`jekyll.yml`)

This workflow builds and deploys the Jekyll documentation site with custom themes and plugins.

### Why Custom Workflow?

The default GitHub Pages action uses the `github-pages` gem which only includes a limited set of themes. Since we use `minimal-mistakes-jekyll`, we need a custom workflow that:

1. Installs Ruby and Bundler
2. Installs all gems from `docs/Gemfile` (including the custom theme)
3. Builds the Jekyll site
4. Deploys to GitHub Pages

### Repository Settings Required

**Important:** You need to configure your GitHub repository settings:

1. Go to **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to: **GitHub Actions**
   (NOT "Deploy from a branch")

### Workflow Triggers

- Automatically runs on push to `main` branch
- Can be manually triggered from the Actions tab

### Build Process

1. **Checkout**: Clones the repository
2. **Setup Ruby**: Installs Ruby 3.3 and runs `bundle install` with caching
3. **Setup Pages**: Configures GitHub Pages settings
4. **Build**: Runs `bundle exec jekyll build` with production environment
5. **Upload**: Creates artifact with built site
6. **Deploy**: Deploys to GitHub Pages

### Troubleshooting

If the build fails:

1. Check that `docs/Gemfile` lists all required gems
2. Verify `docs/_config.yml` uses valid theme and plugin names
3. Review the Actions log for specific error messages
4. Ensure repository settings use "GitHub Actions" as the source

### Local Development

To build locally with the same environment:

```bash
cd docs
bundle install
bundle exec jekyll serve --baseurl "/mytrace"
```

Visit: http://localhost:4000/mytrace/

