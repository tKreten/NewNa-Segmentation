import React, { useState } from 'react';


function FloatingInfoButton() {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    setExpanded(prev => !prev);
  };

  return (
    <div className={`floating-info-container ${expanded ? 'expanded' : ''}`}>
      <button className="floating-info-button" onClick={toggleExpanded}>
        {expanded ? '✕' : 'ℹ'}
      </button>
      {expanded && (
        <div className="floating-info-content">
          <h3>About the NewNa Segmentation App</h3>
          <p>
            This app allows you to segment magazine pages and interact with them dynamically.
            Draw, edit, or delete bounding boxes, and save your work either locally or to a database.
          </p>
          <p>
            This app is the result of a project of the Master's students Tobias Kreten and Svend Göke unter the supervision of Johanna Störiko M.Sc. at the Institute of Digital Humanities Göttingen.
            <p>
            NewNa makes use of the weighted model of the Newspaper Navigator. Our app uses it in the context of German Newspaper Magazines. The focus lies on the detection of advertisements but all available classes can be worked with.
          </p>
          </p>
        </div>
      )}
    </div>
  );
}

export default FloatingInfoButton;