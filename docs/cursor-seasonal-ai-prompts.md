# Cursor Prompt: Seasonal Training & AI Conversation Enhancement

## Task 1: Implement Seasonal Training Phases

### Add Season Selection During Onboarding
Add this to the Personal Data tab or as a modal when soccer is selected:

```javascript
// Seasonal Training Configuration
class SeasonalTraining {
  constructor() {
    this.phases = {
      OFF_SEASON: {
        name: 'Off-Season',
        duration: '2-4 months',
        focus: 'Build strength, address weaknesses, body composition',
        strengthBias: 0.7,  // 70% strength focus
        conditioningBias: 0.3,
        description: 'Maximum strength gains, muscle building, injury prevention'
      },
      PRE_SEASON: {
        name: 'Pre-Season', 
        duration: '4-6 weeks',
        focus: 'Convert strength to power, sport-specific conditioning',
        strengthBias: 0.4,  // 40% strength
        conditioningBias: 0.6,  // 60% conditioning/power
        description: 'Ramp up intensity, add plyometrics, prepare for competition'
      },
      IN_SEASON: {
        name: 'In-Season',
        duration: 'Variable',
        focus: 'Maintain strength, optimize performance, manage fatigue',
        strengthBias: 0.3,  // 30% strength (maintenance)
        conditioningBias: 0.7,  // 70% sport/recovery
        description: 'Stay strong, stay healthy, peak for games'
      },
      PLAYOFFS: {
        name: 'Playoffs',
        duration: '2-4 weeks',
        focus: 'Peak performance, injury prevention, mental sharpness',
        strengthBias: 0.2,  // 20% strength (minimal)
        conditioningBias: 0.8,  // 80% sport-specific
        description: 'Taper volume, maintain intensity, maximize recovery'
      }
    };
    
    this.currentPhase = null;
    this.phaseStartDate = null;
    this.targetDate = null; // For pre-season: first game date
  }
  
  async initializeSeasonPhase(userSport) {
    // Only show for outdoor sports with seasons
    const seasonalSports = ['Soccer (Outdoor)', 'Football', 'Baseball', 'Lacrosse', 'Rugby'];
    
    if (!seasonalSports.includes(userSport)) {
      return; // Indoor sports are year-round
    }
    
    const modal = this.createSeasonModal();
    document.body.appendChild(modal);
  }
  
  createSeasonModal() {
    const modal = document.createElement('div');
    modal.className = 'season-modal';
    modal.innerHTML = `
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000;">
        <div class="modal-content" style="background: #2d3748; padding: 30px; border-radius: 15px; max-width: 600px; margin: 50px auto;">
          <h2 style="color: #68d391; margin-bottom: 20px;">⚽ What phase of the season are you in?</h2>
          
          <div class="season-options" style="display: grid; gap: 15px;">
            ${Object.entries(this.phases).map(([key, phase]) => `
              <button onclick="selectSeasonPhase('${key}')" class="season-btn" style="
                background: #1a1a1a;
                border: 2px solid #4a5568;
                padding: 20px;
                border-radius: 10px;
                text-align: left;
                cursor: pointer;
                transition: all 0.3s;
              " onmouseover="this.style.borderColor='#68d391'" onmouseout="this.style.borderColor='#4a5568'">
                <div style="color: #e2e8f0; font-size: 18px; font-weight: 600; margin-bottom: 8px;">
                  ${phase.name}
                </div>
                <div style="color: #a0aec0; font-size: 14px; margin-bottom: 5px;">
                  ${phase.description}
                </div>
                <div style="color: #718096; font-size: 12px;">
                  Duration: ${phase.duration}
                </div>
              </button>
            `).join('')}
          </div>
          
          <div id="phase-details" style="display: none; margin-top: 20px;">
            <!-- Populated based on selection -->
          </div>
        </div>
      </div>
    `;
    return modal;
  }
  
  selectSeasonPhase(phaseKey) {
    this.currentPhase = this.phases[phaseKey];
    const detailsDiv = document.getElementById('phase-details');
    
    if (phaseKey === 'PRE_SEASON') {
      detailsDiv.innerHTML = `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 10px;">
          <h3 style="color: #f59e0b; margin-bottom: 15px;">📅 When is your first game?</h3>
          <input type="date" id="first-game-date" class="form-input" style="width: 100%; padding: 10px; background: #2d3748; color: white; border: 1px solid #4a5568; border-radius: 5px;">
          <p style="color: #a0aec0; font-size: 13px; margin-top: 10px;">
            We'll create a ${this.calculatePreSeasonWeeks()} week ramp-up program to get you game-ready
          </p>
          <button onclick="confirmPreSeason()" class="btn" style="width: 100%; margin-top: 15px;">Create Pre-Season Plan</button>
        </div>
      `;
    } else if (phaseKey === 'IN_SEASON') {
      detailsDiv.innerHTML = `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 10px;">
          <h3 style="color: #10b981; margin-bottom: 15px;">📅 Select your game days</h3>
          <div class="calendar-selector" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; margin-bottom: 15px;">
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => `
              <button class="day-btn" data-day="${idx}" onclick="toggleGameDay(${idx})" style="
                padding: 15px 5px;
                background: #2d3748;
                border: 2px solid #4a5568;
                border-radius: 8px;
                color: #e2e8f0;
                cursor: pointer;
              ">
                ${day}
              </button>
            `).join('')}
          </div>
          <p style="color: #a0aec0; font-size: 13px;">
            💡 We'll schedule heavy lifting 48+ hours before games and lighter work 24 hours before
          </p>
          <button onclick="confirmInSeason()" class="btn" style="width: 100%; margin-top: 15px;">Set Game Schedule</button>
        </div>
      `;
    } else {
      // Off-season or Playoffs - just confirm
      this.applySeasonalAdjustments();
      this.closeModal();
    }
    
    detailsDiv.style.display = 'block';
  }
  
  calculatePreSeasonWeeks() {
    if (!this.targetDate) return 4; // Default
    
    const today = new Date();
    const firstGame = new Date(this.targetDate);
    const weeks = Math.ceil((firstGame - today) / (7 * 24 * 60 * 60 * 1000));
    
    return Math.min(Math.max(weeks, 2), 8); // Between 2-8 weeks
  }
  
  applySeasonalAdjustments() {
    const phase = this.currentPhase;
    
    // Adjust workout generation based on phase
    switch(this.currentPhase.name) {
      case 'Off-Season':
        return this.generateOffSeasonAdjustments();
      case 'Pre-Season':
        return this.generatePreSeasonProgression();
      case 'In-Season':
        return this.generateInSeasonMaintenance();
      case 'Playoffs':
        return this.generatePlayoffTaper();
    }
  }
  
  generateOffSeasonAdjustments() {
    return {
      volumeMultiplier: 1.2,      // 20% more volume
      intensityRange: [0.7, 0.85], // 70-85% intensity
      exerciseSelection: {
        compound: 0.6,    // 60% big lifts
        accessory: 0.3,   // 30% accessories
        conditioning: 0.1  // 10% conditioning
      },
      weeklyStructure: {
        lifting: 4,       // 4 lifting days
        conditioning: 1,  // 1 conditioning day
        recovery: 2       // 2 recovery days
      },
      progressionRate: 1.5, // Faster progression
      notes: [
        '💪 Focus on progressive overload',
        '🍖 Eat in slight surplus for muscle growth',
        '😴 Prioritize sleep for recovery',
        '📊 Track strength gains weekly'
      ]
    };
  }
  
  generatePreSeasonProgression() {
    const weeksOut = this.calculatePreSeasonWeeks();
    const currentWeek = 1; // Track this over time
    
    // Reverse linear periodization for pre-season
    const phases = [];
    
    if (weeksOut >= 6) {
      phases.push(
        { weeks: [1, 2], name: 'Strength Base', strength: 0.6, power: 0.2, conditioning: 0.2 },
        { weeks: [3, 4], name: 'Power Conversion', strength: 0.4, power: 0.4, conditioning: 0.2 },
        { weeks: [5, 6], name: 'Sport Specific', strength: 0.2, power: 0.3, conditioning: 0.5 }
      );
    } else if (weeksOut >= 4) {
      phases.push(
        { weeks: [1, 2], name: 'Strength/Power', strength: 0.5, power: 0.3, conditioning: 0.2 },
        { weeks: [3, 4], name: 'Game Ready', strength: 0.3, power: 0.3, conditioning: 0.4 }
      );
    } else {
      phases.push(
        { weeks: [1, weeksOut], name: 'Rapid Prep', strength: 0.3, power: 0.4, conditioning: 0.3 }
      );
    }
    
    const currentPhase = phases.find(p => currentWeek >= p.weeks[0] && currentWeek <= p.weeks[1]);
    
    return {
      currentPhase: currentPhase.name,
      volumeMultiplier: 1.0 - (currentWeek / weeksOut * 0.3), // Taper volume
      intensityMultiplier: 0.7 + (currentWeek / weeksOut * 0.2), // Increase intensity
      exerciseSelection: {
        compound: currentPhase.strength,
        power: currentPhase.power,
        conditioning: currentPhase.conditioning
      },
      weeklyStructure: {
        lifting: Math.max(2, 4 - Math.floor(currentWeek / 2)), // Reduce lifting over time
        powerSpeed: Math.min(2, Math.floor(currentWeek / 2)), // Increase power/speed
        conditioning: Math.min(3, 1 + Math.floor(currentWeek / 3)), // Build conditioning
        recovery: 2
      },
      specialExercises: this.getPreSeasonSpecialWork(currentWeek, weeksOut),
      notes: [
        `📈 Week ${currentWeek} of ${weeksOut} pre-season`,
        `🎯 Current focus: ${currentPhase.name}`,
        '⚡ Adding explosive movements',
        '🏃 Increasing sport-specific work'
      ]
    };
  }
  
  getPreSeasonSpecialWork(week, totalWeeks) {
    const exercises = [];
    
    // Early pre-season: Build base
    if (week <= totalWeeks / 3) {
      exercises.push(
        { name: 'Box Jumps', sets: 3, reps: 5, notes: 'Focus on landing mechanics' },
        { name: 'Med Ball Slams', sets: 3, reps: 8, notes: 'Full body power' }
      );
    }
    // Mid pre-season: Sport-specific power
    else if (week <= (totalWeeks * 2) / 3) {
      exercises.push(
        { name: 'Depth Jumps', sets: 3, reps: 3, notes: 'Reactive strength' },
        { name: 'Sprint Starts', sets: 5, reps: '10m', notes: 'Acceleration' },
        { name: 'Lateral Bounds', sets: 3, reps: 6, notes: 'Change of direction' }
      );
    }
    // Late pre-season: Game simulation
    else {
      exercises.push(
        { name: 'RSA Protocol', sets: 6, reps: '20m', notes: 'Game-like sprints' },
        { name: 'Agility Ladder', sets: 3, reps: '30 sec', notes: 'Footwork' },
        { name: 'Position Drills', sets: 'Variable', reps: '10 min', notes: 'Sport specific' }
      );
    }
    
    return exercises;
  }
  
  generateInSeasonMaintenance() {
    const gameDays = this.getGameDays();
    
    return {
      volumeMultiplier: 0.7,       // 30% less volume
      intensityRange: [0.75, 0.85], // Maintain intensity
      exerciseSelection: {
        compound: 0.4,     // Still do big lifts
        maintenance: 0.3,  // Maintain muscle
        recovery: 0.3      // Focus on recovery
      },
      weeklyStructure: this.optimizeAroundGames(gameDays),
      autoRegulation: true, // Adjust based on game performance
      notes: [
        '⚖️ Maintain strength without fatigue',
        '🔄 Quality over quantity',
        '💤 Recovery is performance',
        '📊 Monitor game performance trends'
      ]
    };
  }
  
  optimizeAroundGames(gameDays) {
    // Smart scheduling around games
    const schedule = {
      lifting: [],
      recovery: [],
      optional: []
    };
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    gameDays.forEach(gameDay => {
      // No lifting day before game
      const dayBefore = (gameDay - 1 + 7) % 7;
      schedule.recovery.push(days[dayBefore]);
      
      // Light or no lifting day of game
      schedule.recovery.push(days[gameDay]);
      
      // Heavy lifting 3+ days before game is OK
      const heavyDay = (gameDay - 3 + 7) % 7;
      if (!gameDays.includes(heavyDay)) {
        schedule.lifting.push({ day: days[heavyDay], type: 'Heavy' });
      }
      
      // Medium lifting 2 days after game
      const recoveryDay = (gameDay + 2) % 7;
      if (!gameDays.includes(recoveryDay)) {
        schedule.lifting.push({ day: days[recoveryDay], type: 'Medium' });
      }
    });
    
    return schedule;
  }
  
  generatePlayoffTaper() {
    return {
      volumeMultiplier: 0.5,        // 50% volume
      intensityRange: [0.8, 0.9],   // High intensity, low volume
      exerciseSelection: {
        power: 0.5,        // Power/explosive work
        maintenance: 0.3,  // Minimal strength work
        recovery: 0.2      // Active recovery
      },
      weeklyStructure: {
        lifting: 1,        // 1 maintenance session
        power: 1,          // 1 power session
        recovery: 3,       // Lots of recovery
        gamePrep: 2        // Game-specific prep
      },
      notes: [
        '🏆 Peak for playoffs',
        '⚡ Maintain power, reduce fatigue',
        '🧠 Mental preparation crucial',
        '🎯 Quality > Quantity'
      ]
    };
  }
}
```

