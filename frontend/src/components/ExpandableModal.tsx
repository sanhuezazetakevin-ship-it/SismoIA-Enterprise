import { useEffect, type ReactNode } from 'react';
import { X, Maximize2 } from 'lucide-react';

type ExpandableModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function ExpandableModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children
}: ExpandableModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="sismo-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="sismo-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sismo-modal-header">
          <div>
            <h2 className="sismo-modal-title">{title}</h2>
            {subtitle && <p className="sismo-modal-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="sismo-modal-close"
            onClick={onClose}
            aria-label="Cerrar vista ampliada"
          >
            <X size={18} />
          </button>
        </div>
        <div className="sismo-modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ExpandButton({ onClick, title = 'Ampliar gráfico' }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      className="expand-card-btn"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <Maximize2 size={13} />
    </button>
  );
}
