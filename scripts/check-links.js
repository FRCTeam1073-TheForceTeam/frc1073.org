#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

// Configuration
const REPO_ROOT = path.resolve(__dirname, '..');
const ASSET_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico',
  'pdf', 'css', 'scss', 'js', 'woff', 'woff2', 'ttf', 'json', 'xml', 'txt'
]);

// State
const validUrls = new Set();
const redirectUrls = new Map(); // url -> { file, canonicalUrl }
const permalinksByUrl = new Map(); // normalized url -> [{ file, lineNum }]
const redirectsByUrl = new Map(); // normalized url -> [{ file }]
const failures = [];
const collisions = [];

// Utility: normalize a URL for comparison
function normalizeUrl(url) {
  // Decode URL-encoded characters (%20 → space, etc.)
  let decoded = decodeURIComponent(url);
  // Strip query and hash, normalize trailing slash
  let normalized = decoded.split('?')[0].split('#')[0];
  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

// Utility: extract front matter from markdown
function extractFrontMatter(content) {
  if (!content.startsWith('---')) return {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    return yaml.load(match[1]) || {};
  } catch (e) {
    return {};
  }
}

// Utility: extract markdown body (without front matter)
function extractBody(content) {
  if (!content.startsWith('---')) return content;
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
  return match ? match[1] : content;
}

// Utility: compute Jekyll's default permalink from file path
function computeDefaultPermalink(filePath) {
  let rel = path.relative(REPO_ROOT, filePath);
  if (rel.endsWith('/index.md') || rel.endsWith('/index.markdown')) {
    return '/' + rel.replace(/\/index\.markdown?$/, '').replace(/\\/g, '/');
  }
  return '/' + rel.replace(/\.markdown?$/, '.html').replace(/\\/g, '/');
}

// Step 1: Discover files via git
function discoverFiles() {
  const output = execSync('git ls-files -co --exclude-standard', { cwd: REPO_ROOT, encoding: 'utf-8' });
  const files = output.trim().split('\n').filter(Boolean);

  // Directories to exclude (build output, infrastructure, generated content)
  const excludeDirs = new Set([
    '_site',
    '_site-verify',
    '.claude',
    '.git',
    'node_modules'
  ]);

  const shouldExclude = (file) => {
    for (const dir of excludeDirs) {
      if (file.startsWith(dir + '/')) {
        return true;
      }
    }
    return false;
  };

  const markdown = [];
  const assets = [];

  for (const file of files) {
    if (shouldExclude(file)) continue;

    if (file.endsWith('.md') || file.endsWith('.markdown')) {
      markdown.push(path.join(REPO_ROOT, file));
    } else {
      const ext = path.extname(file).toLowerCase().slice(1);
      if (ASSET_EXTENSIONS.has(ext)) {
        assets.push(file); // Relative path for asset URLs
      }
    }
  }

  return { markdown, assets };
}

// Step 2: Build valid-URL list and redirect map
function buildValidUrlsAndRedirects(markdownFiles, assetFiles) {
  // Add static assets
  for (const asset of assetFiles) {
    validUrls.add('/' + asset.replace(/\\/g, '/'));
  }

  // Parse markdown for permalinks and redirects
  // Only process files with front matter (Jekyll pages)
  for (const mdFile of markdownFiles) {
    const content = fs.readFileSync(mdFile, 'utf-8');
    if (!content.startsWith('---')) {
      // Skip non-Jekyll files (documentation, references)
      continue;
    }
    const frontMatter = extractFrontMatter(content);

    let permalink = frontMatter.permalink;
    if (!permalink) {
      permalink = computeDefaultPermalink(mdFile);
    }

    const normalized = normalizeUrl(permalink);
    validUrls.add(normalized);

    if (!permalinksByUrl.has(normalized)) {
      permalinksByUrl.set(normalized, []);
    }
    permalinksByUrl.get(normalized).push({ file: mdFile, lineNum: 1 });

    // Handle redirect_from
    let redirectFrom = frontMatter.redirect_from;
    if (redirectFrom) {
      const redirects = Array.isArray(redirectFrom) ? redirectFrom : [redirectFrom];
      for (const redirect of redirects) {
        const redirectNormalized = normalizeUrl(redirect);
        redirectUrls.set(redirectNormalized, { file: mdFile, canonicalUrl: normalized });

        if (!redirectsByUrl.has(redirectNormalized)) {
          redirectsByUrl.set(redirectNormalized, []);
        }
        redirectsByUrl.get(redirectNormalized).push({ file: mdFile });
      }
    }
  }
}

// Step 3: Collision detection
function detectCollisions(markdownFiles) {
  // Check for duplicate permalinks
  for (const [url, entries] of permalinksByUrl.entries()) {
    if (entries.length > 1) {
      collisions.push({
        type: 'duplicate-permalink',
        url,
        files: entries.map(e => e.file)
      });
    }
  }

  // Check for redirect_from collisions with another file's permalink/redirect_from
  for (const mdFile of markdownFiles) {
    const content = fs.readFileSync(mdFile, 'utf-8');
    // Skip files without front matter
    if (!content.startsWith('---')) {
      continue;
    }
    const frontMatter = extractFrontMatter(content);
    let redirectFrom = frontMatter.redirect_from;

    if (redirectFrom) {
      const redirects = Array.isArray(redirectFrom) ? redirectFrom : [redirectFrom];
      for (const redirect of redirects) {
        const redirectNormalized = normalizeUrl(redirect);

        // Check if this redirect matches another file's permalink
        const permalinkEntries = permalinksByUrl.get(redirectNormalized) || [];
        for (const entry of permalinkEntries) {
          if (entry.file !== mdFile) {
            collisions.push({
              type: 'redirect-permalink-collision',
              url: redirectNormalized,
              redirectFile: mdFile,
              permalinkFile: entry.file
            });
          }
        }

        // Check if this redirect matches another file's redirect_from
        const redirectEntries = redirectsByUrl.get(redirectNormalized) || [];
        for (const entry of redirectEntries) {
          if (entry.file !== mdFile) {
            collisions.push({
              type: 'duplicate-redirect',
              url: redirectNormalized,
              files: [mdFile, entry.file]
            });
          }
        }
      }
    }
  }
}

// Step 4: Parse navigation.yml
function parseNavigation() {
  const navFile = path.join(REPO_ROOT, '_data', 'navigation.yml');
  if (!fs.existsSync(navFile)) return [];

  const content = fs.readFileSync(navFile, 'utf-8');
  const nav = yaml.load(content) || [];

  const links = [];

  function walk(items, breadcrumb = []) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const crumb = [...breadcrumb, item.title || ''];

      if (item.url) {
        links.push({
          url: item.url,
          location: crumb.join(' > '),
          file: navFile,
          lineNum: 1 // YAML line numbers are hard to track; use 1 as placeholder
        });
      }

      if (item.children) {
        walk(item.children, crumb);
      }
    }
  }

  walk(nav);
  return links;
}

