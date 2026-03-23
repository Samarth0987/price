import React from "react";
import "./HeaderBar.css";
import { loginWithGoogle, logoutUser } from "../supabaseClient"; 

// Receive 'user' as a prop now
function HeaderBar({ search, setSearch, setPage, cartCount, user }) {
  
  const cartBadge = React.useMemo(
    () =>
      cartCount > 0 && (
        <span className="headerbar-cart-count">
          {cartCount}
        </span>
      ),
    [cartCount]
  );

  return (
    <header className="headerbar-main">
      <div className="headerbar-content">
        <h1
          className="headerbar-title"
          role="button"
          tabIndex={0}
          onClick={() => setPage("home")}
          style={{ cursor: "pointer" }}
        >
          🛒 Price Lens
        </h1>

        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search for a product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="headerbar-search"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="headerbar-buttons">
          <button className="headerbar-btn" onClick={() => setPage("compare")}>
            Compare
          </button>
          
          <button className="headerbar-btn headerbar-cart-btn" onClick={() => setPage("cart")}>
            Cart {cartBadge}
          </button>

          {/* Login / User Section */}
          {user ? (
            <div className="user-section" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {user.user_metadata?.avatar_url && (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="User" 
                  style={{ width: '32px', borderRadius: '50%', border: '2px solid white' }} 
                  title={user.user_metadata.full_name || user.email}
                />
              )}
              <button 
                className="headerbar-btn" 
                onClick={logoutUser}
                style={{ backgroundColor: '#ff4444', color: 'white' }}
              >
                Logout
              </button>
            </div>
          ) : (
            <button 
              className="headerbar-btn" 
              onClick={loginWithGoogle}
              style={{ backgroundColor: '#4285F4', color: 'white' }}
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default HeaderBar;