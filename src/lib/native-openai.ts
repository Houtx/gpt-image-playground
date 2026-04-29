import OpenAI from 'openai';

type NativeImageResponse = {
    images: Array<{
        filename: string;
        b64_json: string;
        output_format: string;
    }>;
    usage?: OpenAI.Images.ImagesResponse['usage'];
};

const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;
type ValidOutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

function validateOutputFormat(format: unknown): ValidOutputFormat {
    const normalized = String(format || 'png').toLowerCase();
    const mapped = normalized === 'jpg' ? 'jpeg' : normalized;

    if (VALID_OUTPUT_FORMATS.includes(mapped as ValidOutputFormat)) {
        return mapped as ValidOutputFormat;
    }

    return 'png';
}

function createOpenAIClient(apiKey: string, baseURL?: string | null) {
    const configuredBaseURL = baseURL?.trim() || process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL?.trim();

    return new OpenAI({
        apiKey,
        baseURL: configuredBaseURL || undefined,
        dangerouslyAllowBrowser: true
    });
}

function extractErrorDetails(error: unknown): Record<string, unknown> {
    if (!(error instanceof Error)) {
        return { value: String(error) };
    }

    const details: Record<string, unknown> = {
        name: error.name,
        message: error.message
    };

    for (const key of ['status', 'code', 'type', 'param', 'headers', 'cause']) {
        if (key in error) {
            const value = (error as unknown as Record<string, unknown>)[key];
            details[key] = value instanceof Error ? extractErrorDetails(value) : value;
        }
    }

    if (error.stack) {
        details.stack = error.stack;
    }

    return details;
}

function formatNativeError(error: unknown, baseURL?: string | null): string {
    const configuredBaseURL = baseURL?.trim() || process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL?.trim() || 'OpenAI 官方接口';
    const details = extractErrorDetails(error);

    let serializedDetails: string;
    try {
        serializedDetails = JSON.stringify(details, null, 2);
    } catch {
        serializedDetails = String(error);
    }

    return `接口请求失败\nBase URL: ${configuredBaseURL}\n\n原始错误:\n${serializedDetails}`;
}

export async function runNativeImageRequest(
    formData: FormData,
    apiKey: string,
    baseURL?: string | null
): Promise<NativeImageResponse> {
    if (!apiKey.trim()) {
        throw new Error('请先配置 OpenAI API Key。');
    }

    if (formData.get('stream') === 'true') {
        throw new Error('APK 本地模式暂不支持流式预览，请先关闭流式预览。');
    }

    const openai = createOpenAIClient(apiKey.trim(), baseURL);
    const mode = formData.get('mode') as 'generate' | 'edit' | null;
    const prompt = formData.get('prompt') as string | null;
    const model =
        (formData.get('model') as 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | 'gpt-image-2' | null) ||
        'gpt-image-2';

    if (!mode || !prompt) {
        throw new Error('Missing required parameters: mode and prompt');
    }

    let result: OpenAI.Images.ImagesResponse;
    let outputFormat = validateOutputFormat(formData.get('output_format'));

    try {
        if (mode === 'generate') {
            const rawOutputFormat = outputFormat;
            const outputCompression = parseInt((formData.get('output_compression') as string) || '', 10);
            const params: OpenAI.Images.ImageGenerateParams = {
                model,
                prompt,
                n: Math.max(1, Math.min(parseInt((formData.get('n') as string) || '1', 10) || 1, 10)),
                size: ((formData.get('size') as string) || '1024x1024') as OpenAI.Images.ImageGenerateParams['size'],
                quality: (formData.get('quality') as OpenAI.Images.ImageGenerateParams['quality']) || 'auto',
                output_format: rawOutputFormat,
                background: (formData.get('background') as OpenAI.Images.ImageGenerateParams['background']) || 'auto',
                moderation: (formData.get('moderation') as OpenAI.Images.ImageGenerateParams['moderation']) || 'auto'
            };

            if ((rawOutputFormat === 'jpeg' || rawOutputFormat === 'webp') && !Number.isNaN(outputCompression)) {
                params.output_compression = Math.max(0, Math.min(outputCompression, 100));
            }

            result = await openai.images.generate(params);
        } else if (mode === 'edit') {
            outputFormat = 'png';
            const imageFiles: File[] = [];
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('image_') && value instanceof File) {
                    imageFiles.push(value);
                }
            }

            if (imageFiles.length === 0) {
                throw new Error('No image file provided for editing.');
            }

            const size = ((formData.get('size') as string) || 'auto') as OpenAI.Images.ImageEditParams['size'];
            const quality = (formData.get('quality') as OpenAI.Images.ImageEditParams['quality']) || 'auto';
            const maskFile = formData.get('mask');

            result = await openai.images.edit({
                model,
                prompt,
                image: imageFiles,
                n: Math.max(1, Math.min(parseInt((formData.get('n') as string) || '1', 10) || 1, 10)),
                size: size === 'auto' ? undefined : size,
                quality: quality === 'auto' ? undefined : quality,
                ...(maskFile instanceof File ? { mask: maskFile } : {})
            });
        } else {
            throw new Error('Invalid mode specified');
        }
    } catch (error) {
        console.error('Native OpenAI request failed:', error);
        throw new Error(formatNativeError(error, baseURL));
    }

    if (!result.data?.length) {
        throw new Error('Failed to retrieve image data from API.');
    }

    const timestamp = Date.now();
    return {
        images: result.data.map((imageData, index) => {
            if (!imageData.b64_json) {
                throw new Error(`Image data at index ${index} is missing base64 data.`);
            }

            return {
                filename: `${timestamp}-${index}.${outputFormat}`,
                b64_json: imageData.b64_json,
                output_format: outputFormat
            };
        }),
        usage: result.usage
    };
}
