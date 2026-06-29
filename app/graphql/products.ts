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
          handle
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

export const PRODUCT_BY_ID_QUERY = `#graphql
  query GetProductById($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      featuredImage {
        url
      }
      metafield(namespace: "custom_simulator", key: "config") {
        id
        value
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
