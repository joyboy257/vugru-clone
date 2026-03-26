'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  className?: string;
  textClassName?: string;
  inputClassName?: string;
  placeholder?: string;
  maxLength?: number;
  iconSize?: number;
}

export function InlineEdit({
  value,
  onSave,
  className,
  textClassName,
  inputClassName,
  placeholder = 'Enter name...',
  maxLength = 100,
  iconSize = 14,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Auto-focus when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === value) {
      setEditValue(value);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch {
      // Revert on error
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.slice(0, maxLength))}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className={cn(
            'h-7 px-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'transition-all duration-150',
            inputClassName
          )}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={isSaving}
        />
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
      </div>
    );
  }

  return (
    <div className={cn('group relative inline-flex items-center gap-2', className)}>
      <span className={cn('truncate', textClassName)}>{value || placeholder}</span>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
        title="Rename"
      >
        <Pencil className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" style={{ width: iconSize, height: iconSize }} />
      </button>
    </div>
  );
}
