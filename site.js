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

// ---------------------------------------------------------------------------
// Chat placeholder (Intercom)
//
// Controls labelled "(opens chat)" / "Chat with us" carry data-chat-launch.
// Once the Intercom snippet is in <head>, clicking them opens the messenger;
// until then the click falls through to each control's own href (email or
// the contact section), so nothing dead-ends. TODO: add the standard
// Intercom snippet with the workspace app id — these controls then go live
// with no further changes.
// ---------------------------------------------------------------------------
document.querySelectorAll("[data-chat-launch]").forEach((control) => {
  control.addEventListener("click", (event) => {
    if (typeof window.Intercom === "function") {
      event.preventDefault();
      window.Intercom("show");
    }
  });
});

// ---------------------------------------------------------------------------
// The quote form (quote.html) and its sitewide dialog
//
// The form works with JavaScript off: quote.html is a real page, its two
// branches switch on the path radios via :has() in CSS, and each form's
// action is a plain-text mailto. This block is the upgrade on top:
//
//   1. wireQuoteForms — replaces the flaky native mailto POST with a composed,
//      readable email (subject from data-subject, one "Label: answer" line per
//      field), and enforces "at least one" on checkbox groups marked
//      data-choose-one, which HTML alone cannot express.
//   2. The launcher — any link carrying data-quote-launch (every "Get a quote"
//      control) fetches quote.html once, lifts out .quote-widget, and opens it
//      in a native <dialog>: focus trap, Escape-to-close, and focus return all
//      come from the platform. If the fetch fails (older browser, file://),
//      the click falls back to plain navigation. quote.html itself has no
//      launchers, so the widget's ids are never duplicated in one document.
//
// TODO (WordPress): the real form handler replaces the mailto composition;
// everything else here carries over.
// ---------------------------------------------------------------------------
const QUOTE_EMAIL = "hello@labradoraccessibility.com";

