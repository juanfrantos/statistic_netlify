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

        // Sync all data sources
        await Promise.all([
            fetch('/.netlify/functions/sync-analytics', { method: 'POST' }),
            fetch('/.netlify/functions/sync-typeform', { method: 'POST' }),
            fetch('/.netlify/functions/sync-clickup', { method: 'POST' })
        ]);

        // Fetch analytics data
        const analyticsResponse = await fetch('/.netlify/functions/analytics-traffic');
        const analyticsData = await analyticsResponse.json();

        // Fetch Typeform data
        const typeformResponse = await fetch('/.netlify/functions/typeform-data');
        const typeformData = await typeformResponse.json();

        // Fetch ClickUp data
        const clickupResponse = await fetch('/.netlify/functions/clickup-data');
        const clickupData = await clickupResponse.json();

        // Update UI with fetched data
        updateDashboard(analyticsData, typeformData.data, clickupData.data);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        document.getElementById('error-message').textContent = 'Error loading dashboard data. Please try again.';
        document.getElementById('error-message').style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function updateDashboard(responses, taskCount, traffic) {
    // Update form responses statistics
    document.getElementById('totalResponses').textContent = responses.length || '0'

    const withCalendly = responses.filter(r => r.has_calendly_link).length
    document.getElementById('withCalendly').textContent = withCalendly || '0'

    const calendlyPercentage = responses.length > 0 
        ? ((withCalendly / responses.length) * 100).toFixed(1) 
        : 0
    document.getElementById('calendlyPercentage').textContent = `(${calendlyPercentage}%)`

    // Update total number of tasks
    document.getElementById('completedDocs').textContent = taskCount || '0'

    // Update website traffic
    const trafficTotal = traffic.total || 0;
    document.getElementById('websiteTraffic').textContent = trafficTotal;
    const trafficChange = traffic.previousPeriod > 0
        ? ((trafficTotal - traffic.previousPeriod) / traffic.previousPeriod * 100).toFixed(1)
        : 0;
    document.getElementById('trafficChange').textContent = `(${trafficChange}%)`;

    // Update button clicks
    const buttonClicksTotal = traffic.buttonClicks || 0;
    document.getElementById('buttonClicks').textContent = buttonClicksTotal;
    const clicksChange = traffic.previousButtonClicks > 0
        ? ((buttonClicksTotal - traffic.previousButtonClicks) / traffic.previousButtonClicks * 100).toFixed(1)
        : 0;
    document.getElementById('clicksChange').textContent = `(${clicksChange}%)`;
}

// Event Listeners
document.getElementById('dateRange').addEventListener('change', fetchDashboardData)
document.getElementById('refreshData').addEventListener('click', (e) => {
    e.preventDefault()
    fetchDashboardData()
})

// Initial load
fetchDashboardData()

// Auto-refresh every 5 minutes
setInterval(fetchDashboardData, 5 * 60 * 1000)

