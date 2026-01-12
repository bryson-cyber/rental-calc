import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, BookOpen, CheckCircle2, ArrowRight } from 'lucide-react';
import ebookContent from '../data/ebook-content.md?raw';

interface Chapter {
  id: string;
  title: string;
  content: string;
  readTime: number;
}

// Parse the markdown content into chapters
function parseEbookContent(content: string): Chapter[] {
  const chapters: Chapter[] = [];
  const lines = content.split('\n');
  
  let currentChapter: { title: string; content: string[] } | null = null;
  
  for (const line of lines) {
    // Check for main chapter headers (# Title)
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      // Save previous chapter
      if (currentChapter) {
        const contentText = currentChapter.content.join('\n').trim();
        const wordCount = contentText.split(/\s+/).length;
        chapters.push({
          id: `chapter-${chapters.length + 1}`,
          title: currentChapter.title,
          content: contentText,
          readTime: Math.ceil(wordCount / 200), // ~200 words per minute
        });
      }
      // Start new chapter
      currentChapter = {
        title: line.replace('# ', '').trim(),
        content: [],
      };
    } else if (currentChapter) {
      currentChapter.content.push(line);
    }
  }
  
  // Save last chapter
  if (currentChapter) {
    const contentText = currentChapter.content.join('\n').trim();
    const wordCount = contentText.split(/\s+/).length;
    chapters.push({
      id: `chapter-${chapters.length + 1}`,
      title: currentChapter.title,
      content: contentText,
      readTime: Math.ceil(wordCount / 200),
    });
  }
  
  return chapters;
}

// Simple markdown renderer
function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let inList = false;
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-2 my-4 text-slate-300">
          {listItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines
    if (!line.trim()) {
      if (inList) flushList();
      continue;
    }
    
    // Headers
    if (line.startsWith('## ')) {
      if (inList) flushList();
      elements.push(
        <h3 key={i} className="text-xl font-semibold text-white mt-8 mb-4">
          {line.replace('## ', '')}
        </h3>
      );
      continue;
    }
    
    if (line.startsWith('### ')) {
      if (inList) flushList();
      elements.push(
        <h4 key={i} className="text-lg font-medium text-amber-400 mt-6 mb-3">
          {line.replace('### ', '')}
        </h4>
      );
      continue;
    }
    
    // List items
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      inList = true;
      let itemText = line.trim().replace(/^\*\s+/, '').replace(/^-\s+/, '');
      // Handle bold text
      itemText = itemText.replace(/\*\*([^*]+)\*\*/g, '$1');
      listItems.push(itemText);
      continue;
    }
    
    // Numbered list
    if (/^\d+\.\s+/.test(line.trim())) {
      if (inList) flushList();
      const match = line.trim().match(/^\d+\.\s+(.+)/);
      if (match) {
        elements.push(
          <p key={i} className="text-slate-300 my-2 pl-4">
            <span className="text-amber-400 font-medium">{line.trim().match(/^\d+/)?.[0]}.</span> {match[1]}
          </p>
        );
      }
      continue;
    }
    
    // Blockquotes
    if (line.startsWith('>')) {
      if (inList) flushList();
      elements.push(
        <blockquote key={i} className="border-l-4 border-amber-500 pl-4 my-4 italic text-slate-400">
          {line.replace(/^>\s*/, '')}
        </blockquote>
      );
      continue;
    }
    
    // Regular paragraphs
    if (inList) flushList();
    
    // Handle bold and italic text
    let text = line;
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    elements.push(
      <p 
        key={i} 
        className="text-slate-300 my-3 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }
  
  // Flush any remaining list
  flushList();
  
  return elements;
}

interface InlineEbookProps {
  onStartTools?: () => void;
}

export const InlineEbook: React.FC<InlineEbookProps> = ({ onStartTools }) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [readChapters, setReadChapters] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const parsed = parseEbookContent(ebookContent);
    setChapters(parsed);
    
    // Load read chapters from localStorage
    const saved = localStorage.getItem('rental-ebook-read');
    if (saved) {
      setReadChapters(new Set(JSON.parse(saved)));
    }
  }, []);
  
  const toggleChapter = (chapterId: string) => {
    if (expandedChapter === chapterId) {
      setExpandedChapter(null);
    } else {
      setExpandedChapter(chapterId);
      // Mark as read
      const newRead = new Set(readChapters);
      newRead.add(chapterId);
      setReadChapters(newRead);
      localStorage.setItem('rental-ebook-read', JSON.stringify(Array.from(newRead)));
    }
  };
  
  const totalReadTime = chapters.reduce((sum, ch) => sum + ch.readTime, 0);
  const readCount = readChapters.size;
  const progress = chapters.length > 0 ? Math.round((readCount / chapters.length) * 100) : 0;
  
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-teal-500/20 p-6 border-b border-slate-700/50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-1">
              Rental Riches: Your Guide to Success
            </h2>
            <p className="text-slate-400 text-sm">
              Master the mindset, strategy, and execution of successful short-term rental hosts
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{readCount}/{chapters.length} chapters read</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-amber-400">{progress}%</div>
            <div className="text-xs text-slate-500">Complete</div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-teal-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* Chapters */}
      <div className="max-h-[600px] overflow-y-auto">
        {chapters.map((chapter, index) => {
          const isExpanded = expandedChapter === chapter.id;
          const isRead = readChapters.has(chapter.id);
          
          return (
            <div key={chapter.id} className="border-b border-slate-700/50 last:border-b-0">
              {/* Chapter header */}
              <button
                onClick={() => toggleChapter(chapter.id)}
                className={`w-full p-4 flex items-center gap-4 hover:bg-slate-800/50 transition-colors text-left ${
                  isExpanded ? 'bg-slate-800/70' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isRead 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-slate-700 text-slate-400 border border-slate-600'
                }`}>
                  {isRead ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                </div>
                <div className="flex-1">
                  <h3 className={`font-medium ${isRead ? 'text-slate-300' : 'text-white'}`}>
                    {chapter.title}
                  </h3>
                  <p className="text-xs text-slate-500">{chapter.readTime} min read</p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>
              
              {/* Chapter content */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 bg-slate-800/30">
                  <div className="prose prose-invert max-w-none">
                    {renderMarkdown(chapter.content)}
                  </div>
                  
                  {/* Next chapter button */}
                  {index < chapters.length - 1 && (
                    <button
                      onClick={() => toggleChapter(chapters[index + 1].id)}
                      className="mt-6 flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <span>Next: {chapters[index + 1].title}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  
                  {/* Last chapter - CTA to tools */}
                  {index === chapters.length - 1 && onStartTools && (
                    <button
                      onClick={onStartTools}
                      className="mt-6 w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all flex items-center justify-center gap-2"
                    >
                      <span>Now Use the Tools Below</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Footer CTA */}
      {onStartTools && (
        <div className="p-4 bg-slate-800/50 border-t border-slate-700/50">
          <button
            onClick={onStartTools}
            className="w-full py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all flex items-center justify-center gap-2"
          >
            <span>Skip to Tools</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default InlineEbook;
