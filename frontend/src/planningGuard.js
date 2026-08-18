import { ai } from './ai';

// The app previously had two independent week planners: WeekFocus and an AI
// text plan. That created contradictory schedules. WeekFocus is now canonical;
// legacy callers are intentionally stopped without affecting coach reports or
// photo/session analysis.
ai.weeklyTrainingPlan = async function () {
  throw new Error('WeekFocus is de enige trainingsplanning');
};
