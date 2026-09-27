import { Button } from '../../../components/ui/button';

export function PetFoodCreationControls({
  onCreateFood,
}: {
  onCreateFood: (appearanceId?: string) => void;
}) {
  return (
    <>
      <Button
        data-desktop-pet-interactive="true"
        data-desktop-pet-window-shape="true"
        data-desktop-pet-window-shape-padding="4"
        data-desktop-pet-native-scope="activity-region"
        type="button"
        variant="outline"
        className="pointer-events-auto h-6 rounded-sm border-[#2F80ED]/70 bg-transparent px-2 text-[9px] text-[#2F80ED] hover:bg-[#2F80ED]/10"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onCreateFood()}
      >
        创建道具
      </Button>
    </>
  );
}
