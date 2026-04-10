document.addEventListener('DOMContentLoaded', function () {
    // 1. Setup Colors and Defaults
    const colors = {
        blue: '#2563eb', emerald: '#10b981', amber: '#d97706', 
        indigo: '#4f46e5', red: '#ef4444', slate: '#94a3b8'
    };

    // Auto-set the current Year and Month in the filters
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');

    const yearSelect = document.getElementById('yearFilter');
    const monthSelect = document.getElementById('monthFilter');

    // Default to current year and current month on load
    if(yearSelect) yearSelect.value = currentYear;
    if(monthSelect) monthSelect.value = currentMonth;

    const commonOptions = {
        chart: { 
            height: 280, 
            toolbar: { show: true }, 
            fontFamily: 'Inter, sans-serif',
            animations: { enabled: true } 
        },
        grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
        // CRITICAL: Ensure single data points are visible
        markers: { size: 5, hover: { size: 7 } }, 
        xaxis: { 
            type: 'category',
            labels: { style: { colors: colors.slate, fontWeight: 600 } } 
        },
        yaxis: { labels: { style: { colors: colors.slate, fontWeight: 600 } } }
    };

    // 2. Initialize Charts with visibility fixes
    const loanChart = new ApexCharts(document.querySelector("#loanVolumeChart"), {
        ...commonOptions, 
        type: 'area', 
        series: [{ name: 'Loan Vol (₹)', data: [] }], 
        colors: [colors.blue],
        stroke: { curve: 'smooth', width: 3 }, 
        fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0.1 } }
    });

    const userChart = new ApexCharts(document.querySelector("#newUserChart"), {
        ...commonOptions, 
        type: 'line', 
        series: [{ name: 'New Users', data: [] }], 
        colors: [colors.emerald],
        stroke: { width: 4 }
    });

    const kycChart = new ApexCharts(document.querySelector("#kycStatusChart"), {
        chart: { type: 'donut', height: 250 }, 
        labels: ['Approved', 'Pending', 'Rejected'],
        series: [0, 0, 0], // Handles "single approved" fix
        colors: [colors.emerald, colors.amber, colors.red],
        plotOptions: { 
            pie: { 
                donut: { 
                    size: '70%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total KYC',
                            formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0)
                        }
                    }
                } 
            } 
        },
        legend: { position: 'bottom' }
    });

    const staffChart = new ApexCharts(document.querySelector("#staffActivityChart"), {
        ...commonOptions, 
        type: 'bar', 
        series: [{ name: 'Staff Onboarded', data: [] }], 
        colors: [colors.indigo],
        plotOptions: { bar: { borderRadius: 6, columnWidth: '45%' } }
    });

    [loanChart, userChart, kycChart, staffChart].forEach(c => c.render());

    // 3. Fetch and Atomic Update Function
    async function updateDashboard() {
        const year = yearSelect.value;
        const month = monthSelect.value;

        try {
            const res = await fetch(`/api/admin/stats?year=${year}&month=${month}`);
            const data = await res.json();

            // Synchronized Update (Category labels + Data series together)
            loanChart.updateOptions({
                xaxis: { categories: data.labels },
                series: [{ data: data.loans }]
            });

            userChart.updateOptions({
                xaxis: { categories: data.labels },
                series: [{ data: data.users }]
            });

            staffChart.updateOptions({
                xaxis: { categories: data.labels },
                series: [{ data: data.staff }]
            });

            kycChart.updateSeries(data.kyc);

        } catch (e) { 
            console.error("Stats Fetch Error:", e); 
        }
    }

    // 4. Event Listeners
    yearSelect.addEventListener('change', updateDashboard);
    monthSelect.addEventListener('change', updateDashboard);
    
    // Initial load: This will now fetch data for the CURRENT month/year
    updateDashboard(); 
});