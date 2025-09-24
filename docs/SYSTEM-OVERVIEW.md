# Ignite Fitness - Complete System Overview

## Executive Summary
Ignite Fitness is an AI-powered adaptive fitness application that creates personalized workout plans based on real-time user feedback, automatically adjusting to fatigue, schedule changes, and performance patterns. Unlike static fitness apps, it truly learns and adapts to each individual user.

## 1. Initial Setup (Developer Side)

### Local Development
```bash
# Clone repository
git clone ignite-fitness

# Create .env.local with your keys
STRAVA_CLIENT_ID=xxx
STRAVA_CLIENT_SECRET=xxx
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx  # Optional
DATABASE_URL=postgresql://neon...

# Open index.html locally
# Test with your personal Strava account
```

### Database Setup
- Create Neon Postgres account (free tier: 0.5GB)
- Run `database-setup.sql` to create tables
- Tables created:
  - `users` - User profiles and auth
  - `sessions` - Workout sessions
  - `exercises` - Individual exercise logs
  - `sleep_sessions` - Sleep tracking
  - `strava_activities` - Synced Strava data
  - `user_preferences` - Goals and settings

### Deployment
- Push code to GitHub
- Connect repository to Netlify (auto-deploys on push)
- Add environment variables in Netlify dashboard
- Domain options: ignitefitness.app or ignite.katemurphy.io
- SSL automatically configured by Netlify

## 2. New User Journey

### First Visit - Authentication
Users see login page with two options:

**Option A: Email Signup**
1. Create account with email/password
2. Receive verification email
3. Verify account
4. Manual workout entry only
5. Can connect Strava later

**Option B: Strava Login (Recommended)**
1. OAuth flow to Strava
2. Authorize app permissions
3. Auto-import activity history
4. Full feature access immediately

### Initial Profile Setup
```javascript
// Information collected during onboarding:
{
  demographics: {
    age: 28,
    weight: 175,
    height: 70,  // inches
    sex: "male"
  },
  goals: [
    "Soccer performance",
    "Injury prevention", 
    "Aesthetics"
  ],
  baseline: {
    bench: 135,
    squat: 225,
    deadlift: 275
  },
  schedule: {
    sport: "Soccer",
    practice_days: ["Tuesday", "Thursday"],
    game_days: ["Saturday"]
  },
  training_phase: "Pre-season"  // Off-season, Pre-season, In-season, Playoffs
}
```

## 3. Daily User Flow

### Morning - Workout Planning
1. **User opens app**
   - Sees "Today's Workout" on dashboard
   - AI has pre-generated based on context

2. **AI Workout Generation considers:**
   - Previous workout RPE scores
   - Days since last heavy session
   - Upcoming games/practices
   - Current training phase
   - Detected patterns
   - Sleep quality (if tracked)

3. **Example Generated Workout:**
```
Tuesday - Lower Power (Game in 4 days)

Warmup (10 min):
- Dynamic stretching
- Leg swings 2x10
- Bodyweight squats 2x10
- Light goblet squats

Main Work:
- Box Jumps: 3x5 (explosive, reset each rep)
- Front Squat: 3x5 @ 185lb (75% of max)
- Romanian Deadlift: 3x8 @ 135lb
- Bulgarian Split Squats: 3x10 each leg @ bodyweight

Core Circuit (3 rounds):
- Plank: 45 seconds
- Side plank: 30 seconds each
- Dead bugs: 10 reps

Cooldown:
- Light stretching
- Foam rolling
```

### At the Gym - Workout Execution
1. **Following the workout:**
   - Check off exercises as completed
   - Log actual weight used
   - Record reps achieved
   - Rate RPE (1-10 scale)

2. **Smart Auto-fill:**
   - App suggests weights based on history
   - Shows last workout's numbers
   - Calculates proper barbell loading

3. **Real-time adjustments:**
   - If user rates exercise RPE 10 (max effort)
   - Next set automatically reduced
   - Future workouts adjust volume

### Post-Workout - Feedback Loop
1. **Session summary:**
   - Overall workout RPE
   - Total volume lifted
   - Comparison to plan

2. **Pattern detection triggers:**
   - Stores data for pattern analysis
   - Updates user context
   - Clears AI cache for fresh recommendations

3. **Recovery tracking:**
   - Suggests next workout timing
   - Identifies optimal rest periods

## 4. The AI Intelligence Layer

### Context Building System
Every AI interaction includes comprehensive context:

```javascript
userContext = {
  // Current Status
  profile: {
    age: 28,
    currentLifts: {bench: 145, squat: 235, deadlift: 285},
    goals: ["Soccer performance", "Injury prevention"]
  },
  
  // Recent History
  recentWorkouts: [
    {date: "2024-01-15", type: "Upper", rpe: 7, completed: true},
    {date: "2024-01-13", type: "Lower", rpe: 9, completed: true}
  ],
  
  // Detected Patterns
  patterns: [
    {insight: "Stronger on Saturdays", recommendation: "Schedule heavy lifts Saturday"},
    {insight: "Need 3 days between squats", recommendation: "Space leg days appropriately"}
  ],
  
  // External Factors
  upcomingGames: ["2024-01-20"],
  sleepAverage: 7.2,
  stressLevel: "moderate"
}
```

