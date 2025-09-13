// src/components/MetadataSection.js

import React, { useState } from 'react';

function MetadataSection({ metadata, onUpdateMetadata }) {

  const [editable, setEditable] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState(metadata);

  if (!metadata) return null;


  const handleEditToggle = () => {
    setEditable(!editable);
    setEditedMetadata(metadata); 
  };


  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedMetadata((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  const handleSave = () => {
    onUpdateMetadata(editedMetadata);
    setEditable(false);
  };

  return (
    <div className="metadata-section">
      <h3 className="metadata-title">Metadata</h3>
      <ul className="metadata-list">
     
        <li className="fileName">
          <strong>Name:</strong>{' '}
          {editable ? (
            <input
              type="text"
              name="fileName"
              value={editedMetadata.fileName}
              onChange={handleChange}
              className="metadata-input"
            />
          ) : (
            metadata.fileName
          )}
        </li>

      
        <li className="annotator">
          <strong>Annotator:</strong>{' '}
          {editable ? (
            <input
              type="text"
              name="annotator"
              value={editedMetadata.annotator || ""}
              onChange={handleChange}
              className="metadata-input"
            />
          ) : (
            // 
            metadata.annotator || "N/A"
          )}
        </li>

        <li className="dimensions">
          <strong>Dimensions:</strong> {metadata.width} x {metadata.height} px
        </li>
      </ul>

      <div className="metadata-actions">
        <button
          className="metadata-button"
          onClick={handleEditToggle}
          aria-label={editable ? 'Cancel editing metadata' : 'Edit metadata'}
        >
          {editable ? 'Cancel' : 'Edit'}
        </button>
        {editable && (
          <button
            className="metadata-button save-button"
            onClick={handleSave}
            aria-label="Save updated metadata"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}

export default MetadataSection;