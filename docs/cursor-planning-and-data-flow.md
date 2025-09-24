# Cursor Prompt: 2-Week Planning View & Data Flow Optimization

## Task 1: Implement 2-Week Planning View

### Replace Current 4-Week Display
Find the `displayDetailedWorkoutPlan` function (around line 2580) and modify to show only 2 weeks detailed + 2 weeks preview:

```javascript
function displayDetailedWorkoutPlan(plan) {
    if (!plan) return;
    
    const planDisplay = document.getElementById('workoutPlanDisplay');
    if (!planDisplay) return;
    
    // Get current week number (based on actual date)
    const currentWeekNum = getCurrentWeekNumber();
    
    let html = `
        <div class="workout-plan-container">
            <h3 style="color: #68d391; margin-bottom: 20px;">
                ${plan.title || 'Your Personalized Training Plan'}
            </h3>
            
            <!-- Week Navigation -->
            <div class="week-tabs" style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button class="week-tab active" onclick="showWeekView('current')">
                    📍 This Week
                </button>
                <button class="week-tab" onclick="showWeekView('next')">
                    📊 Next Week (Projected)
                </button>
                <button class="week-tab" onclick="showWeekView('future')">
                    🔮 Weeks 3-4 (Structure)
                </button>
                <button class="week-tab" onclick="showTrainingPhilosophy()">
                    💡 Training Philosophy
                </button>
            </div>
    `;
    
    // Current Week - Full Detail
    html += generateCurrentWeekView(plan.weeks[currentWeekNum - 1]);
    
    // Next Week - Projected with Disclaimer
    html += generateNextWeekView(plan.weeks[currentWeekNum]);
    
    // Future Weeks - Structure Only
    html += generateFutureWeeksView(plan.weeks.slice(currentWeekNum + 1));
    
    // Training Philosophy Modal
    html += generatePhilosophyModal();
    
    html += '</div>';
    planDisplay.innerHTML = html;
}

function generateCurrentWeekView(week) {
    return `
        <div id="current-week-view" class="week-view active">
            <div class="week-header" style="background: #22543d; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="color: #68d391;">This Week - Full Program ✅</h4>
                <p style="color: #9ae6b4; font-size: 14px;">Live updates as you complete workouts</p>
            </div>
            ${generateDetailedWeekContent(week, true)}
        </div>
    `;
}

function generateNextWeekView(week) {
    return `
        <div id="next-week-view" class="week-view" style="display: none;">
            <div class="week-header" style="background: #2c5282; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="color: #63b3ed;">Next Week - Projected 📊</h4>
                <div class="disclaimer" style="background: #2d3748; padding: 10px; border-radius: 5px; margin-top: 10px;">
                    <p style="color: #fbbf24; font-size: 13px;">
                        ⚠️ These weights will automatically adjust based on:
                    </p>
                    <ul style="color: #a0aec0; font-size: 12px; margin: 5px 0 0 20px;">
                        <li>This week's RPE ratings</li>
                        <li>Completed vs missed reps</li>
                        <li>Energy levels and recovery</li>
                    </ul>
                </div>
            </div>
            ${generateDetailedWeekContent(week, false)}
        </div>
    `;
}

function generateFutureWeeksView(weeks) {
    return `
        <div id="future-weeks-view" class="week-view" style="display: none;">
            <div class="week-header" style="background: #553c9a; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="color: #c084fc;">Weeks 3-4 - Training Structure 🔮</h4>
                <p style="color: #e9d5ff; font-size: 14px;">
                    Pattern and progression, not specific weights
                </p>
            </div>
            
            <div class="future-weeks-grid" style="display: grid; gap: 15px;">
                ${weeks.map((week, idx) => `
                    <div class="future-week" style="background: #2d3748; padding: 15px; border-radius: 8px;">
                        <h5 style="color: #e2e8f0; margin-bottom: 10px;">Week ${idx + 3}</h5>
                        <div class="week-pattern" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px;">
                            ${generateWeekPattern(week)}
                        </div>
                        <div class="week-focus" style="margin-top: 10px; padding: 10px; background: #1a1a1a; border-radius: 5px;">
                            <p style="color: #a0aec0; font-size: 13px;">
                                <strong>Focus:</strong> ${getWeekFocus(idx + 3)}
                            </p>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="progression-note" style="background: #1a1a1a; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <p style="color: #e2e8f0; font-size: 14px;">
                    <strong>Why we don't show exact weights:</strong>
                </p>
                <p style="color: #a0aec0; font-size: 13px; margin-top: 5px;">
                    Your body adapts uniquely. By week 3, your actual weights might be 20% higher or lower than any prediction we make today. 
                    Trust the adaptive process - the app will calculate optimal weights when you get there based on your actual progress.
                </p>
            </div>
        </div>
    `;
}

function generateWeekPattern(week) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return week.days.map((day, idx) => {
        const sessionType = day.session || day.sessionType || 'Rest';
        const color = getSessionColor(sessionType);
        const icon = getSessionIcon(sessionType);
        
        return `
            <div style="text-align: center;">
                <div style="font-size: 10px; color: #6b7280;">${days[idx]}</div>
                <div style="background: ${color}; padding: 8px; border-radius: 5px; margin-top: 5px;">
                    <span style="font-size: 16px;">${icon}</span>
                </div>
            </div>
        `;
    }).join('');
}

