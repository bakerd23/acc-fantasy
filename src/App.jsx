import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Standings from './pages/Standings';
import Matchups from './pages/Matchups';
import Teams from './pages/Teams';
import FreeAgents from './pages/FreeAgents';

function App() {
  return (
    <Router>
      <div className="app">
        <header className="header">
          <h1>🏀 ACC Fantasy Basketball</h1>
          <nav className="nav">
            <Link to="/">Standings</Link>
            <Link to="/matchups">Matchups</Link>
            <Link to="/teams">Teams</Link>
            <Link to="/free-agents">Free Agents</Link>
          </nav>
        </header>
        
        <main className="main">
          <Routes>
            <Route path="/" element={<Standings />} />
            <Route path="/matchups" element={<Matchups />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/free-agents" element={<FreeAgents />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;