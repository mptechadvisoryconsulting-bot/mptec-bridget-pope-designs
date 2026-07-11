export function toast(message: string) {
  return { message };
}

export function ToastRegion() {
  return <div aria-live="polite" aria-atomic="true" />;
}
