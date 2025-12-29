
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface SearchableOption {
    value: string | number;
    label: string;
    subLabel?: string;
}

interface SearchableSelectProps {
    options: SearchableOption[];
    value: string | number | undefined;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    required?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = "Selecione...",
    disabled = false,
    className = "",
    required = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Encontrar o item selecionado para exibir o label correto
    const selectedItem = useMemo(() => 
        options.find(o => String(o.value) === String(value)), 
    [options, value]);

    // Atualizar o termo de pesquisa quando o valor externo muda
    useEffect(() => {
        if (selectedItem) {
            setSearchTerm(selectedItem.label);
        } else if (!value) {
            setSearchTerm('');
        }
    }, [selectedItem, value]);

    // Fechar ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Reset search term to selected item label on blur if no new selection was made
                if (selectedItem) {
                    setSearchTerm(selectedItem.label);
                } else {
                    setSearchTerm('');
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedItem]);

    // Filtrar opções
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lowerTerm = searchTerm.toLowerCase();
        // Se o termo for igual ao label selecionado, mostrar tudo (usuário abriu o dropdown mas não editou)
        if (selectedItem && searchTerm === selectedItem.label) return options;

        return options.filter(opt => 
            opt.label.toLowerCase().includes(lowerTerm) || 
            (opt.subLabel && opt.subLabel.toLowerCase().includes(lowerTerm))
        );
    }, [options, searchTerm, selectedItem]);

    const handleSelect = (option: SearchableOption) => {
        onChange(String(option.value));
        setSearchTerm(option.label);
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
        setIsOpen(false);
        if(inputRef.current) inputRef.current.focus();
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div 
                className={`relative flex items-center w-full border rounded-xl bg-white transition-all ${
                    isOpen ? 'ring-2 ring-green-500 border-green-500' : 'border-gray-300'
                } ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'cursor-text'}`}
                onClick={() => { if (!disabled) { setIsOpen(true); inputRef.current?.focus(); } }}
            >
                <Search size={16} className="absolute left-3 text-gray-400" />
                
                <input
                    ref={inputRef}
                    type="text"
                    className={`w-full py-3 pl-10 pr-8 text-sm bg-transparent outline-none ${disabled ? 'cursor-not-allowed' : ''}`}
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!isOpen) setIsOpen(true);
                        // Se o utilizador apagar tudo, limpar seleção
                        if (e.target.value === '') onChange('');
                    }}
                    onFocus={() => setIsOpen(true)}
                    disabled={disabled}
                    required={required && !value}
                />

                <div className="absolute right-2 flex items-center gap-1">
                    {value && !disabled && (
                        <button onClick={handleClear} className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100">
                            <X size={14} />
                        </button>
                    )}
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fade-in-up">
                    {filteredOptions.length > 0 ? (
                        <ul className="py-1">
                            {filteredOptions.map((opt) => (
                                <li
                                    key={opt.value}
                                    onClick={() => handleSelect(opt)}
                                    className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-green-50 flex flex-col ${
                                        String(value) === String(opt.value) ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700'
                                    }`}
                                >
                                    <span>{opt.label}</span>
                                    {opt.subLabel && <span className="text-[10px] text-gray-400 font-normal">{opt.subLabel}</span>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-sm text-gray-400 italic">
                            Nenhum resultado encontrado.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
