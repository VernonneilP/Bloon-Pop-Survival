// ============================================================================
// BLOONS BLITZ BUILD 13 MASTER ENGINE (src/bloons_build13_engine.js)
// - 1:1 Authentic BTD6 3D MOABs, Fortified Airships & All 7 Boss Bloons
// - Interactive Dev Showcase World (Horizontal Lineup + WAILA HUD + 0 Attacks)
// - Strict Sequential Upgrade Paths + Path-Specific 3D Models & Projectiles
// - 3D Dimensional Rift Boss Entrance + Device Haptics + 740px Modal Cap
// ============================================================================
(function initBloonsBuild13MasterEngine() {
  'use strict';
  if (window.__B13_MASTER_ENGINE_ACTIVE) return; // Build 13 engine is merged into src/bloons_update12.js
  window.__B13_MASTER_ENGINE_ACTIVE = true;

  // --------------------------------------------------------------------------
  // 1. DEVICE HAPTIC VIBRATION ENGINE
  // --------------------------------------------------------------------------
  let hapticsEnabled = localStorage.getItem('bloons_haptics_v13') !== '0';
  let lastPopVibeTime = 0;

  window.triggerHaptic = function(pattern) {
    if (!hapticsEnabled) return;
    try {
      if (navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (e) {}
  };

  window.CustomModelRegistry = window.CustomModelRegistry || {};
  window.registerCustomBlenderModel = function(key, builderFn) {
    window.CustomModelRegistry[String(key || '').toUpperCase()] = builderFn;
  };

  // --------------------------------------------------------------------------
  // 2. HIGH-RESOLUTION PROCEDURAL HULL TEXTURES (MOAB, BFB, ZOMG, DDT, BAD, 7 BOSSES)
  // --------------------------------------------------------------------------
  const hullTextureCache = {};

  function getAirshipHullTexture(typeKey) {
    const t = String(typeKey || 'MOAB').toUpperCase().replace('FORTIFIED_', '');
    if (hullTextureCache[t]) return hullTextureCache[t];

    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d');

    const drawRibs = function(count, strokeCol, lineWidth) {
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = lineWidth || 6;
      for (let i = 0; i < count; i++) {
        const x = (i / count) * 1024;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1024);
        ctx.stroke();
      }
    };

    if (t === 'MOAB') {
      const grad = ctx.createLinearGradient(0, 0, 0, 1024);
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(0.5, '#0ea5e9');
      grad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 1024);
      drawRibs(16, '#0369a1', 8);

      // 2 White Rear Stripes
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 680, 1024, 48);
      ctx.fillRect(0, 765, 1024, 45);
      drawRibs(16, 'rgba(2, 132, 199, 0.45)', 5);

      // White Radial Nose Cap
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 1024, 185);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 185, 1024, 8);
      drawRibs(12, '#0284c7', 7);
    } else if (t === 'BFB') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, 1024, 1024);
      drawRibs(16, '#7f1d1d', 9);

      ctx.fillStyle = '#991b1b';
      ctx.fillRect(0, 0, 1024, 150);
      ctx.strokeStyle = '#450a0a';
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(0, 150); ctx.lineTo(1024, 150); ctx.stroke();

      // White Double-Crescent Nose Emblem
      ctx.fillStyle = '#ffffff';
      for (let cIdx = 0; cIdx < 2; cIdx++) {
        const cy = 240 + cIdx * 75;
        ctx.beginPath();
        ctx.arc(512, cy, 115 - cIdx * 15, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.arc(512, cy - 28, 95 - cIdx * 15, 0.85 * Math.PI, 0.15 * Math.PI, true);
        ctx.closePath();
        ctx.fill();
      }

      // Angry Slanted White Eyes
      const drawAngryEye = function(ex, ey, flip) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.scale(flip, 1);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#450a0a';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-55, -20);
        ctx.lineTo(55, 15);
        ctx.quadraticCurveTo(10, 55, -45, 25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };
      drawAngryEye(310, 215, 1);
      drawAngryEye(714, 215, -1);
    } else if (t === 'ZOMG') {
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, 0, 1024, 1024);
      drawRibs(16, '#18181b', 9);

      // Neon-Lime Nose Cone & 2 Rear Stripes
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(0, 700, 1024, 42);
      ctx.fillRect(0, 770, 1024, 42);
      ctx.fillRect(0, 0, 1024, 185);
      ctx.fillStyle = '#3f6212';
      ctx.fillRect(0, 185, 1024, 16);
      drawRibs(16, '#18181b', 7);

      // White Skull Emblem with Green Eye Sockets
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(512, 330, 125, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(455, 410, 114, 65);
      ctx.fillStyle = '#27272a';
      ctx.fillRect(485, 430, 12, 45);
      ctx.fillRect(512, 430, 12, 45);
      ctx.fillRect(539, 430, 12, 45);
      [462, 562].forEach(function(ex) {
        ctx.fillStyle = '#84cc16';
        ctx.beginPath(); ctx.arc(ex, 335, 36, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#18181b';
        ctx.beginPath(); ctx.arc(ex, 335, 22, 0, Math.PI * 2); ctx.fill();
      });
    } else if (t === 'DDT') {
      ctx.fillStyle = '#1e242b';
      ctx.fillRect(0, 0, 1024, 1024);
      const camoCols = ['#11151c', '#2b333c', '#171c22', '#333c47'];
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = camoCols[i % camoCols.length];
        ctx.beginPath();
        ctx.ellipse((i * 137) % 1024, (i * 293) % 1024, 65 + (i % 40), 40 + (i % 30), (i % 6) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      drawRibs(12, '#0f1318', 7);

      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 0, 1024, 145);
      ctx.fillRect(0, 390, 1024, 110);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 390, 1024, 110);
      ctx.fillStyle = '#cbd5e1';
      for (let r = 0; r < 16; r++) {
        ctx.beginPath(); ctx.arc(r * 64 + 32, 445, 9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 64 + 32, 115, 8, 0, Math.PI * 2); ctx.fill();
      }
    } else if (t === 'BAD') {
      ctx.fillStyle = '#9333ea';
      ctx.fillRect(0, 0, 1024, 1024);
      drawRibs(18, '#581c87', 10);

      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(0, 0, 1024, 165);
      ctx.strokeStyle = '#2e1065';
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(0, 165); ctx.lineTo(1024, 165); ctx.stroke();

      [310, 714].forEach(function(ex, idx) {
        ctx.save();
        ctx.translate(ex, 240);
        ctx.scale(idx === 0 ? 1 : -1, 1);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#3b0764';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(-65, -25);
        ctx.lineTo(65, 18);
        ctx.quadraticCurveTo(12, 65, -55, 30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    } else if (t === 'BLOONARIUS') {
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(0, 220, 1024, 160);
      ctx.fillRect(0, 560, 1024, 160);
      drawRibs(16, '#365314', 8);
      ctx.fillStyle = '#22c55e';
      for (let s = 0; s < 24; s++) {
        ctx.beginPath();
        ctx.arc((s * 97) % 1024, 300 + (s * 53) % 500, 38 + (s % 25), 0, Math.PI * 2);
        ctx.fill();
      }
      // Big Cartoon Side Eyes (matching image_e61825.jpg #1!)
      [290, 734].forEach(function(ex) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.arc(ex, 260, 56, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#18181b';
        ctx.beginPath(); ctx.arc(ex, 260, 24, 0, Math.PI * 2); ctx.fill();
      });
    } else if (t === 'LYCH') {
      ctx.fillStyle = '#1e1b2e';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = '#6b21a8';
      ctx.fillRect(0, 320, 1024, 120);
      ctx.fillRect(0, 620, 1024, 120);
      drawRibs(14, '#0f0d18', 10);
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 8;
      for (let st = 0; st < 12; st++) {
        const sx = st * 85 + 20;
        ctx.beginPath(); ctx.moveTo(sx, 290); ctx.lineTo(sx + 30, 350); ctx.stroke();
      }
      ctx.fillStyle = '#4ade80';
      [300, 724].forEach(function(ex) {
        ctx.beginPath(); ctx.arc(ex, 230, 52, 0, Math.PI * 2); ctx.fill();
      });
    } else if (t === 'VORTEX') {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 1024, 175);
      ctx.fillRect(0, 420, 1024, 110);
      ctx.fillRect(0, 720, 1024, 110);
      drawRibs(16, '#0369a1', 8);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 8;
      [[440, 260, 38], [584, 260, 38], [370, 320, 28], [654, 320, 28], [512, 215, 30]].forEach(function(e) {
        ctx.beginPath(); ctx.arc(e[0], e[1], e[2], 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    } else if (t === 'DREADBLOON') {
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 280, 1024, 95);
      ctx.fillRect(0, 540, 1024, 95);
      drawRibs(14, '#451a03', 10);
      ctx.fillStyle = '#d946ef';
      [310, 714].forEach(function(ex) {
        ctx.beginPath(); ctx.arc(ex, 230, 42, 0, Math.PI * 2); ctx.fill();
      });
    } else if (t === 'PHAYZE') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      for (let i = 0; i < 28; i++) {
        const x = (i * 73) % 1024;
        const y = (i * 131) % 1024;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 65, y);
        ctx.lineTo(x + 95, y + 55);
        ctx.stroke();
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.ellipse(512, 260, 95, 52, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#c084fc';
      ctx.beginPath(); ctx.arc(512, 260, 32, 0, Math.PI * 2); ctx.fill();
    } else if (t === 'BLASTAPOPOULOS') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(0, 260, 1024, 110);
      ctx.fillRect(0, 520, 1024, 110);
      drawRibs(16, '#7f1d1d', 9);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 0, 1024, 195);
      ctx.fillStyle = '#fb923c';
      for (let b = 0; b < 24; b++) {
        ctx.beginPath(); ctx.arc((b * 83) % 1024, (b * 41) % 180, 24, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#e879f9';
      [310, 714].forEach(function(ex) {
        ctx.beginPath(); ctx.arc(ex, 245, 44, 0, Math.PI * 2); ctx.fill();
      });
    } else if (t === 'TERRACOTTA') {
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(0, 200, 1024, 80);
      ctx.fillRect(0, 500, 1024, 80);
      ctx.fillStyle = '#14b8a6';
      ctx.fillRect(0, 280, 1024, 55);
      drawRibs(16, '#431407', 8);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    hullTextureCache[t] = tex;
    return tex;
  }

  function buildAuthentic3DAirshipOrBoss(rawType) {
    const upper = String(rawType || 'MOAB').toUpperCase();
    const isFortified = upper.indexOf('FORTIFIED_') === 0;
    const t = upper.replace('FORTIFIED_', '');

    if (window.CustomModelRegistry && typeof window.CustomModelRegistry[upper] === 'function') {
      return window.CustomModelRegistry[upper](upper);
    }

    const HIERARCHY = {
      MOAB:           { scale: 1.25, w: 0.96, h: 0.92, l: 1.48, finCol: 0x0284c7, ribCol: 0x0369a1, engines: 0 },
      DDT:            { scale: 1.55, w: 0.84, h: 0.82, l: 1.58, finCol: 0x334155, ribCol: 0x0f172a, engines: 0, isDdt: true },
      BFB:            { scale: 2.00, w: 1.18, h: 1.05, l: 1.55, finCol: 0xb91c1c, ribCol: 0x7f1d1d, engines: 2, podCol: 0xb91c1c, cowlCol: 0xffffff },
      ZOMG:           { scale: 2.75, w: 1.24, h: 1.10, l: 1.66, finCol: 0x84cc16, ribCol: 0x18181b, engines: 4, podCol: 0x27272a, cowlCol: 0x84cc16 },
      BAD:            { scale: 3.70, w: 1.35, h: 1.18, l: 1.78, finCol: 0xa855f7, ribCol: 0x581c87, engines: 4, podCol: 0x7e22ce, cowlCol: 0xffffff, isBad: true },
      BLOONARIUS:     { scale: 4.30, w: 1.38, h: 1.22, l: 1.72, finCol: 0x4d7c0f, ribCol: 0x365314, engines: 0, boss: 'bloonarius' },
      LYCH:           { scale: 4.25, w: 1.20, h: 1.12, l: 1.75, finCol: 0x7e22ce, ribCol: 0x3b0764, engines: 0, boss: 'lych' },
      VORTEX:         { scale: 4.25, w: 1.22, h: 1.08, l: 1.72, finCol: 0x1e293b, ribCol: 0x0369a1, engines: 2, podCol: 0x0284c7, cowlCol: 0x67e8f9, boss: 'vortex' },
      DREADBLOON:     { scale: 4.35, w: 1.28, h: 1.15, l: 1.65, finCol: 0xfacc15, ribCol: 0x78350f, engines: 2, podCol: 0x78350f, cowlCol: 0xfacc15, boss: 'dreadbloon' },
      PHAYZE:         { scale: 4.35, w: 0.85, h: 0.90, l: 1.70, finCol: 0x1e1b4b, ribCol: 0x38bdf8, engines: 0, boss: 'phayze' },
      BLASTAPOPOULOS: { scale: 4.45, w: 1.32, h: 1.18, l: 1.75, finCol: 0x991b1b, ribCol: 0x7f1d1d, engines: 2, podCol: 0xdc2626, cowlCol: 0xfacc15, boss: 'blastapopoulos' },
      TERRACOTTA:     { scale: 4.40, w: 1.15, h: 1.10, l: 1.85, finCol: 0x0d9488, ribCol: 0xd97706, engines: 0, boss: 'terracotta' }
    };

    const cfg = HIERARCHY[t] || HIERARCHY.MOAB;
    const group = new THREE.Group();
    const propellers = [];

    const hullMat = new THREE.MeshStandardMaterial({
      map: getAirshipHullTexture(t),
      roughness: 0.38,
      metalness: t === 'DDT' ? 0.45 : 0.14
    });
    const finMat = new THREE.MeshStandardMaterial({ color: cfg.finCol, roughness: 0.38, metalness: 0.22 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.72 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45, metalness: 0.4 });

    const buildHullBody = function(offsetX) {
      const hGrp = new THREE.Group();
      const hullGeo = new THREE.SphereGeometry(1.15, 32, 24);
      hullGeo.rotateX(Math.PI / 2);
      const hullMesh = new THREE.Mesh(hullGeo, hullMat);
      hullMesh.scale.set(cfg.w, cfg.h, cfg.l);
      hullMesh.position.set(offsetX, 1.65, 0);
      hGrp.add(hullMesh);

      // 3D Sculpted Tail Cone & 4 Tail Fins
      const tailZ = -1.08 * cfg.l;
      const tailCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42 * cfg.w, 0.48, 14).rotateX(Math.PI / 2), darkMat);
      tailCap.position.set(offsetX, 1.65, tailZ);
      hGrp.add(tailCap);

      for (let f = 0; f < 4; f++) {
        const fa = (f / 4) * Math.PI * 2 + (t === 'BAD' || t === 'DDT' ? Math.PI / 4 : 0);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.88, 0.98), finMat);
        fin.position.set(offsetX + Math.cos(fa) * 0.78 * cfg.w, 1.65 + Math.sin(fa) * 0.75 * cfg.h, tailZ + 0.14);
        fin.rotation.z = fa - Math.PI / 2;
        hGrp.add(fin);
      }

      // Rear Stern Propeller
      const sternProp = new THREE.Group();
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.32, 10).rotateX(Math.PI / 2), steelMat);
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.11, 0.04), steelMat);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.96, 0.04), steelMat);
      sternProp.add(hub, b1, b2);
      sternProp.position.set(offsetX, 1.65, tailZ - 0.24);
      hGrp.add(sternProp);
      propellers.push(sternProp);

      // DDT 3D Riveted Steel Collar & Nose Cone
      if (cfg.isDdt) {
        const ddtNose = new THREE.Mesh(new THREE.ConeGeometry(0.48 * cfg.w, 0.45, 16).rotateX(Math.PI / 2), steelMat);
        ddtNose.position.set(offsetX, 1.65, 1.12 * cfg.l);
        const ddtCollar = new THREE.Mesh(new THREE.TorusGeometry(1.12 * cfg.w, 0.06, 8, 28), steelMat);
        ddtCollar.scale.set(1, cfg.h / cfg.w, 1);
        ddtCollar.position.set(offsetX, 1.65, 0.28);
        hGrp.add(ddtNose, ddtCollar);
      }

      // Fortified 3D Copper/Bronze & Iron Riveted Armor Bands (image_e614e6.jpg!)
      if (isFortified) {
        const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.28, metalness: 0.68 });
        [-0.55, 0.15, 0.72].forEach(function(zPos) {
          const rRadius = 1.16 * cfg.w * Math.sqrt(Math.max(0.15, 1 - Math.pow(zPos / cfg.l, 2)));
          const band = new THREE.Mesh(new THREE.TorusGeometry(rRadius, 0.08, 10, 28), bronzeMat);
          band.scale.set(1, cfg.h / cfg.w, 1);
          band.position.set(offsetX, 1.65, zPos);
          hGrp.add(band);
          // 8 3D Iron Rivet Studs around each Fortified strap
          for (let rv = 0; rv < 8; rv++) {
            const ra = (rv / 8) * Math.PI * 2;
            const stud = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), steelMat);
            stud.position.set(offsetX + Math.cos(ra) * rRadius, 1.65 + Math.sin(ra) * rRadius * (cfg.h / cfg.w), zPos);
            hGrp.add(stud);
          }
        });
      }
      return hGrp;
    };

    if (cfg.boss === 'phayze') {
      group.add(buildHullBody(-0.98));
      group.add(buildHullBody(0.98));
      const riftRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.48, 0.09, 8, 28).rotateX(Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      riftRing.position.set(0, 1.65, 0);
      group.add(riftRing);
      propellers.push(riftRing);
    } else if (cfg.boss === 'terracotta') {
      // 7th Boss: 5 Articulated Undulating Stone Serpent Segments + Feathered Aztec Mask!
      const stoneMat = new THREE.MeshStandardMaterial({ map: getAirshipHullTexture('TERRACOTTA'), roughness: 0.5 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.6 });
      const featherMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.35 });
      const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x22d3ee });

      for (let seg = 0; seg < 5; seg++) {
        const sScale = 1.0 - seg * 0.13;
        const sGrp = new THREE.Group();
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.95 * sScale, 0.82 * sScale, 0.85, 14).rotateX(Math.PI / 2), stoneMat);
        const gRim = new THREE.Mesh(new THREE.TorusGeometry(0.96 * sScale, 0.06, 8, 20), goldMat);
        sGrp.add(cyl, gRim);
        sGrp.position.set(Math.sin(seg * 0.8) * 0.55, 1.65 + Math.cos(seg * 0.9) * 0.25, (1.2 - seg * 0.78));
        group.add(sGrp);
      }
      // Aztec Mask Eyes & Turquoise Feather Plume Crown on Head Segment
      [-0.42, 0.42].forEach(function(ex) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), cyanGlow);
        eye.position.set(ex, 1.75, 1.58);
        group.add(eye);
      });
      for (let f = -3; f <= 3; f++) {
        const plume = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.15, 5), featherMat);
        plume.position.set(Math.sin(f * 0.32) * 1.1, 2.45 + Math.cos(f * 0.32) * 0.45, 1.35);
        plume.rotation.z = -f * 0.32;
        group.add(plume);
      }
    } else {
      group.add(buildHullBody(0));
    }

    // Side Engine Turbine Pods (BFB: 2, ZOMG/BAD: 4)
    if (cfg.engines >= 2) {
      const podMat = new THREE.MeshStandardMaterial({ color: cfg.podCol || 0x27272a, roughness: 0.4, metalness: 0.25 });
      const cowlMat = new THREE.MeshStandardMaterial({ color: cfg.cowlCol || 0xffffff, roughness: 0.3 });
      const podCoords = cfg.engines === 2
        ? [[-1.22 * cfg.w, 1.62, -0.38], [1.22 * cfg.w, 1.62, -0.38]]
        : [
            [-1.28 * cfg.w, 1.82, 0.18], [1.28 * cfg.w, 1.82, 0.18],
            [-1.15 * cfg.w, 1.40, -0.68], [1.15 * cfg.w, 1.40, -0.68]
          ];
      podCoords.forEach(function(pos) {
        const pGrp = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.92, 14).rotateX(Math.PI / 2), podMat);
        const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.29, 0.26, 14).rotateX(Math.PI / 2), cowlMat);
        cowl.position.z = 0.36;
        pGrp.add(body, cowl);

        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.36, 12).rotateX(Math.PI / 2), darkMat);
        cone.position.z = 0.56;
        pGrp.add(cone);

        if (cfg.isBad) {
          const wing = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.07, 0.38), finMat);
          wing.position.set(pos[0] < 0 ? -0.32 : 0.32, 0, -0.1);
          pGrp.add(wing);
        } else {
          const prop = new THREE.Group();
          prop.add(
            new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.09, 0.03), steelMat),
            new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.78, 0.03), steelMat)
          );
          prop.position.z = 0.52;
          pGrp.add(prop);
          propellers.push(prop);
        }

        pGrp.position.set(pos[0], pos[1], pos[2]);
        group.add(pGrp);
      });
    }

    // Boss-Specific Sculpted 3D Anatomy
    if (cfg.boss === 'bloonarius') {
      const mouthRim = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.14, 10, 24), new THREE.MeshStandardMaterial({ color: 0xc2410c }));
      mouthRim.position.set(0, 1.65, 1.12 * cfg.l);
      const fan = new THREE.Group();
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.04), steelMat);
        blade.rotation.z = (b / 3) * Math.PI;
        fan.add(blade);
      }
      fan.position.set(0, 1.65, 1.08 * cfg.l);
      propellers.push(fan);
      group.add(mouthRim, fan);

      const slimeMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      for (let d = 0; d < 10; d++) {
        const drop = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 8).rotateX(Math.PI), slimeMat);
        drop.position.set((d % 2 === 0 ? -0.55 : 0.55) * (0.5 + (d % 3) * 0.3), 0.55, -0.8 + d * 0.18);
        group.add(drop);
      }
    } else if (cfg.boss === 'lych') {
      const spikeMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.3 });
      for (let s = 0; s < 6; s++) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.95, 6), spikeMat);
        sp.position.set((s % 2 === 0 ? -0.35 : 0.35), 2.75, -0.9 + s * 0.28);
        sp.rotation.x = -0.35;
        group.add(sp);
      }
    } else if (cfg.boss === 'vortex') {
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
      [-1, 1].forEach(function(dir) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 0.85), wingMat);
        wing.position.set(dir * 1.45, 1.45, 0.1);
        wing.rotation.y = dir * -0.28;
        group.add(wing);
      });
    } else if (cfg.boss === 'dreadbloon') {
      const drillGrp = new THREE.Group();
      for (let d = 0; d < 5; d++) {
        const r1 = 0.85 * (1 - d * 0.18);
        const r2 = 0.85 * (1 - (d + 1) * 0.18);
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(r2, r1, 0.28, 12).rotateX(Math.PI / 2),
          d % 2 === 0 ? steelMat : new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 })
        );
        seg.position.z = d * 0.26;
        drillGrp.add(seg);
      }
      drillGrp.position.set(0, 1.65, 0.98 * cfg.l);
      group.add(drillGrp);
      propellers.push(drillGrp);
    } else if (cfg.boss === 'blastapopoulos') {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 });
      const lavaMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      for (let h = 0; h < 5; h++) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.85, 8), hornMat);
        horn.position.set(0, 2.75, -0.7 + h * 0.35);
        horn.rotation.x = -0.45;
        group.add(horn);
      }
      for (let f = 0; f < 6; f++) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), lavaMat);
        const fa = (f / 6) * Math.PI * 2;
        orb.position.set(Math.cos(fa) * 1.45, 1.65 + Math.sin(fa) * 0.85, (f - 2.5) * 0.35);
        group.add(orb);
      }
    }

    group.scale.setScalar(cfg.scale);
    group.userData = {
      moabType: upper,
      baseHierarchyScale: cfg.scale,
      propellers: propellers,
      isAuthenticB13: true
    };
    return group;
  }

  // --------------------------------------------------------------------------
  // 3. UNIVERSAL 5-TIER EVOLUTION PALETTES & PROJECTILE PROFILES FOR ALL 10
  //    HEROES AND ALL 14 MONKEY COMPANIONS
  // --------------------------------------------------------------------------
  const EVOLUTION_PALETTES = {
    quincy:       { t1: [0x16a34a, 0xfacc15], t2: [0x2563eb, 0x38bdf8], t3: [0x7e22ce, 0xe879f9], t4: [0xdc2626, 0xfbbf24], t5: [0xfef08a, 0x38bdf8], proj: [0xfef08a, 0x38bdf8, 0xc084fc, 0xf97316, 0x00ffff] },
    gwendolin:    { t1: [0xea580c, 0xfacc15], t2: [0xdc2626, 0xfde047], t3: [0x2563eb, 0x60a5fa], t4: [0x9333ea, 0xf472b6], t5: [0xffffff, 0x38bdf8], proj: [0xf97316, 0xff2a2a, 0x38bdf8, 0xe879f9, 0xfef08a] },
    obyn:         { t1: [0x15803d, 0x4ade80], t2: [0x0d9488, 0x2dd4bf], t3: [0x0284c7, 0x38bdf8], t4: [0x7e22ce, 0xc084fc], t5: [0xfacc15, 0x4ade80], proj: [0x22c55e, 0x2dd4bf, 0x38bdf8, 0xc084fc, 0xfef08a] },
    sauda:        { t1: [0xdc2626, 0xf8fafc], t2: [0x991b1b, 0xfacc15], t3: [0x4c1d95, 0xe879f9], t4: [0x0f172a, 0x38bdf8], t5: [0xfacc15, 0xffffff], proj: [0xf8fafc, 0xfacc15, 0xe879f9, 0x38bdf8, 0xfef08a] },
    benjamin:     { t1: [0x1e293b, 0x22c55e], t2: [0x0f172a, 0x38bdf8], t3: [0x311042, 0xe879f9], t4: [0x78350f, 0xfacc15], t5: [0xfef08a, 0x22d3ee], proj: [0x22c55e, 0x38bdf8, 0xe879f9, 0xfacc15, 0xffffff] },
    supermonkey:  { t1: [0x0284c7, 0xdc2626], t2: [0x1d4ed8, 0xff1e1e], t3: [0x6b21a8, 0xd946ef], t4: [0xfacc15, 0xfef08a], t5: [0xffffff, 0xfacc15], proj: [0xef4444, 0xff1e1e, 0xc026d3, 0xfacc15, 0xffffff] },
    rosalia:      { t1: [0xea580c, 0x06b6d4], t2: [0xd97706, 0x22d3ee], t3: [0x7e22ce, 0x38bdf8], t4: [0xdc2626, 0xfacc15], t5: [0xfef08a, 0x06b6d4], proj: [0x06b6d4, 0x22d3ee, 0xc084fc, 0xfacc15, 0xffffff] },
    corvus:       { t1: [0x311042, 0x22d3ee], t2: [0x4c1d95, 0x38bdf8], t3: [0x581c87, 0xe879f9], t4: [0x0f172a, 0x4ade80], t5: [0xfacc15, 0xc084fc], proj: [0x22d3ee, 0x38bdf8, 0xe879f9, 0x4ade80, 0xfef08a] },
    geraldo:      { t1: [0x1e3a8a, 0xfacc15], t2: [0x0f766e, 0xfde047], t3: [0x6b21a8, 0xfbbf24], t4: [0x991b1b, 0xfef08a], t5: [0xfacc15, 0x38bdf8], proj: [0x38bdf8, 0x2dd4bf, 0xc084fc, 0xfacc15, 0xffffff] },
    silas:        { t1: [0x0284c7, 0xbae6fd], t2: [0x0369a1, 0x67e8f9], t3: [0x1d4ed8, 0x38bdf8], t4: [0x4c1d95, 0xa5f3fc], t5: [0xffffff, 0x22d3ee], proj: [0x7dd3fc, 0x38bdf8, 0x22d3ee, 0xc084fc, 0xffffff] },
    super:        { t1: [0x0284c7, 0xdc2626], t2: [0x1d4ed8, 0xff1e1e], t3: [0x6b21a8, 0xd946ef], t4: [0xfacc15, 0xfef08a], t5: [0xffffff, 0xfacc15] },
    ninja:        { t1: [0xdc2626, 0x18181b], t2: [0xb91c1c, 0xfacc15], t3: [0xf8fafc, 0xdc2626], t4: [0x311042, 0xe879f9], t5: [0x0f172a, 0xfacc15] },
    wizard:       { t1: [0x1e3a8a, 0xfacc15], t2: [0x581c87, 0xc084fc], t3: [0x7c2d12, 0xf97316], t4: [0x0f172a, 0x22c55e], t5: [0x4c1d95, 0xfef08a] },
    sniper:       { t1: [0x15803d, 0x18181b], t2: [0x1e293b, 0xef4444], t3: [0x365314, 0xfacc15], t4: [0x0f172a, 0x38bdf8], t5: [0x18181b, 0xfef08a] },
    boomer:       { t1: [0xfacc15, 0xdc2626], t2: [0xeab308, 0x2563eb], t3: [0x7e22ce, 0x38bdf8], t4: [0xdc2626, 0xfef08a], t5: [0x06b6d4, 0xfacc15] },
    tack:         { t1: [0xec4899, 0xf8fafc], t2: [0xdb2777, 0xfacc15], t3: [0xea580c, 0xfef08a], t4: [0x0284c7, 0x67e8f9], t5: [0x7e22ce, 0xfacc15] },
    dartling:     { t1: [0x3f6212, 0xfacc15], t2: [0x1e293b, 0x22c55e], t3: [0x0284c7, 0x38bdf8], t4: [0x6b21a8, 0xe879f9], t5: [0x991b1b, 0xfef08a] },
    mortar:       { t1: [0x365314, 0xfacc15], t2: [0x1e293b, 0xf97316], t3: [0x7c2d12, 0xef4444], t4: [0x0f172a, 0x38bdf8], t5: [0xfacc15, 0xdc2626] },
    ice:          { t1: [0x38bdf8, 0xffffff], t2: [0x0284c7, 0xbae6fd], t3: [0x1d4ed8, 0x67e8f9], t4: [0x4c1d95, 0x22d3ee], t5: [0xfef08a, 0x38bdf8] },
    mermonkey:    { t1: [0x06b6d4, 0x2dd4bf], t2: [0x0284c7, 0x38bdf8], t3: [0x4c1d95, 0xe879f9], t4: [0x0f766e, 0xfacc15], t5: [0xfef08a, 0x22d3ee] },
    beasthandler: { t1: [0x65a30d, 0xf97316], t2: [0x0284c7, 0xfacc15], t3: [0x991b1b, 0xfef08a], t4: [0x4c1d95, 0x38bdf8], t5: [0xfacc15, 0xef4444] },
    desperado:    { t1: [0x92400e, 0xfacc15], t2: [0x78350f, 0xef4444], t3: [0x1e293b, 0x38bdf8], t4: [0x4c1d95, 0xfbbf24], t5: [0xfacc15, 0xffffff] },
    alchemist:    { t1: [0x7e22ce, 0x22c55e], t2: [0x6b21a8, 0xf97316], t3: [0xb45309, 0xfacc15], t4: [0x0f172a, 0xe879f9], t5: [0xfacc15, 0x22d3ee] },
    druid:        { t1: [0x15803d, 0x84cc16], t2: [0x0284c7, 0xfde047], t3: [0x581c87, 0x38bdf8], t4: [0x991b1b, 0xf97316], t5: [0xfef08a, 0x4ade80] }
  };

  function bootBuild13() {
    const G = window.__GAME;
    if (!G || !G.scene || !G.gameState) {
      setTimeout(bootBuild13, 50);
      return;
    }

    // ------------------------------------------------------------------------
    // A. FIX MAIN MENU & IN-GAME "SETTINGS" BUTTONS
    // ------------------------------------------------------------------------
    function wireMainMenuSettingsButton() {
      const settingsModal = document.getElementById('settings-modal');
      if (!settingsModal) return;

      const openSettingsModal = function(e) {
        if (e) e.stopPropagation();
        if (G.soundFX && G.soundFX.playBlopOrbChime) G.soundFX.playBlopOrbChime(1);
        settingsModal.classList.remove('hidden');
        settingsModal.classList.add('flex');
        settingsModal.style.zIndex = '100';
        if (!G.gameState.inStartMenu) {
          G.gameState.paused = true;
        }
      };

      document.querySelectorAll('#start-modal button, #btn-settings-toggle, #btn-open-settings').forEach(function(btn) {
        const txt = String(btn.textContent || '').toUpperCase();
        if (txt.indexOf('SETTINGS') !== -1 || btn.id === 'btn-settings-toggle' || btn.id === 'btn-open-settings') {
          if (!btn.dataset._b13SettingsWired) {
            btn.dataset._b13SettingsWired = '1';
            btn.addEventListener('click', openSettingsModal);
          }
        }
      });
    }
    wireMainMenuSettingsButton();
    setInterval(wireMainMenuSettingsButton, 900);

    // ------------------------------------------------------------------------
    // B. ENFORCE CANONICAL BTD6 SEQUENTIAL UPGRADE TREE IN HERO_CONFIGS
    // ------------------------------------------------------------------------
    if (G.HERO_CONFIGS && G.HERO_CONFIGS.supermonkey && G.HERO_CONFIGS.supermonkey.paths) {
      const smPaths = G.HERO_CONFIGS.supermonkey.paths;
      if (smPaths.volley) {
        smPaths.volley.name = 'Top Path: Solar Ascension';
        smPaths.volley.tiers = [
          { title: 'Laser Blasts', desc: 'Replaces darts with high-pierce crimson laser beams.' },
          { title: 'Plasma Blasts', desc: 'Superheated purple plasma vaporizes bloons at 2x speed!' },
          { title: 'Sun Avatar', desc: 'Transforms into the Golden Sun Avatar firing 3-way solar rays!' },
          { title: 'Sun Temple', desc: 'Ascends to the radiant Sun Temple with massive solar waves!' },
          { title: 'True Sun God', desc: 'Ultimate Paragon deity of the Sun! Obliterates all blimps!' }
        ];
      }
      if (smPaths.elemental) {
        smPaths.elemental.name = 'Mid Path: Cybernetic Terror';
        smPaths.elemental.tiers = [
          { title: 'Super Range', desc: 'Increases targeting sensor radius and projectile velocity.' },
          { title: 'Epic Range', desc: 'Long-range high-velocity pierce through dense bloon swarms.' },
          { title: 'Robo Monkey', desc: 'Dual cybernetic arm blasters fire twin streams simultaneously!' },
          { title: 'Tech Terror', desc: 'Unleashes green antimatter plasma bursts that melt armor!' },
          { title: 'The Anti-Bloon', desc: 'Supreme cybernetic juggernaut with Annihilation blast!' }
        ];
      }
      if (smPaths.explosive) {
        smPaths.explosive.name = 'Bottom Path: Dark Champion';
        smPaths.explosive.tiers = [
          { title: 'Knockback', desc: 'Heavy kinetic impact pushes bloons backward on every hit.' },
          { title: 'Ultravision', desc: 'Grants Camo sight and bonus damage to disguised bloons.' },
          { title: 'Dark Knight', desc: 'Obsidian cowl & spinning Dark Glaive-Batarangs shred MOABs!' },
          { title: 'Dark Champion', desc: 'Twin dark-matter blades slice through fortified airships!' },
          { title: 'Legend of the Night', desc: 'Ultimate dark vigilante! Black Hole portal consumes blimps!' }
        ];
      }
    }

    // Override createMOABMesh (both casings) & createBossMesh
    if (G.ProceduralAssetForge) {
      G.ProceduralAssetForge.createMOABMesh = buildAuthentic3DAirshipOrBoss;
      G.ProceduralAssetForge.createMoabMesh = buildAuthentic3DAirshipOrBoss;
      G.ProceduralAssetForge.createBossMesh = buildAuthentic3DAirshipOrBoss;
    }
    if (window.ProceduralAssetForge) {
      window.ProceduralAssetForge.createMOABMesh = buildAuthentic3DAirshipOrBoss;
      window.ProceduralAssetForge.createMoabMesh = buildAuthentic3DAirshipOrBoss;
      window.ProceduralAssetForge.createBossMesh = buildAuthentic3DAirshipOrBoss;
    }

    // Hook Haptics into sound engine events
    if (G.soundFX && !G.soundFX._hapticsHooked) {
      G.soundFX._hapticsHooked = true;
      const origPop = G.soundFX.playPop;
      if (typeof origPop === 'function') {
        G.soundFX.playPop = function() {
          const now = performance.now();
          if (now - lastPopVibeTime > 95) {
            lastPopVibeTime = now;
            window.triggerHaptic(8);
          }
          return origPop.apply(this, arguments);
        };
      }
      const origExp = G.soundFX.playExplosion;
      if (typeof origExp === 'function') {
        G.soundFX.playExplosion = function() {
          window.triggerHaptic([35, 30, 55]);
          return origExp.apply(this, arguments);
        };
      }
    }

    // ------------------------------------------------------------------------
    // C. UNIVERSAL 5-TIER & PATH-SPECIFIC 3D MODEL + PROJECTILE EVOLUTION
    // ------------------------------------------------------------------------
    function applyCharacterTierEvolution(mesh, unitKey, tier, pathIndex) {
      if (!mesh) return;
      const sig = String(unitKey) + '_T' + String(tier) + '_P' + String(pathIndex || 0);
      if (mesh.userData._b13EvoSig === sig) return;
      mesh.userData._b13EvoSig = sig;

      // 1. Strip any old floating brown/orange hexagon platforms above y=1.65
      const toRemove = [];
      mesh.traverse(function(child) {
        if (child.isMesh && child.geometry && (child.geometry.type === 'RingGeometry' || child.geometry.type === 'CylinderGeometry')) {
          if (child.position.y > 1.65 && child.scale.x > 0.7) {
            toRemove.push(child);
          }
        }
      });
      toRemove.forEach(function(c) { if (c.parent) c.parent.remove(c); });

      const pal = EVOLUTION_PALETTES[unitKey] || EVOLUTION_PALETTES.supermonkey;
      const tKey = 't' + Math.max(1, Math.min(5, tier));
      let cols = pal[tKey] || pal.t1;

      // Path-Specific Super Monkey Palette Overrides (Top Solar vs Mid Robo vs Bottom Dark Knight)
      if ((unitKey === 'supermonkey' || unitKey === 'super') && tier >= 3) {
        if (pathIndex === 1) cols = tier >= 5 ? [0x0f172a, 0x22c55e] : [0x475569, 0x38bdf8]; // Mid Path Robo/Tech Terror
        else if (pathIndex === 2) cols = tier >= 5 ? [0x09090b, 0xa855f7] : [0x18181b, 0x7e22ce]; // Bottom Path Dark Knight
      }

      const primaryHex = cols[0];
      const accentHex  = cols[1];

      // 2. Recolor outfit, cowl, cape & weapon meshes (and transform skin to Golden Energy for Sun Avatar T4+!)
      let meshIdx = 0;
      const isSolarAvatar = (unitKey === 'supermonkey' || unitKey === 'super') && pathIndex === 0 && tier >= 4;
      mesh.traverse(function(c) {
        if (c.isMesh && c.material && c.material.color && c.name !== 'b13_tier_crest') {
          const hex = c.material.color.getHex();
          const isEye = (hex === 0x111827 || hex === 0x000000 || hex === 0xffffff) && c.scale.x < 0.35;
          const isSkin = [0x8b4513, 0x7c2d12, 0xd97706, 0xfde68a, 0x92400e, 0x78350f].indexOf(hex) !== -1;

          if (isSolarAvatar && isSkin) {
            c.material = c.material.clone();
            c.material.color.setHex(tier >= 5 ? 0xfef08a : 0xfacc15);
            c.material.emissive = new THREE.Color(0xf59e0b);
            c.material.emissiveIntensity = 0.45;
          } else if (!isSkin && !isEye && c.position.y > 0.12) {
            c.material = c.material.clone();
            c.material.color.setHex(meshIdx % 2 === 0 ? primaryHex : accentHex);
            if (tier >= 4) {
              c.material.emissive = new THREE.Color(accentHex);
              c.material.emissiveIntensity = tier >= 5 ? 0.42 : 0.24;
            }
            meshIdx++;
          }
        }
      });

      // 3. Build Path & Tier Specific 3D Attachments (Visors, Sun Ray Crowns, Robo Cannons, Ice Cryo Cannon, etc.)
      const oldCrest = mesh.getObjectByName('b13_tier_crest');
      if (oldCrest) mesh.remove(oldCrest);

      if (tier >= 2) {
        const crestGrp = new THREE.Group();
        crestGrp.name = 'b13_tier_crest';
        const glowMat = new THREE.MeshBasicMaterial({ color: accentHex, side: THREE.DoubleSide });
        const priMat  = new THREE.MeshStandardMaterial({ color: primaryHex, roughness: 0.3, metalness: 0.65 });

        // Tier 2+: Glowing Eye Visor / Headband Crest
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.10, 0.16), glowMat);
        visor.position.set(0, 0.92, 0.36);
        crestGrp.add(visor);

        // Ice Monkey Tier 3+: 3D Arm-Mounted Cryo Cannon!
        if (unitKey === 'ice' && tier >= 3) {
          const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.68, 12).rotateX(Math.PI / 2), glowMat);
          cannon.position.set(0.45, 0.58, 0.38);
          crestGrp.add(cannon);
        }

        // Tier 3+: Sculpted Shoulder Pauldrons (or Twin Robo Cannons / Bat Ears)
        if (tier >= 3) {
          [-0.38, 0.38].forEach(function(px) {
            const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), priMat);
            pauldron.scale.set(1.2, 0.75, 1.1);
            pauldron.position.set(px, 0.72, 0);
            crestGrp.add(pauldron);
          });
        }

        // Tier 4+: Radiant Sun-Ray Crown / Arcane Halo Ring
        if (tier >= 4) {
          const halo = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.06, 8, 28), glowMat);
          halo.position.set(0, 1.05, -0.25);
          crestGrp.add(halo);

          // 8 Radial Sunburst Crown Spikes around the Halo
          for (let r = 0; r < 8; r++) {
            const ra = (r / 8) * Math.PI * 2;
            const ray = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 4), glowMat);
            ray.position.set(Math.cos(ra) * 0.72, 1.05 + Math.sin(ra) * 0.72, -0.25);
            ray.rotation.z = ra - Math.PI / 2;
            crestGrp.add(ray);
          }
        }

        // Tier 5 (True Sun God / Paragon): Luminous Energy Wings & Floating Temple Orbs
        if (tier >= 5) {
          [-1, 1].forEach(function(w) {
            const wing = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.05, 4), glowMat);
            wing.position.set(w * 0.58, 1.18, -0.28);
            wing.rotation.z = -w * 0.65;
            crestGrp.add(wing);

            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), glowMat);
            orb.position.set(w * 0.75, 1.48, 0.1);
            crestGrp.add(orb);
          });
        }

        mesh.add(crestGrp);
      }
    }

    function updateAllHeroAndCompanionEvolutions() {
      const st = G.gameState;
      const h = st && st.hero;
      if (!h) return;

      const vTier = h.volleyTier || 0;
      const eTier = h.elementalTier || 0;
      const xTier = h.explosiveTier || 0;
      const maxHeroTier = 1 + Math.max(vTier, eTier, xTier);
      const dominantPath = vTier >= eTier && vTier >= xTier ? 0 : (eTier >= xTier ? 1 : 2);

      applyCharacterTierEvolution(G.heroMesh, h.id || 'quincy', maxHeroTier, dominantPath);

      if (G.squadMeshes && st.squad) {
        Object.keys(G.squadMeshes).forEach(function(k) {
          const m = G.squadMeshes[k];
          const lvl = st.squad[k] ? st.squad[k].level : 0;
          if (m && lvl > 0) {
            applyCharacterTierEvolution(m, k, lvl, 0);
          }
        });
      }
    }

    // Intercept spawnProjectile so ALL Heroes & Companions evolve their projectile color, energy & multi-beam spread!
    if (typeof G.spawnProjectile === 'function' && !G._projEvolutionHooked) {
      G._projEvolutionHooked = true;
      const origSpawnProj = G.spawnProjectile;
      G.spawnProjectile = function(opts) {
        const st = G.gameState;
        const h = st && st.hero;
        if (opts && h && !opts._isChildBeam) {
          const vTier = h.volleyTier || 0;
          const eTier = h.elementalTier || 0;
          const xTier = h.explosiveTier || 0;
          const highestTier = Math.min(5, 1 + Math.max(vTier, eTier, xTier));

          // Check if projectile originates near the Hero
          const nearHero = Math.hypot((opts.x || 0) - h.x, (opts.z || 0) - h.z) < 1.6;
          if (nearHero) {
            const pal = EVOLUTION_PALETTES[h.id] || EVOLUTION_PALETTES.quincy;
            if (pal.proj && pal.proj[highestTier - 1]) {
              opts.colorHex = pal.proj[highestTier - 1];
            }
            if (highestTier >= 2) {
              opts.isEnergy = true;
              opts.scale = Math.max(opts.scale || 1, 1.05 + (highestTier - 1) * 0.18);
            }
            // Sun Avatar (T4) & True Sun God (T5) Multi-Beam Solar Spread!
            if ((h.id === 'supermonkey' || h.id === 'super') && vTier >= 3 && opts.vx !== undefined && opts.vz !== undefined) {
              const baseSpd = Math.hypot(opts.vx, opts.vz) || 28;
              const baseAng = Math.atan2(opts.vx, opts.vz);
              const extraAngles = vTier >= 4 ? [-0.22, -0.11, 0.11, 0.22] : [-0.14, 0.14];
              extraAngles.forEach(function(da) {
                const cloneOpts = Object.assign({}, opts, {
                  vx: Math.sin(baseAng + da) * baseSpd,
                  vz: Math.cos(baseAng + da) * baseSpd,
                  _isChildBeam: true
                });
                origSpawnProj(cloneOpts);
              });
            }
          }
        }
        return origSpawnProj(opts);
      };
    }

    // ------------------------------------------------------------------------
    // D. PROFESSIONAL 3D DIMENSIONAL RIFT, LIGHTNING ARCS & SHOCKWAVE DOME
    // ------------------------------------------------------------------------
    const bossRiftVFX = new THREE.Group();
    const riftOuter = new THREE.Mesh(
      new THREE.TorusGeometry(3.8, 0.15, 10, 40).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    const riftInner = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.12, 10, 32).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e })
    );
    const riftDome = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.45 })
    );
    const skyBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 3.2, 24, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    skyBeam.position.y = 12.0;

    const riftPillars = [];
    for (let p = 0; p < 8; p++) {
      const pil = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 5.2, 4),
        new THREE.MeshBasicMaterial({ color: p % 2 === 0 ? 0xfacc15 : 0x38bdf8 })
      );
      riftPillars.push(pil);
      bossRiftVFX.add(pil);
    }
    bossRiftVFX.add(riftOuter, riftInner, riftDome, skyBeam);
    bossRiftVFX.visible = false;
    G.scene.add(bossRiftVFX);

    // ------------------------------------------------------------------------
    // E. INTERACTIVE "DEV SHOWCASE WORLD" (HORIZONTAL BLOON/MOAB/BOSS LINEUP
    //    + TIER 1-5 MONKEY LINEUP + WAILA INSPECTOR HUD + ZERO ATTACKS)
    // ------------------------------------------------------------------------
    const devExhibits = [];
    const devShowcaseGroup = new THREE.Group();
    devShowcaseGroup.visible = false;
    G.scene.add(devShowcaseGroup);

    function create2DCartoonBloonShowcaseSprite(hexCol, stripeMode, itemKey) {
      const S = 256;
      const c = document.createElement('canvas');
      c.width = S;
      c.height = S;
      const ctx = c.getContext('2d');
      const imgData = ctx.createImageData(S, S);
      const data = imgData.data;

      const rBase = ((hexCol >> 16) & 255) / 255;
      const gBase = ((hexCol >> 8) & 255) / 255;
      const bBase = (hexCol & 255) / 255;
      const k = String(itemKey || '').toUpperCase();

      const clamp = function(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
      const smoothstep = function(e0, e1, x) {
        const t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
        return t * t * (3.0 - 2.0 * t);
      };
      const mix = function(a, b, t) { return a + (b - a) * t; };

      // Evaluate the EXACT GLSL fragment shader math from bloonMat on every pixel!
      for (let py = 0; py < S; py++) {
        const vUvY = 1.0 - (py / (S - 1));
        for (let px = 0; px < S; px++) {
          const vUvX = px / (S - 1);
          const pX = (vUvX - 0.5) * 2.0;
          const pY = (vUvY - 0.5) * 2.0 - 0.06;

          const pinch = pY < 0.15 ? mix(1.0, 1.38, clamp((0.15 - pY) / 0.95, 0.0, 1.0)) : 1.0;
          const bpX = (pX * pinch) / 0.78;
          const bpY = (pY - 0.06) / 0.78;
          const bodyDist = Math.hypot(bpX, bpY) - 1.0;

          const kpX = pX;
          const kpY = pY + 0.76;
          const knotDist = Math.max(Math.abs(kpX) * 1.65 + kpY * 0.85 - 0.14, Math.abs(kpY) - 0.085);
          const d = Math.min(bodyDist, knotDist);

          if (d > 0.0) continue;

          let br = rBase, bg = gBase, bb = bBase;

          if (stripeMode === 'zebra' || k === 'ZEBRA') {
            const fractVal = ((pY + 1.0) * 3.8 + pX * 1.5) - Math.floor((pY + 1.0) * 3.8 + pX * 1.5);
            const st = fractVal >= 0.5 ? 1.0 : 0.0;
            br = mix(0.12, 0.97, st);
            bg = mix(0.13, 0.98, st);
            bb = mix(0.16, 1.00, st);
          } else if (stripeMode === 'rainbow' || k === 'RAINBOW') {
            const tBand = Math.floor(clamp((pY + 0.72) / 1.48, 0.0, 0.999) * 6.0);
            if (tBand === 5)      { br = 0.96; bg = 0.14; bb = 0.14; }
            else if (tBand === 4) { br = 1.00; bg = 0.56; bb = 0.02; }
            else if (tBand === 3) { br = 1.00; bg = 0.88; bb = 0.08; }
            else if (tBand === 2) { br = 0.20; bg = 0.84; bb = 0.16; }
            else if (tBand === 1) { br = 0.08; bg = 0.58; bb = 0.98; }
            else                  { br = 0.64; bg = 0.20; bb = 0.94; }
          } else if (k === 'CERAMIC') {
            const crack = Math.abs(Math.sin(pX * 12.0 + Math.sin(pY * 10.0) * 2.2)) * Math.abs(Math.cos(pY * 11.0));
            if (crack < 0.08) { br = 0.28; bg = 0.13; bb = 0.04; }
          } else if (k === 'LEAD') {
            const seam = smoothstep(0.055, 0.0, Math.abs(pY - 0.05));
            br = mix(br, 0.22, seam * 0.85);
            bg = mix(bg, 0.26, seam * 0.85);
            bb = mix(bb, 0.32, seam * 0.85);
          } else if (k === 'PURPLE') {
            const purpleRim = smoothstep(-0.22, -0.09, bodyDist);
            br = mix(br, 0.30, purpleRim * 0.78);
            bg = mix(bg, 0.94, purpleRim * 0.78);
            bb = mix(bb, 1.00, purpleRim * 0.78);
          } else if (k === 'GLASS' || k === 'DIAMOND') {
            const facet = Math.abs(Math.sin(bpX * 6.0) * Math.cos(bpY * 6.0));
            br = mix(br, 0.88, facet * 0.55);
            bg = mix(bg, 0.98, facet * 0.55);
            bb = mix(bb, 1.00, facet * 0.55);
          }

          const shadeDist = Math.hypot(bpX + 0.26, bpY - 0.28);
          const sFactor = smoothstep(0.2, 1.35, shadeDist);
          let lr = mix(br * 1.15, br * 0.78, sFactor);
          let lg = mix(bg * 1.15, bg * 0.78, sFactor);
          let lb = mix(bb * 1.15, bb * 0.78, sFactor);

          const hp1X = bpX + 0.34;
          const hp1Y = bpY - 0.34;
          const ang = -0.52;
          const rhpX = (hp1X * Math.cos(ang) - hp1Y * Math.sin(ang)) / 0.75;
          const rhpY = (hp1X * Math.sin(ang) + hp1Y * Math.cos(ang)) / 1.45;
          const highlight1 = 1.0 - smoothstep(0.15, 0.20, Math.hypot(rhpX, rhpY));
          const highlight2 = 1.0 - smoothstep(0.05, 0.08, Math.hypot(bpX + 0.46, bpY - 0.02));
          const totalShine = clamp(highlight1 + highlight2 * 0.85, 0.0, 1.0);

          lr = mix(lr, 1.0, totalShine * 0.92);
          lg = mix(lg, 1.0, totalShine * 0.92);
          lb = mix(lb, 1.0, totalShine * 0.92);

          const outlineMask = smoothstep(-0.11, -0.075, d);
          const fr = mix(lr, 0.09, outlineMask);
          const fg = mix(lg, 0.04, outlineMask);
          const fb = mix(lb, 0.01, outlineMask);

          const idx = (py * S + px) * 4;
          data[idx]     = Math.round(clamp(fr, 0, 1) * 255);
          data[idx + 1] = Math.round(clamp(fg, 0, 1) * 255);
          data[idx + 2] = Math.round(clamp(fb, 0, 1) * 255);
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;

      const grp = new THREE.Group();
      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(1.77, 2.13),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
      );
      quad.position.y = 1.32;
      quad.name = 'dev_bloon_quad';
      grp.add(quad);

      // Soft dark oval drop shadow on pedestal matching real in-game bloon shadow
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x0a1803, transparent: true, opacity: 0.35 })
      );
      shadow.position.y = 0.27;
      grp.add(shadow);

      return grp;
    }

    function createLabelSprite(title, sub) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 160;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(8, 8, 496, 144, 24);
      ctx.fill();
      ctx.stroke();

      ctx.font = '900 34px sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(title, 256, 66);

      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(sub, 256, 118);

      const tex = new THREE.CanvasTexture(c);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sp.scale.set(4.5, 1.4, 1);
      return sp;
    }

    function buildDevShowcaseExhibits() {
      if (devExhibits.length > 0) return;

      const pedMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.6 });

      // Single Continuous Horizontal Lineup (Z = -10) sorted strictly by Bloon -> MOAB -> Boss Hierarchy!
      const RAW_LINEUP = [
        { key: 'RED', name: 'Red Bloon', cat: 'Regular Bloon (Tier 1)', hp: 1, speed: '1.0x', lore: '11 in', scaleTxt: '1.00x', children: 'None', imm: 'None', kind: 'bloon', col: 0xef4444, gap: 4.5 },
        { key: 'BLUE', name: 'Blue Bloon', cat: 'Regular Bloon (Tier 2)', hp: 2, speed: '1.4x', lore: '11.2 in', scaleTxt: '1.05x', children: '1x Red', imm: 'None', kind: 'bloon', col: 0x3b82f6, gap: 4.5 },
        { key: 'GREEN', name: 'Green Bloon', cat: 'Regular Bloon (Tier 3)', hp: 3, speed: '1.8x', lore: '11.4 in', scaleTxt: '1.10x', children: '1x Blue', imm: 'None', kind: 'bloon', col: 0x22c55e, gap: 4.5 },
        { key: 'YELLOW', name: 'Yellow Bloon', cat: 'Regular Bloon (Tier 4)', hp: 4, speed: '3.2x', lore: '11.6 in', scaleTxt: '1.15x', children: '1x Green', imm: 'None', kind: 'bloon', col: 0xfacc15, gap: 4.5 },
        { key: 'PINK', name: 'Pink Bloon', cat: 'Regular Bloon (Tier 5)', hp: 5, speed: '3.5x', lore: '11.8 in', scaleTxt: '1.20x', children: '1x Yellow', imm: 'None', kind: 'bloon', col: 0xf472b6, gap: 4.5 },
        { key: 'BLACK', name: 'Black Bloon', cat: 'Blast-Immune Bloon (Tier 6)', hp: 11, speed: '1.8x', lore: '11.9 in', scaleTxt: '1.12x', children: '2x Pink', imm: 'Explosions', kind: 'bloon', col: 0x1e293b, gap: 4.5 },
        { key: 'WHITE', name: 'White Bloon', cat: 'Freeze-Immune Bloon (Tier 6)', hp: 11, speed: '2.0x', lore: '11.9 in', scaleTxt: '1.12x', children: '2x Pink', imm: 'Ice / Freeze', kind: 'bloon', col: 0xf8fafc, gap: 4.5 },
        { key: 'PURPLE', name: 'Purple Bloon', cat: 'Energy-Immune Bloon (Tier 6)', hp: 11, speed: '3.0x', lore: '12.0 in', scaleTxt: '1.18x', children: '2x Pink', imm: 'Fire / Energy / Plasma', kind: 'bloon', col: 0x9333ea, gap: 4.5 },
        { key: 'LEAD', name: 'Lead Bloon', cat: 'Armored Metal Bloon (Tier 7)', hp: 23, speed: '1.0x', lore: '12.0 in', scaleTxt: '1.22x', children: '2x Black', imm: 'Sharp Darts', kind: 'bloon', col: 0x64748b, gap: 4.5 },
        { key: 'ZEBRA', name: 'Zebra Bloon', cat: 'Dual-Immunity Bloon (Tier 7)', hp: 23, speed: '1.8x', lore: '12.1 in', scaleTxt: '1.25x', children: '1x Black + 1x White', imm: 'Explosions & Freeze', kind: 'bloon', col: 0xe2e8f0, stripe: 'zebra', gap: 4.5 },
        { key: 'RAINBOW', name: 'Rainbow Bloon', cat: 'Chromatic Bloon (Tier 8)', hp: 47, speed: '2.2x', lore: '12.2 in', scaleTxt: '1.30x', children: '2x Zebra', imm: 'None', kind: 'bloon', col: 0xec4899, stripe: 'rainbow', gap: 4.5 },
        { key: 'CERAMIC', name: 'Ceramic Bloon', cat: 'Hardened Clay Bloon (Tier 9)', hp: 104, speed: '2.5x', lore: '12.5 in', scaleTxt: '1.35x', children: '2x Rainbow', imm: '10-Hit Clay Armor', kind: 'bloon', col: 0xd97706, gap: 4.5 },
        { key: 'GLASS', name: 'Glass Bloon', cat: 'Crystalline Special Bloon', hp: 60, speed: '2.2x', lore: '12.4 in', scaleTxt: '1.32x', children: '2x White', imm: 'Sharp Darts', kind: 'bloon', col: 0x67e8f9, gap: 4.5 },
        { key: 'DIAMOND', name: 'Diamond Bloon', cat: 'Faceted Gem Special Bloon', hp: 250, speed: '1.5x', lore: '12.8 in', scaleTxt: '1.38x', children: '2x Ceramic', imm: 'Damage Cap Shield', kind: 'bloon', col: 0x38bdf8, gap: 4.5 },
        { key: 'GOLDEN', name: 'Golden Treasure Bloon', cat: 'Bounty Special Bloon', hp: 180, speed: '3.4x', lore: '12.6 in', scaleTxt: '1.35x', children: '+$35 Monkey Money', imm: 'High Speed', kind: 'bloon', col: 0xfacc15, gap: 6.5 },

        // MOAB-Class Blimps (Standard & Fortified side-by-side in exact hierarchy!)
        { key: 'MOAB', name: 'M.O.A.B.', cat: 'Massive Ornary Air Blimp', hp: 600, speed: '1.0x', lore: '3 ft 8 in (4 Ceramics)', scaleTxt: '1.25x', children: '4x Ceramic', imm: 'Freeze', kind: 'moab', gap: 8.5 },
        { key: 'FORTIFIED_MOAB', name: 'Fortified M.O.A.B.', cat: 'Riveted Armored Air Blimp', hp: 1200, speed: '1.0x', lore: '3 ft 8 in (2x Armor)', scaleTxt: '1.25x', children: '4x Fortified Ceramic', imm: '2x Fortified Hull', kind: 'moab', gap: 9.0 },
        { key: 'DDT', name: 'D.D.T.', cat: 'Dark Dirigible Titan', hp: 950, speed: '2.6x', lore: '4 ft 1 in (Stealth Jet)', scaleTxt: '1.55x', children: '4x Camo Regrow Ceramic', imm: 'Camo + Lead + Black', kind: 'moab', gap: 9.5 },
        { key: 'FORTIFIED_DDT', name: 'Fortified D.D.T.', cat: 'Armored Stealth Titan', hp: 1900, speed: '2.6x', lore: '4 ft 1 in (Armored Jet)', scaleTxt: '1.55x', children: '4x Fortified Camo Ceramic', imm: 'Camo + Lead + 2x HP', kind: 'moab', gap: 10.5 },
        { key: 'BFB', name: 'B.F.B.', cat: 'Brutal Floating Behemoth', hp: 2200, speed: '0.25x', lore: '12 ft 2 in (4 MOABs)', scaleTxt: '2.00x', children: '4x M.O.A.B.', imm: 'Heavy Hull', kind: 'moab', gap: 11.5 },
        { key: 'FORTIFIED_BFB', name: 'Fortified B.F.B.', cat: 'Armored Floating Behemoth', hp: 4400, speed: '0.25x', lore: '12 ft 2 in (Riveted Hull)', scaleTxt: '2.00x', children: '4x Fortified M.O.A.B.', imm: '2x Fortified Hull', kind: 'moab', gap: 13.0 },
        { key: 'ZOMG', name: 'Z.O.M.G.', cat: 'Zeppelin of Mighty Gargantuaness', hp: 6500, speed: '0.18x', lore: '44 ft 8 in (4 BFBs)', scaleTxt: '2.75x', children: '4x B.F.B.', imm: '4x Turbo Propellers', kind: 'moab', gap: 14.5 },
        { key: 'FORTIFIED_ZOMG', name: 'Fortified Z.O.M.G.', cat: 'Armored Gargantuan Zeppelin', hp: 13000, speed: '0.18x', lore: '44 ft 8 in (2x Armor)', scaleTxt: '2.75x', children: '4x Fortified B.F.B.', imm: '2x Fortified Hull', kind: 'moab', gap: 16.5 },
        { key: 'BAD', name: 'B.A.D.', cat: 'Big Airship of Doom', hp: 18000, speed: '0.18x', lore: '113 ft 5 in (2 ZOMGs + 3 DDTs)', scaleTxt: '3.70x', children: '2x Z.O.M.G. + 3x D.D.T.', imm: 'Stun & Slow Immune', kind: 'moab', gap: 18.0 },
        { key: 'FORTIFIED_BAD', name: 'Fortified B.A.D.', cat: 'Supreme Armored Airship of Doom', hp: 36000, speed: '0.18x', lore: '113 ft 5 in (2x Dreadnought)', scaleTxt: '3.70x', children: '2x Fort. ZOMG + 3x Fort. DDT', imm: 'Total Crowd-Control Immunity', kind: 'moab', gap: 20.0 },

        // All 7 Boss Bloons continuing in the exact same horizontal line!
        { key: 'BLOONARIUS', name: 'Bloonarius the Inflator', cat: '1st Boss — Poison Swamp', hp: 25000, speed: '0.14x', lore: 'Swamp Behemoth (3 Skulls)', scaleTxt: '4.30x', children: 'Bloon Tide Swarm on Skull', imm: '3x Skull Shield Gates', kind: 'moab', gap: 21.0 },
        { key: 'LYCH', name: 'Gravelord Lych', cat: '2nd Boss — Ghost Undead', hp: 24000, speed: '0.18x', lore: 'Stitched Necro-Zeppelin', scaleTxt: '4.25x', children: 'Resurrects Chained Moabs', imm: 'Drains Buffs & Heals', kind: 'moab', gap: 21.0 },
        { key: 'VORTEX', name: 'Vortex: Master of Air', cat: '3rd Boss — Electric Tempest', hp: 24500, speed: '0.24x', lore: 'Supersonic Storm Blimp', scaleTxt: '4.25x', children: 'Shockwave Stun on Skull', imm: 'Wind Slipstream Shield', kind: 'moab', gap: 21.0 },
        { key: 'DREADBLOON', name: 'Dreadbloon: Behemoth', cat: '4th Boss — Armored Rock Drill', hp: 28000, speed: '0.12x', lore: 'Titanium Spiral Drill', scaleTxt: '4.35x', children: 'Rock Bloon Escort Swarm', imm: 'Rotating Rock Shield', kind: 'moab', gap: 21.0 },
        { key: 'PHAYZE', name: 'Phayze: Reality Warper', cat: '5th Boss — Twin-Hull Dark Glitch', hp: 26000, speed: '0.20x', lore: 'Split Dimensional Airship', scaleTxt: '4.35x', children: 'Rift Warp Dash on Skull', imm: 'Radar-Jamming Camo Pulse', kind: 'moab', gap: 21.0 },
        { key: 'BLASTAPOPOULOS', name: 'Blastapopoulos: Core Demon', cat: '6th Boss — Volcanic Magma', hp: 29000, speed: '0.15x', lore: 'Molten Magma Dreadnought', scaleTxt: '4.45x', children: 'Meteor Fireballs on Skull', imm: 'Overheats Rapid Towers', kind: 'moab', gap: 21.0 },
        { key: 'TERRACOTTA', name: 'Quetzal: Ancient Guardian', cat: '7th Boss — Ground Temple Serpent', hp: 32000, speed: '0.16x', lore: '5-Segment Aztec Serpent', scaleTxt: '4.40x', children: 'Golden Temple Totems', imm: 'Stone Armor Segments', kind: 'moab', gap: 21.0 }
      ];

      let curX = -75;
      RAW_LINEUP.forEach(function(item) {
        item.x = curX;
        item.z = -10;
        curX += item.gap;

        const holder = new THREE.Group();
        holder.position.set(item.x, 0, item.z);

        const pRadius = item.kind === 'moab' ? 2.5 : 1.15;
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(pRadius, pRadius * 1.12, 0.25, 24), pedMat);
        ped.position.y = 0.12;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(pRadius, 0.06, 8, 28).rotateX(Math.PI / 2), rimMat);
        rim.position.y = 0.25;
        holder.add(ped, rim);

        let displayMesh;
        if (item.kind === 'bloon') {
          displayMesh = create2DCartoonBloonShowcaseSprite(item.col, item.stripe, item.key);
          displayMesh.position.y = 0.0;
        } else {
          displayMesh = buildAuthentic3DAirshipOrBoss(item.key);
          displayMesh.position.y = 0.65;
        }
        holder.add(displayMesh);

        const label = createLabelSprite(item.name, item.scaleTxt + ' Scale • ' + item.hp + ' HP');
        label.position.set(0, item.kind === 'moab' ? 6.8 : 3.6, 0);
        holder.add(label);

        devShowcaseGroup.add(holder);
        item.mesh = displayMesh;
        item.holder = holder;
        devExhibits.push(item);
      });
    }

    function setupDevWorldUI() {
      if (document.getElementById('dev-waila-hud')) return;

      const waila = document.createElement('div');
      waila.id = 'dev-waila-hud';
      waila.innerHTML = [
        '<div class="flex items-center justify-between gap-4 border-b border-sky-500/40 pb-1.5">',
        '  <div class="flex items-center gap-2">',
        '    <span class="px-2 py-0.5 rounded bg-sky-500 text-stone-950 font-black text-[10px] uppercase">WAILA INSPECTOR</span>',
        '    <span id="waila-cat" class="text-xs font-bold text-sky-300">MOAB-CLASS AIRSHIP</span>',
        '  </div>',
        '  <span id="waila-scale" class="text-xs font-black text-amber-300">Scale: 2.75x</span>',
        '</div>',
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">',
        '  <div>',
        '    <h3 id="waila-title" class="font-btd text-xl sm:text-2xl text-yellow-300 leading-none">Z.O.M.G.</h3>',
        '    <p id="waila-lore" class="text-[11px] font-bold text-slate-300 mt-1">Lore Size: 44 ft 8 in • Spawns: 4x B.F.B.</p>',
        '  </div>',
        '  <div class="flex flex-wrap gap-1.5 text-[11px] font-black">',
        '    <span id="waila-hp" class="px-2.5 py-1 rounded-lg bg-rose-950/90 border border-rose-500 text-rose-200">❤️ 6,500 HP</span>',
        '    <span id="waila-speed" class="px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500 text-emerald-200">⚡ 0.18x SPD</span>',
        '    <span id="waila-imm" class="px-2.5 py-1 rounded-lg bg-purple-950/90 border border-purple-400 text-purple-200">🛡️ 4x Turbo Props</span>',
        '  </div>',
        '</div>',
        '<div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/80">',
        '  <span class="text-[10px] text-amber-200 font-bold">💡 Walk Left/Right along the Horizontal Lineup (Bloons -> MOABs -> 7 Bosses) • Attacks Disabled</span>',
        '  <div class="flex items-center gap-1.5">',
        '    <button id="btn-waila-spin" type="button" class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-btd text-xs cursor-pointer">🔄 SPIN MODELS</button>',
        '    <button id="btn-exit-dev-world" type="button" class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-btd text-xs cursor-pointer">🚪 EXIT DEV WORLD</button>',
        '  </div>',
        '</div>'
      ].join('\n');
      document.body.appendChild(waila);

      let spinModels = true;
      waila.querySelector('#btn-waila-spin').addEventListener('click', function() {
        spinModels = !spinModels;
        window.__DEV_SPIN_MODELS = spinModels;
      });
      window.__DEV_SPIN_MODELS = true;

      waila.querySelector('#btn-exit-dev-world').addEventListener('click', function() {
        window.exitDevShowcaseWorld();
      });

      const startBtn = document.getElementById('btn-start-run');
      if (startBtn && startBtn.parentElement && !document.getElementById('btn-enter-dev-world')) {
        const devBtn = document.createElement('button');
        devBtn.id = 'btn-enter-dev-world';
        devBtn.type = 'button';
        devBtn.className = 'btd-btn-blue py-2.5 px-4 rounded-2xl font-btd text-sm sm:text-base text-white tracking-wider cursor-pointer shadow-lg';
        devBtn.textContent = '🧪 DEV WORLD';
        startBtn.parentElement.insertBefore(devBtn, startBtn);
        devBtn.addEventListener('click', function() { window.enterDevShowcaseWorld(); });
      }
    }
    setupDevWorldUI();

    window.enterDevShowcaseWorld = function() {
      buildDevShowcaseExhibits();
      window.__IN_DEV_SHOWCASE = true;
      devShowcaseGroup.visible = true;

      const startModal = document.getElementById('start-modal');
      if (startModal) {
        startModal.classList.add('hidden');
        startModal.classList.remove('flex');
      }
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal) settingsModal.classList.add('hidden');

      if (typeof G.resetGame === 'function') G.resetGame();
      G.gameState.inStartMenu = false;
      G.gameState.paused = false;
      G.gameState.hero.x = 5;
      G.gameState.hero.z = 2;

      const bossHud = document.getElementById('boss-hud-container');
      if (bossHud) bossHud.classList.add('hidden');

      const waila = document.getElementById('dev-waila-hud');
      if (waila) waila.classList.add('active');
      window.triggerHaptic([20, 40, 20]);
    };

    window.exitDevShowcaseWorld = function() {
      window.__IN_DEV_SHOWCASE = false;
      if (G.bloonInstancedMesh) G.bloonInstancedMesh.visible = true;
      if (G.bloonOutlineInstancedMesh) G.bloonOutlineInstancedMesh.visible = true;
      devShowcaseGroup.visible = false;
      const waila = document.getElementById('dev-waila-hud');
      if (waila) waila.classList.remove('active');
      const startModal = document.getElementById('start-modal');
      if (startModal) {
        startModal.classList.remove('hidden');
        startModal.classList.add('flex');
      }
      G.gameState.inStartMenu = true;
    };

    // ------------------------------------------------------------------------
    // F. MAIN SIMULATION LOOP HOOK
    // ------------------------------------------------------------------------
    const prevSim = G.updateSimulation;
    G.updateSimulation = function(dt) {
      const st = G.gameState;
      const h = st && st.hero;

      if (window.__IN_DEV_SHOWCASE && h) {
        if (G.bloonActive) {
          for (let i = 0; i < G.bloonActive.length; i++) G.bloonActive[i] = 0;
        }
        if (G.activeMOABs && G.activeMOABs.length > 0) {
          G.activeMOABs.forEach(function(m) { if (m.mesh) G.scene.remove(m.mesh); });
          G.activeMOABs.length = 0;
        }
        if (G.squadMeshes) {
          Object.values(G.squadMeshes).forEach(function(m) { if (m) m.visible = false; });
        }
        h.fireCooldown = 999;
      }

      prevSim(dt);

      if (!h || st.paused || st.gameOver || st.inStartMenu) return;

      updateAllHeroAndCompanionEvolutions();

      if (window.__IN_DEV_SHOWCASE) {
        // Clear any wild wave bloons that prevSim(dt) tried to spawn & hide instanced wave meshes!
        if (G.bloonActive) {
          for (let i = 0; i < G.bloonActive.length; i++) G.bloonActive[i] = 0;
        }
        if (G.bloonInstancedMesh) G.bloonInstancedMesh.visible = false;
        if (G.bloonOutlineInstancedMesh) G.bloonOutlineInstancedMesh.visible = false;
        if (G.activeMOABs && G.activeMOABs.length > 0) {
          G.activeMOABs.forEach(function(m) { if (m.mesh) G.scene.remove(m.mesh); });
          G.activeMOABs.length = 0;
        }
        const bossHud = document.getElementById('boss-hud-container');
        if (bossHud) bossHud.classList.add('hidden');
        const ptr = document.getElementById('boss-screen-pointer');
        if (ptr) ptr.style.display = 'none';

        let closest = null;
        let minDist = 999;
        for (let i = 0; i < devExhibits.length; i++) {
          const ex = devExhibits[i];
          if (ex.mesh && ex.kind === 'bloon' && G.camera) {
            const qMesh = ex.mesh.getObjectByName('dev_bloon_quad');
            if (qMesh) {
              qMesh.quaternion.copy(G.camera.quaternion);
              qMesh.position.y = 1.35 + Math.sin(st.elapsedTime * 3.5 + i * 0.7) * 0.08;
            }
          }
          if (ex.mesh && ex.kind === 'moab' && window.__DEV_SPIN_MODELS) {
            ex.mesh.rotation.y += dt * 0.65;
            if (ex.mesh.userData && ex.mesh.userData.propellers) {
              ex.mesh.userData.propellers.forEach(function(p) { p.rotation.z += dt * 16; });
            }
          }
          const d = Math.hypot(ex.x - h.x, ex.z - h.z);
          if (d < minDist) {
            minDist = d;
            closest = ex;
          }
        }

        if (closest) {
          const tEl = document.getElementById('waila-title');
          const cEl = document.getElementById('waila-cat');
          const sEl = document.getElementById('waila-scale');
          const lEl = document.getElementById('waila-lore');
          const hpEl = document.getElementById('waila-hp');
          const spEl = document.getElementById('waila-speed');
          const imEl = document.getElementById('waila-imm');
          if (tEl) tEl.textContent = closest.name;
          if (cEl) cEl.textContent = closest.cat;
          if (sEl) sEl.textContent = '3D Scale: ' + closest.scaleTxt;
          if (lEl) lEl.textContent = 'Lore Size: ' + closest.lore + ' • Pop Spawns: ' + closest.children;
          if (hpEl) hpEl.textContent = '❤️ ' + closest.hp.toLocaleString() + ' HP';
          if (spEl) spEl.textContent = '⚡ ' + closest.speed + ' SPD';
          if (imEl) imEl.textContent = '🛡️ ' + closest.imm;
        }
        return;
      }

      let activeRiftBoss = null;
      if (G.activeMOABs && G.activeMOABs.length > 0) {
        for (let m = 0; m < G.activeMOABs.length; m++) {
          const mb = G.activeMOABs[m];
          const bType = String(mb.type || 'MOAB').toUpperCase();

          if (mb.mesh && (!mb.mesh.userData || !mb.mesh.userData.isAuthenticB13)) {
            const parent = mb.mesh.parent || G.scene;
            const pos = mb.mesh.position.clone();
            const rot = mb.mesh.rotation.clone();
            parent.remove(mb.mesh);
            mb.mesh = buildAuthentic3DAirshipOrBoss(bType);
            mb.mesh.position.copy(pos);
            mb.mesh.rotation.copy(rot);
            parent.add(mb.mesh);
          }

          if (mb.mesh) {
            const trueScale = (mb.mesh.userData && mb.mesh.userData.baseHierarchyScale) || 1.25;
            if (mb._entranceTimer !== undefined && mb._entranceTimer < (mb._entranceDuration || 1.15)) {
              activeRiftBoss = mb;
              const p = Math.min(1.0, mb._entranceTimer / (mb._entranceDuration || 1.15));
              mb.mesh.scale.setScalar(trueScale * Math.max(0.15, p));
            } else {
              mb.mesh.scale.setScalar(trueScale);
            }
            if (mb.mesh.userData && mb.mesh.userData.propellers) {
              mb.mesh.userData.propellers.forEach(function(p) { p.rotation.z += dt * 18.0; });
            }
          }
        }
      }

      if (activeRiftBoss) {
        bossRiftVFX.visible = true;
        bossRiftVFX.position.set(activeRiftBoss.x, 0.05, activeRiftBoss.z);
        riftOuter.rotation.z += dt * 5.5;
        riftInner.rotation.z -= dt * 8.5;
        riftDome.rotation.y += dt * 4.0;
        const domeScale = 1.0 + Math.sin(st.elapsedTime * 16.0) * 0.25;
        riftDome.scale.setScalar(domeScale);
        for (let i = 0; i < riftPillars.length; i++) {
          const a = (i / riftPillars.length) * Math.PI * 2 + st.elapsedTime * 5.0;
          riftPillars[i].position.set(Math.cos(a) * 3.4, 2.4 + Math.sin(st.elapsedTime * 14 + i) * 0.7, Math.sin(a) * 3.4);
          riftPillars[i].rotation.z = Math.sin(st.elapsedTime * 10 + i) * 0.35;
        }
      } else {
        bossRiftVFX.visible = false;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootBuild13);
  } else {
    bootBuild13();
  }
})();
