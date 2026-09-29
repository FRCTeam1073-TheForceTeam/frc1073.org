# FRC Team 1073 Website

This is the source for the FRC Team 1073 website, hosted on GitHub Pages.

- **URL**: https://frc1073.org/

## Local Development

### Prerequisites
- Ruby 2.7 or higher
- Bundler

### Setup

```bash
bundle install
bundle exec jekyll serve
```

The site will be available at `http://localhost:4000`

## Editing Content

Pages are written in Markdown. Edit `.md` files directly:
- `home.md` - Homepage
- `about.md` - About page
- etc.

## GitHub Pages & Deployment

This site is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

## Approval Workflow

### How it Works

1. **Student creates a change**: Creates a branch and makes edits
2. **Student opens a Pull Request**: Describes what they changed
3. **Adult reviews**: Looks at the changes and leaves feedback
4. **Approval**: Once approved, the adult merges the PR
5. **Auto-publish**: Changes are immediatly processed by Github actions to go live!
