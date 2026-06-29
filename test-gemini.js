const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const envVars = fs.readFileSync(".env", "utf8").split("\n");
envVars.forEach(line => {
  const match = line.match(/^\s*([^#]+?)\s*=\s*(.+?)\s*$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const model = genAI.getGenerativeModel({ model: modelName });

const generateAIInsights = async (industry) => {
  const prompt = `
          Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
          {
            "salaryRanges": [
              { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
            ],
            "growthRate": number,
            "demandLevel": "High" | "Medium" | "Low",
            "topSkills": ["skill1", "skill2"],
            "marketOutlook": "Positive" | "Neutral" | "Negative",
            "keyTrends": ["trend1", "trend2"],
            "recommendedSkills": ["skill1", "skill2"]
          }
          
          IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
          Include at least 5 common roles for salary ranges.
          Growth rate should be a percentage.
          Include at least 5 skills and trends.
        `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    console.log("Raw output:", text);
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    console.log("Parsed:", JSON.parse(cleanedText));
  } catch (err) {
    fs.writeFileSync("gemini-error.json", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    console.error("Error written to gemini-error.json");
  }
};

generateAIInsights("tech-software-development");
