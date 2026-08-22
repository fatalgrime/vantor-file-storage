'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  description?: string;
}

interface CustomSelectProps<T extends string = string> {
  options: CustomSelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  disabled?: boolean;
}

export function CustomSelect<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  disabled = false,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If available space below is less than 220px and space above is greater, open upward
      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
    setIsOpen(!isOpen);
  };

  return (
    <div ref={containerRef} className={`relative inline-block w-full text-xs font-sans ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-1.5 border px-3 py-1.5 rounded-md text-xs font-medium transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 ${isOpen ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-slate-800 hover:border-slate-700'
          } ${disabled
            ? 'bg-slate-900/50 text-slate-500 cursor-not-allowed border-slate-850'
            : 'bg-slate-900/90 text-slate-300 hover:text-white cursor-pointer'
          } ${buttonClassName}`}
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1 text-left">
          {selectedOption?.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-400' : ''
            }`}
        />
      </button>

      {/* Custom Dropdown Overlay */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'} z-[150] min-w-full rounded-md border border-slate-700 bg-slate-900 py-1 text-xs shadow-2xl max-h-60 overflow-y-auto scrollbar-thin ${dropdownClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-1.5 flex items-center justify-between space-x-2 text-left transition-colors cursor-pointer ${isSelected
                  ? 'bg-blue-600/20 text-blue-400 font-semibold'
                  : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="text-[10px] text-slate-400 font-normal truncate">
                        {option.description}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && <Check className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
