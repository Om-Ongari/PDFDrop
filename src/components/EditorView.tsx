import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  ChevronLeft, 
  ChevronRight, 
  Minus, 
  Plus, 
  Image as ImageIcon, 
  Download, 
  Trash2, 
  CheckCircle,
  AlertCircle,
  Loader2,
  FileDown,
  Sparkles,
  Layers,
  LayoutGrid
} from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { Annotation, PDFPageInfo } from '../types';
import { isPDFDropSecureFile, decryptPDFBytes } from '../utils/cryptoHelper';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface EditorViewProps {
  initialFile?: File;
  onBack: () => void;
}

export default function EditorView({ initialFile, onBack }: EditorViewProps) {
  // Navigation & document states
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Active Tool & Editor Sidebar Tabs
  const [sidebarTab, setSidebarTab] = useState<'tools' | 'pages'>('tools');
  const [activeTool, setActiveTool] = useState<'text' | 'image' | null>(null);
  const [textContent, setTextContent] = useState<string>('Sample text');
  const [textSize, setTextSize] = useState<number>(16);
  const [textColor, setTextColor] = useState<string>('#ef4444'); // Tailwinds red-500 equivalent

  // Image insertion states
  const [imageUploadUrl, setImageUploadUrl] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string>('image/png');
  const [imageWidth, setImageWidth] = useState<number>(150);

  // Annotations state per page pageNum -> array of Annotations
  const [annotations, setAnnotations] = useState<{ [key: number]: Annotation[] }>({});
  
  // Dragging interaction states
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

  // DOM Canvas and overlay refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const annotationLayerRef = useRef<HTMLDivElement>(null);

  // Page thumbnails
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  // Load initial file if provided
  useEffect(() => {
    if (initialFile) {
      loadDocument(initialFile);
    }
  }, [initialFile]);

  // Load document from file input
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      loadDocument(e.target.files[0]);
    }
  };

  const loadDocument = async (file: File) => {
    setLoading(true);
    setSaveStatus(null);
    setAnnotations({});
    try {
      const buffer = await file.arrayBuffer();
      let bytes = new Uint8Array(buffer);

      // Secure container verification
      if (isPDFDropSecureFile(bytes)) {
        const password = prompt(`"${file.name}" is password-protected by PDFDrop. Please enter the decryption password to open it:`);
        if (password === null) {
          throw new Error('Decryption cancelled by user.');
        }
        if (!password) {
          throw new Error('A password is required to decrypt this document.');
        }
        try {
          bytes = await decryptPDFBytes(bytes, password);
          setSaveStatus({ type: 'success', message: 'Document successfully decrypted and unlocked!' });
        } catch (decError) {
          throw new Error('Incorrect password. Failed to decrypt document safely.');
        }
      }

      setPdfBytes(bytes);

      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setPageNum(1);
      
      // Generate small thumbnail previews
      generateThumbnails(doc);
    } catch (err: any) {
      console.error('Error loading PDF document:', err);
      setSaveStatus({ type: 'error', message: err.message || 'Failed to load document. Make sure it is a valid PDF.' });
    } finally {
      setLoading(false);
    }
  };

  // Generate page thumbnails for the Pages tab
  const generateThumbnails = async (doc: pdfjsLib.PDFDocumentProxy) => {
    const thumbs: string[] = [];
    // Cap thumbnails at 15 for performance
    const thumbCount = Math.min(doc.numPages, 15);
    for (let i = 1; i <= thumbCount; i++) {
      try {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          thumbs.push(canvas.toDataURL());
        }
      } catch (err) {
        console.warn('Error generating thumb for page:', i, err);
      }
    }
    setThumbnails(thumbs);
  };

  // Render current active page onto the primary canvas
  useEffect(() => {
    if (!pdfDoc) return;

    let renderTask: any = null;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw clean white background first
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({
          canvasContext: ctx,
          viewport: viewport
        } as any);

        await renderTask.promise;
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    render();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNum, scale]);

  // Image annotation handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImageType(file.type);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageUploadUrl(event.target.result as string);
          setSaveStatus({ type: 'success', message: 'Image loaded! Click "Place image" then click on the page to insert.' });
          setActiveTool('image');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Canvas interaction: placing annotations
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTool || !annotationLayerRef.current) return;

    const rect = annotationLayerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert into scale-independent points coordinates
    const unscaledX = clickX / scale;
    const unscaledY = clickY / scale;

    const newAnnotation: Annotation = {
      id: `anno-${Date.now()}-${Math.random()}`,
      type: activeTool,
      x: unscaledX,
      y: unscaledY,
    };

    if (activeTool === 'text') {
      newAnnotation.text = textContent;
      newAnnotation.fontSize = textSize;
      newAnnotation.color = textColor;
    } else if (activeTool === 'image') {
      if (!imageUploadUrl) {
        setSaveStatus({ type: 'error', message: 'Please select and upload an image file first.' });
        return;
      }
      newAnnotation.dataUrl = imageUploadUrl;
      newAnnotation.width = imageWidth;
    }

    setAnnotations(prev => ({
      ...prev,
      [pageNum]: [...(prev[pageNum] || []), newAnnotation]
    }));

    // Reset tool
    setActiveTool(null);
    setSaveStatus(null);
  };

  // Annotation Drag handlers
  const handleAnnotationMouseDown = (e: React.MouseEvent, id: string, annoX: number, annoY: number) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingId(id);
    
    const scaleX = annoX * scale;
    const scaleY = annoY * scale;

    setDragOffset({
      x: e.clientX - scaleX,
      y: e.clientY - scaleY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || !annotationLayerRef.current) return;

    const rect = annotationLayerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate unscaled coordinates
    const unscaledX = Math.max(0, mouseX / scale);
    const unscaledY = Math.max(0, mouseY / scale);

    setAnnotations(prev => {
      const pageAnnos = prev[pageNum] || [];
      const updated = pageAnnos.map(anno => {
        if (anno.id === draggingId) {
          return { ...anno, x: unscaledX, y: unscaledY };
        }
        return anno;
      });
      return { ...prev, [pageNum]: updated };
    });
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations(prev => ({
      ...prev,
      [pageNum]: (prev[pageNum] || []).filter(anno => anno.id !== id)
    }));
  };

  // Save overlays onto actual PDF using pdf-lib
  const handleSaveAndDownload = async () => {
    if (!pdfBytes) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const workingDoc = await PDFDocument.load(pdfBytes);
      const pages = workingDoc.getPages();

      // Loop through all pages that contain user annotations
      for (const [pNumStr, pageAnnos] of Object.entries(annotations) as [string, Annotation[]][]) {
        const pIdx = parseInt(pNumStr) - 1;
        if (pIdx >= pages.length) continue;

        const page = pages[pIdx];
        const { width: pageW, height: pageH } = page.getSize();

        for (const anno of pageAnnos) {
          if (anno.type === 'text' && anno.text) {
            // Hex to rgb conversion
            const colorHex = anno.color || '#ef4444';
            const r = parseInt(colorHex.slice(1, 3), 16) / 255;
            const g = parseInt(colorHex.slice(3, 5), 16) / 255;
            const b = parseInt(colorHex.slice(5, 7), 16) / 255;

            // Draw text overlay: coordinates are bottom-up, adjust font size offset
            page.drawText(anno.text, {
              x: anno.x,
              y: pageH - anno.y - (anno.fontSize || 14),
              size: anno.fontSize || 14,
              color: rgb(r, g, b)
            });

          } else if (anno.type === 'image' && anno.dataUrl) {
            let embeddedImg;
            const bytes = await fetch(anno.dataUrl).then(res => res.arrayBuffer());

            if (imageType === 'image/jpeg' || imageType === 'image/jpg') {
              embeddedImg = await workingDoc.embedJpg(bytes);
            } else {
              embeddedImg = await workingDoc.embedPng(bytes);
            }

            const scaleRatio = (anno.width || 150) / embeddedImg.width;
            const drawW = embeddedImg.width * scaleRatio;
            const drawH = embeddedImg.height * scaleRatio;

            page.drawImage(embeddedImg, {
              x: anno.x,
              y: pageH - anno.y - drawH,
              width: drawW,
              height: drawH,
            });
          }
        }
      }

      const savedBytes = await workingDoc.save();
      const blob = new Blob([savedBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'edited_document.pdf';
      link.click();
      URL.revokeObjectURL(link.href);

      setSaveStatus({ type: 'success', message: 'PDF document downloaded with all annotation overlays applied!' });
    } catch (err: any) {
      console.error(err);
      setSaveStatus({ type: 'error', message: err.message || 'Failed to draw annotations onto the PDF.' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentAnnotations = annotations[pageNum] || [];

  return (
    <div 
      className="h-screen w-screen bg-neutral-900 text-neutral-200 flex flex-col font-sans overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      
      {/* Top Toolbar */}
      <header className="h-14 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="font-bold text-base tracking-tight flex items-center gap-1.5">
            <span className="text-white">PDFDrop</span>
            <span className="text-neutral-500 text-xs font-semibold px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded uppercase">Editor</span>
          </div>

          <label className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm ml-2">
            <Upload className="w-3.5 h-3.5" />
            Open PDF
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf" 
              className="hidden" 
              onChange={handleDocumentUpload}
            />
          </label>
        </div>

        {pdfDoc && (
          <div className="flex items-center gap-4">
            {/* Page Navigation */}
            <div className="flex items-center gap-1 bg-neutral-900 rounded-lg border border-neutral-800 p-0.5">
              <button 
                onClick={() => pageNum > 1 && setPageNum(p => p - 1)}
                disabled={pageNum <= 1}
                className="w-8 h-7 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold px-2.5 text-neutral-300 min-w-[3.5rem] text-center">
                {pageNum} / {totalPages}
              </span>
              <button 
                onClick={() => pageNum < totalPages && setPageNum(p => p + 1)}
                disabled={pageNum >= totalPages}
                className="w-8 h-7 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-neutral-900 rounded-lg border border-neutral-800 p-0.5">
              <button 
                onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                className="w-8 h-7 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold px-2.5 text-neutral-300 min-w-[3rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button 
                onClick={() => setScale(s => Math.min(3.0, s + 0.25))}
                className="w-8 h-7 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="w-10"></div>
      </header>

      {/* Main Container Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar */}
        <aside className="w-72 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0">
          
          {/* Tabs */}
          <div className="flex border-b border-neutral-800 shrink-0">
            <button 
              onClick={() => setSidebarTab('tools')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center transition-colors border-b-2 ${
                sidebarTab === 'tools' 
                  ? 'border-blue-500 text-blue-500 bg-neutral-900/30' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              } cursor-pointer`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Tools
              </span>
            </button>
            <button 
              onClick={() => setSidebarTab('pages')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center transition-colors border-b-2 ${
                sidebarTab === 'pages' 
                  ? 'border-blue-500 text-blue-500 bg-neutral-900/30' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              } cursor-pointer`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5" />
                Pages ({totalPages})
              </span>
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {sidebarTab === 'tools' ? (
              <>
                {/* Add Text Tool */}
                <section className="space-y-3">
                  <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Add Text Overlay</h4>
                  
                  <button 
                    onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
                    className={`w-full py-2 px-3 border rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      activeTool === 'text'
                        ? 'bg-blue-600/10 border-blue-500 text-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                    }`}
                    id="btn-text-tool"
                  >
                    <span className="font-mono text-sm font-black select-none">T</span>
                    {activeTool === 'text' ? 'Text tool active' : 'Click to place text'}
                  </button>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-neutral-400 font-bold">Text content</label>
                    <input 
                      type="text" 
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400 font-bold">Font size</label>
                      <select 
                        value={textSize}
                        onChange={(e) => setTextSize(parseInt(e.target.value))}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-blue-500"
                      >
                        {[10, 12, 14, 16, 18, 24, 32].map(sz => (
                          <option key={sz} value={sz}>{sz} pt</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400 font-bold">Color</label>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="color" 
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="w-8 h-8 bg-transparent border-0 cursor-pointer p-0"
                        />
                        <span className="text-[10px] font-mono uppercase text-neutral-400">{textColor}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <hr className="border-neutral-800" />

                {/* Add Image Tool */}
                <section className="space-y-3">
                  <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Add Image Overlay</h4>
                  
                  <button 
                    onClick={() => setActiveTool(activeTool === 'image' ? null : 'image')}
                    className={`w-full py-2 px-3 border rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      activeTool === 'image'
                        ? 'bg-blue-600/10 border-blue-500 text-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                    }`}
                    id="btn-image-tool"
                  >
                    <ImageIcon className="w-4 h-4" />
                    {activeTool === 'image' ? 'Image tool active' : 'Place image'}
                  </button>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-neutral-400 font-bold">Upload image first</label>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="w-full py-2 px-3 border border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-900 hover:bg-neutral-900/60 text-xs font-medium text-neutral-400 hover:text-neutral-200 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Choose image file
                      <input 
                        ref={imageInputRef}
                        type="file" 
                        accept="image/png, image/jpeg, image/jpg" 
                        className="hidden" 
                        onChange={handleImageUpload}
                      />
                    </button>
                    {imageUploadUrl && (
                      <div className="flex items-center gap-2 p-1.5 bg-neutral-900 rounded-lg border border-neutral-800">
                        <img 
                          src={imageUploadUrl} 
                          alt="preview" 
                          className="w-8 h-8 object-cover rounded" 
                        />
                        <span className="text-[9px] text-neutral-400 truncate">Image loaded successfully</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-neutral-400 font-bold">Width (pixels on page)</label>
                    <input 
                      type="number" 
                      value={imageWidth}
                      onChange={(e) => setImageWidth(parseInt(e.target.value) || 100)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>
                </section>

                <hr className="border-neutral-800" />

                {/* Actions / Info */}
                <section className="space-y-3 pt-2">
                  <button
                    onClick={handleSaveAndDownload}
                    disabled={isSaving || !pdfDoc}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving to file...
                      </>
                    ) : (
                      <>
                        <FileDown className="w-4 h-4" />
                        Download PDF
                      </>
                    )}
                  </button>

                  {saveStatus && (
                    <div className={`p-3 rounded-lg border text-[11px] flex items-start gap-1.5 ${
                      saveStatus.type === 'success' 
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200' 
                        : 'bg-rose-950/40 border-rose-800 text-rose-200'
                    }`}>
                      {saveStatus.type === 'success' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <span>{saveStatus.message}</span>
                    </div>
                  )}
                </section>
              </>
            ) : (
              /* Thumbnail selection */
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Page list previews</h4>
                {pdfDoc ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => {
                      const isCur = num === pageNum;
                      const hasThumb = thumbnails[num - 1];
                      return (
                        <button
                          key={num}
                          onClick={() => setPageNum(num)}
                          className={`p-1.5 bg-neutral-900 border rounded-lg text-left flex flex-col justify-between h-32 transition-all cursor-pointer ${
                            isCur 
                              ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20' 
                              : 'border-neutral-800 hover:border-neutral-700'
                          }`}
                        >
                          {hasThumb ? (
                            <img 
                              src={hasThumb} 
                              alt={`Page ${num}`} 
                              className="w-full h-24 object-contain rounded bg-white shadow-xs"
                            />
                          ) : (
                            <div className="w-full h-24 bg-neutral-850 rounded flex items-center justify-center text-[10px] font-bold text-neutral-600">
                              Page {num}
                            </div>
                          )}
                          <div className="text-[9px] font-bold text-neutral-400 mt-1 text-center w-full">
                            Page {num}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 italic">No document loaded</p>
                )}
              </div>
            )}

          </div>
        </aside>

        {/* Main Canvas Workspace */}
        <main className="flex-1 bg-neutral-900/60 flex flex-col items-center justify-center relative overflow-auto p-8">
          
          {loading && (
            <div className="absolute inset-0 bg-neutral-900/80 z-50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm font-bold text-neutral-300">Rendering document pages...</p>
            </div>
          )}

          {!pdfDoc ? (
            /* Empty State */
            <div className="text-center p-8 max-w-sm">
              <div className="w-16 h-16 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-600 shadow-lg shadow-neutral-950/20">
                <Layers className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-neutral-200 mb-1.5">Open a PDF to get started</h3>
              <p className="text-xs text-neutral-500 leading-relaxed mb-6">
                Click "Open PDF" in the header to load any file. All rendering and annotation overlays are processed in browser memory.
              </p>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 rounded-xl text-xs font-bold text-neutral-300 hover:text-white transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                Select file
              </button>
            </div>
          ) : (
            /* Active PDF Page Frame container */
            <div 
              ref={containerRef}
              className="relative shadow-2xl border border-neutral-950 rounded bg-white"
              style={{
                width: canvasRef.current ? `${canvasRef.current.width}px` : 'auto',
                height: canvasRef.current ? `${canvasRef.current.height}px` : 'auto',
              }}
            >
              <canvas 
                ref={canvasRef} 
                id="pdf-render-canvas"
                className="rounded block"
              />
              
              {/* Overlay Interactive Annotations Layer */}
              <div 
                ref={annotationLayerRef}
                id="annotation-layer"
                onClick={handleCanvasClick}
                className={`absolute inset-0 z-10 rounded ${
                  activeTool === 'text' 
                    ? 'cursor-text' 
                    : activeTool === 'image' 
                      ? 'cursor-crosshair' 
                      : 'cursor-default'
                }`}
              >
                {currentAnnotations.map((anno) => {
                  const scaleL = anno.x * scale;
                  const scaleT = anno.y * scale;

                  return (
                    <div
                      key={anno.id}
                      onMouseDown={(e) => handleAnnotationMouseDown(e, anno.id, anno.x, anno.y)}
                      className={`absolute select-none cursor-grab group/item border ${
                        draggingId === anno.id 
                          ? 'border-blue-500 bg-blue-500/5 cursor-grabbing shadow-lg' 
                          : 'border-transparent hover:border-blue-500 hover:bg-blue-500/5'
                      }`}
                      style={{
                        left: `${scaleL}px`,
                        top: `${scaleT}px`,
                        transform: 'translate(0, 0)',
                      }}
                    >
                      {anno.type === 'text' ? (
                        <div 
                          className="font-sans whitespace-pre font-medium"
                          style={{
                            fontSize: `${(anno.fontSize || 16) * scale}px`,
                            color: anno.color,
                          }}
                        >
                          {anno.text}
                        </div>
                      ) : (
                        <img 
                          src={anno.dataUrl} 
                          alt="overlay" 
                          className="pointer-events-none block"
                          style={{
                            width: `${(anno.width || 150) * scale}px`,
                          }}
                        />
                      )}

                      {/* Double click delete helper badge */}
                      <button
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          deleteAnnotation(anno.id);
                        }}
                        className="absolute -top-3 -right-3 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity shadow-md hover:bg-rose-700 cursor-pointer"
                        title="Delete annotation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* Floating bottom save button */}
          {pdfDoc && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
              <button 
                onClick={handleSaveAndDownload}
                disabled={isSaving}
                className="w-12 h-12 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-white hover:text-blue-500 transition-all cursor-pointer"
                title="Download updated PDF file"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </button>
            </div>
          )}

        </main>

      </div>

    </div>
  );
}