function getSessionColor(sessionType) {
    if (sessionType.includes('Upper')) return '#2563eb';
    if (sessionType.includes('Lower')) return '#dc2626';
    if (sessionType.includes('Soccer')) return '#16a34a';
    if (sessionType.includes('Recovery')) return '#06b6d4';
    return '#6b7280'; // Rest day
}

function getSessionIcon(sessionType) {
    if (sessionType.includes('Upper')) return '💪';
    if (sessionType.includes('Lower')) return '🦵';
    if (sessionType.includes('Soccer')) return '⚽';
    if (sessionType.includes('Recovery')) return '🧘';
    return '😴'; // Rest day
}

function getWeekFocus(weekNum) {
    const focuses = {
        3: 'Progressive overload - weights increase based on weeks 1-2 performance',
        4: 'Peak/Deload - either testing maxes or recovery based on fatigue'
    };
    return focuses[weekNum] || 'Continued progression';
}

function generatePhilosophyModal() {
    return `
        <div id="philosophy-modal" class="modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000;">
            <div class="modal-content" style="background: #2d3748; padding: 30px; border-radius: 15px; max-width: 600px; margin: 50px auto;">
                <h3 style="color: #68d391; margin-bottom: 20px;">Training Philosophy 🎯</h3>
                
                <div class="philosophy-timeline" style="background: #1a1a1a; padding: 20px; border-radius: 10px;">
                    <h4 style="color: #e2e8f0; margin-bottom: 15px;">Your 3-Month Journey</h4>
                    
                    <div class="month" style="margin-bottom: 15px;">
                        <h5 style="color: #60a5fa;">Month 1: Foundation</h5>
                        <ul style="color: #a0aec0; font-size: 14px; margin-left: 20px;">
                            <li>Weeks 1-2: Establish baseline, perfect form</li>
                            <li>Weeks 3-4: First progression wave, increase volume</li>
                        </ul>
                    </div>
                    
                    <div class="month" style="margin-bottom: 15px;">
                        <h5 style="color: #f59e0b;">Month 2: Building</h5>
                        <ul style="color: #a0aec0; font-size: 14px; margin-left: 20px;">
                            <li>Add power/speed work</li>
                            <li>Increase training density</li>
                            <li>Peak soccer performance</li>
                        </ul>
                    </div>
                    
                    <div class="month">
                        <h5 style="color: #10b981;">Month 3: Peak</h5>
                        <ul style="color: #a0aec0; font-size: 14px; margin-left: 20px;">
                            <li>Test strength gains</li>
                            <li>Optimize game performance</li>
                            <li>Reassess and plan next cycle</li>
                        </ul>
                    </div>
                </div>
                
                <button onclick="closePhilosophyModal()" class="btn" style="margin-top: 20px; width: 100%;">Got it! 💪</button>
            </div>
        </div>
    `;
}
```

## Task 2: Eliminate Data Redundancy

### Create Centralized Data Store
Add this data management system (around line 1600):

```javascript
// Centralized User Data Store
const UserDataStore = {
    // Single source of truth for user data
    currentUser: null,
    
    // Core user stats (entered once, used everywhere)
    coreStats: {
        weight: null,      // lbs
        height: null,      // inches
        age: null,
        sex: null,
        bodyFat: null      // optional
    },
    
    // Session data (updates per workout)
    sessionData: {
        energy: 7,         // default, carries forward
        lastSoccerPerformance: 7,
        lastGymSession: null,
        recentRPE: []
    },
    
    // Initialize or update core stats
    updateCoreStats(data) {
        Object.assign(this.coreStats, data);
        this.propagateToAllTabs();
        this.saveToLocalStorage();
    },
    
    // Propagate data to all relevant inputs
    propagateToAllTabs() {
        // Update all weight inputs
        const weightInputs = [
            'userWeight',           // Personal Data tab
            'settingsWeight',       // Settings tab
            'nutritionWeight'       // Nutrition calculator
        ];
        
        weightInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input && this.coreStats.weight) {
                input.value = this.coreStats.weight;
            }
        });
        
        // Update all height inputs
        const heightInputs = ['userHeight', 'settingsHeight'];
        heightInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input && this.coreStats.height) {
                input.value = this.coreStats.height;
            }
        });
        
        // Update energy across tabs (carry forward last value)
        const energyInputs = ['sessionEnergy', 'recoveryEnergy'];
        energyInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.value = this.sessionData.energy;
                // Update display value
                const display = document.getElementById(id + 'Value');
                if (display) display.textContent = this.sessionData.energy;
            }
        });
    },
    
    // Get data with priority hierarchy
    getData(field) {
        // Priority: 1. Manual entry, 2. Connected services, 3. Calculated, 4. Default
        const priorities = this.getDataPriorities(field);
        
        for (let source of priorities) {
            const value = this.getDataFromSource(field, source);
            if (value !== null && value !== undefined) {
                return { value, source };
            }
        }
        
        return { value: this.getDefaultValue(field), source: 'default' };
    },
    
    getDataPriorities(field) {
        const priorityMap = {
            'weight': ['manual', 'withings', 'garmin', 'strava', 'calculated', 'default'],
            'heartRate': ['garmin', 'apple', 'whoop', 'manual', 'calculated'],
            'calories': ['garmin', 'strava', 'apple', 'calculated', 'manual'],
            'distance': ['strava', 'garmin', 'apple', 'manual'],
            'energy': ['manual', 'whoop', 'calculated'],
            'sleep': ['whoop', 'garmin', 'apple', 'manual']
        };
        
        return priorityMap[field] || ['manual', 'calculated', 'default'];
    },
    
    getDataFromSource(field, source) {
        switch(source) {
            case 'manual':
                return this.coreStats[field] || this.sessionData[field];
            
            case 'strava':
                return this.connectedServices.strava?.[field];
            
            case 'garmin':
                return this.connectedServices.garmin?.[field];
            
            case 'calculated':
                return this.calculateField(field);
            
            default:
                return null;
        }
    },
    
    calculateField(field) {
        switch(field) {
            case 'calories':
                // BMR + activity
                if (this.coreStats.weight && this.coreStats.height && this.coreStats.age) {
                    return calculateTDEE(this.coreStats);
                }
                return null;
            
            case 'energy':
                // Average of recent sessions
                if (this.sessionData.recentRPE.length > 0) {
                    const avgRPE = this.sessionData.recentRPE.reduce((a,b) => a+b, 0) / this.sessionData.recentRPE.length;
                    return Math.round(10 - avgRPE); // Convert RPE to energy
                }
                return null;
            
            default:
                return null;
        }
    },
    
    connectedServices: {
        strava: null,
        garmin: null,
        apple: null,
        whoop: null,
        withings: null
    },
    
    // Save everything to localStorage
    saveToLocalStorage() {
        const data = {
            coreStats: this.coreStats,
            sessionData: this.sessionData,
            connectedServices: this.connectedServices
        };
        localStorage.setItem('userDataStore', JSON.stringify(data));
    },
    
    // Load on app init
    loadFromLocalStorage() {
        const stored = localStorage.getItem('userDataStore');
        if (stored) {
            const data = JSON.parse(stored);
            Object.assign(this, data);
            this.propagateToAllTabs();
        }
    }
};

