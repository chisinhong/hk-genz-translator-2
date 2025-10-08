import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import TranslatorWidget from './components/Translator/TranslatorWidget';
import SimpleTest from './components/SimpleTest';
import AdPlaceholder from './components/common/AdPlaceholder';
import StatCard from './components/common/StatCard';
import Footer from './components/Footer';
import ContributionModal from './components/Contribution/ContributionModal';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import About from './pages/About';
import ProfilePage from './pages/Profile';
import MetaOAuthCallback from './pages/MetaOAuthCallback';
import { ContributionProvider } from './utils/ContributionContext';
import { TesterProvider, useTester } from './utils/TesterContext';
import { TranslationUsageProvider } from './utils/TranslationUsageContext';
import { AuthProvider } from './utils/AuthContext';
import { UpgradeModalProvider } from './components/Upgrade/UpgradeModalProvider';

const Theme = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-700 text-white font-sans">
    {children}
  </div>
);

function AppContent() {
  const { showTester } = useTester();
  const isDevelopment = import.meta.env.MODE === 'development';

  return (
    <>
      <ContributionModal />
      <Header />
      <main className="container mx-auto px-4 py-8 md:py-16 text-center">
        {/* <AdPlaceholder
          title="頁首橫幅廣告 (e.g. 970x90)"
          className="h-24 mb-8"
        /> */}
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-white mb-4">
            AI智能潮語翻譯器
          </h2>
          <p className="text-xl text-white/80 mb-8">
            將香港GenZ潮語翻譯成不同年代用語
          </p>
        </div>

        {/* 開發測試器 */}
        {showTester && isDevelopment && <SimpleTest />}

        {/* 主要翻譯器組件 */}
        <TranslatorWidget />
        <div className="max-w-3xl mx-auto mt-12">
          {/* <AdPlaceholder
            title="內容區塊廣告 (e.g. 300x250 or Responsive)"
            className="h-64"
          /> */}
        </div>

        <div className="mt-20">
          <h3 className="text-2xl font-bold mb-6">📊 即時統計</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <StatCard
              icon="👥"
              value="12,847"
              label="總用戶"
              percentage="+20%"
            />
            <StatCard
              icon="💬"
              value="3,256"
              label="今日翻譯"
              percentage="+5%"
            />
            <StatCard icon="✨" value="+892" label="本週新詞" percentage="" />
            <StatCard icon="⏱️" value="0.3s" label="平均響應" percentage="" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

// 外層包住 Provider
function App() {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.dumpIdToken = async () => {
      try {
        const auth = getAuth();
        if (!auth.currentUser) {
          console.warn('No Firebase user is signed in.');
          return null;
        }
        const token = await auth.currentUser.getIdToken(true);
        console.log('Firebase ID token:', token);
        return token;
      } catch (error) {
        console.error('Failed to fetch ID token:', error);
        return null;
      }
    };
  }

  return (
    <TesterProvider>
      <ContributionProvider>
        <AuthProvider>
          <TranslationUsageProvider>
            <UpgradeModalProvider>
              <Theme>
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<AppContent />} />
                    <Route path="/settings" element={<ProfilePage />} />
                    <Route path="/meta-callback" element={<MetaOAuthCallback />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/about" element={<About />} />
                  </Routes>
                </BrowserRouter>
              </Theme>
            </UpgradeModalProvider>
          </TranslationUsageProvider>
        </AuthProvider>
      </ContributionProvider>
    </TesterProvider>
  );
}

export default App;
import { getAuth } from 'firebase/auth';
