import fs from "fs";
import path from "path";

// Path to the subject data folder
const SUBJECT_DIR = path.join(process.cwd(), "public", "data", "subject");

// Get all subjects (folders inside /public/data/subject)
export const getSubjects = (req, res) => {
  try {
    const subjects = fs.readdirSync(SUBJECT_DIR).filter((f) =>
      fs.statSync(path.join(SUBJECT_DIR, f)).isDirectory()
    );
    res.json(subjects);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Unable to fetch subjects" });
  }
};

// Get topics for a specific subject
export const getSubjectTopics = (req, res) => {
  const { subject } = req.params;

  try {
    const topicsPath = path.join(SUBJECT_DIR, subject, "Topics.json");

    if (!fs.existsSync(topicsPath)) return res.json([]);

    const data = JSON.parse(fs.readFileSync(topicsPath, "utf-8"));

    // Return only the topic names
    const topicNames = data.map((topic) => topic.Name);

    res.json(topicNames);
  } catch (error) {
    console.error(`Error fetching topics for subject ${subject}:`, error);
    res.status(500).json({ error: "Unable to fetch topics" });
  }
};



// Get questions for a specific subject and selected topics
export const getQuestionsForSubject = (req, res) => {
  const { subject } = req.params;
  let { topics = [], limit = 50 } = req.query;

  // Ensure topics is an array
  if (typeof topics === "string") topics = [topics];
  limit = Number(limit);

  try {
    const topicsPath = path.join(SUBJECT_DIR, subject, "Topics.json");
    if (!fs.existsSync(topicsPath)) return res.json([]);

    const topicsData = JSON.parse(fs.readFileSync(topicsPath, "utf-8"));
    let allQuestions = [];

    for (const topic of topicsData) {
      if (topics.length && !topics.includes(topic.Name)) continue;

      for (const qRef of topic.Questions) {
        const yearFile = path.join(SUBJECT_DIR, subject, `${qRef.Year}.json`);
        if (!fs.existsSync(yearFile)) continue;

        const yearData = JSON.parse(fs.readFileSync(yearFile, "utf-8"));
        const questionKey = `Question ${qRef.Number}`;
        const question = yearData[questionKey];

        if (question) {
          allQuestions.push({
            ...question,
            Topic: topic.Name,
            Year: qRef.Year,
          });
        }
      }
    }

    // Shuffle questions
    allQuestions.sort(() => Math.random() - 0.5);

    res.json(allQuestions.slice(0, limit));
  } catch (error) {
    console.error(`Error fetching questions for ${subject}:`, error);
    res.status(500).json({ error: "Unable to fetch questions" });
  }
};