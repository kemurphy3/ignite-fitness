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

## Implementation Summary

This update will:

1. **2-Week View**: Shows current week (detailed), next week (projected), weeks 3-4 (structure only), plus training philosophy
2. **Data Flow**: Enter data once, automatically propagates to all tabs
3. **Smart Defaults**: Carries forward last session's energy, previous weights, etc.
4. **Data Hierarchy**: Manual > Garmin/Whoop > Strava > Calculated > Default
5. **Conflict Resolution**: Shows data source badges, allows user to override
6. **Auto-fill Suggestions**: "Use data from last Upper Body session?"

## Testing Checklist
- [ ] Weight entered in Personal Data appears in all relevant tabs
- [ ] Energy level carries forward to next session
- [ ] Week 3-4 shows only structure, not specific weights
- [ ] Data source badges appear correctly
- [ ] Manual entries override synced data
- [ ] Auto-fill suggestions appear for repeated session types
- [ ] Macros recalculate when weight/height changes