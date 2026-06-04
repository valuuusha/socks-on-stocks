import React, { useState, KeyboardEvent } from "react";

type TagsInputProps = {
  tags: string[];
  onChange: (newTags: string[]) => void;
  onBlur: () => void;
};

export const TagsInput: React.FC<TagsInputProps> = ({ tags, onChange, onBlur }) => {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = inputValue.trim().toLowerCase();
      
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="tags-input-container" onBlur={onBlur}>
      {tags.map((tag, index) => (
        <span key={index} className="tag-chip">
          {tag}
          <button
            type="button"
            className="tag-chip__remove"
            onClick={() => removeTag(index)}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        type="text"
        className="tags-input-field"
        placeholder={tags.length === 0 ? "Enter keywords..." : ""}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};