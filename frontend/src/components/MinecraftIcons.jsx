import React from 'react';

// Authentic Minecraft 16x16 Pixel Art Icons (SVG Pixel Matrices)

export function GrassBlockIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: 'pixelated', display: 'inline-block' }}>
      {/* Dirt Base */}
      <rect x="0" y="0" width="16" height="16" fill="#593d29" />
      <rect x="2" y="8" width="2" height="2" fill="#462f1e" />
      <rect x="8" y="10" width="2" height="2" fill="#462f1e" />
      <rect x="12" y="7" width="2" height="2" fill="#462f1e" />
      <rect x="5" y="13" width="2" height="2" fill="#462f1e" />
      <rect x="11" y="13" width="2" height="2" fill="#755238" />
      <rect x="3" y="11" width="2" height="2" fill="#755238" />
      {/* Grass Top Layer with drips */}
      <rect x="0" y="0" width="16" height="5" fill="#4d9430" />
      <rect x="1" y="1" width="14" height="2" fill="#62b83d" />
      <rect x="2" y="5" width="2" height="2" fill="#4d9430" />
      <rect x="6" y="5" width="2" height="3" fill="#4d9430" />
      <rect x="10" y="5" width="2" height="2" fill="#4d9430" />
      <rect x="13" y="5" width="2" height="3" fill="#4d9430" />
      <rect x="6" y="6" width="2" height="1" fill="#3b7324" />
      <rect x="13" y="6" width="2" height="1" fill="#3b7324" />
    </svg>
  );
}

export function NetherPortalIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: 'pixelated', display: 'inline-block' }}>
      {/* Obsidian Frame */}
      <rect x="1" y="0" width="14" height="16" fill="#140c21" />
      <rect x="2" y="1" width="12" height="1" fill="#2b1a45" />
      <rect x="1" y="2" width="2" height="12" fill="#2b1a45" />
      <rect x="13" y="2" width="2" height="12" fill="#0c0714" />
      <rect x="2" y="14" width="12" height="1" fill="#0c0714" />
      {/* Portal Purple Swirl */}
      <rect x="3" y="2" width="10" height="12" fill="#6c249c" />
      <rect x="4" y="3" width="3" height="3" fill="#a24ad9" />
      <rect x="8" y="7" width="4" height="3" fill="#a24ad9" />
      <rect x="4" y="9" width="3" height="4" fill="#a24ad9" />
      <rect x="7" y="4" width="2" height="2" fill="#d884fc" />
      <rect x="9" y="8" width="2" height="2" fill="#d884fc" />
      <rect x="5" y="10" width="2" height="2" fill="#d884fc" />
    </svg>
  );
}

export function EyeOfEnderIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: 'pixelated', display: 'inline-block' }}>
      {/* Pearl Outer Circle */}
      <rect x="4" y="1" width="8" height="14" fill="#1b4d3e" />
      <rect x="2" y="3" width="12" height="10" fill="#1b4d3e" />
      <rect x="1" y="4" width="14" height="8" fill="#1b4d3e" />
      {/* Inner Green Shell */}
      <rect x="4" y="2" width="8" height="12" fill="#2e8564" />
      <rect x="3" y="3" width="10" height="10" fill="#2e8564" />
      <rect x="2" y="4" width="12" height="8" fill="#2e8564" />
      {/* Highlight glow */}
      <rect x="4" y="3" width="3" height="3" fill="#52d49c" />
      {/* Slit Pupil */}
      <rect x="7" y="4" width="2" height="8" fill="#e85b2e" />
      <rect x="6" y="6" width="4" height="4" fill="#ff7a45" />
      <rect x="7" y="7" width="2" height="2" fill="#0d1f18" />
    </svg>
  );
}

export function WaterfallBeaconIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: 'pixelated', display: 'inline-block' }}>
      {/* Obsidian Base */}
      <rect x="2" y="12" width="12" height="4" fill="#181224" />
      <rect x="3" y="13" width="10" height="2" fill="#2e2145" />
      {/* Glass Casing */}
      <rect x="3" y="4" width="10" height="8" fill="rgba(85, 255, 255, 0.2)" />
      <rect x="3" y="4" width="10" height="1" fill="#75e8e8" />
      <rect x="3" y="4" width="1" height="8" fill="#75e8e8" />
      {/* Diamond Core */}
      <rect x="6" y="6" width="4" height="4" fill="#2dbdbd" />
      <rect x="7" y="7" width="2" height="2" fill="#9effff" />
      {/* Radiant Beam */}
      <rect x="7" y="0" width="2" height="6" fill="#baffff" />
      <rect x="6" y="0" width="4" height="4" fill="rgba(85, 255, 255, 0.4)" />
    </svg>
  );
}

export function LobbyCrownIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: 'pixelated', display: 'inline-block' }}>
      {/* Golden Crown */}
      <rect x="1" y="6" width="3" height="7" fill="#de9b00" />
      <rect x="6" y="4" width="4" height="9" fill="#de9b00" />
      <rect x="12" y="6" width="3" height="7" fill="#de9b00" />
      <rect x="2" y="11" width="12" height="3" fill="#ffc83b" />
      <rect x="2" y="7" width="1" height="4" fill="#fff194" />
      <rect x="7" y="5" width="2" height="6" fill="#fff194" />
      <rect x="13" y="7" width="1" height="4" fill="#fff194" />
      {/* Jewels */}
      <rect x="4" y="12" width="2" height="1" fill="#e82e2e" />
      <rect x="7" y="12" width="2" height="1" fill="#329ba8" />
      <rect x="10" y="12" width="2" height="1" fill="#44bd32" />
    </svg>
  );
}

export function RedstoneTorchIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: 'pixelated', display: 'inline-block' }}>
      {/* Wood Stick */}
      <rect x="7" y="7" width="2" height="8" fill="#4d301b" />
      <rect x="7" y="8" width="1" height="6" fill="#754e31" />
      {/* Redstone Head */}
      <rect x="6" y="2" width="4" height="5" fill="#a81919" />
      <rect x="7" y="3" width="2" height="3" fill="#ff4d4d" />
      <rect x="7" y="3" width="1" height="1" fill="#ffffff" />
    </svg>
  );
}

export function CommandBlockIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: 'pixelated', display: 'inline-block' }}>
      {/* Orange Block Body */}
      <rect x="1" y="1" width="14" height="14" fill="#a66a38" />
      <rect x="2" y="2" width="12" height="12" fill="#c48348" />
      <rect x="1" y="1" width="14" height="1" fill="#e09c5c" />
      <rect x="1" y="1" width="1" height="14" fill="#e09c5c" />
      <rect x="14" y="2" width="1" height="13" fill="#6e3e18" />
      <rect x="2" y="14" width="13" height="1" fill="#6e3e18" />
      {/* Center Console Circle */}
      <rect x="5" y="5" width="6" height="6" fill="#697684" />
      <rect x="6" y="6" width="4" height="4" fill="#b9cad6" />
      <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
    </svg>
  );
}
