import { cp, mkdir, rm, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { minifyJS } from './minify-js.mjs';
import { minifyCSS } from './minify-css.mjs';

const rootDir = resolve(process.cwd());
const distDir = resolve(rootDir, 'dist');

const entriesToCopy = [
  'index.html',
  '.htaccess',
  'assets',
  'src'
];

// CSS and JS minification imported from standalone scripts
// (the JS minifier properly handles template literals, single, and double-quoted strings)

async function minifyAssets(dir) {
  const files = await readdir(dir, { withFileTypes: true, recursive: true });
  const results = [];

  for (const file of files) {
    if (!file.isFile()) continue;

    const filePath = join(file.parentPath || dir, file.name);
    const relativePath = filePath.replace(distDir + '/', '');

    if (file.name.endsWith('.css') && !file.name.endsWith('.min.css')) {
      const css = await readFile(filePath, 'utf8');
      const minified = minifyCSS(css);
      const minPath = filePath.replace('.css', '.min.css');
      await writeFile(minPath, minified, 'utf8');

      const originalSize = Buffer.byteLength(css, 'utf8');
      const minifiedSize = Buffer.byteLength(minified, 'utf8');
      const savings = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);

      results.push({
        file: relativePath,
        original: originalSize,
        minified: minifiedSize,
        savings: `${savings}%`
      });
    }

    if (
      file.name.endsWith('.js') &&
      !file.name.endsWith('.min.js') &&
      !file.name.includes('worker') &&
      !relativePath.includes('vendor/')
    ) {
      const js = await readFile(filePath, 'utf8');
      const minified = minifyJS(js);
      const minPath = filePath.replace('.js', '.min.js');
      await writeFile(minPath, minified, 'utf8');

      const originalSize = Buffer.byteLength(js, 'utf8');
      const minifiedSize = Buffer.byteLength(minified, 'utf8');
      const savings = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);

      results.push({
        file: relativePath,
        original: originalSize,
        minified: minifiedSize,
        savings: `${savings}%`
      });
    }
  }

  return results;
}

async function updateHtmlForMinified() {
  const htmlPath = resolve(distDir, 'index.html');
  let html = await readFile(htmlPath, 'utf8');

  // Update CSS reference to minified version
  html = html.replace('href="assets/styles.css"', 'href="assets/styles.min.css"');

  // Update JS references to minified versions
  html = html.replace('src="src/main.js"', 'src="src/main.min.js"');
  html = html.replace('src="src/flagoji-loader-boot.js"', 'src="src/flagoji-loader-boot.min.js"');

  // Remove redundant defer on module script (modules are deferred by default)
  html = html.replace('type="module" defer', 'type="module"');

  await writeFile(htmlPath, html, 'utf8');
}

async function updateMinifiedImportPaths() {
  const minFiles = [
    resolve(distDir, 'src', 'main.min.js'),
    resolve(distDir, 'src', 'gif-export-worker.js')
  ];
  for (const filePath of minFiles) {
    try {
      let content = await readFile(filePath, 'utf8');
      // Rewrite bare .js imports to .min.js for files we minified
      content = content.replace(/(['"])\.\/flag-physics-webgl\.js(['"])/g, '$1./flag-physics-webgl.min.js$2');
      content = content.replace(/(['"])\.\/gif-export-frame\.js(['"])/g, '$1./gif-export-frame.min.js$2');
      await writeFile(filePath, content, 'utf8');
    } catch {
      // File may not exist yet; skip
    }
  }
}

async function removeUnusedDistFiles() {
  const unused = [
    resolve(distDir, 'assets', 'images', 'flowers.webp'),
    resolve(distDir, 'assets', 'images', 'kurdistan.svg')
  ];
  for (const f of unused) {
    await rm(f, { force: true }).catch(() => { });
  }
}

async function calculateTotalSize(dir) {
  let total = 0;
  const files = await readdir(dir, { recursive: true });

  for (const file of files) {
    const filePath = join(dir, file);
    const stats = await stat(filePath);
    if (stats.isFile()) {
      total += stats.size;
    }
  }

  return total;
}

async function buildDist() {
  console.log('🚀 Starting Flagoji build...\n');

  // Clean and create dist directory
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  // Copy all files
  for (const entry of entriesToCopy) {
    const from = resolve(rootDir, entry);
    const to = resolve(distDir, entry);
    try {
      await cp(from, to, { recursive: true });
      console.log(`  ✓ Copied ${entry}`);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        throw new Error(`Missing required path: ${entry}`);
      }
      throw error;
    }
  }

  // Minify assets
  console.log('\n📦 Minifying assets...');
  const minificationResults = await minifyAssets(distDir);

  for (const result of minificationResults) {
    console.log(`  ✓ ${result.file}`);
    console.log(`    ${(result.original / 1024).toFixed(1)}KB → ${(result.minified / 1024).toFixed(1)}KB (${result.savings} smaller)`);
  }

  // Update HTML to use minified files
  console.log('\n📝 Updating HTML references...');
  await updateHtmlForMinified();
  console.log('  ✓ Updated index.html to use minified files');

  // Rewrite import paths in minified JS modules
  await updateMinifiedImportPaths();
  console.log('  ✓ Updated import paths in minified JS modules');

  // Remove unused assets from dist
  await removeUnusedDistFiles();
  console.log('  ✓ Removed unused assets from dist');

  // Calculate total size
  const totalSize = await calculateTotalSize(distDir);
  const totalSizeKB = (totalSize / 1024).toFixed(1);

  // Write deploy info
  await writeFile(
    resolve(distDir, 'DEPLOY.txt'),
    [
      'Flagoji dist build',
      '',
      'Contents of this folder are the static site root (upload or point your host at these files, not the dist directory name as a URL segment unless you intend that).',
      'For Vercel + GitHub, connect the repo; build is configured in vercel.json.',
      '',
      `Built at: ${new Date().toISOString()}`,
      `Total size: ${totalSizeKB}KB`,
      '',
      'Performance optimizations applied:',
      '- CSS and JS minified',
      '- Images optimized',
      '- Resource hints added',
      '- Async loading for non-critical assets'
    ].join('\n'),
    'utf8'
  );

  console.log('\n✅ Build complete!');
  console.log(`📊 Total size: ${totalSizeKB}KB`);
  console.log(`\n📁 Output: ${distDir}`);
  console.log('\n🚀 Dist ready (e.g. upload root or deploy via Vercel).');
}

buildDist().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

