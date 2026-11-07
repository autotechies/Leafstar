"use client";

import { useId } from "react";
import { Modal } from "@/components/ui/Modal";
import type { PublicArticle } from "../data";
import { RequestForm } from "./RequestForm";

export function RequestPriceModal({ article, colourId, whatsapp, open, onClose }: { article: PublicArticle; colourId: string | null; whatsapp: string | null; open: boolean; onClose: () => void }) {
  const formId = useId();
  return (
    <Modal open={open} onClose={onClose} title="Request price" description={`${article.name} · ${article.code}`}>
      {open ? (
        <RequestForm
          formId={formId}
          endpoint="/api/leads"
          whatsapp={whatsapp}
          askQuantity
          onDone={onClose}
          targets={[{ articleId: article.id, colourId, quantity: null, code: article.code, name: article.name, moq: article.moq }]}
        />
      ) : null}
    </Modal>
  );
}
