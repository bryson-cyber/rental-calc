import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Download, Maximize2 } from 'lucide-react';

interface EbookViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOTAL_PAGES = 48;
const EBOOK_TITLE = "Short-Term Rental Guide: Research, Analysis & Strategy";

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

  // Ebook page images hosted on CDN (uploaded from client/public/ebook/)
  const imageMap: {[key: number]: string} = {
    1: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/yqRZFbwdAoyvKCvB.png",
    2: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/yWypFVACeQmmlBux.png",
    3: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/rNWtnplhenEnaUoW.png",
    4: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/skHghgRcbhgUtqXO.png",
    5: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/KJbTkKDMoFfuHdsI.png",
    6: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/WvZOghygJDEWoyMH.png",
    7: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/kKQPPEbozQAzOSlM.png",
    8: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/ezICwNzqqOaSgpOS.png",
    9: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/PVomtVcEMSmVbSWn.png",
    10: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/bmqPIBbETToYYAtr.png",
    11: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/DjcBjITetsbFlDlG.png",
    12: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/LzmiFzzpIxjxdpkK.png",
    13: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/ATynMdsPGWtVPQvJ.png",
    14: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/eVDIPOWZFBGPZpUG.png",
    15: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/AGLriowxPGuGpvoZ.png",
    16: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/EnrfOHaINuxasLNT.png",
    17: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/nnGNRRZmfUSdQPaV.png",
    18: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/JvIhketyNKjPSkfl.png",
    19: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/trNCszmwkLywAyGb.png",
    20: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/wHwrDLyExlEgeNah.png",
    21: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/kLpznwsRyQKmvlWa.png",
    22: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/LlvOoUbkYdCkayWo.png",
    23: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/ksIjiGZmbzLMWpaP.png",
    24: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/rspHofgRPdwNHKRG.png",
    25: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/sAGyuGNSIfLcrSKQ.png",
    26: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/YcwwFNqhWyAVdXiO.png",
    27: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/QjBOcZvBVzJOAFTC.png",
    28: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/QxcRaqmSqhDEtMuH.png",
    29: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/zFZDiwmDsLAdjJTi.png",
    30: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/abPSboHTYvjorVgb.png",
    31: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/OBOEKMzDrkFfdzCh.png",
    32: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/yEZcwfGfJjkrGkFm.png",
    33: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/kOaWYQAgvsYUXJdZ.png",
    34: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/TqCjRpiayaWqNgpw.png",
    35: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/anbBhxFtPwQLuunh.png",
    36: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/YzNYBHDDjLZGzBSY.png",
    37: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/OTlCbhTTkAseGoPs.png",
    38: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/PAGSsrxaAdfcXpxp.png",
    39: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/MhssFnDcICptiIgE.png",
    40: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/JkUhQQGJKwkFXEkF.png",
    41: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/vrZRiffmtItTsEAV.png",
    42: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/QjLazYKLPMIKipYK.png",
    43: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/HODapQxlOWtXDZya.png",
    44: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/bIbikQSBpWsKqDjh.png",
    45: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/pGXQrEKJnsPKlXms.png",
    46: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/uMCJSrnWxhGhVFwP.png",
    47: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/yvDUsreCFEdoCvgL.png",
    48: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/TlbNrJvmnfMqFOFE.png",
  };
  const imageUrl = imageMap[currentPage] || '';

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