// Smart Input System - Enter Once, Use Everywhere
class SmartInput {
    constructor(inputId, dataField, options = {}) {
        this.input = document.getElementById(inputId);
        this.dataField = dataField;
        this.options = options;
        
        if (this.input) {
            this.init();
        }
    }
    
    init() {
        // Load existing value
        const data = UserDataStore.getData(this.dataField);
        this.input.value = data.value || '';
        
        // Show data source
        if (this.options.showSource && data.source !== 'manual') {
            this.showDataSource(data.source);
        }
        
        // Save on change
        this.input.addEventListener('change', () => {
            this.saveValue();
        });
    }
    
    saveValue() {
        const value = this.input.type === 'number' ? 
            parseFloat(this.input.value) : this.input.value;
        
        // Update central store
        if (this.dataField.includes('.')) {
            // Nested field like 'coreStats.weight'
            const [category, field] = this.dataField.split('.');
            UserDataStore[category][field] = value;
        } else {
            UserDataStore[this.dataField] = value;
        }
        
        // Propagate to other inputs
        UserDataStore.propagateToAllTabs();
        UserDataStore.saveToLocalStorage();
        
        // Trigger recalculations
        if (this.options.triggersRecalc) {
            this.triggerRecalculations();
        }
    }
    
    showDataSource(source) {
        const badge = document.createElement('span');
        badge.className = 'data-source-badge';
        badge.style.cssText = `
            background: #4a5568;
            color: #e2e8f0;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            margin-left: 8px;
        `;
        badge.textContent = `via ${source}`;
        
        this.input.parentElement.appendChild(badge);
    }
    
