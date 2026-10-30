// Web stand-in for expo-image-picker: a demo camera roll of invented meal photos,
// so the real photo-estimate screen has something to pick from in a browser.
// Which photos were picked is exposed as window.__demoPicked for the demo server.

const PHOTOS = [
  { id: 'tacos', day: 'Today', label: 'Tacos, from above' },
  { id: 'tacosSide', day: 'Today', label: 'Tacos, from the side' },
  { id: 'latte', day: 'Today', label: 'Latte' },
  { id: 'bowl', day: 'Yesterday', label: 'Oatmeal, from above' },
  { id: 'bowlSide', day: 'Yesterday', label: 'Oatmeal, from the side' },
  { id: 'pasta', day: 'Yesterday', label: 'Spaghetti' },
  { id: 'salad', day: 'Tuesday', label: 'Salad' },
  { id: 'toast', day: 'Tuesday', label: 'Avocado toast' },
];

const photoUrl = (id) => new URL(`demo-photos/${id}.jpg`, document.baseURI).href;

export const MediaTypeOptions = { All: 'All', Images: 'Images', Videos: 'Videos' };
export const CameraType = { front: 'front', back: 'back' };
export const UIImagePickerPresentationStyle = {};
const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };
export const requestCameraPermissionsAsync = async () => granted;
export const getCameraPermissionsAsync = async () => granted;
export const requestMediaLibraryPermissionsAsync = async () => granted;
export const getMediaLibraryPermissionsAsync = async () => granted;
export const useCameraPermissions = () => [granted, requestCameraPermissionsAsync, getCameraPermissionsAsync];
export const useMediaLibraryPermissions = () => [granted, requestMediaLibraryPermissionsAsync, getMediaLibraryPermissionsAsync];
export const getPendingResultAsync = async () => [];

function el(tag, style, text) {
  const node = document.createElement(tag);
  if (style) node.setAttribute('style', style);
  if (text != null) node.textContent = text;
  return node;
}

function pick({ limit, title }) {
  return new Promise((resolve) => {
    const chosen = [];
    const root = el('div', 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.35);font-family:-apple-system,system-ui,sans-serif');
    const sheet = el('div', 'background:#fff;color:#111;border-radius:14px 14px 0 0;max-height:92%;display:flex;flex-direction:column;overflow:hidden');
    const bar = el('div', 'display:flex;align-items:center;justify-content:space-between;padding:14px 14px 10px;border-bottom:1px solid #e5e5e5');
    const cancel = el('button', 'border:0;background:none;color:#007aff;font-size:16px;cursor:pointer', 'Cancel');
    const head = el('div', 'font-weight:600;font-size:16px', title);
    const add = el('button', 'border:0;background:none;color:#007aff;font-size:16px;font-weight:600;cursor:pointer;opacity:.35', 'Add');
    bar.append(cancel, head, add);
    const hint = el('div', 'font-size:12px;color:#6b6b6b;padding:8px 14px 0', limit > 1 ? `Demo camera roll · pick up to ${limit}` : 'Demo camera · pick a photo');
    const grid = el('div', 'display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:6px 2px 24px;overflow-y:auto');
    let lastDay = '';
    for (const photo of PHOTOS) {
      if (photo.day !== lastDay) {
        grid.append(el('div', 'grid-column:1/-1;font-size:13px;font-weight:700;padding:10px 10px 4px', photo.day));
        lastDay = photo.day;
      }
      const cell = el('button', 'position:relative;border:0;padding:0;aspect-ratio:1;cursor:pointer;background:#ddd;overflow:hidden');
      cell.setAttribute('aria-label', photo.label);
      cell.dataset.demoPhoto = photo.id;
      const img = el('img', 'width:100%;height:100%;display:block;object-fit:cover');
      img.src = photoUrl(photo.id);
      img.alt = '';
      const badge = el('span', 'position:absolute;right:5px;bottom:5px;width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,.25);color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center');
      cell.append(img, badge);
      cell.onclick = () => {
        const at = chosen.indexOf(photo.id);
        if (at >= 0) chosen.splice(at, 1);
        else if (chosen.length < limit) chosen.push(photo.id);
        grid.querySelectorAll('[data-demo-photo]').forEach((c) => {
          const n = chosen.indexOf(c.dataset.demoPhoto);
          const b = c.lastChild;
          b.textContent = n >= 0 ? String(n + 1) : '';
          b.style.background = n >= 0 ? '#007aff' : 'rgba(0,0,0,.25)';
          c.firstChild.style.opacity = n >= 0 ? '.75' : '1';
        });
        add.style.opacity = chosen.length ? '1' : '.35';
        add.textContent = chosen.length ? `Add (${chosen.length})` : 'Add';
        if (limit === 1 && chosen.length) finish();
      };
      grid.append(cell);
    }
    sheet.append(bar, hint, grid);
    root.append(sheet);
    const finish = () => {
      root.remove();
      if (!chosen.length) return resolve({ canceled: true, assets: null });
      window.__demoPicked = [...(window.__demoPicked || []), ...chosen];
      resolve({
        canceled: false,
        assets: chosen.map((id) => ({ assetId: id, uri: photoUrl(id), width: 900, height: 900, type: 'image', mimeType: 'image/jpeg', fileName: `${id}.jpg` })),
      });
    };
    cancel.onclick = () => { chosen.length = 0; finish(); };
    add.onclick = () => { if (chosen.length) finish(); };
    root.onclick = (e) => { if (e.target === root) cancel.onclick(); };
    document.body.append(root);
  });
}

export const launchImageLibraryAsync = (options = {}) =>
  pick({ limit: options.allowsMultipleSelection ? Math.max(1, options.selectionLimit || 4) : 1, title: 'Recents' });
export const launchCameraAsync = () => pick({ limit: 1, title: 'Camera' });
