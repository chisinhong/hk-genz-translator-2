import BackButton from '../components/common/BackButton';

const About = () => (
  <main className="container relative mx-auto px-4 py-12 md:py-16 text-center text-white">
    <BackButton className="absolute left-4 top-4" />
    <div className="mx-auto max-w-4xl rounded-2xl bg-white/10 p-8 backdrop-blur-lg">
      <h1 className="text-3xl font-bold mb-6">關於 HK GenZ Translator</h1>
      <div className="space-y-4 text-white/90">
        <p>
          HK GenZ Translator 致力於透過 AI
          協助不同世代理解最新的香港潮語與流行文化。
        </p>
        <p>
          我們的團隊由對語言與科技充滿熱誠的開發者組成，持續蒐集並更新潮語資料庫，讓翻譯結果更貼近真實語境。
        </p>
        <p>如果你有建議或想加入我們的貢獻者行列，歡迎聯繫：team@hkgenz.com。</p>
      </div>
    </div>
  </main>
);

export default About;
