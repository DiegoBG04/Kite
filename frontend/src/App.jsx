/**
 * App.jsx — Router and Layout Shell
 */

import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import News from "./pages/News";
import Profile from "./pages/Profile";
import { useTheme } from "./hooks/useTheme";

const navStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0",
  padding: "0 24px",
  height: "52px",
  background: "var(--kite-surface)",
  borderBottom: "1px solid var(--kite-border)",
  position: "sticky",
  top: 0,
  zIndex: 100,
};

const wordmarkStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "20px",
  color: "var(--kite-heading)",
  marginRight: "32px",
  letterSpacing: "-0.01em",
};

const linkStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "13px",
  color: "var(--kite-muted)",
  padding: "6px 12px",
  borderRadius: "var(--radius-sm)",
  textDecoration: "none",
  transition: "color 0.15s",
  letterSpacing: "0.02em",
};

const activeLinkStyle = {
  ...linkStyle,
  color: "var(--kite-amber-dark)",
  fontWeight: "600",
};

export default function App() {
  useTheme(); // applies data-theme to <html> on mount and when changed
  return (
    <BrowserRouter>
      <nav style={navStyle}>
        <span style={wordmarkStyle}>Kite</span>
        <NavLink to="/" style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>
          Dashboard
        </NavLink>
        <NavLink to="/news" style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>
          News
        </NavLink>
        <NavLink to="/profile" style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>
          Profile
        </NavLink>
      </nav>

      <main style={{ height: "calc(100vh - 52px)", overflow: "hidden" }}>
        <Routes>
          <Route path="/"        element={<Dashboard />} />
          <Route path="/news"    element={<News />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
