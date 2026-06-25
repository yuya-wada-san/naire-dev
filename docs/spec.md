# 📋 Shopify Custom Product Simulator App - Full Specification

## 1. Overview (概要)
本プロジェクトは、自社Shopifyストア専用に開発する「商品名入れシミュレーター（カスタム名入れページ）」の技術仕様書である。
通常の商品ページとは別に「名入れ専用の代替テンプレート（?view=naire）」を用意し、購入者がテキスト入力やフォント選択を行った際、ボールなどの商品画像の上にリアルタイムでテキストを重ねて表示（シミュレート）する。
また、名入れ料金を別途徴収するため、購入時は「メイン商品」と「名入れ料金（専用の別商品）」の2つのアイテムを、Shopify Ajax APIを用いて裏側で同時にカートへ投入する。

---

## 2. System Flow (ユーザー動線とシステムフロー)

1. **[メイン商品ページ（例: ボール商品）]**
   - ユーザーが「名入れする」ボタンをクリックする。
   - JavaScriptが起動し、名入れ専用商品のURLへ遷移させる。その際、メイン商品の **Variant ID** と **商品ハンドル** の2つをクエリとして付与する。
     - 遷移先URL例: `/products/name-printing-fee?view=naire&parent_id=XXXXX&parent_handle=my-ball`

2. **[名入れ専用ページ (`?view=naire`)]**
   - Shopifyの代替テンプレート機能により、専用の画面（シミュレーター画面）がレンダリングされる。
   - クエリパラメータから `parent_handle` を取得し、`/products/<parent_handle>?view=metafield-config` へフェッチしてメタフィールドのJSON設定を取得する。
   - 取得した設定に基づき、商品画像の上にテキスト入力枠（バウンディングボックス）を生成する。
   - クエリパラメータから `parent_id` (メイン商品のVariant ID) を取得して保持する。
   - ユーザーがテキストを入力、またはフォントを選択すると、画像の上にリアルタイムに反映される。

3. **[カート追加（同時購入）]**
   - ユーザーが「確定してカートに入れる」ボタンを押下した際、標準のフォーム送信をインターセプト（ブロック）する。
   - Shopify Ajax API (`/cart/add.js`) を呼び出し、「メイン商品」と「名入れ専用商品」の2つのVariant IDを一括でカートに追加する。
   - メイン商品のカートアイテムには `properties` を付与し、ユーザーが入力した名入れ内容（テキスト・フォント）をLine Item Propertiesとして記録する。名入れ専用商品には `properties` 不要。

```js
// カート追加のリクエスト例
{
  items: [
    {
      id: parentVariantId,
      quantity: 1,
      properties: {
        "名入れテキスト": userInputText,
        "フォント": selectedFont
      }
    },
    {
      id: feeVariantId,
      quantity: 1
    }
  ]
}
```

---

## 3. Tech Stack & Files (技術スタックと作成ファイル)

### このリポジトリ（`naire-dev`）が担う範囲
- **Framework**: Shopify App（React Router v7）
- **役割**: 各商品の `custom_simulator.config` メタフィールドを管理するShopify Admin埋め込みUI
- **App Configuration**: `shopify.app.toml`

```
naire-dev/
├── app/
│   ├── routes/
│   │   ├── app._index.tsx       # 商品一覧（メタフィールド設定済み/未設定）
│   │   └── app.products.$id.tsx # 商品ごとのメタフィールド編集画面
│   └── shopify.server.ts
├── docs/
├── shopify.app.toml
└── package.json
```

### テーマ側（別リポジトリ）が担う範囲
- **リポジトリ**: `/Users/yuyawada/Home/Prestige/shop-moltensports-jp`
- テーマファイルは直接編集するため、このリポジトリでは管理しない
- 名入れボタンの遷移URL形式のみ参照用として記載する（下記）

---

## 4. Data Structure (メタフィールド設計)
レスポンシブ（PC/スマホ）に完全対応するため、テキスト配置枠の座標とサイズはピクセル（px）ではなく、**画像に対するパーセンテージ（%）**で管理する。
各商品（メイン商品）のメタフィールド（JSON型）に、あらかじめ以下の形式で配置データを登録しておく。

- **Namespace / Key**: `custom_simulator.config`
- **Type**: `json`

### JSONデータ例
```json
{
  "box_top": 35.5,
  "box_left": 20.0,
  "box_width": 60.0,
  "box_height": 10.0,
  "max_characters": 15,
  "available_fonts": ["明朝体", "ゴシック体", "丸ゴシック"],
  "default_font_color": "#FFFFFF"
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `box_top` | number | 商品画像の上からの配置位置（%） |
| `box_left` | number | 商品画像の左からの配置位置（%） |
| `box_width` | number | 配置枠の最大横幅（%） |
| `box_height` | number | 配置枠の最大高さ（%） |
| `max_characters` | number | ユーザーが入力できる最大文字数 |
| `available_fonts` | string[] | 選択可能なフォントの一覧 |
| `default_font_color` | string | テキストのデフォルト表示色（HEX） |
