const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

// load .env like other tests
const envVars = fs.readFileSync('.env', 'utf8').split("\n");
envVars.forEach(line => {
  const match = line.match(/^\s*([^#]+?)\s*=\s*(.+?)\s*$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

(async () => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL || 'gpt-4o-mini';
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const res = await model.generateContent('Hello world');
    console.log('Success', res);
  } catch (e) {
    console.error('Error', e);
  }
})();
