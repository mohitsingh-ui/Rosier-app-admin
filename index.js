// Network timeouts + one retry for flaky connections (must load before anything fetches).
import './src/lib/netPatch';
// Background notification check must be defined before the app starts (it also runs while the app is closed).
import './src/lib/backgroundTask';
import 'expo-router/entry';
