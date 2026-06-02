import Link from "next/link";

export const metadata = {
  title: "個人情報の取扱いについて | 出願システム",
};

// ⚠️ これはテンプレートです。実際の運用前に学園・法務で内容を確定してください。
// 事業者名・連絡先・委託先・保存期間などは貴学園の実態に合わせて記載すること。
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">個人情報の取扱いについて</h1>
        <p className="text-sm text-gray-500 mb-8">最終更新日：____年__月__日</p>

        <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="font-bold text-gray-800 mb-2">1. 事業者</h2>
            <p>学校法人 平井学園（以下「当学園」）<br />住所：____<br />お問い合わせ窓口：入学相談室（____／受付時間 平日9:00〜17:00）</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">2. 取得する個人情報</h2>
            <p>本出願システムでは、以下の情報を取得します。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>氏名・氏名カナ・生年月日・性別・国籍</li>
              <li>連絡先（電話番号・メールアドレス）および住所</li>
              <li>在留資格・在留期限などの在留情報</li>
              <li>日本語能力・学歴・職務経歴・志望動機</li>
              <li>提出書類（パスポート・在留カード・各種証明書・写真等の画像/PDF）</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">3. 利用目的</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>出願の受付・本人確認・選考（書類審査・面接）</li>
              <li>選考料・学費に関する案内および確認</li>
              <li>合否および入学手続きに関する連絡</li>
              <li>入学後の学籍管理に必要な範囲での引継ぎ</li>
              <li>法令に基づく対応、お問い合わせへの回答</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">4. 第三者提供・委託</h2>
            <p>
              法令に基づく場合を除き、ご本人の同意なく第三者へ提供しません。
              利用目的の達成に必要な範囲で、メール配信・システム運用等の業務を委託する場合があり、
              委託先に対しては適切な監督を行います。（委託先例：____）
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">5. 保存期間</h2>
            <p>
              取得した個人情報は、利用目的の達成に必要な期間（____）保存し、期間経過後は適切に消去します。
              不合格・辞退となった場合の保存期間は ____ とします。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">6. 安全管理</h2>
            <p>
              取得した個人情報は、暗号化通信（HTTPS）の利用、アクセス権限の制限、提出書類の非公開保管など、
              漏えい・滅失・毀損の防止のために必要かつ適切な措置を講じます。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">7. ご本人の権利</h2>
            <p>
              ご本人は、当学園が保有する自己の個人情報について、開示・訂正・利用停止・削除等を請求できます。
              上記お問い合わせ窓口までご連絡ください。
            </p>
          </section>

          <section className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
            ※ 本ページはテンプレートです。空欄（____）の記載および内容は、公開前に必ず確定してください。
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <Link href="/apply" className="text-sm text-blue-600 underline hover:text-blue-800">← 出願フォームへ戻る</Link>
        </div>
      </div>
    </main>
  );
}
