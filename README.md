# Cursor Dashboard

A dashboard for tracking metrics from Typeform, ClickUp, and Google Analytics, built with Netlify Functions and Supabase.

## Deployment Instructions

1. Fork or clone this repository to your GitHub account.

2. Create a new site on Netlify:
   - Go to [Netlify](https://app.netlify.com)
   - Click "New site from Git"
   - Choose your repository
   - Set the build command to `npm run build`
   - Set the publish directory to `/`

3. Set up environment variables in Netlify:
   - Go to Site settings > Environment variables
   - Add the following variables:
     ```
     SUPABASE_SERVICE_KEY=your_supabase_service_key
     TYPEFORM_TOKEN=your_typeform_token
     TYPEFORM_FORM_ID=your_typeform_form_id
     CLICKUP_TOKEN=your_clickup_token
     CLICKUP_LIST_ID=your_clickup_list_id
     ```

4. Deploy your site:
   - Netlify will automatically deploy your site
   - Any future pushes to your repository will trigger new deployments

## Development

To run the dashboard locally:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with the required environment variables (see above).

3. Start the development server:
   ```bash
   netlify dev
   ```

## Features

- Real-time analytics dashboard
- Integration with Typeform, ClickUp, and Google Analytics
- Automatic data synchronization
- Interactive charts and metrics
- Serverless architecture using Netlify Functions

## Tech Stack

- Frontend: HTML, JavaScript, Chart.js
- Backend: Netlify Functions
- Database: Supabase
- APIs: Typeform, ClickUp, Google Analytics 