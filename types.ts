export interface CandidateProfile {
  name: string;
  role: string;
  experienceLevel: 'Fresher' | 'Intermediate' | 'Experienced';
  resumeText: string;
  jobDescription: string;
}

export interface EvaluationReport {
  candidateOverview: {
    role: string;
    experienceLevel: string;
    duration: string;
  };
  technical: {
    score: number;
    strengths: string[];
    gaps: string[];
    accuracyVsContext: string;
  };
  communication: {
    score: number;
    observations: string[];
    suggestions: string[];
  };
  behavioral: {
    score: number;
    facialExpressionSummary: string;
    confidenceLevel: string;
    nervousIndicators: string[];
  };
  overall: {
    score: number;
    readiness: string;
    recommendation: 'Strong Hire' | 'Needs Improvement' | 'Not Ready Yet';
  };
  improvementPlan: {
    technical: string[];
    communication: string[];
    behavioral: string[];
  };
}

export enum AppState {
  HOME,
  SETUP,
  INTERVIEW,
  ANALYZING,
  REPORT,
  ABOUT,
  CONTACT
}

export interface AudioStreamConfig {
  sampleRate: number;
}