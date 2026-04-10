
document.addEventListener('DOMContentLoaded', function () {
    const colors = {
        blue: '#2563eb', emerald: '#10b981', amber: '#d97706', indigo: '#4f46e5', red: '#ef4444', slate: '#94a3b8'
    };

    // Auto-set current month/year defaults
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    
    const yearSelect = document.getElementById('yearFilter');
    const monthSelect = document.getElementById('monthFilter');
    if(yearSelect) yearSelect.value = currentYear;
    if(monthSelect) monthSelect.value = currentMonth;

    const commonOptions = {
        chart: { height: 280, toolbar: { show: true }, fontFamily: 'Inter, sans-serif', animations: { enabled: true } },
        grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
        markers: { size: 5, hover: { size: 7 } },
        xaxis: { labels: { style: { colors: colors.slate, fontWeight: 600, fontSize: '10px' } } },
        yaxis: { labels: { style: { colors: colors.slate, fontWeight: 600, fontSize: '10px' } } }
    };

    // Initialize Charts
    const loanChart = new ApexCharts(document.querySelector("#loanVolumeChart"), {
        ...commonOptions, type: 'area', series: [{ name: 'Loan Vol (₹)', data: [] }], colors: [colors.blue],
        stroke: { curve: 'smooth', width: 3 }, fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0.1 } }
    });

    const userChart = new ApexCharts(document.querySelector("#newUserChart"), {
        ...commonOptions, type: 'line', series: [{ name: 'New Users', data: [] }], colors: [colors.emerald],
        stroke: { width: 4 }
    });

    const kycChart = new ApexCharts(document.querySelector("#kycStatusChart"), {
        chart: { type: 'donut', height: 250 }, labels: ['Approved', 'Pending', 'Rejected'],
        series: [0, 0, 0], colors: [colors.emerald, colors.amber, colors.red],
        plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'Total KYC', 
        formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0) } } } } },
        legend: { position: 'bottom', fontSize: '11px' }
    });

    const staffChart = new ApexCharts(document.querySelector("#staffActivityChart"), {
        ...commonOptions, type: 'bar', series: [{ name: 'Staff Action', data: [] }], colors: [colors.indigo],
        plotOptions: { bar: { borderRadius: 6, columnWidth: '45%' } }
    });

    [loanChart, userChart, kycChart, staffChart].forEach(c => c.render());

    async function updateDashboard() {
        const year = yearSelect.value;
        const month = monthSelect.value;

        try {
            const res = await fetch(`/api/admin/stats?year=${year}&month=${month}`);
            const data = await res.json();

            loanChart.updateOptions({ xaxis: { categories: data.labels }, series: [{ data: data.loans }] });
            userChart.updateOptions({ xaxis: { categories: data.labels }, series: [{ data: data.users }] });
            staffChart.updateOptions({ xaxis: { categories: data.labels }, series: [{ data: data.staff }] });
            kycChart.updateSeries(data.kyc);
        } catch (e) { console.error("Stats Fetch Error:", e); }
    }

    yearSelect.addEventListener('change', updateDashboard);
    monthSelect.addEventListener('change', updateDashboard);
    updateDashboard();
});
