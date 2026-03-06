import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import type { UseCase } from "@/lib/types";
import {
  Edit,
  Trash2,
  Copy,
  Check,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Key,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { ApiKeyStatsPopover } from "./ApiKeyStatsPopover";
import type { PaginationState } from "@/hooks/useApiKeys";

// ── Skeleton ──────────────────────────────────────────────────────────

export function ApiKeysTableSkeleton() {
  return (
    <TableBody>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-44 rounded" />
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-6" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-20" />
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

// ── Table ─────────────────────────────────────────────────────────────

interface ApiKeysTableProps {
  useCases: UseCase[];
  loading: boolean;
  pagination: PaginationState;

  // Key visibility
  visibleKeys: Record<number, boolean>;
  toggleKeyVisibility: (id: number) => void;
  copiedKeyId: number | null;
  handleCopyKey: (uc: UseCase) => Promise<void>;
  maskKey: (key: string) => string;

  // Stats
  statsCache: Record<number, any>;
  statsLoading: Record<number, boolean>;
  loadStats: (id: number) => Promise<void>;

  // Actions
  handleOpenPresetDialog: (uc: UseCase) => void;
  handleEdit: (uc: UseCase) => void;
  handleDelete: (id: number) => void;

  // Pagination
  goToPage: (p: number) => void;
  handlePerPageChange: (value: string) => void;
}

export function ApiKeysTable({
  useCases,
  loading,
  pagination,
  visibleKeys,
  toggleKeyVisibility,
  copiedKeyId,
  handleCopyKey,
  maskKey,
  statsCache,
  statsLoading,
  loadStats,
  handleOpenPresetDialog,
  handleEdit,
  handleDelete,
  goToPage,
}: ApiKeysTableProps) {
  return (
    <>
      {loading ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Preset</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <ApiKeysTableSkeleton />
          </Table>
        </div>
      ) : useCases.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No API keys match the current filters
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Preset</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {useCases.map((uc) => (
                <TableRow key={uc.id}>
                  <TableCell className="font-medium">
                    <div>{uc.name}</div>
                    {(uc.description || uc.notes) && (
                      <details className="cursor-pointer mt-1">
                        <summary className="text-xs text-primary">
                          Details
                        </summary>
                        <div className="mt-1 text-xs text-muted-foreground space-y-1">
                          {uc.description && <p>{uc.description}</p>}
                          {uc.notes && <p className="italic">{uc.notes}</p>}
                        </div>
                      </details>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Key className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded truncate max-w-[200px]">
                        {visibleKeys[uc.id]
                          ? uc.api_key
                          : maskKey(uc.api_key)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleKeyVisibility(uc.id)}
                      >
                        {visibleKeys[uc.id] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopyKey(uc)}
                      >
                        {copiedKeyId === uc.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {uc.preset_name ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-accent text-accent-foreground">
                        <SlidersHorizontal className="h-3 w-3" />
                        {uc.preset_name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        None
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {uc.created_at
                      ? new Date(uc.created_at).toLocaleDateString()
                      : "—"}
                  </TableCell>

                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex justify-end gap-1">
                        <ApiKeyStatsPopover
                          ucId={uc.id}
                          statsCache={statsCache}
                          statsLoading={statsLoading}
                          loadStats={loadStats}
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenPresetDialog(uc)}
                            >
                              <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Change preset</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(uc)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit API key</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(uc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete API key</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination controls */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => goToPage(1)}
              disabled={pagination.page <= 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.total_pages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => goToPage(pagination.total_pages)}
              disabled={pagination.page >= pagination.total_pages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
