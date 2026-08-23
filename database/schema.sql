-- ============================================================================
-- SalesPulse — Supabase schema
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================================

-- 1) Raw orders table -------------------------------------------------------
create table if not exists orders (
    id bigserial primary key,
    order_date date not null,
    sales_rep text not null,
    revenue numeric(12,2) not null,
    quantity int not null default 1,
    created_at timestamptz not null default now()
);

create index if not exists idx_orders_order_date on orders (order_date);
create index if not exists idx_orders_sales_rep on orders (sales_rep);

-- 2) Sample seed data (delete this block once you plug in real data) -------
insert into orders (order_date, sales_rep, revenue, quantity) values
    ('2026-03-01', 'Aarav Sharma',  4200, 2),
    ('2026-03-01', 'Priya Nair',    3100, 1),
    ('2026-03-02', 'Aarav Sharma',  2600, 1),
    ('2026-03-02', 'Rohit Verma',   5400, 3),
    ('2026-03-03', 'Priya Nair',    1800, 1),
    ('2026-03-15', 'Aarav Sharma',  7200, 4),
    ('2026-03-15', 'Priya Nair',    3900, 2),
    ('2026-03-15', 'Rohit Verma',   2100, 1),
    ('2026-02-15', 'Aarav Sharma',  5000, 2),
    ('2026-02-15', 'Priya Nair',    4400, 2),
    ('2026-02-20', 'Rohit Verma',   3300, 1)
on conflict do nothing;

-- 3) The aggregation function (this becomes the RPC endpoint) --------------
create or replace function get_dashboard_data(report_date date)
returns table (
    kpi_metrics jsonb,
    sales_rep_metrics jsonb,
    daily_metrics jsonb,
    month_metrics jsonb
)
language plpgsql
as $$
declare
    v_month_start date := date_trunc('month', report_date)::date;
    v_prev_month_same_day date := (report_date - interval '1 month')::date;
    v_prev_month_start date := date_trunc('month', report_date - interval '1 month')::date;
    v_prev_month_end date := (date_trunc('month', report_date))::date - interval '1 day';
begin
    return query
    select
        -- KPI cards
        (select jsonb_build_array(jsonb_build_object(
            'todaysales',        (select count(*) from orders where order_date = report_date),
            'todayrevenue',      (select coalesce(sum(revenue),0) from orders where order_date = report_date),
            'salesthismonth',    (select count(*) from orders where order_date between v_month_start and report_date),
            'revenuethismonth',  (select coalesce(sum(revenue),0) from orders where order_date between v_month_start and report_date),
            'salespvthisday',    (select count(*) from orders where order_date = v_prev_month_same_day),
            'revenuepvthisday',  (select coalesce(sum(revenue),0) from orders where order_date = v_prev_month_same_day),
            'saleslastmonth',    (select count(*) from orders where order_date between v_prev_month_start and v_prev_month_end),
            'revenuelastmonth',  (select coalesce(sum(revenue),0) from orders where order_date between v_prev_month_start and v_prev_month_end)
        ))),

        -- Daily leaderboard
        (select coalesce(jsonb_agg(t), '[]') from (
            select
                sales_rep,
                count(*) filter (where order_date = report_date) as tdy_sales,
                sum(revenue) filter (where order_date = report_date) as tdy_revenue,
                count(*) filter (where order_date between v_month_start and report_date) as mtd_sales,
                sum(revenue) filter (where order_date between v_month_start and report_date) as mtd_revenue
            from orders
            where order_date between v_month_start and report_date
            group by sales_rep
            order by mtd_revenue desc nulls last
        ) t),

        -- Day-wise graph (current month up to report_date)
        (select coalesce(jsonb_agg(t), '[]') from (
            select order_date, count(*) as no_of_sales, sum(revenue) as total_revenue
            from orders
            where order_date between v_month_start and report_date
            group by order_date
            order by order_date
        ) t),

        -- Month-wise summary (all months in the table)
        (select coalesce(jsonb_agg(t), '[]') from (
            select
                extract(year from order_date)::int as year,
                extract(month from order_date)::int as month,
                count(*) as no_of_sales,
                sum(revenue) as total_revenue
            from orders
            group by 1, 2
            order by 1, 2
        ) t);
end;
$$;

-- 4) Row Level Security -------------------------------------------------
-- Supabase turns RLS on by default for new tables in some project setups.
-- The RPC function above runs as the function owner, so it can read the
-- table regardless — but if you ever query "orders" directly from the
-- anon key, you'll need a policy. Uncomment if you hit a permission error:
--
-- alter table orders enable row level security;
-- create policy "public read for dashboard" on orders
--     for select using (true);
