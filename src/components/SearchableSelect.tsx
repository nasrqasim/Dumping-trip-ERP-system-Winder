import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface SearchOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: 'emerald' | 'rose' | 'amber' | 'indigo' | 'slate';
  searchTerms?: string;
}

interface SearchableSelectProps {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  required = false,
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  // Filter options based on search query (case-insensitive partial matching)
  const filteredOptions = options.filter(opt => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const labelMatch = opt.label.toLowerCase().includes(query);
    const subLabelMatch = opt.subLabel ? opt.subLabel.toLowerCase().includes(query) : false;
    const badgeMatch = opt.badge ? opt.badge.toLowerCase().includes(query) : false;
    const termsMatch = opt.searchTerms ? opt.searchTerms.toLowerCase().includes(query) : false;
    const valueMatch = opt.value.toLowerCase().includes(query);

    return labelMatch || subLabelMatch || badgeMatch || termsMatch || valueMatch;
  });

  const getBadgeStyle = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input for native form validation if required */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border rounded-lg text-sm text-left flex items-center justify-between transition ${
          disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
            : isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-100 bg-white'
            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
        }`}
      >
        <div className="flex-1 truncate pr-2">
          {selectedOption ? (
            <div className="flex items-center space-x-2 truncate">
              <span className="font-semibold text-slate-800 truncate">{selectedOption.label}</span>
              {selectedOption.subLabel && (
                <span className="text-xs text-slate-400 truncate">{selectedOption.subLabel}</span>
              )}
              {selectedOption.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getBadgeStyle(selectedOption.badgeColor)}`}>
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0 text-slate-400">
          {selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => {
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange('');
                }
              }}
              className="p-0.5 hover:text-slate-600 rounded cursor-pointer"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-72 animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2">
            <Search className="h-4 w-4 text-slate-400 flex-shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Type to search..."
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none py-1"
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50 py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-indigo-50/60 transition ${
                      isSelected ? 'bg-indigo-50/90 text-indigo-900 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-2">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${getBadgeStyle(opt.badgeColor)}`}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subLabel && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{opt.subLabel}</p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="py-6 px-4 text-center text-xs text-slate-400">
                No matching results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
