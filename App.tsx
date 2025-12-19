import React, { useState } from 'react';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import SetupForm from './components/SetupForm';
import LiveInterview from './components/LiveInterview';
import ReportView from './components/ReportView';
import HomePage from './components/HomePage';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import Navbar from './components/Navbar';
import { AppState, CandidateProfile, EvaluationReport } from './types';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);

  const handleSetupComplete = (newProfile: CandidateProfile) => {
    setProfile(newProfile);
    setAppState(AppState.INTERVIEW);
  };

  const generateReport = async (transcript: string) => {
    if (!profile || !process.env.API_KEY) return;
    
    setAppState(AppState.ANALYZING);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Schema for structured JSON output
      const reportSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          candidateOverview: {
            type: Type.OBJECT,
            properties: {
              role: { type: Type.STRING },
              experienceLevel: { type: Type.STRING },
              duration: { type: Type.STRING }
            },
            required: ["role", "experienceLevel", "duration"]
          },
          technical: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER, description: "Score out of 100" },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              accuracyVsContext: { type: Type.STRING }
            },
            required: ["score", "strengths", "gaps", "accuracyVsContext"]
          },
          communication: {
             type: Type.OBJECT,
             properties: {
               score: { type: Type.NUMBER, description: "Score out of 100" },
               observations: { type: Type.ARRAY, items: { type: Type.STRING } },
               suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
             },
             required: ["score", "observations", "suggestions"]
          },
          behavioral: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER, description: "Score out of 100" },
              facialExpressionSummary: { type: Type.STRING },
              confidenceLevel: { type: Type.STRING },
              nervousIndicators: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["score", "facialExpressionSummary", "confidenceLevel", "nervousIndicators"]
          },
          overall: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER, description: "Score out of 100" },
              readiness: { type: Type.STRING },
              recommendation: { type: Type.STRING, enum: ['Strong Hire', 'Needs Improvement', 'Not Ready Yet'] }
            },
            required: ["score", "readiness", "recommendation"]
          },
          improvementPlan: {
             type: Type.OBJECT,
             properties: {
               technical: { type: Type.ARRAY, items: { type: Type.STRING } },
               communication: { type: Type.ARRAY, items: { type: Type.STRING } },
               behavioral: { type: Type.ARRAY, items: { type: Type.STRING } }
             },
             required: ["technical", "communication", "behavioral"]
          }
        },
        required: ["candidateOverview", "technical", "communication", "behavioral", "overall", "improvementPlan"]
      };

      const prompt = `
        You are a STRICT and CRITICAL Technical Interview Evaluator. 
        
        Analyze the following INTERVIEW TRANSCRIPT between an AI Interviewer and the Candidate (${profile.name}).
        Use the context from the Resume and Job Description to evaluate accuracy.

        --- CONTEXT ---
        Role: ${profile.role}
        Level: ${profile.experienceLevel}
        Resume Snippet: ${profile.resumeText.substring(0, 1000)}...
        Job Description: ${profile.jobDescription.substring(0, 1000)}...

        --- INTERVIEW TRANSCRIPT ---
        ${transcript.substring(0, 50000)} 
        (If transcript is empty or too short, infer based on the fact that the candidate participated but maybe had technical audio issues, or simulate a neutral evaluation).
        ----------------------------

        Generate a detailed JSON evaluation report with SCORING OUT OF 100.
        
        SCORING GUIDELINES (0-100):
        - 90-100: Expert level, perfect answers, deep understanding.
        - 75-89: Strong candidate, minor mistakes, good communication.
        - 60-74: Average, conceptually correct but lacks depth or specific keyword usage.
        - 40-59: Below average, struggled with core concepts.
        - 0-39: Poor, completely incorrect or irrelevant answers.

        INSTRUCTIONS:
        1. **Technical Knowledge (0-100)**: Rate strictly based on correctness, depth, and relevance to the ${profile.role} role. Did they explain 'Why' and 'How'?
        2. **Communication (0-100)**: Assess clarity, fluency, and structure of thoughts.
        3. **Behavioral (0-100)**: Infer confidence, problem-solving approach, and honesty from the text.
        4. **Feedback**: Provide specific examples from the transcript in "strengths" and "gaps".

        IMPORTANT: Return ONLY valid JSON matching the schema.
      `;

      // Use Gemini 3 Pro for robust reasoning and JSON generation from complex transcripts
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: reportSchema
        }
      });
      
      const jsonText = response.text || "{}";
      const reportData = JSON.parse(jsonText) as EvaluationReport;
      
      setReport(reportData);
      setAppState(AppState.REPORT);

    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report. Please try again.");
      setAppState(AppState.SETUP); 
    }
  };

  return (
    <div className="h-screen bg-slate-50 font-sans text-gray-900 flex flex-col overflow-hidden">
      
      <Navbar 
        onHomeClick={() => setAppState(AppState.HOME)}
        onAboutClick={() => setAppState(AppState.ABOUT)}
        onContactClick={() => setAppState(AppState.CONTACT)}
        onStartClick={() => setAppState(AppState.SETUP)}
      />

      <main className="flex-1 relative overflow-hidden flex flex-col">
        {appState === AppState.HOME && (
          <HomePage onStart={() => setAppState(AppState.SETUP)} />
        )}
        
        {appState === AppState.ABOUT && (
          <AboutPage />
        )}

        {appState === AppState.CONTACT && (
          <ContactPage />
        )}

        {appState === AppState.SETUP && (
          <div className="h-full overflow-y-auto">
            <div className="container mx-auto px-4 py-12">
              <SetupForm onComplete={handleSetupComplete} />
            </div>
          </div>
        )}

        {appState === AppState.INTERVIEW && profile && (
          <LiveInterview 
            profile={profile} 
            onEndInterview={(transcript) => generateReport(transcript)} 
          />
        )}

        {appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center h-full bg-white">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-gray-800">Generating Performance Report...</h2>
            <p className="text-gray-500 mt-2">Analyzing interview transcript, technical accuracy, and communication skills.</p>
          </div>
        )}

        {appState === AppState.REPORT && report && (
          <div className="h-full overflow-y-auto">
             <div className="container mx-auto px-4 py-12">
                <ReportView 
                  report={report} 
                  onRestart={() => setAppState(AppState.HOME)} 
                />
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;