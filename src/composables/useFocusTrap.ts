import { computed, nextTick, onBeforeUnmount, onMounted, reactive } from "vue";
import type { Ref } from "vue";

/**
 * Modal focus handling shared by the book, the ledger and the console:
 * initial focus on mount, Tab / Shift+Tab wrapped inside the container, and
 * focus handed back to whatever held it before when the modal unmounts.
 *
 * Traps stack: when the console opens over the book only the topmost trap
 * reacts, and `active` tells the lower one to stay quiet (no arrow keys,
 * no Escape) until it is on top again.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack = reactive<symbol[]>([]);

export interface FocusTrapOptions {
  /** Element to focus first; defaults to the first focusable inside. */
  initialFocus?: () => HTMLElement | null | undefined;
}

export function useFocusTrap(
  root: Ref<HTMLElement | null>,
  options: FocusTrapOptions = {},
): { active: Readonly<Ref<boolean>> } {
  const id = Symbol("focus-trap");
  let previouslyFocused: HTMLElement | null = null;

  const active = computed(() => stack[stack.length - 1] === id);

  function focusables(): HTMLElement[] {
    const el = root.value;
    if (!el) return [];
    return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (node) => node.offsetParent !== null || node === document.activeElement,
    );
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "Tab" || !active.value) return;
    const els = focusables();
    if (els.length === 0) {
      event.preventDefault();
      return;
    }
    const first = els[0]!;
    const last = els[els.length - 1]!;
    const current = document.activeElement;
    const inside = !!root.value?.contains(current);
    if (event.shiftKey) {
      if (current === first || !inside) {
        event.preventDefault();
        last.focus();
      }
    } else if (current === last || !inside) {
      event.preventDefault();
      first.focus();
    }
  }

  onMounted(() => {
    previouslyFocused = document.activeElement as HTMLElement | null;
    stack.push(id);
    window.addEventListener("keydown", onKeydown);
    void nextTick(() => {
      (options.initialFocus?.() ?? focusables()[0])?.focus();
    });
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onKeydown);
    const at = stack.indexOf(id);
    if (at >= 0) stack.splice(at, 1);
    if (previouslyFocused?.isConnected) previouslyFocused.focus?.();
  });

  return { active };
}
