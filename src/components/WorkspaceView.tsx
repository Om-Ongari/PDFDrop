import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Combine, 
  Scissors, 
  Shrink, 
  Image as ImageIcon, 
  FileText, 
  Lock, 
  UploadCloud, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileDown,
  Presentation,
  FileUp,
  Copy,
  Type,
  FileSpreadsheet,
  RotateCw,
  FileCode,
  Plus,
  Settings,
  Shield,
  Check,
  Download
} from 'lucide-react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { ToolType, CategoryType, PDFFile } from '../types';
import { convertTextToPDF } from '../utils/wordToPdfHelper';
import { encryptPDFBytes } from '../utils/cryptoHelper';

// Configure pdfjs worker using standard bundle reference
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface WorkspaceViewProps {
  activeTool: ToolType;
  onBack: () => void;
  onNavigateToEditor: (file?: File) => void;
}

export default function WorkspaceView({ activeTool, onBack, onNavigateToEditor }: WorkspaceViewProps) {
  // Common states
  const [selectedFiles, setSelectedFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Split-specific states
  const [pageCount, setPageCount] = useState(0);
  const [splitRange, setSplitRange] = useState('1');
  const [selectedSplitPages, setSelectedSplitPages] = useState<number[]>([]);

  // Compress-specific states
  const [compressLevel, setCompressLevel] = useState(2); // 1 = Minimal, 2 = Light, 3 = Balanced, 4 = High, 5 = Maximum

  // Image-specific states
  const [imgPageSize, setImgPageSize] = useState<'fit' | 'a4'>('fit');
  const [imgOrientation, setImgOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [imgMargin, setImgMargin] = useState<number>(0); // Margin in px

  // Word-specific states
  const [wordText, setWordText] = useState<string>(
    `# Project Implementation Overview\n\nThis document describes the key features and structure of PDFDrop, an all-in-one PDF toolkit running completely client-side in the browser.\n\n## Core Advantages\n1. Zero Server Uploads: All editing, merging, splitting, compressing, and protecting operations run locally using WebAssembly and canvas-level re-rendering. This guarantees absolute privacy.\n2. Ultra-Fast Operations: Runs at the speed of your device, fully offline-compatible.\n3. Fully Equipped PDF Editor: Supports absolute text overlays and custom image embeds with live visual dragging.\n\n## Setup Guidelines\n- Simply load your files.\n- Select custom parameters (like compression level or password rules).\n- Download your compiled, secure PDF instantly!`
  );
  const [wordTitle, setWordTitle] = useState('PDFDrop Technical Guide');
  const [wordAuthor, setWordAuthor] = useState('PDFDrop Team');
  const [wordFontSize, setWordFontSize] = useState(12);

  // Protect-specific states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // PPT-specific states
  const [pptTheme, setPptTheme] = useState<'navy' | 'dark' | 'emerald' | 'peach' | 'light'>('navy');
  const [pptSlides, setPptSlides] = useState<{ title: string; bullets: string[] }[]>([
    { title: 'Project Launch Presentation', bullets: ['Welcome and Introductions', 'Market Opportunity & Strategy', 'Key Deliverables & Goals'] },
    { title: 'Market Opportunity', bullets: ['Total addressable market exceeds $5B', 'Primary target: SMBs and individual creators', 'Unique competitive advantages with browser sandboxing'] },
    { title: 'Technical Innovation', bullets: ['All calculations are compiled to WebAssembly', 'Guarantees 100% data confidentiality', 'Blazing fast, zero server wait times'] },
    { title: 'Next Milestones', bullets: ['Beta deployment: Q3 2026', 'Creator tools and premium modules', 'Community integrations and API platform'] }
  ]);
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);

  // Watermark-specific states
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkColor, setWatermarkColor] = useState('#EF4444');
  const [watermarkFontSize, setWatermarkFontSize] = useState(48);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.2);
  const [watermarkRotation, setWatermarkRotation] = useState(-45);

  // Excel-specific states
  const [xlsxSheets, setXlsxSheets] = useState<string[]>([]);
  const [xlsxActiveSheet, setXlsxActiveSheet] = useState('');
  const [xlsxPreviewData, setXlsxPreviewData] = useState<any[][]>([]);
  const [xlsxAllData, setXlsxAllData] = useState<{ [sheet: string]: any[][] }>({});

  // Rotate-specific states
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [rotateTarget, setRotateTarget] = useState<'all' | 'odd' | 'even'>('all');

  // Plain Text-specific states
  const [txtContent, setTxtContent] = useState('');
  const [txtTitle, setTxtTitle] = useState('Plain Text Document');

  // Clear states when tool changes
  useEffect(() => {
    setSelectedFiles([]);
    setProcessStatus(null);
    setPageCount(0);
    setSelectedSplitPages([]);
  }, [activeTool]);

  // Load and count pages for splitting / compressing when a file is selected
  useEffect(() => {
    if (selectedFiles.length === 1 && (activeTool === 'split' || activeTool === 'compress' || activeTool === 'protect' || activeTool === 'extract' || activeTool === 'watermark' || activeTool === 'rotate')) {
      const checkPages = async () => {
        try {
          const file = selectedFiles[0].file;
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const count = pdfDoc.getPageCount();
          setPageCount(count);
          // Pre-select all pages for splitting
          setSelectedSplitPages(Array.from({ length: count }, (_, i) => i + 1));
          setSplitRange(`1-${count}`);
        } catch (err) {
          console.error('Error analyzing PDF:', err);
        }
      };
      checkPages();
    }
  }, [selectedFiles, activeTool]);

  // Helper tool properties
  const toolDetails = {
    merge: {
      title: 'Merge PDFs',
      description: 'Combine multiple PDFs into a single file in the exact order you need',
      icon: <Combine className="w-5 h-5 text-blue-600" />,
      bgColor: 'bg-blue-50',
      accepts: '.pdf',
      multiple: true,
      actionText: 'Merge PDFs',
    },
    split: {
      title: 'Split PDF',
      description: 'Extract specific pages or a visual selection into a new document',
      icon: <Scissors className="w-5 h-5 text-orange-500" />,
      bgColor: 'bg-orange-50',
      accepts: '.pdf',
      multiple: false,
      actionText: 'Split PDF',
    },
    compress: {
      title: 'Compress PDF',
      description: 'Shrink your document file size using canvas level re-rendering',
      icon: <Shrink className="w-5 h-5 text-green-600" />,
      bgColor: 'bg-green-50',
      accepts: '.pdf',
      multiple: false,
      actionText: 'Compress PDF',
    },
    img2pdf: {
      title: 'Image → PDF',
      description: 'Convert JPG, PNG, WEBP, or GIF images into a polished PDF document',
      icon: <ImageIcon className="w-5 h-5 text-purple-500" />,
      bgColor: 'bg-purple-50',
      accepts: 'image/png, image/jpeg, image/webp, image/gif',
      multiple: true,
      actionText: 'Convert Images to PDF',
    },
    word2pdf: {
      title: 'Word / Markdown → PDF',
      description: 'Draft or import your documentation content to format and export as PDF',
      icon: <FileText className="w-5 h-5 text-sky-500" />,
      bgColor: 'bg-sky-50',
      accepts: '.txt,.docx',
      multiple: false,
      actionText: 'Generate PDF from Document',
    },
    docx2pdf: {
      title: 'DOCX → PDF',
      description: 'Upload a Microsoft Word (.docx) file to parse and save as PDF',
      icon: <FileUp className="w-5 h-5 text-blue-500" />,
      bgColor: 'bg-blue-50',
      accepts: '.docx',
      multiple: false,
      actionText: 'Convert DOCX to PDF',
    },
    ppt2pdf: {
      title: 'PPT → PDF',
      description: 'Convert PowerPoint (.pptx) or build modern slides into a PDF',
      icon: <Presentation className="w-5 h-5 text-rose-500" />,
      bgColor: 'bg-rose-50',
      accepts: '.pptx,.ppt',
      multiple: false,
      actionText: 'Convert Presentation to PDF',
    },
    xlsx2pdf: {
      title: 'Excel / Spreadsheet → PDF',
      description: 'Convert Excel (.xlsx) files or sheets into styled PDF tables',
      icon: <FileSpreadsheet className="w-5 h-5 text-emerald-500" />,
      bgColor: 'bg-emerald-50',
      accepts: '.xlsx,.xls,.csv',
      multiple: false,
      actionText: 'Convert Spreadsheet to PDF',
    },
    txt2pdf: {
      title: 'Plain Text → PDF',
      description: 'Turn plain text .txt files into beautiful formatted A4 PDFs',
      icon: <FileCode className="w-5 h-5 text-slate-600" />,
      bgColor: 'bg-slate-50',
      accepts: '.txt',
      multiple: false,
      actionText: 'Convert Plain Text to PDF',
    },
    extract: {
      title: 'Extract Pages / Range',
      description: 'Specify ranges or select pages to pull into a new clean PDF',
      icon: <Copy className="w-5 h-5 text-amber-500" />,
      bgColor: 'bg-amber-50',
      accepts: '.pdf',
      multiple: false,
      actionText: 'Extract Pages',
    },
    rotate: {
      title: 'Rotate Pages',
      description: 'Rotate all pages in a PDF document by 90, 180, or 270 degrees',
      icon: <RotateCw className="w-5 h-5 text-teal-500" />,
      bgColor: 'bg-teal-50',
      accepts: '.pdf',
      multiple: false,
      actionText: 'Rotate and Save PDF',
    },
    watermark: {
      title: 'Stamp Watermark',
      description: 'Add custom text watermarks with customizable opacity to PDF pages',
      icon: <Type className="w-5 h-5 text-orange-600" />,
      bgColor: 'bg-orange-50',
      accepts: '.pdf',
      multiple: false,
      actionText: 'Apply Watermark',
    },
    protect: {
      title: 'Protect PDF',
      description: 'Secure your file with a strong user-password and local permissions locking',
      icon: <Lock className="w-5 h-5 text-red-500" />,
      bgColor: 'bg-red-50',
      accepts: '.pdf',
      multiple: false,
      actionText: 'Protect PDF',
    },
    editor: {
      title: 'PDF Editor',
      description: 'Advanced editor',
      icon: <FileText className="w-5 h-5" />,
      bgColor: 'bg-gray-100',
      accepts: '.pdf',
      multiple: false,
      actionText: 'Open Editor',
    }
  }[activeTool];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const newFiles: PDFFile[] = files.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));

    if (toolDetails.multiple) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
    } else {
      setSelectedFiles(newFiles.slice(0, 1));
    }
    setProcessStatus(null);
  };

  // Automatic File Import & Parsing for DOCX, PPT, CSV/XLSX, TXT
  useEffect(() => {
    if (selectedFiles.length === 1) {
      const file = selectedFiles[0].file;
      const extension = file.name.split('.').pop()?.toLowerCase();

      // 1. DOCX -> PDF
      if (activeTool === 'docx2pdf' && extension === 'docx') {
        const loadDocx = async () => {
          setIsProcessing(true);
          setProcessStatus({ type: 'success', message: 'Reading and unzipping DOCX document...' });
          try {
            const JSZip = (await import('jszip')).default;
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            const docXml = await zip.file('word/document.xml')?.async('string');
            if (!docXml) {
              throw new Error('This is not a valid Word DOCX file (missing word/document.xml).');
            }
            
            // DOM Parsing
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(docXml, 'text/xml');
            const paragraphs = xmlDoc.getElementsByTagName('w:p');
            const linesList: string[] = [];
            
            for (let i = 0; i < paragraphs.length; i++) {
              const p = paragraphs[i];
              const tNodes = p.getElementsByTagName('w:t');
              const textParts = Array.from(tNodes).map(n => n.textContent || '');
              if (textParts.length > 0) {
                linesList.push(textParts.join(''));
              } else {
                linesList.push('');
              }
            }
            const fullText = linesList.join('\n');
            setWordText(fullText);
            setWordTitle(file.name.replace('.docx', ''));
            setProcessStatus({ type: 'success', message: 'DOCX document parsed successfully! Customize the content or export to PDF.' });
          } catch (err: any) {
            console.error(err);
            setProcessStatus({ type: 'error', message: err.message || 'Failed to parse DOCX. Please try a different document.' });
          } finally {
            setIsProcessing(false);
          }
        };
        loadDocx();
      }

      // 2. PPT -> PDF
      if (activeTool === 'ppt2pdf' && (extension === 'pptx' || extension === 'ppt')) {
        const loadPptx = async () => {
          setIsProcessing(true);
          setProcessStatus({ type: 'success', message: 'Reading and parsing PowerPoint presentation slides...' });
          try {
            const JSZip = (await import('jszip')).default;
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            const slidePaths = Object.keys(zip.files).filter(p => 
              p.startsWith('ppt/slides/slide') && p.endsWith('.xml')
            ).sort((a, b) => {
              const numA = parseInt(a.replace(/[^0-9]/g, ''));
              const numB = parseInt(b.replace(/[^0-9]/g, ''));
              return numA - numB;
            });

            if (slidePaths.length === 0) {
              throw new Error('No slides found in the PPTX archive.');
            }

            const parsed: { title: string; bullets: string[] }[] = [];
            for (const slidePath of slidePaths) {
              const slideXml = await zip.file(slidePath)?.async('string');
              if (!slideXml) continue;

              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(slideXml, 'text/xml');
              const paragraphs = xmlDoc.getElementsByTagName('a:p');
              const linesList: string[] = [];

              for (let i = 0; i < paragraphs.length; i++) {
                const p = paragraphs[i];
                const tNodes = p.getElementsByTagName('a:t');
                const line = Array.from(tNodes).map(n => n.textContent || '').join('').trim();
                if (line) linesList.push(line);
              }

              if (linesList.length > 0) {
                parsed.push({
                  title: linesList[0],
                  bullets: linesList.slice(1).slice(0, 5) // Limit to 5 bullets for elegance
                });
              } else {
                parsed.push({ title: 'Untitled Slide', bullets: [] });
              }
            }

            setPptSlides(parsed);
            setActiveSlideIdx(0);
            setProcessStatus({ type: 'success', message: `PowerPoint slides successfully parsed (${parsed.length} slides)! Check them out in the interactive slider below.` });
          } catch (err: any) {
            console.error(err);
            setProcessStatus({ type: 'error', message: err.message || 'Failed to parse PowerPoint archive.' });
          } finally {
            setIsProcessing(false);
          }
        };
        loadPptx();
      }

      // 3. XLSX -> PDF
      if (activeTool === 'xlsx2pdf' && (extension === 'xlsx' || extension === 'xls' || extension === 'csv')) {
        const loadXlsx = async () => {
          setIsProcessing(true);
          setProcessStatus({ type: 'success', message: 'Reading and parsing Spreadsheet data...' });
          try {
            const XLSX = await import('xlsx');
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            
            const sheetNames = workbook.SheetNames;
            if (sheetNames.length === 0) {
              throw new Error('Workbook contains no worksheets.');
            }

            const sheetsData: { [sheet: string]: any[][] } = {};
            for (const name of sheetNames) {
              const worksheet = workbook.Sheets[name];
              const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
              sheetsData[name] = rows as any[][];
            }

            setXlsxSheets(sheetNames);
            setXlsxActiveSheet(sheetNames[0]);
            setXlsxPreviewData(sheetsData[sheetNames[0]]);
            setXlsxAllData(sheetsData);
            setProcessStatus({ type: 'success', message: `Spreadsheet loaded successfully! Found ${sheetNames.length} sheet(s).` });
          } catch (err: any) {
            console.error(err);
            setProcessStatus({ type: 'error', message: err.message || 'Failed to read Spreadsheet. Verify the file format is uncorrupted.' });
          } finally {
            setIsProcessing(false);
          }
        };
        loadXlsx();
      }

      // 4. TXT -> PDF
      if (activeTool === 'txt2pdf' && extension === 'txt') {
        const loadTxt = async () => {
          setIsProcessing(true);
          setProcessStatus({ type: 'success', message: 'Reading raw text file...' });
          try {
            const text = await file.text();
            setTxtContent(text);
            setTxtTitle(file.name.replace('.txt', ''));
            setProcessStatus({ type: 'success', message: 'Text file loaded. View/edit raw content and download as PDF.' });
          } catch (err: any) {
            console.error(err);
            setProcessStatus({ type: 'error', message: 'Failed to read Plain Text file.' });
          } finally {
            setIsProcessing(false);
          }
        };
        loadTxt();
      }
    }
  }, [selectedFiles, activeTool]);

  const removeFile = (id: string) => {
    setSelectedFiles(prev => {
      const fileToRem = prev.find(f => f.id === id);
      if (fileToRem?.previewUrl) {
        URL.revokeObjectURL(fileToRem.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
    setProcessStatus(null);
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === selectedFiles.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...selectedFiles];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    setSelectedFiles(reordered);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const toggleSplitPageSelection = (page: number) => {
    setSelectedSplitPages(prev => 
      prev.includes(page) 
        ? prev.filter(p => p !== page) 
        : [...prev, page].sort((a, b) => a - b)
    );
  };

  // ----------------------------------------------------
  // PDF PROCESSORS (REAL BROWSERS MANIPULATIONS)
  // ----------------------------------------------------

  const executeProcess = async () => {
    if (activeTool === 'word2pdf') {
      await handleWord2Pdf();
      return;
    }
    if (activeTool === 'ppt2pdf') {
      await handlePpt2Pdf();
      return;
    }
    if (activeTool === 'txt2pdf') {
      await handleTxt2Pdf();
      return;
    }
    if (activeTool === 'xlsx2pdf') {
      await handleXlsx2Pdf();
      return;
    }

    if (selectedFiles.length === 0) {
      setProcessStatus({ type: 'error', message: 'Please select at least one file to process.' });
      return;
    }

    setIsProcessing(true);
    setProcessStatus(null);

    try {
      switch (activeTool) {
        case 'merge':
          await handleMerge();
          break;
        case 'split':
        case 'extract':
          await handleSplit();
          break;
        case 'compress':
          await handleCompress();
          break;
        case 'img2pdf':
          await handleImg2Pdf();
          break;
        case 'protect':
          await handleProtect();
          break;
        case 'docx2pdf':
          await handleDocx2Pdf();
          break;
        case 'rotate':
          await handleRotate();
          break;
        case 'watermark':
          await handleWatermark();
          break;
        default:
          throw new Error('Unsupported tool workspace.');
      }
    } catch (err: any) {
      console.error(err);
      setProcessStatus({ 
        type: 'error', 
        message: err.message || 'An error occurred while processing your file. Please verify it is a valid, uncorrupted document.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Merge PDF Logic
  const handleMerge = async () => {
    const mergedPdf = await PDFDocument.create();
    
    for (const pdfFile of selectedFiles) {
      const bytes = await pdfFile.file.arrayBuffer();
      const docToCopy = await PDFDocument.load(bytes);
      const copiedPages = await mergedPdf.copyPages(
        docToCopy, 
        Array.from({ length: docToCopy.getPageCount() }, (_, i) => i)
      );
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    triggerDownload(mergedBytes, 'merged_document.pdf');
    setProcessStatus({ type: 'success', message: 'PDF files merged and downloaded successfully!' });
  };

  // 2. Split PDF Logic
  const handleSplit = async () => {
    const file = selectedFiles[0].file;
    const bytes = await file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(bytes);
    const totalPages = sourcePdf.getPageCount();

    // Determine chosen pages (either visually selected or parsed from range input)
    let pagesToExtract: number[] = [];

    if (selectedSplitPages.length > 0) {
      pagesToExtract = selectedSplitPages.filter(p => p >= 1 && p <= totalPages);
    } else {
      // Parse range string (e.g., "1-3, 5")
      const ranges = splitRange.split(',');
      for (const r of ranges) {
        const parts = r.trim().split('-');
        if (parts.length === 1) {
          const num = parseInt(parts[0]);
          if (!isNaN(num)) pagesToExtract.push(num);
        } else if (parts.length === 2) {
          const start = parseInt(parts[0]);
          const end = parseInt(parts[1]);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
              pagesToExtract.push(i);
            }
          }
        }
      }
      // Clean and boundary filter
      pagesToExtract = Array.from(new Set(pagesToExtract))
        .filter(p => p >= 1 && p <= totalPages)
        .sort((a, b) => a - b);
    }

    if (pagesToExtract.length === 0) {
      throw new Error('No valid pages or page ranges specified to split.');
    }

    const splitPdf = await PDFDocument.create();
    const copiedPages = await splitPdf.copyPages(sourcePdf, pagesToExtract.map(p => p - 1));
    copiedPages.forEach(page => splitPdf.addPage(page));

    const splitBytes = await splitPdf.save();
    triggerDownload(splitBytes, `split_pages_${pagesToExtract.join('_')}.pdf`);
    setProcessStatus({ type: 'success', message: `Extracted ${pagesToExtract.length} pages successfully!` });
  };

  // 3. Compress PDF Logic
  const handleCompress = async () => {
    const file = selectedFiles[0].file;
    const arrayBuffer = await file.arrayBuffer();
    
    // Let's implement real Canvas-based size reduction! It creates a highly compressed PDF.
    // Quality scaling:
    // compressLevel: 1=Minimal (scale=1.0, qual=0.9), 2=Light (scale=0.9, qual=0.8), 3=Balanced (scale=0.8, qual=0.7), 4=High (scale=0.6, qual=0.55), 5=Max (scale=0.45, qual=0.4)
    const compressionSettings = {
      1: { scale: 1.0, quality: 0.9, label: 'Minimal' },
      2: { scale: 0.9, quality: 0.8, label: 'Light' },
      3: { scale: 0.75, quality: 0.7, label: 'Balanced' },
      4: { scale: 0.6, quality: 0.5, label: 'High' },
      5: { scale: 0.45, quality: 0.35, label: 'Maximum' }
    }[compressLevel as 1|2|3|4|5] || { scale: 0.8, quality: 0.7, label: 'Balanced' };

    setProcessStatus({ type: 'success', message: `Initializing ${compressionSettings.label} compression rendering...` });

    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const outPdf = await PDFDocument.create();

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: compressionSettings.scale });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport } as any).promise;
      
      // Export canvas compressed image
      const imgDataUrl = canvas.toDataURL('image/jpeg', compressionSettings.quality);
      const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());
      
      const embeddedImg = await outPdf.embedJpg(imgBytes);
      const outPage = outPdf.addPage([viewport.width, viewport.height]);
      outPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height
      });
    }

    const compressedBytes = await outPdf.save();
    triggerDownload(compressedBytes, `compressed_level_${compressLevel}_document.pdf`);
    setProcessStatus({ type: 'success', message: `Document compressed successfully! Quality optimized at ${compressionSettings.label} level.` });
  };

  // 4. Image to PDF Logic
  const handleImg2Pdf = async () => {
    const pdfDoc = await PDFDocument.create();

    for (const imgFile of selectedFiles) {
      const imgBytes = await imgFile.file.arrayBuffer();
      let embeddedImg;

      try {
        if (imgFile.file.type === 'image/jpeg' || imgFile.file.type === 'image/jpg') {
          embeddedImg = await pdfDoc.embedJpg(imgBytes);
        } else if (imgFile.file.type === 'image/png') {
          embeddedImg = await pdfDoc.embedPng(imgBytes);
        } else {
          // Fallback draw on canvas to jpeg format for webp/gif
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = document.createElement('img');
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              ctx?.drawImage(img, 0, 0);
              resolve();
            };
            img.onerror = reject;
            img.src = imgFile.previewUrl || '';
          });

          const canvasJpegUrl = canvas.toDataURL('image/jpeg', 0.9);
          const canvBytes = await fetch(canvasJpegUrl).then(res => res.arrayBuffer());
          embeddedImg = await pdfDoc.embedJpg(canvBytes);
        }

        const imgWidth = embeddedImg.width;
        const imgHeight = embeddedImg.height;

        let pageW = imgWidth + imgMargin * 2;
        let pageH = imgHeight + imgMargin * 2;

        if (imgPageSize === 'a4') {
          // standard A4 dimensions
          pageW = 595.27;
          pageH = 841.89;
          if (imgOrientation === 'landscape') {
            pageW = 841.89;
            pageH = 595.27;
          }
        }

        const page = pdfDoc.addPage([pageW, pageH]);
        
        // Calculate responsive scale to fit A4 container perfectly
        let drawW = imgWidth;
        let drawH = imgHeight;
        
        if (imgPageSize === 'a4') {
          const maxW = pageW - imgMargin * 2;
          const maxH = pageH - imgMargin * 2;
          const scale = Math.min(maxW / imgWidth, maxH / imgHeight);
          drawW = imgWidth * scale;
          drawH = imgHeight * scale;
        }

        const drawX = (pageW - drawW) / 2;
        const drawY = (pageH - drawH) / 2;

        page.drawImage(embeddedImg, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });

      } catch (err) {
        console.warn(`Skipping un-embeddable frame ${imgFile.name}:`, err);
      }
    }

    const compiledBytes = await pdfDoc.save();
    triggerDownload(compiledBytes, 'images_converted.pdf');
    setProcessStatus({ type: 'success', message: 'Images compiled and PDF downloaded successfully!' });
  };

  // 5. Word to PDF Logic
  const handleWord2Pdf = async () => {
    setIsProcessing(true);
    setProcessStatus(null);
    try {
      const generatedBytes = await convertTextToPDF(wordText, {
        fontSize: wordFontSize,
        lineHeight: wordFontSize * 1.5,
        margin: 50,
        title: wordTitle,
        author: wordAuthor
      });

      triggerDownload(generatedBytes, 'document_formatted.pdf');
      setProcessStatus({ type: 'success', message: 'Formatted text converted and PDF downloaded successfully!' });
    } catch (err: any) {
      console.error(err);
      setProcessStatus({ type: 'error', message: err.message || 'Error compiling custom text to PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Protect PDF Logic
  const handleProtect = async () => {
    if (!password) {
      throw new Error('Please define a password to secure your document.');
    }
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    const file = selectedFiles[0].file;
    const arrayBuffer = await file.arrayBuffer();
    const originalBytes = new Uint8Array(arrayBuffer);

    // Secure document using native browser key derivation and AES-GCM
    const protectedBytes = await encryptPDFBytes(originalBytes, password);

    triggerDownload(protectedBytes, `secured_${file.name}`);
    setProcessStatus({ type: 'success', message: 'Document secure locked and downloaded successfully! Keep your password safe.' });
    setPassword('');
    setConfirmPassword('');
  };

  // 7. DOCX to PDF compilation
  const handleDocx2Pdf = async () => {
    setIsProcessing(true);
    setProcessStatus(null);
    try {
      const generatedBytes = await convertTextToPDF(wordText, {
        fontSize: wordFontSize,
        lineHeight: wordFontSize * 1.5,
        margin: 50,
        title: wordTitle,
        author: wordAuthor
      });

      const fileName = selectedFiles[0] ? selectedFiles[0].name.replace('.docx', '') : 'docx_formatted';
      triggerDownload(generatedBytes, `${fileName}.pdf`);
      setProcessStatus({ type: 'success', message: 'Word DOCX parsed, formatted, and downloaded successfully!' });
    } catch (err: any) {
      console.error(err);
      setProcessStatus({ type: 'error', message: err.message || 'Error compiling parsed DOCX content.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 8. PPT to PDF slide rendering
  const handlePpt2Pdf = async () => {
    setIsProcessing(true);
    setProcessStatus(null);
    try {
      if (pptSlides.length === 0) {
        throw new Error('Please add at least one slide to generate your presentation.');
      }

      const pdfDoc = await PDFDocument.create();
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Slide Themes
      const themes = {
        navy: { bg: [15/255, 23/255, 42/255], title: [255/255, 255/255, 255/255], text: [226/255, 232/255, 240/255], accent: [56/255, 189/255, 248/255] },
        dark: { bg: [24/255, 24/255, 27/255], title: [255/255, 255/255, 255/255], text: [212/255, 212/255, 216/255], accent: [168/255, 85/255, 247/255] },
        emerald: { bg: [6/255, 78/255, 59/255], title: [254/255, 243/255, 199/255], text: [209/255, 250/255, 229/255], accent: [52/255, 211/255, 153/255] },
        peach: { bg: [255/255, 245/255, 241/255], title: [67/255, 20/255, 7/255], text: [120/255, 53/255, 4/255], accent: [234/255, 88/255, 12/255] },
        light: { bg: [255/255, 255/255, 255/255], title: [15/255, 23/255, 42/255], text: [71/255, 85/255, 105/255], accent: [37/255, 99/255, 235/255] }
      };
      const theme = themes[pptTheme];

      for (let i = 0; i < pptSlides.length; i++) {
        const slide = pptSlides[i];
        const page = pdfDoc.addPage([841.89, 595.27]); // Standard Landscape A4

        // Background
        page.drawRectangle({
          x: 0,
          y: 0,
          width: 841.89,
          height: 595.27,
          color: rgb(theme.bg[0], theme.bg[1], theme.bg[2])
        });

        // Title
        page.drawText(slide.title || 'Untitled Slide', {
          x: 60,
          y: 480,
          size: 28,
          font: fontBold,
          color: rgb(theme.title[0], theme.title[1], theme.title[2])
        });

        // Accent divider
        page.drawRectangle({
          x: 60,
          y: 450,
          width: 721.89,
          height: 3,
          color: rgb(theme.accent[0], theme.accent[1], theme.accent[2])
        });

        // Bullets list
        let currentY = 380;
        slide.bullets.forEach(bullet => {
          if (!bullet.trim()) return;

          // Bullet dot
          page.drawCircle({
            x: 75,
            y: currentY + 6,
            size: 4,
            color: rgb(theme.accent[0], theme.accent[1], theme.accent[2])
          });

          // Text wrap or single line
          page.drawText(bullet, {
            x: 95,
            y: currentY,
            size: 16,
            font: fontRegular,
            color: rgb(theme.text[0], theme.text[1], theme.text[2])
          });

          currentY -= 45;
        });

        // Footer
        page.drawText(`Slide ${i + 1} of ${pptSlides.length}`, {
          x: 60,
          y: 35,
          size: 10,
          font: fontRegular,
          color: rgb(theme.text[0], theme.text[1], theme.text[2]),
          opacity: 0.6
        });

        page.drawText('PDFDrop Slides Platform', {
          x: 680,
          y: 35,
          size: 10,
          font: fontRegular,
          color: rgb(theme.text[0], theme.text[1], theme.text[2]),
          opacity: 0.6
        });
      }

      const pptBytes = await pdfDoc.save();
      const filename = selectedFiles[0] ? selectedFiles[0].name.replace(/\.[^/.]+$/, '') : 'presentation';
      triggerDownload(pptBytes, `${filename}_export.pdf`);
      setProcessStatus({ type: 'success', message: 'PowerPoint presentation slides compiled and downloaded successfully!' });
    } catch (err: any) {
      console.error(err);
      setProcessStatus({ type: 'error', message: err.message || 'Error generating Presentation PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 9. Spreadsheet / XLSX to PDF conversion
  const handleXlsx2Pdf = async () => {
    setIsProcessing(true);
    setProcessStatus(null);
    try {
      const data = xlsxPreviewData;
      if (!data || data.length === 0) {
        throw new Error('Please upload an Excel spreadsheet or choose a valid sheet first.');
      }

      const pdfDoc = await PDFDocument.create();
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageW = 595.27;
      const pageH = 841.89;
      const margin = 40;

      // Detect column count
      let numCols = 0;
      data.forEach(row => {
        if (row && row.length > numCols) numCols = row.length;
      });

      if (numCols === 0) {
        throw new Error('Spreadsheet worksheet is empty.');
      }

      // Estimate columns width bounds
      const colWidths = Array(numCols).fill(50);
      const totalUsableWidth = pageW - margin * 2;

      for (let c = 0; c < numCols; c++) {
        let maxChars = 4;
        data.forEach(row => {
          if (row && row[c] !== undefined && row[c] !== null) {
            const l = String(row[c]).length;
            if (l > maxChars) maxChars = l;
          }
        });
        colWidths[c] = Math.max(50, Math.min(220, maxChars * 8));
      }

      // Normalize columns widths to page boundary
      const sumWidths = colWidths.reduce((sum, w) => sum + w, 0);
      if (sumWidths > totalUsableWidth) {
        const scaleFactor = totalUsableWidth / sumWidths;
        for (let c = 0; c < numCols; c++) {
          colWidths[c] = colWidths[c] * scaleFactor;
        }
      }

      let currentPage = pdfDoc.addPage([pageW, pageH]);
      let currentY = pageH - margin - 45;

      // Draw document spreadsheet title header
      currentPage.drawText(xlsxActiveSheet || 'Spreadsheet Export', {
        x: margin,
        y: pageH - margin - 15,
        size: 15,
        font: fontBold,
        color: rgb(15/255, 23/255, 42/255)
      });

      currentPage.drawText(`Generated via PDFDrop Spreadsheet Engine • ${new Date().toLocaleDateString()}`, {
        x: margin,
        y: pageH - margin - 28,
        size: 8,
        font: fontRegular,
        color: rgb(100/255, 116/255, 139/255)
      });

      const drawTableHeader = (page: any, y: number) => {
        let currentX = margin;
        // background fill
        page.drawRectangle({
          x: margin,
          y: y - 5,
          width: totalUsableWidth,
          height: 20,
          color: rgb(30/255, 41/255, 59/255)
        });

        const headerRow = data[0] || [];
        for (let c = 0; c < numCols; c++) {
          const text = headerRow[c] !== undefined && headerRow[c] !== null ? String(headerRow[c]) : `Col ${c+1}`;
          page.drawText(text.length > 20 ? text.substring(0, 18) + '..' : text, {
            x: currentX + 5,
            y: y + 2,
            size: 9,
            font: fontBold,
            color: rgb(1, 1, 1)
          });
          currentX += colWidths[c];
        }
      };

      drawTableHeader(currentPage, currentY);
      currentY -= 20;

      // Loop over sheet rows (skip header row 0)
      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;

        if (currentY < margin + 40) {
          currentPage = pdfDoc.addPage([pageW, pageH]);
          currentY = pageH - margin - 40;
          drawTableHeader(currentPage, currentY);
          currentY -= 20;
        }

        // Zebra striping background
        const bg = r % 2 === 0 ? rgb(248/255, 250/255, 252/255) : rgb(255/255, 255/255, 255/255);
        currentPage.drawRectangle({
          x: margin,
          y: currentY - 5,
          width: totalUsableWidth,
          height: 18,
          color: bg
        });

        // Horizontal line separator
        currentPage.drawRectangle({
          x: margin,
          y: currentY - 5,
          width: totalUsableWidth,
          height: 0.5,
          color: rgb(226/255, 232/255, 240/255)
        });

        let currentX = margin;
        for (let c = 0; c < numCols; c++) {
          const val = row[c] !== undefined && row[c] !== null ? String(row[c]) : '';
          
          currentPage.drawText(val.length > 25 ? val.substring(0, 22) + '...' : val, {
            x: currentX + 5,
            y: currentY - 1,
            size: 8,
            font: fontRegular,
            color: rgb(51/255, 65/255, 85/255)
          });

          // Draw vertical border gridlines
          currentPage.drawRectangle({
            x: currentX,
            y: currentY - 5,
            width: 0.5,
            height: 18,
            color: rgb(226/255, 232/255, 240/255)
          });

          currentX += colWidths[c];
        }

        // Rightmost vertical line
        currentPage.drawRectangle({
          x: margin + totalUsableWidth,
          y: currentY - 5,
          width: 0.5,
          height: 18,
          color: rgb(226/255, 232/255, 240/255)
        });

        currentY -= 18;
      }

      const xlsxBytes = await pdfDoc.save();
      const filename = selectedFiles[0] ? selectedFiles[0].name.replace(/\.[^/.]+$/, '') : 'spreadsheet';
      triggerDownload(xlsxBytes, `${filename}_${xlsxActiveSheet}.pdf`);
      setProcessStatus({ type: 'success', message: 'Excel spreadsheet table successfully rendered to PDF!' });
    } catch (err: any) {
      console.error(err);
      setProcessStatus({ type: 'error', message: err.message || 'Error processing spreadsheet.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 10. Plain Text to PDF
  const handleTxt2Pdf = async () => {
    setIsProcessing(true);
    setProcessStatus(null);
    try {
      if (!txtContent) {
        throw new Error('Please write, draft, or upload plain text contents first.');
      }

      const generatedBytes = await convertTextToPDF(txtContent, {
        fontSize: 11,
        lineHeight: 11 * 1.5,
        margin: 50,
        title: txtTitle,
        author: 'Plain Text Creator'
      });

      triggerDownload(generatedBytes, 'plain_text_export.pdf');
      setProcessStatus({ type: 'success', message: 'Plain Text converted and PDF downloaded successfully!' });
    } catch (err: any) {
      console.error(err);
      setProcessStatus({ type: 'error', message: err.message || 'Error converting text to PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 11. Rotate PDF Pages
  const handleRotate = async () => {
    try {
      const file = selectedFiles[0].file;
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pages = pdfDoc.getPages();

      for (let i = 0; i < pages.length; i++) {
        const pageNum = i + 1;
        const isOdd = pageNum % 2 !== 0;
        const isEven = pageNum % 2 === 0;

        let shouldRotate = false;
        if (rotateTarget === 'all') shouldRotate = true;
        else if (rotateTarget === 'odd' && isOdd) shouldRotate = true;
        else if (rotateTarget === 'even' && isEven) shouldRotate = true;

        if (shouldRotate) {
          const page = pages[i];
          const currRot = page.getRotation().angle;
          const newRot = (currRot + rotateAngle) % 360;
          page.setRotation(degrees(newRot));
        }
      }

      const rotatedBytes = await pdfDoc.save();
      triggerDownload(rotatedBytes, `rotated_${file.name}`);
      setProcessStatus({ type: 'success', message: `PDF page rotation (${rotateAngle}°) applied and downloaded successfully!` });
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  // 12. Watermark stamp text
  const handleWatermark = async () => {
    try {
      const file = selectedFiles[0].file;
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Convert hex color to floating RGB
      const cleanHex = watermarkColor.replace('#', '');
      const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
      const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
      const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        
        // Calculate dynamic dimensions
        const txtWidth = font.widthOfTextAtSize(watermarkText, watermarkFontSize);
        
        // Use math to center rotated watermark nicely
        const angleRad = (watermarkRotation * Math.PI) / 180;
        const xOffset = (txtWidth / 2) * Math.cos(angleRad);
        const yOffset = (txtWidth / 2) * Math.sin(angleRad);

        const targetX = width / 2 - xOffset;
        const targetY = height / 2 - yOffset;

        page.drawText(watermarkText, {
          x: isNaN(targetX) ? width / 2 : targetX,
          y: isNaN(targetY) ? height / 2 : targetY,
          size: watermarkFontSize,
          font: font,
          color: rgb(r, g, b),
          opacity: watermarkOpacity,
          rotate: degrees(watermarkRotation)
        });
      }

      const stampedBytes = await pdfDoc.save();
      triggerDownload(stampedBytes, `watermarked_${file.name}`);
      setProcessStatus({ type: 'success', message: 'Custom text watermarks stamped on every page successfully!' });
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const triggerDownload = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ----------------------------------------------------
  // FILE TYPE CONTENT EXTRACTORS (Txt / Docx)
  // ----------------------------------------------------
  const handleWordDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setWordTitle(file.name.replace(/\.[^/.]+$/, ""));
      
      if (file.name.endsWith('.txt')) {
        const text = await file.text();
        setWordText(text);
      } else {
        // Docx simple text extraction using lightweight browser parsing or general text helper
        // Since mammoth standard cdn requires window context, let's read as text array to find clean paragraphs
        const reader = new FileReader();
        reader.onload = (event) => {
          const contents = event.target?.result as string;
          // Simple cleaning of word structures if plain content
          const cleanLines = contents
            .replace(/[^\x20-\x7E\t\r\n]/g, '') // remove non-printable control chars
            .replace(/\s+/g, ' ')
            .replace(/ParaId|StyleId|Normal/g, '');
          setWordText(cleanLines.slice(0, 4000));
        };
        reader.readAsText(file);
      }
      setProcessStatus({ type: 'success', message: `Imported text from ${file.name} successfully!` });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 font-sans">
      
      {/* Navigation Header */}
      <button 
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors cursor-pointer group"
        id="ws-back-btn"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to all tools
      </button>

      {/* Main Workspace Frame */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Tool Header Banner */}
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${toolDetails.bgColor} flex items-center justify-center shrink-0`}>
              {toolDetails.icon}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">{toolDetails.title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{toolDetails.description}</p>
            </div>
          </div>
          
          {/* Quick link to standard Editor */}
          {activeTool !== 'word2pdf' && selectedFiles.length === 1 && (
            <button
              onClick={() => onNavigateToEditor(selectedFiles[0].file)}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100 transition-colors cursor-pointer"
            >
              Open in Advanced Editor
            </button>
          )}
        </div>

        {/* Content Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
          
          {/* Left panel: File drop area / Content input */}
          <div className="p-6 lg:col-span-7 space-y-6">
            
            {(activeTool === 'word2pdf' || activeTool === 'docx2pdf') ? (
              /* Rich edit area for Word to PDF */
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileUp className="w-5 h-5 text-blue-500" />
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Document Text Editor</span>
                  </div>
                  <label className="text-xs bg-white text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-100 hover:border-blue-200 transition-colors shadow-xs cursor-pointer flex items-center gap-1 font-semibold">
                    <UploadCloud className="w-3.5 h-3.5" />
                    Import .docx / .txt file
                    <input 
                      type="file" 
                      accept=".docx,.txt" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          addFiles([e.target.files[0]]);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  value={wordText}
                  onChange={(e) => setWordText(e.target.value)}
                  placeholder="Draft your document text content here. Markdown headings (#, ##) and list bullets are automatically styled when exported..."
                  className="w-full h-[400px] p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none font-mono text-gray-700 leading-relaxed"
                  id="word-textarea"
                />
                <div className="text-right text-[10px] text-gray-400 font-mono">
                  {wordText.length} characters • {wordText.split(/\s+/).filter(Boolean).length} words
                </div>
              </div>
            ) : activeTool === 'txt2pdf' ? (
              /* Plain Text Editor */
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-slate-600" />
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Plain Text Editor</span>
                  </div>
                  <label className="text-xs bg-white text-slate-600 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors shadow-xs cursor-pointer flex items-center gap-1 font-semibold">
                    <UploadCloud className="w-3.5 h-3.5" />
                    Upload .txt file
                    <input 
                      type="file" 
                      accept=".txt" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          addFiles([e.target.files[0]]);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  value={txtContent}
                  onChange={(e) => setTxtContent(e.target.value)}
                  placeholder="Type or paste plain text here. Paragraph spacing and pagination are automatically optimized for formal A4 output..."
                  className="w-full h-[400px] p-4 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-500 focus:bg-white transition-all resize-none text-slate-800"
                  id="txt-textarea"
                />
                <div className="text-right text-[10px] text-gray-400 font-mono">
                  {txtContent.length} characters
                </div>
              </div>
            ) : activeTool === 'ppt2pdf' ? (
              /* Slide interactive creator */
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-rose-50/50 p-3 rounded-xl border border-rose-100/50">
                  <div className="flex items-center gap-2">
                    <Presentation className="w-5 h-5 text-rose-500" />
                    <span className="text-xs font-extrabold text-rose-900 uppercase tracking-wider">Interactive Slide Deck Builder</span>
                  </div>
                  <label className="text-xs bg-white text-rose-700 hover:text-rose-800 px-2.5 py-1.5 rounded-lg border border-rose-200 hover:border-rose-300 transition-colors shadow-xs cursor-pointer flex items-center gap-1 font-semibold">
                    <UploadCloud className="w-3.5 h-3.5" />
                    Import PowerPoint (.pptx)
                    <input 
                      type="file" 
                      accept=".pptx" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          addFiles([e.target.files[0]]);
                        }
                      }}
                    />
                  </label>
                </div>

                {pptSlides.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-rose-200 rounded-xl">
                    <p className="text-xs text-rose-600 font-medium">No slides in this deck.</p>
                    <button
                      onClick={() => setPptSlides([{ title: 'New Slide', bullets: ['Add bullets here'] }])}
                      className="mt-2 text-xs bg-rose-600 text-white px-3 py-1.5 rounded-lg font-bold"
                    >
                      Create Slide
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-4 border border-gray-200 rounded-xl p-4 bg-gray-50/30">
                    
                    {/* Slides navigator rail */}
                    <div className="col-span-4 border-r border-gray-100 pr-3 space-y-2 max-h-96 overflow-y-auto">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Slide Index</span>
                        <button
                          onClick={() => {
                            const newSlide = { title: `Slide ${pptSlides.length + 1}`, bullets: ['New key bullet point'] };
                            setPptSlides([...pptSlides, newSlide]);
                            setActiveSlideIdx(pptSlides.length);
                          }}
                          className="p-1 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Add Slide"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {pptSlides.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => setActiveSlideIdx(idx)}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                            activeSlideIdx === idx
                              ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-200'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-rose-600">Slide {idx + 1}</span>
                            {pptSlides.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = pptSlides.filter((_, i) => i !== idx);
                                  setPptSlides(updated);
                                  setActiveSlideIdx(Math.max(0, idx - 1));
                                }}
                                className="text-gray-400 hover:text-red-500 p-0.5"
                                title="Delete Slide"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] font-extrabold text-gray-800 truncate mt-1">
                            {s.title || '(Untitled Slide)'}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Active Slide text editor */}
                    <div className="col-span-8 pl-1 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Slide Header Title</label>
                        <input
                          type="text"
                          value={pptSlides[activeSlideIdx]?.title || ''}
                          onChange={(e) => {
                            const updated = [...pptSlides];
                            if (updated[activeSlideIdx]) {
                              updated[activeSlideIdx].title = e.target.value;
                              setPptSlides(updated);
                            }
                          }}
                          placeholder="e.g. Market Strategy Overview"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-extrabold text-gray-800 focus:ring-1 focus:ring-rose-400 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Key Bullet Points (one per line)</label>
                        <textarea
                          value={pptSlides[activeSlideIdx]?.bullets.join('\n') || ''}
                          onChange={(e) => {
                            const updated = [...pptSlides];
                            if (updated[activeSlideIdx]) {
                              updated[activeSlideIdx].bullets = e.target.value.split('\n');
                              setPptSlides(updated);
                            }
                          }}
                          rows={6}
                          placeholder="Bullet point 1&#10;Bullet point 2&#10;Bullet point 3"
                          className="w-full bg-white border border-gray-200 rounded-lg p-3 text-xs focus:ring-1 focus:ring-rose-400 focus:outline-hidden leading-relaxed text-gray-700"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 leading-normal">
                        <strong>💡 Layout Guide:</strong> Keep bullets to 3-5 lines for perfect landscape slide presentation formatting.
                      </p>
                    </div>

                  </div>
                )}
              </div>
            ) : activeTool === 'xlsx2pdf' ? (
              /* Excel preview spreadsheet view */
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">Spreadsheet Previewer</span>
                  </div>
                  <label className="text-xs bg-white text-emerald-700 hover:text-emerald-800 px-2.5 py-1.5 rounded-lg border border-emerald-200 hover:border-emerald-300 transition-colors shadow-xs cursor-pointer flex items-center gap-1 font-semibold">
                    <UploadCloud className="w-3.5 h-3.5" />
                    Import .xlsx / .csv
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.csv" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          addFiles([e.target.files[0]]);
                        }
                      }}
                    />
                  </label>
                </div>

                {xlsxSheets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-b border-gray-100 pb-2">
                    {xlsxSheets.map(sheet => (
                      <button
                        key={sheet}
                        onClick={() => {
                          setXlsxActiveSheet(sheet);
                          setXlsxPreviewData(xlsxAllData[sheet] || []);
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          xlsxActiveSheet === sheet
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {sheet}
                      </button>
                    ))}
                  </div>
                )}

                {xlsxPreviewData.length === 0 ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-200 rounded-xl py-16 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-emerald-50/20 transition-all group"
                  >
                    <FileSpreadsheet className="w-10 h-10 text-emerald-400 group-hover:text-emerald-500 mb-2 transition-colors" />
                    <p className="text-sm font-bold text-emerald-800">No Excel file imported</p>
                    <p className="text-xs text-gray-400 max-w-xs mt-1 leading-relaxed">
                      Drop or upload an Excel (.xlsx) or CSV spreadsheet file to parse and view cells instantly.
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white font-mono text-[10px]">
                            {xlsxPreviewData[0]?.map((col, cIdx) => (
                              <th key={cIdx} className="px-3 py-2 border-r border-slate-700 min-w-[100px]">
                                {col !== undefined && col !== null ? String(col) : `Col ${cIdx+1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-[10px] text-gray-700">
                          {xlsxPreviewData.slice(1, 20).map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50 font-sans">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-2 border-r border-gray-100 truncate max-w-[150px]" title={String(cell)}>
                                  {cell !== undefined && cell !== null ? String(cell) : ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {xlsxPreviewData.length > 20 && (
                      <div className="bg-gray-50 px-3 py-2 text-[10px] text-gray-500 border-t border-gray-100 text-center font-semibold">
                        Showing first 20 rows of {xlsxPreviewData.length} records. Whole table will be converted to PDF!
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Standard Drag & Drop widget for document files */
              <div className="space-y-4">
                
                {/* Upload Trigger Area */}
                {(selectedFiles.length === 0 || toolDetails.multiple) && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${
                      dragOver 
                        ? 'border-blue-500 bg-blue-50/40' 
                        : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50/50'
                    }`}
                    id="dropzone"
                  >
                    <UploadCloud className="w-10 h-10 text-gray-400 group-hover:text-blue-500 transition-colors mb-3" />
                    <h4 className="font-semibold text-gray-800 text-sm">
                      {dragOver ? 'Drop files here now!' : 'Choose files or drag them here'}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs">
                      Supports {toolDetails.accepts.toUpperCase()} files. All computation is processed in client memory.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={toolDetails.accepts}
                      multiple={toolDetails.multiple}
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-input"
                    />
                  </div>
                )}

                {/* Selected Files visual List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Selected Document{selectedFiles.length > 1 ? 's' : ''} ({selectedFiles.length})
                    </h4>
                    
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {selectedFiles.map((item, idx) => (
                        <div 
                          key={item.id}
                          className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-4 hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            {item.previewUrl ? (
                              <img 
                                src={item.previewUrl} 
                                alt="Image preview" 
                                className="w-10 h-10 object-cover rounded-lg border border-gray-200 shrink-0" 
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                PDF
                              </div>
                            )}
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-gray-800 truncate" title={item.name}>
                                {item.name}
                              </p>
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                {(item.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Sorting arrows for merge / images order */}
                            {toolDetails.multiple && selectedFiles.length > 1 && (
                              <>
                                <button
                                  onClick={() => moveFile(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-gray-100"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => moveFile(idx, 'down')}
                                  disabled={idx === selectedFiles.length - 1}
                                  className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-gray-100"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => removeFile(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Right panel: Custom Settings Options */}
          <div className="p-6 lg:col-span-5 flex flex-col justify-between bg-gray-50/40">
            
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">
                Configuration Settings
              </h3>

              {/* 1. Merge PDFs Settings */}
              {activeTool === 'merge' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Rearrange the file order on the left using the up and down arrow buttons. 
                    They will be appended sequentially into the final compiled PDF document.
                  </p>
                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-700">
                    <strong>Tip:</strong> Re-order images or page bounds to set the layout flow before clicking Generate.
                  </div>
                </div>
              )}

              {/* 2. Split PDF Settings */}
              {activeTool === 'split' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Page Count detected</label>
                    <div className="text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 inline-block">
                      {pageCount > 0 ? `${pageCount} Page${pageCount > 1 ? 's' : ''}` : 'Analyzing document...'}
                    </div>
                  </div>

                  {pageCount > 0 && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                          Specify page range string
                        </label>
                        <input
                          type="text"
                          value={splitRange}
                          onChange={(e) => {
                            setSplitRange(e.target.value);
                            setSelectedSplitPages([]); // Clear manual toggling
                          }}
                          placeholder="e.g. 1-3, 5"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          Use commas to separate bounds, hyphens to define ranges.
                        </span>
                      </div>

                      {/* Visual checkboxes for page split selecting */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">
                          Or click individual pages below
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-white border border-gray-200 rounded-lg">
                          {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => {
                            const isSel = selectedSplitPages.includes(p);
                            return (
                              <button
                                key={p}
                                onClick={() => toggleSplitPageSelection(p)}
                                className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                                  isSel 
                                    ? 'bg-orange-500 text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Compress PDF Settings */}
              {activeTool === 'compress' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-gray-700">Compression scale</label>
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded-full">
                        {
                          ['Minimal', 'Light', 'Balanced', 'High', 'Maximum'][compressLevel - 1]
                        }
                      </span>
                    </div>
                    
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={compressLevel}
                      onChange={(e) => setCompressLevel(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                    />

                    <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-semibold">
                      <span>100% Quality</span>
                      <span>Balanced</span>
                      <span>35% Quality</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed bg-white border border-gray-200 p-3 rounded-xl">
                    {
                      [
                        'Barely compressed. Highest quality layout preservation.',
                        'Slight size reduction, minimal loss of image clarity. Excellent for documents with detailed text.',
                        'Good balance of visual sharpness and memory reduction. Highly recommended for standard emails and uploads.',
                        'Compact footprint. Visible compression may be noticeable in dense diagrams or high-res photos.',
                        'Maximum compression. Reduces file down to the absolute smallest sizes possible. Excellent for slow networks.'
                      ][compressLevel - 1]
                    }
                  </p>
                </div>
              )}

              {/* 4. Image to PDF Settings */}
              {activeTool === 'img2pdf' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Page Dimensions</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setImgPageSize('fit')}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          imgPageSize === 'fit' 
                            ? 'bg-blue-50 border-blue-500 text-blue-700' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Fit to Image
                      </button>
                      <button
                        onClick={() => setImgPageSize('a4')}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          imgPageSize === 'a4' 
                            ? 'bg-blue-50 border-blue-500 text-blue-700' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Standard A4
                      </button>
                    </div>
                  </div>

                  {imgPageSize === 'a4' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Orientation</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setImgOrientation('portrait')}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                            imgOrientation === 'portrait' 
                              ? 'bg-blue-50 border-blue-500 text-blue-700' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Portrait
                        </button>
                        <button
                          onClick={() => setImgOrientation('landscape')}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                            imgOrientation === 'landscape' 
                              ? 'bg-blue-50 border-blue-500 text-blue-700' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Landscape
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Page Margins (px)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 10, 25].map(val => (
                        <button
                          key={val}
                          onClick={() => setImgMargin(val)}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                            imgMargin === val 
                              ? 'bg-blue-50 border-blue-500 text-blue-700' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {val === 0 ? 'None' : `${val} px`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Word to PDF Settings */}
              {activeTool === 'word2pdf' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Document Title</label>
                    <input
                      type="text"
                      value={wordTitle}
                      onChange={(e) => setWordTitle(e.target.value)}
                      placeholder="e.g. Project Specs"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Author Name</label>
                    <input
                      type="text"
                      value={wordAuthor}
                      onChange={(e) => setWordAuthor(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Font size</label>
                    <select
                      value={wordFontSize}
                      onChange={(e) => setWordFontSize(parseInt(e.target.value))}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value={10}>10 pt (Compact)</option>
                      <option value={12}>12 pt (Standard)</option>
                      <option value={14}>14 pt (Large)</option>
                      <option value={16}>16 pt (Executive)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 6. Protect PDF Settings */}
              {activeTool === 'protect' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter file password"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Retype password"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* 7. Extract Pages Settings */}
              {activeTool === 'extract' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Page Count detected</label>
                    <div className="text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 inline-block">
                      {pageCount > 0 ? `${pageCount} Page${pageCount > 1 ? 's' : ''}` : 'Analyzing document...'}
                    </div>
                  </div>

                  {pageCount > 0 && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                          Specify page range to extract
                        </label>
                        <input
                          type="text"
                          value={splitRange}
                          onChange={(e) => {
                            setSplitRange(e.target.value);
                            setSelectedSplitPages([]); // Clear manual toggling
                          }}
                          placeholder="e.g. 1-2, 4"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          Use commas to separate bounds, hyphens to define ranges.
                        </span>
                      </div>

                      {/* Visual checkboxes for page split selecting */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">
                          Or check individual pages below
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-white border border-gray-200 rounded-lg">
                          {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => {
                            const isSel = selectedSplitPages.includes(p);
                            return (
                              <button
                                key={p}
                                onClick={() => toggleSplitPageSelection(p)}
                                className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                                  isSel 
                                    ? 'bg-amber-500 text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 8. DOCX to PDF Settings */}
              {activeTool === 'docx2pdf' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Document Title</label>
                    <input
                      type="text"
                      value={wordTitle}
                      onChange={(e) => setWordTitle(e.target.value)}
                      placeholder="e.g. Project specs"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Author Name</label>
                    <input
                      type="text"
                      value={wordAuthor}
                      onChange={(e) => setWordAuthor(e.target.value)}
                      placeholder="e.g. Creator Team"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Text size</label>
                    <select
                      value={wordFontSize}
                      onChange={(e) => setWordFontSize(parseInt(e.target.value))}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value={10}>10 pt (Compact)</option>
                      <option value={12}>12 pt (Standard)</option>
                      <option value={14}>14 pt (Large)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 9. PPT to PDF slide options */}
              {activeTool === 'ppt2pdf' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Slide Presentation Theme</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'navy', label: 'Classic Navy', bg: 'bg-slate-900 border-slate-700 text-white' },
                        { id: 'dark', label: 'Cosmic Obsidian', bg: 'bg-zinc-950 border-zinc-800 text-white' },
                        { id: 'emerald', label: 'Forest Green', bg: 'bg-emerald-950 border-emerald-800 text-white' },
                        { id: 'peach', label: 'Soft Sunset', bg: 'bg-orange-50 border-orange-200 text-orange-950' },
                        { id: 'light', label: 'Clean White', bg: 'bg-white border-gray-200 text-gray-900' }
                      ].map(theme => (
                        <button
                          key={theme.id}
                          onClick={() => setPptTheme(theme.id as any)}
                          className={`p-2 rounded-lg border text-xs font-bold transition-all text-left flex flex-col justify-between ${theme.bg} ${
                            pptTheme === theme.id ? 'ring-2 ring-rose-500' : 'opacity-80 hover:opacity-100'
                          }`}
                        >
                          <span>{theme.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 leading-relaxed">
                    <strong>Presentation layout:</strong> Generates widescreen slide format with elegant typography and custom matching theme accent margins.
                  </div>
                </div>
              )}

              {/* 10. XLSX spreadsheet settings */}
              {activeTool === 'xlsx2pdf' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Select sheet to convert</label>
                    {xlsxSheets.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">Please upload an Excel spreadsheet file first</span>
                    ) : (
                      <select
                        value={xlsxActiveSheet}
                        onChange={(e) => {
                          const sheet = e.target.value;
                          setXlsxActiveSheet(sheet);
                          setXlsxPreviewData(xlsxAllData[sheet] || []);
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      >
                        {xlsxSheets.map(sheet => (
                          <option key={sheet} value={sheet}>{sheet}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 leading-relaxed">
                    <strong>Spreadsheet layout:</strong> Converts rows and cells to a formal PDF table with dynamic column width scaling and automatic page pagination.
                  </div>
                </div>
              )}

              {/* 11. TXT plain text settings */}
              {activeTool === 'txt2pdf' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Document Title Header</label>
                    <input
                      type="text"
                      value={txtTitle}
                      onChange={(e) => setTxtTitle(e.target.value)}
                      placeholder="e.g. plain text note"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-slate-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* 12. Rotate PDF Settings */}
              {activeTool === 'rotate' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Rotate Angle</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[90, 180, 270].map(angle => (
                        <button
                          key={angle}
                          onClick={() => setRotateAngle(angle as any)}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            rotateAngle === angle 
                              ? 'bg-teal-50 border-teal-500 text-teal-700' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {angle}° Clockwise
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Apply to Pages</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'all', label: 'All Pages' },
                        { id: 'odd', label: 'Odd Pages Only' },
                        { id: 'even', label: 'Even Pages Only' }
                      ].map(target => (
                        <button
                          key={target.id}
                          onClick={() => setRotateTarget(target.id as any)}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            rotateTarget === target.id 
                              ? 'bg-teal-50 border-teal-500 text-teal-700' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {target.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 13. Stamp Watermark Settings */}
              {activeTool === 'watermark' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Watermark Text</label>
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="CONFIDENTIAL"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-hidden font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Font Size</label>
                      <input
                        type="number"
                        min="12"
                        max="120"
                        value={watermarkFontSize}
                        onChange={(e) => setWatermarkFontSize(parseInt(e.target.value) || 24)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Color Accent</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={watermarkColor}
                          onChange={(e) => setWatermarkColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0"
                        />
                        <span className="text-xs font-mono text-gray-500 flex items-center">{watermarkColor}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                      <span>Opacity</span>
                      <span>{(watermarkOpacity * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.8"
                      step="0.05"
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                      <span>Rotation Angle</span>
                      <span>{watermarkRotation}°</span>
                    </div>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      step="15"
                      value={watermarkRotation}
                      onChange={(e) => setWatermarkRotation(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Actions Area */}
            <div className="pt-6 border-t border-gray-100 mt-6 space-y-4">
              
              {/* Process Outcome Alert Messages */}
              {processStatus && (
                <div className={`p-3.5 rounded-xl flex items-start gap-2 text-xs border ${
                  processStatus.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                    : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}>
                  {processStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{processStatus.message}</span>
                </div>
              )}

              <button
                onClick={executeProcess}
                disabled={isProcessing || (['word2pdf', 'ppt2pdf', 'txt2pdf', 'docx2pdf', 'xlsx2pdf'].indexOf(activeTool) === -1 && selectedFiles.length === 0)}
                className={`w-full py-3 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                  isProcessing 
                    ? 'bg-gray-400' 
                    : activeTool === 'protect' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : activeTool === 'compress' 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50`}
                id="ws-execute-btn"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    {toolDetails.actionText}
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
