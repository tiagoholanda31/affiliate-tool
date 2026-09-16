"use client";

import { FileImage, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data-display/status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deleteMaterialAction, setMaterialActiveAction } from "@/features/materials/actions";
import {
  MaterialForm,
  type MaterialFormInitial,
  type MaterialFormProduct,
} from "@/features/materials/components/material-form";
import type { AdminMaterialListItem } from "@/features/materials/types";
import { labelFor } from "@/lib/i18n/pt-BR";

type MaterialsAdminClientProps = {
  items: AdminMaterialListItem[];
  products: MaterialFormProduct[];
  /** Detalhe completo para edição (id → dados). */
  details: Record<string, MaterialFormInitial>;
};

export function MaterialsAdminClient({
  items,
  products,
  details,
}: MaterialsAdminClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialFormInitial | undefined>();
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(undefined);
    setOpen(true);
  }

  function openEdit(id: string) {
    const detail = details[id];
    if (!detail) {
      toast.error("Não foi possível carregar o material.");
      return;
    }
    setEditing(detail);
    setOpen(true);
  }

  function onDone() {
    setOpen(false);
    setEditing(undefined);
    router.refresh();
  }

  function toggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      const result = await setMaterialActiveAction({ id, isActive: !isActive });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "Material inativado." : "Material ativado.");
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          Novo material
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FileImage}
          title="Nenhum material cadastrado"
          description="Cadastre imagens, PDFs, textos com {{link}} ou links externos para os afiliados."
          action={
            <Button type="button" onClick={openCreate}>
              Cadastrar material
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-mist-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-mist-200 bg-mist-50 text-xs uppercase tracking-wide text-navy-700">
              <tr>
                <th className="px-3 py-2 font-medium">Material</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Produto</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Ordem</th>
                <th className="px-3 py-2 font-medium">Downloads</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-mist-100 last:border-0">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      {item.thumbPath ? (
                        // eslint-disable-next-line @next/next/no-img-element -- thumb autenticado via API
                        <img
                          src={`/api/materials/${item.id}/thumb`}
                          alt=""
                          className="size-12 rounded object-cover"
                        />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded bg-mist-100 text-navy-600">
                          <FileImage className="size-5" aria-hidden />
                        </div>
                      )}
                      <span className="font-medium text-navy-900">{item.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">{labelFor("materialType", item.type)}</td>
                  <td className="px-3 py-3 text-navy-700">{item.productName ?? "Geral"}</td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      label={item.isActive ? "Ativo" : "Inativo"}
                      tone={item.isActive ? "success" : "neutral"}
                    />
                  </td>
                  <td className="px-3 py-3 tabular-nums">{item.sortOrder}</td>
                  <td className="px-3 py-3 tabular-nums">{item.downloadCount}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          openEdit(item.id);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          toggleActive(item.id, item.isActive);
                        }}
                      >
                        {item.isActive ? "Inativar" : "Ativar"}
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button type="button" variant="ghost" size="sm">
                            Excluir
                          </Button>
                        }
                        title="Excluir material?"
                        description={
                          <>
                            Isso remove o material e o arquivo do storage. Digite{" "}
                            <strong>{item.title}</strong> para confirmar.
                          </>
                        }
                        variant="destructive"
                        typeToConfirm={item.title}
                        confirmLabel="Excluir"
                        onConfirm={async () => {
                          const result = await deleteMaterialAction({
                            id: item.id,
                            confirmTitle: item.title,
                          });
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("Material excluído.");
                          router.refresh();
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar material" : "Novo material"}</SheetTitle>
            <SheetDescription>
              Imagens e PDFs ficam disponíveis para download autenticado. Textos usam{" "}
              {"{{link}}"}.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 px-1 pb-6">
            <MaterialForm
              mode={editing ? "edit" : "create"}
              products={products}
              initial={editing}
              onDone={onDone}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
