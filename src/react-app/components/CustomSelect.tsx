import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  label?: string;
  variant?: "search" | "filter";
  className?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  label,
  variant = "search",
  className = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  const isFilter = variant === "filter";

  return (
    <div
      ref={containerRef}
      className={`c-select-root ${isFilter ? "c-select-filter" : "c-select-search"} ${isOpen ? "c-select-open" : ""} ${className}`}
    >
      {label && <label className="c-select-label">{label}</label>}

      <button
        type="button"
        className="c-select-trigger"
        onClick={toggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="c-select-value-wrap">
          {selectedOption?.icon && <span className="c-select-icon">{selectedOption.icon}</span>}
          <span className={`c-select-value ${!selectedOption && !value ? "c-select-placeholder" : ""}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="c-select-chip">{selectedOption.badge}</span>
          )}
        </div>
        <ChevronDown size={14} className={`c-select-chevron ${isOpen ? "c-select-chevron-rotate" : ""}`} />
      </button>

      {isOpen && (
        <div className="c-select-dropdown" role="listbox">
          <div className="c-select-options-list">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`c-select-option ${isSelected ? "c-select-option-selected" : ""}`}
                  onClick={() => handleSelect(option.value)}
                >
                  <div className="c-select-opt-left">
                    {option.icon && <span className="c-select-opt-icon">{option.icon}</span>}
                    <div className="c-select-opt-text">
                      <span className="c-select-opt-label">{option.label}</span>
                      {option.sublabel && (
                        <span className="c-select-opt-sublabel">{option.sublabel}</span>
                      )}
                    </div>
                  </div>

                  <div className="c-select-opt-right">
                    {option.badge && (
                      <span className="c-select-opt-badge">{option.badge}</span>
                    )}
                    {isSelected && <Check size={14} className="c-select-check" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
