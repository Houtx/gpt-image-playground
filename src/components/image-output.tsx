'use client';

import * as React from 'react';
import Image from 'next/image';
import { Grid, Loader2, Maximize2, Send } from 'lucide-react';

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

const getGridColsClass = (count: number): string => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
};

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

    const handleSendClick = () => {
        if (typeof viewMode === 'number' && imageBatch && imageBatch[viewMode]) {
            onSendToEdit(imageBatch[viewMode].filename);
        }
    };

    const openViewer = (image: ImageInfo) => {
        setViewerImage(image);
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
                <DialogContent className='max-w-[calc(100vw-2rem)] overflow-hidden border-border bg-background p-0 sm:max-w-[min(96vw,1200px)]'>
                    <DialogHeader className='sr-only'>
                        <DialogTitle>图片查看器</DialogTitle>
                        <DialogDescription>放大查看生成图片。</DialogDescription>
                    </DialogHeader>
                    <div className='flex h-[min(82svh,900px)] w-full items-center justify-center bg-muted/30 p-3 sm:h-[min(86vh,900px)] sm:p-6'>
                        {viewerImage && (
                            <Image
                                src={viewerImage.path}
                                alt='放大查看生成图片'
                                width={1200}
                                height={1200}
                                className='max-h-full max-w-full object-contain'
                                unoptimized
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
