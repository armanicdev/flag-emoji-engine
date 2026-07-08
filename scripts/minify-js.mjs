/**
 * Simple JS minification script
 * Removes comments and whitespace while properly preserving string literals
 */

export function minifyJS(js) {
  const strings = [];
  let result = js;

  // Extract and preserve strings (both single and double quotes, and template literals)
  // Handle template literals with ${} interpolation
  result = result.replace(/`[^`]*`/g, (match) => {
    strings.push(match);
    return `\x00${strings.length - 1}\x00`;
  });

  // Handle single-quoted strings (escape sequences)
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, (match) => {
    strings.push(match);
    return `\x00${strings.length - 1}\x00`;
  });

  // Handle double-quoted strings (escape sequences)
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
    strings.push(match);
    return `\x00${strings.length - 1}\x00`;
  });

  // Now minify the code (strings are safely extracted)
  result = result
    // Remove single-line comments
    .replace(/\/\/[^\n]*/g, '')
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove leading/trailing whitespace from lines
    .replace(/^[\s\t]+|[\s\t]+$/gm, '')
    // Normalize newlines
    .replace(/\n+/g, '\n')
    // Remove empty lines
    .replace(/^\s*\n/gm, '')
    // Remove spaces around operators and punctuation (but not in strings since we extracted them)
    .replace(/\s*([=+\-*/{}()[\];,<>!&|])\s*/g, '$1')
    // Space around keywords that need it
    .replace(/\b(function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|new|delete|typeof|instanceof|in|of|var|let|const|with|debugger|default|do|export|import|from|as|class|extends|super|static|get|set|async|await|yield|void|typeof)\b/g, ' $1 ')
    // Remove multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Trim
    .trim();

  // Restore strings
  result = result.replace(/\x00(\d+)\x00/g, (match, index) => strings[parseInt(index)]);

  return result;
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const js = await process.stdin.text();
  console.log(minifyJS(js));
}
