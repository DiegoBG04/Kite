/**
 * App.jsx — Router and Layout Shell
 *
 * Purpose: Defines client-side routing using React Router.
 * Three routes: Dashboard (/), News (/news), Profile (/profile).
 * The nav bar is rendered here so it persists across all pages.
 *
 * TODO (Step 8): Add a nav bar component once the design pass begins.
 */

import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import News from "./pages/News";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <BrowserRouter>
      {/* Top navigation — no styling yet, that comes in the design pass */}
      <nav>
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/news">News</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>

      <main>
        <Routes>
          <Route path="/"        element={<Dashboard />} />
          <Route path="/news"    element={<News />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
