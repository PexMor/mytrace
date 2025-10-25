# Documentation Structure

This document explains the organization of documentation in the vsc_ext project.

## Documentation Organization

### Root Level Files

**README.md** - Brief overview and quick start
- Installation instructions
- Key features
- Links to detailed documentation
- Configuration overview
- Keep it under 150 lines

**AGENTS.md** - Architecture and technical decisions
- System architecture
- Component design
- Integration with aitrace
- Technical trade-offs
- Future enhancements
- For both humans and AI agents

**CHANGELOG.md** - Version history
- Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format
- Adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
- Release notes for each version
- Planned features in [Unreleased] section

### docs/ Directory

**user-guide.md** - Comprehensive user documentation
- Installation steps
- Quick start guide
- Loading and viewing traces
- Configuration reference
- All commands explained
- Troubleshooting guide
- Usage examples
- Tips and tricks

**development.md** - Developer documentation
- Setup instructions
- Development workflow
- Project structure
- Building and packaging
- Testing procedures
- Debugging guide
- Code guidelines
- Contributing process

## Documentation Principles

### Avoid Redundancy

- Each topic covered in one place
- Cross-reference between docs
- Use links instead of duplicating

### Keep It Organized

- Root README is the entry point
- AGENTS.md for architecture/decisions
- Detailed guides in docs/
- CHANGELOG.md for history only

### Target Audience

**README.md**: All users (quick reference)
**docs/user-guide.md**: End users (comprehensive)
**docs/development.md**: Contributors (technical)
**AGENTS.md**: Developers and AI agents (architectural)

## Cross-References

### From README.md

Points to:
- `docs/user-guide.md` - for usage details
- `docs/development.md` - for setup/building
- `AGENTS.md` - for architecture
- `CHANGELOG.md` - for version history

### From user-guide.md

Points to:
- `docs/development.md` - for dev tasks
- `AGENTS.md` - for design decisions
- `CHANGELOG.md` - for what's new
- `../README.md` - for aitrace docs

### From development.md

Points to:
- `docs/user-guide.md` - for testing workflows
- `AGENTS.md` - for architecture understanding
- `CHANGELOG.md` - for version updates

## Maintenance

### When Adding Features

1. Update `CHANGELOG.md` (under [Unreleased])
2. Update `docs/user-guide.md` if user-facing
3. Update `docs/development.md` if affects dev workflow
4. Update `AGENTS.md` if architectural change
5. Keep `README.md` brief (link to details)

### Before Release

1. Move [Unreleased] items to new version in `CHANGELOG.md`
2. Verify all docs reflect new features
3. Update version in `package.json`
4. Ensure cross-references are valid

### Avoid

- Duplicating content across files
- Outdated information
- Implementation details in user docs
- User instructions in dev docs

## File Locations

```
vsc_ext/
├── README.md              # Brief overview
├── AGENTS.md              # Architecture
├── CHANGELOG.md           # Version history
│
├── docs/
│   ├── user-guide.md      # User documentation
│   ├── development.md     # Developer guide
│   └── DOCUMENTATION_STRUCTURE.md  # This file
│
├── src/
│   └── extension.ts       # Source code
│
├── .vscode/
│   ├── launch.json        # Debug config
│   └── tasks.json         # Build tasks
│
├── media/                 # Icons
├── package.json           # Manifest
├── tsconfig.json          # TypeScript config
├── .gitignore
├── .vscodeignore
└── out/                   # Compiled output (gitignored)
```

## Documentation Workflow

### For Users

1. Start with `README.md`
2. Read `docs/user-guide.md` for details
3. Check `CHANGELOG.md` for latest changes

### For Developers

1. Start with `README.md`
2. Read `docs/development.md` for setup
3. Read `AGENTS.md` for architecture
4. Check `CHANGELOG.md` for changes

### For Contributors

1. Read `docs/development.md` first
2. Understand architecture from `AGENTS.md`
3. Follow contribution guidelines
4. Update relevant docs with changes

