import type { SVGProps } from "react";

/**
 * Hand-drawn 24px line icons. Using local SVG keeps the bundle small and avoids
 * an icon dependency; every icon inherits `currentColor` and respects text size.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const WheatIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 21V8" />
    <path d="M12 11C8.5 10.3 6.6 8.2 6 5c3.5.3 5.5 2.3 6 6Z" />
    <path d="M12 15c3.5-.7 5.4-2.8 6-6-3.5.3-5.5 2.3-6 6Z" />
    <path d="M12 19c-2.9-.6-4.5-2.3-5-5 2.9.2 4.6 1.9 5 5Z" />
  </Svg>
);

export const SatelliteIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m7 7 3 3" />
    <path d="m14 14 3 3" />
    <path d="M9.5 4.5 4.5 9.5l3 3 5-5-3-3Z" />
    <path d="M19.5 14.5 14.5 19.5l-3-3 5-5 3 3Z" />
    <path d="m12 12 0 0" />
    <path d="M17 3a4 4 0 0 1 4 4" />
  </Svg>
);

export const DropIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3.5c3.2 3.8 6 7 6 10.2a6 6 0 0 1-12 0C6 10.5 8.8 7.3 12 3.5Z" />
    <path d="M9.5 14.2a2.6 2.6 0 0 0 2.5 2.6" />
  </Svg>
);

export const LeafIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 20c0-7.5 4.5-13 16-13 0 9-5.5 13-13 13H4Z" />
    <path d="M4 20c3-5 7-8.5 12-11" />
  </Svg>
);

export const ThermometerIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" />
    <path d="M12 9v7" />
  </Svg>
);

export const HumidityIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 14a4 4 0 1 0 8 0c0-2.5-2-4.8-4-7-2 2.2-4 4.5-4 7Z" />
    <path d="M4 8c0-1.7 1.3-3 3-3" />
    <path d="M4 4v2" />
  </Svg>
);

export const WindIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 8h11a3 3 0 1 0-3-3" />
    <path d="M3 12h16a3 3 0 1 1-3 3" />
    <path d="M3 16h6" />
  </Svg>
);

export const SunIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </Svg>
);

export const MoonIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Svg>
);

export const LanguagesIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 5h10M8 3v2M10.5 5c-.4 3.2-2.4 5.7-6 7.3" />
    <path d="M5 9.5c1.2 2.2 3 3.8 5.5 4.5" />
    <path d="m13 20 4-10 4 10M14.6 16.5h4.8" />
  </Svg>
);

export const RainIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 15a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 8.4 3.5 3.5 0 0 1 17 15H7Z" />
    <path d="M8 18v2M12 18v2M16 18v2" />
  </Svg>
);

export const SoilIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 17c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
    <path d="M3 13c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
    <path d="M8 9c1-3 2.5-5 4-7 1.5 2 3 4 4 7" />
  </Svg>
);

export const GaugeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 18a8.5 8.5 0 1 1 15 0" />
    <path d="m12 14 4-5" />
    <circle cx="12" cy="15" r="1.4" />
  </Svg>
);

export const SparkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    <path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8L18 16Z" />
  </Svg>
);

export const MapPinIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);

export const InfoIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);

export const AlertIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 4 2.8 20h18.4L12 4Z" />
    <path d="M12 9v5M12 17h.01" />
  </Svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </Svg>
);

export const MenuIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const CloseIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const SearchIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m16.5 16.5 4 4" />
  </Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m4 12.5 5 5L20 6.5" />
  </Svg>
);

export const DatabaseIcon = (props: IconProps) => (
  <Svg {...props}>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
    <path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13" />
    <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
  </Svg>
);

export const CpuIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    <rect x="10" y="10" width="4" height="4" rx="0.5" />
  </Svg>
);

export const LayersIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 16 9 5 9-5" />
  </Svg>
);

export const SendIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M21 3 10.5 13.5" />
    <path d="M21 3l-6.5 18-4-8-8-4L21 3Z" />
  </Svg>
);

export const RefreshIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 11a8 8 0 0 0-14.7-3M4 13a8 8 0 0 0 14.7 3" />
    <path d="M20 4v7h-7M4 20v-7h7" />
  </Svg>
);

export const TrashIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    <path d="M10 11v5M14 11v5" />
  </Svg>
);

export const PlusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ExternalLinkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);

export const TrendUpIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m4 16 6-6 4 4 6-7" />
    <path d="M15 7h5v5" />
  </Svg>
);

export const TrendDownIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m4 8 6 6 4-4 6 7" />
    <path d="M15 17h5v-5" />
  </Svg>
);
