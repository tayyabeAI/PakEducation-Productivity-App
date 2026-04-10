import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getProductivityRecommendations(tasks: any[], goals: any[]) {
  try {
    const prompt = `
      As a productivity expert, analyze the following tasks and goals and provide 3 personalized recommendations to improve efficiency.
      
      Tasks: ${JSON.stringify(tasks.map(t => ({ title: t.title, status: t.status, priority: t.priority })))}
      Goals: ${JSON.stringify(goals.map(g => ({ title: g.title, progress: g.progress, type: g.type })))}
      
      Provide recommendations in a professional, encouraging tone.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  impact: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
                },
                required: ["title", "description", "impact"]
              }
            }
          },
          required: ["recommendations"]
        }
      }
    });

    return JSON.parse(response.text).recommendations;
  } catch (error) {
    console.error("Error getting AI recommendations:", error);
    return [];
  }
}
