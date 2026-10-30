import type { DatoRangeProductRecord } from "lib/cms/range";
import { formatCopySource } from "lib/content/format-copy";
import type { DatoResponsiveImage } from "lib/cms/datocms";
import { structuredTextToHtml } from "lib/cms/structured-text";
import type { Product, ProductVariant } from "lib/shopify/types";

export type RangeProductPageVariant = {
  id: string;
  label: string;
  price: string;
};

export type RangeProductPageData = {
  handle: string;
  rangeSlug: string;
  title: string;
  descriptionHtml: string;
  images: DatoResponsiveImage[];
  /** Present when the CMS slug matches a Shopify product handle. */
  product: Product | null;
  variants: RangeProductPageVariant[];
};

function formatVariantPrice(variant: ProductVariant): string {
  const { amount, currencyCode } = variant.price;

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(amount));
}

function collectGalleryImages(
  cmsProduct: DatoRangeProductRecord,
): DatoResponsiveImage[] {
  const sources: Array<DatoResponsiveImage | null | undefined> = [];

  if (cmsProduct.thumbnail?.responsiveImage) {
    sources.push(cmsProduct.thumbnail.responsiveImage);
  }

  for (const image of cmsProduct.images) {
    sources.push(image.responsiveImage);
  }

  const seen = new Set<string>();
  const images: DatoResponsiveImage[] = [];

  for (const image of sources) {
    if (!image?.src || seen.has(image.src)) continue;
    seen.add(image.src);
    images.push(image);
  }

  return images;
}

function descriptionToHtml(
  description: DatoRangeProductRecord["description"],
): string {
  return structuredTextToHtml(description) ?? "";
}

export function mapRangeProductPageData({
  cmsProduct,
  shopifyProduct,
  rangeSlug,
}: {
  cmsProduct: DatoRangeProductRecord;
  shopifyProduct: Product | null | undefined;
  rangeSlug: string;
}): RangeProductPageData {
  const cmsDescription = descriptionToHtml(cmsProduct.description);
  const shopifyDescription = shopifyProduct?.descriptionHtml?.trim()
    ? formatCopySource(shopifyProduct.descriptionHtml)
    : shopifyProduct?.description?.trim()
      ? formatCopySource(shopifyProduct.description)
      : "";

  const variants: RangeProductPageVariant[] = shopifyProduct
    ? shopifyProduct.variants.map((variant) => ({
        id: variant.id,
        label: variant.title,
        price: formatVariantPrice(variant),
      }))
    : [];

  return {
    handle: cmsProduct.slug,
    rangeSlug,
    title: (
      cmsProduct.title ||
      shopifyProduct?.title ||
      cmsProduct.slug
    ).toUpperCase(),
    descriptionHtml: cmsDescription || shopifyDescription,
    images: collectGalleryImages(cmsProduct),
    product: shopifyProduct ?? null,
    variants,
  };
}
