import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X } from "lucide-react";

import { useApiKeys } from "@/hooks/useApiKeys";
import { ApiKeysTable } from "@/components/api-keys/ApiKeysTable";
import { ApiKeyFormDialog } from "@/components/api-keys/ApiKeyFormDialog";
import { ChangePresetDialog } from "@/components/api-keys/ChangePresetDialog";

export default function KeyCasesPage() {
  const k = useApiKeys();

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">API Keys</h2>

        <ApiKeyFormDialog
          open={k.open}
          setOpen={k.setOpen}
          editing={k.editing}
          formData={k.formData}
          setFormData={k.setFormData}
          originalFormData={k.originalFormData}
          submitting={k.submitting}
          handleSubmit={k.handleSubmit}
          resetForm={k.resetForm}
          presets={k.presets}
          presetCreateOpen={k.presetCreateOpen}
          setPresetCreateOpen={k.setPresetCreateOpen}
          presetFormData={k.presetFormData}
          setPresetFormData={k.setPresetFormData}
          presetCreateLoading={k.presetCreateLoading}
          handlePresetCreate={k.handlePresetCreate}
          rateLimits={k.rateLimits}
          ipAllowlists={k.ipAllowlists}
          ipBlocklists={k.ipBlocklists}
          presetProjects={k.presetProjects}
        />
      </div>

      {/* Filter Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Name or description…"
                value={k.filters.search}
                onChange={(e) =>
                  k.setFilters({ ...k.filters, search: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Preset</Label>
              <Select
                value={k.filters.preset_id}
                onValueChange={(v) =>
                  k.setFilters({
                    ...k.filters,
                    preset_id: v === "all" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All presets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All presets</SelectItem>
                  {k.presets.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              {k.hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={k.clearFilters}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </div>
            <div className="flex items-end justify-end">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Per page
                </Label>
                <Select
                  value={k.pagination.per_page.toString()}
                  onValueChange={k.handlePerPageChange}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            {k.pagination.total.toLocaleString()} total entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeysTable
            useCases={k.useCases}
            loading={k.loading}
            pagination={k.pagination}
            visibleKeys={k.visibleKeys}
            toggleKeyVisibility={k.toggleKeyVisibility}
            copiedKeyId={k.copiedKeyId}
            handleCopyKey={k.handleCopyKey}
            maskKey={k.maskKey}
            statsCache={k.statsCache}
            statsLoading={k.statsLoading}
            loadStats={k.loadStats}
            handleOpenPresetDialog={k.handleOpenPresetDialog}
            handleEdit={k.handleEdit}
            handleDelete={k.handleDelete}
            goToPage={k.goToPage}
            handlePerPageChange={k.handlePerPageChange}
          />
        </CardContent>
      </Card>

      {/* Change Preset Dialog */}
      <ChangePresetDialog
        open={k.presetDialogOpen}
        onOpenChange={k.setPresetDialogOpen}
        useCase={k.presetDialogUseCase}
        value={k.presetDialogValue}
        onValueChange={k.setPresetDialogValue}
        loading={k.presetDialogLoading}
        presets={k.presets}
        onConfirm={k.handlePresetChange}
        onReset={() => {
          k.setPresetDialogUseCase(null);
          k.setPresetDialogValue("");
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={k.deleteDialogOpen}
        onOpenChange={(open) => {
          k.setDeleteDialogOpen(open);
          if (!open) {
            k.setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? This will
              permanently remove the use case and its API key. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={k.confirmDelete}
              disabled={k.submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <AlertDialog open={k.errorDialogOpen} onOpenChange={k.setErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{k.errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => k.setErrorDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
