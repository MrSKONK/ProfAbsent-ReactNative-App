import React from 'react';
import { Stack } from 'expo-router';

export default function RequestsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="all" />
      <Stack.Screen name="recap" />
    </Stack>
  );
}
