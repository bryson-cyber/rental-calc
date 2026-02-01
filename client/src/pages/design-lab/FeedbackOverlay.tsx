/**
 * FeedbackOverlay - Interactive feedback collection for Design Lab
 * 
 * Allows users to click on elements and leave comments,
 * then export all feedback as structured markdown.
 */

import { useState, useCallback, useEffect } from 'react';
import { MessageSquare, X, Send, Copy, Check } from 'lucide-react';

interface Comment {
  id: string;
  variant: string;
  selector: string;
  elementDescription: string;
  text: string;
  position: { x: number; y: number };
}

interface FeedbackOverlayProps {
  targetName: string;
}

export function FeedbackOverlay({ targetName }: FeedbackOverlayProps) {
  const [isActive, setIsActive] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeComment, setActiveComment] = useState<{
    position: { x: number; y: number };
    variant: string;
    selector: string;
    elementDescription: string;
  } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [overallDirection, setOverallDirection] = useState('');
  const [copied, setCopied] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Handle element click when feedback mode is active
  const handleElementClick = useCallback((e: MouseEvent) => {
    if (!isActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target as HTMLElement;
    
    // Find the variant container
    const variantContainer = target.closest('[data-variant]');
    const variant = variantContainer?.getAttribute('data-variant') || 'Unknown';
    
    // Generate selector
    const selector = target.id 
      ? `#${target.id}`
      : target.className 
        ? `.${target.className.split(' ')[0]}`
        : target.tagName.toLowerCase();
    
    // Generate description
    const textContent = target.textContent?.slice(0, 30) || '';
    const elementDescription = `${target.tagName.toLowerCase()}${textContent ? ` with "${textContent}..."` : ''}`;
    
    setActiveComment({
      position: { x: e.clientX, y: e.clientY },
      variant,
      selector,
      elementDescription
    });
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      document.addEventListener('click', handleElementClick, true);
      document.body.style.cursor = 'crosshair';
    } else {
      document.removeEventListener('click', handleElementClick, true);
      document.body.style.cursor = '';
    }
    
    return () => {
      document.removeEventListener('click', handleElementClick, true);
      document.body.style.cursor = '';
    };
  }, [isActive, handleElementClick]);

  const addComment = () => {
    if (!activeComment || !commentText.trim()) return;
    
    const newComment: Comment = {
      id: Date.now().toString(),
      variant: activeComment.variant,
      selector: activeComment.selector,
      elementDescription: activeComment.elementDescription,
      text: commentText.trim(),
      position: activeComment.position
    };
    
    setComments(prev => [...prev, newComment]);
    setCommentText('');
    setActiveComment(null);
  };

  const generateMarkdown = () => {
    const grouped = comments.reduce((acc, comment) => {
      if (!acc[comment.variant]) acc[comment.variant] = [];
      acc[comment.variant].push(comment);
      return acc;
    }, {} as Record<string, Comment[]>);

    let md = `## Design Lab Feedback\n\n`;
    md += `**Target:** ${targetName}\n`;
    md += `**Comments:** ${comments.length}\n\n`;

    Object.entries(grouped).forEach(([variant, variantComments]) => {
      md += `### Variant ${variant}\n`;
      variantComments.forEach((comment, i) => {
        md += `${i + 1}. **${comment.elementDescription}** (\`${comment.selector}\`)\n`;
        md += `   "${comment.text}"\n\n`;
      });
    });

    md += `### Overall Direction\n${overallDirection || '(Not provided)'}\n`;

    return md;
  };

  const copyFeedback = () => {
    const md = generateMarkdown();
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Export Panel */}
        {showExport && (
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-96 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Export Feedback</h3>
              <button 
                onClick={() => setShowExport(false)}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overall Direction (required)
              </label>
              <textarea
                value={overallDirection}
                onChange={(e) => setOverallDirection(e.target.value)}
                placeholder="Which variant wins? What should change?"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none h-24 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600">
                <strong>{comments.length}</strong> comments collected
              </p>
            </div>
            
            <button
              onClick={copyFeedback}
              disabled={!overallDirection.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Feedback
                </>
              )}
            </button>
            
            <p className="text-xs text-gray-400 text-center mt-3">
              Paste this in the chat to submit your feedback
            </p>
          </div>
        )}
        
        {/* Comment Count Badge */}
        {comments.length > 0 && !showExport && (
          <button
            onClick={() => setShowExport(true)}
            className="bg-amber-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:bg-amber-600 transition-colors"
          >
            {comments.length} comment{comments.length !== 1 ? 's' : ''} · Submit
          </button>
        )}
        
        {/* Main Toggle Button */}
        <button
          onClick={() => {
            setIsActive(!isActive);
            if (isActive) setActiveComment(null);
          }}
          className={`p-4 rounded-full shadow-lg transition-all ${
            isActive 
              ? 'bg-amber-500 text-white scale-110' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <MessageSquare className="w-6 h-6" />
        </button>
        
        {isActive && (
          <p className="text-xs text-gray-500 bg-white px-3 py-1.5 rounded-full shadow-sm">
            Click any element to comment
          </p>
        )}
      </div>

      {/* Comment Input Popup */}
      {activeComment && (
        <div 
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-72 animate-in zoom-in-95 duration-200"
          style={{
            left: Math.min(activeComment.position.x, window.innerWidth - 300),
            top: Math.min(activeComment.position.y + 10, window.innerHeight - 200)
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
              Variant {activeComment.variant}
            </span>
            <button 
              onClick={() => setActiveComment(null)}
              className="p-1 rounded hover:bg-gray-100"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mb-2 truncate">
            {activeComment.elementDescription}
          </p>
          
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="What should change?"
            className="w-full p-2 border border-gray-200 rounded-lg text-sm resize-none h-20 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            autoFocus
          />
          
          <button
            onClick={addComment}
            disabled={!commentText.trim()}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            Save Comment
          </button>
        </div>
      )}

      {/* Comment Markers */}
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="fixed w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg cursor-pointer hover:scale-110 transition-transform z-40"
          style={{
            left: comment.position.x - 12,
            top: comment.position.y - 12
          }}
          title={comment.text}
        >
          {comments.indexOf(comment) + 1}
        </div>
      ))}
    </>
  );
}
