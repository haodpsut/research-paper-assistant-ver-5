
import { OPENROUTER_DEFAULT_MODEL } from '../constants';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterChatCompletionResponse {
  id: string;
  choices: {
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }[];
  // ... other fields
}

// Accepts a pre-formed array of messages
export async function generateTextWithOpenRouter(
  apiKey: string,
  messages: OpenRouterMessage[], // Changed from prompt, systemInstruction, history
  model: string = OPENROUTER_DEFAULT_MODEL
): Promise<string> {
  if (!apiKey) {
    throw new Error("OpenRouter API key is not set.");
  }
  if (!messages || messages.length === 0) {
    throw new Error("Messages array cannot be empty for OpenRouter.");
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages, // Pass the full messages array
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json() as OpenRouterChatCompletionResponse;
    
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else {
      throw new Error("OpenRouter returned no choices or an unexpected response format.");
    }
  } catch (error: any) {
    console.error("OpenRouter API error:", error);
    throw new Error(`OpenRouter API error: ${error.message || 'Unknown error'}`);
  }
}

export async function chatWithOpenRouter(
  apiKey: string,
  userMessageText: string,
  currentHistory: OpenRouterMessage[], 
  model: string = OPENROUTER_DEFAULT_MODEL,
  systemInstruction?: string 
): Promise<{ text: string; updatedHistory: OpenRouterMessage[] }> {
  
  const messagesForApi: OpenRouterMessage[] = [];

  // Add system instruction if provided and not already in history's start
  if (systemInstruction && (!currentHistory.length || currentHistory[0].role !== 'system')) {
    messagesForApi.push({ role: 'system', content: systemInstruction });
  }
  
  // Add existing history (ensuring no duplicate system message if systemInstruction was just added)
  if (currentHistory.length > 0) {
    if (messagesForApi.length > 0 && messagesForApi[0].role === 'system' && currentHistory[0].role === 'system') {
      // If systemInstruction was added AND history also starts with one, prefer the new one
      // Or, if systemInstruction was added, and history has one, we might risk duplication.
      // Safest: if new systemInstruction is added, and history starts with one, we replace.
      // For now, let's assume `currentHistory` doesn't get a system prompt if `systemInstruction` is passed.
      // The `App.tsx` logic for `effectiveSystemInstruction` tries to set it once.
       messagesForApi.push(...currentHistory.filter(m => m.role !== 'system' || !systemInstruction));
    } else {
       messagesForApi.push(...currentHistory);
    }
  }


  messagesForApi.push({ role: 'user', content: userMessageText });

  const aiResponseText = await generateTextWithOpenRouter(
      apiKey, 
      messagesForApi, // Pass the fully constructed message array
      model
  );

  const finalHistory: OpenRouterMessage[] = [
    ...messagesForApi, // This already includes the new user message
    { role: 'assistant', content: aiResponseText },
  ];
  
  return { text: aiResponseText, updatedHistory: finalHistory };
}
