
const base_url = 'https://sales-pulse-dashboard.onrender.com';

const DEFAULT_DATE = '2026-03-15';

const statusBar = document.getElementById('statusBar');

function setStatus(message, isError = false) {
    if (!message) { statusBar.hidden = true; return; }
    statusBar.hidden = false;
    statusBar.textContent = message;
    statusBar.classList.toggle('error', isError);
}

function datePick() {
    return document.getElementById('date_picker').value; // YYYY-MM-DD
}

// ---------- little animation helpers ----------

function countUp(el, target, { prefix = '', decimals = 0, duration = 850 } = {}) {
    const start = 0;
    const startTime = performance.now();
    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = easeOutExpo(progress);
        const value = start + (target - start) * eased;
        el.textContent = prefix + value.toLocaleString('en-IN', {
            maximumFractionDigits: decimals,
            minimumFractionDigits: decimals
        });
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// subtle 3D tilt on KPI cards, following the cursor
function attachTilt(card) {
    const strength = 8; // degrees
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `rotateY(${x * strength}deg) rotateX(${-y * strength}deg) translateY(-3px)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'rotateY(0deg) rotateX(0deg) translateY(0)';
    });
}

document.querySelectorAll('.kpi-card').forEach(attachTilt);

// ---------- renderers ----------

function renderKpiCards(kpiCards) {
    const cards = [
        {
            id: 'today', dotClass: '', label: 'Today',
            count: kpiCards.todaysales, revenue: kpiCards.todayrevenue,
            sub: `vs ${kpiCards.salespvthisday} orders same day last month`
        },
        {
            id: 'thisMonth', label: 'This month',
            count: kpiCards.salesthismonth, revenue: kpiCards.revenuethismonth,
            sub: `₹${Number(kpiCards.revenuethismonth).toLocaleString('en-IN')} booked so far`
        },
        {
            id: 'prevMonthSameDay', label: 'Same day, last month',
            count: kpiCards.salespvthisday, revenue: kpiCards.revenuepvthisday,
            sub: 'Reference point for today'
        },
        {
            id: 'prevMonth', label: 'Last month total',
            count: kpiCards.saleslastmonth, revenue: kpiCards.revenuelastmonth,
            sub: 'Full previous month'
        }
    ];

    cards.forEach(({ id, label, count, revenue, sub }) => {
        const el = document.getElementById(id);
        el.innerHTML = `
            <div class="kpi-eyebrow"><span class="kpi-dot"></span>${label}</div>
            <div class="kpi-figure"><span class="kpi-count">0</span><small>orders</small></div>
            <div class="kpi-sub"><span class="kpi-rev">₹0</span></div>
        `;
        countUp(el.querySelector('.kpi-count'), Number(count) || 0, { decimals: 0, duration: 800 });
        countUp(el.querySelector('.kpi-rev'), Number(revenue) || 0, { prefix: '₹', decimals: 0, duration: 1000 });
        el.title = sub;
    });
}

function renderDailyLeaderboard(leaderboard) {
    const tableBody = document.querySelector('#metrics-table tbody');
    tableBody.innerHTML = '';

    const fmt = (v) => (v === null || v === undefined ? '-' : v);
    const fmtCur = (v) => (v === null || v === undefined ? '-' : '₹' + Number(v).toLocaleString('en-IN'));

    if (!leaderboard || leaderboard.length === 0) {
        tableBody.innerHTML = `<tr><td class="empty-state" colspan="5">No orders logged for this period yet.</td></tr>`;
        return;
    }

    leaderboard.forEach((rep, i) => {
        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="rank-badge ${rankClass}">${i + 1}</span><strong>${rep.sales_rep.trim()}</strong></td>
            <td>${fmt(rep.tdy_sales)}</td>
            <td>${fmtCur(rep.tdy_revenue)}</td>
            <td>${fmt(rep.mtd_sales)}</td>
            <td>${fmtCur(rep.mtd_revenue)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function renderTopProducts(products) {
    const list = document.getElementById('topProductsList');
    list.innerHTML = '';

    if (!products || products.length === 0) {
        list.innerHTML = `<li class="empty-state">No product sales logged for this period yet.</li>`;
        return;
    }

    products.forEach((p) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <div class="product-name">${p.product}</div>
                <span class="product-sales">${p.no_of_sales} orders</span>
            </div>
            <span class="product-revenue">₹${Number(p.total_revenue).toLocaleString('en-IN')}</span>
        `;
        list.appendChild(li);
    });
}

let dayRevChartInstance = null;
let daySaleChartInstance = null;

function gradientFill(ctx, hex) {
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, hex + '55');
    g.addColorStop(1, hex + '00');
    return g;
}

