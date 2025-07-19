
import { GoogleGenAI, GenerateContentResponse, Chat, Part, Content, GenerateContentParameters } from "@google/genai";
import { GEMINI_TEXT_MODEL } from '../constants'; // Default model
import { GroundingChunk } from "../types";

let ai: GoogleGenAI | null = null;
let activeApiKey: string | null = null;

function getAi(apiKey: string): GoogleGenAI {
  if (ai && activeApiKey === apiKey) {
    return ai;
  }
  if (!apiKey) {
    throw new Error("Gemini API key is not set.");
  }
  ai = new GoogleGenAI({ apiKey });
  activeApiKey = apiKey;
  return ai;
}

export interface GeminiGenerateTextResult {
  text: string;
  groundingChunks?: GroundingChunk[];
}

// Accepts an array of Parts for content
export async function generateTextWithGemini(
  apiKey: string,
  parts: Part[], 
  model: string = GEMINI_TEXT_MODEL,
  systemInstruction?: string,
  useSearchGrounding: boolean = false
): Promise<GeminiGenerateTextResult> {
  const currentAi = getAi(apiKey);

  const request: GenerateContentParameters = {
    model: model,
    contents: [{ role: "user", parts: parts }],
    config: {},
  };

  if (request.config && systemInstruction) {
    request.config.systemInstruction = systemInstruction;
  }

  if (useSearchGrounding && request.config) {
    request.config.tools = [{ googleSearch: {} }];
  }

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent(request);
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    return {
      text: response.text,
      groundingChunks: groundingMetadata?.groundingChunks as GroundingChunk[] || undefined
    };
  } catch (error: any) {
    console.error("Gemini API error:", error);
    throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
  }
}

let geminiChatInstance: Chat | null = null;
let chatApiKey: string | null = null;
let chatSystemInstruction: string | null = null;
let chatModelUsed: string | null = null; 

export async function startOrContinueChatWithGemini(
  apiKey: string,
  userMessageParts: Part[], // Changed from userMessage: string
  history: Content[],
  model: string = GEMINI_TEXT_MODEL,
  systemInstruction?: string
): Promise<{ text: string; updatedHistory: Content[] }> {
  const currentAi = getAi(apiKey);

  if (!geminiChatInstance || chatApiKey !== apiKey || chatSystemInstruction !== systemInstruction || chatModelUsed !== model) {
    // History for a new chat instance should typically be only the system instruction if provided, 
    // or system instruction plus existing history if continuing a conceptual session.
    // The Gemini SDK's chat.create history is for initial turns before the first sendMessage.
     const initialHistoryForCreate: Content[] = [];
     if (systemInstruction) {
        // This is a common way to set system instructions for ongoing chats, though Gemini's `Chat` object takes it in `config`.
        // For SDK's `create`, the history parameter primes the conversation.
        // Let's rely on the config for systemInstruction and pass the provided history as is.
     }

    geminiChatInstance = currentAi.chats.create({
      model: model, 
      history: history, // Pass current history to prime the chat
      config: systemInstruction ? { systemInstruction: systemInstruction } : {},
    });
    chatApiKey = apiKey;
    chatSystemInstruction = systemInstruction; // Store for comparison
    chatModelUsed = model; 
  }

  try {
    // sendMessage should take the content for the current turn.
    // The history is managed by the Chat instance.
    // The `SendMessageRequest` interface expects { message: string | Part | (string | Part)[] }
    const response: GenerateContentResponse = await geminiChatInstance.sendMessage({ message: userMessageParts });
    const aiResponseText = response.text;
    
    // The history array passed to this function is the state from App.tsx
    // We need to append the user's turn and AI's response to it.
    const updatedHistory: Content[] = [
      ...history,
      { role: "user", parts: userMessageParts },
      { role: "model", parts: [{ text: aiResponseText }] }, // AI response is typically text
    ];

    return { text: aiResponseText, updatedHistory };
  } catch (error: any) {
    console.error("Gemini Chat API error:", error);
    if (error.message && error.message.includes("API key not valid")) {
      ai = null;
      activeApiKey = null;
      geminiChatInstance = null;
      chatApiKey = null;
      chatModelUsed = null;
    }
    throw new Error(`Gemini Chat API error: ${error.message || 'Unknown error'}`);
  }
}

export function resetGeminiChat() {
  geminiChatInstance = null;
  chatApiKey = null;
  chatSystemInstruction = null;
  chatModelUsed = null;
}
