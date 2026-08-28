// import OpenAI from "openai";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is stored in environment variables
// });

// export async function generateQuestions(topic, difficulty, numberOfQuestions) {
//   // Construct the messages for the chat model
//   const messages = [
//     {
//       role: "user",
//       content: `Generate ${numberOfQuestions} questions on the topic "${topic}" at a ${difficulty} difficulty level. Include a mix of multiple-choice and short-answer questions.`,
//     },
//   ];

//   try {
//     const response = await openai.createChatCompletion({
//       model: "gpt-3.5-turbo", // You can also use "gpt-4" if you have access
//       messages: messages,
//       max_tokens: 1000,
//       temperature: 0.7,
//     });

//     // Extract the questions from the response
//     const questions = response.data.choices[0].message.content
//       .trim()
//       .split("\n")
//       .filter((q) => q);

//     return questions;
//   } catch (error) {
//     console.error("Error generating questions:", error);
//     throw new Error("Failed to generate questions from OpenAI");
//   }
// // }
// import OpenAI from "openai";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is stored in environment variables
// });

// export async function generateQuestions(topic, difficulty, numberOfQuestions) {
//   // Construct the messages for the chat model
//   const messages = [
//     {
//       role: "user",
//       content: `Generate ${numberOfQuestions} questions on the topic "${topic}" at a ${difficulty} difficulty level. Include a mix of multiple-choice and short-answer questions.`,
//     },
//   ];

//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo", // You can also use "gpt-4" if you have access
//       messages: messages,
//       max_tokens: 1000,
//       temperature: 0.7,
//     });

//     // Extract the questions from the response
//     const questions = response.choices[0].message.content
//       .trim()
//       .split("\n")
//       .filter((q) => q);

//     return questions;
//   } catch (error) {
//     console.error("Error generating questions:", error);
//     throw new Error("Failed to generate questions from OpenAI");
//   }
// }

import { callGeminiJson } from "./geminiService.js";

function normalizeQuestions(result) {
  const list = Array.isArray(result) ? result : result?.questions;
  if (!Array.isArray(list)) {
    throw new Error("No questions were generated.");
  }

  return list.map((item) => {
    const options = Array.isArray(item?.options)
      ? item.options.map((opt) => String(opt).trim()).filter(Boolean)
      : [];

    return {
      questionText: String(item?.questionText || item?.text || "").trim(),
      questionType:
        item?.questionType === "multiple-choice" || options.length > 0
          ? "multiple-choice"
          : "short-answer",
      options,
      correctAnswer: String(item?.correctAnswer || "").trim(),
    };
  }).filter((item) => item.questionText);
}

export async function generateQuestions({
  topic,
  difficulty,
  numberOfQuestions,
  subject,
  className,
}) {
  const prompt = `
Generate ${numberOfQuestions} school assessment questions as JSON only.

Context:
- Topic: ${topic}
- Subject: ${subject || "General"}
- Class: ${className || "General"}
- Difficulty: ${difficulty}

Return a JSON array. Each item must have:
- questionText: string
- questionType: "multiple-choice" or "short-answer"
- options: string[] (empty for short-answer)
- correctAnswer: string

Rules:
- Include a mix of multiple-choice and short-answer questions.
- For multiple-choice, provide exactly 4 options.
- Keep wording classroom-appropriate.
- Do not wrap the JSON in markdown fences.
`;

  const result = await callGeminiJson(prompt, {
    systemInstruction:
      "You are an expert teacher creating school exam questions. Return valid JSON only.",
    maxOutputTokens: 2200,
    temperature: 0.6,
  });

  return normalizeQuestions(result);
}
