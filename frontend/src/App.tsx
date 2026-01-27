import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Tournaments from './pages/Tournaments'
import TournamentDetail from './pages/TournamentDetail'
import Teams from './pages/Teams'
import TeamDetail from './pages/TeamDetail'
import Matches from './pages/Matches'
import MatchDetail from './pages/MatchDetail'
import LiveScoring from './pages/LiveScoring'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/tournaments/:id" element={<TournamentDetail />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/matches/:id" element={<MatchDetail />} />
          <Route path="/matches/:id/scoring" element={<LiveScoring />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
