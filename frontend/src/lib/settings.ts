export interface UserSettings {
  fontFamily: string;
  iconLibrary: string;
  borderRadius: number;
  // Color settings
  primary: string;
  secondary: string;
  accent: string;
  destructive: string;
  muted: string;
  // Other settings
  fontSize: 'small' | 'medium' | 'large';
  timezone?: string; // IANA timezone name (e.g., 'America/New_York', 'Europe/London')
}

export const DEFAULT_SETTINGS: UserSettings = {
  fontFamily: 'JetBrains Mono',
  iconLibrary: 'lucide',
  borderRadius: 0,
  primary: '262.1 83.3% 57.8%',
  secondary: '240 4.8% 95.9%',
  accent: '240 4.8% 95.9%',
  destructive: '0 84.2% 60.2%',
  muted: '240 4.8% 95.9%',
  fontSize: 'medium',
};

export function applySettings(newSettings: UserSettings) {
  const root = document.documentElement;

  // Load font if needed (for Google Fonts)
  // Always load fonts, including system fonts might need special handling
  const fontName = newSettings.fontFamily.replace(/\s+/g, '+');
  const linkId = 'dynamic-font-link';
  let link = document.getElementById(linkId) as HTMLLinkElement;
  
  if (newSettings.fontFamily === 'system-ui') {
    // Remove Google Fonts link if using system font
    if (link) {
      link.remove();
    }
  } else if (newSettings.fontFamily !== 'JetBrains Mono') {
    // Load Google Fonts for non-system fonts
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`;
  } else {
    // For JetBrains Mono, we might want to load it from Google Fonts or CDN
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap`;
  }

  // Apply font globally using CSS variable
  const fontFamilyValue = `"${newSettings.fontFamily}", system-ui, sans-serif`;
  root.style.setProperty('--font-family', fontFamilyValue);
  
  // Also apply directly to html and body for immediate effect
  document.documentElement.style.fontFamily = fontFamilyValue;
  document.body.style.fontFamily = fontFamilyValue;

  // Apply border radius
  root.style.setProperty('--radius', `${newSettings.borderRadius}px`);

  // Apply colors - apply to both light and dark mode
  root.style.setProperty('--primary', newSettings.primary);
  root.style.setProperty('--secondary', newSettings.secondary);
  root.style.setProperty('--accent', newSettings.accent);
  root.style.setProperty('--destructive', newSettings.destructive);
  root.style.setProperty('--muted', newSettings.muted);

  // Apply font size
  const fontSizeMap = {
    small: '14px',
    medium: '16px',
    large: '18px',
  };
  root.style.setProperty('--base-font-size', fontSizeMap[newSettings.fontSize]);
  document.body.style.fontSize = fontSizeMap[newSettings.fontSize];
}

export function loadSettingsFromStorage(): UserSettings {
  const saved = localStorage.getItem('key-userSettings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      console.error('Failed to load settings:', e);
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export function applySettingsFromStorage() {
  const settings = loadSettingsFromStorage();
  applySettings(settings);
}
