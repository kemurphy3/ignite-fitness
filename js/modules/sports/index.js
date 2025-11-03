/**
 * Sports Module Index - Tree-shakeable exports
 * Only exports what's actually used to enable dead code elimination
 */

// Core sports modules
export { SoccerExercises } from './SoccerExercises.js';
export { SeasonalPrograms } from './SeasonalPrograms.js';
export { SeasonalTrainingSystem } from './SeasonalTrainingSystem.js';

// Exercise libraries
export { ExerciseLibrary } from './ExerciseLibrary.js';
export { MovementScreens } from './MovementScreens.js';

// Training systems
export { WorkoutGenerator } from '../workout/WorkoutGenerator.js';
export { PeriodizationManager } from './PeriodizationManager.js';

// Workout catalog
export { WorkoutCatalog } from './WorkoutCatalog.js';
