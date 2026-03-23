import React from 'react';
import './HomePage.css';

function HomePage({ setPage }) {
  return (
    <div className="homepage-container">
      {/* Hero Section */}
      <section className="home-hero-section">
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
        
        <div className="home-hero-content">
          <div className="hero-icon">🛒</div>
          
          <h1 className="home-hero-title">
            Welcome to <span className="hero-title-highlight">Price Lens!</span>
          </h1>
          
          <p className="home-hero-subtitle">
            India's fastest online shopping price comparison tool
          </p>
          
          <p className="home-hero-description">
            Save money by comparing product prices across multiple online stores.
            <br />
            Fast, transparent, and always up-to-date!
          </p>
          
          <button
            onClick={() => setPage('compare')}
            className="home-start-btn"
            aria-label="Start Comparing"
          >
            <span>Start Comparing</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="home-works-section">
        <h2 className="home-works-title">Get Started in 3 Easy Steps</h2>
        <div className="title-underline"></div>
        
        <div className="home-works-list">
          {/* Step 1 */}
          <div className="home-works-step">
            <div className="step-number">1</div>
            <div className="step-icon">🔍</div>
            <h3 className="step-title">Search</h3>
            <p className="step-description">
              Enter any product you want to find.
            </p>
            <div className="step-arrow">➜</div>
          </div>
          
          {/* Step 2 */}
          <div className="home-works-step">
            <div className="step-number">2</div>
            <div className="step-icon">📊</div>
            <h3 className="step-title">Compare</h3>
            <p className="step-description">
              See live prices from all top stores in your area.
            </p>
            <div className="step-arrow">➜</div>
          </div>
          
          {/* Step 3 */}
          <div className="home-works-step">
            <div className="step-number">3</div>
            <div className="step-icon">✅</div>
            <h3 className="step-title">Save</h3>
            <p className="step-description">
              Choose the best deal and save money instantly.
            </p>
          </div>
        </div>
      </section>

      {/* Additional CTA Section */}
      <section className="home-cta-section">
        <div className="cta-box">
          <div className="cta-content">
            <div className="cta-icon">💡</div>
            <div className="cta-text">
              <h3>Ready to start saving?</h3>
              <p>Compare prices now and never overpay again!</p>
            </div>
          </div>
          <button
            onClick={() => setPage('compare')}
            className="cta-button"
          >
            Get Started →
          </button>
        </div>
      </section>
    </div>
  );
}

export default HomePage;