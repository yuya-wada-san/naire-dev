# 名入れシミュレーター - Shopify 管理アプリ

Shopify に組み込む名入れシミュレーター用の管理画面アプリです。商品ごとに「テキスト配置エリア」を視覚的に設定し、その設定値をメタフィールドに保存します。

## 機能概要

### 商品一覧画面 (`/app`)

- ストア内の商品（最大50件）を一覧表示
- 各商品に名入れシミュレーター設定が存在するかを「設定済み / 未設定」で表示
- 商品サムネイル・タイトル・設定状態を一覧で確認できる

### 商品設定画面 (`/app/products/:id`)

- 商品画像の上にドラッグ＆ドロップでテキスト配置エリア（バウンディングボックス）を調整
- 8方向のリサイズハンドル付き（四隅＋上下左右）
- プレビュー文字を入力して実際の見た目を確認可能（保存はされない）
- 以下の設定値を保存できる：

| 設定項目 | フィールド名 | 説明 |
|---|---|---|
| テキストエリア上端 | `box_top` | 画像全体に対する % |
| テキストエリア左端 | `box_left` | 画像全体に対する % |
| テキストエリア幅 | `box_width` | 画像全体に対する % |
| テキストエリア高さ | `box_height` | 画像全体に対する % |
| フォントサイズ | `font_size` | px 単位 |
| 最大文字数 | `max_characters` | 入力制限文字数 |
| 使用フォント一覧 | `available_fonts` | カンマ区切りで複数指定 |
| テキスト色 | `default_font_color` | HEX カラーコード（例: `#FFFFFF`）|

設定値は Shopify メタフィールド（namespace: `custom_simulator`, key: `config`）に JSON 形式で保存されます。

## 技術スタック

- **フレームワーク**: React Router v7（Shopify App React Router テンプレート）
- **UI**: Shopify Polaris Web Components（`<s-page>`, `<s-section>` など）
- **認証**: Shopify App Bridge / `@shopify/shopify-app-react-router`
- **DB（セッション管理）**: Prisma + SQLite
- **データ永続化**: Shopify メタフィールド（Admin GraphQL API）

## ディレクトリ構成

```
app/
├── components/
│   └── BoundingBoxEditor.tsx   # ドラッグ操作でボックスを編集するコンポーネント
├── graphql/
│   └── products.ts             # GraphQL クエリ・ミューテーション定義
├── routes/
│   ├── app._index.tsx          # 商品一覧画面
│   └── app.products.$id.tsx    # 商品設定画面
└── shopify.server.ts           # Shopify 認証設定
```

## メタフィールド仕様

| 項目 | 値 |
|---|---|
| namespace | `custom_simulator` |
| key | `config` |
| type | `json` |
| owner | Product |

保存される JSON の例：

```json
{
  "box_top": 35.5,
  "box_left": 20.0,
  "box_width": 60.0,
  "box_height": 10.0,
  "font_size": 24,
  "max_characters": 15,
  "available_fonts": ["明朝体", "ゴシック体", "丸ゴシック"],
  "default_font_color": "#FFFFFF"
}
```

## ローカル開発

```shell
# 依存パッケージのインストール
pnpm install

# DB セットアップ
pnpm run setup

# 開発サーバー起動
shopify app dev
```

起動後、Shopify 管理画面の「アプリ」から本アプリを開きます。

## アクセス権限

`shopify.app.toml` で以下のスコープを要求しています：

- `write_products` — 商品メタフィールドの読み書き
- `write_metaobjects` / `write_metaobject_definitions` — メタオブジェクト操作（将来拡張用）

## デプロイ

```shell
pnpm run build
shopify app deploy
```

本番環境の詳細は [Shopify デプロイドキュメント](https://shopify.dev/docs/apps/launch/deployment) を参照してください。
