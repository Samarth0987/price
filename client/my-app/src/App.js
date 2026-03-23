import React, { useState, useEffect } from "react";
import HeaderBar from "./components/HeaderBar";
import Spinner from "./components/Spinner";
import HomePage from "./pages/HomePage";
import ComparePage from "./pages/ComparePage";
import CartPage from "./pages/CartPage";
import "./App.css";

// --- SUPABASE IMPORTS ---
import { supabase } from "./supabaseClient";

// Define STORES globally with URLs (general online shopping)
const STORES = [
  { name: "Amazon", color: "#FF9900", url: "https://www.amazon.in/" },
  { name: "Flipkart", color: "#2874F0", url: "https://www.flipkart.com/" },
  { name: "Myntra", color: "#FF3F6C", url: "https://www.myntra.com/" },
  { name: "Ajio", color: "#2C2C2C", url: "https://www.ajio.com/" },
];

function App() {
  const [page, setPage] = useState("home"); // 'home', 'compare', 'cart'
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null); // Track User state

  // --- 1. LISTEN FOR LOGIN / LOGOUT VIA SUPABASE ---
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);

      // (Optional) Here you could load a saved cart from Supabase if implemented
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);

      if (!session) {
        setCart([]);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Add item to cart logic
  const handleAddToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.cartItemId === product.product_id);
      if (existing) {
        return prevCart.map((item) =>
          item.cartItemId === product.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, cartItemId: product.product_id, quantity: 1 }];
    });
  };

  return (
    <div className="App">
      {/* HeaderBar receives user prop */}
      <HeaderBar
        search={search}
        setSearch={setSearch}
        setPage={setPage}
        cartCount={cart.length}
        user={user} 
      />

      <main className="main-content">
        {loading ? (
          <Spinner />
        ) : page === "home" ? (
          <HomePage setPage={setPage} />
        ) : page === "compare" ? (
          <ComparePage
            onAddToCart={handleAddToCart}
            setPage={setPage}
            STORES={STORES}
            search={search}
          />
        ) : page === "cart" ? (
          <CartPage
            cart={cart}
            setCart={setCart}
            setPage={setPage}
            STORES={STORES}
          />
        ) : null}
      </main>

      <footer className="app-footer">
        <p className="footer-text">© 2025 Price Lens. All Rights Reserved.</p>
      </footer>
    </div>
  );
}

export default App;