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
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CardTag {
  id: string;
  tag: { id: string; name: string; color: string };
}

interface BoardCard {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: number;
  position: number;
  clientId: string | null;
  client: { id: string; name: string } | null;
  contactId: string | null;
  contact: { id: string; firstName: string | null; lastName: string | null } | null;
  assigneeId: string | null;
  assigneeName?: string;
  dueDate: string | null;
  links: string | null;
  tags: CardTag[];
  _count: { comments: number; attachments: number };
  createdAt: string;
}

const PRIORITY_CONFIG: Record<number, { label: string; color: string; dot: string }> = {
  1: { label: "Urgente", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  2: { label: "Normale", color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  3: { label: "Basse", color: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all group",
        (isSortableDragging || isDragging) && "opacity-50 shadow-lg",
        card.priority === 1 && "border-l-2 border-l-red-500"
      )}
      onClick={onClick}
    >
      {/* Drag handle + Priority */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <button
            {...attributes}
            {...listeners}
            className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
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
        </div>
        {/* Assignee avatar */}
        {card.assigneeName && (
          <div
            className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center text-[9px] font-bold text-primary-700 flex-shrink-0"
            title={card.assigneeName}
          >
            {card.assigneeName.charAt(0).toUpperCase()}
          </div>
        )}
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
            <span className="flex items-center gap-1 text-xs text-slate-600">
              <Building2 className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{card.client.name}</span>
            </span>
          )}
          {contactName && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{contactName}</span>
            </span>
          )}
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
