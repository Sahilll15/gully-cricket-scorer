import { ActivityIndicator, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Press, Txt, tw } from "./ui";

/** Google's own "G", which the brand rules say must stay in its four colours. */
export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/** "Continue with Google" in Google's dark theme, which suits the app's dark sheets. */
export function GoogleButton({ onPress, busy }: { onPress: () => void; busy?: boolean }) {
  return (
    <Press onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel="Continue with Google"
      style={[tw`min-h-14 flex-row items-center justify-center gap-3 rounded-2xl border px-4`, { backgroundColor: "#131314", borderColor: "#8E918F" }]}>
      <View style={tw`h-5 w-5 items-center justify-center`}>{busy ? <ActivityIndicator size="small" color="#E3E3E3" /> : <GoogleG />}</View>
      <Txt style={[tw`text-[15px] font-medium`, { color: "#E3E3E3" }]}>Continue with Google</Txt>
    </Press>
  );
}

/** The line between the Google button and the phone form. */
export function OrDivider({ label }: { label: string }) {
  return (
    <View style={tw`my-5 flex-row items-center gap-3`}>
      <View style={tw`h-px flex-1 bg-line`} />
      <Txt style={tw`text-xs text-mute`}>{label}</Txt>
      <View style={tw`h-px flex-1 bg-line`} />
    </View>
  );
}
