"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// choose a supported generative model via env var, default to a safe one
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const model = genAI.getGenerativeModel({ model: modelName });

export const generateAIInsights = async (industry) => {
  const prompt = `
          Analyze the current state of the ${industry} industry in the INDIAN job market and provide insights in ONLY the following JSON format without any additional notes or explanations:
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
          All salary values are ANNUAL CTC in Indian Rupees as full numbers (NOT in thousands or lakhs).
          Example: min: 400000 means ₹4,00,000 per year (4 LPA), max: 1500000 means ₹15,00,000 per year (15 LPA).
          Salary ranges must reflect realistic Indian market annual CTC (e.g. junior roles 300000-800000, mid-level 800000-2000000, senior 2000000-5000000).
          Include at least 5 common roles for salary ranges relevant to India, with location set to an Indian city.
          Growth rate should be a percentage.
          Include at least 5 skills and trends relevant to India.
        `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return JSON.parse(cleanedText);
  } catch (err) {
    console.error("AI insight generation failed:", err);
    // return fallback structure so onboarding/update can continue
    return {
      salaryRanges: [],
      growthRate: 0,
      demandLevel: "Medium",
      topSkills: [],
      marketOutlook: "Neutral",
      keyTrends: [],
      recommendedSkills: [],
    };
  }
};

export async function getIndustryInsights() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  // Detect stale/non-Indian salary data:
  // Indian annual CTC values are stored as full rupee amounts (e.g. 400000 = ₹4L/yr).
  // If any max salary is below ₹3,00,000 (300000), the data is clearly USD-era or wrong.
  const hasStaleData =
    user.industryInsight &&
    user.industryInsight.salaryRanges?.some((r) => r.max < 300000);

  // If no insights exist or data looks like it's USD-based, generate Indian data
  if (!user.industryInsight || hasStaleData) {
    const insights = await generateAIInsights(user.industry);

    if (hasStaleData) {
      // Update existing record with Indian market data
      const updated = await db.industryInsight.update({
        where: { industry: user.industry },
        data: {
          ...insights,
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      return updated;
    }

    const industryInsight = await db.industryInsight.create({
      data: {
        industry: user.industry,
        ...insights,
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return industryInsight;
  }

  return user.industryInsight;
}

export async function getUserQuizHistory() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const assessments = await db.assessment.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return assessments;
  } catch (error) {
    console.error("Error fetching user quiz history:", error);
    throw new Error("Failed to fetch user quiz history");
  }
}
