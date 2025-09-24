import BackButton from '../components/common/BackButton';

const Terms = () => (
  <main className="container relative mx-auto px-4 py-12 md:py-16 text-center text-white">
    <BackButton className="absolute left-4 top-4" />
    <div className="mx-auto max-w-4xl rounded-2xl bg-white/10 p-8 backdrop-blur-lg">
      <h1 className="text-3xl font-bold mb-6">服務條款</h1>
      <div className="space-y-4 text-white/90">
        <p>最後更新：2025年9月</p>

        <h2 className="text-xl font-bold">服務使用</h2>
        <p>本服務提供香港潮語翻譯，僅供參考使用。</p>

        <h2 className="text-xl font-bold">用戶責任</h2>
        <p>用戶應當合理使用服務，不得進行惡意攻擊或濫用。</p>

        <h2 className="text-xl font-bold">免責聲明</h2>
        <p>翻譯結果僅供參考，我們不對翻譯準確性承擔法律責任。</p>
      </div>
    </div>
  </main>
);

export default Terms;
