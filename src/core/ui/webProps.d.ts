import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    dataSet?: Readonly<Record<string, string>>;
  }
}
