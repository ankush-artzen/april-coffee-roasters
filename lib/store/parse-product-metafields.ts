import { formatCopySource } from "lib/content/format-copy";
import { sanitizeRichHtml } from "lib/html/sanitize-rich-html";
import { parseProductDescriptionLines } from "lib/store/parse-product-description";

export type SizeChartMeasurement = {
  name: string;
  measures: string[];
};

export type SizeChartData = {
  variantNames: string[];
  measurements: SizeChartMeasurement[];
  footerNotes: string[];
};

export type ParsedTechnicalDetails = {
  lines: string[];
  html: string | null;
};

export type ParsedSizeChart = {
  table: SizeChartData | null;
  plainText: string | null;
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, " ");
}

function splitBulletText(text: string): string[] {
  return text
    .split(/\s*•\s*|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseTechnicalDetails(
  value: string | null | undefined,
): ParsedTechnicalDetails | null {
  if (!value?.trim()) return null;

  const trimmed = value.trim();

  if (trimmed.includes("<")) {
    const lines = parseProductDescriptionLines("", trimmed);
    return {
      lines,
      html: sanitizeRichHtml(trimmed),
    };
  }

  const lines = splitBulletText(trimmed);
  if (lines.length === 0) return null;

  const detailLines =
    lines.length > 1 && lines[0]?.toUpperCase().endsWith(" DETAILS")
      ? lines.slice(1)
      : lines;

  return {
    lines: detailLines,
    html: null,
  };
}

/** Multi-line / rich-text recipe body from Shopify metafields. */
export type ParsedRecipeContent = ParsedTechnicalDetails;

export function parseRecipeContent(
  value: string | null | undefined,
): ParsedRecipeContent | null {
  if (!value?.trim()) return null;

  const html = formatCopySource(value);
  const text = html.replace(/<[^>]+>/g, "").trim();
  if (!text) return null;

  return {
    lines: parseProductDescriptionLines("", html),
    html,
  };
}

export function parseSizeChart(
  value: string | null | undefined,
): ParsedSizeChart | null {
  if (!value?.trim()) return null;

  const trimmed = value.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        measurements?: Array<{ name?: string; measures?: string[] }>;
        variant_names?: string[];
      };

      const variantNames = parsed.variant_names?.filter(Boolean) ?? [];
      const measurements =
        parsed.measurements
          ?.filter((item) => item.name && item.measures?.length)
          .map((item) => ({
            name: item.name!,
            measures: item.measures!,
          })) ?? [];

      if (variantNames.length > 0 && measurements.length > 0) {
        return {
          table: {
            variantNames,
            measurements,
            footerNotes: [],
          },
          plainText: null,
        };
      }
    } catch (error) {
      console.error(error);
    }
  }

  const plainTextTable = parsePlainTextSizeChart(trimmed);
  if (plainTextTable) {
    return {
      table: plainTextTable,
      plainText: null,
    };
  }

  return {
    table: null,
    plainText: decodeHtmlEntities(trimmed),
  };
}

const PLAIN_TEXT_SIZE_CHART_MEASUREMENTS = [
  "Body Length",
  "Sleeve Length",
  "Chest",
  "Waist",
  "Hem",
];

function parsePlainTextSizeChart(text: string): SizeChartData | null {
  const footerMatch = text.match(/(ALL MEASUREMENTS[\s\S]*)$/i);
  const footerNotes = footerMatch?.[1]?.trim()
    ? footerMatch[1]
        .trim()
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  const body =
    footerMatch && footerMatch.index != null
      ? text.slice(0, footerMatch.index).trim()
      : text;

  const found = PLAIN_TEXT_SIZE_CHART_MEASUREMENTS.flatMap((name) => {
    const index = body.indexOf(name);
    return index >= 0 ? [{ name, index }] : [];
  }).sort((a, b) => a.index - b.index);

  const firstMeasurement = found[0];
  if (!firstMeasurement) return null;

  const variantNames = body
    .slice(0, firstMeasurement.index)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (variantNames.length === 0) return null;

  const measurements: SizeChartMeasurement[] = [];

  for (let index = 0; index < found.length; index += 1) {
    const current = found[index];
    if (!current) continue;

    const next = found[index + 1];
    const start = current.index + current.name.length;
    const end = next ? next.index : body.length;
    const measures = body.slice(start, end).trim().split(/\s+/).filter(Boolean);

    if (measures.length === 0) continue;

    measurements.push({
      name: current.name,
      measures,
    });
  }

  if (measurements.length === 0) return null;

  return {
    variantNames,
    measurements,
    footerNotes,
  };
}
