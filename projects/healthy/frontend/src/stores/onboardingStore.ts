import { create } from 'zustand';

export type Goal = 'lose_weight' | 'gain_muscle' | 'stay_active' | 'improve_habits';
export type BodyType = 'slim' | 'athletic' | 'average' | 'overweight';
export type Gender = 'male' | 'female' | 'other';
export type Schedule = 'morning' | 'afternoon' | 'night' | 'flexible';
export type Equipment = 'gym' | 'home' | 'outdoors' | 'none';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'gluten_free' | 'keto' | 'other';
export type Budget = 'low' | 'medium' | 'high';
export type PreviousAttempts = 'none' | 'few' | 'many';

export interface OnboardingData {
  goal?: Goal;
  profile?:    { gender: Gender; age: number; weight: number; height: number; bodyType: BodyType };
  lifestyle?:  { profession: string; workSchedule: Schedule; stressLevel: 1|2|3|4|5 };
  training?:   { daysPerWeek: number; equipment: Equipment[]; experience: Experience };
  nutrition?:  { dietType: DietType; restrictions: string[]; budget: Budget };
  health?:     { conditions: string[]; injuries: string[] };
  motivation?: { motivations: string[]; previousAttempts: PreviousAttempts; mainChallenge: string };
}

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface OnboardingState {
  data:          OnboardingData;
  currentStep:   OnboardingStep;
  completedSteps: Set<OnboardingStep>;

  setGoal:       (g: Goal) => void;
  setProfile:    (p: OnboardingData['profile'])    => void;
  setLifestyle:  (l: OnboardingData['lifestyle'])  => void;
  setTraining:   (t: OnboardingData['training'])   => void;
  setNutrition:  (n: OnboardingData['nutrition'])  => void;
  setHealth:     (h: OnboardingData['health'])     => void;
  setMotivation: (m: OnboardingData['motivation']) => void;
  setCurrentStep:(s: OnboardingStep) => void;
  markStepComplete: (s: OnboardingStep) => void;
  reset:         () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  data:           {},
  currentStep:    1,
  completedSteps: new Set<OnboardingStep>(),

  setGoal:       (goal)       => set((s) => ({ data: { ...s.data, goal } })),
  setProfile:    (profile)    => set((s) => ({ data: { ...s.data, profile } })),
  setLifestyle:  (lifestyle)  => set((s) => ({ data: { ...s.data, lifestyle } })),
  setTraining:   (training)   => set((s) => ({ data: { ...s.data, training } })),
  setNutrition:  (nutrition)  => set((s) => ({ data: { ...s.data, nutrition } })),
  setHealth:     (health)     => set((s) => ({ data: { ...s.data, health } })),
  setMotivation: (motivation) => set((s) => ({ data: { ...s.data, motivation } })),

  setCurrentStep: (step) => set({ currentStep: step }),

  markStepComplete: (step) => set((s) => ({
    completedSteps: new Set([...s.completedSteps, step]),
  })),

  reset: () => set({ data: {}, currentStep: 1, completedSteps: new Set<OnboardingStep>() }),
}));
