
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ApiProvider } from '../types';
import { PaperAirplaneIcon, SparklesIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface ChatWindowProps {
  messages: ChatMessage[];
  onSendMessage: (messageText: string, provider: ApiProvider, model: string) => Promise<void>;
  loading: boolean;
  chatError: string | null;
  activeProvider: ApiProvider;
  onProviderChange: (provider: ApiProvider) => void; 
  isApiKeySet: (provider: ApiProvider) => boolean;

  selectedGeminiModel: string;
  onGeminiModelChange: (model: string) => void;
  
  selectedOpenRouterModel: string;
  onOpenRouterModelChange: (model: string) => void;

  useChatWithContext: boolean;
  onToggleChatContext: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ 
  messages, onSendMessage, loading, chatError, 
  activeProvider, onProviderChange, isApiKeySet,
  selectedGeminiModel, onGeminiModelChange,
  selectedOpenRouterModel, onOpenRouterModelChange,
  useChatWithContext, onToggleChatContext
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentModel = activeProvider === ApiProvider.GEMINI ? selectedGeminiModel : selectedOpenRouterModel;
    if (input.trim() && !loading && isApiKeySet(activeProvider) && currentModel && currentModel.trim()) {
      await onSendMessage(input.trim(), activeProvider, currentModel.trim());
      setInput('');
    } else if (!isApiKeySet(activeProvider)) {
        alert(`Please set the API key for ${activeProvider} to use the chat.`);
    } else if (!currentModel || !currentModel.trim()) {
        alert(`Please enter a model name for ${activeProvider} to use the chat.`);
    }
  };
  
  const currentModelForChat = activeProvider === ApiProvider.GEMINI ? selectedGeminiModel : selectedOpenRouterModel;
  const modelNameForPlaceholder = currentModelForChat?.split('/').pop() || 'model';

  return (
    <div className="p-4 bg-white dark:bg-gray-800 shadow-md rounded-lg flex flex-col h-[500px] sm:h-[600px] md:h-[700px] lg:h-auto">
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
              <SparklesIcon className="w-6 h-6 mr-2 text-primary-600 dark:text-primary-400" />
              AI Chat 
              <span className="text-xs ml-1.5 text-gray-500 dark:text-gray-400">
                (Context: {useChatWithContext ? 'On' : 'Off'})
              </span>
            </h2>
            <select
                id="chatApiProvider"
                name="chatApiProvider"
                value={activeProvider}
                onChange={(e) => onProviderChange(e.target.value as ApiProvider)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black sm:text-sm text-xs"
                disabled={loading}
            >
                <option value={ApiProvider.GEMINI}>Gemini</option>
                <option value={ApiProvider.OPENROUTER}>OpenRouter</option>
            </select>
        </div>

        {/* Context Toggle */}
        <div className="flex items-center space-x-2 my-2.5">
            <label htmlFor="chatContextToggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Use Research Context:
            </label>
            <input
                type="checkbox"
                id="chatContextToggle"
                checked={useChatWithContext}
                onChange={onToggleChatContext}
                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-offset-gray-800"
            />
             <span className="text-xs text-gray-500 dark:text-gray-400">(Clears chat on change)</span>
        </div>
        
        {/* Model Input for Chat */}
        {activeProvider === ApiProvider.GEMINI && isApiKeySet(ApiProvider.GEMINI) && (
            <div className="mt-2">
            <label htmlFor="chatGeminiModelInput" className="sr-only">Gemini Model for Chat</label>
            <input
                type="text"
                id="chatGeminiModelInput"
                value={selectedGeminiModel}
                onChange={(e) => onGeminiModelChange(e.target.value)}
                placeholder="Enter Gemini model name"
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm text-xs"
                disabled={loading}
            />
            </div>
        )}
        {activeProvider === ApiProvider.OPENROUTER && isApiKeySet(ApiProvider.OPENROUTER) && (
            <div className="mt-2">
            <label htmlFor="chatOpenRouterModelInput" className="sr-only">OpenRouter Model for Chat</label>
             <input
                type="text"
                id="chatOpenRouterModelInput"
                value={selectedOpenRouterModel}
                onChange={(e) => onOpenRouterModelChange(e.target.value)}
                placeholder="Enter OpenRouter model name (e.g. openai/gpt-4o)"
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm text-xs"
                disabled={loading}
            />
            </div>
        )}
         {((activeProvider === ApiProvider.GEMINI && !isApiKeySet(ApiProvider.GEMINI)) ||
            (activeProvider === ApiProvider.OPENROUTER && !isApiKeySet(ApiProvider.OPENROUTER))) && (
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 text-center">
                Set API key for {activeProvider} to enter model and chat.
            </p>
        )}
      </div>
      
      <div className="flex-grow overflow-y-auto mb-3 pr-2 space-y-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md min-h-[200px]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-2.5 rounded-lg shadow ${
              msg.sender === 'user' 
                ? 'bg-primary-500 text-white rounded-br-none' 
                : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-bl-none'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <p className="text-xs mt-1 opacity-70 text-right">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {loading && messages.length > 0 && messages[messages.length-1].sender === 'user' && (
           <div className="flex justify-start">
             <div className="max-w-[70%] p-2.5 rounded-lg shadow bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-bl-none">
                <LoadingSpinner size="w-5 h-5" />
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {chatError && <p className="text-red-500 dark:text-red-400 text-xs mb-2 text-center">{chatError}</p>}
      <form onSubmit={handleSend} className="flex items-center space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            !isApiKeySet(activeProvider) ? 
            `Set ${activeProvider} API key first...` : 
            (!currentModelForChat || !currentModelForChat.trim() ? 
              `Enter model for ${activeProvider}...` :
              (useChatWithContext ? `Ask about the research context (${modelNameForPlaceholder})...` : `Ask ${activeProvider} (${modelNameForPlaceholder})...`))
          }
          className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm"
          disabled={loading || !isApiKeySet(activeProvider) || !currentModelForChat || !currentModelForChat.trim()}
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || !isApiKeySet(activeProvider) || !currentModelForChat || !currentModelForChat.trim()}
          className="inline-flex items-center justify-center p-2.5 border border-transparent rounded-full shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
          aria-label="Send message"
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

export default ChatWindow;
