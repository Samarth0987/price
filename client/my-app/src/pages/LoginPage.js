import React from "react";
import "./LoginPage.css";

function LoginPage({ user, setPage, onLogin, authBusy, authError }) {
  const userName =
    user?.user_metadata?.full_name || user?.email || "You are already signed in.";

  return (
    <div className="loginpage-shell">
      <section className="loginpage-hero">
        <div className="loginpage-hero-copy">
          <p className="loginpage-eyebrow">Account Access</p>
          <h1 className="loginpage-title">Sign in to make Price Lens feel personal.</h1>
          <p className="loginpage-subtitle">
            Save your shopping flow, sync carts later, and keep one clean place for your
            product comparisons.
          </p>
        </div>

        <div className="loginpage-orbit loginpage-orbit-one"></div>
        <div className="loginpage-orbit loginpage-orbit-two"></div>
      </section>

      <section className="loginpage-card">
        {user ? (
          <div className="loginpage-state">
            <div className="loginpage-badge success">Signed in</div>
            <h2 className="loginpage-card-title">Welcome back</h2>
            <p className="loginpage-copy">{userName}</p>
            <div className="loginpage-actions">
              <button
                type="button"
                className="loginpage-primary-btn"
                onClick={() => setPage("compare")}
              >
                Continue to Compare
              </button>
              <button
                type="button"
                className="loginpage-secondary-btn"
                onClick={() => setPage("home")}
              >
                Back Home
              </button>
            </div>
          </div>
        ) : (
          <div className="loginpage-state">
            <div className="loginpage-badge">Google Sign-In</div>
            <h2 className="loginpage-card-title">One tap login, then straight back to the app.</h2>
            <p className="loginpage-copy">
              We are keeping auth simple for now: Google login only, with a guest path if
              you just want to compare prices.
            </p>

            {authError ? (
              <div className="loginpage-error" role="alert">
                {authError}
              </div>
            ) : (
              <div className="loginpage-tip">
                If sign-in does not open, the page will show the exact config problem here.
              </div>
            )}

            <div className="loginpage-actions">
              <button
                type="button"
                className="loginpage-primary-btn"
                onClick={onLogin}
                disabled={authBusy}
              >
                {authBusy ? "Connecting to Google..." : "Continue with Google"}
              </button>
              <button
                type="button"
                className="loginpage-secondary-btn"
                onClick={() => setPage("compare")}
              >
                Continue as Guest
              </button>
            </div>
          </div>
        )}

        <div className="loginpage-benefits">
          <article className="loginpage-benefit">
            <span className="loginpage-benefit-icon">1</span>
            <h3>Cleaner entry point</h3>
            <p>Users know exactly where sign-in starts instead of hunting inside the header.</p>
          </article>
          <article className="loginpage-benefit">
            <span className="loginpage-benefit-icon">2</span>
            <h3>Better error handling</h3>
            <p>OAuth or Supabase problems can be explained on-page without throwing users away.</p>
          </article>
          <article className="loginpage-benefit">
            <span className="loginpage-benefit-icon">3</span>
            <h3>Guest mode still works</h3>
            <p>Price comparison remains accessible even when login is optional or under repair.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default LoginPage;
