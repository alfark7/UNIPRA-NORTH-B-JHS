
'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface EditableRemarkProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  isTextarea?: boolean;
}

export function EditableRemark({ label, value, onChange, options, isTextarea = false }: EditableRemarkProps) {
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    // If the value is not in the options and it's not empty, it must be a custom value.
    if (value && !options.includes(value)) {
      setIsCustom(true);
    } else {
      setIsCustom(false);
    }
  }, [value, options]);

  const handleSelectChange = (selectValue: string) => {
    if (selectValue === 'Other') {
      setIsCustom(true);
      onChange(''); // Clear the value to allow for custom input
    } else {
      setIsCustom(false);
      onChange(selectValue);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }

  const getSelectValue = () => {
    if (isCustom) return 'Other';
    return value || "";
  }

  return (
    <div>
      <h4 className="font-semibold">{label}</h4>
      <div className="mt-1 flex flex-col gap-2">
        <Select value={getSelectValue()} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
            <SelectItem value="Other">Other (specify)</SelectItem>
          </SelectContent>
        </Select>
        {isCustom && (
            isTextarea ? (
                <Textarea 
                    value={value}
                    onChange={handleInputChange}
                    placeholder={`Enter custom ${label.toLowerCase()}`}
                    className="mt-2"
                />
            ) : (
                <Input
                    value={value}
                    onChange={handleInputChange}
                    placeholder={`Enter custom ${label.toLowerCase()}`}
                    className="mt-2"
                />
            )
        )}
      </div>
    </div>
  );
}
