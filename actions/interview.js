"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const model = genAI.getGenerativeModel({ model: modelName });

// Each model has a SEPARATE 20 req/day free-tier quota, so we cycle through them
const quizModelNames = ["gemini-2.0-flash", "gemini-2.0-flash-lite", modelName];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Extract retry delay from Google API 429/503 error messages
function getRetryDelay(error) {
  const match = error?.message?.match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1])) * 1000 : 2000;
}

export async function generateQuiz() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { industry: true, skills: true },
  });

  if (!user) throw new Error("User not found");

  const skillsText = user.skills?.length
    ? ` with skills in ${user.skills.slice(0, 5).join(", ")}`
    : "";

  const prompt = `Generate 10 multiple-choice technical interview questions for a ${user.industry} professional${skillsText}.

Respond with ONLY a JSON object in this exact format (no markdown, no code fences):
{"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":"A","explanation":"..."}]}

Rules: 4 options per question, correctAnswer must match one option exactly, explanation max 1 sentence.`;

  let lastError;

  for (const name of quizModelNames) {
    try {
      const currentModel = genAI.getGenerativeModel({ model: name });
      const result = await currentModel.generateContent(prompt);
      const raw = result.response.text();

      // Strip code fences then parse
      let cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();

      let quiz;
      try {
        quiz = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON found in response");
        quiz = JSON.parse(match[0]);
      }

      if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        throw new Error("No questions in parsed JSON");
      }

      return quiz.questions;
    } catch (error) {
      lastError = error;
      const is503or429 =
        error?.message?.includes("503") ||
        error?.message?.includes("429") ||
        error?.message?.includes("quota") ||
        error?.message?.includes("retry");

      if (is503or429) {
        // This model's quota is exhausted — try the next model immediately
        console.warn(`Quiz: ${name} rate-limited, trying next model...`);
        continue;
      }

      // For non-quota errors (JSON parse, network, etc.) — retry same model once after delay
      console.error(`Quiz: ${name} error:`, error.message);
      try {
        await sleep(1500);
        const retryModel = genAI.getGenerativeModel({ model: name });
        const result = await retryModel.generateContent(prompt);
        const raw = result.response.text();
        const cleaned = raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "")
          .trim();

        let quiz;
        try {
          quiz = JSON.parse(cleaned);
        } catch {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (!match) throw new Error("No JSON in retry response");
          quiz = JSON.parse(match[0]);
        }

        if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
          return quiz.questions;
        }
      } catch (retryErr) {
        lastError = retryErr;
        console.error(`Quiz: ${name} retry also failed:`, retryErr.message);
      }
    }
  }

  console.error("All quiz models exhausted:", lastError?.message);
  throw new Error(
    "Quiz generation temporarily unavailable. Your daily free-tier API quota may be reached — please try again after some time."
  );
}

export async function saveQuizResult(questions, answers, score) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const questionResults = questions.map((q, index) => ({
    question: q.question,
    answer: q.correctAnswer,
    userAnswer: answers[index],
    isCorrect: q.correctAnswer === answers[index],
    explanation: q.explanation,
  }));

  // Get wrong answers
  const wrongAnswers = questionResults.filter((q) => !q.isCorrect);

  // Only generate improvement tips if there are wrong answers
  let improvementTip = null;
  if (wrongAnswers.length > 0) {
    const wrongQuestionsText = wrongAnswers
      .map(
        (q) =>
          `Question: "${q.question}"\nCorrect Answer: "${q.answer}"\nUser Answer: "${q.userAnswer}"`
      )
      .join("\n\n");

    const improvementPrompt = `
      The user got the following ${user.industry} technical interview questions wrong:

      ${wrongQuestionsText}

      Based on these mistakes, provide a concise, specific improvement tip.
      Focus on the knowledge gaps revealed by these wrong answers.
      Keep the response under 2 sentences and make it encouraging.
      Don't explicitly mention the mistakes, instead focus on what to learn/practice.
    `;

    try {
      const tipResult = await model.generateContent(improvementPrompt);

      improvementTip = tipResult.response.text().trim();
      console.log(improvementTip);
    } catch (error) {
      console.error("Error generating improvement tip:", error);
      // Continue without improvement tip if generation fails
    }
  }

  try {
    const assessment = await db.assessment.create({
      data: {
        userId: user.id,
        quizScore: score,
        questions: questionResults,
        category: user.industry, // Set category to the current industry
        improvementTip,
      },
    });

    return assessment;
  } catch (error) {
    console.error("Error saving quiz result:", error);
    throw new Error("Failed to save quiz result");
  }
}

export async function getAssessments() {
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
        category: user.industry, // Only fetch quizzes matching the active profile
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return assessments;
  } catch (error) {
    console.error("Error fetching assessments:", error);
    throw new Error("Failed to fetch assessments");
  }
}
