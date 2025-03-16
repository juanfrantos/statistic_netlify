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
    // Get total responses
    const { data: totalResponses, error: totalError } = await supabase
      .from('form_responses')
      .select('response_id');

    if (totalError) throw totalError;

    // Get responses with Calendly links
    const { data: calendlyResponses, error: calendlyError } = await supabase
      .from('form_responses')
      .select('response_id')
      .eq('has_calendly_link', true);

    if (calendlyError) throw calendlyError;

    // Get responses by date for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: dailyResponses, error: dailyError } = await supabase
      .from('form_responses')
      .select('date_submitted, has_calendly_link')
      .gte('date_submitted', thirtyDaysAgo.toISOString());

    if (dailyError) throw dailyError;

    // Process daily responses
    const dailyData = {};
    dailyResponses.forEach(response => {
      const date = new Date(response.date_submitted);
      date.setUTCHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { total: 0, withCalendly: 0 };
      }
      
      dailyData[dateStr].total++;
      if (response.has_calendly_link) {
        dailyData[dateStr].withCalendly++;
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          totalResponses: totalResponses.length,
          calendlyResponses: calendlyResponses.length,
          dailyData
        }
      })
    };
  } catch (error) {
    console.error('Error in typeform-data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}; 