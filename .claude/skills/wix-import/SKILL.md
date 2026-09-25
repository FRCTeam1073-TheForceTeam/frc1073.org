---
name: wix-import
description: Import and migrate pages from Wix to Jekyll. Use this skill whenever the user is migrating content from their Wix site to Jekyll, converting Wix pages to markdown, or batch-importing multiple Wix pages. Handles content extraction, image downloading, Jekyll frontmatter generation, and navigation updates.
compatibility: Requires Puppeteer scripts in .claude/scripts/ (fetch-wix-content.js, analyze-wix-layout.js)
---

# Import Wix Page to Jekyll

Migrate content from Wix to Jekyll by converting pages to markdown, downloading images, and updating navigation.

## Quick Reference

- **Base Wix URL**: `https://hbrb1073.wixsite.com/frc1073/`
- **Input**: Wix page URL(s) or page description (relative path or full description)
- **Output**: Jekyll markdown file + images in `/assets/` + updated `_data/navigation.yml`
- **Constraints**: No summarizing or paraphrasing; content must match Wix exactly

## Single Page Workflow

### 1. Extract Content from Wix

Use Puppeteer to render and extract content (Wix pages use JavaScript so WebFetch won't work):

```bash
node .claude/scripts/fetch-wix-content.js <wix-url>
```

This saves to `.tmp/wix-page/`:
- `page.html` — rendered HTML for reference
- `content.txt` — extracted text (innerText, excluding scripts/styles/nav/footer)
- `images.json` — metadata about images on the page

### 2. Analyze Page Layout and Image Placement

Map images to their positions relative to content sections:

```bash
# Generate basic layout (headings and images in order)
node .claude/scripts/analyze-wix-layout.js

# Generate detailed image-to-section mapping (RECOMMENDED)
node .claude/scripts/map-wix-images.js
```

Produces:
- `.tmp/wix-page/layout.json` — image order and section hierarchy
- `.tmp/wix-page/image-mapping.json` — detailed mapping of each image to its preceding section heading (use this for accurate placement!)

### 2.5. Check for Embedded Media

The text extraction (`content.txt`) only captures text via `innerText` and may miss:
- Embedded YouTube/video players
- Images used as backgrounds or in interactive components
- Embeds and iframes

**Search the raw HTML** for media that didn't appear in extracted text:

```bash
# Look for YouTube embeds
grep -i "youtube\|iframe" .tmp/wix-page/page.html

# Look for video sources
grep -i "video\|mp4\|webm" .tmp/wix-page/page.html

# Look for image sources not captured
grep -o 'src="https://[^"]*\.png\|jpg\|gif"' .tmp/wix-page/page.html | sort -u
```

**For videos**: Add `<iframe>` embeds directly to the markdown (YouTube, Vimeo, etc.)

**For background images**: Download them and reference with `![alt]({{ site.baseurl }}/assets/images/filename.jpg)`

**Why this matters**: Interactive elements and background media are integral to the page and must be preserved exactly.

### 3. Extract Main Content

Identify and extract the primary content area, excluding:
- Navigation, footers, sidebars, UI chrome
- Header/logo images (part of site chrome)

**Identifying boilerplate/header images:**
- **Logo/branding images at the top of every page** (site header, site logo, organization crest) are site chrome, NOT page content — exclude them
- **How to tell**: If an image appears in the same position on multiple imported pages, it's part of the header and should be excluded
- For this site: The FRC Team 1073 claw logo appears in the site header on every page — do NOT include it in page content
- Only include images that are **unique to this specific page's content**

**Important**: Include the main page heading/title that displays on the page (not just browser tab title).

### 4. Convert to Markdown

Transform content into clean Jekyll markdown:

- `#` for page title
- `##` for section headings
- `-` for bullet points
- `[text](url)` for links
- `![alt]({{ site.baseurl }}/assets/images/filename.jpg)` for images — **IMPORTANT: Always use `{{ site.baseurl }}` prefix in markdown content** so images load correctly when site has a baseurl configured

### 5. Match Wix URL Structure

Extract the page path from the Wix URL and use it for the Jekyll permalink:

- Wix: `https://hbrb1073.wixsite.com/frc1073/about-the-team` → Jekyll permalink: `/about-the-team/`
- If page exists with different permalink, update it
- **ALWAYS update `_data/navigation.yml`** to reference the correct path when URL structure changes
  - **Important**: Navigation URLs in `_data/navigation.yml` should be PLAIN PATHS (e.g., `/what-is-first/`) WITHOUT `{{ site.baseurl }}`
  - The template's `| prepend: site.baseurl` filter handles adding the baseurl automatically
  - Example: Page URL changes from `/about/what-is-first/` to `/what-is-first/` → update navigation url to `/what-is-first/`

**IMPORTANT: Wix uses flat URL structure** – all pages are at the root level like `/page-name/`, NOT nested like `/parent/child/`.

When the Jekyll navigation shows nested pages (e.g., "What is FIRST" under "About the Team"), those are organizational categories in Jekyll only. On Wix, search for the page at the flat path:
- Jekyll nav shows: `/about-the-team/what-is-first`
- Wix actually has: `/what-is-first/` (not nested)
- Try Wix URLs by extracting just the final segment: `https://hbrb1073.wixsite.com/frc1073/what-is-first`

### 5.5. Verify URL Structure and Navigation Updates

**CRITICAL: Do not skip this step.** Verify the URL was correctly extracted and matched, and that navigation was updated.

```bash
# 1. Verify the page's permalink matches the Wix path
# Extract the Wix path segment from the URL:
# Wix URL: https://hbrb1073.wixsite.com/frc1073/subgroupelectromechanical
# Path segment: /subgroupelectromechanical/

# Then confirm in the markdown file:
grep "^permalink:" pages/*/*.md pages/*.md | grep "/subgroupelectromechanical/"

# 2. Verify navigation.yml was updated if the URL changed
# Check that navigation points to the CORRECT URL, not the old one:
grep -A 2 "Electromechanical\|<page-title>" _data/navigation.yml | grep "url:"

# 3. If the page existed at a different URL before, verify it was updated:
# Example: If page was at /structure/electromechanical/ and should be /subgroupelectromechanical/:
grep "permalink:" pages/structure/electromechanical.md
# Should show: permalink: /subgroupelectromechanical/
# NOT: permalink: /structure/electromechanical/
```

**Verification checklist:**
- ✅ Permalink in markdown frontmatter matches Wix page path (e.g., `/subgroupelectromechanical/`)
- ✅ Navigation file updated to point to the new URL if it changed
- ✅ Old URL in navigation removed/updated (don't leave stale references)
- ✅ Page renders correctly at the new URL (test with dev server before committing)

### 6. Generate Jekyll Frontmatter

```yaml
---
layout: page
title: [Page Title]
permalink: /[wix-page-path]/
---
```

### 7. Create Markdown File

Place in appropriate location under `/pages/` or root, using naming convention matching site structure.

### 8. Download Images

If page has images (excluding header/logo):
- Download to `/assets/images/` with descriptive names (e.g., `page-title-image.png`)
- **Reference images using `{{ site.baseurl }}/assets/images/filename.jpg`** in markdown to ensure they load correctly when site has a baseurl configured (e.g., `baseurl: "/frc1073.org"`)

**IMPORTANT: Downloading from Wix URLs correctly:**
- Wix URLs in `images.json` include transformation parameters (`/v1/fill/`, `/v1/crop/`, query strings with `q=`, `enc_avif`, etc.)
- **Do NOT use these transformation URLs** — they can produce corrupted files
- **Extract the base URL**: Find the actual image URI before the `/v1/` path segment
  - Example: `https://static.wixstatic.com/media/f9b998_abc123~mv2.jpg/v1/fill/...` → use `https://static.wixstatic.com/media/f9b998_abc123~mv2.jpg`
- Download the base URL to get the full-resolution, uncorrupted original image
- Use `wget` with timeout: `wget --timeout=10 -q "<base-url>" -O filename.jpg`

### 8.5. Determine Image Placement by Section

**CRITICAL: Images must be placed in the correct section.** Use the reliable HTML analysis script to automatically determine correct placement.

**Method: Use map-wix-images.js for reliable image placement detection**

Run this script to analyze the downloaded HTML and map each image to its preceding section heading:

```bash
node .claude/scripts/map-wix-images.js
```

This generates `.tmp/wix-page/image-mapping.json` showing:
- Each image's alt text and dimensions
- The **preceding section heading** that appears before the image in the HTML
- Clear instruction for placement in markdown

**Example output:**
```
Image 1:
  Alt text: "software photo final.png"
  Size: 357x263
  Place this image in the markdown AFTER the "Who We Are" section heading.
```

**How the script works:**
1. Parses the downloaded `page.html` file
2. Finds all images ≥100×100px (ignores small icons/decorative images)
3. For each image, walks backwards through the HTML to find the nearest preceding `<h1>`-`<h3>` heading
4. Outputs the section where each image belongs

**Place the image in markdown:**
```markdown
## Who We Are

[Section text...]

![Image description]({{ site.baseurl }}/assets/images/image-name.png)

## Next Section

[Next section text...]
```
- Always place images immediately **after** the section content they follow in the HTML
- Use a blank line before and after the image markdown
- Use descriptive alt text that matches the image purpose

**Common mistakes to avoid:**
- ❌ Placing images at the end of the page instead of where they belong in the HTML order
- ❌ Using transformation URLs that produce corrupted image files
- ❌ Manually guessing placement instead of verifying with the mapping script
- ❌ Assuming images are sequential when they may be in different sections

### 9. Verify Accuracy

**CRITICAL: Remove ANY content not from the Wix page.**

Before finalizing, audit the markdown file to ensure it contains ONLY content extracted from Wix:
- ❌ **DO NOT include** placeholder text, boilerplate, templates, or "Lorem ipsum" content
- ❌ **DO NOT include** speculative future content, TBD sections, or "[Date TBD]" filler
- ❌ **DO NOT include** content from other sources, examples, or guides
- ✅ **ONLY include** text that appeared on the actual Wix page via `content.txt`
- ✅ **ONLY include** images that were in `images.json`
- ✅ **ONLY include** embeds found in the raw `page.html`

**How to verify:** Line-by-line comparison with `.tmp/wix-page/content.txt` — every sentence in the markdown should trace back to the extracted content. If you see content that doesn't appear in the extraction, delete it.

Then confirm extracted content matches Wix page exactly (not summarized or paraphrased):
- Compare every hyperlink in the Jekyll markdown against the Wix page source
- Verify link text matches exactly
- Verify link URLs match exactly (including protocols, paths, query parameters, fragments)
- Check for any missing links or modified URLs
- **Check for embedded media** that may have been missed: YouTube videos, iframes, background images
- Confirm all images from `images.json` are accounted for (either included or identified as site chrome)
- Verify video embeds are included exactly as they appear on Wix

**CRITICAL: Validate EVERY downloaded image is not corrupted:**

**MANDATORY for every page:** After downloading images, verify they are valid before deploying. This is required for all images on all pages.

```bash
# Check EVERY image downloaded for this page
cd /assets/images/
for img in page-name-*.{jpg,png,gif}; do
  echo -n "$img: "
  if identify "$img" 2>&1 | grep -q "error\|cannot"; then
    echo "❌ CORRUPTED - re-download using base URL"
  else
    identify "$img" | head -1
  fi
done

# Or check all images in the directory (after completing all page imports)
for img in *.{jpg,png,gif}; do
  [ -f "$img" ] || continue
  if ! identify "$img" 2>&1 >/dev/null | grep -q "error"; then
    echo "✓ $img"
  else
    echo "❌ $img CORRUPTED"
  fi
done
```

- Use `file` command to verify file type: `file image.jpg`
- Use `identify` (ImageMagick) to check dimensions and detect corruption: `identify image.jpg`
- If `identify` reports errors like "cannot open" or "error", the image is corrupted

**If images appear corrupted even after re-downloading from base URLs:**

Sometimes Wix images may have encoding issues even from the base URL. Try re-encoding the images with ImageMagick to create clean, valid copies:

```bash
# Re-encode a single image
convert corrupted-image.jpg -quality 90 corrupted-image-fixed.jpg
mv corrupted-image-fixed.jpg corrupted-image.jpg

# Re-encode all images in a directory
for img in *.jpg *.png; do
  [ -f "$img" ] || continue
  convert "$img" -quality 90 "${img%.*}-fixed.${img##*.}"
  mv "${img%.*}-fixed.${img##*.}" "$img"
  echo "Fixed: $img"
done
```

This creates fresh, clean image files that will display correctly. Verify with `identify` after re-encoding.

## Batch Processing

For multiple pages, repeat the workflow for each page. You can:

1. **Process in series** (recommended for accuracy):
   - Extract one page completely (steps 1–9)
   - Move to next page
   - Update `_data/navigation.yml` once at the end with all new pages

2. **Parallel extraction** (if extracting many pages):
   - Run fetch-wix-content.js for all pages in parallel to `.tmp/wix-page-<name>/`
   - Then process each one sequentially through conversion and image download

## Special Cases: Shop Pages

Shop pages **cannot be hosted on GitHub Pages** and must remain on Wix:

- **Do NOT convert shop pages to Jekyll** — link to them on Wix instead
- **Use Wix shop URL**: `https://hbrb1073.wixsite.com/shop` (or specific shop page)
- **Update navigation and links** to point to `https://hbrb1073.wixsite.com` for shop content
- **Replace old domain**: Change references from `https://frc1073.org` to `https://hbrb1073.wixsite.com` for shop-related links

## Critical Requirements

**NO SUMMARIZING, PARAPHRASING, OR SIMPLIFYING**

- **EVERY WORD** from the Wix page must be imported exactly as written
- **ALL LINKS** in imported text must be preserved exactly as they appear on Wix — verify every hyperlink URL matches the source
- **URL MUST MATCH WIX**: The Jekyll page's permalink must match the Wix page path (e.g., Wix `/about-the-team` → Jekyll `/about-the-team/`)
- **Navigation must be updated** if the permalink is changed
- **ALL IMAGES** from the Wix page must be downloaded and included (excluding header/logo/navigation images which are part of site chrome)
- **ALL DOCUMENTS/FILES** (PDFs, downloads, etc.) must be preserved
- The resulting Jekyll page must be an exact match of the Wix page content
- Do not condense, rephrase, reorganize, or omit any content
- Do not create placeholder or made-up content

## Tools and Scripts

**Puppeteer scripts in `.claude/scripts/`:**
- `fetch-wix-content.js` — Fetches page, saves HTML/text/images to `.tmp/wix-page/`
- `analyze-wix-layout.js` — Maps image positions relative to headings, saves to `.tmp/wix-page/layout.json`

**Working directory:** All temporary Wix page data goes to `.tmp/wix-page/` (git-ignored)

**Output locations:**
- Markdown files: `/pages/` or root (following site structure)
- Images: `/assets/images/` (with descriptive names)
- Documents: `/assets/docs/` or similar
- Navigation: `_data/navigation.yml`

## Domain Handling

When you encounter links pointing to `frc1073.org`:
- Change to either local Jekyll pages or to `https://hbrb1073.wixsite.com` (for shop/Wix-hosted content)
- Always match the original intent of the link
