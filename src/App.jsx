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
import { ContributionProvider } from './utils/ContributionContext';
import { TesterProvider, useTester } from './utils/TesterContext';

const Theme = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-700 text-white font-sans">
    <Header />
    {children}
    <Footer />
  </div>
);

function AppContent() {
  const { showTester } = useTester();

  return (
    <>
      <ContributionModal />
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
        {showTester && process.env.NODE_ENV === 'development' && <SimpleTest />}

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
    </>
  );
}

// 外層包住 Provider
function App() {
  return (
    <TesterProvider>
      <ContributionProvider>
        <Theme>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppContent />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </BrowserRouter>
        </Theme>
      </ContributionProvider>
    </TesterProvider>
  );
}

export default App;
