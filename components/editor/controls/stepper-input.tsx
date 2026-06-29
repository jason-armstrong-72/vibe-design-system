"use client";

import { ChevronDown, ChevronUp } from "@untitled-ui/icons-react";
import type { DraftField } from "@/lib/editor/use-draft-field";

interface StepperButtonsProps {
  ariaLabel: string;
  step: number;
  onStep: (delta: number) => void;
}

export function StepperButtons({ ariaLabel, step, onStep }: StepperButtonsProps) {
  return (
    <div className="ed-stepper">
      <button
        type="button"
        aria-label={`Increment ${ariaLabel}`}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onStep(step)}
      >
        <ChevronUp width={10} height={10} />
      </button>
      <button
        type="button"
        aria-label={`Decrement ${ariaLabel}`}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onStep(-step)}
      >
        <ChevronDown width={10} height={10} />
      </button>
    </div>
  );
}

interface StepperInputProps extends DraftField {
  ariaLabel: string;
  step?: number;
  onStep: (delta: number) => void;
}

export function StepperInput({
  draft,
  onChange,
  onBlur,
  onKeyDown,
  ariaLabel,
  step = 1,
  onStep,
}: StepperInputProps) {
  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={draft}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <StepperButtons ariaLabel={ariaLabel} step={step} onStep={onStep} />
    </>
  );
}
