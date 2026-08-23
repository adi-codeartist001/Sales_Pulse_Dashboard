-- 1) Raw orders table -------------------------------------------------------
create table if not exists orders (
    id bigserial primary key,
    order_date date not null,
    sales_rep text not null,
    product text not null default 'General',
    revenue numeric(12,2) not null,
    quantity int not null default 1,
    created_at timestamptz not null default now()
);

create index if not exists idx_orders_order_date on orders (order_date);
create index if not exists idx_orders_sales_rep on orders (sales_rep);
create index if not exists idx_orders_product on orders (product);

-- 2) Sample seed data (delete this block once you plug in real data) -------
insert into orders (order_date, sales_rep, product, revenue, quantity) values
    ('2026-03-01', 'Aarav Sharma',  'Wireless Earbuds',   4200, 2),
    ('2026-03-01', 'Priya Nair',    'Smart Watch',        3100, 1),
    ('2026-03-02', 'Aarav Sharma',  'Bluetooth Speaker',  2600, 1),
    ('2026-03-02', 'Rohit Verma',   'Phone Case',         5400, 3),
    ('2026-03-03', 'Priya Nair',    'Wireless Earbuds',   1800, 1),
    ('2026-03-15', 'Aarav Sharma',  'Smart Watch',        7200, 4),
    ('2026-03-15', 'Priya Nair',    'Bluetooth Speaker',  3900, 2),
    ('2026-03-15', 'Rohit Verma',   'Wireless Earbuds',   2100, 1),
    ('2026-02-15', 'Aarav Sharma',  'Phone Case',         5000, 2),
    ('2026-02-15', 'Priya Nair',    'Smart Watch',        4400, 2),
    ('2026-02-20', 'Rohit Verma',   'Wireless Earbuds',   3300, 1)
on conflict do nothing;

-- 3) The aggregation function (this becomes the RPC endpoint) --------------
create or replace function get_dashboard_data(report_date date)
returns table (
    kpi_metrics jsonb,
    sales_rep_metrics jsonb,
    daily_metrics jsonb,
    month_metrics jsonb,
    top_products jsonb
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

        -- Day-wise graph
        (select coalesce(jsonb_agg(t), '[]') from (
            select order_date, count(*) as no_of_sales, sum(revenue) as total_revenue
            from orders
            where order_date between v_month_start and report_date
            group by order_date
            order by order_date
        ) t),

        -- Month-wise summary
        (select coalesce(jsonb_agg(t), '[]') from (
            select
                extract(year from order_date)::int as year,
                extract(month from order_date)::int as month,
                count(*) as no_of_sales,
                sum(revenue) as total_revenue
            from orders
            group by 1, 2
            order by 1, 2
        ) t),

        -- Top products (month to date, by revenue)
        (select coalesce(jsonb_agg(t), '[]') from (
            select product, count(*) as no_of_sales, sum(revenue) as total_revenue
            from orders
            where order_date between v_month_start and report_date
            group by product
            order by total_revenue desc
            limit 8
        ) t);
end;
$$;

-- 4) Row Level Security -------------------------------------------------
-- alter table orders enable row level security;
-- create policy "public read for dashboard" on orders
--     for select using (true);