import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PRODUCTS_QUERY } from "../graphql/products";

type Product = {
  id: string;
  title: string;
  handle: string;
  featuredImage: { url: string } | null;
  metafield: { id: string; value: string } | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first: 50 },
  });
  const data = await response.json();
  const products: Product[] = data.data.products.edges.map(
    (e: { node: Product }) => e.node,
  );
  return { products };
};

export default function Index() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <s-page heading="名入れシミュレーター - 商品設定">
      <s-section heading="商品一覧">
        <s-paragraph>
          名入れシミュレーターを有効にしたい商品を選択し、テキスト配置設定を登録してください。
        </s-paragraph>
        {products.length === 0 ? (
          <s-paragraph>
            商品がありません。Shopify管理画面に商品を追加してください。
          </s-paragraph>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "8px" }}
          >
            {products.map((product) => {
              const numericId = product.id.replace(
                "gid://shopify/Product/",
                "",
              );
              const hasConfig = product.metafield !== null;
              return (
                <div
                  key={product.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    border: "1px solid #e3e3e3",
                    borderRadius: "8px",
                    backgroundColor: "#fff",
                  }}
                >
                  {product.featuredImage && (
                    <img
                      src={product.featuredImage.url}
                      alt={product.title}
                      width={48}
                      height={48}
                      style={{ objectFit: "cover", borderRadius: "4px", flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <s-link href={`/app/products/${numericId}`}>
                      {product.title}
                    </s-link>
                    <div style={{ marginTop: "4px" }}>
                      <s-text tone={hasConfig ? "success" : "caution"}>
                        {hasConfig ? "✓ 設定済み" : "● 未設定"}
                      </s-text>
                    </div>
                  </div>
                  <s-button href={`/app/products/${numericId}`} variant="tertiary">
                    {hasConfig ? "編集" : "設定する"}
                  </s-button>
                </div>
              );
            })}
          </div>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
