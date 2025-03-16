import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://qidrctmkgmezeftvdlnf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export const handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get the last 90 days of data
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        const { data, error } = await supabase
            .from('form_responses')
            .select('date_submitted, has_calendly_link')
            .gte('date_submitted', startDate.toISOString())
            .lte('date_submitted', endDate.toISOString())
            .order('date_submitted', { ascending: false });

        if (error) {
            throw error;
        }

        // Process data to get daily counts
        const dailyCounts = {};
        const today = new Date().toISOString().split('T')[0];

        // Initialize the last 90 days with zero counts
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            dailyCounts[dateStr] = {
                date: dateStr,
                total: 0,
                with_calendly: 0
            };
        }

        // Count responses for each day
        data.forEach(response => {
            const submittedDate = response.date_submitted.split('T')[0];
            if (dailyCounts[submittedDate]) {
                dailyCounts[submittedDate].total++;
                if (response.has_calendly_link) {
                    dailyCounts[submittedDate].with_calendly++;
                }
            }
        });

        // Convert to array and sort by date
        const formattedData = Object.values(dailyCounts)
            .sort((a, b) => b.date.localeCompare(a.date));

        // Calculate totals
        const totalResponses = formattedData.reduce((sum, day) => sum + day.total, 0);
        const totalWithCalendly = formattedData.reduce((sum, day) => sum + day.with_calendly, 0);

        // Calculate previous period (excluding today)
        const previousData = formattedData.filter(day => day.date !== today);
        const previousResponses = previousData.reduce((sum, day) => sum + day.total, 0);
        const previousWithCalendly = previousData.reduce((sum, day) => sum + day.with_calendly, 0);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                total: totalResponses,
                withCalendly: totalWithCalendly,
                previousTotal: previousResponses,
                previousWithCalendly,
                data: formattedData
            })
        };
    } catch (error) {
        console.error('Error fetching Typeform data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
}; 