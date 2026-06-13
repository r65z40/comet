"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  users: { id: string; name: string }[];
  className?: string;
}

export default function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  rows = 3,
  disabled = false,
  users,
  className,
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(query.toLowerCase())
  );

  // Reset active index when filtered results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!showDropdown || !dropdownRef.current) return;
    const activeEl = dropdownRef.current.children[activeIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, showDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const insertMention = useCallback(
    (user: { id: string; name: string }) => {
      if (mentionStart === null) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const before = value.slice(0, mentionStart);
      const after = value.slice(textarea.selectionStart);
      // Zero-width space (​) after the mention to separate it from following text
      const mention = `@${user.name}​`;
      const newValue = before + mention + after;

      onChange(newValue);
      setShowDropdown(false);
      setMentionStart(null);
      setQuery("");

      // Restore focus and set cursor position after the inserted mention
      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPos = before.length + mention.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [mentionStart, value, onChange]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      const cursorPos = e.target.selectionStart;
      // Look backwards from cursor for an unmatched '@'
      const textBeforeCursor = newValue.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        // Only trigger if '@' is at start of input or preceded by a whitespace
        const charBefore = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : " ";
        if (/\s/.test(charBefore) || lastAtIndex === 0) {
          const partial = textBeforeCursor.slice(lastAtIndex + 1);
          // Don't show dropdown if there's a space in the partial (mention already completed)
          // or if there's a zero-width space (mention already inserted)
          if (!partial.includes(" ") && !partial.includes("​")) {
            setQuery(partial);
            setMentionStart(lastAtIndex);
            setShowDropdown(true);
            return;
          }
        }
      }

      setShowDropdown(false);
      setMentionStart(null);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter or Cmd+Enter => submit
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSubmit?.();
        return;
      }

      if (!showDropdown || filteredUsers.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          insertMention(filteredUsers[activeIndex]);
          break;
        case "Escape":
          e.preventDefault();
          setShowDropdown(false);
          setMentionStart(null);
          break;
        case "Tab":
          e.preventDefault();
          insertMention(filteredUsers[activeIndex]);
          break;
      }
    },
    [showDropdown, filteredUsers, activeIndex, insertMention, onSubmit]
  );

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={cn(
          "w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />

      {showDropdown && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 z-50 mt-1 max-h-48 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {filteredUsers.map((user, index) => (
            <button
              key={user.id}
              type="button"
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-sm transition-colors",
                index === activeIndex
                  ? "bg-primary-50 text-primary-700"
                  : "text-slate-700 hover:bg-primary-50"
              )}
              onMouseDown={(e) => {
                // Use mousedown instead of click to fire before textarea blur
                e.preventDefault();
                insertMention(user);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {user.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
