'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import * as React from 'react';

type NativeSettings = {
    apiKey: string;
    baseUrl: string;
};

type NativeSettingsDialogProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (settings: NativeSettings) => void;
    initialApiKey?: string | null;
    initialBaseUrl?: string | null;
};

export function NativeSettingsDialog({
    isOpen,
    onOpenChange,
    onSave,
    initialApiKey,
    initialBaseUrl
}: NativeSettingsDialogProps) {
    const [apiKey, setApiKey] = React.useState('');
    const [baseUrl, setBaseUrl] = React.useState('');

    React.useEffect(() => {
        if (isOpen) {
            setApiKey(initialApiKey || '');
            setBaseUrl(initialBaseUrl || '');
        }
    }, [isOpen, initialApiKey, initialBaseUrl]);

    const handleSave = () => {
        onSave({
            apiKey: apiKey.trim(),
            baseUrl: baseUrl.trim()
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className='border-white/20 bg-black text-white sm:max-w-[520px]'>
                <DialogHeader>
                    <DialogTitle className='text-white'>配置移动端接口</DialogTitle>
                    <DialogDescription className='text-white/60'>
                        API Key 和 Base URL 会保存在当前设备，用于 APK 本地模式直接调用接口。
                    </DialogDescription>
                </DialogHeader>
                <div className='grid gap-4 py-4'>
                    <div className='grid gap-2'>
                        <label htmlFor='native-api-key' className='text-sm text-white/80'>
                            API Key
                        </label>
                        <Input
                            id='native-api-key'
                            type='password'
                            placeholder='sk-...'
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className='border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                    </div>
                    <div className='grid gap-2'>
                        <label htmlFor='native-base-url' className='text-sm text-white/80'>
                            Base URL
                        </label>
                        <Input
                            id='native-base-url'
                            type='url'
                            placeholder='https://example.com/v1'
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            className='border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                        <p className='text-xs leading-5 text-white/45'>留空时会使用 OpenAI 官方接口。</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        type='button'
                        onClick={handleSave}
                        disabled={!apiKey.trim()}
                        className='bg-white px-6 text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50'>
                        保存
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
