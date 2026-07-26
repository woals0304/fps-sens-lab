import { useId, type ReactNode } from 'react';

interface ExpandableDetailSectionProps {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function ExpandableDetailSection({
  title,
  description,
  open,
  onToggle,
  children,
}: ExpandableDetailSectionProps): JSX.Element {
  const titleId = useId();
  const contentId = useId();

  return (
    <section className="panel-card detail-section" aria-labelledby={titleId}>
      <div className="detail-section-header">
        <div>
          <h3 id={titleId}>{title}</h3>
          {description ? <p className="muted-text">{description}</p> : null}
        </div>

        <button
          type="button"
          className="secondary-button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggle}
        >
          {open ? '접기' : '펼쳐 보기'}
        </button>
      </div>

      {open ? (
        <div id={contentId} className="detail-section-body" role="region" aria-labelledby={titleId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
