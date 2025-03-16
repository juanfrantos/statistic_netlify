import { createClient } from '@supabase/supabase-js';
import { Client as ClickUpClient } from 'clickup.js';

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
            .from('clickup_tasks')
            .select('date_created, date_closed')
            .gte('date_created', startDate.toISOString())
            .lte('date_created', endDate.toISOString())
            .order('date_created', { ascending: false });

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
                created: 0,
                closed: 0
            };
        }

        // Count tasks for each day
        data.forEach(task => {
            const createdDate = task.date_created.split('T')[0];
            const closedDate = task.date_closed ? task.date_closed.split('T')[0] : null;

            if (dailyCounts[createdDate]) {
                dailyCounts[createdDate].created++;
            }

            if (closedDate && dailyCounts[closedDate]) {
                dailyCounts[closedDate].closed++;
            }
        });

        // Convert to array and sort by date
        const formattedData = Object.values(dailyCounts)
            .sort((a, b) => b.date.localeCompare(a.date));

        // Calculate totals
        const totalCreated = formattedData.reduce((sum, day) => sum + day.created, 0);
        const totalClosed = formattedData.reduce((sum, day) => sum + day.closed, 0);

        // Calculate previous period (excluding today)
        const previousData = formattedData.filter(day => day.date !== today);
        const previousCreated = previousData.reduce((sum, day) => sum + day.created, 0);
        const previousClosed = previousData.reduce((sum, day) => sum + day.closed, 0);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                created: totalCreated,
                closed: totalClosed,
                previousCreated,
                previousClosed,
                data: formattedData
            })
        };
    } catch (error) {
        console.error('Error fetching ClickUp data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
}; 