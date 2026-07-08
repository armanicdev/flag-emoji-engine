/**
 * Simple CSS minification script
 * Removes comments, whitespace, and optimizes for production
 */

export function minifyCSS(css) {
  return css
    // Remove block comments (CSS has no single-line // comments)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove leading/trailing whitespace from lines
    .replace(/^[\s\t]+|[\s\t]+$/gm, '')
    // Remove newlines and extra spaces
    .replace(/\n+/g, '')
    // Remove spaces around selectors and properties
    .replace(/\s*{\s*/g, '{')
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*:\s*/g, ':')
    // Remove last semicolon in block
    .replace(/;}/g, '}')
    // Remove unnecessary spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const css = await process.stdin.text();
  console.log(minifyCSS(css));
}
