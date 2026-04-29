'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ModeToggleProps = {
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
};

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
    return (
        <Tabs
            value={currentMode}
            onValueChange={(value) => onModeChange(value as 'generate' | 'edit')}
            className='w-auto'>
            <TabsList className='grid h-10 grid-cols-2 gap-1 rounded-md border border-border bg-muted p-1'>
                <TabsTrigger
                    value='generate'
                    className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                        currentMode === 'generate'
                            ? 'border-border bg-card text-foreground shadow-xs'
                            : 'border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    } `}>
                    生成
                </TabsTrigger>
                <TabsTrigger
                    value='edit'
                    className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                        currentMode === 'edit'
                            ? 'border-border bg-card text-foreground shadow-xs'
                            : 'border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    } `}>
                    编辑
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
