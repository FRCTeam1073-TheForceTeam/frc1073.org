# FRC Team 1073 Website

This is the source for the FRC Team 1073 website, hosted on GitHub Pages.

- **URL**: https://frc1073.org/

## Editing Content

### Pages

Pages are written in Markdown. Edit `.md` files directly. See [this Markdown cheatsheet](https://www.markdownguide.org/cheat-sheet/) to know
how to use Markdown syntax. Pages are arranged in a directory structure that mirrors the menu:

- [`home.md`](home.md) - Homepage with its images in [`home/`](home/)
- [`support/sponsors.md`](support/sponsors.md) - Sponsor list page with its images in [`support/sponsors/`](support/sponsors/)
- [`resources/calendar.md`](resources/calendar.md) - Our calendar
- etc.

New pages need a section at the top called [Frontmatter](https://docs.github.com/en/contributing/writing-for-github-docs/using-yaml-frontmatter). At the very minimum, every page should have a layout, a page title, and a permalink that gives the page a URL.  For example:
```
---
layout: page
title: Team 1073 Calendar
permalink: /calendar/
---
```

### Page Header, Navigation Menu, and Site Style

Edit the following items to affect the look and feel of the entire site:

- [`_config.yml`](_config.yml): Site name and URL
- [`_includes/header.html`](_includes/header.html): The layout of the header with the logo and the navigation menu
- [`assets/images/logo.png`](assets/images/logo.png): The claw logo
- [`_data/navigation.yml`](_data/navigation.yml): The contents of the menu
- [`assets/css/`](assets/css/): Custom stylesheets for colors, fonts, and layout

## Checking out the site locally

Clone the repository on your computer to get a copy of the site that you can edit and test locally:

```bash
git clone https://github.com/FRC1073/frc1073.org.git
cd frc1073.org
```

On Windows, you may want to use graphical tools rather than the command line to do this:

- [Github Desktop](https://desktop.github.com/)
- [Git for Windows](https://gitforwindows.org/)

## Editing pages with vscode

We recommend using [VSCode](https://code.visualstudio.com/) for editing. This extension allows you to preview most pages:

- [**Markdown Preview Enhanced**](https://marketplace.visualstudio.com/items?itemName=shd101wyy) - Use the Markdown preview (Ctrl+Shift+V) to see how your changes will look

Videos or iframe embeds (like the calendar) won't show up in this preview. You'll need to install a local server to preview those pages.  See the "Local Development" instructions below.

## Local Development

### Prerequisites
- [Ruby 2.7 or higher](https://www.ruby-lang.org/en/downloads/)
- [Node.js and npm](https://nodejs.org/)
- [Bundler](https://bundler.io/)
- [GNU Make](https://www.gnu.org/software/make/)
- [pre-commit](https://pre-commit.com/)

### Setup

```bash
make install
make run
```

The site will be available at `http://localhost:4000`

## GitHub Pages & Deployment

This site is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

### CI/CD Pipeline

When you push changes, an automated pipeline runs:

1. **Pre-commit checks** run first, including a link validator that checks for:
   - Broken internal links (links to pages that don't exist)
   - Missing `{{ site.baseurl }}` in internal links
   - Insecure `http://` links (should use `https://`)
   - Links pointing to old domains
   - Duplicate page URLs or redirects

2. **If checks pass**, the site is built with Jekyll and deployed to GitHub Pages
3. **If checks fail**, deployment is blocked and the PR review will show what needs to be fixed

### Checking Deployment Status

To see if your changes were successfully deployed:

1. Go to the [Actions tab](https://github.com/FRCTeam1073-TheForceTeam/frc1073.org/actions) in the GitHub repository
2. Click on the latest workflow run
3. Look for the "Build and deploy to GitHub Pages" workflow
4. If all checks have a green checkmark ✅, your changes are live
5. If any checks have a red ❌, click on it to see what needs to be fixed

Common reasons for deployment failure:
- **Broken link**: You linked to a page that doesn't exist
- **Missing baseurl**: Internal links must use `{{ site.baseurl }}/path/to/page`
- **Insecure link**: External links must use `https://` not `http://`

## Approval Workflow

### How it Works

1. **Student creates a change**: Creates a branch and makes edits
2. **Student opens a Pull Request**: Describes what they changed
3. **Adult reviews**: Looks at the changes and leaves feedback
4. **Approval**: Once approved, the adult merges the PR
5. **Auto-publish**: Changes are immediately processed by GitHub Actions to go live!
