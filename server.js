import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import pkg from '@supabase/supabase-js';
import { syncGoogleAnalytics } from './src/analytics.js';
const { createClient } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Supabase client
const supabaseUrl = 'https://qidrctmkgmezeftvdlnf.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize API configurations
const typeformApiKey = process.env.TYPEFORM_API_KEY;
const typeformFormId = process.env.TYPEFORM_FORM_ID;
const clickupApiKey = process.env.CLICKUP_API_KEY;
const clickupListId = process.env.CLICKUP_LIST_ID;

// Verify environment variables
const requiredEnvVars = {
    SUPABASE_KEY: supabaseKey,
    TYPEFORM_API_KEY: typeformApiKey,
    TYPEFORM_FORM_ID: typeformFormId,
    CLICKUP_API_KEY: clickupApiKey,
    CLICKUP_LIST_ID: clickupListId
};

const missingVars = Object.entries(requiredEnvVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    console.error('Please check your .env file');
    process.exit(1);
}

console.log('Environment check:', {
    hasSupabaseKey: !!supabaseKey,
    hasTypeformApiKey: !!typeformApiKey,
    hasTypeformFormId: !!typeformFormId,
    hasClickupApiKey: !!clickupApiKey,
    hasClickupListId: !!clickupListId,
    typeformApiKeyPrefix: typeformApiKey?.substring(0, 4),
    typeformFormIdLength: typeformFormId?.length,
    clickupApiKeyPrefix: clickupApiKey?.substring(0, 4),
    clickupListIdLength: clickupListId?.length,
    supabaseUrl
});

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static files from the root directory
app.use(express.static(join(__dirname)));

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// API endpoint to trigger ClickUp sync
app.post('/api/sync-clickup', async (req, res) => {
    try {
        console.log('Starting ClickUp sync...');
        
        // Validate ClickUp configuration
        if (!clickupApiKey) {
            throw new Error('ClickUp API key is missing');
        }
        if (!clickupListId) {
            throw new Error('ClickUp List ID is missing');
        }

        console.log('ClickUp configuration:', {
            hasApiKey: !!clickupApiKey,
            apiKeyPrefix: clickupApiKey.substring(0, 10),
            listId: clickupListId
        });

        const url = `https://api.clickup.com/api/v2/list/${clickupListId}/task?include_closed=true`;
        console.log('Requesting ClickUp URL:', url);
        
        const clickupResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': clickupApiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!clickupResponse.ok) {
            const errorText = await clickupResponse.text();
            console.error('ClickUp API error:', {
                status: clickupResponse.status,
                text: errorText,
                requestUrl: url,
                apiKeyPrefix: clickupApiKey.substring(0, 10) + '...'
            });
            throw new Error(`ClickUp API error: ${clickupResponse.status} - ${errorText}`);
        }

        const data = await clickupResponse.json();
        const tasks = data.tasks || [];
        console.log('\n=== ClickUp Tasks Retrieved ===');
        console.log(`Total tasks found: ${tasks.length}`);
        console.log('Task IDs:', tasks.map(t => t.id).join(', '));

        // Get all task IDs from ClickUp for comparison
        const clickupTaskIds = new Set(tasks.map(task => task.id));
        
        // Get all existing tasks from Supabase
        const { data: existingTasks, error: fetchError } = await supabase
            .from('clickup_tasks')
            .select('task_id');
            
        if (fetchError) {
            console.error('Error fetching existing tasks:', fetchError);
            throw fetchError;
        }

        console.log('\n=== Current Supabase State ===');
        console.log('Tasks in Supabase:', existingTasks.map(t => t.task_id).join(', '));

        // Find tasks to delete (exist in Supabase but not in ClickUp)
        const tasksToDelete = existingTasks
            .filter(task => !clickupTaskIds.has(task.task_id))
            .map(task => task.task_id);

        if (tasksToDelete.length > 0) {
            console.log(`\nFound ${tasksToDelete.length} tasks to delete from Supabase:`, tasksToDelete);
            const { error: deleteError } = await supabase
                .from('clickup_tasks')
                .delete()
                .in('task_id', tasksToDelete);

            if (deleteError) {
                console.error('Error deleting old tasks:', deleteError);
                throw deleteError;
            }
            console.log(`Successfully deleted ${tasksToDelete.length} old tasks:`, tasksToDelete);
        }

        // Format current tasks for Supabase
        const formattedTasks = tasks.map(task => {
            const formattedTask = {
                task_id: task.id,
                name: task.name,
                status: task.status?.status || null,
                is_closed: task.status?.type === 'closed',
                custom_fields: task.custom_fields || [],
                raw_data: task
            };

            // Only add date fields if they exist and are valid
            if (task.date_created) {
                try {
                    formattedTask.date_created = new Date(parseInt(task.date_created)).toISOString();
                } catch (e) {
                    console.warn(`Invalid date_created for task ${task.id}:`, task.date_created);
                }
            }

            if (task.date_updated) {
                try {
                    formattedTask.date_updated = new Date(parseInt(task.date_updated)).toISOString();
                } catch (e) {
                    console.warn(`Invalid date_updated for task ${task.id}:`, task.date_updated);
                }
            }

            return formattedTask;
        });

        // Update Supabase with current tasks
        console.log('\n=== Updating Supabase ===');
        const { data: supabaseData, error: supabaseError } = await supabase
            .from('clickup_tasks')
            .upsert(formattedTasks, {
                onConflict: 'task_id'
            });

        if (supabaseError) {
            console.error('Supabase error:', {
                error: supabaseError,
                details: supabaseError.details,
                hint: supabaseError.hint,
                code: supabaseError.code
            });
            throw supabaseError;
        }

        // Verify the final state
        const { data: verificationData, error: verificationError } = await supabase
            .from('clickup_tasks')
            .select('*')
            .order('date_updated', { ascending: false });

        if (verificationError) {
            console.error('Verification error:', verificationError);
        } else {
            console.log('Final Supabase state:', {
                clickupTasks: tasks.length,
                supabaseTasks: verificationData?.length || 0,
                tasksDeleted: tasksToDelete.length,
                tasksUpserted: formattedTasks.length,
                matchesClickup: verificationData?.length === tasks.length
            });
        }

        res.json({
            success: true,
            message: `Synced ${formattedTasks.length} tasks, deleted ${tasksToDelete.length} tasks`,
            tasksProcessed: tasks.length,
            tasksUpdated: formattedTasks.length,
            tasksDeleted: tasksToDelete.length,
            finalCount: verificationData?.length || 0
        });

    } catch (error) {
        console.error('Error in sync-clickup:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            details: error.details || 'No additional details'
        });
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack
        });
    }
});

