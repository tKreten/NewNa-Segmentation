import React, { useEffect, useRef, useState } from 'react';
import '../App.css';

// SegmentationViewer Component
// 
// This component provides the interactive segmentation viewer.
// It allows users to draw new bounding boxes, resize/edit existing ones,
// and filter them by category. The component takes into account the scaling
// of the displayed image relative to its natural dimensions so that the boxes
// appear in the correct positions and sizes.
// Problems encountered included proper coordinate conversion and smooth
// interaction between drawing/resizing modes. The solution was to compute scale
// factors and use them consistently throughout the component.

function SegmentationViewer({
  image,            // URL of the image to segment
  imageId,          // Unique ID for the current image (used to trigger reloading)
  filterCategory,   // Selected category filter ('all' or specific category id)
  imgRef,           // Ref to the image element to compute dimensions and scaling
  allBoxes,         // Array of bounding boxes (both backend predictions and user drawings)
  setAllBoxes,      // Setter function to update the bounding boxes array
  metadata          // Metadata for the current image (should contain fileName)
}) {
  // Refs for container and menu elements
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  // State variables for drawing and editing interactions
  const [isDrawing, setIsDrawing] = useState(false);         // Indicates if a new box is being drawn
  const [currentBox, setCurrentBox] = useState(null);          // Stores the current box being drawn
  const [activeBoxId, setActiveBoxId] = useState(null);        // ID of the box currently being resized
  const [isResizing, setIsResizing] = useState(false);         // Indicates if a resize action is in progress
  const [resizingCorner, setResizingCorner] = useState(null);    // Which corner is used for resizing (e.g., 'top-left')
  const [selectedBoxId, setSelectedBoxId] = useState(null);    // ID of the currently selected box (for context menu)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 }); // Position for the context (click) menu
  const [editingBoxId, setEditingBoxId] = useState(null);      // ID of the box in editing mode (e.g., to change category)
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false); // Toggles the category selection menu
  const [imageLoaded, setImageLoaded] = useState(false);       // Indicates if the image has loaded
  const [filteredBoxes, setFilteredBoxes] = useState([]);      // Array of boxes after applying category filter
  const [scaleX, setScaleX] = useState(1);                       // Scale factor: displayed width / natural width
  const [scaleY, setScaleY] = useState(1);                       // Scale factor: displayed height / natural height

  // Compute scaled versions of all bounding boxes for accurate rendering on the displayed image.
  // Problem: The coordinates stored in allBoxes are in the image's natural coordinate space.
  // Solution: Multiply each coordinate by scaleX/scaleY to convert to the displayed size.
  const scaledBoxes = allBoxes.map((box) => ({
    ...box,
    scaledX: box.x * scaleX,
    scaledY: box.y * scaleY,
    scaledW: box.width * scaleX,
    scaledH: box.height * scaleY
  }));

  // Define the available categories. Each category gets a specific color.
  const categories = [
    { id: 0, name: 'Photograph' },
    { id: 1, name: 'Illustration' },
    { id: 2, name: 'Map' },
    { id: 3, name: 'Comic/Cartoon' },
    { id: 4, name: 'Editorial Cartoon' },
    { id: 5, name: 'Headline' },
    { id: 6, name: 'Advertisement' },
  ];

  // Reset imageLoaded state when imageId changes (i.e., when a new image is uploaded)
  useEffect(() => {
    setImageLoaded(false);
  }, [imageId]);

  // Check if the image is already loaded; if yes, update the state.
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setImageLoaded(true);
    }
  }, [imgRef]);

  // After the image loads, calculate scale factors based on natural vs. displayed dimensions.
  // Problem: The image may be resized by the browser; bounding boxes must be scaled accordingly.
  // Solution: Use naturalWidth/clientWidth and naturalHeight/clientHeight to compute scaleX and scaleY.
  useEffect(() => {
    if (!imgRef.current || !imageLoaded) return;
    const naturalW = imgRef.current.naturalWidth || 1;
    const naturalH = imgRef.current.naturalHeight || 1;
    const displayW = imgRef.current.clientWidth || naturalW;
    const displayH = imgRef.current.clientHeight || naturalH;
    setScaleX(displayW / naturalW);
    setScaleY(displayH / naturalH);
  }, [imageLoaded, imgRef]);

  // Filter the bounding boxes based on the selected filterCategory.
  // If 'all' is selected, then all boxes are shown; otherwise, filter by the specific category.
  useEffect(() => {
    if (filterCategory === 'all') {
      setFilteredBoxes(allBoxes);
    } else {
      const catId = parseInt(filterCategory, 10);
      setFilteredBoxes(allBoxes.filter((box) => box.category_id === catId));
    }
  }, [filterCategory, allBoxes]);

  // Utility function to convert mouse event coordinates into image coordinates.
  // Problem: Mouse events give viewport coordinates, but we need coordinates relative to the image's scaling.
  // Solution: Subtract the image's bounding rectangle offsets and divide by scale factors.
  const getEventCoordinates = (e) => {
    if (!imgRef.current) return { realX: 0, realY: 0 };
    const bounds = imgRef.current.getBoundingClientRect();
    const displayX = e.clientX - bounds.left;
    const displayY = e.clientY - bounds.top;
    const realX = displayX / scaleX;
    const realY = displayY / scaleY;
    return { realX, realY };
  };

  // Mouse down handler for initiating drawing a new bounding box.
  // If no box is currently selected or being edited, start a new box using the current mouse position.
  // 
  // When drawing a new box, we add a file_name property.
  // If metadata is provided via props, we use metadata.fileName; otherwise, we fallback to 'default_filename'.
  // NOTE: If you see "default_filename" in the database, it means metadata isn't preserved.
  const handleMouseDown = (e) => {
    if (selectedBoxId || editingBoxId) {
      // If a box is already selected for editing, clear the selection.
      setSelectedBoxId(null);
      setEditingBoxId(null);
      setIsCategoryMenuOpen(false);
      return;
    }
    e.preventDefault();
    const { realX, realY } = getEventCoordinates(e);
    setIsDrawing(true);
    setCurrentBox({
      x: realX,
      y: realY,
      width: 0,
      height: 0,
      category_id: filterCategory === 'all' ? null : parseInt(filterCategory, 10),
      isBackend: false, // Indicates this is a user-drawn box.
      file_name: metadata && metadata.fileName ? metadata.fileName : 'default_filename'
    });
  };

  // Mouse move handler to update the dimensions of the currently drawn or resized box.
  const handleMouseMove = (e) => {
    if (!isDrawing && !isResizing) return;
    e.preventDefault();
    const { realX, realY } = getEventCoordinates(e);
    if (isDrawing && currentBox) {
      // Update the dimensions and position of the new box based on current mouse coordinates.
      setCurrentBox((prev) => ({
        ...prev,
        width: Math.abs(realX - prev.x),
        height: Math.abs(realY - prev.y),
        x: realX < prev.x ? realX : prev.x,
        y: realY < prev.y ? realY : prev.y
      }));
    } else if (isResizing && activeBoxId !== null) {
      // Update the dimensions of the box being resized.
      setAllBoxes((prev) =>
        prev.map((box) => {
          if (box.id === activeBoxId) {
            const isTopLeft = (resizingCorner === 'top-left');
            const newWidth = isTopLeft
              ? box.width + (box.x - realX)
              : Math.abs(realX - box.x);
            const newHeight = isTopLeft
              ? box.height + (box.y - realY)
              : Math.abs(realY - box.y);
            return {
              ...box,
              x: isTopLeft ? realX : box.x,
              y: isTopLeft ? realY : box.y,
              width: Math.max(1, newWidth),   // Ensure a minimum width
              height: Math.max(1, newHeight)  // Ensure a minimum height
            };
          }
          return box;
        })
      );
    }
  };

  // Mouse up handler to finalize drawing or resizing.
  // For drawing, it creates a new box with a unique ID and adds it to the state.
  // For resizing, it simply resets the resizing state.
  const handleMouseUp = () => {
    if (isDrawing && currentBox) {
      const newBox = { ...currentBox, id: Date.now().toString() };
      setAllBoxes((prev) => [...prev, newBox]);
      setIsDrawing(false);
      setCurrentBox(null);
    }
    setIsResizing(false);
    setActiveBoxId(null);
    setResizingCorner(null);
  };

  // Click handler for individual bounding boxes.
  // Toggles the selection state to either show or hide the context menu.
  const handleBoxClick = (e, boxId) => {
    e.stopPropagation();
    if (selectedBoxId === boxId) {
      setSelectedBoxId(null);
      setEditingBoxId(null);
      setIsCategoryMenuOpen(false);
    } else {
      setSelectedBoxId(boxId);
      setEditingBoxId(null);
      // Determine the position for the context menu based on the container's position.
      if (containerRef.current) {
        const bounds = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - bounds.left;
        const clickY = e.clientY - bounds.top;
        setMenuPosition({ x: clickX, y: clickY });
      }
    }
  };

  // Mouse down handler for resize handles.
  // Initiates resizing by setting the active box and the corner being dragged.
  const handleResizeMouseDown = (e, boxId, corner) => {
    e.stopPropagation();
    setIsResizing(true);
    setActiveBoxId(boxId);
    setResizingCorner(corner);
  };

  // Handler to change the category of a box.
  // Updates the category_id of the selected box.
  const handleChangeCategory = (boxId, newCategoryId) => {
    setAllBoxes((prev) =>
      prev.map((box) =>
        box.id === boxId ? { ...box, category_id: newCategoryId } : box
      )
    );
    setIsCategoryMenuOpen(false);
    setSelectedBoxId(null);
  };

  // Utility function that returns a background color based on the category id.
  // This ensures that each category has a consistent visual representation.
  const getColorForCategory = (catId) => {
    switch (catId) {
      case 0: return 'rgba(58,68,102,0.4)';
      case 1: return 'rgba(178,57,48,0.4)';
      case 2: return 'rgba(47,115,84,0.4)';
      case 3: return 'rgba(216,172,82,0.4)';
      case 4: return 'rgba(112,72,145,0.4)';
      case 5: return 'rgba(66,113,161,0.4)';
      case 6: return 'rgba(189,87,38,0.4)';
      default: return 'rgba(89,96,108,0.4)';
    }
  };

  // Render the segmentation viewer, including the image, SVG overlay for boxes,
  // and context menus for box actions (delete, edit, change category).
  return (
    <div
      className="segmentation-viewer-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      ref={containerRef}
      style={{ overflow: 'visible' }}
    >
      <div className="segmentation-viewer" style={{ position: 'relative' }}>
        <img
          src={image}
          alt="Segmented"
          ref={imgRef}
          onLoad={() => setImageLoaded(true)}
        />
        <svg className="svg-overlay">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Render each bounding box after scaling, filtering by category if needed */}
          {scaledBoxes
            .filter((box) => {
              if (filterCategory === 'all') return true;
              return box.category_id === parseInt(filterCategory, 10);
            })
            .map((box) => (
              <g key={box.id}>
                <rect
                  x={box.scaledX}
                  y={box.scaledY}
                  width={box.scaledW}
                  height={box.scaledH}
                  className={`bounding-box ${box.fadeOut ? 'fade-out' : ''} ${
                    isResizing && activeBoxId === box.id ? 'no-transition' : ''
                  }`}
                  style={{
                    fill: getColorForCategory(box.category_id),
                    stroke: 'black',
                    strokeWidth: 2,
                    cursor: 'pointer',
                  }}
                  onClick={(e) => handleBoxClick(e, box.id)}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                {/* If the box is in editing mode, display resize handles */}
                {editingBoxId === box.id && (
                  <>
                    <circle
                      cx={box.scaledX + box.scaledW}
                      cy={box.scaledY + box.scaledH}
                      r="5"
                      className="resize-handle"
                      onMouseDown={(e) => handleResizeMouseDown(e, box.id, 'bottom-right')}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <circle
                      cx={box.scaledX}
                      cy={box.scaledY}
                      r="5"
                      className="resize-handle"
                      onMouseDown={(e) => handleResizeMouseDown(e, box.id, 'top-left')}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </>
                )}
              </g>
            ))}
          {/* Render the current drawing box if the user is drawing */}
          {isDrawing && currentBox && (
            <rect
              x={currentBox.x * scaleX}
              y={currentBox.y * scaleY}
              width={currentBox.width * scaleX}
              height={currentBox.height * scaleY}
              className="bounding-box drawing-box no-transition"
              style={{ fill: 'rgba(89,96,108,0.4)', stroke: 'black' }}
            />
          )}
        </svg>
        {/* Display a context menu when a box is selected */}
        {selectedBoxId && (
          <div
            className="click-menu"
            ref={menuRef}
            style={{
              left: `${menuPosition.x}px`,
              top: `${menuPosition.y}px`,
              zIndex: 10000,
              position: 'absolute',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                // Delete the selected box with a fade-out effect
                setAllBoxes(prev =>
                  prev.map(b => b.id === selectedBoxId ? { ...b, fadeOut: true } : b)
                );
                setSelectedBoxId(null);
                // Remove the box after the fade-out animation completes (1 second)
                setTimeout(() => {
                  setAllBoxes(prev => prev.filter(b => !b.fadeOut));
                }, 1000);
              }}
              className="menu-button"
            >
              Delete
            </button>
            <button
              onClick={() => {
                // Enable editing mode for the selected box
                setEditingBoxId(selectedBoxId);
                setSelectedBoxId(null);
              }}
              className="menu-button"
            >
              Edit
            </button>
            <button
              onClick={() => setIsCategoryMenuOpen(prev => !prev)}
              className="menu-button"
            >
              Change Category
            </button>
            {isCategoryMenuOpen && (
              <div className="category-menu">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    className="menu-button"
                    onClick={() => handleChangeCategory(selectedBoxId, cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SegmentationViewer;