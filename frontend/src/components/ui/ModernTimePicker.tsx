import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Sun, Moon, Check, RotateCcw, LayoutGrid } from 'lucide-react';

export interface ModernTimePickerProps {
  value: string; // "HH:mm" (24-hour format)
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
}

interface ParsedTime {
  hours24: number;
  hours12: number;
  minutes: number;
  period: 'AM' | 'PM';
}

function parseTime24(timeStr?: string): ParsedTime {
  if (!timeStr || !timeStr.includes(':')) {
    const now = new Date();
    const h24 = now.getHours();
    const mins = Math.floor(now.getMinutes() / 5) * 5;
    const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return { hours24: h24, hours12: h12, minutes: mins, period };
  }

  const parts = timeStr.split(':');
  let h24 = parseInt(parts[0], 10);
  let mins = parseInt(parts[1], 10);

  if (isNaN(h24)) h24 = 10;
  if (isNaN(mins)) mins = 0;

  h24 = Math.max(0, Math.min(23, h24));
  mins = Math.max(0, Math.min(59, mins));

  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;

  return { hours24: h24, hours12: h12, minutes: mins, period };
}

function formatTo24(hours12: number, minutes: number, period: 'AM' | 'PM'): string {
  let h24 = hours12 % 12;
  if (period === 'PM') {
    h24 += 12;
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h24)}:${pad(minutes)}`;
}

function formatDisplayTime(timeStr?: string): string {
  if (!timeStr) return '--:--';
  const { hours12, minutes, period } = parseTime24(timeStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours12)}:${pad(minutes)} ${period}`;
}

