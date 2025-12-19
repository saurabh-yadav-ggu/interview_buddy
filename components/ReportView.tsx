import React from 'react';
import { EvaluationReport } from '../types';
import { Download, CheckCircle, AlertTriangle, XCircle, ChevronRight, Star } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface ReportViewProps {
  report: EvaluationReport;
  onRestart: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ report, onRestart }) => {
  const downloadPDF = () => {
    const doc = new jsPDF();
    const lineHeight = 7;
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80);
    doc.text("AI Interview Evaluation Report", 20, y);
    y += 15;

    // Overview
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Candidate Role: ${report?.candidateOverview?.role || 'N/A'}`, 20, y);
    y += lineHeight;
    doc.text(`Experience Level: ${report?.candidateOverview?.experienceLevel || 'N/A'}`, 20, y);
    y += lineHeight;
    doc.text(`Duration: ${report?.candidateOverview?.duration || 'N/A'}`, 20, y);
    y += 15;

    // Scores
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Performance Breakdown (Score / 100)", 20, y);
    y += 10;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Technical Knowledge: ${report?.technical?.score ?? 0}/100`, 20, y);
    y += lineHeight;
    doc.text(`Communication Skills: ${report?.communication?.score ?? 0}/100`, 20, y);
    y += lineHeight;
    doc.text(`Behavioral Analysis: ${report?.behavioral?.score ?? 0}/100`, 20, y);
    y += lineHeight;
    doc.text(`Professional Readiness: ${report?.overall?.score ?? 0}/100`, 20, y);
    y += 15;

    // Detailed Sections (Simplified for PDF demo)
    doc.setFont("helvetica", "bold");
    doc.text("Hiring Recommendation:", 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(report?.overall?.recommendation || 'N/A', 80, y);
    y += 15;

    doc.setFont("helvetica", "bold");
    doc.text("Improvement Plan:", 20, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    
    if (report?.improvementPlan?.technical) {
      report.improvementPlan.technical.forEach(item => {
        // Simple text wrapping or truncating for PDF
        const text = item.length > 80 ? item.substring(0, 80) + '...' : item;
        doc.text(`- ${text}`, 25, y);
        y += lineHeight;
      });
    }

    doc.save("interview-report.pdf");
  };

  // Adjusted thresholds for 0-100 scale
  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  if (!report) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header Action */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Evaluation Complete</h2>
          <p className="text-gray-500">Here is your detailed performance analysis.</p>
        </div>
        <button
          onClick={downloadPDF}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg hover:shadow-blue-200"
        >
          <Download size={20} className="mr-2" />
          Download PDF Report
        </button>
      </div>

      {/* Main Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "Technical", score: report.technical?.score ?? 0 },
          { title: "Communication", score: report.communication?.score ?? 0 },
          { title: "Behavioral", score: report.behavioral?.score ?? 0 },
          { title: "Readiness", score: report.overall?.score ?? 0 },
        ].map((item, idx) => (
          <div key={idx} className={`p-6 rounded-2xl border ${getScoreColor(item.score)} flex flex-col items-center justify-center text-center`}>
            <span className="text-sm font-semibold uppercase tracking-wider opacity-80">{item.title}</span>
            <span className="text-4xl font-bold mt-2">{item.score}<span className="text-lg opacity-60">/100</span></span>
          </div>
        ))}
      </div>

      {/* Detailed Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Technical */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 text-blue-600">
              <CheckCircle size={18} />
            </div>
            Technical Proficiency
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Strengths</p>
              <div className="flex flex-wrap gap-2">
                {report.technical?.strengths?.map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">{s}</span>
                )) || <span className="text-gray-400 text-sm">No specific strengths listed.</span>}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Identified Gaps</p>
               <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {report.technical?.gaps?.map((g, i) => <li key={i}>{g}</li>) || <li>None detected.</li>}
              </ul>
            </div>
            <div className="pt-2 border-t border-gray-100">
               <p className="text-xs font-semibold text-gray-500">CONTEXT ACCURACY</p>
               <p className="text-sm text-gray-700 italic">"{report.technical?.accuracyVsContext}"</p>
            </div>
          </div>
        </div>

        {/* Behavioral */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
             <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3 text-purple-600">
              <Star size={18} />
            </div>
            Behavioral & Emotional
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
             <div className="flex justify-between border-b pb-2">
               <span>Facial Analysis</span>
               <span className="font-medium text-gray-900">{report.behavioral?.facialExpressionSummary || "N/A"}</span>
             </div>
             <div className="flex justify-between border-b pb-2">
               <span>Confidence Level</span>
               <span className="font-medium text-gray-900">{report.behavioral?.confidenceLevel || "N/A"}</span>
             </div>
             <div>
               <p className="mb-1">Nervous Indicators:</p>
               <div className="flex gap-2 flex-wrap">
                  {report.behavioral?.nervousIndicators?.length > 0 ? report.behavioral.nervousIndicators.map((ind, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded border border-red-100">{ind}</span>
                  )) : <span className="text-gray-400 text-xs">None detected</span>}
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className={`p-6 rounded-2xl border-l-4 shadow-sm flex items-center justify-between
        ${report.overall?.recommendation === 'Strong Hire' ? 'bg-green-50 border-green-500' : 
          report.overall?.recommendation === 'Needs Improvement' ? 'bg-yellow-50 border-yellow-500' : 'bg-red-50 border-red-500'}`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Final Verdict</p>
          <h2 className="text-3xl font-bold text-gray-900">{report.overall?.recommendation || "Pending"}</h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-600">Industry Readiness</p>
          <p className="text-lg font-bold text-gray-900">{report.overall?.readiness || "N/A"}</p>
        </div>
      </div>

      {/* Improvement Plan */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg">
        <h3 className="text-xl font-bold mb-6">🚀 Personalized Improvement Plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="font-semibold text-blue-400 mb-3 uppercase text-xs tracking-wider">Technical Revision</h4>
             <ul className="space-y-2 text-sm text-gray-300">
                {report.improvementPlan?.technical?.map((item, i) => (
                  <li key={i} className="flex items-start"><ChevronRight size={14} className="mt-1 mr-2 text-blue-500" /> {item}</li>
                )) || <li>No suggestions.</li>}
             </ul>
          </div>
          <div>
            <h4 className="font-semibold text-purple-400 mb-3 uppercase text-xs tracking-wider">Communication</h4>
             <ul className="space-y-2 text-sm text-gray-300">
                {report.improvementPlan?.communication?.map((item, i) => (
                  <li key={i} className="flex items-start"><ChevronRight size={14} className="mt-1 mr-2 text-purple-500" /> {item}</li>
                )) || <li>No suggestions.</li>}
             </ul>
          </div>
          <div>
             <h4 className="font-semibold text-green-400 mb-3 uppercase text-xs tracking-wider">Behavioral Coaching</h4>
             <ul className="space-y-2 text-sm text-gray-300">
                {report.improvementPlan?.behavioral?.map((item, i) => (
                  <li key={i} className="flex items-start"><ChevronRight size={14} className="mt-1 mr-2 text-green-500" /> {item}</li>
                )) || <li>No suggestions.</li>}
             </ul>
          </div>
        </div>
      </div>

       <div className="text-center pt-8">
          <button onClick={onRestart} className="text-gray-500 hover:text-gray-900 font-medium text-sm">Start New Interview</button>
       </div>
    </div>
  );
};

export default ReportView;