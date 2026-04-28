import { readBlockConfig } from '../../scripts/aem.js';
import { CS_FETCH_GRAPHQL, getProductLink } from '../../scripts/commerce.js';

async function fetchCategoryProducts(categoryId, maxProducts) {
  const query = `
        query GetCategoryProducts($categoryId: String!, $pageSize: Int!) {
        productSearch(
            phrase: ""
            filter: [{ attribute: "categoryIds", eq: $categoryId }]
            page_size: $pageSize
        ) {
        items {
            productView {
            name
            sku
            urlKey
            images(roles: ["image"]) {
            url
            label
        }
        price {
          final { amount { value currency } }
          regular { amount { value currency } }
             }
            }
          }
          }
        }
        `;
  const { data } = await CS_FETCH_GRAPHQL.fetchGraphQl(query, {
    variables: {
      categoryId,
      pageSize: maxProducts,
    },
  });
  return data?.productSearch?.items || [];
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return '';
  return imageUrl.startsWith('http') ? imageUrl : `/${imageUrl.replace(/^\/+/, '')}`;
}

function formatPrice(price) {
  if (!price?.currency || typeof price?.value !== 'number') return '';
  return `${price.currency} ${price.value.toFixed(2)}`;
}

function renderProducts(productsContainer, items) {
  const cards = document.createDocumentFragment();

  items.forEach((item) => {
    const product = item?.productView;
    if (!product) return;

    const image = product.images?.[0];
    const price = product.price?.final?.amount;
    const productUrl = getProductLink(product.urlKey, product.sku);

    const productAnchor = document.createElement('a');
    productAnchor.className = 'promo-banner__product';
    productAnchor.href = productUrl;

    if (image?.url) {
      const productImage = document.createElement('img');
      productImage.src = resolveImageUrl(image.url);
      productImage.alt = image.label || product.name || '';
      productImage.loading = 'lazy';
      productImage.width = 300;
      productImage.height = 300;
      productAnchor.append(productImage);
    }

    const nameEl = document.createElement('span');
    nameEl.className = 'promo-banner__product-name';
    nameEl.textContent = product.name || product.sku || 'Product';
    productAnchor.append(nameEl);

    const formattedPrice = formatPrice(price);
    if (formattedPrice) {
      const priceEl = document.createElement('span');
      priceEl.className = 'promo-banner__product-price';
      priceEl.textContent = formattedPrice;
      productAnchor.append(priceEl);
    }

    cards.append(productAnchor);
  });

  productsContainer.replaceChildren(cards);
}

export default async function decorate(block) {
  const {
    'category-id': categoryId = '',
    heading = 'Featured Products',
    'max-products': maxProductsStr = '4',
  } = readBlockConfig(block);

  const parsedMaxProducts = parseInt(maxProductsStr, 10);
  const maxProducts = Number.isNaN(parsedMaxProducts) ? 4 : parsedMaxProducts;

  block.innerHTML = `
    <div class="promo-banner__heading"><h2>${heading}</h2></div>
    <div class="promo-banner__products"><p>Loading products...</p></div>
  `;

  const productsContainer = block.querySelector('.promo-banner__products');

  if (!categoryId) {
    productsContainer.innerHTML = '<p>No products found.</p>';
    return;
  }

  try {
    const products = await fetchCategoryProducts(categoryId, maxProducts);

    if (!products.length) {
      productsContainer.innerHTML = '<p>No products found.</p>';
      return;
    }

    renderProducts(productsContainer, products);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Promo banner: failed to fetch products', error);
    productsContainer.innerHTML = '<p>Unable to load products.</p>';
  }
}
