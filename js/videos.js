/**
 * 筋トレ動画プレイリスト（Single Source of Truth）
 *
 * 【動画の追加・編集方法】
 * 新しい動画を追加したい場合や差し替えたい場合は、この配列を編集するだけで完了します。
 * - id: YouTube動画ID（例: https://www.youtube.com/watch?v=6p4K9HWTi20 の "6p4K9HWTi20" 部分）
 * - title: アプリ上に表示される動画タイトル
 * - duration: 動画の目安時間
 * - category: 部位・ジャンル（例: 全身, 腹筋, 背中, 脚）
 */
window.DEFAULT_WORKOUT_VIDEOS = [
  {
    id: "6p4K9HWTi20",
    title: "【変わりすぎ注意】継続すれば必ず体が変わる4分間筋トレ",
    duration: "4分",
    category: "全身・体幹"
  },
  {
    id: "CXwHm18n4Tk",
    title: "【5分】お腹・腰周りの浮き輪肉を落とす鬼の筋トレ【腹筋】",
    duration: "5分",
    category: "腹筋・ウエスト"
  },
  {
    id: "52xzTBcO6eQ",
    title: "【たった10回】騙されたと思って30日間この筋トレを試してみてください。",
    duration: "6分",
    category: "自重・全身"
  },
  {
    id: "y_fJvagpvk0",
    title: "【地獄の6分】自宅で強烈に追い込む！地獄の下半身トレーニング【脚トレ】",
    duration: "6分",
    category: "下半身・脚"
  },
  {
    id: "x3Jk1rDUTdM",
    title: "【3分】背筋トレーニング6種目！短時間で追い込む最強自重背筋【器具なし】",
    duration: "3分",
    category: "背筋・姿勢"
  },
  {
    id: "mk_yGB6BLKA",
    title: "知らないとヤバい！◯◯を知るだけで筋トレ効果倍増になる裏技を全て見せます",
    duration: "8分",
    category: "フォーム・効果UP"
  }
];

// 初期設定のフォールバック
window.WORKOUT_VIDEOS = window.DEFAULT_WORKOUT_VIDEOS;

