import React from "react";
import "./CartPage.css";

function CartPage({ cart, setPage, setCart, STORES }) {
  // Handle quantity change
  const handleQuantityChange = (cartItemId, delta) => {
    setCart(prevCart =>
      prevCart
        .map(item => {
          if (item.cartItemId === cartItemId) {
            const newQuantity = item.quantity + delta;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  // Remove item (with confirmation)
  const handleRemoveItem = cartItemId => {
    if (window.confirm("Remove this item from your cart?")) {
      setCart(cart.filter(item => item.cartItemId !== cartItemId));
    }
  };

  // Calculate totals per store
  const calculateStoreTotals = () => {
    const totals = {};
    // Initialize totals
    STORES.forEach(store => (totals[store.name] = { total: 0, items: 0 }));

    cart.forEach(item =>
      item.offers.forEach(offer => {
        if (totals[offer.store]) {
          totals[offer.store].total += offer.price * item.quantity;
          totals[offer.store].items += item.quantity;
        }
      })
    );

    let minTotal = Infinity;
    let bestStore = null;
    Object.entries(totals).forEach(([store, data]) => {
      if (data.total > 0 && data.total < minTotal) {
        minTotal = data.total;
        bestStore = store;
      }
    });

    return { totals, minTotal, bestStore };
  };

  const { totals, minTotal, bestStore } = calculateStoreTotals();

  return (
    <div className="cart-container">
      <button
        onClick={() => setPage("compare")}
        className="btn-primary"
        aria-label="Back to Comparison"
        style={{ marginBottom: "1.5rem" }}
      >
        ← Back to Comparison
      </button>

      <h2>
        🛒 Cart Comparison <span className="text-muted">({cart.length} items)</span>
      </h2>

      {cart.length === 0 ? (
        <div className="empty-cart">
          <p>Your cart is empty.</p>
          <button
            className="btn-primary"
            onClick={() => setPage("compare")}
            aria-label="Go to comparison page"
            style={{ marginTop: "1.5rem" }}
          >
            Add items from the comparison page
          </button>
        </div>
      ) : (
        <>
          {/* Item List */}
          <div style={{ marginBottom: "2.5rem" }}>
            {cart.map(item => (
              <div key={item.cartItemId} className="cart-item" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1.2rem", padding: "1.2rem" }}>
                <div style={{ flex: 1 }}>
                  <span className="font-semibold" style={{ fontSize: "1.1rem" }}>{item.name}</span>
                  <div style={{ marginTop: "0.7rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <button
                      onClick={() => handleQuantityChange(item.cartItemId, -1)}
                      className="qty-btn"
                    >
                      -
                    </button>
                    <span style={{ padding: "0 0.5rem", fontWeight: 600 }}>{item.quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(item.cartItemId, 1)}
                      className="qty-btn"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveItem(item.cartItemId)}
                  className="remove-btn"
                  style={{ marginRight: "1.2rem" }}
                >
                  Remove
                </button>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                  {item.offers.map(offer => (
                    <span key={offer.store} className="store-chip">
                      {offer.store}: <span className="price">₹{offer.price}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Totals Summary (Clickable Links) */}
          <h3>Total Cart Value by Store</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.2rem" }}>
            {Object.entries(totals).map(([storeName, data]) => {
              // Find URL from STORES array
              const storeObj = STORES.find(s => s.name === storeName);
              const storeUrl = storeObj ? storeObj.url : "#";

              return (
                <a
                  key={storeName}
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`store-card${storeName === bestStore ? " best" : ""}`}
                  style={{ 
                    textDecoration: "none", 
                    color: "inherit", 
                    cursor: "pointer", 
                    display: "block" 
                  }}
                  title={`Click to visit ${storeName}`}
                >
                  <h4 style={{ fontWeight: 600, fontSize: "1.06rem" }}>
                    {storeName} <span style={{ fontSize: "0.8em" }}>🔗</span>
                  </h4>
                  <p className="price" style={{ marginTop: "0.5rem" }}>
                    ₹{data.total.toFixed(2)}
                  </p>
                </a>
              );
            })}
          </div>

          <p style={{ marginTop: "2rem", fontSize: "1.08rem", color: "#166534" }}>
            To get your cart for the <span className="text-green">lowest price (₹{minTotal.toFixed(2)})</span>,
            click on <strong>{bestStore}</strong> above to order.
          </p>
        </>
      )}
    </div>
  );
}

export default CartPage;