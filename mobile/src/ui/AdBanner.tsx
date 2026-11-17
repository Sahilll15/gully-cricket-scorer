import { useState } from "react";
import { View } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

// Test unit until EXPO_PUBLIC_ADMOB_BANNER_ID is set. Never place this on the live scoring screen.
const UNIT = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || TestIds.ADAPTIVE_BANNER;

/** One adaptive banner in the same spots as the web app's AdBox; collapses if no ad loads. */
export function AdBanner() {
  const [shown, setShown] = useState(true);
  const [width, setWidth] = useState(0);
  if (!shown) return null;
  // Adaptive banners default to the device width, which overflows padded pages, so size to the slot.
  return (
    <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ alignSelf: "stretch", alignItems: "center", marginVertical: 12, borderRadius: 16, overflow: "hidden" }}>
      {width > 0 && (
        <BannerAd unitId={UNIT} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} width={width}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }} onAdFailedToLoad={() => setShown(false)} />
      )}
    </View>
  );
}
