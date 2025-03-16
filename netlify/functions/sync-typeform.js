import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = 'https://qidrctmkgmezeftvdlnf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const typeformToken = process.env.TYPEFORM_TOKEN;
const formId = process.env.TYPEFORM_FORM_ID;

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
    // Fetch responses from Typeform
    const typeformResponse = await axios.get(
      `https://api.typeform.com/forms/${formId}/responses`,
      {
        headers: {
          'Authorization': `Bearer ${typeformToken}`
        }
      }
    );

    const responses = typeformResponse.data.items;

    // Clear existing data
    await supabase
      .from('form_responses')
      .delete()
      .neq('response_id', 'dummy');

    // Process and insert new responses
    const formattedResponses = responses.map(response => {
      const answers = {};
      let hasCalendlyLink = false;

      // Process each answer
      response.answers?.forEach(answer => {
        const value = answer.text || answer.choice?.label || answer.choices?.labels?.join(', ') || answer.email || answer.url || answer.number || answer.boolean;
        if (value && typeof value === 'string' && value.toLowerCase().includes('calendly.com')) {
          answers.calendly_link = value;
          hasCalendlyLink = true;
        }
        answers[answer.field.ref] = value;
      });

      // Check raw response for Calendly links
      const rawResponseStr = JSON.stringify(response);
      if (rawResponseStr.toLowerCase().includes('calendly.com')) {
        hasCalendlyLink = true;
      }

      return {
        response_id: response.response_id,
        date_submitted: response.submitted_at,
        answers,
        has_calendly_link: hasCalendlyLink,
        raw_response: response,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    // Insert formatted responses
    const { error: insertError } = await supabase
      .from('form_responses')
      .insert(formattedResponses);

    if (insertError) {
      throw insertError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Successfully synced ${formattedResponses.length} responses`
      })
    };
  } catch (error) {
    console.error('Error in sync-typeform:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}; 