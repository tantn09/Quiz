export function LoadingScreen() {
  return (
    <div role="status" className="fixed inset-0 z-[110] grid place-items-center bg-page">
      <span aria-hidden="true" className="size-10 rounded-full border-[3px] border-line border-t-brand motion-safe:animate-spin" />
      <span className="sr-only">Đang tải / Loading</span>
    </div>
  );
}
