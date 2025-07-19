
import React from 'react';

interface CitationResultsDisplayProps {
  title: string;
  content: string;
  loading: boolean;
  error: string | null;
}

const CitationResultsDisplay: React.FC<CitationResultsDisplayProps> = ({ title, content, loading, error }) => {
  if (!content && !loading && !error) {
    return null; // Don't render if there's nothing to show
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{title}</h3>
      {loading && <p className="text-gray-600 dark:text-gray-300">Finding citations and generating references...</p>}
      {error && <p className="text-red-600 dark:text-red-400">Error: {error}</p>}
      {content && (
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
          {content}
        </div>
      )}
    </div>
  );
};

export default CitationResultsDisplay;
