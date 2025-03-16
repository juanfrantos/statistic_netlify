import { createClient } from '@supabase/supabase-js';
import { createClient as createTypeformClient } from '@typeform/api-client';

// Initialize Supabase client
const supabaseUrl = 'https://qidrctmkgmezeftvdlnf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Initialize Typeform client
const typeform = createTypeformClient({
    token: process.env.TYPEFORM_TOKEN
});

const FORM_ID = 'Wd5qPLbx';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get all responses
        const responses = await typeform.responses.list({
            uid: FORM_ID,
            pageSize: 1000,
            since: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        });

        // Process responses
        const processedResponses = responses.items.map(response => {
            const answers = {};
            let hasCalendlyLink = false;

            // Process each answer
            response.answers?.forEach(answer => {
                const value = answer.type === 'url' ? answer.url :
                    answer.type === 'text' ? answer.text :
                    answer.type === 'choice' ? answer.choice.label :
                    answer.type === 'choices' ? answer.choices.labels :
                    answer.type === 'email' ? answer.email :
                    answer.type === 'number' ? answer.number :
                    answer.type === 'boolean' ? answer.boolean :
                    answer.type === 'date' ? answer.date : null;

                answers[answer.field.ref] = value;

                // Check for Calendly link in any answer
                if (typeof value === 'string' && value.includes('calendly.com')) {
                    hasCalendlyLink = true;
                    answers.calendly_link = value;
                }
            });

            return {
                response_id: response.response_id,
                date_submitted: response.submitted_at,
                answers,
                has_calendly_link: hasCalendlyLink,
                raw_response: response
            };
        });

        // Upsert responses into Supabase
        const { error: upsertError } = await supabase
            .from('form_responses')
            .upsert(processedResponses, {
                onConflict: 'response_id'
            });

        if (upsertError) {
            throw upsertError;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: `Synced ${processedResponses.length} responses`
            })
        };
    } catch (error) {
        console.error('Error syncing Typeform data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
}; 