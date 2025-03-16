// Debug Supabase client
// 
const supabase = window.supabase;

async function getTypeformResponses() {
    try {
        console.log('Fetching Typeform responses from Supabase...');
        
        const { data: responses, error } = await supabase
            .from('form_responses')
            .select('*')
            .order('date_submitted', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            return [];
        }

        console.log('Retrieved responses:', {
            totalResponses: responses?.length || 0,
            firstResponse: responses?.[0]
        });

        return responses || [];
    } catch (error) {
        console.error('Error fetching Typeform responses:', error);
        return [];
    }
}

async function getClickUpTasks() {
    try {
        const { data: tasks, error } = await supabase
            .from('clickup_tasks')
            .select('*')

        if (error) {
            console.error('Error fetching ClickUp tasks:', error);
            return [];
        }
        return tasks || []
    } catch (error) {
        console.error('Error fetching ClickUp tasks:', error)
        return [];
    }
}

// Chart configuration
const chartConfig = {
    type: 'line',
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false,
                backgroundColor: '#1e293b',
                titleColor: '#f8fafc',
                bodyColor: '#f8fafc',
                titleFont: {
                    size: 12,
                    weight: 'normal'
                },
                bodyFont: {
                    size: 14,
                    weight: 'bold'
                },
                padding: 12,
                displayColors: false,
                callbacks: {
                    title: function(tooltipItems) {
                        const date = new Date(tooltipItems[0].label);
                        return date.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric'
                        });
                    },
                    label: function(context) {
                        return context.raw.toString();
                    }
                }
            }
        },
        scales: {
            x: {
                display: false
            },
            y: {
                display: false
            }
        },
        elements: {
            line: {
                tension: 0.4,
                borderWidth: 2,
                borderColor: '#3b82f6'
            },
            point: {
                radius: 3,
                hitRadius: 8,
                hoverRadius: 5,
                backgroundColor: '#3b82f6',
                borderColor: '#f8fafc',
                borderWidth: 2
            }
        },
        hover: {
            mode: 'index',
            intersect: false
        }
    }
};

// Create charts
let trafficChart, clicksChart, submissionsChart, meetingsChart, closedChart;

function initializeCharts() {
    trafficChart = new Chart(document.getElementById('trafficChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                data: [],
                fill: {
                    target: 'origin',
                    above: 'rgba(59, 130, 246, 0.1)'
                }
            }]
        }
    });

    clicksChart = new Chart(document.getElementById('clicksChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                data: [],
                fill: {
                    target: 'origin',
                    above: 'rgba(59, 130, 246, 0.1)'
                }
            }]
        }
    });

    submissionsChart = new Chart(document.getElementById('submissionsChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                data: [],
                fill: {
                    target: 'origin',
                    above: 'rgba(59, 130, 246, 0.1)'
                }
            }]
        }
    });

    meetingsChart = new Chart(document.getElementById('meetingsChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                data: [],
                fill: {
                    target: 'origin',
                    above: 'rgba(59, 130, 246, 0.1)'
                }
            }]
        }
    });

    closedChart = new Chart(document.getElementById('closedChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                data: [],
                fill: {
                    target: 'origin',
                    above: 'rgba(59, 130, 246, 0.1)'
                }
            }]
        }
    });
}

// Initialize charts when the page loads
initializeCharts();

