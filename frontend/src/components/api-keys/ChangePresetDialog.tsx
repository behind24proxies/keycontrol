import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Preset, UseCase } from "@/lib/types";

interface ChangePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  useCase: UseCase | null;
  value: string;
  onValueChange: (v: string) => void;
  loading: boolean;
  presets: Preset[];
  onConfirm: () => Promise<void>;
  onReset: () => void;
}

export function ChangePresetDialog({
  open,
  onOpenChange,
  useCase,
  value,
  onValueChange,
  loading,
  presets,
  onConfirm,
  onReset,
}: ChangePresetDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) onReset();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Preset</DialogTitle>
          <DialogDescription>
            {useCase && `Select a preset for "${useCase.name}"`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label>Preset</Label>
          <Select
            value={value}
            onValueChange={onValueChange}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a preset…" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading || !value}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