    triggerRecalculations() {
        // Recalculate macros if weight/height/age changed
        if (['weight', 'height', 'age'].includes(this.dataField)) {
            recalculateMacros();
        }
        
        // Recalculate next workout weights if RPE changed
        if (this.dataField === 'rpe') {
            recalculateProgressions();
        }
    }
}

// Initialize Smart Inputs on Page Load
document.addEventListener('DOMContentLoaded', () => {
    // Load stored data
    UserDataStore.loadFromLocalStorage();
    
    // Initialize smart inputs
    new SmartInput('userWeight', 'coreStats.weight', { 
        showSource: true, 
        triggersRecalc: true 
    });
    
    new SmartInput('userHeight', 'coreStats.height', { 
        triggersRecalc: true 
    });
    
    new SmartInput('sessionEnergy', 'sessionData.energy', {
        showSource: true
    });
    
    // Auto-fill repeated fields
    setupAutoFillSystem();
});

// Auto-fill System for Session Data
function setupAutoFillSystem() {
    // When user selects session type, auto-fill from last similar session
    const sessionTypeSelect = document.getElementById('sessionType');
    sessionTypeSelect?.addEventListener('change', (e) => {
        const sessionType = e.target.value;
        const lastSession = getLastSessionOfType(sessionType);
        
        if (lastSession) {
            // Auto-fill but allow override
            suggestAutoFill(lastSession);
        }
    });
}

function suggestAutoFill(lastSession) {
    const autoFillBanner = document.createElement('div');
    autoFillBanner.className = 'autofill-suggestion';
    autoFillBanner.style.cssText = `
        background: #2563eb;
        color: white;
        padding: 12px;
        border-radius: 8px;
        margin: 10px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    
    autoFillBanner.innerHTML = `
        <span>📊 Found data from last ${lastSession.type} session (${formatDate(lastSession.date)})</span>
        <div>
            <button onclick="applyAutoFill(${JSON.stringify(lastSession)})" class="btn btn-small">Apply</button>
            <button onclick="dismissAutoFill()" class="btn btn-small btn-secondary">Ignore</button>
        </div>
    `;
    
    document.getElementById('log').prepend(autoFillBanner);
}
```

## Task 3: Data Priority Hierarchy

Add this data source management system:

```javascript
// Data Source Priority Configuration
const DataSourcePriority = {
    // Define trust levels for each source
    trustLevels: {
        manual: 1.0,        // User input is truth
        garmin: 0.95,       // Very reliable
        whoop: 0.95,        // Very reliable for recovery
        apple: 0.9,         // Reliable
        strava: 0.85,       // Good for activities
        calculated: 0.7,    // Our estimates
        default: 0.5        // Fallback values
    },
    
    // Conflict resolution
    resolveConflict(data1, data2) {
        // If manual entry exists and is recent (< 24 hours), always use it
        if (data1.source === 'manual' && this.isRecent(data1.timestamp)) {
            return data1;
        }
        
        // Otherwise, use trust levels
        const trust1 = this.trustLevels[data1.source] || 0;
        const trust2 = this.trustLevels[data2.source] || 0;
        
        if (trust1 === trust2) {
            // Same trust level? Use most recent
            return data1.timestamp > data2.timestamp ? data1 : data2;
        }
        
        return trust1 > trust2 ? data1 : data2;
    },
    
    isRecent(timestamp, hoursThreshold = 24) {
        const now = Date.now();
        const age = (now - timestamp) / (1000 * 60 * 60); // hours
        return age < hoursThreshold;
    },
    
    // Show data lineage to user
    displayDataSource(element, dataSource) {
        const sourceColors = {
            manual: '#10b981',    // Green - user entered
            garmin: '#3b82f6',    // Blue - device
            strava: '#f97316',    // Orange - activity
            calculated: '#8b5cf6', // Purple - computed
            default: '#6b7280'     // Gray - fallback
        };
        
        const badge = document.createElement('div');
        badge.className = 'data-source-indicator';
        badge.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            background: ${sourceColors[dataSource]};
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
        `;
        badge.textContent = dataSource.toUpperCase();
        
        element.style.position = 'relative';
        element.appendChild(badge);
    }
};

