'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Clock, Copy, PanelTopOpen, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type RequestLogEvent = {
    at: number;
    label: string;
    details?: string;
};

export type RequestLogEntry = {
    id: string;
    startedAt: number;
    updatedAt: number;
    completedAt?: number;
    status: 'pending' | 'success' | 'error';
    mode: 'generate' | 'edit';
    runtime: 'web' | 'apk';
    method: string;
    url: string;
    baseUrl?: string;
    model: string;
    promptPreview: string;
    request: Record<string, unknown>;
    responseStatus?: number;
    responseContentType?: string | null;
    responseSummary?: string;
    error?: string;
    events: RequestLogEvent[];
};

type RequestInspectorProps = {
    logs: RequestLogEntry[];
    onClear: () => void;
};

const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

const formatDuration = (entry: RequestLogEntry) => {
    const end = entry.completedAt ?? entry.updatedAt;
    return `${Math.max(0, end - entry.startedAt)}ms`;
};

const statusClassName: Record<RequestLogEntry['status'], string> = {
    pending: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
    success: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
};

const statusLabel: Record<RequestLogEntry['status'], string> = {
    pending: '进行中',
    success: '成功',
    error: '失败'
};

export function RequestInspector({ logs, onClear }: RequestInspectorProps) {
    const [expandedId, setExpandedId] = React.useState<string | null>(null);
    const [isMobileOpen, setIsMobileOpen] = React.useState(false);

    React.useEffect(() => {
        if (!expandedId && logs[0]) {
            setExpandedId(logs[0].id);
        }
    }, [expandedId, logs]);

    const latest = logs[0];
    const latestSummary = latest
        ? `${latest.method} ${latest.url} · ${statusLabel[latest.status]} · ${formatDuration(latest)}`
        : '暂无请求记录';

    const copyLog = async (entry: RequestLogEntry) => {
        await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    };

    return (
        <>
            <Card className='overflow-hidden rounded-lg border border-border bg-card md:hidden'>
                <CardHeader className='flex flex-row items-center justify-between gap-3 px-3 py-3'>
                    <div className='min-w-0'>
                        <CardTitle className='flex items-center gap-2 text-base font-medium'>
                            <Clock className='h-4 w-4' />
                            请求查看
                        </CardTitle>
                        <p className='mt-1 truncate text-xs text-muted-foreground'>{latestSummary}</p>
                    </div>
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => setIsMobileOpen(true)}
                        className='shrink-0 gap-2'>
                        <PanelTopOpen className='h-4 w-4' />
                        打开
                    </Button>
                </CardHeader>
            </Card>

            <div className='hidden md:block'>
                <RequestInspectorPanel
                    logs={logs}
                    onClear={onClear}
                    expandedId={expandedId}
                    onExpandedIdChange={setExpandedId}
                    copyLog={copyLog}
                    latestSummary={latestSummary}
                />
            </div>

            <Dialog open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <DialogContent className='flex h-[88svh] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0'>
                    <DialogHeader className='border-b border-border px-4 py-3 pr-12 text-left'>
                        <DialogTitle className='flex items-center gap-2 text-base'>
                            <Clock className='h-4 w-4' />
                            请求查看
                        </DialogTitle>
                        <DialogDescription className='truncate'>{latestSummary}</DialogDescription>
                    </DialogHeader>
                    <RequestLogList
                        logs={logs}
                        onClear={onClear}
                        expandedId={expandedId}
                        onExpandedIdChange={setExpandedId}
                        copyLog={copyLog}
                        className='min-h-0 flex-1 overflow-y-auto'
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

function RequestInspectorPanel({
    logs,
    onClear,
    expandedId,
    onExpandedIdChange,
    copyLog,
    latestSummary
}: {
    logs: RequestLogEntry[];
    onClear: () => void;
    expandedId: string | null;
    onExpandedIdChange: (id: string | null) => void;
    copyLog: (entry: RequestLogEntry) => void;
    latestSummary: string;
}) {
    return (
        <Card className='overflow-hidden rounded-lg border border-border bg-card'>
            <CardHeader className='flex flex-row items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-4'>
                <div className='min-w-0'>
                    <CardTitle className='flex items-center gap-2 text-base font-medium'>
                        <Clock className='h-4 w-4' />
                        请求查看
                    </CardTitle>
                    <p className='mt-1 truncate text-xs text-muted-foreground'>{latestSummary}</p>
                </div>
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={onClear}
                    disabled={logs.length === 0}
                    className='shrink-0 gap-2'>
                    <Trash2 className='h-4 w-4' />
                    清空
                </Button>
            </CardHeader>
            <RequestLogList
                logs={logs}
                onClear={onClear}
                expandedId={expandedId}
                onExpandedIdChange={onExpandedIdChange}
                copyLog={copyLog}
                className='max-h-[440px] overflow-y-auto'
            />
        </Card>
    );
}

function RequestLogList({
    logs,
    onClear,
    expandedId,
    onExpandedIdChange,
    copyLog,
    className
}: {
    logs: RequestLogEntry[];
    onClear: () => void;
    expandedId: string | null;
    onExpandedIdChange: (id: string | null) => void;
    copyLog: (entry: RequestLogEntry) => void;
    className?: string;
}) {
    return (
        <CardContent className={cn('p-0', className)}>
            {logs.length === 0 ? (
                <div className='px-4 py-8 text-center text-sm text-muted-foreground'>
                    点击生成或编辑后，这里会显示实时请求状态。
                </div>
            ) : (
                <>
                    <div className='flex justify-end border-b border-border px-3 py-2 md:hidden'>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={onClear}
                            disabled={logs.length === 0}
                            className='gap-2'>
                            <Trash2 className='h-4 w-4' />
                            清空
                        </Button>
                    </div>
                    <div className='divide-y divide-border'>
                        {logs.map((entry) => {
                            const isExpanded = expandedId === entry.id;
                            return (
                                <div key={entry.id} className='px-3 py-2 sm:px-4'>
                                    <button
                                        type='button'
                                        className='flex w-full items-center gap-2 text-left'
                                        onClick={() => onExpandedIdChange(isExpanded ? null : entry.id)}>
                                        {isExpanded ? (
                                            <ChevronDown className='h-4 w-4 shrink-0 text-muted-foreground' />
                                        ) : (
                                            <ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground' />
                                        )}
                                        <span
                                            className={cn(
                                                'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                                statusClassName[entry.status]
                                            )}>
                                            {statusLabel[entry.status]}
                                        </span>
                                        <span className='min-w-0 flex-1 truncate text-sm'>
                                            {formatTime(entry.startedAt)} · {entry.mode} · {entry.model}
                                        </span>
                                        <span className='shrink-0 text-xs text-muted-foreground'>
                                            {formatDuration(entry)}
                                        </span>
                                    </button>

                                    {isExpanded && (
                                        <div className='mt-3 space-y-3 pl-0 text-xs sm:pl-6'>
                                            <div className='grid gap-2 sm:grid-cols-2'>
                                                <Info label='Runtime' value={entry.runtime} />
                                                <Info label='URL' value={entry.url} />
                                                <Info label='Base URL' value={entry.baseUrl || '-'} />
                                                <Info label='HTTP' value={String(entry.responseStatus ?? '-')} />
                                                <Info label='Content-Type' value={entry.responseContentType || '-'} />
                                                <Info label='Prompt' value={entry.promptPreview || '-'} />
                                            </div>

                                            <section>
                                                <div className='mb-1 font-medium text-foreground'>阶段</div>
                                                <div className='space-y-1.5'>
                                                    {entry.events.map((event, index) => (
                                                        <div
                                                            key={`${event.at}-${index}`}
                                                            className='rounded border border-border bg-muted/30 p-2'>
                                                            <div className='flex items-center justify-between gap-2'>
                                                                <span className='font-medium text-foreground'>
                                                                    {event.label}
                                                                </span>
                                                                <span className='text-muted-foreground'>
                                                                    +{event.at - entry.startedAt}ms
                                                                </span>
                                                            </div>
                                                            {event.details && (
                                                                <pre className='mt-1 whitespace-pre-wrap break-words text-muted-foreground'>
                                                                    {event.details}
                                                                </pre>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>

                                            <section>
                                                <div className='mb-1 font-medium text-foreground'>请求参数</div>
                                                <pre className='max-h-48 overflow-auto rounded border border-border bg-muted/30 p-2 whitespace-pre-wrap break-words text-muted-foreground'>
                                                    {JSON.stringify(entry.request, null, 2)}
                                                </pre>
                                            </section>

                                            {(entry.responseSummary || entry.error) && (
                                                <section>
                                                    <div className='mb-1 font-medium text-foreground'>
                                                        {entry.error ? '错误' : '响应摘要'}
                                                    </div>
                                                    <pre className='max-h-48 overflow-auto rounded border border-border bg-muted/30 p-2 whitespace-pre-wrap break-words text-muted-foreground'>
                                                        {entry.error || entry.responseSummary}
                                                    </pre>
                                                </section>
                                            )}

                                            <Button
                                                type='button'
                                                variant='outline'
                                                size='sm'
                                                className='gap-2'
                                                onClick={() => copyLog(entry)}>
                                                <Copy className='h-4 w-4' />
                                                复制日志
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </CardContent>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className='min-w-0 rounded border border-border bg-muted/20 p-2'>
            <div className='text-muted-foreground'>{label}</div>
            <div className='mt-0.5 truncate font-medium text-foreground' title={value}>
                {value}
            </div>
        </div>
    );
}
