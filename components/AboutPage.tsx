import React from 'react';
import { Target, Cpu, MessageSquareText, FileText } from 'lucide-react';

const AboutPage: React.FC = () => {
  return (
    <div className="h-full bg-slate-50 overflow-y-auto">
      {/* Header Section */}
      <div className="bg-blue-900 text-white py-20 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">About Interview Mate</h1>
        <p className="text-xl text-blue-100 max-w-3xl mx-auto">
          Bridging the gap between preparation and performance with AI-driven interview simulations.
        </p>
      </div>

      <div className="container mx-auto px-6 py-16 max-w-5xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Mission</h2>
          <p className="text-gray-600 leading-relaxed text-lg">
            Interview Mate is designed to help job seekers, students, and professionals master technical interviews. 
            By leveraging advanced Generative AI from Google, we provide a realistic, pressure-free environment where you can 
            practice, fail, learn, and improve before the actual interview.
          </p>
        </div>

        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mr-5 flex-shrink-0">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Context-Aware Analysis</h3>
              <p className="text-gray-600">
                We use RAG (Retrieval-Augmented Generation) to read your uploaded resume and job description, ensuring every question is relevant to your specific goal.
              </p>
            </div>
          </div>

          <div className="flex p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mr-5 flex-shrink-0">
              <MessageSquareText size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Natural Conversation</h3>
              <p className="text-gray-600">
                Powered by Gemini Live API, our AI interviewer speaks, listens, and reacts in real-time with human-like latency and intonation.
              </p>
            </div>
          </div>

          <div className="flex p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 mr-5 flex-shrink-0">
              <Cpu size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Technical Assessment</h3>
              <p className="text-gray-600">
                A built-in code editor allows you to solve coding challenges while the AI observes your logic and provides feedback on your syntax and approach.
              </p>
            </div>
          </div>

          <div className="flex p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mr-5 flex-shrink-0">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Detailed Reporting</h3>
              <p className="text-gray-600">
                Get a comprehensive PDF report instantly, breaking down your technical scores, communication skills, and behavioral traits with actionable tips.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;