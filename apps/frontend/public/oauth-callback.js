// Redirect URI of the browser-only OAuth sign-in (no BFF): hands the callback URL (code, state) to
// the fluid page that opened the sign-in, which checks the state and exchanges the code itself.
(function () {
  var message = { type: 'fluid-oauth-browser', url: window.location.href };
  try {
    var channel = new BroadcastChannel('fluid-oauth-browser');
    channel.postMessage(message);
    channel.close();
  } catch (e) {
    // No BroadcastChannel: window.opener below.
  }
  try {
    if (window.opener) window.opener.postMessage(message, window.location.origin);
  } catch (e) {
    // The opener is gone or another origin.
  }
  // The code is single-use, but it has no business staying in the history.
  window.history.replaceState(null, '', window.location.pathname);
  window.close();
})();
