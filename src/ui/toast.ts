// The 1.8s transient message. Its own module because the retired-site screen
// (ui/farewell.ts) needs it and must not pull the settings sheet — and with it
// the whole audio stack — into its bundle.
export function toast(text: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
