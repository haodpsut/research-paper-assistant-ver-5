
import React from 'react';
import { ApiProvider } from '../types';
import { SparklesIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface SectionGeneratorControlsProps {
  onGenerateSection: (sectionType: 'introduction' | 'relatedWorks' | 'other') => void;
  selectedProvider: ApiProvider;
  onProviderChange: (provider: ApiProvider) => void;
  loading: boolean;
  canGenerate: boolean;
  
  selectedGeminiModel: string;
  onGeminiModelChange: (model: string) => void;
  
  selectedOpenRouterModel: string;
  onOpenRouterModelChange: (model: string) => void;
  isApiKeyAvailable: (provider: ApiProvider) => boolean;

  introRequirements: string;
  onIntroRequirementsChange: (value: string) => void;
  relatedWorksRequirements: string;
  onRelatedWorksRequirementsChange: (value: string) => void;
  otherRequirements: string;
  onOtherRequirementsChange: (value: string) => void;

  useGoogleSearch: boolean;
  onToggleGoogleSearch: () => void;
}

const SectionGeneratorControls: React.FC<SectionGeneratorControlsProps> = ({
  onGenerateSection,
  selectedProvider,
  onProviderChange,
  loading,
  canGenerate,
  selectedGeminiModel,
  onGeminiModelChange,
  selectedOpenRouterModel,
  onOpenRouterModelChange,
  isApiKeyAvailable,
  introRequirements,
  onIntroRequirementsChange,
  relatedWorksRequirements,
  onRelatedWorksRequirementsChange,
  otherRequirements,
  onOtherRequirementsChange,
  useGoogleSearch,
  onToggleGoogleSearch,
}) => {
  const geminiApiKeySet = isApiKeyAvailable(ApiProvider.GEMINI);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Generate Paper Sections</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="apiProvider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            AI Provider
          </label>
          <select
            id="apiProvider"
            name="apiProvider"
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
          {selectedProvider === ApiProvider.GEMINI && geminiApiKeySet && (
            <>
              <label htmlFor="geminiModelInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gemini Model (for Generation)
              </label>
              <input
                type="text"
                id="geminiModelInput"
                value={selectedGeminiModel}
                onChange={(e) => onGeminiModelChange(e.target.value)}
                placeholder="e.g., gemini-2.5-flash-preview-04-17"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm"
                disabled={loading}
              />
            </>
          )}

          {selectedProvider === ApiProvider.OPENROUTER && isApiKeyAvailable(ApiProvider.OPENROUTER) && (
            <>
              <label htmlFor="openRouterModelInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                OpenRouter Model (for Generation)
              </label>
              <input
                type="text"
                id="openRouterModelInput"
                value={selectedOpenRouterModel}
                onChange={(e) => onOpenRouterModelChange(e.target.value)}
                placeholder="e.g., openai/gpt-3.5-turbo"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm"
                disabled={loading}
              />
            </>
          )}
           {( (selectedProvider === ApiProvider.GEMINI && !geminiApiKeySet) ||
             (selectedProvider === ApiProvider.OPENROUTER && !isApiKeyAvailable(ApiProvider.OPENROUTER)) ) && (
                <div className="h-full flex items-end">
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Set API key for {selectedProvider} to select/enter a model.
                    </p>
                </div>
           )}
        </div>
      </div>
      
      {selectedProvider === ApiProvider.GEMINI && (
        <div className="mb-4">
          <div className="flex items-center">
            <input
              id="googleSearchToggle"
              type="checkbox"
              checked={useGoogleSearch}
              onChange={onToggleGoogleSearch}
              disabled={loading || !geminiApiKeySet}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
            />
            <label htmlFor="googleSearchToggle" className={`ml-2 text-sm font-medium ${!geminiApiKeySet ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
              Enable Google Search for grounding (Gemini only)
            </label>
          </div>
          {!geminiApiKeySet && <p className="text-xs text-gray-400 dark:text-gray-500 ml-6">Set Gemini API key to enable.</p>}
           {geminiApiKeySet && useGoogleSearch && <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-0.5">If enabled, Gemini may use Google Search to find relevant, up-to-date information. Sources will be cited if used.</p>}
        </div>
      )}


      <div className="space-y-4">
        <div>
          <label htmlFor="introRequirements" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Custom Requirements for Introduction (Optional)
          </label>
          <textarea
            id="introRequirements"
            rows={3}
            value={introRequirements}
            onChange={(e) => onIntroRequirementsChange(e.target.value)}
            placeholder="e.g., Focus on the historical context, specifically mention technique X, aim for a concise overview..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm"
            disabled={loading}
          />
          <button
            onClick={() => onGenerateSection('introduction')}
            disabled={loading || !canGenerate}
            className="mt-2 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
            aria-label="Generate Introduction"
          >
            {loading ? <LoadingSpinner size="w-5 h-5 mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
            Generate Introduction
          </button>
        </div>

        <div>
          <label htmlFor="relatedWorksRequirements" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Custom Requirements for Related Works (Optional)
          </label>
          <textarea
            id="relatedWorksRequirements"
            rows={3}
            value={relatedWorksRequirements}
            onChange={(e) => onRelatedWorksRequirementsChange(e.target.value)}
            placeholder="e.g., Compare approaches A and B, highlight gaps in current research, discuss recent advancements..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm"
            disabled={loading}
          />
          <button
            onClick={() => onGenerateSection('relatedWorks')}
            disabled={loading || !canGenerate}
            className="mt-2 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
            aria-label="Generate Related Works"
          >
            {loading ? <LoadingSpinner size="w-5 h-5 mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
            Generate Related Works
          </button>
        </div>

        <div>
          <label htmlFor="otherRequirements" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Custom Requirements for 'Write Other Things' (Required)
          </label>
          <textarea
            id="otherRequirements"
            rows={3}
            value={otherRequirements}
            onChange={(e) => onOtherRequirementsChange(e.target.value)}
            placeholder="Enter your specific instructions or prompt for generating custom text here..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-black placeholder-gray-500 dark:placeholder-gray-400 sm:text-sm"
            disabled={loading}
            aria-required="true"
          />
          <button
            onClick={() => onGenerateSection('other')}
            disabled={loading || !canGenerate || !otherRequirements.trim()}
            className="mt-2 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
            aria-label="Generate Custom Text for Write Other Things"
          >
            {loading ? <LoadingSpinner size="w-5 h-5 mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
            Generate Custom Text
          </button>
        </div>
      </div>
      {!canGenerate && <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-3">Please search for papers or upload documents, ensure relevant API keys are set for the chosen provider, and a model is entered. If using Google Search with Gemini, ensure it's enabled.</p>}
       {canGenerate && !otherRequirements.trim() && <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Custom requirements are needed to generate 'Write Other Things'.</p>}

    </div>
  );
};

export default SectionGeneratorControls;