// Test endpoint for ClickUp API
app.get('/api/test-clickup', async (req, res) => {
    try {
        console.log('Testing ClickUp API connection...');
        
        if (!clickupApiKey || !clickupListId) {
            throw new Error('ClickUp configuration missing');
        }

        const url = `https://api.clickup.com/api/v2/list/${clickupListId}`;
        console.log('Testing ClickUp URL:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': clickupApiKey,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.text();
        console.log('ClickUp API test response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            data: data.substring(0, 200) // Log first 200 chars only
        });

        if (!response.ok) {
            throw new Error(`ClickUp API error: ${response.status} - ${data}`);
        }

        res.json({
            success: true,
            message: 'ClickUp API connection successful',
            status: response.status
        });

    } catch (error) {
        console.error('ClickUp API test error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Analytics sync endpoint
app.post('/api/sync-analytics', async (req, res) => {
    try {
        const result = await syncGoogleAnalytics();
        res.json(result);
    } catch (error) {
        console.error('Error in /api/sync-analytics:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Analytics endpoints
app.get('/api/analytics/traffic', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('google_analytics')
            .select('date, page_views, button_clicks')
            .order('date', { ascending: false })
            .limit(90);

        if (error) {
            console.error('Error fetching analytics:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        // Calculate totals for both metrics
        const totalPageViews = data.reduce((sum, day) => sum + day.page_views, 0);
        const previousPeriodPageViews = data.slice(1).reduce((sum, day) => sum + day.page_views, 0);
        const totalButtonClicks = data.reduce((sum, day) => sum + (day.button_clicks || 0), 0);
        const previousPeriodButtonClicks = data.slice(1).reduce((sum, day) => sum + (day.button_clicks || 0), 0);

        return res.json({ 
            success: true, 
            analytics: [
                { page_views: totalPageViews, button_clicks: totalButtonClicks },
                { page_views: previousPeriodPageViews, button_clicks: previousPeriodButtonClicks }
            ] 
        });
    } catch (error) {
        console.error('Error in /api/analytics/traffic:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Typeform sync endpoint
app.post('/api/sync-typeform', async (req, res) => {
    try {
        console.log('Starting Typeform sync...');
        
        // Validate Typeform configuration
        if (!typeformApiKey || !typeformFormId) {
            throw new Error('Typeform configuration missing');
        }

        // Fetch responses from Typeform
        const url = `https://api.typeform.com/forms/${typeformFormId}/responses`;
        console.log('Requesting Typeform URL:', url);
        
        const typeformResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${typeformApiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!typeformResponse.ok) {
            const errorText = await typeformResponse.text();
            console.error('Typeform API error:', {
                status: typeformResponse.status,
                text: errorText
            });
            throw new Error(`Typeform API error: ${typeformResponse.status} - ${errorText}`);
        }

        const data = await typeformResponse.json();
        const responses = data.items || [];
        console.log(`Retrieved ${responses.length} responses from Typeform`);

        // Delete existing responses
        console.log('Deleting existing responses...');
        const { error: deleteError } = await supabase
            .from('form_responses')
            .delete()
            .neq('response_id', 'dummy'); // Delete all records

        if (deleteError) {
            console.error('Error deleting existing responses:', deleteError);
            throw deleteError;
        }
        console.log('Successfully deleted existing responses');

        if (responses.length === 0) {
            console.log('No responses to process');
            return res.json({
                success: true,
                message: 'No responses found'
            });
        }

        // Format responses for Supabase
        const formattedResponses = responses.map(response => {
            const answers = {};
            let hasCalendlyLink = false;

            // Process each answer and look for Calendly links
            response.answers?.forEach(answer => {
                const value = answer.text || answer.choice?.label || answer.choices?.labels?.join(', ') || answer.number || answer.email || answer.file_url || null;
                answers[answer.field.ref] = value;
                
                // Check if this answer contains a Calendly link
                if (typeof value === 'string' && value.toLowerCase().includes('calendly.com')) {
                    hasCalendlyLink = true;
                }
            });

            // Also check the raw response for any Calendly links
            const rawResponseStr = JSON.stringify(response);
            if (rawResponseStr.toLowerCase().includes('calendly.com')) {
                hasCalendlyLink = true;
            }

            console.log(`Processing response ${response.response_id}:`, {
                hasCalendlyLink,
                answerCount: response.answers?.length || 0,
                rawResponseLength: rawResponseStr.length
            });

            return {
                response_id: response.response_id,
                date_submitted: response.submitted_at,
                answers: answers,
                has_calendly_link: hasCalendlyLink,
                raw_response: response
            };
        });

        console.log('Formatted responses summary:', formattedResponses.map(r => ({
            response_id: r.response_id,
            has_calendly_link: r.has_calendly_link
        })));

        // Insert responses into Supabase
        const { data: insertedData, error: insertError } = await supabase
            .from('form_responses')
            .insert(formattedResponses);

        if (insertError) {
            console.error('Error inserting responses:', insertError);
            throw insertError;
        }

        console.log(`Successfully synced ${formattedResponses.length} responses`);

        res.json({
            success: true,
            message: `Synced ${formattedResponses.length} responses`,
            responsesProcessed: formattedResponses.length
        });

    } catch (error) {
        console.error('Error in sync-typeform:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

async function verifyDataUpdate(taskIds) {
    try {
        console.log('Verifying data update in Supabase...');
        const { data, error } = await supabase
            .from('clickup_tasks')
            .select('*')
            .in('task_id', taskIds)
            .order('date_updated', { ascending: false });

        if (error) {
            console.error('Error verifying data update:', error);
            return;
        }

        console.log('Verification results:', {
            expectedCount: taskIds.length,
            actualCount: data.length,
            sampleTask: data[0]
        });

        return data;
    } catch (error) {
        console.error('Error in verification:', error);
    }
}

// Verify Supabase table structure
async function verifySupabaseTable() {
    try {
        console.log('Verifying Supabase table structure...');
        
        // Check if table exists
        const { data: tables, error: tablesError } = await supabase
            .from('clickup_tasks')
            .select('task_id')
            .limit(1);

        if (tablesError) {
            console.error('Error checking Supabase table:', tablesError);
            if (tablesError.code === '42P01') { // relation does not exist
                console.log('Creating clickup_tasks table...');
                
                // Create the table using SQL
                const { error: createError } = await supabase
                    .from('clickup_tasks')
                    .insert({
                        task_id: 'temp',
                        name: 'temp',
                        status: 'temp',
                        is_closed: false,
                        custom_fields: [],
                        raw_data: {}
                    });

                if (createError && createError.code !== '23505') { // Ignore unique violation
                    console.error('Error creating table:', createError);
                    throw createError;
                }
                console.log('Successfully created clickup_tasks table');
            } else {
                throw tablesError;
            }
        } else {
            console.log('Supabase table exists and is accessible');
            
            // Log the current table structure
            const { data: tableInfo, error: infoError } = await supabase
                .from('clickup_tasks')
                .select('*')
                .limit(1);
                
            if (infoError) {
                console.error('Error getting table info:', infoError);
            } else {
                console.log('Current table structure:', {
                    columns: tableInfo ? Object.keys(tableInfo[0] || {}) : [],
                    sampleRow: tableInfo?.[0]
                });
            }
        }
    } catch (error) {
        console.error('Failed to verify Supabase table:', error);
        throw error;
    }
}

// Call verify function before starting server
verifySupabaseTable()
    .then(() => {
        // Start the server
        const port = process.env.PORT || 3001;
        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    })
    .catch(error => {
        console.error('Server startup failed:', error);
        process.exit(1);
    }); 