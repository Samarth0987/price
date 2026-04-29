import React, { useEffect, useLayoutEffect, useState } from 'react';

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
  const storeCatalog = propsStores || MOCK_STORES;
  const normalizedSearch = search.trim();
  const [selectedStores, setSelectedStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState(storeCatalog);
  const [loading, setLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState(normalizedSearch);

  useEffect(() => {
    setStores(storeCatalog);
    setSelectedStores(storeCatalog.map((store) => store.name));
  }, [storeCatalog]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(normalizedSearch);
    }, 700);

    return () => clearTimeout(timeoutId);
  }, [normalizedSearch]);

  useLayoutEffect(() => {
    if (!debouncedSearch && normalizedSearch) {
      setLoading(true);
    }
  }, [debouncedSearch, normalizedSearch]);

  // Fetch products + review data from Python backend whenever search changes
  useEffect(() => {
    if (!debouncedSearch) {
      if (normalizedSearch) {
        setLoading(true);
        return undefined;
      }

      setProducts([]);
      setStores(storeCatalog);
      setSelectedStores(storeCatalog.map((store) => store.name));
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const run = async () => {
      setLoading(true);

      const query = debouncedSearch;
      try {
        const res = await fetch(
          `http://localhost:8002/api/reviews?query=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          console.error('Failed to fetch reviews', res.status);
          setProducts([]);
          setStores(storeCatalog);
          setSelectedStores(storeCatalog.map(s => s.name));
          return;
        }
        const data = await res.json();
        const productsFromApi = (data.products || []).map((product) => {
          const offersByStore = new Map((product.offers || []).map((offer) => [offer.store, offer]));
          return {
            ...product,
            offers: storeCatalog.map((store) => (
              offersByStore.get(store.name) || {
                store: store.name,
                price: null,
                rating: null,
                reviewCount: null,
                title: null,
                url: null,
                sentiment: 'Unavailable',
                available: false,
              }
            )),
          };
        });

        setProducts(productsFromApi);
        setStores(storeCatalog);
        setSelectedStores(storeCatalog.map(s => s.name));
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error talking to review backend', err);
        }
        setProducts([]);
        setStores(storeCatalog);
        setSelectedStores(storeCatalog.map(s => s.name));
      } finally {
        setLoading(false);
      }
    };

    run();

    return () => controller.abort();
  }, [debouncedSearch, normalizedSearch, storeCatalog]);

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
  const isWaitingForSearch = !debouncedSearch && normalizedSearch.length > 0;
  const isLoadingView = loading || isWaitingForSearch;

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
          {isLoadingView ? "Loading..." : `${filteredProducts.length} products found`}
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
        {!isLoadingView && filteredProducts.map(product => {
          const displayOffers = (product.offers || [])
            .filter(offer => selectedStores.includes(offer.store))
            .sort((a, b) => stores.findIndex(store => store.name === a.store) - stores.findIndex(store => store.name === b.store));
          const hasAvailableOffer = displayOffers.some((offer) => offer.available);
          
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
                  const sentimentLabel = offer.available
                    ? getSentimentLabel(offer.rating, offer.reviewCount)
                    : 'Unavailable';
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
                        {offer.available && offer.title && (
                          <span style={{
                            fontSize: '0.78rem',
                            color: '#475569',
                            maxWidth: '180px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {offer.title}
                          </span>
                        )}
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                          {offer.available && offer.rating != null
                            ? `${offer.rating.toFixed(1)}★ · ${offer.reviewCount} reviews`
                            : 'Not available on this site'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          color: '#1f2937'
                        }}>
                          {offer.available && offer.price != null ? `₹${offer.price}` : 'Not available'}
                        </div>
                        <div style={{
                          fontSize: '0.8rem',
                          marginTop: '4px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          display: 'inline-block',
                          backgroundColor:
                            sentimentLabel === 'Good'
                              ? '#dcfce7'
                              : sentimentLabel === 'Medium'
                              ? '#fef9c3'
                              : sentimentLabel === 'Bad'
                              ? '#fee2e2'
                              : '#e5e7eb',
                          color:
                            sentimentLabel === 'Good'
                              ? '#166534'
                              : sentimentLabel === 'Medium'
                              ? '#854d0e'
                              : sentimentLabel === 'Bad'
                              ? '#991b1b'
                              : '#4b5563'
                        }}>
                          {offer.available ? `${sentimentLabel} reviews` : 'Site unavailable'}
                        </div>
                        {offer.available && offer.url && (
                          <a
                            href={offer.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              marginTop: '6px',
                              fontSize: '0.78rem',
                              color: storeMeta?.color || '#2563eb',
                              textDecoration: 'none',
                              fontWeight: '600'
                            }}
                          >
                            View product
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => handleAddToCart(product)}
                disabled={!hasAvailableOffer}
                style={{
                  backgroundColor: hasAvailableOffer ? '#10B981' : '#94a3b8',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: hasAvailableOffer ? 'pointer' : 'not-allowed',
                  fontSize: '0.95rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (hasAvailableOffer) e.target.style.backgroundColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = hasAvailableOffer ? '#10B981' : '#94a3b8';
                }}
                aria-label={`Add ${product.name} to cart`}
              >
                {hasAvailableOffer ? 'Add to Cart' : 'Unavailable'}
              </button>
            </div>
          );
        })}
      </div>

      {/* No Products Message */}
      {!isLoadingView && filteredProducts.length === 0 && (
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
