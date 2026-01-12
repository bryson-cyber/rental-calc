import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Download, Maximize2 } from 'lucide-react';

interface EbookViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOTAL_PAGES = 48;
const EBOOK_TITLE = "Rental Riches: Master Short-Term Rentals for Long-Term Wealth";

export const EbookViewer: React.FC<EbookViewerProps> = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
    setImageLoaded(false);
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(TOTAL_PAGES, prev + 1));
    setImageLoaded(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowLeft') handlePrevPage();
    if (e.key === 'ArrowRight') handleNextPage();
    if (e.key === 'Escape') onClose();
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentPage]);

  if (!isOpen) return null;

  // Get the correct image name from the available ebook images
  const imageMap: {[key: number]: string} = {
    1: 'image2-33.png',
    2: 'image3-35.png',
    3: 'image4-37.png',
    4: 'image5-39.png',
    5: 'image6-41.png',
    6: 'image7-43.png',
    7: 'image8-45.png',
    8: 'image9-47.png',
    9: 'image10-49.png',
    10: 'image11-51.png',
    11: 'image12-53.png',
    12: 'image13-55.png',
    13: 'image14-57.png',
    14: 'image15-59.png',
    15: 'image16-61.png',
    16: 'image17-63.png',
    17: 'image18-65.png',
    18: 'image19-67.png',
    19: 'image20-69.png',
    20: 'image21-71.png',
    21: 'image22-73.png',
    22: 'image23-75.png',
    23: 'image24-77.png',
    24: 'image25-79.png',
    25: 'image26-81.png',
    26: 'image27-83.png',
    27: 'image28-85.png',
    28: 'image29-87.png',
    29: 'image30-89.png',
    30: 'image31-91.png',
    31: 'image32-93.png',
    32: 'image33-95.png',
    33: 'image34-97.png',
    34: 'image35-99.png',
    35: 'image36-101.png',
    36: 'image37-103.png',
    37: 'image38-105.png',
    38: 'image39-107.png',
    39: 'image40-109.png',
    40: 'image41-111.png',
    41: 'image42-113.png',
    42: 'image43-115.png',
    43: 'image44-117.png',
    44: 'image45-119.png',
    45: 'image46-121.png',
    46: 'image47-123.png',
    47: 'image48-125.png',
    48: 'image49-127.png',
  };
  const imageName = imageMap[currentPage] || `image${currentPage + 1}-${(currentPage + 1) * 2 - 1}.png`;
  const imageUrl = `/ebook/${imageName}`;

  const containerClass = isFullscreen 
    ? 'fixed inset-0 z-50 bg-black' 
    : 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4';

  return (
    <div className={containerClass}>
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        aria-label="Close ebook"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Main Viewer */}
      <div className={isFullscreen ? 'w-full h-full flex flex-col' : 'w-full max-w-4xl h-auto'}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{EBOOK_TITLE}</h2>
            <p className="text-sm opacity-90">Page {currentPage} of {TOTAL_PAGES}</p>
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-white/20 rounded transition-colors"
            aria-label="Toggle fullscreen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Image Container */}
        <div className={`flex-1 bg-black flex items-center justify-center overflow-hidden ${isFullscreen ? 'h-screen' : 'min-h-96'}`}>
          <img
            src={imageUrl}
            alt={`Page ${currentPage}`}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />
          {!imageLoaded && (
            <div className="text-white/50">Loading page...</div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gray-900 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          {/* Page Input */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max={TOTAL_PAGES}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= TOTAL_PAGES) {
                  setCurrentPage(page);
                  setImageLoaded(false);
                }
              }}
              className="w-16 px-2 py-2 bg-gray-800 text-white text-center rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
            <span className="text-gray-400">/ {TOTAL_PAGES}</span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage === TOTAL_PAGES}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Footer Info */}
        <div className="bg-gray-950 px-6 py-3 text-gray-400 text-sm text-center border-t border-gray-800">
          Use arrow keys to navigate • Press Escape to close
        </div>
      </div>
    </div>
  );
};
