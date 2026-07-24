// theme.ts — palette transcribed from the app's colors.xml
export const theme = {
  red: '#f44336',        // colorPrimary
  redDark: '#d32f2f',    // colorPrimaryDark
  redDeep: '#dd2c00',    // colorAccent / HospitalRedder
  redIcon: '#b71c1c',    // IconColor / Red900
  redTint: '#fdecea',
  ink: '#1c1b1b',        // primaryTheme ~ de000000
  inkSoft: '#3B3A35',    // altblack
  muted: '#6b6b6b',      // secondaryTheme ~ 8a000000
  line: '#e5e5e5',       // divider / HospitalGray
  bg: '#f7f5f4',         // ~ HospitalLightGray
  surface: '#ffffff',
  ok: '#2e7d32',
  okTint: '#e9f3ea',
  warn: '#b25a00',
  warnTint: '#fbf0e3',
};
export type Theme = typeof theme;
