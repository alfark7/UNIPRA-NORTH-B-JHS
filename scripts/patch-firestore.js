const fs = require('fs');
const path = require('path');

const filesToPatch = [
  'node_modules/@firebase/firestore/dist/index.esm2017.js',
  'node_modules/@firebase/firestore/dist/index.cjs.js',
  'node_modules/@firebase/firestore/dist/index.rn.js',
];

const targetPattern = /this\.Fe\s*-=\s*1,\s*__PRIVATE_hardAssert\s*\(\s*this\.Fe\s*>=\s*0,\s*3241,\s*\{[\s\S]*?Fe:\s*this\.Fe[\s\S]*?\}\s*\);/g;
const replacement = 'this.Fe = Math.max(0, this.Fe - 1);';

let patchedCount = 0;

for (const relPath of filesToPatch) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`File not found, skipping: ${relPath}`);
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('this.Fe = Math.max(0, this.Fe - 1);')) {
    console.log(`Already patched: ${relPath}`);
    patchedCount++;
    continue;
  }

  if (targetPattern.test(content)) {
    const newContent = content.replace(targetPattern, replacement);
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`Successfully patched: ${relPath}`);
    patchedCount++;
  } else {
    console.warn(`Pattern not matched in: ${relPath}`);
  }
}

console.log(`Firestore assertion ca9 patch complete. Patched ${patchedCount} files.`);
