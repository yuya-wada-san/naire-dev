# 名入れシミュレーター Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shopify Online Store 2.0 のテーマに、商品画像上でリアルタイム名入れプレビューができる代替テンプレートと、メイン商品ページ用ボタンスニペットを追加する。

**Architecture:** `?view=personalize` の代替テンプレート（`product.personalize.json`）が `main-product-personalize` セクションを呼び出す。セクション内のVanilla JSが sessionStorage から配置設定を読み込み、商品画像上にテキストオーバーレイを生成する。カート追加時は Shopify Ajax API でメイン商品と名入れ料金商品を同時投入し、Line Item Properties に名入れ内容を記録する。

**Tech Stack:** Shopify Online Store 2.0, Liquid, Vanilla JS (ES6), CSS (Absolute Positioning), Shopify Ajax API (`/cart/add.js`)

## Global Constraints

- Vanilla JS のみ使用。外部ライブラリ・フレームワーク不可。
- テキスト配置座標はすべてピクセルではなく % で管理する。
- メタフィールド namespace/key: `custom_simulator.config`（JSON型）
- 名入れ料金商品のスラッグ: `name-printing-fee`（別途Shopify管理画面で作成済みが前提）
- カート追加は `/cart/add.js` の `items` 配列で2アイテム同時投入する。
- テスト環境: `shopify theme dev` を使用したローカルプレビュー（Shopify開発ストアが必要）

---

## File Map

| ファイル | 役割 |
|---|---|
| `templates/product.personalize.json` | 代替テンプレート定義。`main-product-personalize` セクションを参照する |
| `sections/main-product-personalize.liquid` | シミュレーター画面の全体（HTML構造・CSS・JS）を実装する |
| `snippets/naire-button.liquid` | メイン商品ページに埋め込む「名入れする」ボタン。sessionStorage保存と遷移を担当する |

---

## Task 1: 代替テンプレートの定義

**Files:**
- Create: `templates/product.personalize.json`

**Interfaces:**
- Produces: `?view=personalize` でアクセスした際に `main-product-personalize` セクションがレンダリングされる

- [ ] **Step 1: ファイルを作成する**

```json
{
  "sections": {
    "main": {
      "type": "main-product-personalize",
      "settings": {}
    }
  },
  "order": ["main"]
}
```

- [ ] **Step 2: ローカルで動作確認する**

```bash
shopify theme dev --store your-store.myshopify.com
```

ブラウザで `/products/name-printing-fee?view=personalize` を開き、Shopify が 404 でなく（セクションファイルがまだなくても）テンプレートを認識することを確認する。

- [ ] **Step 3: コミットする**

```bash
git add templates/product.personalize.json
git commit -m "feat: add product.personalize alternate template"
```

---

## Task 2: シミュレーター画面のHTML/CSS骨格

**Files:**
- Create: `sections/main-product-personalize.liquid`

**Interfaces:**
- Consumes: Task 1 の `product.personalize.json` からレンダリングを受ける
- Produces: 商品画像・入力フォーム・カートボタンが正しい2カラムレイアウトで表示される。JSは未実装の状態。

- [ ] **Step 1: HTML/CSS骨格を作成する**

`sections/main-product-personalize.liquid` を以下の内容で作成する:

