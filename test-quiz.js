const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

// Load .env
fs.readFileSync(".env", "utf8").split("\n").forEach((line) => {
    const match = line.match(/^\s*([^#]+?)\s*=\s*(.+?)\s*$/);
    if (match) process.env[match[1]] = match[2];
});

(async () => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    console.log("Calling gemini-2.0-flash...");
    const start = Date.now();

    try {
        const result = await model.generateContent(
            'Generate 3 multiple-choice questions about JavaScript. Return ONLY valid JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":"A","explanation":"..."}]}'
        );
        const text = result.response.text();
        const elapsed = Date.now() - start;

        console.log("Time:", elapsed, "ms");
        console.log("Raw text:");
        console.log(text);
        console.log("---END---");

        // Parse
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
        let quiz;
        try {
            quiz = JSON.parse(cleaned);
        } catch {
            const m = cleaned.match(/\{[\s\S]*\}/);
            if (m) quiz = JSON.parse(m[0]);
            else throw new Error("No JSON found");
        }
        console.log("Parsed OK. Questions:", quiz.questions.length);
    } catch (err) {
        console.error("ERROR:", err.message);
        console.error(err.stack);
    }
})();
