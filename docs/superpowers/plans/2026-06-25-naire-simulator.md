# 名入れシミュレーター Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shopify Admin に埋め込まれた React Router v7 アプリを構築し、各商品の `custom_simulator.config` メタフィールドを管理（登録・編集）できる画面を提供する。ストアフロント側のLiqual実装は別リポジトリ（`shop-moltensports-jp`）で行うため、このアプリはAdmin UI のみに専念する。

**Architecture:** React Router v7（Shopify App テンプレート）でアプリを生成する。Shopify Admin GraphQL API を通じて商品の metafield (`custom_simulator.config`) を読み書きする。

**Tech Stack:** Shopify CLI 3.x, React Router v7（Shopify App テンプレート）, Shopify Admin GraphQL API, Polaris（UIコンポーネント）

## Global Constraints

- メタフィールド namespace/key: `custom_simulator.config`（JSON型）
- React Router v7 の規約に従うこと（`shopify app init` が生成するテンプレートのまま使う）
- GraphQL の mutation は Shopify の `metafieldsSet` を使う
- Node.js: 18.x 以上
- テーマ側の Liquid 実装はこのリポジトリの対象外。設計はこのドキュメントの末尾に参照用として記載する。

---

## File Map

| ファイル | 役割 |
|---|---|
| `shopify.app.toml` | アプリ設定（CLI生成） |
| `app/routes/app._index.tsx` | 商品一覧。メタフィールド設定済み/未設定を区別して表示する |
| `app/routes/app.products.$id.tsx` | 商品ごとの `custom_simulator.config` 編集画面 |
| `app/graphql/products.ts` | 商品一覧取得・メタフィールド読み書きのGraphQLクエリ定数 |

---

## Task 1: Shopify App のスキャフォールド

**Files:**
- Generate: `shopify.app.toml`, `app/`, `package.json`（CLI生成）

**Interfaces:**
- Produces: `shopify app dev` が起動できる状態

> **注意:** `shopify app init` は対話型コマンドのため、ターミナルで手動実行する。

- [ ] **Step 1: Shopify CLI のバージョンを確認する**

```bash
shopify version
```

Expected output: `3.x.x` 系（3.60以上推奨）

- [ ] **Step 2: リポジトリルートでアプリを初期化する**

```bash
cd /Users/yuyawada/Helpful/naire-dev
shopify app init
```

プロンプトで以下を選択する：
- Template: **Start by adding your first extension** → No, start with app only
- Framework: **React Router** 
- Package manager: **npm**

> `docs/` フォルダは上書きされない。

- [ ] **Step 3: 依存パッケージをインストールする**

```bash
npm install
```

- [ ] **Step 4: `.gitignore` に `node_modules` と `.env` が含まれることを確認する**

```bash
grep -E "node_modules|\.env" .gitignore
```

両方が含まれていれば OK。

- [ ] **Step 5: 開発サーバーを起動して初期画面を確認する**

```bash
shopify app dev
```

Shopify Admin でアプリが開き、CLIが生成したデフォルト画面が表示されることを確認する。確認後 Ctrl+C で停止する。

- [ ] **Step 6: コミットする**

```bash
git add -A
git commit -m "feat: scaffold Shopify App with React Router template"
```

---

## Task 2: GraphQL クエリ定数の定義

**Files:**
- Create: `app/graphql/products.ts`

**Interfaces:**
- Produces:
  - `PRODUCTS_QUERY` — 商品一覧 + `custom_simulator.config` メタフィールドを取得する
  - `METAFIELDS_SET_MUTATION` — メタフィールドを登録・更新する

- [ ] **Step 1: `app/graphql/products.ts` を作成する**

```ts
export const PRODUCTS_QUERY = `#graphql
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          featuredImage {
            url
          }
          metafield(namespace: "custom_simulator", key: "config") {
            id
            value
          }
        }
      }
    }
  }
` as const;

export const METAFIELDS_SET_MUTATION = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        key
        value
      }
      userErrors {
        field
        message
      }
    }
  }
` as const;
```

- [ ] **Step 2: TypeScript のコンパイルが通ることを確認する**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミットする**

```bash
git add app/graphql/products.ts
git commit -m "feat: add GraphQL query constants for products and metafields"
```

---

## Task 3: 商品一覧画面（`app._index.tsx`）

**Files:**
- Modify: `app/routes/app._index.tsx`

**Interfaces:**
- Consumes: `PRODUCTS_QUERY`（Task 2）、`shopify.server.ts`（CLIが生成）の `authenticate.admin`
- Produces: 商品一覧を表示し、各商品の「設定済み/未設定」バッジと編集リンクを表示する

- [ ] **Step 1: `app/routes/app._index.tsx` を以下に書き換える**

```tsx
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  Thumbnail,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { PRODUCTS_QUERY } from "../graphql/products";
import type { LoaderFunctionArgs } from "@remix-run/node";

