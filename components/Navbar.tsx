import React from 'react';
import { Sparkles } from 'lucide-react';

interface NavbarProps {
  onHomeClick: () => void;
  onAboutClick: () => void;
  onContactClick: () => void;
  onStartClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onHomeClick, onAboutClick, onContactClick, onStartClick }) => {
  return (
    <header className="bg-white/90 backdrop-blur-sm border-b border-blue-100 sticky top-0 z-50 flex-none h-20 flex items-center">
      <div className="container mx-auto px-6 flex justify-between items-center w-full">
        <div 
          onClick={onHomeClick}
          className="flex items-center space-x-2 text-blue-700 font-bold text-xl tracking-wide cursor-pointer hover:opacity-80 transition"
        >
          <Sparkles className="w-6 h-6" />
          <span className="uppercase tracking-wider">Interview Buddy</span>
        </div>
        
        <nav className="hidden md:flex space-x-8 font-medium text-gray-700">
          <button onClick={onHomeClick} className="hover:text-blue-700 transition">Home</button>
          <button onClick={onAboutClick} className="hover:text-blue-700 transition">About</button>
          <button onClick={onContactClick} className="hover:text-blue-700 transition">Contact</button>
        </nav>

        <button 
          onClick={onStartClick}
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-full font-semibold transition shadow-md hover:shadow-xl transform hover:-translate-y-0.5 text-sm"
        >
          Start Live Interview
        </button>
      </div>
    </header>
  );
};

export default Navbar;