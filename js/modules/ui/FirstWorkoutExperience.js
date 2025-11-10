/**
 * FirstWorkoutExperience - Celebration and presentation of first workout
 * Shows after onboarding completion
 */

class FirstWorkoutExperience {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.workout = null;
    }

    /**
     * Show workout intro with celebration
     * @param {Object} workout - Workout data
     * @returns {string} Workout intro HTML
     */
    showWorkoutIntro(workout) {
        this.workout = workout || this.generateDefaultWorkout();

        return `
            <div data-component="FirstWorkoutExperience" class="workout-intro" style="
                max-width: 600px;
                margin: 2rem auto;
                padding: 2rem;
            ">
                <div class="celebration-header" style="
                    text-align: center;
                    margin-bottom: 2rem;
                ">
                    <div class="celebration-emoji" style="
                        font-size: 4rem;
                        margin-bottom: 1rem;
                        animation: bounce 1s ease-in-out;
                    ">🎉</div>
                    <h1 style="
                        color: #2d3748;
                        margin: 0 0 0.5rem 0;
                        font-size: 2rem;
                        font-weight: 700;
                    ">Your Plan is Ready!</h1>
                    <p style="
                        color: #718096;
                        margin: 0;
                        font-size: 1.125rem;
                    ">Here's your first personalized workout</p>
                </div>
                
                <div class="workout-card featured" style="
                    background: white;
                    border: 2px solid #4299e1;
                    border-radius: 12px;
                    padding: 2rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    margin-bottom: 2rem;
                ">
                    <div class="workout-header" style="
                        margin-bottom: 1.5rem;
                        padding-bottom: 1rem;
                        border-bottom: 1px solid #e2e8f0;
                    ">
                        <h2 style="
                            color: #2d3748;
                            margin: 0 0 0.75rem 0;
                            font-size: 1.5rem;
                            font-weight: 600;
                        ">${this.workout.name || 'Your First Workout'}</h2>
                        <div class="workout-meta" style="
                            display: flex;
                            gap: 1rem;
                            flex-wrap: wrap;
                        ">
                            <span class="duration" style="
                                display: inline-flex;
                                align-items: center;
                                gap: 0.5rem;
                                color: #4a5568;
                                font-size: 0.875rem;
                            ">⏱️ ${this.workout.duration || 45} min</span>
                            <span class="difficulty" style="
                                display: inline-flex;
                                align-items: center;
                                gap: 0.5rem;
                                color: #4a5568;
                                font-size: 0.875rem;
                            ">📈 ${this.workout.difficulty || 'Beginner Friendly'}</span>
                        </div>
                    </div>
                    
                    <div class="workout-preview" style="
                        margin-bottom: 1.5rem;
                    ">
                        <h3 style="
                            color: #2d3748;
                            margin: 0 0 1rem 0;
                            font-size: 1.125rem;
                            font-weight: 600;
                        ">What you'll do:</h3>
                        <ul class="exercise-preview" style="
                            list-style: none;
                            padding: 0;
                            margin: 0;
                            display: flex;
                            flex-direction: column;
                            gap: 0.5rem;
                        ">
                            ${this.renderExercisePreview()}
                        </ul>
                    </div>
                    
                    <div class="workout-encouragement" style="
                        background: #f7fafc;
                        padding: 1rem;
                        border-radius: 8px;
                        margin-bottom: 1.5rem;
                        border-left: 4px solid #4299e1;
                    ">
                        <p style="
                            margin: 0;
                            color: #2d3748;
                            line-height: 1.6;
                        "><strong>💡 AI Coach Says:</strong> ${this.getEncouragementMessage()}</p>
                    </div>
                    
                    <div class="workout-actions" style="
                        display: flex;
                        gap: 1rem;
                        flex-direction: column;
                    ">
                        <button class="btn-primary large" onclick="window.startFirstWorkout()" aria-label="Start your first workout" style="
                            background: #4299e1;
                            color: white;
                            border: none;
                            padding: 1rem 2rem;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 600;
                            font-size: 1.125rem;
                            width: 100%;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#3182ce'" onmouseout="this.style.background='#4299e1'">
                            Start My First Workout
                        </button>
                        <button class="btn-secondary" onclick="window.viewFullPlan()" aria-label="View full workout plan" style="
                            background: #e2e8f0;
                            color: #2d3748;
                            border: none;
                            padding: 0.75rem 1.5rem;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 600;
                            width: 100%;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#cbd5e0'" onmouseout="this.style.background='#e2e8f0'">
                            View Full Plan
                        </button>
                    </div>
                </div>
            </div>
            <style>
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            </style>
        `;
    }

    /**
     * Render exercise preview list
     * @returns {string} Exercise list HTML
     */
    renderExercisePreview() {
        if (!this.workout.exercises || this.workout.exercises.length === 0) {
            return `
                <li style="padding: 0.5rem; background: #f7fafc; border-radius: 4px;">🏃 Warm-up routine - 5 min</li>
                <li style="padding: 0.5rem; background: #f7fafc; border-radius: 4px;">💪 Main exercises - 30 min</li>
                <li style="padding: 0.5rem; background: #f7fafc; border-radius: 4px;">🧘 Cool-down & stretch - 10 min</li>
            `;
        }

        const preview = this.workout.exercises.slice(0, 3).map(ex => {
            const name = ex.name || ex.exercise || 'Exercise';
            const sets = ex.sets || 3;
            const reps = ex.reps || 10;
            const weight = ex.weight ? ` @ ${ex.weight}` : '';
            return `<li style="
                padding: 0.75rem;
                background: #f7fafc;
                border-radius: 6px;
                color: #2d3748;
            ">💪 ${name} - ${sets}x${reps}${weight}</li>`;
        }).join('');

        const moreCount = this.workout.exercises.length > 3
            ? `<li style="
                padding: 0.75rem;
                background: #edf2f7;
                border-radius: 6px;
                color: #4a5568;
                font-style: italic;
            ">+ ${this.workout.exercises.length - 3} more exercises</li>`
            : '';

        return preview + moreCount;
    }

    /**
     * Get encouragement message
     * @returns {string} Encouragement message
     */
    getEncouragementMessage() {
        const messages = [
            'This workout is perfectly tailored to your fitness level. Take your time and focus on proper form!',
            "Remember, consistency beats intensity. You're building a sustainable fitness habit!",
            "Every expert was once a beginner. You're taking the first step toward your goals!",
            'Listen to your body and adjust as needed. The AI will learn from your feedback!'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    /**
     * Generate default workout if none provided
     * @returns {Object} Default workout data
     */
    generateDefaultWorkout() {
        return {
            name: 'Welcome Workout',
            duration: 30,
            difficulty: 'Beginner Friendly',
            exercises: [
                { name: 'Warm-up', sets: 1, reps: '5 min' },
                { name: 'Bodyweight Squats', sets: 3, reps: 10 },
                { name: 'Push-ups', sets: 3, reps: 8 },
                { name: 'Plank', sets: 3, reps: '30 sec' },
                { name: 'Cool-down Stretch', sets: 1, reps: '5 min' }
            ]
        };
    }

    /**
     * Render celebration for workout completion
     * @returns {string} Completion celebration HTML
     */
    renderCompletionCelebration() {
        return `
            <div class="completion-celebration">
                <div class="celebration-emoji">🏆</div>
                <h1>Amazing! Your First Workout Complete!</h1>
                <p>You've taken the first step on your fitness journey</p>
                
                <div class="streak-badge">
                    <div class="streak-number">1</div>
                    <div class="streak-label">Workout Streak</div>
                </div>
                
                <div class="completion-actions">
                    <button class="btn-primary" onclick="window.viewProgress()" aria-label="View your progress">
                        View Progress
                    </button>
                    <button class="btn-secondary" onclick="window.viewNextWorkout()" aria-label="See next workout">
                        See Next Workout
                    </button>
                </div>
            </div>
        `;
    }
}

// Create global instance
window.FirstWorkoutExperience = FirstWorkoutExperience;

// Global helpers
window.startFirstWorkout = function() {
    if (window.Router) {
        window.Router.navigate('#/workouts');
    }
};

window.viewFullPlan = function() {
    if (window.Router) {
        window.Router.navigate('#/training');
    }
};

window.viewProgress = function() {
    if (window.Router) {
        window.Router.navigate('#/progress');
    }
};

window.viewNextWorkout = function() {
    if (window.Router) {
        window.Router.navigate('#/workouts');
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirstWorkoutExperience;
}

