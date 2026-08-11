import * as THREE from "three";
import type { ItemId } from "./types";

/** Hover/select callbacks; SceneManager wraps SceneEvents before passing. */
export interface InteractionEvents {
  onHover?: (item: ItemId | null, screen?: { x: number; y: number }) => void;
  /** root = the actual picked group instance (itemIds can be shared). */
  onSelect?: (item: ItemId, root: THREE.Group) => void;
}

interface EmissiveSnapshot {
  material: THREE.MeshStandardMaterial;
  emissive: THREE.Color;
  emissiveIntensity: number;
}

const HOVER_TINT = new THREE.Color(0x4a2f14);
const KEYBOARD_ORDER: ItemId[] = [
  "spellbook",
  "sword",
  "shield",
  "potion",
  "scroll",
  "dice",
  "tankard",
  "candle",
];
const CLICK_MAX_DIST = 6;
const CLICK_MAX_MS = 400;

/** Standard-material family that carries an emissive channel. */
function hasEmissive(
  material: THREE.Material,
): material is THREE.MeshStandardMaterial {
  return "emissive" in material;
}

/**
 * Pointer raycasting (throttled to the render loop), hover emissive
 * boost, click-vs-drag detection, and keyboard highlight cycling.
 */
export class Interaction {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNDC = new THREE.Vector2();

  private readonly roots: THREE.Group[];
  private readonly primaryByItem = new Map<ItemId, THREE.Group>();
  private readonly order: ItemId[];

  private enabled = true;
  /** While set, hover is suppressed and only this item may be selected. */
  private focusFilter: ItemId | null = null;
  private pickPending = false;
  private lastClientX = 0;
  private lastClientY = 0;

  private hoveredRoot: THREE.Group | null = null;
  private readonly snapshots: EmissiveSnapshot[] = [];

  private keyboardIndex = -1;
  private highlightedItem: ItemId | null = null;

  private downX = 0;
  private downY = 0;
  private downTime = 0;
  private downValid = false;

  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly events: InteractionEvents;

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.PerspectiveCamera,
    roots: THREE.Group[],
    events: InteractionEvents,
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.events = events;
    this.roots = roots;
    for (const root of roots) {
      const id = root.userData.itemId as ItemId | undefined;
      if (id && !this.primaryByItem.has(id)) this.primaryByItem.set(id, root);
    }
    this.order = KEYBOARD_ORDER.filter((id) => this.primaryByItem.has(id));

    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
  }

  /** Called once per frame; performs at most one hover raycast per raf. */
  update(): void {
    if (!this.pickPending) return;
    this.pickPending = false;
    if (!this.enabled || this.focusFilter !== null) return;

    const root = this.pick(this.lastClientX, this.lastClientY);
    if (root === this.hoveredRoot) return;

    this.clearHighlight();
    this.hoveredRoot = root;
    if (root) {
      this.applyHighlight(root);
      this.highlightedItem = root.userData.itemId as ItemId;
      this.keyboardIndex = this.order.indexOf(this.highlightedItem);
      document.body.style.cursor = "pointer";
      this.events.onHover?.(this.highlightedItem, {
        x: this.lastClientX,
        y: this.lastClientY,
      });
    } else {
      this.highlightedItem = null;
      document.body.style.cursor = "";
      this.events.onHover?.(null);
    }
  }

  /** Disable picking entirely (used while an item is focused). */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.clearHover();
    }
  }

  /**
   * While an item is focused: hover events stop, but clicks on that item's
   * group(s) still register (candle snuffing counts clicks while focused).
   */
  setFocus(item: ItemId | null): void {
    if (this.focusFilter === item) return;
    this.focusFilter = item;
    if (item !== null) this.clearHover();
  }

  highlightNext(direction: 1 | -1): ItemId {
    const count = this.order.length;
    this.keyboardIndex = (this.keyboardIndex + direction + count) % count;
    const item = this.order[this.keyboardIndex];
    const root = this.primaryByItem.get(item);

    this.clearHighlight();
    this.hoveredRoot = null;
    this.highlightedItem = item;
    if (root) {
      this.applyHighlight(root);
      this.events.onHover?.(item, this.projectToScreen(root));
    }
    return item;
  }

  activateHighlighted(): void {
    if (!this.highlightedItem) return;
    const root = this.primaryByItem.get(this.highlightedItem);
    if (root) this.events.onSelect?.(this.highlightedItem, root);
  }

  dispose(): void {
    this.clearHover();
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    this.lastClientX = event.clientX;
    this.lastClientY = event.clientY;
    this.pickPending = true;
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    this.downX = event.clientX;
    this.downY = event.clientY;
    this.downTime = performance.now();
    this.downValid = true;
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    if (!this.downValid || !this.enabled) return;
    this.downValid = false;
    const dx = event.clientX - this.downX;
    const dy = event.clientY - this.downY;
    if (
      Math.hypot(dx, dy) > CLICK_MAX_DIST ||
      performance.now() - this.downTime > CLICK_MAX_MS
    ) {
      return;
    }
    const root = this.pick(event.clientX, event.clientY);
    if (!root) return;
    const item = root.userData.itemId as ItemId;
    // While focused, only the focused item's group(s) accept clicks.
    if (this.focusFilter !== null && item !== this.focusFilter) return;
    this.events.onSelect?.(item, root);
  };

  private readonly onPointerLeave = () => {
    this.downValid = false;
    this.clearHover();
  };

  private clearHover(): void {
    this.pickPending = false;
    if (this.hoveredRoot || this.highlightedItem) {
      this.clearHighlight();
      this.hoveredRoot = null;
      this.highlightedItem = null;
      document.body.style.cursor = "";
      this.events.onHover?.(null);
    }
  }

  private pick(clientX: number, clientY: number): THREE.Group | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this.pointerNDC.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.roots, true);
    for (const hit of hits) {
      const root = this.findRoot(hit.object);
      if (root) return root;
    }
    return null;
  }

  private findRoot(object: THREE.Object3D): THREE.Group | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.itemId) return current as THREE.Group;
      current = current.parent;
    }
    return null;
  }

  private applyHighlight(root: THREE.Group): void {
    const seen = new Set<THREE.Material>();
    root.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (seen.has(material) || !hasEmissive(material)) continue;
        seen.add(material);
        this.snapshots.push({
          material,
          emissive: material.emissive.clone(),
          emissiveIntensity: material.emissiveIntensity,
        });
        material.emissive.add(HOVER_TINT);
        material.emissiveIntensity = Math.max(material.emissiveIntensity, 1);
      }
    });
  }

  private clearHighlight(): void {
    for (const snap of this.snapshots) {
      snap.material.emissive.copy(snap.emissive);
      snap.material.emissiveIntensity = snap.emissiveIntensity;
    }
    this.snapshots.length = 0;
  }

  private projectToScreen(root: THREE.Group): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const world = new THREE.Vector3();
    root.getWorldPosition(world);
    world.y += 0.12;
    world.project(this.camera);
    return {
      x: rect.left + ((world.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - world.y) / 2) * rect.height,
    };
  }
}
