/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Header from './components/Header';
import HomeView from './components/HomeView';
import WorkspaceView from './components/WorkspaceView';
import EditorView from './components/EditorView';
import { ToolType } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'workspace' | 'editor'>('home');
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [editorFile, setEditorFile] = useState<File | undefined>(undefined);

  const handleSelectTool = (tool: ToolType) => {
    if (tool === 'editor') {
      setEditorFile(undefined);
      setCurrentView('editor');
    } else {
      setActiveTool(tool);
      setCurrentView('workspace');
    }
  };

  const handleNavigateToEditor = (file?: File) => {
    setEditorFile(file);
    setCurrentView('editor');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setActiveTool(null);
    setEditorFile(undefined);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-800">
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
  );
}

