import { InView } from "@/components/deliver/in-view";
import { inlineSvg } from "@/lib/inline-svg";

const spokes = (x: number, y: number, r: number) =>
  `<path d="M${x} ${y - r}v${2 * r}M${x - r} ${y}h${2 * r}" stroke="#3f3d56" stroke-width="3" stroke-linecap="round" fill="none"/>`;

const streak = (x: number, y: number, width: number, delay: number) =>
  `<rect x="${x}" y="${y}" width="${width}" height="4" rx="2" fill="#d4d4d8" opacity="0" style="animation-delay:${delay}s"/>`;

const SPEED_LINES = `<g class="ow-speed">${streak(690, 576, 60, 0)}${streak(668, 606, 80, 0.4)}${streak(700, 636, 48, 0.8)}</g>`;

function buildScene() {
  return inlineSvg(
    "undraw_on-the-way_zwi3.svg",
    [
      { from: 2, to: 4, open: '<g class="ow-plant">' },
      { from: 5, to: 7, open: '<g class="ow-plant ow-plant-sm">' },
      { from: 0, to: 1, open: '<g class="ow-ride"><g class="ow-bob">', close: "</g></g>" },
      { from: 8, to: 38, open: '<g class="ow-ride">' },
      { from: 8, to: 19, open: '<g class="ow-bob">' },
      {
        from: 20,
        to: 21,
        open: '<g class="ow-wheel">',
        close: `${spokes(1125.26, 654.39, 11)}</g>`,
      },
      {
        from: 22,
        to: 23,
        open: '<g class="ow-wheel">',
        close: `${spokes(851.2, 646.19, 13)}</g>`,
      },
      { from: 24, to: 38, open: '<g class="ow-bob">' },
      { from: 35, to: 35, open: '<g class="ow-hair">' },
    ],
    { 8: SPEED_LINES },
  );
}

const scene = buildScene();

export function RideScene({ className }: { className?: string }) {
  return (
    <InView className={className}>
      <div aria-hidden dangerouslySetInnerHTML={{ __html: scene }} />
    </InView>
  );
}
