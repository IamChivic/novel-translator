import { cn } from "cn";
import type { FontFamily, ReadingWidth, TextSize } from "@/shared/options";

const SIZE: Record<TextSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};
const WIDTH: Record<ReadingWidth, string> = {
  narrow: "max-w-xl",
  medium: "max-w-2xl",
  wide: "max-w-none",
};
const FONT: Record<FontFamily, string> = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
};

/** A chapter's paragraphs in the reader's chosen size, width and font. */
export function ChapterText({
  text,
  size = "md",
  width = "medium",
  font = "sans",
  testId,
  lang,
}: {
  text: string;
  size?: TextSize;
  width?: ReadingWidth;
  font?: FontFamily;
  testId?: string;
  lang?: string;
}) {
  const paragraphs = text.split(/\n+/).filter((line) => line.trim());
  return (
    <div
      data-testid={testId}
      data-size={size}
      data-width={width}
      data-font={font}
      lang={lang}
      className={cn("space-y-4 leading-relaxed", SIZE[size], WIDTH[width], FONT[font])}
    >
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