const COMMON_PRESETS = [
  { label: '09:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '11:00 AM', value: '11:00' },
  { label: '02:00 PM', value: '14:00' },
  { label: '03:30 PM', value: '15:30' },
  { label: '04:00 PM', value: '16:00' },
];

export const ModernTimePicker: React.FC<ModernTimePickerProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
  required = false,
  id,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeUnit, setActiveUnit] = useState<'hours' | 'minutes'>('hours');
  const [viewMode, setViewMode] = useState<'dial' | 'grid'>('dial');
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Internal selection state
  const parsed = parseTime24(value);
  const [selectedHour12, setSelectedHour12] = useState<number>(parsed.hours12);
  const [selectedMinute, setSelectedMinute] = useState<number>(parsed.minutes);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(parsed.period);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const clockRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);

  // Sync internal state when external value changes
  useEffect(() => {
    const p = parseTime24(value);
    setSelectedHour12(p.hours12);
    setSelectedMinute(p.minutes);
    setSelectedPeriod(p.period);
  }, [value]);

  // Position calculation with portal into document.body to prevent ANY modal overflow clipping
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 300;
    const popoverHeight = 350;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    if (left < 12) left = 12;

    const spaceBelow = window.innerHeight - rect.bottom;
    let top: number;
    if (spaceBelow >= popoverHeight + 8) {
      top = rect.bottom + 6;
    } else if (rect.top >= popoverHeight + 8) {
      top = rect.top - popoverHeight - 6;
    } else {
      top = Math.max(12, window.innerHeight - popoverHeight - 12);
    }

    setCoords({ top, left });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Handle outside click to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Commit value change to parent
  const commitChange = useCallback(
    (h12: number, min: number, per: 'AM' | 'PM') => {
      setSelectedHour12(h12);
      setSelectedMinute(min);
      setSelectedPeriod(per);
      const formatted24 = formatTo24(h12, min, per);
      onChange(formatted24);
    },
    [onChange]
  );

  // Handle dial pointer angle calculation
  const handlePointerAngle = useCallback(
    (clientX: number, clientY: number, autoAdvance = false) => {
      if (!clockRef.current) return;
      const rect = clockRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = clientX - centerX;
      const dy = clientY - centerY;

      // Calculate angle from 12 o'clock in degrees (0 to 360)
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angle < 0) angle += 360;

      if (activeUnit === 'hours') {
        let hour = Math.round(angle / 30);
        if (hour === 0) hour = 12;
        hour = Math.max(1, Math.min(12, hour));
        commitChange(hour, selectedMinute, selectedPeriod);
        if (autoAdvance) {
          setTimeout(() => setActiveUnit('minutes'), 200);
        }
      } else {
        let min = Math.round(angle / 6);
        if (min === 60) min = 0;
        min = Math.max(0, Math.min(59, min));
        commitChange(selectedHour12, min, selectedPeriod);
      }
    },
    [activeUnit, commitChange, selectedHour12, selectedMinute, selectedPeriod]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    handlePointerAngle(e.clientX, e.clientY, true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    handlePointerAngle(e.clientX, e.clientY, false);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  // Adjust time by minutes
  const addMinutes = (delta: number) => {
    let totalMins = (selectedHour12 % 12) * 60 + selectedMinute;
    if (selectedPeriod === 'PM') totalMins += 12 * 60;
    totalMins = (totalMins + delta + 24 * 60) % (24 * 60);

    const h24 = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const per: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;

    commitChange(h12, mins, per);
  };

  const handleSetNow = () => {
    const now = new Date();
    const h24 = now.getHours();
    const mins = now.getMinutes();
    const per: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    commitChange(h12, mins, per);
  };

  // Dial hand angle
  const handAngle = activeUnit === 'hours' ? (selectedHour12 % 12) * 30 : selectedMinute * 6;

  return (
    <div className={`relative inline-block w-full ${className}`}>
      {/* Hidden native input for standard form submission */}
      <input type="hidden" id={id} name={name} value={value} required={required} />

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between pl-3.5 pr-3 py-2 text-sm rounded-lg bg-background border transition-all duration-200 group text-left ${
          isOpen
            ? 'border-primary ring-2 ring-primary/20 shadow-sm'
            : 'border-border hover:border-foreground/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="font-medium text-foreground tracking-wide font-mono text-sm">
          {formatDisplayTime(value)}
        </span>
        <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-primary transition-colors">
          <Clock className="w-4 h-4 text-primary" />
        </div>
      </button>

      {/* Floating Modern Clock Popover via React Portal directly into document.body */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
            }}
            className="w-[295px] rounded-2xl bg-card border border-border shadow-2xl p-3.5 animate-in fade-in zoom-in-95 duration-150 select-none text-card-foreground"
          >
            {/* Header Display: Digital readout + AM/PM Switcher + Mode toggle */}
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              {/* Big Digital Readout */}
              <div className="flex items-center gap-1 font-mono text-xl font-bold">
                <button
                  type="button"
                  onClick={() => setActiveUnit('hours')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    activeUnit === 'hours'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-foreground/80 hover:bg-muted'
                  }`}
                >
                  {selectedHour12.toString().padStart(2, '0')}
                </button>
                <span className="text-muted-foreground text-lg animate-pulse">:</span>
                <button
                  type="button"
                  onClick={() => setActiveUnit('minutes')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    activeUnit === 'minutes'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-foreground/80 hover:bg-muted'
                  }`}
                >
                  {selectedMinute.toString().padStart(2, '0')}
                </button>
              </div>

              {/* AM / PM Segmented Toggle */}
              <div className="flex items-center p-0.5 bg-muted rounded-lg border border-border text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => commitChange(selectedHour12, selectedMinute, 'AM')}
                  className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    selectedPeriod === 'AM'
                      ? 'bg-background text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sun className="w-3 h-3 text-amber-500" />
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => commitChange(selectedHour12, selectedMinute, 'PM')}
                  className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    selectedPeriod === 'PM'
                      ? 'bg-background text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Moon className="w-3 h-3 text-indigo-400" />
                  PM
                </button>
              </div>

              {/* View Mode Toggle Button */}
              <button
                type="button"
                onClick={() => setViewMode((m) => (m === 'dial' ? 'grid' : 'dial'))}
                title={viewMode === 'dial' ? 'Switch to Grid View' : 'Switch to Clock Dial'}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {viewMode === 'dial' ? <LayoutGrid className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Quick Increment/Decrement Row */}
            <div className="flex items-center justify-between py-2 text-[11px] text-muted-foreground">
              <span className="font-semibold text-[11px] text-foreground uppercase tracking-wider">
                {activeUnit === 'hours' ? 'Choose Hour' : 'Choose Minute'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => addMinutes(-15)}
                  className="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted text-foreground transition-colors text-[10px]"
                >
                  -15m
                </button>
                <button
                  type="button"
                  onClick={() => addMinutes(15)}
                  className="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted text-foreground transition-colors text-[10px]"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => addMinutes(30)}
                  className="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted text-foreground transition-colors text-[10px]"
                >
                  +30m
                </button>
              </div>
            </div>

            {/* BODY: Analog Clock Face (ViewMode === 'dial') */}
            {viewMode === 'dial' ? (
              <div className="py-1 flex justify-center">
                <div
                  ref={clockRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="relative w-[180px] h-[180px] rounded-full bg-muted/40 border border-border shadow-inner flex items-center justify-center cursor-pointer touch-none"
                >
                  {/* Center Pivot Pin */}
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-primary z-20 shadow-xs" />

                  {/* Clock Hand */}
                  <div
                    className="absolute bottom-1/2 left-1/2 -translate-x-1/2 origin-bottom transition-transform duration-100 ease-out z-10 pointer-events-none"
                    style={{
                      height: '65px',
                      transform: `rotate(${handAngle}deg)`,
                    }}
                  >
                    {/* Stem */}
                    <div className="w-0.5 h-full bg-primary mx-auto" />
                    {/* Selector disc at top of hand */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6.5 h-6.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shadow-md font-mono">
                      {activeUnit === 'hours'
                        ? selectedHour12
                        : selectedMinute.toString().padStart(2, '0')}
                    </div>
                  </div>

                  {/* Dial Numbers */}
                  {activeUnit === 'hours'
                    ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h, i) => {
                        const angle = (i * 30 - 90) * (Math.PI / 180);
                        const radius = 64;
                        const x = 90 + radius * Math.cos(angle);
                        const y = 90 + radius * Math.sin(angle);
                        const isSelected = selectedHour12 === h;

                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              commitChange(h, selectedMinute, selectedPeriod);
                              setTimeout(() => setActiveUnit('minutes'), 150);
                            }}
                            style={{
                              left: `${x}px`,
                              top: `${y}px`,
                            }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold font-mono transition-colors z-20 ${
                              isSelected
                                ? 'text-primary-foreground font-bold'
                                : 'text-foreground/80 hover:bg-muted'
                            }`}
                          >
                            {h}
                          </button>
                        );
                      })
                    : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m, i) => {
                        const angle = (i * 30 - 90) * (Math.PI / 180);
                        const radius = 64;
                        const x = 90 + radius * Math.cos(angle);
                        const y = 90 + radius * Math.sin(angle);
                        const isSelected = selectedMinute === m;

                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              commitChange(selectedHour12, m, selectedPeriod);
                            }}
                            style={{
                              left: `${x}px`,
                              top: `${y}px`,
                            }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold font-mono transition-colors z-20 ${
                              isSelected
                                ? 'text-primary-foreground font-bold'
                                : 'text-foreground/80 hover:bg-muted'
                            }`}
                          >
                            {m.toString().padStart(2, '0')}
                          </button>
                        );
                      })}
                </div>
              </div>
            ) : (
              /* BODY: Fast Grid View (ViewMode === 'grid') */
              <div className="py-2 space-y-2">
                {activeUnit === 'hours' ? (
                  <div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => {
                            commitChange(h, selectedMinute, selectedPeriod);
                            setActiveUnit('minutes');
                          }}
                          className={`py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                            selectedHour12 === h
                              ? 'bg-primary text-primary-foreground shadow-xs scale-105'
                              : 'bg-muted/50 hover:bg-muted text-foreground'
                          }`}
                        >
                          {h.toString().padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => commitChange(selectedHour12, m, selectedPeriod)}
                          className={`py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                            selectedMinute === m
                              ? 'bg-primary text-primary-foreground shadow-xs scale-105'
                              : 'bg-muted/50 hover:bg-muted text-foreground'
                          }`}
                        >
                          :{m.toString().padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Slots Strip */}
            <div className="pt-2 border-t border-border">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Common Slots
              </div>
              <div className="grid grid-cols-3 gap-1 text-xs">
                {COMMON_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      onChange(preset.value);
                      const p = parseTime24(preset.value);
                      setSelectedHour12(p.hours12);
                      setSelectedMinute(p.minutes);
                      setSelectedPeriod(p.period);
                    }}
                    className={`py-1 px-1 rounded text-[10px] font-mono text-center transition-colors ${
                      value === preset.value
                        ? 'bg-primary/15 text-primary font-bold border border-primary/30'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Footer */}
            <div className="pt-2.5 mt-1.5 border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={handleSetNow}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                Now
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-all shadow-xs"
              >
                <Check className="w-3 h-3" />
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default ModernTimePicker;
