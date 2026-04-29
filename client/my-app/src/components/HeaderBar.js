import React from "react";
import "./HeaderBar.css";

// Receive 'user' as a prop now
function HeaderBar({
  search,
  setSearch,
  setPage,
  cartCount,
  user,
  authBusy,
  onLogout,
}) {
  const searchInputRef = React.useRef(null);
  const cartBadge = React.useMemo(
    () =>
      cartCount > 0 && (
        <span className="headerbar-cart-count">
          {cartCount}
        </span>
      ),
    [cartCount]
  );

  const handleSearchSubmit = React.useCallback(() => {
    const submittedSearch = searchInputRef.current?.value?.trim() || search.trim();
    if (!submittedSearch) {
      return;
    }

    setSearch(submittedSearch);
    setPage("compare");
  }, [search, setPage, setSearch]);

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
            ref={searchInputRef}
            type="text"
            placeholder="Search for a product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearchSubmit();
              }
            }}
            className="headerbar-search"
          />
          <button
            type="button"
            className="search-icon-button"
            onClick={handleSearchSubmit}
            aria-label="Search products"
          >
            <span className="search-icon">🔍</span>
          </button>
        </div>

        <div className="headerbar-buttons">
          <button className="headerbar-btn" onClick={() => setPage("compare")}>
            Compare
          </button>
          
          <button className="headerbar-btn headerbar-cart-btn" onClick={() => setPage("cart")}>
            Cart {cartBadge}
          </button>

          {/* Login / User Section */}
          <div className="headerbar-auth-block">
            {user ? (
              <div className="user-section">
                {user.user_metadata?.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="User"
                    className="headerbar-avatar"
                    title={user.user_metadata.full_name || user.email}
                  />
                )}
                <button
                  className="headerbar-btn"
                  onClick={onLogout}
                  disabled={authBusy}
                  style={{ backgroundColor: "#ff4444", color: "white" }}
                >
                  {authBusy ? "Signing out..." : "Logout"}
                </button>
              </div>
            ) : (
              <button
                className="headerbar-btn"
                onClick={() => setPage("login")}
                style={{ backgroundColor: "#4285F4", color: "white" }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default HeaderBar;
