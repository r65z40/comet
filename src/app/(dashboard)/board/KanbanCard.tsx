"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  MessageSquare,
  Paperclip,
  Calendar,
  Building2,
  User,
  CheckSquare,
  Clock,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CardTag {
  id: string;
  tag: { id: string; name: string; color: string };
}

interface ChecklistItem {
  id: string;
  checked: boolean;
}

interface BoardCard {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: number;
  position: number;
  clientId: string | null;
  client: { id: string; name: string; logoUrl?: string | null } | null;
  contactId: string | null;
  contact: { id: string; firstName: string | null; lastName: string | null } | null;
  assigneeId: string | null;
  assigneeIds?: string | null;
  assigneeNames?: string[];
  dueDate: string | null;
  links: string | null;
  tags: CardTag[];
  checklist?: ChecklistItem[];
  archived?: boolean;
  movedToColumnAt?: string;
  _count: { comments: number; attachments: number; checklist?: number };
  createdAt: string;
}

const PRIORITY_CONFIG: Record<number, { label: string; color: string; dot: string }> = {
  1: { label: "Urgente", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  2: { label: "Normale", color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  3: { label: "Basse", color: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

function getTimeInColumn(movedToColumnAt?: string): string | null {
  if (!movedToColumnAt) return null;
  const moved = new Date(movedToColumnAt);
  const now = new Date();
  const diffMs = now.getTime() - moved.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return `${diffDays}j`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}sem`;
}

function getTimeInColumnColor(movedToColumnAt?: string): string {
  if (!movedToColumnAt) return "text-slate-400";
  const moved = new Date(movedToColumnAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - moved.getTime()) / 86400000);
  if (diffDays >= 14) return "text-red-500";
  if (diffDays >= 7) return "text-orange-500";
  if (diffDays >= 3) return "text-amber-500";
  return "text-slate-400";
}

interface Props {
  card: BoardCard;
  onClick: () => void;
  isDragging?: boolean;
}

export default function KanbanCard({ card, onClick, isDragging }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = PRIORITY_CONFIG[card.priority] || PRIORITY_CONFIG[3];
  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();
  const contactName = card.contact
    ? [card.contact.firstName, card.contact.lastName].filter(Boolean).join(" ") || null
    : null;

  // Checklist progress
  const checklistTotal = card.checklist?.length || card._count?.checklist || 0;
  const checklistDone = card.checklist?.filter((c) => c.checked).length || 0;
  const checklistPercent = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  // Time in column
  const timeInCol = getTimeInColumn(card.movedToColumnAt);
  const timeColor = getTimeInColumnColor(card.movedToColumnAt);

  // Multiple assignees
  const assigneeNames = card.assigneeNames || [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all group",
        (isSortableDragging || isDragging) && "opacity-50 shadow-lg",
        card.priority === 1 && "border-l-2 border-l-red-500",
        card.archived && "opacity-60"
      )}
      onClick={onClick}
    >
      {/* Drag handle + Priority */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <button
            {...attributes}
            {...listeners}
            className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border",
              priority.color
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", priority.dot)} />
            {priority.label}
          </span>
          {card.archived && (
            <Archive className="h-3 w-3 text-slate-400" />
          )}
        </div>
        {/* Assignee avatars + Client logo */}
        <div className="flex items-center gap-1">
          {card.client?.logoUrl && (
            <img
              src={card.client.logoUrl}
              alt={card.client.name}
              title={card.client.name}
              className="w-5 h-5 rounded-full object-cover flex-shrink-0"
            />
          )}
          {assigneeNames.length > 0 ? (
            <div className="flex -space-x-1">
              {assigneeNames.slice(0, 3).map((name, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 border border-white",
                    i === 0 ? "bg-primary-100 text-primary-700" :
                    i === 1 ? "bg-emerald-100 text-emerald-700" :
                    "bg-amber-100 text-amber-700"
                  )}
                  title={name}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
              ))}
              {assigneeNames.length > 3 && (
                <div
                  className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 border border-white flex-shrink-0"
                  title={assigneeNames.slice(3).join(", ")}
                >
                  +{assigneeNames.length - 3}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-slate-800 mb-1 line-clamp-2">{card.title}</h4>

      {/* Description preview */}
      {card.description && (
        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{card.description}</p>
      )}

      {/* Client & Contact */}
      {(card.client || contactName) && (
        <div className="flex flex-col gap-0.5 mb-2">
          {card.client && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-primary-50 border border-primary-100 rounded-md">
              <Building2 className="h-3.5 w-3.5 text-primary-600 flex-shrink-0" />
              <span className="truncate text-xs font-semibold text-primary-700">{card.client.name}</span>
            </span>
          )}
          {contactName && (
            <span className="flex items-center gap-1 text-xs text-slate-500 pl-1">
              <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{contactName}</span>
            </span>
          )}
        </div>
      )}

      {/* Checklist progress bar */}
      {checklistTotal > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <CheckSquare className={cn("h-3 w-3", checklistPercent === 100 ? "text-emerald-500" : "text-slate-400")} />
            <span className={cn("text-[10px] font-medium", checklistPercent === 100 ? "text-emerald-600" : "text-slate-500")}>
              {checklistDone}/{checklistTotal}
            </span>
          </div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                checklistPercent === 100 ? "bg-emerald-500" : checklistPercent > 50 ? "bg-primary-500" : "bg-slate-300"
              )}
              style={{ width: `${checklistPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.tags.map((t) => (
            <span
              key={t.id}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded"
              style={{
                backgroundColor: t.tag.color + "20",
                color: t.tag.color,
              }}
            >
              {t.tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {/* Due date */}
          {card.dueDate && (
            <span
              className={cn(
                "flex items-center gap-1",
                isOverdue ? "text-red-500" : "text-slate-400"
              )}
            >
              <Calendar className="h-3 w-3" />
              {new Date(card.dueDate).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          )}
          {/* Time in column */}
          {timeInCol && (
            <span className={cn("flex items-center gap-0.5", timeColor)} title="Temps dans cette colonne">
              <Clock className="h-3 w-3" />
              {timeInCol}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {card._count.comments > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {card._count.comments}
            </span>
          )}
          {card._count.attachments > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip className="h-3 w-3" />
              {card._count.attachments}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
