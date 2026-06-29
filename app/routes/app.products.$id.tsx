import { useState, useEffect } from "react";
import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  HeadersFunction,
} from "react-router";
import { useLoaderData, useActionData, Form, Link } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  PRODUCT_BY_ID_QUERY,
  METAFIELDS_SET_MUTATION,
} from "../graphql/products";
import { BoundingBoxEditor } from "../components/BoundingBoxEditor";

type SimulatorConfig = {
  box_top: number;
  box_left: number;
  box_width: number;
  box_height: number;
  font_size: number;
  max_characters: number;
  available_fonts: string[];
  default_font_color: string;
};

const DEFAULT_CONFIG: SimulatorConfig = {
  box_top: 35.5,
  box_left: 20.0,
  box_width: 60.0,
  box_height: 10.0,
  font_size: 24,
  max_characters: 15,
  available_fonts: ["明朝体", "ゴシック体", "丸ゴシック"],
  default_font_color: "#FFFFFF",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "14px",
  border: "1px solid #c9cccf",
  borderRadius: "4px",
  boxSizing: "border-box",
  marginTop: "4px",
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const gid = `gid://shopify/Product/${params.id}`;

  const response = await admin.graphql(PRODUCT_BY_ID_QUERY, {
    variables: { id: gid },
  });
  const data = await response.json();
  const product = data.data.product;

  if (!product) throw new Response("Not Found", { status: 404 });

  const config: SimulatorConfig = product.metafield
    ? JSON.parse(product.metafield.value)
    : DEFAULT_CONFIG;

  return { product, config };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const config: SimulatorConfig = {
    box_top: parseFloat(formData.get("box_top") as string),
    box_left: parseFloat(formData.get("box_left") as string),
    box_width: parseFloat(formData.get("box_width") as string),
    box_height: parseFloat(formData.get("box_height") as string),
    font_size: parseInt(formData.get("font_size") as string, 10),
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
  const errors: { field: string; message: string }[] =
    result.data?.metafieldsSet?.userErrors ?? [];

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true };
};

export default function ProductEdit() {
  const { product, config } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [box, setBox] = useState({
    top: config.box_top,
    left: config.box_left,
    width: config.box_width,
    height: config.box_height,
  });

  const [previewText, setPreviewText] = useState("");
  const [fontSizePx, setFontSizePx] = useState(config.font_size);
  const shopify = useAppBridge();

  useEffect(() => {
    if (!actionData) return;
    if (actionData.success) {
      shopify.toast.show("保存しました", { duration: 3000 });
    } else if (actionData.errors && actionData.errors.length > 0) {
      shopify.toast.show("保存に失敗しました", { isError: true, duration: 5000 });
    }
  }, [actionData, shopify]);

  return (
    <s-page heading={product.title} back-url="/app">

      <s-section heading="テキスト配置設定（画像上でドラッグして調整）">
        <Form method="post">
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <BoundingBoxEditor
              imageUrl={product.featuredImage?.url ?? ""}
              box={box}
              onChange={setBox}
              previewText={previewText}
              fontColor={config.default_font_color}
              fontSizePx={fontSizePx}
            />

            <label>
              <s-text>プレビュー文字（保存されません）</s-text>
              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="例：田中太郎"
                maxLength={config.max_characters}
                style={inputStyle}
              />
            </label>

            <input type="hidden" name="box_top" value={box.top} />
            <input type="hidden" name="box_left" value={box.left} />
            <input type="hidden" name="box_width" value={box.width} />
            <input type="hidden" name="box_height" value={box.height} />

            <label>
              <s-text>フォントサイズ font_size (px)</s-text>
              <input
                name="font_size"
                type="number"
                min="8"
                max="200"
                value={fontSizePx}
                onChange={(e) => setFontSizePx(Number(e.target.value))}
                style={inputStyle}
                required
              />
            </label>

            <label>
              <s-text>最大文字数 max_characters</s-text>
              <input
                name="max_characters"
                type="number"
                min="1"
                max="50"
                defaultValue={config.max_characters}
                style={inputStyle}
                required
              />
            </label>

            <label>
              <s-text>フォント一覧（カンマ区切り）</s-text>
              <input
                name="available_fonts"
                type="text"
                defaultValue={config.available_fonts.join(", ")}
                placeholder="例: 明朝体, ゴシック体, 丸ゴシック"
                style={inputStyle}
                required
              />
            </label>

            <label>
              <s-text>テキスト色 default_font_color（HEX）</s-text>
              <input
                name="default_font_color"
                type="text"
                defaultValue={config.default_font_color}
                placeholder="#FFFFFF"
                pattern="^#[0-9A-Fa-f]{6}$"
                style={inputStyle}
                required
              />
            </label>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                type="submit"
                style={{
                  padding: "10px 24px",
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                保存する
              </button>
              <Link
                to="/app"
                style={{
                  padding: "10px 24px",
                  background: "transparent",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                一覧に戻る
              </Link>
            </div>
          </div>
        </Form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