// Step 5: Extract links from markdown body
function extractMarkdownLinks(body) {
  const links = [];

  // Markdown links [text](url)
  const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = mdLinkRegex.exec(body)) !== null) {
    links.push({ url: match[2] });
  }

  // Markdown images ![alt](url)
  const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = mdImageRegex.exec(body)) !== null) {
    links.push({ url: match[2] });
  }

  // HTML href and src (handle both double and single quotes, accounting for nested quotes)
  const htmlDoubleQuoteRegex = /(?:href|src)="([^"]+)"/g;
  while ((match = htmlDoubleQuoteRegex.exec(body)) !== null) {
    links.push({ url: match[1] });
  }
  const htmlSingleQuoteRegex = /(?:href|src)='([^']+)'/g;
  while ((match = htmlSingleQuoteRegex.exec(body)) !== null) {
    links.push({ url: match[1] });
  }

  return links;
}

// Step 6: Check link validity
function checkLink(url, file, context) {
  // Skip anchors, mailto, tel
  if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
    return { valid: true };
  }

  // External URLs: handle special cases
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    // Special case: frc1073.org links should be relative links using {{ site.baseurl }}
    if (url.includes('frc1073.org')) {
      return {
        valid: false,
        reason: 'links to frc1073.org should be relative links using {{ site.baseurl }}',
        rawUrl: url
      };
    }
    // Special case: hbrb1073.wixsite.com is an old domain, but shop URLs are temporarily OK
    if (url.includes('hbrb1073.wixsite.com')) {
      if (url.includes('/frc1073/product-page/') || url.includes('/frc1073/shop')) {
        // Temporary: using Wix shop URLs until GitHub Pages shop is set up
        return { valid: true };
      }
      // Old domain, should migrate away
      return {
        valid: false,
        reason: 'links to old Wix domain (hbrb1073.wixsite.com) — migrate to new URL or remove',
        rawUrl: url
      };
    }
    // Allow https:// URLs, flag http:// as insecure
    if (url.startsWith('https://') || url.startsWith('//')) {
      return { valid: true };
    }
    // http:// is insecure
    if (url.startsWith('http://')) {
      return {
        valid: false,
        reason: 'insecure link (http://) — use https://',
        rawUrl: url
      };
    }
  }

  // For markdown content: must start with {{ site.baseurl }}
  if (context === 'markdown') {
    if (!url.startsWith('{{ site.baseurl }}')) {
      if (url.startsWith('{{') || url.startsWith('{%')) {
        return {
          valid: false,
          reason: 'uses Liquid filter instead of {{ site.baseurl }}',
          rawUrl: url
        };
      }
      return {
        valid: false,
        reason: 'internal link must use {{ site.baseurl }}',
        rawUrl: url
      };
    }

    // Strip {{ site.baseurl }} prefix
    const stripped = url.slice('{{ site.baseurl }}'.length);
    const normalized = normalizeUrl(stripped);

    if (validUrls.has(normalized)) {
      return { valid: true };
    }

    if (redirectUrls.has(normalized)) {
      const redirect = redirectUrls.get(normalized);
      return {
        valid: false,
        reason: `points to a redirect, canonical URL is ${redirect.canonicalUrl}`,
        rawUrl: url
      };
    }

    return {
      valid: false,
      reason: 'not found',
      rawUrl: url
    };
  }

  // For navigation.yml: bare paths are expected, no baseurl required
  const normalized = normalizeUrl(url);

  if (validUrls.has(normalized)) {
    return { valid: true };
  }

  if (redirectUrls.has(normalized)) {
    const redirect = redirectUrls.get(normalized);
    return {
      valid: false,
      reason: `points to a redirect, canonical URL is ${redirect.canonicalUrl}`,
      rawUrl: url
    };
  }

  return {
    valid: false,
    reason: 'not found',
    rawUrl: url
  };
}

