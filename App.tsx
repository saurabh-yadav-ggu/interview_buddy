import React, { useState } from 'react';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import SetupForm from './components/SetupForm';
import LiveInterview from './components/LiveInterview';
import ReportView from './components/ReportView';
import HomePage from './components/HomePage';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import { AppState, CandidateProfile, EvaluationReport } from './types';
import { Loader2, AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const AppContent: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  const { currentUser } = useAuth();

  const handleStartInterviewClick = () => {
    if (currentUser) {
      setAppState(AppState.SETUP);
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const handleLoginSuccess = () => {
    // Automatically proceed to setup after successful login if that was the intent
    setAppState(AppState.SETUP);
  };

  const handleSetupComplete = (newProfile: CandidateProfile) => {
    setProfile(newProfile);
    setAppState(AppState.INTERVIEW);
  };

  const generateReport = async (transcript: string) => {
    if (!profile) return;
    
    setAppState(AppState.ANALYZING);
    setGenerationError(null);

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please ensure 'API_KEY' is set in your .env file or deployment environment variables.");
      }

      const ai = new GoogleGenAI({ apiKey: apiKey });

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
        ${transcript ? transcript.substring(0, 50000) : "No transcript available. Evaluate based on an assumption of average performance or incomplete session."} 
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

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: reportSchema
        }
      });
      
      let jsonText = response.text;
      
      if (!jsonText) {
         throw new Error("The AI model returned an empty response. This might be due to safety filters or connection issues.");
      }

      // Robust Cleaning: Remove Markdown and find JSON object
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);
      }

      try {
        const reportData = JSON.parse(jsonText) as EvaluationReport;
        setReport(reportData);
        setAppState(AppState.REPORT);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError, "Raw Text:", jsonText);
        throw new Error("Failed to parse the report data. The AI response was not valid JSON.");
      }

    } catch (error) {
      console.error("Error generating report:", error);
      setGenerationError(error instanceof Error ? error.message : "An unexpected error occurred.");
    }
  };

  return (
    <div className="h-screen bg-slate-50 font-sans text-gray-900 flex flex-col overflow-hidden">
      
      <Navbar 
        onHomeClick={() => setAppState(AppState.HOME)}
        onAboutClick={() => setAppState(AppState.ABOUT)}
        onContactClick={() => setAppState(AppState.CONTACT)}
        onStartClick={handleStartInterviewClick}
      />

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <main className="flex-1 relative overflow-hidden flex flex-col">
        {appState === AppState.HOME && (
          <HomePage onStart={handleStartInterviewClick} />
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
          <div className="flex flex-col items-center justify-center h-full bg-white px-4 text-center">
            {generationError ? (
              <div className="max-w-md bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm animate-fade-in">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-red-700 mb-2">Report Generation Failed</h3>
                <p className="text-red-600 mb-6 text-sm">{generationError}</p>
                <button 
                  onClick={() => setAppState(AppState.SETUP)}
                  className="bg-white border border-red-200 text-red-700 px-6 py-2 rounded-lg font-semibold hover:bg-red-50 transition"
                >
                  Return to Setup
                </button>
              </div>
            ) : (
              <>
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-gray-800">Generating Performance Report...</h2>
                <p className="text-gray-500 mt-2 max-w-lg">
                  Analyzing interview transcript, technical accuracy, and communication skills. This may take 30-60 seconds.
                </p>
              </>
            )}
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

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;