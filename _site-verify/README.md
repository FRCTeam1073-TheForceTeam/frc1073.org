# FRC Team 1073 Website

This is the source for the FRC Team 1073 website, hosted on GitHub Pages.

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

## File Structure

```
.
├── _config.yml           # Site configuration
├── index.md              # Homepage
├── pages/                # Page content
│   ├── about.md          # About the team
│   ├── structure.md      # Team subgroups (Electromechanical, Software, Business, Strategy)
│   ├── resources.md      # Competition schedule, events, technical resources
│   ├── safety.md         # Safety policies and guidelines
│   ├── support.md        # Donations and sponsorship information
│   ├── raffle.md         # 2026 Raffle information
│   ├── media.md          # News, photos, videos, press coverage
│   ├── shop.md           # Team merchandise store
│   └── contact.md        # Contact information
├── files/                # PDFs, documents, engineering notebooks
└── _data/                # Data files (for navigation, etc.)
```

## Editing Content

### For Students (Visual Editing)
1. Make changes in a new branch
2. Create a Pull Request
3. Wait for adult approval
4. Changes are automatically published when merged!

### For Adults (Approvers)
1. Review Pull Requests from students
2. Leave comments or request changes
3. Approve and merge when ready

### Direct Markdown Editing
Pages are written in Markdown. Edit `.md` files directly:
- `index.md` - Homepage
- `pages/about.md` - About page
- etc.

## GitHub Pages & Deployment

This site is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

- **Live URL**: https://FRCTeam1073-TheForceTeam.github.io/website/
- **Custom Domain**: (configure in GitHub settings)

## Approval Workflow

### How it Works

1. **Student creates a change**: Creates a branch and makes edits
2. **Student opens a Pull Request**: Describes what they changed
3. **Adult reviews**: Looks at the changes and leaves feedback
4. **Approval**: Once approved, the adult merges the PR
5. **Auto-publish**: Changes go live immediately!

### Setting Up Approvals

To require adult approval before publishing:
1. Go to Settings → Branches
2. Add a branch protection rule for `main`
3. Require pull request reviews before merging
4. Require approval from code owners

## Content Migration from Wix

✅ **Migrated Content:**
- Homepage with 2026 season highlights
- About page with team mission and 2026 accomplishments
- Team structure pages (Electromechanical, Software, Business, Strategy)
- Competition schedule and resources
- Safety policies and guidelines
- Support and sponsorship information
- Raffle information and details
- Media and news page
- Team merchandise store page
- Contact information
- Social media links

## Next Steps

1. [ ] Add team photos and competition photos to `/media.md`
2. [ ] Upload engineering notebooks and PDFs to `/files/`
3. [ ] Link to external merchandise shop (if available)
4. [ ] Set up custom domain (if desired)
5. [ ] Configure branch protection rules for approval workflow
6. [ ] Set up Decap CMS for visual editing (optional - allows students to edit without git)
7. [ ] Add specific mentors/leadership bios
8. [ ] Create detailed sponsorship packages page
9. [ ] Add video gallery/highlights

## Questions?

Contact the team: contact@frc1073.org
