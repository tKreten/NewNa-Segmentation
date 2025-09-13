// Import React, necessary hooks, and external libraries/components
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios'; // Used for HTTP requests to the backend server
import SegmentationViewer from './components/SegmentationViewer'; // Displays the segmentation results
import InfoSection from './components/InfoSection'; // Displays the page history/thumbnails
import MetadataSection from './components/MetadataSection'; // Displays and allows editing of image metadata
import { saveAs } from 'file-saver'; // Used to save files (e.g., JSON, ZIP)
import JSZip from 'jszip'; // Used to create ZIP archives (e.g., for segmentation images)
import './App.css';

function App() {
  // STATE VARIABLES
  // These state variables manage the app's UI modes, uploaded image, predictions,
  // annotations, metadata, and various UI flags.
  
  // Determines if the app is in "Database Mode" (saving to DB) or "Upload Only Mode"
  const [isDatabaseMode, setIsDatabaseMode] = useState(false);
  // Indicates whether the selected mode has been confirmed by the user
  const [modeConfirmed, setModeConfirmed] = useState(false);
  // Stores the URL (blob) of the uploaded image
  const [uploadedImage, setUploadedImage] = useState(null);
  // Contains the current predictions (bounding boxes) received from the backend
  const [predictions, setPredictions] = useState([]);
  // Stores ground truth annotations if loaded from the database (Database Mode)
  const [groundTruthAnnotations, setGroundTruthAnnotations] = useState([]);
  // Toggles the display of ground truth annotations on the segmentation viewer
  const [showGroundTruth, setShowGroundTruth] = useState(false);
  // Stores feedback messages (errors, success messages) for the user
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  // Flag to indicate if a file is currently being uploaded (for spinner display)
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  // Loading flag to show a spinner overlay during asynchronous operations
  const [loading, setLoading] = useState(false);
  // Unique ID for the current image (used to update the image history)
  const [currentImageId, setCurrentImageId] = useState(null);
  // Stores all bounding boxes (both from backend predictions and user modifications)
  const [allBoxes, setAllBoxes] = useState([]);
  // Maintains a history of uploaded images along with their associated data (for thumbnail display)
  const [imageHistory, setImageHistory] = useState([]);
  // Stores metadata of the current image (e.g., file name, dimensions, upload time)
  const [metadata, setMetadata] = useState(null);
  // Filter category to display a subset of bounding boxes (or show all)
  const [filterCategory, setFilterCategory] = useState('all');
  // Toggles the display of the info section (the page overview with thumbnails)
  const [showInfo, setShowInfo] = useState(false);
  // Flag to manage the transition effect when changing pages
  const [transitioning, setTransitioning] = useState(false);
  // Toggles the instructions modal that explains how to use the app
  const [showInstructions, setShowInstructions] = useState(false);
  // Controls the expanded state of the floating info button (top-left)
  const [floatingExpanded, setFloatingExpanded] = useState(false);
  // Controls the display of the "Clear All Boxes" confirmation modal
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  // REFS 
  // Refs allow us to directly interact with DOM elements.
  // Here we use them to trigger file input clicks and to obtain image dimensions.
  const fileInputRef = useRef(null); // Ref for the "Upload New Page" button input
  const imgRef = useRef(null);       // Ref for the image element used in segmentation

  // IMAGE HISTORY UPDATE
  // Problem: When the user modifies bounding boxes, we need to ensure that these changes
  // are saved in the image history. Otherwise, if the user navigates away, their work would be lost.
  // Solution: Use a useEffect that watches "allBoxes" and "currentImageId" and updates the corresponding
  // entry in the imageHistory array.
  useEffect(() => {
    if (currentImageId) {
      setImageHistory(prev =>
        prev.map(img =>
          img.id === currentImageId ? { ...img, predictions: allBoxes } : img
        )
      );
    }
  }, [allBoxes, currentImageId]);

  // IMAGE UPLOAD & SEGMENTATION
  // Function to handle image upload, send it to the backend for segmentation, and process the response.
  const handleImageUpload = async (file) => {
    if (!file) return;
    // Set loading and upload flags for user feedback.
    setIsUploadingFile(true);
    setLoading(true);
    // Create a FormData object to send the file and the current mode to the backend.
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', isDatabaseMode ? 'database' : 'upload_only');
    // Generate a local URL (blob URL) for the uploaded image to display it.
    const imageUrl = URL.createObjectURL(file);
    try {
      // Send the image to the backend endpoint "/segment" for processing.
      const response = await axios.post('http://127.0.0.1:5000/segment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // If the backend returns predictions, process them.
      if (response.data && response.data.predictions) {
        const img = new Image();
        // Wait for the image to load to obtain its dimensions.
        img.onload = () => {
          const uploadDate = new Date().toLocaleString();
          const finalFileName = response.data.predictions[0].file_name;
          // Process each prediction by converting bbox array [x1,y1,x2,y2] into an object with x, y, width, height.
          const processedPredictions = response.data.predictions.map((pred, idx) => ({
            id: pred.image_id ? `pred-${pred.image_id}` : `${Date.now()}-${idx}`,
            category_id: pred.category_id,
            x: pred.bbox[0],
            y: pred.bbox[1],
            width: pred.bbox[2] - pred.bbox[0],
            height: pred.bbox[3] - pred.bbox[1],
            isBackend: true, // Indicates that these boxes came from the backend.
            file_name: pred.file_name,
          }));
          // Update state with the predictions.
          setPredictions(processedPredictions);
          setAllBoxes(processedPredictions);
          // Generate a unique ID for the image (used in the image history).
          const newImageId = Date.now().toString();
          setCurrentImageId(newImageId);
          // Add a sequential box number for each prediction (optional).
          const numberedPredictions = processedPredictions.map((p, i) => ({
            ...p,
            boxNumber: i
          }));
          // Build an image history object to store the image along with its predictions and metadata.
          const newImageData = {
            id: newImageId,
            imageUrl,
            predictions: numberedPredictions,
            unsaved: true, // Flag to indicate that the page is not yet saved (for unsaved badge)
            width: img.width,
            height: img.height,
            metadata: {
              fileName: finalFileName,
              uploadDate,
              width: img.width,
              height: img.height,
            },
          };
          // Update the state with the new image data.
          setUploadedImage(imageUrl);
          setImageHistory(prev => [...prev, newImageData]);
          setMetadata({
            fileName: finalFileName,
            uploadDate,
            width: img.width,
            height: img.height,
          });
          // Provide user feedback for a successful upload.
          setFeedbackMessage({
            type: 'success',
            message: response.data.message || 'Image uploaded successfully',
          });
          // In Database Mode, if the image exists, load its ground truth annotations.
          if (isDatabaseMode && response.data.message === "Image exists. Retrieved annotations.") {
            const rawRows = response.data.predictions;
            const gts = rawRows.map((ann, i) => {
              // Ensure bbox is an array (parse JSON if necessary)
              let bboxArr = Array.isArray(ann.bbox) ? ann.bbox : JSON.parse(ann.bbox || "[]");
              const w = bboxArr[2] - bboxArr[0];
              const h = bboxArr[3] - bboxArr[1];
              return {
                id: `gt-${ann.id || i}`,
                category_id: ann.category_id,
                x: bboxArr[0],
                y: bboxArr[1],
                width: w,
                height: h,
                isBackend: false,
                isGroundTruth: true, // Marks these boxes as ground truth
                file_name: ann.file_name,
              };
            });
            setGroundTruthAnnotations(gts);
            setFeedbackMessage({
              type: 'success',
              message: 'Ground truth annotations loaded from Database',
            });
          }
        };
        // Set the image source to trigger the onload event.
        img.src = imageUrl;
      } else if (response.data && response.data.error) {
        // Handle errors returned from the backend.
        setFeedbackMessage({ type: 'error', message: response.data.error });
      } else {
        // Handle unexpected cases where no predictions are received.
        setFeedbackMessage({ type: 'error', message: 'No predictions received from the backend.' });
      }
    } catch (error) {
      // Log errors to the console and show a user-friendly message.
      console.error('Error uploading image:', error);
      setFeedbackMessage({ type: 'error', message: 'An error occurred while uploading the image.' });
    } finally {
      // Always reset the loading states, whether the operation succeeded or failed.
      setIsUploadingFile(false);
      setLoading(false);
    }
  };

  // SAVE ANNOTATIONS AS JSON
  // Function to save the current annotations as a JSON file for local backup.
  const saveAnnotations = () => {
    // Check that there are bounding boxes and metadata to save.
    if (!allBoxes.length) {
      setFeedbackMessage({ type: 'error', message: 'No bounding boxes to save.' });
      return;
    }
    if (!metadata) {
      setFeedbackMessage({ type: 'error', message: 'No metadata for page.' });
      return;
    }
    // Build a JSON object with annotations.
    const dbJson = { annotations: [] };
    const pageArea = (metadata.width || 1) * (metadata.height || 1);
    // For each box, calculate the area percentage and include size as an array.
    allBoxes.forEach((box) => {
      const boxArea = box.width * box.height;
      const percentPage = boxArea / pageArea;
      dbJson.annotations.push({
        image_id: box.id,
        category_id: box.category_id,
        bbox: [box.x, box.y, box.x + box.width, box.y + box.height],
        file_name: box.file_name,
        size: [box.width, box.height],
        percent_page: percentPage,
      });
    });
    // Create a Blob from the JSON and trigger a download.
    const blob = new Blob([JSON.stringify(dbJson, null, 2)], { type: 'application/json' });
    saveAs(blob, 'annotations.json');
    setFeedbackMessage({ type: 'success', message: 'Annotations saved as JSON' });
    // Mark the current page as saved (removing the "unsaved" badge).
    setImageHistory(prev => prev.map(img => img.id === currentImageId ? { ...img, unsaved: false } : img));
  };

  // SAVE SEGMENTATIONS AS PNGs IN ZIP
  // Function to extract segmented image parts from the original image and package them in a ZIP file.
  const saveSegmentations = () => {
    if (!uploadedImage || !allBoxes.length) {
      setFeedbackMessage({ type: 'error', message: 'No segmentations to save.' });
      return;
    }
    const img = new Image();
    img.src = uploadedImage;
    img.onload = () => {
      const zip = new JSZip();
      let processedCount = 0;
      const totalBoxes = allBoxes.length;
      // Helper function to check if all boxes have been processed before generating the ZIP.
      const checkIfAllProcessed = () => {
        processedCount++;
        if (processedCount === totalBoxes) {
          zip.generateAsync({ type: 'blob' }).then((content) => {
            saveAs(content, 'segmentations.zip');
            setFeedbackMessage({ type: 'success', message: 'Segmentations saved successfully!' });
          });
        }
      };
      // Process each box: create a canvas to crop out the box area from the image.
      allBoxes.forEach((box, idx) => {
        const { x, y, width, height, file_name } = box;
        // Validate dimensions to prevent errors (skip if invalid)
        if (width <= 0 || height <= 0) {
          console.warn(`Skipping box ${idx + 1} => invalid dims`);
          checkIfAllProcessed();
          return;
        }
        try {
          // Create a canvas element to draw the extracted image segment.
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(width);
          canvas.height = Math.ceil(height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error(`No canvas context for box ${idx + 1}`);
            checkIfAllProcessed();
            return;
          }
          // Draw the selected segment onto the canvas.
          ctx.drawImage(
            img,
            x, y, width, height,
            0, 0, canvas.width, canvas.height
          );
          // Convert the canvas content to a PNG blob.
          canvas.toBlob((blob) => {
            if (blob) {
              // Extract the original file name from the file path.
              const pathParts = file_name.split('/');
              const originalFile = pathParts.pop() || 'box.png';
              // Generate a unique file name and ensure it ends with ".png"
              let uniqueFileName = `${idx}_${originalFile}`;
              if (!uniqueFileName.toLowerCase().endsWith('.png')) {
                uniqueFileName += '.png';
              }
              // Organize files into folders matching the original file path.
              const folder = zip.folder(pathParts.join('/'));
              if (folder) {
                folder.file(uniqueFileName, blob);
              }
            }
            checkIfAllProcessed();
          }, 'image/png');
        } catch (err) {
          console.error(`Error with box ${idx + 1}:`, err);
          checkIfAllProcessed();
        }
      });
    };
    img.onerror = (err) => {
      console.error('Image load fail:', err);
      setFeedbackMessage({ type: 'error', message: 'Failed to load image for segmentation.' });
    };
  };

  // SAVE ANNOTATIONS TO DATABASE 
  // Function to save the current page's annotations to the database in Database Mode.
  // Problem: Ensure that the correct width and height values are stored.
  // Solution: We explicitly pass the width and height from each box (which are non-zero)
  // in the payload sent to the backend.
  const handleSaveToDB = async () => {
    if (!isDatabaseMode) {
      setFeedbackMessage({ type: 'error', message: 'Not in Database Mode!' });
      return;
    }
    if (!allBoxes.length) {
      setFeedbackMessage({ type: 'error', message: 'No boxes to save.' });
      return;
    }
    if (!metadata) {
      setFeedbackMessage({ type: 'error', message: 'No metadata for page.' });
      return;
    }
    const pageArea = (metadata.width || 1) * (metadata.height || 1);
    // Build annotation payload for each box, including explicit width and height.
    const annData = allBoxes.map((box) => {
      const boxArea = box.width * box.height;
      const percentPage = boxArea / pageArea;
      return {
        category_id: box.category_id,
        bbox: [box.x, box.y, box.x + box.width, box.y + box.height],
        width: box.width,      // Explicit width for database storage
        height: box.height,    // Explicit height for database storage
        file_name: box.file_name,
        percent_page: percentPage
      };
    });
    try {
      // POST the annotation data to the backend "/save" endpoint.
      const res = await axios.post('http://127.0.0.1:5000/save', {
        file_name: annData[0].file_name,
        annotations: annData
      });
      if (res.data && res.data.error) {
        setFeedbackMessage({ type: 'error', message: res.data.error });
      } else {
        setFeedbackMessage({
          type: 'success',
          message: res.data.message || 'Annotations saved to DB!',
        });
        // Mark the current page as saved (unsaved flag set to false)
        setImageHistory(prev =>
          prev.map(img =>
            img.id === currentImageId ? { ...img, unsaved: false } : img
          )
        );
      }
    } catch (err) {
      console.error('Error saving to DB:', err);
      setFeedbackMessage({ type: 'error', message: 'Could not save to DB.' });
    }
  };

  // SAVE ALL PAGES TO DATABASE
  // Function to save multiple pages and their annotations to the database.
  // It expects a payload with arrays of images and annotations.
  // Similar to the single save, we ensure that the width/height from the "size" field are used.
  const handleSaveAllPages = async () => {
    if (!isDatabaseMode) {
      setFeedbackMessage({ type: 'error', message: 'Not in Database Mode!' });
      return;
    }
    if (!allBoxes.length) {
      setFeedbackMessage({ type: 'error', message: 'No boxes to save.' });
      return;
    }
    if (!metadata) {
      setFeedbackMessage({ type: 'error', message: 'No metadata for page.' });
      return;
    }
    // Prepare image data; here only one image is processed.
    const images = [
      {
        file_name: metadata.fileName,
        width: metadata.width || 0,
        height: metadata.height || 0,
        year: "1899",
        nr: "32"
      }
    ];
    const pageArea = (metadata.width || 1) * (metadata.height || 1);
    // Build annotations payload, including "size" as an array.
    const annotations = allBoxes.map((box) => {
      const boxArea = box.width * box.height;
      const percentPage = boxArea / pageArea;
      return {
        image_id: 0, // This will be mapped to the correct page ID on the backend.
        category_id: box.category_id,
        bbox: [box.x, box.y, box.x + box.width, box.y + box.height],
        file_name: box.file_name,
        size: [box.width, box.height],
        percent_page: percentPage
      };
    });
    try {
      const payload = { images, annotations };
      // POST the data to the backend "/save_all" endpoint.
      const res = await axios.post("http://127.0.0.1:5000/save_all", payload);
      if (res.data && res.data.error) {
        setFeedbackMessage({ type: 'error', message: res.data.error });
      } else {
        setFeedbackMessage({
          type: 'success',
          message: res.data.message
        });
      }
    } catch (err) {
      console.error('Error saving pages+boxes:', err);
      setFeedbackMessage({ type: 'error', message: 'Could not save pages/boxes to DB.' });
    }
  };

  // THUMBNAIL CLICK HANDLER
  // Function to handle when a thumbnail (from the image history) is clicked.
  // Problem: When switching pages, the displayed image and its annotations must update smoothly.
  // Solution: Use a short timeout and transition flag to animate the change.
  const handleThumbnailClick = (imageData) => {
    if (currentImageId === imageData.id) return; // Do nothing if the image is already active
    setTransitioning(true);
    // Delay the switch slightly to allow a transition effect
    setTimeout(() => {
      const targetImage = imageHistory.find(img => img.id === imageData.id);
      setUploadedImage(imageData.imageUrl);
      setAllBoxes(targetImage ? targetImage.predictions : imageData.predictions);
      setCurrentImageId(imageData.id);
      setGroundTruthAnnotations([]); // Reset ground truth annotations when switching pages
      setShowGroundTruth(false);
      setMetadata(imageData.metadata);
      setTransitioning(false);
    }, 300);
  };

  // UPDATE METADATA
  // Function to update the metadata of the current image.
  // It also updates the image history to ensure consistency.
  const updateMetadata = (updated) => {
    setMetadata(updated);
    setImageHistory(prev =>
      prev.map(img =>
        img.id === currentImageId ? { ...img, metadata: updated } : img
      )
    );
  };

  // CLEAR BOXES HANDLERS
  // Handler to open the confirmation modal before clearing all boxes.
  const handleClearAllBoxes = () => {
    setShowClearConfirmation(true);
  };

  // Function to confirm clearing all boxes with a fade-out effect.
  const confirmClearAllBoxes = () => {
    // Apply a fade-out effect by marking each box with "fadeOut"
    setAllBoxes(prev => prev.map(b => ({ ...b, fadeOut: true })));
    setShowClearConfirmation(false);
    // After 1 second (matching the CSS fade-out transition), clear all boxes.
    setTimeout(() => {
      setAllBoxes([]);
    }, 1000);
  };

  // Function to cancel the clearing of boxes (dismiss the modal).
  const cancelClearAllBoxes = () => {
    setShowClearConfirmation(false);
  };

  // FEEDBACK AUTO-HIDE
  // Automatically hides success feedback messages after 3 seconds.
  useEffect(() => {
    if (feedbackMessage && feedbackMessage.type === 'success') {
      const timer = setTimeout(() => {
        setFeedbackMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // RENDERING THE APP
  return (
    <div className="App">
      {loading && (
        // Display a spinner overlay while loading is active.
        <div className="spinner-overlay">
          <div className="spinner"></div>
        </div>
      )}
      {feedbackMessage && (
        // Show feedback messages (success or error) to the user.
        <div className={`feedback-message ${feedbackMessage.type}`}
          onClick={feedbackMessage.type === 'error' ? () => setFeedbackMessage(null) : undefined}
          role={feedbackMessage.type === 'error' ? 'alert' : 'status'}
        >
          {feedbackMessage.type === 'error' && <span role="img" aria-label="Error">╳ </span>}
          {feedbackMessage.type === 'success' && <span role="img" aria-label="Success">✓ </span>}
          {feedbackMessage.message}
        </div>
      )}

      {/* FLOATING INFO BUTTON */}
      {/* Displays additional app information when expanded. */}
      <div className={`floating-info-container ${floatingExpanded ? 'expanded' : ''}`}>
        <button className="floating-info-button" onClick={() => setFloatingExpanded(prev => !prev)}>
          ℹ
        </button>
        {floatingExpanded && (
          <div className="floating-info-content">
            <h3>About NewNa Segmentation</h3>
            <p>This app allows you to segment magazine pages and interact with them dynamically.
            Draw, edit, or delete bounding boxes, and save your work either locally or to a database.</p>
            <p>
              This project is developed by Tobias Kreten and Svend Göke under the supervision of Johanna Störiko.
            </p>
          </div>
        )}
      </div>

      {/* PAGE OVERVIEW (THUMBNAILS) */}
      <div className={`show-pages-container ${modeConfirmed ? 'show-pages-visible' : ''}`}>
        <button className="toggle-info-button" onClick={() => setShowInfo(!showInfo)}>
          <span>{showInfo ? 'Hide Pages' : 'Show Pages'}</span>
        </button>
      </div>
      {/* InfoSection displays the history of uploaded pages as thumbnails */}
      <div className={`info-section-container ${showInfo ? 'expanded' : ''}`}>
        <InfoSection imageHistory={imageHistory} onThumbnailClick={handleThumbnailClick} />
      </div>

      {/*  UPLOAD / ANNOTATION PAGE */}
      {/* If no image is uploaded or no predictions exist, show the upload landing page. */}
      {!uploadedImage || !predictions.length ? (
        <div className="upload-page">
          <h3>NewNa</h3>
          <h1>SEGMENTATION APP</h1>
          <h2>An app to segment and dynamically interact with magazine pages</h2>
          <div className={`landing-interaction ${modeConfirmed ? 'mode-confirmed' : ''}`}>
            <div className="mode-selection-section">
              {/* Toggle between Database Mode and Upload Only Mode */}
              <label className="initial-mode-toggle-label">
                <input
                  type="checkbox"
                  checked={isDatabaseMode}
                  onChange={(e) => {
                    setIsDatabaseMode(e.target.checked);
                    setShowGroundTruth(false);
                    setGroundTruthAnnotations([]);
                  }}
                />
                <span className="mode-label-text">{isDatabaseMode ? 'Database Mode' : 'Upload Only Mode'}</span>
              </label>
              <div className="initial-mode-description-box">
                <p className="mode-description">
                  {isDatabaseMode
                    ? 'In Database Mode, bounding boxes can be saved & retrieved from MySQL.'
                    : 'In Upload Only Mode, everything is local to this browser session.'
                  }
                </p>
              </div>
              <button className="confirm-mode-button" onClick={() => setModeConfirmed(true)}>
                Confirm Mode
              </button>
            </div>
            <div className="image-upload">
              {/* The upload label text is forced to be on one line via CSS */}
              <label htmlFor="imageUpload" className="upload-label">
                <span>Upload an image to be segmented</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="file"
                  id="imageUpload"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files[0])}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Display the annotation page when an image is uploaded and predictions exist.
        <div className={`annotation-page ${transitioning ? 'fading' : ''}`} style={{ backgroundColor: 'rgba(40, 40, 40, 0.4)', borderRadius: '50px', padding: '50px' }}>
          <div className="sidebar left-sidebar">
            {/* Instruction modal for user guidance */}
            <div className="instruction-container">
              <button className="instruction-button" onClick={() => setShowInstructions(prev => !prev)}>
                Instructions
              </button>
              {showInstructions && (
                <div className="instruction-modal">
                  <button className="close-button" onClick={() => setShowInstructions(false)}>×</button>
                  <h2>How to use</h2>
                  <p>
                    - Upload an image to begin segmentation<br />
                    - Click and drag to draw bounding boxes<br />
                    - Click a box to edit or delete it<br />
                    - Use the category legend to filter boxes<br />
                    - You can directly draw a new box for a specific category when in the filtered view<br />
                    - Flip through your uploaded pages by hovering over the thumbnails at the top<br />
                    - Save your annotations using the provided buttons
                  </p>
                </div>
              )}
            </div>
            {/* "Upload New Page" button for quickly adding another page */}
            <div className="upload-new-container">
              <button className="upload-new-button" onClick={() => fileInputRef.current.click()}>
                Upload New Page
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={(e) => handleImageUpload(e.target.files[0])}
              />
            </div>
            {/* Back button to return to the landing page */}
            <div className="back-button-container">
              <button className="back-button" onClick={() => {
                setUploadedImage(null);
                setCurrentImageId(null);
                setGroundTruthAnnotations([]);
                setShowGroundTruth(false);
                setMetadata(null);
                setAllBoxes([]);
              }}>
                ← Overview
              </button>
            </div>
          </div>
          {/* The main segmentation viewer that displays the image and bounding boxes */}
          <div className="segmentation-viewer-container">
            <SegmentationViewer
              image={uploadedImage}
              imageId={currentImageId}
              filterCategory={filterCategory}
              imgRef={imgRef}
              allBoxes={allBoxes}
              setAllBoxes={setAllBoxes}
              metadata={metadata} 
            />
          </div>
          <div className="sidebar right-sidebar">
            {/* Component to display and edit image metadata */}
            <MetadataSection metadata={metadata} onUpdateMetadata={updateMetadata} />
            {/* Category legend: shows different categories and lets users filter bounding boxes */}
            <div className="category-legend">
              <h3>Category Key</h3>
              <ul className="legend-list">
                {[
                  { id: 0, name: 'Photograph', color: 'rgba(58,68,102,0.4)' },
                  { id: 1, name: 'Illustration', color: 'rgba(178,57,48,0.4)' },
                  { id: 2, name: 'Map', color: 'rgba(47,115,84,0.4)' },
                  { id: 3, name: 'Comic/Cartoon', color: 'rgba(216,172,82,0.4)' },
                  { id: 4, name: 'Editorial Cartoon', color: 'rgba(112,72,145,0.4)' },
                  { id: 5, name: 'Headline', color: 'rgba(66,113,161,0.4)' },
                  { id: 6, name: 'Advertisement', color: 'rgba(189,87,38,0.4)' },
                ].map((cat) => (
                  <li
                    key={cat.id}
                    className={`legend-item ${parseInt(filterCategory, 10) === cat.id ? 'active' : ''}`}
                    onClick={() => setFilterCategory(cat.id.toString())}
                  >
                    <span className="legend-color-box" style={{
                      backgroundColor: cat.color,
                      border: parseInt(filterCategory, 10) === cat.id ? '1px solid #ffcc00' : '1px solid #000'
                    }}></span>
                    {cat.name}
                  </li>
                ))}
                <li className={`legend-item ${filterCategory === 'all' ? 'active' : ''}`} onClick={() => setFilterCategory('all')}>
                  <span className="legend-color-box" style={{
                    backgroundColor: 'rgba(234, 32, 32, 0.4)',
                    border: filterCategory === 'all' ? '1px solid #ffcc00' : '1px solid #000'
                  }}></span>
                  All
                </li>
              </ul>
            </div>
            {/* Control buttons to save annotations, segmentations, clear boxes, and save to DB */}
            <button className="control-button" onClick={saveAnnotations} style={{ transition: 'transform 0.2s, box-shadow 0.2s' }}>
              Save Annotations (JSON)
            </button>
            <button className="control-button" onClick={saveSegmentations} style={{ transition: 'transform 0.2s, box-shadow 0.2s' }}>
              Save Segmentations (PNGs)
            </button>
            <button className="control-button" onClick={() => setShowClearConfirmation(true)} style={{ transition: 'transform 0.2s, box-shadow 0.2s' }}>
              Clear All Boxes
            </button>
            {isDatabaseMode && allBoxes.length > 0 && (
              <button className="control-button" onClick={handleSaveToDB} style={{ marginBottom: '10px', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                Save to DB
              </button>
            )}
            {isDatabaseMode && (
              <button className="control-button" onClick={() => setShowGroundTruth(!showGroundTruth)} disabled={groundTruthAnnotations.length === 0} style={{ transition: 'transform 0.2s, box-shadow 0.2s' }}>
                {showGroundTruth ? 'Hide Ground Truth' : 'Show Ground Truth'}
              </button>
            )}
            {/* Confirmation modal for clearing all boxes */}
            {showClearConfirmation && (
              <div className="clear-boxes-container">
                <div className="confirmation-modal">
                  <p>Are you sure you want to clear all boxes?</p>
                  <div className="confirmation-buttons">
                    <button className="confirm-button" onClick={confirmClearAllBoxes}>Yes</button>
                    <button className="cancel-button" onClick={cancelClearAllBoxes}>No</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE INDICATOR */}
      {/* Displays a small indicator to allow the user to reset the mode.
          It appears only on the landing page (when no image is uploaded or predictions exist). */}
      {modeConfirmed && (!uploadedImage || !predictions.length) && (
        <div className={`mode-indicator-small ${isDatabaseMode ? 'database' : 'upload-only'}`}
          onClick={() => {
            setModeConfirmed(false);
            setShowGroundTruth(false);
            setGroundTruthAnnotations([]);
            setMetadata(null);
          }}
          role="button"
          tabIndex={0}
        >
          {isDatabaseMode ? 'Database Mode' : 'Upload Only Mode'}
        </div>
      )}

      {/* FOOTER*/}
      {/* The footer is  styled to fade out
          when in segmentation mode (i.e. when an image is uploaded and predictions exist).
          This removes the footer from the segmentation page. */}
      <footer className={`footer ${uploadedImage && predictions.length ? 'fade-out-footer' : ''}`}>
        <p>
          &copy; NewNa Segmentation App | Frontend: Tobias Kreten | Backend: Svend Göke | Supervisor: Johanna Störiko
        </p>
      </footer>
    </div>
  );
}

export default App;