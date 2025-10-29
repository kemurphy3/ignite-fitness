/**
 * AI Module Index - Tree-shakeable exports
 * Only exports what's actually used to enable dead code elimination
 */

// Core AI modules
export { ExpertCoordinator } from './ExpertCoordinator.js';
export { MemoizedCoordinator } from './MemoizedCoordinator.js';

// Context modules
export { ContextAwareAI } from './context/ContextAwareAI.js';
export { CoordinatorContext } from './context/CoordinatorContext.js';

// Expert systems (only export if used)
export { StrengthCoach } from './experts/StrengthCoach.js';
export { SportsCoach } from './experts/SportsCoach.js';
export { PhysioCoach } from './experts/PhysioCoach.js';
export { NutritionCoach } from './experts/NutritionCoach.js';
export { AestheticsCoach } from './experts/AestheticsCoach.js';

// Utility modules
export { PatternDetector } from './PatternDetector.js';
export { ReadinessInference } from './ReadinessInference.js';
export { WhyThisDecider } from './WhyThisDecider.js';
export { AIDataValidator } from './AIDataValidator.js';
