"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM, VRMExpressionPresetName } from "@pixiv/three-vrm";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type Affect = { mood: string; valence: number; arousal: number; blush: number; gaze: string; speak_rate: number; pitch: number; };

function useVRM(path: string) {
  const [vrm, setVRM] = useState<VRM | null>(null);
  useEffect(() => {
    if (!path) return;
    const loader = new GLTFLoader();
    loader.register((parser: any) => new VRMLoaderPlugin(parser));
    loader.load(path, (gltf: any) => {
      const v = gltf.userData.vrm as VRM;
      if (v?.scene) v.scene.traverse((obj: any) => { obj.frustumCulled = false; });
      setVRM(v);
    }, undefined, () => {
      // ignore load errors for now
    });
  }, [path]);
  return vrm;
}

function applyAffect(vrm: VRM, affect: Affect, dt: number, mouthOpen: number) {
  const em = vrm.expressionManager as any;
  if (!em) return;
  const set = (name: any, v: number) => em.setValue(name, Math.min(1, Math.max(0, v)));

  ["happy","angry","sad","relaxed","surprised","neutral"].forEach((n) => { try { set(n as any, 0); } catch {} });

  const a = affect.arousal;
  switch (affect.mood) {
    case "happy":
    case "playful":
    case "flirty": set(VRMExpressionPresetName.Happy, 0.7 + 0.2 * affect.valence); break;
    case "sad": set(VRMExpressionPresetName.Sad, 0.6 + 0.2 * -affect.valence); break;
    case "angry": set(VRMExpressionPresetName.Angry, 0.6 + 0.2 * a); break;
    case "surprised": set(VRMExpressionPresetName.Surprised, 0.7); break;
    case "sleepy": set(VRMExpressionPresetName.Relaxed, 0.6); break;
    default: set("neutral" as any, 0.8);
  }

  set(VRMExpressionPresetName.Aa, Math.min(1, mouthOpen * 1.4));

  const blinkSpeed = THREE.MathUtils.lerp(0.05, 0.25, 1 - a);
  const t = performance.now() / 1000;
  const blink = Math.max(0, Math.sin(t * Math.PI * blinkSpeed));
  try { set("blink" as any, blink > 0.95 ? 1 : 0); } catch {}

  const head = (vrm as any).humanoid?.getBoneNode("head");
  if (head) {
    const targetYaw = affect.gaze === "left" ? 0.2 : affect.gaze === "right" ? -0.2 : 0;
    const targetPitch = affect.gaze === "down" ? 0.15 : 0;
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetYaw, 0.05);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetPitch, 0.05);
  }

  const chest = (vrm as any).humanoid?.getBoneNode("chest");
  if (chest) {
    const breath = Math.sin(t * (0.8 + a * 1.2)) * 0.02;
    chest.position.y = breath;
  }
}

function Scene({ vrm, affect, mouthAmp }: { vrm: VRM | null; affect: Affect; mouthAmp: number }) {
  const mouthOpenRef = useRef(mouthAmp);
  useEffect(() => { mouthOpenRef.current = mouthAmp; }, [mouthAmp]);
  useFrame((_, dt) => { if (vrm) applyAffect(vrm, affect as any, dt, mouthOpenRef.current); });
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 2]} intensity={1.2} />
      <Environment preset="city" />
      {vrm && <primitive object={vrm.scene} position={[0, -1.0, 0]} />}
      <OrbitControls enablePan={false} minDistance={1.8} maxDistance={2.8} />
    </>
  );
}

export function Avatar3D({ vrmPath, affect, mouthAmp = 0 }: { vrmPath: string; affect: Affect; mouthAmp?: number; }) {
  const vrm = useVRM(vrmPath);
  return (
    <Canvas camera={{ position: [0, 1.3, 2.2], fov: 25 }}>
      <Scene vrm={vrm} affect={affect} mouthAmp={mouthAmp} />
    </Canvas>
  );
}

