# Engine-X

An interactive 3D anatomy of the turbocharger and a V-belt pulley drive — modeled part by part in Three.js, with sectioning, exploded views, X-ray mode and true kinematics.

## Structure

Everything lives at the repo root (no subfolders — easiest for uploading from a phone):

- `index.html` — cinematic homepage (trailer, founder credit, links into the atlas, the blog, and the "How it was built" story); kept clean, with Schema.org JSON-LD (WebApplication + Person) and meta description for AEO/SEO
- `atlas.html` — the interactive 3D atlas itself, with a `<noscript>` fallback description for crawlers
- `boot.js` — loads the app's dependencies one at a time and shows a clear on-screen message naming exactly which file failed, instead of a silent stuck loader
- `llms.txt` — plain-text summary of the site for AI answer engines/crawlers
- `robots.txt`, `sitemap.xml` — standard crawler discovery files
- `blog.html` — blog listing page (currently just the explainer post; the "how it was built" story is intentionally not listed here — see below)
- `blog-how-it-works.html` — explainer post: what Engine-X is, plus turbo lag, turbo vs supercharger, belt vs gear drives. The "Machines in the atlas" section on this page reads `machines-index.js` live at page-load time and lists every machine automatically (name, description, part count) — nothing here needs editing when a machine is added or removed.
- `blog-making-of.html` — standalone "how it was built" story, linked only from the homepage footer ("How it was built"), not from `blog.html`
- `styles.css`, `main.js`, `viewer.js`, `geom.js`, `materials.js`, `machines-index.js`, `turbo.js`, `pulleybelt.js` — the atlas's code

## Adding a new machine

Just add it to `machines-index.js` as usual (see the existing pattern in `turbo.js`/`pulleybelt.js`). As long as its exported object has `name`, `sub`, `pieces`, `color` and an `about` HTML string, it will automatically appear in the atlas AND in the "Machines in the atlas" section of `blog-how-it-works.html` — no separate blog file to upload or edit.

## Adding a new blog post

1. Copy `blog-how-it-works.html` or `blog-making-of.html`, change its title/content/URL, and give it a new filename (keep it at the repo root — no subfolders).
2. Add a new `<a class="card">` entry to `blog.html` linking to it.
3. Add its URL to `sitemap.xml` and to the Pages list in `llms.txt`.

## Deploying to GitHub Pages

Settings → Pages → Source: Deploy from a branch → Branch: `main`, Folder: `/ (root)` → Save.

Engineered by Parth Parmar.
