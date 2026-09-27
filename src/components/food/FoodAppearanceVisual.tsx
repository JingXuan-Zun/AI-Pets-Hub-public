import { Folder as FolderIcon } from 'lucide-react';
import { type FoodAppearance } from '../../types';

interface FoodAppearanceVisualProps {
  appearance?: FoodAppearance | null;
  className?: string;
  imageClassName?: string;
  iconClassName?: string;
}

export function FoodAppearanceVisual({
  appearance = null,
  className = 'flex h-12 w-12 items-center justify-center rounded border border-primary/20 bg-primary/10',
  imageClassName = 'h-11 w-11 object-contain',
  iconClassName = 'h-6 w-6 text-primary',
}: FoodAppearanceVisualProps) {
  return (
    <div className={className}>
      {appearance ? (
        <img
          src={appearance.imageUrl}
          alt={appearance.name}
          className={imageClassName}
          draggable={false}
        />
      ) : (
        <FolderIcon className={iconClassName} />
      )}
    </div>
  );
}
