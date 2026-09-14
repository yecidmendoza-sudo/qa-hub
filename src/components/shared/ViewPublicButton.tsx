import { Eye } from 'lucide-react';

interface ViewPublicButtonProps {
  /** Full URL to open in a new tab */
  url: string;
  label?: string;
  title?: string;
  /** 'sm' matches header buttons; 'xs' (default) matches list/table rows */
  size?: 'xs' | 'sm';
}

/**
 * Shared "Ver" button — opens a public (no-login) URL in a new tab.
 * Use this everywhere a public share link is needed to ensure visual consistency.
 */
export default function ViewPublicButton({
  url,
  label = 'Ver',
  title = 'Ver vista pública (sin login)',
  size = 'xs',
}: ViewPublicButtonProps) {
  const sizeClass = size === 'sm'
    ? 'px-3 py-2 text-sm gap-1.5'
    : 'px-3 py-1.5 text-xs gap-1.5';

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={title}
      className={`inline-flex items-center font-medium rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-all ${sizeClass}`}
    >
      <Eye className={iconSize} />
      {label}
    </a>
  );
}
