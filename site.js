// site.js — the prototype's one script, progressive enhancement only. Every
// control on the page works without it: the contact email is a plain mailto
// link until this wires it to copy the address instead. Keep it that way —
// nothing on these pages may *require* JavaScript.

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
    note.textContent = message;
    clearTimeout(timer);
    timer = setTimeout(() => {
      note.textContent = "";
    }, holdMs);
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
        settle("Selected. Copy with your usual shortcut.", 4000);
      },
    );
  });
});
