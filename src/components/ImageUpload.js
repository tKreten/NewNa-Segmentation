import React from 'react';

function ImageUpload({ onUpload }) {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
        onUpload(file, dimensions);
        URL.revokeObjectURL(url); 
      };

      img.src = url;
    }
  };

  return (
    <div className="image-upload">
      <label htmlFor="file-input" className="upload-label">
        <span>Upload an image to be segmented</span>
      </label>
      <input
        id="file-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
    </div>
  );
}

export default ImageUpload;