'use client';

import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { GenerationForm, type GenerationFormData } from '@/components/generation-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { NativeSettingsDialog } from '@/components/native-settings-dialog';
import { PasswordDialog } from '@/components/password-dialog';
import { RequestInspector, type RequestLogEntry } from '@/components/request-inspector';
import { ThemeToggle } from '@/components/theme-toggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { calculateApiCost, type CostDetails, type GptImageModel } from '@/lib/cost-utils';
import { getPresetDimensions } from '@/lib/size-utils';
import { db, type ImageRecord } from '@/lib/db';
import { runNativeImageRequest } from '@/lib/native-openai';
import { useLiveQuery } from 'dexie-react-hooks';
import { KeyRound } from 'lucide-react';
import * as React from 'react';

type HistoryImage = {
    filename: string;
};

export type HistoryMetadata = {
    timestamp: number;
    images: HistoryImage[];
    storageModeUsed?: 'fs' | 'indexeddb';
    durationMs: number;
    quality: GenerationFormData['quality'];
    background: GenerationFormData['background'];
    moderation: GenerationFormData['moderation'];
    prompt: string;
    mode: 'generate' | 'edit';
    costDetails: CostDetails | null;
    output_format?: GenerationFormData['output_format'];
    model?: GptImageModel;
};

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

const MAX_EDIT_IMAGES = 10;

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
const isCapacitorRuntime = process.env.NEXT_PUBLIC_APP_RUNTIME === 'capacitor';

const vercelEnvClient = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isOnVercelClient = vercelEnvClient === 'production' || vercelEnvClient === 'preview';

let effectiveStorageModeClient: 'fs' | 'indexeddb';

if (isCapacitorRuntime) {
    effectiveStorageModeClient = 'indexeddb';
} else if (explicitModeClient === 'fs') {
    effectiveStorageModeClient = 'fs';
} else if (explicitModeClient === 'indexeddb') {
    effectiveStorageModeClient = 'indexeddb';
} else if (isOnVercelClient) {
    effectiveStorageModeClient = 'indexeddb';
} else {
    effectiveStorageModeClient = 'fs';
}
console.log(
    `客户端存储模式： ${effectiveStorageModeClient} (显式配置： ${explicitModeClient || '未设置'}, Vercel 环境： ${vercelEnvClient || 'N/A'})`
);

type ApiImageResponseItem = {
    filename: string;
    b64_json?: string;
    output_format: string;
    path?: string;
};

