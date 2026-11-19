"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Matrix4, Quaternion, Vector3 } from "three";
import { BANNERS, clothFront, clothZ } from "./bannerKit";

const noRaycast = () => null;
const Y = new Vector3(0, 1, 0);

// A matrix that turns a unit cylinder (height 1 along +y, centred) into a segment from a to b.
function segment(a, b) {
  const from = new Vector3(...a);
  const to = new Vector3(...b);
  const dir = to.clone().sub(from);
  const length = dir.length();
  const q = new Quaternion().setFromUnitVectors(Y, dir.normalize());
  return new Matrix4().compose(from.add(to).multiplyScalar(0.5), q, new Vector3(1, length, 1));
}
const place = (position, rotationZ = 0, scale = 1) => new Matrix4().compose(
  new Vector3(...position),
  new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rotationZ),
  new Vector3(scale, scale, scale),
);

function Instances({ geometry, material, matrices }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} raycast={noRaycast} />;
}

// The parts' sizes grow with the banner (the ranking banner is about 4× wider than an honour banner).
const PART_SCALE = { honour: 1, ranking: 1.7 };

// A hanging royal banner built in code. Its origin is the middle of the cloth's top edge; the cloth
// hangs down (−y) and faces +z. Parts: crimson velvet cloth with a cream header band, blue scrollwork
// and a gold embroidered border; V-shaped bottom with a gold fringe; a crest shield near the bottom;
// a gold rod with round finials, hung from two cords; 2 large tassels at the rod ends and 2 small
// tassels at the bottom corners. Honour banners also carry their title under the header band.
// hangTo: local height the hanging cord runs up to from the hook (the roof line), if set.
export default function RoyalBanner({ kit, size = "honour", crest, title = null, crestY, hookRise = 0.8, hangTo = null, children, ...group }) {
  const spec = BANNERS[size];
  const k = PART_SCALE[size];
  const { width: W, height: H, vDepth: V, header, border: b } = spec;
  const { geometry, materials } = kit;
  const shield = geometry.crest[size];

  const parts = useMemo(() => {
    const rodY = 0.03 * k;
    const rodLength = W + 0.12 * k;
    const end = rodLength / 2;
    const tasselX = end + 0.1 * k;
    const hook = [0, rodY + hookRise, 0];
    const cordDrop = 0.32 * k;
    const corner = -(H - V);
    const cornerZ = (x) => clothZ(spec, x, corner);
    return {
      rod: { position: [0, rodY, 0], scale: [spec.rodR, rodLength, spec.rodR] },
      finials: [
        place([-end, rodY, 0], Math.PI / 2, k),
        place([end, rodY, 0], -Math.PI / 2, k),
        place([hook[0], hook[1] - 0.04 * k, 0], 0, 0.55 * k), // hook knob the cords meet at
      ],
      cords: [
        segment([-(W / 2 - 0.15 * k), rodY, 0], hook),
        segment([W / 2 - 0.15 * k, rodY, 0], hook),
        segment([-tasselX, rodY, 0], [-tasselX, rodY - cordDrop, 0]),
        segment([tasselX, rodY, 0], [tasselX, rodY - cordDrop, 0]),
        ...(hangTo != null ? [segment(hook, [0, hangTo, 0])] : []),
      ],
      tassels: [
        place([-tasselX, rodY - cordDrop, 0], 0, 0.6 * k),
        place([tasselX, rodY - cordDrop, 0], 0, 0.6 * k),
        place([-(W / 2 - 0.03), corner + 0.01, cornerZ(-W / 2) + 0.03], 0, 0.3 * k),
        place([W / 2 - 0.03, corner + 0.01, cornerZ(W / 2) + 0.03], 0, 0.3 * k),
      ],
    };
  }, [spec, k, W, H, V, hookRise, hangTo]);

  // Flat parts sit just in front of the folds (plus room for the ripple).
  const crestZ = clothFront(spec, -shield.w / 2, shield.w / 2, crestY - shield.h / 2, crestY + shield.h / 2) + 0.04;
  const titleW = W - 2 * b - 0.2;
  const titleH = titleW / (1024 / 192);
  const titleY = -(b + header + 0.06 + titleH / 2);
  const titleZ = clothFront(spec, -titleW / 2, titleW / 2, titleY - titleH / 2, titleY + titleH / 2) + 0.02;

  return <group {...group}>
    <mesh geometry={geometry.cloth[size]} material={materials.cloth[size]} />
    <mesh geometry={geometry.fringe[size]} material={materials.fringe[size]} raycast={noRaycast} />
    <mesh geometry={geometry.rod} material={materials.gold} position={parts.rod.position} scale={parts.rod.scale} rotation-z={Math.PI / 2} raycast={noRaycast} />
    <Instances geometry={geometry.finial} material={materials.gold} matrices={parts.finials} />
    <Instances geometry={geometry.cord} material={materials.cord} matrices={parts.cords} />
    <Instances geometry={geometry.tassel} material={materials.tassel} matrices={parts.tassels} />
    <group position={[0, crestY, crestZ]}>
      <mesh geometry={shield.body} material={materials.gold} position-z={-shield.depth} raycast={noRaycast} />
      <mesh geometry={shield.faces[crest]} material={materials.crestFace} position-z={0.004} raycast={noRaycast} />
    </group>
    {title != null && <mesh geometry={geometry.titleRows[title]} material={materials.title} position={[0, titleY, titleZ]} scale={[titleW, titleH, 1]} raycast={noRaycast} />}
    {children /* drawn on the cloth: the info patch */}
  </group>;
}
