/**
 * Non-interactive still life on the tabletop from the licensed
 * scrolls & books set: an inkwell with its quill, a small book stack and
 * a loose scroll. Placed clear of the interactables and the d20's usual
 * rolling lane; each becomes a static dice collider. Nothing here is
 * created when the models are missing.
 */
import * as THREE from "three";
import { TABLE_SURFACE_Y } from "../types";
import { styleModel, type ModelKey, type ModelLibrary } from "../assets";

interface PropPlacement {
  key: ModelKey;
  x: number;
  z: number;
  rotY: number;
  scale?: number;
}

const TABLE_PROPS: PropPlacement[] = [
  // Behind the tome, between the potions and the tankard.
  { key: "ink", x: -0.08, z: -0.55, rotY: 0.5, scale: 0.85 },
  { key: "scroll1", x: 0.17, z: -0.6, rotY: -0.35, scale: 0.9 },
  // Right end, tucked behind the longsword and clear of the die's lane.
  { key: "bookStack", x: 0.96, z: -0.11, rotY: -0.45, scale: 0.72 },
];

export function buildTableProps(models: ModelLibrary): THREE.Group[] {
  const props: THREE.Group[] = [];
  for (const placement of TABLE_PROPS) {
    const model = models.model(placement.key);
    if (!model) continue;
    // Hand-painted set: slightly warmer and softer so it sits with the
    // procedural tableware under the candles.
    styleModel(model, { tint: 0xe8ddd0, roughnessMin: 0.6 });
    const group = new THREE.Group();
    group.name = `tableProp:${placement.key}`;
    model.scale.setScalar(placement.scale ?? 1);
    group.add(model);
    group.position.set(placement.x, TABLE_SURFACE_Y, placement.z);
    group.rotation.y = placement.rotY;
    props.push(group);
  }
  return props;
}
