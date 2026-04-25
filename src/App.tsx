import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LargeTextView from './views/LargeTextView'

function App() {
  return (
    <Router future={{ v7_relativeSplatPath: true }}>
      <div className="h-screen overflow-hidden">
        <Routes>
          <Route path="/" element={<LargeTextView />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
