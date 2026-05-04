import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { AgentProvider } from './context/AgentContext';
import { useAgentSystem } from './context/AgentContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import BottomNav from './components/layout/BottomNav';
import LoginPage from './pages/LoginPage';
import DiscoverPage from './pages/DiscoverPage';
import TrackPage from './pages/TrackPage';
import ProfilePage from './pages/ProfilePage';
import AIChatPage from './pages/AIChatPage';
import AboutPage from './pages/AboutPage';
import ApplicationDetailPage from './pages/ApplicationDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import { CVUpload } from './components/CVUpload';

// Inner component — has access to AgentContext
function AppShell({ onLogout }: { onLogout: () => void }) {
  const { agentState } = useAgentSystem();

  // Show CV upload screen until agents are done
  if (!agentState.isReady) {
    return <CVUpload />;
  }

  // Agents done — show the full app
  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/track" element={<TrackPage />} />
          <Route path="/profile" element={<ProfilePage onLogout={onLogout} />} />
          <Route path="/ai-chat" element={<AIChatPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/application/:id" element={<ApplicationDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

function App() {
   console.log('KEY CHECK GEMINI:', import.meta.env.VITE_GEMINI_API_KEY?.slice(0, 15))
console.log('KEY CHECK OR:', import.meta.env.VITE_OPENROUTER_API_KEY?.slice(0, 15))
console.log('ALL ENV:', import.meta.env)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('cm_authenticated') === 'true' && !!localStorage.getItem('cm_token');
  });

  useEffect(() => {
    const handleStorage = () => {
      const hasToken = !!localStorage.getItem('cm_token');
      const hasAuth = localStorage.getItem('cm_authenticated') === 'true';
      setIsAuthenticated(hasToken && hasAuth);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogin = (token: string) => {
    localStorage.setItem('cm_token', token);
    localStorage.setItem('cm_authenticated', 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('cm_authenticated');
    localStorage.removeItem('cm_token');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <ThemeProvider>
        <LoginPage onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <UserProvider>
        <AppProvider>
          <AgentProvider>
            <AppShell onLogout={handleLogout} />
          </AgentProvider>
        </AppProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;
