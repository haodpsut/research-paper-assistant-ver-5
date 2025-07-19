
import React, { useCallback, useState } from 'react';
import { UploadedFile, UploadedFileStatus } from '../types';
import { UploadIcon, TrashIcon, FileTextIcon, PhotoIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface FileUploadManagerProps {
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TEXT_TYPES = ['text/plain'];
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']; // Gemini supports these

const FileUploadManager: React.FC<FileUploadManagerProps> = ({ uploadedFiles, setUploadedFiles }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File): Promise<Partial<UploadedFile>> => {
    return new Promise((resolve) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        resolve({ status: 'error', errorMessage: `File too large (max ${MAX_FILE_SIZE_MB}MB)` });
        return;
      }

      const reader = new FileReader();
      const fileType = file.type;

      if (ALLOWED_TEXT_TYPES.includes(fileType) || file.name.endsWith('.txt')) {
        reader.onload = (e) => {
          resolve({
            extractedText: e.target?.result as string,
            status: 'ready',
            mimeType: fileType || 'text/plain',
          });
        };
        reader.onerror = () => resolve({ status: 'error', errorMessage: 'Error reading text file' });
        reader.readAsText(file);
      } else if (ALLOWED_IMAGE_TYPES.includes(fileType)) {
        reader.onload = (e) => {
          resolve({
            base64Data: e.target?.result as string,
            status: 'ready',
            mimeType: fileType,
          });
        };
        reader.onerror = () => resolve({ status: 'error', errorMessage: 'Error reading image file' });
        reader.readAsDataURL(file);
      } else {
        resolve({ status: 'unsupported_type', errorMessage: 'File type not supported for content extraction.' });
      }
    });
  };

  const handleFilesSelected = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newUploads: UploadedFile[] = Array.from(selectedFiles).map(file => ({
      id: `${file.name}-${file.lastModified}-${file.size}`,
      file,
      status: 'pending' as UploadedFileStatus,
    }));

    setUploadedFiles(prev => [...prev, ...newUploads.filter(nu => !prev.find(ex => ex.id === nu.id))]); // Add only new files

    for (const newUpload of newUploads) {
      if (uploadedFiles.find(ex => ex.id === newUpload.id && ex.status !== 'pending')) continue; // Already processed or processing

      setUploadedFiles(prev => prev.map(f => f.id === newUpload.id ? { ...f, status: 'reading' } : f));
      const processingResult = await processFile(newUpload.file);
      setUploadedFiles(prev =>
        prev.map(f => (f.id === newUpload.id ? { ...f, ...processingResult } : f))
      );
    }
  }, [uploadedFiles, setUploadedFiles]);

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };
  
  const handleClearAllFiles = () => {
    setUploadedFiles([]);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const getFileIcon = (uploadedFile: UploadedFile) => {
    if (uploadedFile.mimeType?.startsWith('image/')) {
      return <PhotoIcon className="w-5 h-5 text-purple-500" />;
    }
    if (uploadedFile.mimeType === 'text/plain' || uploadedFile.file.name.endsWith('.txt')) {
      return <FileTextIcon className="w-5 h-5 text-blue-500" />;
    }
    return <FileTextIcon className="w-5 h-5 text-gray-500" />; // Default
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">Upload Documents/Images</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Upload .txt files or images (PNG, JPG, WEBP, max {MAX_FILE_SIZE_MB}MB each) to provide additional context.
        Content from these files will be used alongside selected papers for section generation.
      </p>

      <div 
        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 ${isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-700/10' : 'border-dashed'} rounded-md`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="space-y-1 text-center">
          <UploadIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <div className="flex text-sm text-gray-600 dark:text-gray-300">
            <label
              htmlFor="file-upload"
              className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800 focus-within:ring-primary-500"
            >
              <span>Upload files</span>
              <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={(e) => handleFilesSelected(e.target.files)} accept=".txt,image/png,image/jpeg,image/webp" />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">TXT, PNG, JPG, WEBP up to {MAX_FILE_SIZE_MB}MB</p>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-medium text-gray-700 dark:text-gray-200">Uploaded Files ({uploadedFiles.length}):</h3>
            <button
                onClick={handleClearAllFiles}
                className="px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-700/30 hover:bg-red-200 dark:hover:bg-red-600/40 rounded-md disabled:opacity-50"
            >
                Clear All
            </button>
          </div>
          <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-700/30">
            {uploadedFiles.map(uploadedFile => (
              <li key={uploadedFile.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-md shadow-sm">
                <div className="flex items-center space-x-2 overflow-hidden">
                  {getFileIcon(uploadedFile)}
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate" title={uploadedFile.file.name}>
                    {uploadedFile.file.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">({(uploadedFile.file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <div className="flex items-center space-x-2">
                  {uploadedFile.status === 'pending' && <span className="text-xs text-gray-400 dark:text-gray-500">Pending...</span>}
                  {uploadedFile.status === 'reading' && <LoadingSpinner size="w-4 h-4" />}
                  {uploadedFile.status === 'ready' && <span className="text-xs text-green-600 dark:text-green-400">Ready</span>}
                  {uploadedFile.status === 'error' && <span className="text-xs text-red-600 dark:text-red-400 truncate" title={uploadedFile.errorMessage}>Error</span>}
                  {uploadedFile.status === 'unsupported_type' && <span className="text-xs text-yellow-600 dark:text-yellow-400">Unsupported</span>}
                  <button onClick={() => handleRemoveFile(uploadedFile.id)} className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" aria-label="Remove file">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUploadManager;
