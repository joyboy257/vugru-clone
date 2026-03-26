'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Photo {
  id: string;
  storageKey: string;
  filename: string;
  publicUrl: string | null;
  width?: number | null;
  height?: number | null;
  order: number;
}

interface SortablePhotoProps {
  photo: Photo;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  onStageClick?: (photo: Photo) => void;
}

function SortablePhoto({ photo, onDelete, isDeleting, onStageClick }: SortablePhotoProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative aspect-square group rounded-lg overflow-hidden bg-slate-800',
        isDragging && 'opacity-50 z-10 scale-105 shadow-2xl ring-2 ring-blue-500'
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.publicUrl || ''}
        alt={photo.filename}
        className="w-full h-full object-cover"
      />

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
      >
        <div className="w-6 h-6 bg-black/60 backdrop-blur-sm rounded flex items-center justify-center">
          <GripVertical className="w-3.5 h-3.5 text-white/80" />
        </div>
      </div>

      {/* Stage button */}
      {onStageClick && (
        <button
          onClick={(e) => { e.stopPropagation(); onStageClick(photo); }}
          className="absolute top-1.5 left-9 w-6 h-6 bg-black/60 backdrop-blur-sm rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 z-10"
        >
          <Wand2 className="w-3.5 h-3.5 text-white" />
        </button>
      )}

      {/* Delete button */}
      <button
        onClick={() => onDelete(photo.id)}
        disabled={isDeleting}
        className={cn(
          'absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 backdrop-blur-sm rounded flex items-center justify-center',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'hover:bg-red-500 hover:ring-2 hover:ring-red-400',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isDeleting ? (
          <Loader2 className="w-3 h-3 text-white animate-spin" />
        ) : (
          <X className="w-3 h-3 text-white" />
        )}
      </button>
    </div>
  );
}

interface SortablePhotoGridProps {
  photos: Photo[];
  projectId: string;
  onDeleted: (photoId: string) => void;
  onReordered: (photoIds: string[]) => void;
  onStageClick?: (photo: Photo) => void;
}

export function SortablePhotoGrid({
  photos,
  projectId,
  onDeleted,
  onReordered,
  onStageClick,
}: SortablePhotoGridProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = photos.findIndex((p) => p.id === active.id);
      const newIndex = photos.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(photos, oldIndex, newIndex);
      const newOrder = reordered.map((p) => p.id);

      // Optimistic update
      onReordered(newOrder);

      try {
        const res = await fetch(`/api/projects/${projectId}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ photoIds: newOrder }),
        });
        if (!res.ok) throw new Error('Failed to save order');
      } catch {
        // Revert by re-applying current server order (parents will pass correct order)
        toast.error('Failed to save order');
      }
    },
    [photos, projectId, onReordered]
  );

  const handleDelete = useCallback(
    async (photoId: string) => {
      setDeletingId(photoId);
      // Optimistic
      onDeleted(photoId);

      try {
        const res = await fetch(`/api/photos/${photoId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to delete photo');
      } catch {
        toast.error('Failed to delete photo');
        // Parent should revert on error — we just hide the spinner
        setDeletingId(null);
      }
    },
    [onDeleted]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {photos.map((photo) => (
            <SortablePhoto
              key={photo.id}
              photo={photo}
              onDelete={handleDelete}
              isDeleting={deletingId === photo.id}
              onStageClick={onStageClick}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
