import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import LandingPage from './pages/LandingPage';
import InteractivePage from './pages/InteractivePage';
import DisplayPage from './pages/DisplayPage';
import AdminPage from './pages/AdminPage';
import InstallPrompt from './components/shared/InstallPrompt';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/:slug" element={<InteractivePage />} />
        <Route path="/:slug/display" element={<DisplayPage />} />
        <Route path="/:slug/admin" element={<AdminPage />} />
      </Routes>
      <InstallPrompt />
    </AuthProvider>
  );
}

export default App;
