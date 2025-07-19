
import React from 'react';
import { ApiProvider } from '../types';
import { SearchIcon } from './icons'; // Using SearchIcon, could be a more specific one
import LoadingSpinner from './LoadingSpinner';

interface FindCitationsControlsProps {
  inputText: string;
  onInputChange: (value: string) => void;
  onFindCitations: () => void;
  loading: boolean;
  
  // Reusing props from SectionGenerator for provider/model selection
  selectedProvider: ApiProvider;
  onProviderChange: (provider: ApiProvider) => void;
  selectedGeminiModel: string;
  onGeminiModelChange: (model: string) => void;
  selectedOpenRouterModel: string;
  onOpenRouterModelChange: (model: string) => void;
  isApiKeyAvailable: (provider: ApiProvider) => boolean;
  isSemanticScholarKeySet: boolean;
}

const FindCitationsControls: React.FC<FindCitationsControlsProps> = ({
  inputText,
  onInputChange,
  onFindCitations,
  loading,
  selectedProvider,
  onProviderChange,
  selectedGeminiModel,
  onGeminiModelChange,
  selectedOpenRouterModel,
  onOpenRouterModelChange,
  isApiKeyAvailable,
  isSemanticScholarKeySet,
}) => {
  const aiProviderApiKeySet = isApiKeyAvailable(selectedProvider);
  const canFindCitations = inputText.trim() !== '' && aiProviderApiKeySet && isSemanticScholarKeySet && 
                           (selectedProvider === ApiProvider.GEMINI ? !!selectedGeminiModel.trim() : !!selectedOpenRouterModel.trim());

  return (
    <div className="p-4 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Find Citations</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
        <div>
          <label htmlFor="citationApiProvider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            AI Provider (for analysis)
          </label>
          <select
            id="citationApiProvider"
            name="citationApiProvider"
            value={selectedProvider}
            onChange={(e) => onProviderChange(e.target.value as ApiProvider)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black sm:text-sm"
            disabled={loading}
          >
            <option value={ApiProvider.GEMINI}>Gemini</option>
            <option value={ApiProvider.OPENROUTER}>OpenRouter</option>
          </select>
        </div>

        <div>
          {selectedProvider === ApiProvider.GEMINI && aiProviderApiKeySet && (
            <>
              <label htmlFor="citationGeminiModelInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gemini Model
              </label>
              <input
                type="text"
                id="citationGeminiModelInput"
                value={selectedGeminiModel}
                onChange={(e) => onGeminiModelChange(e.target.value)}
                placeholder="e.g., gemini-2.5-flash-preview-04-17"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm"
                disabled={loading}
              />
            </>
          )}
          {selectedProvider === ApiProvider.OPENROUTER && aiProviderApiKeySet && (
            <>
              <label htmlFor="citationOpenRouterModelInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                OpenRouter Model
              </label>
              <input
                type="text"
                id="citationOpenRouterModelInput"
                value={selectedOpenRouterModel}
                onChange={(e) => onOpenRouterModelChange(e.target.value)}
                placeholder="e.g., openai/gpt-3.5-turbo"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm"
                disabled={loading}
              />
            </>
          )}
          {!aiProviderApiKeySet && (
            <div className="h-full flex items-end">
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Set AI API key for {selectedProvider} to select/enter a model.
                </p>
            </div>
           )}
        </div>
      </div>
      {!isSemanticScholarKeySet && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
            Semantic Scholar API Key is required to search for papers.
        </p>
      )}


      <div>
        <label htmlFor="inputTextForCitations" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Enter Text to Find Citations For
        </label>
        <textarea
          id="inputTextForCitations"
          rows={5}
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Paste text here... The tool will search Semantic Scholar for relevant papers and suggest citations."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm"
          disabled={loading}
        />
        <button
          onClick={onFindCitations}
          disabled={loading || !canFindCitations}
          className="mt-2 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
          aria-label="Find Citations"
        >
          {loading ? <LoadingSpinner size="w-5 h-5 mr-2" /> : <SearchIcon className="w-5 h-5 mr-2" />}
          Find Citations
        </button>
      </div>
      {!canFindCitations && !loading && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-3">
          Please enter text, ensure Semantic Scholar and relevant AI Provider API keys are set, and a model is specified.
        </p>
      )}
    </div>
  );
};

export default FindCitationsControls;
