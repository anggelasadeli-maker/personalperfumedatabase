# Fragrance Archive

A static site for your perfume collection. No backend, no database — just a JSON file the page reads and renders.

## Files
- `index.html` — page structure
- `style.css` — visual design
- `script.js` — reads `data.json` and builds the accord wheel, collection grid, and gap table
- `data.json` — **this is the only file you'll edit day-to-day**

## Preview it locally first
Browsers block `fetch()` on files opened directly (`file://`), so run a tiny local server from inside the folder:

```bash
cd perfume-site
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Edit `data.json`, save, refresh — no rebuild step needed.

## Put it on GitHub Pages (free hosting)

1. **Create a repo on GitHub** — go to github.com, click "New repository", name it something like `fragrance-archive`, keep it public, don't initialize with a README (you already have one).

2. **Push this folder to it**, from inside `perfume-site`:
   ```bash
   git init
   git add .
   git commit -m "Initial fragrance archive"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/fragrance-archive.git
   git push -u origin main
   ```

3. **Turn on Pages**: on GitHub, go to your repo → Settings → Pages → under "Build and deployment", set Source to "Deploy from a branch" → Branch: `main`, folder: `/ (root)` → Save.

4. Wait ~1 minute, then your site is live at:
   ```
   https://YOUR_USERNAME.github.io/fragrance-archive/
   ```

## Adding a new perfume
Since your tracker lives in Google Sheets, add the new row there first, then regenerate `data.json`:
- **Manual**: open `data.json`, add a new object to the `perfumes` array matching the existing shape (name, brand, notes.top/mid/base/general, accordFamily, season, occasion, rating, pricePerMl, rebuy, etc.)
- **Scripted**: File → Download → Comma-separated values (.csv) from Google Sheets, then re-run the conversion script (ask me to regenerate it any time — it reads the CSV export and rebuilds `data.json` automatically, including the occasion-tag typo fix).

Commit and push `data.json` — the live site updates automatically.

## Adding AI-assisted note lookup (optional, later)
Since this site is static (no server), don't call the Claude API directly from `script.js` — that would expose an API key to anyone who views your page source. Instead, do the AI step **offline**, before you commit:
- Write a small Python or n8n script that takes a perfume name, calls the Claude API (or searches Fragrantica) to get its note pyramid, and appends the result to `data.json`.
- Run that script locally whenever you add a bottle, then commit the updated `data.json`.

This keeps the live site simple and free, with all the "AI" work happening in your own pipeline, not in the browser.
