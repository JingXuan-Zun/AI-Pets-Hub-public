import { type DesktopPetSlot } from '../../../multiPetRoster';

/** 招呼语的第一句，当作角色签名。 */
export function resolveHubSignature(greeting: string) {
  const firstLine = greeting.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? '';
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

/** 角色头像：有聊天头像用图片，没有就用名字首字。 */
export function HubAvatar({ slot, name, className }: { slot: DesktopPetSlot | null; name: string; className: string }) {
  const avatarUrl = slot?.personality.chatAvatarUrl?.trim();
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 font-bold text-primary ${className}`}>
      {avatarUrl
        ? <img alt="" src={avatarUrl} className="h-full w-full object-cover" draggable={false} />
        : (name.trim().slice(0, 1) || '宠')}
    </span>
  );
}