```liquid
<style>
  .naire-simulator {
    display: flex;
    flex-wrap: wrap;
    gap: 40px;
    max-width: 1200px;
    margin: 40px auto;
    padding: 0 20px;
  }

  .naire-simulator__preview {
    flex: 1 1 400px;
  }

  .naire-simulator__image-wrapper {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  .naire-simulator__image-wrapper img {
    width: 100%;
    height: auto;
    display: block;
  }

  .naire-simulator__text-overlay {
    position: absolute;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.6);
    font-size: clamp(14px, 3vw, 28px);
    line-height: 1;
    overflow: hidden;
    white-space: nowrap;
  }

  .naire-simulator__form {
    flex: 1 1 300px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .naire-simulator__form h1 {
    font-size: 1.5rem;
    margin: 0;
  }

  .naire-simulator__input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .naire-simulator__input-group label {
    font-weight: bold;
    font-size: 0.9rem;
  }

  .naire-simulator__input-group input[type="text"] {
    width: 100%;
    padding: 10px 12px;
    font-size: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
  }

  .naire-char-count {
    font-size: 0.8rem;
    color: #888;
    text-align: right;
  }

  .naire-simulator__font-select {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .naire-simulator__font-select > span {
    font-weight: bold;
    font-size: 0.9rem;
  }

  .naire-font-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .naire-font-options button {
    padding: 8px 16px;
    border: 2px solid #ccc;
    background: #fff;
    cursor: pointer;
    border-radius: 4px;
    font-size: 0.9rem;
    transition: border-color 0.2s;
  }

  .naire-font-options button.is-active {
    border-color: #000;
    background: #f5f5f5;
  }

  .naire-add-to-cart-btn {
    padding: 14px 24px;
    background: #000;
    color: #fff;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    border-radius: 4px;
    transition: opacity 0.2s;
  }

  .naire-add-to-cart-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .naire-loading {
    font-size: 0.9rem;
    color: #555;
  }

  .naire-error {
    font-size: 0.9rem;
    color: #c00;
    padding: 10px;
    border: 1px solid #c00;
    border-radius: 4px;
  }

  .naire-config-error {
    text-align: center;
    padding: 40px 20px;
    color: #c00;
  }
</style>

<div class="naire-simulator" id="js-naire-simulator">
  <div class="naire-simulator__preview">
    <div class="naire-simulator__image-wrapper" id="js-image-wrapper">
      <img
        src="{{ product.featured_image | image_url: width: 800 }}"
        alt="{{ product.title | escape }}"
        id="js-product-image"
        width="800"
        height="800"
      >
      <div class="naire-simulator__text-overlay" id="js-text-overlay"></div>
    </div>
  </div>

  <div class="naire-simulator__form">
    <h1>{{ product.title | escape }}</h1>

    <div id="js-config-error" class="naire-config-error" style="display: none;">
      設定が正しく読み込まれませんでした。<br>
      <a href="{{ product.url }}">商品ページ</a>からやり直してください。
    </div>

    <div id="js-form-body">
      <div class="naire-simulator__input-group">
        <label for="naire-text-input">名入れテキスト</label>
        <input
          type="text"
          id="naire-text-input"
          placeholder="例：TANAKA"
          autocomplete="off"
        >
        <span class="naire-char-count" id="js-char-count">0/15</span>
      </div>

      <div class="naire-simulator__font-select">
        <span>フォント選択</span>
        <div class="naire-font-options" id="js-font-options"></div>
      </div>

      <button type="button" class="naire-add-to-cart-btn" id="js-add-to-cart">
        確定してカートに入れる
      </button>

      <div class="naire-loading" id="js-loading" style="display: none;">追加中...</div>
      <div class="naire-error" id="js-error" style="display: none;"></div>
    </div>
  </div>
</div>

<script>
  // Task 3 で JS を追加する
</script>

{% schema %}
{
  "name": "名入れシミュレーター",
  "settings": []
}
{% endschema %}
```

- [ ] **Step 2: ブラウザで表示を確認する**

`shopify theme dev` が起動中の状態で `/products/name-printing-fee?view=personalize` を開き、以下を確認する：
- 商品画像と入力フォームが2カラムで並ぶ
- スマホ幅（375px）に縮めた際に縦1カラムに折り返す
- 入力欄・フォント選択エリア・カートボタンが存在する

- [ ] **Step 3: コミットする**

```bash
git add sections/main-product-personalize.liquid
git commit -m "feat: add simulator section HTML/CSS skeleton"
```

---

## Task 3: シミュレーターのJS実装（初期化・プレビュー・カート追加）

**Files:**
- Modify: `sections/main-product-personalize.liquid`（`<script>` タグ内を置き換える）

**Interfaces:**
- Consumes:
  - `sessionStorage.getItem('naire_config')` → JSON文字列（`box_top`, `box_left`, `box_width`, `box_height`, `max_characters`, `available_fonts`, `default_font_color`）
  - URLクエリ `?parent_id=XXXXX` → メイン商品のVariant ID（数値）
  - Liquidから: `{{ product.variants.first.id }}` → 名入れ料金商品のVariant ID
- Produces:
  - 画像上のテキストオーバーレイがリアルタイムに更新される
  - 「確定してカートに入れる」押下で `/cart/add.js` が呼ばれ、カートページへ遷移する

- [ ] **Step 1: `<script>` タグ内を以下で置き換える**

`sections/main-product-personalize.liquid` の `<script>` タグ内（`// Task 3 で JS を追加する` の行）を以下で置き換える:

```js
(function () {
  var FEE_VARIANT_ID = {{ product.variants.first.id }};

  // --- 1. URLと sessionStorage からデータを取得 ---
  var params = new URLSearchParams(window.location.search);
  var parentVariantId = params.get('parent_id');

  var config = null;
  try {
    var raw = sessionStorage.getItem('naire_config');
    if (raw) config = JSON.parse(raw);
  } catch (e) {}

  // --- 2. 設定が取得できない場合はエラー表示して終了 ---
  if (!config || !parentVariantId) {
    document.getElementById('js-config-error').style.display = 'block';
    document.getElementById('js-form-body').style.display = 'none';
    return;
  }

  // --- 3. テキスト入力フィールドの文字数上限をメタフィールド値に設定 ---
  var textInput = document.getElementById('naire-text-input');
  var charCountEl = document.getElementById('js-char-count');
  var maxChars = config.max_characters || 15;
  textInput.maxLength = maxChars;
  charCountEl.textContent = '0/' + maxChars;

  // --- 4. バウンディングボックス（テキストオーバーレイ）を配置 ---
  var overlay = document.getElementById('js-text-overlay');
  overlay.style.top = config.box_top + '%';
  overlay.style.left = config.box_left + '%';
  overlay.style.width = config.box_width + '%';
  overlay.style.height = config.box_height + '%';
  overlay.style.color = config.default_font_color || '#FFFFFF';

  // --- 5. フォント選択ボタンを動的生成 ---
  var fontContainer = document.getElementById('js-font-options');
  var fonts = Array.isArray(config.available_fonts) && config.available_fonts.length > 0
    ? config.available_fonts
    : ['明朝体'];
  var selectedFont = fonts[0];

  fonts.forEach(function (font) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = font;
    btn.style.fontFamily = font;
    if (font === selectedFont) btn.classList.add('is-active');

    btn.addEventListener('click', function () {
      selectedFont = font;
      fontContainer.querySelectorAll('button').forEach(function (b) {
        b.classList.remove('is-active');
      });
      btn.classList.add('is-active');
      updatePreview();
    });

    fontContainer.appendChild(btn);
  });

  // --- 6. リアルタイムプレビュー更新 ---
  function updatePreview() {
    overlay.textContent = textInput.value;
    overlay.style.fontFamily = selectedFont;
    charCountEl.textContent = textInput.value.length + '/' + maxChars;
  }

  textInput.addEventListener('input', updatePreview);

  // 初期フォントをオーバーレイに適用
  overlay.style.fontFamily = selectedFont;

  // --- 7. カート追加 ---
  var addToCartBtn = document.getElementById('js-add-to-cart');
  var loadingEl = document.getElementById('js-loading');
  var errorEl = document.getElementById('js-error');

  addToCartBtn.addEventListener('click', function () {
    var text = textInput.value.trim();
    if (!text) {
      errorEl.textContent = '名入れテキストを入力してください。';
      errorEl.style.display = 'block';
      return;
    }

    addToCartBtn.disabled = true;
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            id: Number(parentVariantId),
            quantity: 1,
            properties: {
              '名入れテキスト': text,
              'フォント': selectedFont
            }
          },
          {
            id: FEE_VARIANT_ID,
            quantity: 1
          }
        ]
      })
    })
    .then(function (res) {
      if (!res.ok) {
        return res.json().then(function (data) {
          throw new Error(data.description || 'カートへの追加に失敗しました。');
        });
      }
      return res.json();
    })
    .then(function () {
      sessionStorage.removeItem('naire_config');
      window.location.href = '/cart';
    })
    .catch(function (err) {
      loadingEl.style.display = 'none';
      addToCartBtn.disabled = false;
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    });
  });
})();
```

- [ ] **Step 2: ブラウザでJS動作を確認する**

`/products/name-printing-fee?view=personalize&parent_id=DUMMY` を開いた状態でブラウザの開発者コンソールから以下を実行し、sessionStorageにモックデータを入れて動作確認する:

```js
sessionStorage.setItem('naire_config', JSON.stringify({
  box_top: 35.5,
  box_left: 20.0,
  box_width: 60.0,
  box_height: 10.0,
  max_characters: 15,
  available_fonts: ["明朝体", "ゴシック体", "丸ゴシック"],
  default_font_color: "#FFFFFF"
}));
location.reload();
```

リロード後、以下を確認する：
- テキスト入力欄に文字を打つと画像上のオーバーレイにリアルタイム反映される
- フォントボタンを押すとオーバーレイのフォントが切り替わる
- 文字数カウントが正しく動作する（最大15文字で入力不可になる）
- sessionStorageを空にしてリロードすると、エラーメッセージが表示される（フォームが非表示になる）

- [ ] **Step 3: 「確定してカートに入れる」の動作を確認する**

Shopify開発ストアで `parent_id` に実在するVariant IDを指定し、テキスト入力後にカートボタンを押す。

確認項目：
- `/cart` ページに遷移する
- カートにメイン商品と名入れ料金商品の2アイテムが入っている
- メイン商品のLine Item Properties に「名入れテキスト」と「フォント」が表示されている
- `sessionStorage` から `naire_config` が削除されている（開発者コンソールで確認）

- [ ] **Step 4: コミットする**

```bash
git add sections/main-product-personalize.liquid
git commit -m "feat: implement simulator JS - preview, font select, cart add"
```

---

## Task 4: メイン商品ページ用ボタンスニペット

**Files:**
- Create: `snippets/naire-button.liquid`

