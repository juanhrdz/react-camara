import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { setupAppCheck } from '../services/appCheckService';
import { getDatabase } from '../services/dbService';

export default function RootLayout() {
  useEffect(() => {
    setupAppCheck();
    try {
      getDatabase();
    } catch (e) {
      console.error('Error al inicializar SQLite:', e);
    }
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1E40AF' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: '#F8FAFC' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'FotoApuntes IA' }} />
      <Stack.Screen name="resumen" options={{ title: 'Resumen del Apunte' }} />
      <Stack.Screen name="quiz" options={{ title: 'Quiz de Autoevaluación' }} />
      <Stack.Screen name="historial" options={{ title: 'Historial de Apuntes' }} />
    </Stack>
  );
}
