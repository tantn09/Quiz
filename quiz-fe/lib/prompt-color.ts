import { Color } from "@tiptap/extension-text-style";

const hexColor = /^#[0-9a-f]{6}$/i;

function channels(hex: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function luminance(rgb: number[]) {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// Match --foreground and --surface-subtle in globals.css. Table headers use the latter.
const lightForeground = channels("#20223d");
const darkForeground = channels("#f0f1ff");
const lightSurface = luminance(channels("#f5f4ff"));
const darkSurface = luminance(channels("#262b46"));

function readableColor(hex: string, foreground: number[], surface: number) {
  const original = channels(hex);
  const passes = (rgb: number[]) => {
    const text = luminance(rgb);
    return (Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05) >= 4.5;
  };
  if (passes(original)) return hex;

  function blend(step: number) {
    return original.map((channel, index) => Math.round(channel + (foreground[index] - channel) * step / 256));
  }

  let low = 0;
  let high = 256;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (passes(blend(middle))) high = middle;
    else low = middle;
  }
  return "#" + blend(high).map((channel) => channel.toString(16).padStart(2, "0")).join("");
}

export const PromptColor = Color.extend({
  addGlobalAttributes() {
    return (this.parent?.() ?? []).map((group) => ({
      ...group,
      attributes: {
        ...group.attributes,
        color: {
          ...group.attributes.color,
          renderHTML: ({ color }) => {
            if (typeof color !== "string" || !hexColor.test(color)) return {};
            const light = readableColor(color, lightForeground, lightSurface);
            const dark = readableColor(color, darkForeground, darkSurface);
            return {
              "data-prompt-color": "",
              style: `color: ${color}; --prompt-color-light: ${light}; --prompt-color-dark: ${dark}`,
            };
          },
        },
      },
    }));
  },
});
