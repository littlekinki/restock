import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="shop" options={{ title: 'Restock Shop' }} />
      <Stack.Screen name="distributor" options={{ title: 'Restock Distributor' }} />
      <Stack.Screen name="rider" options={{ title: 'Restock Rider' }} />
    </Stack>
  );
}
