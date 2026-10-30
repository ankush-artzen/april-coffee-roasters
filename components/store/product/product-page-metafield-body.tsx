import type { ParsedRecipeContent } from "lib/store/parse-product-metafields";

export default function ProductPageMetafieldBody({
  content,
  className,
}: {
  content: ParsedRecipeContent;
  className?: string;
}) {
  if (content.html) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: content.html }}
      />
    );
  }

  return (
    <div className={className}>
      {content.lines.map((line, index) => {
        if (!line.trim()) {
          return <p key={`gap-${index}`} className="copy-gap" />;
        }

        return <p key={`${index}-${line}`}>{line}</p>;
      })}
    </div>
  );
}
