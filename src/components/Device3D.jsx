import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, RoundedBox, Text } from "@react-three/drei";

function createGripGeometry() {
  const shape = new THREE.Shape();
  // Contoured ergonomic trainer grip profile (in XY plane)
  shape.moveTo(-1.32, -0.18);
  shape.lineTo(-0.56, -0.18);
  shape.lineTo(-0.74, -0.78);
  shape.lineTo(-0.98, -1.62);
  shape.quadraticCurveTo(-1.02, -1.72, -1.16, -1.72);
  shape.lineTo(-1.72, -1.62);
  shape.quadraticCurveTo(-1.82, -1.58, -1.78, -1.46);
  shape.lineTo(-1.46, -0.52);
  shape.quadraticCurveTo(-1.4, -0.32, -1.32, -0.18);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.44,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.055,
    bevelThickness: 0.055,
  });
  geo.translate(0, 0, -0.22);
  geo.computeVertexNormals();
  return geo;
}

function createTriggerGuardGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.62, -0.22);
  shape.lineTo(0.42, -0.22);
  shape.lineTo(0.32, -0.74);
  shape.quadraticCurveTo(0.28, -0.82, 0.16, -0.82);
  shape.lineTo(-0.68, -0.82);
  shape.lineTo(-0.62, -0.22);

  const hole = new THREE.Path();
  hole.moveTo(-0.52, -0.32);
  hole.lineTo(0.28, -0.32);
  hole.lineTo(0.21, -0.68);
  hole.quadraticCurveTo(0.18, -0.73, 0.11, -0.73);
  hole.lineTo(-0.58, -0.73);
  hole.lineTo(-0.52, -0.32);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  geo.translate(0, 0, -0.11);
  geo.computeVertexNormals();
  return geo;
}

function createSlideBevelGeometry() {
  const shape = new THREE.Shape();
  // Chamfered slide cross-section (in YZ plane, extruded along X)
  shape.moveTo(-0.28, -0.22);
  shape.lineTo(0.28, -0.22);
  shape.lineTo(0.28, 0.16);
  shape.lineTo(0.19, 0.27);
  shape.lineTo(-0.19, 0.27);
  shape.lineTo(-0.28, 0.16);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 3.18,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  });
  // Rotate so extrusion runs along +X and center it
  geo.rotateY(Math.PI / 2);
  geo.translate(-1.59, 0.28, 0);
  geo.computeVertexNormals();
  return geo;
}