**Interfaces:**
- Consumes: `product.metafields.custom_simulator.config`（メタフィールドのJSON値）
- Produces:
  - メタフィールドが存在する商品ページにのみ「名入れする」ボタンが表示される
  - クリック時に `sessionStorage` に配置設定を保存し、`/products/name-printing-fee?view=personalize&parent_id=<variantId>` へ遷移する

- [ ] **Step 1: スニペットを作成する**

```liquid
{% if product.metafields.custom_simulator.config != blank %}
  {%- assign naire_config = product.metafields.custom_simulator.config | json -%}

  <button
    type="button"
    class="naire-trigger-btn"
    id="js-naire-trigger-{{ product.id }}"
    style="margin-top: 12px; padding: 12px 24px; background: #fff; border: 2px solid #000; cursor: pointer; font-size: 1rem; border-radius: 4px; width: 100%;"
  >
    名入れする
  </button>

  <script>
    (function () {
      var btn = document.getElementById('js-naire-trigger-{{ product.id }}');
      if (!btn) return;

      btn.addEventListener('click', function () {
        // 選択中のVariant IDを取得（標準テーマの hidden input[name="id"] から）
        var variantInput = document.querySelector('input[name="id"], select[name="id"]');
        var variantId = variantInput
          ? variantInput.value
          : '{{ product.selected_or_first_available_variant.id }}';

        var config = {{ naire_config }};
        sessionStorage.setItem('naire_config', JSON.stringify(config));

        window.location.href =
          '/products/name-printing-fee?view=personalize&parent_id=' + variantId;
      });
    })();
  </script>
{% endif %}
```

- [ ] **Step 2: 既存のメイン商品セクションにスニペットを挿入する**

テーマの `sections/main-product.liquid`（または相当するファイル）内の「カートに入れる」ボタン直後に以下を追加する:

```liquid
{% render 'naire-button' %}
```

※ファイル名と挿入箇所はテーマによって異なるため、実際のテーマ構造を確認してから実施すること。

- [ ] **Step 3: メイン商品ページで動作を確認する**

`custom_simulator.config` メタフィールドを設定済みの商品ページを開き、以下を確認する：
- 「名入れする」ボタンが表示されている
- メタフィールドが未設定の商品ページではボタンが表示されない
- バリアントを選択してから「名入れする」を押すと、正しいVariant IDがURLの `parent_id` に入る
- 遷移後の名入れページで `sessionStorage` からデータが正常に読み込まれ、シミュレーターが起動する

- [ ] **Step 4: コミットする**

```bash
git add snippets/naire-button.liquid
git commit -m "feat: add naire-button snippet for main product page"
```

---

## Self-Review チェックリスト

### Spec Coverage
- [x] 商品画像上にリアルタイムでテキストを重ねる → Task 3 の `updatePreview()`
- [x] フォント選択 → Task 3 のフォントボタン生成
- [x] `?view=personalize` 代替テンプレート → Task 1
- [x] sessionStorage への配置設定保存 → Task 4 スニペット
- [x] `parent_id` をURLクエリで渡す → Task 4 スニペット
- [x] sessionStorage から配置設定を読み込む → Task 3 の初期化処理
- [x] テキスト配置を% 座標で管理 → Task 2/3 でCSSのtop/left/width/heightを%で設定
- [x] `/cart/add.js` で2アイテム同時追加 → Task 3 のカート追加処理
- [x] Line Item Properties に名入れ内容を記録 → Task 3 の `properties` フィールド
- [x] `max_characters` で入力文字数制限 → Task 3 の `textInput.maxLength`
- [x] `available_fonts` をUIに反映 → Task 3 のフォントボタン生成
- [x] `default_font_color` をオーバーレイに適用 → Task 3 の `overlay.style.color`
- [x] メタフィールド未設定商品ではボタン非表示 → Task 4 の `{% if %}` 条件

### Type/Name Consistency
- `js-text-overlay`（Task 2 HTML）→ `document.getElementById('js-text-overlay')`（Task 3 JS）: 一致
- `js-font-options`（Task 2 HTML）→ `document.getElementById('js-font-options')`（Task 3 JS）: 一致
- `js-add-to-cart`（Task 2 HTML）→ `document.getElementById('js-add-to-cart')`（Task 3 JS）: 一致
- `js-loading`（Task 2 HTML）→ `document.getElementById('js-loading')`（Task 3 JS）: 一致
- `js-error`（Task 2 HTML）→ `document.getElementById('js-error')`（Task 3 JS）: 一致
- `is-active`（Task 2 CSS）→ `classList.add('is-active')`（Task 3 JS）: 一致
- `naire_config`（Task 4 sessionStorage key）→ `sessionStorage.getItem('naire_config')`（Task 3 JS）: 一致
