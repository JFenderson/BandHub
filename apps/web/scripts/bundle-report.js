#!/usr/bin/env node

/**
 * Bundle Size Reporter
 * 
 * Run after `npm run build` to get a summary of bundle sizes
 * Usage: node scripts/bundle-report.js
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', '.next');
const STATIC_DIR = path.join(BUILD_DIR, 'static', 'chunks');

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (err) {
    return 0;
  }
}

function analyzeChunks() {
  console.log('\n📦 Bundle Size Report\n');
  console.log('=' .repeat(60));

  if (!fs.existsSync(STATIC_DIR)) {
    console.error('❌ Build directory not found. Run `npm run build` first.');
    process.exit(1);
  }

  const chunks = [];
  let totalSize = 0;

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDir(filePath);
      } else if (file.endsWith('.js')) {
        const size = stat.size;
        totalSize += size;
        chunks.push({
          name: file,
          size: size,
          path: filePath.replace(BUILD_DIR, '.next')
        });
      }
    });
  }

  scanDir(STATIC_DIR);

  // Sort by size (largest first)
  chunks.sort((a, b) => b.size - a.size);

  // Display results
  console.log('\n📊 Largest Chunks:\n');
  chunks.slice(0, 10).forEach((chunk, index) => {
    const size = formatBytes(chunk.size);
    const bar = '█'.repeat(Math.floor(chunk.size / (chunks[0].size / 40)));
    console.log(`${index + 1}. ${chunk.name}`);
    console.log(`   ${size.padEnd(10)} ${bar}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\n📦 Total Bundle Size: ${formatBytes(totalSize)}`);
  
  // Check against targets
  const largestChunk = chunks[0];
  const TARGET_INITIAL = 200 * 1024; // 200KB
  const TARGET_CHUNK = 150 * 1024;   // 150KB

  console.log('\n🎯 Performance Targets:\n');
  
  if (totalSize < TARGET_INITIAL) {
    console.log('✅ Initial load: PASS (<200KB)');
  } else {
    console.log(`❌ Initial load: FAIL (${formatBytes(totalSize)} > 200KB)`);
  }

  if (largestChunk.size < TARGET_CHUNK) {
    console.log('✅ Largest chunk: PASS (<150KB)');
  } else {
    console.log(`❌ Largest chunk: FAIL (${formatBytes(largestChunk.size)} > 150KB)`);
  }

  console.log('\n💡 Tips:');
  console.log('  - Run `npm run analyze` for detailed bundle visualization');
  console.log('  - Use dynamic imports for large components');
  console.log('  - Check for duplicate dependencies\n');
}

analyzeChunks();