// Sync Manager for Connected Services
class SyncManager {
    constructor() {
        this.syncInterval = 5 * 60 * 1000; // 5 minutes
        this.lastSync = {};
        this.syncQueue = [];
    }
    
    async syncAll() {
        const services = UserDataStore.connectedServices;
        
        for (let [service, config] of Object.entries(services)) {
            if (config && config.enabled) {
                await this.syncService(service);
            }
        }
        
        // After all syncs, reconcile data
        this.reconcileData();
    }
    
    async syncService(service) {
        console.log(`Syncing ${service}...`);
        
        try {
            const data = await this.fetchServiceData(service);
            UserDataStore.connectedServices[service] = {
                ...UserDataStore.connectedServices[service],
                lastSync: Date.now(),
                data: data
            };
            
            // Update UI to show sync status
            this.updateSyncStatus(service, 'success');
            
        } catch (error) {
            console.error(`Failed to sync ${service}:`, error);
            this.updateSyncStatus(service, 'error');
        }
    }
    
    reconcileData() {
        // For each data field, determine best source
        const fields = ['weight', 'heartRate', 'calories', 'distance', 'sleep'];
        
        fields.forEach(field => {
            const sources = this.getAllSourcesForField(field);
            
            if (sources.length > 1) {
                // Multiple sources - need to pick best one
                const best = this.pickBestSource(sources);
                
                // If best source differs from current, notify user
                if (best.source !== UserDataStore.currentSources[field]) {
                    this.notifyDataSourceChange(field, best);
                }
            }
        });
    }
    
    notifyDataSourceChange(field, newSource) {
        const notification = document.createElement('div');
        notification.className = 'data-update-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1e40af;
            color: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span>📊</span>
                <div>
                    <strong>${field} updated</strong><br>
                    <small>Now using ${newSource.source} (${newSource.value})</small>
                </div>
                <button onclick="revertDataSource('${field}')" style="margin-left: auto; background: transparent; border: 1px solid white; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                    Undo
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => notification.remove(), 5000);
    }
}

// Initialize sync on page load
const syncManager = new SyncManager();
setInterval(() => syncManager.syncAll(), syncManager.syncInterval);
```

## Task 4: Workout Deduplication & Data Enrichment

Prevent duplicate workouts when syncing external services. Instead, enrich existing workouts with additional data:

```javascript
// Add Workout Reconciliation System
class WorkoutReconciliation {
  
  // When Strava/Garmin/Apple syncs, check for matches
  async reconcileExternalWorkout(externalWorkout) {
    const matchCriteria = {
      date: externalWorkout.date,
      timeWindow: 2 * 60 * 60 * 1000, // 2 hour window
      type: this.normalizeWorkoutType(externalWorkout.type)
    };
    
    const existingWorkout = this.findPotentialMatch(matchCriteria);
    
    if (existingWorkout) {
      // ENRICH existing workout, don't duplicate
      return this.enrichWorkoutData(existingWorkout, externalWorkout);
    } else {
      // No match found - offer to import
      return this.offerWorkoutImport(externalWorkout);
    }
  }
  
  findPotentialMatch(criteria) {
    const workouts = getUserWorkouts(criteria.date);
    
    return workouts.find(workout => {
      const timeDiff = Math.abs(workout.timestamp - criteria.timestamp);
      const isWithinWindow = timeDiff < criteria.timeWindow;
      const isSameType = this.matchesType(workout.type, criteria.type);
      
      return isWithinWindow && isSameType;
    });
  }
  
