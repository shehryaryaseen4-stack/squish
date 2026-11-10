// Written in old JavaScript on purpose: browsers too old for the app (such as the
// old Microsoft Edge on Windows 10) can still run this and say what to do,
// instead of showing a blank page.
(function () {
  // modern.js (loaded just before) sets the flag only where the new syntax works.
  // No eval here: the app's security policy forbids it.
  function show() {
    if (window.GYM_MODERN) return;
    var box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;inset:0;top:0;left:0;right:0;bottom:0;background:#111;color:#fff;font:18px/1.5 Arial,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;z-index:99999');
    box.innerHTML = '<div style="max-width:560px"><div style="font-size:44px">&#9888;</div>'
      + '<h1 style="font-size:26px;margin:10px 0">This browser is too old for the gym app</h1>'
      + '<p>Please open it in <b>Google Chrome</b> or the new <b>Microsoft Edge</b>:</p>'
      + '<p style="background:#222;border-radius:10px;padding:10px 14px;font-family:monospace;word-break:break-all">' + location.href.replace(/[<>&"]/g, '') + '</p>'
      + '<p style="color:#bbb;font-size:15px">Yeh browser purana hai. Ye address Chrome mein kholein.</p></div>';
    document.body.appendChild(box);
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
