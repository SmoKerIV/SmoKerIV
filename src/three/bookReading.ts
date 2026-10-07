/**
 * Link between the tome's DOM overlay and the scene for one-page-at-a-time
 * reading: the overlay says which page is being read (the camera glides to
 * it) and asks for the cosmetic 3D page flip. The scene registers its
 * handlers while it lives; calls with no scene are no-ops.
 */
export type BookPage = "left" | "right";

interface Handlers {
  setPage: (page: BookPage) => void;
  flip: (direction: 1 | -1) => void;
}

let handlers: Handlers | null = null;

export const bookReading = {
  /** Scene side: install handlers, returns the unregister function. */
  register(h: Handlers): () => void {
    handlers = h;
    return () => {
      if (handlers === h) handlers = null;
    };
  },
  setPage(page: BookPage): void {
    handlers?.setPage(page);
  },
  flip(direction: 1 | -1): void {
    handlers?.flip(direction);
  },
};
