# The local Android toolchain (Windows)

Written 2026-08-25, while packaging the TWA. This is the machine-local setup
that `bubblewrap` needs. None of it is committed — `android-tools/` is
gitignored — so this file is how it gets rebuilt.

Everything lives in **`S:\Coding\Dumpling\android-tools\`**:

```
android-tools/
  jdk/            Temurin JDK 17 (bubblewrap rejects anything else)
  android-sdk/    build-tools, platforms, platform-tools, cmdline-tools
  downloads/      the two zips, kept so a rebuild needs no network
```

`~/.bubblewrap/config.json` points at them, with **forward slashes**:

```json
{
  "jdkPath": "S:/Coding/Dumpling/android-tools/jdk",
  "androidSdkPath": "S:/Coding/Dumpling/android-tools/android-sdk"
}
```

Backslashes need doubling in JSON, and a single `\C` is an invalid escape that
makes the file silently unparseable. Forward slashes work fine on Windows.

## Rebuilding it from scratch

```bash
# JDK 17 (bubblewrap refuses 19, 21, anything but 17)
curl -L -o jdk17.zip "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"

# Android command line tools -> android-sdk/cmdline-tools/latest/
curl -L -o cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"

# then, with JAVA_HOME pointing at the JDK above:
sdkmanager --sdk_root=<sdk> --licenses
sdkmanager --sdk_root=<sdk> platform-tools "build-tools;36.1.0" "platforms;android-36"
```

## Three traps, all of which cost time

### 1. `build-tools;36.1.0` exactly

`@bubblewrap/core` hardcodes `BUILD_TOOLS_VERSION = '36.1.0'` and checks for
that exact directory. Installing `36.0.0` is not close enough — it fails with
a generic error that does not name the version. Check the constant in
`@bubblewrap/core/dist/lib/androidSdk/AndroidSdkTools.js` when bumping.

### 2. The empty `android-sdk/bin/` folder is load-bearing

`AndroidSdkTools.validatePath()` requires `<sdk>/tools` **or** `<sdk>/bin` to
exist — the pre-2020 SDK layout. A correct modern install has neither (they
live under `cmdline-tools/latest/`), so validation fails on a perfectly good
SDK with:

> ERROR The provided androidSdk isn't correct.

The fix is an empty `<sdk>/bin/` directory. Bubblewrap never reads from it; it
only ever touches `build-tools/36.1.0/` and `platform-tools/adb`. There is a
`README.txt` inside saying so. **Do not "clean up" that folder.**

### 3. `NoDefaultCurrentDirectoryInExePath=1` breaks the Gradle call

This environment sets that variable, which tells `cmd.exe` *not* to search the
current directory for executables. Bubblewrap shells out to bare
`gradlew.bat` (no `.\` prefix), so the build dies with:

> 'gradlew.bat' is not recognized as an internal or external command

Gradle is fine — `.\gradlew.bat --version` works. **Unset the variable for the
build:**

```bash
unset NoDefaultCurrentDirectoryInExePath
export JAVA_HOME="S:/Coding/Dumpling/android-tools/jdk"
export PATH="$JAVA_HOME/bin:$PATH"
cd android && npx @bubblewrap/cli build --manifest ./twa-manifest.json
```

## Why the project is generated from a hand-written twa-manifest.json

`bubblewrap init` is interactive only — no flags for the answers. Instead
`android/twa-manifest.json` is committed and the project is regenerated with:

```bash
npx @bubblewrap/cli update --manifest ./twa-manifest.json --skipVersionUpgrade
```

Every choice is then reviewable in a diff instead of buried in prompt answers.
Without `--skipVersionUpgrade` it **prompts** for a version name and bumps
`appVersionCode`; piping input or passing the flag are the only ways to keep a
regeneration deterministic.