function SmartTrainerModel({
  mode = "LOCKED",
  fault = false,
  ammo = 10,
  distance = null,
}) {
  const accentLightRef = useRef(null);
  const pulseRingRef = useRef(null);
  const ledMatRef = useRef(null);

  const gripGeo = useMemo(() => createGripGeometry(), []);
  const guardGeo = useMemo(() => createTriggerGuardGeometry(), []);
  const slideGeo = useMemo(() => createSlideBevelGeometry(), []);

  useEffect(() => {
    return () => {
      gripGeo.dispose();
      guardGeo.dispose();
      slideGeo.dispose();
    };
  }, [gripGeo, guardGeo, slideGeo]);

  const isTraining = !fault && mode === "TRAINING";
  const accentColor = fault ? "#ff4d6a" : isTraining ? "#3ee6b8" : "#5ea8ff";
  const ledSecondary = fault ? "#ff2e51" : isTraining ? "#7af5d4" : "#89beff";

  const clampedAmmo = Math.max(0, Math.min(10, Number(ammo ?? 10)));
  const oledLine1 = fault ? "FAULT LOCK" : String(mode || "LOCKED").slice(0, 10);
  const oledLine2 =
    distance == null ? "DIST: --" : `DIST: ${Number(distance).toFixed(1)}cm`;
  const oledLine3 = `CNT: ${clampedAmmo}/10`;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const speed = fault ? 7.5 : isTraining ? 2.6 : 1.3;
    const pulse = 0.5 + 0.5 * Math.sin(t * speed);

    if (ledMatRef.current) {
      ledMatRef.current.emissiveIntensity = fault
        ? 1.1 + pulse * 1.9
        : 0.9 + pulse * 0.7;
    }

    if (accentLightRef.current) {
      accentLightRef.current.intensity = fault
        ? 5 + pulse * 9
        : isTraining
          ? 7 + pulse * 3
          : 4 + pulse * 1.5;
    }

    if (pulseRingRef.current) {
      const wave = (t * (isTraining ? 0.9 : 0.45)) % 1;
      const scale = 0.65 + wave * 1.65;
      pulseRingRef.current.scale.set(scale, scale, 1);
      pulseRingRef.current.position.x = 1.62 + wave * 0.75;
      pulseRingRef.current.material.opacity = fault
        ? 0
        : (1 - wave) * (isTraining ? 0.48 : 0.18);
    }
  });

  const serrationXs = [-1.36, -1.24, -1.12, -1.0, -0.88, -0.76];
  const frontSerrationXs = [0.76, 0.88, 1.0, 1.12];
  const railSlotXs = [-0.4, -0.15, 0.1, 0.35, 0.6, 0.85, 1.1];
  const ventXs = [0.72, 0.95, 1.18];

  return (
    <group rotation={[0, -0.32, 0]} position={[0.08, 0.25, 0]}>
      {/* Dynamic status accent light */}
      <pointLight
        ref={accentLightRef}
        position={[0.6, 0.4, 1.6]}
        distance={6}
        intensity={8}
        color={accentColor}
      />

      {/* === UPPER MACHINED SLIDE / SENSOR CHASSIS === */}
      <mesh geometry={slideGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#1e2d3f"
          metalness={0.82}
          roughness={0.28}
          clearcoat={0.35}
          clearcoatRoughness={0.25}
        />
      </mesh>

      {/* Top optic rail spine */}
      <RoundedBox
        args={[2.4, 0.075, 0.26]}
        radius={0.015}
        smoothness={3}
        position={[0.05, 0.59, 0]}
      >
        <meshStandardMaterial color="#14202e" metalness={0.78} roughness={0.35} />
      </RoundedBox>

      {/* Picatinny-style top rail ribs */}
      {railSlotXs.map((x) => (
        <mesh key={`rail-${x}`} position={[x, 0.635, 0]}>
          <boxGeometry args={[0.13, 0.032, 0.27]} />
          <meshStandardMaterial color="#27394d" metalness={0.75} roughness={0.3} />
        </mesh>
      ))}

      {/* Compact Holo/Reflex Optical Module on top rail */}
      <group position={[-0.55, 0.72, 0]}>
        <RoundedBox args={[0.72, 0.12, 0.36]} radius={0.02} smoothness={3} position={[0, -0.05, 0]}>
          <meshStandardMaterial color="#182534" metalness={0.8} roughness={0.3} />
        </RoundedBox>
        {/* Optic hood left/right/top */}
        <mesh position={[0, 0.12, 0.16]}>
          <boxGeometry args={[0.54, 0.24, 0.04]} />
          <meshStandardMaterial color="#1c2c3e" metalness={0.82} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.12, -0.16]}>
          <boxGeometry args={[0.54, 0.24, 0.04]} />
          <meshStandardMaterial color="#1c2c3e" metalness={0.82} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.23, 0]}>
          <boxGeometry args={[0.54, 0.04, 0.36]} />
          <meshStandardMaterial color="#223549" metalness={0.85} roughness={0.22} />
        </mesh>
        {/* Tinted holographic glass lens */}
        <mesh position={[0.04, 0.11, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.27, 0.19]} />
          <meshPhysicalMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={0.28}
            transparent
            opacity={0.26}
            roughness={0.05}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Reticle dot inside lens */}
        <mesh position={[0.05, 0.11, 0]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial
            color={ledSecondary}
            emissive={accentColor}
            emissiveIntensity={2.6}
          />
        </mesh>
      </group>

      {/* Rear & Front Sight Posts with Glowing Fiber Dots */}
      <group position={[-1.46, 0.62, 0]}>
        <mesh position={[0, 0, 0.095]}>
          <boxGeometry args={[0.14, 0.11, 0.06]} />
          <meshStandardMaterial color="#131e2c" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, -0.095]}>
          <boxGeometry args={[0.14, 0.11, 0.06]} />
          <meshStandardMaterial color="#131e2c" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[-0.072, 0.015, 0.095]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2} />
        </mesh>
        <mesh position={[-0.072, 0.015, -0.095]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2} />
        </mesh>
      </group>
      <group position={[1.45, 0.62, 0]}>
        <mesh>
          <boxGeometry args={[0.14, 0.12, 0.065]} />
          <meshStandardMaterial color="#131e2c" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[-0.072, 0.02, 0]}>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2.4} />
        </mesh>
      </group>

      {/* Machined Rear & Front Slide Serrations (both sides) */}
      {[-1, 1].map((side) => (
        <group key={`serrations-${side}`}>
          {serrationXs.map((x) => (
            <mesh
              key={`rs-${side}-${x}`}
              position={[x, 0.27, side * 0.295]}
              rotation={[0, 0, -0.22]}
            >
              <boxGeometry args={[0.045, 0.3, 0.03]} />
              <meshStandardMaterial color="#0e1722" metalness={0.6} roughness={0.5} />
            </mesh>
          ))}
          {frontSerrationXs.map((x) => (
            <mesh
              key={`fs-${side}-${x}`}
              position={[x, 0.27, side * 0.295]}
              rotation={[0, 0, -0.22]}
            >
              <boxGeometry args={[0.045, 0.24, 0.03]} />
              <meshStandardMaterial color="#0e1722" metalness={0.6} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Upper Cooling / Telemetry Port Vents */}
      {ventXs.map((x) => (
        <mesh key={`vent-${x}`} position={[x, 0.56, 0]}>
          <boxGeometry args={[0.14, 0.02, 0.34]} />
          <meshStandardMaterial color="#0a121c" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}

      {/* Recessed Ejection / Sensor Calibration Bay */}
      <mesh position={[0.16, 0.36, 0.22]}>
        <boxGeometry args={[0.68, 0.24, 0.19]} />
        <meshStandardMaterial color="#0d1723" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0.16, 0.34, 0.14]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.115, 0.115, 0.66, 20]} />
        <meshStandardMaterial color="#3c546e" metalness={0.92} roughness={0.18} />
      </mesh>

      {/* === FRONT OPTICAL TRAINER EMITTER / BARREL SHROUD === */}
      <group position={[1.64, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        {/* Outer fluted shroud */}
        <mesh>
          <cylinderGeometry args={[0.135, 0.145, 0.36, 28]} />
          <meshStandardMaterial color="#2a3d52" metalness={0.9} roughness={0.22} />
        </mesh>
        {/* Recessed dark emitter core */}
        <mesh position={[0, -0.17, 0]}>
          <cylinderGeometry args={[0.085, 0.085, 0.06, 24]} />
          <meshStandardMaterial color="#060c14" metalness={0.4} roughness={0.5} />
        </mesh>
        {/* Glowing laser/optical trainer ring */}
        <mesh position={[0, -0.185, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.092, 0.015, 12, 28]} />
          <meshStandardMaterial
            color={ledSecondary}
            emissive={accentColor}
            emissiveIntensity={2.0}
          />
        </mesh>
      </group>

      {/* === LOWER POLYMER FRAME & UNDER-RAIL === */}
      <RoundedBox
        args={[2.92, 0.32, 0.52]}
        radius={0.045}
        smoothness={4}
        position={[0.02, -0.08, 0]}
      >
        <meshStandardMaterial color="#121e2c" metalness={0.35} roughness={0.62} />
      </RoundedBox>

      {/* Glowing Cyber Seam LED Strip (both sides) */}
      {[-1, 1].map((side) => (
        <mesh key={`seam-${side}`} position={[0.08, 0.08, side * 0.278]}>
          <boxGeometry args={[2.52, 0.032, 0.02]} />
          <meshStandardMaterial
            ref={side === 1 ? ledMatRef : undefined}
            color={ledSecondary}
            emissive={accentColor}
            emissiveIntensity={1.6}
          />
        </mesh>
      ))}

      {/* === HC-SR04 ULTRASONIC SMART SENSOR POD (UNDER FRONT RAIL) === */}
      <group position={[1.05, -0.34, 0]}>
        <RoundedBox args={[0.88, 0.28, 0.48]} radius={0.04} smoothness={4}>
          <meshStandardMaterial color="#162638" metalness={0.65} roughness={0.35} />
        </RoundedBox>
        {/* Dual ultrasonic transducers (front face, left & right) */}
        {[-0.125, 0.125].map((zOff, i) => (
          <group
            key={`transducer-${i}`}
            position={[0.45, 0, zOff]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <mesh>
              <cylinderGeometry args={[0.095, 0.095, 0.09, 24]} />
              <meshStandardMaterial color="#9eb4c9" metalness={0.92} roughness={0.18} />
            </mesh>
            <mesh position={[0, -0.046, 0]}>
              <cylinderGeometry args={[0.072, 0.072, 0.015, 20]} />
              <meshStandardMaterial
                color="#091521"
                emissive={accentColor}
                emissiveIntensity={0.45}
                metalness={0.4}
                roughness={0.4}
              />
            </mesh>
          </group>
        ))}
        {/* Side sensor status LED */}
        <mesh position={[0.12, -0.04, 0.245]}>
          <sphereGeometry args={[0.032, 16, 16]} />
          <meshStandardMaterial
            color={ledSecondary}
            emissive={accentColor}
            emissiveIntensity={2.2}
          />
        </mesh>
      </group>

      {/* Expanding ultrasonic telemetry wave ring */}
      <mesh
        ref={pulseRingRef}
        position={[1.7, -0.34, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <ringGeometry args={[0.14, 0.175, 32]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* === SIDE-MOUNTED LIVE OLED TELEMETRY SCREEN (SSD1306) === */}
      <group position={[-0.22, 0.26, 0.305]}>
        {/* Bezel */}
        <RoundedBox args={[0.88, 0.34, 0.04]} radius={0.02} smoothness={3}>
          <meshStandardMaterial color="#0c1520" metalness={0.7} roughness={0.3} />
        </RoundedBox>
        {/* Glowing OLED glass */}
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[0.78, 0.26]} />
          <meshStandardMaterial
            color="#04131c"
            emissive={accentColor}
            emissiveIntensity={0.22}
            roughness={0.15}
          />
        </mesh>
        {/* Live Telemetry Text */}
        <Text
          position={[-0.34, 0.068, 0.026]}
          fontSize={0.072}
          color={accentColor}
          anchorX="left"
          anchorY="middle"
        >
          {oledLine1}
        </Text>
        <Text
          position={[-0.34, -0.015, 0.026]}
          fontSize={0.056}
          color="#d8f4ff"
          anchorX="left"
          anchorY="middle"
        >
          {oledLine2}
        </Text>
        <Text
          position={[-0.34, -0.085, 0.026]}
          fontSize={0.052}
          color="#8fb6cf"
          anchorX="left"
          anchorY="middle"
        >
          {oledLine3}
        </Text>
      </group>

      {/* === TRIGGER GUARD & ELECTRONIC ACTUATOR SWITCH === */}
      <mesh geometry={guardGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#152333" metalness={0.42} roughness={0.55} />
      </mesh>
      {/* Curved electronic switch */}
      <mesh position={[-0.14, -0.49, 0]} rotation={[0, 0, -0.28]}>
        <boxGeometry args={[0.075, 0.34, 0.09]} />
        <meshStandardMaterial
          color={fault ? "#802033" : "#2e465f"}
          emissive={fault ? "#ff3b5c" : accentColor}
          emissiveIntensity={fault ? 0.8 : 0.25}
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>

      {/* === ERGONOMIC CONTOURED GRIP & BATTERY / COUNTER PACK === */}
      <mesh geometry={gripGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#132030" metalness={0.28} roughness={0.72} />
      </mesh>

      {/* Textured Grip Side Panels with Biometric Pad Indicator */}
      {[-1, 1].map((side) => (
        <group
          key={`grip-panel-${side}`}
          position={[-1.24, -0.94, side * 0.265]}
          rotation={[0, 0, -0.28]}
        >
          <RoundedBox args={[0.42, 1.02, 0.04]} radius={0.02} smoothness={3}>
            <meshStandardMaterial color="#1c2f44" metalness={0.35} roughness={0.78} />
          </RoundedBox>
          {/* 5-segment virtual counter LED gauge on grip */}
          {[0, 1, 2, 3, 4].map((seg) => {
            const lit = clampedAmmo >= (seg + 1) * 2;
            return (
              <mesh
                key={`bar-${side}-${seg}`}
                position={[0.09, -0.32 + seg * 0.14, side * 0.024]}
              >
                <boxGeometry args={[0.14, 0.06, 0.015]} />
                <meshStandardMaterial
                  color={lit ? ledSecondary : "#162636"}
                  emissive={lit ? accentColor : "#000000"}
                  emissiveIntensity={lit ? 1.5 : 0}
                />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Flared Smart Battery / Magazine Baseplate */}
      <group position={[-1.4, -1.72, 0]} rotation={[0, 0, -0.22]}>
        <RoundedBox args={[0.88, 0.16, 0.56]} radius={0.03} smoothness={3}>
          <meshStandardMaterial color="#1f3247" metalness={0.75} roughness={0.3} />
        </RoundedBox>
        <mesh position={[0.42, 0, 0]}>
          <boxGeometry args={[0.05, 0.07, 0.34]} />
          <meshStandardMaterial
            color={ledSecondary}
            emissive={accentColor}
            emissiveIntensity={1.2}
          />
        </mesh>
      </group>

      {/* Rear Slide Endplate Status Indicator */}
      <group position={[-1.61, 0.28, 0]}>
        <RoundedBox args={[0.06, 0.42, 0.46]} radius={0.015} smoothness={3}>
          <meshStandardMaterial color="#182738" metalness={0.82} roughness={0.28} />
        </RoundedBox>
        <mesh position={[-0.035, 0.06, 0]}>
          <boxGeometry args={[0.02, 0.08, 0.26]} />
          <meshStandardMaterial
            color={ledSecondary}
            emissive={accentColor}
            emissiveIntensity={2.0}
          />
        </mesh>
      </group>
    </group>
  );
}

export default function Device3D({
  mode = "LOCKED",
  fault = false,
  ammo = 10,
  distance = null,
}) {
  const isTraining = !fault && mode === "TRAINING";
  const rimColor = fault ? "#ff4d6a" : isTraining ? "#3ee6b8" : "#5ea8ff";

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [3.4, 1.85, 4.35], fov: 38 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
    >
      {/* Studio three-point + rim lighting for crisp metallic depth */}
      <hemisphereLight args={["#9ed4ff", "#091523", 1.1]} />
      <directionalLight position={[5, 8, 6]} intensity={2.6} color="#e6f5ff" />
      <directionalLight position={[-6, 3, -5]} intensity={1.8} color={rimColor} />
      <directionalLight position={[0, -4, 4]} intensity={0.7} color="#2d5b7c" />

      <Float speed={1.25} rotationIntensity={0.1} floatIntensity={0.22}>
        <SmartTrainerModel
          mode={mode}
          fault={fault}
          ammo={ammo}
          distance={distance}
        />
      </Float>

      {/* Holographic floor pedestal + grid */}
      <group position={[0, -1.78, 0]}>
        <gridHelper args={[12, 20, "#1f4561", "#122437"]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[1.55, 1.62, 48]} />
          <meshBasicMaterial color={rimColor} transparent opacity={0.35} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <circleGeometry args={[1.54, 48]} />
          <meshBasicMaterial color="#0c1c2e" transparent opacity={0.45} />
        </mesh>
      </group>

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.07}
        minDistance={3.0}
        maxDistance={8.5}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 1.95}
      />
    </Canvas>
  );
}
