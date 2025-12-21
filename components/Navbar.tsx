import React, { useState } from 'react';
import { Sparkles, LogOut, User, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  onHomeClick: () => void;
  onAboutClick: () => void;
  onContactClick: () => void;
  onStartClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onHomeClick, onAboutClick, onContactClick, onStartClick }) => {
  const { currentUser, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileNav = (action: () => void) => {
    action();
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-white/90 backdrop-blur-sm border-b border-blue-100 sticky top-0 z-50 flex-none h-16 md:h-20 flex items-center">
      <div className="container mx-auto px-4 md:px-6 flex justify-between items-center w-full">
        <div 
          onClick={onHomeClick}
          className="flex items-center space-x-2 text-blue-700 font-bold text-lg md:text-xl tracking-wide cursor-pointer hover:opacity-80 transition"
        >
          <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
          <span className="uppercase tracking-wider">Interview Buddy</span>
        </div>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex space-x-8 font-medium text-gray-700">
          <button onClick={onHomeClick} className="hover:text-blue-700 transition">Home</button>
          <button onClick={onAboutClick} className="hover:text-blue-700 transition">About</button>
          <button onClick={onContactClick} className="hover:text-blue-700 transition">Contact</button>
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden md:flex items-center space-x-4">
          {currentUser ? (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <User size={16} />
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 hidden lg:inline">{currentUser.displayName || currentUser.email}</span>
              </div>
              <button 
                onClick={logout}
                className="text-gray-500 hover:text-red-600 transition p-2"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={onStartClick}
              className="text-sm font-medium text-blue-700 hover:underline mr-2"
            >
              Log In
            </button>
          )}

          <button 
            onClick={onStartClick}
            className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-full font-semibold transition shadow-md hover:shadow-xl transform hover:-translate-y-0.5 text-sm"
          >
            Start Live Interview
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="md:hidden flex items-center">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-xl p-4 flex flex-col space-y-4 md:hidden animate-fade-in z-50">
          <button onClick={() => handleMobileNav(onHomeClick)} className="text-left py-2 font-medium text-gray-700">Home</button>
          <button onClick={() => handleMobileNav(onAboutClick)} className="text-left py-2 font-medium text-gray-700">About</button>
          <button onClick={() => handleMobileNav(onContactClick)} className="text-left py-2 font-medium text-gray-700">Contact</button>
          <div className="border-t border-gray-100 pt-4">
             {currentUser ? (
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center space-x-2">
                    <User size={16} className="text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">{currentUser.displayName || currentUser.email}</span>
                  </div>
                  <button onClick={() => handleMobileNav(logout)} className="flex items-center text-red-600 text-sm font-medium">
                    <LogOut size={16} className="mr-2" /> Sign Out
                  </button>
                </div>
             ) : (
                <div className="flex flex-col space-y-3">
                  <button onClick={() => handleMobileNav(onStartClick)} className="text-blue-700 font-medium text-left">Log In</button>
                  <button onClick={() => handleMobileNav(onStartClick)} className="bg-blue-700 text-white py-3 rounded-lg font-bold text-center">Start Live Interview</button>
                </div>
             )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;