// Step 7: Process all markdown files for links
function checkMarkdownLinks(markdownFiles) {
  const linksByFile = new Map();

  for (const mdFile of markdownFiles) {
    const content = fs.readFileSync(mdFile, 'utf-8');
    // Skip files without front matter (not Jekyll pages)
    if (!content.startsWith('---')) {
      continue;
    }
    const body = extractBody(content);
    const links = extractMarkdownLinks(body);

    if (links.length > 0) {
      linksByFile.set(mdFile, links);
    }
  }

  // Now check each link and report failures
  for (const [file, links] of linksByFile.entries()) {
    for (const link of links) {
      const result = checkLink(link.url, file, 'markdown');
      if (!result.valid) {
        failures.push({
          file,
          url: link.url,
          reason: result.reason
        });
      }
    }
  }
}

// Step 8: Process navigation.yml for links
function checkNavigationLinks(navLinks) {
  for (const navLink of navLinks) {
    const result = checkLink(navLink.url, navLink.file, 'navigation');
    if (!result.valid) {
      failures.push({
        file: navLink.file,
        location: navLink.location,
        url: navLink.url,
        reason: result.reason
      });
    }
  }
}

// Step 9: Report results
function reportResults() {
  // Report collisions
  for (const collision of collisions) {
    if (collision.type === 'duplicate-permalink') {
      console.log(`COLLISION: Multiple files declare permalink ${collision.url}:`);
      for (const file of collision.files) {
        console.log(`  ${path.relative(REPO_ROOT, file)}`);
      }
    } else if (collision.type === 'redirect-permalink-collision') {
      console.log(`COLLISION: ${path.relative(REPO_ROOT, collision.redirectFile)} has redirect_from: ${collision.url}, but ${path.relative(REPO_ROOT, collision.permalinkFile)} has permalink: ${collision.url}`);
    } else if (collision.type === 'duplicate-redirect') {
      console.log(`COLLISION: Multiple files have redirect_from: ${collision.url}:`);
      for (const file of collision.files) {
        console.log(`  ${path.relative(REPO_ROOT, file)}`);
      }
    }
  }

  // Report failures grouped by file
  const failuresByFile = new Map();
  const failuresByReason = new Map(); // Track counts by reason

  for (const failure of failures) {
    if (!failuresByFile.has(failure.file)) {
      failuresByFile.set(failure.file, []);
    }
    failuresByFile.get(failure.file).push(failure);

    // Track failure reason counts - simplify for grouping
    let reasonKey = failure.reason;
    // Simplify multi-part reasons to just the first part
    if (reasonKey.includes(', canonical URL is')) {
      reasonKey = 'points to a redirect';
    } else if (reasonKey.includes(' — ')) {
      reasonKey = reasonKey.split(' — ')[0];
    }
    failuresByReason.set(reasonKey, (failuresByReason.get(reasonKey) || 0) + 1);
  }

  for (const [file, fileFailures] of failuresByFile.entries()) {
    console.log(`${path.relative(REPO_ROOT, file)}:`);
    for (const failure of fileFailures) {
      const location = failure.location ? ` (${failure.location})` : '';
      console.log(`  ${failure.url}${location} — ${failure.reason}`);
    }
  }

  // Print summary if there are issues
  if (collisions.length > 0 || failures.length > 0) {
    console.log('');
    if (collisions.length > 0) {
      console.log(`collisions: ${collisions.length}`);
    }
    for (const [reason, count] of Array.from(failuresByReason.entries()).sort()) {
      console.log(`${reason}: ${count}`);
    }
    process.exit(1);
  }
}

// Main
function main() {
  const { markdown, assets } = discoverFiles();
  buildValidUrlsAndRedirects(markdown, assets);
  detectCollisions(markdown);

  const navLinks = parseNavigation();

  checkMarkdownLinks(markdown);
  checkNavigationLinks(navLinks);

  reportResults();
}

main();
