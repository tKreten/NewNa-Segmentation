// src/InfoSection.js - legacy name as functionality is that of the thumnails at the top that developed from the first info section

import React from 'react';


function InfoSection({ imageHistory, currentImageId, onThumbnailClick }) {
  return (
    <div className="info-section">
      <h2>Page Catalogue</h2>
      {imageHistory.length > 0 ? (
        <div className="thumbnail-gallery">
          {imageHistory.map((imageData, index) => (
            // Wrap each thumbnail in a container to allow absolute positioning of the badge
            <div 
              key={index} 
              className="thumbnail-wrapper" 
              onClick={() => onThumbnailClick(imageData)}
            >
              <img
                src={imageData.imageUrl}
                alt={`Thumbnail ${index + 1}`}
                className={`thumbnail-image ${imageData.unsaved ? 'unsaved' : ''} ${imageData.id === currentImageId ? 'active' : ''}`}
              />
              {/* Render a red badge if the page is unsaved */}
              {imageData.unsaved && (
                <div className="unsaved-badge">
                  <span>Unsaved</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>No pages uploaded yet. Start by uploading your first page to segment.</p>
      )}
    </div>
  );
}

export default InfoSection;