import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = 'https://qidrctmkgmezeftvdlnf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const clickupToken = process.env.CLICKUP_TOKEN;
const listId = process.env.CLICKUP_LIST_ID;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Fetch tasks from ClickUp
    const clickupResponse = await axios.get(
      `https://api.clickup.com/api/v2/list/${listId}/task`,
      {
        headers: {
          'Authorization': clickupToken
        },
        params: {
          subtasks: true,
          include_closed: true
        }
      }
    );

    const tasks = clickupResponse.data.tasks;

    // Clear existing data
    await supabase
      .from('clickup_tasks')
      .delete()
      .neq('task_id', 'dummy');

    // Process and insert tasks
    const formattedTasks = tasks.map(task => ({
      task_id: task.id,
      name: task.name,
      status: task.status.status,
      date_created: new Date(task.date_created).toISOString(),
      date_updated: new Date(task.date_updated).toISOString(),
      date_closed: task.date_closed ? new Date(task.date_closed).toISOString() : null,
      raw_task: task,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert formatted tasks
    const { error: insertError } = await supabase
      .from('clickup_tasks')
      .insert(formattedTasks);

    if (insertError) {
      throw insertError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Successfully synced ${formattedTasks.length} tasks`
      })
    };
  } catch (error) {
    console.error('Error in sync-clickup:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}; 