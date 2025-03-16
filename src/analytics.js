import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Supabase client
const supabaseUrl = 'https://qidrctmkgmezeftvdlnf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Initialize Google Analytics client
const PROPERTY_ID = '360388988';
const credentialsPath = join(__dirname, '..', 'credentials.json');
const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly']
});

const analyticsClient = google.analyticsdata({
    version: 'v1beta',
    auth
});

export async function syncGoogleAnalytics() {
    try {
        console.log('Starting Google Analytics sync...');
        
        // Get the last 90 days of data
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        const dateRange = {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };

        console.log('Fetching analytics data for date range:', dateRange);

        // Fetch both page views and button clicks
        const [pageViewsResponse, buttonClicksResponse] = await Promise.all([
            analyticsClient.properties.runReport({
                property: `properties/${PROPERTY_ID}`,
                requestBody: {
                    dateRanges: [{
                        startDate: dateRange.startDate,
                        endDate: dateRange.endDate
                    }],
                    dimensions: [
                        { name: 'date' },
                        { name: 'pagePath' }
                    ],
                    metrics: [
                        { name: 'screenPageViews' }
                    ],
                    dimensionFilter: {
                        filter: {
                            fieldName: 'pagePath',
                            stringFilter: {
                                value: '/boosting-brands',
                                matchType: 'EXACT'
                            }
                        }
                    }
                }
            }),
            analyticsClient.properties.runReport({
                property: `properties/${PROPERTY_ID}`,
                requestBody: {
                    dateRanges: [{
                        startDate: dateRange.startDate,
                        endDate: dateRange.endDate
                    }],
                    dimensions: [
                        { name: 'date' }
                    ],
                    metrics: [
                        { name: 'eventCount' }
                    ],
                    dimensionFilter: {
                        filter: {
                            fieldName: 'eventName',
                            stringFilter: {
                                value: 'typeform_button',
                                matchType: 'EXACT'
                            }
                        }
                    }
                }
            })
        ]);

        console.log('Google Analytics raw responses:', {
            pageViews: JSON.stringify(pageViewsResponse.data, null, 2),
            buttonClicks: JSON.stringify(buttonClicksResponse.data, null, 2)
        });

        // Initialize data structure for all dates
        const formattedData = {};
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

        // Process page views
        if (pageViewsResponse.data?.rows?.length) {
            pageViewsResponse.data.rows.forEach(row => {
                const date = row.dimensionValues[0].value;
                formattedData[date] = {
                    date,
                    page_views: parseInt(row.metricValues[0].value, 10),
                    button_clicks: 0
                };
            });
        }

        // Process button clicks
        if (buttonClicksResponse.data?.rows?.length) {
            buttonClicksResponse.data.rows.forEach(row => {
                const date = row.dimensionValues[0].value;
                if (!formattedData[date]) {
                    formattedData[date] = {
                        date,
                        page_views: 0,
                        button_clicks: 0
                    };
                }
                formattedData[date].button_clicks = parseInt(row.metricValues[0].value, 10);
            });
        }

        // If no data for today, add it with zeros
        if (!formattedData[today]) {
            formattedData[today] = {
                date: today,
                page_views: 0,
                button_clicks: 0
            };
        }

        const dataToUpsert = Object.values(formattedData);
        console.log('Formatted analytics data:', dataToUpsert);

        // Upsert data into Supabase
        const { data, error } = await supabase
            .from('google_analytics')
            .upsert(dataToUpsert);

        if (error) {
            console.error('Error upserting to Supabase:', error);
            throw error;
        }

        console.log('Successfully synced analytics data:', data);

        return {
            success: true,
            message: `Synced ${dataToUpsert.length} days of analytics data`
        };
    } catch (error) {
        console.error('Error syncing Google Analytics:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

export async function getWebsiteTraffic() {
    try {
        const { data, error } = await supabase
            .from('google_analytics')
            .select('date, page_views')
            .order('date', { ascending: false })
            .limit(90);

        if (error) {
            console.error('Error fetching website traffic:', error);
            throw error;
        }

        console.log('Retrieved traffic data:', data);

        const total = data[0]?.page_views || 0;
        const previousPeriod = data[1]?.page_views || 0;
        const historicalData = data || [];

        return {
            total,
            previousPeriod,
            historicalData
        };
    } catch (error) {
        console.error('Error fetching website traffic:', error);
        return {
            total: 0,
            previousPeriod: 0,
            historicalData: []
        };
    }
} 