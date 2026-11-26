#!/usr/bin/env bash
# Adds the permissions the app needs (camera for barcode scanning, vibrate for scan feedback)
# to the generated Capacitor Android project. Safe to run more than once.
set -euo pipefail
M="android/app/src/main/AndroidManifest.xml"
[ -f "$M" ] || { echo "Run 'npx cap add android' first"; exit 1; }
add() { grep -q "$1" "$M" || sed -i "s#<application#$2\n    <application#" "$M"; }
add 'android.permission.CAMERA' '    <uses-permission android:name="android.permission.CAMERA" />'
add 'android.permission.VIBRATE' '    <uses-permission android:name="android.permission.VIBRATE" />'
add 'android.hardware.camera"' '    <uses-feature android:name="android.hardware.camera" android:required="false" />'
grep -q 'android.permission.INTERNET' "$M" || sed -i "s#<application#    <uses-permission android:name=\"android.permission.INTERNET\" />\n    <application#" "$M"
echo "Manifest ready:"; grep -E 'uses-(permission|feature)' "$M"
