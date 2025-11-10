/**
 * SportSelection - Primary sport selection step for onboarding
 * Enhanced for multi-sport beta requirements
 */

class SportSelection extends window.BaseComponent {
    constructor() {
        super();
        this.selectedPrimary = null;
        this.sportSpecificData = {};
        this.sportOptions = {
            running: {
                name: 'Running',
                description: 'Road, track, trail, and cross country',
                icon: '🏃‍♂️',
                subCategories: ['road', 'track', 'trail', 'cross_country']
            },
            cycling: {
                name: 'Cycling',
                description: 'Road, gravel, mountain, and indoor',
                icon: '🚴‍♂️',
                subCategories: ['road', 'gravel', 'mountain', 'indoor']
            },
            swimming: {
                name: 'Swimming',
                description: 'Pool and open water swimming',
                icon: '🏊‍♂️',
                subCategories: ['pool', 'open_water']
            },
            soccer: {
                name: 'Soccer/Football',
                description: 'Field training and match preparation',
                icon: '⚽',
                subCategories: ['11v11', '7v7', 'futsal', 'recreational']
            },
            general_fitness: {
                name: 'General Fitness',
                description: 'Strength, conditioning, and wellness',
                icon: '💪',
                subCategories: ['strength', 'conditioning', 'functional']
            }
        };
    }

