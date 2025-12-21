import React, { useState, useRef } from 'react';
import { CandidateProfile } from '../types';
import { User, Briefcase, FileText, ArrowRight, Upload, Loader2, AlertCircle } from 'lucide-react';
import { extractTextFromPDF } from '../utils/pdfUtils';

interface SetupFormProps {
  onComplete: (profile: CandidateProfile) => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ onComplete }) => {
  const [profile, setProfile] = useState<CandidateProfile>({
    name: '',
    role: '',
    experienceLevel: 'Intermediate',
    resumeText: '',
    jobDescription: ''
  });
  
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(profile);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setPdfError("Please upload a PDF file.");
      return;
    }

    setIsProcessingPdf(true);
    setPdfError(null);

    try {
      const text = await extractTextFromPDF(file);
      if (text.length < 50) {
        setPdfError("Could not extract enough text. The PDF might be an image/scanned. Please paste text manually.");
      } else {
        setProfile(prev => ({ ...prev, resumeText: text }));
      }
    } catch (err) {
      setPdfError("Failed to read PDF. Please paste text manually.");
    } finally {
      setIsProcessingPdf(false);
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
      <div className="text-center mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">AI Interview Setup</h1>
        <p className="text-sm md:text-base text-gray-500">Configure your mock interview session with context.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
        {/* Personal Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
              <User size={16} className="mr-2 text-blue-600" /> Candidate Name
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-gray-400"
              placeholder="e.g. Alex Johnson"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
              <Briefcase size={16} className="mr-2 text-blue-600" /> Target Role
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-gray-400"
              placeholder="e.g. Senior React Developer"
              value={profile.role}
              onChange={(e) => setProfile({ ...profile, role: e.target.value })}
            />
          </div>
        </div>

        {/* Experience Level */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Experience Level</label>
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {['Fresher', 'Intermediate', 'Experienced'].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setProfile({ ...profile, experienceLevel: level as any })}
                className={`py-3 px-2 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
                  profile.experienceLevel === level
                    ? 'bg-blue-600 text-white shadow-md transform scale-105'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Resume Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <label className="block text-sm font-semibold text-gray-700 flex items-center">
              <FileText size={16} className="mr-2 text-blue-600" /> Resume / Key Skills
            </label>
            
            <div className="relative">
              <input 
                type="file" 
                accept="application/pdf"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden" 
                id="resume-upload" 
              />
              <label 
                htmlFor="resume-upload"
                className={`cursor-pointer inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  ${isProcessingPdf ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'}
                `}
              >
                {isProcessingPdf ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" /> Extracting...
                  </>
                ) : (
                  <>
                    <Upload size={14} className="mr-1.5" /> Upload PDF
                  </>
                )}
              </label>
            </div>
          </div>

          {pdfError && (
             <div className="flex items-center p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100">
               <AlertCircle size={16} className="mr-2 flex-shrink-0" />
               {pdfError}
             </div>
          )}

          <textarea
            required
            rows={6}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition text-sm placeholder-gray-400 resize-y"
            placeholder="Paste your resume content or upload a PDF above..."
            value={profile.resumeText}
            onChange={(e) => setProfile({ ...profile, resumeText: e.target.value })}
          />
        </div>

        {/* Job Description Section */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
            <FileText size={16} className="mr-2 text-blue-600" /> Job Description / Requirements
          </label>
          <textarea
            required
            rows={5}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition text-sm placeholder-gray-400 resize-y"
            placeholder="Paste the job description you are interviewing for..."
            value={profile.jobDescription}
            onChange={(e) => setProfile({ ...profile, jobDescription: e.target.value })}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 group transform hover:-translate-y-0.5"
        >
          <span>Start Interview Session</span>
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </form>
    </div>
  );
};

export default SetupForm;