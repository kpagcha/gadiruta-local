/** Shared interface icons, including Gadiruta's custom brand mark. */
import {
  ArrowRight,
  BusFront,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  Map,
  MapPin,
  Moon,
  Route,
  Search,
  Ship,
  Sun,
  TrainFront,
  TramFront,
  X,
  type LucideIcon,
} from 'lucide-react';

/** Available decorative symbols; accessible names belong to their surrounding controls. */
export type IconName =
  | 'route'
  | 'arrow'
  | 'bus'
  | 'train'
  | 'tram'
  | 'boat'
  | 'place'
  | 'stop'
  | 'gadiruta'
  | 'sun'
  | 'moon'
  | 'search'
  | 'clock'
  | 'calendar'
  | 'chevronLeft'
  | 'chevronDown'
  | 'chevronRight'
  | 'close';

const iconComponents: Record<Exclude<IconName, 'gadiruta'>, LucideIcon> = {
  route: Route,
  arrow: ArrowRight,
  bus: BusFront,
  train: TrainFront,
  tram: TramFront,
  boat: Ship,
  place: Map,
  stop: MapPin,
  sun: Sun,
  moon: Moon,
  search: Search,
  clock: Clock3,
  calendar: CalendarDays,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  close: X,
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
    // The brand mark is a small local SVG; the remaining names delegate to the icon library.
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

  // TypeScript narrows `name` here, so it is safe to index the library-icon map.
  const IconComponent = iconComponents[name];
  return (
    <IconComponent aria-hidden="true" className={className} focusable="false" size={size} strokeWidth={strokeWidth} />
  );
}
