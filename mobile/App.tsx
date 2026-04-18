import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SpreadsheetScreen } from './src/components/SpreadsheetScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <SpreadsheetScreen />
    </SafeAreaProvider>
  );
}