type Product = {
  id: string;
  title: string;
  featuredImage: { url: string } | null;
  metafield: { id: string; value: string } | null;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first: 50 },
  });
  const data = await response.json();
  const products: Product[] = data.data.products.edges.map(
    (e: { node: Product }) => e.node
  );
  return json({ products });
}

export default function Index() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <Page title="名入れシミュレーター - 商品一覧">
      <Layout>
        <Layout.Section>
          <Card>
            {products.length === 0 ? (
              <EmptyState
                heading="商品がありません"
                image=""
              >
                <p>Shopify管理画面に商品を追加してください。</p>
              </EmptyState>
            ) : (
              <ResourceList
                resourceName={{ singular: "商品", plural: "商品" }}
                items={products}
                renderItem={(product) => {
                  const numericId = product.id.replace(
                    "gid://shopify/Product/",
                    ""
                  );
                  return (
                    <ResourceItem
                      id={product.id}
                      url={`/app/products/${numericId}`}
                      media={
                        product.featuredImage ? (
                          <Thumbnail
                            source={product.featuredImage.url}
                            alt={product.title}
                            size="small"
                          />
                        ) : undefined
                      }
                    >
                      <Text as="h3" variant="bodyMd" fontWeight="bold">
                        {product.title}
                      </Text>
                      <div style={{ marginTop: "4px" }}>
                        {product.metafield ? (
                          <Badge tone="success">設定済み</Badge>
                        ) : (
                          <Badge tone="attention">未設定</Badge>
                        )}
                      </div>
                    </ResourceItem>
                  );
                }}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
```

- [ ] **Step 2: TypeScript のコンパイルを確認する**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: `shopify app dev` で画面を確認する**

商品一覧が表示され、メタフィールドが設定済みの商品に「設定済み」バッジ、未設定の商品に「未設定」バッジが表示されることを確認する。

- [ ] **Step 4: コミットする**

```bash
git add app/routes/app._index.tsx
git commit -m "feat: add product list page with metafield status badges"
```

---

## Task 4: 商品メタフィールド編集画面（`app.products.$id.tsx`）

**Files:**
- Create: `app/routes/app.products.$id.tsx`

**Interfaces:**
- Consumes: `PRODUCTS_QUERY`, `METAFIELDS_SET_MUTATION`（Task 2）、URLパラメータ `$id`（商品の数値ID）
- Produces:
  - 現在の `custom_simulator.config` の各フィールドをフォームで編集できる
  - 保存すると `metafieldsSet` mutation でメタフィールドを更新し、一覧ページへリダイレクトする

- [ ] **Step 1: `app/routes/app.products.$id.tsx` を作成する**

```tsx
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { PRODUCTS_QUERY, METAFIELDS_SET_MUTATION } from "../graphql/products";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

type SimulatorConfig = {
  box_top: number;
  box_left: number;
  box_width: number;
  box_height: number;
  max_characters: number;
  available_fonts: string[];
  default_font_color: string;
};

const DEFAULT_CONFIG: SimulatorConfig = {
  box_top: 35.5,
  box_left: 20.0,
  box_width: 60.0,
  box_height: 10.0,
  max_characters: 15,
  available_fonts: ["明朝体", "ゴシック体", "丸ゴシック"],
  default_font_color: "#FFFFFF",
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const gid = `gid://shopify/Product/${params.id}`;

  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first: 1 },
  });
  const data = await response.json();

  const product = data.data.products.edges
    .map((e: { node: { id: string; title: string; metafield: { value: string } | null } }) => e.node)
    .find((p: { id: string }) => p.id === gid);

  if (!product) throw new Response("Not Found", { status: 404 });

  const config: SimulatorConfig = product.metafield
    ? JSON.parse(product.metafield.value)
    : DEFAULT_CONFIG;

  return json({ product, config });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const config: SimulatorConfig = {
    box_top: parseFloat(formData.get("box_top") as string),
    box_left: parseFloat(formData.get("box_left") as string),
    box_width: parseFloat(formData.get("box_width") as string),
    box_height: parseFloat(formData.get("box_height") as string),
    max_characters: parseInt(formData.get("max_characters") as string, 10),
    available_fonts: (formData.get("available_fonts") as string)
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean),
    default_font_color: formData.get("default_font_color") as string,
  };

  const gid = `gid://shopify/Product/${params.id}`;
  const response = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: gid,
          namespace: "custom_simulator",
          key: "config",
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    },
  });
  const result = await response.json();
  const errors = result.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return json({ errors });
  }

  return redirect("/app");
}

