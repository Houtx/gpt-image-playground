'use client';

import * as React from 'react';
import Image from 'next/image';
import { Download, Grid, Loader2, Maximize2, RotateCcw, Send, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ImageInfo = {
    path: string;
    filename: string;
};

type ImageOutputProps = {
    imageBatch: ImageInfo[] | null;
    viewMode: 'grid' | number;
    onViewChange: (view: 'grid' | number) => void;
    altText?: string;
    isLoading: boolean;
    onSendToEdit: (filename: string) => void;
    currentMode: 'generate' | 'edit';
    baseImagePreviewUrl: string | null;
    streamingPreviewImages?: Map<number, string>;
};

type TouchPoint = {
    x: number;
    y: number;
};

const getGridColsClass = (count: number): string => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getDistance = (a: TouchPoint, b: TouchPoint) => Math.hypot(a.x - b.x, a.y - b.y);

const getCenter = (a: TouchPoint, b: TouchPoint): TouchPoint => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
});

const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('Failed to read image data.'));
                return;
            }

            resolve(result.split(',')[1] ?? result);
        };
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read image data.'));
        reader.readAsDataURL(blob);
    });

const getSafeFilename = (filename: string) => filename.replace(/[^\w.-]/g, '_') || `image-${Date.now()}.png`;

function ZoomableImage({ image, altText }: { image: ImageInfo; altText: string }) {
    const [scale, setScale] = React.useState(1);
    const [position, setPosition] = React.useState<TouchPoint>({ x: 0, y: 0 });
    const pointersRef = React.useRef(new Map<number, TouchPoint>());
    const lastPanPointRef = React.useRef<TouchPoint | null>(null);
    const pinchRef = React.useRef<{
        startDistance: number;
        startScale: number;
        startCenter: TouchPoint;
        startPosition: TouchPoint;
    } | null>(null);

    const reset = React.useCallback(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    const startPinchIfReady = React.useCallback(() => {
        const points = Array.from(pointersRef.current.values());
        if (points.length < 2) return;

        const [first, second] = points;
        pinchRef.current = {
            startDistance: getDistance(first, second),
            startScale: scale,
            startCenter: getCenter(first, second),
            startPosition: position
        };
    }, [position, scale]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointersRef.current.size === 1) {
            lastPanPointRef.current = { x: event.clientX, y: event.clientY };
        } else {
            startPinchIfReady();
        }
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!pointersRef.current.has(event.pointerId)) return;

        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointersRef.current.size >= 2 && pinchRef.current) {
            const points = Array.from(pointersRef.current.values());
            const [first, second] = points;
            const nextDistance = getDistance(first, second);
            const nextCenter = getCenter(first, second);
            const nextScale = clamp(
                pinchRef.current.startScale * (nextDistance / pinchRef.current.startDistance),
                1,
                6
            );

            setScale(nextScale);
            setPosition({
                x: pinchRef.current.startPosition.x + (nextCenter.x - pinchRef.current.startCenter.x),
                y: pinchRef.current.startPosition.y + (nextCenter.y - pinchRef.current.startCenter.y)
            });
            return;
        }

        if (pointersRef.current.size === 1 && scale > 1 && lastPanPointRef.current) {
            const dx = event.clientX - lastPanPointRef.current.x;
            const dy = event.clientY - lastPanPointRef.current.y;
            lastPanPointRef.current = { x: event.clientX, y: event.clientY };
            setPosition((current) => ({ x: current.x + dx, y: current.y + dy }));
        }
    };

    const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
        pointersRef.current.delete(event.pointerId);
        pinchRef.current = null;

        const remaining = Array.from(pointersRef.current.values());
        lastPanPointRef.current = remaining[0] ?? null;

        if (pointersRef.current.size >= 2) {
            startPinchIfReady();
        }
    };

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        setScale((current) => clamp(current + (event.deltaY < 0 ? 0.25 : -0.25), 1, 6));
    };

    const handleDoubleClick = () => {
        if (scale > 1) {
            reset();
            return;
        }

        setScale(2);
    };

    return (
        <div
            className='relative flex h-full w-full touch-none select-none items-center justify-center overflow-hidden bg-muted/30'
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}>
            <Image
                src={image.path}
                alt={altText}
                width={1400}
                height={1400}
                className='max-h-full max-w-full object-contain will-change-transform'
                style={{
                    transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
                    transition: pointersRef.current.size > 0 ? 'none' : 'transform 120ms ease-out',
                    cursor: scale > 1 ? 'grab' : 'zoom-in'
                }}
                draggable={false}
                unoptimized
            />
            {scale > 1 && (
                <Button
                    type='button'
                    variant='secondary'
                    size='icon'
                    className='absolute bottom-3 right-3 h-9 w-9 rounded-full bg-background/85 shadow-sm backdrop-blur'
                    onClick={reset}
                    aria-label='重置缩放'>
                    <RotateCcw className='h-4 w-4' />
                </Button>
            )}
        </div>
    );
}

