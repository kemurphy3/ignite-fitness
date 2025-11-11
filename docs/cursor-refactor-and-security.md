# Cursor Prompt: Refactor Monolithic HTML and Fix Security Issues

## Task 1: Fix Security Issues (DO THIS FIRST)

### Remove Exposed Secrets from config.js

The current config.js file has exposed API secrets. These need to be replaced
with environment variables.

1. Create a new file `.env.local` (make sure it's in .gitignore):

```bash
# .env.local
STRAVA_CLIENT_ID=168662
STRAVA_CLIENT_SECRET=8d502e2d7f16d70bc03f75cafdef3fa0fc541be6
OPENAI_API_KEY=sk-...  # Add your actual key
ANTHROPIC_API_KEY=sk-ant-...  # Add if you have one
DATABASE_URL=postgresql://...  # Your Neon connection string
```

2. Update `config.js` to be a template:

```javascript
// config.js - Safe to commit
const CONFIG = {
  strava: {
    clientId: 'YOUR_CLIENT_ID_HERE',
    clientSecret: 'YOUR_CLIENT_SECRET_HERE',
    redirectUri: window.location.origin + '/callback',
  },
  openai: {
    apiKey: 'YOUR_OPENAI_KEY_HERE',
  },
  anthropic: {
    apiKey: 'YOUR_ANTHROPIC_KEY_HERE', // Optional
  },
  neon: {
    connectionString: 'YOUR_DATABASE_URL_HERE',
  },
};

// For local development, you'll need to manually replace these
// For production, use Netlify environment variables
```

3. Create `config.example.js` as the template and add `config.js` to .gitignore

## Task 2: Break Up the 346KB HTML File

### Create Modular JavaScript Files

Create the following file structure:

```
ignite-fitness/
├── index.html (minimal HTML structure)
├── js/
│   ├── app.js (main initialization)
│   ├── auth.js (Strava OAuth flow)
│   ├── workout-generator.js (largest file - exercise selection)
│   ├── ai-client.js (AI integration)
│   ├── data-sync.js (Strava sync)
│   ├── database.js (Neon client)
│   ├── ui-components.js (tab management)
│   ├── patterns.js (pattern detection)
│   └── utils.js (barbell math, helpers)
├── css/
│   └── styles.css
└── config/
    ├── config.js (git-ignored, real values)
    └── config.example.js (template)
```

### Step-by-Step Refactoring

1. **Extract workout-generator.js first** (this is likely 40% of your code):
   - Move `generateWorkoutPlan()` function
   - Move `getGoalOrientedExercises()` function
   - Move `calculateRealisticWeight()` function
   - Move all exercise databases and progression logic
   - Move barbell plate math functions

2. **Extract ai-client.js**:
   - Move all AI-related functions
   - Move the expert system configuration
   - Move model selection logic
   - Move prompt templates

3. **Extract auth.js**:
   - Move Strava OAuth functions
   - Move user session management
   - Move token refresh logic

4. **Extract data-sync.js**:
   - Move Strava activity sync
   - Move workout deduplication logic
   - Move data source prioritization

5. **Extract database.js**:
   - Move all Neon Postgres queries
   - Move database initialization
   - Move CRUD operations

6. **Extract ui-components.js**:
   - Move tab switching logic
   - Move form handlers
   - Move notification system

7. **Extract utils.js**:
   - Move date formatting
   - Move unit conversions
   - Move helper functions

8. **Update index.html**:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Ignite Fitness</title>
    <link rel="stylesheet" href="css/styles.css" />
  </head>
  <body>
    <!-- Minimal HTML structure -->
    <div id="app"></div>

    <!-- Load configuration first -->
    <script src="config/config.js"></script>

    <!-- Load modules in dependency order -->
    <script src="js/utils.js"></script>
    <script src="js/database.js"></script>
    <script src="js/auth.js"></script>
    <script src="js/patterns.js"></script>
    <script src="js/workout-generator.js"></script>
    <script src="js/ai-client.js"></script>
    <script src="js/data-sync.js"></script>
    <script src="js/ui-components.js"></script>
    <script src="js/app.js"></script>
  </body>
</html>
```

## Task 3: For Netlify Deployment

### Use Netlify Functions to Hide API Keys

1. Create `netlify/functions/ai-proxy.js`:

```javascript
// This runs on Netlify's server, hiding your API keys
exports.handler = async (event, context) => {
  const { model, prompt } = JSON.parse(event.body);

  // Keys are safe in Netlify environment variables
  const apiKey = model.includes('gpt')
    ? process.env.OPENAI_API_KEY
    : process.env.ANTHROPIC_API_KEY;

  // Make the actual API call server-side
  const response = await callAI(model, prompt, apiKey);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};
```

2. Update client-side to call Netlify Function:

```javascript
// ai-client.js
async function callAI(model, prompt) {
  // Instead of calling OpenAI directly, call your Netlify function
  const response = await fetch('/.netlify/functions/ai-proxy', {
    method: 'POST',
    body: JSON.stringify({ model, prompt }),
  });
  return response.json();
}
```

## Task 4: Quick Win Approach

If you want to start simple:

1. **Fix security first** (move secrets to environment variables)
2. **Extract just workout-generator.js** (biggest win)
3. **Extract ai-client.js** (second biggest file)
4. **Leave the rest in HTML** until it bothers you

## Testing After Refactor

1. Test Strava OAuth flow still works
2. Test workout generation
3. Test data persistence to Neon
4. Verify no secrets in git history:

```bash
git grep "8d502e2d7f16d70bc03f75cafdef3fa0fc541be6"
```

## Important Notes

- **Never commit real API keys**
- Add `.env.local` to `.gitignore` immediately
- For production, set environment variables in Netlify dashboard
- Consider using Netlify Functions for all API calls to hide keys completely
- Test locally with a `.env.local` file before deploying
