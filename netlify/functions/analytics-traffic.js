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
    const { data, error } = await supabase
      .from('google_analytics')
      .select('date, page_views, button_clicks')
      .order('date', { ascending: false })
      .limit(90);

    if (error) {
      throw error;
    }

    // Calculate totals for both metrics
    const totalPageViews = data.reduce((sum, day) => sum + day.page_views, 0);
    const previousPeriodPageViews = data.slice(1).reduce((sum, day) => sum + day.page_views, 0);
    const totalButtonClicks = data.reduce((sum, day) => sum + (day.button_clicks || 0), 0);
    const previousPeriodButtonClicks = data.slice(1).reduce((sum, day) => sum + (day.button_clicks || 0), 0);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        analytics: [
          { page_views: totalPageViews, button_clicks: totalButtonClicks },
          { page_views: previousPeriodPageViews, button_clicks: previousPeriodButtonClicks }
        ]
      })
    };
  } catch (error) {
    console.error('Error in analytics-traffic:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}; 