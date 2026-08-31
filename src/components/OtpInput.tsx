import React, { useRef, useEffect } from 'react';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
}) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanDigit = rawVal.replace(/[^0-9]/g, '').slice(-1);

    const valArray = value.split('');
    if (cleanDigit) {
      valArray[index] = cleanDigit;
      const nextValue = valArray.join('').slice(0, length);
      onChange(nextValue);

      if (nextValue.length === length && onComplete) {
        onComplete(nextValue);
      } else if (index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    } else {
      valArray[index] = '';
      onChange(valArray.join('').slice(0, length));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] || digits[index] === ' ') {
        if (index > 0) {
          const valArray = value.split('');
          valArray[index - 1] = '';
          onChange(valArray.join(''));
          inputRefs.current[index - 1]?.focus();
        }
      } else {
        const valArray = value.split('');
        valArray[index] = '';
        onChange(valArray.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain').replace(/[^0-9]/g, '').slice(0, length);
    if (pasted) {
      onChange(pasted);
      const targetIndex = Math.min(pasted.length, length) - 1;
      if (targetIndex >= 0 && inputRefs.current[targetIndex]) {
        inputRefs.current[targetIndex]?.focus();
      }
      if (pasted.length === length && onComplete) {
        onComplete(pasted);
      }
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-2.5 my-2">
      {Array.from({ length }).map((_, index) => {
        const char = digits[index]?.trim() || '';
        const isFocused = document.activeElement === inputRefs.current[index];

        return (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={char}
            disabled={disabled}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`w-11 h-13 sm:w-12 sm:h-14 text-center font-mono font-bold text-xl rounded-xl border transition-all outline-none bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] ${
              error
                ? 'border-red-500 ring-2 ring-red-500/20 text-red-500'
                : char
                ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                : 'border-[var(--color-border)] hover:border-zinc-400 dark:hover:border-zinc-600 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={`Digit ${index + 1} of verification code`}
          />
        );
      })}
    </div>
  );
};
