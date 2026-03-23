import React, { useState, useEffect } from 'react';

// Default online shopping stores
const MOCK_STORES = [
  { name: 'Amazon', color: '#FF9900' },
  { name: 'Flipkart', color: '#2874F0' },
  { name: 'Myntra', color: '#FF3F6C' },
  { name: 'Ajio', color: '#2C2C2C' },
];

// Convert rating + review count into a simple Good / Medium / Bad label
const getSentimentLabel = (rating, reviewCount) => {
  if (!rating || reviewCount == null) return 'Medium';
  if (rating >= 4.2 && reviewCount >= 100) return 'Good';
  if (rating >= 3.5) return 'Medium';
  return 'Bad';
};

function ComparePage({ onAddToCart, setPage, STORES: propsStores, search = '' }) {
  const [selectedStores, setSelectedStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch products + review data from Python backend whenever search changes
  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);

      const query = search && search.trim().length > 0 ? search.trim() : 'Sample Product';
      try {
        const res = await fetch(
          `http://localhost:8002/api/reviews?query=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          console.error('Failed to fetch reviews', res.status);
          setProducts([]);
          setStores(propsStores || MOCK_STORES);
          setSelectedStores((propsStores || MOCK_STORES).map(s => s.name));
          return;
        }
        const data = await res.json();
        const productsFromApi = data.products || [];
        setProducts(productsFromApi);

        // Derive stores from offers, fall back to props / mock
        const uniqueStores = new Map();
        productsFromApi.forEach((p) => {
          (p.offers || []).forEach((offer) => {
            if (!uniqueStores.has(offer.store)) {
              const fallback = (propsStores || MOCK_STORES).find((s) => s.name === offer.store);
              uniqueStores.set(offer.store, fallback || { name: offer.store, color: '#4b5563' });
            }
          });
        });
        const storesList = Array.from(uniqueStores.values());
        setStores(storesList.length > 0 ? storesList : (propsStores || MOCK_STORES));
        setSelectedStores((storesList.length > 0 ? storesList : (propsStores || MOCK_STORES)).map(s => s.name));
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error talking to review backend', err);
        }
        setProducts([]);
        setStores(propsStores || MOCK_STORES);
        setSelectedStores((propsStores || MOCK_STORES).map(s => s.name));
      } finally {
        setLoading(false);
      }
    };

    run();

    return () => controller.abort();
  }, [propsStores, search]);

  // Toggle store filter
  const toggleStoreFilter = (storeName) => {
    setSelectedStores(prev =>
      prev.includes(storeName)
        ? prev.filter(s => s !== storeName)
        : [...prev, storeName]
    );
  };

  // Add single product to cart
  const handleAddToCart = (product) => {
    // Call the parent's onAddToCart function if provided
    if (onAddToCart) {
      onAddToCart(product);
    }
    
    // Show notification
    setNotificationCount(1);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 2000);
  };

  // Filter products based on selected stores
  const filteredProducts = products.filter(
    p => p.offers.some(offer => selectedStores.includes(offer.store))
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Notification Toast */}
      {showNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#10B981',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          animation: 'slideIn 0.3s ease-out'
        }}>
          ✓ {notificationCount} item{notificationCount > 1 ? 's' : ''} added to cart!
        </div>
      )}

      {/* Results Count */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        gap: '1rem',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: '500' }}>
          {loading ? "Loading..." : `${filteredProducts.length} products found`}
        </div>
      </div>

      {/* Store Filter Chips */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        padding: '1rem 1.5rem',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        overflowX: 'auto'
      }}>
        <span style={{ fontSize: '0.9rem', fontWeight: '500', color: '#6b7280', whiteSpace: 'nowrap' }}>Filter:</span>
        {stores.map(store => {
          const selected = selectedStores.includes(store.name);
          return (
            <button
              key={store.name}
              style={{
                backgroundColor: selected ? store.color : '#e5e7eb',
                color: selected ? '#fff' : '#6b7280',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
              onClick={() => toggleStoreFilter(store.name)}
              aria-label={`Filter by ${store.name}`}
            >
              {store.name}
              {selected && <span style={{ marginLeft: "6px" }}>×</span>}
            </button>
          );
        })}
      </div>

      {/* Product Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1.5rem',
        padding: '1.5rem',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {!loading && filteredProducts.map(product => {
          const displayOffers = (product.offers || [])
            .filter(offer => selectedStores.includes(offer.store))
            .sort((a, b) => {
              const sentimentOrder = { Good: 0, Medium: 1, Bad: 2 };
              const sa = sentimentOrder[getSentimentLabel(a.rating, a.reviewCount)];
              const sb = sentimentOrder[getSentimentLabel(b.rating, b.reviewCount)];

              if (sa !== sb) return sa - sb;                   // Better sentiment first
              if (b.rating !== a.rating) return b.rating - a.rating; // Higher rating next
              return a.price - b.price;                        // Then cheaper
            });
          
          return (
            <div 
              key={product.product_id}
              style={{
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff',
                borderRadius: '12px',
                padding: '1rem',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              {/* Product Name */}
              <div style={{
                backgroundColor: '#f9fafb',
                padding: '1rem',
                borderRadius: '8px'
              }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#1f2937'
                }}>
                  {product.name}
                </div>
              </div>

              {/* Offers List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {displayOffers.map((offer) => {
                  const storeMeta = stores.find(s => s.name === offer.store);
                  return (
                    <div
                      key={offer.store}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        border: `2px solid ${storeMeta?.color ? storeMeta.color + '60' : '#e5e7eb'}`,
                        backgroundColor: storeMeta?.color ? storeMeta.color + '10' : '#f9fafb',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          color: storeMeta?.color || '#4b5563'
                        }}>
                          {offer.store}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                          {offer.rating != null ? `${offer.rating.toFixed(1)}★ · ${offer.reviewCount} reviews` : 'No rating'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          color: '#1f2937'
                        }}>
                          ₹{offer.price}
                        </div>
                        <div style={{
                          fontSize: '0.8rem',
                          marginTop: '4px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          display: 'inline-block',
                          backgroundColor:
                            getSentimentLabel(offer.rating, offer.reviewCount) === 'Good'
                              ? '#dcfce7'
                              : getSentimentLabel(offer.rating, offer.reviewCount) === 'Medium'
                              ? '#fef9c3'
                              : '#fee2e2',
                          color:
                            getSentimentLabel(offer.rating, offer.reviewCount) === 'Good'
                              ? '#166534'
                              : getSentimentLabel(offer.rating, offer.reviewCount) === 'Medium'
                              ? '#854d0e'
                              : '#991b1b'
                        }}>
                          {getSentimentLabel(offer.rating, offer.reviewCount)} reviews
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => handleAddToCart(product)}
                style={{
                  backgroundColor: '#10B981',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { e.target.style.backgroundColor = '#059669'; }}
                onMouseLeave={(e) => { e.target.style.backgroundColor = '#10B981'; }}
                aria-label={`Add ${product.name} to cart`}
              >
                Add to Cart
              </button>
            </div>
          );
        })}
      </div>

      {/* No Products Message */}
      {!loading && filteredProducts.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 1.5rem',
          color: '#6b7280'
        }}>
          <p style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            No products found matching your criteria.
          </p>
          <p style={{ fontSize: '0.95rem' }}>
            Try adjusting your store filters.
          </p>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

export default ComparePage;