'use client';

import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { LanguageId } from '@/core/types';
import { getLanguageConfig } from '@/core/templates';

export interface MonacoEditorViewProps {
  code: string;
  onChange: (val: string) => void;
  language: LanguageId;
  fontSize?: number;
  isVimMode?: boolean;
  minimap?: boolean;
  onRun: () => void;
  onSubmit: () => void;
  editorRef?: React.MutableRefObject<any>;
}

export function MonacoEditorSkeleton() {
  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e] select-none p-4 overflow-hidden">
      {/* Editor top placeholder */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-2/40 mb-3">
        <div className="flex items-center space-x-2">
          <div className="h-3 w-12 rounded bg-surface-3/40 animate-pulse" />
          <div className="h-3 w-20 rounded bg-surface-3/30 animate-pulse" />
        </div>
        <div className="h-2 w-16 rounded bg-surface-3/20 animate-pulse" />
      </div>

      {/* Code lines skeleton */}
      <div className="flex-1 space-y-2.5 font-mono text-xs">
        {[
          { num: 1, w: 'w-2/5', color: 'bg-indigo-400/20' },
          { num: 2, w: 'w-1/3', color: 'bg-emerald-400/20' },
          { num: 3, w: 'w-1/6', color: 'bg-surface-3/20' },
          { num: 4, w: 'w-3/5', color: 'bg-sky-400/20' },
          { num: 5, w: 'w-1/2', color: 'bg-purple-400/20' },
          { num: 6, w: 'w-2/3', color: 'bg-amber-400/20' },
          { num: 7, w: 'w-1/4', color: 'bg-surface-3/30' },
          { num: 8, w: 'w-2/5', color: 'bg-blue-400/20' },
          { num: 9, w: 'w-1/2', color: 'bg-emerald-400/20' },
          { num: 10, w: 'w-1/5', color: 'bg-surface-3/20' },
          { num: 11, w: 'w-3/4', color: 'bg-indigo-400/20' },
          { num: 12, w: 'w-1/3', color: 'bg-purple-400/20' },
        ].map((line) => (
          <div key={line.num} className="flex items-center space-x-4">
            <span className="text-surface-3/40 w-6 text-right select-none text-[11px]">
              {line.num}
            </span>
            <div className={`h-3.5 rounded ${line.w} ${line.color} animate-pulse`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const MonacoEditorView: React.FC<MonacoEditorViewProps> = ({
  code,
  onChange,
  language,
  fontSize = 14,
  isVimMode = false,
  minimap = false,
  onRun,
  onSubmit,
  editorRef,
}) => {
  const onRunRef = useRef(onRun);
  const onSubmitRef = useRef(onSubmit);
  const internalEditorRef = useRef<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  const langConfig = getLanguageConfig(language);
  const monacoLanguage = langConfig?.monacoLanguage || 'cpp';
  const tabSize = language === 'javascript' || language === 'typescript' ? 2 : 4;

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    internalEditorRef.current = editor;
    if (editorRef) {
      editorRef.current = editor;
    }
    setIsMounted(true);

    // Register editor actions for Command Palette & Context Menu
    editor.addAction({
      id: 'cses-run-code',
      label: 'Run Code against Sample Cases',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      contextMenuGroupId: '1_cses',
      contextMenuOrder: 1,
      run: () => {
        onRunRef.current();
      },
    });

    editor.addAction({
      id: 'cses-submit-solution',
      label: 'Submit Solution to Judge',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter],
      contextMenuGroupId: '1_cses',
      contextMenuOrder: 2,
      run: () => {
        onSubmitRef.current();
      },
    });

    // Also bind direct command fallbacks
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunRef.current();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      onSubmitRef.current();
    });
  };

  return (
    <div className="relative w-full h-full min-h-[300px] overflow-hidden bg-[#1e1e1e]">
      <Editor
        height="100%"
        width="100%"
        theme="vs-dark"
        language={monacoLanguage}
        value={code}
        onChange={(val) => onChange(val ?? '')}
        onMount={handleEditorDidMount}
        loading={<MonacoEditorSkeleton />}
        options={{
          fontSize: fontSize || 14,
          fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
          fontLigatures: true,
          minimap: { enabled: minimap },
          bracketPairColorization: { enabled: true },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          tabSize,
          automaticLayout: true,
          wordWrap: 'on',
          contextmenu: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'line',
          padding: { top: 12, bottom: 12 },
        }}
      />

      {/* Vim mode indicator overlay if enabled */}
      {isVimMode && isMounted && (
        <div className="absolute bottom-2 right-4 z-10 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-400 backdrop-blur-sm pointer-events-none">
          VIM MODE
        </div>
      )}
    </div>
  );
};

export default MonacoEditorView;
