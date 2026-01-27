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

// Simple markdown renderer for light theme
function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let inList = false;
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-2 my-5 text-[oklch(0.40_0_0)]">
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">{item}</li>
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
        <h3 key={i} className="text-xl font-semibold text-[oklch(0.15_0_0)] mt-10 mb-4 tracking-tight">
          {line.replace('## ', '')}
        </h3>
      );
      continue;
    }
    
    if (line.startsWith('### ')) {
      if (inList) flushList();
      elements.push(
        <h4 key={i} className="text-lg font-medium text-[oklch(0.55_0.14_75)] mt-8 mb-3">
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
          <p key={i} className="text-[oklch(0.40_0_0)] my-2 pl-4">
            <span className="text-[oklch(0.55_0.14_75)] font-medium">{line.trim().match(/^\d+/)?.[0]}.</span> {match[1]}
          </p>
        );
      }
      continue;
    }
    
    // Blockquotes
    if (line.startsWith('>')) {
      if (inList) flushList();
      elements.push(
        <blockquote key={i} className="border-l-2 border-[oklch(0.55_0.14_75)]/50 pl-5 my-6 italic text-[oklch(0.50_0_0)]">
          {line.replace(/^>\s*/, '')}
        </blockquote>
      );
      continue;
    }
    
    // Regular paragraphs
    if (inList) flushList();
    
    // Handle bold and italic text
    let text = line;
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[oklch(0.20_0_0)] font-medium">$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    elements.push(
      <p 
        key={i} 
        className="text-[oklch(0.40_0_0)] my-4 leading-[1.8]"
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
  
  const readCount = readChapters.size;
  const progress = chapters.length > 0 ? Math.round((readCount / chapters.length) * 100) : 0;
  
  return (
    <div className="apple-card overflow-hidden">
      {/* Header */}
      <div className="relative p-8 md:p-10 border-b border-[oklch(0.92_0_0)]">
        <div className="relative flex items-start gap-6">
          <div className="p-4 bg-[oklch(0.55_0.14_75)] rounded-2xl glow-gold">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl md:text-3xl font-semibold text-[oklch(0.15_0_0)] mb-2">
              Short-Term Rental Guide
            </h2>
            <p className="text-[oklch(0.50_0_0)] text-lg leading-relaxed">
              Learn the research, analysis, and strategy behind informed rental decisions
            </p>
            <div className="flex items-center gap-4 mt-5">
              <div className="flex items-center gap-2 text-[oklch(0.50_0_0)] text-sm">
                <CheckCircle2 className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
                <span>{readCount}/{chapters.length} chapters read</span>
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-5xl font-semibold text-gold">{progress}%</div>
            <div className="text-xs text-[oklch(0.55_0_0)] uppercase tracking-wider mt-2">Complete</div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="relative mt-8 h-2 bg-[oklch(0.92_0_0)] rounded-full overflow-hidden">
          <div 
            className="h-full bg-[oklch(0.55_0.14_75)] transition-all duration-500 ease-out"
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
            <div key={chapter.id} className="border-b border-[oklch(0.92_0_0)] last:border-b-0">
              {/* Chapter header */}
              <button
                onClick={() => toggleChapter(chapter.id)}
                className={`w-full p-5 md:p-6 flex items-center gap-4 transition-all duration-300 text-left ${
                  isExpanded 
                    ? 'bg-[oklch(0.97_0_0)]' 
                    : 'hover:bg-[oklch(0.98_0_0)]'
                }`}
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  isRead 
                    ? 'bg-[oklch(0.55_0.14_75)]/15 text-[oklch(0.55_0.14_75)]' 
                    : 'bg-[oklch(0.94_0_0)] text-[oklch(0.50_0_0)]'
                }`}>
                  {isRead ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium text-base truncate ${isRead ? 'text-[oklch(0.50_0_0)]' : 'text-[oklch(0.20_0_0)]'}`}>
                    {chapter.title}
                  </h3>
                  <p className="text-sm text-[oklch(0.55_0_0)] mt-1">{chapter.readTime} min read</p>
                </div>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isExpanded ? 'bg-[oklch(0.92_0_0)] rotate-180' : ''
                }`}>
                  <ChevronDown className="w-5 h-5 text-[oklch(0.50_0_0)]" />
                </div>
              </button>
              
              {/* Chapter content */}
              {isExpanded && (
                <div className="px-6 md:px-10 pb-10 pt-4 bg-[oklch(0.98_0_0)]">
                  <div className="prose max-w-none">
                    {renderMarkdown(chapter.content)}
                  </div>
                  
                  {/* Next chapter button */}
                  {index < chapters.length - 1 && (
                    <button
                      onClick={() => toggleChapter(chapters[index + 1].id)}
                      className="mt-10 flex items-center gap-2 text-gold hover:text-[oklch(0.50_0.14_75)] transition-colors font-medium"
                    >
                      <span>Next: {chapters[index + 1].title}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  
                  {/* Last chapter - CTA to tools */}
                  {index === chapters.length - 1 && onStartTools && (
                    <button
                      onClick={onStartTools}
                      className="btn-gold w-full mt-10 flex items-center justify-center gap-2"
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
        <div className="p-5 md:p-6 bg-[oklch(0.97_0_0)] border-t border-[oklch(0.92_0_0)]">
          <button
            onClick={onStartTools}
            className="btn-gold-outline w-full flex items-center justify-center gap-2"
          >
            <span>Skip to Tools</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
