const fs = require('fs');
const path = require('path');

const replacements = [
  { regex: /productRollsTable/g, replacement: "productBatchesTable" },
  { regex: /ProductRollsModal/g, replacement: "ProductBatchesModal" },
  { regex: /ProductRoll/g, replacement: "ProductBatch" },
  { regex: /productRoll/g, replacement: "productBatch" },
  { regex: /rollStock/g, replacement: "kratStock" },
  { regex: /meterStock/g, replacement: "kgStock" },
  { regex: /pricePerMeter/g, replacement: "pricePerKg" },
  { regex: /costPricePerMeter/g, replacement: "costPricePerKg" },
  { regex: /pricePerRoll/g, replacement: "pricePerKrat" },
  { regex: /costPricePerRoll/g, replacement: "costPricePerKrat" },
  { regex: /originalLength/g, replacement: "originalWeight" },
  { regex: /currentLength/g, replacement: "currentWeight" },
  { regex: /rollId/g, replacement: "batchId" },
  { regex: /rolls/g, replacement: "krats" },
  { regex: /meters/g, replacement: "kgs" },
  { regex: /rollLengthsJson/g, replacement: "batchWeightsJson" },
  { regex: /rollLengths/g, replacement: "batchWeights" },
  { regex: /METER/g, replacement: "KG" },
  { regex: /ROLL/g, replacement: "KRAT" },
  { regex: /Meter/g, replacement: "Kg" },
  { regex: /Roll/g, replacement: "Krat" },
  { regex: /meter/g, replacement: "kg" },
  { regex: /roll/g, replacement: "krat" },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.github'].includes(file)) continue;
      processDirectory(fullPath);
    } else {
      if (['.ts', '.tsx', '.js', '.jsx', '.css'].includes(path.extname(file))) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;
        
        if (fullPath.includes('schema\\index.ts')) continue;
        if (fullPath.includes('schema/index.ts')) continue;

        for (const { regex, replacement } of replacements) {
          if (regex.test(content)) {
            content = content.replace(regex, replacement);
            modified = true;
          }
        }
        
        if (modified) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`Updated ${fullPath}`);
        }
      }
    }
  }
}

processDirectory(path.join(__dirname, '../artifacts/api-server'));
processDirectory(path.join(__dirname, '../artifacts/tmcpos'));
processDirectory(path.join(__dirname, '../lib/api-zod'));
processDirectory(path.join(__dirname, '../lib/api-client-react'));
