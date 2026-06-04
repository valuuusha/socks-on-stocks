import React, { KeyboardEvent, useEffect, useRef, useState } from "react";

type TagsInputProps = {
  tags: string[];
  onChange: (newTags: string[]) => void;
  onBlur: () => void;
};

export const TagsInput = ({ tags, onChange, onBlur }: TagsInputProps) => {
  const [inputValue, setInputValue] = useState("");
  const [cursorIndex, setCursorIndex] = useState(tags.length);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (inputRefs.current[cursorIndex]) {
      inputRefs.current[cursorIndex]?.focus();
    }
  }, [cursorIndex]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = inputValue.trim().toLowerCase();
      if (newTag && !tags.includes(newTag)) {
        const updatedTags = [...tags];
        updatedTags.splice(index, 0, newTag);
        onChange(updatedTags);
        setCursorIndex(index + 1);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && inputValue === "") {
      if (index > 0) {
        const updatedTags = [...tags];
        updatedTags.splice(index - 1, 1);
        onChange(updatedTags);
        setCursorIndex(index - 1);
      }
    } else if (e.key === "ArrowLeft" && inputValue === "") {
      if (index > 0) setCursorIndex(index - 1);
    } else if (e.key === "ArrowRight" && inputValue === "") {
      if (index < tags.length) setCursorIndex(index + 1);
    }
  };

  const removeTag = (indexToRemove: number) => {
    const updatedTags = tags.filter((_, index) => index !== indexToRemove);
    onChange(updatedTags);
    if (cursorIndex > indexToRemove) {
      setCursorIndex(cursorIndex - 1);
    }
  };

  const renderInput = (index: number) => {
    const isActive = cursorIndex === index;
    
    return (
      <input
        ref={(el) => (inputRefs.current[index] = el)}
        type="text"
        className={`tags-input-field ${isActive ? "active" : "inactive"}`}
        placeholder={tags.length === 0 && isActive ? "Enter keywords..." : ""}
        value={isActive ? inputValue : ""}
        onChange={(e) => isActive && setInputValue(e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, index)}
        onFocus={() => {
          if (cursorIndex !== index) {
            setCursorIndex(index);
            setInputValue("");
          }
        }}
        style={{
          width: isActive
            ? (inputValue.length > 0 ? `${inputValue.length + 2}ch` : "120px")
            : "8px",
        }}
      />
    );
  };

  return (
    <div
      className="tags-input-container"
      ref={containerRef}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          onBlur();
        }
      }}
      onClick={(e) => {
        if (e.target === containerRef.current) {
          setCursorIndex(tags.length);
        }
      }}
    >
      {tags.map((tag, index) => (
        <React.Fragment key={`${tag}-${index}`}>
          {renderInput(index)}
          <span className="tag-chip">
            {tag}
            <button
              type="button"
              className="tag-chip__remove"
              onClick={() => removeTag(index)}
              tabIndex={-1}
            >
              ✕
            </button>
          </span>
        </React.Fragment>
      ))}
      {renderInput(tags.length)}
    </div>
  );
};