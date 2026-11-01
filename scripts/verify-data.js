const fs = require('fs');
const path = require('path');

const problems = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/problems.json'), 'utf8'));

console.log('Total problems in problems.json:', problems.length);

// Check first problem (Weird Algorithm)
const p1068 = problems.find((p) => p.id === '1068');
console.log('\n--- Sample Problem 1068 ---');
console.log(JSON.stringify(p1068, null, 2));

// Check problem with 2 test cases (Two Sets)
const p1092 = problems.find((p) => p.id === '1092');
console.log('\n--- Sample Problem 1092 (Two Sets) Test Cases ---');
console.log(JSON.stringify(p1092.testCases, null, 2));

// Check sorting and searching problem
const p1621 = problems.find((p) => p.id === '1621');
console.log('\n--- Sample Problem 1621 (Distinct Numbers) ---');
console.log('Title:', p1621.title);
console.log('Category:', p1621.category);
console.log('Limits:', p1621.timeLimit, p1621.memoryLimit);
console.log('TestCases count:', p1621.testCases.length);
console.log('Stats:', p1621.stats);

// Validate all problems have required fields
let validCount = 0;
let scrapedCount = 0;
for (const p of problems) {
  if (
    p.id &&
    p.title &&
    p.category &&
    p.timeLimit &&
    p.memoryLimit &&
    typeof p.statementHtml === 'string' &&
    Array.isArray(p.testCases) &&
    p.stats &&
    typeof p.stats.solvedBy === 'number' &&
    Array.isArray(p.stats.fastest) &&
    Array.isArray(p.stats.shortest)
  ) {
    validCount++;
  }
  if (p.testCases.length > 0 && p.stats.solvedBy > 0) {
    scrapedCount++;
  }
}

console.log(`\nValidation: ${validCount}/${problems.length} problems match Problem interface strictly.`);
console.log(`Fully scraped problems with test cases & real stats: ${scrapedCount}`);
