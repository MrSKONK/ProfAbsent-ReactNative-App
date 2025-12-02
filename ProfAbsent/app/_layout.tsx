import React from "react";
import { Stack } from "expo-router";
import { useNotifications } from "../utils/useNotifications";

export default function RootLayout() {
  // Initialiser les notifications push
  useNotifications();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="diagnostic" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="manager" />
    </Stack>
  );
}