const wireQuoteForms = (root) => {
  // Both branches open with the same four questions (name, email, company,
  // country). Someone who fills them in, then realises they picked the wrong
  // path, shouldn't have to type them again — mirror them across the two
  // forms as they're typed. Autofill already offers the same values, so this
  // is a convenience on top, not something the form depends on.
  root.querySelectorAll(".quote-widget").forEach((widget) => {
    const forms = Array.from(widget.querySelectorAll("form.quote-form"));
    if (forms.length < 2) return;
    widget.addEventListener("input", (event) => {
      const field = event.target;
      if (!field.name || field.type === "checkbox" || field.type === "radio") return;
      const home = field.closest("form.quote-form");
      if (!home) return;
      forms.forEach((form) => {
        if (form === home) return;
        const twin = form.elements[field.name];
        // Skip anything that isn't a single matching text field (the shared
        // four); a RadioNodeList here would mean a same-named group.
        if (twin && !(twin instanceof RadioNodeList) && twin !== field) twin.value = field.value;
      });
    });
  });

  root.querySelectorAll("form.quote-form").forEach((form) => {
    // "Check at least one": all boxes in the group are required until any one
    // is checked. The browser then does the messaging in its own words, in
    // the visitor's own language.
    const groups = new Map();
    form.querySelectorAll('input[type="checkbox"][data-choose-one]').forEach((box) => {
      if (!groups.has(box.name)) groups.set(box.name, []);
      groups.get(box.name).push(box);
    });
    groups.forEach((boxes) => {
      const sync = () => {
        const any = boxes.some((box) => box.checked);
        boxes.forEach((box) => {
          box.required = !any;
          // Clearing on every change is essential: a custom validity message
          // sticks until it's set back to "", which would leave the whole
          // group permanently invalid.
          box.setCustomValidity("");
        });
      };
      boxes.forEach((box) => {
        box.addEventListener("change", sync);
        // The browser's own wording for a required checkbox is "check THIS
        // box", which is wrong for a group where any one box satisfies the
        // constraint. Say what's actually being asked.
        box.addEventListener("invalid", () => {
          box.setCustomValidity("Check at least one option in this list.");
        });
      });
      sync();
    });

    // Only fires once the form is valid — native validation runs first.
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const seen = new Set();
      const lines = [];
      Array.from(form.elements).forEach((el) => {
        if (!el.name || seen.has(el.name)) return;
        if (el.type === "submit" || el.type === "button") return;
        let value = "";
        if (el.type === "checkbox" || el.type === "radio") {
          // form.elements[name] is a RadioNodeList when the name is shared
          // (radio groups, the service checklists) and a lone element when not.
          const named = form.elements[el.name];
          const inputs = named instanceof RadioNodeList ? Array.from(named) : [named];
          value = inputs
            .filter((input) => input.checked)
            .map((input) => input.value)
            .join(", ");
        } else {
          value = el.value.trim();
        }
        seen.add(el.name);
        if (value) lines.push(`${el.name}: ${value}`);
      });

      const subject = form.dataset.subject || "Quote request";
      const body = lines.join("\r\n");
      window.location.href = `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      const status = form.querySelector(".quote-status");
      if (status) {
        status.textContent =
          "Your email app should now be open with everything filled in. If nothing opened, " +
          `email us at ${QUOTE_EMAIL}.`;
      }
    });
  });
};

wireQuoteForms(document);

// Pointer-vs-keyboard focus for the quote form's text fields. Text inputs
// match :focus-visible on mouse click by spec, so CSS alone cannot tell the
// two modalities apart; this tracks the last interaction and marks fields
// focused by pointer, which the stylesheet steps down to a quieter (still
// visible) indicator. Keyboard focus keeps the full yellow/black ring. One
// document-level listener covers the quote page and the dialog alike.
let clearPointerFocusMode = () => {};

(() => {
  let byPointer = false;
  document.addEventListener("pointerdown", () => {
    byPointer = true;
  });
  document.addEventListener("keydown", () => {
    byPointer = false;
  });
  document.addEventListener("focusin", (event) => {
    const field = event.target;
    if (field.matches("input, textarea") && field.closest(".quote-widget")) {
      field.classList.toggle("pointer-focus", byPointer);
    }
  });
  // Moving focus programmatically (the dialog's opening focus) is a
  // wayfinding moment for pointer users too: they need to see where Tab will
  // start. The opener resets to keyboard mode so the full ring shows.
  clearPointerFocusMode = () => {
    byPointer = false;
  };
})();

(() => {
  const launchers = document.querySelectorAll("a[data-quote-launch]");
  if (!launchers.length || typeof HTMLDialogElement === "undefined") return;

  let dialog = null;
  let fetching = false;

  const build = (widget) => {
    dialog = document.createElement("dialog");
    dialog.className = "quote-dialog";
    dialog.setAttribute("aria-labelledby", "quote-dialog-title");

    const inner = document.createElement("div");
    inner.className = "quote-dialog-inner";

    const head = document.createElement("div");
    head.className = "quote-dialog-head";
    const title = document.createElement("h2");
    title.id = "quote-dialog-title";
    title.textContent = "Get a quote";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "quote-close";
    close.textContent = "Close";
    close.addEventListener("click", () => dialog.close());
    head.append(title, close);

    inner.append(head, widget);
    dialog.append(inner);

    // A click on the dialog element itself is a click on the backdrop — the
    // content sits entirely inside .quote-dialog-inner.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    document.body.append(dialog);
    wireQuoteForms(dialog);
  };

  const open = () => {
    dialog.showModal();
    // Land on the path chooser, past the Close button: the task, not the exit.
    const first = dialog.querySelector('input[name="quote-path"]:checked');
    if (first) {
      clearPointerFocusMode();
      first.focus();
    }
  };

  launchers.forEach((link) => {
    link.addEventListener("click", (event) => {
      // These are real links: Cmd/Ctrl/Shift-click and middle-click must keep
      // opening quote.html in a new tab or window, not the dialog.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (typeof event.button === "number" && event.button !== 0) return;
      if (dialog) {
        event.preventDefault();
        open();
        return;
      }
      if (fetching) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      fetching = true;
      fetch(link.getAttribute("href"))
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.text();
        })
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, "text/html");
          const widget = doc.querySelector(".quote-widget");
          if (!widget) throw new Error("no widget");
          build(document.importNode(widget, true));
          open();
        })
        .catch(() => {
          // Anything went wrong: behave like the link this is.
          window.location.href = link.href;
        })
        .finally(() => {
          fetching = false;
        });
    });
  });
})();

document.querySelectorAll(".contact-email").forEach((item) => {
  if (!navigator.clipboard) return;

  const link = item.querySelector("a");
  const note = item.querySelector(".copy-note");
  const clickHint = item.querySelector(".copy-hint");
  const address = link.textContent.trim();
  let timer;

  // The visible "(click to copy)" cue only appears once the behavior it
  // describes actually exists.
  if (clickHint) clickHint.hidden = false;

  // Once JS is in charge the link copies instead of navigating, so say so in
  // its accessible name before anyone commits to a click.
  const nameHint = document.createElement("span");
  nameHint.className = "visually-hidden";
  nameHint.textContent = " (copies the address to your clipboard)";
  link.append(nameHint);

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
