
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Paper, ChatMessage, ApiProvider, ApiKeyName, ApiKeys, GroundingChunk, UploadedFile, UploadedFileStatus } from './types';
import { 
    APP_TITLE, MAX_CONTEXT_LENGTH_WORDS, 
    GEMINI_TEXT_MODEL, OPENROUTER_DEFAULT_MODEL, 
    PAPERS_PER_PAGE, PRACTICAL_SELECT_ALL_LIMIT,
    AVAILABLE_GEMINI_MODELS, AVAILABLE_OPENROUTER_MODELS,
    MAX_CHAT_CONTEXT_LENGTH_WORDS, CHAT_BASE_SYSTEM_INSTRUCTION
} from './constants';
import { DEEP_RESEARCH_QUERY_PROMPT_TEMPLATE, ADVANCED_PROMPT_GENERATOR_META_PROMPT } from './prompts';
import { useLocalStorage } from './hooks/useLocalStorage';
import ApiKeyManager from './components/ApiKeyManager';
import PaperSearchForm from './components/PaperSearchForm';
import PaperListDisplay from './components/PaperListDisplay';
import SectionGeneratorControls from './components/SectionGeneratorControls';
import GeneratedSectionDisplay from './components/GeneratedSectionDisplay';
import ChatWindow from './components/ChatWindow';
import FileUploadManager from './components/FileUploadManager';
import FindCitationsControls from './components/FindCitationsControls'; 
import CitationResultsDisplay from './components/CitationResultsDisplay'; 
import { searchSemanticScholarPapers, SemanticScholarSearchResponse, fetchAllPapersForTopic } from './services/semanticScholar';
import { generateTextWithGemini, startOrContinueChatWithGemini, resetGeminiChat, GeminiGenerateTextResult } from './services/gemini';
import { generateTextWithOpenRouter, chatWithOpenRouter, OpenRouterMessage } from './services/openrouter';
import { Content, Part } from '@google/genai'; 

