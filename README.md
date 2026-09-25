# Engine-X

An interactive 3D anatomy of the turbocharger and a V-belt pulley drive — modeled part by part in Three.js, with sectioning, exploded views, X-ray mode and true kinematics.

## Structure

Everything lives at the repo root (no subfolders — easiest for uploading from a phone):

- `index.html` — cinematic homepage (trailer, founder credit, links into the atlas), plus a crawlable About/FAQ section, Schema.org JSON-LD (WebApplication + FAQPage + Person) and meta description for AEO/SEO
- `atlas.html` — the interactive 3D atlas itself, with a `<noscript>` fallback description for crawlers
- `boot.js` — loads the app's dependencies one at a time and shows a clear on-screen message naming exactly which file failed, instead of a silent stuck loader
- `llms.txt` — plain-text summary of the site for AI answer engines/crawlers
- `robots.txt`, `sitemap.xml` — standard crawler discovery files
- `blog.html` — blog listing page
- `blog-making-of.html` — first blog post: how Engine-X was built with Claude
- `styles.css`, `main.js`, `viewer.js`, `geom.js`, `materials.js`, `machines-index.js`, `turbo.js`, `pulleybelt.js` — the atlas's code

## Adding a new blog post

1. Copy `blog-making-of.html`, change its title/content/URL, and give it a new filename (keep it at the repo root — no subfolders).
2. Add a new `<a class="card">` entry to `blog.html` linking to it.
3. Add its URL to `sitemap.xml` and to the Pages list in `llms.txt`.

## Deploying to GitHub Pages

Settings → Pages → Source: Deploy from a branch → Branch: `main`, Folder: `/ (root)` → Save.

Engineered by Parth Parmar.
