/**
 * A search bar so a display can double as a browser homepage. It is off for wall screens;
 * the dashboard turns it on per display. It is a plain form: typing and pressing Enter
 * sends you to Google's results, and nothing is stored here.
 */
export default function SearchBox() {
  return (
    <form action="https://www.google.com/search" method="get" target="_top" className="w-full max-w-[70cqw]">
      <input
        name="q"
        type="search"
        placeholder="Search Google"
        aria-label="Search Google"
        autoComplete="off"
        className="w-full rounded-full border border-white/15 bg-surface-raised/85 px-[3cqw] py-[1.2cqh] text-[length:calc(var(--fs,1)*min(3cqw,2.4cqh))] text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
    </form>
  );
}
