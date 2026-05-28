import { Stack } from 'expo-router';

// Stack navigator for the auth route group. Header off — each auth screen
// renders its own nav row.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
