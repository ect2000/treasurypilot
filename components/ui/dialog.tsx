"use client";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Inspector({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="dialog-overlay" />
        <Primitive.Content className="inspector">
          <Primitive.Close
            className="icon-button inspector-close"
            aria-label="Close inspector"
          >
            <X size={20} />
          </Primitive.Close>
          <div className="section-kicker">DECISION INSPECTOR</div>
          <Primitive.Title className="inspector-title">{title}</Primitive.Title>
          <Primitive.Description className="inspector-description">
            {description}
          </Primitive.Description>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