const stringifyDebugDetails = (value: unknown) => {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

export default function HomePage() {
    const [mode, setMode] = React.useState<'generate' | 'edit'>('generate');
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(null);
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSendingToEdit, setIsSendingToEdit] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [latestImageBatch, setLatestImageBatch] = React.useState<{ path: string; filename: string }[] | null>(null);
    const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const blobUrlCacheRef = React.useRef<Map<string, string>>(new Map());
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
    const [lastApiCallArgs, setLastApiCallArgs] = React.useState<[GenerationFormData | EditingFormData] | null>(null);
    const [nativeApiKey, setNativeApiKey] = React.useState<string | null>(null);
    const [nativeBaseUrl, setNativeBaseUrl] = React.useState<string | null>(null);
    const [isNativeSettingsDialogOpen, setIsNativeSettingsDialogOpen] = React.useState(false);
    const [skipDeleteConfirmation, setSkipDeleteConfirmation] = React.useState<boolean>(false);
    const [itemToDeleteConfirm, setItemToDeleteConfirm] = React.useState<HistoryMetadata | null>(null);
    const [dialogCheckboxStateSkipConfirm, setDialogCheckboxStateSkipConfirm] = React.useState<boolean>(false);
    const [requestLogs, setRequestLogs] = React.useState<RequestLogEntry[]>([]);

    const allDbImages = useLiveQuery<ImageRecord[] | undefined>(() => db.images.toArray(), []);

    const [editImageFiles, setEditImageFiles] = React.useState<File[]>([]);
    const [editSourceImagePreviewUrls, setEditSourceImagePreviewUrls] = React.useState<string[]>([]);
    const [editPrompt, setEditPrompt] = React.useState('');
    const [editN, setEditN] = React.useState([1]);
    const [editSize, setEditSize] = React.useState<EditingFormData['size']>('auto');
    const [editCustomWidth, setEditCustomWidth] = React.useState<number>(1024);
    const [editCustomHeight, setEditCustomHeight] = React.useState<number>(1024);
    const [editQuality, setEditQuality] = React.useState<EditingFormData['quality']>('auto');
    const [editBrushSize, setEditBrushSize] = React.useState([20]);
    const [editShowMaskEditor, setEditShowMaskEditor] = React.useState(false);
    const [editGeneratedMaskFile, setEditGeneratedMaskFile] = React.useState<File | null>(null);
    const [editIsMaskSaved, setEditIsMaskSaved] = React.useState(false);
    const [editOriginalImageSize, setEditOriginalImageSize] = React.useState<{ width: number; height: number } | null>(
        null
    );
    const [editDrawnPoints, setEditDrawnPoints] = React.useState<DrawnPoint[]>([]);
    const [editMaskPreviewUrl, setEditMaskPreviewUrl] = React.useState<string | null>(null);

    const [genModel, setGenModel] = React.useState<GenerationFormData['model']>('gpt-image-2');
    const [genPrompt, setGenPrompt] = React.useState('');
    const [genN, setGenN] = React.useState([1]);
    const [genSize, setGenSize] = React.useState<GenerationFormData['size']>('auto');
    const [genCustomWidth, setGenCustomWidth] = React.useState<number>(1024);
    const [genCustomHeight, setGenCustomHeight] = React.useState<number>(1024);
    const [genQuality, setGenQuality] = React.useState<GenerationFormData['quality']>('auto');
    const [genOutputFormat, setGenOutputFormat] = React.useState<GenerationFormData['output_format']>('png');
    const [genCompression, setGenCompression] = React.useState([100]);
    const [genBackground, setGenBackground] = React.useState<GenerationFormData['background']>('auto');
    const [genModeration, setGenModeration] = React.useState<GenerationFormData['moderation']>('auto');

    const [editModel, setEditModel] = React.useState<EditingFormData['model']>('gpt-image-2');

    // Streaming state (shared between generate and edit modes)
    const [enableStreaming, setEnableStreaming] = React.useState(false);
    const [partialImages, setPartialImages] = React.useState<1 | 2 | 3>(2);
    // Streaming preview images (base64 data URLs for partial images during streaming)
    const [streamingPreviewImages, setStreamingPreviewImages] = React.useState<Map<number, string>>(new Map());

    const getImageSrc = React.useCallback(
        (filename: string): string | undefined => {
            const cached = blobUrlCacheRef.current.get(filename);
            if (cached) return cached;

            const record = allDbImages?.find((img) => img.filename === filename);
            if (record?.blob) {
                const url = URL.createObjectURL(record.blob);
                blobUrlCacheRef.current.set(filename, url);
                return url;
            }

            return undefined;
        },
        [allDbImages]
    );

    const addRequestEvent = React.useCallback((requestId: string, label: string, details?: unknown) => {
        setRequestLogs((current) =>
            current.map((entry) =>
                entry.id === requestId
                    ? {
                          ...entry,
                          updatedAt: Date.now(),
                          events: [
                              ...entry.events,
                              {
                                  at: Date.now(),
                                  label,
                                  details: details === undefined ? undefined : stringifyDebugDetails(details)
                              }
                          ]
                      }
                    : entry
            )
        );
    }, []);

    const updateRequestLog = React.useCallback((requestId: string, patch: Partial<RequestLogEntry>) => {
        setRequestLogs((current) =>
            current.map((entry) =>
                entry.id === requestId
                    ? {
                          ...entry,
                          ...patch,
                          updatedAt: Date.now()
                      }
                    : entry
            )
        );
    }, []);

    React.useEffect(() => {
        const cache = blobUrlCacheRef.current;
        return () => {
            cache.forEach((url) => URL.revokeObjectURL(url));
            cache.clear();
        };
    }, []);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        try {
            const storedHistory = localStorage.getItem('openaiImageHistory');
            if (storedHistory) {
                const parsedHistory: HistoryMetadata[] = JSON.parse(storedHistory);
                if (Array.isArray(parsedHistory)) {
                    setHistory(parsedHistory);
                } else {
                    console.warn('Invalid history data found in localStorage.');
                    localStorage.removeItem('openaiImageHistory');
                }
            }
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem('openaiImageHistory');
        }
        setIsInitialLoad(false);
    }, []);

    React.useEffect(() => {
        if (isCapacitorRuntime) {
            setIsPasswordRequiredByBackend(false);
            const storedApiKey = localStorage.getItem('nativeOpenAIApiKey');
            const storedBaseUrl = localStorage.getItem('nativeOpenAIBaseUrl');
            if (storedApiKey) {
                setNativeApiKey(storedApiKey);
            } else {
                setIsNativeSettingsDialogOpen(true);
            }
            if (storedBaseUrl) {
                setNativeBaseUrl(storedBaseUrl);
            }
            return;
        }

        const fetchAuthStatus = async () => {
            try {
                const response = await fetch('/api/auth-status');
                if (!response.ok) {
                    throw new Error('Failed to fetch auth status');
                }
                const data = await response.json();
                setIsPasswordRequiredByBackend(data.passwordRequired);
            } catch (error) {
                console.error('Error fetching auth status:', error);
                setIsPasswordRequiredByBackend(false);
            }
        };

        fetchAuthStatus();
        const storedHash = localStorage.getItem('clientPasswordHash');
        if (storedHash) {
            setClientPasswordHash(storedHash);
        }
    }, []);

    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem('openaiImageHistory', JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [history, isInitialLoad]);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        const storedPref = localStorage.getItem('imageGenSkipDeleteConfirm');
        if (storedPref === 'true') {
            setSkipDeleteConfirmation(true);
        } else if (storedPref === 'false') {
            setSkipDeleteConfirmation(false);
        }
    }, []);

    React.useEffect(() => {
        localStorage.setItem('imageGenSkipDeleteConfirm', String(skipDeleteConfirmation));
    }, [skipDeleteConfirmation]);

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (mode !== 'edit' || !event.clipboardData) {
                return;
            }

            if (editImageFiles.length >= MAX_EDIT_IMAGES) {
                alert(`最多只能添加 ${MAX_EDIT_IMAGES} 张图片。`);
                return;
            }

            const items = event.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();

                        const previewUrl = URL.createObjectURL(file);

                        setEditImageFiles((prevFiles) => [...prevFiles, file]);
                        setEditSourceImagePreviewUrls((prevUrls) => [...prevUrls, previewUrl]);

                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);

        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [mode, editImageFiles.length]);

    async function sha256Client(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    const handleSavePassword = async (password: string) => {
        if (!password.trim()) {
            setError('操作失败，请重试。');
            return;
        }
        try {
            const hash = await sha256Client(password);
            localStorage.setItem('clientPasswordHash', hash);
            setClientPasswordHash(hash);
            setError(null);
            setIsPasswordDialogOpen(false);
            if (passwordDialogContext === 'retry' && lastApiCallArgs) {
                await handleApiCall(...lastApiCallArgs);
            }
        } catch (e) {
            console.error('Error hashing password:', e);
            setError('操作失败，请重试。');
        }
    };

    const handleOpenPasswordDialog = () => {
        setPasswordDialogContext('initial');
        setIsPasswordDialogOpen(true);
    };

    const handleSaveNativeSettings = (settings: { apiKey: string; baseUrl: string }) => {
        const trimmedApiKey = settings.apiKey.trim();
        const trimmedBaseUrl = settings.baseUrl.trim().replace(/\/+$/, '');
        if (!trimmedApiKey) {
            setError('请先输入 OpenAI API Key。');
            return;
        }

        localStorage.setItem('nativeOpenAIApiKey', trimmedApiKey);
        if (trimmedBaseUrl) {
            localStorage.setItem('nativeOpenAIBaseUrl', trimmedBaseUrl);
        } else {
            localStorage.removeItem('nativeOpenAIBaseUrl');
        }
        setNativeApiKey(trimmedApiKey);
        setNativeBaseUrl(trimmedBaseUrl || null);
        setError(null);
        setIsNativeSettingsDialogOpen(false);
    };

    const getMimeTypeFromFormat = (format: string): string => {
        if (format === 'jpeg') return 'image/jpeg';
        if (format === 'webp') return 'image/webp';

        return 'image/png';
    };

    const processImageResult = async (
        result: { images?: ApiImageResponseItem[]; usage?: Parameters<typeof calculateApiCost>[0] },
        durationMs: number
    ) => {
        if (!result.images || result.images.length === 0) {
            setLatestImageBatch(null);
            throw new Error('API response did not contain valid image data or filenames.');
        }

        let historyQuality: GenerationFormData['quality'] = 'auto';
        let historyBackground: GenerationFormData['background'] = 'auto';
        let historyModeration: GenerationFormData['moderation'] = 'auto';
        let historyOutputFormat: GenerationFormData['output_format'] = 'png';
        let historyPrompt = '';

        if (mode === 'generate') {
            historyQuality = genQuality;
            historyBackground = genBackground;
            historyModeration = genModeration;
            historyOutputFormat = genOutputFormat;
            historyPrompt = genPrompt;
        } else {
            historyQuality = editQuality;
            historyPrompt = editPrompt;
        }

        const currentModel = mode === 'generate' ? genModel : editModel;
        const costDetails = calculateApiCost(result.usage, currentModel);
        const newHistoryEntry: HistoryMetadata = {
            timestamp: Date.now(),
            images: result.images.map((img) => ({ filename: img.filename })),
            storageModeUsed: effectiveStorageModeClient,
            durationMs,
            quality: historyQuality,
            background: historyBackground,
            moderation: historyModeration,
            output_format: historyOutputFormat,
            prompt: historyPrompt,
            mode,
            costDetails,
            model: currentModel
        };

        let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] = [];
        if (effectiveStorageModeClient === 'indexeddb') {
            newImageBatchPromises = result.images.map(async (img) => {
                if (!img.b64_json) {
                    console.warn(`Image ${img.filename} missing b64_json in indexeddb mode.`);
                    return null;
                }

                try {
                    const byteCharacters = atob(img.b64_json);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: getMimeTypeFromFormat(img.output_format) });

                    await db.images.put({ filename: img.filename, blob });

                    const blobUrl = URL.createObjectURL(blob);
                    blobUrlCacheRef.current.set(img.filename, blobUrl);

                    return { filename: img.filename, path: blobUrl };
                } catch (dbError) {
                    console.error(`Error saving blob ${img.filename} to IndexedDB:`, dbError);
                    setError(`Failed to save image ${img.filename} to local database.`);
                    return null;
                }
            });
        } else {
            newImageBatchPromises = result.images
                .filter((img) => !!img.path)
                .map((img) => Promise.resolve({ path: img.path!, filename: img.filename }));
        }

        const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as {
            path: string;
            filename: string;
        }[];

        setLatestImageBatch(processedImages);
        setImageOutputView(processedImages.length > 1 ? 'grid' : 0);
        setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
    };

    const handleApiCall = async (formData: GenerationFormData | EditingFormData) => {
        const startTime = Date.now();
        let durationMs = 0;

        setIsLoading(true);
        setError(null);
        setLatestImageBatch(null);
        setImageOutputView('grid');
        setStreamingPreviewImages(new Map());

        const apiFormData = new FormData();
        if (isPasswordRequiredByBackend && clientPasswordHash) {
            apiFormData.append('passwordHash', clientPasswordHash);
        } else if (isPasswordRequiredByBackend && !clientPasswordHash) {
            setError('操作失败，请重试。');
            setPasswordDialogContext('initial');
            setIsPasswordDialogOpen(true);
            setIsLoading(false);
            return;
        }
        apiFormData.append('mode', mode);

        // Add streaming parameters if enabled
        if (enableStreaming) {
            apiFormData.append('stream', 'true');
            apiFormData.append('partial_images', partialImages.toString());
        }

        if (mode === 'generate') {
            const genData = formData as GenerationFormData;
            apiFormData.append('model', genModel);
            apiFormData.append('prompt', genPrompt);
            apiFormData.append('n', genN[0].toString());
            const genSizeToSend =
                genSize === 'custom'
                    ? `${genCustomWidth}x${genCustomHeight}`
                    : (getPresetDimensions(genSize, genModel) ?? genSize);
            apiFormData.append('size', genSizeToSend);
            apiFormData.append('quality', genQuality);
            apiFormData.append('output_format', genOutputFormat);
            if (
                (genOutputFormat === 'jpeg' || genOutputFormat === 'webp') &&
                genData.output_compression !== undefined
            ) {
                apiFormData.append('output_compression', genData.output_compression.toString());
            }
            apiFormData.append('background', genBackground);
            apiFormData.append('moderation', genModeration);
        } else {
            apiFormData.append('model', editModel);
            apiFormData.append('prompt', editPrompt);
            apiFormData.append('n', editN[0].toString());
            const editSizeToSend =
                editSize === 'custom'
                    ? `${editCustomWidth}x${editCustomHeight}`
                    : (getPresetDimensions(editSize, editModel) ?? editSize);
            apiFormData.append('size', editSizeToSend);
            apiFormData.append('quality', editQuality);

            editImageFiles.forEach((file, index) => {
                apiFormData.append(`image_${index}`, file, file.name);
            });
            if (editGeneratedMaskFile) {
                apiFormData.append('mask', editGeneratedMaskFile, editGeneratedMaskFile.name);
            }
        }

        const requestId = `${startTime}-${Math.random().toString(36).slice(2, 8)}`;
        const requestSummary =
            mode === 'generate'
                ? {
                      mode,
                      model: genModel,
                      promptPreview: `${genPrompt.slice(0, 160)}${genPrompt.length > 160 ? '...' : ''}`,
                      n: genN[0],
                      size: apiFormData.get('size'),
                      quality: genQuality,
                      outputFormat: genOutputFormat,
                      background: genBackground,
                      moderation: genModeration,
                      streaming: enableStreaming,
                      partialImages: enableStreaming ? partialImages : undefined
                  }
                : {
                      mode,
                      model: editModel,
                      promptPreview: `${editPrompt.slice(0, 160)}${editPrompt.length > 160 ? '...' : ''}`,
                      n: editN[0],
                      size: apiFormData.get('size'),
                      quality: editQuality,
                      imageCount: editImageFiles.length,
                      images: editImageFiles.map((file) => ({
                          name: file.name,
                          type: file.type,
                          size: file.size
                      })),
                      hasMask: Boolean(editGeneratedMaskFile),
                      streaming: enableStreaming,
                      partialImages: enableStreaming ? partialImages : undefined
                  };
        const requestLog: RequestLogEntry = {
            id: requestId,
            startedAt: startTime,
            updatedAt: startTime,
            status: 'pending',
            mode,
            runtime: isCapacitorRuntime ? 'apk' : 'web',
            method: 'POST',
            url: isCapacitorRuntime
                ? `${nativeBaseUrl?.trim() || process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL || 'https://api.openai.com/v1'}/images/${mode === 'generate' ? 'generations' : 'edits'}`
                : '/api/images',
            baseUrl: isCapacitorRuntime
                ? nativeBaseUrl?.trim() || process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL || 'https://api.openai.com/v1'
                : undefined,
            model: mode === 'generate' ? genModel : editModel,
            promptPreview: mode === 'generate' ? genPrompt.slice(0, 160) : editPrompt.slice(0, 160),
            request: requestSummary,
            events: [
                {
                    at: startTime,
                    label: '已创建请求',
                    details: stringifyDebugDetails(requestSummary)
                }
            ]
        };
        setRequestLogs((current) => [requestLog, ...current].slice(0, 30));

        try {
            if (isCapacitorRuntime) {
                if (!nativeApiKey) {
                    addRequestEvent(requestId, '缺少 APK API Key');
                    setIsNativeSettingsDialogOpen(true);
                    throw new Error('请先配置 OpenAI API Key。');
                }

                addRequestEvent(requestId, '准备发起 APK 本地请求', {
                    baseUrl: nativeBaseUrl?.trim() || process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL || 'official',
                    storageMode: effectiveStorageModeClient
                });
                const result = await runNativeImageRequest(apiFormData, nativeApiKey, nativeBaseUrl, (event) => {
                    addRequestEvent(requestId, event.label, event.details);
                });
                durationMs = Date.now() - startTime;
                updateRequestLog(requestId, {
                    status: 'success',
                    completedAt: Date.now(),
                    responseSummary: stringifyDebugDetails({
                        imageCount: result.images?.length ?? 0,
                        filenames: result.images?.map((image) => image.filename),
                        usage: result.usage
                    })
                });
                addRequestEvent(requestId, '开始处理图片结果');
                await processImageResult(result, durationMs);
                addRequestEvent(requestId, '图片结果已保存到本地状态');
                return;
            }

            addRequestEvent(requestId, '发起 fetch 请求', { url: '/api/images' });
            const response = await fetch('/api/images', {
                method: 'POST',
                body: apiFormData
            });
            updateRequestLog(requestId, {
                responseStatus: response.status,
                responseContentType: response.headers.get('content-type')
            });
            addRequestEvent(requestId, '已收到响应头', {
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('content-type')
            });

            // Check if response is SSE (streaming)
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('text/event-stream')) {
                if (!response.body) {
                    throw new Error('Response body is null');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                addRequestEvent(requestId, '开始读取 SSE 流');

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        addRequestEvent(requestId, 'SSE 流读取结束');
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });

                    // Process complete SSE events
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // Keep incomplete event in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.slice(6);
                            try {
                                const event = JSON.parse(jsonStr);

                                if (event.type === 'partial_image') {
                                    addRequestEvent(requestId, '收到局部预览', {
                                        index: event.index,
                                        partialImageIndex: event.partial_image_index,
                                        b64Length: event.b64_json?.length
                                    });
                                    // Update streaming preview with partial image
                                    const imageIndex = event.index ?? 0;
                                    const dataUrl = `data:image/png;base64,${event.b64_json}`;
                                    setStreamingPreviewImages((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(imageIndex, dataUrl);
                                        return newMap;
                                    });
                                } else if (event.type === 'error') {
                                    addRequestEvent(requestId, 'SSE 返回错误', event);
                                    throw new Error(event.error || 'Streaming error occurred');
                                } else if (event.type === 'done') {
                                    addRequestEvent(requestId, 'SSE 返回完成事件', {
                                        imageCount: event.images?.length ?? 0,
                                        filenames: event.images?.map((image: { filename: string }) => image.filename),
                                        usage: event.usage
                                    });
                                    // Finalize with all completed images
                                    durationMs = Date.now() - startTime;

                                    if (event.images && event.images.length > 0) {
                                        let historyQuality: GenerationFormData['quality'] = 'auto';
                                        let historyBackground: GenerationFormData['background'] = 'auto';
                                        let historyModeration: GenerationFormData['moderation'] = 'auto';
                                        let historyOutputFormat: GenerationFormData['output_format'] = 'png';
                                        let historyPrompt: string = '';

                                        if (mode === 'generate') {
                                            historyQuality = genQuality;
                                            historyBackground = genBackground;
                                            historyModeration = genModeration;
                                            historyOutputFormat = genOutputFormat;
                                            historyPrompt = genPrompt;
                                        } else {
                                            historyQuality = editQuality;
                                            historyBackground = 'auto';
                                            historyModeration = 'auto';
                                            historyOutputFormat = 'png';
                                            historyPrompt = editPrompt;
                                        }

                                        const currentModel = mode === 'generate' ? genModel : editModel;
                                        const costDetails = calculateApiCost(event.usage, currentModel);

                                        const batchTimestamp = Date.now();
                                        const newHistoryEntry: HistoryMetadata = {
                                            timestamp: batchTimestamp,
                                            images: event.images.map((img: { filename: string }) => ({
                                                filename: img.filename
                                            })),
                                            storageModeUsed: effectiveStorageModeClient,
                                            durationMs: durationMs,
                                            quality: historyQuality,
                                            background: historyBackground,
                                            moderation: historyModeration,
                                            output_format: historyOutputFormat,
                                            prompt: historyPrompt,
                                            mode: mode,
                                            costDetails: costDetails,
                                            model: currentModel
                                        };

                                        let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] =
                                            [];
                                        if (effectiveStorageModeClient === 'indexeddb') {
                                            newImageBatchPromises = event.images.map(async (img: ApiImageResponseItem) => {
                                                if (img.b64_json) {
                                                    try {
                                                        const byteCharacters = atob(img.b64_json);
                                                        const byteNumbers = new Array(byteCharacters.length);
                                                        for (let i = 0; i < byteCharacters.length; i++) {
                                                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                                                        }
                                                        const byteArray = new Uint8Array(byteNumbers);

                                                        const actualMimeType = getMimeTypeFromFormat(img.output_format);
                                                        const blob = new Blob([byteArray], { type: actualMimeType });

                                                        await db.images.put({ filename: img.filename, blob });

                                                        const blobUrl = URL.createObjectURL(blob);
                                                        blobUrlCacheRef.current.set(img.filename, blobUrl);

                                                        return { filename: img.filename, path: blobUrl };
                                                    } catch (dbError) {
                                                        console.error(
                                                            `Error saving blob ${img.filename} to IndexedDB:`,
                                                            dbError
                                                        );
                                                        setError(
                                                            `Failed to save image ${img.filename} to local database.`
                                                        );
                                                        return null;
                                                    }
                                                } else {
                                                    console.warn(
                                                        `Image ${img.filename} missing b64_json in indexeddb mode.`
                                                    );
                                                    return null;
                                                }
                                            });
                                        } else {
                                            newImageBatchPromises = event.images
                                                .filter((img: ApiImageResponseItem) => !!img.path)
                                                .map((img: ApiImageResponseItem) =>
                                                    Promise.resolve({
                                                        path: img.path!,
                                                        filename: img.filename
                                                    })
                                                );
                                        }

                                        const processedImages = (await Promise.all(newImageBatchPromises)).filter(
                                            Boolean
                                        ) as {
                                            path: string;
                                            filename: string;
                                        }[];

                                        setLatestImageBatch(processedImages);
                                        setImageOutputView(processedImages.length > 1 ? 'grid' : 0);
                                        setStreamingPreviewImages(new Map()); // Clear streaming previews

                                        setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
                                        updateRequestLog(requestId, {
                                            status: 'success',
                                            completedAt: Date.now(),
                                            responseSummary: stringifyDebugDetails({
                                                imageCount: event.images.length,
                                                filenames: event.images.map((image: { filename: string }) => image.filename),
                                                usage: event.usage
                                            })
                                        });
                                        addRequestEvent(requestId, '图片结果已保存到本地状态');
                                    }
                                }
                            } catch (parseError) {
                                addRequestEvent(requestId, '解析 SSE 事件失败', parseError);
                                console.error('Error parsing SSE event:', parseError);
                            }
                        }
                    }
                }

                return; // Exit early for streaming
            }

            // Non-streaming response handling (original code)
            const result = await response.json();
            addRequestEvent(requestId, '已解析 JSON 响应', {
                ok: response.ok,
                imageCount: result.images?.length ?? 0,
                error: result.error,
                usage: result.usage
            });

            if (!response.ok) {
                if (response.status === 401 && isPasswordRequiredByBackend) {
                    setError('操作失败，请重试。');
                    setPasswordDialogContext('retry');
                    setLastApiCallArgs([formData]);
                    setIsPasswordDialogOpen(true);

                    return;
                }
                throw new Error(result.error || `API request failed with status ${response.status}`);
            }

            if (result.images && result.images.length > 0) {
                durationMs = Date.now() - startTime;

                let historyQuality: GenerationFormData['quality'] = 'auto';
                let historyBackground: GenerationFormData['background'] = 'auto';
                let historyModeration: GenerationFormData['moderation'] = 'auto';
                let historyOutputFormat: GenerationFormData['output_format'] = 'png';
                let historyPrompt: string = '';

                if (mode === 'generate') {
                    historyQuality = genQuality;
                    historyBackground = genBackground;
                    historyModeration = genModeration;
                    historyOutputFormat = genOutputFormat;
                    historyPrompt = genPrompt;
                } else {
                    historyQuality = editQuality;
                    historyBackground = 'auto';
                    historyModeration = 'auto';
                    historyOutputFormat = 'png';
                    historyPrompt = editPrompt;
                }

                const currentModel = mode === 'generate' ? genModel : editModel;
                const costDetails = calculateApiCost(result.usage, currentModel);

                const batchTimestamp = Date.now();
                const newHistoryEntry: HistoryMetadata = {
                    timestamp: batchTimestamp,
                    images: result.images.map((img: { filename: string }) => ({ filename: img.filename })),
                    storageModeUsed: effectiveStorageModeClient,
                    durationMs: durationMs,
                    quality: historyQuality,
                    background: historyBackground,
                    moderation: historyModeration,
                    output_format: historyOutputFormat,
                    prompt: historyPrompt,
                    mode: mode,
                    costDetails: costDetails,
                    model: currentModel
                };

                let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] = [];
                if (effectiveStorageModeClient === 'indexeddb') {
                    newImageBatchPromises = result.images.map(async (img: ApiImageResponseItem) => {
                        if (img.b64_json) {
                            try {
                                const byteCharacters = atob(img.b64_json);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);

                                const actualMimeType = getMimeTypeFromFormat(img.output_format);
                                const blob = new Blob([byteArray], { type: actualMimeType });

                                await db.images.put({ filename: img.filename, blob });

                                const blobUrl = URL.createObjectURL(blob);
                                blobUrlCacheRef.current.set(img.filename, blobUrl);

                                return { filename: img.filename, path: blobUrl };
                            } catch (dbError) {
                                console.error(`Error saving blob ${img.filename} to IndexedDB:`, dbError);
                                setError(`Failed to save image ${img.filename} to local database.`);
                                return null;
                            }
                        } else {
                            console.warn(`Image ${img.filename} missing b64_json in indexeddb mode.`);
                            return null;
                        }
                    });
                } else {
                    newImageBatchPromises = result.images
                        .filter((img: ApiImageResponseItem) => !!img.path)
                        .map((img: ApiImageResponseItem) =>
                            Promise.resolve({
                                path: img.path!,
                                filename: img.filename
                            })
                        );
                }

                const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as {
                    path: string;
                    filename: string;
                }[];

                setLatestImageBatch(processedImages);
                setImageOutputView(processedImages.length > 1 ? 'grid' : 0);

                setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
                updateRequestLog(requestId, {
                    status: 'success',
                    completedAt: Date.now(),
                    responseSummary: stringifyDebugDetails({
                        imageCount: result.images.length,
                        filenames: result.images.map((image: { filename: string }) => image.filename),
                        usage: result.usage
                    })
                });
                addRequestEvent(requestId, '图片结果已保存到本地状态');
            } else {
                setLatestImageBatch(null);
                throw new Error('API response did not contain valid image data or filenames.');
            }
        } catch (err: unknown) {
            durationMs = Date.now() - startTime;
            console.error(`API Call Error after ${durationMs}ms:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            updateRequestLog(requestId, {
                status: 'error',
                completedAt: Date.now(),
                error: errorMessage
            });
            addRequestEvent(requestId, '请求失败', errorMessage);
            setError(errorMessage);
            setLatestImageBatch(null);
            setStreamingPreviewImages(new Map());
        } finally {
            if (durationMs === 0) durationMs = Date.now() - startTime;
            setIsLoading(false);
        }
    };

    const handleHistorySelect = React.useCallback(
        (item: HistoryMetadata) => {
            const originalStorageMode = item.storageModeUsed || 'fs';

            const selectedBatchPromises = item.images.map(async (imgInfo) => {
                let path: string | undefined;
                if (originalStorageMode === 'indexeddb') {
                    path = getImageSrc(imgInfo.filename);
                } else {
                    path = `/api/image/${imgInfo.filename}`;
                }

                if (path) {
                    return { path, filename: imgInfo.filename };
                } else {
                    console.warn(
                        `Could not get image source for history item: ${imgInfo.filename} (mode: ${originalStorageMode})`
                    );
                    setError(`Image ${imgInfo.filename} could not be loaded.`);
                    return null;
                }
            });

            Promise.all(selectedBatchPromises).then((resolvedBatch) => {
                const validImages = resolvedBatch.filter(Boolean) as { path: string; filename: string }[];

                if (validImages.length !== item.images.length) {
                    setError('部分历史图片无法加载，可能已被删除或移动。');
                } else {
                    setError(null);
                }

                setLatestImageBatch(validImages.length > 0 ? validImages : null);
                setImageOutputView(validImages.length > 1 ? 'grid' : 0);
            });
        },
        [getImageSrc]
    );

    const handleClearHistory = React.useCallback(async () => {
        const confirmationMessage =
            effectiveStorageModeClient === 'indexeddb'
                ? '确定要清空全部图片历史记录吗？IndexedDB 模式下也会永久删除本地存储的图片。此操作无法撤销。'
                : '确定要清空全部图片历史记录吗？此操作无法撤销。';

        if (window.confirm(confirmationMessage)) {
            setHistory([]);
            setLatestImageBatch(null);
            setImageOutputView('grid');
            setError(null);

            try {
                localStorage.removeItem('openaiImageHistory');

                if (effectiveStorageModeClient === 'indexeddb') {
                    await db.images.clear();
                    blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
                    blobUrlCacheRef.current.clear();
                }
            } catch (e) {
                console.error('Failed during history clearing:', e);
                setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }, []);

    const handleSendToEdit = async (filename: string) => {
        if (isSendingToEdit) return;
        setIsSendingToEdit(true);
        setError(null);

        const alreadyExists = editImageFiles.some((file) => file.name === filename);
        if (mode === 'edit' && alreadyExists) {
            setIsSendingToEdit(false);
            return;
        }

        if (mode === 'edit' && editImageFiles.length >= MAX_EDIT_IMAGES) {
            setError(`最多只能添加 ${MAX_EDIT_IMAGES} 张图片。`);
            setIsSendingToEdit(false);
            return;
        }

        try {
            let blob: Blob | undefined;
            let mimeType: string = 'image/png';

            if (effectiveStorageModeClient === 'indexeddb') {
                const record = allDbImages?.find((img) => img.filename === filename);
                if (record?.blob) {
                    blob = record.blob;
                    mimeType = blob.type || mimeType;
                } else {
                    throw new Error(`Image ${filename} not found in local database.`);
                }
            } else {
                const response = await fetch(`/api/image/${filename}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.statusText}`);
                }
                blob = await response.blob();
                mimeType = response.headers.get('Content-Type') || mimeType;
            }

            if (!blob) {
                throw new Error(`Could not retrieve image data for ${filename}.`);
            }

            const newFile = new File([blob], filename, { type: mimeType });
            const newPreviewUrl = URL.createObjectURL(blob);

            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));

            setEditImageFiles([newFile]);
            setEditSourceImagePreviewUrls([newPreviewUrl]);

            if (mode === 'generate') {
                setMode('edit');
            }
        } catch (err: unknown) {
            console.error('Error sending image to edit:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to send image to edit form.';
            setError(errorMessage);
        } finally {
            setIsSendingToEdit(false);
        }
    };

    const executeDeleteItem = React.useCallback(
        async (item: HistoryMetadata) => {
            if (!item) return;
            setError(null);

            const { images: imagesInEntry, storageModeUsed, timestamp } = item;
            const filenamesToDelete = imagesInEntry.map((img) => img.filename);

            try {
                if (storageModeUsed === 'indexeddb') {
                    await db.images.where('filename').anyOf(filenamesToDelete).delete();
                    filenamesToDelete.forEach((fn) => {
                        const url = blobUrlCacheRef.current.get(fn);
                        if (url) URL.revokeObjectURL(url);
                        blobUrlCacheRef.current.delete(fn);
                    });
                } else if (storageModeUsed === 'fs') {
                    const apiPayload: { filenames: string[]; passwordHash?: string } = {
                        filenames: filenamesToDelete
                    };
                    if (isPasswordRequiredByBackend && clientPasswordHash) {
                        apiPayload.passwordHash = clientPasswordHash;
                    }

                    const response = await fetch('/api/image-delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(apiPayload)
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || `API deletion failed with status ${response.status}`);
                    }
                }

                setHistory((prevHistory) => prevHistory.filter((h) => h.timestamp !== timestamp));
                setLatestImageBatch((prev) =>
                    prev && prev.some((img) => filenamesToDelete.includes(img.filename)) ? null : prev
                );
            } catch (e: unknown) {
                console.error('Error during item deletion:', e);
                setError(e instanceof Error ? e.message : 'An unexpected error occurred during deletion.');
            } finally {
                setItemToDeleteConfirm(null);
            }
        },
        [isPasswordRequiredByBackend, clientPasswordHash]
    );

    const handleRequestDeleteItem = React.useCallback(
        (item: HistoryMetadata) => {
            if (!skipDeleteConfirmation) {
                setDialogCheckboxStateSkipConfirm(skipDeleteConfirmation);
                setItemToDeleteConfirm(item);
            } else {
                executeDeleteItem(item);
            }
        },
        [skipDeleteConfirmation, executeDeleteItem]
    );

    const handleConfirmDeletion = React.useCallback(() => {
        if (itemToDeleteConfirm) {
            executeDeleteItem(itemToDeleteConfirm);
            setSkipDeleteConfirmation(dialogCheckboxStateSkipConfirm);
        }
    }, [itemToDeleteConfirm, executeDeleteItem, dialogCheckboxStateSkipConfirm]);

    const handleCancelDeletion = React.useCallback(() => {
        setItemToDeleteConfirm(null);
    }, []);

    return (
        <main className='app-shell flex min-h-screen flex-col items-center overflow-x-hidden p-3 text-foreground sm:p-4 md:p-6 lg:p-8'>
            <PasswordDialog
                isOpen={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
                onSave={handleSavePassword}
                title={passwordDialogContext === 'retry' ? '需要密码' : '配置密码'}
                description={
                    passwordDialogContext === 'retry'
                        ? '请输入访问密码后继续。'
                        : '请输入后端配置的访问密码。'
                }
            />
            <NativeSettingsDialog
                isOpen={isNativeSettingsDialogOpen}
                onOpenChange={setIsNativeSettingsDialogOpen}
                onSave={handleSaveNativeSettings}
                initialApiKey={nativeApiKey}
                initialBaseUrl={nativeBaseUrl}
            />
            <div className='w-full max-w-screen-2xl space-y-4 md:space-y-5'>
                <div className='app-topbar flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='min-w-0'>
                        <p className='text-sm font-medium text-primary'>AI 图像工作台</p>
                        <h1 className='mt-1 text-xl font-semibold tracking-normal text-foreground sm:text-2xl md:text-3xl'>
                            GPT Image Playground
                        </h1>
                        <p className='mt-1 max-w-2xl text-sm text-muted-foreground'>
                            在一个工作区中生成、编辑、查看并复用 AI 图片。
                        </p>
                    </div>
                    <div className='flex shrink-0 items-center justify-start gap-2 sm:justify-end'>
                        {isCapacitorRuntime && (
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => setIsNativeSettingsDialogOpen(true)}
                                className='gap-2'>
                                <KeyRound className='size-4' />
                                接口设置
                            </Button>
                        )}
                        <ThemeToggle />
                    </div>
                </div>
                <div className='grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5'>
                    <div className='relative flex min-h-0 flex-col lg:col-span-1 lg:h-[72vh] lg:min-h-[620px] lg:max-h-none'>
                        <div className={mode === 'generate' ? 'block w-full lg:h-full' : 'hidden'}>
                            <GenerationForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                model={genModel}
                                setModel={setGenModel}
                                prompt={genPrompt}
                                setPrompt={setGenPrompt}
                                n={genN}
                                setN={setGenN}
                                size={genSize}
                                setSize={setGenSize}
                                customWidth={genCustomWidth}
                                setCustomWidth={setGenCustomWidth}
                                customHeight={genCustomHeight}
                                setCustomHeight={setGenCustomHeight}
                                quality={genQuality}
                                setQuality={setGenQuality}
                                outputFormat={genOutputFormat}
                                setOutputFormat={setGenOutputFormat}
                                compression={genCompression}
                                setCompression={setGenCompression}
                                background={genBackground}
                                setBackground={setGenBackground}
                                moderation={genModeration}
                                setModeration={setGenModeration}
                                enableStreaming={enableStreaming}
                                setEnableStreaming={setEnableStreaming}
                                partialImages={partialImages}
                                setPartialImages={setPartialImages}
                            />
                        </div>
                        <div className={mode === 'edit' ? 'block w-full lg:h-full' : 'hidden'}>
                            <EditingForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading || isSendingToEdit}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                editModel={editModel}
                                setEditModel={setEditModel}
                                imageFiles={editImageFiles}
                                sourceImagePreviewUrls={editSourceImagePreviewUrls}
                                setImageFiles={setEditImageFiles}
                                setSourceImagePreviewUrls={setEditSourceImagePreviewUrls}
                                maxImages={MAX_EDIT_IMAGES}
                                editPrompt={editPrompt}
                                setEditPrompt={setEditPrompt}
                                editN={editN}
                                setEditN={setEditN}
                                editSize={editSize}
                                setEditSize={setEditSize}
                                editCustomWidth={editCustomWidth}
                                setEditCustomWidth={setEditCustomWidth}
                                editCustomHeight={editCustomHeight}
                                setEditCustomHeight={setEditCustomHeight}
                                editQuality={editQuality}
                                setEditQuality={setEditQuality}
                                editBrushSize={editBrushSize}
                                setEditBrushSize={setEditBrushSize}
                                editShowMaskEditor={editShowMaskEditor}
                                setEditShowMaskEditor={setEditShowMaskEditor}
                                editGeneratedMaskFile={editGeneratedMaskFile}
                                setEditGeneratedMaskFile={setEditGeneratedMaskFile}
                                editIsMaskSaved={editIsMaskSaved}
                                setEditIsMaskSaved={setEditIsMaskSaved}
                                editOriginalImageSize={editOriginalImageSize}
                                setEditOriginalImageSize={setEditOriginalImageSize}
                                editDrawnPoints={editDrawnPoints}
                                setEditDrawnPoints={setEditDrawnPoints}
                                editMaskPreviewUrl={editMaskPreviewUrl}
                                setEditMaskPreviewUrl={setEditMaskPreviewUrl}
                                enableStreaming={enableStreaming}
                                setEnableStreaming={setEnableStreaming}
                                partialImages={partialImages}
                                setPartialImages={setPartialImages}
                            />
                        </div>
                    </div>
                    <div className='flex min-h-[360px] flex-col lg:col-span-1 lg:h-[72vh] lg:min-h-[620px] lg:max-h-none'>
                        {error && (
                            <Alert variant='destructive' className='mb-4 border-destructive/40 bg-destructive/10 text-destructive'>
                                <AlertTitle>閿欒</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <ImageOutput
                            imageBatch={latestImageBatch}
                            viewMode={imageOutputView}
                            onViewChange={setImageOutputView}
                            altText='生成图片输出'
                            isLoading={isLoading || isSendingToEdit}
                            onSendToEdit={handleSendToEdit}
                            currentMode={mode}
                            baseImagePreviewUrl={editSourceImagePreviewUrls[0] || null}
                            streamingPreviewImages={streamingPreviewImages}
                        />
                    </div>
                </div>

                <RequestInspector logs={requestLogs} onClear={() => setRequestLogs([])} />

                <div className='md:min-h-[450px]'>
                    <HistoryPanel
                        history={history}
                        onSelectImage={handleHistorySelect}
                        onClearHistory={handleClearHistory}
                        getImageSrc={getImageSrc}
                        onDeleteItemRequest={handleRequestDeleteItem}
                        itemPendingDeleteConfirmation={itemToDeleteConfirm}
                        onConfirmDeletion={handleConfirmDeletion}
                        onCancelDeletion={handleCancelDeletion}
                        deletePreferenceDialogValue={dialogCheckboxStateSkipConfirm}
                        onDeletePreferenceDialogChange={setDialogCheckboxStateSkipConfirm}
                    />
                </div>
            </div>
        </main>
    );
}
