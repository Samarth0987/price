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

  const getStoreOffer = (item, storeName) =>
    item.offers.find(
      offer => offer.store === storeName && offer.available && offer.price != null
    );

  const openStoreProducts = storeName => {
    const urls = Array.from(
      new Set(
        cart
          .map(item => getStoreOffer(item, storeName)?.url)
          .filter(Boolean)
      )
    );

    if (!urls.length) {
      window.alert(`No exact ${storeName} product links are available for your cart yet.`);
      return;
    }

    urls.forEach(url => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  // Calculate totals per store
  const calculateStoreTotals = () => {
    const totals = {};
    // Initialize totals
    STORES.forEach(store => (
      totals[store.name] = { total: 0, items: 0, matchedItems: 0, urls: [] }
    ));

    cart.forEach(item => {
      STORES.forEach(store => {
        const offer = getStoreOffer(item, store.name);
        if (offer && totals[store.name]) {
          totals[store.name].total += offer.price * item.quantity;
          totals[store.name].items += item.quantity;
          totals[store.name].matchedItems += 1;
          if (offer.url) {
            totals[store.name].urls.push(offer.url);
          }
        }
      });
    });

    let minTotal = Infinity;
    let bestStore = null;
    Object.entries(totals).forEach(([store, data]) => {
      if (data.matchedItems === cart.length && data.total > 0 && data.total < minTotal) {
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
                    <a
                      key={offer.store}
                      href={offer.available && offer.url ? offer.url : undefined}
                      target={offer.available && offer.url ? "_blank" : undefined}
                      rel={offer.available && offer.url ? "noopener noreferrer" : undefined}
                      className="store-chip"
                      style={{
                        textDecoration: "none",
                        opacity: offer.available ? 1 : 0.65,
                        pointerEvents: offer.available && offer.url ? "auto" : "none",
                      }}
                      title={
                        offer.available && offer.url
                          ? `Open ${offer.store} product`
                          : `${offer.store} product not available`
                      }
                    >
                      {offer.store}:{" "}
                      <span className="price">
                        {offer.available && offer.price != null ? `₹${offer.price}` : "N/A"}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Totals Summary */}
          <h3>Total Cart Value by Store</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.2rem" }}>
            {Object.entries(totals).map(([storeName, data]) => {
              const cartCovered = data.matchedItems === cart.length;

              return (
                <button
                  key={storeName}
                  onClick={() => openStoreProducts(storeName)}
                  disabled={!cartCovered}
                  className={`store-card${storeName === bestStore ? " best" : ""}`}
                  style={{ 
                    textDecoration: "none",
                    color: "inherit",
                    cursor: cartCovered ? "pointer" : "not-allowed",
                    display: "block",
                    width: "100%",
                    border: "none",
                    textAlign: "left",
                    opacity: cartCovered ? 1 : 0.75,
                  }}
                  title={
                    cartCovered
                      ? `Open all shown ${storeName} product pages`
                      : `${storeName} does not have all cart items`
                  }
                >
                  <h4 style={{ fontWeight: 600, fontSize: "1.06rem" }}>
                    {storeName} <span style={{ fontSize: "0.8em" }}>{cartCovered ? "🔗" : "!"}</span>
                  </h4>
                  <p className="price" style={{ marginTop: "0.5rem" }}>
                    {cartCovered ? `₹${data.total.toFixed(2)}` : "Not fully available"}
                  </p>
                  <p style={{ marginTop: "0.35rem", color: "#64748b", fontSize: "0.9rem" }}>
                    {cartCovered
                      ? "Open exact product pages for this store"
                      : `${data.matchedItems}/${cart.length} cart items matched`}
                  </p>
                </button>
              );
            })}
          </div>

          {bestStore ? (
            <p style={{ marginTop: "2rem", fontSize: "1.08rem", color: "#166534" }}>
              For the lowest full-cart price (<span className="text-green">₹{minTotal.toFixed(2)}</span>),
              open <strong>{bestStore}</strong> above and you will be taken to the exact product pages shown in comparison.
            </p>
          ) : (
            <p style={{ marginTop: "2rem", fontSize: "1.08rem", color: "#92400e" }}>
              No single store has exact links for every cart item yet. You can still open the available product pages store by store above.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default CartPage;
