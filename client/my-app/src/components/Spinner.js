import React from 'react';
import './Spinner.css'; // Import the custom CSS for spinner

/**
 * Spinner component shows a loading indicator.
 * Accessible, visually centered, and responsive.
 */
function Spinner() {
  return (
    <div className="spinner-center" role="status" aria-label="Loading">
      <span className="spinner" />
    </div>
  );
}

export default Spinner;