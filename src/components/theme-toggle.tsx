'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = mounted ? resolvedTheme === 'dark' : false;

    return (
        <Button
            type='button'
            variant='outline'
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className='h-10 cursor-pointer gap-2 rounded-md border-border bg-card px-2 text-card-foreground shadow-sm hover:bg-accent hover:text-accent-foreground'
            aria-label={isDark ? '切换到白天模式' : '切换到黑夜模式'}
            title={isDark ? '切换到白天模式' : '切换到黑夜模式'}>
            <span
                className={cn(
                    'flex h-7 items-center gap-1.5 rounded px-2 text-sm transition-colors',
                    !isDark ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}>
                <Sun className='h-4 w-4' />
                白天
            </span>
            <span
                className={cn(
                    'flex h-7 items-center gap-1.5 rounded px-2 text-sm transition-colors',
                    isDark ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}>
                <Moon className='h-4 w-4' />
                黑夜
            </span>
        </Button>
    );
}
