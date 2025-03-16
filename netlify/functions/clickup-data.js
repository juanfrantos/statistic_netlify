import { createClient } from '@supabase/supabase-js';

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
    // Calculate date range for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get tasks created in the last 30 days
    const { data: tasks, error: tasksError } = await supabase
      .from('clickup_tasks')
      .select('*')
      .gte('date_created', thirtyDaysAgo.toISOString());

    if (tasksError) throw tasksError;

    // Process tasks by date
    const dailyData = {};
    tasks.forEach(task => {
      const date = new Date(task.date_created);
      date.setUTCHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { total: 0 };
      }
      
      dailyData[dateStr].total++;
    });

    // Get total tasks count
    const { count: totalTasks, error: countError } = await supabase
      .from('clickup_tasks')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          totalTasks,
          dailyData
        }
      })
    };
  } catch (error) {
    console.error('Error in clickup-data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}; 