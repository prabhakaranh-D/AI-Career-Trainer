"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const model = genAI.getGenerativeModel({ model: modelName });

export async function saveResume(content) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const resume = await db.resume.upsert({
      where: {
        userId: user.id,
      },
      update: {
        content,
      },
      create: {
        userId: user.id,
        content,
      },
    });

    revalidatePath("/resume");
    return resume;
  } catch (error) {
    console.error("Error saving resume:", error);
    throw new Error("Failed to save resume");
  }
}

export async function getResume() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  return await db.resume.findUnique({
    where: {
      userId: user.id,
    },
  });
}

export async function improveWithAI({ current, type, context = {} }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  let prompt;

  if (type === "education") {
    const { title = "", organization = "", startDate = "" } = context;
    prompt = `
      You are an expert resume writer. Generate a concise, impactful description for the following education entry:

      - Degree / Programme: ${title || "Not specified"}
      - Institution: ${organization || "Not specified"}
      - Start Date: ${startDate || "Not specified"}
      - Existing description (if any): "${current || "None"}"

      Requirements:
      1. Focus entirely on the degree, course content, and institution — do NOT reference any job industry
      2. Highlight key subjects, skills, or achievements typically associated with this programme
      3. Mention relevant coursework, projects, academic achievements, or honours if appropriate
      4. Keep it to 2–3 impactful sentences
      5. Use plain text only — no markdown, emojis, or special characters
      6. Start with what was studied or achieved, not with "I"

      Return ONLY the improved description with no preamble or explanation.
    `;
  } else {
    prompt = `
      As an expert ATS-optimized resume writer, improve the following ${type} description for a ${user.industry} professional.
      The output will be parsed by Applicant Tracking Systems (ATS), so it must be plain text compatible.
      Current content: "${current}"

      Requirements:
      1. Start with a strong action verb (e.g. Developed, Led, Optimized, Implemented)
      2. Include specific metrics and quantifiable results wherever possible (e.g. "increased by 30%", "reduced time by 2 hours/week")
      3. Use industry-standard keywords and terminology that ATS systems look for in ${user.industry} roles
      4. Keep it concise — 2 to 4 impactful sentences max
      5. Focus on achievements and impact, not just responsibilities
      6. Do NOT use emojis, special characters, tables, or any non-standard formatting
      7. Use plain text only — no markdown bold, italics, or symbols

      Return ONLY the improved text with no preamble, labels, or explanations.
    `;
  }

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const improvedContent = response.text().trim();
    return improvedContent;
  } catch (error) {
    console.error("Error improving content:", error);
    throw new Error("Failed to improve content");
  }
}
