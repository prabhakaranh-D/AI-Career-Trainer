const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const envVars = fs.readFileSync('.env', 'utf8').split('\n');
envVars.forEach(line => {
  const match = line.match(/^\s*([^#]+?)\s*=\s*(.+?)\s*$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

(async () => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    fs.writeFileSync('models.json', JSON.stringify(data, null, 2), 'utf8');
    console.log('Available models written to models.json');
  } catch (err) {
    console.error('Error listing models:', err);
  }
})();
