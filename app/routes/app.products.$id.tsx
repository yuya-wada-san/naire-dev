import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  HeadersFunction,
} from "react-router";
import { useLoaderData, useActionData, Form, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  PRODUCT_BY_ID_QUERY,
  METAFIELDS_SET_MUTATION,
} from "../graphql/products";

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
    return { errors };
  }

  return redirect("/app");
};

export default function ProductEdit() {
  const { product, config } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading={product.title} back-url="/app">
      {actionData?.errors && actionData.errors.length > 0 && (
        <s-banner tone="critical" heading="保存に失敗しました">
          {actionData.errors.map(
            (e: { field: string; message: string }, i: number) => (
              <s-paragraph key={i}>{e.message}</s-paragraph>
            ),
          )}
        </s-banner>
      )}

      <s-section heading="テキスト配置設定（商品画像に対する %）">
        <Form method="post">
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              <label>
                <s-text>上からの位置 box_top (%)</s-text>
                <input
                  name="box_top"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={config.box_top}
                  style={inputStyle}
                  required
                />
              </label>
              <label>
                <s-text>左からの位置 box_left (%)</s-text>
                <input
                  name="box_left"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={config.box_left}
                  style={inputStyle}
                  required
                />
              </label>
              <label>
                <s-text>横幅 box_width (%)</s-text>
                <input
                  name="box_width"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={config.box_width}
                  style={inputStyle}
                  required
                />
              </label>
              <label>
                <s-text>高さ box_height (%)</s-text>
                <input
                  name="box_height"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={config.box_height}
                  style={inputStyle}
                  required
                />
              </label>
            </div>

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

            <div>
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