async function fetchDashboardData() {
    try {
        // Show loading state
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('error-message').style.display = 'none';

        // Sync all data sources
        console.log('Syncing data sources...');
        const syncResults = await Promise.allSettled([
            fetch('/.netlify/functions/sync-analytics', { method: 'POST' }),
            fetch('/.netlify/functions/sync-typeform', { method: 'POST' }),
            fetch('/.netlify/functions/sync-clickup', { method: 'POST' })
        ]);

        // Check for sync errors
        syncResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Sync error for source ${index}:`, result.reason);
            }
        });

        // Fetch data from all sources
        console.log('Fetching data from all sources...');
        const [analyticsResponse, typeformResponse, clickupResponse] = await Promise.all([
            fetch('/.netlify/functions/analytics-traffic'),
            fetch('/.netlify/functions/typeform-data'),
            fetch('/.netlify/functions/clickup-data')
        ]);

        if (!analyticsResponse.ok) throw new Error(`Analytics API error: ${analyticsResponse.status}`);
        if (!typeformResponse.ok) throw new Error(`Typeform API error: ${typeformResponse.status}`);
        if (!clickupResponse.ok) throw new Error(`ClickUp API error: ${clickupResponse.status}`);

        const analytics = await analyticsResponse.json();
        const typeform = await typeformResponse.json();
        const clickup = await clickupResponse.json();

        console.log('Data fetched successfully:', { analytics, typeform, clickup });

        // Update UI with fetched data
        updateDashboard(analytics, typeform, clickup);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        document.getElementById('error-message').textContent = `Error: ${error.message}. Please try again.`;
        document.getElementById('error-message').style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function updateDashboard(analytics, typeform, clickup) {
    // Update website traffic
    document.getElementById('websiteTraffic').textContent = analytics.total || '0';
    document.getElementById('trafficChange').textContent = analytics.previousPeriod ? 
        `(${((analytics.total - analytics.previousPeriod) / analytics.previousPeriod * 100).toFixed(1)}%)` : 
        '(0%)';

    // Update button clicks
    document.getElementById('buttonClicks').textContent = analytics.buttonClicks || '0';
    document.getElementById('clicksChange').textContent = analytics.previousButtonClicks ?
        `(${((analytics.buttonClicks - analytics.previousButtonClicks) / analytics.previousButtonClicks * 100).toFixed(1)}%)` :
        '(0%)';

    // Update form submissions
    document.getElementById('totalResponses').textContent = typeform.total || '0';

    // Update meetings booked
    document.getElementById('withCalendly').textContent = typeform.withCalendly || '0';
    document.getElementById('calendlyPercentage').textContent = typeform.total ?
        `(${((typeform.withCalendly / typeform.total) * 100).toFixed(1)}%)` :
        '(0%)';

    // Update closed tasks
    document.getElementById('completedDocs').textContent = clickup.closed || '0';
    document.getElementById('docsPercentage').textContent = clickup.created ?
        `(${((clickup.closed / clickup.created) * 100).toFixed(1)}%)` :
        '(0%)';

    // Update charts
    if (analytics.data) {
        updateChart(trafficChart, analytics.data.map(d => ({ date: d.date, value: d.page_views })));
        updateChart(clicksChart, analytics.data.map(d => ({ date: d.date, value: d.button_clicks })));
    }

    if (typeform.data) {
        updateChart(submissionsChart, typeform.data.map(d => ({ date: d.date, value: d.total })));
        updateChart(meetingsChart, typeform.data.map(d => ({ date: d.date, value: d.with_calendly })));
    }

    if (clickup.data) {
        updateChart(closedChart, clickup.data.map(d => ({ date: d.date, value: d.closed })));
    }
}

function updateChart(chart, data) {
    if (!data || !Array.isArray(data)) {
        console.warn('Invalid data for chart update:', data);
        return;
    }

    // Sort data by date
    data.sort((a, b) => a.date.localeCompare(b.date));

    chart.data.labels = data.map(d => d.date);
    chart.data.datasets[0].data = data.map(d => d.value);
    chart.update();
}

// Event Listeners
document.getElementById('dateRange').addEventListener('change', fetchDashboardData);
document.getElementById('refreshData').addEventListener('click', (e) => {
    e.preventDefault();
    fetchDashboardData();
});

// Initial load
fetchDashboardData();

// Auto-refresh every 5 minutes
setInterval(fetchDashboardData, 5 * 60 * 1000)

