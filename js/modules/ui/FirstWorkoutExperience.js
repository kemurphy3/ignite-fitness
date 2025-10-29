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
            <div data-component="FirstWorkoutExperience" class="workout-intro">
                <div class="celebration-header">
                    <div class="celebration-emoji">🎉</div>
                    <h1>Your Plan is Ready!</h1>
                    <p>Here's your first personalized workout</p>
                </div>
                
                <div class="workout-card featured">
                    <div class="workout-header">
                        <h2>${this.workout.name || 'Your First Workout'}</h2>
                        <div class="workout-meta">
                            <span class="duration">⏱️ ${this.workout.duration || 45} min</span>
                            <span class="difficulty">📈 ${this.workout.difficulty || 'Beginner Friendly'}</span>
                        </div>
                    </div>
                    
                    <div class="workout-preview">
                        <h3>What you'll do:</h3>
                        <ul class="exercise-preview">
                            ${this.renderExercisePreview()}
                        </ul>
                    </div>
                    
                    <div class="workout-encouragement">
                        <p><strong>💡 AI Coach Says:</strong> ${this.getEncouragementMessage()}</p>
                    </div>
                    
                    <div class="workout-actions">
                        <button class="btn-primary large" onclick="window.startFirstWorkout()" aria-label="Start your first workout">
                            Start My First Workout
                        </button>
                        <button class="btn-secondary" onclick="window.viewFullPlan()" aria-label="View full workout plan">
                            View Full Plan
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render exercise preview list
     * @returns {string} Exercise list HTML
     */
    renderExercisePreview() {
        if (!this.workout.exercises || this.workout.exercises.length === 0) {
            return `
                <li>Warm-up routine - 5 min</li>
                <li>Main exercises - 30 min</li>
                <li>Cool-down & stretch - 10 min</li>
            `;
        }

        const preview = this.workout.exercises.slice(0, 3).map(ex => 
            `<li>${ex.name || ex} - ${ex.sets || 3}x${ex.reps || 10}</li>`
        ).join('');
        
        const moreCount = this.workout.exercises.length > 3 
            ? `<li>+ ${this.workout.exercises.length - 3} more exercises</li>` 
            : '';
        
        return preview + moreCount;
    }

    /**
     * Get encouragement message
     * @returns {string} Encouragement message
     */
    getEncouragementMessage() {
        const messages = [
            "This workout is perfectly tailored to your fitness level. Take your time and focus on proper form!",
            "Remember, consistency beats intensity. You're building a sustainable fitness habit!",
            "Every expert was once a beginner. You're taking the first step toward your goals!",
            "Listen to your body and adjust as needed. The AI will learn from your feedback!"
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