const App: React.FC = () => {
  const defaultApiKeys: ApiKeys = { semanticScholar: '', gemini: '', openRouter: '' };
  const [apiKeys, setApiKeys] = useState<ApiKeys>(defaultApiKeys);

  const [researchTopic, setResearchTopic] = useLocalStorage<string>('researchTopic', '');
  const [papers, setPapers] = useState<Paper[]>([]); 
  const [selectedPaperIds, setSelectedPaperIds] = useLocalStorage<string[]>('selectedPaperIds', []);
  
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useLocalStorage<number>('currentPage', 1);
  const [totalPapers, setTotalPapers] = useLocalStorage<number>('totalPapers', 0);
  
  const [cachedPapers, setCachedPapers] = useState<Map<string, Paper>>(new Map());
  const [selectingAllPapersLoading, setSelectingAllPapersLoading] = useState<boolean>(false);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);


  const [generationProvider, setGenerationProvider] = useLocalStorage<ApiProvider>('generationProvider', ApiProvider.GEMINI);
  const [introContent, setIntroContent] = useLocalStorage<string>('introContent', '');
  const [relatedWorksContent, setRelatedWorksContent] = useLocalStorage<string>('relatedWorksContent', '');
  const [otherContent, setOtherContent] = useLocalStorage<string>('otherContent', '');

  const [introGrounding, setIntroGrounding] = useLocalStorage<GroundingChunk[] | undefined>('introGrounding', undefined);
  const [relatedWorksGrounding, setRelatedWorksGrounding] = useLocalStorage<GroundingChunk[] | undefined>('relatedWorksGrounding', undefined);
  const [otherGrounding, setOtherGrounding] = useLocalStorage<GroundingChunk[] | undefined>('otherGrounding', undefined);
  
  const [generationLoading, setGenerationLoading] = useState<boolean>(false);
  const [introError, setIntroError] = useState<string | null>(null);
  const [relatedWorksError, setRelatedWorksError] = useState<string | null>(null);
  const [otherError, setOtherError] = useState<string | null>(null);

  const [introRequirements, setIntroRequirements] = useLocalStorage<string>('introRequirements', '');
  const [relatedWorksRequirements, setRelatedWorksRequirements] = useLocalStorage<string>('relatedWorksRequirements', '');
  const [otherRequirements, setOtherRequirements] = useLocalStorage<string>('otherRequirements', '');
  
  const [useGoogleSearchForGeneration, setUseGoogleSearchForGeneration] = useLocalStorage<boolean>('useGoogleSearchForGeneration', false);

  const [inputTextForCitations, setInputTextForCitations] = useLocalStorage<string>('inputTextForCitations', '');
  const [citationsOutput, setCitationsOutput] = useLocalStorage<string>('citationsOutput', '');
  const [citationsLoading, setCitationsLoading] = useState<boolean>(false);
  const [citationsError, setCitationsError] = useState<string | null>(null);


  const [chatMessages, setChatMessages] = useLocalStorage<ChatMessage[]>('chatMessages', []);
  const [chatProvider, setChatProvider] = useLocalStorage<ApiProvider>('chatProvider', ApiProvider.GEMINI);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  
  const [geminiChatHistory, setGeminiChatHistory] = useLocalStorage<Content[]>('geminiChatHistory', []);
  const [openRouterChatHistory, setOpenRouterChatHistory] = useLocalStorage<OpenRouterMessage[]>('openRouterChatHistory', []);

  const [selectedGeminiModel, setSelectedGeminiModel] = useLocalStorage<string>(
    'selectedGeminiModel', 
    AVAILABLE_GEMINI_MODELS[0] || GEMINI_TEXT_MODEL
  );
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useLocalStorage<string>(
    'selectedOpenRouterModel', 
    AVAILABLE_OPENROUTER_MODELS[0] || OPENROUTER_DEFAULT_MODEL
  );
  
  const [useChatWithContext, setUseChatWithContext] = useLocalStorage<boolean>('useChatWithContext', false);

  const handleApiKeyChange = (name: ApiKeyName, value: string) => {
    setApiKeys(prev => ({ ...prev, [name]: value }));
    if (name === 'gemini') {
        resetGeminiChat(); 
        setGeminiChatHistory([]);
    }
     if (name === 'openRouter') {
        setOpenRouterChatHistory([]);
    }
  };

  const handleSelectedGeminiModelChange = (model: string) => {
    setSelectedGeminiModel(model);
    resetGeminiChat(); 
    setGeminiChatHistory([]); 
  };

  const handleSelectedOpenRouterModelChange = (model: string) => {
    setSelectedOpenRouterModel(model);
    setOpenRouterChatHistory([]); 
  };
  
  const handleToggleChatContext = () => {
    setUseChatWithContext(prev => {
        const newState = !prev;
        setChatMessages([]);
        setGeminiChatHistory([]);
        setOpenRouterChatHistory([]);
        resetGeminiChat(); 
        return newState;
    });
  };

  const fetchPapersForPage = useCallback(async (topic: string, page: number) => {
    if (!apiKeys.semanticScholar) {
      setSearchError("Semantic Scholar API key is not set.");
      setPapers([]);
      setTotalPapers(0);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const offset = (page - 1) * PAPERS_PER_PAGE;
      
      const response: SemanticScholarSearchResponse = await searchSemanticScholarPapers(
        topic, 
        apiKeys.semanticScholar, 
        PAPERS_PER_PAGE, 
        offset
      );
      setPapers(response.papers);
      setTotalPapers(response.total);
      setCurrentPage(page);
      setCachedPapers(prevCache => {
        const newCache = new Map(prevCache);
        response.papers.forEach(p => newCache.set(p.paperId, p));
        return newCache;
      });
    } catch (err: any) {
      setSearchError(err.message || "Failed to fetch papers.");
      setPapers([]); 
      setTotalPapers(0);
    } finally {
      setSearchLoading(false);
    }
  }, [apiKeys.semanticScholar, setCurrentPage, setTotalPapers]); 

  const handleSearch = async (topic: string) => {
    setResearchTopic(topic);
    setSelectedPaperIds([]); 
    setIntroContent(''); 
    setRelatedWorksContent('');
    setOtherContent('');
    setIntroGrounding(undefined);
    setRelatedWorksGrounding(undefined);
    setOtherGrounding(undefined);
    setCachedPapers(new Map());
    await fetchPapersForPage(topic, 1); 
  };

  const handlePageChange = (newPage: number) => {
    if (researchTopic) {
      fetchPapersForPage(researchTopic, newPage); 
    }
  };

  const toggleSelectPaper = (paperId: string) => {
    setSelectedPaperIds(prevArray => {
      const newSet = new Set(prevArray);
      if (newSet.has(paperId)) {
        newSet.delete(paperId);
      } else {
        newSet.add(paperId);
      }
      return Array.from(newSet);
    });
  };

  const handleSelectAllOnPage = () => {
    const paperIdsOnPage = papers.map(p => p.paperId); 
    setSelectedPaperIds(prevArray => {
        const newSet = new Set(prevArray);
        paperIdsOnPage.forEach(id => newSet.add(id));
        return Array.from(newSet);
    });
  };

  const handleDeselectAllPapers = () => {
    setSelectedPaperIds([]);
  };

  const handleSelectAllAcrossPages = async () => {
    if (!researchTopic || !apiKeys.semanticScholar) {
      setSearchError("Cannot select all papers without a topic and Semantic Scholar API key.");
      return;
    }
    setSelectingAllPapersLoading(true);
    setSearchError(null);
    try {
      const allFoundPapers = await fetchAllPapersForTopic(researchTopic, apiKeys.semanticScholar, PRACTICAL_SELECT_ALL_LIMIT);
      setCachedPapers(prevCache => {
        const newCache = new Map(prevCache);
        allFoundPapers.forEach(p => newCache.set(p.paperId, p));
        return newCache;
      });
      setSelectedPaperIds(allFoundPapers.map(p => p.paperId));
    } catch (err: any) {
      setSearchError(err.message || "Failed to fetch all papers.");
    } finally {
      setSelectingAllPapersLoading(false);
    }
  };

  const getContextFromSelectedPapers = (): string => {
    let context = "";
    let wordCount = 0;
    let paperCounter = 1;
    const papersToConsider: Paper[] = [];
    const currentSelectedPaperIdSet = new Set(selectedPaperIds);

    if (currentSelectedPaperIdSet.size > 0) {
        currentSelectedPaperIdSet.forEach(id => {
            const paper = cachedPapers.get(id);
            if (paper) papersToConsider.push(paper);
        });
    } else { 
        papers.forEach(p => { 
            const cachedPaper = cachedPapers.get(p.paperId);
            if(cachedPaper) papersToConsider.push(cachedPaper);
        });
    }
    
    papersToConsider.sort((a, b) => { 
        const citationDiff = (b.citationCount ?? 0) - (a.citationCount ?? 0);
        if (citationDiff !== 0) return citationDiff;
        return (b.year ?? 0) - (a.year ?? 0);
    });

    for (const p of papersToConsider) {
        const authorNames = p.authors?.map(a => a.name).join(', ') || 'N/A';
        // Ensure URL is included here for the AI to use
        const paperInfo = `[${paperCounter}] Title: ${p.title}\nAuthors: ${authorNames}\nYear: ${p.year || 'N/A'}\nVenue: ${p.venue || 'N/A'}\nURL: ${p.url || 'N/A'}\nAbstract: ${p.abstract || 'N/A'}\n\n`;
        const currentPaperWordCount = paperInfo.split(/\s+/).length;

        if (wordCount + currentPaperWordCount <= MAX_CONTEXT_LENGTH_WORDS) {
            context += paperInfo;
            wordCount += currentPaperWordCount;
            paperCounter++;
        } else {
            break; 
        }
    }
    return context.trim();
  };
  
  const getActiveResearchContext = (wordLimit: number): string => {
    let combinedContext = "";
    let currentWordCount = 0;

    const papersToConsiderForContext: Paper[] = [];
    const currentSelectedPaperIdSet = new Set(selectedPaperIds);

    if (currentSelectedPaperIdSet.size > 0) {
        currentSelectedPaperIdSet.forEach(id => {
            const paper = cachedPapers.get(id);
            if (paper) papersToConsiderForContext.push(paper);
        });
    } else { 
        papers.forEach(p => { 
            const cachedPaper = cachedPapers.get(p.paperId);
            if (cachedPaper) papersToConsiderForContext.push(cachedPaper);
        });
    }
     papersToConsiderForContext.sort((a, b) => { 
        const citationDiff = (b.citationCount ?? 0) - (a.citationCount ?? 0);
        if (citationDiff !== 0) return citationDiff;
        return (b.year ?? 0) - (a.year ?? 0);
    });

    let paperContext = "Summaries of relevant papers (including URLs if available):\n";
    for (const p of papersToConsiderForContext) {
        const paperInfo = `Title: ${p.title}\nAuthors: ${p.authors?.map(a=>a.name).join(', ')}\nYear: ${p.year}\nURL: ${p.url || 'N/A'}\nAbstract: ${p.abstract}\n\n`;
        const paperWordCount = paperInfo.split(/\s+/).length;
        if (currentWordCount + paperWordCount <= wordLimit) {
            paperContext += paperInfo;
            currentWordCount += paperWordCount;
        } else break;
    }
    if (paperContext !== "Summaries of relevant papers (including URLs if available):\n") combinedContext += paperContext;

    const uploadedTextParts: string[] = [];
    uploadedFiles.forEach(f => {
        if (f.status === 'ready' && f.extractedText) {
            uploadedTextParts.push(`--- From uploaded file: ${f.file.name} ---\n${f.extractedText}\n--- End of file: ${f.file.name} ---`);
        }
    });
    const uploadedTextContext = uploadedTextParts.join('\n\n');
    
    if (uploadedTextContext) {
        const uploadedTextWordCount = uploadedTextContext.split(/\s+/).length;
        if (currentWordCount + uploadedTextWordCount <= wordLimit) {
            if (combinedContext) combinedContext += '\n\n'; 
            combinedContext += `Additional context from uploaded documents:\n${uploadedTextContext}`;
            currentWordCount += uploadedTextWordCount;
        }
    }

    if (introContent) {
        const introWordCount = introContent.split(/\s+/).length;
        if (currentWordCount + introWordCount <= wordLimit) {
            if (combinedContext) combinedContext += '\n\n';
            combinedContext += `Previously generated Introduction section:\n${introContent}`;
            currentWordCount += introWordCount;
        }
    }
    if (relatedWorksContent) {
        const rwWordCount = relatedWorksContent.split(/\s+/).length;
        if (currentWordCount + rwWordCount <= wordLimit) {
            if (combinedContext) combinedContext += '\n\n';
            combinedContext += `Previously generated Related Works section:\n${relatedWorksContent}`;
            currentWordCount += rwWordCount;
        }
    }
    if (otherContent) {
        const otherWordCount = otherContent.split(/\s+/).length;
        if (currentWordCount + otherWordCount <= wordLimit) {
            if (combinedContext) combinedContext += '\n\n';
            combinedContext += `Previously generated "Other Things" section:\n${otherContent}`;
            currentWordCount += otherWordCount;
        }
    }
    return combinedContext.trim();
  };

  const handleGenerateSection = async (sectionType: 'introduction' | 'relatedWorks' | 'other') => {
    const paperContext = getContextFromSelectedPapers(); 
    if (!researchTopic && sectionType !== 'other') { // 'other' might be topic-agnostic if user prompt is self-contained
      alert("Please search for a topic first for Introduction or Related Works."); return;
    }
    if (!researchTopic && sectionType === 'other' && !otherRequirements.trim()){
      alert("Please provide a research topic or specific requirements for 'Write Other Things'."); return;
    }


    const apiKey = generationProvider === ApiProvider.GEMINI ? apiKeys.gemini : apiKeys.openRouter;
    const modelToUse = generationProvider === ApiProvider.GEMINI ? selectedGeminiModel.trim() : selectedOpenRouterModel.trim();

    if (!apiKey) {
      alert(`API key for ${generationProvider} is not set.`); return;
    }
    if (!modelToUse) {
      alert(`Model for ${generationProvider} is not entered or is empty.`); return;
    }

    setGenerationLoading(true);
    if (sectionType === 'introduction') { setIntroError(null); setIntroContent(''); setIntroGrounding(undefined); }
    if (sectionType === 'relatedWorks') { setRelatedWorksError(null); setRelatedWorksContent(''); setRelatedWorksGrounding(undefined); }
    if (sectionType === 'other') { setOtherError(null); setOtherContent(''); setOtherGrounding(undefined); }

    let finalSystemInstructionForGenerator = '';
    let finalUserQueryForGenerator = '';
    const actionVerb = sectionType === 'introduction' ? "an Introduction" : sectionType === 'relatedWorks' ? "a Related Works section" : "a custom text output";
    const baseInstructionForReferences = `When citing papers from the provided context (which includes summaries and URLs from Semantic Scholar), you MUST include full reference details in a 'References' section specific to THIS generated content. Format these references as: "[Number] Authors (Year). Title. *Venue*. URL: [Full Semantic Scholar URL from context]". For Google Search results (if used with Gemini), cite as "[Web X]" in the text and list them as "[Web X] Title - URL" in the 'References' section. Ensure this 'References' section is clearly distinct, appears at the end of the generated content for this section, and only lists items actually cited in *this specific* generated piece. Numbering in the text and references must correspond. If citing uploaded files, refer to them by filename (e.g., "As stated in 'filename.txt', ...") and do not include them in the numbered 'References' list unless explicitly asked.`;

    const callIntermediateAI = async (task: string, metaPrompt: string): Promise<string> => {
        let resultText = '';
        if (generationProvider === ApiProvider.GEMINI) {
            const result = await generateTextWithGemini(apiKey, [{ text: task }], modelToUse, metaPrompt, false);
            resultText = result.text;
        } else { // OpenRouter
            const messages: OpenRouterMessage[] = [{ role: 'system', content: metaPrompt }, { role: 'user', content: task }];
            resultText = await generateTextWithOpenRouter(apiKey, messages, modelToUse);
        }
        if (!resultText.trim()) throw new Error("Intermediate AI call (prompt generation/refinement) returned empty content.");
        return resultText;
    };

    try {
        if (sectionType === 'introduction' || sectionType === 'relatedWorks') {
            const userProvidedRequirements = sectionType === 'introduction' ? introRequirements.trim() : relatedWorksRequirements.trim();

            if (!userProvidedRequirements) {
                const taskForInitialPrompt = `You are to generate a highly detailed and effective *prompt* (not the section itself) for another AI. This generated prompt will instruct that AI on how to write an outstanding '${sectionType}' section for a research paper on the topic: "${researchTopic}". The *prompt you generate* MUST explicitly instruct the target AI to:
1.  Thoroughly analyze the research topic ("${researchTopic}") and any provided context (which will include paper summaries with author, year, title, venue, URL, and abstract, plus content from user-uploaded files).
2.  Logically structure the '${sectionType}' section, covering all essential components relevant to academic standards for such a section.
3.  Maintain a formal, objective, and analytical academic tone and style throughout the '${sectionType}'.
4.  Naturally and critically integrate information from the provided paper summaries, citing them in-text as [1], [2], etc.
5.  Incorporate relevant information from user-uploaded files, citing them by filename (e.g., "Details from 'report.txt' suggest...").
6.  If Google Search is used (applicable for Gemini provider), cite web sources found as [Web 1], [Web 2], etc.
7.  Conclude the generated '${sectionType}' with a clearly demarcated 'References' section. This 'References' section MUST:
    a. List *only* the sources (papers from context, web results from Google Search) that were *actually cited* within this specific '${sectionType}'.
    b. Format paper references meticulously as: [Number] Author(s) (Year). Title of Paper. *Venue/Journal*. URL: [Full Semantic Scholar URL as provided in the context].
    c. Format web references (if any) as: [Web X] Title of Webpage - Full URL.
    d. Ensure the numbering in this 'References' list precisely matches the in-text citation markers used.
    e. This 'References' list is unique to this '${sectionType}' and should not include general knowledge or uncited sources.`;
                
                let initialPrompt = await callIntermediateAI(taskForInitialPrompt, DEEP_RESEARCH_QUERY_PROMPT_TEMPLATE);
                let refinedPrompt = await callIntermediateAI(initialPrompt, ADVANCED_PROMPT_GENERATOR_META_PROMPT);
                
                finalSystemInstructionForGenerator = refinedPrompt; // This IS the detailed prompt for the section-writing AI
                finalUserQueryForGenerator = `The research topic is: "${researchTopic}". Please follow your detailed system instructions precisely. You will be provided with context from research papers and uploaded files. Remember the specific instructions about citation and reference formatting.`;
            } else {
                let refinedUserReqs = await callIntermediateAI(userProvidedRequirements, ADVANCED_PROMPT_GENERATOR_META_PROMPT);
                finalSystemInstructionForGenerator = `You are an expert academic writing assistant. Your task is to write a high-quality '${sectionType}' section for a research paper. You MUST strictly follow the refined user requirements provided in the user message. ${baseInstructionForReferences}`;
                finalUserQueryForGenerator = `The research topic is: "${researchTopic}".
Please write ${actionVerb} based on the following refined requirements:
${refinedUserReqs}
Remember to use the provided context (research papers, uploaded files, and potentially Google Search results) as detailed in your general instructions, and to format citations and references correctly according to the system prompt.`;
            }
        } else { // sectionType === 'other'
            const otherUserReqs = otherRequirements.trim();
            if (!otherUserReqs) {
                alert("Please provide your custom requirements for the 'Write Other Things' section.");
                setGenerationLoading(false); return;
            }
            finalSystemInstructionForGenerator = `You are an expert AI assistant. Your primary goal is to fulfill the user's custom requirements for generating text. You are given a research topic (if any), context from research papers, text from user-uploaded documents, and potentially image data or Google Search results. Adhere strictly to the user's specified requirements. If academic conventions like citations and references are implied or requested by the user's requirements, ${baseInstructionForReferences.replace("When citing papers from the provided context", "when citing papers from any provided context")}`;
            finalUserQueryForGenerator = `Research Topic: "${researchTopic || 'Not specified, rely on custom requirements.'}"
User-Specified Requirements:
${otherUserReqs}`;
        }

        let fullUserPromptForFinalAIGeneration = `${finalUserQueryForGenerator}\n\n---CONTEXT BEGINS---\n`;
        if (paperContext) {
            fullUserPromptForFinalAIGeneration += `Context from Research Papers (cite as [Number], use provided URLs for references):\n${paperContext}\n\n`;
        } else {
             fullUserPromptForFinalAIGeneration += `Context from Research Papers: None provided or selected. Base your response on the topic, user requirements, and any uploaded documents or Google Search results.\n\n`;
        }
        
        const uploadedTextContextParts: string[] = [];
        uploadedFiles.forEach(f => {
            if (f.status === 'ready' && f.extractedText) {
                uploadedTextContextParts.push(`--- Content from uploaded file: ${f.file.name} (cite by filename) ---\n${f.extractedText}\n--- End of content from ${f.file.name} ---\n\n`);
            }
        });
        const uploadedTextContext = uploadedTextContextParts.join('');
        if (uploadedTextContext) {
            fullUserPromptForFinalAIGeneration += uploadedTextContext;
        }
        fullUserPromptForFinalAIGeneration += `---CONTEXT ENDS---\n\nBegin the ${actionVerb} now:`;
        
        const isAnyContextAvailable = paperContext || 
                                      uploadedTextContext || 
                                      (generationProvider === ApiProvider.GEMINI && uploadedFiles.some(f => f.status === 'ready' && f.base64Data)) ||
                                      (generationProvider === ApiProvider.GEMINI && useGoogleSearchForGeneration);

        if (!isAnyContextAvailable && (sectionType === 'introduction' || sectionType === 'relatedWorks') && !researchTopic) {
            alert("No papers selected/found on page, no processable files uploaded, and Google Search (if applicable) is not enabled or not the provider. Please provide some context or ensure a research topic is set for section generation.");
            setGenerationLoading(false);
            return;
        }
        
        let resultText = '';
        let groundingData: GroundingChunk[] | undefined = undefined;

        if (generationProvider === ApiProvider.GEMINI) {
            const geminiPartsForFinalCall: Part[] = [{ text: fullUserPromptForFinalAIGeneration }];
            uploadedFiles.forEach(f => {
                if (f.status === 'ready' && f.base64Data && f.mimeType?.startsWith('image/')) {
                    geminiPartsForFinalCall.push({
                        inlineData: { mimeType: f.mimeType, data: f.base64Data.split(',')[1] }
                    });
                }
            });
            const geminiResult = await generateTextWithGemini(
                apiKey, 
                geminiPartsForFinalCall, 
                modelToUse, 
                finalSystemInstructionForGenerator, 
                useGoogleSearchForGeneration
            );
            resultText = geminiResult.text;
            groundingData = geminiResult.groundingChunks;
        } else { 
            const openRouterMessages: OpenRouterMessage[] = [];
            if (finalSystemInstructionForGenerator) {
                openRouterMessages.push({ role: 'system', content: finalSystemInstructionForGenerator });
            }
            openRouterMessages.push({ role: 'user', content: fullUserPromptForFinalAIGeneration });
            resultText = await generateTextWithOpenRouter(apiKey, openRouterMessages, modelToUse);
        }
        
        if (sectionType === 'introduction') { setIntroContent(resultText); setIntroGrounding(groundingData); }
        else if (sectionType === 'relatedWorks') { setRelatedWorksContent(resultText); setRelatedWorksGrounding(groundingData); }
        else if (sectionType === 'other') { setOtherContent(resultText); setOtherGrounding(groundingData); }

    } catch (err: any) {
        const newErrorMessage = err.message || `An error occurred while generating the ${sectionType} section.`;
        if (sectionType === 'introduction') { setIntroError(newErrorMessage); }
        else if (sectionType === 'relatedWorks') { setRelatedWorksError(newErrorMessage); }
        else if (sectionType === 'other') { setOtherError(newErrorMessage); }
    } finally {
        setGenerationLoading(false);
    }
  };

  const isApiKeySet = useCallback((provider: ApiProvider): boolean => {
    if (provider === ApiProvider.GEMINI) return !!apiKeys.gemini;
    if (provider === ApiProvider.OPENROUTER) return !!apiKeys.openRouter;
    return false;
  }, [apiKeys]);

  const handleSendMessage = async (messageText: string, provider: ApiProvider, model: string) => {
    const userMessageDisplay: ChatMessage = { id: Date.now().toString(), sender: 'user', text: messageText, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessageDisplay]);
    setChatLoading(true);
    setChatError(null);

    const apiKey = provider === ApiProvider.GEMINI ? apiKeys.gemini : apiKeys.openRouter;
    const modelToUse = model.trim();

    if (!apiKey || !modelToUse) { 
      const errorMsg = !apiKey ? `API key for ${provider} is not set.` : `Model for ${provider} is not entered or is empty.`;
      setChatError(errorMsg);
      setChatLoading(false);
      const errorAiMsg: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'ai', text: `Error: ${errorMsg}`, timestamp: new Date() };
      setChatMessages(prev => [...prev, errorAiMsg]);
      return;
    }
    
    let effectiveSystemInstruction = CHAT_BASE_SYSTEM_INSTRUCTION;
    let currentGeminiHistory = geminiChatHistory;
    let currentOpenRouterHistory = openRouterChatHistory;

    if (useChatWithContext && currentGeminiHistory.length === 0 && currentOpenRouterHistory.length === 0) {
        const researchContext = getActiveResearchContext(MAX_CHAT_CONTEXT_LENGTH_WORDS);
        if (researchContext) {
            const contextMessage = `\n\nHere is some research context (from selected papers, generated sections, and uploaded text documents). This context is provided below, enclosed in <research_context> tags. You MUST use this information when answering relevant questions, including any questions about the content of the uploaded documents and their Semantic Scholar URLs if available in the context:\n<research_context>\n${researchContext}\n</research_context>\nIf you are asked about specific uploaded images, they will be provided with the user's message.`;
            effectiveSystemInstruction += contextMessage;
            
            if (provider === ApiProvider.OPENROUTER && !currentOpenRouterHistory.find(m => m.role === 'system')) {
                 currentOpenRouterHistory = [{ role: 'system', content: effectiveSystemInstruction }];
            }
        }
    }


    try {
      let aiResponseText = '';
      if (provider === ApiProvider.GEMINI) {
        const userMessageParts: Part[] = [{ text: messageText }];
        uploadedFiles.forEach(f => {
            if (f.status === 'ready' && f.base64Data && f.mimeType?.startsWith('image/')) {
                userMessageParts.push({
                    inlineData: { mimeType: f.mimeType, data: f.base64Data.split(',')[1] }
                });
            }
        });

        const { text: geminiText, updatedHistory: newGeminiHistory } = await startOrContinueChatWithGemini(
            apiKey, 
            userMessageParts, 
            currentGeminiHistory, 
            modelToUse, 
            (currentGeminiHistory.length === 0 && effectiveSystemInstruction !== CHAT_BASE_SYSTEM_INSTRUCTION) ? effectiveSystemInstruction : undefined
        );
        aiResponseText = geminiText;
        setGeminiChatHistory(newGeminiHistory);

      } else { 
        let orSystemInstructionForThisTurn: string | undefined = undefined;
        if (useChatWithContext && 
            (!currentOpenRouterHistory.length || currentOpenRouterHistory[0].role !== 'system') &&
            effectiveSystemInstruction !== CHAT_BASE_SYSTEM_INSTRUCTION) {
            orSystemInstructionForThisTurn = effectiveSystemInstruction;
        }
        
        const { text: orText, updatedHistory: newOrHistory } = await chatWithOpenRouter(
            apiKey, 
            messageText, 
            currentOpenRouterHistory, 
            modelToUse, 
            orSystemInstructionForThisTurn
        );
        aiResponseText = orText;
        setOpenRouterChatHistory(newOrHistory);
      }
      const aiMessage: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'ai', text: aiResponseText, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      setChatError(err.message || `Failed to get response from ${provider}.`);
      const aiErrorMessage: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'ai', text: `Error: ${err.message}`, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiErrorMessage]);
    } finally {
      setChatLoading(false);
    }
  };
  

  const handleFindCitations = async () => {
    if (!inputTextForCitations.trim()) {
      setCitationsError("Please enter some text to find citations for.");
      return;
    }
    const aiApiKey = generationProvider === ApiProvider.GEMINI ? apiKeys.gemini : apiKeys.openRouter;
    const modelToUse = generationProvider === ApiProvider.GEMINI ? selectedGeminiModel.trim() : selectedOpenRouterModel.trim();

    if (!apiKeys.semanticScholar) {
      setCitationsError("Semantic Scholar API key is not set. It's needed to search for papers.");
      return;
    }
    if (!aiApiKey) {
      setCitationsError(`API key for ${generationProvider} is not set. It's needed for AI analysis.`);
      return;
    }
    if (!modelToUse) {
      setCitationsError(`Model for ${generationProvider} is not entered or is empty.`);
      return;
    }

    setCitationsLoading(true);
    setCitationsError(null);
    setCitationsOutput('');

    try {
      const queryExtractionPrompt = `Given the following text, extract 2-3 distinct and concise search queries that could be used to find relevant academic papers on Semantic Scholar. Return the queries as a JSON array of strings. For example, if the text is 'The sky is blue due to Rayleigh scattering of sunlight by atmospheric particles.', suitable queries might be ["Rayleigh scattering", "atmospheric optics sunlight"]. Text: '${inputTextForCitations}'`;
      let searchQueries: string[] = [];

      if (generationProvider === ApiProvider.GEMINI) {
        const queryResponse = await generateTextWithGemini(aiApiKey, [{ text: queryExtractionPrompt }], modelToUse, "You are a helpful assistant that extracts search queries and returns ONLY a valid JSON array of strings.", false);
        try {
            let jsonStr = queryResponse.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }
            searchQueries = JSON.parse(jsonStr);
        } catch (e) {
          throw new Error("Failed to parse search queries from AI. AI Response: " + queryResponse.text);
        }
      } else { // OpenRouter
        const orMessages: OpenRouterMessage[] = [
            {role: "system", content: "You are a helpful assistant that extracts search queries. Return ONLY a valid JSON array of strings."},
            {role: "user", content: queryExtractionPrompt }
        ];
        const queryResponseText = await generateTextWithOpenRouter(aiApiKey, orMessages, modelToUse);
        try {
            let jsonStr = queryResponseText.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }
            searchQueries = JSON.parse(jsonStr);
        } catch (e) {
          throw new Error("Failed to parse search queries from AI. AI Response: " + queryResponseText);
        }
      }

      if (!Array.isArray(searchQueries) || searchQueries.length === 0 || !searchQueries.every(q => typeof q === 'string')) {
        throw new Error("AI did not return valid search queries as a JSON array of strings.");
      }
      
      let fetchedPapers: Paper[] = [];
      const fetchedPaperIds = new Set<string>();
      const papersPerQueryLimit = 5; 

      for (const query of searchQueries.slice(0,3)) { 
        try {
            const s2Response = await searchSemanticScholarPapers(query, apiKeys.semanticScholar, papersPerQueryLimit, 0);
            s2Response.papers.forEach(p => {
                if (p.paperId && !fetchedPaperIds.has(p.paperId)) {
                    fetchedPapers.push(p);
                    fetchedPaperIds.add(p.paperId);
                }
            });
        } catch (s2Error: any) {
            console.warn(`Failed to fetch papers for query "${query}": ${s2Error.message}`);
        }
        if (fetchedPapers.length >= 15) break; 
      }

      if (fetchedPapers.length === 0) {
        setCitationsOutput("No relevant papers found by Semantic Scholar for the given text. Try rephrasing or provide more specific text.");
        setCitationsLoading(false);
        return;
      }
      
      const paperDetailsForPrompt = fetchedPapers.map((p, index) => 
        `Paper ${index + 1}:\nTitle: ${p.title}\nAuthors: ${p.authors?.map(a => a.name).join(', ') || 'N/A'}\nYear: ${p.year || 'N/A'}\nVenue: ${p.venue || 'N/A'}\nURL: ${p.url || 'N/A'}\nAbstract: ${p.abstract || 'N/A'}\n`
      ).join('\n');

      const citationSystemInstruction = "You are an expert academic assistant. Your task is to analyze the user's text and a list of research paper details (including titles, authors, years, venues, URLs, and abstracts). Identify which papers are relevant to cite for specific sentences or claims in the user's text. Insert citation markers (e.g., [1], [2], using the 'Paper X' numbers from the provided list as a basis for re-numbering sequentially starting from [1]) into the user's text. Then, create a 'References' section at the end of the modified text. This section must list only the papers you actually cited. Format paper references as: [Number] Authors (Year). Title. *Venue*. URL: [Full Semantic Scholar URL as provided in the paper details]. The numbering in the 'References' section MUST correspond to the in-text citation markers you inserted.";
      const citationUserPrompt = `User's text to analyze and cite:\n"${inputTextForCitations}"\n\nPotential research papers for citation (use their abstracts and details to determine relevance. When you cite a paper in the text, use a sequential number starting from [1], e.g., [1], [2], etc. Ensure to use the provided URL for each paper in the reference list):\n${paperDetailsForPrompt}\n\nInstructions: Modify the user's text by inserting citation markers (e.g., [1], [2]). After the modified text, append a 'References' section. Only include papers you actually cited. Ensure the reference list numbers correspond to the in-text citation numbers you created, and format references as specified in the system prompt, including the URL for each paper.`;
      
      let finalOutput = "";
      if (generationProvider === ApiProvider.GEMINI) {
        const result = await generateTextWithGemini(aiApiKey, [{ text: citationUserPrompt }], modelToUse, citationSystemInstruction, false);
        finalOutput = result.text;
      } else { // OpenRouter
        const orMessages: OpenRouterMessage[] = [
            {role: "system", content: citationSystemInstruction },
            {role: "user", content: citationUserPrompt }
        ];
        finalOutput = await generateTextWithOpenRouter(aiApiKey, orMessages, modelToUse);
      }
      setCitationsOutput(finalOutput);

    } catch (err: any) {
      console.error("Error in handleFindCitations:", err);
      setCitationsError(err.message || "An unexpected error occurred while finding citations.");
    } finally {
      setCitationsLoading(false);
    }
  };


  useEffect(() => {
    resetGeminiChat();
  }, [chatProvider, selectedGeminiModel, apiKeys.gemini, useChatWithContext]); 

   useEffect(() => {
   }, [chatProvider, selectedOpenRouterModel, apiKeys.openRouter, useChatWithContext]); 

  useEffect(() => {
    if (researchTopic && apiKeys.semanticScholar && papers.length === 0 && totalPapers === 0 && !searchLoading && currentPage === 1) { 
        fetchPapersForPage(researchTopic, 1);
    }
  }, [researchTopic, apiKeys.semanticScholar, papers.length, totalPapers, searchLoading, currentPage, fetchPapersForPage]);


  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-2 sm:p-4 md:p-6">
      <header className="mb-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary-600 dark:text-primary-400">{APP_TITLE}</h1>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <ApiKeyManager
              apiKeys={apiKeys}
              onApiKeyChange={handleApiKeyChange}
            />
            <PaperSearchForm onSearch={handleSearch} loading={searchLoading} />
            <FileUploadManager uploadedFiles={uploadedFiles} setUploadedFiles={setUploadedFiles} />
            <PaperListDisplay
              papers={papers} 
              selectedPaperIds={new Set(selectedPaperIds)}
              onToggleSelectPaper={toggleSelectPaper}
              loading={searchLoading}
              error={searchError}
              currentPage={currentPage}
              totalPapers={totalPapers}
              papersPerPage={PAPERS_PER_PAGE}
              onPageChange={handlePageChange}
              researchTopicPresent={!!researchTopic}
              onSelectAllOnPage={handleSelectAllOnPage}
              onDeselectAll={handleDeselectAllPapers}
              onSelectAllAcrossPages={handleSelectAllAcrossPages}
              selectingAllPapersLoading={selectingAllPapersLoading}
              practicalSelectAllLimit={PRACTICAL_SELECT_ALL_LIMIT}
            />
          </div>

          <div className="lg:col-span-1 space-y-6">
            <SectionGeneratorControls
              onGenerateSection={handleGenerateSection}
              selectedProvider={generationProvider}
              onProviderChange={setGenerationProvider}
              loading={generationLoading}
              canGenerate={
                (papers.length > 0 || uploadedFiles.some(f => f.status === 'ready') || (generationProvider === ApiProvider.GEMINI && useGoogleSearchForGeneration) || !!researchTopic) && 
                isApiKeySet(generationProvider) &&
                !!(generationProvider === ApiProvider.GEMINI ? selectedGeminiModel : selectedOpenRouterModel)
              }
              selectedGeminiModel={selectedGeminiModel}
              onGeminiModelChange={setSelectedGeminiModel} 
              selectedOpenRouterModel={selectedOpenRouterModel}
              onOpenRouterModelChange={setSelectedOpenRouterModel} 
              isApiKeyAvailable={isApiKeySet}
              introRequirements={introRequirements}
              onIntroRequirementsChange={setIntroRequirements}
              relatedWorksRequirements={relatedWorksRequirements}
              onRelatedWorksRequirementsChange={setRelatedWorksRequirements}
              otherRequirements={otherRequirements}
              onOtherRequirementsChange={setOtherRequirements}
              useGoogleSearch={useGoogleSearchForGeneration}
              onToggleGoogleSearch={() => setUseGoogleSearchForGeneration(prev => !prev)}
            />
            <FindCitationsControls
              inputText={inputTextForCitations}
              onInputChange={setInputTextForCitations}
              onFindCitations={handleFindCitations}
              loading={citationsLoading}
              selectedProvider={generationProvider} 
              onProviderChange={setGenerationProvider} 
              selectedGeminiModel={selectedGeminiModel} 
              onGeminiModelChange={setSelectedGeminiModel} 
              selectedOpenRouterModel={selectedOpenRouterModel} 
              onOpenRouterModelChange={setSelectedOpenRouterModel} 
              isApiKeyAvailable={isApiKeySet} 
              isSemanticScholarKeySet={!!apiKeys.semanticScholar}
            />
          </div>

          <div className="lg:col-span-1">
            <ChatWindow
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              loading={chatLoading}
              chatError={chatError}
              activeProvider={chatProvider}
              onProviderChange={(newProvider) => {
                  setChatProvider(newProvider);
                  if (newProvider === ApiProvider.GEMINI) {
                      setOpenRouterChatHistory([]);
                  } else {
                      setGeminiChatHistory([]);
                      resetGeminiChat();
                  }
                  setChatMessages([]); 
              }}
              isApiKeySet={isApiKeySet}
              selectedGeminiModel={selectedGeminiModel} 
              onGeminiModelChange={handleSelectedGeminiModelChange}
              selectedOpenRouterModel={selectedOpenRouterModel}
              onOpenRouterModelChange={handleSelectedOpenRouterModelChange}
              useChatWithContext={useChatWithContext}
              onToggleChatContext={handleToggleChatContext}
            />
          </div>
        </div>
        
        <GeneratedSectionDisplay title="Introduction" content={introContent} loading={generationLoading && !introError && !introContent && !!researchTopic && (introRequirements === '' || introRequirements !== '')} error={introError} groundingSources={introGrounding} />
        <GeneratedSectionDisplay title="Related Works" content={relatedWorksContent} loading={generationLoading && !relatedWorksError && !relatedWorksContent && !!researchTopic && (relatedWorksRequirements === '' || relatedWorksRequirements !== '')} error={relatedWorksError} groundingSources={relatedWorksGrounding} />
        <GeneratedSectionDisplay title="Write Other Things" content={otherContent} loading={generationLoading && !otherError && !otherContent && (!!researchTopic || !!otherRequirements)} error={otherError} groundingSources={otherGrounding} />
        <CitationResultsDisplay title="Found Citations & References" content={citationsOutput} loading={citationsLoading} error={citationsError} />
      </main>

      <footer className="mt-8 pt-4 border-t border-gray-300 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>&copy; {new Date().getFullYear()} Research Paper Assistant. All rights reserved.</p>
        <p className="mt-1">Generated content is AI-assisted and may require review and editing.</p>
      </footer>
    </div>
  );
};

export default App;