### Intelligent Model Selection
Different AI models for different tasks:

| Query Type | Model Selected | Cost/1k tokens | Reasoning |
|------------|---------------|----------------|-----------|
| "What's next?" | Claude Haiku | $0.0008 | Simple lookup |
| "Create workout" | GPT-3.5 | $0.002 | Standard generation |
| "My knee hurts" | Claude Sonnet | $0.015 | Health sensitivity |
| "Analyze 6 months" | Claude Opus | $0.075 | Complex analysis |

### Response Caching Strategy
- Cache responses for 10 minutes
- Pre-cache common queries overnight
- Reduces API costs by ~60%
- Invalidate cache on new workout data

## 5. Data Synchronization

### Strava Integration Flow
```javascript
// Runs every 4 hours automatically
async function syncStrava() {
  // 1. Fetch new activities
  const activities = await strava.getActivities(lastSyncTime);
  
  // 2. Check for duplicates
  for (activity of activities) {
    const existing = findManualEntry(activity.start_date);
    
    if (existing) {
      // Merge: Keep manual RPE, add Strava metrics
      mergeEntries(existing, activity);
    } else {
      // Import as new cardio session
      createCardioSession(activity);
    }
  }
  
  // 3. Adjust upcoming workouts
  if (foundLongRun) {
    reduceLegVolume(nextWorkout);
  }
}
```

### Data Priority Hierarchy
1. **Manual entry** (user input - highest priority)
2. **Garmin/Whoop** (wearable data)
3. **Strava** (activity data)
4. **Calculated** (derived metrics)
5. **Defaults** (baseline assumptions)

### Deduplication Logic
- Match by date/time window (±30 minutes)
- Compare activity type
- If match: Enrich, don't duplicate
- If different: Keep both

## 6. The 2-Week Adaptive Plan

### Weekly View Display
```
WEEK 1 (Current)
┌─────────┬──────────────────────┬──────┬─────────┐
│ Day     │ Planned              │ RPE  │ Status  │
├─────────┼──────────────────────┼──────┼─────────┤
│ Mon     │ Upper Power          │ 7/10 │ ✓       │
│ Tue     │ Soccer Practice      │ -    │ Strava  │
│ Wed     │ Lower Volume         │ -    │ Today   │
│ Thu     │ Soccer Practice      │ -    │ Planned │
│ Fri     │ Recovery/Core        │ -    │ Planned │
│ Sat     │ Soccer Game          │ -    │ Planned │
│ Sun     │ Upper Hypertrophy    │ -    │ Planned │
└─────────┴──────────────────────┴──────┴─────────┘

WEEK 2 (Adaptive)
[Generated based on Week 1 performance]
```

### Continuous Adaptation Rules
- High RPE (9-10) → Reduce next session 20%
- Missed workout → Redistribute volume
- Added activity (pickup game) → Adjust recovery
- Consistent pattern → Permanent change

## 7. Expert System Architecture

### Expert Weight Distribution
```javascript
const EXPERT_WEIGHTS = {
  soccerStrengthCoach: 0.30,    // Sport-specific power
  physicalTherapist: 0.25,      // Injury prevention
  personalTrainer: 0.20,        // General fitness
  eliteSoccerCoach: 0.10,       // Sport tactics
  nutritionist: 0.10,           // Recovery/fueling
  aestheticsCoach: 0.05         // Physique goals
}
```

### Exercise Selection Example
```javascript
// Selecting primary leg exercise
function selectLegExercise(context) {
  const recommendations = {
    soccerStrengthCoach: "Power clean",      // Explosiveness
    physicalTherapist: "Split squat",        // Unilateral
    personalTrainer: "Back squat",           // Fundamental
    eliteSoccerCoach: "Box jumps",          // Field transfer
    nutritionist: "Moderate volume",         // Recovery
    aestheticsCoach: "Add calf raises"       // Aesthetics
  };
  
  // Weighted consensus
  return "Bulgarian Split Squat"; // Addresses most concerns
}
```

## 8. Pattern Detection Engine

### Pattern Types Detected
1. **Day-of-week patterns**
   - "Stronger on Saturdays"
   - "Monday fatigue common"

2. **Exercise response**
   - "Bench improving 5% weekly"
   - "Squats plateaued last month"

3. **Volume tolerance**
   - "Best with 4 sets per exercise"
   - "5+ sets causes overtraining"

4. **Recovery needs**
   - "Need 72 hours between legs"
   - "Can do upper every 48 hours"

5. **External factors**
   - "Poor sleep = reduce volume 30%"
   - "Game performance better with 2 days rest"

