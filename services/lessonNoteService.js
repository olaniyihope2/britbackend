import { callGemini } from "./geminiService.js";

export async function generateLessonNoteContent(topic, className, subject) {
  const prompt = `
Generate a detailed lesson note for:
- Topic: ${topic}
- Class: ${className}
- Subject: ${subject}

Structure the response with these headings:
1. Objectives
2. Introduction
3. Lesson Body
4. Conclusion
5. Assignment

Requirements:
- Write in clear teacher-friendly English.
- Make the lesson body detailed and broken into subtopics.
- Include examples and classroom applications.
- Keep it practical for a school environment.
`;

  return callGemini(prompt, {
    systemInstruction:
      "You are an expert school curriculum and lesson-note assistant. Write clear, practical lesson notes for classroom use.",
    maxOutputTokens: 2500,
    temperature: 0.7,
  });
}
