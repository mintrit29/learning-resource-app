// Only ScholarFlow's top-level search page may request microphone audio.
function allowSearchMicrophone({ permission, sameWindow, pageUrl, requestingUrl, serverUrl, isMainFrame, mediaTypes }) {
  if (permission !== "media" || !sameWindow || isMainFrame !== true
    || !Array.isArray(mediaTypes) || mediaTypes.length !== 1 || mediaTypes[0] !== "audio") return false;
  try {
    const base = new URL(serverUrl);
    const page = new URL(pageUrl);
    const requester = new URL(requestingUrl);
    return base.hostname === "127.0.0.1" && base.protocol === "http:"
      && page.origin === base.origin && requester.origin === base.origin
      && page.pathname === "/search" && !page.username && !page.password;
  } catch { return false; }
}
module.exports = { allowSearchMicrophone };
