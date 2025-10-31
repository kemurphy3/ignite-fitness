/**
 * Goals Step - Multi-select goal selection with follow-up questions
 * Users can select multiple training goals with goal-specific follow-up questions
 */
class GoalsStep {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.followUpData = {}; // Store follow-up responses by goal
    }

    /**
     * Render goals selection step
     * @param {Object} existingData - Existing onboarding data
     * @returns {string} HTML for goals step
     */
    render(existingData = {}) {
        const selectedGoals = existingData.goals || [];
        this.followUpData = existingData.goalFollowUps || {};
        
        return `
            <div class="onboarding-step goals-step">
                <h2>What are your training goals?</h2>
                <p class="step-description">Select all that apply - we'll customize your plan based on your goals.</p>
                
                <div class="goals-grid">
                    <!-- Weight Loss -->
                    <label class="goal-option">
                        <input type="checkbox" value="weight_loss" 
                               ${selectedGoals.includes('weight_loss') ? 'checked' : ''}
                               data-goal="weight_loss"
                               onchange="window.GoalsStep?.handleGoalChange('weight_loss', this.checked)">
                        <div class="goal-card">
                            <span class="goal-icon">📉</span>
                            <div class="goal-content">
                                <div class="goal-label">Weight Loss</div>
                                <div class="goal-description">Lose fat while preserving muscle</div>
                            </div>
                        </div>
                    </label>
                    
                    <!-- Muscle Gain -->
                    <label class="goal-option">
                        <input type="checkbox" value="muscle_gain" 
                               ${selectedGoals.includes('muscle_gain') ? 'checked' : ''}
                               data-goal="muscle_gain"
                               onchange="window.GoalsStep?.handleGoalChange('muscle_gain', this.checked)">
                        <div class="goal-card">
                            <span class="goal-icon">💪</span>
                            <div class="goal-content">
                                <div class="goal-label">Muscle Gain</div>
                                <div class="goal-description">Build size and strength</div>
                            </div>
                        </div>
                    </label>
                    
                    <!-- Endurance -->
                    <label class="goal-option">
                        <input type="checkbox" value="endurance" 
                               ${selectedGoals.includes('endurance') ? 'checked' : ''}
                               data-goal="endurance"
                               onchange="window.GoalsStep?.handleGoalChange('endurance', this.checked)">
                        <div class="goal-card">
                            <span class="goal-icon">🏃</span>
                            <div class="goal-content">
                                <div class="goal-label">Endurance</div>
                                <div class="goal-description">Improve cardiovascular fitness</div>
                            </div>
                        </div>
                    </label>
                    
                    <!-- Athletic Performance -->
                    <label class="goal-option">
                        <input type="checkbox" value="athletic_performance" 
                               ${selectedGoals.includes('athletic_performance') ? 'checked' : ''}
                               data-goal="athletic_performance"
                               onchange="window.GoalsStep?.handleGoalChange('athletic_performance', this.checked)">
                        <div class="goal-card">
                            <span class="goal-icon">⚡</span>
                            <div class="goal-content">
                                <div class="goal-label">Athletic Performance</div>
                                <div class="goal-description">Get faster, stronger, more explosive</div>
                            </div>
                        </div>
                    </label>
                    
                    <!-- Sport-Specific -->
                    <label class="goal-option">
                        <input type="checkbox" value="sport_specific" 
                               ${selectedGoals.includes('sport_specific') ? 'checked' : ''}
                               data-goal="sport_specific"
                               onchange="window.GoalsStep?.handleGoalChange('sport_specific', this.checked)">
                        <div class="goal-card">
                            <span class="goal-icon">⚽</span>
                            <div class="goal-content">
                                <div class="goal-label">Sport-Specific</div>
                                <div class="goal-description">Train for your sport</div>
                            </div>
                        </div>
                    </label>
                    
                    <!-- V-Taper Physique -->
                    <label class="goal-option">
                        <input type="checkbox" value="v_taper" 
                               ${selectedGoals.includes('v_taper') ? 'checked' : ''}
                               data-goal="v_taper"
                               onchange="window.GoalsStep?.handleGoalChange('v_taper', this.checked)">
                        <div class="goal-card">
                            <span class="goal-icon">🎯</span>
                            <div class="goal-content">
                                <div class="goal-label">V-Taper Physique</div>
                                <div class="goal-description">Wide shoulders, strong back</div>
                            </div>
                        </div>
                    </label>
                    
                    <!-- General Fitness -->
                    <label class="goal-option">
                        <input type="checkbox" value="general_fitness" 
                               ${selectedGoals.includes('general_fitness') ? 'checked' : ''}
                               data-goal="general_fitness"
                               onchange="window.GoalsStep?.handleGoalChange('general_fitness', this.checked)">
                        <div class="goal-card">
                            <span class="goal-icon">💚</span>
                            <div class="goal-content">
                                <div class="goal-label">General Fitness</div>
                                <div class="goal-description">Stay active and healthy</div>
                            </div>
                        </div>
                    </label>
                </div>
                
                <!-- Follow-up questions container -->
                <div id="goal-follow-ups" class="goal-follow-ups">
                    ${this.renderFollowUps(selectedGoals)}
                </div>
                
                <div class="step-actions">
                    <button class="btn-secondary" onclick="window.OnboardingManager.skipStep()">
                        Skip for now
                    </button>
                    <button class="btn-primary" onclick="window.GoalsStep?.saveAndContinue()">
                        Continue →
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Render follow-up questions for selected goals
     * @param {Array} selectedGoals - Selected goal IDs
     * @returns {string} Follow-up HTML
     */
    renderFollowUps(selectedGoals) {
        if (!selectedGoals || selectedGoals.length === 0) {
            return '';
        }
        
        let html = '';
        selectedGoals.forEach(goal => {
            const followUpHtml = this.getFollowUpForGoal(goal);
            if (followUpHtml) {
                html += followUpHtml;
            }
        });
        
        return html;
    }
    
    /**
     * Get follow-up questions for a specific goal
     * @param {string} goal - Goal ID
     * @returns {string} Follow-up HTML
     */
    getFollowUpForGoal(goal) {
        const existingData = this.followUpData[goal] || {};
        
        switch (goal) {
            case 'weight_loss':
                return `
                    <div class="follow-up-section" data-goal="weight_loss">
                        <h3>Weight Loss Details</h3>
                        <div class="follow-up-question">
                            <label>How much weight do you want to lose per week?</label>
                            <select class="follow-up-input" data-goal="weight_loss" data-question="weekly_target">
                                <option value="">Select target...</option>
                                <option value="0.5" ${existingData.weekly_target === '0.5' ? 'selected' : ''}>0.5 lbs/week (gentle, sustainable)</option>
                                <option value="1" ${existingData.weekly_target === '1' ? 'selected' : ''}>1 lb/week (moderate)</option>
                                <option value="1.5" ${existingData.weekly_target === '1.5' ? 'selected' : ''}>1.5 lbs/week (aggressive)</option>
                                <option value="2" ${existingData.weekly_target === '2' ? 'selected' : ''}>2+ lbs/week (very aggressive)</option>
                            </select>
                        </div>
                        <div class="follow-up-question">
                            <label>Do you want to preserve muscle mass during weight loss?</label>
                            <div class="radio-group">
                                <label>
                                    <input type="radio" name="preserve_muscle_${goal}" value="yes" 
                                           ${existingData.preserve_muscle === 'yes' ? 'checked' : ''}>
                                    Yes, prioritize muscle preservation
                                </label>
                                <label>
                                    <input type="radio" name="preserve_muscle_${goal}" value="moderate" 
                                           ${existingData.preserve_muscle === 'moderate' ? 'checked' : ''}>
                                    Moderate focus
                                </label>
                                <label>
                                    <input type="radio" name="preserve_muscle_${goal}" value="no" 
                                           ${existingData.preserve_muscle === 'no' ? 'checked' : ''}>
                                    Weight loss is the priority
                                </label>
                            </div>
                        </div>
                    </div>
                `;
                
            case 'muscle_gain':
                return `
                    <div class="follow-up-section" data-goal="muscle_gain">
                        <h3>Muscle Gain Details</h3>
                        <div class="follow-up-question">
                            <label>What's your main focus area for muscle gain?</label>
                            <div class="checkbox-group">
                                <label>
                                    <input type="checkbox" value="upper_body" 
                                           ${existingData.focus_areas?.includes('upper_body') ? 'checked' : ''}>
                                    Upper body (chest, back, arms)
                                </label>
                                <label>
                                    <input type="checkbox" value="lower_body" 
                                           ${existingData.focus_areas?.includes('lower_body') ? 'checked' : ''}>
                                    Lower body (legs, glutes)
                                </label>
                                <label>
                                    <input type="checkbox" value="full_body" 
                                           ${existingData.focus_areas?.includes('full_body') ? 'checked' : ''}>
                                    Full body (balanced)
                                </label>
                            </div>
                        </div>
                        <div class="follow-up-question">
                            <label>What's your training experience level?</label>
                            <select class="follow-up-input" data-goal="muscle_gain" data-question="experience">
                                <option value="">Select experience...</option>
                                <option value="beginner" ${existingData.experience === 'beginner' ? 'selected' : ''}>Beginner (0-6 months)</option>
                                <option value="intermediate" ${existingData.experience === 'intermediate' ? 'selected' : ''}>Intermediate (6-24 months)</option>
                                <option value="advanced" ${existingData.experience === 'advanced' ? 'selected' : ''}>Advanced (2+ years)</option>
                            </select>
                        </div>
                    </div>
                `;
                
            case 'endurance':
                return `
                    <div class="follow-up-section" data-goal="endurance">
                        <h3>Endurance Training Details</h3>
                        <div class="follow-up-question">
                            <label>What type of endurance training do you prefer?</label>
                            <div class="radio-group">
                                <label>
                                    <input type="radio" name="endurance_type_${goal}" value="running" 
                                           ${existingData.endurance_type === 'running' ? 'checked' : ''}>
                                    Running / Jogging
                                </label>
                                <label>
                                    <input type="radio" name="endurance_type_${goal}" value="cycling" 
                                           ${existingData.endurance_type === 'cycling' ? 'checked' : ''}>
                                    Cycling
                                </label>
                                <label>
                                    <input type="radio" name="endurance_type_${goal}" value="swimming" 
                                           ${existingData.endurance_type === 'swimming' ? 'checked' : ''}>
                                    Swimming
                                </label>
                                <label>
                                    <input type="radio" name="endurance_type_${goal}" value="mixed" 
                                           ${existingData.endurance_type === 'mixed' ? 'checked' : ''}>
                                    Mixed (variety)
                                </label>
                            </div>
                        </div>
                        <div class="follow-up-question">
                            <label>What's your target endurance distance/duration?</label>
                            <select class="follow-up-input" data-goal="endurance" data-question="target_distance">
                                <option value="">Select target...</option>
                                <option value="5k" ${existingData.target_distance === '5k' ? 'selected' : ''}>5K / 20-30 min</option>
                                <option value="10k" ${existingData.target_distance === '10k' ? 'selected' : ''}>10K / 45-60 min</option>
                                <option value="half_marathon" ${existingData.target_distance === 'half_marathon' ? 'selected' : ''}>Half Marathon / 1.5-2 hours</option>
                                <option value="marathon" ${existingData.target_distance === 'marathon' ? 'selected' : ''}>Marathon / 3+ hours</option>
                                <option value="ultra" ${existingData.target_distance === 'ultra' ? 'selected' : ''}>Ultra / 4+ hours</option>
                            </select>
                        </div>
                    </div>
                `;
                
            case 'sport_specific':
                return `
                    <div class="follow-up-section" data-goal="sport_specific">
                        <h3>Sport-Specific Training Details</h3>
                        <div class="follow-up-question">
                            <label>What sport are you training for?</label>
                            <select class="follow-up-input" data-goal="sport_specific" data-question="sport">
                                <option value="">Select sport...</option>
                                <option value="soccer" ${existingData.sport === 'soccer' ? 'selected' : ''}>Soccer / Football</option>
                                <option value="basketball" ${existingData.sport === 'basketball' ? 'selected' : ''}>Basketball</option>
                                <option value="tennis" ${existingData.sport === 'tennis' ? 'selected' : ''}>Tennis</option>
                                <option value="swimming" ${existingData.sport === 'swimming' ? 'selected' : ''}>Swimming</option>
                                <option value="running" ${existingData.sport === 'running' ? 'selected' : ''}>Running / Track</option>
                                <option value="cycling" ${existingData.sport === 'cycling' ? 'selected' : ''}>Cycling</option>
                                <option value="other" ${existingData.sport === 'other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div class="follow-up-question" id="sport-position-question" style="display: none;">
                            <label>What position do you play? (if applicable)</label>
                            <input type="text" class="follow-up-input" data-goal="sport_specific" data-question="position" 
                                   placeholder="e.g., midfielder, forward, goalkeeper..." 
                                   value="${existingData.position || ''}">
                        </div>
                        <div class="follow-up-question">
                            <label>When is your main season/competition?</label>
                            <select class="follow-up-input" data-goal="sport_specific" data-question="season_phase">
                                <option value="">Select phase...</option>
                                <option value="off_season" ${existingData.season_phase === 'off_season' ? 'selected' : ''}>Off-Season (base building)</option>
                                <option value="pre_season" ${existingData.season_phase === 'pre_season' ? 'selected' : ''}>Pre-Season (preparation)</option>
                                <option value="in_season" ${existingData.season_phase === 'in_season' ? 'selected' : ''}>In-Season (maintenance)</option>
                                <option value="playoffs" ${existingData.season_phase === 'playoffs' ? 'selected' : ''}>Playoffs (peak performance)</option>
                                <option value="post_season" ${existingData.season_phase === 'post_season' ? 'selected' : ''}>Post-Season (recovery)</option>
                            </select>
                        </div>
                    </div>
                `;
                
            default:
                return '';
        }
    }
    
    /**
     * Handle goal checkbox change
     * @param {string} goal - Goal ID
     * @param {boolean} checked - Is checked
     */
    handleGoalChange(goal, checked) {
        const followUpsContainer = document.getElementById('goal-follow-ups');
        if (!followUpsContainer) return;
        
        if (checked) {
            // Show follow-up questions
            const followUpHtml = this.getFollowUpForGoal(goal);
            if (followUpHtml) {
                // Check if already rendered
                const existing = followUpsContainer.querySelector(`[data-goal="${goal}"]`);
                if (!existing) {
                    followUpsContainer.insertAdjacentHTML('beforeend', followUpHtml);
                    this.attachFollowUpListeners(goal);
                }
            }
        } else {
            // Remove follow-up questions
            const section = followUpsContainer.querySelector(`[data-goal="${goal}"]`);
            if (section) {
                section.remove();
                delete this.followUpData[goal];
            }
        }
        
        // Show/hide position question based on sport selection
        if (goal === 'sport_specific') {
            this.updateSportSpecificVisibility();
        }
    }
    
    /**
     * Attach event listeners to follow-up inputs
     * @param {string} goal - Goal ID
     */
    attachFollowUpListeners(goal) {
        const section = document.querySelector(`[data-goal="${goal}"]`);
        if (!section) return;
        
        // Handle select inputs
        section.querySelectorAll('select.follow-up-input').forEach(select => {
            select.addEventListener('change', (e) => {
                const question = select.dataset.question;
                if (!this.followUpData[goal]) this.followUpData[goal] = {};
                this.followUpData[goal][question] = select.value;
            });
        });
        
        // Handle text inputs
        section.querySelectorAll('input[type="text"].follow-up-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const question = input.dataset.question;
                if (!this.followUpData[goal]) this.followUpData[goal] = {};
                this.followUpData[goal][question] = input.value;
            });
        });
        
        // Handle radio buttons
        section.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const question = e.target.name.replace(`_${goal}`, '');
                if (!this.followUpData[goal]) this.followUpData[goal] = {};
                this.followUpData[goal][question] = e.target.value;
            });
        });
        
        // Handle checkboxes
        section.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const question = 'focus_areas';
                if (!this.followUpData[goal]) this.followUpData[goal] = {};
                if (!this.followUpData[goal][question]) this.followUpData[goal][question] = [];
                
                if (e.target.checked) {
                    this.followUpData[goal][question].push(e.target.value);
                } else {
                    this.followUpData[goal][question] = this.followUpData[goal][question].filter(v => v !== e.target.value);
                }
            });
        });
        
        // Special handling for sport-specific
        if (goal === 'sport_specific') {
            const sportSelect = section.querySelector('[data-question="sport"]');
            if (sportSelect) {
                sportSelect.addEventListener('change', () => this.updateSportSpecificVisibility());
            }
            this.updateSportSpecificVisibility();
        }
    }
    
    /**
     * Update sport-specific visibility
     */
    updateSportSpecificVisibility() {
        const positionQuestion = document.getElementById('sport-position-question');
        if (!positionQuestion) return;
        
        const sportSelect = document.querySelector('[data-goal="sport_specific"][data-question="sport"]');
        if (sportSelect && (sportSelect.value === 'soccer' || sportSelect.value === 'basketball' || sportSelect.value === 'football')) {
            positionQuestion.style.display = 'block';
        } else {
            positionQuestion.style.display = 'none';
        }
    }
    
    /**
     * Save goals and follow-ups, then continue
     */
    saveAndContinue() {
        const selectedGoals = this.getSelectedGoals();
        
        // Save goals and follow-ups to onboarding data
        if (window.OnboardingManager) {
            window.OnboardingManager.setData('goals', selectedGoals);
            window.OnboardingManager.setData('goalFollowUps', this.followUpData);
        }
        
        // Continue to next step
        window.OnboardingManager.nextStep();
    }

    /**
     * Get selected goals
     * @returns {Array} Selected goal IDs
     */
    getSelectedGoals() {
        const checkboxes = document.querySelectorAll('.goal-option input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    /**
     * Validate step
     * @returns {boolean} Is valid
     */
    validate() {
        // At least one goal selected OR skipped
        return true; // Goals are optional
    }
}

// Create global instance
window.GoalsStep = new GoalsStep();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoalsStep;
}
