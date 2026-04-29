import React, { useState, useEffect } from "react";
import HeaderBar from "./components/HeaderBar";
import Spinner from "./components/Spinner";
import HomePage from "./pages/HomePage";
import ComparePage from "./pages/ComparePage";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/LoginPage";
import "./App.css";

// --- SUPABASE IMPORTS ---
import { loginWithGoogle, logoutUser, supabase } from "./supabaseClient";

// Define STORES globally with URLs (general online shopping)
const STORES = [
  { name: "Amazon", color: "#FF9900", url: "https://www.amazon.in/" },
  { name: "Flipkart", color: "#2874F0", url: "https://www.flipkart.com/" },
  { name: "Myntra", color: "#FF3F6C", url: "https://www.myntra.com/" },
  { name: "Ajio", color: "#2C2C2C", url: "https://www.ajio.com/" },
];

function App() {
  const [page, setPage] = useState("home"); // 'home', 'compare', 'cart', 'login'
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null); // Track User state
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const navigateTo = (nextPage) => {
    if (nextPage !== "login") {
      setAuthError("");
    }
    setPage(nextPage);
  };

  // --- 1. LISTEN FOR LOGIN / LOGOUT VIA SUPABASE ---
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Failed to restore Supabase session", error);
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }

      // (Optional) Here you could load a saved cart from Supabase if implemented
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAuthError("");

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
    const cartItemId = [
      product.name,
      ...(product.offers || []).map(
        (offer) => offer.url || `${offer.store}:${offer.price ?? "na"}`
      ),
    ].join("|");

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.cartItemId === cartItemId);
      if (existing) {
        return prevCart.map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, cartItemId, quantity: 1 }];
    });
  };

  const handleLogin = async () => {
    setAuthBusy(true);
    setAuthError("");

    try {
      await loginWithGoogle();
    } catch (error) {
      setAuthError(
        error?.message || "Login start nahi ho paya. Supabase config check karo."
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    setAuthError("");

    try {
      await logoutUser();
      setPage("home");
    } catch (error) {
      setAuthError(error?.message || "Logout fail ho gaya.");
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="App">
      {/* HeaderBar receives user prop */}
      <HeaderBar
        search={search}
        setSearch={setSearch}
        setPage={navigateTo}
        cartCount={cart.length}
        user={user}
        authBusy={authBusy}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {loading ? (
          <Spinner />
        ) : page === "home" ? (
          <HomePage setPage={navigateTo} />
        ) : page === "login" ? (
          <LoginPage
            user={user}
            setPage={navigateTo}
            onLogin={handleLogin}
            authBusy={authBusy}
            authError={authError}
          />
        ) : page === "compare" ? (
          <ComparePage
            onAddToCart={handleAddToCart}
            setPage={navigateTo}
            STORES={STORES}
            search={search}
          />
        ) : page === "cart" ? (
          <CartPage
            cart={cart}
            setCart={setCart}
            setPage={navigateTo}
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
