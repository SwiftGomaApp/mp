const ROUTES = [
  {
    id: "route-a",
    d: "M0 160H280Q300 160 300 180V380Q300 400 320 400H640Q660 400 660 420V560",
    dur: 7,
    begin: 0,
  },
  { id: "route-b", d: "M1200 640H900Q880 640 880 620V460Q880 440 860 440H740", dur: 6, begin: -2 },
  { id: "route-c", d: "M120 800V640Q120 620 140 620H420Q440 620 440 600V500", dur: 8, begin: -4 },
  { id: "route-d", d: "M1200 200H1020Q1000 200 1000 220V320", dur: 5, begin: -1 },
] as const;

export function RoutesBackdrop({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      {ROUTES.map(({ id, d, dur, begin }) => (
        <g key={id}>
          <path
            id={id}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.14}
            strokeWidth={2}
          />

          <g className="motion-reduce:hidden">
            <path
              d={d}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity={0.55}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="6 14"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="20"
                to="0"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </path>

            <circle r={10} fill="var(--primary)" fillOpacity={0.2}>
              <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite">
                <mpath href={`#${id}`} />
              </animateMotion>
            </circle>
            <circle r={4} fill="var(--primary)">
              <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite">
                <mpath href={`#${id}`} />
              </animateMotion>
            </circle>
          </g>

          <circle
            r={5}
            fill="var(--background)"
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth={2}
          >
            <animateMotion dur="0.001s" fill="freeze" begin="0s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
        </g>
      ))}
    </svg>
  );
}