## Task 2: Enhanced AI Conversation Prompts

### Add AI Coach Interface Improvements

```javascript
// AI Coach Conversation Enhancement
class AICoachInterface {
  constructor() {
    this.contextualPrompts = {
      initial: [
        "💬 Tell me about any injuries or pain",
        "🎯 What's most important: strength, speed, or aesthetics?",
        "📅 Any big games or events coming up?",
        "😴 How's your sleep and recovery?",
        "🏃 What other activities are you doing?"
      ],
      
      preWorkout: [
        "How's your energy today? (1-10)",
        "Any soreness from last session?",
        "Need to modify anything today?",
        "How much time do you have?"
      ],
      
      midWorkout: [
        "How's that weight feeling?",
        "Form feel good?",
        "Need an alternative exercise?",
        "Want to adjust the weight?"
      ],
      
      postWorkout: [
        "How hard was that session? (RPE)",
        "Any exercises feel off?",
        "What worked well?",
        "Recovery plan for tomorrow?"
      ],
      
      weekly: [
        "How's the program feeling overall?",
        "Want to shift focus at all?",
        "Game performance improving?",
        "Need a deload week?"
      ]
    };
    
    this.smartSuggestions = {
      patterns: {
        highRPE: "I notice your RPEs are high. Consider a deload week?",
        lowEnergy: "Energy seems low lately. How's your nutrition and sleep?",
        plateau: "Weights haven't increased in 2 weeks. Try a different rep scheme?",
        consistent: "You're crushing it! Ready to add more volume?",
        gameDay: "Game tomorrow - keep today's session light",
        injured: "Let's modify the program while you heal"
      }
    };
  }
  
  createAIChatInterface() {
    return `
      <div class="ai-coach-chat" style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;">
        <button onclick="toggleAIChat()" class="ai-toggle" style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        ">
          <span style="font-size: 24px;">🤖</span>
        </button>
        
        <div id="ai-chat-window" class="chat-window" style="
          display: none;
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 350px;
          height: 500px;
          background: #2d3748;
          border-radius: 15px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        ">
          <div class="chat-header" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 15px;
            border-radius: 15px 15px 0 0;
          ">
            <h3 style="color: white; margin: 0;">AI Coach 🤖</h3>
            <p style="color: rgba(255,255,255,0.8); font-size: 12px; margin: 5px 0 0;">
              I adapt your training in real-time
            </p>
          </div>
          
          <div class="chat-prompts" style="padding: 15px; border-bottom: 1px solid #4a5568;">
            <p style="color: #a0aec0; font-size: 13px; margin-bottom: 10px;">Quick Actions:</p>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${this.generateQuickPrompts()}
            </div>
          </div>
          
          <div class="chat-messages" style="
            height: 300px;
            overflow-y: auto;
            padding: 15px;
          ">
            ${this.getContextualGreeting()}
          </div>
          
          <div class="chat-input" style="
            padding: 15px;
            border-top: 1px solid #4a5568;
          ">
            <input type="text" id="ai-input" placeholder="Tell me anything..." style="
              width: 100%;
              padding: 10px;
              background: #1a1a1a;
              border: 1px solid #4a5568;
              border-radius: 8px;
              color: white;
            " onkeypress="if(event.key==='Enter') sendToAI()">
          </div>
        </div>
      </div>
    `;
  }
  
  generateQuickPrompts() {
    const context = this.getCurrentContext();
    const prompts = [];
    
    // Context-aware prompt chips
    if (context.isPreWorkout) {
      prompts.push(
        { text: "Feeling tired", action: "adjustForFatigue" },
        { text: "Shoulder hurts", action: "modifyForInjury" },
        { text: "Short on time", action: "quickWorkout" }
      );
    } else if (context.justFinishedWorkout) {
      prompts.push(
        { text: "That was easy", action: "increaseIntensity" },
        { text: "Too hard", action: "decreaseIntensity" },
        { text: "Form felt off", action: "formCorrection" }
      );
    } else if (context.gameIsTomorrow) {
      prompts.push(
        { text: "Prep for game", action: "gamePrep" },
        { text: "Feeling tight", action: "mobilityWork" },
        { text: "Skip workout", action: "restDay" }
      );
    } else {
      prompts.push(
        { text: "Change goals", action: "adjustGoals" },
        { text: "See progress", action: "showProgress" },
        { text: "Injury update", action: "injuryStatus" }
      );
    }
    
    return prompts.map(p => `
      <button onclick="quickAction('${p.action}')" style="
        background: #4a5568;
        color: #e2e8f0;
        padding: 6px 12px;
        border-radius: 20px;
        border: none;
        cursor: pointer;
        font-size: 12px;
      ">
        ${p.text}
      </button>
    `).join('');
  }
  
  getContextualGreeting() {
    const hour = new Date().getHours();
    const context = this.getCurrentContext();
    const user = UserDataStore.currentUser;
    
    let greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    
    let message = `
      <div class="ai-message" style="
        background: #4a5568;
        padding: 12px;
        border-radius: 10px;
        margin-bottom: 10px;
      ">
        <p style="color: #e2e8f0; margin: 0;">
          ${greeting}! 👋
        </p>
    `;
    
    if (context.gameIsTomorrow) {
      message += `
        <p style="color: #fbbf24; margin: 10px 0 0;">
          ⚽ Game tomorrow! Today should be light maintenance only.
        </p>
      `;
    } else if (context.needsDeload) {
      message += `
        <p style="color: #f59e0b; margin: 10px 0 0;">
          📊 You've been training hard for 3 weeks. Consider a deload?
        </p>
      `;
    } else if (context.isPreSeason) {
      message += `
        <p style="color: #10b981; margin: 10px 0 0;">
          📈 Pre-season week ${context.preSeasonWeek}. Let's build that power!
        </p>
      `;
    }
    
    message += `
        <p style="color: #a0aec0; margin: 10px 0 0; font-size: 13px;">
          I can help with:
          • Modifying exercises for pain/injury
          • Adjusting intensity based on energy
          • Swapping exercises you don't like
          • Planning around your schedule
          • Optimizing for specific goals
        </p>
      </div>
    `;
    
    return message;
  }
  
  processUserInput(input) {
    const lowerInput = input.toLowerCase();
    
    // Injury/Pain Detection
    if (this.detectsInjury(lowerInput)) {
      return this.handleInjury(input);
    }
    
    // Fatigue Detection
    if (this.detectsFatigue(lowerInput)) {
      return this.handleFatigue(input);
    }
    
    // Goal Change Detection
    if (this.detectsGoalChange(lowerInput)) {
      return this.handleGoalChange(input);
    }
    
    // Exercise Substitution
    if (this.detectsExerciseIssue(lowerInput)) {
      return this.handleExerciseSubstitution(input);
    }
    
    // Schedule Change
    if (this.detectsScheduleChange(lowerInput)) {
      return this.handleScheduleChange(input);
    }
    
    // Default to contextual response
    return this.generateContextualResponse(input);
  }
  
  detectsInjury(input) {
    const injuryKeywords = [
      'hurt', 'pain', 'injury', 'injured', 'sore', 'ache', 'tweak',
      'strain', 'pull', 'tear', 'discomfort', 'bothering'
    ];
    return injuryKeywords.some(keyword => input.includes(keyword));
  }
  
  handleInjury(input) {
    // Parse body part
    const bodyParts = {
      'shoulder': ['shoulder', 'delt', 'rotator'],
      'knee': ['knee', 'patella'],
      'back': ['back', 'spine', 'lower back'],
      'ankle': ['ankle', 'achilles'],
      'hip': ['hip', 'glute'],
      'elbow': ['elbow', 'forearm'],
      'wrist': ['wrist', 'hand']
    };
    
    let affectedArea = null;
    for (const [part, keywords] of Object.entries(bodyParts)) {
      if (keywords.some(kw => input.toLowerCase().includes(kw))) {
        affectedArea = part;
        break;
      }
    }
    
    // Generate modified program
    const modifications = this.getInjuryModifications(affectedArea);
    
    return {
      message: `I understand your ${affectedArea || 'body'} is bothering you. Here's how we'll modify:`,
      modifications: modifications,
      followUp: "How does this feel? We can adjust further if needed.",
      action: () => this.applyInjuryModifications(modifications)
    };
  }
  
  getInjuryModifications(bodyPart) {
    const mods = {
      shoulder: {
        avoid: ['Overhead press', 'Bench press', 'Dips'],
        substitute: {
          'Bench press': 'Floor press or push-ups',
          'Overhead press': 'Lateral raises',
          'Pull-ups': 'Lat pulldowns with neutral grip'
        },
        add: ['Band pull-aparts', 'Face pulls', 'External rotations'],
        reduce: { intensity: 0.7, volume: 0.6 }
      },
      knee: {
        avoid: ['Squats', 'Lunges', 'Jumps'],
        substitute: {
          'Squats': 'Leg press or wall sits',
          'Lunges': 'Step-ups or leg extensions',
          'Jumps': 'Bike sprints'
        },
        add: ['Quad sets', 'Straight leg raises', 'Clamshells'],
        reduce: { intensity: 0.6, volume: 0.5 }
      },
      back: {
        avoid: ['Deadlifts', 'Bent rows', 'Good mornings'],
        substitute: {
          'Deadlifts': 'Trap bar or rack pulls',
          'Bent rows': 'Chest-supported rows',
          'Squats': 'Goblet squats or leg press'
        },
        add: ['Cat-cow', 'Dead bugs', 'Bird dogs'],
        reduce: { intensity: 0.6, volume: 0.7 }
      }
    };
    
    return mods[bodyPart] || {
      avoid: [],
      substitute: {},
      add: ['Gentle mobility work'],
      reduce: { intensity: 0.7, volume: 0.7 }
    };
  }
}

// Initialize AI Coach
const aiCoach = new AICoachInterface();
const seasonalTraining = new SeasonalTraining();

// Add to page load
document.addEventListener('DOMContentLoaded', () => {
  // Add AI chat interface
  document.body.insertAdjacentHTML('beforeend', aiCoach.createAIChatInterface());
  
  // Check if outdoor sport and initialize seasonal training
  const userSport = UserDataStore.currentUser?.sport;
  if (userSport) {
    seasonalTraining.initializeSeasonPhase(userSport);
  }
});
```

