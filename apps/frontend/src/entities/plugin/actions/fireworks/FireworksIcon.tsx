import Icon from '@ant-design/icons';

// Two bursts and the trail of the rocket, drawn on antd's 1024 grid so the icon
// sits with the outlined ones (1em, currentColor).
const BIG_BURST =
  'M532 452L679 513M472 512L533 659M388 512L327 659M328 452L181 513M328 368L181 307M388 308L327 161M472 308L533 161M532 368L679 307';
const SMALL_BURST = 'M850 250L930 250M825 293L865 363M775 293L735 363M750 250L670 250M775 207L735 137M825 207L865 137';

function FireworksSvg() {
  return (
    <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor" aria-hidden>
      <path d={`${BIG_BURST}${SMALL_BURST}`} stroke="currentColor" strokeWidth={64} strokeLinecap="round" fill="none" />
      <circle cx={430} cy={410} r={44} />
      <circle cx={800} cy={250} r={30} />
      <circle cx={480} cy={790} r={36} />
      <circle cx={520} cy={900} r={28} />
    </svg>
  );
}

/** A fireworks icon, in the style of the antd outlined icons. */
export function FireworksIcon() {
  return <Icon component={FireworksSvg} />;
}
