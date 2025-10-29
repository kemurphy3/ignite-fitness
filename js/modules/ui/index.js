/**
 * UI Module Index - Tree-shakeable exports
 * Only exports what's actually used to enable dead code elimination
 */

// Core UI components
export { DashboardRenderer } from './DashboardRenderer.js';
export { VirtualList } from './VirtualList.js';

// Chart components
export { ChartManager } from './charts/ChartManager.js';
export { Trends } from './charts/Trends.js';

// Input components
export { RPEInput } from './RPEInput.js';
export { TimerOverlay } from './components/WorkoutTimer.js';

// Panel components
export { WhyPanel } from './components/WhyPanel.js';
export { ErrorAlert } from './components/ErrorAlert.js';
export { SessionComplete } from './components/SessionComplete.js';
export { NextSessionPreview } from './components/NextSessionPreview.js';

// Onboarding
export { OnboardingManager } from '../onboarding/OnboardingManager.js';