  enrichWorkoutData(existingWorkout, externalData) {
    // Add external data WITHOUT overwriting manual entries
    const enriched = {
      ...existingWorkout,
      dataSources: {
        manual: existingWorkout.dataSources?.manual || {},
        [externalData.source]: externalData
      },
      enrichment: {
        source: externalData.source,
        syncedAt: Date.now(),
        addedData: {}
      }
    };
    
    // Priority: Manual data always wins
    // Only add data that wasn't manually entered
    if (!existingWorkout.heartRate && externalData.heartRate) {
      enriched.enrichment.addedData.heartRate = {
        avg: externalData.avgHeartRate,
        max: externalData.maxHeartRate,
        source: externalData.source
      };
      enriched.heartRate = externalData.heartRate;
    }
    
    if (!existingWorkout.calories && externalData.calories) {
      enriched.enrichment.addedData.calories = {
        value: externalData.calories,
        source: externalData.source
      };
      enriched.calories = externalData.calories;
    }
    
    // Validate RPE if we have heart rate data
    if (externalData.avgHeartRate && existingWorkout.rpe) {
      enriched.enrichment.rpeValidation = this.validateRPE(
        existingWorkout.rpe, 
        externalData.avgHeartRate,
        UserDataStore.coreStats.age
      );
    }
    
    // Show enrichment notification
    this.notifyEnrichment(enriched);
    
    // Save enriched workout
    this.saveEnrichedWorkout(enriched);
    
    return enriched;
  }
  
  validateRPE(userRPE, avgHeartRate, userAge) {
    // Check if RPE aligns with heart rate data
    const maxHR = 220 - userAge;
    const hrPercentage = (avgHeartRate / maxHR) * 100;
    
    // HR zones to RPE mapping
    const hrToRPE = {
      50: 5,  // 50% max HR ≈ RPE 5
      60: 6,  // 60% max HR ≈ RPE 6  
      70: 7,  // 70% max HR ≈ RPE 7
      80: 8,  // 80% max HR ≈ RPE 8
      90: 9,  // 90% max HR ≈ RPE 9
      95: 10  // 95% max HR ≈ RPE 10
    };
    
    const calculatedRPE = Math.round(hrPercentage / 10);
    const difference = Math.abs(userRPE - calculatedRPE);
    
    if (difference > 2) {
      return {
        userRPE,
        hrBasedRPE: calculatedRPE,
        match: false,
        message: 'RPE significantly differs from HR - consider fatigue, stress, or dehydration'
      };
    }
    
    return {
      validated: true,
      userRPE,
      hrBasedRPE: calculatedRPE,
      match: true,
      message: 'RPE aligns with heart rate data'
    };
  }
  
