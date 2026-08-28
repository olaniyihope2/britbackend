import { callGemini } from "./geminiService.js";

export const generateFieldsFromOpenAI = async () => {
  const prompt = `
List professional and academic fields.
Return one field per line only.
Keep each field concise.
`;

  const fieldsText = await callGemini(prompt, {
    systemInstruction:
      "You are an assistant that lists broad academic and professional fields. Return plain text with one item per line.",
    maxOutputTokens: 300,
    temperature: 0.4,
  });

  return fieldsText
    .split("\n")
    .map((field) => field.replace(/^\d+[\).\-\s]*/, "").trim())
    .filter(Boolean);
};