export function ImageOutput({
    imageBatch,
    viewMode,
    onViewChange,
    altText = '生成图片',
    isLoading,
    onSendToEdit,
    currentMode,
    baseImagePreviewUrl,
    streamingPreviewImages
}: ImageOutputProps) {
    const [viewerImage, setViewerImage] = React.useState<ImageInfo | null>(null);
    const [imageActionMessage, setImageActionMessage] = React.useState<string | null>(null);

    const getImageBlob = React.useCallback(async (image: ImageInfo) => {
        const response = await fetch(image.path);
        if (!response.ok) {
            throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
        }

        return response.blob();
    }, []);

    const handleSendClick = () => {
        if (typeof viewMode === 'number' && imageBatch && imageBatch[viewMode]) {
            onSendToEdit(imageBatch[viewMode].filename);
        }
    };

    const openViewer = (image: ImageInfo) => {
        setImageActionMessage(null);
        setViewerImage(image);
    };

    const handleDownload = async () => {
        if (!viewerImage) return;

        try {
            const blob = await getImageBlob(viewerImage);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = viewerImage.filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            setImageActionMessage('已开始下载图片。');
        } catch (error) {
            console.error('Failed to download image:', error);
            setImageActionMessage(error instanceof Error ? error.message : '下载图片失败。');
        }
    };

    const handleShare = async () => {
        if (!viewerImage) return;

        try {
            const blob = await getImageBlob(viewerImage);
            if (process.env.NEXT_PUBLIC_APP_RUNTIME === 'capacitor') {
                const { registerPlugin } = await import('@capacitor/core');
                const nativeShare = registerPlugin<{
                    shareImage: (options: {
                        filename: string;
                        mimeType: string;
                        base64Data: string;
                    }) => Promise<void>;
                }>('NativeShare');

                await nativeShare.shareImage({
                    filename: getSafeFilename(viewerImage.filename),
                    mimeType: blob.type || 'image/png',
                    base64Data: await blobToBase64(blob)
                });
                setImageActionMessage(null);
                return;
            }

            const file = new File([blob], viewerImage.filename, { type: blob.type || 'image/png' });
            const shareData: ShareData = {
                title: viewerImage.filename,
                text: '分享一张生成图片',
                files: [file]
            };

            if (navigator.canShare?.(shareData)) {
                await navigator.share(shareData);
                setImageActionMessage(null);
                return;
            }

            if (navigator.share) {
                await navigator.share({
                    title: viewerImage.filename,
                    text: '当前设备不支持直接分享图片文件，请先下载后分享。'
                });
                setImageActionMessage('当前设备不支持直接分享图片文件，请先下载后分享。');
                return;
            }

            setImageActionMessage('当前浏览器不支持系统分享，请先下载图片。');
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            console.error('Failed to share image:', error);
            setImageActionMessage(error instanceof Error ? error.message : '分享图片失败。');
        }
    };

    const showCarousel = imageBatch && imageBatch.length > 1;
    const isSingleImageView = typeof viewMode === 'number';
    const canSendToEdit = !isLoading && isSingleImageView && imageBatch && imageBatch[viewMode];

    return (
        <>
            <div className='app-panel flex min-h-[360px] w-full flex-col items-center justify-between gap-3 overflow-hidden rounded-lg p-3 sm:gap-4 sm:p-4 lg:h-full lg:min-h-[300px]'>
                <div className='relative flex min-h-[280px] w-full flex-grow items-center justify-center overflow-hidden lg:h-full lg:min-h-0'>
                    {isLoading ? (
                        streamingPreviewImages && streamingPreviewImages.size > 0 ? (
                            <div className='relative flex h-full w-full items-center justify-center'>
                                {(() => {
                                    const entries = Array.from(streamingPreviewImages.entries());
                                    const latestEntry = entries[entries.length - 1];
                                    if (!latestEntry) return null;

                                    const [, dataUrl] = latestEntry;
                                    return (
                                        <Image
                                            src={dataUrl}
                                            alt='生成预览'
                                            width={512}
                                            height={512}
                                            className='max-h-full max-w-full object-contain'
                                            unoptimized
                                        />
                                    );
                                })()}
                                <div className='absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-popover/85 px-3 py-1.5 text-popover-foreground shadow-sm backdrop-blur'>
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                    <p className='text-sm'>正在生成预览...</p>
                                </div>
                            </div>
                        ) : currentMode === 'edit' && baseImagePreviewUrl ? (
                            <div className='relative flex h-full w-full items-center justify-center'>
                                <Image
                                    src={baseImagePreviewUrl}
                                    alt='待编辑图片'
                                    fill
                                    style={{ objectFit: 'contain' }}
                                    className='blur-md filter'
                                    unoptimized
                                />
                                <div className='absolute inset-0 flex flex-col items-center justify-center bg-background/70 text-muted-foreground backdrop-blur-sm'>
                                    <Loader2 className='mb-2 h-8 w-8 animate-spin' />
                                    <p>正在编辑图片...</p>
                                </div>
                            </div>
                        ) : (
                            <div className='flex flex-col items-center justify-center text-muted-foreground'>
                                <Loader2 className='mb-2 h-8 w-8 animate-spin' />
                                <p>正在生成图片...</p>
                            </div>
                        )
                    ) : imageBatch && imageBatch.length > 0 ? (
                        viewMode === 'grid' ? (
                            <div
                                className={`grid ${getGridColsClass(
                                    imageBatch.length
                                )} max-h-full w-full max-w-full gap-1 p-1 sm:gap-2`}>
                                {imageBatch.map((img, index) => (
                                    <button
                                        key={img.filename}
                                        type='button'
                                        className='group relative aspect-square overflow-hidden rounded border border-border bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                                        onClick={() => openViewer(img)}
                                        aria-label={`放大查看第 ${index + 1} 张图片`}>
                                        <Image
                                            src={img.path}
                                            alt={`生成图片 ${index + 1}`}
                                            fill
                                            style={{ objectFit: 'contain' }}
                                            sizes='(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                                            unoptimized
                                        />
                                        <span className='absolute right-2 top-2 rounded-md bg-background/75 p-1 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
                                            <Maximize2 className='h-4 w-4' />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : imageBatch[viewMode] ? (
                            <button
                                type='button'
                                className='group relative flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                                onClick={() => openViewer(imageBatch[viewMode])}
                                aria-label='放大查看当前图片'>
                                <Image
                                    src={imageBatch[viewMode].path}
                                    alt={altText}
                                    width={512}
                                    height={512}
                                    className='max-h-full max-w-full object-contain'
                                    unoptimized
                                />
                                <span className='absolute right-3 top-3 rounded-md bg-background/75 p-1.5 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
                                    <Maximize2 className='h-4 w-4' />
                                </span>
                            </button>
                        ) : (
                            <div className='text-center text-muted-foreground'>
                                <p>暂无图片输出。</p>
                            </div>
                        )
                    ) : (
                        <div className='text-center text-muted-foreground'>
                            <p>暂无图片输出。</p>
                        </div>
                    )}
                </div>

                <div className='flex min-h-10 w-full shrink-0 flex-wrap items-center justify-center gap-2 sm:h-10 sm:flex-nowrap sm:gap-4'>
                    {showCarousel && (
                        <div className='flex max-w-full min-w-0 items-center gap-1.5 overflow-x-auto rounded-md border border-border bg-muted p-1'>
                            <Button
                                variant='ghost'
                                size='icon'
                                className={cn(
                                    'h-8 w-8 rounded p-1',
                                    viewMode === 'grid'
                                        ? 'bg-card text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                )}
                                onClick={() => onViewChange('grid')}
                                aria-label='显示宫格视图'>
                                <Grid className='h-4 w-4' />
                            </Button>
                            {imageBatch.map((img, index) => (
                                <Button
                                    key={img.filename}
                                    variant='ghost'
                                    size='icon'
                                    className={cn(
                                        'h-8 w-8 overflow-hidden rounded p-0.5',
                                        viewMode === index
                                            ? 'ring-2 ring-ring ring-offset-1 ring-offset-background'
                                            : 'opacity-60 hover:opacity-100'
                                    )}
                                    onClick={() => onViewChange(index)}
                                    aria-label={`查看图片 ${index + 1}`}>
                                    <Image
                                        src={img.path}
                                        alt={`缩略图 ${index + 1}`}
                                        width={28}
                                        height={28}
                                        className='h-full w-full object-cover'
                                        unoptimized
                                    />
                                </Button>
                            ))}
                        </div>
                    )}

                    <Button
                        variant='outline'
                        size='sm'
                        onClick={handleSendClick}
                        disabled={!canSendToEdit}
                        className={cn(
                            'app-soft-button shrink-0 disabled:pointer-events-none disabled:opacity-50',
                            showCarousel && viewMode === 'grid' ? 'hidden sm:invisible' : 'visible'
                        )}>
                        <Send className='mr-2 h-4 w-4' />
                        发送到编辑
                    </Button>
                </div>
            </div>

            <Dialog open={Boolean(viewerImage)} onOpenChange={(open) => !open && setViewerImage(null)}>
                <DialogContent className='max-w-[calc(100vw-1rem)] overflow-hidden border-border bg-background p-0 sm:max-w-[min(96vw,1200px)]'>
                    <DialogHeader className='sr-only'>
                        <DialogTitle>图片查看器</DialogTitle>
                        <DialogDescription>放大查看生成图片，支持双指缩放、下载和系统分享。</DialogDescription>
                    </DialogHeader>
                    <div className='flex items-center justify-between gap-2 border-b border-border px-3 py-2 pr-12'>
                        <div className='min-w-0 text-sm text-muted-foreground'>
                            <p className='truncate font-medium text-foreground'>{viewerImage?.filename}</p>
                            {imageActionMessage && <p className='truncate text-xs'>{imageActionMessage}</p>}
                        </div>
                        <div className='flex shrink-0 items-center gap-2'>
                            <Button type='button' variant='outline' size='sm' onClick={handleDownload}>
                                <Download className='mr-2 h-4 w-4' />
                                下载
                            </Button>
                            <Button type='button' variant='outline' size='sm' onClick={handleShare}>
                                <Share2 className='mr-2 h-4 w-4' />
                                分享
                            </Button>
                        </div>
                    </div>
                    <div className='h-[min(78svh,860px)] w-full sm:h-[min(82vh,860px)]'>
                        {viewerImage && <ZoomableImage image={viewerImage} altText='放大查看生成图片' />}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
