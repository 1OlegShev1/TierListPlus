import { ItemSourceModal } from "@/components/items/source-modal/ItemSourceModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { TemplateItemData } from "@/types";

export interface ListEditorSourceModalSavePayload {
  itemLabel?: string | null;
  resolvedImageUrl?: string | null;
  resolvedTitle?: string | null;
  sourceEndSec: number | null;
  sourceNote: string | null;
  sourceStartSec: number | null;
  sourceUrl: string | null;
}

interface ListEditorDialogsProps {
  addByUrlSourceError: string | null;
  addingByUrl: boolean;
  editingSourceItem: TemplateItemData | null;
  onCancelDraftChoice: (choice: "discard" | "keep") => void;
  onCloseAddByUrl: () => void;
  onCloseEditingSource: () => void;
  onSaveAddByUrl: (payload: ListEditorSourceModalSavePayload) => Promise<boolean>;
  onSaveEditingSource: (payload: ListEditorSourceModalSavePayload) => Promise<boolean>;
  showAddByUrlSourceModal: boolean;
  showCancelDraftDialog: boolean;
}

export function ListEditorDialogs({
  addByUrlSourceError,
  addingByUrl,
  editingSourceItem,
  onCancelDraftChoice,
  onCloseAddByUrl,
  onCloseEditingSource,
  onSaveAddByUrl,
  onSaveEditingSource,
  showAddByUrlSourceModal,
  showCancelDraftDialog,
}: ListEditorDialogsProps) {
  return (
    <>
      {editingSourceItem && (
        <ItemSourceModal
          open
          itemLabel={editingSourceItem.label || "Untitled item"}
          itemImageUrl={editingSourceItem.imageUrl}
          sourceUrl={editingSourceItem.sourceUrl}
          sourceProvider={editingSourceItem.sourceProvider}
          sourceNote={editingSourceItem.sourceNote}
          sourceStartSec={editingSourceItem.sourceStartSec}
          sourceEndSec={editingSourceItem.sourceEndSec}
          editable
          onClose={onCloseEditingSource}
          onSave={onSaveEditingSource}
        />
      )}

      {showAddByUrlSourceModal && (
        <ItemSourceModal
          open
          mode="CREATE_FROM_URL"
          itemLabel="New item"
          itemImageUrl={null}
          sourceUrl={null}
          sourceProvider={null}
          sourceNote={null}
          sourceStartSec={null}
          sourceEndSec={null}
          editable
          saving={addingByUrl}
          error={addByUrlSourceError}
          onClose={onCloseAddByUrl}
          onSave={onSaveAddByUrl}
        />
      )}

      <ConfirmDialog
        open={showCancelDraftDialog}
        title="Leave with an unsaved draft?"
        description="Select Cancel to keep your draft and leave this page, or choose Discard draft and leave to remove it."
        confirmLabel="Discard draft and leave"
        confirmVariant="danger"
        onConfirm={() => onCancelDraftChoice("discard")}
        onCancel={() => onCancelDraftChoice("keep")}
      />
    </>
  );
}
