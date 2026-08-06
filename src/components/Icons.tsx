/**
 * Inline SVG icons.
 *
 * Bundled as components rather than pulled from an icon package: the app ships
 * with only react, react-dom and react-router-dom as dependencies, and these
 * also have to render with no network access.
 */

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const PlaneIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.7.7 0 0 0-.7 1.1l3.4 3.4-2.3 2.3-1.9-.4a.6.6 0 0 0-.6 1l2 2 2 2a.6.6 0 0 0 1-.6l-.4-1.9 2.3-2.3 3.4 3.4a.7.7 0 0 0 1.1-.7Z" />
  </svg>
);

export const SendIcon = ({ size = 17, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

export const ArrowDownIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);

export const CheckIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const AlertIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const ShieldIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z" />
  </svg>
);

export const BookIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </svg>
);

export const SearchIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const LayersIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m12 2 9 5-9 5-9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 17 9 5 9-5" />
  </svg>
);

export const ActivityIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

export const UploadIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </svg>
);

export const PlusIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const LogoutIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const SparkIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ToolIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3Z" />
    <path d="M18 2.5 21.5 6" />
  </svg>
);

export const UsersIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
    <path d="M16 3.1a4 4 0 0 1 0 7.8" />
  </svg>
);

export const SunIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />
  </svg>
);

export const MicIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
  </svg>
);

export const VolumeIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M11 5 6 9H2v6h4l5 4Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

export const CopyIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);

export const StopIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const ThumbsUpIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M7 10v11H3V10ZM7 19h10.2a2 2 0 0 0 2-1.6l1.3-6A2 2 0 0 0 18.5 9H14l.7-3.4A2.2 2.2 0 0 0 12.5 3L7 10Z" />
  </svg>
);

export const ThumbsDownIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M17 14V3h4v11ZM17 5H6.8a2 2 0 0 0-2 1.6l-1.3 6A2 2 0 0 0 5.5 15H10l-.7 3.4a2.2 2.2 0 0 0 2.2 2.6L17 14Z" />
  </svg>
);

export const MenuIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const SidebarIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2.2" />
    <path d="M9 4v16" />
  </svg>
);

export const PanelRightIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2.2" />
    <path d="M15 4v16" />
  </svg>
);

export const CloseIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const TrashIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M9 11v6M15 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
  </svg>
);

export const MoreIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);
