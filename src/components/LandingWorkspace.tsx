'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, RotateCcw, Play } from 'lucide-react';
import styles from './LandingWorkspace.module.css';

const steps = ['Read', 'Code', 'Test'] as const;

export function LandingWorkspace() {
  const [active, setActive] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const play = useCallback(() => {
    clearTimers();
    setActive(0);
    setHasPlayed(true);
    setPlaying(true);
    timers.current = [
      setTimeout(() => setActive(1), 1150),
      setTimeout(() => setActive(2), 2300),
      setTimeout(() => setPlaying(false), 3450),
    ];
  }, [clearTimers]);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!reduce.matches) {
      timers.current = [setTimeout(play, 450)];
      return () => clearTimers();
    }
    return () => clearTimers();
  }, [play, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const select = (index: number) => {
    clearTimers();
    setActive((index + steps.length) % steps.length);
    setHasPlayed(true);
    setPlaying(false);
  };

  const forward = () => select(active + 1);
  const backward = () => select(active - 1);

  return (
    <div className={styles.window} data-step={active}>
      <div className={styles.topbar}>
        <div className={styles.traffic}><i /><i /><i /></div>
        <span className={styles.windowTitle}>CSES Better <span>/</span> Weird Algorithm</span>
        <span className={styles.online}><i /> Workspace</span>
      </div>
      <div className={styles.toolbar}><span className={styles.problemTab}>Weird Algorithm <span>1068</span></span><span className={styles.language}>C++17 <i /></span></div>

      <div className={styles.workArea}>
        <div className={`${styles.pane} ${styles.statement}`} aria-hidden="true">
          <div className={styles.paneHead}><span>PROBLEM</span><span>⋯</span></div>
          <h3>Weird Algorithm</h3>
          <p>Consider an algorithm that takes as input a positive integer <code>n</code>.</p>
          <div className={`${styles.rule} ${active === 0 ? styles.focused : ''}`}><b>If n is even</b><span>divide it by two</span></div>
          <div className={`${styles.rule} ${active === 0 ? styles.focused : ''}`}><b>If n is odd</b><span>multiply by three and add one</span></div>
          <p className={styles.statementFoot}>Repeat until <code>n = 1</code>.</p>
        </div>
        <div className={`${styles.pane} ${styles.editor}`}>
          <div className={styles.paneHead}><span>EDITOR</span><span>main.cpp</span></div>
          <div className={styles.code} aria-label="Example C++ solution for Weird Algorithm">
            <div><em>1</em><span><b className={styles.purple}>#include</b> <i>&lt;bits/stdc++.h&gt;</i></span></div>
            <div><em>2</em><span><b className={styles.blue}>using namespace</b> std;</span></div>
            <div><em>3</em><span>&nbsp;</span></div>
            <div className={active >= 1 ? styles.codeFocus : ''}><em>4</em><span><b className={styles.purple}>int</b> main() {'{'}</span></div>
            <div className={active >= 1 ? styles.codeFocus : ''}><em>5</em><span>  <b className={styles.purple}>long long</b> n;</span></div>
            <div className={active >= 1 ? styles.codeFocus : ''}><em>6</em><span>  cin &gt;&gt; n;</span></div>
            <div className={active >= 1 ? styles.codeFocus : ''}><em>7</em><span>  cout &lt;&lt; n &lt;&lt; <i>" "</i>;</span></div>
            <div className={active >= 1 ? styles.codeFocus : ''}><em>8</em><span>  <b className={styles.purple}>while</b> (n != 1) {'{'}</span></div>
            <div className={active >= 1 ? styles.codeFocus : ''}><em>9</em><span>    n = n % 2 ? 3*n+1 : n/2;</span></div>
            <div className={active >= 1 ? styles.codeFocus : ''}><em>10</em><span>    cout &lt;&lt; n &lt;&lt; <i>" "</i>;</span></div>
            <div><em>11</em><span>  {'}'}</span></div>
            <div><em>12</em><span>{'}'}</span></div>
          </div>
          <div className={`${styles.runBar} ${active === 2 ? styles.runReady : ''}`}><span className={styles.runButton}><Play aria-hidden="true" size={10} fill="currentColor" /> Run sample</span><span>{active === 2 ? 'Sample checked' : 'Sample test'}</span></div>
        </div>
        <div className={`${styles.pane} ${styles.output} ${active === 2 ? styles.outputOpen : ''}`}>
          <div className={styles.paneHead}><span>TEST BENCH</span><span>{active === 2 ? '1 / 1 passed' : 'Sample'}</span></div>
          <div className={styles.testCase}><b>Input</b><code>3</code></div>
          <div className={styles.testCase}><b>Expected output</b><code>3 10 5 16 8 4 2 1</code></div>
          {active === 2 && <div className={styles.accepted}><Check aria-hidden="true" size={12} /> Sample passed</div>}
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.stepButtons} role="group" aria-label="Workspace preview stages">
          {steps.map((label, index) => <button key={label} type="button" onClick={() => select(index)} aria-pressed={active === index} aria-label={`${label} stage`} className={active === index ? styles.activeStep : ''}><span>{index + 1}</span>{label}</button>)}
        </div>
        <div className={styles.transport}>
          <button type="button" onClick={backward} aria-label="Previous stage"><ChevronLeft size={16} /></button>
          <button type="button" onClick={play} aria-label={hasPlayed ? 'Replay workspace preview' : 'Play workspace preview'}>{hasPlayed ? <RotateCcw size={14} /> : <Play size={13} fill="currentColor" />}{hasPlayed ? 'Replay' : 'Play'}</button>
          <button type="button" onClick={forward} aria-label="Next stage"><ChevronRight size={16} /></button>
        </div>
      </div>
      <p className={styles.caption} aria-live="polite">Illustrative demo · no code is submitted. {active === 0 ? 'Start with the problem statement.' : active === 1 ? 'Shape an idea into code.' : 'Check the sample result.'}</p>
    </div>
  );
}
