import { StyleSheet, Text, type TextProps } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        // Centralize the Font Family here for all types
        { fontFamily: 'Inter-Regular' }, 
        type === 'default' ? styles.default : undefined,
        type === 'title' ? [styles.title, { fontFamily: 'Inter-Bold' }] : undefined,
        type === 'defaultSemiBold' ? [styles.defaultSemiBold, { fontFamily: 'Inter-SemiBold' }] : undefined,
        type === 'subtitle' ? [styles.subtitle, { fontFamily: 'Inter-SemiBold' }] : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 24 },
  defaultSemiBold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: 'bold', lineHeight: 32 },
  subtitle: { fontSize: 20, fontWeight: 'bold' },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#2D6CDF', // Your DriverPro Royal Blue
    textDecorationLine: 'underline',
  },
});