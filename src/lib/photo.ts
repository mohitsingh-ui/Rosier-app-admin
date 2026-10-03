import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { toast } from '../components/Toast';
import { useApp } from '../store/app';

/** Let the customer pick or take a profile photo and keep a private copy of it. */
export async function choosePhoto(source: 'camera' | 'library') {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    toast(source === 'camera' ? 'Allow camera access in Settings to take a photo' : 'Allow photo access in Settings to choose a photo', 'info');
    return;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return;
  let uri = res.assets[0].uri;

  if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
    const dest = `${FileSystem.documentDirectory}avatar-${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      const old = useApp.getState().photo;
      if (old?.startsWith(FileSystem.documentDirectory)) FileSystem.deleteAsync(old, { idempotent: true }).catch(() => {});
      uri = dest;
    } catch {
      // Fall back to the picker's copy.
    }
  }
  useApp.getState().setPhoto(uri);
  toast('Looking good! Photo updated');
}

export function removePhoto() {
  const old = useApp.getState().photo;
  if (old && FileSystem.documentDirectory && old.startsWith(FileSystem.documentDirectory)) {
    FileSystem.deleteAsync(old, { idempotent: true }).catch(() => {});
  }
  useApp.getState().setPhoto(null);
}
