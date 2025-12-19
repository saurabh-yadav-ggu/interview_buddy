import React from 'react';
import { BrainCircuit, Code, ClipboardCheck } from 'lucide-react';

interface HomePageProps {
  onStart: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onStart }) => {
  return (
    <div className="h-full bg-gradient-to-br from-blue-50 via-white to-red-50 overflow-y-auto">
      {/* Hero Section */}
      <section className="min-h-[85vh] flex flex-col items-center justify-center text-center px-6 pt-12 pb-20">
        <h1 className="text-5xl md:text-7xl font-extrabold text-blue-900 leading-tight mb-6">
          AI-Powered Smart <br className="hidden md:block" />
          Interviews for the <br className="hidden md:block" />
          <span className="text-blue-700">Future</span>
        </h1>
        
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Real-time AI interviews with live coding, camera analysis, and intelligent evaluation.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
          <button 
            onClick={onStart}
            className="px-8 py-4 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold text-lg transition shadow-md hover:shadow-lg w-full sm:w-auto"
          >
            Start Live Interview
          </button>
          <button className="px-8 py-4 bg-transparent border-2 border-blue-900 text-blue-900 rounded-lg font-bold text-lg hover:bg-blue-50 transition w-full sm:w-auto">
            Learn More
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-24 px-6 border-t border-blue-50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-blue-900 mb-16">Why Interview Buddy?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Card 1 */}
            <div className="p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 bg-white group hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <BrainCircuit className="w-7 h-7 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-blue-900 mb-3">AI-Driven Questions</h3>
              <p className="text-gray-600 leading-relaxed">
                Our RAG engine generates dynamic, role-specific questions from your own knowledge base.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 bg-white group hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Code className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-blue-900 mb-3">Live Coding Environment</h3>
              <p className="text-gray-600 leading-relaxed">
                Write and test code during the interview with real-time AI evaluation and feedback.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 bg-white group hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <ClipboardCheck className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-blue-900 mb-3">Transcript & Analysis</h3>
              <p className="text-gray-600 leading-relaxed">
                Complete session transcription and face-to-face confidence tracking for high-fidelity evaluation.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Simple Footer */}
      <footer className="bg-slate-50 py-12 text-center text-gray-500 text-sm border-t border-gray-200">
        <div className="mb-4">
          <span className="font-bold text-blue-900 text-lg">INTERVIEW BUDDY</span>
        </div>
        <p>© {new Date().getFullYear()} Interview Buddy. Powered by Google Gemini.</p>
      </footer>
    </div>
  );
};

export default HomePage;