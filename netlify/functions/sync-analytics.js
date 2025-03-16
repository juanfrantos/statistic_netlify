import { google } from 'googleapis';
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

// Initialize Google Analytics client
const PROPERTY_ID = '360388988';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Decode and parse the credentials
    const credentialsStr = Buffer.from(process.env.GOOGLE_ANALYTICS_CREDENTIALS, 'base64').toString();
    const credentials = JSON.parse(credentialsStr);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly']
    });

    const analyticsClient = google.analyticsdata({
      version: 'v1beta',
      auth
    });

    // Get the last 90 days of data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const dateRange = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };

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

    // Upsert data into Supabase
    const { error: supabaseError } = await supabase
      .from('google_analytics')
      .upsert(dataToUpsert);

    if (supabaseError) {
      throw supabaseError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Synced ${dataToUpsert.length} days of analytics data`
      })
    };
  } catch (error) {
    console.error('Error syncing Google Analytics:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}; 