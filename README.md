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
- [`_includes/header.html`](_includes/header.html): The layout of the page header
- [`assets/images/logo.png`](assets/images/logo.png): The claw logo
- [`_data/navigation.yml`](_data/navigation.yml): The contents of the navigation menu
- [`assets/css/`](assets/css/): Custom stylesheets for colors, fonts, and layout

## Getting a copy of the site locally

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

- [**Markdown Preview Enhanced**](https://marketplace.visualstudio.com/items?itemName=shd101wyy) - Use (Ctrl+Shift+V) to see how your changes will look

Videos or iframe embeds (like the calendar) won't show up in Markdown Preview. Nor will you be able to see the menu or the site's styles.  For those, you'll need to install a local server following the "Local Development" instructions below.

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

When you push changes, an automated pipeline runs that lints the site for errors and the publishes it to Github pages. If the lint validation fails, the site is blocked from publishing. Common reasons that validation might fail:

- Broken internal links (links to pages that don't exist)
- Missing `{{ site.baseurl }}` in internal links
- Insecure `http://` links (should use `https://`)
- Links pointing to old domains
- Duplicate page URLs or redirects
- More than one consecutive blank line in markdown files
- Trailing whitespace on any line
- No new line at the end of a file

To see if your changes were successfully deployed go to the [Actions tab](https://github.com/FRCTeam1073-TheForceTeam/frc1073.org/actions) in the GitHub repository.

## Approval Workflow

### How it Works

1. **Student creates a change**: Creates a branch and makes edits
2. **Student opens a Pull Request**: Describes what they changed
3. **Adult reviews**: Looks at the changes and leaves feedback
4. **Approval**: Once approved, the adult merges the PR
5. **Auto-publish**: Changes are immediately processed by GitHub Actions to go live!

## Automated Edits

The [`scripts/parse-calendar.js`](scripts/parse-calendar.js) script automatically updates the upcoming events section on the home page with the latest calendar entries. This script runs on a schedule via GitHub Actions to keep the homepage calendar fresh without manual updates. If the calendar receives last-minute updates, you can manually trigger the update by running the [update-calendar workflow](https://github.com/FRCTeam1073-TheForceTeam/frc1073.org/actions/workflows/update-calendar.yml) in the Actions tab.
