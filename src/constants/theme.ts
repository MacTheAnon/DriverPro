import { Platform } from 'react-native';

// Professional DriverPro Color Palette
const primaryBlue = '#2D6CDF'; // Your main brand color
const darkBackground = '#121212'; // True dark mode background
const cardGrey = '#1E1E1E'; // For buttons/cards

export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    tint: primaryBlue,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: primaryBlue,
  },
  dark: {
    text: '#FFFFFF',
    background: darkBackground,
    tint: primaryBlue,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: primaryBlue,
    card: cardGrey,
    border: '#333333',
    success: '#4CAF50', // For verified documents
    error: '#FF5252',   // For failed tracking
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    mono: 'Courier',
    bold: 'HelveticaNeue-Bold',
  },
  android: {
    sans: 'sans-serif',
    mono: 'monospace',
    bold: 'sans-serif-condensed',
  },
  default: {
    sans: 'normal',
    mono: 'monospace',
  },
});