function renderDayWiseGraph(dayWiseGraph) {
    const c1 = document.getElementById('daywiseRev').getContext('2d');
    const c2 = document.getElementById('daywiseSale').getContext('2d');

    const dates = [], revenue = [], sales = [];
    dayWiseGraph.forEach((d) => { dates.push(d.order_date); revenue.push(d.total_revenue); sales.push(d.no_of_sales); });

    if (dayRevChartInstance) dayRevChartInstance.destroy();
    if (daySaleChartInstance) daySaleChartInstance.destroy();

    const commonOptions = (yLabel) => ({
        responsive: true,
        animation: { duration: 1100, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#14171F',
                titleFont: { family: 'JetBrains Mono', size: 11 },
                bodyFont: { family: 'JetBrains Mono', size: 12 },
                padding: 10,
                cornerRadius: 8,
                displayColors: false
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { family: 'Manrope', size: 11 }, color: '#9AA1AE' } },
            y: { beginAtZero: true, title: { display: true, text: yLabel, font: { family: 'Manrope', size: 11, weight: '600' }, color: '#6B7280' },
                 grid: { color: 'rgba(20,23,31,0.06)' }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#9AA1AE' } }
        }
    });

    dayRevChartInstance = new Chart(c1, {
        type: 'line',
        data: { labels: dates, datasets: [{
            label: 'Revenue', data: revenue,
            borderColor: '#5B3FE0', backgroundColor: gradientFill(c1, '#5B3FE0'),
            borderWidth: 2.5, fill: true, tension: 0.4,
            pointRadius: 3, pointBackgroundColor: '#5B3FE0', pointBorderColor: '#fff', pointBorderWidth: 2
        }]},
        options: commonOptions('Revenue (₹)')
    });

    daySaleChartInstance = new Chart(c2, {
        type: 'line',
        data: { labels: dates, datasets: [{
            label: 'Orders', data: sales,
            borderColor: '#FF6B4A', backgroundColor: gradientFill(c2, '#FF6B4A'),
            borderWidth: 2.5, fill: true, tension: 0.4,
            pointRadius: 3, pointBackgroundColor: '#FF6B4A', pointBorderColor: '#fff', pointBorderWidth: 2
        }]},
        options: commonOptions('Orders')
    });
}

// ---------- signature isometric 3D bar chart (month-wise) ----------

function renderMonthWise3D(monthWiseMetrics) {
    const scene = document.getElementById('monthwise3d');
    scene.innerHTML = '';

    if (!monthWiseMetrics || monthWiseMetrics.length === 0) {
        scene.innerHTML = `<div class="empty-state">No monthly data yet.</div>`;
        return;
    }

    const monthList = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sorted = [...monthWiseMetrics].sort((a, b) => a.year - b.year || a.month - b.month);
    const maxRevenue = Math.max(...sorted.map(m => Number(m.total_revenue) || 0), 1);
    const palette = ['#5B3FE0', '#FF6B4A', '#1FAE7A', '#3AA0FF', '#F5C34C', '#B14FE0'];

    sorted.forEach((m, i) => {
        const heightPx = 30 + (Number(m.total_revenue) / maxRevenue) * 160; // 30–190px
        const color = palette[i % palette.length];

        const col = document.createElement('div');
        col.className = 'bar3d-col';
        col.innerHTML = `
            <div class="bar3d-value">₹${Number(m.total_revenue).toLocaleString('en-IN')}</div>
            <div class="bar3d" style="--h:${heightPx}px; --bar-color:${color}; --bar-delay:${i * 90}ms">
                <div class="face front"></div>
                <div class="face back"></div>
                <div class="face left"></div>
                <div class="face right"></div>
                <div class="face top"></div>
            </div>
            <div class="bar3d-label">${monthList[m.month - 1]} ${m.year}</div>
        `;
        scene.appendChild(col);
    });
}

async function getDashboard() {
    const reportDate = datePick();
    if (!reportDate) return;

    setStatus('Loading…');

    try {
        const response = await fetch(`${base_url}/getData/${reportDate}`);
        if (!response.ok) throw new Error(`HTTP network error status code: ${response.status}`);

        const rawdata = await response.json();
        const targetData = rawdata[0];
        const kpiCards = targetData.kpi_metrics[0];
        const leaderboard = targetData.sales_rep_metrics;
        const dayWiseGraph = targetData.daily_metrics;
        const monthWiseMetrics = targetData.month_metrics;
        const topProducts = targetData.top_products;

        renderKpiCards(kpiCards);
        renderDailyLeaderboard(leaderboard);
        renderTopProducts(topProducts);
        renderDayWiseGraph(dayWiseGraph);
        renderMonthWise3D(monthWiseMetrics);

        setStatus(null);
    } catch (error) {
        console.error('Dashboard engine rendering failure:', error);
        setStatus('Could not load data — check that the backend URL in script.js is correct and running.', true);
    }
}

// ---------- date picker wiring ----------

const dateBtn = document.getElementById('date_btn');
const datePicker = document.getElementById('date_picker');

datePicker.value = DEFAULT_DATE;
dateBtn.textContent = datePicker.value;

dateBtn.addEventListener('click', function () {
    if (typeof datePicker.showPicker === 'function') datePicker.showPicker();
    else { datePicker.focus(); datePicker.click(); }
});

datePicker.addEventListener('change', function () {
    dateBtn.textContent = datePicker.value;
    getDashboard();
});

getDashboard();