## Task 3: Speed vs Strength Balance for Feel

```javascript
// Athletic Feel Optimizer
class AthleticBalance {
  constructor() {
    this.profiles = {
      STRONG_BUT_SLOW: {
        name: "Tank Mode",
        current: { strength: 0.8, speed: 0.2 },
        target: { strength: 0.6, speed: 0.4 },
        prescription: "More plyometrics, reduce grinding reps"
      },
      FAST_BUT_WEAK: {
        name: "Gazelle Mode", 
        current: { strength: 0.2, speed: 0.8 },
        target: { strength: 0.4, speed: 0.6 },
        prescription: "Build base strength, maintain speed"
      },
      BALANCED: {
        name: "Hybrid Athlete",
        current: { strength: 0.5, speed: 0.5 },
        target: { strength: 0.5, speed: 0.5 },
        prescription: "Maintain balance, periodic focus blocks"
      }
    };
  }
  
  assessCurrentProfile(userData) {
    // Based on recent training and feedback
    const strengthScore = this.calculateStrengthScore(userData);
    const speedScore = this.calculateSpeedScore(userData);
    
    if (strengthScore > speedScore * 1.5) {
      return this.profiles.STRONG_BUT_SLOW;
    } else if (speedScore > strengthScore * 1.5) {
      return this.profiles.FAST_BUT_WEAK;
    }
    
    return this.profiles.BALANCED;
  }
  
  generateBalancedProgram(profile, preferences) {
    const wantsToFeelStrong = preferences.includes('strong');
    const wantsToFeelFast = preferences.includes('fast');
    
    // Adjust program to achieve desired feel
    const program = {
      monday: wantsToFeelStrong ? 
        { type: 'Heavy Lower', focus: 'Maximum strength' } :
        { type: 'Power Lower', focus: 'Explosive strength' },
        
      wednesday: wantsToFeelFast ?
        { type: 'Speed & Agility', focus: 'Acceleration' } :
        { type: 'Strength Maintenance', focus: 'Maintain power' },
        
      friday: {
        type: 'Hybrid Session',
        exercises: [
          { name: 'Power Clean', sets: 3, reps: 3, notes: 'Feel explosive' },
          { name: 'Front Squat', sets: 3, reps: 5, notes: 'Feel strong' },
          { name: 'Box Jumps', sets: 3, reps: 3, notes: 'Feel athletic' }
        ]
      }
    };
    
    return program;
  }
}
```

## Implementation Summary

This adds three critical features:

1. **Seasonal Training Phases**: Automatically adjusts program based on off-season, pre-season, in-season, or playoffs
2. **AI Coach Prompts**: Makes it obvious how much users can lean on the AI with contextual suggestions
3. **Athletic Balance**: Ensures users feel both strong AND fast, not just one or the other

The seasonal system is particularly smart - it asks WHEN your first game is and creates a reverse-engineered pre-season program to get you ready. For in-season, it asks what days you play and automatically schedules heavy work 48+ hours before games.

The AI prompts remove the guesswork - users see chips like "Shoulder hurts" or "Short on time" and can tap them for instant modifications. This makes the conversational AI discoverable rather than hidden.