  offerWorkoutImport(externalWorkout) {
    // Found workout in Strava/Garmin but not in our app
    const importModal = document.createElement('div');
    importModal.className = 'import-modal';
    importModal.innerHTML = `
      <div class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 999;">
        <div class="modal-content" style="position: relative; background: #2d3748; padding: 25px; border-radius: 12px; max-width: 500px; margin: 100px auto;">
          <h3 style="color: #68d391; margin-bottom: 15px;">
            Import ${externalWorkout.source} Workout?
          </h3>
          
          <div style="background: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="color: #e2e8f0; margin-bottom: 10px;">
              <strong>${externalWorkout.type}</strong> on ${formatDate(externalWorkout.date)}
            </p>
            <div style="color: #a0aec0; font-size: 14px;">
              <p>⏱️ Time: ${formatTime(externalWorkout.startTime)}</p>
              <p>⏳ Duration: ${externalWorkout.duration} min</p>
              ${externalWorkout.calories ? `<p>🔥 Calories: ${externalWorkout.calories}</p>` : ''}
              ${externalWorkout.distance ? `<p>📏 Distance: ${externalWorkout.distance}</p>` : ''}
              ${externalWorkout.avgHeartRate ? `<p>❤️ Avg HR: ${externalWorkout.avgHeartRate} bpm</p>` : ''}
            </div>
          </div>
          
          <div style="display: flex; gap: 10px;">
            <button onclick="importAsWorkout('${externalWorkout.id}')" class="btn" style="flex: 1;">
              📥 Import as Workout
            </button>
            <button onclick="importAsRecovery('${externalWorkout.id}')" class="btn btn-secondary" style="flex: 1;">
              🧘 Import as Recovery
            </button>
            <button onclick="ignoreImport('${externalWorkout.id}')" class="btn btn-secondary" style="flex: 1;">
              ❌ Ignore
            </button>
          </div>
          
          <div style="margin-top: 10px;">
            <label style="color: #a0aec0; font-size: 12px;">
              <input type="checkbox" id="rememberChoice"> Remember this choice for similar workouts
            </label>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(importModal);
  }
  
  notifyEnrichment(enrichedWorkout) {
    const notification = document.createElement('div');
    notification.className = 'enrichment-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 1000;
      animation: slideInRight 0.3s ease;
      max-width: 350px;
    `;
    
    const addedFields = Object.keys(enrichedWorkout.enrichment.addedData);
    notification.innerHTML = `
      <div style="display: flex; align-items: start; gap: 10px;">
        <span style="font-size: 20px;">✨</span>
        <div style="flex: 1;">
          <strong>Workout Enhanced!</strong><br>
          <small style="opacity: 0.9;">
            Added ${addedFields.join(', ')} from ${enrichedWorkout.enrichment.source}
          </small>
          ${enrichedWorkout.enrichment.rpeValidation ? `
            <div style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">
              <small>
                ${enrichedWorkout.enrichment.rpeValidation.match ? '✅' : '⚠️'}
                RPE ${enrichedWorkout.enrichment.rpeValidation.userRPE} 
                ${enrichedWorkout.enrichment.rpeValidation.match ? 'confirmed' : 'differs'} 
                from HR data (RPE ${enrichedWorkout.enrichment.rpeValidation.hrBasedRPE})
              </small>
            </div>
          ` : ''}
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 20px;">
          ×
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => notification.remove(), 5000);
  }
}

// Workout Type Matching Logic
const workoutTypeMap = {
  // External service type -> Our workout types
  'Weight Training': ['Upper Body', 'Lower Body', 'Full Body', 'Upper A', 'Upper B', 'Lower A', 'Lower B'],
  'Strength Training': ['Upper Body', 'Lower Body', 'Full Body', 'Upper A', 'Upper B', 'Lower A', 'Lower B'],
  'Strength': ['Upper Body', 'Lower Body', 'Full Body'],
  'Run': ['Conditioning', 'Recovery Run', 'Sprint Work'],
  'Running': ['Conditioning', 'Recovery Run', 'Sprint Work'],
  'Soccer': ['Soccer (Outdoor)', 'Soccer (Indoor)'],
  'Football': ['Soccer (Outdoor)', 'Soccer (Indoor)'],
  'Yoga': ['Recovery', 'Mobility', 'Recovery Day'],
  'Walk': ['Active Recovery', 'Recovery'],
  'Walking': ['Active Recovery', 'Recovery'],
  'Cycling': ['Conditioning', 'Active Recovery'],
  'Bike': ['Conditioning', 'Active Recovery']
};

function matchesWorkoutType(appType, externalType) {
  // Normalize strings for comparison
  const normalizedApp = appType.toLowerCase().trim();
  const normalizedExternal = externalType.toLowerCase().trim();
  
  // Check exact match first
  if (normalizedApp === normalizedExternal) {
    return true;
  }
  
  // Check if external type maps to app type
  for (const [external, appTypes] of Object.entries(workoutTypeMap)) {
    if (normalizedExternal.includes(external.toLowerCase())) {
      return appTypes.some(type => 
        normalizedApp.includes(type.toLowerCase())
      );
    }
  }
  
  // Check partial matches for flexibility
  const keywords = ['upper', 'lower', 'soccer', 'recovery', 'conditioning'];
  for (const keyword of keywords) {
    if (normalizedApp.includes(keyword) && normalizedExternal.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

// Visual Indication of Data Sources in Workout Display
function displayEnrichedWorkout(workout) {
  const dataSources = Object.keys(workout.dataSources || { manual: true });
  
  return `
    <div class="workout-card" style="background: #2d3748; padding: 20px; border-radius: 10px; margin-bottom: 15px;">
      <div class="workout-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="color: #e2e8f0; margin: 0;">${workout.type}</h3>
        <div class="data-sources" style="display: flex; gap: 8px;">
          ${dataSources.map(source => `
            <span class="source-badge ${source}" style="
              background: ${getSourceColor(source)};
              color: white;
              padding: 3px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            ">
              ${getSourceIcon(source)} ${source}
            </span>
          `).join('')}
        </div>
      </div>
      
      <div class="workout-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px;">
        ${workout.duration ? `
          <div class="stat">
            <label style="color: #a0aec0; font-size: 12px;">Duration</label>
            <div style="color: #e2e8f0; font-size: 18px; font-weight: 600;">
              ${workout.duration} min
              ${getDataSourceIndicator(workout, 'duration')}
            </div>
          </div>
        ` : ''}
        
        ${workout.calories ? `
          <div class="stat">
            <label style="color: #a0aec0; font-size: 12px;">Calories</label>
            <div style="color: #e2e8f0; font-size: 18px; font-weight: 600;">
              ${workout.calories}
              ${getDataSourceIndicator(workout, 'calories')}
            </div>
          </div>
        ` : ''}
        
        ${workout.heartRate?.avg ? `
          <div class="stat">
            <label style="color: #a0aec0; font-size: 12px;">Avg HR</label>
            <div style="color: #e2e8f0; font-size: 18px; font-weight: 600;">
              ${workout.heartRate.avg} bpm
              ${getDataSourceIndicator(workout, 'heartRate')}
            </div>
          </div>
        ` : ''}
        
        ${workout.rpe ? `
          <div class="stat">
            <label style="color: #a0aec0; font-size: 12px;">RPE</label>
            <div style="color: #e2e8f0; font-size: 18px; font-weight: 600;">
              ${workout.rpe}/10
              ${getDataSourceIndicator(workout, 'rpe')}
              ${workout.enrichment?.rpeValidation ? `
                <span style="
                  color: ${workout.enrichment.rpeValidation.match ? '#68d391' : '#fbbf24'};
                  font-size: 12px;
                  margin-left: 5px;
                ">
                  ${workout.enrichment.rpeValidation.match ? '✓' : '⚠'} HR verified
                </span>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function getSourceColor(source) {
  const colors = {
    manual: '#10b981',    // Green
    strava: '#fc4c02',    // Strava orange
    garmin: '#007cc3',    // Garmin blue
    apple: '#000000',     // Apple black
    whoop: '#01b3e3',     // Whoop cyan
    calculated: '#8b5cf6' // Purple
  };
  return colors[source.toLowerCase()] || '#6b7280';
}

function getSourceIcon(source) {
  const icons = {
    manual: '📝',
    strava: '🚴',
    garmin: '⌚',
    apple: '🍎',
    whoop: '💤',
    calculated: '🧮'
  };
  return icons[source.toLowerCase()] || '📊';
}

function getDataSourceIndicator(workout, field) {
  // Find which source provided this data
  if (workout.enrichment?.addedData[field]) {
    const source = workout.enrichment.addedData[field].source;
    return `<span style="margin-left: 5px; opacity: 0.7;">${getSourceIcon(source)}</span>`;
  }
  return '<span style="margin-left: 5px; opacity: 0.7;">📝</span>'; // Default to manual
}

// Initialize reconciliation on sync
const workoutReconciliation = new WorkoutReconciliation();

// Add to sync manager
syncManager.onSyncComplete = async (service, data) => {
  if (data.workouts && data.workouts.length > 0) {
    for (const workout of data.workouts) {
      await workoutReconciliation.reconcileExternalWorkout({
        ...workout,
        source: service
      });
    }
  }
};
```

## Implementation Summary

This update will:

1. **2-Week View**: Shows current week (detailed), next week (projected), weeks 3-4 (structure only), plus training philosophy
2. **Data Flow**: Enter data once, automatically propagates to all tabs
3. **Smart Defaults**: Carries forward last session's energy, previous weights, etc.
4. **Data Hierarchy**: Manual > Garmin/Whoop > Strava > Calculated > Default
5. **Conflict Resolution**: Shows data source badges, allows user to override
6. **Auto-fill Suggestions**: "Use data from last Upper Body session?" - appears every time with smart recommendations
7. **Workout Deduplication**: Never creates duplicate workouts when syncing external services
8. **Data Enrichment**: Adds HR, calories, etc. to existing workouts without overwriting manual data
9. **RPE Validation**: Compares user's RPE against heart rate data to validate perceived effort
10. **Import Options**: For unmatched external workouts, offers to import as workout or recovery

## Testing Checklist
- [ ] Weight entered in Personal Data appears in all relevant tabs
- [ ] Energy level carries forward to next session
- [ ] Week 3-4 shows only structure, not specific weights
- [ ] Data source badges appear correctly
- [ ] Manual entries override synced data
- [ ] Auto-fill suggestions appear for repeated session types
- [ ] Macros recalculate when weight/height changes
- [ ] Syncing Strava doesn't duplicate existing workouts
- [ ] External data enriches but doesn't overwrite manual entries
- [ ] RPE validation shows when HR data is available
- [ ] Import modal appears for unmatched external workouts
- [ ] Data source indicators show on each stat (📝 for manual, 🚴 for Strava, etc.)