/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import HomeView from './components/HomeView';
import WorkspaceView from './components/WorkspaceView';
import EditorView from './components/EditorView';
import AnimatedBackground from './components/AnimatedBackground';
import { ToolType } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'workspace' | 'editor'>('home');
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [editorFile, setEditorFile] = useState<File | undefined>(undefined);

  // Set a baseline "home" history entry, and listen for the back button
  // (phone back button / browser back) so it navigates within the app
  // instead of closing it.
  useEffect(() => {
    window.history.replaceState({ view: 'home' }, '');

    const handlePopState = () => {
      setCurrentView('home');
      setActiveTool(null);
      setEditorFile(undefined);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Pushes a history entry the first time we leave Home, so there's
  // something for the back button to "consume." If we're already away
  // from Home (e.g. jumping from a tool straight into the Editor), we
  // replace instead of push, so one back press still always returns Home.
  const registerNavigation = (view: 'workspace' | 'editor') => {
    if (currentView === 'home') {
      window.history.pushState({ view }, '');
    } else {
      window.history.replaceState({ view }, '');
    }
  };

  const handleSelectTool = (tool: ToolType) => {
    if (tool === 'editor') {
      setEditorFile(undefined);
      setCurrentView('editor');
      registerNavigation('editor');
    } else {
      setActiveTool(tool);
      setCurrentView('workspace');
      registerNavigation('workspace');
    }
  };

  const handleNavigateToEditor = (file?: File) => {
    setEditorFile(file);
    setCurrentView('editor');
    registerNavigation('editor');
  };

  const handleBackToHome = () => {
    if (currentView !== 'home') {
      // Use native browser back so it stays perfectly in sync with the
      // phone/browser back button behavior.
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-800">
      {/* Ambient, click-through background. Skipped in the full-screen dark
          editor since it fully covers the viewport there anyway. Rendered
          with a lower stack level (z-0) than the content wrapper below (z-10)
          so it always paints behind the real UI. */}
      {currentView !== 'editor' && <AnimatedBackground />}

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Do not render standard header when in dedicated full-screen dark editor mode */}
        {currentView !== 'editor' && (
          <Header onBackToHome={handleBackToHome} currentView={currentView} />
        )}

        <main className="flex-grow">
          {currentView === 'home' && (
            <HomeView onSelectTool={handleSelectTool} />
          )}

          {currentView === 'workspace' && activeTool && (
            <WorkspaceView 
              activeTool={activeTool} 
              onBack={handleBackToHome} 
              onNavigateToEditor={handleNavigateToEditor}
            />
          )}

          {currentView === 'editor' && (
            <EditorView 
              initialFile={editorFile} 
              onBack={handleBackToHome} 
            />
          )}
        </main>
      </div>
    </div>
  );
}