### Pattern Implementation
```javascript
class PatternDetector {
  async detectPatterns(userId) {
    const workouts = await getRecentWorkouts(userId, 30);
    
    const patterns = [];
    
    // Day analysis
    const dayPerformance = analyzeDayPatterns(workouts);
    if (dayPerformance.strongDay) {
      patterns.push({
        type: 'timing',
        insight: `Strongest on ${dayPerformance.strongDay}`,
        recommendation: `Schedule important lifts on ${dayPerformance.strongDay}`
      });
    }
    
    // Progress analysis
    const progress = analyzeProgress(workouts);
    progress.forEach(exercise => {
      if (exercise.trend > 0) {
        patterns.push({
          type: 'progress',
          insight: `${exercise.name} improving steadily`,
          recommendation: `Maintain current ${exercise.name} programming`
        });
      }
    });
    
    return patterns;
  }
}
```

## 9. Technology Stack

### Frontend Architecture
```
ignite-fitness/
├── index.html (minimal shell)
├── js/
│   ├── app.js (initialization)
│   ├── workout-generator.js (core logic)
│   ├── ai-client.js (LLM interface)
│   ├── auth.js (login/OAuth)
│   ├── data-sync.js (Strava sync)
│   ├── database.js (Postgres client)
│   ├── patterns.js (ML patterns)
│   └── utils.js (helpers)
├── css/
│   └── styles.css
└── config/
    └── config.js (environment vars)
```

### Backend Services
- **Hosting:** Netlify (free tier → $19/mo Pro)
- **Database:** Neon Postgres (free 0.5GB → $19/mo for 10GB)
- **Functions:** Netlify Functions (125k requests free)
- **CDN:** Netlify Edge (included)

### External APIs
- **OpenAI:** GPT-3.5-turbo, GPT-4
- **Anthropic:** Claude Haiku, Sonnet, Opus
- **Strava:** OAuth + Activity API
- **SendGrid:** Email service (optional)

### Cost Analysis at Scale

| Users | API Costs | Hosting | Database | Total Cost | Revenue (@$5/user) | Profit |
|-------|-----------|---------|----------|------------|-------------------|--------|
| 10    | $2.40     | $0      | $0       | $2.40      | $50               | $47.60 |
| 50    | $12       | $19     | $0       | $31        | $250              | $219   |
| 100   | $24       | $19     | $0       | $43        | $500              | $457   |
| 500   | $120      | $19     | $19      | $158       | $2,500            | $2,342 |

## 10. Security & Privacy

### Authentication Security
- Passwords hashed using SHA-256
- Session tokens with expiration
- OAuth 2.0 for Strava
- Email verification required
- Password reset tokens expire in 1 hour

### Data Protection
- API keys in environment variables
- Database SSL/TLS encryption
- No plaintext password storage
- Secure token refresh flow
- HTTPS enforced via Netlify

### Privacy Features
- Workouts private by default
- No cross-user data sharing (yet)
- GDPR-compliant data export
- Account deletion removes all data
- No tracking pixels or ads

## 11. Unique Value Proposition

### What Makes Ignite Fitness Different

**Traditional Apps:**
- Static 12-week programs
- No adaptation to fatigue
- Ignore external activities
- Generic progression
- No pattern recognition

**Ignite Fitness:**
- Daily adaptive programming
- RPE-based auto-regulation
- Integrates all activities
- Personalized patterns
- Learns what works for YOU

### The Magic: True Adaptation

```javascript
// Example of adaptation in action
Day 1: User logs squat RPE 10 (maximum effort)
→ System: Reduces next leg day volume by 20%

Day 3: Strava shows 10-mile run
→ System: Changes tomorrow from legs to upper body

Week 2: Pattern detected - "Tuesdays always high fatigue"
→ System: Permanently schedules lighter Tuesdays

Month 2: Analysis shows better progress with higher frequency
→ System: Shifts from 3x/week to 4x/week program
```

## 12. Future Roadmap (Not Yet Implemented)

### Phase 1: Team Features (Months 3-4)
- Share workouts with soccer team
- Team leaderboards
- Coach can view team progress
- Group challenges

### Phase 2: Advanced AI (Months 5-6)
- Level 3 RAG implementation
- Learn from community patterns
- "Users like you succeeded with..."
- Vector similarity matching

### Phase 3: Multi-Sport Support (Months 7-8)
- Basketball mode (plyometric focus)
- Tennis mode (rotational power)
- Climbing mode (grip protocols)
- Running mode (mileage planning)

### Phase 4: Wearable Integration (Months 9-10)
- Apple Health direct sync
- Garmin Connect integration
- Whoop recovery scores
- Heart rate variability training

### Phase 5: Social Features (Year 2)
- Follow other athletes
- Share PR celebrations
- Workout comments/likes
- Community challenges

## Conclusion

Ignite Fitness represents a paradigm shift in fitness technology - from static programs to truly adaptive coaching. By combining real-time feedback, pattern detection, and intelligent AI, it provides professional-level programming at 2.5% of the cost of a personal trainer.

The system is designed to scale efficiently, with 90% profit margins achievable at just 100 users. More importantly, it actually helps athletes improve by learning their individual patterns and adapting accordingly.

For athletes juggling sports and strength training, this is the first app that truly understands the challenge of being a hybrid athlete and adapts in real-time to help them succeed in both domains.