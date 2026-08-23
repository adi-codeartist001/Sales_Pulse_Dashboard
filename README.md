# SalesPulse — Daily Sales Ledger

A small sales-performance dashboard: today's KPIs, a daily leaderboard per sales rep,
and revenue/order trend charts — backed by a single Supabase Postgres function.

```
frontend/   → static HTML/CSS/JS (Chart.js), talks to the backend
backend/    → Flask proxy that forwards requests to Supabase and adds CORS
database/   → schema.sql: the table + aggregation function to run in Supabase
```
## Run the backend locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```
Then:
```bash
python app.py
```
Visit `http://127.0.0.1:5000/` — you should see `{"status": "ok", ...}`.

## Run the frontend locally

Open `frontend/js/script.js` and set:
```js
const base_url = 'http://127.0.0.1:5000';
```
**