    /**
     * Render sport selection step
     * @param {Object} onboardingData - Current onboarding data
     * @returns {string} HTML for step
     */
    render(onboardingData = {}) {
        this.onboardingData = onboardingData;
        this.selectedPrimary = onboardingData.primarySport || null;
        this.sportSpecificData = onboardingData.sportSpecific || {};

        return `
            <div class="onboarding-step sport-selection-step">
                <div class="step-header">
                    <h2>What's your primary training focus?</h2>
                    <p>This will determine your main training approach and zones</p>
                </div>

                <div class="sport-grid">
                    ${Object.entries(this.sportOptions).map(([key, sport]) => `
                        <div class="sport-card ${this.selectedPrimary === key ? 'selected' : ''}"
                             onclick="window.SportSelection.selectPrimarySport('${key}')"
                             data-sport="${key}">
                            <div class="sport-icon">${sport.icon}</div>
                            <h3>${sport.name}</h3>
                            <p>${sport.description}</p>
                            <div class="sport-subcategories">
                                ${sport.subCategories.map(sub => `
                                    <span class="subcategory">${sub.replace('_', ' ')}</span>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${this.selectedPrimary ? this.renderSportSpecificQuestions() : ''}

                <div class="step-actions">
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.previousStep()" aria-label="Go back">
                        Back
                    </button>
                    <button class="btn btn-primary" 
                            ${this.selectedPrimary ? '' : 'disabled'}
                            onclick="window.SportSelection.saveAndContinue()" 
                            aria-label="Continue to next step">
                        Continue
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Select primary sport
     * @param {string} sportKey - Sport key
     */
    selectPrimarySport(sportKey) {
        this.selectedPrimary = sportKey;

        // Update UI
        document.querySelectorAll('.sport-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-sport="${sportKey}"]`).classList.add('selected');

        // Render sport-specific questions
        const container = document.querySelector('.sport-selection-step');
        if (container) {
            const questionsHtml = this.renderSportSpecificQuestions();
            const existingQuestions = container.querySelector('.sport-specific-questions');
            if (existingQuestions) {
                existingQuestions.outerHTML = questionsHtml;
            } else {
                const actionsDiv = container.querySelector('.step-actions');
                if (actionsDiv) {
                    actionsDiv.insertAdjacentHTML('beforebegin', questionsHtml);
                }
            }

            // Re-enable continue button
            const continueBtn = container.querySelector('.btn-primary');
            if (continueBtn) {
                continueBtn.disabled = false;
            }
        }
    }

    /**
     * Render sport-specific questions
     * @returns {string} HTML for sport-specific questions
     */
    renderSportSpecificQuestions() {
        if (!this.selectedPrimary) {return '';}

        switch(this.selectedPrimary) {
            case 'running':
                return this.renderRunningQuestions();
            case 'cycling':
                return this.renderCyclingQuestions();
            case 'swimming':
                return this.renderSwimmingQuestions();
            case 'soccer':
                return this.renderSoccerQuestions();
            default:
                return '';
        }
    }

    /**
     * Render running-specific questions
     * @returns {string} HTML for running questions
     */
    renderRunningQuestions() {
        const data = this.sportSpecificData.running || {};

        return `
            <div class="sport-specific-questions">
                <h3>Running Specifics</h3>

                <div class="question-group">
                    <label for="running_focus">Primary running focus:</label>
                    <select id="running_focus" name="running_focus" value="${data.focus || ''}">
                        <option value="">Select focus...</option>
                        <option value="5k" ${data.focus === '5k' ? 'selected' : ''}>5K and shorter</option>
                        <option value="10k" ${data.focus === '10k' ? 'selected' : ''}>10K</option>
                        <option value="half_marathon" ${data.focus === 'half_marathon' ? 'selected' : ''}>Half Marathon</option>
                        <option value="marathon" ${data.focus === 'marathon' ? 'selected' : ''}>Marathon</option>
                        <option value="trail" ${data.focus === 'trail' ? 'selected' : ''}>Trail Running</option>
                        <option value="general" ${data.focus === 'general' ? 'selected' : ''}>General Fitness</option>
                    </select>
                </div>

                <div class="question-group">
                    <label for="recent_5k">Recent 5K time (if known):</label>
                    <input type="text" 
                           id="recent_5k" 
                           name="recent_5k" 
                           placeholder="e.g., 22:30"
                           value="${data.recent5k || ''}"
                           onchange="window.SportSelection.updateSportData('running', 'recent5k', this.value)">
                    <small>Helps estimate training zones</small>
                </div>

                <div class="question-group">
                    <label>Preferred training terrain:</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" name="terrain" value="road" ${(data.terrain || []).includes('road') ? 'checked' : ''} onchange="window.SportSelection.updateTerrain('road', this.checked)"> Road</label>
                        <label><input type="checkbox" name="terrain" value="track" ${(data.terrain || []).includes('track') ? 'checked' : ''} onchange="window.SportSelection.updateTerrain('track', this.checked)"> Track</label>
                        <label><input type="checkbox" name="terrain" value="trail" ${(data.terrain || []).includes('trail') ? 'checked' : ''} onchange="window.SportSelection.updateTerrain('trail', this.checked)"> Trails</label>
                        <label><input type="checkbox" name="terrain" value="treadmill" ${(data.terrain || []).includes('treadmill') ? 'checked' : ''} onchange="window.SportSelection.updateTerrain('treadmill', this.checked)"> Treadmill</label>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render cycling-specific questions
     * @returns {string} HTML for cycling questions
     */
    renderCyclingQuestions() {
        const data = this.sportSpecificData.cycling || {};

        return `
            <div class="sport-specific-questions">
                <h3>Cycling Specifics</h3>

                <div class="question-group">
                    <label for="cycling_type">Primary cycling type:</label>
                    <select id="cycling_type" name="cycling_type" value="${data.type || ''}">
                        <option value="">Select type...</option>
                        <option value="road" ${data.type === 'road' ? 'selected' : ''}>Road</option>
                        <option value="gravel" ${data.type === 'gravel' ? 'selected' : ''}>Gravel/CX</option>
                        <option value="mountain" ${data.type === 'mountain' ? 'selected' : ''}>Mountain</option>
                        <option value="indoor" ${data.type === 'indoor' ? 'selected' : ''}>Indoor Trainer</option>
                        <option value="recreational" ${data.type === 'recreational' ? 'selected' : ''}>Recreational</option>
                    </select>
                </div>

                <div class="question-group">
                    <label for="ftp_estimate">FTP estimate (watts):</label>
                    <input type="number" 
                           id="ftp_estimate" 
                           name="ftp_estimate" 
                           placeholder="e.g., 250"
                           value="${data.ftp || ''}"
                           onchange="window.SportSelection.updateSportData('cycling', 'ftp', this.value)">
                    <small>Functional Threshold Power - helps set training zones</small>
                </div>
            </div>
        `;
    }

    /**
     * Render swimming-specific questions
     * @returns {string} HTML for swimming questions
     */
    renderSwimmingQuestions() {
        const data = this.sportSpecificData.swimming || {};

        return `
            <div class="sport-specific-questions">
                <h3>Swimming Specifics</h3>

                <div class="question-group">
                    <label for="swim_environment">Primary swim environment:</label>
                    <select id="swim_environment" name="swim_environment" value="${data.environment || ''}">
                        <option value="">Select environment...</option>
                        <option value="pool" ${data.environment === 'pool' ? 'selected' : ''}>Pool</option>
                        <option value="open_water" ${data.environment === 'open_water' ? 'selected' : ''}>Open Water</option>
                        <option value="both" ${data.environment === 'both' ? 'selected' : ''}>Both</option>
                    </select>
                </div>

                <div class="question-group">
                    <label for="pool_length">Pool length:</label>
                    <select id="pool_length" name="pool_length" value="${data.poolLength || ''}">
                        <option value="">Select length...</option>
                        <option value="25m" ${data.poolLength === '25m' ? 'selected' : ''}>25m</option>
                        <option value="50m" ${data.poolLength === '50m' ? 'selected' : ''}>50m</option>
                        <option value="25yd" ${data.poolLength === '25yd' ? 'selected' : ''}>25yd</option>
                    </select>
                </div>
            </div>
        `;
    }

    /**
     * Render soccer-specific questions
     * @returns {string} HTML for soccer questions
     */
    renderSoccerQuestions() {
        const data = this.sportSpecificData.soccer || {};

        return `
            <div class="sport-specific-questions">
                <h3>Soccer Specifics</h3>

                <div class="question-group">
                    <label for="soccer_position">Primary position:</label>
                    <select id="soccer_position" name="soccer_position" value="${data.position || ''}">
                        <option value="">Select position...</option>
                        <option value="goalkeeper">Goalkeeper</option>
                        <option value="defender">Defender</option>
                        <option value="midfielder">Midfielder</option>
                        <option value="forward">Forward</option>
                        <option value="utility">Utility/All Positions</option>
                    </select>
                </div>

                <div class="question-group">
                    <label for="soccer_level">Competition level:</label>
                    <select id="soccer_level" name="soccer_level" value="${data.level || ''}">
                        <option value="">Select level...</option>
                        <option value="recreational">Recreational</option>
                        <option value="youth">Youth</option>
                        <option value="high_school">High School</option>
                        <option value="college">College</option>
                        <option value="semi_pro">Semi-Professional</option>
                        <option value="professional">Professional</option>
                    </select>
                </div>
            </div>
        `;
    }

    /**
     * Update sport-specific data
     * @param {string} sport - Sport key
     * @param {string} key - Data key
     * @param {*} value - Data value
     */
    updateSportData(sport, key, value) {
        if (!this.sportSpecificData[sport]) {
            this.sportSpecificData[sport] = {};
        }
        this.sportSpecificData[sport][key] = value;
    }

    /**
     * Update terrain selection
     * @param {string} terrain - Terrain type
     * @param {boolean} selected - Whether selected
     */
    updateTerrain(terrain, selected) {
        const sport = this.selectedPrimary;
        if (!this.sportSpecificData[sport]) {
            this.sportSpecificData[sport] = { terrain: [] };
        }
        if (!this.sportSpecificData[sport].terrain) {
            this.sportSpecificData[sport].terrain = [];
        }

        if (selected && !this.sportSpecificData[sport].terrain.includes(terrain)) {
            this.sportSpecificData[sport].terrain.push(terrain);
        } else if (!selected) {
            this.sportSpecificData[sport].terrain = this.sportSpecificData[sport].terrain.filter(t => t !== terrain);
        }
    }

    /**
     * Save data and continue to next step
     */
    saveAndContinue() {
        if (!this.selectedPrimary) {
            alert('Please select a primary sport first');
            return;
        }

        // Collect all form data
        const formData = this.collectFormData();

        // Update onboarding data
        const onboardingManager = window.OnboardingManager;
        if (onboardingManager) {
            onboardingManager.onboardingData.primarySport = this.selectedPrimary;
            onboardingManager.onboardingData.sportSpecific = this.sportSpecificData;
            onboardingManager.onboardingData.sportSelectionData = formData;

            // Save and continue
            onboardingManager.saveStepData('sport_selection', {
                primarySport: this.selectedPrimary,
                sportSpecific: this.sportSpecificData,
                ...formData
            });

            onboardingManager.nextStep();
        }
    }

    /**
     * Collect form data
     * @returns {Object} Form data
     */
    collectFormData() {
        const formData = {};
        const sport = this.selectedPrimary;

        if (sport === 'running') {
            const focusSelect = document.getElementById('running_focus');
            const recent5kInput = document.getElementById('recent_5k');
            if (focusSelect) {formData.focus = focusSelect.value;}
            if (recent5kInput) {formData.recent5k = recent5kInput.value;}
        } else if (sport === 'cycling') {
            const typeSelect = document.getElementById('cycling_type');
            const ftpInput = document.getElementById('ftp_estimate');
            if (typeSelect) {formData.type = typeSelect.value;}
            if (ftpInput) {formData.ftp = ftpInput.value;}
        } else if (sport === 'swimming') {
            const envSelect = document.getElementById('swim_environment');
            const poolSelect = document.getElementById('pool_length');
            if (envSelect) {formData.environment = envSelect.value;}
            if (poolSelect) {formData.poolLength = poolSelect.value;}
        } else if (sport === 'soccer') {
            const posSelect = document.getElementById('soccer_position');
            const levelSelect = document.getElementById('soccer_level');
            if (posSelect) {formData.position = posSelect.value;}
            if (levelSelect) {formData.level = levelSelect.value;}
        }

        return formData;
    }
}

// Create global instance
window.SportSelection = SportSelection;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SportSelection;
}

