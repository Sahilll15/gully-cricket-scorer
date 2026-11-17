const { withAppBuildGradle } = require("expo/config-plugins");

// Signs release builds with the upload key when GULLY_UPLOAD_STORE_FILE and GULLY_UPLOAD_KEY_PASSWORD are set.
// Without them, release falls back to the debug key so local test builds still work.
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (c) => {
    let g = c.modResults.contents;
    if (g.includes("gullyUpload")) return c;
    g = g.replace(/signingConfigs \{\n/, `signingConfigs {
        gullyUpload {
            def f = System.getenv("GULLY_UPLOAD_STORE_FILE")
            if (f) {
                storeFile file(f)
                storePassword System.getenv("GULLY_UPLOAD_KEY_PASSWORD")
                keyAlias "upload"
                keyPassword System.getenv("GULLY_UPLOAD_KEY_PASSWORD")
            }
        }
`);
    g = g.replace(/(release \{[\s\S]*?)signingConfig signingConfigs\.debug/, `$1signingConfig System.getenv("GULLY_UPLOAD_STORE_FILE") ? signingConfigs.gullyUpload : signingConfigs.debug`);
    c.modResults.contents = g;
    return c;
  });
};
