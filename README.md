# SalesPulse — Daily Sales Ledger

A small sales-performance dashboard: today's KPIs, a daily leaderboard per sales rep,
and revenue/order trend charts — backed by a single Supabase Postgres function.

```
frontend/   → static HTML/CSS/JS (Chart.js), talks to the backend
backend/    → Flask proxy that forwards requests to Supabase and adds CORS
database/   → schema.sql: the table + aggregation function to run in Supabase
```

## 1. Set up Supabase (do this first — it's the only manual data step)

1. Go to [supabase.com](https://supabase.com) → create a free account → **New project**.
2. Once it's created, open **SQL Editor** → **New query**.
3. Paste the entire contents of [`database/schema.sql`](./database/schema.sql) and click **Run**.
   This creates the `orders` table, adds a few sample rows, and creates the
   `get_dashboard_data()` function that the app calls.
4. Go to **Project Settings → Data API** and copy your **Project URL**.
   Your RPC endpoint is:
   ```
   https://<project-ref>.supabase.co/rest/v1/rpc/get_dashboard_data
   ```
5. Go to **Project Settings → API Keys** and copy the **anon / public** key.
6. (Optional, once you're ready for real data) Delete the sample rows and insert your
   own into the `orders` table — either via the Table Editor UI or your own insert script.

That's it on the Supabase side. Everything else (the actual dashboard logic) is already
written for you below.

## 2. Run the backend locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and fill in:
```
supabase_url=https://<project-ref>.supabase.co/rest/v1/rpc/get_dashboard_data
apikey=<your anon public key>
allowed_origin=*
```

Then:
```bash
python app.py
```
Visit `http://127.0.0.1:5000/` — you should see `{"status": "ok", ...}`.

## 3. Run the frontend locally

Open `frontend/js/script.js` and set:
```js
const base_url = 'http://127.0.0.1:5000';
```
Then just open `frontend/index.html` in your browser (or serve it with `npx serve frontend`).
Pick a date between 2026-01-01 and 2026-05-31 (matches the sample data range) and the
dashboard should populate.

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: SalesPulse dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

`.env` is already git-ignored so your Supabase key won't be committed.

## 5. Deploy

**Backend → Render.com**
- New → Web Service → connect your repo, root directory `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`
- Add env vars `supabase_url`, `apikey`, `allowed_origin` in the Render dashboard
  (set `allowed_origin` to your frontend's deployed URL once you have it)

**Frontend → Netlify / GitHub Pages / Render static site**
- Deploy the `frontend/` folder as-is
- Update `base_url` in `js/script.js` to your deployed backend URL before deploying

## Customizing it into your own project

- Swap `orders` columns / add tables to match your real business data
  (products, regions, teams — whatever you're tracking)
- Change the KPI set in `get_dashboard_data()` (e.g. add "New customers", "Avg order value")
- Theme lives in `frontend/css/style.css` under the `:root` CSS variables —
  change `--brass`, `--sage`, `--sky`, `--rust` and the fonts to make it your own
- Date range restriction (`min`/`max` on the date picker) is in `index.html` — adjust
  or remove once you have real ongoing data instead of a fixed sample range
