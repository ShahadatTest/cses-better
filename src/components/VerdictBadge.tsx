'use client';

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Loader2,
  MinusCircle,
  Database,
  PauseCircle,
  type LucideIcon,
} from 'lucide-react';
import { VerdictStatus } from '@/core/types';

export interface VerdictBadgeProps {
  status: VerdictStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  label?: string;
  className?: string;
}

interface VerdictConfig {
  label: string;
  classes: string;
  icon: LucideIcon;
  spinIcon?: boolean;
}

const VERDICT_CONFIGS: Record<VerdictStatus, VerdictConfig> = {
  AC: {
    label: 'Accepted',
    classes: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    icon: CheckCircle2,
  },
  WA: {
    label: 'Wrong Answer',
    classes: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
    icon: XCircle,
  },
  TLE: {
    label: 'Time Limit Exceeded',
    classes: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    icon: Clock,
  },
  MLE: {
    label: 'Memory Limit Exceeded',
    classes: 'bg-orange-500/10 text-orange-400 border border-orange-500/30',
    icon: Database,
  },
  CE: {
    label: 'Compilation Error',
    classes: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
    icon: AlertTriangle,
  },
  RE: {
    label: 'Runtime Error',
    classes: 'bg-red-500/10 text-red-400 border border-red-500/30',
    icon: AlertCircle,
  },
  RUNNING: {
    label: 'Running',
    classes: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30',
    icon: Loader2,
    spinIcon: true,
  },
  PAUSED: {
    label: 'Paused',
    classes: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    icon: PauseCircle,
  },
  IDLE: {
    label: 'Idle',
    classes: 'bg-slate-800 text-slate-400 border border-slate-700',
    icon: MinusCircle,
  },
  SKIPPED: {
    label: 'Passed (>100KB)',
    classes: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
    icon: CheckCircle2,
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5 rounded gap-1',
  md: 'text-xs md:text-sm px-2.5 py-1 rounded-md gap-1.5',
  lg: 'text-sm md:text-base px-3.5 py-1.5 rounded-lg gap-2 font-medium',
};

const ICON_SIZES = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5 md:w-4 md:h-4',
  lg: 'w-4 h-4 md:w-5 md:h-5',
};

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  label,
  className = '',
}) => {
  const config = VERDICT_CONFIGS[status] || VERDICT_CONFIGS.IDLE;
  const IconComponent = config.icon;
  const displayText = label ?? config.label;

  return (
    <span
      className={`inline-flex items-center select-none font-medium transition-colors ${SIZE_CLASSES[size]} ${config.classes} ${className}`}
      title={`${status}: ${displayText}`}
    >
      {showIcon && (
        <IconComponent
          className={`shrink-0 ${ICON_SIZES[size]} ${
            config.spinIcon ? 'animate-spin' : ''
          }`}
          aria-hidden="true"
        />
      )}
      <span>{displayText}</span>
    </span>
  );
};

export default VerdictBadge;
