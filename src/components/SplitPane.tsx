'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

export interface SplitPaneProps {
  direction?: 'horizontal' | 'vertical';
  initialSize?: number; // percentage, e.g. 45
  minSize?: number; // percentage, e.g. 20
  maxSize?: number; // percentage, e.g. 80
  children: [React.ReactNode, React.ReactNode];
  firstCollapsed?: boolean;
  className?: string;
}

export function SplitPane({
  direction = 'horizontal',
  initialSize = 50,
  minSize = 20,
  maxSize = 80,
  children,
  firstCollapsed = false,
  className = '',
}: SplitPaneProps) {
  const [size, setSize] = useState<number>(initialSize);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHorizontal = direction === 'horizontal';

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setSize(50);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      let newPercent = 50;

      if (isHorizontal) {
        const clientX = e.clientX;
        const offset = clientX - rect.left;
        newPercent = (offset / rect.width) * 100;
      } else {
        const clientY = e.clientY;
        const offset = clientY - rect.top;
        newPercent = (offset / rect.height) * 100;
      }

      const clamped = Math.max(minSize, Math.min(maxSize, newPercent));
      setSize(clamped);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging, isHorizontal, minSize, maxSize]);

  const [firstChild, secondChild] = children;

  if (firstCollapsed) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden ${className}`}
      >
        <div className="w-full h-full overflow-hidden">{secondChild}</div>
      </div>
    );
  }

  const firstPaneStyle: React.CSSProperties = isHorizontal
    ? { width: `${size}%`, height: '100%' }
    : { height: `${size}%`, width: '100%' };

  const secondPaneStyle: React.CSSProperties = isHorizontal
    ? { width: `${100 - size}%`, height: '100%' }
    : { height: `${100 - size}%`, width: '100%' };

  return (
    <div
      ref={containerRef}
      className={`relative flex w-full h-full overflow-hidden select-none-during-drag ${
        isHorizontal ? 'flex-row' : 'flex-col'
      } ${className}`}
      style={{ userSelect: isDragging ? 'none' : 'auto' }}
    >
      {/* First Pane */}
      <div
        style={firstPaneStyle}
        className={`relative overflow-hidden ${
          isDragging ? 'pointer-events-none' : ''
        }`}
      >
        {firstChild}
      </div>

      {/* Resizer Gutter */}
      <div
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        className={`group relative z-20 flex flex-shrink-0 items-center justify-center transition-colors select-none ${
          isHorizontal
            ? 'w-2 cursor-col-resize hover:bg-sky-500/20 active:bg-sky-500/30'
            : 'h-2 cursor-row-resize hover:bg-sky-500/20 active:bg-sky-500/30'
        } ${isDragging ? (isHorizontal ? 'bg-sky-500/30' : 'bg-sky-500/30') : 'bg-surface-0'}`}
        title="Drag to resize, double click to reset to 50%"
      >
        {/* Visual divider line & handle pill */}
        <div
          className={`transition-all duration-150 ${
            isHorizontal
              ? 'w-px h-full bg-border-subtle group-hover:bg-sky-400 group-hover:w-0.5'
              : 'h-px w-full bg-border-subtle group-hover:bg-sky-400 group-hover:h-0.5'
          } ${isDragging ? (isHorizontal ? '!w-0.5 !bg-sky-400' : '!h-0.5 !bg-sky-400') : ''}`}
        />
        {/* Handle grip pill */}
        <div
          className={`absolute rounded-full bg-slate-600 transition-all opacity-0 group-hover:opacity-100 ${
            isHorizontal ? 'w-1 h-7' : 'h-1 w-7'
          } ${isDragging ? '!opacity-100 !bg-sky-400' : ''}`}
        />
      </div>

      {/* Second Pane */}
      <div
        style={secondPaneStyle}
        className={`relative overflow-hidden flex-1 ${
          isDragging ? 'pointer-events-none' : ''
        }`}
      >
        {secondChild}
      </div>

      {/* Full screen invisible overlay while dragging to trap mouse over iframes */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 cursor-col-resize select-none"
          style={{
            cursor: isHorizontal ? 'col-resize' : 'row-resize',
          }}
        />
      )}
    </div>
  );
}
