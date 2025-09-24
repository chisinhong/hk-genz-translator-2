import BackButton from '../components/common/BackButton';

const PrivacyPolicy = () => (
  <main className="container relative mx-auto px-4 py-12 md:py-16 text-center text-white">
    <BackButton className="absolute left-4 top-4" />
    <div className="max-w-4xl mx-auto rounded-2xl bg-white/10 p-8 backdrop-blur-lg">
      <h1 className="text-3xl font-bold mb-6">隱私政策</h1>
      <div className="space-y-4 text-white/90">
        <p>最後更新：2025年9月</p>
        <h2 className="text-xl font-bold">收集的信息</h2>
        <p>我們收集您使用翻譯服務時的匿名使用數據，用於改善服務品質。</p>

        <h2 className="text-xl font-bold">Cookie 使用</h2>
        <p>我們使用 Cookie 來提供個性化體驗和分析網站使用情況。</p>

        <h2 className="text-xl font-bold">第三方廣告</h2>
        <p>
          我們使用 Google AdSense 顯示廣告，Google 可能會使用 Cookie
          提供相關廣告。
        </p>

        <h2 className="text-xl font-bold">聯繫我們</h2>
        <p>如有隱私相關問題，請聯繫：privacy@hkgenz.com</p>
      </div>
    </div>
  </main>
);

export default PrivacyPolicy;
