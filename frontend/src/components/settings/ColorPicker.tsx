import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ── HSL utilities ─────────────────────────────────────────────────────

export function parseHSL(hsl: string): [number, number, number] {
  const parts = hsl.split(" ");
  return [
    parseFloat(parts[0]) || 0,
    parseFloat(parts[1]) || 0,
    parseFloat(parts[2]) || 0,
  ];
}

export function formatHSL(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s / 100) * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToHsl(hex: string): [number, number, number] {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// ── ColorPicker component ─────────────────────────────────────────────

interface ColorPickerProps {
  label: string | React.ReactNode;
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [h, s, l] = parseHSL(tempValue);
  const hexColor = hslToHex(h, s, l);

  useEffect(() => {
    if (isOpen) {
      setTempValue(value);
    }
  }, [isOpen, value]);

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const [newH, newS, newL] = hexToHsl(hex);
    setTempValue(formatHSL(newH, newS, newL));
  };

  const handleHSLChange = (newH?: number, newS?: number, newL?: number) => {
    setTempValue(formatHSL(newH ?? h, newS ?? s, newL ?? l));
  };

  const handleApply = () => {
    onChange(tempValue);
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTempValue(value);
    }
    setIsOpen(open);
  };

  const [displayH, displayS, displayL] = parseHSL(value);
  const displayHex = hslToHex(displayH, displayS, displayL);

  return (
    <div className="space-y-2">
      {typeof label === "string" ? <Label>{label}</Label> : label}
      <div className="flex gap-2 items-center">
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-16 h-12 rounded border border-border cursor-pointer"
              style={{ backgroundColor: displayHex, padding: "2px" }}
              onClick={() => setIsOpen(true)}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-4">
              <div className="flex gap-2 items-center">
                <Input
                  type="color"
                  value={hexColor}
                  onChange={handleColorInputChange}
                  className="w-20 h-12 rounded border border-border cursor-pointer"
                  style={{ padding: "2px" }}
                />
                <div
                  className="w-16 h-16 rounded border border-border"
                  style={{ backgroundColor: `hsl(${h}, ${s}%, ${l}%)` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">H</Label>
                  <Input
                    type="number"
                    min="0"
                    max="360"
                    value={h}
                    onChange={(e) =>
                      handleHSLChange(
                        parseFloat(e.target.value) || 0,
                        undefined,
                        undefined,
                      )
                    }
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">S</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={s}
                    onChange={(e) =>
                      handleHSLChange(
                        undefined,
                        parseFloat(e.target.value) || 0,
                        undefined,
                      )
                    }
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">L</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={l}
                    onChange={(e) =>
                      handleHSLChange(
                        undefined,
                        undefined,
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="h-8"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleApply}>
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div
          className="w-12 h-12 rounded border border-border"
          style={{
            backgroundColor: `hsl(${displayH}, ${displayS}%, ${displayL}%)`,
          }}
        />
        <div className="flex-1 grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">H</Label>
            <Input
              type="number"
              min="0"
              max="360"
              value={displayH}
              onChange={(e) =>
                onChange(
                  formatHSL(
                    parseFloat(e.target.value) || 0,
                    displayS,
                    displayL,
                  ),
                )
              }
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">S</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={displayS}
              onChange={(e) =>
                onChange(
                  formatHSL(
                    displayH,
                    parseFloat(e.target.value) || 0,
                    displayL,
                  ),
                )
              }
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">L</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={displayL}
              onChange={(e) =>
                onChange(
                  formatHSL(
                    displayH,
                    displayS,
                    parseFloat(e.target.value) || 0,
                  ),
                )
              }
              className="h-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
