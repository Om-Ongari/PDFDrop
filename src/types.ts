export type ToolType = 'merge' | 'split' | 'compress' | 'img2pdf' | 'word2pdf' | 'protect' | 'editor' | 'ppt2pdf' | 'docx2pdf' | 'extract' | 'watermark' | 'xlsx2pdf' | 'rotate' | 'txt2pdf' | 'unlock' | 'pdf2img' | 'pagenumbers';

export type CategoryType = 'all' | 'organize' | 'convert' | 'optimize' | 'security';

export interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string;
}

export interface Annotation {
  id: string;
  type: 'text' | 'image';
  x: number; // PDF point coordinates (0,0 is top-left of page in our layout mapping, converted to bottom-left on save)
  y: number;
  text?: string;
  fontSize?: number;
  color?: string;
  dataUrl?: string;
  width?: number;
  height?: number;
}

export interface PDFPageInfo {
  pageNumber: number;
  width: number;
  height: number;
}