export default function ProductEdit() {
  const { product, config } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Page
      title={product.title}
      backAction={{ content: "商品一覧", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.errors?.length > 0 && (
            <Banner tone="critical" title="保存に失敗しました">
              {actionData.errors.map((e: { message: string }, i: number) => (
                <p key={i}>{e.message}</p>
              ))}
            </Banner>
          )}
          <Card>
            <Form method="post">
              <FormLayout>
                <Text as="h2" variant="headingMd">テキスト配置設定（商品画像に対する%）</Text>
                <FormLayout.Group>
                  <TextField
                    label="上からの位置 box_top (%)"
                    name="box_top"
                    type="number"
                    defaultValue={String(config.box_top)}
                    autoComplete="off"
                  />
                  <TextField
                    label="左からの位置 box_left (%)"
                    name="box_left"
                    type="number"
                    defaultValue={String(config.box_left)}
                    autoComplete="off"
                  />
                </FormLayout.Group>
                <FormLayout.Group>
                  <TextField
                    label="横幅 box_width (%)"
                    name="box_width"
                    type="number"
                    defaultValue={String(config.box_width)}
                    autoComplete="off"
                  />
                  <TextField
                    label="高さ box_height (%)"
                    name="box_height"
                    type="number"
                    defaultValue={String(config.box_height)}
                    autoComplete="off"
                  />
                </FormLayout.Group>
                <TextField
                  label="最大文字数 max_characters"
                  name="max_characters"
                  type="number"
                  defaultValue={String(config.max_characters)}
                  autoComplete="off"
                />
                <TextField
                  label="フォント一覧（カンマ区切り）available_fonts"
                  name="available_fonts"
                  defaultValue={config.available_fonts.join(", ")}
                  helpText="例: 明朝体, ゴシック体, 丸ゴシック"
                  autoComplete="off"
                />
                <TextField
                  label="テキスト色 default_font_color（HEX）"
                  name="default_font_color"
                  defaultValue={config.default_font_color}
                  helpText="例: #FFFFFF"
                  autoComplete="off"
                />
                <Button submit variant="primary">保存する</Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
```

- [ ] **Step 2: TypeScript のコンパイルを確認する**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: `shopify app dev` で編集画面を確認する**

商品一覧から商品をクリックし、編集画面が開くことを確認する。

確認項目：
- 各フィールドに現在の値（またはデフォルト値）が入力済みになっている
- 値を変更して「保存する」を押すと一覧ページへリダイレクトされる
- 保存後、その商品のバッジが「設定済み」になっている
- Shopify Admin の「商品 > メタフィールド」で `custom_simulator.config` に値が入っていることを確認する

- [ ] **Step 4: コミットする**

```bash
git add app/routes/app.products.\$id.tsx
git commit -m "feat: add product metafield edit page"
```

---

## テーマ側の設計メモ（`shop-moltensports-jp` リポジトリで実装）

> **このアプリは実装しない。** テーマ担当者向けの設計参照用。

### 作成するファイル

| ファイル | 役割 |
|---|---|
| `templates/product.personalize.json` | `?view=personalize` で使われる代替テンプレート |
| `sections/main-product-personalize.liquid` | シミュレーター画面（HTML/CSS + JS）|
| `snippets/naire-button.liquid` | 商品ページ用「名入れする」ボタン |

### sessionStorage のキーと型

```ts
// キー名
sessionStorage.setItem('naire_config', JSON.stringify(config));

// 型（custom_simulator.config メタフィールドの JSON と同一）
type NaireConfig = {
  box_top: number;       // 商品画像上からの位置 (%)
  box_left: number;      // 商品画像左からの位置 (%)
  box_width: number;     // 配置枠の横幅 (%)
  box_height: number;    // 配置枠の高さ (%)
  max_characters: number;
  available_fonts: string[];
  default_font_color: string; // HEX
};
```

### カート追加リクエスト（`/cart/add.js`）

```js
{
  items: [
    {
      id: Number(parentVariantId), // メイン商品のVariant ID（URLの?parent_id=から取得）
      quantity: 1,
      properties: {
        '名入れテキスト': userInputText,
        'フォント': selectedFont
      }
    },
    {
      id: feeVariantId, // 名入れ料金商品のVariant ID（Liquidから埋め込む）
      quantity: 1
    }
  ]
}
```

### 遷移URL形式

```
/products/name-printing-fee?view=personalize&parent_id=<VARIANT_ID>
```

---

## Self-Review チェックリスト

### Spec Coverage
- [x] メタフィールド `custom_simulator.config` の登録・編集 → Task 3, 4
- [x] 商品一覧で設定済み/未設定を確認できる → Task 3
- [x] React Router v7 構成 → Task 1
- [x] Shopify Admin GraphQL API でメタフィールド読み書き → Task 2, 4
- [x] テーマ側の設計を参照用として記録 → テーマ側設計メモ
- [x] Line Item Properties に名入れ内容を記録する仕様 → テーマ側設計メモ

### Type Consistency
- `PRODUCTS_QUERY`（Task 2）→ `import { PRODUCTS_QUERY }`（Task 3, 4）: 一致
- `METAFIELDS_SET_MUTATION`（Task 2）→ `import { METAFIELDS_SET_MUTATION }`（Task 4）: 一致
- `SimulatorConfig` 型（Task 4）→ `NaireConfig` 型（テーマ設計メモ）: フィールド名・型は完全一致
