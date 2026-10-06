"use client";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef } from "react";
export function Inspector({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  variant?: "governor";
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="dialog-overlay" />
        <Primitive.Content
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
          className={`inspector ${variant === "governor" ? "g-inspector" : ""}`}
        >
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
