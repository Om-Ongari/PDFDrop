import React, { useState } from 'react';
import { 
  Combine, 
  Scissors, 
  Shrink, 
  Image, 
  FileText, 
  Lock, 
  Edit3,
  Sparkles,
  ArrowRight,
  Presentation,
  FileUp,
  Copy,
  Type,
  FileSpreadsheet,
  RotateCw,
  FileCode
} from 'lucide-react';
import { ToolType, CategoryType } from '../types';

interface HomeViewProps {
  onSelectTool: (tool: ToolType) => void;
}

interface ToolCard {
  id: ToolType;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
  category: CategoryType;
  isNew?: boolean;
}

export default function HomeView({ onSelectTool }: HomeViewProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');

  const tools: ToolCard[] = [
    {
      id: 'editor',
      title: 'PDF Editor',
      description: 'Draw text, place images, and annotate PDF pages locally',
      icon: <Edit3 className="w-5 h-5" />,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100/80',
      category: 'organize',
      isNew: true,
    },
    {
      id: 'merge',
      title: 'Merge PDFs',
      description: 'Combine multiple PDFs into one file in custom order',
      icon: <Combine className="w-5 h-5" />,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100/80',
      category: 'organize',
    },
    {
      id: 'split',
      title: 'Split PDF',
      description: 'Cut a PDF into multiple documents or select specific pages',
      icon: <Scissors className="w-5 h-5" />,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50 hover:bg-orange-100/80',
      category: 'organize',
    },
    {
      id: 'extract',
      title: 'Extract Pages / Range',
      description: 'Specify ranges or select pages to pull into a new clean PDF',
      icon: <Copy className="w-5 h-5" />,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50 hover:bg-amber-100/80',
      category: 'organize',
      isNew: true,
    },
    {
      id: 'rotate',
      title: 'Rotate Pages',
      description: 'Rotate all pages in a PDF document by 90, 180, or 270 degrees',
      icon: <RotateCw className="w-5 h-5" />,
      iconColor: 'text-teal-500',
      bgColor: 'bg-teal-50 hover:bg-teal-100/80',
      category: 'organize',
    },
    {
      id: 'compress',
      title: 'Compress PDF',
      description: 'Reduce file size with interactive compression level control',
      icon: <Shrink className="w-5 h-5" />,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100/80',
      category: 'optimize',
    },
    {
      id: 'img2pdf',
      title: 'Image → PDF',
      description: 'Convert JPG, PNG, or WEBP images into a compiled PDF',
      icon: <Image className="w-5 h-5" />,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50 hover:bg-purple-100/80',
      category: 'convert',
    },
    {
      id: 'word2pdf',
      title: 'Word / Markdown → PDF',
      description: 'Draft or import Rich Markdown text to format and export as PDF',
      icon: <FileText className="w-5 h-5" />,
      iconColor: 'text-sky-500',
      bgColor: 'bg-sky-50 hover:bg-sky-100/80',
      category: 'convert',
    },
    {
      id: 'docx2pdf',
      title: 'DOCX → PDF',
      description: 'Upload a Microsoft Word (.docx) file to parse and save as PDF',
      icon: <FileUp className="w-5 h-5" />,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50 hover:bg-blue-100/80',
      category: 'convert',
      isNew: true,
    },
    {
      id: 'ppt2pdf',
      title: 'PPT → PDF',
      description: 'Convert PowerPoint (.pptx) or build modern slides into a PDF',
      icon: <Presentation className="w-5 h-5" />,
      iconColor: 'text-rose-500',
      bgColor: 'bg-rose-50 hover:bg-rose-100/80',
      category: 'convert',
      isNew: true,
    },
    {
      id: 'xlsx2pdf',
      title: 'Excel / Spreadsheet → PDF',
      description: 'Convert Excel (.xlsx) files or sheets into styled PDF tables',
      icon: <FileSpreadsheet className="w-5 h-5" />,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100/80',
      category: 'convert',
      isNew: true,
    },
    {
      id: 'txt2pdf',
      title: 'Plain Text → PDF',
      description: 'Turn plain text .txt files into beautiful formatted A4 PDFs',
      icon: <FileCode className="w-5 h-5" />,
      iconColor: 'text-slate-600',
      bgColor: 'bg-slate-50 hover:bg-slate-100/80',
      category: 'convert',
    },
    {
      id: 'protect',
      title: 'Protect PDF',
      description: 'Add a password and strong local encryption to lock your PDF',
      icon: <Lock className="w-5 h-5" />,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50 hover:bg-red-100/80',
      category: 'security',
    },
    {
      id: 'watermark',
      title: 'Stamp Watermark',
      description: 'Add custom text watermarks with customizable opacity to PDF pages',
      icon: <Type className="w-5 h-5" />,
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-50 hover:bg-orange-100/80',
      category: 'security',
      isNew: true,
    },
  ];

  const categories = [
    { id: 'all', label: 'All tools' },
    { id: 'organize', label: 'Organize' },
    { id: 'convert', label: 'Convert to PDF' },
    { id: 'optimize', label: 'Optimize' },
    { id: 'security', label: 'Security' },
  ];

  const filteredTools = activeCategory === 'all' 
    ? tools 
    : tools.filter(t => t.category === activeCategory);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
      
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-4 font-sans leading-tight">
          Every PDF tool <br />
          <span className="text-blue-600">in one place.</span>
        </h1>
        <p className="text-gray-600 text-base md:text-lg max-w-xl mx-auto">
          Create, convert, edit, compress, and merge PDFs — all in your browser. 
          Zero uploads. Zero accounts. Your files never leave your device.
        </p>
      </div>

      {/* Primary Action Banner for Editor */}
      <div className="mb-12 max-w-3xl mx-auto bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-200">
            <Edit3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-gray-900 text-base">Interactive PDF Editor</h4>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded uppercase tracking-wider">Most Popular</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Open any PDF to type new text, draw images, and save changes locally.</p>
          </div>
        </div>
        <button
          onClick={() => onSelectTool('editor')}
          className="w-full md:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:translate-x-0.5"
          id="btn-quick-editor"
        >
          Open PDF Editor
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10" id="category-tabs">
        {categories.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as CategoryType)}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all cursor-pointer ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              id={`cat-btn-${cat.id}`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" id="tool-grid">
        {filteredTools.map(tool => (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            className="group relative p-5 bg-white rounded-xl border border-gray-200/80 hover:border-blue-500/30 shadow-xs hover:shadow-md transition-all duration-200 text-left flex flex-col h-full cursor-pointer hover:-translate-y-0.5"
            id={`tool-card-${tool.id}`}
          >
            {tool.isNew && (
              <div className="absolute top-4 right-4 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase tracking-wider">
                New
              </div>
            )}
            
            <div className={`w-10 h-10 rounded-lg ${tool.bgColor} flex items-center justify-center mb-4 transition-colors shrink-0`}>
              <span className={tool.iconColor}>{tool.icon}</span>
            </div>

            <h3 className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-blue-600 transition-colors">
              {tool.title}
            </h3>
            
            <p className="text-xs text-gray-500 leading-relaxed flex-grow">
              {tool.description}
            </p>
          </button>
        ))}
      </div>

      {/* Safe Disclaimer */}
      <div className="mt-16 text-center text-xs text-gray-400 max-w-md mx-auto leading-relaxed border-t border-gray-100 pt-6">
        <Sparkles className="w-4 h-4 text-amber-400 mx-auto mb-2 opacity-75" />
        All operations run entirely inside sandbox memory using your browser's CPU and Web Assembly. We do not transmit document content or metadata to external servers, providing maximum privacy.
      </div>

    </div>
  );
}
