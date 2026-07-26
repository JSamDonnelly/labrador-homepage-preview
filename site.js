// site.js — the prototype's one script, progressive enhancement only. Every
// control on the page works without it: the contact email is a plain mailto
// link until this wires it to copy the address instead, and the nav is a
// wrapping row of links until this collapses it behind the Menu button. Keep it
// that way — nothing on these pages may *require* JavaScript.

// ---------------------------------------------------------------------------
// Responsive nav
//
// The Menu button and the collapsed panel are both CSS-gated on .nav-enhanced,
// added here. That ordering is the whole point: if this script never runs, the
// button stays hidden and the nav stays open, so nobody is left with a menu
// they cannot open. A native <button> carries the disclosure semantics
// (aria-expanded, keyboard operation) that a styled <div> would not.
// ---------------------------------------------------------------------------
(() => {
  const header = document.querySelector(".masthead-inner");
  const button = header && header.querySelector(".menu-button");
  const panel = header && header.querySelector("nav.masthead");
  if (!header || !button || !panel) return;

  // max-width, not the range syntax the stylesheet uses: matchMedia support for
  // ranges is newer than the media query itself. Same 900px boundary.
  const narrow = window.matchMedia("(max-width: 900px)");

  const setOpen = (open) => {
    header.classList.toggle("nav-open", open);
    button.setAttribute("aria-expanded", String(open));
    // Reopening should start clean, so collapse the Services disclosure with it.
    if (!open) {
      panel.querySelectorAll("details[open]").forEach((d) => {
        d.open = false;
      });
    }
  };

  header.classList.add("nav-enhanced");
  setOpen(false);

  button.addEventListener("click", () => {
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });

  // In-page links must close the panel: the target section sits below an open
  // menu, so leaving it open would scroll the reader to a pushed-down anchor.
  panel.addEventListener("click", (event) => {
    if (narrow.matches && event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (button.getAttribute("aria-expanded") !== "true") return;
    setOpen(false);
    // Escape must leave focus somewhere sensible, not on a link that just
    // disappeared.
    button.focus();
  });

  // Widening past the breakpoint shows the full nav again; clear the collapsed
  // state so it can never come back stuck shut.
  narrow.addEventListener("change", (event) => {
    if (!event.matches) setOpen(false);
  });
})();

document.querySelectorAll(".contact-email").forEach((item) => {
  if (!navigator.clipboard) return;

  const link = item.querySelector("a");
  const note = item.querySelector(".copy-note");
  const address = link.textContent.trim();
  let timer;

  // Once JS is in charge the link copies instead of navigating, so say so in
  // its accessible name before anyone commits to a click.
  const hint = document.createElement("span");
  hint.className = "visually-hidden";
  hint.textContent = " (copies the address to your clipboard)";
  link.append(hint);

  const settle = (message, holdMs) => {
    // One element does both jobs: visible note for sighted users, and a
    // role="status" live region announcing the same words to screen readers.
    // holdMs is only passed for the success message — its task is already
    // done, so it may fade. The failure message is an instruction the user
    // still has to act on, so it stays until the next attempt replaces it.
    note.textContent = message;
    clearTimeout(timer);
    if (holdMs) {
      timer = setTimeout(() => {
        note.textContent = "";
      }, holdMs);
    }
  };

  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigator.clipboard.writeText(address).then(
      () => settle("Copied!", 2400),
      () => {
        // Clipboard refused (blocked permission, unfocused document): select
        // the address so one keystroke finishes the job. Never fail silently.
        // The range covers only the address text node, not the hidden hint.
        const selection = document.getSelection();
        const range = document.createRange();
        range.selectNode(link.firstChild);
        selection.removeAllRanges();
        selection.addRange(range);
        settle("Selected. Copy with your usual shortcut.");
      },
    );
  });
});
