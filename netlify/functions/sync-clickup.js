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

// Initialize ClickUp client
const clickup = new ClickUpClient(process.env.CLICKUP_API_KEY);
const SPACE_ID = '90160413088';
const LIST_ID = '901603968088';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get all tasks from the list
        const tasks = await clickup.lists.getTasks(LIST_ID, {
            include_closed: true,
            subtasks: true,
            page: 0
        });

        // Process tasks for database
        const processedTasks = tasks.map(task => ({
            task_id: task.id,
            name: task.name,
            status: task.status.status,
            date_created: task.date_created,
            date_closed: task.date_closed || null,
            url: task.url,
            parent: task.parent || null,
            space_id: SPACE_ID,
            list_id: LIST_ID,
            raw_task: task
        }));

        // Upsert tasks into Supabase
        const { error: upsertError } = await supabase
            .from('clickup_tasks')
            .upsert(processedTasks, {
                onConflict: 'task_id'
            });

        if (upsertError) {
            throw upsertError;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: `Synced ${processedTasks.length} tasks`
            })
        };
    } catch (error) {
        console.error('Error syncing ClickUp data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
}; 