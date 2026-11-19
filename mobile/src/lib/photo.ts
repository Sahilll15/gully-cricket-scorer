import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { PHOTO_SIZE, validPhoto } from "@shared/photo";

/** Gallery picker with a square crop, then shrunk to a small JPEG data URL. Null if cancelled or unreadable. */
export async function pickPhoto(): Promise<string | null> {
  try {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (r.canceled || !r.assets[0]) return null;
    const out = await manipulateAsync(r.assets[0].uri, [{ resize: { width: PHOTO_SIZE, height: PHOTO_SIZE } }], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
    const url = out.base64 ? `data:image/jpeg;base64,${out.base64}` : "";
    return validPhoto(url) ? url : null;
  } catch { return null; }
}
