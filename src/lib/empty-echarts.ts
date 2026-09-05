// Empty mock for ECharts on SSR so it is never bundled into Cloudflare Workers isolate
export default {};
export const init = () => ({
  setOption: () => {},
  resize: () => {},
  dispose: () => {},
  on: () => {},
});
