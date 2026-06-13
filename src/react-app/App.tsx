import { Link } from "react-router-dom";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>AI Hiring Screener</h1>
        <p>Semantic resume scoring powered by Cloudflare Workers AI</p>
      </header>
      <main className="main">
        <p>Project setup complete. Backend API is running at <code>/api/health</code>.</p>
        <p>Next steps: database schema, job creation, resume scoring, and live leaderboard.</p>
        <Link to="/" className="link">
          Home
        </Link>
      </main>
    </div>
  );
}

export default App;
