// react-native-web's TextInput.State lacks currentlyFocusedInput(), which React Native has.
const TextInput = require('react-native-web/dist/exports/TextInput').default;
if (TextInput && TextInput.State && !TextInput.State.currentlyFocusedInput) {
  TextInput.State.currentlyFocusedInput = () => TextInput.State.currentlyFocusedField();
}

// react-native-web's Alert.alert does nothing; show an iOS-style dialog instead so
// the app's confirmations and choices work in the browser.
const Alert = require('react-native-web/dist/exports/Alert').default;
Alert.alert = (title, message, buttons) => {
  if (typeof document === 'undefined') return;
  let list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
  // iOS puts Cancel last when buttons stack vertically.
  if (list.length > 2) list = [...list.filter((b) => b.style !== 'cancel'), ...list.filter((b) => b.style === 'cancel')];
  const root = document.createElement('div');
  root.setAttribute('style', 'position:fixed;inset:0;z-index:99998;display:grid;place-items:center;background:rgba(0,0,0,.3);font-family:-apple-system,system-ui,sans-serif');
  const box = document.createElement('div');
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('style', 'width:270px;max-width:86%;background:rgba(242,242,242,.98);border-radius:14px;overflow:hidden;text-align:center;color:#000');
  const body = document.createElement('div');
  body.setAttribute('style', 'padding:18px 16px 14px');
  const h = document.createElement('div');
  h.setAttribute('style', 'font-weight:600;font-size:16px;margin-bottom:4px');
  h.textContent = title || '';
  const m = document.createElement('div');
  m.setAttribute('style', 'font-size:13px;line-height:1.35;white-space:pre-line');
  m.textContent = message || '';
  body.append(h, m);
  box.append(body);
  const row = document.createElement('div');
  row.setAttribute('style', `display:${list.length === 2 ? 'grid;grid-template-columns:1fr 1fr' : 'grid'};border-top:1px solid rgba(60,60,67,.29)`);
  list.forEach((btn, i) => {
    const b = document.createElement('button');
    b.textContent = btn.text || 'OK';
    const color = btn.style === 'destructive' ? '#ff3b30' : '#007aff';
    const sep = list.length === 2 ? (i === 0 ? 'border-right:1px solid rgba(60,60,67,.29);' : '') : (i > 0 ? 'border-top:1px solid rgba(60,60,67,.29);' : '');
    b.setAttribute('style', `${sep}border-left:0;border-bottom:0;border-top-width:${list.length === 2 ? 0 : ''};background:none;padding:11px 8px;font-size:16px;color:${color};font-weight:${btn.style === 'cancel' ? 600 : 400};cursor:pointer`);
    b.onclick = () => { root.remove(); if (btn.onPress) btn.onPress(); };
    row.append(b);
  });
  box.append(row);
  root.append(box);
  document.body.append(root);
};
