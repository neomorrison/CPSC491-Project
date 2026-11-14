declare module '*.svg' {
  import type { ComponentType } from 'react';
  import type { SvgProps } from 'react-native-svg';

  const component: ComponentType<SvgProps>;
  export default component;
}