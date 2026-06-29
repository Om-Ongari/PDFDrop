import React from 'react';
import { FileText } from 'lucide-react';

interface HeaderProps {
  onBackToHome: () => void;
  currentView: string;
}

export default function Header({ onBackToHome, currentView }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer group"
          id="nav-logo"
        >
          <div className="w-3 h-3 bg-blue-600 rounded-full group-hover:scale-110 transition-transform"></div>
          <span className="font-bold text-lg tracking-tight text-gray-900 font-sans">PDFDrop</span>
        </button>

        {/* Dynamic Status / Button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100">
            <FileText className="w-3.5 h-3.5" />
            All-in-one PDF toolkit
          </div>
          {currentView !== 'home' && (
            <button
              onClick={onBackToHome}
              className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              id="header-nav-back"
            >
              All tools
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
