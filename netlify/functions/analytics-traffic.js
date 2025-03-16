import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://qidrctmkgmezeftvdlnf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Validate environment variables
if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_KEY is not set');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export const handler = async (event) => {
    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Fetching analytics data from Supabase');
        const { data, error } = await supabase
            .from('google_analytics')
            .select('date, page_views, button_clicks')
            .order('date', { ascending: false })
            .limit(90);

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        console.log('Processing analytics data');
        // Calculate totals for both metrics
        const totalPageViews = data.reduce((sum, day) => sum + day.page_views, 0);
        const previousPeriodPageViews = data.slice(1).reduce((sum, day) => sum + day.page_views, 0);
        const totalButtonClicks = data.reduce((sum, day) => sum + (day.button_clicks || 0), 0);
        const previousPeriodButtonClicks = data.slice(1).reduce((sum, day) => sum + (day.button_clicks || 0), 0);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                total: totalPageViews,
                previousPeriod: previousPeriodPageViews,
                buttonClicks: totalButtonClicks,
                previousButtonClicks: previousPeriodButtonClicks,
                data
            })
        };
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            })
        };
    }
}; 