# 筋トレ用YouTubeメニュー選定PWA

iPhoneのSafariから「ホーム画面に追加」してすぐ使える、筋トレ用YouTube動画選定PWA（Progressive Web App）です。  
厳選されたプレイリストから「今日のメニュー」をランダムに1本選んで、アプリ内でそのままYouTube再生できます。

---

## 主な機能

- 🎲 **ワンタップで選定**: 「今日のメニューを選ぶ」を押すと、軽快なシャッフル演出とともにランダムで1本動画を決定
- 🔄 **再選定**: 気分に合わせて「別のメニューにする」で即座に別の動画を選び直し
- 📺 **インライン再生**: ページ内でスムーズにYouTube動画を埋め込み再生（`playsinline` 対応）
- ⚙️ **アプリ画面上での動画管理**:
  - 「動画を管理」ボタンから、YouTubeのURLや動画IDを貼り付けるだけで新しい動画を即座に追加
  - 登録中の動画をワンタップ削除（誤タップ防止の2ステップ確認付き）
  - ローカルストレージ（`localStorage`）に永続保存＆「初期リストに戻す」ボタンでいつでも復元可能
- 📋 **全メニュー一覧**: プレイリスト内の動画一覧を確認し、手動で直接選んで再生することも可能
- 📱 **PWA & iPhoneホーム画面対応**:
  - Web App Manifest / Service Worker完備
  - フルスクリーン表示（`standalone`）
  - アプリアイコン（Apple Touch Icon / 192px / 512px / SVG）
  - iPhoneのノッチ・セーフエリア（`env(safe-area-inset-*)`）最適化
- ⚡ **超軽量＆ゼロビルド**:
  - ビルド不要の Vanilla HTML / CSS / JavaScript
  - GitHub Pagesで無料・即座にホスティング可能

---

## 動画一覧の管理方法

### 方法1: アプリ画面上の「動画を管理」から操作（推奨・ノーコード）
1. 画面右上の **「⚙️ 動画を管理」** をタップします。
2. YouTubeのURL（例: `https://youtu.be/xxxxxx` や `https://www.youtube.com/watch?v=xxxxxx`）とタイトルを入力して **「リストに追加する」** をタップ。
3. 自動でIDが抽出され、お使いの端末（iPhone / PC）の `localStorage` に保存されます。
4. いつでも動画の削除や「初期リストに戻す」が可能です。

### 方法2: コードベースで初期リストを編集（`js/videos.js`）
アプリの初期プリセット動画を変更したい場合は、[`js/videos.js`](js/videos.js) を編集します。

```javascript
window.DEFAULT_WORKOUT_VIDEOS = [
  {
    id: "6p4K9HWTi20", // YouTube URLの「v=」以降の11桁のID
    title: "【変わりすぎ注意】継続すれば必ず体が変わる4分間筋トレ",
    duration: "4分",
    category: "全身・体幹"
  },
  // 初期プリセットをここに追加・変更...
];
```

---

## iPhoneでの使い方（ホーム画面に追加）

1. iPhoneのSafariで本アプリのURLを開きます。
2. 画面下部の中央にある **「共有」ボタン（四角形から上向き矢印が出ているアイコン）** をタップします。
3. メニューをスクロールし、**「ホーム画面に追加」** をタップします。
4. ホーム画面に専用アイコンが配置され、タップするとSafariのアドレスバーなしのフルスクリーンアプリとして起動します。

---

## GitHub Pages での公開手順

### パターンA: 独立リポジトリとして公開する場合（推奨）
1. GitHubで新規リポジトリ（例: `workout-pwa`）を作成します。
2. 本フォルダ（`Projects/workout-pwa`）をGit初期化してリモートにプッシュします：
   ```bash
   cd Projects/workout-pwa
   git init
   git add .
   git commit -m "feat: initial commit for workout-pwa"
   git remote add origin https://github.com/ChibaKei/workout-pwa.git
   git branch -M main
   git push -u origin main
   ```
3. GitHubリポジトリの **Settings > Pages** で「Deploy from a branch」を選び、`main` / `root` を保存します。
4. 数分で `https://chibakei.github.io/workout-pwa/` に公開されます。

### パターンB: STRATUSリポジトリのGitHub Actions等で公開する場合
- 相対パス（`./`）で全リソースを参照しているため、任意のサブディレクトリでも正常に動作します。
