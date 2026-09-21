/** Shared interface icons, including Gadiruta's custom brand mark. */
import { Moon, Route, Sun, type LucideIcon } from 'lucide-react';

/** Available decorative symbols; accessible names belong to their surrounding controls. */
export type IconName = 'route' | 'gadiruta' | 'sun' | 'moon';

const iconComponents: Record<Exclude<IconName, 'gadiruta'>, LucideIcon> = {
  route: Route,
  sun: Sun,
  moon: Moon,
};

/** Properties shared by the custom mark and the imported decorative icons. */
interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
  strokeWidth?: number;
}

/** Render a decorative icon without taking over its surrounding accessible label. */
export function Icon({ name, className, size = 24, strokeWidth = 1.6 }: IconProps) {
  if (name === 'gadiruta') {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        viewBox="0 0 24 24"
        width={size}
      >
        <circle cx="6" cy="5" r="2" />
        <circle cx="6" cy="19" r="2" />
        <path d="M8 5h7a4 4 0 0 1 0 8h-5a4 4 0 0 0-4 4" />
      </svg>
    );
  }

  const IconComponent = iconComponents[name];
  return (
    <IconComponent
      aria-hidden="true"
      className={className}
      focusable="false"
      size={size}
      strokeWidth={strokeWidth}
    />
  );
}
