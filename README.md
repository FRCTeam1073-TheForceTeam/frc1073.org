# FRC Team 1073 Website

This is the source for the FRC Team 1073 website, hosted on GitHub Pages.

- **URL**: https://frc1073.org/

## Editing Content

### Pages

Pages are written in Markdown `.md` files and can be edited directly. See [this Markdown cheatsheet](https://www.markdownguide.org/cheat-sheet/) to know
how to use Markdown syntax. Pages are arranged in a directory structure that mirrors the menu:

- [`home.md`](home.md) - Homepage with its images in [`home/`](home/)
- [`support/sponsors.md`](support/sponsors.md) - Sponsor list page with its images in [`support/sponsors/`](support/sponsors/)
- [`resources/calendar.md`](resources/calendar.md) - Our calendar
- etc.

Every page's Markdown needs a block at the top called [Frontmatter](https://docs.github.com/en/contributing/writing-for-github-docs/using-yaml-frontmatter). At the very minimum, every page should specify a layout, a page title, and a permalink that gives the page a URL.  For example:
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

## Quick Edits in GitHub's Web Interface

You can make quick edits to pages directly on GitHub without downloading anything. Simply:

1. Navigate to the file you want to edit in the [repository](https://github.com/FRCTeam1073-TheForceTeam/frc1073.org)
2. Click the pencil icon (✏️) in the top right of the file
3. Make your changes in the editor
4. Scroll down and click "Commit changes"
5. Choose "Create a new branch for this commit and start a pull request"
6. Click "Propose changes" and then "Create pull request"

Your changes will now be in a pull request waiting for review. This method works best for simple content edits and doesn't require any software installation.

## Getting a Copy of the Site Locally

Clone the repository on your computer to get a copy of the site that you can edit and test locally:

```bash
git clone https://github.com/FRC1073/frc1073.org.git
cd frc1073.org
```

On Windows, you may want to use graphical tools rather than the command line to do this:

- [Github Desktop](https://desktop.github.com/)
- [Git for Windows](https://gitforwindows.org/)

## Editing Pages with Visual Studio Code

We recommend using [VSCode](https://code.visualstudio.com/) for editing. In addition, installing one of the extensions makes editing markdown easier and provides a rendered preview:

- [**Markdown Preview Enhanced**](https://marketplace.visualstudio.com/items?itemName=shd101wyy) - Open the preview pane (Ctrl+Shift+V) to see how your changes will look.
- [**Markdown All in One**](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one) - Adds a formatting toolbar, keyboard shortcuts, and preview.

Videos or iframe embeds (like the calendar) won't show up in markdown previews. Nor will you be able to see the menu or the site's styles.  For those, you'll need to install a local server as described in the following section.

## Running the Full Site Locally

### Prerequisites
- [Ruby 2.7 or higher](https://www.ruby-lang.org/en/downloads/)
- [Node.js and npm](https://nodejs.org/)
- [Bundler](https://bundler.io/)
- [GNU Make](https://www.gnu.org/software/make/)
- [pre-commit](https://pre-commit.com/)

#### Installing Prerequisites

<details>
<summary>Windows</summary>

Using [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) (recommended):
```powershell
winget install RubyLang.Ruby RubyLang.RubyDevKit OpenJS.NodeJS Python.Python.3.12 PreCommit.PreCommit GnuWin32.Make
```

Or using [Chocolatey](https://chocolatey.org/):
```powershell
choco install make nodejs ruby pre-commit
```

Or install each manually from their download pages
</details>
<details>
<summary>macOS</summary>

```bash
# Install Homebrew first if you don't have it: https://brew.sh
brew install ruby node make pre-commit
sudo gem install bundler
```
</details>
<details>
<summary>Linux (Debian/Ubuntu)</summary>

```bash
sudo apt-get update
sudo apt-get install -y ruby ruby-dev build-essential nodejs npm python3-pipx make
pipx install pre-commit
sudo gem install bundler
```
</details>

### Running the Site

```bash
make install
make run
```

`make install` downloads and installs all required dependencies (Ruby gems, Node packages, and pre-commit hooks). `make run` starts the Jekyll development server with live reload, so your changes appear instantly in the browser. When you're done, stop the server with `make stop`.

The site will be available at `http://localhost:4000`

## GitHub Pages & Deployment

This site is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

### CI/CD Pipeline

When you push changes, an automated pipeline runs that lints the site for errors and the publishes it to GitHub pages. If the lint validation fails, the site is blocked from publishing. Common reasons that validation might fail:

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
