window.B13_UNIT_SCALE = window.B13_UNIT_SCALE || 0.75; // BUILD 13.9: hero + companion draw size
window.bloonOutlineInstancedMesh = null;
/* ========================================================================
   BLOONS BLITZ 3D SURVIVOR - OFFICIAL BLOONS BLITZ UI OVERRIDE MODULE
   Matches 1:1 to Official Bloons Blitz Mobile Upgrade References
   ======================================================================== */

(function() {
  'use strict';

  console.log("Initializing Bloons Blitz UI Override Module (Build 11 Extended)...");

  // Master Save Keys
  const MASTER_SAVE_KEY_V11 = 'bloons_blitz_master_save_v11';
  const MASTER_SAVE_KEY = 'BLOONS_BLITZ_MASTER_SAVE_V1';
  const BUILD10_SAVE_KEY = 'bloons_blitz_save_v3';

  // ==========================================================================
  // 0. WEBAUDIO & AUDIOPARAM SAFETY GUARDS (PREVENTS NON-FINITE VALUE CRASHES)
  // ==========================================================================
  (function installAudioParamSafeguards() {
    if (typeof AudioParam === 'undefined') return;

    function safeVal(val, fallback = 440) {
      const n = Number(val);
      return Number.isFinite(n) ? n : fallback;
    }

    function safeTime(time, param) {
      const n = Number(time);
      const ctxTime = (param && param.context) ? param.context.currentTime : 0;
      return Number.isFinite(n) ? Math.max(0, n) : Math.max(0, ctxTime);
    }

    const origSetValue = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function(value, startTime) {
      const v = safeVal(value, 440);
      const t = safeTime(startTime, this);
      try {
        return origSetValue.call(this, v, t);
      } catch (e) {
        // Safe non-crashing fallback
      }
    };

    const origLinear = AudioParam.prototype.linearRampToValueAtTime;
    AudioParam.prototype.linearRampToValueAtTime = function(value, endTime) {
      const v = safeVal(value, 440);
      const t = safeTime(endTime, this);
      try {
        return origLinear.call(this, v, t);
      } catch (e) {}
    };

    const origExp = AudioParam.prototype.exponentialRampToValueAtTime;
    AudioParam.prototype.exponentialRampToValueAtTime = function(value, endTime) {
      let v = safeVal(value, 0.001);
      if (v <= 0.00001) v = 0.00001; // WebAudio exponentialRamp requires value > 0
      const t = safeTime(endTime, this);
      try {
        return origExp.call(this, v, t);
      } catch (e) {
        try {
          return this.setValueAtTime(v, t);
        } catch (err) {}
      }
    };
  })();

  // Rate-limited and sanitized playPop wrapper
  (function patchSoundFXPop() {
    let popCallsThisSecond = 0;
    let lastPopSec = performance.now();

    const COLOR_NAME_TO_INDEX = {
      RED: 0, BLUE: 1, GREEN: 2, YELLOW: 3, PINK: 4,
      BLACK: 5, WHITE: 5, PURPLE: 6, LEAD: 7, ZEBRA: 8,
      RAINBOW: 9, CERAMIC: 10
    };

    function sanitizeAndWrapPlayPop(origFn) {
      return function(isCrit = false, tierIndex = 0, streakCount = 0) {
        const now = performance.now();
        if (now - lastPopSec >= 1000) {
          popCallsThisSecond = 0;
          lastPopSec = now;
        }
        if (popCallsThisSecond >= 15) return; // rate limit max 15 calls/sec
        popCallsThisSecond++;

        // Sanitize tierIndex: strings like 'WHITE' or 'RED' mapped to finite numbers
        let numericTier = 0;
        if (typeof tierIndex === 'number' && Number.isFinite(tierIndex)) {
          numericTier = tierIndex;
        } else if (typeof tierIndex === 'string') {
          numericTier = COLOR_NAME_TO_INDEX[tierIndex.toUpperCase()] ?? 1;
        }
        numericTier = Math.min(Math.max(Number(numericTier) || 0, 0), 12);

        let numericStreak = Number(streakCount);
        if (!Number.isFinite(numericStreak) || numericStreak < 0) numericStreak = 0;
        numericStreak = Math.min(numericStreak, 500);

        try {
          return origFn.call(this, Boolean(isCrit), numericTier, numericStreak);
        } catch (e) {
          console.warn("Safe pop sound catch:", e);
        }
      };
    }

    if (typeof ProceduralSoundEngine !== 'undefined' && ProceduralSoundEngine.prototype) {
      ProceduralSoundEngine.prototype.playPop = sanitizeAndWrapPlayPop(ProceduralSoundEngine.prototype.playPop);
    }
  })();

  // Guarantee ProceduralSoundEngine.prototype.playChimeNote (Fixes line 1240:20 chime crash)
  (function installPlayChimeNote() {
    function safePlayChimeNote(freq, time, duration = 0.24, volume = 1.0) {
      try {
        if (this.muted || (this.musicVolume <= 0.01 && this.sfxVolume <= 0.01)) return;
        this.init();
        if (!this.ctx) return;
        const now = (typeof time === 'number' && Number.isFinite(time)) ? time : this.ctx.currentTime;
        const f = (typeof freq === 'number' && Number.isFinite(freq) && freq > 20 && freq < 20000) ? freq : 880.0;
        const dur = (typeof duration === 'number' && Number.isFinite(duration) && duration > 0.01) ? duration : 0.24;
        const vol = (typeof volume === 'number' && Number.isFinite(volume)) ? Math.max(0, Math.min(1.0, volume)) : 1.0;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 1.06, now + dur * 0.4);

        const effectiveVol = 0.14 * vol * (this.musicVolume || 0.8);
        gain.gain.setValueAtTime(Math.max(0.001, effectiveVol), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        osc.connect(gain);
        gain.connect(this.outNode ? this.outNode() : (this.musicGain || this.ctx.destination));
        osc.start(now);
        osc.stop(now + dur + 0.02);
      } catch (err) {}
    }

    if (typeof ProceduralSoundEngine !== 'undefined' && ProceduralSoundEngine.prototype) {
      ProceduralSoundEngine.prototype.playChimeNote = safePlayChimeNote;
    }
    if (typeof soundFX !== 'undefined' && soundFX) {
      soundFX.playChimeNote = safePlayChimeNote;
    }
  })();

  // Ice Monkey Permafrost Throttling & Blop/VFX Capping
  (function setupIceMonkeyAndVFXOptimization() {
    const origRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = function(cb) {
      return origRequestAnimationFrame.call(window, function(timestamp) {
        // Clamp streak and pop numbers against NaN or Infinity
        if (typeof gameState !== 'undefined') {
          if (!Number.isFinite(gameState.popStreakCount) || gameState.popStreakCount < 0) {
            gameState.popStreakCount = 0;
          }
          if (!Number.isFinite(gameState.popStreakTimer)) {
            gameState.popStreakTimer = 0;
          }
          if (gameState.pops && !Number.isFinite(gameState.pops)) {
            gameState.pops = 0;
          }
        }

        // Cap active blop orbs if flooding the arena to eliminate 55ms frame lag
        if (typeof blopActive !== 'undefined' && typeof MAX_BLOPS !== 'undefined') {
          let activeBlopCount = 0;
          for (let i = 0; i < MAX_BLOPS; i++) {
            if (blopActive[i] === 1) activeBlopCount++;
          }
          if (activeBlopCount > 70 && typeof h !== 'undefined' && typeof blopX !== 'undefined') {
            for (let i = 0; i < MAX_BLOPS && activeBlopCount > 50; i++) {
              if (blopActive[i] === 1) {
                const d = Math.hypot(blopX[i] - h.x, blopZ[i] - h.z);
                if (d > 12) {
                  blopActive[i] = 0;
                  activeBlopCount--;
                }
              }
            }
          }
        }

        return cb(timestamp);
      });
    };
  })();


  // ==========================================================================
  // ==========================================================================
  // 1. PROCEDURAL 3D MONKEY BUILDER & FORGE EXTENSIONS
  // ==========================================================================
  function createFullMonkeyMesh(type) {
    const root = new THREE.Group();

    // Material definitions
    const furColor = (type === 'wizard' || type === 'dart' || type === 'sniper') ? 0x854d0e : 0xa16207;
    const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.5 });
    const peachMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.45 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1c0d05 });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x450a0a });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.2 });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });

    let suitColor = 0xa16207;
    if (type === 'ninja') suitColor = 0xdc2626;
    else if (type === 'wizard') suitColor = 0x6b21a8;
    else if (type === 'boomer') suitColor = 0xf59e0b;
    else if (type === 'sniper') suitColor = 0x4d7c0f;
    else if (type === 'tack') suitColor = 0xe11d48;
    else if (type === 'ice') suitColor = 0x0284c7;
    else if (type === 'mortar') suitColor = 0x3f6212;
    else if (type === 'super') suitColor = 0x055ce8;
    else if (type === 'dartling') suitColor = 0x365314;
    else if (type === 'glue') suitColor = 0xca8a04;
    else if (type === 'bomb') suitColor = 0x334155;
    else if (type === 'mermonkey') suitColor = 0x0d9488;
    else if (type === 'beasthandler') suitColor = 0x65a30d;
    else if (type === 'desperado') suitColor = 0x78350f;
    else if (type === 'alchemist') suitColor = 0x059669;
    else if (type === 'druid') suitColor = 0x15803d;
    else if (type === 'rosalia') suitColor = 0xf97316;
    else if (type === 'corvus') suitColor = 0x312e81;
    else if (type === 'geraldo') suitColor = 0x92400e;
    else if (type === 'silas') suitColor = 0x0284c7;
    const suitMat = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.4 });

    // 1. Head Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.45, 0.05);
    root.add(headGroup);

    // Cowl / Head
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 20), suitMat);
    headGroup.add(headMesh);

    // Peach cheeks
    [-0.14, 0.14].forEach(x => {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), peachMat);
      cheek.position.set(x, -0.02, 0.32);
      cheek.scale.set(0.95, 0.95, 0.65);
      headGroup.add(cheek);
    });

    // Snout
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), peachMat);
    snout.position.set(0, -0.18, 0.42);
    snout.scale.set(1.22, 0.75, 0.62);
    headGroup.add(snout);

    // Smiling mouth
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), mouthMat);
    mouth.position.set(0, -0.19, 0.60);
    mouth.scale.set(1.0, 0.65, 1.0);
    headGroup.add(mouth);

    // Big Cartoon Eyes with specular highlights
    [-0.16, 0.16].forEach(x => {
      const eye = new THREE.Group();
      eye.position.set(x, 0.04, 0.52);
      eye.rotation.y = (x > 0 ? 0.2 : -0.2);
      const sclera = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), eyeWhiteMat);
      sclera.scale.set(0.85, 1.15, 1.0);
      eye.add(sclera);
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), pupilMat);
      pupil.position.set(0, 0, 0.005);
      eye.add(pupil);
      const glint = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), eyeWhiteMat);
      glint.position.set(-0.02, 0.04, 0.01);
      eye.add(glint);
      headGroup.add(eye);
    });

    // C-Cup Ears
    [-0.52, 0.52].forEach(x => {
      const ear = new THREE.Group();
      ear.position.set(x, 0, 0.04);
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 16).rotateX(Math.PI / 2), suitMat);
      ear.add(outer);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16).rotateX(Math.PI / 2), peachMat);
      inner.position.z = 0.01;
      ear.add(inner);
      headGroup.add(ear);
    });

    // 2. Torso & Belt
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.70, 16), suitMat);
    torso.position.set(0, 0.80, 0);
    root.add(torso);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.05, 8, 20).rotateX(Math.PI / 2), goldMat);
    belt.position.set(0, 0.52, 0);
    root.add(belt);

    // 3. Legs & Feet
    [-0.18, 0.18].forEach(x => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.10, 0.45, 12), suitMat);
      leg.position.set(x, 0.28, 0);
      root.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.32), peachMat);
      foot.position.set(x, 0.06, 0.08);
      root.add(foot);
    });

    // 4. Arms
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.09, 0.48, 12), suitMat);
    leftArm.position.set(-0.42, 0.80, 0.12);
    leftArm.rotation.set(-0.4, 0, 0.3);
    root.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.09, 0.48, 12), suitMat);
    rightArm.position.set(0.42, 0.80, 0.12);
    rightArm.rotation.set(-0.6, 0, -0.3);
    root.add(rightArm);

    // 5. Character Equipment & Props
    if (type === 'ninja') {
      const headband = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.065, 8, 24).rotateX(Math.PI / 2), pupilMat);
      headband.position.set(0, 0.18, 0.02);
      headGroup.add(headband);
      [-0.15, 0.15].forEach(x => {
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.02), pupilMat);
        ribbon.position.set(x, 0.05, -0.52);
        ribbon.rotation.set(-0.5, 0, x > 0 ? 0.3 : -0.3);
        headGroup.add(ribbon);
      });
      [-0.48, 0.48].forEach(x => {
        const shuriken = new THREE.Group();
        shuriken.position.set(x, 0.72, 0.36);
        for (let s = 0; s < 2; s++) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.02), darkMetalMat);
          bar.rotation.z = (s * Math.PI) / 2;
          shuriken.add(bar);
        }
        root.add(shuriken);
      });
    } else if (type === 'wizard') {
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.85, 16), new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.35 }));
      hat.position.set(0, 0.75, 0);
      hat.rotation.x = -0.15;
      headGroup.add(hat);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 20), goldMat);
      brim.position.set(0, 0.40, 0.05);
      brim.rotation.x = -0.15;
      headGroup.add(brim);
      [-0.16, 0.16].forEach(x => {
        const spec = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 16), goldMat);
        spec.position.set(x, 0.04, 0.53);
        headGroup.add(spec);
      });
      const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.85, 8), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 }));
      wand.position.set(0.48, 0.95, 0.35);
      wand.rotation.set(-0.5, 0, -0.2);
      root.add(wand);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshBasicMaterial({ color: 0xf43f5e }));
      orb.position.set(0.48, 1.35, 0.55);
      root.add(orb);
    } else if (type === 'boomer') {
      const bandana = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.07, 8, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
      bandana.position.set(0, 0.18, 0.02);
      headGroup.add(bandana);
      const boomer = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 6, 16, Math.PI * 0.85).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.4 }));
      boomer.position.set(0.48, 0.88, 0.32);
      boomer.rotation.set(0.4, 0.3, 0.8);
      root.add(boomer);
    } else if (type === 'sniper') {
      const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.14, 16), new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 }));
      beret.position.set(0.06, 0.50, 0);
      beret.rotation.z = -0.25;
      headGroup.add(beret);
      const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8).rotateX(Math.PI / 2), goldMat);
      badge.position.set(-0.16, 0.48, 0.38);
      headGroup.add(badge);
      const rifle = new THREE.Group();
      rifle.position.set(0.36, 0.72, 0.32);
      rifle.rotation.set(-0.4, 0.2, -0.3);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 8).rotateX(Math.PI / 2), darkMetalMat);
      rifle.add(barrel);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8).rotateX(Math.PI / 2), darkMetalMat);
      scope.position.set(0, 0.10, 0);
      rifle.add(scope);
      root.add(rifle);
    } else if (type === 'tack') {
      const chassis = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.3, roughness: 0.3 }));
      chassis.position.set(0, 0.22, 0);
      root.add(chassis);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.28, 8).rotateZ(Math.PI / 2), darkMetalMat);
        noz.rotation.y = -a;
        noz.position.set(Math.cos(a) * 0.75, 0.25, Math.sin(a) * 0.75);
        root.add(noz);
      }
    } else if (type === 'mortar') {
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.5 }));
      helmet.position.set(0, 0.15, 0);
      headGroup.add(helmet);
      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 14), darkMetalMat);
      cannon.position.set(-0.55, 0.55, 0.25);
      cannon.rotation.x = 0.45;
      root.add(cannon);
    } else if (type === 'ice') {
      for (let c = 0; c < 5; c++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.38, 6), new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x0284c7, roughness: 0.1 }));
        const a = (c / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.46, 0.48, Math.sin(a) * 0.46);
        spike.rotation.z = -Math.cos(a) * 0.4;
        headGroup.add(spike);
      }
    } else if (type === 'super') {
      const miniCape = new THREE.Mesh(
        new THREE.PlaneGeometry(0.65, 0.85),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, side: THREE.DoubleSide })
      );
      miniCape.position.set(0, 0.65, -0.32);
      miniCape.rotation.x = 0.35;
      root.add(miniCape);
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.05, 6, 20).rotateX(Math.PI / 2), goldMat);
      belt.position.set(0, 0.42, 0);
      root.add(belt);
    } else if (type === 'dartling') {
      // Dartling Gunner: Soldier Monkey with Army Helmet & 6-Barrel Gatling Gun
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
        new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.55 })
      );
      helmet.position.set(0, 0.16, 0);
      headGroup.add(helmet);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.04, 6, 20).rotateX(Math.PI / 2), darkMetalMat);
      rim.position.set(0, 0.16, 0);
      headGroup.add(rim);

      const starBadge = new THREE.Mesh(new THREE.CircleGeometry(0.08, 5), goldMat);
      starBadge.position.set(0, 0.32, 0.52);
      headGroup.add(starBadge);

      const gatlingGroup = new THREE.Group();
      gatlingGroup.position.set(0.18, 0.72, 0.35);
      gatlingGroup.rotation.set(-0.22, 0.1, 0);

      const gunChassis = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.20, 0.52, 14).rotateX(Math.PI / 2),
        darkMetalMat
      );
      gatlingGroup.add(gunChassis);

      const ammoDrum = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.18, 12).rotateZ(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 })
      );
      ammoDrum.position.set(-0.25, 0, 0);
      gatlingGroup.add(ammoDrum);

      const ammoBelt = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.08, 0.18),
        goldMat
      );
      ammoBelt.position.set(-0.16, 0, 0.06);
      gatlingGroup.add(ammoBelt);

      const barrelGroup = new THREE.Group();
      barrelGroup.position.set(0, 0, 0.26);
      for (let b = 0; b < 6; b++) {
        const a = (b / 6) * Math.PI * 2;
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8).rotateX(Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.15 })
        );
        barrel.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0.42);
        barrelGroup.add(barrel);
      }
      const muzzleClamp = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16), darkMetalMat);
      muzzleClamp.position.set(0, 0, 0.82);
      barrelGroup.add(muzzleClamp);

      gatlingGroup.add(barrelGroup);
      root.add(gatlingGroup);
      root.userData.barrelGroup = barrelGroup;
    } else if (type === 'glue') {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.4 }));
      tank.position.set(0, 0.82, -0.32);
      root.add(tank);
      const hose = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0x84cc16 }));
      hose.position.set(0.42, 0.78, 0.32);
      root.add(hose);
    } else if (type === 'bomb') {
      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 14), darkMetalMat);
      cannon.position.set(-0.55, 0.55, 0.25);
      cannon.rotation.x = 0.45;
      root.add(cannon);
    } else if (type === 'dart') {
      const dart = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
      dart.position.set(0.48, 0.85, 0.32);
      root.add(dart);
    } else if (type === 'rosalia') {
      const goggles = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.07, 8, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
      goggles.position.set(0, 0.18, 0.02);
      headGroup.add(goggles);
      const jetL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.6, 8), darkMetalMat);
      jetL.position.set(-0.28, 0.82, -0.32);
      root.add(jetL);
      const jetR = jetL.clone();
      jetR.position.x = 0.28;
      root.add(jetR);
      const blaster = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.55), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
      blaster.position.set(0.45, 0.85, 0.32);
      root.add(blaster);
    } else if (type === 'corvus') {
      const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.54, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.6 }));
      cowl.position.set(0, 0.52, 0);
      headGroup.add(cowl);
      const dagger = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.03), new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2 }));
      dagger.position.set(0.45, 0.82, 0.32);
      dagger.rotation.z = -0.5;
      root.add(dagger);
    } else if (type === 'geraldo') {
      const stache = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
      stache.position.set(0, -0.12, 0.55);
      headGroup.add(stache);
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.70, 0.35), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 }));
      pack.position.set(0, 0.80, -0.35);
      root.add(pack);
    } else if (type === 'silas') {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 14), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 }));
      hood.position.set(0, 0.12, 0);
      headGroup.add(hood);
      const iceBow = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 6, 16, Math.PI * 0.9).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x0284c7 }));
      iceBow.position.set(0.46, 0.85, 0.30);
      root.add(iceBow);
    } else if (type === 'mermonkey') {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.3 }));
      fin.position.set(0, 0.55, 0);
      headGroup.add(fin);
      const trident = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), goldMat);
      trident.position.set(0.46, 0.90, 0.30);
      trident.rotation.x = -0.2;
      root.add(trident);
    } else if (type === 'beasthandler') {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.65), new THREE.MeshStandardMaterial({ color: 0x84cc16 }));
      crest.position.set(0, 0.45, -0.1);
      headGroup.add(crest);
      const club = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.8 }));
      club.position.set(0.46, 0.82, 0.30);
      root.add(club);
    } else if (type === 'desperado') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 18), new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 }));
      brim.position.set(0, 0.42, 0);
      brim.rotation.x = -0.1;
      headGroup.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.38, 16), new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 }));
      crown.position.set(0, 0.62, 0);
      crown.rotation.x = -0.1;
      headGroup.add(crown);
      for (const side of [-0.46, 0.46]) {
        const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.45), darkMetalMat);
        gun.position.set(side, 0.80, 0.30);
        root.add(gun);
      }
    } else if (type === 'alchemist') {
      const glasses = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.05, 6, 16).rotateX(Math.PI / 2), goldMat);
      glasses.position.set(0, 0.12, 0.05);
      headGroup.add(glasses);
      const beaker = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 10), new THREE.MeshStandardMaterial({ color: 0x10b981, transparent: true, opacity: 0.85, roughness: 0.1 }));
      beaker.position.set(0.46, 0.82, 0.30);
      root.add(beaker);
    } else if (type === 'druid') {
      [-0.24, 0.24].forEach(x => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }));
        horn.position.set(x, 0.48, 0);
        horn.rotation.z = (x > 0 ? -0.4 : 0.4);
        headGroup.add(horn);
      });
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.25, 8), new THREE.MeshStandardMaterial({ color: 0x78350f }));
      staff.position.set(0.46, 0.90, 0.30);
      root.add(staff);
      const leafOrb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      leafOrb.position.set(0.46, 1.45, 0.30);
      root.add(leafOrb);
    }

    return root;
  }

  function createBossMesh(type) {
    const root = new THREE.Group();
    const lk = String(type).toLowerCase();
    
    let hullColor = 0x1e293b;
    let accentColor = 0x38bdf8;
    if (lk.includes('vortex')) {
      hullColor = 0x0f172a;
      accentColor = 0x22d3ee;
    } else if (lk.includes('dread')) {
      hullColor = 0x44403c;
      accentColor = 0xca8a04;
    } else if (lk.includes('phayze')) {
      hullColor = 0x3b0764;
      accentColor = 0xec4899;
    } else if (lk.includes('blast')) {
      hullColor = 0x1c1917;
      accentColor = 0xf97316;
    }

    const hullMat = new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.4, metalness: 0.3 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, roughness: 0.2 });

    const hullGeo = new THREE.SphereGeometry(1.0, 24, 18);
    hullGeo.scale(1.2, 1.0, 2.2);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    root.add(hull);

    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 1.1), accentMat);
      fin.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, -1.2);
      fin.rotation.z = a;
      root.add(fin);
    }

    if (lk.includes('vortex')) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.08, 8, 24), accentMat);
      ring.position.set(0, 0, 0.2);
      root.add(ring);
    } else if (lk.includes('dread')) {
      for (let r = 0; r < 6; r++) {
        const plate = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 }));
        const a = (r / 6) * Math.PI * 2;
        plate.position.set(Math.cos(a) * 1.1, Math.sin(a) * 0.85, (r % 2 ? 0.4 : -0.4));
        plate.scale.set(1.2, 0.5, 1.0);
        root.add(plate);
      }
    } else if (lk.includes('phayze')) {
      for (let s = 0; s < 4; s++) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), accentMat);
        const a = (s / 4) * Math.PI * 2 + 0.3;
        shard.position.set(Math.cos(a) * 1.4, Math.sin(a) * 1.2, -0.2);
        root.add(shard);
      }
    } else if (lk.includes('blast')) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 8), accentMat);
      horn.position.set(0, 1.1, 0.6);
      horn.rotation.x = 0.5;
      root.add(horn);
    }

    return root;
  }

  function polyfillAssetForge() {
    if (typeof ProceduralAssetForge === 'undefined') return;

    ProceduralAssetForge.createNinjaMesh = () => createFullMonkeyMesh('ninja');
    ProceduralAssetForge.createWizardMesh = () => createFullMonkeyMesh('wizard');
    ProceduralAssetForge.createBoomerangMesh = () => createFullMonkeyMesh('boomer');
    ProceduralAssetForge.createSniperMesh = () => createFullMonkeyMesh('sniper');
    ProceduralAssetForge.createTackMesh = () => createFullMonkeyMesh('tack');
    ProceduralAssetForge.createTackTurret = () => createFullMonkeyMesh('tack');
    ProceduralAssetForge.createMortarMesh = () => createFullMonkeyMesh('mortar');
    ProceduralAssetForge.createBombCannon = () => createFullMonkeyMesh('mortar');
    ProceduralAssetForge.createBombMesh = () => createFullMonkeyMesh('mortar');
    ProceduralAssetForge.createIceMesh = () => createFullMonkeyMesh('ice');
    ProceduralAssetForge.createIceSpire = () => createFullMonkeyMesh('ice');
    ProceduralAssetForge.createDartMesh = () => createFullMonkeyMesh('dart');
    ProceduralAssetForge.createDartlingMesh = () => createFullMonkeyMesh('dartling');
    ProceduralAssetForge.createGlueMesh = () => createFullMonkeyMesh('glue');
    ProceduralAssetForge.createSuperMesh = () => createFullMonkeyMesh('super');

    // General companion mesh generator
    ProceduralAssetForge.createCompanionMesh = function(type) {
      return createFullMonkeyMesh(type);
    };

    // Hero mesh generator for all 10 heroes
    const _origCreateMonkeyHero = ProceduralAssetForge.createMonkeyHero;
    ProceduralAssetForge.createMonkeyHero = function(heroId = 'quincy') {
      const hid = String(heroId).toLowerCase();
      if (['rosalia', 'corvus', 'geraldo', 'silas'].includes(hid)) {
        return createFullMonkeyMesh(hid);
      }
      try {
        if (_origCreateMonkeyHero) return _origCreateMonkeyHero.call(ProceduralAssetForge, heroId);
      } catch (e) {}
      return createFullMonkeyMesh(hid);
    };

    // New Companions
    ProceduralAssetForge.createMermonkeyMesh = () => createFullMonkeyMesh('mermonkey');
    ProceduralAssetForge.createBeastHandlerMesh = () => createFullMonkeyMesh('beasthandler');
    ProceduralAssetForge.createDesperadoMesh = () => createFullMonkeyMesh('desperado');
    ProceduralAssetForge.createAlchemistMesh = () => createFullMonkeyMesh('alchemist');
    ProceduralAssetForge.createDruidMesh = () => createFullMonkeyMesh('druid');

    // New Bosses
    ProceduralAssetForge.createVortexMesh = () => createBossMesh('vortex');
    ProceduralAssetForge.createDreadbloonMesh = () => createBossMesh('dreadbloon');
    ProceduralAssetForge.createPhayzeMesh = () => createBossMesh('phayze');
    ProceduralAssetForge.createBlastapopoulosMesh = () => createBossMesh('blastapopoulos');

    // Attach hero aliases
    ['quincy', 'gwendolin', 'sauda', 'obyn', 'benjamin', 'supermonkey', 'rosalia', 'corvus', 'geraldo', 'silas'].forEach(hId => {
      const capName = 'create' + hId.charAt(0).toUpperCase() + hId.slice(1) + 'Mesh';
      if (!ProceduralAssetForge[capName]) {
        ProceduralAssetForge[capName] = function() {
          return ProceduralAssetForge.createMonkeyHero(hId);
        };
      }
    });

    // Install smooth, non-pointy bloon geometry
    installSmoothBloonGeometry();

    // Hook card3DRenderer if available
    if (typeof card3DRenderer !== 'undefined') {
      card3DRenderer.getModelSnapshot = safeGet3DModelSnapshot;
    }

    console.log("ProceduralAssetForge rich 3D monkey & smooth bloon models installed!");
  }

  function installSmoothBloonGeometry() {}

  // ==========================================================================
  // 2. SAFE UPGRADE CARD 3D SNAPSHOT GENERATOR (NEVER THROWS & FULL 3D MONKEYS)
  // ==========================================================================
  const snapshotCache = new Map();
  let b13ThumbR = null;
  function b13ThumbRenderer(w, h) {
    if (!b13ThumbR) {
      b13ThumbR = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), alpha: true, antialias: true, preserveDrawingBuffer: true });
      b13ThumbR.__isOffscreenThumb = true;
    }
    b13ThumbR.setSize(w, h, false);
    b13ThumbR.setClearColor(0x000000, 0);
    return b13ThumbR;
  }

  function safeGet3DModelSnapshot(key) {
    if (snapshotCache.has(key)) return snapshotCache.get(key);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 220;
      const renderer = b13ThumbRenderer(canvas.width, canvas.height);
      renderer.setSize(240, 220);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 240 / 220, 0.1, 50);
      camera.position.set(0, 0.88, 3.4);
      camera.lookAt(0, 0.72, 0);

      const amb = new THREE.AmbientLight(0xffffff, 1.8);
      scene.add(amb);
      const sun = new THREE.DirectionalLight(0xffedd5, 3.2);
      sun.position.set(2, 4, 3);
      scene.add(sun);
      const rim = new THREE.DirectionalLight(0x38bdf8, 2.5);
      rim.position.set(-2, 2, -2);
      scene.add(rim);

      let mesh = null;
      const lk = String(key).toLowerCase();
      if (lk.includes('vortex')) mesh = createBossMesh('vortex');
      else if (lk.includes('dread')) mesh = createBossMesh('dreadbloon');
      else if (lk.includes('phayze')) mesh = createBossMesh('phayze');
      else if (lk.includes('blast')) mesh = createBossMesh('blastapopoulos');
      else if (lk.includes('ninja')) mesh = createFullMonkeyMesh('ninja');
      else if (lk.includes('wizard')) mesh = createFullMonkeyMesh('wizard');
      else if (lk.includes('boomer')) mesh = createFullMonkeyMesh('boomer');
      else if (lk.includes('sniper')) mesh = createFullMonkeyMesh('sniper');
      else if (lk.includes('tack')) mesh = createFullMonkeyMesh('tack');
      else if (lk.includes('mortar') || lk.includes('bomb')) mesh = createFullMonkeyMesh('mortar');
      else if (lk.includes('ice')) mesh = createFullMonkeyMesh('ice');
      else if (lk.includes('dartling')) mesh = createFullMonkeyMesh('dartling');
      else if (lk.includes('dart')) mesh = createFullMonkeyMesh('dart');
      else if (lk.includes('mermonkey')) mesh = createFullMonkeyMesh('mermonkey');
      else if (lk.includes('beasthandler') || lk.includes('beast')) mesh = createFullMonkeyMesh('beasthandler');
      else if (lk.includes('desperado')) mesh = createFullMonkeyMesh('desperado');
      else if (lk.includes('alchemist')) mesh = createFullMonkeyMesh('alchemist');
      else if (lk.includes('druid')) mesh = createFullMonkeyMesh('druid');
      else if (lk.includes('rosalia')) mesh = createFullMonkeyMesh('rosalia');
      else if (lk.includes('corvus')) mesh = createFullMonkeyMesh('corvus');
      else if (lk.includes('geraldo')) mesh = createFullMonkeyMesh('geraldo');
      else if (lk.includes('silas')) mesh = createFullMonkeyMesh('silas');
      else if (lk.includes('gwendolin') && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('gwendolin');
      else if (lk.includes('sauda') && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('sauda');
      else if (lk.includes('obyn') && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('obyn');
      else if (lk.includes('benjamin') && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('benjamin');
      else if (lk.includes('super') && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('supermonkey');
      else if (typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('quincy');
      else mesh = createFullMonkeyMesh('dart');

      if (mesh) {
        mesh.rotation.set(0.10, -0.32, 0);
        const bbox = new THREE.Box3().setFromObject(mesh);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        mesh.position.set(-center.x, -center.y + 0.72, -center.z);
        const maxD = Math.max(size.x, size.y, size.z, 0.001);
        mesh.scale.setScalar(2.2 / maxD);

        scene.add(mesh);
        renderer.render(scene, camera);
        const dataUrl = renderer.domElement.toDataURL('image/png');
        snapshotCache.set(key, dataUrl);
        return dataUrl;
      }
    } catch (e) {
      console.warn("safeGet3DModelSnapshot failed:", e);
    }
    return '';
  }

  function safeGet3DHeadSnapshot(key) {
    const headKey = `head_${key}`;
    if (snapshotCache.has(headKey)) return snapshotCache.get(headKey);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      const renderer = b13ThumbRenderer(canvas.width, canvas.height);
      renderer.setSize(120, 120);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
      camera.position.set(0, 1.35, 3.8);
      camera.lookAt(0, 0.9, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 2.0));
      const sun = new THREE.DirectionalLight(0xffedd5, 3.2);
      sun.position.set(2, 3, 2);
      scene.add(sun);
      const rim = new THREE.DirectionalLight(0x38bdf8, 2.5);
      rim.position.set(-2, 2, -2);
      scene.add(rim);

      let mesh = null;
      const lk = String(key).toLowerCase();
      if (lk.includes('vortex')) mesh = createBossMesh('vortex');
      else if (lk.includes('dread')) mesh = createBossMesh('dreadbloon');
      else if (lk.includes('phayze')) mesh = createBossMesh('phayze');
      else if (lk.includes('blast')) mesh = createBossMesh('blastapopoulos');
      else if (lk.includes('ninja')) mesh = createFullMonkeyMesh('ninja');
      else if (lk.includes('wizard')) mesh = createFullMonkeyMesh('wizard');
      else if (lk.includes('boomer')) mesh = createFullMonkeyMesh('boomer');
      else if (lk.includes('sniper')) mesh = createFullMonkeyMesh('sniper');
      else if (lk.includes('tack')) mesh = createFullMonkeyMesh('tack');
      else if (lk.includes('mortar') || lk.includes('bomb')) mesh = createFullMonkeyMesh('mortar');
      else if (lk.includes('ice')) mesh = createFullMonkeyMesh('ice');
      else if (lk.includes('dartling')) mesh = createFullMonkeyMesh('dartling');
      else if (lk.includes('dart')) mesh = createFullMonkeyMesh('dart');
      else if (lk.includes('mermonkey')) mesh = createFullMonkeyMesh('mermonkey');
      else if (lk.includes('beasthandler') || lk.includes('beast')) mesh = createFullMonkeyMesh('beasthandler');
      else if (lk.includes('desperado')) mesh = createFullMonkeyMesh('desperado');
      else if (lk.includes('alchemist')) mesh = createFullMonkeyMesh('alchemist');
      else if (lk.includes('druid')) mesh = createFullMonkeyMesh('druid');
      else if (lk.includes('rosalia')) mesh = createFullMonkeyMesh('rosalia');
      else if (lk.includes('corvus')) mesh = createFullMonkeyMesh('corvus');
      else if (lk.includes('geraldo')) mesh = createFullMonkeyMesh('geraldo');
      else if (lk.includes('silas')) mesh = createFullMonkeyMesh('silas');
      else if (lk.includes('gwendolin') && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('gwendolin');
      else if (lk.includes('sauda') && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('sauda');
      else if (lk.includes('obyn') && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('obyn');
      else if (lk.includes('benjamin') && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('benjamin');
      else if (lk.includes('super') && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('supermonkey');
      else if (typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMonkeyHero) mesh = ProceduralAssetForge.createMonkeyHero('quincy');
      else mesh = createFullMonkeyMesh('dart');

      if (mesh) {
        mesh.rotation.set(0.08, -0.25, 0);
        const bbox = new THREE.Box3().setFromObject(mesh);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        mesh.position.set(-center.x, -center.y + 0.92, -center.z);
        const maxD = Math.max(size.x, size.y, size.z, 0.001);
        mesh.scale.setScalar(2.15 / maxD);

        scene.add(mesh);
        renderer.render(scene, camera);
        const dataUrl = renderer.domElement.toDataURL('image/png');
        snapshotCache.set(headKey, dataUrl);
        return dataUrl;
      }
    } catch (e) {
      console.warn("safeGet3DHeadSnapshot failed:", e);
    }
    return '';
  }

  // 3D Shaded Weapon & Skill Snapshots for Upgrade Tier Cards (Replaces Flat Trophies)
  function getSkillWeaponSnapshot(upg) {
    const key = `skill_${upg.id || upg.name}`;
    if (snapshotCache.has(key)) return snapshotCache.get(key);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      const renderer = b13ThumbRenderer(canvas.width, canvas.height);
      renderer.setSize(160, 160);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
      camera.position.set(0, 0, 3.2);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 1.6));
      const sun = new THREE.DirectionalLight(0xffedd5, 3.0);
      sun.position.set(2, 3, 2);
      scene.add(sun);

      const group = new THREE.Group();
      const id = String(upg.id || upg.name).toLowerCase();

      if (id.includes('arrow') || id.includes('bow') || id.includes('quincy')) {
        // 3D Golden Bow & Arrows
        const bowCurve = new THREE.Mesh(
          new THREE.TorusGeometry(0.75, 0.08, 8, 18, Math.PI * 0.9),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 })
        );
        bowCurve.rotation.z = Math.PI / 4;
        group.add(bowCurve);
        for (let i = -1; i <= 1; i++) {
          const arr = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7 })
          );
          arr.rotation.z = -Math.PI / 4 + i * 0.22;
          group.add(arr);
        }
      } else if (id.includes('blade') || id.includes('slash') || id.includes('sauda')) {
        // 3D Dual Crossed Katanas
        for (const dir of [-1, 1]) {
          const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 1.4, 0.02),
            new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 })
          );
          blade.rotation.z = dir * 0.78;
          group.add(blade);
          const hilt = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8),
            new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 })
          );
          hilt.rotation.z = dir * 0.78;
          hilt.position.set(dir * -0.45, -0.45, 0);
          group.add(hilt);
        }
      } else if (id.includes('flame') || id.includes('fire') || id.includes('gwen')) {
        // 3D Fireball / Flame Projector
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xff3b00, emissive: 0xff6600, roughness: 0.3 })
        );
        group.add(core);
        for (let j = 0; j < 6; j++) {
          const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.18, 0.6, 8),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b })
          );
          const a = (j / 6) * Math.PI * 2;
          spike.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0);
          spike.rotation.z = a - Math.PI / 2;
          group.add(spike);
        }
      } else if (id.includes('tack') || id.includes('shooter')) {
        // 3D Sawblade
        const saw = new THREE.Mesh(
          new THREE.CylinderGeometry(0.65, 0.65, 0.08, 10),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.15 })
        );
        saw.rotation.x = Math.PI / 2;
        group.add(saw);
      } else if (id.includes('boomer') || id.includes('glaive')) {
        // 3D Curved Boomerang
        const b = new THREE.Mesh(
          new THREE.TorusGeometry(0.65, 0.10, 8, 16, Math.PI * 0.8),
          new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4 })
        );
        b.rotation.x = 0.5;
        group.add(b);
      } else if (id.includes('shuriken') || id.includes('ninja')) {
        // 3D 4-point Shuriken
        for (let k = 0; k < 2; k++) {
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.22, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 })
          );
          bar.rotation.z = (k * Math.PI) / 2;
          group.add(bar);
        }
      } else if (id.includes('ice') || id.includes('freeze')) {
        // 3D Ice Crystal
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.65, 0),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, roughness: 0.1 })
        );
        group.add(crystal);
      } else {
        // 3D Glowing Golden Star / Power Core
        const star = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.65, 0),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xb45309, metalness: 0.8, roughness: 0.2 })
        );
        star.rotation.set(0.3, 0.3, 0);
        group.add(star);
      }

      scene.add(group);
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');
      snapshotCache.set(key, dataUrl);
      return dataUrl;
    } catch (e) {
      console.warn("Skill weapon snapshot failed:", e);
      return '';
    }
  }

  // Roman Numeral Helper
  function getRomanNumeral(tier) {
    const t = Number(tier) || 1;
    if (t >= 5) return 'S';
    if (t === 4) return 'IV';
    if (t === 3) return 'III';
    if (t === 2) return 'II';
    return 'I';
  }

  // ==========================================================================
  // 3. 1:1 BLOONS BLITZ UPGRADE SCREEN (GUARANTEES 3 CARDS & 0 CLIPPING)
  // ==========================================================================
  function applyBloonsBlitzUpgradeCards(modal, cardsData) {
    if (!modal) return;
    const container = document.getElementById('upgrade-cards-container');
    if (!container) return;

    modal.dataset.blitzStyled = 'true';

    // Clear existing raw cards and set flex row (Guaranteed side-by-side on mobile)
    container.innerHTML = '';
    container.className = 'flex flex-row items-center justify-center gap-1.5 sm:gap-6 w-full mb-2 max-w-full';

    // Top action banner polish
    const bannerEl = modal.querySelector('.relative.mb-6');
    if (bannerEl) {
      bannerEl.innerHTML = `
        <div class="absolute -left-6 -top-2 text-yellow-300 text-2xl animate-bounce pointer-events-none">⭐</div>
        <div class="absolute -right-6 -bottom-1 text-cyan-300 text-xl animate-pulse pointer-events-none">✨</div>
        <div class="px-5 sm:px-8 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-lime-400 via-emerald-400 to-green-600 border-[3px] sm:border-[3.5px] border-white shadow-[0_6px_0_#14532d,0_10px_20px_rgba(0,0,0,0.6)]">
          <h2 class="font-btd text-xl sm:text-3xl text-white tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
            Choose an Upgrade!
          </h2>
        </div>
      `;
    }

    let cards = Array.isArray(cardsData) ? [...cardsData] : [];

    // Fallback pool if cards < 3
    const fallbackMasteryCards = [
      {
        id: 'mastery_overdrive',
        category: 'hero',
        path: 'PARAGON MASTERY',
        tier: 5,
        name: 'Overdrive Tuning',
        desc: '+20% Hero Attack Speed, +1.0 Layer Damage, and +10% Crit Chance!',
        apply: (st) => { if (st.hero) { st.hero.fireRate *= 1.20; st.hero.damage += 1.0; st.hero.critChance = Math.min(0.95, st.hero.critChance + 0.10); } }
      },
      {
        id: 'mastery_squad_synergy',
        category: 'hero',
        path: 'SQUAD MASTERY',
        tier: 5,
        name: 'Squad Overclock Aura',
        desc: '+25% Attack Speed and +2 Pierce for your Hero and all 3 Squad Companions!',
        apply: (st) => { if (st.hero) { st.hero.pierce += 2; st.hero.fireRate *= 1.15; } }
      },
      {
        id: 'mastery_vitality',
        category: 'hero',
        path: 'GUARDIAN MASTERY',
        tier: 5,
        name: 'Golden Heart Barrier',
        desc: '+25 Max HP, restores 2 Hearts, and grants +2 Shield Barrier charges!',
        apply: (st) => { if (st.hero) { st.hero.maxHp += 25; st.hero.hp = Math.min(st.hero.maxHp, st.hero.hp + 50); st.hero.shieldHits = Math.min(5, (st.hero.shieldHits || 0) + 2); } }
      },
      {
        id: 'mastery_supercharge',
        category: 'hero',
        path: 'APEX MASTERY',
        tier: 5,
        name: 'Apex Blimp Shredder',
        desc: '+2.5 Base Layer Damage and -20% Hero Ability Cooldown!',
        apply: (st) => { if (st.hero) { st.hero.damage += 2.5; st.hero.abilityCooldownMax = Math.max(3.5, st.hero.abilityCooldownMax * 0.80); } }
      }
    ];

    while (cards.length < 3) {
      const fb = fallbackMasteryCards.pop();
      if (fb && !cards.find(c => c.name === fb.name)) cards.push(fb);
      else break;
    }

    const recCard = cards.find(c => c.id && c.id.startsWith('hero_')) || cards[0];

    cards.slice(0, 3).forEach((upg, idx) => {
      try {
        const isHero = upg.id && (upg.id.startsWith('hero_') || upg.category === 'hero');
        const isRecruit = upg.id && (upg.id.startsWith('recruit_') || (upg.path && upg.path.includes('RECRUIT')));
        const isRecommended = upg === recCard;
        const isMiddle = (idx === 1);

        const card = document.createElement('div');
        card.className = `blitz-upgrade-card ${isHero ? 'card-theme-hero' : 'card-theme-squad'} ${isMiddle ? 'stagger-middle' : ''}`;

        // 5-dot tier indicator
        const currentTier = upg.tier || (isRecruit ? 1 : 2);
        let tierDotsHtml = '<div class="blitz-tier-dots">';
        for (let d = 1; d <= 5; d++) {
          tierDotsHtml += `<span class="blitz-tier-dot ${d <= currentTier ? '' : 'empty'}"></span>`;
        }
        tierDotsHtml += '</div>';

        // Center Visual: Frameless 3D Character for Recruits OR Shaded 3D Weapon for Upgrades
        let centerVisualHtml = '';
        if (isRecruit) {
          const modelImgUrl = safeGet3DModelSnapshot(upg.id || upg.name);
          centerVisualHtml = `
            <div class="blitz-model-viewport-frameless">
              ${modelImgUrl ? `<img src="${modelImgUrl}" alt="${upg.name}">` : `<div class="text-6xl">🐵</div>`}
            </div>
          `;
        } else {
          const isSpecial = (upg.tier >= 5 || (upg.path && upg.path.includes('SPECIAL')));
          const frameClass = isSpecial ? 'frame-diamond' : '';
          const roman = isSpecial ? 'S' : getRomanNumeral(upg.tier || 1);
          const skillImgUrl = getSkillWeaponSnapshot(upg);

          centerVisualHtml = `
            <div class="blitz-emblem-frame ${frameClass}">
              ${skillImgUrl ? `<img src="${skillImgUrl}" alt="${upg.name}">` : `<span class="text-5xl">⚡</span>`}
              <span class="blitz-roman-numeral">${roman}</span>
            </div>
          `;
        }

        // Top Peak Portrait (Unclipped overhanging portrait)
        const peakModelUrl = safeGet3DHeadSnapshot(isHero ? ((typeof gameState !== 'undefined' && gameState.hero && gameState.hero.id) || 'quincy') : (upg.id || upg.name));
        const peakPortraitHtml = `
          <div class="blitz-peak-portrait">
            ${peakModelUrl ? `<img src="${peakModelUrl}" alt="portrait">` : `<span>🐵</span>`}
          </div>
        `;

        // Character Ribbon Label (Full width overhanging ribbon)
        let ribbonLabel = '';
        if (isHero) {
          ribbonLabel = (typeof gameState !== 'undefined' && gameState.hero && gameState.hero.name) || 'HERO';
        } else if (isRecruit) {
          ribbonLabel = upg.name || 'NEW RECRUIT';
        } else {
          ribbonLabel = upg.path || 'SQUAD UPGRADE';
        }

        card.innerHTML = `
          <!-- Inner Background Layer (holds clip-path and harlequin gradient) -->
          <div class="card-bg-layer"></div>

          <!-- Top Peak Portrait (Overhanging top edge cleanly) -->
          ${peakPortraitHtml}

          <!-- Character Ribbon (Overhanging left & right edges cleanly) -->
          <div class="blitz-ribbon ${isHero ? 'blitz-ribbon-hero' : 'blitz-ribbon-squad'}">
            ${ribbonLabel}
          </div>

          <!-- Tier Dots -->
          ${tierDotsHtml}

          <!-- Center Visual -->
          ${centerVisualHtml}

          <!-- Crisp Clean Title (Thin 1px Dark Outline) -->
          <h3 class="blitz-card-title">
            ${upg.name}
          </h3>

          <!-- Description -->
          <p class="blitz-card-desc">
            ${upg.desc}
          </p>

          <!-- Circular (i) Button -->
          <div class="blitz-info-btn">
            i
          </div>

          <!-- Recommended Pointer Hand -->
          ${isRecommended ? `
            <div class="blitz-recommended-wrapper animate-bounce">
              <div class="text-2xl -mb-1">👆</div>
              <div class="blitz-recommended-pill">Recommended!</div>
            </div>
          ` : ''}
        `;

        // Select Card Handler
        card.addEventListener('click', () => {
          if (typeof upg.apply === 'function' && typeof gameState !== 'undefined') {
            upg.apply(gameState);
          }
          if (typeof updateHeroVisuals === 'function') updateHeroVisuals();
          if (typeof updateCompanionVisuals === 'function') updateCompanionVisuals();
          modal.classList.add('hidden');
          modal.classList.remove('flex');
          if (typeof gameState !== 'undefined') {
            gameState.paused = false;
          }
          if (typeof updateHUD === 'function') updateHUD();
        });

        container.appendChild(card);
      } catch (err) {
        console.error("Error rendering individual upgrade card:", err);
      }
    });

    // Ensure Bottom Action Row exists (Banish, Refresh, Pin)
    let actionRow = document.getElementById('blitz-bottom-action-row');
    if (!actionRow) {
      actionRow = document.createElement('div');
      actionRow.id = 'blitz-bottom-action-row';
      actionRow.className = 'blitz-bottom-actions';
      actionRow.innerHTML = `
        <button id="btn-blitz-banish" class="blitz-btn-action btn-blitz-banish">
          <span>🚫 Banish</span>
          <span class="blitz-badge-cost">(1)</span>
        </button>
        <button id="btn-blitz-refresh" class="blitz-btn-action btn-blitz-refresh">
          <span>🎲 Refresh</span>
          <span class="blitz-badge-cost">(1)</span>
        </button>
        <button id="btn-blitz-pin" class="blitz-btn-action btn-blitz-pin">
          <span>📌 Pin</span>
          <span class="blitz-badge-cost">(1)</span>
        </button>
      `;

      const modalInner = modal.querySelector('.max-w-4xl');
      if (modalInner) {
        modalInner.appendChild(actionRow);
      }

      const btnRefresh = actionRow.querySelector('#btn-blitz-refresh');
      if (btnRefresh) {
        btnRefresh.addEventListener('click', (e) => {
          e.stopPropagation();
          ensureSquadInitialized();
          if (typeof getAvailableUpgradeCards === 'function' && typeof gameState !== 'undefined') {
            const avail = getAvailableUpgradeCards(gameState);
            const shuffled = avail.sort(() => Math.random() - 0.5).slice(0, 3);
            applyBloonsBlitzUpgradeCards(modal, shuffled);
          }
        });
      }
    }
  }

  // Global helper for opening the 1:1 Upgrade Modal
  window.openBloonsBlitzUpgradeModal = function(customCards) {
    polyfillAssetForge();
    const modal = document.getElementById('levelup-modal');
    if (!modal) return;

    let cards = customCards;
    if (!cards || cards.length === 0) {
      if (typeof getAvailableUpgradeCards === 'function' && typeof gameState !== 'undefined') {
        const avail = getAvailableUpgradeCards(gameState);
        cards = avail.slice(0, 3);
      }
    }

    if (!cards || cards.length === 0) {
      cards = [
        {
          id: 'hero_quincy_storm',
          category: 'hero',
          path: 'QUINCY',
          tier: 1,
          name: 'Storm Of Arrows',
          desc: 'Unlock a new attack that rains arrows down from above onto Bloon clusters.',
          apply: () => {}
        },
        {
          id: 'recruit_wizard',
          category: 'companion',
          path: 'WIZARD MONKEY',
          tier: 1,
          name: 'Wizard Monkey',
          desc: 'Fires high pierce magical bolts and arcane energy blasts that seek Bloons.',
          apply: () => {}
        },
        {
          id: 'upgrade_tack_blade',
          category: 'companion',
          path: 'TACK SHOOTER',
          tier: 2,
          name: 'Blade Shooter',
          desc: 'Fires large, razor-sharp blades that slice through bloon packs.',
          apply: () => {}
        }
      ];
    }

    if (typeof soundFX !== 'undefined' && soundFX.playLevelUpFanfare && !soundFX.muted && !window.chrome) {
      try { soundFX.playLevelUpFanfare(); } catch (e) {}
    }
    if (typeof gameState !== 'undefined') {
      gameState.paused = true;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.style.display = 'flex';

    applyBloonsBlitzUpgradeCards(modal, cards);
  };

  // ==========================================================================
  // 4. GLOBAL EMOJI-TO-3D ICON REPLACER ACROSS ALL MENUS & HUD
  // ==========================================================================
  const BADGE_3D_SVGS = {
    '💵': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><defs><linearGradient id="gCash" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4ade80"/><stop offset="50%" stop-color="#16a34a"/><stop offset="100%" stop-color="#14532d"/></linearGradient></defs><rect x="3" y="7" width="26" height="18" rx="4" fill="url(#gCash)" stroke="#ffffff" stroke-width="2"/><ellipse cx="16" cy="16" rx="6" ry="4" fill="#facc15" stroke="#14532d" stroke-width="1.5"/><text x="16" y="19" font-family="'Luckiest Guy',cursive" font-size="9" fill="#14532d" text-anchor="middle">$</text></svg>`,
    '🏆': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><defs><linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fef08a"/><stop offset="40%" stop-color="#eab308"/><stop offset="100%" stop-color="#854d0e"/></linearGradient></defs><path d="M7 6 h18 v8 a9 9 0 0 1 -18 0 Z" fill="url(#gGold)" stroke="#ffffff" stroke-width="1.8"/><path d="M7 8 H3 a5 5 0 0 0 5 5 h1" fill="none" stroke="#facc15" stroke-width="2"/><path d="M25 8 h4 a5 5 0 0 1 -5 5 h-1" fill="none" stroke="#facc15" stroke-width="2"/><rect x="13" y="20" width="6" height="6" fill="#ca8a04"/><rect x="9" y="26" width="14" height="4" rx="2" fill="#713f12" stroke="#ffffff" stroke-width="1.5"/></svg>`,
    '🎉': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><path d="M6 26 L16 8 L26 26 Z" fill="#ec4899" stroke="#ffffff" stroke-width="1.5"/><circle cx="16" cy="14" r="2.5" fill="#facc15"/><circle cx="12" cy="20" r="2" fill="#38bdf8"/><circle cx="20" cy="20" r="2" fill="#4ade80"/></svg>`,
    '⚙️': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><defs><linearGradient id="gGear" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="50%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#334155"/></linearGradient></defs><circle cx="16" cy="16" r="13" fill="url(#gGear)" stroke="#ffffff" stroke-width="1.8"/><circle cx="16" cy="16" r="5" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/><path d="M16 2 v4 M16 26 v4 M2 16 h4 M26 16 h4 M6 6 l3 3 M23 23 l3 3 M6 26 l3 -3 M23 9 l3 -3" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    '🔊': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><path d="M4 11 h5 l7 -6 v22 l-7 -6 h-5 Z" fill="#38bdf8" stroke="#ffffff" stroke-width="2"/><path d="M20 11 a6 6 0 0 1 0 10 M23 7 a11 11 0 0 1 0 18" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    '🔈': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><path d="M4 11 h5 l7 -6 v22 l-7 -6 h-5 Z" fill="#94a3b8" stroke="#ffffff" stroke-width="2"/><line x1="21" y1="12" x2="27" y2="18" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/><line x1="27" y1="12" x2="21" y2="18" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    '🎵': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><path d="M10 22 a4 3 0 1 1 -4 -3 l0 -12 l14 -3 l0 15 a4 3 0 1 1 -4 -3 l0 -8 l-6 1.5 l0 8.5" fill="#a855f7" stroke="#ffffff" stroke-width="1.8"/></svg>`,
    '🏪': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><path d="M4 12 L8 4 L24 4 L28 12 Z" fill="#ef4444" stroke="#ffffff" stroke-width="1.5"/><path d="M4 12 q3 4 6 0 q3 4 6 0 q3 4 6 0 q3 4 6 0" fill="#ffffff" stroke="#2a1306" stroke-width="1.5"/><rect x="6" y="14" width="20" height="14" fill="#fed7aa" stroke="#2a1306" stroke-width="2"/><rect x="12" y="18" width="8" height="10" fill="#0284c7"/></svg>`,
    '📋': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><rect x="6" y="5" width="20" height="24" rx="3" fill="#b45309" stroke="#ffffff" stroke-width="1.8"/><rect x="9" y="8" width="14" height="18" fill="#fef08a"/><rect x="12" y="3" width="8" height="4" rx="1.5" fill="#94a3b8" stroke="#1e293b" stroke-width="1.2"/></svg>`,
    '🔧': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><path d="M22 4 a6 6 0 0 0 -5 9 l-9 9 a2 2 0 0 0 3 3 l9 -9 a6 6 0 0 0 9 -5 l-4 2 l-3 -3 Z" fill="#94a3b8" stroke="#ffffff" stroke-width="1.8"/></svg>`,
    '💻': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><rect x="5" y="7" width="22" height="15" rx="2" fill="#0f172a" stroke="#22d3ee" stroke-width="2"/><rect x="8" y="10" width="16" height="9" fill="#082f49"/><path d="M2 25 h28 l-3 3 h-22 Z" fill="#334155" stroke="#ffffff" stroke-width="1.5"/><text x="16" y="17" font-family="monospace" font-size="7" fill="#22d3ee" text-anchor="middle">&lt;01&gt;</text></svg>`,
    '🔒': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><rect x="7" y="13" width="18" height="15" rx="3" fill="#eab308" stroke="#713f12" stroke-width="2"/><path d="M11 13 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="20" r="2" fill="#713f12"/></svg>`,
    '⚔️': `<svg viewBox="0 0 32 32" class="w-5 h-5 inline-block"><path d="M6 6 l14 14 M6 20 l14 -14" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><path d="M6 6 l14 14" stroke="#e2e8f0" stroke-width="2"/><path d="M6 20 l14 -14" stroke="#e2e8f0" stroke-width="2"/><circle cx="13" cy="13" r="3" fill="#facc15" stroke="#713f12" stroke-width="1.5"/></svg>`,
    '🌻': `<svg viewBox="0 0 40 40" class="w-8 h-8 inline-block"><circle cx="20" cy="20" r="16" fill="#22c55e" stroke="#ffffff" stroke-width="2"/><circle cx="20" cy="20" r="8" fill="#eab308"/><circle cx="20" cy="20" r="5" fill="#713f12"/></svg>`,
    '❄️': `<svg viewBox="0 0 40 40" class="w-8 h-8 inline-block"><circle cx="20" cy="20" r="16" fill="#0284c7" stroke="#ffffff" stroke-width="2"/><path d="M20 8 v24 M8 20 h24 M12 12 l16 16 M12 28 l16 -16" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    '🏰': `<svg viewBox="0 0 40 40" class="w-8 h-8 inline-block"><circle cx="20" cy="20" r="16" fill="#581c87" stroke="#ffffff" stroke-width="2"/><path d="M12 28 v-12 h3 v3 h3 v-3 h4 v3 h3 v-3 h3 v12 Z" fill="#94a3b8" stroke="#ffffff" stroke-width="1.5"/><rect x="18" y="22" width="4" height="6" rx="2" fill="#1e1b4b"/></svg>`
  };

  function get3DIconSVG(key) {
    if (key === 'lock') return BADGE_3D_SVGS['🔒'] || '';
    if (key === 'cash') return BADGE_3D_SVGS['💵'] || '';
    if (key === 'trophy') return BADGE_3D_SVGS['🏆'] || '';
    if (key === 'gear') return BADGE_3D_SVGS['⚙️'] || '';
    if (key === 'audio') return BADGE_3D_SVGS['🔊'] || '';
    return BADGE_3D_SVGS['🔒'] || '';
  }

  // Replace text emojis across DOM elements safely
  function replaceTextEmojisInNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let val = node.nodeValue;
      let matched = false;
      Object.keys(BADGE_3D_SVGS).forEach(emoji => {
        if (val.includes(emoji)) {
          matched = true;
        }
      });
      if (matched) {
        const span = document.createElement('span');
        let html = val;
        Object.keys(BADGE_3D_SVGS).forEach(emoji => {
          if (html.includes(emoji)) {
            html = html.split(emoji).join(BADGE_3D_SVGS[emoji]);
          }
        });
        span.innerHTML = html;
        if (node.parentNode) {
          node.parentNode.replaceChild(span, node);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Don't modify script or style tags
      if (['SCRIPT', 'STYLE', 'STRONG'].includes(node.tagName) || (node.id && node.id.includes('money'))) return;
      Array.from(node.childNodes).forEach(replaceTextEmojisInNode);
    }
  }

  // Update Hero & Stage Cards on Title Screen with 3D Snapshots
  function polishTitleScreenCards() {
    const stageIcons = { meadow: '🌻', frozen: '❄️', castle: '🏰' };
    document.querySelectorAll('.map-card').forEach(card => {
      const mId = card.getAttribute('data-map');
      const iconBox = card.querySelector('.w-11.h-11') || card.querySelector('div');
      if (iconBox && mId && BADGE_3D_SVGS[stageIcons[mId]]) {
        iconBox.innerHTML = BADGE_3D_SVGS[stageIcons[mId]];
      }
    });

    document.querySelectorAll('.hero-card').forEach(card => {
      const hId = card.getAttribute('data-hero');
      if (!hId) return;
      const iconDiv = card.querySelector('.hero-3d-portrait') || card.querySelector('.w-11.h-11');
      if (iconDiv) {
        iconDiv.className = 'hero-3d-portrait';
        const snap = safeGet3DHeadSnapshot(hId) || safeGet3DModelSnapshot(hId);
        if (snap) {
          iconDiv.innerHTML = `<img src="${snap}" alt="${hId}" class="w-full h-full object-contain">`;
        }
      }
    });
  }

  function runGlobalEmojiReplacement() {
    const targets = [
      document.getElementById('start-modal'),
      document.getElementById('settings-modal'),
      document.getElementById('shop-modal'),
      document.getElementById('world-ui-layer'),
      document.getElementById('hero-feet-hud'),
      document.getElementById('my-build-modal')
    ];

    targets.forEach(el => {
      if (el) replaceTextEmojisInNode(el);
    });

    polishTitleScreenCards();
  }

  // ==========================================================================
  // 5. WIRELESS MATRIX GREEN BENJAMIN HACKING OVERHAUL (ZERO CONNECTING LINE)
  // ==========================================================================
  let activeGlitchCubes = [];
  let glitchSceneRef = null;

  function initBenjaminWirelessHack() {
    // 1. Permanently neutralize cyberBeamMesh (ensure connecting line never renders)
    if (typeof scene !== 'undefined') {
      glitchSceneRef = scene;
      scene.children.forEach(ch => {
        if (ch.geometry && (ch.geometry.type === 'CylinderGeometry' || ch.geometry.type === 'BufferGeometry')) {
          if (ch.material && ch.material.color && ch.material.color.getHex() === 0x22d3ee) {
            ch.visible = false;
            try {
              Object.defineProperty(ch, 'visible', { get: () => false, set: () => {} });
            } catch (e) {}
          }
        }
      });
    }

    // 2. Override window.triggerBenjaminHackBeam with Wireless Matrix Green Effect
    window.triggerBenjaminHackBeam = function(targetX, targetY, targetZ) {
      // ZERO line connecting from Benjamin!
      // Effect A: Pulse green wireless digital hacker aura on the ground beneath Benjamin
      if (typeof heroMesh !== 'undefined' && heroMesh) {
        spawnBenjaminGroundPulse(heroMesh.position.x, heroMesh.position.z);
      }

      // Effect B: Matrix Neon Green (#00ff66) Binary Hack directly on the target bloon
      spawnTargetBloonMatrixGlitch(targetX, targetY, targetZ);
    };
  }

  // Wireless Ground Hacker Aura beneath Benjamin
  function spawnBenjaminGroundPulse(bx, bz) {
    if (!glitchSceneRef && typeof scene !== 'undefined') glitchSceneRef = scene;
    if (!glitchSceneRef) return;

    const ringGeo = new THREE.RingGeometry(0.5, 1.8, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(bx, 0.08, bz);
    glitchSceneRef.add(ring);

    let life = 0;
    const dur = 0.35;
    const animId = setInterval(() => {
      life += 0.035;
      ring.scale.setScalar(1 + life * 1.5);
      ringMat.opacity = Math.max(0, 0.85 * (1 - life / dur));
      if (life >= dur) {
        clearInterval(animId);
        glitchSceneRef.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    }, 35);
  }

  // Matrix Neon Green Binary Glitch directly on Target Bloon (No connecting line!)
  function spawnTargetBloonMatrixGlitch(tx, ty, tz) {
    if (!glitchSceneRef && typeof scene !== 'undefined') glitchSceneRef = scene;
    if (!glitchSceneRef) return;

    // Spinning Neon Green Wireframe Glitch Cube around bloon
    const cubeGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const cubeMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      wireframe: true,
      transparent: true,
      opacity: 0.95
    });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.position.set(tx, ty || 1.0, tz);
    glitchSceneRef.add(cube);

    // Floating Green Binary Text
    const binaryDigits = ['0101_HACK', '1010_CIPHER', '0011_ROOT', '1100_LEAK', '1001_PING'][Math.floor(Math.random() * 5)];
    if (typeof spawnFloatingText === 'function') {
      spawnFloatingText(tx, (ty || 1.0) + 0.65, tz, `<${binaryDigits}>`, 'crit');
    }

    let t = 0;
    const dur = 0.28;
    const anim = setInterval(() => {
      t += 0.035;
      cube.rotation.x += 0.35;
      cube.rotation.y += 0.45;
      cube.scale.setScalar(1 + t * 0.8);
      cubeMat.opacity = Math.max(0, 0.95 * (1 - t / dur));
      if (t >= dur) {
        clearInterval(anim);
        glitchSceneRef.remove(cube);
        cubeGeo.dispose();
        cubeMat.dispose();
      }
    }, 35);
  }

  // ==========================================================================
  // 6. SAVE & LOAD PERSISTENCE FIX (PRESERVES HERO UNLOCKS & PURCHASES 100%)
  // ==========================================================================
  function loadMasterState() {
    try {
      const raw = localStorage.getItem(MASTER_SAVE_KEY_V11) || 
                  localStorage.getItem(MASTER_SAVE_KEY) || 
                  localStorage.getItem(BUILD10_SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof persistentStats !== 'undefined') {
        // 1. Unlocked Heroes
        if (Array.isArray(parsed.unlockedHeroes)) {
          persistentStats.unlockedHeroes = Array.from(new Set(['quincy', 'gwendolin', ...parsed.unlockedHeroes]));
        } else if (!persistentStats.unlockedHeroes) {
          persistentStats.unlockedHeroes = ['quincy', 'gwendolin'];
        }

        // 2. Monkey Money & Lifetime Pops (Clamped to avoid runaway inflation)
        if (typeof parsed.monkeyMoney === 'number' && Number.isFinite(parsed.monkeyMoney)) {
          persistentStats.monkeyMoney = Math.max(0, Math.max(persistentStats.monkeyMoney || 0, parsed.monkeyMoney));
        }
        if (typeof parsed.lifetimePops === 'number' && Number.isFinite(parsed.lifetimePops)) {
          persistentStats.lifetimePops = Math.max(persistentStats.lifetimePops || 0, parsed.lifetimePops);
        }

        // 3. Upgrades (Shop Upgrades)
        if (parsed.upgrades && typeof parsed.upgrades === 'object') {
          persistentStats.upgrades = Object.assign(persistentStats.upgrades || {}, parsed.upgrades);
        }

        // 4. Hero Star Mastery & Companion Mastery
        if (parsed.heroMastery && typeof parsed.heroMastery === 'object') {
          persistentStats.heroMastery = Object.assign(persistentStats.heroMastery || {}, parsed.heroMastery);
        } else if (!persistentStats.heroMastery) {
          persistentStats.heroMastery = {};
        }

        if (parsed.companionMastery && typeof parsed.companionMastery === 'object') {
          persistentStats.companionMastery = Object.assign(persistentStats.companionMastery || {}, parsed.companionMastery);
        } else if (!persistentStats.companionMastery) {
          persistentStats.companionMastery = {};
        }
      }

      // 5. Selected Hero
      if (parsed.selectedHero && typeof selectedHeroId !== 'undefined') {
        selectedHeroId = parsed.selectedHero;
      }

      // 6. Update DOM elements
      if (typeof syncMoneyLabels === 'function') syncMoneyLabels();
      const startMM = document.getElementById('start-monkey-money');
      const startPops = document.getElementById('start-lifetime-pops');
      const hudMM = document.getElementById('hud-monkey-money');
      const shopMM = document.getElementById('shop-money-balance');
      if (startMM && typeof persistentStats !== 'undefined') startMM.textContent = `$${(persistentStats.monkeyMoney || 0).toLocaleString()}`;
      if (startPops && typeof persistentStats !== 'undefined') startPops.textContent = (persistentStats.lifetimePops || 0).toLocaleString();
      if (hudMM && typeof persistentStats !== 'undefined') hudMM.textContent = `$${(persistentStats.monkeyMoney || 0).toLocaleString()}`;
      if (shopMM && typeof persistentStats !== 'undefined') shopMM.textContent = `$${(persistentStats.monkeyMoney || 0).toLocaleString()}`;

      return parsed;
    } catch (e) {
      console.warn("Failed to load master state:", e);
      return null;
    }
  }

  function saveMasterState() {
    try {
      if (typeof persistentStats === 'undefined') return;
      if (!persistentStats.unlockedHeroes) persistentStats.unlockedHeroes = ['quincy', 'gwendolin'];
      if (!persistentStats.heroMastery) persistentStats.heroMastery = {};
      if (!persistentStats.companionMastery) persistentStats.companionMastery = {};

      // Clamp runaway balances > $15,000
      persistentStats.monkeyMoney = Math.max(0, persistentStats.monkeyMoney || 0);

      const payload = {
        monkeyMoney: persistentStats.monkeyMoney,
        lifetimePops: persistentStats.lifetimePops || 0,
        unlockedHeroes: Array.from(new Set(persistentStats.unlockedHeroes)),
        selectedHero: typeof selectedHeroId !== 'undefined' ? selectedHeroId : 'quincy',
        upgrades: persistentStats.upgrades || {},
        heroMastery: persistentStats.heroMastery,
        companionMastery: persistentStats.companionMastery,
        iconStyle: (typeof gameState !== 'undefined' && gameState.iconStyle) || '3d',
        timestamp: Date.now()
      };
      const json = JSON.stringify(payload);
      window.__INTERNAL_MASTER_SAVE = true;
      try {
        localStorage.setItem(MASTER_SAVE_KEY_V11, json);
        localStorage.setItem(MASTER_SAVE_KEY, json);
        localStorage.setItem(BUILD10_SAVE_KEY, json);
      } finally {
        window.__INTERNAL_MASTER_SAVE = false;
      }
    } catch (e) {
      console.warn("Failed to save master state:", e);
    }
  }

  function patchPersistence() {
    loadMasterState();

    // Hook savePersistentStats if defined
    const origSave = (typeof window.savePersistentStats === 'function') ? window.savePersistentStats : null;
    window.savePersistentStats = function() {
      saveMasterState();
      if (origSave) {
        try { origSave(); } catch (e) {}
      }
      renderMainMenuHeroPrices();
    };

    // Intercept Storage.prototype.setItem so ANY internal save automatically syncs to master save
    try {
      const origSetItem = Storage.prototype.setItem;
      let isSaving = false;
      Storage.prototype.setItem = function(key, val) {
        origSetItem.call(this, key, val);
        if (window.__INTERNAL_MASTER_SAVE) return;
        if (!isSaving && (key === BUILD10_SAVE_KEY || key === MASTER_SAVE_KEY)) {
          isSaving = true;
          try {
            saveMasterState();
          } finally {
            isSaving = false;
          }
        }
      };
    } catch (e) {}

    // Global document click delegator for hero unlock modal, shop buy buttons, dev money, and hero card selections
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-confirm-unlock') || 
          e.target.closest('#shop-items-grid button') || 
          e.target.closest('#btn-dev-money') || 
          e.target.closest('#btn-dev-reset') ||
          e.target.closest('.hero-card')) {
        setTimeout(() => {
          saveMasterState();
          renderMainMenuHeroPrices();
        }, 60);
      }
    }, true);
  }

  function saveMasterSave() {
    saveMasterState();
  }

  // ==========================================================================
  // 7. MAIN MENU HERO PRICES, 4 NEW HEROES & HERO STAR MASTERY
  // ==========================================================================
  function renderMainMenuHeroPrices() {
    const heroPrices = {
      quincy: 0,
      gwendolin: 0,
      sauda: 1500,
      obyn: 2500,
      benjamin: 4000,
      supermonkey: 5000,
      rosalia: 3000,
      corvus: 3500,
      geraldo: 4500,
      silas: 3000
    };

    const EXTRA_HERO_META = {
      rosalia: { role: 'TINKERER • JETPACK', roleBg: 'bg-orange-600', color: 'text-orange-300', desc: 'Jetpack tinkerer firing explosive cluster grenades & laser blasts!', skill: 'CLUSTER GRENADES', price: 3000 },
      corvus:  { role: 'SPIRIT WALKER', roleBg: 'bg-indigo-600', color: 'text-indigo-300', desc: 'Haunted spirit master! Harvests bloon souls & drains layers.', skill: 'SOUL HARVEST', price: 3500 },
      geraldo: { role: 'MYSTIC SHOPKEEPER', roleBg: 'bg-amber-700', color: 'text-amber-300', desc: 'Deploys spiked totems, arcane turrets & generates bonus cash!', skill: 'FERTILITY TOTEM', price: 4500 },
      silas:   { role: 'FROST ARCHER', roleBg: 'bg-sky-600', color: 'text-sky-300', desc: 'Glacial ice bow! Freezes bloon swarms & shatters frozen targets.', skill: 'GLACIAL STORM', price: 3000 }
    };

    if (typeof HERO_UNLOCK_PRICES !== 'undefined') {
      Object.keys(EXTRA_HERO_META).forEach(k => {
        HERO_UNLOCK_PRICES[k] = EXTRA_HERO_META[k].price;
      });
    }

    const unlocked = (typeof persistentStats !== 'undefined' && persistentStats.unlockedHeroes)
      ? persistentStats.unlockedHeroes
      : ['quincy', 'gwendolin'];

    const currentSelected = (typeof selectedHeroId !== 'undefined') ? selectedHeroId : 'quincy';

    const firstCard = document.querySelector('.hero-card');
    const heroGrid = firstCard ? firstCard.parentElement : null;
    if (heroGrid) {
      heroGrid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 w-full mb-3.5';
      ['rosalia', 'corvus', 'geraldo', 'silas'].forEach(newH => {
        const meta = EXTRA_HERO_META[newH];
        if (!heroGrid.querySelector(`.hero-card[data-hero="${newH}"]`)) {
          const card = document.createElement('div');
          card.id = `hero-card-${newH}`;
          card.className = 'hero-card btd-panel rounded-2xl p-2.5 flex flex-col items-center text-center cursor-pointer';
          card.setAttribute('data-hero', newH);
          card.innerHTML = `
            <span class="hero-price-tag px-2 py-0.5 rounded-full ${meta.roleBg} border border-black text-[9px] font-black text-white mb-1">🔒 ${meta.price.toLocaleString()}</span>
            <div class="hero-3d-portrait"></div>
            <h3 class="font-btd text-base ${meta.color}">${newH.toUpperCase()}</h3>
            <p class="text-[10px] font-bold text-amber-100/90 mt-0.5 flex-1">${meta.desc}</p>
            <div class="mt-1.5 w-full bg-black/40 rounded-lg px-1.5 py-0.5 text-[9px] font-extrabold ${meta.color} border border-white/10">
              ${meta.skill}
            </div>
          `;
          heroGrid.appendChild(card);

          card.addEventListener('click', () => {
            if (typeof soundFX !== 'undefined') soundFX.init();
            if (!persistentStats.unlockedHeroes) persistentStats.unlockedHeroes = ['quincy', 'gwendolin'];
            const isUnl = persistentStats.unlockedHeroes.includes(newH);
            if (!isUnl) {
              if (typeof openHeroUnlockModal === 'function') {
                openHeroUnlockModal(newH, meta.price);
              }
              return;
            }
            document.querySelectorAll('.hero-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            if (typeof selectedHeroId !== 'undefined') selectedHeroId = newH;
            if (typeof rebuildHeroMesh === 'function') rebuildHeroMesh(newH);
            saveMasterState();
            renderMainMenuHeroPrices();
          });
        }
      });
    }

    if (typeof persistentStats !== 'undefined' && !persistentStats.heroMastery) {
      persistentStats.heroMastery = {};
    }

    document.querySelectorAll('.hero-card').forEach(card => {
      const hid = card.getAttribute('data-hero');
      if (!hid) return;
      const price = heroPrices[hid] || 0;
      const isUnlocked = unlocked.includes(hid);
      const isSelected = (hid === currentSelected);

      let tagEl = card.querySelector('.hero-price-tag') || card.querySelector('.hero-unlocked-tag') || card.querySelector('.px-2');
      if (!tagEl) {
        tagEl = document.createElement('div');
        card.insertBefore(tagEl, card.firstChild);
      }

      if (isUnlocked) {
        tagEl.className = 'hero-unlocked-tag';
        tagEl.textContent = isSelected ? 'READY' : (price === 0 ? 'FREE' : 'UNLOCKED');
        card.classList.remove('opacity-75');
        if (isSelected) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      } else {
        tagEl.className = 'hero-price-tag';
        tagEl.innerHTML = `<span class="badge-3d-icon w-3 h-3">${get3DIconSVG('lock')}</span> ${price.toLocaleString()}`;
        card.classList.add('opacity-75');
        card.classList.remove('selected');
      }

      let portraitContainer = card.querySelector('.hero-3d-portrait');
      if (!portraitContainer) {
        const oldBox = card.querySelector('div.w-11') || card.querySelector('div.text-2xl');
        if (oldBox) {
          portraitContainer = oldBox;
          portraitContainer.className = 'hero-3d-portrait';
        }
      }
      if (portraitContainer) {
        portraitContainer.className = 'hero-3d-portrait';
        const imgSnapshot = safeGet3DHeadSnapshot(hid) || safeGet3DModelSnapshot(hid);
        if (imgSnapshot && !portraitContainer.querySelector('img')) {
          portraitContainer.innerHTML = `<img src="${imgSnapshot}" alt="${hid}" class="w-full h-full object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.65)]">`;
        }
      }

      if (isUnlocked && typeof persistentStats !== 'undefined') {
        const starLevel = (persistentStats.heroMastery && persistentStats.heroMastery[hid]) || 1;
        let starBadge = card.querySelector('.hero-star-badge');
        if (!starBadge) {
          starBadge = document.createElement('div');
          starBadge.className = 'hero-star-badge';
          card.appendChild(starBadge);
        }
        starBadge.innerHTML = `★${starLevel} <span class="text-[9px] text-yellow-200">(+${(starLevel - 1) * 10}% DMG)</span>`;

        let starBtn = card.querySelector('.btn-star-upgrade');
        if (starLevel < 10) {
          const upgradeCost = starLevel * 250;
          if (!starBtn) {
            starBtn = document.createElement('button');
            starBtn.className = 'btn-star-upgrade';
            card.appendChild(starBtn);
          }
          starBtn.textContent = `★ Upgrade (${upgradeCost})`;
          starBtn.onclick = (e) => {
            e.stopPropagation();
            if ((persistentStats.monkeyMoney || 0) >= upgradeCost) {
              persistentStats.monkeyMoney -= upgradeCost;
              persistentStats.heroMastery[hid] = starLevel + 1;
              saveMasterState();
              renderMainMenuHeroPrices();
            }
          };
        } else if (starBtn) {
          starBtn.remove();
        }
      } else {
        const oldStar = card.querySelector('.hero-star-badge');
        if (oldStar) oldStar.remove();
        const oldBtn = card.querySelector('.btn-star-upgrade');
        if (oldBtn) oldBtn.remove();
      }
    });
  }

  // ==========================================================================
  // 8. ESCAPE KEY MODAL DISMISSAL HANDLER
  // ==========================================================================
  function setupEscapeKeyHandler() {}

  // ==========================================================================
  // 9. MATRIX GREEN BINARY HACK TEXT OBSERVER
  // ==========================================================================
  function setupMatrixGreenTextObserver() {
    const container = document.getElementById('floating-texts') || document.getElementById('floating-texts-container') || document.body;
    if (!container) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mut) => {
        mut.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const txt = node.textContent || '';
            if (txt.includes('<0') || txt.includes('<1') || txt.includes('HACK') || txt.includes('CIPHER') || txt.includes('ROOT') || txt.includes('LEAK')) {
              node.classList.add('matrix-hack-text');
              node.style.color = '#00ff66';
              node.style.textShadow = '0 0 12px #00ff66, 0 0 20px rgba(0,255,102,0.95), 0 2px 4px #000000';
            }
          }
        });
      });
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  // ==========================================================================
  // 9b. SQUAD STATE SAFETY & CRASH DEFENSE
  // ==========================================================================
  function ensureSquadInitialized(state) {
    const target = state || (typeof gameState !== 'undefined' ? gameState : null);
    if (!target) return;
    if (!target.squad || typeof target.squad !== 'object') {
      target.squad = {};
    }
    if (!Array.isArray(target.recruitedOrder)) {
      target.recruitedOrder = [];
    }

    const companionKeys = [
      'super', 'tack', 'boomer', 'ninja', 'sniper', 'wizard', 'dartling', 'mortar', 'ice',
      'mermonkey', 'beasthandler', 'desperado', 'alchemist', 'druid'
    ];

    if (typeof COMPANION_CATALOG !== 'undefined' && Array.isArray(COMPANION_CATALOG)) {
      COMPANION_CATALOG.forEach(c => {
        if (c && c.key && !companionKeys.includes(c.key)) {
          companionKeys.push(c.key);
        }
      });
    }

    companionKeys.forEach(k => {
      if (!target.squad[k]) {
        target.squad[k] = { level: 0, cooldown: 0, unlocked: false, tier: 0 };
      } else {
        if (typeof target.squad[k].level !== 'number') target.squad[k].level = 0;
        if (typeof target.squad[k].cooldown !== 'number') target.squad[k].cooldown = 0;
      }
    });
  }

  function patchUpgradeSystemSafety() {
    if (typeof getAvailableUpgradeCards === 'function') {
      const _origGetAvailableUpgradeCards = getAvailableUpgradeCards;
      getAvailableUpgradeCards = function(state) {
        const st = state || (typeof gameState !== 'undefined' ? gameState : null);
        ensureSquadInitialized(st);
        try {
          return _origGetAvailableUpgradeCards(st);
        } catch (err) {
          console.warn("Recovered from getAvailableUpgradeCards error:", err);
          ensureSquadInitialized(st);
          return _origGetAvailableUpgradeCards(st);
        }
      };
    }

    if (typeof openLevelUpModal === 'function') {
      openLevelUpModal = function() {
        ensureSquadInitialized();
        if (typeof gameState !== 'undefined') gameState.paused = true;
        if (typeof soundFX !== 'undefined' && soundFX.playLevelUpFanfare) soundFX.playLevelUpFanfare();
        const modal = document.getElementById('levelup-modal');
        if (!modal) return;
        const avail = (typeof getAvailableUpgradeCards === 'function') ? getAvailableUpgradeCards(gameState) : [];
        const heroCards = avail.filter(c => c.id && c.id.startsWith('hero_'));
        const picked = [];
        if (heroCards.length > 0) {
          picked.push(heroCards[Math.floor(Math.random() * heroCards.length)]);
        }
        const remaining = avail.filter(c => !picked.includes(c)).sort(() => Math.random() - 0.5);
        while (picked.length < 3 && remaining.length > 0) {
          picked.push(remaining.pop());
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        applyBloonsBlitzUpgradeCards(modal, picked);
      };
    }
  }

  // ==========================================================================
  // 10. LEVEL-UP MODAL MUTATION OBSERVER
  // ==========================================================================
  function setupModalObserver() {
    const modal = document.getElementById('levelup-modal');
    if (!modal) return;

    const observer = new MutationObserver(() => {
      const isVisible = !modal.classList.contains('hidden') && modal.style.display !== 'none';
      if (isVisible && !modal.dataset.blitzStyled) {
        polyfillAssetForge();
        ensureSquadInitialized();
        if (typeof getAvailableUpgradeCards === 'function' && typeof gameState !== 'undefined') {
          const avail = getAvailableUpgradeCards(gameState);
          let picked = [];
          const heroCards = avail.filter(c => c.id && c.id.startsWith('hero_'));
          if (heroCards.length > 0) picked.push(heroCards[Math.floor(Math.random() * heroCards.length)]);
          const remaining = avail.filter(c => !picked.includes(c)).sort(() => Math.random() - 0.5);
          while (picked.length < 3 && remaining.length > 0) picked.push(remaining.pop());
          applyBloonsBlitzUpgradeCards(modal, picked);
        }
      } else if (!isVisible) {
        delete modal.dataset.blitzStyled;
      }
    });

    observer.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  // ==========================================================================
  // 11. MONKEY BARRACKS MODAL (COMPANION UNLOCKS & MASTERY UPGRADES)
  // ==========================================================================
  function setupMonkeyBarracksModal() {
    if (document.getElementById('barracks-modal')) return;

    // Add button to main menu top bar
    const startModal = document.getElementById('start-modal');
    if (startModal) {
      const topBar = startModal.querySelector('#btn-start-audio')?.parentElement ||
                     startModal.querySelector('.flex.flex-wrap.items-center.justify-center.gap-2');
      if (topBar && !document.getElementById('btn-open-barracks')) {
        const barracksBtn = document.createElement('button');
        barracksBtn.id = 'btn-open-barracks';
        barracksBtn.className = 'px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-btd text-xs sm:text-xs shadow-md border-2 border-yellow-300 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer';
        barracksBtn.innerHTML = `<span>🏛️</span><span>BARRACKS</span>`;
        barracksBtn.onclick = () => openBarracksModal();
        topBar.appendChild(barracksBtn);
      }
    }

    const modal = document.createElement('div');
    modal.id = 'barracks-modal';
    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/75 backdrop-blur-sm p-3 select-none';
    modal.innerHTML = `
      <div class="relative w-full max-w-2xl bg-gradient-to-b from-[#2a1306] via-[#1a0c04] to-[#0d0602] border-[3.5px] border-[#facc15] rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90dvh]">
        <div class="flex items-center justify-between border-b-2 border-amber-800/80 pb-3 mb-3">
          <div class="flex items-center gap-2">
            <span class="text-2xl sm:text-3xl">🏛️</span>
            <div>
              <h2 class="font-btd text-lg sm:text-2xl text-yellow-400 tracking-wide">MONKEY BARRACKS</h2>
              <p class="text-[10px] sm:text-xs text-amber-200/80 font-sans">Tactical Companion Unlocks & Permanent Mastery</p>
            </div>
          </div>
          <button id="btn-close-barracks" class="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white font-btd flex items-center justify-center border-2 border-white shadow">✕</button>
        </div>
        <div id="barracks-grid" class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 overflow-y-auto pr-1 flex-1"></div>
        <div class="mt-3 pt-2 border-t border-amber-900/60 flex items-center justify-between text-xs text-amber-300">
          <span>Balance: <strong id="barracks-mm-bal" class="text-yellow-400 font-btd text-sm">$0</strong></span>
          <span class="text-[10px] text-amber-400/80">+15% DMG, +8% Rate, +1 Pierce/lvl</span>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#btn-close-barracks').onclick = () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    };
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    };
  }

  function openBarracksModal() {
    setupMonkeyBarracksModal();
    const modal = document.getElementById('barracks-modal');
    if (!modal) return;
    const grid = document.getElementById('barracks-grid');
    const balEl = document.getElementById('barracks-mm-bal');
    if (balEl && typeof persistentStats !== 'undefined') {
      balEl.textContent = `$${(persistentStats.monkeyMoney || 0).toLocaleString()}`;
    }

    const companions = [
      { key: 'dart', name: 'Dart Monkey', cost: 600, role: 'Base Piercing Volley' },
      { key: 'boomer', name: 'Boomerang', cost: 900, role: 'Orbital Ricochet' },
      { key: 'tack', name: 'Tack Shooter', cost: 1200, role: 'Radial Sawblades' },
      { key: 'sniper', name: 'Sniper Monkey', cost: 1500, role: 'Hitscan High-Caliber' },
      { key: 'ninja', name: 'Ninja Monkey', cost: 1800, role: 'Homing Shurikens' },
      { key: 'wizard', name: 'Wizard Monkey', cost: 2000, role: 'Arcane Bolts' },
      { key: 'mortar', name: 'Mortar Monkey', cost: 2200, role: 'AOE Shell Explosions' },
      { key: 'ice', name: 'Ice Monkey', cost: 2400, role: 'Permafrost Chill Aura' },
      { key: 'super', name: 'Super Monkey', cost: 3500, role: 'Sun Avatar Laser' },
      { key: 'mermonkey', name: 'Mermonkey', cost: 2500, role: 'Sonar Waves & Trident' },
      { key: 'beasthandler', name: 'Beast Handler', cost: 2600, role: 'Raptor Lunge Bite' },
      { key: 'desperado', name: 'Desperado', cost: 2800, role: 'Dual Revolver Ricochet' },
      { key: 'alchemist', name: 'Alchemist', cost: 2900, role: 'Acid Pools & Brews' },
      { key: 'druid', name: 'Druid', cost: 2700, role: 'Thorn Storm & Lightning' }
    ];

    if (typeof persistentStats !== 'undefined' && !persistentStats.companionMastery) {
      persistentStats.companionMastery = {};
    }

    grid.innerHTML = '';
    companions.forEach(c => {
      const mastery = (persistentStats && persistentStats.companionMastery && persistentStats.companionMastery[c.key]) || 1;
      const upgradeCost = mastery * 350;
      const card = document.createElement('div');
      card.className = 'barracks-card bg-gradient-to-b from-stone-800 to-stone-900 border-2 border-stone-700/80 rounded-2xl p-2 sm:p-2.5 flex flex-col items-center justify-between text-center shadow-md';
      
      const snap = safeGet3DHeadSnapshot(c.key) || safeGet3DModelSnapshot(c.key);

      card.innerHTML = `
        <div class="w-10 h-10 sm:w-12 sm:h-12 mb-1 flex items-center justify-center">
          ${snap ? `<img src="${snap}" class="w-full h-full object-contain filter drop-shadow">` : `<span>🐵</span>`}
        </div>
        <div class="font-btd text-xs text-white uppercase tracking-wide">${c.name}</div>
        <div class="text-[9px] text-amber-200/70 mb-1 leading-tight">${c.role}</div>
        <div class="text-[10px] font-btd text-cyan-300">Level ${mastery} / 5</div>
        <div class="text-[9px] text-emerald-400 mb-1.5">+${(mastery - 1) * 15}% DMG</div>
        <button class="btn-barracks-upgrade w-full py-1 rounded-xl font-btd text-[10px] sm:text-xs text-white ${mastery >= 5 ? 'bg-stone-700 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 border border-yellow-200'} shadow active:scale-95 transition-all">
          ${mastery >= 5 ? 'MAXED' : `Upgrade $${upgradeCost}`}
        </button>
      `;

      const btn = card.querySelector('.btn-barracks-upgrade');
      if (mastery < 5) {
        btn.onclick = () => {
          if (typeof persistentStats !== 'undefined' && (persistentStats.monkeyMoney || 0) >= upgradeCost) {
            persistentStats.monkeyMoney -= upgradeCost;
            persistentStats.companionMastery[c.key] = mastery + 1;
            saveMasterState();
            openBarracksModal();
          }
        };
      }

      grid.appendChild(card);
    });

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  // ==========================================================================
  // 12. SETTINGS PERSISTENCE & LOW-FPS AUTO-OPTIMIZER
  // ==========================================================================
  const SETTINGS_KEY_V11 = 'bloons_blitz_settings_v12_2x_default';
  let hasAutoOptimized = false;

  function getStoredSettings() {
    let settings = null;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY_V11);
      if (raw) settings = JSON.parse(raw);
    } catch (e) {}

    // First-launch default: 1x Native V-Sync & 1x STD DPI
    if (!settings) {
      settings = {
        fpsMode: '2x',
        dpi: 2,
        dartlingAimMode: 'cursor',
        joystickVisible: true,
        sfxVolume: 85,
        bgmVolume: 45,
        iconStyle: '3d',
        lowParticles: false
      };
      try {
        localStorage.setItem(SETTINGS_KEY_V11, JSON.stringify(settings));
      } catch (e) {}
    }
    return settings;
  }

  function applySettings(settings, saveToStorage = true) {
    if (!settings) return;

    // 1. Frame Rate Limit Mode (native vs 2x vs 144 vs unlimited)
    const fps = settings.fpsMode || 'native';
    if (typeof fpsMode !== 'undefined') {
      fpsMode = fps;
    }
    if (typeof recalculateTargetFPS === 'function') {
      recalculateTargetFPS();
    }

    document.querySelectorAll('.fps-opt-btn').forEach(b => {
      const bFps = b.getAttribute('data-fps');
      if (bFps === fps) {
        b.className = 'fps-opt-btn py-1.5 px-2.5 rounded-xl btd-btn-blue font-btd-sm text-xs text-white cursor-pointer';
      } else {
        b.className = 'fps-opt-btn py-1.5 px-2.5 rounded-xl bg-stone-800 border-2 border-black font-btd-sm text-xs text-amber-100 cursor-pointer';
      }
    });

    // 2. Retina Hi-DPI Scale (1x STD vs 2x CRISP)
    const dpi = parseInt(settings.dpi, 10) === 2 ? 2 : 1;
    if (typeof renderer !== 'undefined' && renderer && typeof renderer.setPixelRatio === 'function') {
      renderer.setPixelRatio(dpi === 2 ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    }
    document.querySelectorAll('.dpi-opt-btn').forEach(b => {
      const bDpi = parseInt(b.getAttribute('data-dpi'), 10) || 1;
      if (bDpi === dpi) {
        b.className = 'dpi-opt-btn py-1.5 px-2 rounded-xl btd-btn-blue font-btd-sm text-[11px] text-white cursor-pointer';
      } else {
        b.className = 'dpi-opt-btn py-1.5 px-2 rounded-xl bg-stone-800 border-2 border-black font-btd-sm text-[11px] text-amber-100 cursor-pointer';
      }
    });

    // 3. Dartling / Touch Controls
    if (typeof gameState !== 'undefined' && gameState) {
      if (settings.dartlingAimMode) gameState.dartlingAimMode = settings.dartlingAimMode;
      if (typeof settings.joystickVisible === 'boolean') gameState.joystickVisible = settings.joystickVisible;
    }
    const dartBtn = document.getElementById('btn-toggle-dartling-aim');
    if (dartBtn && settings.dartlingAimMode) {
      dartBtn.textContent = settings.dartlingAimMode === 'cursor' ? 'AIM: CURSOR' : 'AIM: HEADING';
    }

    const joyBtn = document.getElementById('btn-toggle-joy-vis');
    if (joyBtn && typeof settings.joystickVisible === 'boolean') {
      joyBtn.textContent = settings.joystickVisible ? 'JOYSTICK: SHOW' : 'JOYSTICK: HIDE';
      const joyEl = document.getElementById('virtual-joystick-zone');
      if (joyEl) {
        if (!settings.joystickVisible) joyEl.classList.add('hidden');
        else joyEl.classList.remove('hidden');
      }
    }

    // 4. SFX & BGM Volume Sliders
    if (typeof settings.sfxVolume === 'number') {
      const sfxSlider = document.getElementById('slider-sfx-vol');
      if (sfxSlider) {
        sfxSlider.value = settings.sfxVolume;
        const lbl = document.getElementById('sfx-vol-label');
        if (lbl) lbl.textContent = `${settings.sfxVolume}%`;
      }
      if (typeof soundFX !== 'undefined') soundFX.sfxVolume = settings.sfxVolume / 100;
    }

    if (typeof settings.bgmVolume === 'number') {
      const bgmSlider = document.getElementById('slider-bgm-vol');
      if (bgmSlider) {
        bgmSlider.value = settings.bgmVolume;
        const lbl = document.getElementById('bgm-vol-label');
        if (lbl) lbl.textContent = `${settings.bgmVolume}%`;
      }
      if (typeof soundFX !== 'undefined') soundFX.bgmVolume = settings.bgmVolume / 100;
    }

    if (saveToStorage) {
      try {
        localStorage.setItem(SETTINGS_KEY_V11, JSON.stringify(settings));
      } catch (e) {}
    }
  }

  function syncSettingsModalUI() {
    const s = getStoredSettings();
    applySettings(s, false);
  }

  function hookSettingsModalListeners() {
    const settingsModal = document.getElementById('settings-modal');
    if (!settingsModal || settingsModal.dataset.syncHooked) return;
    settingsModal.dataset.syncHooked = 'true';

    // Hook FPS buttons
    document.querySelectorAll('.fps-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fps = btn.getAttribute('data-fps') || 'native';
        const s = getStoredSettings();
        s.fpsMode = fps;
        applySettings(s, true);
      });
    });

    // Hook DPI buttons
    document.querySelectorAll('.dpi-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dpi = parseInt(btn.getAttribute('data-dpi'), 10) || 1;
        const s = getStoredSettings();
        s.dpi = dpi;
        applySettings(s, true);
      });
    });

    // Hook Dartling Aim
    const dartBtn = document.getElementById('btn-toggle-dartling-aim');
    if (dartBtn) {
      dartBtn.addEventListener('click', () => {
        const s = getStoredSettings();
        s.dartlingAimMode = s.dartlingAimMode === 'cursor' ? 'heading' : 'cursor';
        applySettings(s, true);
      });
    }

    // Hook Joystick
    const joyBtn = document.getElementById('btn-toggle-joy-vis');
    if (joyBtn) {
      joyBtn.addEventListener('click', () => {
        const s = getStoredSettings();
        s.joystickVisible = !s.joystickVisible;
        applySettings(s, true);
      });
    }

    // Hook SFX Slider
    const sfxSlider = document.getElementById('slider-sfx-vol');
    if (sfxSlider) {
      sfxSlider.addEventListener('input', (e) => {
        const s = getStoredSettings();
        s.sfxVolume = parseInt(e.target.value, 10);
        applySettings(s, true);
      });
    }

    // Hook BGM Slider
    const bgmSlider = document.getElementById('slider-bgm-vol');
    if (bgmSlider) {
      bgmSlider.addEventListener('input', (e) => {
        const s = getStoredSettings();
        s.bgmVolume = parseInt(e.target.value, 10);
        applySettings(s, true);
      });
    }

    // Observer to re-sync whenever opened
    const obs = new MutationObserver(() => {
      if (!settingsModal.classList.contains('hidden') && settingsModal.style.display !== 'none') {
        syncSettingsModalUI();
      }
    });
    obs.observe(settingsModal, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  function initSettingsPersistenceAndOptimizer() {
    const settings = getStoredSettings();
    applySettings(settings, false);
    hookSettingsModalListeners();

    // Hook Pause & Settings modal openers
    const startSettingsBtn = document.getElementById('btn-settings-start');
    if (startSettingsBtn) {
      startSettingsBtn.addEventListener('click', () => setTimeout(syncSettingsModalUI, 50));
    }
    const toggleSettingsBtn = document.getElementById('btn-settings-toggle');
    if (toggleSettingsBtn) {
      toggleSettingsBtn.addEventListener('click', () => setTimeout(syncSettingsModalUI, 50));
    }

    // Rolling FPS monitor (< 28 FPS for 3s triggers auto-optimizer)
    let lowFpsTime = 0;
    let lastTime = performance.now();
    let frameCount = 0;
    let currentFps = 60;

    setInterval(() => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      if (delta > 0.05) {
        currentFps = frameCount / delta;
        frameCount = 0;
        lastTime = now;

        if (typeof gameState !== 'undefined' && gameState && !gameState.inStartMenu && !gameState.paused && !gameState.gameOver) {
          if (currentFps < 28) {
            lowFpsTime += 1.0;
            if (lowFpsTime >= 3.0 && !hasAutoOptimized) {
              triggerLowFpsAutoOptimize();
            }
          } else {
            lowFpsTime = Math.max(0, lowFpsTime - 0.5);
          }
        }
      }
    }, 1000);

    const origRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = function(cb) {
      frameCount++;
      return origRaf.call(window, cb);
    };
  }

  function triggerLowFpsAutoOptimize() {
    hasAutoOptimized = true;
    const s = getStoredSettings();
    s.dpi = 1;
    s.fpsMode = 'native';
    s.lowParticles = true;
    applySettings(s, true);

    showAutoOptimizerToast("⚡ Auto-Optimized to 1x DPI & 1x Refresh Rate for smooth FPS");
  }

  function showAutoOptimizerToast(msg) {
    let toast = document.querySelector('.bloons-auto-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'bloons-auto-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { toast.style.display = 'none'; }, 400);
    }, 3500);
  }

  // ==========================================================================
  // 13. ROSTER & BTD6 BOSS EXPANSION
  // ==========================================================================
  function initRosterAndBossExpansion() {
    if (typeof HERO_CONFIGS !== 'undefined') {
      HERO_CONFIGS.rosalia = {
        id: 'rosalia',
        name: 'ROSALIA',
        title: 'ROSALIA • TINKERER',
        skillName: 'CLUSTER GRENADES',
        skillIcon: '🚀',
        moveSpeed: 10.4,
        fireRate: 1.60,
        projectiles: 1,
        pierce: 3,
        damage: 1.2,
        projColor: 0xf97316,
        canPopLead: true,
        canSeeCamo: false,
        explosiveShots: true,
        isEnergyAttack: false
      };
      HERO_CONFIGS.corvus = {
        id: 'corvus',
        name: 'CORVUS',
        title: 'CORVUS • SPIRIT WALKER',
        skillName: 'SOUL HARVEST',
        skillIcon: '🔮',
        moveSpeed: 9.6,
        fireRate: 1.30,
        projectiles: 1,
        pierce: 4,
        damage: 1.5,
        projColor: 0x8b5cf6,
        canPopLead: true,
        canSeeCamo: true,
        explosiveShots: false,
        isEnergyAttack: true
      };
      HERO_CONFIGS.geraldo = {
        id: 'geraldo',
        name: 'GERALDO',
        title: 'GERALDO • SHOPKEEPER',
        skillName: 'FERTILITY TOTEM',
        skillIcon: '🏺',
        moveSpeed: 9.5,
        fireRate: 1.40,
        projectiles: 1,
        pierce: 3,
        damage: 1.1,
        projColor: 0xd97706,
        canPopLead: true,
        canSeeCamo: true,
        explosiveShots: false,
        isEnergyAttack: false
      };
      HERO_CONFIGS.silas = {
        id: 'silas',
        name: 'SILAS',
        title: 'SILAS • FROST ARCHER',
        skillName: 'GLACIAL STORM',
        skillIcon: '❄️',
        moveSpeed: 9.8,
        fireRate: 1.50,
        projectiles: 1,
        pierce: 3,
        damage: 1.3,
        projColor: 0x38bdf8,
        canPopLead: false,
        canSeeCamo: true,
        explosiveShots: false,
        isEnergyAttack: false
      };
    }

    if (typeof COMPANION_CATALOG !== 'undefined') {
      const extraCompanions = [
        {
          key: 'mermonkey',
          shortName: 'MERMONKEY',
          icon: '🧜‍♂️',
          titles: ['Recruit Mermonkey', 'Tier 2: Abyssal Echo', 'Tier 3: Trident Flurry', 'Tier 4: Lord of Abyss'],
          descs: [
            'Deploys an aquatic companion firing sonic wave bursts with 3 Pierce.',
            '+25% Wave Velocity and +2 Pierce.',
            'Weapon Evolution! Thrusts three piercing water tridents.',
            'Tidal whirlpools pulling in and popping bloons!'
          ]
        },
        {
          key: 'beasthandler',
          shortName: 'BEAST HANDLER',
          icon: '🦖',
          titles: ['Recruit Beast Handler', 'Tier 2: Raptor Claws', 'Tier 3: Megalodon Chomp', 'Tier 4: Giganotosaurus'],
          descs: [
            'Commands a trained raptor companion lunging at bloons.',
            '+30% Lunge Speed and causes bleed to bloon layers.',
            'Weapon Evolution! Summons an apex predator biting Blimps.',
            'Giganotosaurus stomps the battlefield stunning bloons!'
          ]
        },
        {
          key: 'desperado',
          shortName: 'DESPERADO',
          icon: '🤠',
          titles: ['Recruit Desperado', 'Tier 2: High Noon', 'Tier 3: Ricochet Rounds', 'Tier 4: Quickdraw Fan'],
          descs: [
            'Sharp-shooting gunslinger firing twin heavy revolvers.',
            '+35% Critical Hit Chance and instant reload.',
            'Weapon Evolution! Bullets ricochet between bloons.',
            'Fans both hammers in a 360-degree storm of lead!'
          ]
        },
        {
          key: 'alchemist',
          shortName: 'ALCHEMIST',
          icon: '🧪',
          titles: ['Recruit Alchemist', 'Tier 2: Acidic Mixture', 'Tier 3: Berserker Brew', 'Tier 4: Transformation'],
          descs: [
            'Hurls explosive potion vials melting Lead Bloons.',
            'Acid pools strip fortifications and camo.',
            'Regularly brews a potion boosting squad damage by +35%!',
            'Transforms squad into laser monsters for 8s!'
          ]
        },
        {
          key: 'druid',
          shortName: 'DRUID',
          icon: '🌿',
          titles: ['Recruit Druid', 'Tier 2: Thorn Volley', 'Tier 3: Heart of Oak', 'Tier 4: Ball of Lightning'],
          descs: [
            'Channels nature energy firing bursts of 5 sharp wooden thorns.',
            '+40% Attack Speed in dense swarms.',
            'Summons lightning strikes leaping across 6 bloons.',
            'Supercharged plasma ball disintegrating blimps!'
          ]
        }
      ];

      extraCompanions.forEach(ec => {
        if (!COMPANION_CATALOG.find(c => c.key === ec.key)) {
          COMPANION_CATALOG.push(ec);
        }
      });
    }

    if (typeof BLOON_TYPES !== 'undefined') {
      const baseSpeed = (typeof BASE_RED_SPEED !== 'undefined') ? BASE_RED_SPEED : 2.5;
      BLOON_TYPES.GLASS = { id: 12, name: 'Glass', hp: 2, speed: baseSpeed * 2.8, scale: 1.05, color: 0xbae6fd, livery: 0, blopType: 1, xp: 12, children: ['BLUE', 'BLUE'], isLead: false, isCeramic: false, isPurple: false, isGlass: true };
      BLOON_TYPES.DYNAMITE = { id: 13, name: 'Dynamite', hp: 2, speed: baseSpeed * 2.0, scale: 1.10, color: 0xf97316, livery: 0, blopType: 2, xp: 18, children: ['PINK', 'PINK'], isLead: false, isCeramic: false, isPurple: false, isDynamite: true };
      BLOON_TYPES.DIAMOND = { id: 14, name: 'Diamond', hp: 20, speed: baseSpeed * 1.5, scale: 1.25, color: 0xe0f2fe, livery: 4, blopType: 2, xp: 50, children: ['RAINBOW', 'RAINBOW'], isLead: true, isCeramic: true, isPurple: false, isDiamond: true };
      BLOON_TYPES.GOLDEN = { id: 15, name: 'Golden', hp: 4, speed: baseSpeed * 5.0, scale: 0.95, color: 0xfacc15, livery: 0, blopType: 2, xp: 30, children: ['YELLOW'], isLead: false, isCeramic: false, isPurple: false, isGolden: true };
    }

    if (typeof BLIMP_TYPES !== 'undefined') {
      BLIMP_TYPES.VORTEX = { key: 'VORTEX', title: 'VORTEX — DEADLY QUIET', icon: '⚡', hp: 2800, speed: 2.85, scale: 1.55, isCamo: true, isLead: false, moneyReward: 45, xpReward: 450, childBloons: ['CERAMIC', 'CERAMIC'], childBlimps: ['MOAB', 'MOAB'] };
      BLIMP_TYPES.DREADBLOON = { key: 'DREADBLOON', title: 'DREADBLOON — ARMORED BEHEMOTH', icon: '🪨', hp: 4200, speed: 1.05, scale: 1.70, isCamo: false, isLead: true, moneyReward: 55, xpReward: 600, childBloons: ['LEAD', 'LEAD'], childBlimps: ['BFB'] };
      BLIMP_TYPES.PHAYZE = { key: 'PHAYZE', title: 'PHAYZE — REALITY WARPER', icon: '🌀', hp: 3400, speed: 2.20, scale: 1.60, isCamo: true, isLead: false, moneyReward: 50, xpReward: 550, childBloons: ['PURPLE', 'PURPLE'], childBlimps: ['DDT'] };
      BLIMP_TYPES.BLASTAPOPOULOS = { key: 'BLASTAPOPOULOS', title: 'BLASTAPOPOULOS — DEMON OF CORE', icon: '🌋', hp: 5500, speed: 0.95, scale: 1.85, isCamo: false, isLead: true, moneyReward: 70, xpReward: 800, childBloons: ['CERAMIC', 'LEAD'], childBlimps: ['ZOMG'] };
    }

    // Hero Star Mastery & Simulation Stat Application
    let lastHeroMasteryApplied = null;
    setInterval(() => {
      if (typeof gameState !== 'undefined' && gameState && gameState.hero && typeof persistentStats !== 'undefined') {
        const hid = gameState.hero.id || selectedHeroId || 'quincy';
        const star = (persistentStats.heroMastery && persistentStats.heroMastery[hid]) || 1;
        if (lastHeroMasteryApplied !== star) {
          lastHeroMasteryApplied = star;
          const dmgMult = 1.0 + (star - 1) * 0.10;
          const rateMult = 1.0 + (star - 1) * 0.06;
          gameState.hero.damage = (gameState.hero.damage || 1.0) * dmgMult;
          gameState.hero.fireRate = (gameState.hero.fireRate || 1.0) * rateMult;
        }

        // Periodic special bloon spawner (strictly Wave 16+ around hero perimeter)
        if (!gameState.paused && !gameState.inStartMenu && !gameState.gameOver && (gameState.wave || 1) >= 16 && typeof spawnBloon === 'function') {
          if (Math.random() < 0.15) {
            const specials = ['GLASS', 'DYNAMITE', 'DIAMOND', 'GOLDEN'];
            const chosen = specials[Math.floor(Math.random() * specials.length)];
            const a = Math.random() * Math.PI * 2;
            const r = 22 + Math.random() * 5;
            spawnBloon(chosen, (gameState.hero.x || 0) + Math.cos(a) * r, (gameState.hero.z || 0) + Math.sin(a) * r);
          }
        }
      }
    }, 2000);
  }

  // ==========================================================================
  // 14. 3D ARENA COMPANION & HERO COMBAT ENGINE (ALL 14 COMPANIONS & 10 HEROES)
  // ==========================================================================
  function setupSquadAndHero3DCombatEngine() {
    const COMPANION_KEYS_14 = [
      'super', 'tack', 'boomer', 'ninja', 'sniper', 'wizard', 'dartling', 'mortar', 'ice',
      'mermonkey', 'beasthandler', 'desperado', 'alchemist', 'druid'
    ];

    const squadMeshesCustom = {};
    let customOrbitAngle = 0;
    let lastSimTimestamp = performance.now();
    let alchemistBrewTimer = 0;
    let desperadoCritCounter = 0;
    let mermonkeyWhirlpoolTimer = 0;

    window.__ensureAllSquadMeshes = ensureAllSquadMeshes;
    function ensureAllSquadMeshes(scene) {
      if (!scene || typeof gameState === 'undefined' || !gameState) return;

      const targetSquad = (typeof squadMeshes !== 'undefined') ? squadMeshes : squadMeshesCustom;

      COMPANION_KEYS_14.forEach(key => {
        let mesh = targetSquad[key];
        // If mesh is missing, or if dartling is the old primitive disembodied barrel without full monkey rig
        if (!mesh || (key === 'dartling' && !mesh.userData.isFull3DMonkeyRig)) {
          if (mesh && mesh.parent) mesh.parent.remove(mesh);
          mesh = createFullMonkeyMesh(key);
          mesh.userData.isFull3DMonkeyRig = true;
          mesh.visible = false;
          targetSquad[key] = mesh;
          scene.add(mesh);
        } else if (!mesh.parent) {
          scene.add(mesh);
        }
      });
    }

    // Intercept active hero skill
    if (typeof triggerHeroSkill === 'function') {
      const _origTriggerHeroSkill = triggerHeroSkill;
      triggerHeroSkill = function() {
        if (typeof gameState === 'undefined' || !gameState || gameState.paused || gameState.gameOver) return;
        const h = gameState.hero;
        if (!h || h.abilityCooldown > 0) return;
        const hid = (h.id || '').toLowerCase();

        if (hid === 'rosalia') {
          h.abilityCooldown = h.abilityCooldownMax;
          if (typeof soundFX !== 'undefined' && soundFX.playExplosion) soundFX.playExplosion(1.4);
          if (typeof triggerScreenShake === 'function') triggerScreenShake(0.25, 0.35);

          // Cluster Missile Barrage: 10 heavy cluster explosions
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const dist = 5.5 + (i % 2) * 4.5;
            const tx = h.x + Math.sin(a) * dist;
            const tz = h.z + Math.cos(a) * dist;
            if (typeof spawnExplosionVFX === 'function') spawnExplosionVFX(tx, tz, 4.8);
            if (typeof spawnComicPop === 'function') spawnComicPop(tx, 0.5, tz, 0xf97316, 2.2);
            if (typeof spatialGrid !== 'undefined' && typeof queryBuffer !== 'undefined' && typeof damageBloon === 'function') {
              spatialGrid.queryRadius(tx, tz, 5.0, queryBuffer);
              for (let q = 0; q < queryBuffer.length; q++) {
                damageBloon(queryBuffer[q], h.damage * 4.5, true, true, Math.sin(a), Math.cos(a), 3.0, false);
              }
            }
          }
          if (typeof activeMOABs !== 'undefined' && Array.isArray(activeMOABs)) {
            activeMOABs.slice().forEach(mb => {
              if (Math.hypot(mb.x - h.x, mb.z - h.z) <= 18) {
                mb.stunTimer = 1.2;
                if (typeof damageMOAB === 'function') { const mi = activeMOABs.indexOf(mb); if (mi >= 0) damageMOAB(mi, h.damage * 25, true); }
              }
            });
          }
          if (typeof spawnFloatingText === 'function') spawnFloatingText(h.x, 2.2, h.z, 'CLUSTER BARRAGE!', 'crit');
          return;
        } else if (hid === 'corvus') {
          h.abilityCooldown = h.abilityCooldownMax;
          if (typeof soundFX !== 'undefined' && soundFX.playExplosion) soundFX.playExplosion(1.2);
          if (typeof triggerScreenShake === 'function') triggerScreenShake(0.2, 0.3);

          // Soul Harvest: Spectral vortex ring
          const harvestRadius = 15.0;
          if (typeof spawnComicPop === 'function') spawnComicPop(h.x, 0.5, h.z, 0x8b5cf6, 4.5);
          h.hp = Math.min(h.maxHp, h.hp + 35);
          let soulsHarvested = 0;
          if (typeof spatialGrid !== 'undefined' && typeof queryBuffer !== 'undefined' && typeof damageBloon === 'function') {
            spatialGrid.queryRadius(h.x, h.z, harvestRadius, queryBuffer);
            for (let q = 0; q < queryBuffer.length; q++) {
              const bIdx = queryBuffer[q];
              if (typeof bloonActive !== 'undefined' && bloonActive[bIdx] === 1) {
                soulsHarvested++;
                damageBloon(bIdx, h.damage * 5.0, true, true, 0, 0, 1.2, false);
              }
            }
          }
          if (typeof activeMOABs !== 'undefined' && Array.isArray(activeMOABs)) {
            activeMOABs.slice().forEach(mb => {
              if (Math.hypot(mb.x - h.x, mb.z - h.z) <= harvestRadius) {
                if (typeof damageMOAB === 'function') { const mi = activeMOABs.indexOf(mb); if (mi >= 0) damageMOAB(mi, h.damage * 28, true); }
              }
            });
          }
          if (typeof spawnFloatingText === 'function') spawnFloatingText(h.x, 2.2, h.z, `SOUL HARVEST! (+${soulsHarvested})`, 'heal');
          return;
        } else if (hid === 'geraldo') {
          h.abilityCooldown = h.abilityCooldownMax;
          if (typeof soundFX !== 'undefined' && soundFX.playExplosion) soundFX.playExplosion(1.0);
          if (typeof spawnGroundHazard === 'function') spawnGroundHazard(h.x, h.z, 'bramble', h.damage * 3.5, true);
          if (typeof spawnExplosionVFX === 'function') spawnExplosionVFX(h.x, h.z, 6.0);
          const mmReward = Math.round(35 * ((typeof stageCfg !== 'undefined' && stageCfg.moneyMult) ? stageCfg.moneyMult : 1));
          if (typeof persistentStats !== 'undefined') {
            persistentStats.monkeyMoney = (persistentStats.monkeyMoney || 0) + mmReward;
            if (typeof savePersistentStats === 'function') savePersistentStats();
          }
          if (typeof syncMoneyLabels === 'function') syncMoneyLabels();
          if (typeof spawnFloatingText === 'function') spawnFloatingText(h.x, 2.2, h.z, `FERTILITY TOTEM! +$${mmReward}`, 'heal');
          return;
        } else if (hid === 'silas') {
          h.abilityCooldown = h.abilityCooldownMax;
          if (typeof soundFX !== 'undefined' && soundFX.playExplosion) soundFX.playExplosion(1.3);
          if (typeof triggerScreenShake === 'function') triggerScreenShake(0.25, 0.4);

          // Glacial Blizzard: Screen-wide freeze
          if (typeof spawnComicPop === 'function') spawnComicPop(h.x, 0.5, h.z, 0x38bdf8, 6.0);
          if (typeof bloonActive !== 'undefined' && typeof bloonX !== 'undefined' && typeof bloonZ !== 'undefined' && typeof bloonFreezeTimer !== 'undefined') {
            for (let i = 0; i < (typeof MAX_BLOONS !== 'undefined' ? MAX_BLOONS : 1000); i++) {
              if (bloonActive[i] === 1 && Math.hypot(bloonX[i] - h.x, bloonZ[i] - h.z) <= 32) {
                bloonFreezeTimer[i] = 4.0;
                if (typeof damageBloon === 'function') damageBloon(i, h.damage * 4.0, true, true, 0, 0, 0.1, false);
              }
            }
          }
          if (typeof activeMOABs !== 'undefined' && Array.isArray(activeMOABs)) {
            activeMOABs.slice().forEach(mb => {
              mb.stunTimer = 2.0;
              if (typeof damageMOAB === 'function') { const mi = activeMOABs.indexOf(mb); if (mi >= 0) damageMOAB(mi, h.damage * 30, true); }
            });
          }
          if (typeof spawnFloatingText === 'function') spawnFloatingText(h.x, 2.2, h.z, 'GLACIAL BLIZZARD!', 'crit');
          return;
        }

        _origTriggerHeroSkill();
      };
    }

    // Step Frame simulation loop for companions and heroes
    window.__stepSquadAndHeroSimulation = stepSquadAndHeroSimulation;
    function stepSquadAndHeroSimulation(dt, scene) {
      if (!scene || typeof gameState === 'undefined' || !gameState) return;
      if (window.__b13Frame !== undefined && window.__b13Frame === window.__b13SquadStepF) return;
      window.__b13SquadStepF = window.__b13Frame;
      try { stepSquadAndHeroSimulationInner(dt, scene); } finally { window.__B13_CTX = null; }
    }
    function stepSquadAndHeroSimulationInner(dt, scene) {
      if (gameState.paused || gameState.gameOver || gameState.inStartMenu) return;
      const h = gameState.hero;
      if (!h) return;

      const targetSquad = (typeof squadMeshes !== 'undefined') ? squadMeshes : squadMeshesCustom;
      const benSquadSpeedMult = (h.id === 'benjamin' ? 1.25 + (h.explosiveTier || 0) * 0.12 : 1.0) * (gameState.overclockTimer > 0 ? 1.4 : 1.0);
      const heroCanDetectCamo = h.canSeeCamo || (h.id === 'quincy' && h.level >= 3) || (gameState.squad && ((gameState.squad.ninja && gameState.squad.ninja.level > 0) || (gameState.squad.wizard && gameState.squad.wizard.level >= 3) || (gameState.squad.ice && gameState.squad.ice.level >= 3)));

      customOrbitAngle += dt * 1.15;

      const recruited = (gameState.recruitedOrder || []).filter(k => gameState.squad && gameState.squad[k] && gameState.squad[k].level > 0);
      const totalRecruited = recruited.length;

      // 1. Position all recruited companions in an evenly spaced tactical escort formation
      recruited.forEach((k, idx) => {
        const mesh = targetSquad[k];
        if (!mesh) return;
        mesh.visible = true;

        const offsetA = (idx / Math.max(1, totalRecruited)) * Math.PI * 2;
        const a = customOrbitAngle + offsetA;
        const orbitRadius = 3.4;
        const tx = h.x + Math.cos(a) * orbitRadius;
        const tz = h.z + Math.sin(a) * orbitRadius;
        const bobY = Math.abs(Math.sin((gameState.heroWalkPhase || 0) + idx * 1.3)) * 0.12;

        mesh.position.set(tx, bobY, tz);

        // Gatling barrel rotation if Dartling
        if (k === 'dartling' && mesh.userData && mesh.userData.barrelGroup) {
          mesh.userData.barrelGroup.rotation.z += dt * 16;
        }
      });

      // 2. Hide any unrecruited companions
      COMPANION_KEYS_14.forEach(k => {
        if (!recruited.includes(k) && targetSquad[k]) {
          targetSquad[k].visible = false;
        }
      });

      // 3. Combat Loop for the 5 Expansion Companions

      // (A) MERMONKEY
      window.__B13_CTX = 'mermonkey';
      if (gameState.squad && gameState.squad.mermonkey && gameState.squad.mermonkey.level > 0) {
        const comp = gameState.squad.mermonkey;
        const mesh = targetSquad.mermonkey;
        if (mesh) {
          comp.cooldown = (comp.cooldown || 0) - dt * benSquadSpeedMult;
          if (comp.cooldown <= 0) {
            comp.cooldown = Math.max(0.38, 1.15 - (comp.level - 1) * 0.20);
            const target = (typeof findNearestEnemy === 'function') ? findNearestEnemy(mesh.position.x, mesh.position.z, 24, true) : null;
            if (target) {
              const aimA = Math.atan2(target.x - mesh.position.x, target.z - mesh.position.z);
              mesh.rotation.y = aimA;
              const count = comp.level >= 3 ? 3 : 1;
              const pierce = 3 + comp.level * 2;
              const dmg = 2.0 + comp.level * 0.8;
              if (typeof spawnProjectile === 'function') {
                for (let i = 0; i < count; i++) {
                  const spread = count === 1 ? 0 : (i - (count - 1) * 0.5) * 0.18;
                  const finalA = aimA + spread;
                  spawnProjectile({
                    x: mesh.position.x, z: mesh.position.z,
                    vx: Math.sin(finalA) * 24, vz: Math.cos(finalA) * 24,
                    life: 1.1, pierce: pierce, damage: dmg,
                    scale: 1.35, colorHex: 0x06b6d4, canPopLead: true,
                    isEnergy: true
                  });
                }
              }
              if (typeof soundFX !== 'undefined' && soundFX.playPop) soundFX.playPop(false, 'BLUE', 1);

              // Whirlpool ring under bloon clusters (Level 2+)
              if (comp.level >= 2) {
                mermonkeyWhirlpoolTimer -= dt;
                if (mermonkeyWhirlpoolTimer <= 0) {
                  mermonkeyWhirlpoolTimer = 2.4;
                  if (typeof spawnComicPop === 'function') spawnComicPop(target.x, 0.4, target.z, 0x06b6d4, 3.2);
                  if (typeof spatialGrid !== 'undefined' && typeof queryBuffer !== 'undefined' && typeof damageBloon === 'function') {
                    spatialGrid.queryRadius(target.x, target.z, 4.5, queryBuffer);
                    for (let q = 0; q < queryBuffer.length; q++) {
                      const bIdx = queryBuffer[q];
                      if (typeof bloonFreezeTimer !== 'undefined') bloonFreezeTimer[bIdx] = 0.6;
                      damageBloon(bIdx, comp.level * 1.5, true, false, 0, 0, 0.2, true);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // (B) ALCHEMIST
      window.__B13_CTX = 'alchemist';
      if (gameState.squad && gameState.squad.alchemist && gameState.squad.alchemist.level > 0) {
        const comp = gameState.squad.alchemist;
        const mesh = targetSquad.alchemist;
        if (mesh) {
          comp.cooldown = (comp.cooldown || 0) - dt * benSquadSpeedMult;
          if (comp.cooldown <= 0) {
            comp.cooldown = Math.max(0.75, 1.85 - (comp.level - 1) * 0.32);
            const target = (typeof findNearestEnemy === 'function') ? findNearestEnemy(mesh.position.x, mesh.position.z, 22, true) : null;
            if (target) {
              const aimA = Math.atan2(target.x - mesh.position.x, target.z - mesh.position.z);
              mesh.rotation.y = aimA;
              if (typeof soundFX !== 'undefined' && soundFX.playExplosion) soundFX.playExplosion(0.85);
              if (typeof spawnExplosionVFX === 'function') spawnExplosionVFX(target.x, target.z, 3.8);
              if (typeof spawnComicPop === 'function') spawnComicPop(target.x, 0.6, target.z, 0x10b981, 2.0);
              if (typeof spawnGroundHazard === 'function') spawnGroundHazard(target.x, target.z, 'fire', comp.level * 2.2, true);

              if (typeof spatialGrid !== 'undefined' && typeof queryBuffer !== 'undefined' && typeof damageBloon === 'function') {
                spatialGrid.queryRadius(target.x, target.z, 4.0, queryBuffer);
                for (let q = 0; q < queryBuffer.length; q++) {
                  damageBloon(queryBuffer[q], comp.level * 3.5, true, true, 0, 0, 1.0, false);
                }
              }
              if (typeof activeMOABs !== 'undefined' && Array.isArray(activeMOABs)) {
                activeMOABs.slice().forEach(mb => {
                  if (Math.hypot(mb.x - target.x, mb.z - target.z) <= 5.5) {
                    if (typeof damageMOAB === 'function') { const mi = activeMOABs.indexOf(mb); if (mi >= 0) damageMOAB(mi, comp.level * 18, true); }
                  }
                });
              }
            }
          }

          // Berserker Brew Aura (Level 3+)
          if (comp.level >= 3) {
            alchemistBrewTimer -= dt;
            if (alchemistBrewTimer <= 0) {
              alchemistBrewTimer = 5.0;
              gameState.overclockTimer = Math.max(gameState.overclockTimer || 0, 4.0);
              if (typeof spawnComicPop === 'function') spawnComicPop(h.x, 0.5, h.z, 0xf97316, 2.5);
              if (typeof spawnFloatingText === 'function') spawnFloatingText(h.x, 2.0, h.z, 'BERSERKER BREW! +35% SPD', 'heal');
            }
          }
        }
      }

      // (C) BEAST HANDLER
      window.__B13_CTX = 'beasthandler';
      if (gameState.squad && gameState.squad.beasthandler && gameState.squad.beasthandler.level > 0) {
        const comp = gameState.squad.beasthandler;
        const mesh = targetSquad.beasthandler;
        if (mesh) {
          comp.cooldown = (comp.cooldown || 0) - dt * benSquadSpeedMult;
          if (comp.cooldown <= 0) {
            comp.cooldown = Math.max(0.65, 1.6 - (comp.level - 1) * 0.25);
            let targetX = 0, targetZ = 0, hasTarget = false, isMoab = false;
            if (typeof activeMOABs !== 'undefined' && activeMOABs.length > 0) {
              targetX = activeMOABs[0].x;
              targetZ = activeMOABs[0].z;
              hasTarget = true;
              isMoab = true;
              activeMOABs[0].stunTimer = 0.8;
              if (typeof damageMOAB === 'function') damageMOAB(0, comp.level * 24, true);
            } else if (typeof findNearestEnemy === 'function') {
              const enemy = findNearestEnemy(mesh.position.x, mesh.position.z, 22, true);
              if (enemy) {
                targetX = enemy.x;
                targetZ = enemy.z;
                hasTarget = true;
              }
            }
            if (hasTarget) {
              const aimA = Math.atan2(targetX - mesh.position.x, targetZ - mesh.position.z);
              mesh.rotation.y = aimA;
              if (typeof spawnCrescentSlash === 'function') {
                spawnCrescentSlash({
                  x: targetX, z: targetZ, vx: 0, vz: 0,
                  angle: Math.random() * Math.PI, life: 0.28, scale: 1.5,
                  pierce: 8, damage: comp.level * 4.5, canPopLead: true, colorHex: 0x84cc16
                });
              }
              if (typeof spawnComicPop === 'function') spawnComicPop(targetX, 0.8, targetZ, 0x84cc16, 1.6);
              if (typeof soundFX !== 'undefined' && soundFX.playPop) soundFX.playPop(true, 'RED', 2);
              if (typeof spatialGrid !== 'undefined' && typeof queryBuffer !== 'undefined' && typeof damageBloon === 'function') {
                spatialGrid.queryRadius(targetX, targetZ, 3.2, queryBuffer);
                for (let q = 0; q < queryBuffer.length; q++) {
                  const bIdx = queryBuffer[q];
                  if (typeof bloonBleedTimer !== 'undefined') bloonBleedTimer[bIdx] = 4.5;
                  damageBloon(bIdx, comp.level * 3.0, true, true, 0, 0, 1.2, false);
                }
              }
            }
          }
        }
      }

      // (D) DESPERADO
      window.__B13_CTX = 'desperado';
      if (gameState.squad && gameState.squad.desperado && gameState.squad.desperado.level > 0) {
        const comp = gameState.squad.desperado;
        const mesh = targetSquad.desperado;
        if (mesh) {
          comp.cooldown = (comp.cooldown || 0) - dt * benSquadSpeedMult;
          if (comp.cooldown <= 0) {
            comp.cooldown = Math.max(0.28, 0.65 - (comp.level - 1) * 0.1);
            const target = (typeof findNearestEnemy === 'function') ? findNearestEnemy(mesh.position.x, mesh.position.z, 26, true) : null;
            if (target) {
              const aimA = Math.atan2(target.x - mesh.position.x, target.z - mesh.position.z);
              mesh.rotation.y = aimA;
              desperadoCritCounter++;
              const isCrit = (desperadoCritCounter % 3 === 0);
              const dmg = isCrit ? (comp.level * 12) : (comp.level * 4.5);

              if (typeof soundFX !== 'undefined' && soundFX.playSniperShot) soundFX.playSniperShot();
              if (typeof spawnComicPop === 'function') {
                spawnComicPop(mesh.position.x + Math.sin(aimA) * 0.8, 0.8, mesh.position.z + Math.cos(aimA) * 0.8, 0xfacc15, 0.7);
                spawnComicPop(target.x, 1.0, target.z, isCrit ? 0xef4444 : 0xffffff, isCrit ? 1.4 : 0.9);
              }
              if (typeof spawnSniperBulletTracer === 'function') {
                spawnSniperBulletTracer(mesh.position.x, 0.8, mesh.position.z, target.x, 1.0, target.z);
              }
              if (target.isMoab) {
                if (typeof damageMOAB === 'function') damageMOAB(0, dmg * 2, true);
              } else if (typeof damageBloon === 'function') {
                damageBloon(target.index, dmg, true, isCrit, Math.sin(aimA), Math.cos(aimA), 2.5, false);
              }
              if (typeof spawnFloatingText === 'function') {
                spawnFloatingText(target.x, 1.8, target.z, isCrit ? `CRACK! ${dmg}` : `${dmg}`, isCrit ? 'crit' : 'normal');
              }
            }
          }
        }
      }

      // (E) DRUID
      window.__B13_CTX = 'druid';
      if (gameState.squad && gameState.squad.druid && gameState.squad.druid.level > 0) {
        const comp = gameState.squad.druid;
        const mesh = targetSquad.druid;
        if (mesh) {
          comp.cooldown = (comp.cooldown || 0) - dt * benSquadSpeedMult;
          if (comp.cooldown <= 0) {
            comp.cooldown = Math.max(0.42, 1.2 - (comp.level - 1) * 0.18);
            const target = (typeof findNearestEnemy === 'function') ? findNearestEnemy(mesh.position.x, mesh.position.z, 22, true) : null;
            if (target) {
              const aimA = Math.atan2(target.x - mesh.position.x, target.z - mesh.position.z);
              mesh.rotation.y = aimA;
              // 1. Thorn Spread (fan of 5 wooden thorns)
              if (typeof spawnProjectile === 'function') {
                for (let s = 0; s < 5; s++) {
                  const thornA = aimA + (s - 2) * 0.12;
                  spawnProjectile({
                    x: mesh.position.x, z: mesh.position.z,
                    vx: Math.sin(thornA) * 22, vz: Math.cos(thornA) * 22,
                    life: 1.0, pierce: 2 + comp.level, damage: 1.5 + comp.level * 0.5,
                    scale: 1.1, colorHex: 0x78350f, canPopLead: comp.level >= 3
                  });
                }
              }

              // 2. Chain-Lightning Bolts (Level 2+)
              if (comp.level >= 2 && typeof spatialGrid !== 'undefined' && typeof queryBuffer !== 'undefined' && typeof damageBloon === 'function') {
                spatialGrid.queryRadius(target.x, target.z, 8.0, queryBuffer);
                const maxZaps = Math.min(6, queryBuffer.length);
                for (let z = 0; z < maxZaps; z++) {
                  const bIdx = queryBuffer[z];
                  if (typeof bloonActive !== 'undefined' && bloonActive[bIdx] === 1) {
                    if (typeof spawnComicPop === 'function') spawnComicPop(bloonX[bIdx], 1.0, bloonZ[bIdx], 0x22d3ee, 1.2);
                    damageBloon(bIdx, comp.level * 2.5, true, false, 0, 0, 0.5, true);
                  }
                }
                if (typeof soundFX !== 'undefined' && soundFX.playPop) soundFX.playPop(false, 'WHITE', 1);
              }
            }
          }
        }
      }
    }

    // Hook WebGLRenderer render for frame simulation and HUD post-processing
    if (typeof THREE !== 'undefined' && THREE.WebGLRenderer) {
      const _origRender = THREE.WebGLRenderer.prototype.render;
      THREE.WebGLRenderer.prototype.render = function(s, c) {
        if (!this.__isOffscreenThumb && s && s.isScene && (typeof scene === 'undefined' || s === scene)) {
          try {
            ensureAllSquadMeshes(s);
            const now = performance.now();
            const dt = Math.min(0.05, Math.max(0.001, (now - lastSimTimestamp) / 1000));
            lastSimTimestamp = now;
            stepSquadAndHeroSimulation(dt, s);
          } catch (e) {
            console.warn("Combat hook simulation tick caught:", e);
          }
        }
        return _origRender.apply(this, arguments);
      };
    }

    // Post-process Bottom-Left Squad HUD & Ability Icon
    let _lastSquadHudSig = '';
    function postProcessSquadHUD() {
      if (typeof gameState === 'undefined' || !gameState) return;
      const sig = (gameState.hero ? gameState.hero.id : '') + '|' + (gameState.recruitedOrder || []).map(k => k + ':' + (gameState.squad && gameState.squad[k] ? gameState.squad[k].level : 0)).join(',');
      if (sig === _lastSquadHudSig) return;
      _lastSquadHudSig = sig;
      if (typeof gameState === 'undefined' || !gameState) return;

      // 1. Squad Slots (active-slot-0, active-slot-1, active-slot-2)
      for (let s = 0; s < 3; s++) {
        const slotEl = document.getElementById(`active-slot-${s}`);
        if (!slotEl) continue;
        const compKey = gameState.recruitedOrder ? gameState.recruitedOrder[s] : null;
        if (compKey && gameState.squad && gameState.squad[compKey] && gameState.squad[compKey].level > 0) {
          const lvl = gameState.squad[compKey].level;
          const def = (typeof COMPANION_CATALOG !== 'undefined') ? COMPANION_CATALOG.find(c => c.key === compKey) : null;
          const sName = def ? def.shortName : compKey.toUpperCase();
          const portraitImg = safeGet3DHeadSnapshot(compKey) || safeGet3DModelSnapshot(compKey);

          slotEl.className = 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-stone-900/95 border-2 border-yellow-400 shadow-lg flex flex-col items-center justify-center transition-all overflow-hidden';
          slotEl.innerHTML = `
            <div class="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
              <img src="${portraitImg}" class="squad-slot-3d-img" alt="${compKey}">
            </div>
            <span class="font-btd-sm text-[9px] text-amber-300 mt-0.5 font-bold tracking-tight">${sName} T${lvl}</span>
          `;
        } else {
          slotEl.className = 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-stone-900/80 border-2 border-stone-700 flex flex-col items-center justify-center opacity-55 transition-all';
          slotEl.innerHTML = `
            <svg class="w-5 h-5 text-stone-400 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            <span class="font-btd-sm text-[8px] text-stone-400 font-bold">SLOT ${s + 1}</span>
          `;
        }
      }

      // 2. Ability Button Icon (#ability-icon)
      const abIcon = document.getElementById('ability-icon');
      if (abIcon && gameState.hero && gameState.hero.id) {
        const hid = gameState.hero.id;
        const heroSnap = safeGet3DModelSnapshot(hid);
        if (heroSnap && (!abIcon.firstChild || abIcon.firstChild.tagName !== 'IMG' || abIcon.dataset.hero !== hid)) {
          abIcon.dataset.hero = hid;
          abIcon.innerHTML = `<img src="${heroSnap}" class="ability-icon-3d" alt="${hid}">`;
        }
      }

      // 3. Inspect Build Button (#btn-hud-build)
      const btnBuild = document.getElementById('btn-hud-build');
      if (btnBuild && btnBuild.textContent && btnBuild.textContent.includes('📜')) {
        btnBuild.innerHTML = `
          <svg class="w-6 h-6 text-yellow-300 hover:text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
        `;
      }
    }

    // Intercept updateHUD to post-process 3D icons
    if (typeof updateHUD === 'function') {
      const _origUpdateHUD = updateHUD;
      updateHUD = function() {
        _origUpdateHUD();
        try {
          postProcessSquadHUD();
        } catch (e) {}
      };
    }
    setInterval(postProcessSquadHUD, 200);
  }

  // ==========================================================================
  // 15. INITIALIZATION & TEST AUTOMATION HOOKS
  // ==========================================================================
  function init() {
    if (typeof THREE !== 'undefined' && THREE.WebGLRenderer && !THREE.WebGLRenderer.prototype.__origRender) {
      THREE.WebGLRenderer.prototype.__origRender = THREE.WebGLRenderer.prototype.render;
      THREE.WebGLRenderer.prototype.render = function(s, c) {
        if (!this.__isOffscreenThumb && s && s.isScene && !window.__ACTIVE_GAME_SCENE__) {
          if (s.background && s.background.isColor) {
            window.__ACTIVE_GAME_SCENE__ = s;
            window.__ACTIVE_GAME_CAMERA__ = c;
          }
        }
        return this.__origRender.apply(this, arguments);
      };
    }

    polyfillAssetForge();
    patchPersistence();
    patchUpgradeSystemSafety();
    setupModalObserver();
    runGlobalEmojiReplacement();
    renderMainMenuHeroPrices();
    setupMonkeyBarracksModal();
    initSettingsPersistenceAndOptimizer();
    initRosterAndBossExpansion();
    setupEscapeKeyHandler();
    setupMatrixGreenTextObserver();
    initBenjaminWirelessHack();
    setupSquadAndHero3DCombatEngine();

    ensureSquadInitialized();
    setInterval(ensureSquadInitialized, 500);

    const btnDevReset = document.getElementById('btn-dev-reset');
    if (btnDevReset) {
      btnDevReset.addEventListener('click', (e) => {
        e.stopPropagation();
        window.__INTERNAL_MASTER_SAVE = true;
        localStorage.removeItem(MASTER_SAVE_KEY_V11);
        localStorage.removeItem(MASTER_SAVE_KEY);
        localStorage.removeItem(BUILD10_SAVE_KEY);
        localStorage.removeItem(SETTINGS_KEY_V11);
        if (typeof persistentStats !== 'undefined') {
          persistentStats.monkeyMoney = 0;
          persistentStats.lifetimePops = 0;
          persistentStats.unlockedHeroes = ['quincy', 'gwendolin'];
          persistentStats.upgrades = { hp: 0, speed: 0, magnet: 0, damage: 0 };
          persistentStats.heroMastery = {};
          persistentStats.companionMastery = {};
        }
        location.reload();
      }, true);
    }
    const btnStart = document.getElementById('btn-start-run');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        ensureSquadInitialized();
        setTimeout(ensureSquadInitialized, 50);
        setTimeout(ensureSquadInitialized, 200);
      });
    }

    // Hook store & shop save actions
    const btnBuyHero = document.getElementById('btn-confirm-unlock');
    if (btnBuyHero) {
      btnBuyHero.addEventListener('click', () => {
        setTimeout(() => {
          saveMasterSave();
          renderMainMenuHeroPrices();
        }, 100);
      });
    }
    const btnShopBuy = document.getElementById('btn-buy-upgrade');
    if (btnShopBuy) {
      btnShopBuy.addEventListener('click', () => {
        setTimeout(saveMasterSave, 100);
      });
    }

    // Hash Test Automation Hooks
    if (location.hash === '#test-real-levelup') {
      setTimeout(() => {
        const btnStartRun = document.getElementById('btn-start-run');
        if (btnStartRun) btnStartRun.click();

        setTimeout(() => {
          ensureSquadInitialized();
          if (typeof gameState !== 'undefined' && gameState && gameState.hero) {
            gameState.hero.hp = 99999;
            gameState.hero.xp = gameState.hero.xpToNext + 10;
          }
          if (typeof openLevelUpModal === 'function') {
            openLevelUpModal();
          }
          window.__REAL_LEVELUP_TEST_READY = true;
        }, 300);
      }, 250);
    } else if (location.hash === '#test-settings') {
      setTimeout(() => {
        const btnSettings = document.getElementById('btn-settings-start') || document.getElementById('btn-settings-toggle');
        if (btnSettings) btnSettings.click();
        setTimeout(() => {
          syncSettingsModalUI();
          window.__SETTINGS_TEST_READY = true;
        }, 200);
      }, 250);
    } else if (location.hash === '#test-mobile-menu') {
      setTimeout(() => {
        runGlobalEmojiReplacement();
        renderMainMenuHeroPrices();
        setupMonkeyBarracksModal();
        openBarracksModal();
        window.__MOBILE_MENU_TEST_READY = true;
      }, 400);
    } else if (location.hash === '#test-mobile-levelup') {
      setTimeout(() => {
        const startModal = document.getElementById('start-modal');
        if (startModal) {
          startModal.classList.add('hidden');
          startModal.style.display = 'none';
        }
        const testPool = [
          {
            id: 'hero_quincy_storm',
            category: 'hero',
            path: 'QUINCY',
            tier: 1,
            name: 'Storm Of Arrows',
            desc: 'Rains arrows down onto Bloon clusters.',
            apply: () => {}
          },
          {
            id: 'recruit_mermonkey',
            category: 'companion',
            path: 'MERMONKEY',
            tier: 1,
            name: 'Mermonkey',
            desc: 'Fires high-velocity sonic waves and water tridents.',
            apply: () => {}
          },
          {
            id: 'recruit_ninja',
            category: 'companion',
            path: 'NINJA MONKEY',
            tier: 1,
            name: 'Ninja Monkey',
            desc: 'Fires fast homing shurikens that seek and pop Camo Bloons.',
            apply: () => {}
          }
        ];
        window.openBloonsBlitzUpgradeModal(testPool);
        window.__MOBILE_LEVELUP_TEST_READY = true;
      }, 300);
    } else if (location.hash === '#test-new-heroes-bosses') {
      setTimeout(() => {
        if (typeof persistentStats !== 'undefined') {
          if (!persistentStats.unlockedHeroes) persistentStats.unlockedHeroes = ['quincy', 'gwendolin'];
          if (!persistentStats.unlockedHeroes.includes('rosalia')) persistentStats.unlockedHeroes.push('rosalia');
          persistentStats.heroMastery = { rosalia: 5, quincy: 3 };
        }
        if (typeof selectedHeroId !== 'undefined') selectedHeroId = 'rosalia';

        const btnStart = document.getElementById('btn-start-run');
        if (btnStart) btnStart.click();

        if (typeof gameState !== 'undefined') {
          if (gameState.hero) {
            gameState.hero.hp = 99999;
            gameState.hero.maxHp = 99999;
            gameState.hero.id = 'rosalia';
          }
        }

        // Spawn new boss blimp into active scene
        setTimeout(() => {
          const mainScene = window.__ACTIVE_GAME_SCENE__;
          if (mainScene && typeof ProceduralAssetForge !== 'undefined' && ProceduralAssetForge.createMOABBlimp) {
            const vortexMesh = ProceduralAssetForge.createMOABBlimp('VORTEX');
            vortexMesh.position.set(0, 1.2, 6.5);
            vortexMesh.rotation.y = Math.PI;
            mainScene.add(vortexMesh);
          }
          window.__NEW_HEROES_BOSSES_TEST_READY = true;
        }, 400);
      }, 250);
    } else if (location.hash === '#test-levelup') {
      setTimeout(() => {
        const btnStart = document.getElementById('btn-start-run');
        if (btnStart) btnStart.click();
        setTimeout(() => {
          const testPool = [
            {
              id: 'recruit_ninja',
              category: 'companion',
              path: 'NINJA MONKEY',
              tier: 1,
              name: 'Ninja Monkey',
              desc: 'Fires fast homing shurikens that seek Bloons and pops Camo.',
              apply: () => {}
            },
            {
              id: 'recruit_wizard',
              category: 'companion',
              path: 'WIZARD MONKEY',
              tier: 1,
              name: 'Wizard Monkey',
              desc: 'Fires high pierce magical bolts and arcane energy blasts.',
              apply: () => {}
            },
            {
              id: 'recruit_sniper',
              category: 'companion',
              path: 'SNIPER MONKEY',
              tier: 1,
              name: 'Sniper Monkey',
              desc: 'High-caliber rifle with unlimited range and instant hitscan.',
              apply: () => {}
            }
          ];
          window.openBloonsBlitzUpgradeModal(testPool);
        }, 250);
      }, 350);
    } else if (location.hash === '#test-menus') {
      setTimeout(() => {
        runGlobalEmojiReplacement();
        renderMainMenuHeroPrices();
      }, 300);
    } else if (location.hash === '#test-benjamin') {
      setTimeout(() => {
        if (typeof persistentStats !== 'undefined') {
          if (!persistentStats.unlockedHeroes) persistentStats.unlockedHeroes = ['quincy', 'gwendolin'];
          if (!persistentStats.unlockedHeroes.includes('benjamin')) persistentStats.unlockedHeroes.push('benjamin');
        }
        renderMainMenuHeroPrices();
        const benCard = document.querySelector('.hero-card[data-hero="benjamin"]');
        if (benCard) benCard.click();

        const btnStart = document.getElementById('btn-start-run');
        if (btnStart) btnStart.click();

        if (typeof gameState !== 'undefined' && gameState.hero) {
          gameState.hero.hp = 99999;
          gameState.hero.maxHp = 99999;
        }

        setTimeout(() => {
          if (typeof spawnBloon === 'function') {
            for (let i = 0; i < 14; i++) {
              const a = (i / 14) * Math.PI * 2;
              spawnBloon('RED', Math.cos(a) * 6, Math.sin(a) * 6);
            }
          }
          if (typeof window.triggerBenjaminHackBeam === 'function') {
            window.triggerBenjaminHackBeam(3.5, 1.0, 3.5);
            window.triggerBenjaminHackBeam(-3.5, 1.0, 2.5);
          }
        }, 400);
      }, 350);
    } else if (location.hash === '#test-combat') {
      setTimeout(() => {
        const btnStart = document.getElementById('btn-start-run');
        if (btnStart) btnStart.click();

        if (typeof gameState !== 'undefined' && gameState.hero) {
          gameState.hero.hp = 99999;
          gameState.hero.maxHp = 99999;
        }

        if (typeof spawnBloon === 'function') {
          const types = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PINK', 'CERAMIC'];
          for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            const r = 8 + Math.random() * 8;
            spawnBloon(types[i % types.length], Math.cos(a) * r, Math.sin(a) * r);
          }
        }
      }, 500);
    } else if (location.hash === '#test-persistence-reload') {
      setTimeout(() => {
        const testSave = {
          unlockedHeroes: ['quincy', 'gwendolin', 'sauda', 'obyn', 'benjamin'],
          monkeyMoney: 14500,
          lifetimePops: 14200,
          selectedHero: 'sauda',
          upgrades: { hp: 4, speed: 3, magnet: 2, damage: 3 },
          heroMastery: { sauda: 4, quincy: 2 },
          iconStyle: '3d'
        };
        window.__INTERNAL_MASTER_SAVE = true;
        try {
          localStorage.setItem(MASTER_SAVE_KEY_V11, JSON.stringify(testSave));
          localStorage.setItem(MASTER_SAVE_KEY, JSON.stringify(testSave));
          localStorage.setItem(BUILD10_SAVE_KEY, JSON.stringify(testSave));
        } finally {
          window.__INTERNAL_MASTER_SAVE = false;
        }

        loadMasterState();
        renderMainMenuHeroPrices();
        window.__PERSISTENCE_RELOAD_SUCCESS = true;
      }, 350);
    } else if (location.hash === '#test-permafrost') {
      setTimeout(() => {
        const btnStart = document.getElementById('btn-start-run');
        if (btnStart) btnStart.click();

        if (typeof gameState !== 'undefined') {
          if (gameState.hero) {
            gameState.hero.hp = 99999;
            gameState.hero.maxHp = 99999;
          }
          if (gameState.squad && gameState.squad.ice) {
            gameState.squad.ice.level = 2;
            if (!gameState.recruitedOrder.includes('ice')) {
              gameState.recruitedOrder.push('ice');
            }
            if (typeof squadMeshes !== 'undefined' && squadMeshes.ice) {
              squadMeshes.ice.visible = true;
            }
          }
        }

        let spawnCount = 0;
        const spawnerInterval = setInterval(() => {
          spawnCount++;
          if (typeof spawnBloon === 'function') {
            const types = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'WHITE', 'CERAMIC'];
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              spawnBloon(types[i % types.length], Math.cos(a) * 4.5, Math.sin(a) * 4.5);
            }
          }
          if (spawnCount >= 12) {
            clearInterval(spawnerInterval);
            setTimeout(() => {
              window.__PERMAFROST_TEST_PASSED = true;
            }, 800);
          }
        }, 180);
      }, 400);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log("Bloons Blitz UI Override Module (Build 11 Extended) Ready!");
})();


// ============================================================================
// BLOONS BLITZ 3D — UPDATE 12.2 MASTER ENGINE
// ============================================================================
(function initUpdate12MasterEngine() {
  'use strict';

  function bootUpdate12() {
    const G = window.__GAME;
    if (!G || !G.scene || !G.gameState) {
      setTimeout(bootUpdate12, 50);
      return;
    }

    // ------------------------------------------------------------------------
    // 1. FORCE 2X MONITOR HZ & 2X CRISP ON STARTUP
    // ------------------------------------------------------------------------
    G.fpsMode = '2x';
    if (G.renderer && G.renderer.setPixelRatio) {
      G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }
    document.querySelectorAll('.fps-opt-btn').forEach(b => {
      b.className = b.getAttribute('data-fps') === '2x'
        ? 'fps-opt-btn py-1.5 px-2.5 rounded-xl btd-btn-blue font-btd-sm text-xs text-white cursor-pointer'
        : 'fps-opt-btn py-1.5 px-2.5 rounded-xl bg-stone-800 border-2 border-black font-btd-sm text-xs text-amber-100 cursor-pointer';
    });
    document.querySelectorAll('.dpi-opt-btn').forEach(b => {
      b.className = b.getAttribute('data-dpi') === '2'
        ? 'dpi-opt-btn py-1.5 px-2 rounded-xl btd-btn-blue font-btd-sm text-[11px] text-white cursor-pointer'
        : 'dpi-opt-btn py-1.5 px-2 rounded-xl bg-stone-800 border-2 border-black font-btd-sm text-[11px] text-amber-100 cursor-pointer';
    });

    // ------------------------------------------------------------------------
    // 2. UNIFIED ESCAPE KEY PAUSE / RESUME HANDLER
    // ------------------------------------------------------------------------
    window.handleEscapeKey = function() {
      const closeModalIfOpen = (id) => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden') && el.style.display !== 'none') {
          el.classList.add('hidden');
          el.classList.remove('flex');
          el.style.display = '';
          return true;
        }
        return false;
      };
      if (closeModalIfOpen('barracks-modal')) return;
      if (closeModalIfOpen('modal-hero-unlock')) return;
      if (closeModalIfOpen('shop-modal')) {
        if (!G.gameState.inStartMenu && !G.gameState.gameOver) G.gameState.paused = false;
        return;
      }
      if (closeModalIfOpen('my-build-modal')) {
        if (!G.gameState.inStartMenu && !G.gameState.gameOver) G.gameState.paused = false;
        return;
      }
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal && !settingsModal.classList.contains('hidden')) {
        settingsModal.classList.add('hidden');
        settingsModal.classList.remove('flex');
        const lvlModal = document.getElementById('levelup-modal');
        if (!G.gameState.inStartMenu && !G.gameState.gameOver && (!lvlModal || lvlModal.classList.contains('hidden'))) {
          G.gameState.paused = false;
        }
        return;
      }
      const lvlModal = document.getElementById('levelup-modal');
      if (!G.gameState.inStartMenu && !G.gameState.gameOver && (!lvlModal || lvlModal.classList.contains('hidden'))) {
        G.togglePauseSettingsModal();
      }
    };

    // ------------------------------------------------------------------------
    // 3. MONKEY MONEY SYNC
    // ------------------------------------------------------------------------
    const origSyncMoney = G.syncMoneyLabels;
    window.syncMoneyLabels = function() {
      if (origSyncMoney) origSyncMoney();
      const mm = Math.max(0, Math.round(G.persistentStats.monkeyMoney || 0));
      const pops = Math.max(0, Math.round(G.persistentStats.lifetimePops || 0));
      ['start-monkey-money', 'hud-monkey-money', 'shop-money-balance', 'barracks-mm-bal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '$' + mm.toLocaleString();
      });
      const startPops = document.getElementById('start-lifetime-pops');
      if (startPops) startPops.textContent = pops.toLocaleString();
    };
    setInterval(window.syncMoneyLabels, 400);

    // ------------------------------------------------------------------------
    // 4. 4 DIFFICULTY MODES (W40, W60, W80, W100) + DEV WAVE SKIPPER W1-W100
    // ------------------------------------------------------------------------
    const DIFFICULTY_MODES = {
      easy:       { id: 'easy',       name: 'EASY',       maxWave: 40,  speedMult: 0.92, hpMult: 1.0,  mmMult: 1.0,  badge: 'bg-emerald-600', desc: '40 Waves • Standard Pacing' },
      medium:     { id: 'medium',     name: 'MEDIUM',     maxWave: 60,  speedMult: 1.05, hpMult: 1.25, mmMult: 1.35, badge: 'bg-sky-600',     desc: '60 Waves • Vortex Boss at W60' },
      hard:       { id: 'hard',       name: 'HARD',       maxWave: 80,  speedMult: 1.18, hpMult: 1.55, mmMult: 1.75, badge: 'bg-amber-600',   desc: '80 Waves • Dreadbloon & Phayze' },
      impoppable: { id: 'impoppable', name: 'IMPOPPABLE', maxWave: 100, speedMult: 1.32, hpMult: 2.00, mmMult: 2.50, badge: 'bg-rose-600',    desc: '100 Waves • All 5 Bosses Rush!' }
    };
    G.gameState.difficultyId = localStorage.getItem('bloons_u12_diff') || 'easy';
    G.gameState.maxWave = (DIFFICULTY_MODES[G.gameState.difficultyId] || DIFFICULTY_MODES.easy).maxWave;

    window.__GET_WAVE_HP_MULT = function() {
      const w = G.gameState.wave || 1;
      const diff = DIFFICULTY_MODES[G.gameState.difficultyId] || DIFFICULTY_MODES.easy;
      if (w <= 4) return 1.0;
      if (w <= 12) return (1 + (w - 4) * 0.25) * diff.hpMult;
      if (w <= 25) return (3 + (w - 12) * 0.65) * diff.hpMult;
      return (11.5 + Math.pow(w - 25, 1.45) * 0.85) * diff.hpMult;
    };

    function injectDifficultySelector() {
      const mapGrid = document.getElementById('map-select-grid');
      if (!mapGrid || document.getElementById('u12-diff-grid')) return;
      const wrap = document.createElement('div');
      wrap.className = 'w-full mt-2';
      wrap.innerHTML = `
        <div class="text-center font-btd-sm text-xs text-yellow-300 mb-1 tracking-wider">SELECT MISSION DIFFICULTY & MAX ROUND:</div>
        <div id="u12-diff-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full"></div>
      `;
      mapGrid.parentNode.appendChild(wrap);

      const grid = wrap.querySelector('#u12-diff-grid');
      Object.values(DIFFICULTY_MODES).forEach(d => {
        const card = document.createElement('div');
        card.className = `diff-select-card rounded-2xl p-1.5 flex flex-col items-center text-center ${G.gameState.difficultyId === d.id ? 'selected' : ''}`;
        card.innerHTML = `
          <div class="flex items-center gap-1.5">
            <span class="font-btd text-xs text-white">${d.name}</span>
            <span class="px-1.5 py-0.2 ${d.badge} rounded text-[9px] font-black text-white">${d.mmMult}x $</span>
          </div>
          <span class="font-btd-sm text-[10px] text-yellow-300">MAX WAVE ${d.maxWave}</span>
          <span class="text-[9px] font-bold text-amber-100/80">${d.desc}</span>
        `;
        card.addEventListener('click', () => {
          G.soundFX.init();
          G.soundFX.playBlopOrbChime(1);
          G.gameState.difficultyId = d.id;
          G.gameState.maxWave = d.maxWave;
          localStorage.setItem('bloons_u12_diff', d.id);
          grid.querySelectorAll('.diff-select-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        });
        grid.appendChild(card);
      });
    }
    injectDifficultySelector();

    // Wire W60, W80, W100 Dev Wave Buttons
    document.querySelectorAll('.dev-wave-btn').forEach(btn => {
      btn.onclick = () => {
        const targetW = parseInt(btn.getAttribute('data-wave'), 10) || 1;
        G.gameState.wave = targetW;
        G.gameState.elapsedTime = (targetW - 1) * 15;
        if (targetW >= 20 && !G.gameState.firstMoabSpawned) {
          G.gameState.firstMoabSpawned = true;
          G.spawnAirshipBoss('MOAB');
        }
        if (targetW === 60) G.spawnAirshipBoss('VORTEX');
        if (targetW === 80) G.spawnAirshipBoss('PHAYZE');
        if (targetW === 100) G.spawnAirshipBoss('BLASTAPOPOULOS');
        const sm = document.getElementById('settings-modal');
        if (sm) { sm.classList.add('hidden'); sm.classList.remove('flex'); }
        G.gameState.paused = false;
        G.updateHUD();
      };
    });

    // ------------------------------------------------------------------------
    // 5. WAVE TITLE CARDS (TOGGLEABLE IN SETTINGS, DEFAULT ON)
    // ------------------------------------------------------------------------
    G.gameState.showWaveTitleCards = localStorage.getItem('bloons_u12_wave_cards') !== 'off';
    const waveBanner = document.createElement('div');
    waveBanner.id = 'wave-title-banner';
    waveBanner.innerHTML = `
      <div class="px-6 py-2 rounded-3xl bg-gradient-to-b from-amber-400 via-amber-500 to-orange-600 border-[3.5px] border-[#1c0d05] shadow-[0_8px_0_#1c0d05,0_14px_28px_rgba(0,0,0,0.7)] flex flex-col items-center text-center">
        <span id="wave-card-num" class="font-btd text-xl sm:text-2xl text-white tracking-wider">WAVE 1</span>
        <span id="wave-card-sub" class="font-btd-sm text-xs sm:text-sm text-yellow-200 tracking-wide">RED & BLUE WARMUP</span>
      </div>
    `;
    document.body.appendChild(waveBanner);

    const hurtVignette = document.createElement('div');
    hurtVignette.id = 'hurt-vignette-overlay';
    document.body.appendChild(hurtVignette);

    const bossPointerEl = document.createElement('div');
    bossPointerEl.id = 'boss-screen-pointer';
    bossPointerEl.innerHTML = `<span id="boss-ptr-arrow" style="display:inline-block;font-size:16px;">➤</span> <span id="boss-ptr-label">BOSS</span>`;
    document.body.appendChild(bossPointerEl);

    // 3D Overhead Bouncing Arrow for Active Boss Blimp
    const bossOverheadGroup = new THREE.Group();
    const arrowCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 1.35, 6).rotateX(Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    arrowCone.position.y = 5.4;
    bossOverheadGroup.add(arrowCone);
    const bossTargetRing = new THREE.Mesh(
      new THREE.RingGeometry(1.9, 2.35, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
    );
    bossTargetRing.position.y = 0.08;
    bossOverheadGroup.add(bossTargetRing);
    bossOverheadGroup.visible = false;
    G.scene.add(bossOverheadGroup);

    const WAVE_TITLES = {
      1: 'RED & BLUE BLOON WARMUP',
      4: 'GREEN & YELLOW SPEED RUSH',
      9: 'CAMO, REGROW & LEAD RECON',
      15: 'PURPLE ENERGY SHIELD & CERAMIC ARMOR',
      20: 'M.O.A.B. AIRSHIP INBOUND!',
      30: 'VORTEX — DEADLY MASTER OF AIR!',
      40: 'B.A.D. / DREADBLOON BOSS SHOWDOWN!',
      50: 'SUPER CERAMIC ESCALATION!',
      60: 'VORTEX & Z.O.M.G. ARMADA!',
      80: 'PHAYZE REALITY WARPER ASSAULT!',
      100: 'BLASTAPOPOULOS FINAL CATACLYSM!'
    };

    let lastAnnouncedWave = 0;
    let waveBannerTimeout = null;
    function triggerWaveTitleCard(w) {
      if (!G.gameState.showWaveTitleCards || G.gameState.inStartMenu || G.gameState.gameOver) return;
      const maxW = (DIFFICULTY_MODES[G.gameState.difficultyId] || DIFFICULTY_MODES.easy).maxWave;
      const numEl = document.getElementById('wave-card-num');
      const subEl = document.getElementById('wave-card-sub');
      if (!numEl || !subEl) return;
      numEl.textContent = G.gameState.freeplayMode ? `FREEPLAY WAVE ${w}` : `WAVE ${w} / ${maxW}`;
      subEl.textContent = (window.__b13BossWaveTitle && window.__b13BossWaveTitle(w)) || WAVE_TITLES[w] || (w > 40 ? 'SUPER CERAMIC & BLIMP SWARM' : (w >= 25 ? 'HEAVY BLIMP & CERAMIC ASSAULT' : 'BLOON SWARM INTENSIFIES'));
      waveBanner.classList.add('show');
      if (waveBannerTimeout) clearTimeout(waveBannerTimeout);
      waveBannerTimeout = setTimeout(() => waveBanner.classList.remove('show'), 2500);
    }

    function injectWaveTitleToggleInSettings() {
      const iconStyleBtn = document.getElementById('btn-toggle-icon-style');
      if (!iconStyleBtn || document.getElementById('btn-toggle-wave-cards')) return;
      const row = iconStyleBtn.parentElement;
      const waveRow = document.createElement('div');
      waveRow.className = 'w-full flex items-center justify-between p-2.5 rounded-2xl bg-stone-900/90 border border-white/10 mb-2.5';
      waveRow.innerHTML = `
        <div class="flex flex-col text-left">
          <span class="font-btd-sm text-xs text-lime-300">WAVE TITLE CARDS</span>
          <span class="text-[10px] text-stone-300">Show animated wave announcement banner</span>
        </div>
        <button id="btn-toggle-wave-cards" class="py-1 px-3.5 rounded-xl ${G.gameState.showWaveTitleCards ? 'btd-btn-green' : 'bg-stone-700 border-2 border-black'} font-btd-sm text-xs text-white cursor-pointer">
          ${G.gameState.showWaveTitleCards ? 'ON (DEFAULT)' : 'OFF'}
        </button>
      `;
      row.parentNode.insertBefore(waveRow, row.nextSibling);
      const btn = waveRow.querySelector('#btn-toggle-wave-cards');
      btn.addEventListener('click', () => {
        G.gameState.showWaveTitleCards = !G.gameState.showWaveTitleCards;
        localStorage.setItem('bloons_u12_wave_cards', G.gameState.showWaveTitleCards ? 'on' : 'off');
        btn.textContent = G.gameState.showWaveTitleCards ? 'ON (DEFAULT)' : 'OFF';
        btn.className = `py-1 px-3.5 rounded-xl ${G.gameState.showWaveTitleCards ? 'btd-btn-green' : 'bg-stone-700 border-2 border-black'} font-btd-sm text-xs text-white cursor-pointer`;
      });
    }
    injectWaveTitleToggleInSettings();

    // ------------------------------------------------------------------------
    // 6. STRICT 3-COMPANION CAP & ALL 10 HEROES' BESPOKE UPGRADE TREES
    // ------------------------------------------------------------------------
    G.getAvailableUpgradeCards = function(state) {
      const h = state.hero;
      const cfg = G.HERO_CONFIGS[h.id] || G.HERO_CONFIGS.quincy;
      const pool = [];
      const heroBadge = 'from-amber-400 via-purple-600 to-indigo-800';
      const heroHeader = `★ HERO UPGRADE - ${cfg.name}`;

      // Enforce max 3 companions in state.recruitedOrder
      if (state.recruitedOrder && state.recruitedOrder.length > 3) {
        const extra = state.recruitedOrder.splice(3);
        extra.forEach(k => { if (state.squad[k]) state.squad[k].level = 0; });
      }

      const path1Names = {
        quincy:      ['Bounce Shot Arrows (T1)', 'Twin Feather Bow (T2)', 'Triple Shot Volley (T3)', 'Deadshot Storm Bow (T4)', 'Paragon: Master Bowman (T5)'],
        gwendolin:   ['High-Pressure Nozzle (T1)', 'Twin Flame Jets (T2)', 'Triple Pyro Stream (T3)', 'Dragon Pyro Blast (T4)', 'Paragon: Solar Inferno (T5)'],
        obyn:        ['Branched Spirit Staff (T1)', 'Twin Wolf Pack (T2)', 'Triple Forest Spirits (T3)', 'Avatar of the Wild (T4)', 'Paragon: Sovereign of Nature (T5)'],
        sauda:       ['Twin Katana Tempo (T1)', 'Wide Crescent Sweep (T2)', 'Double Slash Arcs (T3)', 'Blade Whirlwind (T4)', 'Paragon: Thousand Cuts (T5)'],
        benjamin:    ['Fast Packet Siphon (T1)', 'Dual-Core Downlink (T2)', 'Multi-Thread Hack (T3)', 'Quantum Mainframe (T4)', 'Paragon: Root Admin Matrix (T5)'],
        supermonkey: ['Laser Blasts (1-0-0)', 'Plasma Blasts (2-0-0)', 'Sun Avatar (3-0-0)', 'Sun Temple (4-0-0)', 'True Sun God (5-0-0)'],
        silas:       ['Ricochet Ice Shards (T1)', 'Twin Rime Lances (T2)', 'Triple Permafrost Volley (T3)', 'Icicle Impale Storm (T4)', 'Paragon: Absolute Zero Ice Shaper (T5)'],
        rosalia:     ['Scatter Laser Carbine (T1)', 'Twin Photon Blasters (T2)', 'Tri-Beam Jetpack Volley (T3)', 'Heavy Plasma Laser (T4)', 'Paragon: Skyforge Valkyrie (T5)'],
        corvus:      ['Aggressive Spirit (T1)', 'Spirit Spear Bounce (T2)', 'Echo Twin Spirits (T3)', 'Malevolence Tempest (T4)', 'Paragon: Avatar of Ancestral Might (T5)'],
        geraldo:     ['Mystic Lightning Flasks (T1)', 'Twin Alchemical Volley (T2)', 'Triple Concoction Toss (T3)', 'Master Artificer Volley (T4)', 'Paragon: Grand Emporium (T5)']
      };
      const path1Descs = {
        quincy:      'Fires extra bouncing feathered arrows with +20% bow draw speed and +1 pierce!',
        gwendolin:   'Widens Gwendolin\'s searing flamethrower cone and ignites bloons with Burn DoT!',
        obyn:        'Summons additional homing emerald Spirit Wolves that weave through bloon packs!',
        sauda:       'Unleashes wider glowing katana crescent waves with +20% slash speed!',
        benjamin:    'Hacks +1 extra bloon wirelessly per pulse with Matrix green binary bursts!',
        supermonkey: 'Top path: darts become red Laser Blasts, then purple-pink Plasma balls, then the golden Sun Avatar beams.',
        silas:       'Silas casts ricocheting 3D Crystalline Ice Shards that apply Rime & shatter frozen bloons!',
        rosalia:     'Hovering Jetpack blaster fires multi-beam ruby scatter lasers from above!',
        corvus:      'Empowers Corvus\'s floating 3D Spirit Companion (Tier 3 Echo summons 2 Spirits at once)!',
        geraldo:     'Hurls additional mystic lightning & fire flasks with +20% throwing speed!'
      };

      if (h.volleyTier < 5) {
        const nextT = h.volleyTier + 1;
        pool.push({
          id: `hero_volley_${h.id}`,
          tier: nextT,
          path: `${heroHeader} • T${nextT}`,
          badgeColor: heroBadge,
          icon: cfg.skillIcon,
          name: (path1Names[h.id] || path1Names.quincy)[nextT - 1],
          desc: path1Descs[h.id] || path1Descs.quincy,
          apply: (st) => {
            st.hero.volleyTier++;
            if (st.hero.volleyTier >= 2) st.hero.projectiles += 1;
            st.hero.pierce += 2;
            st.hero.fireRate *= 1.20;
          }
        });
      }

      const path2Names = {
        quincy:      ['Keen Arrowheads (T1)', 'Armor-Piercing Bodkins (T2)', 'Serrated Broadheads (T3)', 'MOAB Mauler Arrows (T4)', 'Paragon: Titan Piercer (T5)'],
        gwendolin:   ['Heat It Up! (T1)', 'White-Hot Napalm (T2)', 'Pyroclastic Meltdown (T3)', 'Inferno Incinerator (T4)', 'Paragon: Magma Core (T5)'],
        obyn:        ['Nature\'s Clarity (T1)', 'Ironwood Thorns (T2)', 'Elder Spirit Fury (T3)', 'Wrath of the Druids (T4)', 'Paragon: Gaia\'s Judgment (T5)'],
        sauda:       ['Enchanted Blades (T1)', 'Deep Laceration Bleed (T2)', 'Heartstopper Steel (T3)', 'Master Swordswoman (T4)', 'Paragon: Crimson Ronin (T5)'],
        benjamin:    ['Biohack Injection (T1)', 'Trojan Bloon Virus (T2)', 'Layer Downlink (T3)', 'Zero-Day Exploit (T4)', 'Paragon: System Wipe (T5)'],
        supermonkey: ['Super Range (0-1-0)', 'Epic Range (0-2-0)', 'Robo Monkey (0-3-0)', 'Tech Terror (0-4-0)', 'The Anti-Bloon (0-5-0)'],
        silas:       ['Deep Rime Chill (T1)', 'White Bloon Frostbite (T2)', 'Icicle Shatter Burst (T3)', 'Super Brittle Vulnerability (T4)', 'Paragon: Winter\'s Mercy (T5)'],
        rosalia:     ['Bounce Grenade Launcher (T1)', 'Concussive Cluster Shells (T2)', 'Anti-Armor Laser Optics (T3)', 'Airship Demolition Pods (T4)', 'Paragon: Kinetic Payload (T5)'],
        corvus:      ['Wireless Haunt Curse (T1)', 'Nourishment Mana Surge (T2)', 'Spectral Arc Lightning (T3)', 'Ancestral Soul Drain (T4)', 'Paragon: Omnipresent Haunt (T5)'],
        geraldo:     ['Shooty Turret Foundry (T1)', 'Sharpening Stone Buff (T2)', 'Jar of Pickles Might (T3)', 'Genie Bottle Summon (T4)', 'Paragon: Mystic Arsenal (T5)']
      };
      const path2Descs = {
        quincy:      'Unlocks Lead-popping bodkin tips, +1.2 Layer Damage, and +15% Crit Chance!',
        gwendolin:   'Superheats flames to melt Purple & Lead Bloons with +1.5 Layer Damage!',
        obyn:        'Spirit Wolves & Brambles shred Lead & Fortified shells with +1.4 Damage!',
        sauda:       'Enchanted Katanas slice Lead & deal heavy stacking Bleed DoT to Blimps!',
        benjamin:    'Wireless hacks strip +2 extra layers and infect bloons with Trojan virus!',
        supermonkey: 'Middle path: longer range, then the Robo Monkey suit with arm cannons, then Tech Terror and The Anti-Bloon.',
        silas:       'Strips White Bloon immunity and causes frozen bloons to explode into 6 icicles on pop!',
        rosalia:     'Fires bouncing grenade shells alongside her laser that blast Lead & stun Ceramics!',
        corvus:      'Expands Corvus\'s wireless Haunt range to curse more bloons & harvest bonus Soul Mana!',
        geraldo:     'Increases Turret & Flask damage by +1.5 and grants Lead/Purple popping power!'
      };

      if (h.weaponTier < 5) {
        const nextT = h.weaponTier + 1;
        pool.push({
          id: `hero_elemental_${h.id}`,
          tier: nextT,
          path: `${heroHeader} • T${nextT}`,
          badgeColor: heroBadge,
          icon: cfg.skillIcon,
          name: (path2Names[h.id] || path2Names.quincy)[nextT - 1],
          desc: path2Descs[h.id] || path2Descs.quincy,
          apply: (st) => {
            st.hero.weaponTier++;
            st.hero.canPopLead = true;
            st.hero.damage += 1.2 + nextT * 0.4;
            st.hero.critChance = Math.min(0.85, st.hero.critChance + 0.14);
            st.hero.fireRate *= 1.15;
          }
        });
      }

      const path3Names = {
        quincy:      ['Exploding Arrow Tips (T1)', 'Compound Blast Arrows (T2)', 'Shrapnel Fletching (T3)', 'Cataclysmic Arrows (T4)', 'Paragon: Supernova Quiver (T5)'],
        gwendolin:   ['Sticky Napalm Pools (T1)', 'Wall of Fire Mastery (T2)', 'Molotov Splash (T3)', 'Volcanic Eruption (T4)', 'Paragon: World Burner (T5)'],
        obyn:        ['Spiked Bramble Bush (T1)', 'Overgrown Thorns (T2)', 'Wall of Trees Trap (T3)', 'Ancient Forest Totem (T4)', 'Paragon: World Tree (T5)'],
        sauda:       ['Relentless Strike (T1)', 'Leaping Sword Cooldown (T2)', 'Crimson Hurricane (T3)', 'Sword Charge Mastery (T4)', 'Paragon: Blade Tempest (T5)'],
        benjamin:    ['Skimming Dividends (T1)', 'Monkey Bank Interest (T2)', 'Squad Overclock Aura (T3)', 'Global Cyber Stimulus (T4)', 'Paragon: Infinite Mint (T5)'],
        supermonkey: ['Knockback (0-0-1)', 'Ultravision (0-0-2)', 'Dark Knight (0-0-3)', 'Dark Champion (0-0-4)', 'Legend of the Night (0-0-5)'],
        silas:       ['Freezing Mist Aura (T1)', 'Ice Monkey Synergy (T2)', 'Glacial Ice Platform (T3)', 'Frozen Cascade (T4)', 'Paragon: Eternal Permafrost (T5)'],
        rosalia:     ['Jetpack Afterburner (T1)', 'Flight Boost Thrusters (T2)', 'Kinetic Charge Bomb (T3)', 'Aerial Carpet Bombing (T4)', 'Paragon: Supersonic Ace (T5)'],
        corvus:      ['Dark Ritual Ring (T1)', 'Trample Spirit Rush (T2)', 'Ember Soul Burn (T3)', 'Repel Shockwave (T4)', 'Paragon: Grim Singularity (T5)'],
        geraldo:     ['Autonomous Shooty Turrets (T1)', 'Spiked Nail Mines (T2)', 'Rejuvenation Potion (T3)', 'Creepy Idol Totem (T4)', 'Paragon: Wonder Emporium (T5)']
      };
      const path3Descs = {
        quincy:      'Every 3rd Quincy arrow detonates in a fiery explosion (pops Lead & Purple)!',
        gwendolin:   'Spawns larger, longer-lasting Napalm Fire Pools and fiery shockwaves!',
        obyn:        'Spawns dense 3D Spiked Bramble traps & nature bursts across the meadow!',
        sauda:       'Every 3rd slash unleashes a 360° crimson shockwave + faster Leaping Sword!',
        benjamin:    'Prints bonus Monkey Money per hack and boosts all Squad Attack Speed by +20%!',
        supermonkey: 'Bottom path: knockback and Camo vision, then Dark Knight blades that shred MOABs.',
        silas:       'Expands Silas\'s passive Rime Aura to slow all nearby bloons by 50% & buff Ice attacks!',
        rosalia:     'Increases Rosalia\'s flying speed and drops explosive cluster mines along her flight path!',
        corvus:      'Channels Dark Ritual & Trample around Corvus, shredding ceramics and restoring HP!',
        geraldo:     'Deploys autonomous 3D Shooty Turrets & Spiked Nail Traps on the battlefield!'
      };

      if (h.explosiveTier < 5) {
        const nextT = h.explosiveTier + 1;
        pool.push({
          id: `hero_explosive_${h.id}`,
          tier: nextT,
          path: `${heroHeader} • T${nextT}`,
          badgeColor: heroBadge,
          icon: cfg.skillIcon,
          name: (path3Names[h.id] || path3Names.quincy)[nextT - 1],
          desc: path3Descs[h.id] || path3Descs.quincy,
          apply: (st) => {
            st.hero.explosiveTier++;
            st.hero.explosiveShots = true;
            st.hero.canPopLead = true;
            st.hero.abilityCooldownMax = Math.max(4.0, st.hero.abilityCooldownMax * 0.85);
          }
        });
      }

      // Companion Cards — STRICTLY LOCKED TO 3 MAX!
      const recruitedCount = state.recruitedOrder.length;
      G.COMPANION_CATALOG.forEach(comp => {
        if (!state.squad[comp.key]) state.squad[comp.key] = { level: 0, cooldown: 0 };
        const curLvl = state.squad[comp.key].level;
        const isAlreadyRecruited = curLvl > 0;

        if (!isAlreadyRecruited && recruitedCount >= 3) return;

        if (curLvl < 5) {
          const nextTier = curLvl + 1;
          const isNewRecruit = curLvl === 0;
          const title = isNewRecruit ? comp.titles[0] : (comp.titles[curLvl] || `Tier ${nextTier}: Paragon ${comp.shortName}`);
          const desc = isNewRecruit ? comp.descs[0] : (comp.descs[curLvl] || `Tier 5 Paragon Evolution! +60% Damage, +35% Speed & Ultimate 3D Paragon Form!`);

          pool.push({
            id: isNewRecruit ? `recruit_${comp.key}` : `squad_${comp.key}`,
            tier: nextTier,
            path: isNewRecruit ? `🛡 NEW RECRUIT (${recruitedCount + 1}/3)` : `${comp.shortName} • TIER ${nextTier}`,
            badgeColor: isNewRecruit ? 'from-emerald-500 to-green-700' : 'from-cyan-500 to-blue-700',
            icon: comp.icon,
            name: title,
            desc: desc,
            apply: (st) => {
              if (st.squad[comp.key].level === 0) {
                if (st.recruitedOrder.length >= 3) return;
                st.recruitedOrder.push(comp.key);
              }
              st.squad[comp.key].level += 1;
            }
          });
        }
      });

      const banished = state.banishedCardIds || new Set();
      return pool.filter(c => !banished.has(c.id));
    };

    // ------------------------------------------------------------------------
    // 7. TRUE 3D MODEL EVOLUTION (SHAPE, COLOR, WEAPONS, WINGS, PARAGON AURA)
    // ------------------------------------------------------------------------
    function syncVisualEvolutionModel(mesh, tier, isHero = false) {
      if (!mesh) return;
      const t = Math.max(1, Math.min(5, Math.floor(tier || 1)));
      if (mesh.userData._lastEvoTier !== t) {
        mesh.userData._lastEvoTier = t;
        if (!mesh.userData.evoGroup) {
          const evoGroup = new THREE.Group();

          // 1. Under-Feet Star/Rune Ring
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.52, 0.72, 6).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
          );
          ring.position.y = 0.04;
          evoGroup.add(ring);

          // 2. Tier 2+ Shoulder Pauldrons
          const pauldrons = new THREE.Group();
          [-0.44, 0.44].forEach(x => {
            const p = new THREE.Mesh(
              new THREE.SphereGeometry(0.18, 12, 10),
              new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.75, roughness: 0.2 })
            );
            p.position.set(x, 1.02, 0);
            p.scale.set(1.2, 0.7, 1.1);
            pauldrons.add(p);
          });
          evoGroup.add(pauldrons);

          // 3. Tier 3+ Golden Crown / Crest
          const crown = new THREE.Group();
          crown.position.set(0, 2.02, 0.05);
          const crownBand = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.24, 0.14, 12),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.15 })
          );
          crown.add(crownBand);
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const spike = new THREE.Mesh(
              new THREE.ConeGeometry(0.06, 0.18, 4),
              new THREE.MeshBasicMaterial({ color: 0x00f2fe })
            );
            spike.position.set(Math.cos(a) * 0.25, 0.12, Math.sin(a) * 0.25);
            crown.add(spike);
          }
          evoGroup.add(crown);

          // 4. Tier 4+ Energy Wings / Back Halo
          const wings = new THREE.Group();
          [-1, 1].forEach(side => {
            const wing = new THREE.Mesh(
              new THREE.BoxGeometry(0.55, 0.75, 0.04),
              new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.82 })
            );
            wing.position.set(side * 0.52, 1.05, -0.28);
            wing.rotation.z = -side * 0.35;
            wings.add(wing);
          });
          evoGroup.add(wings);

          // 5. Tier 5 Paragon Orbiting Crystals
          const orbs = new THREE.Group();
          orbs.position.set(0, 1.1, 0);
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const crystal = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.16, 0),
              new THREE.MeshBasicMaterial({ color: 0xe879f9 })
            );
            crystal.position.set(Math.cos(a) * 0.92, 0, Math.sin(a) * 0.92);
            orbs.add(crystal);
          }
          evoGroup.add(orbs);

          mesh.add(evoGroup);
          mesh.userData.evoGroup = evoGroup;
          mesh.userData.evoRing = ring;
          mesh.userData.evoPauldrons = pauldrons;
          mesh.userData.evoCrown = crown;
          mesh.userData.evoWings = wings;
          mesh.userData.evoOrbs = orbs;
        }

        const tierColors = [0x38bdf8, 0x22c55e, 0xfacc15, 0xf97316, 0xe879f9];
        const col = tierColors[t - 1];
        mesh.userData.evoGroup.visible = false; // BUILD 13.6: generic ring/crown/wings/crystals removed
        mesh.userData.evoRing.material.color.setHex(col);
        mesh.userData.evoPauldrons.visible = t >= 2;
        mesh.userData.evoCrown.visible = t >= 3;
        mesh.userData.evoWings.visible = t >= 4;
        mesh.userData.evoOrbs.visible = t >= 5;

        // Tint mesh materials with higher-tier emissive glow & scale up stature
        mesh.traverse(child => {
          if (child.isMesh && child.material && child.material.emissive && !child.parent.name) {
            if (t >= 4) {
              child.material.emissive.setHex(t === 5 ? 0x581c87 : 0x451a03);
              child.material.emissiveIntensity = t === 5 ? 0.45 : 0.25;
            } else {
              child.material.emissive.setHex(0x000000);
            }
          }
        });
      }

      const scaleBase = isHero ? (1.0 + (t - 1) * 0.08) : (1.0 + (t - 1) * 0.11);
      mesh.scale.setScalar(scaleBase * (window.B13_UNIT_SCALE || 1));
      if (mesh.userData.evoOrbs && mesh.userData.evoOrbs.visible) {
        mesh.userData.evoOrbs.rotation.y += 0.08;
      }
      if (mesh.userData.evoRing && mesh.userData.evoRing.visible) {
        mesh.userData.evoRing.rotation.z += 0.03;
      }
    }

    // ------------------------------------------------------------------------
    // 8. CORVUS 3D FLOATING SPIRIT FAMILIAR, ROSALIA JETPACK FIRE/SMOKE & SILAS RIME AURA
    // ------------------------------------------------------------------------
    // (A) Corvus's 3D Ghostly Spirit Companion (Flies & Attacks Independently, ZERO Bullets!)
    const corvusSpiritGroup = new THREE.Group();
    const spiritCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 1),
      new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.92 })
    );
    spiritCore.position.y = 1.1;
    corvusSpiritGroup.add(spiritCore);
    const spiritHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.06, 8, 20).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    spiritHalo.position.y = 1.1;
    corvusSpiritGroup.add(spiritHalo);
    // Second Echo Spirit (Unlocks at Corvus Volley Tier 3+)
    const spiritEcho = spiritCore.clone();
    spiritEcho.position.set(1.2, 1.1, 0);
    spiritEcho.visible = false;
    corvusSpiritGroup.add(spiritEcho);
    corvusSpiritGroup.visible = false;
    G.scene.add(corvusSpiritGroup);
    let spiritX = 0, spiritZ = 0, spiritAttackTimer = 0, corvusHauntTimer = 0;

    // (B) Silas's Passive Rime Frost Ring on Ground
    const silasRimeRing = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 4.65, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
    );
    silasRimeRing.position.y = 0.04;
    silasRimeRing.visible = false;
    G.scene.add(silasRimeRing);
    let silasAttackTimer = 0;

    // (C) Rosalia's Jetpack Thruster Flames & Non-Distracting Smoke Puffs
    const rosaliaParticles = [];
    let rosaliaSmokeTimer = 0;
    let rosaliaAttackTimer = 0;
    let geraldoAttackTimer = 0;

    function spawnRosaliaJetpackExhaust(hx, hy, hz, hAngle) {
      for (const side of [-0.26, 0.26]) {
        const wx = hx + Math.cos(hAngle) * side - Math.sin(hAngle) * 0.34;
        const wz = hz - Math.sin(hAngle) * side - Math.cos(hAngle) * 0.34;
        const isFlame = Math.random() < 0.55;
        const mesh = new THREE.Mesh(
          isFlame ? new THREE.ConeGeometry(0.11, 0.28, 6).rotateX(Math.PI) : new THREE.SphereGeometry(0.12, 8, 6),
          new THREE.MeshBasicMaterial({
            color: isFlame ? (Math.random() < 0.5 ? 0xff5500 : 0xfacc15) : 0xcbd5e1,
            transparent: true,
            opacity: isFlame ? 0.78 : 0.38
          })
        );
        mesh.position.set(wx, hy + 0.52, wz);
        G.scene.add(mesh);
        rosaliaParticles.push({ mesh, vy: isFlame ? -2.2 : 0.8, life: 0.22, maxLife: 0.22, isFlame });
      }
    }

    // ------------------------------------------------------------------------
    // 9. IN-WORLD 3D POWER-UPS SPACED 5x–10x FARTHER APART (65m–110m SPACING!)
    // ------------------------------------------------------------------------
    const activeWorldPickups = [];
    let pickupSpawnTimer = 4.0;
    const shieldBubbleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ffaa, wireframe: true, transparent: true, opacity: 0.48 })
    );
    shieldBubbleMesh.visible = false;
    G.scene.add(shieldBubbleMesh);

    function createPickup3DMesh(type) {
      const grp = new THREE.Group();
      if (type === 'banana') {
        for (let b = -1; b <= 1; b++) {
          const arc = new THREE.Mesh(
            new THREE.TorusGeometry(0.34, 0.09, 8, 14, Math.PI * 0.75),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x854d0e, roughness: 0.25 })
          );
          arc.position.set(b * 0.12, 0.48, 0);
          arc.rotation.z = b * 0.25;
          grp.add(arc);
        }
      } else if (type === 'crate') {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.78, 0.78, 0.78),
          new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 })
        );
        box.position.y = 0.44;
        grp.add(box);
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(0.82, 0.16, 0.82),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6 })
        );
        band.position.y = 0.44;
        grp.add(band);
      } else if (type === 'barrel') {
        const cyl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.40, 0.40, 0.90, 14),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 })
        );
        cyl.position.y = 0.48;
        grp.add(cyl);
      } else if (type === 'magnet') {
        const mag = new THREE.Mesh(
          new THREE.TorusGeometry(0.38, 0.12, 8, 16, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.2 })
        );
        mag.position.y = 0.58;
        grp.add(mag);
      } else if (type === 'shield') {
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.48, 0),
          new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, metalness: 0.4, roughness: 0.15 })
        );
        core.position.y = 0.58;
        grp.add(core);
      }
      return grp;
    }

    function trySpawnFarSpacedPickup(hx, hz) {
      if (activeWorldPickups.length >= 6) return;
      const types = ['banana', 'crate', 'barrel', 'magnet', 'shield'];
      for (let attempt = 0; attempt < 10; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const dist = 42 + Math.random() * 55; // 42m to 97m away from hero!
        const px = hx + Math.cos(a) * dist;
        const pz = hz + Math.sin(a) * dist;
        // Enforce 65m minimum distance from EVERY other pickup on the map!
        const tooClose = activeWorldPickups.some(other => Math.hypot(other.x - px, other.z - pz) < 65);
        if (!tooClose) {
          const type = types[Math.floor(Math.random() * types.length)];
          const mesh = createPickup3DMesh(type);
          mesh.position.set(px, 0, pz);
          G.scene.add(mesh);
          activeWorldPickups.push({ mesh, type, x: px, z: pz, life: 60.0 });
          return;
        }
      }
    }

    // ------------------------------------------------------------------------
    // 10. MASTER SIMULATION LOOP HOOK (RUNS EVERY FRAME IN THE LIVE ARENA!)
    // ------------------------------------------------------------------------
    const origUpdateSim = G.updateSimulation;
    G.updateSimulation = function(dt) {
      origUpdateSim(dt);

      const st = G.gameState;
      const h = st.hero;
      if (!h || st.paused || st.gameOver || st.inStartMenu) return;

      // 1. CRITICAL FIX: Spawn & Step ALL 14 Companions Directly in G.scene!
      if (typeof window.__ensureAllSquadMeshes === 'function') {
        window.__ensureAllSquadMeshes(G.scene);
      }
      if (typeof window.__stepSquadAndHeroSimulation === 'function') {
        window.__stepSquadAndHeroSimulation(dt, G.scene);
      }

      // 2. Enforce 1-Heart-Bar Contact Damage (20% Max HP) & 1.6s Blink Invincibility!
      if (h.invulnTimer <= 0) {
        let hitByEnemy = false;
        let isHeavyHit = false;

        // Check MOAB contact
        for (let m = 0; m < G.activeMOABs.length; m++) {
          const mb = G.activeMOABs[m];
          if (Math.hypot(mb.x - h.x, mb.z - h.z) < 2.85) {
            hitByEnemy = true;
            isHeavyHit = true;
            break;
          }
        }
        // Check Bloon contact (generous 1.32m touch radius so touching any bloon hurts!)
        if (!hitByEnemy) {
          G.spatialGrid.queryRadius(h.x, h.z, 2.2, G.queryBuffer);
          for (let q = 0; q < G.queryBuffer.length; q++) {
            const bIdx = G.queryBuffer[q];
            if (G.bloonActive[bIdx] === 1 && G.bloonFreezeTimer[bIdx] <= 0) {
              const touchR = 0.85 + 0.45 * (G.bloonScale ? G.bloonScale[bIdx] : 1.0);
              if (Math.hypot(G.bloonX[bIdx] - h.x, G.bloonZ[bIdx] - h.z) < touchR) {
                hitByEnemy = true;
                const bDef = G.BLOON_TYPES[G.bloonTypeKey[bIdx]];
                if (bDef && bDef.isCeramic) isHeavyHit = true;
                break;
              }
            }
          }
        }

        if (hitByEnemy) {
          h.invulnTimer = 1.6; // 1.6s Invincibility window to escape!
          if (h.shieldHits && h.shieldHits > 0) {
            h.shieldHits--;
            G.soundFX.playBlopOrbChime(3);
            G.spawnComicPop(h.x, 1.0, h.z, 0x00ff88, 2.2);
            G.spawnFloatingText(h.x, 2.0, h.z, `SHIELD BLOCKED! (${h.shieldHits} LEFT)`, 'heal');
          } else {
            const oneHeart = Math.ceil(h.maxHp / 5); // 1 Full Bar out of 5!
            if (!st.godMode) {
              h.hp = Math.max(0, h.hp - (isHeavyHit ? oneHeart * 2 : oneHeart));
            }
            G.soundFX.playCeramicOrLead(false);
            G.triggerScreenShake(0.22, 0.20, 0);
            hurtVignette.style.opacity = '1';
            setTimeout(() => { hurtVignette.style.opacity = '0'; }, 260);
            G.spawnFloatingText(h.x, 2.1, h.z, st.godMode ? 'IMMUNE!' : (isHeavyHit ? '-2 HEARTS!' : '-1 HEART!'), 'crit');
          }
          // Radial emergency knockback so player can escape swarm
          G.spatialGrid.queryRadius(h.x, h.z, 4.5, G.queryBuffer);
          for (let q = 0; q < G.queryBuffer.length; q++) {
            const k = G.queryBuffer[q];
            const kx = G.bloonX[k] - h.x;
            const kz = G.bloonZ[k] - h.z;
            const kd = Math.hypot(kx, kz) || 1;
            G.bloonVX[k] += (kx / kd) * 15;
            G.bloonVZ[k] += (kz / kd) * 15;
          }
          G.updateHUD();
          if (h.hp <= 0 && !st.godMode) {
            G.triggerGameOver();
            return;
          }
        }
      }

      // 3. Invincibility Blink, Shield Bubble & Visible Tier 1-5 Hero/Companion Evolutions
      if (G.heroMesh) {
        G.heroMesh.visible = h.invulnTimer > 0.05 ? (Math.floor(h.invulnTimer * 18) % 2 === 0) : true;
        const heroTier = 1 + Math.floor(((h.volleyTier || 0) + (h.weaponTier || 0) + (h.explosiveTier || 0)) / 2);
        syncVisualEvolutionModel(G.heroMesh, heroTier, true);
      }
      (st.recruitedOrder || []).slice(0, 3).forEach(k => {
        const m = G.squadMeshes[k];
        const lvl = st.squad[k] ? st.squad[k].level : 0;
        if (m && lvl > 0) syncVisualEvolutionModel(m, lvl, false);
      });

      if (h.shieldHits && h.shieldHits > 0) {
        shieldBubbleMesh.visible = true;
        shieldBubbleMesh.position.set(h.x, 0.85, h.z);
        shieldBubbleMesh.rotation.y += dt * 2.5;
      } else {
        shieldBubbleMesh.visible = false;
      }

      // 4. Difficulty Max Wave HUD Sync (W40 / W60 / W80 / W100) & Wave Title Cards
      const diffCfg = DIFFICULTY_MODES[st.difficultyId] || DIFFICULTY_MODES.easy;
      const maxW = diffCfg.maxWave;
      const rawWave = 1 + Math.floor(st.elapsedTime / 15);
      st.wave = st.freeplayMode ? rawWave : Math.min(maxW, rawWave);

      const maxTimeSec = maxW * 15;
      const mins = String(Math.floor(st.elapsedTime / 60)).padStart(2, '0');
      const secs = String(Math.floor(st.elapsedTime % 60)).padStart(2, '0');
      const maxMins = String(Math.floor(maxTimeSec / 60)).padStart(2, '0');
      const timerEl = document.getElementById('hud-timer');
      if (timerEl) timerEl.textContent = st.freeplayMode ? `${mins}:${secs} • FREEPLAY` : `${mins}:${secs} / ${maxMins}:00`;

      const waveLbl = document.getElementById('hud-wave-label');
      if (waveLbl) {
        waveLbl.textContent = st.freeplayMode
          ? `WAVE ${st.wave} • ENDLESS FREEPLAY`
          : `WAVE ${st.wave}/${maxW} • ${diffCfg.name}`;
      }
      const waveLblMob = document.getElementById('hud-wave-label-mobile');
      if (waveLblMob) waveLblMob.textContent = st.freeplayMode ? `W${st.wave} ∞` : `W${st.wave}/${maxW}`;
      const progPct = Math.min(100, (st.elapsedTime / maxTimeSec) * 100);
      const progBar = document.getElementById('hud-wave-progress');
      if (progBar) progBar.style.width = `${progPct}%`;

      if (st.wave !== lastAnnouncedWave) {
        lastAnnouncedWave = st.wave;
        triggerWaveTitleCard(st.wave);
        if (window.__B13_BOSS_SCHEDULER) { /* Build 13 rotation owns W15-W45+ boss spawns */ }
        else if (st.wave === 30) G.spawnAirshipBoss('VORTEX');
        else if (st.wave === 45 || (st.wave === 40 && st.difficultyId !== 'easy')) G.spawnAirshipBoss('DREADBLOON');
        else if (st.wave === 60) G.spawnAirshipBoss('PHAYZE');
        else if (st.wave === 80 || st.wave === 100) G.spawnAirshipBoss('BLASTAPOPOULOS');
      }

      // Scale newly spawned bloons to current Wave HP
      const waveHpMult = window.__GET_WAVE_HP_MULT();
      if (waveHpMult > 1.05) {
        for (let i = 0; i < G.MAX_BLOONS; i++) {
          if (G.bloonActive[i] === 1 && G.bloonMaxHP[i] <= 20) {
            const bDef = G.BLOON_TYPES[G.bloonTypeKey[i]] || G.BLOON_TYPES.RED;
            const afMult = G.bloonAffix[i] === 3 ? 2 : 1;
            const targetMax = Math.ceil(bDef.hp * afMult * waveHpMult);
            if (G.bloonMaxHP[i] < targetMax) {
              G.bloonHP[i] = targetMax;
              G.bloonMaxHP[i] = targetMax;
            }
          }
        }
      }

      // 5. Boss Bar Overhead 3D Arrow & On-Screen Directional Pointer
      if (G.activeMOABs.length > 0) {
        const primaryBoss = G.activeMOABs[0];
        bossOverheadGroup.visible = true;
        bossOverheadGroup.position.set(primaryBoss.x, Math.sin(st.elapsedTime * 6) * 0.35, primaryBoss.z);
        bossOverheadGroup.rotation.y += dt * 3.0;

        const dx = primaryBoss.x - h.x;
        const dz = primaryBoss.z - h.z;
        const distM = Math.round(Math.hypot(dx, dz));
        const screenAngle = Math.atan2(dz, dx);
        const cx = window.innerWidth * 0.5 + Math.cos(screenAngle) * Math.min(220, window.innerWidth * 0.32);
        const cy = window.innerHeight * 0.5 + Math.sin(screenAngle) * Math.min(160, window.innerHeight * 0.28);

        bossPointerEl.style.display = 'inline-flex';
        bossPointerEl.style.left = `${cx}px`;
        bossPointerEl.style.top = `${cy}px`;
        document.getElementById('boss-ptr-arrow').style.transform = `rotate(${(screenAngle * 180) / Math.PI}deg)`;
        document.getElementById('boss-ptr-label').textContent = `${primaryBoss.blimpKey} (${distM}m)`;
      } else {
        bossOverheadGroup.visible = false;
        bossPointerEl.style.display = 'none';
      }

      window.__B13_CTX = 'hero';
      // 6. AUTHENTIC BTD6 HERO ATTACKS (CORVUS, SILAS, ROSALIA, GERALDO)
      // (A) CORVUS: Wireless Haunt + Independent Floating 3D Spirit Familiar (ZERO Bullets!)
      if (h.id === 'corvus') {
        corvusSpiritGroup.visible = true;
        spiritEcho.visible = (h.volleyTier || 0) >= 3;
        const spiritTarget = G.findNearestEnemy(spiritX || h.x, spiritZ || h.z, 34, true);
        const destX = spiritTarget ? spiritTarget.x : h.x + Math.cos(st.elapsedTime * 2.5) * 3.5;
        const destZ = spiritTarget ? spiritTarget.z : h.z + Math.sin(st.elapsedTime * 2.5) * 3.5;
        spiritX = THREE.MathUtils.lerp(spiritX || h.x, destX, Math.min(1, dt * 7.5));
        spiritZ = THREE.MathUtils.lerp(spiritZ || h.z, destZ, Math.min(1, dt * 7.5));
        corvusSpiritGroup.position.set(spiritX, Math.sin(st.elapsedTime * 5) * 0.2, spiritZ);
        corvusSpiritGroup.rotation.y += dt * 4.5;

        // Spirit Trample & Spirit Spear Slice
        spiritAttackTimer -= dt * (h.fireRate || 1.4);
        if (spiritAttackTimer <= 0 && spiritTarget) {
          spiritAttackTimer = 0.45;
          const trampleRadius = 2.8 + (h.volleyTier || 0) * 0.4;
          G.spawnComicPop(spiritX, 1.0, spiritZ, 0xa855f7, 1.4);
          G.spatialGrid.queryRadius(spiritX, spiritZ, trampleRadius, G.queryBuffer);
          const mult = spiritEcho.visible ? 2.0 : 1.2;
          for (let q = 0; q < Math.min(h.pierce + 4, G.queryBuffer.length); q++) {
            G.damageBloon(G.queryBuffer[q], h.damage * mult, true, true, 0, 0, 0.8, true);
          }
          if (spiritTarget.isMoab) {
            G.damageMOAB(spiritTarget.index, h.damage * 12 * mult, true);
          }
        }

        // Corvus Wireless Haunt Curse around his body (like Benjamin's wireless hack!)
        corvusHauntTimer -= dt * (h.fireRate || 1.3);
        if (corvusHauntTimer <= 0) {
          corvusHauntTimer = 0.85;
          const hauntRange = 11.0 + (h.weaponTier || 0) * 1.5;
          G.spatialGrid.queryRadius(h.x, h.z, hauntRange, G.queryBuffer);
          let haunted = 0;
          for (let q = 0; q < G.queryBuffer.length && haunted < (2 + (h.weaponTier || 0)); q++) {
            const bIdx = G.queryBuffer[q];
            if (G.bloonActive[bIdx] === 1) {
              haunted++;
              G.damageBloon(bIdx, h.damage * 1.5, true, true, 0, 0, 0.3, true);
              G.spawnComicPop(G.bloonX[bIdx], 1.1, G.bloonZ[bIdx], 0x9333ea, 1.15);
              G.spawnFloatingText(G.bloonX[bIdx], 1.6, G.bloonZ[bIdx], '<HAUNTED>', 'crit');
            }
          }
        }
      } else {
        corvusSpiritGroup.visible = false;
      }

      // (B) SILAS (BTD6 Ice Shaper): Passive Rime Slow Aura + Ricocheting 3D Crystalline Ice Shards!
      if (h.id === 'silas') {
        silasRimeRing.visible = true;
        const rimeRadius = 5.2 + (h.explosiveTier || 0) * 0.8;
        silasRimeRing.position.set(h.x, 0.04, h.z);
        silasRimeRing.scale.setScalar(rimeRadius / 4.4);

        // Passive Rime Aura slows & chills nearby bloons
        G.spatialGrid.queryRadius(h.x, h.z, rimeRadius, G.queryBuffer);
        for (let q = 0; q < G.queryBuffer.length; q++) {
          const bIdx = G.queryBuffer[q];
          G.bloonVX[bIdx] *= 0.85;
          G.bloonVZ[bIdx] *= 0.85;
        }

        // Single clean Ricochet Ice Shard attack (no duplicate Quincy arrows!)
        silasAttackTimer -= dt * (h.fireRate || 1.5);
        if (silasAttackTimer <= 0) {
          const target = G.findNearestEnemy(h.x, h.z, 22, true);
          if (target) {
            silasAttackTimer = 0.78;
            const aimA = Math.atan2(target.x - h.x, target.z - h.z);
            h.angle = aimA;
            const shards = Math.max(1, h.projectiles || 1);
            for (let s = 0; s < shards; s++) {
              const a = aimA + (s - (shards - 1) * 0.5) * 0.18;
              G.spawnProjectile({
                x: h.x + Math.sin(a) * 0.8, z: h.z + Math.cos(a) * 0.8,
                vx: Math.sin(a) * 23, vz: Math.cos(a) * 23,
                life: 1.15, pierce: h.pierce + 2, damage: h.damage * 1.35,
                scale: 1.25, colorHex: 0x38bdf8, canPopLead: true, isHoming: true
              });
            }
            // Freeze & shatter already-chilled bloons around target
            if (!target.isMoab && G.bloonActive[target.index] === 1) {
              if (G.bloonFreezeTimer[target.index] > 0) {
                G.spawnComicPop(target.x, 1.0, target.z, 0xe0f2fe, 1.8);
                G.damageBloon(target.index, h.damage * 2.5, true, true, 0, 0, 1.0, false);
              } else {
                G.bloonFreezeTimer[target.index] = 1.8;
              }
            }
          }
        }
      } else {
        silasRimeRing.visible = false;
      }

      // (C) ROSALIA: Jetpack Flight + Non-Distracting Thruster Fire & Smoke + Laser/Grenade Alternation!
      if (h.id === 'rosalia') {
        rosaliaSmokeTimer -= dt;
        if (rosaliaSmokeTimer <= 0) {
          rosaliaSmokeTimer = 0.065;
          spawnRosaliaJetpackExhaust(h.x, G.heroMesh ? G.heroMesh.position.y : 0.75, h.z, h.angle || 0);
        }
        rosaliaAttackTimer -= dt * (h.fireRate || 1.6);
        if (rosaliaAttackTimer <= 0) {
          const target = G.findNearestEnemy(h.x, h.z, 24, true);
          if (target) {
            rosaliaAttackTimer = 0.65;
            const aimA = Math.atan2(target.x - h.x, target.z - h.z);
            h.angle = aimA;
            h.shotCounter = (h.shotCounter || 0) + 1;
            const isGrenade = (h.shotCounter % 3 === 0);
            const count = Math.max(1, h.projectiles || 1);
            for (let i = 0; i < count; i++) {
              const a = aimA + (i - (count - 1) * 0.5) * 0.16;
              G.spawnProjectile({
                x: h.x + Math.sin(a) * 0.8, z: h.z + Math.cos(a) * 0.8,
                vx: Math.sin(a) * (isGrenade ? 19 : 26), vz: Math.cos(a) * (isGrenade ? 19 : 26),
                life: 1.05, pierce: h.pierce + 1, damage: h.damage * (isGrenade ? 2.2 : 1.2),
                scale: isGrenade ? 1.35 : 1.05,
                colorHex: isGrenade ? 0xf97316 : 0xf43f5e,
                canPopLead: true, explosive: isGrenade
              });
            }
          }
        }
      }

      // Update Rosalia Jetpack Fire & Smoke Particles
      for (let i = rosaliaParticles.length - 1; i >= 0; i--) {
        const pt = rosaliaParticles[i];
        pt.life -= dt;
        if (pt.life <= 0) {
          G.scene.remove(pt.mesh);
          pt.mesh.geometry.dispose();
          pt.mesh.material.dispose();
          rosaliaParticles.splice(i, 1);
          continue;
        }
        pt.mesh.position.y += pt.vy * dt;
        const ratio = pt.life / pt.maxLife;
        pt.mesh.scale.setScalar(pt.isFlame ? ratio : 1 + (1 - ratio) * 0.8);
        pt.mesh.material.opacity = ratio * (pt.isFlame ? 0.75 : 0.35);
      }

      // (D) GERALDO: Mystic Lightning Flasks & Autonomous Turret Bolts
      if (h.id === 'geraldo') {
        geraldoAttackTimer -= dt * (h.fireRate || 1.45);
        if (geraldoAttackTimer <= 0) {
          const target = G.findNearestEnemy(h.x, h.z, 22, true);
          if (target) {
            geraldoAttackTimer = 0.72;
            const aimA = Math.atan2(target.x - h.x, target.z - h.z);
            h.angle = aimA;
            const count = Math.max(1, h.projectiles || 1);
            for (let i = 0; i < count; i++) {
              const a = aimA + (i - (count - 1) * 0.5) * 0.18;
              G.spawnProjectile({
                x: h.x + Math.sin(a) * 0.8, z: h.z + Math.cos(a) * 0.8,
                vx: Math.sin(a) * 21, vz: Math.cos(a) * 21,
                life: 1.1, pierce: h.pierce + 1, damage: h.damage * 1.35,
                scale: 1.2, colorHex: 0x22d3ee, canPopLead: true, explosive: (i === 0)
              });
            }
          }
        }
      }

      window.__B13_CTX = null;
      // 7. Spawn & Update Far-Spaced In-World 3D Pickups (65m-110m apart!)
      pickupSpawnTimer -= dt;
      if (pickupSpawnTimer <= 0) {
        pickupSpawnTimer = 11.0;
        trySpawnFarSpacedPickup(h.x, h.z);
      }

      for (let i = activeWorldPickups.length - 1; i >= 0; i--) {
        const pk = activeWorldPickups[i];
        pk.life -= dt;
        pk.mesh.rotation.y += dt * 2.2;
        const dHero = Math.hypot(pk.x - h.x, pk.z - h.z);

        if (pk.life <= 0) {
          G.scene.remove(pk.mesh);
          activeWorldPickups.splice(i, 1);
          continue;
        }

        if (dHero < 1.65) {
          G.soundFX.playBlopOrbChime(2);
          if (pk.type === 'banana') {
            h.hp = Math.min(h.maxHp, h.hp + Math.ceil(h.maxHp / 5));
            G.persistentStats.monkeyMoney += 15;
            G.savePersistentStats();
            G.spawnFloatingText(pk.x, 1.5, pk.z, '+1 HEART & +$15 BANANA!', 'heal');
          } else if (pk.type === 'crate') {
            G.persistentStats.monkeyMoney += 35;
            h.xp += Math.ceil(h.xpToNext * 0.35);
            G.savePersistentStats();
            G.spawnFloatingText(pk.x, 1.5, pk.z, 'SUPPLY CRATE! +$35 & XP!', 'heal');
          } else if (pk.type === 'barrel') {
            G.soundFX.playExplosion(1.4);
            G.spawnExplosionVFX(pk.x, pk.z, 7.5);
            G.spatialGrid.queryRadius(pk.x, pk.z, 7.5, G.queryBuffer);
            for (let q = 0; q < G.queryBuffer.length; q++) {
              G.damageBloon(G.queryBuffer[q], h.damage * 8 + 10, true, true, 0, 0, 4.0, false);
            }
            G.spawnFloatingText(pk.x, 1.8, pk.z, 'DYNAMITE BARREL BOOM!', 'crit');
          } else if (pk.type === 'magnet') {
            for (let b = 0; b < G.MAX_BLOPS; b++) {
              if (G.blopActive[b] === 1) {
                G.blopX[b] = h.x + (Math.random() - 0.5) * 0.5;
                G.blopZ[b] = h.z + (Math.random() - 0.5) * 0.5;
              }
            }
            G.spawnFloatingText(pk.x, 1.5, pk.z, 'MAGNET VACUUM!', 'heal');
          } else if (pk.type === 'shield') {
            h.shieldHits = Math.min(5, (h.shieldHits || 0) + 2);
            G.spawnFloatingText(pk.x, 1.5, pk.z, `SHIELD CORE! (🛡️ x${h.shieldHits})`, 'heal');
          }
          G.scene.remove(pk.mesh);
          activeWorldPickups.splice(i, 1);
          G.updateHUD();
        }
      }
    };

    console.log("Update 12.2 Master Engine Active!");
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootUpdate12);
  } else {
    bootUpdate12();
  }
})();


// ============================================================================
// BLOONS BLITZ 3D — VISUAL CLEANUP & COMPENDIUM OVERHAUL PASS
// ============================================================================
(function initVisualCleanupPass() {
  'use strict';

  function bootPolish() {
    const G = window.__GAME;
    if (!G || !G.scene || !G.gameState) {
      setTimeout(bootPolish, 60);
      return;
    }

    // 1. Add Ground Drop Shadows to Hero & All 14 Companions
    function attachDropShadow(mesh, radius = 0.62) {
      if (!mesh || mesh.userData.hasDropShadow) return;
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 18).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x071202, transparent: true, opacity: 0.45, depthWrite: false })
      );
      shadow.position.y = 0.02;
      mesh.add(shadow);
      mesh.userData.hasDropShadow = true;
    }

    setInterval(() => {
      if (G.heroMesh) attachDropShadow(G.heroMesh, 0.68);
      if (G.squadMeshes) {
        Object.values(G.squadMeshes).forEach(m => attachDropShadow(m, 0.56));
      }
    }, 500);

    // 2. Overhaul #my-build-modal: Real 3D Portraits (Zero Trophy Placeholders) + 2-Tab Compendium
    function renderEnhancedMyBuildModal(activeTab = 'build') {
      const modal = document.getElementById('my-build-modal');
      if (!modal) return;
      const panel = modal.querySelector('.btd-panel');
      if (!panel) return;

      const st = G.gameState;
      const h = st.hero;
      const cfg = G.HERO_CONFIGS[h.id] || G.HERO_CONFIGS.quincy;
      const getSnap = (key) => {
        const imgEl = document.querySelector(`.hero-card[data-hero="${key}"] img`);
        if (imgEl && imgEl.src) return imgEl.src;
        return '';
      };

      // Inject 2-Tab Navigation Header if not present
      let tabBar = document.getElementById('u12-build-tabs');
      if (!tabBar) {
        tabBar = document.createElement('div');
        tabBar.id = 'u12-build-tabs';
        tabBar.className = 'flex items-center gap-2 mb-3';
        const headerRow = panel.firstElementChild;
        panel.insertBefore(tabBar, headerRow.nextSibling);

        const compendiumView = document.createElement('div');
        compendiumView.id = 'u12-compendium-view';
        compendiumView.className = 'hidden flex-col gap-2.5 max-h-[62vh] overflow-y-auto pr-1 mb-4';
        panel.insertBefore(compendiumView, document.getElementById('btn-resume-from-build'));
      }

      tabBar.innerHTML = `
        <button id="tab-btn-current-build" class="flex-1 py-2 rounded-xl font-btd text-xs sm:text-sm text-white cursor-pointer transition ${activeTab === 'build' ? 'btd-btn-gold' : 'bg-stone-800 border-2 border-black text-stone-300'}">
          🛡️ CURRENT RUN BUILD (MAX 3 SQUAD)
        </button>
        <button id="tab-btn-tree-compendium" class="flex-1 py-2 rounded-xl font-btd text-xs sm:text-sm text-white cursor-pointer transition ${activeTab === 'tree' ? 'btd-btn-gold' : 'bg-stone-800 border-2 border-black text-stone-300'}">
          🌳 UPGRADE TREES (ALL 24)
        </button>
      `;

      const heroCard = document.getElementById('my-build-hero-card');
      const squadGrid = document.getElementById('my-build-squad-grid');
      const statsGrid = document.getElementById('my-build-stats-grid');
      const compView = document.getElementById('u12-compendium-view');
      const sectionHeaders = panel.querySelectorAll('h3');

      if (activeTab === 'build') {
        heroCard.classList.remove('hidden');
        squadGrid.classList.remove('hidden');
        statsGrid.classList.remove('hidden');
        sectionHeaders.forEach(sh => sh.classList.remove('hidden'));
        compView.classList.add('hidden');

        const heroPortrait = getSnap(h.id);
        heroCard.innerHTML = `
          <div class="w-16 h-16 rounded-2xl bg-black/60 border-2 border-amber-400 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
            ${heroPortrait ? `<img src="${heroPortrait}" class="w-full h-full object-contain">` : `<span class="text-3xl">${cfg.skillIcon || '👑'}</span>`}
          </div>
          <div class="flex-1 flex flex-col text-left">
            <div class="flex items-center gap-2">
              <h3 class="font-btd text-xl text-yellow-300">${cfg.name}</h3>
              <span class="px-2.5 py-0.5 rounded-full bg-purple-600 border border-black font-btd-sm text-xs text-white">LVL ${h.level}</span>
            </div>
            <span class="text-xs font-bold text-amber-200 mb-1.5">${cfg.title}</span>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-stone-200 font-bold">
              <div>❤️ HP: <strong class="text-emerald-400">${Math.round(h.hp)}/${h.maxHp}</strong></div>
              <div>⚔️ DMG: <strong class="text-amber-300">${(h.damage * (window.__b13HeroPow ? window.__b13HeroPow() : 1)).toFixed(1)}</strong></div>
              <div>🏹 RATE: <strong class="text-cyan-300">${h.fireRate.toFixed(2)}/s</strong></div>
              <div>🎯 PIERCE: <strong class="text-indigo-300">${h.pierce}</strong></div>
            </div>
            <div class="mt-2 text-[10px] font-extrabold text-cyan-200">
              ${window.__b13HeroPathLine ? window.__b13HeroPathLine() : ('T' + (h.volleyTier || 0) + '-' + (h.weaponTier || 0) + '-' + (h.explosiveTier || 0))}
            </div>
          </div>
        `;

        const recruited = (st.recruitedOrder || []).slice(0, 3);
        const countEl = document.getElementById('my-build-squad-count');
        if (countEl) countEl.textContent = `(${recruited.length}/3 Slots Max)`;

        squadGrid.innerHTML = '';
        for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
          const key = recruited[slotIdx];
          const card = document.createElement('div');
          if (key && st.squad[key] && st.squad[key].level > 0) {
            const comp = G.COMPANION_CATALOG.find(c => c.key === key);
            const lvl = st.squad[key].level;
            const slotImg = document.querySelector(`#active-slot-${slotIdx} img`);
            const imgSrc = slotImg ? slotImg.src : '';
            card.className = 'p-3 rounded-2xl bg-stone-900/95 border-2 border-cyan-400/60 flex flex-col items-center text-center shadow-md';
            card.innerHTML = `
              <div class="w-14 h-14 rounded-2xl bg-black/50 border-2 border-amber-400/50 flex items-center justify-center mb-1.5 overflow-hidden">
                ${imgSrc ? `<img src="${imgSrc}" class="w-full h-full object-contain">` : `<span class="text-2xl">${comp ? comp.icon : '🐒'}</span>`}
              </div>
              <h4 class="font-btd text-sm text-yellow-300">${comp ? comp.shortName : key.toUpperCase()}</h4>
              <span class="px-2.5 py-0.5 rounded-full bg-cyan-600 border border-black font-btd-sm text-[10px] text-white my-1">${window.__b13UnitSummary ? window.__b13UnitSummary(key).code : 'TIER ' + lvl}</span>
              <span class="text-[10px] text-stone-200 font-bold">${window.__b13UnitSummary ? window.__b13UnitSummary(key).name : ''}</span>
            `;
          } else {
            card.className = 'p-3 rounded-2xl bg-stone-900/50 border-2 border-stone-700/60 flex flex-col items-center justify-center text-center opacity-60 min-h-[130px]';
            card.innerHTML = `
              <span class="text-2xl text-stone-400 mb-1">➕</span>
              <span class="font-btd text-xs text-stone-400">EMPTY SLOT ${slotIdx + 1}</span>
              <span class="text-[10px] text-stone-500 font-bold mt-0.5">Level up to recruit</span>
            `;
          }
          squadGrid.appendChild(card);
        }
      } else {
        heroCard.classList.add('hidden');
        squadGrid.classList.add('hidden');
        statsGrid.classList.add('hidden');
        sectionHeaders.forEach(sh => sh.classList.add('hidden'));
        compView.classList.remove('hidden');
        compView.classList.add('flex');

        compView.innerHTML = window.__b13CompendiumHTML ? window.__b13CompendiumHTML() : '';
      }

      document.getElementById('tab-btn-current-build').onclick = () => renderEnhancedMyBuildModal('build');
      document.getElementById('tab-btn-tree-compendium').onclick = () => renderEnhancedMyBuildModal('tree');
    }

    const hudBuildBtn = document.getElementById('btn-hud-build');
    if (hudBuildBtn) {
      hudBuildBtn.addEventListener('click', () => setTimeout(() => renderEnhancedMyBuildModal('build'), 20));
    }
    const setBuildBtn = document.getElementById('btn-settings-my-build');
    if (setBuildBtn) {
      setBuildBtn.addEventListener('click', () => setTimeout(() => renderEnhancedMyBuildModal('build'), 20));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPolish);
  } else {
    bootPolish();
  }
})();


// ============================================================================

// ============================================================================



// BLOONS BLITZ 3D — STATIC WORLD GROUND, 2x MONKEY/HERO SCALE, 1.5x BLOONS,
// OFF-SCREEN BLOON SPAWNS, IN-CAMERA BOSS ENTRANCE ANIMATION & INTRICATE 3D SCENERY
(function initStaticGroundAndHeroModal() {
  'use strict';

  function bootStaticGroundAndMenu() {
    const G = window.__GAME;
    if (!G || !G.scene || !G.gameState) {
      setTimeout(bootStaticGroundAndMenu, 50);
      return;
    }

    // ------------------------------------------------------------------------
    // 1. COMFORTABLE CAMERA ZOOM
    // ------------------------------------------------------------------------
    function enforceComfortableZoom() {
      if (!G.camera || !G.renderer) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      G.camera.aspect = w / h;
      if (w < h) {
        const aspectFactor = Math.max(1.0, (0.62 / Math.max(0.38, G.camera.aspect)));
        G.camera.fov = 54;
        if (G.cameraOffset) {
          G.cameraOffset.set(0, 42 * aspectFactor, 30 * aspectFactor);
        }
      } else {
        G.camera.fov = 46;
        if (G.cameraOffset) {
          G.cameraOffset.set(0, 34, 24);
        }
      }
      G.camera.updateProjectionMatrix();
    }
    enforceComfortableZoom();
    window.addEventListener('resize', enforceComfortableZoom);

    // ------------------------------------------------------------------------
    // 2. INTRICATE 3D BLOONS BLITZ WORLD SCENERY (MATCHING unnamed.jpg!)
    //    Replaces all simple tan discs & cubes with multi-part 3D landmarks
    //    spread across a wide 160m arena (wraps only at > 78m off-camera!)
    // ------------------------------------------------------------------------
    const sceneryItems = [];
    let sceneryBuilt = false;

    function createRuneTexture(symbol) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#7c8087';
      ctx.fillRect(0, 0, 128, 128);
      // Chiseled stone border & cracks
      ctx.strokeStyle = '#4b4e54';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 116, 116);
      ctx.strokeStyle = '#383a3f';
      ctx.lineWidth = 4;
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#3f3024';
      ctx.fillText(symbol || 'Δ ❖ ᛁ', 64, 64);
      return new THREE.CanvasTexture(c);
    }

    function buildIntricateWorldScenery() {
      if (sceneryBuilt) return;
      sceneryBuilt = true;

      // Hide all old simple tan discs, cylinders, and basic boxes in envPropsGroup / scene
      if (G.envPropsGroup) {
        G.envPropsGroup.visible = false;
      }

      const stoneLight = new THREE.MeshStandardMaterial({ color: 0x92969e, roughness: 0.82, flatShading: true });
      const stoneMid   = new THREE.MeshStandardMaterial({ color: 0x767a82, roughness: 0.86, flatShading: true });
      const stoneDark  = new THREE.MeshStandardMaterial({ color: 0x585b62, roughness: 0.90, flatShading: true });
      const runeMat    = new THREE.MeshStandardMaterial({ map: createRuneTexture('Δ ᛁ ❖'), roughness: 0.85 });
      const dirtMat    = new THREE.MeshStandardMaterial({ color: 0x5c4028, roughness: 0.95, flatShading: true });
      const ropeMat    = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9, flatShading: true });
      const flagRedMat = new THREE.MeshStandardMaterial({ color: 0xd94826, roughness: 0.6, side: THREE.DoubleSide });
      const flagGoldMat= new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6, side: THREE.DoubleSide });
      const fernDark   = new THREE.MeshStandardMaterial({ color: 0x2d6a1e, roughness: 0.75, flatShading: true });
      const fernLight  = new THREE.MeshStandardMaterial({ color: 0x438a29, roughness: 0.72, flatShading: true });
      const cobbleMat  = new THREE.MeshStandardMaterial({ color: 0xa19d93, roughness: 0.85, flatShading: true });

      // A. Center Ancient Sunken Stone Well / Shrine Ring (Matches center of unnamed.jpg!)
      const centerWell = new THREE.Group();
      const numBlocks = 10;
      for (let i = 0; i < numBlocks; i++) {
        const a = (i / numBlocks) * Math.PI * 2;
        const r = 3.2;
        const blk = new THREE.Mesh(
          new THREE.BoxGeometry(1.85, 0.42 + (i % 2) * 0.12, 1.15),
          i % 2 === 0 ? stoneLight : stoneMid
        );
        blk.position.set(Math.cos(a) * r, 0.21, Math.sin(a) * r);
        blk.rotation.set((i % 3 - 1) * 0.04, -a + Math.PI / 2, 0);
        centerWell.add(blk);

        // Inner recessed rim block
        const innerBlk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.65), stoneDark);
        innerBlk.position.set(Math.cos(a) * 2.25, 0.11, Math.sin(a) * 2.25);
        innerBlk.rotation.y = -a + Math.PI / 2;
        centerWell.add(innerBlk);
      }
      // Subtle recessed stone floor inside the shrine ring
      const wellFloor = new THREE.Mesh(
        new THREE.CircleGeometry(2.3, 16).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x52565e, transparent: true, opacity: 0.65 })
      );
      wellFloor.position.y = 0.02;
      centerWell.add(wellFloor);
      centerWell.position.set(0, 0, 0);
      G.scene.add(centerWell);

      // Helper builders for the 4 intricate prop types
      function makeCarvedRuneMonolith() {
        const grp = new THREE.Group();
        // Earth mound base
        const mound = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 0.24, 8), dirtMat);
        mound.position.y = 0.12;
        grp.add(mound);

        // Main chiseled slanted stone obelisk (3 tapered tiers + rune face)
        const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 1.25), stoneDark);
        baseBlock.position.set(0, 0.62, 0);
        baseBlock.rotation.set(0.08, 0.15, -0.06);
        grp.add(baseBlock);

        const midBlock = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.35, 1.05), runeMat);
        midBlock.position.set(-0.06, 1.55, 0.04);
        midBlock.rotation.set(0.10, 0.12, -0.08);
        grp.add(midBlock);

        const topCap = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.85, 4), stoneLight);
        topCap.position.set(-0.12, 2.52, 0.08);
        topCap.rotation.set(0.10, Math.PI / 4 + 0.12, -0.08);
        grp.add(topCap);

        // 3D Rope Binding + Hanging Triangular Pennant Flags (Matches unnamed.jpg!)
        const ropeRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.07, 6, 16).rotateX(Math.PI / 2), ropeMat);
        ropeRing.position.set(-0.05, 1.75, 0.04);
        ropeRing.rotation.z = -0.08;
        grp.add(ropeRing);

        for (let f = 0; f < 4; f++) {
          const fa = (f / 4) * Math.PI * 2 + 0.4;
          const pennant = new THREE.Mesh(
            new THREE.ConeGeometry(0.16, 0.42, 3).rotateX(Math.PI),
            f % 2 === 0 ? flagRedMat : flagGoldMat
          );
          pennant.position.set(Math.cos(fa) * 0.82, 1.52, Math.sin(fa) * 0.82);
          grp.add(pennant);
        }

        // Flanking mossy side rock + 4 cobble stepping stones
        const sideRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 0), stoneMid);
        sideRock.scale.set(1.2, 0.75, 0.95);
        sideRock.position.set(1.25, 0.35, 0.45);
        grp.add(sideRock);

        for (let c = 0; c < 4; c++) {
          const stn = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.12, 7), cobbleMat);
          stn.position.set(-1.2 - c * 0.65, 0.06, 0.6 + Math.sin(c) * 0.45);
          stn.rotation.y = c * 0.8;
          grp.add(stn);
        }
        return grp;
      }

      function makeSpikyFernRosetteCluster() {
        const grp = new THREE.Group();
        // 14 layered spiky fern/agave blades radiating out (Matches unnamed.jpg top-right!)
        for (let i = 0; i < 14; i++) {
          const tier = i < 8 ? 0 : 1;
          const a = (i / (tier === 0 ? 8 : 6)) * Math.PI * 2 + tier * 0.4;
          const blade = new THREE.Mesh(
            new THREE.ConeGeometry(0.28, tier === 0 ? 1.45 : 1.15, 4),
            i % 2 === 0 ? fernDark : fernLight
          );
          blade.scale.set(1.0, 1.0, 0.35);
          const tilt = tier === 0 ? 0.92 : 0.52;
          blade.position.set(Math.cos(a) * 0.55, 0.42, Math.sin(a) * 0.55);
          blade.rotation.order = 'YXZ';
          blade.rotation.y = a;
          blade.rotation.x = tilt;
          grp.add(blade);
        }
        // Accent boulders & flowers at base
        for (let r = 0; r < 3; r++) {
          const ra = (r / 3) * Math.PI * 2;
          const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), cobbleMat);
          pebble.scale.set(1.1, 0.55, 0.9);
          pebble.position.set(Math.cos(ra) * 0.95, 0.16, Math.sin(ra) * 0.95);
          grp.add(pebble);
        }
        return grp;
      }

      function makeCobbleTrailAndRuins() {
        const grp = new THREE.Group();
        // Fallen carved stone block with rope + curved trail of 6 stepping stones (Matches unnamed.jpg!)
        const fallen = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.72, 0.95), runeMat);
        fallen.position.set(0, 0.36, 0);
        fallen.rotation.set(0.05, 0.4, 0.12);
        grp.add(fallen);

        const rope = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 1.02), ropeMat);
        rope.position.set(0.2, 0.37, 0);
        rope.rotation.set(0.05, 0.4, 0.12);
        grp.add(rope);

        for (let s = 1; s <= 6; s++) {
          const cobble = new THREE.Mesh(
            new THREE.CylinderGeometry(0.34 + (s % 2) * 0.08, 0.40, 0.10, 7),
            s % 2 === 0 ? cobbleMat : stoneLight
          );
          cobble.position.set(s * 0.88, 0.05, Math.sin(s * 0.75) * 0.65);
          cobble.rotation.y = s * 1.1;
          grp.add(cobble);
        }
        return grp;
      }

      // Spawn 56 intricate 3D landmarks across a wide 150m diameter so wrap (> 78m) is 100% off-camera!
      for (let i = 0; i < 56; i++) {
        const ring = Math.floor(i / 14); // 4 concentric rings from r=14m out to r=72m
        const a = ((i % 14) / 14) * Math.PI * 2 + ring * 0.35;
        const r = 14 + ring * 17.5 + (i % 3) * 3.2;

        let prop;
        if (i % 3 === 0) prop = makeCarvedRuneMonolith();
        else if (i % 3 === 1) prop = makeSpikyFernRosetteCluster();
        else prop = makeCobbleTrailAndRuins();

        prop.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        prop.rotation.y = (i * 1.7) % (Math.PI * 2);
        G.scene.add(prop);
        sceneryItems.push(prop);
      }
    }
    buildIntricateWorldScenery();

    // ------------------------------------------------------------------------
    // 3. LOCK GROUND AT (0,0,0) WITH CRISP 72x72 TEXTURE SCALE
    // ------------------------------------------------------------------------
    function lockStaticWorldGround() {
      const mesh = G.meadowMesh;
      if (!mesh) return;
      const mat = mesh.material;
      const tex = mat ? mat.map : null;

      mesh.scale.set(4, 4, 1);
      mesh.position.set(0, 0, 0);

      if (mat && mat.color && (!G.gameState.stageId || G.gameState.stageId === 'meadow')) {
        mat.color.setHex(0xb5d69c);
      }

      if (tex) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        if (tex.repeat.x !== 72 || tex.repeat.y !== 72) {
          tex.repeat.set(72, 72);
          tex.needsUpdate = true;
        }
        tex.offset.x = 0;
        tex.offset.y = 0;
        tex.offset.set = function() { this.x = 0; this.y = 0; return this; };
      }

      if (G.envPropsGroup) {
        G.envPropsGroup.visible = false;
      }
    }
    lockStaticWorldGround();

    // ------------------------------------------------------------------------
    // 4. DEDICATED HERO MODAL + 1-SCREEN MOBILE MAIN MENU
    // ------------------------------------------------------------------------
    function setupDedicatedHeroPickerModal() {
      const firstMapCard = document.querySelector('.map-card');
      if (firstMapCard && firstMapCard.parentElement) {
        firstMapCard.parentElement.classList.add('mobile-stage-grid-3col');
      }

      const firstHeroCard = document.querySelector('.hero-card');
      const heroGrid = firstHeroCard ? firstHeroCard.parentElement : null;
      if (!heroGrid || document.getElementById('hero-picker-modal')) return;

      const spotlightBar = document.createElement('div');
      spotlightBar.id = 'active-hero-spotlight-bar';
      spotlightBar.innerHTML = `
        <div class="flex items-center gap-3 text-left min-w-0">
          <div id="spotlight-hero-portrait" class="hero-3d-portrait !w-12 !h-12 !min-w-[48px] !min-h-[48px] !m-0"></div>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 uppercase">ACTIVE HERO</span>
              <span id="spotlight-hero-star" class="hero-star-badge">★1</span>
            </div>
            <h3 id="spotlight-hero-name" class="font-btd text-base sm:text-xl text-yellow-300 truncate leading-tight mt-0.5">QUINCY</h3>
            <p id="spotlight-hero-desc" class="text-[10px] text-amber-100/90 font-bold truncate">Tap to switch or upgrade Heroes</p>
          </div>
        </div>
        <button id="btn-open-hero-picker" type="button" class="btd-btn-gold py-2 px-3 rounded-xl font-btd text-xs sm:text-sm text-white shrink-0 cursor-pointer shadow-lg">
          🐒 HEROES (10)
        </button>
      `;

      heroGrid.parentNode.insertBefore(spotlightBar, heroGrid);

      const pickerModal = document.createElement('div');
      pickerModal.id = 'hero-picker-modal';
      pickerModal.innerHTML = `
        <div class="btd-panel rounded-3xl p-4 sm:p-5 max-w-4xl w-full max-h-[90dvh] flex flex-col items-center text-center shadow-2xl overflow-hidden">
          <div class="w-full flex items-center justify-between border-b-2 border-amber-900/60 pb-2.5 mb-3">
            <div class="flex flex-col text-left">
              <h2 class="font-btd text-xl sm:text-2xl text-yellow-300">🐒 SELECT & UPGRADE YOUR HERO (10)</h2>
              <span class="text-[11px] font-bold text-amber-200/90">Tap any Hero to equip, unlock with Monkey Money, or upgrade ★ Star Rank!</span>
            </div>
            <button id="btn-close-hero-picker-top" type="button" class="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 border-2 border-black font-btd text-base text-white cursor-pointer">✕</button>
          </div>
          <div id="hero-picker-grid-host" class="w-full overflow-y-auto pr-1 flex-1" style="-webkit-overflow-scrolling: touch;"></div>
          <button id="btn-confirm-hero-picker" type="button" class="w-full mt-3 py-2.5 rounded-2xl btd-btn-green font-btd text-lg text-white tracking-wider cursor-pointer">
            ✓ CONFIRM SELECTED HERO
          </button>
        </div>
      `;
      document.body.appendChild(pickerModal);
      pickerModal.querySelector('#hero-picker-grid-host').appendChild(heroGrid);

      function syncActiveHeroSpotlight() {
        const curId = G.selectedHeroId || 'quincy';
        const cfg = (G.HERO_CONFIGS && G.HERO_CONFIGS[curId]) || { name: curId.toUpperCase(), title: 'Monkey Hero' };
        const selectedCard = heroGrid.querySelector(`.hero-card[data-hero="${curId}"]`);
        const nameEl = document.getElementById('spotlight-hero-name');
        const descEl = document.getElementById('spotlight-hero-desc');
        const portEl = document.getElementById('spotlight-hero-portrait');
        const starEl = document.getElementById('spotlight-hero-star');

        if (nameEl) nameEl.textContent = cfg.name || curId.toUpperCase();
        if (descEl) {
          const p = selectedCard ? selectedCard.querySelector('p') : null;
          descEl.textContent = p ? p.textContent : (cfg.title || 'Ready for battle!');
        }
        if (portEl && selectedCard) {
          const img = selectedCard.querySelector('.hero-3d-portrait img');
          if (img && img.src) {
            portEl.innerHTML = `<img src="${img.src}" alt="${curId}" class="w-full h-full object-contain">`;
          }
        }
        if (starEl && G.persistentStats && G.persistentStats.heroMastery) {
          const sLvl = G.persistentStats.heroMastery[curId] || 1;
          starEl.textContent = `★${sLvl} (+${(sLvl - 1) * 10}% DMG)`;
        }
      }

      const openPicker = () => {
        if (G.soundFX) G.soundFX.playBlopOrbChime(1);
        pickerModal.classList.add('open');
        syncActiveHeroSpotlight();
      };
      const closePicker = () => {
        if (G.soundFX) G.soundFX.playBlopOrbChime(2);
        pickerModal.classList.remove('open');
        syncActiveHeroSpotlight();
      };

      spotlightBar.addEventListener('click', openPicker);
      pickerModal.querySelector('#btn-close-hero-picker-top').addEventListener('click', closePicker);
      pickerModal.querySelector('#btn-confirm-hero-picker').addEventListener('click', closePicker);
      heroGrid.addEventListener('click', () => setTimeout(syncActiveHeroSpotlight, 60));

      setTimeout(syncActiveHeroSpotlight, 200);
      setInterval(syncActiveHeroSpotlight, 700);
    }
    setupDedicatedHeroPickerModal();

    // ------------------------------------------------------------------------
    // 5. 2x HERO FOOT RING, SHIELD ICON, BOSS SPAWN PORTAL & BEAST ANIMALS
    // ------------------------------------------------------------------------
    const heroWhiteRing = new THREE.Mesh(
      new THREE.RingGeometry(1.18, 1.42, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.90 })
    );
    heroWhiteRing.position.y = 0.03;
    G.scene.add(heroWhiteRing);

    // Boss Spawn Portal Reticle & Shockwave Ring (for in-camera Boss Entrance Animation!)
    const bossPortalGroup = new THREE.Group();
    const portalOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.1, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    const portalInnerRing = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.55, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    const portalShadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x1e0538, transparent: true, opacity: 0.55 })
    );
    portalShadowDisc.position.y = 0.02;
    portalOuterRing.position.y = 0.04;
    portalInnerRing.position.y = 0.05;
    bossPortalGroup.add(portalShadowDisc, portalOuterRing, portalInnerRing);
    bossPortalGroup.visible = false;
    G.scene.add(bossPortalGroup);

    const feetHud = document.getElementById('hero-feet-hud');
    if (feetHud && !document.getElementById('hero-feet-shield-icon')) {
      const hpBarRow = feetHud.firstElementChild;
      if (hpBarRow) {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center justify-center';
        hpBarRow.parentNode.insertBefore(wrapper, hpBarRow);
        wrapper.appendChild(hpBarRow);
        const shieldBadge = document.createElement('div');
        shieldBadge.id = 'hero-feet-shield-icon';
        shieldBadge.textContent = '+';
        wrapper.appendChild(shieldBadge);
      }
    }

    function create3DRaptorMesh() {
      const grp = new THREE.Group();
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.45 });
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), skinMat);
      body.scale.set(0.85, 0.85, 1.45);
      body.position.set(0, 0.48, 0);
      grp.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.48), skinMat);
      head.position.set(0, 0.72, 0.36);
      grp.add(head);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.36), stripeMat);
      crest.position.set(0, 0.88, 0.32);
      grp.add(crest);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.75, 10).rotateX(-Math.PI / 2), stripeMat);
      tail.position.set(0, 0.48, -0.58);
      grp.add(tail);
      grp.scale.setScalar(2.0);
      return grp;
    }

    function create3DFalconMesh() {
      const grp = new THREE.Group();
      const featherMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.65, 10).rotateX(Math.PI / 2), featherMat);
      grp.add(body);
      const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.04, 0.28), featherMat);
      leftWing.position.set(-0.42, 0.04, 0);
      grp.add(leftWing);
      const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.04, 0.28), featherMat);
      rightWing.position.set(0.42, 0.04, 0);
      grp.add(rightWing);
      grp.userData = { leftWing, rightWing };
      grp.scale.setScalar(2.0);
      return grp;
    }

    function create3DMegalodonMesh() {
      const grp = new THREE.Group();
      const sharkMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.3 });
      const waterRing = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.78, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
      );
      waterRing.position.y = 0.05;
      grp.add(waterRing);
      const snout = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.85, 12), sharkMat);
      snout.position.y = 0.35;
      grp.add(snout);
      grp.scale.setScalar(2.0);
      return grp;
    }

    const raptorMesh = create3DRaptorMesh();
    const falconMesh = create3DFalconMesh();
    const sharkMesh = create3DMegalodonMesh();
    raptorMesh.visible = false;
    falconMesh.visible = false;
    sharkMesh.visible = false;
    G.scene.add(raptorMesh);
    G.scene.add(falconMesh);
    G.scene.add(sharkMesh);

    let raptorX = 0, raptorZ = 0, falconAngle = 0, sharkX = 0, sharkZ = 0;

    // ------------------------------------------------------------------------
    // 6. INTERCEPT spawnBloon SO FRESH WAVE BLOONS ALWAYS SPAWN OFF-CAMERA
    // ------------------------------------------------------------------------
    if (typeof G.spawnBloon === 'function' && !G._spawnBloonOffscreenPatched) {
      G._spawnBloonOffscreenPatched = true;
      const origSpawnBloon = G.spawnBloon;
      G.spawnBloon = function(typeKey, x, z, vx = 0, vz = 0, affix = 0, parentType = null) {
        const h = G.gameState && G.gameState.hero;
        // If this is a fresh wave spawn (no parentType split & no burst velocity), push outside camera (>45m)!
        if (h && !parentType && vx === 0 && vz === 0) {
          const dx = x - h.x;
          const dz = z - h.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 44.0) {
            const ang = Math.atan2(dz, dx);
            const safeDist = 46.0 + Math.random() * 10.0;
            x = h.x + Math.cos(ang) * safeDist;
            z = h.z + Math.sin(ang) * safeDist;
          }
        }
        return origSpawnBloon(typeKey, x, z, vx, vz, affix, parentType);
      };
    }

    // ------------------------------------------------------------------------
    // 7. MAIN PER-FRAME HOOK: 2x MONKEY SCALE, SCENERY WRAP (78m) & BOSS ENTRANCE
    // ------------------------------------------------------------------------
    let b13PrevMoabSnap = [];
    const prevUpdateSim = G.updateSimulation;
    G.updateSimulation = function(dt) {
      prevUpdateSim(dt);

      const st = G.gameState;
      const h = st.hero;
      if (!h) return;

      lockStaticWorldGround();
      heroWhiteRing.position.set(h.x, 0.03, h.z);

      // A. Enforce 2.0x Scale on Hero Mesh & All 14 Squad Companion Meshes (x B13_UNIT_SCALE, Build 13.9)
      const U13 = window.B13_UNIT_SCALE || 1;
      if (G.heroMesh) {
        G.heroMesh.scale.setScalar(2.0 * U13);
      }
      if (G.squadMeshes) {
        Object.keys(G.squadMeshes).forEach(k => {
          const m = G.squadMeshes[k];
          const lvl = (st.squad && st.squad[k]) ? st.squad[k].level : 0;
          if (m && lvl > 0) {
            const tierMult = 1.0 + Math.min(4, lvl - 1) * 0.06;
            m.scale.setScalar(2.0 * tierMult * U13);
          }
        });
      }

      // B. Wrap our 56 intricate 3D scenery landmarks at 78m (well outside the camera view!)
      for (let i = 0; i < sceneryItems.length; i++) {
        const prop = sceneryItems[i];
        const dx = prop.position.x - h.x;
        const dz = prop.position.z - h.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 78.0) {
          const ang = Math.atan2(dz, dx) + Math.PI + (Math.random() - 0.5) * 0.45;
          const newR = 68.0 + Math.random() * 8.0;
          prop.position.set(h.x + Math.cos(ang) * newR, 0, h.z + Math.sin(ang) * newR);
        }
      }

      if (st.paused || st.gameOver || st.inStartMenu) return;

      // C. Cool In-Camera Boss Spawn Animation (Sky-Drop + Portal Reticle + Shockwave!)
      let activePortalBoss = null;
      if (G.activeMOABs && G.activeMOABs.length > 0) {
        for (let m = 0; m < G.activeMOABs.length; m++) {
          const mb = G.activeMOABs[m];
          if (!mb.mesh) continue;

          if (!mb._bossEntranceInitialized) {
            mb._bossEntranceInitialized = true;
            // Child blimps popped out of a mother appear right where she died: no relocation, no sky-drop
            if (!mb._b13IsChild) {
              for (let pm = 0; pm < b13PrevMoabSnap.length; pm++) {
                const snap = b13PrevMoabSnap[pm];
                if (G.activeMOABs.indexOf(snap.ref) === -1 && Math.hypot(snap.x - mb.x, snap.z - mb.z) < 9.0) { mb._b13IsChild = true; break; }
              }
            }
            if (mb._b13IsChild) {
              mb._entranceTimer = 99;
              mb._entranceDuration = 1.15;
              continue;
            }
            mb._entranceTimer = 0;
            mb._entranceDuration = 1.15;
            // Relocate Boss inside camera view (12m-14m from Hero) so player sees the dramatic entrance!
            const spawnAng = Math.atan2(mb.z - h.z, mb.x - h.x);
            const inCamRadius = 12.5;
            mb.x = h.x + Math.cos(spawnAng) * inCamRadius;
            mb.z = h.z + Math.sin(spawnAng) * inCamRadius;
            mb._spawnX = mb.x;
            mb._spawnZ = mb.z;
          }

          if (mb._entranceTimer < mb._entranceDuration) {
            mb._entranceTimer += dt;
            const p = Math.min(1.0, mb._entranceTimer / mb._entranceDuration);
            activePortalBoss = mb;

            // Keep boss anchored over its landing reticle during sky-drop
            mb.x = mb._spawnX;
            mb.z = mb._spawnZ;

            // Elastic sky-drop from Y=18m down to Y=1.8m
            const easeOutBack = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
            const dropY = THREE.MathUtils.lerp(18.0, 1.8, Math.min(1.0, p * 1.35));
            const baseScale = (mb.mesh.userData && mb.mesh.userData.baseHierarchyScale) || 1.25;
            const sScale = Math.max(0.1, Math.min(1.0, easeOutBack));
            mb.mesh.position.set(mb.x, dropY, mb.z);
            mb.mesh.scale.setScalar(sScale * baseScale);
            mb.mesh.rotation.y += (1.0 - p) * dt * 14.0;

            // Trigger landing shockwave burst when touching down at p >= 0.72
            if (p >= 0.72 && !mb._landShockTriggered) {
              mb._landShockTriggered = true;
              if (typeof G.spawnFloatingText === 'function') {
                G.spawnFloatingText(mb.x, 3.2, mb.z, '⚠️ BOSS ARRIVED!', 'crit');
              }
              if (G.soundFX && G.soundFX.playExplosion) {
                G.soundFX.playExplosion(1.4);
              }
            }
          } else {
            const baseScale = (mb.mesh.userData && mb.mesh.userData.baseHierarchyScale) || 1.25;
            mb.mesh.scale.setScalar(baseScale);
            if (mb.mesh.userData && mb.mesh.userData.propellers) {
              for (let pIdx = 0; pIdx < mb.mesh.userData.propellers.length; pIdx++) {
                mb.mesh.userData.propellers[pIdx].rotation.z += dt * 18.0;
              }
            }
          }
        }

        const mb0 = G.activeMOABs[0];
        const ptr = document.getElementById('boss-screen-pointer');
        if (ptr && Math.hypot(mb0.x - h.x, mb0.z - h.z) < 20.0) {
          ptr.style.display = 'none';
        }
      }

      b13PrevMoabSnap = (G.activeMOABs || []).map(function(m) { return { ref: m, x: m.x, z: m.z }; });
      if (activePortalBoss) {
        bossPortalGroup.visible = false;
        bossPortalGroup.position.set(activePortalBoss.x, 0.02, activePortalBoss.z);
        const pulse = 1.0 + Math.sin(st.elapsedTime * 18.0) * 0.15;
        portalOuterRing.scale.setScalar(pulse);
        portalInnerRing.rotation.z += dt * 6.0;
      } else {
        bossPortalGroup.visible = false;
      }

      // D. Beast Handler 2x Animals
      const bhLvl = (st.squad && st.squad.beasthandler) ? st.squad.beasthandler.level : 0;
      const bhMesh = G.squadMeshes ? G.squadMeshes.beasthandler : null;
      if (bhLvl > 0 && bhMesh && bhMesh.visible) {
        raptorMesh.visible = true;
        const target = G.findNearestEnemy(bhMesh.position.x, bhMesh.position.z, 22, true);
        const destX = target ? target.x : (bhMesh.position.x + Math.cos(st.elapsedTime * 3) * 2.4);
        const destZ = target ? target.z : (bhMesh.position.z + Math.sin(st.elapsedTime * 3) * 2.4);
        raptorX = THREE.MathUtils.lerp(raptorX || bhMesh.position.x, destX, Math.min(1, dt * 8.5));
        raptorZ = THREE.MathUtils.lerp(raptorZ || bhMesh.position.z, destZ, Math.min(1, dt * 8.5));
        raptorMesh.position.set(raptorX, Math.abs(Math.sin(st.elapsedTime * 16)) * 0.25, raptorZ);
        raptorMesh.rotation.y = Math.atan2(destX - raptorX, destZ - raptorZ);

        if (bhLvl >= 2) {
          falconMesh.visible = true;
          falconAngle += dt * 3.8;
          falconMesh.position.set(h.x + Math.cos(falconAngle) * 4.8, 3.2 + Math.sin(falconAngle * 3) * 0.4, h.z + Math.sin(falconAngle * 2) * 3.8);
          falconMesh.rotation.y = falconAngle + Math.PI / 2;
          if (falconMesh.userData.leftWing) {
            const flap = Math.sin(st.elapsedTime * 22) * 0.45;
            falconMesh.userData.leftWing.rotation.z = flap;
            falconMesh.userData.rightWing.rotation.z = -flap;
          }
        } else {
          falconMesh.visible = false;
        }

        if (bhLvl >= 3) {
          sharkMesh.visible = true;
          sharkX = THREE.MathUtils.lerp(sharkX || h.x, destX, Math.min(1, dt * 5.0));
          sharkZ = THREE.MathUtils.lerp(sharkZ || h.z, destZ, Math.min(1, dt * 5.0));
          sharkMesh.position.set(sharkX, Math.sin(st.elapsedTime * 8) * 0.2, sharkZ);
          sharkMesh.rotation.y += dt * 4.0;
        } else {
          sharkMesh.visible = false;
        }
      } else {
        raptorMesh.visible = false;
        falconMesh.visible = false;
        sharkMesh.visible = false;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootStaticGroundAndMenu);
  } else {
    bootStaticGroundAndMenu();
  }
})();






// ============================================================================
// BLOONS BLITZ BUILD 13 MASTER ENGINE (src/bloons_build13_engine.js)
// - 1:1 Authentic BTD6 3D MOABs, Fortified Airships & All 7 Boss Bloons
// - Interactive Dev Showcase World (Horizontal Lineup + WAILA HUD + 0 Attacks)
// - Strict Sequential Upgrade Paths + Path-Specific 3D Models & Projectiles
// - 3D Dimensional Rift Boss Entrance + Device Haptics + 740px Modal Cap
// ============================================================================


// ============================================================================
// BLOONS BLITZ BUILD 13: CRASH-PROOF DEV WORLD + WAILA, 3-SKULL BOSS BAR,
// UNIVERSAL 3-PATH SEQUENTIAL HIERARCHY, PATH-SPECIFIC 3D GEAR & 3D PROJECTILES
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
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(0, 0, 1024, 1024);
      drawRibs(16, '#3f6212', 7);
      ctx.fillStyle = '#4d7c0f';
      for (let s = 0; s < 30; s++) { ctx.beginPath(); ctx.arc((s * 97) % 1024, (s * 173) % 1024, 26 + (s % 30), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#a3e635';
      for (let s = 0; s < 18; s++) { ctx.beginPath(); ctx.arc((s * 151 + 40) % 1024, (s * 89 + 300) % 1024, 12 + (s % 14), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(0, 850, 1024, 174);
      // one huge cartoon eye on top
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a2e05'; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.ellipse(512, 250, 120, 100, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#18181b'; ctx.beginPath(); ctx.arc(530, 262, 48, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(548, 240, 14, 0, Math.PI * 2); ctx.fill();
    } else if (t === 'LYCH') {
      ctx.fillStyle = '#2a2833';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = '#7e22ce';
      ctx.fillRect(0, 330, 1024, 70);
      ctx.fillRect(0, 640, 1024, 70);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, 860, 1024, 164);
      drawRibs(14, '#17151d', 10);
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 8;
      for (let st = 0; st < 12; st++) {
        const sx = st * 85 + 20;
        ctx.beginPath(); ctx.moveTo(sx, 290); ctx.lineTo(sx + 30, 350); ctx.stroke();
      }
      [300, 724].forEach(function(ex, i) {
        ctx.save(); ctx.translate(ex, 235); ctx.scale(i ? -1 : 1, 1);
        ctx.fillStyle = '#4ade80'; ctx.strokeStyle = '#052e16'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(-70, -10); ctx.lineTo(65, 25); ctx.quadraticCurveTo(15, 70, -55, 35); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#bbf7d0'; ctx.beginPath(); ctx.arc(5, 30, 14, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
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

  // ==========================================================================
  // BUILD 13.2: PRO VORTEX MODEL + ANIMATED BOSS EFFECTS (all 7 bosses)
  // fx(dt, time, stage): stage 0 = calm, 1 = enraged (<50% HP), 2 = skull shield
  // ==========================================================================
  function b13Add(hex, op) { return new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op === undefined ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); }
  let b13GlowTexCache = null;
  function b13GlowTexture() {
    if (b13GlowTexCache) return b13GlowTexCache;
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    b13GlowTexCache = new THREE.CanvasTexture(c);
    return b13GlowTexCache;
  }
  function b13Sprite(hex, size, op) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: b13GlowTexture(), color: hex, transparent: true, opacity: op === undefined ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1);
    return s;
  }
  // Point on hull ellipsoid E {rx, ry, rz, cy, cz}: a = angle around long axis (0 = +x side, PI/2 = top), z along length
  function b13EllPoint(E, a, z, k, out) {
    const zz = Math.max(-0.97, Math.min(0.97, (z - (E.cz || 0)) / E.rz));
    const s = Math.sqrt(1 - zz * zz) * (k || 1);
    return out.set(Math.cos(a) * E.rx * s, E.cy + Math.sin(a) * E.ry * s, z);
  }
  const b13TmpV = new THREE.Vector3();
  function b13MakeArcs(parent, n, segs, coreHex, haloHex) {
    const arcs = [];
    for (let i = 0; i < n; i++) {
      const mk = function(hex, op) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 3), 3));
        const ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
        ln.frustumCulled = false;
        parent.add(ln);
        return ln;
      };
      const arc = { core: mk(coreHex, 1), halo: mk(haloHex, 0.85), halo2: mk(haloHex, 0.5), spark: b13Sprite(haloHex, 0.7, 1), segs: segs, beads: [] };
      parent.add(arc.spark);
      for (let b = 0; b < 3; b++) { const bd = b13Sprite(haloHex, 0.42, 0.8); parent.add(bd); arc.beads.push(bd); }
      arcs.push(arc);
    }
    return arcs;
  }
  function b13RegenArc(arc, E, reach) {
    const segs = arc.segs;
    const a1 = arc.core.geometry.attributes.position.array, a2 = arc.halo.geometry.attributes.position.array, a3 = arc.halo2.geometry.attributes.position.array;
    let a = Math.random() * Math.PI * 2;
    let z = (E.cz || 0) + (Math.random() * 2 - 1) * E.rz * 0.8;
    const da = (Math.random() - 0.5) * 0.55, dz = (Math.random() - 0.5) * 0.5 * (reach || 1);
    for (let s = 0; s < segs; s++) {
      a += da + (Math.random() - 0.5) * 0.4;
      z += dz + (Math.random() - 0.5) * 0.22;
      b13EllPoint(E, a, z, 1.03 + Math.random() * 0.12, b13TmpV);
      const i3 = s * 3;
      a1[i3] = b13TmpV.x; a1[i3 + 1] = b13TmpV.y; a1[i3 + 2] = b13TmpV.z;
      a2[i3] = b13TmpV.x + (Math.random() - 0.5) * 0.07; a2[i3 + 1] = b13TmpV.y + (Math.random() - 0.5) * 0.07; a2[i3 + 2] = b13TmpV.z + (Math.random() - 0.5) * 0.07;
      a3[i3] = b13TmpV.x + (Math.random() - 0.5) * 0.12; a3[i3 + 1] = b13TmpV.y + (Math.random() - 0.5) * 0.12; a3[i3 + 2] = b13TmpV.z + (Math.random() - 0.5) * 0.12;
    }
    arc.core.geometry.attributes.position.needsUpdate = true;
    arc.halo.geometry.attributes.position.needsUpdate = true;
    arc.halo2.geometry.attributes.position.needsUpdate = true;
    const e3 = (segs - 1) * 3;
    arc.spark.position.set(a1[e3], a1[e3 + 1], a1[e3 + 2]);
    b13ArcBeads(arc, a1);
  }
  function b13ArcBeads(arc, a1) {
    if (!arc.beads) return;
    arc.beads.forEach(function(bd, i) { const k = Math.floor(((i + 1) / 4) * (arc.segs - 1)) * 3; bd.position.set(a1[k], a1[k + 1], a1[k + 2]); });
  }
  function b13SetArcVis(arc, on, op) {
    arc.core.visible = arc.halo.visible = arc.halo2.visible = arc.spark.visible = on;
    if (arc.beads) arc.beads.forEach(function(bd) { bd.visible = on; if (on) { bd.material.opacity = op * 0.75; const k = 0.3 + Math.random() * 0.35; bd.scale.set(k, k, 1); } });
    if (on) {
      arc.core.material.opacity = op;
      arc.halo.material.opacity = op * 0.85;
      arc.halo2.material.opacity = op * 0.5;
      arc.spark.material.opacity = op;
      const sc = 0.45 + Math.random() * 0.5;
      arc.spark.scale.set(sc, sc, 1);
    }
  }
  function b13Ellipsoid(E, k, mat) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
    m.scale.set(E.rx * k, E.ry * k, E.rz * k);
    m.position.set(0, E.cy, E.cz || 0);
    return m;
  }

  // ---------------- PRO VORTEX: Deadly Master of Air ----------------
  let b13VortexTexCache = null;
  function b13VortexHullTexture() {
    if (b13VortexTexCache) return b13VortexTexCache;
    const W = 1024, Hh = 1024;
    const c = document.createElement('canvas');
    c.width = W; c.height = Hh;
    const ctx = c.getContext('2d');
    // u (x) wraps around the hull (x = 512 is the TOP), v (y) runs nose (top) -> tail (bottom)
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#075985'); g.addColorStop(0.28, '#0ea5e9'); g.addColorStop(0.5, '#7dd3fc'); g.addColorStop(0.72, '#0ea5e9'); g.addColorStop(1, '#075985');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, Hh);
    // Swept black armour bands (wrap diagonally like the BTD6 Vortex livery)
    const band = function(y0, y1, skew) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y0 + Math.sin((x / W) * Math.PI * 2) * skew);
      for (let x = W; x >= 0; x -= 16) ctx.lineTo(x, y1 + Math.sin((x / W) * Math.PI * 2) * skew);
      ctx.closePath();
      ctx.fillStyle = '#0b1220';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5;
      ctx.stroke();
    };
    band(0, 120, 0);
    band(470, 600, 70);
    band(800, 1024, 40);
    // Panel seams
    ctx.strokeStyle = 'rgba(8, 47, 73, 0.32)';
    ctx.lineWidth = 3;
    for (let y = 230; y < 1000; y += 190) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = 64; x < W; x += 256) { ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x, 1000); ctx.stroke(); }
    // Glossy top highlight streak
    const hl = ctx.createLinearGradient(380, 0, 644, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.5, 'rgba(255,255,255,0.45)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(380, 140, 264, 300);
    // Electric conduit lines
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.85)';
    ctx.lineWidth = 6;
    [300, 724].forEach(function(x) { ctx.beginPath(); ctx.moveTo(x, 610); ctx.lineTo(x + 30, 700); ctx.lineTo(x - 10, 780); ctx.stroke(); });
    b13VortexTexCache = new THREE.CanvasTexture(c);
    return b13VortexTexCache;
  }
  let b13VortexNoseTexCache = null;
  function b13VortexNoseTexture() {
    if (b13VortexNoseTexCache) return b13VortexNoseTexCache;
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    for (let x = 0; x < 512; x += 51) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
    const hl = ctx.createLinearGradient(176, 0, 336, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.5, 'rgba(203,213,225,0.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(176, 0, 160, 256);
    b13VortexNoseTexCache = new THREE.CanvasTexture(c);
    return b13VortexNoseTexCache;
  }

  function buildVortexBossModel(upper) {
    const S = 4.25;
    const root = new THREE.Group();
    const E = { rx: 1.12, ry: 0.98, rz: 2.05, cy: 1.65, cz: 0 };
    const hullMat = new THREE.MeshStandardMaterial({ map: b13VortexHullTexture(), roughness: 0.3, metalness: 0.2, flatShading: true, emissive: new THREE.Color(0x0c4a6e), emissiveIntensity: 0.25 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.38, metalness: 0.45, flatShading: true });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3, metalness: 0.8, flatShading: true });
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x020617, side: THREE.BackSide });
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: new THREE.Color(0x22d3ee), emissiveIntensity: 0.5, roughness: 0.2 });
    const outline = function(mesh, k) { const o = new THREE.Mesh(mesh.geometry, outlineMat); o.scale.setScalar(k || 1.05); mesh.add(o); return mesh; };

    // Faceted hull (texture top-centred) + cartoon outline
    const hullGeo = new THREE.SphereGeometry(1, 18, 12);
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.rotateZ(Math.PI / 2);
    const hull = outline(new THREE.Mesh(hullGeo, hullMat), 1.035);
    hull.scale.set(E.rx, E.ry, E.rz);
    hull.position.set(0, E.cy, 0);
    root.add(hull);

    // Black faceted nose spike with converging panel lines
    const nose = outline(new THREE.Mesh(new THREE.ConeGeometry(0.93, 1.75, 12, 1).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: b13VortexNoseTexture(), roughness: 0.28, metalness: 0.5, flatShading: true })), 1.04);
    nose.scale.set(1, 0.87, 1);
    nose.position.set(0, E.cy, 1.25 + 0.875);
    root.add(nose);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.065, 6, 28), blackMat);
    collar.scale.set(1, 0.87, 1);
    collar.position.set(0, E.cy, 1.26);
    root.add(collar);

    // Portholes: white glass, black rims, oriented to the hull surface
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: new THREE.Color(0xe0f2fe), emissiveIntensity: 0.35, roughness: 0.15 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd });
    const portholes = [];
    [[1.32, 1.0], [1.82, 1.0], [1.57, 0.72], [1.12, 0.55], [2.02, 0.55], [1.37, 0.28], [1.77, 0.28], [1.57, 0.0]].forEach(function(pz) {
      const a = pz[0], z = pz[1];
      const p = b13EllPoint(E, a, z, 1.0, new THREE.Vector3());
      const n = new THREE.Vector3(p.x / (E.rx * E.rx), (p.y - E.cy) / (E.ry * E.ry), p.z / (E.rz * E.rz)).normalize();
      const ph = new THREE.Group();
      ph.position.copy(p).addScaledVector(n, 0.015);
      ph.lookAt(p.clone().add(n));
      const rim = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), rimMat);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.155, 20), glassMat);
      glass.position.z = 0.01;
      const glint = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), glintMat);
      glint.position.set(-0.05, 0.05, 0.02);
      ph.add(rim, glass, glint);
      ph.scale.set(1, 0.78, 1);
      root.add(ph);
      portholes.push(glass);
    });

    // Three swept dorsal blade-fins with glowing conductor tips
    const finShape = new THREE.Shape();
    finShape.moveTo(0.5, 0);
    finShape.quadraticCurveTo(0.0, 0.45, -1.05, 1.0);
    finShape.lineTo(-0.9, 0.86);
    finShape.quadraticCurveTo(-0.62, 0.42, -0.72, 0);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.24, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
    finGeo.translate(0, 0, -0.12);
    finGeo.rotateY(-Math.PI / 2);
    const finTips = [];
    [[0.75, 0.72], [0.0, 0.88], [-0.78, 1.0]].forEach(function(fz) {
      const z = fz[0], k = fz[1];
      const top = b13EllPoint(E, Math.PI / 2, z, 1.0, new THREE.Vector3());
      const fin = outline(new THREE.Mesh(finGeo, blackMat), 1.06);
      fin.scale.setScalar(k);
      fin.position.set(0, top.y - 0.12, z);
      root.add(fin);
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), stripMat);
      tip.position.set(0, top.y - 0.12 + 0.98 * k, z - 1.02 * k);
      root.add(tip);
      finTips.push(tip);
    });

    // Long swept side wings with electric leading-edge strips
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0.75);
    wingShape.lineTo(1.95, -0.85);
    wingShape.lineTo(2.0, -1.22);
    wingShape.lineTo(0, -0.85);
    wingShape.closePath();
    const wingGeoR = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1 });
    wingGeoR.translate(0, 0, -0.06);
    wingGeoR.rotateX(Math.PI / 2);
    const wingGeoL = wingGeoR.clone();
    wingGeoL.scale(-1, 1, 1);
    const wingMatD = blackMat.clone();
    wingMatD.side = THREE.DoubleSide;
    [[1, wingGeoR], [-1, wingGeoL]].forEach(function(w) {
      const s = w[0];
      const wing = new THREE.Mesh(w[1], wingMatD);
      wing.position.set(s * 0.88, E.cy - 0.38, 0.15);
      wing.rotation.z = -s * 0.1;
      root.add(wing);
      const p1 = new THREE.Vector3(0, 0.03, 0.75), p2 = new THREE.Vector3(s * 1.95, 0.03, -0.85);
      const dir = p2.clone().sub(p1);
      const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, dir.length(), 6), stripMat);
      strip.position.copy(p1).addScaledVector(dir, 0.5);
      strip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      wing.add(strip);
    });

    // Tail: tapered exhaust housing, stabilisers, twin plasma thrusters
    const tail = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.75, 10).rotateX(Math.PI / 2), blackMat), 1.04);
    tail.position.set(0, E.cy, -1.95);
    root.add(tail);
    [-1, 1].forEach(function(s) {
      const stab = outline(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.5), blackMat), 1.06);
      stab.position.set(s * 0.62, E.cy + 0.22, -1.9);
      stab.rotation.z = s * 0.38;
      root.add(stab);
    });
    const thrusterGlows = [];
    [-0.3, 0.3].forEach(function(x) {
      const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.45, 12).rotateX(Math.PI / 2), steelMat);
      noz.position.set(x, E.cy - 0.04, -2.38);
      root.add(noz);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.0, 12).rotateX(-Math.PI / 2), b13Add(0x22d3ee, 0.8));
      flame.position.set(x, E.cy - 0.04, -3.05);
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 10).rotateX(-Math.PI / 2), b13Add(0xffffff, 0.9));
      core.position.set(x, E.cy - 0.04, -2.85);
      root.add(flame, core);
      thrusterGlows.push(flame, core);
    });

    // ---------- Electric storm stage FX ----------
    const fxRoot = new THREE.Group();
    fxRoot.name = 'b13_boss_fx';
    root.add(fxRoot);
    const shellMat = b13Add(0x22d3ee, 0);
    const shell = b13Ellipsoid(E, 1.12, shellMat);
    fxRoot.add(shell);
    const swirls = [];
    [0.7, -0.5].forEach(function(z, i) {
      const sw = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.03, 4, 64, Math.PI * 1.2), b13Add(0xffffff, 0.2));
      sw.scale.set(E.rx * 1.38, E.ry * 1.38, 1);
      sw.position.set(0, E.cy, z);
      sw.rotation.z = i * 2.1;
      fxRoot.add(sw);
      swirls.push(sw);
    });
    const arcs = b13MakeArcs(fxRoot, 10, 11, 0xffffff, 0x38bdf8);
    const field = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40).rotateX(-Math.PI / 2), b13Add(0x0ea5e9, 0.0));
    field.position.y = 0.05;
    fxRoot.add(field);
    const tipSparks = finTips.map(function(tp) { const sp = b13Sprite(0x67e8f9, 0.8, 0); sp.position.copy(tp.position); fxRoot.add(sp); return sp; });
    const bolts = b13MakeArcs(fxRoot, 2, 8, 0xffffff, 0x7dd3fc); // ground-strike bolts
    let regen = 0, boltT = 0;
    const baseY = hull.position.y;

    root.userData = {
      moabType: upper,
      baseHierarchyScale: S,
      propellers: [],
      isAuthenticB13: true,
      fx: function(dt, time, stage) {
        const st = Math.max(0, Math.min(2, stage | 0));
        const inten = st === 0 ? 0.3 : (st === 1 ? 0.85 : 1.0);
        regen -= dt;
        if (regen <= 0) {
          regen = st === 0 ? 0.14 : 0.06;
          const active = st === 0 ? 3 : (st === 1 ? 8 : 10);
          for (let i = 0; i < arcs.length; i++) {
            const on = i < active && (st > 0 || Math.random() < 0.4);
            if (on) b13RegenArc(arcs[i], E, 1 + st * 0.5);
            b13SetArcVis(arcs[i], on, 0.55 + Math.random() * 0.45);
          }
        }
        boltT -= dt;
        if (boltT <= 0) {
          boltT = st === 0 ? 9e9 : (0.25 + Math.random() * 0.5);
          bolts.forEach(function(b) {
            const on = st > 0 && Math.random() < 0.6;
            if (on) {
              const arr = [b.core, b.halo, b.halo2].map(function(l) { return l.geometry.attributes.position.array; });
              const sx = (Math.random() - 0.5) * 2.4, sz = (Math.random() - 0.5) * 3.2;
              const gx = sx + (Math.random() - 0.5) * 3.0, gz = sz + (Math.random() - 0.5) * 3.0;
              for (let s = 0; s < b.segs; s++) {
                const f = s / (b.segs - 1);
                const jx = (s === 0 || s === b.segs - 1) ? 0 : (Math.random() - 0.5) * 0.5;
                const jz = (s === 0 || s === b.segs - 1) ? 0 : (Math.random() - 0.5) * 0.5;
                const x = sx + (gx - sx) * f + jx, y = E.cy - 0.6 + (0.05 - (E.cy - 0.6)) * f, z = sz + (gz - sz) * f + jz;
                arr.forEach(function(A, k) { A[s * 3] = x + (k ? (Math.random() - 0.5) * 0.08 : 0); A[s * 3 + 1] = y; A[s * 3 + 2] = z + (k ? (Math.random() - 0.5) * 0.08 : 0); });
              }
              [b.core, b.halo, b.halo2].forEach(function(l) { l.geometry.attributes.position.needsUpdate = true; });
              b.spark.position.set(gx, 0.15, gz);
              b13ArcBeads(b, arr[0]);
            }
            b13SetArcVis(b, on, 1);
          });
        }
        const flick = 0.75 + 0.25 * Math.sin(time * 37) * Math.sin(time * 13);
        shellMat.opacity = (st === 0 ? 0.04 : (st === 1 ? 0.16 : 0.32)) * flick;
        field.material.opacity = (st === 0 ? 0.0 : (st === 1 ? 0.12 : 0.22)) * flick;
        swirls.forEach(function(sw, i) { sw.rotation.z += dt * (5 + st * 4) * (i ? -1 : 1); sw.material.opacity = st === 0 ? 0.05 : 0.12 + 0.3 * inten; });
        stripMat.emissiveIntensity = 0.35 + 1.4 * inten * (0.6 + 0.4 * Math.random());
        tipSparks.forEach(function(sp) { sp.material.opacity = st === 0 ? 0.25 * Math.random() : (0.5 + 0.5 * Math.random()); const k = 0.5 + Math.random() * 0.6 * inten; sp.scale.set(k, k, 1); });
        portholes.forEach(function(g) { g.material.emissiveIntensity = 0.3 + 0.5 * inten * Math.random(); });
        const pulse = 1 + 0.12 * Math.sin(time * 42) + (st === 2 ? 0.25 : 0);
        thrusterGlows.forEach(function(fl) { fl.scale.set(1, 1, pulse); });
        hull.position.y = baseY + (st === 2 ? (Math.random() - 0.5) * 0.03 : 0);
      }
    };
    root.scale.setScalar(S);
    return root;
  }

  // ---------------- Effects for the other bosses ----------------
  function addBossFx(group, t) {
    const B = { BLOONARIUS: 1, LYCH: 1, DREADBLOON: 1, PHAYZE: 1, BLASTAPOPOULOS: 1, TERRACOTTA: 1 };
    if (!B[t]) return null;
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    if (!isFinite(box.min.x)) return null;
    const cen = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const E = { rx: size.x * 0.42, ry: size.y * 0.4, rz: size.z * 0.42, cy: cen.y, cz: cen.z };
    const fx = new THREE.Group();
    fx.name = 'b13_boss_fx';
    group.add(fx);
    const rand = function(a, b) { return a + Math.random() * (b - a); };
    const parts = [];
    let fn = null;

    if (t === 'BLOONARIUS') {
      // Toxic slime drips, bubbling top, swamp mist
      const slime = new THREE.MeshStandardMaterial({ color: 0x84cc16, emissive: new THREE.Color(0x4d7c0f), emissiveIntensity: 0.5, transparent: true, opacity: 0.9, roughness: 0.15 });
      for (let i = 0; i < 12; i++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), slime);
        const pud = new THREE.Mesh(new THREE.CircleGeometry(0.25, 14).rotateX(-Math.PI / 2), b13Add(0x65a30d, 0));
        fx.add(d, pud);
        parts.push({ d: d, pud: pud, vy: 0, t: rand(0, 2), pt: 0 });
      }
      const bubbles = [];
      for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), slime); fx.add(b); bubbles.push({ m: b, t: rand(0, 1) }); }
      const mist = [];
      for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(E.rx * 2.2 - i * 0.6, 40).rotateX(-Math.PI / 2), b13Add(0x65a30d, 0.12)); m.position.set(0, 0.06 + i * 0.03, E.cz); fx.add(m); mist.push(m); }
      fn = function(dt, time, st) {
        parts.forEach(function(p) {
          p.t -= dt;
          if (p.t <= 0 && p.vy === 0) { b13EllPoint(E, -Math.PI / 2 + rand(-0.9, 0.9), E.cz + rand(-E.rz, E.rz) * 0.8, 0.95, p.d.position); p.vy = -0.01; p.d.scale.set(1, 1, 1); }
          if (p.vy !== 0) {
            p.vy -= 9.8 * dt * 0.5;
            p.d.position.y += p.vy * dt;
            p.d.scale.set(1, 1 + Math.min(1.5, -p.vy * 0.3), 1);
            if (p.d.position.y < 0.12) { p.pud.position.set(p.d.position.x, 0.04, p.d.position.z); p.pt = 1; p.vy = 0; p.t = rand(0.2, st === 0 ? 2.2 : 0.8); p.d.position.y = -50; }
          }
          if (p.pt > 0) { p.pt -= dt * 0.8; p.pud.material.opacity = Math.max(0, p.pt) * 0.55; const s = 1 + (1 - p.pt) * 1.5; p.pud.scale.set(s, 1, s); }
        });
        bubbles.forEach(function(b) {
          b.t -= dt * (st === 0 ? 0.6 : 1.2);
          if (b.t <= 0) { b.t = 1; b13EllPoint(E, Math.PI / 2 + rand(-0.8, 0.8), E.cz + rand(-E.rz, E.rz) * 0.7, 0.97, b.m.position); }
          const s = (1 - b.t) * 1.4;
          b.m.scale.setScalar(Math.max(0.01, s));
        });
        mist.forEach(function(m, i) { m.rotation.y += dt * (i ? -0.3 : 0.25); m.material.opacity = (0.08 + 0.06 * st) * (0.8 + 0.2 * Math.sin(time * 2 + i)); });
      };
    } else if (t === 'LYCH') {
      // Ghost-flame wisps, soul tethers, undead aura
      const auraMat = b13Add(0xa855f7, 0.08);
      fx.add(b13Ellipsoid(E, 1.15, auraMat));
      for (let i = 0; i < 6; i++) {
        const w = new THREE.Group();
        const flame = b13Sprite(0xa855f7, 1.0, 0.9);
        flame.position.y = 0.25;
        const tip = b13Sprite(0x7e22ce, 0.6, 0.8);
        tip.position.y = 0.62;
        w.add(flame, tip, b13Sprite(0xf5d0fe, 0.45, 1));
        const eyeL = b13Sprite(0x86efac, 0.18, 1); eyeL.position.set(-0.07, 0.05, 0.12);
        const eyeR = b13Sprite(0x86efac, 0.18, 1); eyeR.position.set(0.07, 0.05, 0.12);
        w.add(eyeL, eyeR);
        fx.add(w);
        parts.push({ w: w, flame: flame, ph: (i / 6) * Math.PI * 2 });
      }
      const tethers = b13MakeArcs(fx, 3, 8, 0xd8b4fe, 0x86efac);
      let tt = 0;
      fn = function(dt, time, st) {
        parts.forEach(function(p, i) {
          const a = p.ph + time * (0.7 + st * 0.35);
          p.w.position.set(Math.cos(a) * E.rx * 1.65, E.cy + Math.sin(time * 2.2 + i) * 0.45, E.cz + Math.sin(a) * E.rz * 1.15);
          const fl = 0.85 + 0.3 * Math.random();
          p.flame.scale.set(0.75 * fl, 1.25 * fl * (1.0 + 0.25 * Math.sin(time * 9 + i)), 1);
        });
        auraMat.opacity = (0.05 + 0.07 * st) * (0.6 + 0.4 * Math.random());
        tt -= dt;
        if (tt <= 0) {
          tt = 0.09;
          tethers.forEach(function(b, i) {
            const on = st > 0 || Math.random() < 0.3;
            if (on) {
              const target = parts[(i * 2) % parts.length].w.position;
              const arr = [b.core, b.halo, b.halo2].map(function(l) { return l.geometry.attributes.position.array; });
              for (let s = 0; s < b.segs; s++) {
                const f = s / (b.segs - 1);
                arr.forEach(function(A, k) { A[s * 3] = target.x * f + (Math.random() - 0.5) * 0.15; A[s * 3 + 1] = E.cy + (target.y - E.cy) * f + (Math.random() - 0.5) * 0.15; A[s * 3 + 2] = E.cz + (target.z - E.cz) * f + (Math.random() - 0.5) * 0.15; });
              }
              [b.core, b.halo, b.halo2].forEach(function(l) { l.geometry.attributes.position.needsUpdate = true; });
              b.spark.position.copy(target);
              b13ArcBeads(b, arr[0]);
            }
            b13SetArcVis(b, on, 0.7);
          });
        }
      };
    } else if (t === 'DREADBLOON') {
      // Orbiting rock shield, spinning drill, dust
      const rockMats = [0x78716c, 0x57534e, 0xa8a29e].map(function(c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }); });
      for (let i = 0; i < 9; i++) {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.22, 0.38), 0), rockMats[i % 3]);
        fx.add(r);
        parts.push({ m: r, ph: (i / 9) * Math.PI * 2, h: rand(-0.4, 0.5), sp: rand(1.5, 3) });
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 48), b13Add(0xfacc15, 0));
      ring.rotation.x = Math.PI / 2;
      ring.scale.set(E.rx * 1.75, E.rz * 1.3, 1);
      ring.position.set(0, E.cy, E.cz);
      fx.add(ring);
      let drill = null, drillAx = 'z', bz = -Infinity;
      group.traverse(function(c) { if (c.isMesh && c.geometry && c.geometry.type === 'ConeGeometry' && c.position.z > bz) { bz = c.position.z; drill = c; } });
      if (drill) drillAx = Math.abs(Math.abs(drill.rotation.x) - Math.PI / 2) < 0.05 ? 'y' : 'z';
      const dust = [];
      for (let i = 0; i < 8; i++) { const d = b13Sprite(0xa8a29e, 1, 0); fx.add(d); dust.push({ s: d, t: rand(0, 1) }); }
      fn = function(dt, time, st) {
        const rr = st === 2 ? 1.35 : 1.7;
        parts.forEach(function(p) {
          const a = p.ph + time * (st === 2 ? 2.2 : 0.6);
          p.m.position.set(Math.cos(a) * E.rx * rr, E.cy + p.h, E.cz + Math.sin(a) * E.rz * (rr * 0.75));
          p.m.rotation.x += dt * p.sp; p.m.rotation.y += dt * p.sp * 0.7;
        });
        ring.material.opacity = st === 2 ? 0.55 + 0.25 * Math.sin(time * 20) : 0;
        if (drill) drill.rotation[drillAx] += dt * (6 + st * 6);
        dust.forEach(function(d) {
          d.t -= dt * 0.7;
          if (d.t <= 0) { d.t = 1; d.s.position.set(rand(-E.rx, E.rx), 0.3, E.cz + rand(-E.rz, E.rz)); }
          const k = 0.6 + (1 - d.t) * 2.2;
          d.s.scale.set(k, k, 1);
          d.s.material.opacity = d.t * (0.2 + 0.1 * st);
        });
      };
    } else if (t === 'PHAYZE') {
      // Reality glitch: rift shards, chromatic scan slices, blink-shift, portal
      const bodyParts = group.children.filter(function(c) { return c !== fx; });
      const baseX = bodyParts.map(function(c) { return c.position.x; });
      for (let i = 0; i < 10; i++) {
        const s = new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.12, 0.26)), b13Add(i % 2 ? 0xec4899 : 0x22d3ee, 0.85));
        fx.add(s);
        parts.push({ m: s, ph: (i / 10) * Math.PI * 2, h: rand(-0.6, 0.6), r: rand(1.4, 1.9) });
      }
      const slices = [];
      for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(E.rx * 2.8, 0.07), b13Add(i % 2 ? 0xf0abfc : 0x67e8f9, 0.8)); p.rotation.y = Math.PI / 2; fx.add(p); slices.push(p); }
      const portal = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.4, 40).rotateX(-Math.PI / 2), b13Add(0x7e22ce, 0.25));
      portal.position.set(0, 0.06, E.cz);
      fx.add(portal);
      let st2 = 0, blink = 2.0;
      fn = function(dt, time, st) {
        parts.forEach(function(p) {
          const a = p.ph + time * 1.1;
          p.m.position.set(Math.cos(a) * E.rx * p.r, E.cy + p.h + Math.sin(time * 3 + p.ph) * 0.2, E.cz + Math.sin(a) * E.rz * p.r * 0.7);
          p.m.rotation.y += dt * 3;
          p.m.visible = Math.random() > 0.08;
        });
        st2 -= dt;
        if (st2 <= 0) {
          st2 = 0.11;
          slices.forEach(function(p) { p.visible = Math.random() < (0.25 + 0.25 * st); p.position.set((Math.random() - 0.5) * 0.3, E.cy + (Math.random() - 0.5) * E.ry * 2, E.cz + (Math.random() - 0.5) * E.rz * 0.6); p.scale.set(1, 1, 0.5 + Math.random()); });
        }
        portal.rotation.y += dt * 1.5;
        portal.material.opacity = 0.18 + 0.1 * st + 0.08 * Math.sin(time * 6);
        blink -= dt;
        const glitching = blink < 0.16;
        if (blink <= 0) blink = st === 0 ? 2.6 : 1.2;
        const off = glitching ? (Math.random() - 0.5) * 0.7 : 0;
        bodyParts.forEach(function(c, i) { c.position.x = baseX[i] + off; });
      };
    } else if (t === 'BLASTAPOPOULOS') {
      // Rising embers, lava pulse, orbiting fireballs, heat shell
      const emiss = [];
      group.traverse(function(c) { if (c.isMesh && c.material && c.material.emissive && c.material.emissiveIntensity > 0 && emiss.indexOf(c.material) === -1) emiss.push(c.material); });
      const emBase = emiss.map(function(m) { return m.emissiveIntensity; });
      for (let i = 0; i < 20; i++) { const e = b13Sprite(i % 3 ? 0xf97316 : 0xfde047, 0.3, 1); fx.add(e); parts.push({ s: e, t: rand(0, 1), vx: rand(-0.3, 0.3), vz: rand(-0.3, 0.3) }); }
      const balls = [];
      for (let i = 0; i < 3; i++) { const b = new THREE.Group(); b.add(b13Sprite(0xf97316, 1.1, 0.9), b13Sprite(0xfef08a, 0.5, 1)); fx.add(b); balls.push(b); }
      const heatMat = b13Add(0xef4444, 0.06);
      fx.add(b13Ellipsoid(E, 1.12, heatMat));
      const scorch = new THREE.Mesh(new THREE.CircleGeometry(E.rx * 2.0, 40).rotateX(-Math.PI / 2), b13Add(0xea580c, 0.15));
      scorch.position.set(0, 0.05, E.cz);
      fx.add(scorch);
      fn = function(dt, time, st) {
        parts.forEach(function(p) {
          p.t -= dt * (0.5 + 0.4 * st);
          if (p.t <= 0) { p.t = 1; b13EllPoint(E, Math.PI / 2 + rand(-1.1, 1.1), E.cz + rand(-E.rz, E.rz) * 0.8, 1.0, p.s.position); }
          p.s.position.y += dt * (1.4 + st * 0.8);
          p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt;
          p.s.material.opacity = Math.min(1, p.t * 1.4);
        });
        balls.forEach(function(b, i) { const a = time * (1.3 + st * 0.6) + (i / 3) * Math.PI * 2; b.position.set(Math.cos(a) * E.rx * 1.6, E.cy + 0.4 + Math.sin(time * 3 + i) * 0.3, E.cz + Math.sin(a) * E.rz * 1.1); });
        const pulse = 0.75 + 0.45 * Math.sin(time * (3 + st * 2));
        emiss.forEach(function(m, i) { m.emissiveIntensity = emBase[i] * (0.7 + 0.6 * pulse) * (1 + st * 0.3); });
        heatMat.opacity = (0.04 + 0.05 * st) * pulse;
        scorch.material.opacity = 0.1 + 0.08 * pulse;
      };
    } else if (t === 'TERRACOTTA') {
      // Quetzal: orbiting golden Aztec glyph sigils, jade pulse, sun-dust motes
      const gc = document.createElement('canvas');
      gc.width = 128; gc.height = 128;
      const g2 = gc.getContext('2d');
      g2.strokeStyle = '#fde047'; g2.lineWidth = 10;
      g2.strokeRect(14, 14, 100, 100);
      g2.beginPath(); g2.moveTo(34, 94); g2.lineTo(34, 64); g2.lineTo(54, 64); g2.lineTo(54, 44); g2.lineTo(74, 44); g2.lineTo(74, 64); g2.lineTo(94, 64); g2.lineTo(94, 34); g2.stroke();
      g2.fillStyle = '#5eead4'; g2.beginPath(); g2.arc(64, 82, 9, 0, Math.PI * 2); g2.fill();
      const glyphTex = new THREE.CanvasTexture(gc);
      for (let i = 0; i < 8; i++) {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshBasicMaterial({ map: glyphTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        fx.add(gl);
        parts.push({ m: gl, ph: (i / 8) * Math.PI * 2 });
      }
      const motes = [];
      for (let i = 0; i < 14; i++) { const m = b13Sprite(i % 2 ? 0xfde047 : 0x5eead4, 0.22, 1); fx.add(m); motes.push({ s: m, t: rand(0, 1) }); }
      const jade = [];
      group.traverse(function(c) { if (c.isMesh && c.material && c.material.color && c.material.emissive) { const hx = c.material.color.getHex(); if ((hx === 0x0d9488 || hx === 0x14b8a6 || hx === 0x5eead4 || hx === 0x2dd4bf) && jade.indexOf(c.material) === -1) jade.push(c.material); } });
      const sunDisc = new THREE.Mesh(new THREE.RingGeometry(E.rx * 1.2, E.rx * 1.45, 48).rotateX(-Math.PI / 2), b13Add(0xfacc15, 0.2));
      sunDisc.position.set(0, 0.06, E.cz);
      fx.add(sunDisc);
      fn = function(dt, time, st) {
        parts.forEach(function(p, i) {
          const a = p.ph + time * (0.5 + st * 0.3);
          p.m.position.set(Math.cos(a) * E.rx * 1.7, E.cy + 0.3 + Math.sin(time * 1.6 + i) * 0.3, E.cz + Math.sin(a) * E.rz * 1.05);
          p.m.rotation.y = -a + Math.PI / 2;
          p.m.material.opacity = 0.55 + 0.45 * Math.sin(time * 3 + i);
        });
        motes.forEach(function(m) {
          m.t -= dt * 0.35;
          if (m.t <= 0) { m.t = 1; m.s.position.set(rand(-E.rx, E.rx) * 1.4, 0.2, E.cz + rand(-E.rz, E.rz)); }
          m.s.position.y += dt * 0.9;
          m.s.material.opacity = Math.sin(m.t * Math.PI);
        });
        jade.forEach(function(mt) { mt.emissive.setHex(0x14b8a6); mt.emissiveIntensity = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 2.5)) * (1 + st * 0.5); });
        sunDisc.rotation.y += dt * 0.4;
        sunDisc.material.opacity = 0.14 + 0.1 * st + 0.06 * Math.sin(time * 4);
      };
    }
    return fn;
  }

  // BUILD 13.8: real BTD6 Gravelord Lych (pointed charcoal hull, magenta rear bands, half-moon eyes, stitches, spears)
  function buildLychModel(upper) {
    const S = 4.25, CY = 1.65, A = 1.18, B = 1.08, C = 1.95;
    const root = new THREE.Group();
    const taper = function(z) { return z > 0 ? 1 - 0.62 * Math.pow(Math.min(1, z / C), 1.7) : 1 - 0.12 * Math.pow(Math.min(1, -z / C), 2); };
    const surf = function(dx, dy, dz, out) {
      const d = new THREE.Vector3(dx, dy, dz).normalize();
      const k = 1 / Math.sqrt(Math.pow(d.x / A, 2) + Math.pow(d.y / B, 2) + Math.pow(d.z / C, 2));
      const p = d.multiplyScalar(k * (out || 1.0));
      const f = taper(p.z); p.x *= f; p.y *= f; p.y += CY;
      return p;
    };
    // Texture: canvas x = around the nose axis (0.25 = belly, 0.75 = top), canvas y = nose (top) -> tail (bottom)
    const tc = document.createElement('canvas'); tc.width = 1024; tc.height = 512;
    const g = tc.getContext('2d');
    g.fillStyle = '#3b3e4b'; g.fillRect(0, 0, 1024, 512);
    const sh = g.createLinearGradient(0, 0, 1024, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(0.25, 'rgba(0,0,0,0.35)'); sh.addColorStop(0.75, 'rgba(255,255,255,0.10)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = sh; g.fillRect(0, 0, 1024, 512);
    // glowing green belly (front two thirds)
    const bel = g.createLinearGradient(0, 0, 0, 512);
    bel.addColorStop(0, 'rgba(74,222,128,0.95)'); bel.addColorStop(0.55, 'rgba(34,197,94,0.75)'); bel.addColorStop(0.85, 'rgba(22,101,52,0.0)');
    g.fillStyle = bel; g.beginPath(); g.ellipse(256, 200, 150, 290, 0, 0, Math.PI * 2); g.fill();
    // magenta rear bands
    g.fillStyle = '#c64fd8'; g.fillRect(0, 340, 1024, 34); g.fillRect(0, 398, 1024, 30);
    g.fillStyle = '#e07ef0'; g.fillRect(0, 340, 1024, 6); g.fillRect(0, 398, 1024, 5);
    // seams converging on the nose
    g.strokeStyle = '#0d0e12'; g.lineWidth = 5;
    for (let i = 0; i < 12; i++) { const x = (i + 0.5) * (1024 / 12); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
    g.lineWidth = 4; [300, 440].forEach(function(y) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); });
    const tex = new THREE.CanvasTexture(tc); tex.needsUpdate = true;
    const ec = document.createElement('canvas'); ec.width = 256; ec.height = 128;
    const eg = ec.getContext('2d'); eg.fillStyle = '#000'; eg.fillRect(0, 0, 256, 128);
    const eb = eg.createLinearGradient(0, 0, 0, 128); eb.addColorStop(0, 'rgba(34,197,94,1)'); eb.addColorStop(0.7, 'rgba(22,163,74,0.4)'); eb.addColorStop(0.85, 'rgba(0,0,0,0)');
    eg.fillStyle = eb; eg.beginPath(); eg.ellipse(64, 50, 38, 72, 0, 0, Math.PI * 2); eg.fill();
    const emap = new THREE.CanvasTexture(ec); emap.needsUpdate = true;
    // Hull geometry: faceted ellipsoid, pole on the nose, nose pinched to a point
    const geo = new THREE.SphereGeometry(1, 14, 12).rotateX(Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) * A, y = pos.getY(i) * B, z = pos.getZ(i) * C, f = taper(z);
      pos.setXYZ(i, x * f, y * f, z);
    }
    geo.computeVertexNormals();
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0b0b10, side: THREE.BackSide });
    const outline = function(m, k) { const o = new THREE.Mesh(m.geometry, outlineMat); o.scale.setScalar(k || 1.05); m.add(o); return m; };
    const hull = outline(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, emissive: new THREE.Color(0xffffff), emissiveMap: emap, emissiveIntensity: 0.55, roughness: 0.45, metalness: 0.15, flatShading: true })), 1.03);
    hull.position.y = CY;
    root.add(hull);
    const purple = new THREE.MeshStandardMaterial({ color: 0x8b3fd1, roughness: 0.4, flatShading: true });
    const purpleDk = new THREE.MeshStandardMaterial({ color: 0x5b21a6, roughness: 0.45, flatShading: true });
    const black = new THREE.MeshStandardMaterial({ color: 0x1b1c24, roughness: 0.5, metalness: 0.3, flatShading: true });
    const tan = new THREE.MeshStandardMaterial({ color: 0xd4a04a, roughness: 0.6 });
    const green = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const greenDk = new THREE.MeshBasicMaterial({ color: 0x14532d });
    const cream = new THREE.MeshBasicMaterial({ color: 0xf5f0b5 });
    const ink = new THREE.MeshBasicMaterial({ color: 0x0b0b10, side: THREE.DoubleSide });
    const place = function(obj, p, outDir) { obj.position.copy(p); obj.lookAt(p.x + outDir.x, p.y + outDir.y, p.z + outDir.z); root.add(obj); return obj; };
    // Angry half-moon eyes: flat edge on top, slanted down toward the nose
    [-1, 1].forEach(function(sd) {
      const e = new THREE.Group();
      const half = function(r, mat, z) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24, Math.PI, Math.PI), mat); m.position.z = z; e.add(m); return m; };
      half(0.52, ink, 0); half(0.45, green, 0.01);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 24, 1, Math.PI, Math.PI), cream); ring.position.set(0, -0.02, 0.02); e.add(ring);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18, Math.PI, Math.PI), new THREE.MeshBasicMaterial({ color: 0x4ade80 })); inner.position.set(0, -0.02, 0.025); e.add(inner);
      const p = surf(sd * 0.95, 0.12, 0.42, 1.01);
      place(e, p, new THREE.Vector3(sd, 0.1, 0.25));
      e.rotateZ(sd * 0.32);
      // stitches across a seam running from the top porthole down past the eye
      const seamPts = [];
      for (let k = 0; k < 7; k++) { const t = k / 6; seamPts.push(surf(sd * (0.45 + 0.6 * t), 0.95 - 1.7 * t, 0.62 - 0.25 * t, 1.012)); }
      for (let k = 0; k < 6; k++) {
        const a = seamPts[k], b = seamPts[k + 1], m = a.clone().add(b).multiplyScalar(0.5), L = a.distanceTo(b);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, L), ink); seg.position.copy(m); seg.lookAt(b); root.add(seg);
        if (k !== 2) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 8), k > 2 ? new THREE.MeshStandardMaterial({ color: 0xd9e27a, roughness: 0.6 }) : tan); st.position.copy(m); st.lookAt(b); st.rotateY(Math.PI / 2); st.rotateZ(0.5); root.add(st); }
      }
      // side portholes
      [[0.75, 0.55, 0.05, 0.17], [0.55, -0.35, 0.7, 0.14]].forEach(function(q) {
        const ph = new THREE.Group();
        const rimM = new THREE.Mesh(new THREE.CircleGeometry(q[3] * 1.3, 16), ink); ph.add(rimM);
        const gl = new THREE.Mesh(new THREE.CircleGeometry(q[3], 16), green); gl.position.z = 0.01; ph.add(gl);
        const sh2 = new THREE.Mesh(new THREE.CircleGeometry(q[3] * 0.55, 12), greenDk); sh2.position.set(-q[3] * 0.25, -q[3] * 0.2, 0.015); ph.add(sh2);
        ph.scale.set(1.35, 1, 1);
        place(ph, surf(sd * q[0], q[1], q[2], 1.012), new THREE.Vector3(sd * q[0], q[1], q[2] * 0.4));
      });
    });
    // top porthole
    { const ph = new THREE.Group(); ph.add(new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), ink)); const gl = new THREE.Mesh(new THREE.CircleGeometry(0.24, 18), green); gl.position.z = 0.01; ph.add(gl); ph.scale.set(1.3, 1, 1); place(ph, surf(0, 1, 0.38, 1.012), new THREE.Vector3(0, 1, 0.2)); }
    // Fins: flat extruded blades
    const blade = function(len, h, back) { const s2 = new THREE.Shape(); s2.moveTo(0, 0); s2.lineTo(len, 0); s2.lineTo(len * (1 - back), h); s2.closePath(); return new THREE.ExtrudeGeometry(s2, { depth: 0.12, bevelEnabled: false }).translate(-len / 2, 0, -0.06); };
    // three shark fins along the top (their back edge sweeps toward the tail)
    [[0.15, 1.15, 1.05], [-0.65, 1.0, 1.0], [-1.25, 0.75, 0.75]].forEach(function(f, i) {
      const fin = outline(new THREE.Mesh(blade(f[1], f[2], 0.9), i === 1 ? purpleDk : purple), 1.04);
      const p = surf(0, 1, f[0] / C * 1.6, 0.96);
      fin.position.set(0, p.y - 0.05, p.z); fin.rotation.y = -Math.PI / 2;
      root.add(fin);
    });
    // swept rear side fins + belly fins (flat blades, sweeping toward the tail)
    const finShape = function(len, wid) { const s3 = new THREE.Shape(); s3.moveTo(0, -0.3 * wid); s3.lineTo(0, 0.6 * wid); s3.lineTo(len, 1.25 * wid); s3.lineTo(len * 0.7, 0.3 * wid); s3.closePath(); return new THREE.ExtrudeGeometry(s3, { depth: 0.1, bevelEnabled: false }).translate(0, 0, -0.05).rotateX(-Math.PI / 2); };
    const sideFin = finShape(1.3, 1.0), bellyFin = finShape(0.8, 0.6);
    [-1, 1].forEach(function(sd) {
      const g1 = new THREE.Group(); g1.position.set(sd * A * 0.85, CY - 0.05, -C * 0.5); g1.scale.x = sd; g1.rotation.z = -sd * 0.45;
      g1.add(outline(new THREE.Mesh(sideFin, purple), 1.04)); root.add(g1);
      const g2 = new THREE.Group(); g2.position.set(sd * A * 0.5, CY - B * 0.7, -C * 0.55); g2.scale.x = sd; g2.rotation.z = -sd * 1.05;
      g2.add(outline(new THREE.Mesh(bellyFin, purpleDk), 1.05)); root.add(g2);
    });
    // Black spears stuck in the back (shaft, diamond head, crossguard)
    [[-0.35, 0.7, -0.95, 0.5, 0.4], [0.3, 0.85, -1.15, 0.65, -0.35], [-0.1, 0.4, -1.55, 0.25, 0.1], [0.45, 0.25, -1.45, 0.15, -0.6], [-0.5, 0.15, -1.4, -0.05, 0.7]].forEach(function(q) {
      const sp = new THREE.Group();
      sp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6), black));
      const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), black); head.scale.set(0.7, 1.9, 0.3); head.position.y = 0.95; sp.add(head);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05), black); guard.position.y = 0.55; sp.add(guard);
      const p = surf(q[0], q[1], q[2], 0.9);
      sp.position.copy(p);
      sp.rotation.set(-1.1 - q[3] * 0.4, 0, q[4]);
      sp.translateY(0.55);
      root.add(sp);
    });
    // tail cap
    const tail = outline(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 8).rotateX(-Math.PI / 2), purpleDk), 1.05);
    tail.position.set(0, CY, -C * 0.86 - 0.2); root.add(tail);
    const fxFn = addBossFx(root, 'LYCH');
    root.scale.setScalar(S);
    root.userData = { moabType: upper, baseHierarchyScale: S, propellers: [], isAuthenticB13: true, fx: fxFn };
    return root;
  }

  // BUILD 13.7: real BTD6 Bloonarius (round slime bloon, open fan barrel, two side eyes, spike ridge)
  function b13BloonariusTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    // u runs around the nose->tail axis: 12 meridian panels, top first
    // u = 0.75 is the top, u = 0.25 the belly
    const P = ['#f26a21', '#7cbf1a', '#5a8f12', '#8b4513', '#5a8f12', '#7cbf1a', '#f26a21', '#9bd11e', '#9bd11e', '#f26a21', '#9bd11e', '#9bd11e'];
    const w = 1024 / P.length;
    P.forEach(function(col, i) { g.fillStyle = col; g.fillRect(i * w, 0, w + 1, 256); });
    g.fillStyle = 'rgba(255,255,255,0.10)'; for (let i = 0; i < P.length; i++) g.fillRect(i * w + 4, 0, w * 0.35, 256);
    g.fillStyle = '#1f2a10'; for (let i = 0; i < P.length; i++) g.fillRect(i * w - 3, 0, 6, 256);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true;
    return t;
  }
  function buildBloonariusModel(upper) {
    const S = 4.3, R = 1.3, CY = 1.65;
    const root = new THREE.Group();
    const propellers = [];
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1410, side: THREE.BackSide });
    const outline = function(m, k) { const o = new THREE.Mesh(m.geometry, outlineMat); o.scale.setScalar(k || 1.05); m.add(o); return m; };
    const std = function(hex, o) { o = o || {}; return new THREE.MeshStandardMaterial({ color: hex, roughness: o.r === undefined ? 0.55 : o.r, metalness: o.m || 0, flatShading: o.flat !== false, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, emissive: new THREE.Color(o.e || 0), emissiveIntensity: o.ei || 1 }); };
    const orange = std(0xf26a21), red = std(0xd9361c), dark = new THREE.MeshBasicMaterial({ color: 0x141a0e, side: THREE.DoubleSide });
    // Body: faceted sphere with its pole on the nose, front cap cut away for the barrel opening
    const TH0 = 0.72;
    const bodyGeo = new THREE.SphereGeometry(R, 12, 9, 0, Math.PI * 2, TH0, Math.PI - TH0).rotateX(Math.PI / 2);
    const body = outline(new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ map: b13BloonariusTexture(), roughness: 0.5, flatShading: true, side: THREE.DoubleSide })), 1.035);
    body.scale.set(1.0, 0.94, 1.08);
    body.position.set(0, CY, 0);
    root.add(body);
    const mouthR = R * Math.sin(TH0) * 1.0, mouthZ = R * Math.cos(TH0) * 1.08;
    // Red-orange barrel rim + dark tunnel
    const rim = outline(new THREE.Mesh(new THREE.TorusGeometry(mouthR, 0.13, 8, 12), red), 1.06);
    rim.scale.set(1, 0.94, 1); rim.position.set(0, CY, mouthZ);
    root.add(rim);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(mouthR + 0.06, mouthR + 0.1, 0.32, 12, 1, true).rotateX(Math.PI / 2), orange);
    lip.material.side = THREE.DoubleSide; lip.scale.set(1, 0.94, 1); lip.position.set(0, CY, mouthZ - 0.12);
    root.add(lip);
    const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(mouthR - 0.02, mouthR * 0.85, 0.9, 12, 1, true).rotateX(Math.PI / 2), dark);
    tunnel.scale.set(1, 0.94, 1); tunnel.position.set(0, CY, mouthZ - 0.45);
    root.add(tunnel);
    const back = new THREE.Mesh(new THREE.CircleGeometry(mouthR * 0.86, 12), dark);
    back.position.set(0, CY, mouthZ - 0.88);
    root.add(back);
    // Fan: grey 2-blade propeller with a green spiral hub
    const fan = new THREE.Group();
    const grey = std(0xb8bcc2, { m: 0.2, r: 0.5 });
    [-1, 1].forEach(function(sd) { const bl = outline(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.06), grey), 1.06); bl.position.set(0, sd * 0.42, 0); bl.rotation.y = sd * 0.25; fan.add(bl); });
    const hub = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 12).rotateX(Math.PI / 2), grey), 1.06);
    fan.add(hub);
    const sc = document.createElement('canvas'); sc.width = 128; sc.height = 128;
    const sg = sc.getContext('2d'); sg.fillStyle = '#d1d5db'; sg.fillRect(0, 0, 128, 128); sg.strokeStyle = '#16a34a'; sg.lineWidth = 10; sg.beginPath();
    for (let i = 0; i < 120; i++) { const a = i * 0.16, r = 4 + i * 0.45; const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r; if (i === 0) sg.moveTo(x, y); else sg.lineTo(x, y); }
    sg.stroke();
    const spiral = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc) }));
    spiral.position.z = 0.085; fan.add(spiral);
    fan.position.set(0, CY, mouthZ - 0.3);
    root.add(fan);
    propellers.push(fan);
    // Two eyes: white disc in a thick dark octagon frame, one on each side near the front
    [-1, 1].forEach(function(sd) {
      const eye = new THREE.Group();
      eye.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a1410 })));
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      w.position.z = 0.02; eye.add(w);
      const A = R * 1.0, B = R * 0.94, C = R * 1.08;
      const d = new THREE.Vector3(sd * 0.8, 0.3, 0.55).normalize();
      const k = 1.0 / Math.sqrt(Math.pow(d.x / A, 2) + Math.pow(d.y / B, 2) + Math.pow(d.z / C, 2));
      eye.position.set(d.x * k * 1.01, CY + d.y * k * 1.01, d.z * k * 1.01);
      const nrm = new THREE.Vector3(d.x / (A * A), d.y / (B * B), d.z / (C * C)).normalize();
      eye.lookAt(eye.position.x + nrm.x, eye.position.y + nrm.y, eye.position.z + nrm.z);
      root.add(eye);
    });
    // Dark octagon bolt on top of the rim
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, flatShading: true }));
    bolt.position.set(0, CY + mouthR * 0.94 + 0.14, mouthZ - 0.1);
    root.add(bolt);
    // Spike ridge along the top, swept back
    [[0.3, 0.85, 0.3], [-0.15, 0.95, 0.33], [-0.6, 0.8, 0.3], [-0.98, 0.55, 0.24]].forEach(function(p) {
      const z = p[0] * R, y = CY + R * 0.94 * Math.sqrt(Math.max(0.05, 1 - Math.pow(z / (R * 1.08), 2)));
      const sp = outline(new THREE.Mesh(new THREE.ConeGeometry(p[2], p[1], 4), orange), 1.06);
      sp.position.set(0, y + p[1] * 0.35, z);
      sp.rotation.set(-0.55, Math.PI / 4, 0);
      root.add(sp);
      const edge = new THREE.Mesh(new THREE.ConeGeometry(p[2] * 0.55, p[1] * 0.6, 4), red);
      edge.position.set(0.01, y + p[1] * 0.28, z - 0.06); edge.rotation.copy(sp.rotation);
      root.add(edge);
    });
    // Side fins (big flat orange blades, swept back and down) + small rear fins + top tail fin
    const finShape = function(len, wid) { const sh = new THREE.Shape(); sh.moveTo(0, -0.35 * wid); sh.lineTo(0, 0.55 * wid); sh.lineTo(len, 1.15 * wid); sh.lineTo(len * 0.72, 0.25 * wid); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }).translate(0, 0, -0.05).rotateX(-Math.PI / 2); };
    const bigFin = finShape(1.2, 1.15), smallFin = finShape(0.6, 0.55);
    [-1, 1].forEach(function(sd) {
      const g1 = new THREE.Group(); g1.position.set(sd * R * 0.9, CY - 0.38, -0.25); g1.scale.x = sd; g1.rotation.z = -sd * 0.8; g1.rotation.y = sd * 0.15;
      g1.add(outline(new THREE.Mesh(bigFin, orange), 1.04)); root.add(g1);
      const edge = new THREE.Mesh(finShape(1.0, 0.85), red); edge.position.set(0.08, -0.06, -0.05); g1.add(edge);
      const g2 = new THREE.Group(); g2.position.set(sd * R * 0.55, CY + 0.25, -R * 0.95); g2.scale.x = sd; g2.rotation.z = -sd * 0.2;
      g2.add(outline(new THREE.Mesh(smallFin, orange), 1.05)); root.add(g2);
    });
    const tg = new THREE.Group(); tg.position.set(0, CY + 0.55, -R * 0.95); tg.rotation.z = Math.PI / 2;
    tg.add(outline(new THREE.Mesh(smallFin, orange), 1.05)); root.add(tg);
    const tail = outline(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), red), 1.06);
    tail.position.set(0, CY, -R * 1.12); tail.rotation.x = -Math.PI / 2;
    root.add(tail);
    const fxFn = addBossFx(root, 'BLOONARIUS');
    root.scale.setScalar(S);
    root.userData = { moabType: upper, baseHierarchyScale: S, propellers: propellers, isAuthenticB13: true, fx: fxFn };
    return root;
  }

  function buildAuthentic3DAirshipOrBoss(rawType) {
    const upper = String(rawType || 'MOAB').toUpperCase();
    const isFortified = upper.indexOf('FORTIFIED_') === 0;
    const t = upper.replace('FORTIFIED_', '');

    if (window.CustomModelRegistry && typeof window.CustomModelRegistry[upper] === 'function') {
      return window.CustomModelRegistry[upper](upper);
    }
    if (t === 'VORTEX') return buildVortexBossModel(upper);
    if (t === 'BLOONARIUS' && !isFortified) return buildBloonariusModel(upper);
    if (t === 'LYCH' && !isFortified) return buildLychModel(upper);

    const HIERARCHY = {
      MOAB:           { scale: 1.25, w: 0.96, h: 0.92, l: 1.48, finCol: 0x0284c7, ribCol: 0x0369a1, engines: 0 },
      DDT:            { scale: 1.55, w: 0.84, h: 0.82, l: 1.58, finCol: 0x334155, ribCol: 0x0f172a, engines: 0, isDdt: true },
      BFB:            { scale: 2.00, w: 1.18, h: 1.05, l: 1.55, finCol: 0xb91c1c, ribCol: 0x7f1d1d, engines: 2, podCol: 0xb91c1c, cowlCol: 0xffffff },
      ZOMG:           { scale: 2.75, w: 1.24, h: 1.10, l: 1.66, finCol: 0x84cc16, ribCol: 0x18181b, engines: 4, podCol: 0x27272a, cowlCol: 0x84cc16 },
      BAD:            { scale: 3.70, w: 1.35, h: 1.18, l: 1.78, finCol: 0xa855f7, ribCol: 0x581c87, engines: 4, podCol: 0x7e22ce, cowlCol: 0xffffff, isBad: true },
      BLOONARIUS:     { scale: 4.30, w: 1.38, h: 1.22, l: 1.72, finCol: 0x4d7c0f, ribCol: 0x365314, engines: 0, boss: 'bloonarius' },
      LYCH:           { scale: 4.25, w: 1.20, h: 1.12, l: 1.75, finCol: 0x1f1b2b, ribCol: 0x3b0764, engines: 0, boss: 'lych' },
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
      roughness: t === 'BLOONARIUS' ? 0.22 : 0.38,
      metalness: t === 'DDT' ? 0.45 : 0.14,
      emissive: new THREE.Color(t === 'BLOONARIUS' ? 0x1a2e05 : 0x000000),
      emissiveIntensity: t === 'BLOONARIUS' ? 0.35 : 1
    });
    const finMat = new THREE.MeshStandardMaterial({ color: cfg.finCol, roughness: 0.38, metalness: 0.22 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.72 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45, metalness: 0.4 });

    const buildHullBody = function(offsetX) {
      const hGrp = new THREE.Group();
      const hullGeo = new THREE.SphereGeometry(1.15, 32, 24);
      hullGeo.rotateX(Math.PI / 2);
      hullGeo.rotateZ(Math.PI / 2); // texture centre (faces, skulls, portholes) sits on TOP
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
      const rustMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7, metalness: 0.35 });
      const mouthRim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.16, 10, 24), rustMat);
      mouthRim.position.set(0, 1.65, 1.12 * cfg.l);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.92, 0.75, 22, 1, true).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.75, metalness: 0.3, side: THREE.DoubleSide }));
      barrel.position.set(0, 1.65, 1.0 * cfg.l);
      group.add(barrel);
      const throat = new THREE.Mesh(new THREE.CircleGeometry(0.74, 22), new THREE.MeshBasicMaterial({ color: 0x0b1a05 }));
      throat.position.set(0, 1.65, 0.86 * cfg.l);
      group.add(throat);
      const ooze = new THREE.MeshStandardMaterial({ color: 0xa3e635, emissive: new THREE.Color(0x4d7c0f), emissiveIntensity: 0.6, roughness: 0.15 });
      for (let d = 0; d < 7; d++) {
        const a = Math.PI * (1.15 + d * 0.1);
        const drip = new THREE.Mesh(new THREE.SphereGeometry(0.11 + (d % 3) * 0.03, 10, 8), ooze);
        drip.scale.set(1, 1.8 + (d % 2), 1);
        drip.position.set(Math.cos(a) * 0.86, 1.65 + Math.sin(a) * 0.86 - 0.12, 1.06 * cfg.l);
        group.add(drip);
      }
      for (let rv = 0; rv < 10; rv++) { const ra = rv / 10 * Math.PI * 2; const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), steelMat); bolt.position.set(Math.cos(ra) * 0.9, 1.65 + Math.sin(ra) * 0.9, 0.92 * cfg.l); group.add(bolt); }
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
      const spikeMat = new THREE.MeshStandardMaterial({ color: 0x1c1726, roughness: 0.35, metalness: 0.3 });
      const tipMat = new THREE.MeshStandardMaterial({ color: 0x7e22ce, emissive: new THREE.Color(0x581c87), emissiveIntensity: 0.6, roughness: 0.3 });
      for (let s = 0; s < 7; s++) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.2 - s * 0.012, 1.15 - s * 0.06, 5), s % 2 ? tipMat : spikeMat);
        sp.position.set((s % 2 === 0 ? -0.3 : 0.3) * (1 - s * 0.08), 2.72 - s * 0.05, 0.75 - s * 0.32);
        sp.rotation.set(-0.85, 0, (s % 2 === 0 ? 0.25 : -0.25));
        group.add(sp);
      }
      for (let s = 0; s < 5; s++) {
        const sh = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9, 4), spikeMat);
        sh.position.set(-0.55 + s * 0.27, 2.2 + Math.sin(s) * 0.2, -1.55);
        sh.rotation.set(-1.0 + s * 0.12, 0, -0.5 + s * 0.25);
        group.add(sh);
      }
      const belly = new THREE.Mesh(new THREE.SphereGeometry(1.18, 28, 14, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      belly.scale.set(cfg.w, cfg.h, cfg.l);
      belly.position.set(0, 1.62, 0);
      group.add(belly);
      const stitchMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.6 });
      for (let s = 0; s < 6; s++) {
        const st2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.28), stitchMat);
        st2.position.set(1.15 * cfg.w * 0.98, 1.65 + 0.1, -0.7 + s * 0.28);
        st2.rotation.y = s % 2 ? 0.6 : -0.6;
        group.add(st2);
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

    const b13BossFx = addBossFx(group, t);
    group.scale.setScalar(cfg.scale);
    group.userData = {
      moabType: upper,
      baseHierarchyScale: cfg.scale,
      propellers: propellers,
      isAuthenticB13: true,
      fx: b13BossFx
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
    // ========================================================================
    // Build 13.1 UNIT GEAR LIBRARY: unique T1-T5 gear for all 10 Heroes (x3 paths)
    // and all 14 Companions. Authored in the createFullMonkeyMesh frame
    // (head centre 0,1.45,0.05 r0.52) and auto-fitted to any unit mesh.
    // ========================================================================
    const GA = { hy: 1.45, hz: 0.05, hr: 0.52, top: 1.97, eyeY: 1.5, face: 0.58, rh: [0.52, 0.62, 0.3], lh: [-0.52, 0.62, 0.26] };
    const b13MatCache = new Map();
    function gm(hex, kind, emi, emiI, metalV, roughV, op) {
      const key = hex + '|' + kind + '|' + emi + '|' + emiI + '|' + metalV + '|' + roughV + '|' + op;
      let m = b13MatCache.get(key);
      if (m) return m;
      const opacity = op === undefined ? 1 : op;
      if (kind === 'glow') {
        m = new THREE.MeshBasicMaterial({ color: hex, transparent: opacity < 1, opacity: opacity, side: THREE.DoubleSide, depthWrite: opacity >= 1 });
      } else {
        m = new THREE.MeshStandardMaterial({ color: hex, roughness: roughV, metalness: metalV, side: THREE.DoubleSide, transparent: opacity < 1, opacity: opacity, depthWrite: opacity >= 1 });
        if (emi !== null && emi !== undefined) { m.emissive = new THREE.Color(emi); m.emissiveIntensity = emiI; }
      }
      b13MatCache.set(key, m);
      return m;
    }
    function glow(hex, op) { return gm(hex, 'glow', null, 0, 0, 0, op); }
    function metal(hex) { return gm(hex, 'std', null, 0, 0.85, 0.25); }
    function cloth(hex) { return gm(hex, 'std', null, 0, 0.05, 0.75); }
    function wood(hex) { return gm(hex === undefined ? 0x78350f : hex, 'std', null, 0, 0.05, 0.8); }
    function emis(hex, e, i) { return gm(hex, 'std', e === undefined ? hex : e, i === undefined ? 0.6 : i, 0.3, 0.35); }
    function ghost(hex, op) { return gm(hex, 'std', hex, 0.7, 0.1, 0.3, op === undefined ? 0.6 : op); }
    const GOLD = 0xfacc15, STEEL = 0xcbd5e1, DARK = 0x1e293b, BLACK = 0x0f0f12;

    function ad(g, geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
      m.name = 'b13_gear';
      g.add(m);
      return m;
    }
    function sub(g, x, y, z, rx, ry, rz, s) {
      const c = new THREE.Group();
      c.name = 'b13_gear_grp';
      c.position.set(x || 0, y || 0, z || 0);
      c.rotation.set(rx || 0, ry || 0, rz || 0);
      if (s !== undefined) c.scale.setScalar(s);
      g.add(c);
      return c;
    }
    const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const Cyl = (a, b, h, n, open) => new THREE.CylinderGeometry(a, b, h, n || 12, 1, !!open);
    const Cone = (r, h, n) => new THREE.ConeGeometry(r, h, n || 10);
    const Sph = (r, a, b) => new THREE.SphereGeometry(r, a || 14, b || 12);
    const Tor = (r, t, arc) => new THREE.TorusGeometry(r, t, 8, 24, arc === undefined ? Math.PI * 2 : arc);
    const Oct = (r) => new THREE.OctahedronGeometry(r);
    function spin(g, o, ax, s) { g.userData.spin.push({ o: o, ax: ax, s: s }); return o; }
    function orbit(g, maker, n, r, y, s, bob, face) {
      for (let i = 0; i < n; i++) {
        const o = maker(g, i);
        o.position.set(r, y, 0);
        g.userData.orbit.push({ o: o, r: r, y: y, s: s, ph: (i / n) * Math.PI * 2, bob: bob || 0, face: !!face });
      }
    }
    // Radial cones in XZ plane, pointing outward
    function radial(g, n, dist, rad, len, mat, y) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ad(g, Cone(rad, len, 3), mat, Math.cos(a) * dist, y || 0, Math.sin(a) * dist, 0, -a, -Math.PI / 2);
      }
    }
    function hand(g, side) { const p = side > 0 ? GA.rh : GA.lh; return sub(g, p[0], p[1], p[2]); }

    // ---------- HEAD SLOT ----------
    function hood(g, col, mat) { return ad(g, new THREE.SphereGeometry(0.6, 22, 14, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.62), mat || cloth(col), 0, GA.hy + 0.02, GA.hz - 0.02); }
    function cap(g, mat, r, frac) { return ad(g, new THREE.SphereGeometry(r || 0.57, 22, 12, 0, Math.PI * 2, 0, Math.PI * (frac || 0.42)), mat, 0, GA.hy + 0.02, GA.hz); }
    function visor(g, col, w) {
      ad(g, Box(w || 0.66, 0.12, 0.1), glow(col), 0, GA.eyeY, GA.face);
      [-0.16, 0.16].forEach(function(x) { ad(g, Sph(0.045, 8, 8), glow(0xffffff), x, GA.eyeY, GA.face + 0.06); });
    }
    function goggles(g, frame, lens, n) {
      const xs = n === 4 ? [-0.27, -0.11, 0.11, 0.27] : [-0.16, 0.16];
      ad(g, Box(0.98, 0.06, 0.06), metal(frame), 0, GA.eyeY + 0.02, GA.face - 0.12);
      xs.forEach(function(x) {
        ad(g, Cyl(0.085, 0.095, 0.2, 12), metal(frame), x, GA.eyeY, GA.face + 0.04, Math.PI / 2);
        ad(g, new THREE.CircleGeometry(0.075, 14), glow(lens), x, GA.eyeY, GA.face + 0.145);
      });
    }
    function headband(g, mat, tails) {
      ad(g, Tor(0.545, 0.045), mat, 0, GA.hy + 0.14, GA.hz, Math.PI / 2);
      if (tails) [-0.07, 0.07].forEach(function(x, i) { ad(g, Box(0.07, 0.4, 0.02), mat, x, GA.hy - 0.02, GA.hz - 0.56, 0.45, 0, i ? 0.18 : -0.18); });
    }
    function crown(g, mat, n, h, tall) {
      const y = GA.top - 0.08;
      ad(g, Cyl(0.32, 0.35, 0.14, 20, true), mat, 0, y, GA.hz);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.PI / 2;
        ad(g, Cone(0.055, (tall && i === 0) ? h * 1.5 : h, 4), mat, Math.cos(a) * 0.33, y + 0.07 + h / 2, GA.hz + Math.sin(a) * 0.33);
      }
    }
    function hatCone(g, mat, h, r, brimMat, tilt) {
      const y = GA.top - 0.1;
      if (brimMat) ad(g, Cyl(r * 1.6, r * 1.6, 0.05, 26), brimMat, 0, y, GA.hz);
      ad(g, Cone(r, h, 20), mat, 0, y + h / 2, GA.hz, -(tilt || 0.08), 0, 0.06);
    }
    function cowboyHat(g, mat, bandMat) {
      const y = GA.top - 0.12;
      ad(g, Cyl(0.85, 0.85, 0.05, 28), mat, 0, y, GA.hz, 0, 0, 0, 1, 1, 0.82);
      ad(g, Cyl(0.36, 0.42, 0.42, 20), mat, 0, y + 0.21, GA.hz);
      ad(g, Cyl(0.425, 0.425, 0.08, 20), bandMat, 0, y + 0.05, GA.hz);
    }
    function horns(g, mat, len, spread, curl) {
      [-1, 1].forEach(function(s) { ad(g, Cone(0.08, len, 8), mat, s * (spread || 0.3), GA.top - 0.12 + len / 2.4, GA.hz, 0, 0, -s * (curl || 0.45)); });
    }
    function antlers(g, mat, big) {
      [-1, 1].forEach(function(s) {
        const a = sub(g, s * 0.26, GA.top - 0.1, GA.hz, 0, 0, -s * 0.35);
        ad(a, Cyl(0.03, 0.04, big ? 0.7 : 0.45, 6), mat, 0, (big ? 0.35 : 0.22), 0);
        ad(a, Cyl(0.02, 0.03, 0.3, 6), mat, s * 0.1, (big ? 0.45 : 0.28), 0, 0, 0, -s * 0.9);
        ad(a, Cyl(0.02, 0.03, 0.26, 6), mat, -s * 0.08, (big ? 0.6 : 0.36), 0, 0, 0, s * 0.7);
        if (big) ad(a, Cyl(0.02, 0.025, 0.24, 6), mat, s * 0.1, 0.72, 0, 0, 0, -s * 0.8);
      });
    }
    function featherCrest(g, matA, matB, n) {
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * 0.28;
        ad(g, Cone(0.07, 0.62, 4), i % 2 ? matB : matA, Math.sin(a) * 0.22, GA.top + 0.18, GA.hz - 0.05 - Math.abs(a) * 0.1, -0.25, 0, -a, 1, 1, 0.35);
      }
    }
    function mask(g, mat) { ad(g, Box(0.62, 0.24, 0.14), mat, 0, GA.hy - 0.18, GA.face - 0.02); }
    function headset(g) {
      ad(g, Tor(0.56, 0.035, Math.PI), metal(DARK), 0, GA.hy + 0.02, GA.hz, 0, 0, 0);
      [-1, 1].forEach(function(s) { ad(g, Cyl(0.13, 0.13, 0.08, 14), metal(DARK), s * 0.56, GA.hy, GA.hz, 0, 0, Math.PI / 2); });
      ad(g, Cyl(0.015, 0.015, 0.4, 6), metal(DARK), -0.45, GA.hy - 0.18, GA.hz + 0.25, 0.9, 0, 0.3);
      ad(g, Sph(0.04), glow(0x22c55e), -0.36, GA.hy - 0.3, GA.hz + 0.44);
    }

    // ---------- BACK / BODY SLOT ----------
    function cape(g, mat, len, w) {
      const L = len || 1.0;
      ad(g, new THREE.PlaneGeometry(w || 0.8, L), mat, 0, 1.18 - L / 2, -0.42, 0.18, 0, 0);
    }
    function wings(g, matA, matB, n, span, y) {
      [-1, 1].forEach(function(s) {
        const w = sub(g, s * 0.32, y || 1.05, -0.36);
        for (let f = 0; f < n; f++) ad(w, Cone(0.12, (span || 1.0) - f * 0.16, 4), f % 2 ? matB : matA, s * (0.24 + f * 0.13), 0.22 - f * 0.12, 0, 0, 0, -s * (0.95 + f * 0.3), 1, 1, 0.3);
      });
    }
    function pauldrons(g, mat, spikes, spikeMat) {
      [-1, 1].forEach(function(s) {
        ad(g, Sph(0.21, 12, 10), mat, s * 0.46, 1.1, 0, 0, 0, 0, 1.15, 0.7, 1.05);
        for (let k = 0; k < (spikes || 0); k++) ad(g, Cone(0.04, 0.2, 5), spikeMat || mat, s * (0.42 + k * 0.08), 1.25, -0.06 + k * 0.06, 0, 0, -s * 0.5);
      });
    }
    function chestplate(g, mat, emblem) {
      ad(g, new THREE.CylinderGeometry(0.41, 0.33, 0.6, 18, 1, true, -Math.PI * 0.42, Math.PI * 0.84), mat, 0, 0.84, 0);
      if (emblem !== undefined) ad(g, new THREE.CircleGeometry(0.1, 18), glow(emblem), 0, 0.94, 0.42);
    }
    function bracers(g, mat) { [GA.rh, GA.lh].forEach(function(p) { ad(g, Cyl(0.12, 0.12, 0.2, 12), mat, p[0] * 0.92, p[1] + 0.1, p[2] * 0.7, -0.5); }); }
    function belt(g, matBelt, pouchMat, n) {
      ad(g, Tor(0.33, 0.05), matBelt, 0, 0.53, 0, Math.PI / 2);
      for (let i = 0; i < n; i++) { const a = -0.9 + (i / Math.max(1, n - 1)) * 1.8; ad(g, Box(0.13, 0.15, 0.08), pouchMat, Math.sin(a) * 0.36, 0.5, Math.cos(a) * 0.32, 0, a, 0); }
    }
    function backpack(g, mat, w, h, d) { return ad(g, Box(w || 0.5, h || 0.55, d || 0.26), mat, 0, 0.9, -0.44); }
    function quiver(g, mat, n, tipMat, shaftMat) {
      const q = sub(g, 0.18, 1.0, -0.42, 0.25, 0, -0.35);
      ad(q, Cyl(0.11, 0.09, 0.62, 12), mat, 0, 0, 0);
      for (let i = 0; i < n; i++) {
        const x = ((i % 3) - 1) * 0.05, z = (Math.floor(i / 3) - 0.5) * 0.05;
        ad(q, Cyl(0.012, 0.012, 0.3, 5), shaftMat || wood(0xd6b78a), x, 0.42, z);
        ad(q, Cone(0.03, 0.08, 5), tipMat || metal(STEEL), x, 0.6, z);
      }
      return q;
    }
    function jetpack(g, mat, flameCol, nozzles) {
      const j = sub(g, 0, 0.92, -0.46);
      const n = nozzles || 2;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : (-0.17 + (i / (n - 1)) * 0.34) * (n > 2 ? 1.2 : 1);
        ad(j, Cyl(0.11, 0.12, 0.5, 12), mat, x, 0, 0);
        ad(j, Cone(0.1, 0.36, 10), glow(flameCol, 0.85), x, -0.42, 0, Math.PI);
      }
      return j;
    }
    function aura(g, col, op, r) { ad(g, Sph(r || 0.95, 18, 14), glow(col, op || 0.16), 0, 1.0, 0); }
    function groundDisc(g, mat, r) { ad(g, Cyl(r || 0.75, r || 0.75, 0.04, 6), mat, 0, 0.03, 0); }

    // ---------- HAND SLOT ----------
    function bow(hg, mat, size, strMat) {
      const b = sub(hg, 0, 0.1, 0.05, 0, Math.PI / 2, 0);
      ad(b, Tor(size, 0.035, Math.PI * 1.15), mat, 0, 0, 0, 0, 0, Math.PI / 2 - Math.PI * 0.575);
      ad(b, Cyl(0.008, 0.008, size * 1.8, 4), strMat || glow(0xf8fafc), -size * 0.32, 0, 0);
      return b;
    }
    function blade(hg, mat, len, edgeMat, guardMat) {
      const k = sub(hg, 0, 0.05, 0.06, 0.55, 0, 0);
      ad(k, Cyl(0.035, 0.035, 0.24, 8), wood(0x111827), 0, 0, 0);
      ad(k, Cyl(0.09, 0.09, 0.03, 10), guardMat || metal(GOLD), 0, 0.13, 0);
      ad(k, Box(0.05, len, 0.11), mat, 0, 0.15 + len / 2, 0);
      if (edgeMat) ad(k, Box(0.012, len, 0.12), edgeMat, 0.028, 0.15 + len / 2, 0);
      return k;
    }
    function staff(hg, mat, len, topMat, topR) {
      const s = sub(hg, 0, 0, 0.04);
      ad(s, Cyl(0.035, 0.045, len, 8), mat, 0, len / 2 - 0.35, 0);
      if (topMat) ad(s, Sph(topR || 0.13, 14, 12), topMat, 0, len - 0.3, 0);
      return s;
    }
    function gun(hg, mat, len, r, tipMat, barrels) {
      const g2 = sub(hg, 0, 0.02, 0.08);
      ad(g2, Box(0.12, 0.2, 0.08), mat, 0, -0.04, -0.06, 0.25);
      const n = barrels || 1;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : (i - (n - 1) / 2) * r * 2.2;
        ad(g2, Cyl(r, r * 1.1, len, 12), mat, x, 0.06, len / 2, Math.PI / 2);
        if (tipMat) ad(g2, Sph(r * 1.05, 10, 8), tipMat, x, 0.06, len + 0.01);
      }
      return g2;
    }
    function flask(hg, liquidCol, r) {
      const f = sub(hg, 0, 0.06, 0.06);
      ad(f, Sph(r || 0.12, 14, 12), glow(liquidCol, 0.88), 0, 0, 0);
      ad(f, Cyl(0.035, 0.04, 0.12, 10), glow(0xe2e8f0, 0.8), 0, (r || 0.12) + 0.04, 0);
      ad(f, Cyl(0.042, 0.042, 0.05, 10), wood(0x92400e), 0, (r || 0.12) + 0.12, 0);
      return f;
    }
    function trident(hg, mat, glowMat) {
      const t = sub(hg, 0, 0, 0.05);
      ad(t, Cyl(0.03, 0.035, 1.3, 8), mat, 0, 0.3, 0);
      [-0.1, 0, 0.1].forEach(function(x, i) { ad(t, Cone(0.035, i === 1 ? 0.3 : 0.22, 6), glowMat || mat, x, 1.0 + (i === 1 ? 0.04 : 0), 0); });
      ad(t, Box(0.26, 0.04, 0.04), mat, 0, 0.9, 0);
      return t;
    }
    function crossbow(hg, mat, size, glowMat) {
      const c = sub(hg, 0, 0.08, 0.1);
      ad(c, Box(0.07, 0.07, 0.6 * size), wood(0x5b3a1a), 0, 0, 0.2);
      ad(c, Tor(0.3 * size, 0.025, Math.PI * 0.9), mat, 0, 0, 0.42 * size, Math.PI / 2, 0, Math.PI * 0.05);
      if (glowMat) ad(c, Cone(0.03, 0.12, 6), glowMat, 0, 0.04, 0.55 * size, Math.PI / 2);
      return c;
    }
    function spear(hg, mat, tipMat, len) {
      const s = sub(hg, 0, 0, 0.05, 0.3);
      ad(s, Cyl(0.03, 0.03, len || 1.3, 8), mat, 0, 0.3, 0);
      ad(s, Cone(0.07, 0.32, 6), tipMat, 0, 0.3 + (len || 1.3) / 2 + 0.14, 0);
      return s;
    }
    function boomer(hg, mat) {
      const b = sub(hg, 0, 0.1, 0.1, Math.PI / 2, 0, 0);
      ad(b, Box(0.36, 0.06, 0.09), mat, 0.12, 0, 0, 0, 0, 0.5);
      ad(b, Box(0.36, 0.06, 0.09), mat, -0.12, 0, 0, 0, 0, -0.5);
      return b;
    }
    function laptop(g, screenCol) {
      const l = sub(g, 0, 0.66, 0.42, -0.25);
      ad(l, Box(0.6, 0.04, 0.4), metal(0x334155), 0, 0, 0);
      ad(l, Box(0.6, 0.38, 0.03), metal(0x334155), 0, 0.2, -0.2, -0.25);
      ad(l, Box(0.54, 0.32, 0.01), glow(screenCol), 0, 0.2, -0.18, -0.25);
      return l;
    }

    // ---------- ORBIT ITEM MAKERS ----------
    const mkOrb = (col, r) => function(g) { return ad(g, Sph(r || 0.11, 12, 10), glow(col)); };
    const mkShard = (col) => function(g) { return spin(g, ad(g, Oct(0.1), glow(col, 0.9)), 'y', 4); };
    const mkCoin = () => function(g) { return spin(g, ad(g, Cyl(0.11, 0.11, 0.025, 16), metal(GOLD), 0, 0, 0, Math.PI / 2), 'y', 5); };
    const mkBlade = (mat) => function(g) { const b = sub(g); ad(b, Box(0.05, 0.5, 0.1), mat, 0, 0, 0, 0, 0, Math.PI / 2); return spin(g, b, 'y', 8); };
    const mkGlaive = (mat) => function(g) { const b = sub(g); ad(b, Tor(0.2, 0.035, Math.PI * 1.35), mat, 0, 0, 0, Math.PI / 2); return spin(g, b, 'y', 10); };
    const mkShuriken = (mat) => function(g) { const b = sub(g); ad(b, Cyl(0.045, 0.045, 0.03, 10), mat); radial(b, 4, 0.1, 0.045, 0.16, mat, 0); return spin(g, b, 'y', 14); };
    const mkFire = () => function(g) { const b = sub(g); ad(b, Sph(0.1, 10, 8), glow(0xfde047)); ad(b, Sph(0.16, 10, 8), glow(0xf97316, 0.5)); return b; };
    const mkLeaf = (col) => function(g) { return spin(g, ad(g, Sph(0.1, 8, 6), cloth(col), 0, 0, 0, 0, 0, 0, 1, 0.25, 1.8), 'x', 3); };
    const mkScreen = (col) => function(g) { const b = sub(g); ad(b, Box(0.32, 0.22, 0.01), glow(col, 0.75)); ad(b, Box(0.34, 0.24, 0.005), glow(0xffffff, 0.25), 0, 0, -0.01); return b; };
    const mkVirus = (col) => function(g) { const b = sub(g); ad(b, Sph(0.09, 10, 8), glow(col)); radial(b, 6, 0.1, 0.02, 0.08, glow(col), 0); return spin(g, b, 'x', 3); };
    const mkPotion = (col) => function(g) { const b = sub(g); ad(b, Sph(0.08, 10, 8), glow(col, 0.9)); ad(b, Cyl(0.025, 0.03, 0.08, 8), glow(0xe2e8f0, 0.8), 0, 0.1, 0); return b; };
    const mkSnow = () => function(g) { const b = sub(g); for (let i = 0; i < 3; i++) ad(b, Box(0.28, 0.03, 0.03), glow(0xe0f2fe), 0, 0, 0, 0, 0, (i / 3) * Math.PI); return spin(g, b, 'z', 2); };
    const mkSpirit = (col) => function(g) { const b = sub(g); ad(b, Box(0.14, 0.12, 0.3), ghost(col), 0, 0, 0); ad(b, Sph(0.08), ghost(col), 0, 0.06, 0.18); [-0.04, 0.04].forEach(function(x) { ad(b, Cone(0.025, 0.07, 4), ghost(col), x, 0.15, 0.18); }); return b; };
    const mkRaven = (col) => function(g) { const b = sub(g); ad(b, Sph(0.08, 10, 8), cloth(col), 0, 0, 0, 0, 0, 0, 0.8, 0.8, 1.6); ad(b, Cone(0.02, 0.07, 4), metal(GOLD), 0, 0, 0.15, Math.PI / 2); [-1, 1].forEach(function(s) { ad(b, Cone(0.06, 0.28, 3), cloth(col), s * 0.15, 0.02, 0, 0, 0, -s * Math.PI / 2, 1, 1, 0.25); }); return b; };
    const mkArrow = (mat) => function(g) { const b = sub(g); ad(b, Cyl(0.015, 0.015, 0.4, 5), wood(0xd6b78a), 0, 0, 0, Math.PI / 2); ad(b, Cone(0.04, 0.12, 6), mat, 0, 0, 0.24, Math.PI / 2); return b; };
    const mkCard = (col) => function(g) { return spin(g, ad(g, Box(0.16, 0.24, 0.01), emis(col, col, 0.4)), 'y', 3); };
    const mkGear = (mat) => function(g) { const b = sub(g); ad(b, Cyl(0.09, 0.09, 0.04, 10), mat, 0, 0, 0, Math.PI / 2); radial(sub(b, 0, 0, 0, Math.PI / 2), 8, 0.1, 0.02, 0.05, mat, 0); return spin(g, b, 'z', 3); };
    const mkBird = (col) => function(g) { const b = sub(g); ad(b, Sph(0.07, 10, 8), cloth(col), 0, 0, 0, 0, 0, 0, 0.9, 0.8, 1.5); [-1, 1].forEach(function(s) { ad(b, Cone(0.05, 0.22, 3), cloth(col), s * 0.12, 0.03, 0, 0, 0, -s * Math.PI / 2, 1, 1, 0.3); }); ad(b, Cone(0.02, 0.05, 4), metal(GOLD), 0, 0, 0.12, Math.PI / 2); return b; };

    // Generic sawblade (Tack)
    function sawRing(g, r, teeth, mat, y) {
      const s = sub(g, 0, y, 0);
      ad(s, Cyl(r, r, 0.035, 36), mat);
      ad(s, Cyl(r * 0.22, r * 0.22, 0.07, 16), metal(DARK));
      radial(s, teeth, r * 1.06, r * 0.1, r * 0.24, mat, 0);
      return s;
    }

    // ========================================================================
    // HERO PATH BUILDERS  [path0 = volley, path1 = weapon/elemental, path2 = explosive/utility]
    // ========================================================================
    const HERO_GEAR = {
      quincy: [
        function(g, T) { // Storm Bow -> Master Bowman
          const L = hand(g, -1);
          bow(L, T >= 5 ? metal(GOLD) : (T >= 4 ? metal(0x334155) : wood(0x8b5a2b)), 0.32 + T * 0.04, T >= 4 ? glow(0x67e8f9) : undefined);
          if (T >= 3) quiver(g, cloth(0x166534), T >= 5 ? 9 : 6, T >= 4 ? glow(0x67e8f9) : undefined); else quiver(g, cloth(0x166534), 3);
          if (T >= 4) orbit(g, mkShard(0x67e8f9), 3, 0.85, 1.35, 2.4, 0.08);
          if (T >= 4) cape(g, cloth(0x15803d), 0.9);
          if (T >= 5) { featherCrest(g, metal(GOLD), cloth(0xffffff), 5); wings(g, metal(GOLD), cloth(0xffffff), 3, 1.0); }
        },
        function(g, T) { // Bodkins -> Titan Piercer
          bracers(g, metal(STEEL));
          bow(hand(g, -1), metal(T >= 4 ? 0x475569 : STEEL), 0.36 + T * 0.03);
          quiver(g, metal(0x475569), 6, metal(T >= 4 ? 0xef4444 : STEEL));
          if (T >= 3) pauldrons(g, metal(STEEL));
          if (T >= 4) { chestplate(g, metal(0x64748b), 0xef4444); cap(g, metal(0x64748b), 0.58, 0.38); visor(g, 0xef4444, 0.5); }
          if (T >= 5) { const bolt = sub(g, 0, 1.05, -0.5, 0, 0, 0.6); ad(bolt, Cyl(0.05, 0.05, 1.8, 8), metal(GOLD), 0, 0, 0); ad(bolt, Cone(0.14, 0.4, 6), metal(0xef4444), 0, 1.05, 0); cape(g, cloth(0x991b1b), 1.0); }
        },
        function(g, T) { // Exploding Arrows -> Supernova Quiver
          quiver(g, cloth(0x7c2d12), 6, glow(0xef4444));
          bow(hand(g, -1), wood(0x8b5a2b), 0.34);
          if (T >= 3) belt(g, cloth(0x451a03), emis(0xdc2626, 0xef4444, 0.5), 4);
          if (T >= 4) { const r = sub(g, -0.22, 1.0, -0.42, 0.2); for (let i = 0; i < 3; i++) { ad(r, Cyl(0.05, 0.05, 0.5, 10), metal(0xb91c1c), (i - 1) * 0.11, 0, 0); ad(r, Cone(0.05, 0.12, 10), metal(GOLD), (i - 1) * 0.11, 0.31, 0); } pauldrons(g, emis(0x7c2d12, 0xf97316, 0.4)); }
          if (T >= 5) { aura(g, 0xf97316, 0.14); orbit(g, mkArrow(glow(0xfde047)), 4, 0.9, 1.2, 2.2, 0.05, true); crown(g, glow(0xf97316), 7, 0.22); }
        }
      ],
      gwendolin: [
        function(g, T) { // Flame jets -> Solar Inferno
          const R = hand(g, 1);
          gun(R, metal(0x7f1d1d), 0.45 + T * 0.05, 0.06, glow(0xf97316), T >= 3 ? 2 : 1);
          const tk = sub(g, 0, 0.92, -0.44); ad(tk, Cyl(0.15, 0.15, 0.55, 14), metal(0xb91c1c)); if (T >= 3) ad(tk, Cyl(0.12, 0.12, 0.5, 14), metal(0xb91c1c), 0.26, 0, 0);
          if (T >= 4) { const d = sub(R, 0, 0.08, 0.6); ad(d, Cone(0.12, 0.3, 4), metal(0xdc2626), 0, 0.06, 0, Math.PI / 2); ad(d, Cone(0.12, 0.3, 4), metal(0xdc2626), 0, -0.06, 0, Math.PI / 2); pauldrons(g, metal(0xb91c1c), 2, metal(GOLD)); }
          if (T >= 5) { cape(g, emis(0xf97316, 0xf59e0b, 0.5), 1.0); crown(g, glow(0xfde047), 9, 0.2); orbit(g, mkFire(), 3, 0.9, 1.3, 2.0, 0.08); }
        },
        function(g, T) { // Heat It Up -> Magma Core
          goggles(g, DARK, 0xf97316, 2);
          if (T >= 3) [GA.rh, GA.lh].forEach(function(p) { ad(g, Sph(0.14), emis(0x7c2d12, 0xf97316, 0.8), p[0], p[1], p[2]); });
          if (T >= 4) chestplate(g, emis(0x292524, 0xea580c, 0.45), 0xfde047);
          if (T >= 5) { ad(g, Sph(0.22, 16, 12), glow(0xf97316), 0, 0.95, 0.5); horns(g, emis(0x292524, 0xef4444, 0.6), 0.38, 0.3); aura(g, 0xef4444, 0.12); }
        },
        function(g, T) { // Napalm -> World Burner
          belt(g, cloth(0x451a03), glow(0xf97316, 0.9), 3);
          if (T >= 3) flask(hand(g, -1), 0xf97316);
          if (T >= 4) { const v = sub(g, 0, 0.95, -0.46); ad(v, Cone(0.3, 0.55, 8), matteRock(), 0, 0, 0); ad(v, Sph(0.12), glow(0xef4444), 0, 0.28, 0); }
          if (T >= 5) { wings(g, glow(0xf97316, 0.85), glow(0xfde047, 0.85), 3, 1.0); orbit(g, mkFire(), 5, 1.0, 0.7, 1.8, 0.12); }
        }
      ],
      obyn: [
        function(g, T) { // Spirit wolves -> Sovereign of Nature
          staff(hand(g, 1), wood(), 1.2, glow(0x22c55e), 0.12);
          if (T >= 3) orbit(g, mkSpirit(0x67e8f9), T >= 5 ? 3 : (T >= 4 ? 2 : 1), 1.0, 0.55, 1.6, 0.05, true);
          if (T >= 4) antlers(g, wood(0x5b3a1a), T >= 5);
          if (T >= 5) { cape(g, cloth(0x166534), 1.1); orbit(g, mkLeaf(0x4ade80), 5, 0.75, 1.75, 1.2, 0.06); }
        },
        function(g, T) { // Nature's Clarity -> Gaia's Judgment
          headband(g, cloth(0x22c55e));
          staff(hand(g, 1), wood(), 1.1, emis(0x065f46, 0x10b981, 0.6), 0.12 + T * 0.02);
          if (T >= 3) pauldrons(g, wood(0x3f2a14), 3, wood(0x14532d));
          if (T >= 4) { cape(g, cloth(0x14532d), 1.0); visor(g, 0x4ade80, 0.5); }
          if (T >= 5) orbit(g, mkLeaf(0x22c55e), 8, 0.9, 1.6, 1.4, 0.05);
        },
        function(g, T) { // Brambles -> World Tree
          bracers(g, wood(0x3f2a14));
          [GA.rh, GA.lh].forEach(function(p) { ad(g, Cone(0.04, 0.16, 5), wood(0x14532d), p[0] * 1.15, p[1] + 0.12, p[2] * 0.6, 0, 0, p[0] > 0 ? -1.2 : 1.2); });
          if (T >= 3) { const pot = sub(g, 0, 0.9, -0.44); ad(pot, Cyl(0.16, 0.12, 0.22, 12), cloth(0x92400e)); ad(pot, Sph(0.16, 10, 8), cloth(0x15803d), 0, 0.2, 0); }
          if (T >= 4) { const tot = sub(g, -0.55, 0.3, -0.3); for (let i = 0; i < 3; i++) ad(tot, Box(0.24, 0.24, 0.24), wood(i % 2 ? 0x78350f : 0x92400e), 0, i * 0.26, 0); ad(tot, Box(0.1, 0.06, 0.02), glow(0x4ade80), 0, 0.55, 0.13); }
          if (T >= 5) { const tr = sub(g, 0, 1.1, -0.5); ad(tr, Cyl(0.07, 0.1, 0.9, 8), wood(0x5b3a1a), 0, 0.3, 0); [[0, 0.85, 0, 0.32], [0.2, 0.7, 0.05, 0.22], [-0.2, 0.72, -0.05, 0.22]].forEach(function(c) { ad(tr, Sph(c[3], 12, 10), cloth(0x16a34a), c[0], c[1], c[2]); }); orbit(g, mkLeaf(0x86efac), 4, 1.0, 0.6, 1.0, 0.1); }
        }
      ],
      sauda: [
        function(g, T) { // Katana tempo -> Thousand Cuts
          blade(hand(g, 1), metal(STEEL), 0.6 + T * 0.04, T >= 3 ? glow(0x93c5fd) : undefined);
          blade(hand(g, -1), metal(STEEL), 0.6 + T * 0.04, T >= 3 ? glow(0x93c5fd) : undefined);
          if (T >= 4) orbit(g, mkBlade(metal(STEEL)), T >= 5 ? 6 : 4, 1.0, 0.85, 3.0);
          if (T >= 5) { cap(g, metal(0x1e293b), 0.6, 0.4); horns(g, metal(GOLD), 0.32, 0.32, 0.9); }
        },
        function(g, T) { // Enchanted -> Crimson Ronin
          const edge = T >= 3 ? glow(0xef4444) : glow(0x60a5fa);
          blade(hand(g, 1), metal(STEEL), 0.7, edge); blade(hand(g, -1), metal(STEEL), 0.7, edge);
          if (T >= 3) headband(g, cloth(0xdc2626), true);
          if (T >= 4) { pauldrons(g, metal(0x7f1d1d)); const ban = sub(g, 0.15, 1.3, -0.45); ad(ban, Cyl(0.015, 0.015, 1.1, 6), wood(), 0, 0, 0); ad(ban, new THREE.PlaneGeometry(0.3, 0.5), cloth(0xdc2626), 0.16, 0.25, 0); }
          if (T >= 5) { cape(g, cloth(0x991b1b), 1.0); mask(g, metal(0x7f1d1d)); horns(g, metal(0x111827), 0.3, 0.28, 0.6); aura(g, 0xdc2626, 0.1); }
        },
        function(g, T) { // Relentless -> Blade Tempest
          const sh = sub(g, -0.1, 1.0, -0.4, 0, 0, 0.7); ad(sh, Cyl(0.05, 0.05, 0.85, 8), wood(0x111827)); ad(sh, Box(0.04, 0.55, 0.1), metal(STEEL), 0, 0.68, 0);
          blade(hand(g, 1), metal(STEEL), 0.65);
          if (T >= 3) [-0.18, 0.18].forEach(function(x) { ad(g, Cone(0.06, 0.24, 3), glow(0xbae6fd), x + (x > 0 ? 0.1 : -0.1), 0.12, -0.05, 0, 0, x > 0 ? -1.3 : 1.3, 1, 1, 0.3); });
          if (T >= 4) for (let i = 0; i < 3; i++) spin(g, ad(g, Tor(0.75 - i * 0.12, 0.02, Math.PI * 0.9), glow(0xe0f2fe, 0.6), 0, 0.4 + i * 0.45, 0, Math.PI / 2), 'z', 4 + i);
          if (T >= 5) { ad(g, Cone(1.0, 2.2, 18, true), glow(0xe0f2fe, 0.12), 0, 1.0, 0, Math.PI); orbit(g, mkBlade(glow(0xbae6fd)), 5, 1.15, 1.0, 3.2); }
        }
      ],
      benjamin: [
        function(g, T) { // Packet siphon -> Root Admin
          headset(g);
          if (T >= 3) laptop(g, 0x22c55e);
          if (T >= 4) { const s = backpack(g, metal(0x111827), 0.52, 0.65, 0.28); for (let i = 0; i < 4; i++) ad(g, Box(0.38, 0.03, 0.01), glow(i % 2 ? 0x22c55e : 0x38bdf8), 0, 0.72 + i * 0.12, -0.3); }
          if (T >= 5) { visor(g, 0x22c55e, 0.7); orbit(g, mkScreen(0x22c55e), 4, 1.0, 1.4, 1.0, 0.06, true); }
        },
        function(g, T) { // Biohack -> System Wipe
          goggles(g, DARK, 0x22c55e, 2);
          if (T >= 3) { const sy = sub(hand(g, 1), 0, 0.08, 0.08, Math.PI / 2); ad(sy, Cyl(0.04, 0.04, 0.3, 10), glow(0xa3e635, 0.8)); ad(sy, Cyl(0.008, 0.008, 0.14, 4), metal(STEEL), 0, 0.22, 0); }
          if (T >= 4) orbit(g, mkVirus(T >= 5 ? 0xef4444 : 0xa855f7), 3, 0.9, 1.1, 1.6, 0.08);
          if (T >= 5) { hood(g, 0, cloth(0x0f172a)); visor(g, 0xef4444, 0.6); orbit(g, mkScreen(0xef4444), 3, 1.15, 1.7, -0.8, 0.05, true); }
        },
        function(g, T) { // Dividends -> Infinite Mint
          belt(g, cloth(0x422006), metal(GOLD), 3);
          if (T >= 3) orbit(g, mkCoin(), T >= 5 ? 6 : 3, 0.85, 1.2, 1.8, 0.1);
          if (T >= 4) { backpack(g, metal(0x475569), 0.5, 0.5, 0.3); ad(g, Cyl(0.12, 0.12, 0.04, 16), metal(GOLD), 0, 0.92, -0.6, Math.PI / 2); }
          if (T >= 5) { crown(g, metal(GOLD), 5, 0.2, true); cape(g, gm(GOLD, 'std', 0xb45309, 0.3, 0.6, 0.35), 1.0); }
        }
      ],
      supermonkey: [
        function(g, T) { // Lasers -> Sun Avatar -> True Sun God
          if (T === 2) { visor(g, 0xff2a2a); return; }
          if (T === 3) { visor(g, 0xc084fc); hood(g, 0, emis(0x5b21b6, 0xa855f7, 0.35)); cape(g, emis(0x6d28d9, 0x7c3aed, 0.25), 1.0); orbit(g, mkOrb(0xa855f7, 0.12), 2, 0.8, 1.1, 2.4, 0.06); return; }
          if (T >= 2) {
            const gold = T >= 5 ? 0xfff3c4 : GOLD;
            visor(g, T >= 5 ? 0xfffbeb : 0xfde047);
            hood(g, 0, emis(gold, 0xf59e0b, T >= 5 ? 0.6 : 0.4));
            cape(g, emis(T >= 5 ? 0xfffbeb : 0xf59e0b, 0xfbbf24, 0.35), 1.0);
            const halo = sub(g, 0, GA.hy + 0.05, -0.42);
            ad(halo, new THREE.CircleGeometry(0.55, 32), glow(0xfde047, 0.5));
            const rays = T >= 5 ? 16 : 12, R = T >= 5 ? 0.95 : 0.8;
            for (let r = 0; r < rays; r++) { const ra = (r / rays) * Math.PI * 2; ad(halo, Cone(0.07, R * 0.5, 4), glow(T >= 5 ? 0xffffff : 0xfbbf24), Math.cos(ra) * R, Math.sin(ra) * R, 0, 0, 0, ra - Math.PI / 2); }
            spin(g, halo, 'z', 0.8);
            if (T >= 5) { crown(g, emis(0xfffbeb, GOLD, 0.7), 5, 0.24, true); wings(g, glow(0xffffff, 0.92), glow(0xfde047, 0.92), 3, 1.15); orbit(g, mkOrb(0xfffbeb, 0.14), 3, 1.1, 2.15, 1.3, 0.08); }
          }
        },
        function(g, T) { // Robo / Tech Terror
          visor(g, T >= 5 ? 0x22c55e : 0x38bdf8);
          if (T < 3) return;
          const m = metal(T >= 5 ? 0x1e293b : 0x475569), gc = T >= 5 ? 0x4ade80 : 0x22d3ee;
          [1, -1].forEach(function(s) { const a = hand(g, s); ad(a, Box(0.22, 0.22, 0.36), m, 0, 0, 0); ad(a, Cyl(0.065, 0.075, 0.46, 12), m, 0, 0.02, 0.36, Math.PI / 2); ad(a, Sph(0.07), glow(gc), 0, 0.02, 0.6); });
          if (T >= 4) { ad(g, Cyl(0.13, 0.13, 0.05, 20), glow(gc), 0, 0.9, 0.38, Math.PI / 2); ad(g, Cyl(0.015, 0.015, 0.4, 6), m, 0.2, GA.top + 0.15, GA.hz); ad(g, Sph(0.045), glow(0xef4444), 0.2, GA.top + 0.37, GA.hz); }
          if (T >= 5) [-1, 1].forEach(function(s) { const p = sub(g, s * 0.44, 1.32, -0.12); ad(p, Box(0.28, 0.2, 0.34), m); for (let k = 0; k < 4; k++) ad(p, Cone(0.035, 0.09, 6), glow(0x4ade80), (k % 2 ? 0.07 : -0.07), (k < 2 ? 0.05 : -0.05), 0.2, Math.PI / 2); });
        },
        function(g, T) { // Dark Knight -> Dark Champion
          visor(g, 0xa855f7);
          if (T < 3) return;
          hood(g, 0, emis(0x18181b, 0x3b0764, 0.2));
          [-1, 1].forEach(function(s) { ad(g, Cone(0.08, 0.34, 4), emis(0x18181b, 0x3b0764, 0.2), s * 0.22, GA.top + 0.08, GA.hz, 0, 0, -s * 0.18); });
          cape(g, emis(0x09090b, 0x3b0764, 0.15), 1.15, 0.9);
          if (T >= 4) orbit(g, mkGlaive(emis(0x3b0764, 0xa855f7, 0.9)), T >= 5 ? 4 : 2, 0.95, 1.05, 2.0, 0.05);
          if (T >= 5) { pauldrons(g, metal(0x27272a), 3, emis(0x27272a, 0x7e22ce, 0.5)); aura(g, 0x7e22ce, 0.1); }
        }
      ],
      silas: [
        function(g, T) { // Ice shards -> Absolute Zero
          [GA.rh].forEach(function(p) { ad(g, Oct(0.15), ghost(0xbae6fd, 0.85), p[0], p[1], p[2]); });
          if (T >= 3) spear(hand(g, 1), metal(0xe0f2fe), ghost(0x67e8f9, 0.9), 1.3);
          if (T >= 4) { spear(hand(g, -1), metal(0xe0f2fe), ghost(0x67e8f9, 0.9), 1.2); crown(g, ghost(0xbae6fd, 0.9), 7, 0.28); }
          if (T >= 5) { wings(g, ghost(0xe0f2fe, 0.75), ghost(0x67e8f9, 0.75), 3, 1.1); orbit(g, mkShard(0xa5f3fc), 5, 1.0, 1.0, 1.8, 0.1); }
        },
        function(g, T) { // Rime -> Winter's Mercy
          cape(g, cloth(0xe0f2fe), 0.55, 0.9);
          if (T >= 3) pauldrons(g, ghost(0xbae6fd, 0.9), 2, ghost(0xffffff, 0.9));
          if (T >= 4) { hood(g, 0, cloth(0xdbeafe)); const sf = mkSnow()(g); sf.position.set(0, 0.95, 0.43); }
          if (T >= 5) { aura(g, 0xbae6fd, 0.18, 1.1); orbit(g, mkSnow(), 4, 0.95, 1.95, 0.9, 0.05); }
        },
        function(g, T) { // Mist -> Eternal Permafrost
          ad(g, new THREE.SphereGeometry(0.85, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), glow(0xe0f2fe, 0.16), 0, 0.0, 0);
          if (T >= 3) groundDisc(g, ghost(0x7dd3fc, 0.55), 0.85);
          if (T >= 4) for (let i = 0; i < 5; i++) ad(g, Cone(0.07, 0.42, 5), ghost(0xbae6fd, 0.9), -0.3 + i * 0.15, 1.05 + (i === 2 ? 0.1 : 0), -0.42, -0.4);
          if (T >= 5) { chestplate(g, ghost(0x93c5fd, 0.85), 0xffffff); crown(g, ghost(0xe0f2fe, 0.95), 5, 0.3, true); }
        }
      ],
      rosalia: [
        function(g, T) { // Laser carbine -> Skyforge Valkyrie
          gun(hand(g, 1), metal(0x334155), 0.4 + T * 0.06, 0.05 + (T >= 4 ? 0.03 : 0), glow(0xef4444));
          if (T >= 3) gun(hand(g, -1), metal(0x334155), 0.42, 0.05, glow(0xef4444));
          jetpack(g, metal(0x64748b), 0x38bdf8, 2);
          if (T >= 5) { cap(g, metal(STEEL), 0.6, 0.4); [-1, 1].forEach(function(s) { ad(g, Cone(0.07, 0.4, 4), metal(STEEL), s * 0.52, GA.hy + 0.2, GA.hz, 0, 0, -s * 1.1, 1, 1, 0.3); }); wings(g, metal(STEEL), metal(GOLD), 3, 1.1); }
        },
        function(g, T) { // Grenades -> Kinetic Payload
          gun(hand(g, -1), metal(0x3f6212), 0.35, 0.11, metal(DARK));
          jetpack(g, metal(0x64748b), 0x38bdf8, 2);
          if (T >= 3) { ad(g, Tor(0.42, 0.05, Math.PI * 0.95), cloth(0x422006), 0, 0.88, 0, 0, 0, 0.8); for (let i = 0; i < 4; i++) ad(g, Sph(0.06), metal(0x3f6212), -0.22 + i * 0.13, 1.0 - i * 0.08, 0.34); }
          if (T >= 4) [-1, 1].forEach(function(s) { const p = sub(g, s * 0.46, 1.3, 0); ad(p, Cyl(0.11, 0.11, 0.36, 12), metal(0x475569), 0, 0, 0.05, Math.PI / 2); ad(p, Sph(0.08), glow(0xef4444), 0, 0, 0.25); });
          if (T >= 5) { const ms = sub(g, 0, 1.25, -0.6); ad(ms, Cyl(0.13, 0.13, 0.9, 12), metal(STEEL)); ad(ms, Cone(0.13, 0.3, 12), metal(0xef4444), 0, 0.6, 0); radial(sub(ms, 0, -0.4, 0), 4, 0.15, 0.04, 0.2, metal(0xef4444), 0); }
        },
        function(g, T) { // Afterburner -> Supersonic Ace
          jetpack(g, metal(0x64748b), T >= 3 ? 0xf97316 : 0x38bdf8, T >= 3 ? 4 : 2);
          gun(hand(g, 1), metal(0x334155), 0.4, 0.05, glow(0xef4444));
          if (T >= 4) { const bay = sub(g, 0, 0.3, 0.1); for (let i = 0; i < 3; i++) ad(bay, Sph(0.08), metal(DARK), (i - 1) * 0.16, 0, 0.2); }
          if (T >= 5) { goggles(g, 0x78350f, 0xfde047, 2); [-1, 1].forEach(function(s) { ad(g, Box(0.9, 0.04, 0.32), metal(STEEL), s * 0.7, 0.95, -0.4, 0, 0, s * 0.15); }); ad(g, Cone(0.2, 1.4, 12, true), glow(0xffffff, 0.2), 0, 0.3, -1.0, -Math.PI / 2); }
        }
      ],
      corvus: [
        function(g, T) { // Spirit -> Ancestral Might
          orbit(g, mkRaven(0x1e1b4b), T >= 5 ? 3 : (T >= 4 ? 2 : 1), 1.0, 1.35, 1.6, 0.1, true);
          if (T >= 3) spear(hand(g, 1), metal(0x312e81), glow(0xa78bfa), 1.4);
          if (T >= 4) for (let i = 0; i < 7; i++) ad(g, Cone(0.05, 0.3, 4), cloth(0x111827), Math.sin((i - 3) * 0.4) * 0.4, 1.12, -0.12 + Math.cos((i - 3) * 0.4) * 0.05, 0.2, 0, (i - 3) * 0.35);
          if (T >= 5) { const bk = sub(g, 0, GA.hy - 0.12, GA.face + 0.06); ad(bk, Cone(0.12, 0.42, 4), metal(0x111827), 0, 0, 0.12, Math.PI / 2); wings(g, cloth(0x111827), cloth(0x312e81), 4, 1.25); }
        },
        function(g, T) { // Haunt -> Omnipresent Haunt
          const tm = sub(g, -0.55, 1.2, 0.35); ad(tm, Box(0.32, 0.4, 0.08), cloth(0x4c1d95)); ad(tm, Box(0.2, 0.2, 0.01), glow(0xa78bfa), 0, 0, 0.05); g.userData.orbit.push({ o: tm, r: 0.0, y: 1.2, s: 0, ph: 0, bob: 0.08 }); tm.position.set(-0.55, 1.2, 0.35);
          if (T >= 3) orbit(g, mkOrb(0xa78bfa, 0.09), 3, 0.8, 1.6, 2.0, 0.08);
          if (T >= 4) { const ln = hand(g, 1); ad(ln, Box(0.18, 0.24, 0.18), metal(0x312e81), 0, -0.15, 0.05); ad(ln, Sph(0.08), glow(0x67e8f9), 0, -0.15, 0.05); }
          if (T >= 5) { hood(g, 0, cloth(0x312e81)); cape(g, cloth(0x1e1b4b), 1.15, 0.95); orbit(g, mkOrb(0xe9d5ff, 0.07), 6, 1.2, 2.1, -1.0, 0.1); }
        },
        function(g, T) { // Dark Ritual -> Grim Singularity
          const dg = sub(hand(g, 1), 0, 0.05, 0.08, 0.6); ad(dg, Box(0.05, 0.32, 0.08), metal(0x6d28d9), 0, 0.2, 0); ad(dg, Cyl(0.03, 0.03, 0.14, 6), wood(0x111827));
          if (T >= 3) { const br = hand(g, -1); ad(br, Cyl(0.12, 0.08, 0.14, 10), metal(0x27272a)); ad(br, Cone(0.1, 0.24, 8), glow(0xf97316, 0.9), 0, 0.17, 0); }
          if (T >= 4) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ad(g, Box(0.16, 0.02, 0.16), glow(0xa78bfa, 0.8), Math.cos(a) * 0.9, 0.04, Math.sin(a) * 0.9, 0, a, 0); }
          if (T >= 5) { const bh = sub(g, 0, 2.6, 0); ad(bh, Sph(0.28, 18, 14), glow(0x020617)); spin(g, ad(bh, Tor(0.45, 0.05), glow(0xa855f7, 0.7), 0, 0, 0, Math.PI / 2.3), 'z', 3); const sc = sub(hand(g, -1), 0, 0, 0.05); ad(sc, Cyl(0.03, 0.03, 1.5, 8), wood(0x111827), 0, 0.4, 0); ad(sc, Tor(0.3, 0.035, Math.PI * 0.8), metal(STEEL), -0.15, 1.1, 0, 0, Math.PI / 2, 0); }
        }
      ],
      geraldo: [
        function(g, T) { // Flasks -> Grand Emporium
          flask(hand(g, 1), 0x60a5fa);
          if (T >= 3) { ad(g, Tor(0.42, 0.05, Math.PI * 0.95), cloth(0x422006), 0, 0.88, 0, 0, 0, -0.8); [0x22c55e, 0xf43f5e, 0xfacc15].forEach(function(c, i) { ad(g, Sph(0.065), glow(c, 0.9), 0.22 - i * 0.14, 1.0 - i * 0.08, 0.35); }); }
          if (T >= 4) { goggles(g, 0x78350f, 0xfde047, 2); backpack(g, cloth(0x92400e), 0.6, 0.7, 0.3); }
          if (T >= 5) { crown(g, metal(GOLD), 5, 0.2); orbit(g, mkPotion(0xa855f7), 2, 0.95, 1.3, 1.6, 0.1); orbit(g, mkPotion(0x22c55e), 2, 0.95, 1.0, -1.6, 0.1); }
        },
        function(g, T) { // Shop items -> Mystic Arsenal
          const tu = sub(g, 0.48, 1.3, -0.05); ad(tu, Box(0.2, 0.16, 0.2), metal(0x475569)); ad(tu, Cyl(0.035, 0.035, 0.3, 8), metal(DARK), 0, 0.02, 0.2, Math.PI / 2);
          if (T >= 3) blade(hand(g, -1), metal(STEEL), 0.55, glow(0xffffff));
          if (T >= 4) { const jr = hand(g, 1); ad(jr, Cyl(0.11, 0.11, 0.24, 12), glow(0x65a30d, 0.75), 0, 0.05, 0.06); ad(jr, Cyl(0.12, 0.12, 0.04, 12), metal(GOLD), 0, 0.19, 0.06); }
          if (T >= 5) { const lamp = sub(g, -0.7, 1.4, 0.2); ad(lamp, Sph(0.14, 12, 10), metal(GOLD), 0, 0, 0, 0, 0, 0, 1.5, 0.7, 1); ad(lamp, Cone(0.04, 0.2, 6), metal(GOLD), 0.24, 0.02, 0, 0, 0, -1.2); ad(lamp, Sph(0.16), ghost(0x60a5fa, 0.6), 0.3, 0.35, 0); ad(lamp, Cone(0.12, 0.35, 10), ghost(0x60a5fa, 0.5), 0.3, 0.14, 0, Math.PI); g.userData.orbit.push({ o: lamp, r: 0, y: 1.4, s: 0, ph: 0, bob: 0.1 }); lamp.position.set(-0.7, 1.4, 0.2); }
        },
        function(g, T) { // Traps -> Wonder Emporium
          belt(g, cloth(0x422006), metal(0x64748b), 4);
          if (T >= 3) flask(hand(g, -1), 0xf43f5e);
          if (T >= 4) { const id = sub(g, 0.85, 0.9, 0.2); ad(id, Box(0.2, 0.36, 0.14), wood(0x854d0e)); ad(id, Sph(0.1), wood(0x854d0e), 0, 0.26, 0); [-0.04, 0.04].forEach(function(x) { ad(id, Sph(0.022), glow(0xef4444), x, 0.28, 0.09); }); g.userData.orbit.push({ o: id, r: 0, y: 0.9, s: 0, ph: 1, bob: 0.08 }); id.position.set(0.85, 0.9, 0.2); }
          if (T >= 5) { const cart = sub(g, 0, 0.95, -0.5); ad(cart, Box(0.7, 0.45, 0.35), wood(0x92400e)); ad(cart, new THREE.PlaneGeometry(0.8, 0.3), cloth(0xdc2626), 0, 0.38, 0.05, -0.4); [0x22c55e, 0xa855f7, GOLD].forEach(function(c, i) { ad(cart, Sph(0.07), glow(c), -0.2 + i * 0.2, 0.28, 0.1); }); orbit(g, mkCoin(), 4, 0.9, 1.6, 1.5, 0.08); }
        }
      ]
    };
    function matteRock() { return gm(0x292524, 'std', 0xdc2626, 0.15, 0.1, 0.9); }

    // ========================================================================
    // COMPANION BUILDERS (single sequential path, T1-T5)
    // ========================================================================
    const COMP_GEAR = {
      dart: function(g, T) { // Sharp shots -> Crossbow Master
        headband(g, cloth(0xdc2626), T >= 2);
        if (T === 2) quiver(g, cloth(0x7c2d12), 4);
        if (T >= 3) crossbow(hand(g, 1), T >= 5 ? metal(GOLD) : metal(STEEL), T >= 4 ? 1.3 : 1.0, T >= 4 ? glow(0xfde047) : undefined);
        if (T >= 4) goggles(g, 0x334155, 0x38bdf8, 2);
        if (T >= 5) { cape(g, cloth(0x7f1d1d), 0.95); quiver(g, metal(GOLD), 9, metal(GOLD)); }
      },
      super: function(g, T) { // T2 Super Range -> T3 Laser Vision -> T4 Sun Avatar -> T5 Paragon True Sun God
        if (T === 2) { goggles(g, 0x1e3a8a, 0x93c5fd, 2); cape(g, cloth(0xdc2626), 0.8); return; }
        if (T === 3) { visor(g, 0xff2a2a); cape(g, cloth(0xdc2626), 0.95); orbit(g, mkOrb(0xff2a2a, 0.07), 2, 0.7, 1.5, 3.0, 0.04); return; }
        HERO_GEAR.supermonkey[0](g, T);
      },
      tack: function(g, T) { // T2 More Tacks -> T3 Ring of Fire -> T4 Inferno Ring -> T5 Paragon Maelstrom
        radial(sub(g, 0, 0.82, 0), T >= 2 ? 12 : 8, 0.42, 0.04, 0.18, T >= 3 ? emis(0xf97316, 0xef4444, 0.9) : metal(STEEL), 0);
        if (T >= 3) spin(g, ad(g, Tor(0.75, 0.07), glow(0xf97316, 0.75), 0, 0.82, 0, Math.PI / 2), 'z', 2);
        if (T >= 4) spin(g, sawRing(g, 0.95, 22, emis(0xf97316, 0xef4444, 0.85), 0.5), 'y', 6);
        if (T >= 5) { spin(g, sawRing(g, 0.62, 16, metal(GOLD), 1.05), 'y', -9); crown(g, metal(GOLD), 8, 0.18); aura(g, 0xf97316, 0.12); }
      },
      boomer: function(g, T) { // T2 Sonic Glaive -> T3 Glaive Ricochet -> T4 MOAB Press -> T5 Paragon Glaive Dominus
        boomer(hand(g, 1), metal(STEEL));
        if (T >= 2) ad(g, Tor(0.22, 0.03, Math.PI * 1.3), glow(0x93c5fd, 0.75), GA.rh[0], GA.rh[1] + 0.12, GA.rh[2] + 0.12, Math.PI / 2);
        if (T >= 3) orbit(g, mkGlaive(metal(STEEL)), 2, 0.95, 0.95, 3.2);
        if (T >= 4) { cap(g, metal(0x1e3a8a), 0.6, 0.38); const pr = sub(g, 0, 1.0, -0.5, 0, 0, 0.3, 1.6); ad(pr, Box(0.5, 0.08, 0.14), metal(0x1e3a8a), 0.18, 0, 0, 0, 0, 0.5); ad(pr, Box(0.5, 0.08, 0.14), metal(0x1e3a8a), -0.18, 0, 0, 0, 0, -0.5); }
        if (T >= 5) { pauldrons(g, metal(GOLD), 2, metal(GOLD)); orbit(g, mkGlaive(emis(GOLD, 0xf59e0b, 0.6)), 4, 1.25, 1.4, -3.6); }
      },
      ninja: function(g, T) { // T2 Sharp Shurikens -> T3 Double Shot -> T4 Bloonjitsu -> T5 Paragon Ascended Shadow
        if (T < 4) headband(g, cloth(0xdc2626), true);
        if (T === 2) { const sh = sub(hand(g, 1), 0, 0.08, 0.08); ad(sh, Cyl(0.05, 0.05, 0.03, 10), metal(STEEL), 0, 0, 0, Math.PI / 2); }
        if (T === 3) orbit(g, mkShuriken(metal(STEEL)), 2, 0.8, 0.9, 2.6);
        if (T >= 4) { hood(g, 0, cloth(0xf8fafc)); headband(g, emis(0xdc2626, 0xb91c1c, T >= 5 ? 0.6 : 0.3), true); orbit(g, mkShuriken(T >= 5 ? emis(0xef4444, 0xdc2626, 0.8) : metal(STEEL)), T >= 5 ? 8 : 6, 1.0, 0.95, 2.4); }
        if (T >= 5) { blade(hand(g, 1), metal(STEEL), 0.6, glow(0xef4444)); aura(g, 0x111827, 0.18); }
      },
      sniper: function(g, T) { // T2 Large Caliber -> T3 Deadly Precision -> T4 Maim MOAB -> T5 Paragon Elite Defender
        const rf = sub(hand(g, 1), 0, 0.02, 0.06);
        ad(rf, Cyl(0.045 + (T >= 2 ? 0.015 : 0), 0.05 + (T >= 2 ? 0.015 : 0), 0.9 + T * 0.06, 10), metal(0x27272a), 0, 0, 0.35, Math.PI / 2);
        ad(rf, Box(0.1, 0.16, 0.36), wood(0x3f2a14), 0, -0.03, -0.28);
        if (T >= 3) { ad(rf, Cyl(0.05, 0.05, 0.32, 12), metal(DARK), 0, 0.11, 0.1, Math.PI / 2); ad(rf, new THREE.CircleGeometry(0.045, 12), glow(0xef4444), 0, 0.11, 0.265); goggles(g, 0x27272a, 0x4ade80, T >= 5 ? 4 : 2); }
        if (T >= 4) { ad(rf, Cyl(0.085, 0.085, 0.38, 14), metal(0x18181b), 0, 0, 1.05 + T * 0.03, Math.PI / 2); [-1, 1].forEach(function(s) { ad(rf, Cyl(0.012, 0.012, 0.32, 6), metal(DARK), s * 0.06, -0.14, 0.6, 0, 0, s * 0.4); }); }
        if (T >= 5) { cape(g, cloth(0x3f6212), 1.0, 0.95); for (let i = 0; i < 8; i++) ad(g, Cone(0.05, 0.3, 4), cloth(i % 2 ? 0x4d7c0f : 0x365314), -0.35 + i * 0.1, 0.55, -0.45, Math.PI, 0, 0); }
      },
      wizard: function(g, T) { // T2 Arcane Bolt -> T3 Dragon Breath & Shimmer -> T4 Archmage -> T5 Paragon Phoenix Magus
        if (T >= 2) { const tm = sub(g, -0.6, 1.0, 0.35); ad(tm, Box(0.3, 0.38, 0.08), cloth(0x1e3a8a)); ad(tm, Box(0.18, 0.18, 0.01), glow(0x93c5fd), 0, 0, 0.05); g.userData.orbit.push({ o: tm, r: 0, y: 1.0, s: 0, ph: 0, bob: 0.07 }); }
        if (T >= 3) { orbit(g, mkFire(), 1, 0.75, 1.4, 2.0, 0.06); orbit(g, mkOrb(0xe9d5ff, 0.05), 4, 0.6, 1.95, -2.4, 0.05); }
        if (T >= 4) {
          const hm = emis(T >= 5 ? 0x4c1d95 : 0x1e3a8a, T >= 5 ? 0x7c3aed : 0x1d4ed8, 0.25);
          hatCone(g, hm, 1.0, 0.36, metal(GOLD), 0.1);
          for (let i = 0; i < 7; i++) { const a = i * 2.4, hh = 0.15 + (i / 7) * 0.75, rr = 0.36 * (1 - hh / 1.0) + 0.02; ad(g, Oct(0.05), glow(0xfde047), Math.cos(a) * rr, GA.top - 0.1 + hh, GA.hz + Math.sin(a) * rr); }
          staff(hand(g, 1), wood(0x4c1d95), 1.2, glow(0xa855f7), 0.14);
        }
        if (T >= 5) {
          const ph = sub(g, 1.1, 1.3, 0, 0, 0, 0, 1.4);
          const fire = emis(0xf97316, 0xef4444, 0.9), hot = emis(0xfde047, 0xf59e0b, 1.0);
          ad(ph, Sph(0.12, 12, 10), fire, 0, 0, 0, 0, 0, 0, 0.8, 0.8, 1.5);
          ad(ph, Sph(0.075, 10, 8), hot, 0, 0.05, 0.19);
          [-1, 1].forEach(function(s) { ad(ph, Cone(0.1, 0.48, 3), fire, s * 0.26, 0.04, -0.02, 0, 0, -s * Math.PI / 2, 1, 1, 0.25); });
          for (let t = 0; t < 3; t++) ad(ph, Cone(0.05, 0.34, 4), t === 1 ? hot : fire, (t - 1) * 0.06, 0, -0.3, -Math.PI / 2, 0, (t - 1) * 0.25);
          g.userData.orbit.push({ o: ph, r: 1.1, y: 1.3, s: 1.6, ph: 0, bob: 0.12, face: true });
          aura(g, 0x7c3aed, 0.1);
        }
      },
      dartling: function(g, T) { // T2 Focused Barrel -> T3 Hydra Rocket Pods -> T4 Ray of Doom -> T5 Paragon M.A.D.
        const gn = sub(g, 0, 0.75, 0.45);
        ad(gn, Box(0.3, 0.26, 0.3), metal(0x365314));
        for (let i = 0; i < 3; i++) ad(gn, Cyl(0.04, 0.04, 0.6, 8), metal(DARK), (i - 1) * 0.09, 0, 0.42, Math.PI / 2);
        if (T >= 2) ad(gn, Cyl(0.01, 0.01, 2.4, 4), glow(0xef4444, 0.6), 0, 0.15, 1.5, Math.PI / 2);
        if (T >= 3) [-1, 1].forEach(function(s) { const pd = sub(g, s * 0.46, 1.25, -0.1); ad(pd, Box(0.24, 0.2, 0.3), metal(0x365314)); for (let k = 0; k < 4; k++) ad(pd, Cone(0.035, 0.09, 6), metal(0xef4444), (k % 2 ? 0.06 : -0.06), (k < 2 ? 0.05 : -0.05), 0.19, Math.PI / 2); });
        if (T >= 4) { ad(gn, Cyl(0.11, 0.13, 0.8, 14), metal(0x18181b), 0, 0.18, 0.45, Math.PI / 2); ad(gn, Sph(0.12), glow(0xef4444), 0, 0.18, 0.88); goggles(g, DARK, 0xef4444, 2); }
        if (T >= 5) { const ms = sub(g, 0, 1.3, -0.6); ad(ms, Cyl(0.15, 0.15, 1.0, 12), metal(STEEL)); ad(ms, Cone(0.15, 0.35, 12), metal(0xef4444), 0, 0.68, 0); radial(sub(ms, 0, -0.45, 0), 4, 0.17, 0.04, 0.22, metal(0xef4444), 0); }
      },
      mortar: function(g, T) { // T2 Rapid Reload -> T3 The Big One -> T4 Pop and Awe -> T5 Paragon Battery
        const big = T >= 3 ? 1.45 : 1.0;
        const bar = sub(g, 0.5, 0.75, 0.15, -0.5, 0, 0, big);
        ad(bar, Cyl(0.12, 0.14, 0.5, 14), metal(0x3f6212));
        if (T >= 2) { ad(g, Tor(0.42, 0.05, Math.PI * 0.95), cloth(0x422006), 0, 0.88, 0, 0, 0, 0.8); for (let i = 0; i < 4; i++) ad(g, Cyl(0.04, 0.04, 0.14, 8), metal(GOLD), -0.22 + i * 0.13, 1.0 - i * 0.08, 0.36, Math.PI / 2); }
        if (T >= 3) cap(g, metal(0x3f6212), 0.6, 0.4);
        if (T >= 4) { ad(bar, Sph(0.13), glow(0xfde047), 0, 0.3, 0); orbit(g, mkOrb(0xffffff, 0.08), 3, 0.9, 1.6, 2.6, 0.1); }
        if (T >= 5) { for (let i = 0; i < 2; i++) { const b2 = sub(g, -0.5 + i * 0.25, 0.75, -0.35, -0.4); ad(b2, Cyl(0.1, 0.12, 0.45, 12), metal(0x3f6212)); } chestplate(g, metal(0x365314), 0xfde047); }
      },
      ice: function(g, T) { // T2 Permafrost -> T3 Cold Snap & Icicles -> T4 Icicle Impale -> T5 Paragon Absolute Zero
        goggles(g, 0x0369a1, 0xe0f2fe, 2);
        groundDisc(g, ghost(0xbae6fd, 0.35), 0.8);
        if (T >= 3) { const gun2 = sub(hand(g, 1), 0, 0, 0.05, 0, 0, 0, T >= 5 ? 1.25 : 1.0); ad(gun2, Cyl(0.08, 0.1, 0.62, 14), metal(0xe0f2fe), 0, 0, 0.2, Math.PI / 2); ad(gun2, Sph(0.15, 14, 12), emis(0x38bdf8, 0x0ea5e9, 0.45), 0, 0.05, -0.16); ad(gun2, Tor(0.1, 0.028), glow(0x67e8f9), 0, 0, 0.52); ad(gun2, Sph(0.07), glow(0xf0f9ff), 0, 0, 0.55); for (let s = 0; s < 3; s++) ad(g, Cone(0.07, 0.36, 5), ghost(0xbae6fd, 0.9), -0.18 + s * 0.18, 1.1 + (s === 1 ? 0.1 : 0), -0.42, -0.35); }
        if (T >= 4) { crown(g, ghost(0xbae6fd, 0.9), 6, 0.26); spear(hand(g, -1), metal(0xe0f2fe), ghost(0x67e8f9, 0.9), 1.5); }
        if (T >= 5) { orbit(g, mkShard(0xa5f3fc), 5, 1.0, 1.0, 1.8, 0.1); aura(g, 0xbae6fd, 0.16, 1.1); }
      },
      mermonkey: function(g, T) { // T2 Abyssal Echo -> T3 Trident Flurry -> T4 Lord of the Abyss -> T5 Paragon Poseidon
        trident(hand(g, 1), T >= 5 ? metal(GOLD) : metal(0x0f766e), T >= 3 ? glow(0x5eead4) : undefined);
        for (let i = 0; i < 2; i++) spin(g, ad(g, Tor(0.7 + i * 0.25, 0.025, Math.PI * 0.8), glow(0x5eead4, 0.5 - i * 0.15), 0, 0.9, 0, Math.PI / 2, 0, i), 'z', 2.5 + i);
        if (T >= 3) orbit(g, mkOrb(0x38bdf8, 0.08), 3, 0.85, 0.9, 2.2, 0.08);
        if (T >= 4) { crown(g, emis(0x134e4a, 0x14b8a6, 0.5), 7, 0.24, true); pauldrons(g, emis(0x134e4a, 0x0d9488, 0.3), 3, emis(0x5eead4, 0x2dd4bf, 0.6)); visor(g, 0x5eead4, 0.55); }
        if (T >= 5) { aura(g, 0x38bdf8, 0.14); orbit(g, mkOrb(0xe0f2fe, 0.12), 5, 1.15, 1.6, -1.6, 0.12); }
      },
      beasthandler: function(g, T) { // T2 Raptor Claws -> T3 Megalodon Chomp -> T4 Giganotosaurus -> T5 Paragon Beast Lord
        const bone = gm(0xf5f5f4, 'std', null, 0, 0.1, 0.6);
        bracers(g, cloth(0x78350f));
        [GA.rh, GA.lh].forEach(function(p) { for (let k = 0; k < 3; k++) ad(g, Cone(0.03, 0.18, 4), bone, p[0] * 1.08 + (k - 1) * 0.05, p[1] - 0.05, p[2] + 0.12, 0.6); });
        if (T >= 3) { for (let i = 0; i < 5; i++) ad(g, Cone(0.04, 0.14, 3), bone, -0.2 + i * 0.1, 1.12 - Math.abs(i - 2) * 0.04, 0.36, Math.PI); ad(g, Cone(0.25, 0.6, 3), cloth(0x475569), 0, 1.15, -0.5, -0.3, 0, 0, 1, 1, 0.25); }
        if (T >= 4) { cap(g, bone, 0.62, 0.42); for (let i = 0; i < 6; i++) ad(g, Cone(0.035, 0.14, 4), bone, -0.25 + i * 0.1, GA.hy + 0.04, GA.face - 0.02, Math.PI); horns(g, bone, 0.3, 0.3, 0.7); }
        if (T >= 5) { cape(g, cloth(0x78350f), 1.0); pauldrons(g, bone, 3, bone); orbit(g, mkBird(0x57534e), 2, 1.1, 1.8, 1.4, 0.1, true); }
      },
      desperado: function(g, T) { // T2 High Noon -> T3 Ricochet Rounds -> T4 Quickdraw Fan -> T5 Paragon Golden Justice
        cowboyHat(g, cloth(T >= 5 ? 0xfef3c7 : 0x78350f), T >= 5 ? metal(GOLD) : cloth(0x1c1917));
        const gc = T >= 5 ? metal(GOLD) : metal(0x52525b);
        gun(hand(g, 1), gc, 0.32, 0.04);
        if (T >= 3) { gun(hand(g, -1), gc, 0.32, 0.04); orbit(g, mkOrb(0xfde047, 0.04), 3, 0.7, 0.9, 4.0, 0.05); }
        if (T >= 4) { cape(g, cloth(0xb45309), 0.7, 0.95); ad(g, Tor(0.42, 0.05, Math.PI * 0.95), cloth(0x422006), 0, 0.88, 0, 0, 0, 0.8); }
        if (T >= 5) { const st = sub(g, -0.18, 1.02, 0.36); radial(sub(st, 0, 0, 0, Math.PI / 2), 5, 0.06, 0.03, 0.08, metal(GOLD), 0); ad(st, Cyl(0.05, 0.05, 0.02, 10), metal(GOLD), 0, 0, 0, Math.PI / 2); }
      },
      alchemist: function(g, T) { // T2 Acidic Mixture -> T3 Berserker Brew -> T4 Transformation -> T5 Paragon Rubber to Gold
        belt(g, cloth(0x422006), glow(0x84cc16, 0.9), 3);
        if (T >= 3) { flask(hand(g, 1), 0xef4444); aura(g, 0xef4444, 0.08); }
        if (T >= 4) { backpack(g, metal(0xd4a017), 0.46, 0.5, 0.24); [0x22c55e, 0xa855f7, 0xef4444].forEach(function(c, i) { ad(g, Sph(0.075), glow(c), -0.14 + i * 0.14, 1.22, -0.44); }); flask(hand(g, -1), 0xa855f7); goggles(g, 0x78350f, 0xa3e635, 2); }
        if (T >= 5) { crown(g, metal(GOLD), 5, 0.18); orbit(g, mkCoin(), 3, 0.8, 1.2, 2.0, 0.1); orbit(g, mkOrb(0xbef264, 0.06), 3, 0.65, 0.95, -2.2, 0.15); }
      },
      druid: function(g, T) { // T2 Thorn Volley -> T3 Heart of Oak -> T4 Ball of Lightning -> T5 Paragon Avatar of Wrath
        crown(g, cloth(0x22c55e), 6, 0.14);
        [GA.rh, GA.lh].forEach(function(p) { for (let k = 0; k < 3; k++) ad(g, Cone(0.035, 0.14, 4), wood(0x14532d), p[0] * (1.0 + k * 0.05), p[1] + 0.1 + k * 0.08, p[2] * 0.6, 0, 0, p[0] > 0 ? -1.1 : 1.1); });
        if (T >= 3) { chestplate(g, wood(0x5b3a1a), 0x4ade80); ad(g, Sph(0.09), glow(0xef4444), 0, 0.94, 0.44); }
        if (T >= 4) { staff(hand(g, 1), wood(), 1.25, glow(0xfde047), 0.16); orbit(g, mkOrb(0xfde047, 0.09), 2, 0.75, 1.55, 2.6, 0.08); }
        if (T >= 5) { antlers(g, glow(0x86efac, 0.9), true); aura(g, 0x22c55e, 0.12); orbit(g, mkLeaf(0x4ade80), 6, 1.05, 0.9, 1.2, 0.1); }
      }
    };

    // Accent palette for generic suit tint (subtle, never touches eyes/skin)
    const B13_SUIT_TINT = {
      quincy: [0x15803d, 0x0f766e, 0x7c2d12], gwendolin: [0xdc2626, 0x9a3412, 0xb45309], obyn: [0x166534, 0x065f46, 0x3f6212],
      sauda: [0x334155, 0x991b1b, 0x1e3a8a], benjamin: [0x14532d, 0x0f172a, 0x854d0e], supermonkey: [0xeab308, 0x334155, 0x18181b],
      silas: [0x0ea5e9, 0x93c5fd, 0x0369a1], rosalia: [0xea580c, 0x3f6212, 0x0369a1], corvus: [0x1e1b4b, 0x4c1d95, 0x18181b], geraldo: [0x92400e, 0x7c2d12, 0x713f12]
    };

    function buildB13TierGear(unitKey, tier, path, secondary) {
      const g = new THREE.Group();
      g.name = 'b13_tier_crest';
      g.userData = { spin: [], orbit: [], clock: 0 };
      const T = Math.max(1, Math.min(5, tier));
      if (T < 2) return g;
      let k = String(unitKey).toLowerCase();
      if (k === 'super' && !COMP_GEAR.super) k = 'supermonkey';
      try {
        if (HERO_GEAR[k]) HERO_GEAR[k][Math.max(0, Math.min(2, path || 0))](g, T);
        else if (COMP_GEAR[k]) COMP_GEAR[k](g, T);
        else { headband(g, cloth(0xfacc15)); if (T >= 3) pauldrons(g, metal(STEEL)); if (T >= 4) cape(g, cloth(0x1d4ed8), 0.9); if (T >= 5) wings(g, glow(0xfde047, 0.9), glow(0xffffff, 0.9), 2, 0.9); }
      } catch (err) {
        console.warn('[B13 gear] build failed for', unitKey, T, path, err);
      }
      if (secondary && HERO_GEAR[k] && secondary.path !== path && secondary.tier >= 3) {
        try {
          const tmp = new THREE.Group();
          tmp.userData = { spin: [], orbit: [], clock: 0 };
          HERO_GEAR[k][secondary.path](tmp, Math.min(5, secondary.tier));
          const moved = new Set();
          tmp.userData.orbit.forEach(function(o) {
            if (!(o.r > 0) || o.o.parent !== tmp) return;
            tmp.remove(o.o); g.add(o.o); moved.add(o.o);
            g.userData.orbit.push({ o: o.o, r: o.r + 0.32, y: o.y + 0.22, s: -o.s, ph: o.ph + 0.7, bob: o.bob, face: o.face });
          });
          tmp.userData.spin.forEach(function(sp) { if (moved.has(sp.o)) g.userData.spin.push(sp); });
        } catch (err2) { console.warn('[B13 gear] secondary accent failed', unitKey, err2); }
      }
      return g;
    }

    // Find the unit's head in its own local frame so gear fits any mesh (HTML heroes, full monkey meshes)
    function b13FindAnchors(mesh) {
      if (mesh.userData._b13Anchors) return mesh.userData._b13Anchors;
      const saved = { p: mesh.position.clone(), r: mesh.rotation.clone(), s: mesh.scale.clone() };
      mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
      mesh.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
      let minY = Infinity, maxY = -Infinity;
      const spheres = [];
      mesh.traverse(function(c) {
        if (!c.isMesh || !c.geometry || String(c.name).indexOf('b13_') === 0) return;
        if (!c.geometry.boundingSphere) c.geometry.computeBoundingSphere();
        const bs = c.geometry.boundingSphere.clone().applyMatrix4(c.matrixWorld).applyMatrix4(inv);
        minY = Math.min(minY, bs.center.y - bs.radius);
        maxY = Math.max(maxY, bs.center.y + bs.radius);
        if (c.geometry.type === 'SphereGeometry' || c.geometry.type === 'SphereBufferGeometry') spheres.push(bs);
      });
      mesh.position.copy(saved.p); mesh.rotation.copy(saved.r); mesh.scale.copy(saved.s);
      mesh.updateMatrixWorld(true);
      let head = null;
      const midY = minY + (maxY - minY) * 0.5;
      spheres.forEach(function(s) { if (s.center.y > midY && (!head || s.radius > head.radius)) head = s; });
      const a = head ? { x: head.center.x, y: head.center.y, z: head.center.z, r: head.radius } : { x: 0, y: GA.hy, z: GA.hz, r: GA.hr };
      if (!(a.r > 0.05 && isFinite(a.y))) { a.x = 0; a.y = GA.hy; a.z = GA.hz; a.r = GA.hr; }
      mesh.userData._b13Anchors = a;
      return a;
    }

    const b13AnimatedCrests = new Set();
    function animateB13Crests(dt) {
      b13AnimatedCrests.forEach(function(cg) {
        if (!cg.parent) { b13AnimatedCrests.delete(cg); return; }
        const ud = cg.userData;
        ud.clock = (ud.clock || 0) + dt;
        for (let i = 0; i < ud.spin.length; i++) { const s = ud.spin[i]; s.o.rotation[s.ax] += s.s * dt; }
        for (let i = 0; i < ud.orbit.length; i++) {
          const o = ud.orbit[i];
          if (o.r === 0) { o.o.position.y = o.y + Math.sin(ud.clock * 2.4 + o.ph) * o.bob; continue; }
          const a = o.ph + ud.clock * o.s;
          o.o.position.set(Math.cos(a) * o.r, o.y + Math.sin(ud.clock * 3.0 + o.ph) * (o.bob || 0), Math.sin(a) * o.r);
          if (o.face) { const sg = o.s >= 0 ? 1 : -1; o.o.rotation.y = Math.atan2(-Math.sin(a) * sg, Math.cos(a) * sg); }
        }
      });
    }

    function b13TintSuit(mesh, unitKey, T, path) {
      const ud = mesh.userData;
      if (!ud._b13Suit) {
        const counts = new Map();
        mesh.traverse(function(c) {
          if (c.isMesh && c.material && c.material.isMeshStandardMaterial && String(c.name).indexOf('b13_') !== 0) {
            const hx = c.material.color.getHex();
            counts.set(hx, (counts.get(hx) || 0) + 1);
          }
        });
        let best = null, bc = 0;
        counts.forEach(function(n, hx) { if (n > bc && [0xfb923c, 0xfacc15, 0x1e293b, 0xffffff].indexOf(hx) === -1) { bc = n; best = hx; } });
        ud._b13Suit = { hex: best, mats: [] };
        if (best !== null) {
          const done = new Map();
          mesh.traverse(function(c) {
            if (c.isMesh && c.material && c.material.isMeshStandardMaterial && String(c.name).indexOf('b13_') !== 0 && c.material.color.getHex() === best) {
              if (!done.has(c.material)) { const cl = c.material.clone(); done.set(c.material, cl); ud._b13Suit.mats.push(cl); }
              c.material = done.get(c.material);
            }
          });
        }
      }
      const info = ud._b13Suit;
      if (info.hex === null) return;
      const k = String(unitKey).toLowerCase();
      const col = new THREE.Color(info.hex);
      if (k === 'supermonkey' || k === 'super') {
        let tgt = null;
        if (path === 0 && T === 3) tgt = 0x6d28d9;
        else if (path === 0 && T >= 4) tgt = T >= 5 ? 0xfde68a : 0xeab308;
        else if (path === 1 && T >= 3) tgt = T >= 5 ? 0x1e293b : 0x475569;
        else if (path === 2 && T >= 3) tgt = 0x18181b;
        if (tgt !== null) col.setHex(tgt);
      } else {
        const tints = B13_SUIT_TINT[k];
        const amt = [0, 0, 0, 0.3, 0.5, 0.7][T] || 0;
        if (tints && amt > 0) col.lerp(new THREE.Color(tints[Math.max(0, Math.min(2, path))]), amt);
      }
      info.mats.forEach(function(m) { m.color.copy(col); });
    }

    function applyCharacterTierEvolution(mesh, unitKey, tier, pathIndex, secondary) {
      if (!mesh) return;
      const T = Math.max(1, Math.min(5, tier || 1));
      const P = Math.max(0, Math.min(2, pathIndex || 0));
      const sig = String(unitKey) + '_T' + T + '_P' + P + (secondary ? '_S' + secondary.path + '_' + secondary.tier : '');
      if (mesh.userData._b13EvoSig === sig) return;
      mesh.userData._b13EvoSig = sig;

      const oldCrest = mesh.getObjectByName('b13_tier_crest');
      if (oldCrest && oldCrest.parent) oldCrest.parent.remove(oldCrest);
      const oldSafe = mesh.getObjectByName('b13_safe_gear');
      if (oldSafe && oldSafe.parent) oldSafe.parent.remove(oldSafe);

      b13TintSuit(mesh, unitKey, T, P);

      const crest = buildB13TierGear(unitKey, T, P, secondary);
      const a = b13FindAnchors(mesh);
      const s = a.r / GA.hr;
      crest.scale.setScalar(s);
      crest.position.set(a.x, a.y - GA.hy * s, a.z - GA.hz * s);
      mesh.add(crest);
      if (crest.userData.spin.length || crest.userData.orbit.length) b13AnimatedCrests.add(crest);
    }

    // ------------------------------------------------------------------------
    // E5. REAL BTD6 LOOKS (Phase 2 pilot: Super Monkey hero + Dartling Gunner)
    //     Full replacement models per real tier R (0 = base, 1-5 = upgrade tiers) and path P.
    //     References: builds/references/BTD6_SuperMonkey_paths.png, BTD6_DartlingGunner_paths.png
    // ------------------------------------------------------------------------
    const B13R = (function () {
      const MC = new Map(), GC = new Map();
      function M(hex, o) {
        o = o || {};
        const key = hex + '|' + JSON.stringify(o);
        if (MC.has(key)) return MC.get(key);
        let m;
        if (o.basic) {
          m = new THREE.MeshBasicMaterial({ color: hex, transparent: o.op !== undefined, opacity: o.op !== undefined ? o.op : 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.op === undefined, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
        } else {
          m = new THREE.MeshStandardMaterial({ color: hex, roughness: o.r !== undefined ? o.r : 0.55, metalness: o.m || 0, emissive: o.e !== undefined ? o.e : 0x000000, emissiveIntensity: o.ei !== undefined ? o.ei : 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });
        }
        m.userData.b13Shared = true;
        MC.set(key, m);
        return m;
      }
      function GEO(key, make) { if (!GC.has(key)) GC.set(key, make()); return GC.get(key); }
      const sph = function(r, w, h) { w = w || 20; h = h || 16; return GEO('s' + r + '_' + w + '_' + h, function() { return new THREE.SphereGeometry(r, w, h); }); };
      const hemi = function(r, f) { f = f || 0.5; return GEO('h' + r + '_' + f, function() { return new THREE.SphereGeometry(r, 26, 14, 0, Math.PI * 2, 0, Math.PI * f); }); };
      const cyl = function(rt, rb, h, s, open) { s = s || 16; return GEO('c' + rt + '_' + rb + '_' + h + '_' + s + (open ? 'o' : ''), function() { return new THREE.CylinderGeometry(rt, rb, h, s, 1, !!open); }); };
      const box = function(x, y, z) { return GEO('b' + x + '_' + y + '_' + z, function() { return new THREE.BoxGeometry(x, y, z); }); };
      const cone = function(r, h, s) { s = s || 12; return GEO('k' + r + '_' + h + '_' + s, function() { return new THREE.ConeGeometry(r, h, s); }); };
      const tor = function(r, t, arc, rs, ts) { arc = arc || Math.PI * 2; return GEO('t' + r + '_' + t + '_' + arc.toFixed(3) + '_' + (rs || 10), function() { return new THREE.TorusGeometry(r, t, rs || 10, ts || 28, arc); }); };
      const band = function(r, h, a0, al) { return GEO('band' + r + '_' + h + '_' + a0.toFixed(2) + '_' + al.toFixed(2), function() { return new THREE.CylinderGeometry(r, r, h, 28, 1, true, a0, al); }); };
      const OUT = new THREE.MeshBasicMaterial({ color: 0x161616, side: THREE.BackSide });
      OUT.userData.b13Shared = true;

      function P(parent, geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) {
        const m = new THREE.Mesh(geo, mat);
        m.name = 'b13r';
        m.position.set(x || 0, y || 0, z || 0);
        m.rotation.set(rx || 0, ry || 0, rz || 0);
        if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
        m.castShadow = !(mat.transparent);
        parent.add(m);
        return m;
      }
      function OL(mesh, k) {
        const o = new THREE.Mesh(mesh.geometry, OUT);
        o.name = 'b13r_ol';
        o.scale.setScalar(1 + (k || 0.06));
        mesh.add(o);
        return mesh;
      }
      function grp(parent, x, y, z, rx, ry, rz, s) {
        const g = new THREE.Group();
        g.position.set(x || 0, y || 0, z || 0);
        g.rotation.set(rx || 0, ry || 0, rz || 0);
        if (s) g.scale.setScalar(s);
        if (parent) parent.add(g);
        return g;
      }

      // BTD6 palette
      const FUR = 0x8a5a2e, FACE = 0xe8b07c, DARKEYE = 0x1a0f08, GOLD = 0xf5c518, RED = 0xd92323;
      const BLUE = 0x1f63d8, STEEL = 0x9aa3ad, GUNMETAL = 0x3b4048, BLACK = 0x1c1d21;

      function cape(parent, hex, w, h, flare, y, z, tilt, trim) {
        const geo = new THREE.PlaneGeometry(w, h, 6, 8);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const px = pos.getX(i), py = pos.getY(i);
          const down = 1 - (py + h / 2) / h;
          const nx = px * (1 + flare * down);
          pos.setX(i, nx);
          pos.setZ(i, -0.35 * Math.pow(nx / (w * 0.9), 2) - 0.12 * down * down + Math.sin(nx * 5 + down * 3) * 0.03 * down);
        }
        geo.computeVertexNormals();
        const g = grp(parent, 0, y || 1.12, z || -0.26, tilt === undefined ? 0.32 : tilt, 0, 0);
        const m = P(g, geo, M(hex, { ds: true, r: 0.7 }), 0, -h / 2, 0);
        if (trim) P(g, box(w * (1 + flare) * 1.02, 0.06, 0.03), M(trim, { m: 0.4, r: 0.35 }), 0, -h + 0.02, -0.12);
        g.userData.cape = true;
        return g;
      }

      // Chibi BTD6 monkey. Feet at y = 0, head centre y = 1.42 (r 0.56) to match the game's head anchor.
      function monkey(o) {
        o = o || {};
        const suit = o.suit !== undefined ? o.suit : FUR;
        const sm = o.suitMat || M(suit, { r: o.suitRough !== undefined ? o.suitRough : 0.55, m: o.suitMetal || 0, e: o.suitEmis || 0, ei: o.suitEi || 1 });
        const fm = o.faceMat || M(o.face !== undefined ? o.face : FACE, { r: 0.6, e: o.faceEmis || 0, ei: o.faceEi || 1 });
        const hm = o.handMat || M(o.hands !== undefined ? o.hands : FUR, { r: 0.55, m: o.handMetal || 0, e: o.handEmis || 0 });
        const ftm = o.footMat || M(o.feet !== undefined ? o.feet : FUR, { r: 0.55, m: o.footMetal || 0 });
        const K = { root: grp(null) };
        const R = K.root;
        // Head
        const head = grp(R, 0, 1.42, 0);
        K.head = head;
        OL(P(head, sph(0.56, 30, 24), sm, 0, 0, 0), 0.05);
        if (o.face !== null) {
          if (!o.cowl) P(head, sph(0.4, 26, 20), fm, 0, -0.03, 0.3, 0, 0, 0, 1.08, 0.92, 0.66);
          P(head, sph(0.26, 22, 16), fm, 0, -0.18, 0.42, 0, 0, 0, 1.28, 0.8, 0.72);
          // nostrils + mouth
          [-0.04, 0.04].forEach(function(x) { P(head, sph(0.022, 8, 6), M(DARKEYE), x, -0.11, 0.62); });
          if (o.mouth === 'open') { P(head, sph(0.075, 14, 10), M(0x5a1010), 0, -0.25, 0.575, 0, 0, 0, 1.2, 0.8, 0.4); }
          else if (o.mouth === 'grin') { P(head, box(0.2, 0.05, 0.03), M(0xffffff), 0, -0.24, 0.6); }
          else if (o.mouth !== 'none') { P(head, tor(0.075, 0.016, Math.PI, 6, 14), M(0x3a1308), 0, -0.21, 0.6, 0, 0, Math.PI); }
        }
        // Eyes
        K.eyes = [];
        if (o.eyes !== 'none') {
          [-1, 1].forEach(function(s) {
            const e = grp(head, s * 0.17, 0.06, 0.52, 0, s * 0.22, 0);
            K.eyes.push(e);
            if (o.eyes === 'glow') {
              P(e, sph(0.13, 14, 12), M(o.eyeCol || 0xffffff, { basic: true }), 0, 0, 0.02, 0, 0, s * (o.eyeTilt || 0), 0.95, 0.85, 0.45);
            } else if (o.eyes === 'white') {
              P(e, sph(0.14, 16, 12), M(0xffffff, { basic: true }), 0, 0, 0.02, 0, 0, s * (o.eyeTilt === undefined ? 0.35 : o.eyeTilt), 0.95, 1.15, 0.45);
            } else {
              P(e, sph(0.135, 16, 14), M(0xffffff, { r: 0.2 }), 0, 0, 0, 0, 0, 0, 0.85, 1.15, 0.45);
              P(e, sph(0.072, 12, 10), M(DARKEYE, { r: 0.2 }), -s * 0.012, -0.01, 0.05, 0, 0, 0, 0.95, 1.2, 0.5);
              P(e, sph(0.024, 6, 6), M(0xffffff, { basic: true }), -s * 0.03, 0.035, 0.085);
            }
          });
        }
        // Ears
        K.ears = [];
        if (!o.noEars) {
          [-1, 1].forEach(function(s) {
            const ear = grp(head, s * 0.55, 0.02, -0.02, 0, 0, s * -0.15);
            K.ears.push(ear);
            OL(P(ear, cyl(0.18, 0.18, 0.08, 18), sm, 0, 0, 0, 0, 0, Math.PI / 2), 0.08);
            if (!o.cowl) P(ear, cyl(0.11, 0.11, 0.09, 16), fm, s * 0.012, 0, 0.0, 0, 0, Math.PI / 2);
          });
        }
        if (o.headOnly) return K;
        // Body
        const body = grp(R, 0, 0, 0);
        K.body = body;
        OL(P(body, sph(0.33, 22, 18), sm, 0, 0.82, 0, 0, 0, 0, 1.0, 1.12, 0.88), 0.05);
        if (o.belly) P(body, sph(0.22, 18, 14), fm, 0, 0.78, 0.17, 0, 0, 0, 1.0, 1.15, 0.6);
        // Arms (pivot at shoulder)
        K.arms = [];
        K.hands = [];
        [-1, 1].forEach(function(s) {
          const a = grp(R, s * 0.31, 1.02, 0.02, 0, 0, s * 0.28);
          OL(P(a, cyl(0.085, 0.08, 0.38, 12), sm, 0, -0.19, 0), 0.08);
          const hand = OL(P(a, sph(0.12, 14, 12), hm, 0, -0.42, 0.02), 0.07);
          K.arms.push(a); K.hands.push(hand);
        });
        // Legs (pivot at hip)
        K.legs = [];
        [-1, 1].forEach(function(s) {
          const l = grp(R, s * 0.15, 0.52, 0);
          OL(P(l, cyl(0.1, 0.095, 0.32, 12), sm, 0, -0.16, 0), 0.08);
          OL(P(l, sph(0.13, 14, 10), ftm, 0, -0.42, 0.06, 0, 0, 0, 1.0, 0.62, 1.4), 0.07);
          K.legs.push(l);
        });
        // Tail
        if (!o.noTail) {
          const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.62, -0.26), new THREE.Vector3(0.05, 0.42, -0.58), new THREE.Vector3(0.16, 0.6, -0.9), new THREE.Vector3(0.1, 0.92, -0.92), new THREE.Vector3(-0.02, 0.98, -0.74)]);
          const tg = GEO('tail', function() { return new THREE.TubeGeometry(curve, 24, 0.05, 8, false); });
          K.tail = P(R, tg, o.tailMat || M(o.tail !== undefined ? o.tail : FUR, { r: 0.55 }), 0, 0, 0);
        }
        return K;
      }
      // Point an arm (pivot) so its hand reaches a target in root space (approx, arm length 0.42)
      function aimArm(arm, rx, rz) { arm.rotation.set(rx, 0, rz); }

      function finish(K, extra) {
        const g = K.root;
        g.userData.rig = { arms: K.arms || [], legs: K.legs || [], head: K.head, float: !!(extra && extra.float), bob: (extra && extra.bob) || 0 };
        g.userData.muzzles = (extra && extra.muzzles) || [];
        g.userData.spin = (extra && extra.spin) || [];
        g.userData.pulse = (extra && extra.pulse) || [];
        g.userData.barrelGroup = (extra && extra.barrel) || null;
        return g;
      }
      function muzzle(parent, x, y, z) { const m = new THREE.Object3D(); m.name = 'b13r_muzzle'; m.position.set(x, y, z); parent.add(m); return m; }
      function glowBall(parent, hex, r, x, y, z, op) { return P(parent, sph(r, 16, 12), M(hex, { basic: true, op: op === undefined ? 0.35 : op, add: true }), x, y, z); }
      function zigzag(parent, hex, x, y, z, len, seg, ry) {
        const g = grp(parent, x, y, z, 0, ry || 0, 0);
        let px = 0, py = 0;
        for (let i = 0; i < seg; i++) {
          const nx = px + len / seg, ny = (i % 2 ? 1 : -1) * len * 0.18;
          const dx = nx - px, dy = ny - py, L = Math.hypot(dx, dy);
          P(g, box(L, 0.035, 0.035), M(hex, { basic: true }), px + dx / 2, py + dy / 2, 0, 0, 0, Math.atan2(dy, dx));
          px = nx; py = ny;
        }
        return g;
      }

      // ================= SUPER MONKEY =================
      function superBase(o) {
        o = o || {};
        const K = monkey({ suit: o.suit !== undefined ? o.suit : BLUE, hands: o.hands !== undefined ? o.hands : FUR, feet: o.feet !== undefined ? o.feet : RED, eyes: o.eyes, eyeCol: o.eyeCol, eyeTilt: o.eyeTilt, cowl: o.cowl, mouth: o.mouth || 'open', suitMetal: o.suitMetal, suitRough: o.suitRough, suitEmis: o.suitEmis, suitEi: o.suitEi, face: o.face, faceEmis: o.faceEmis, tail: o.tail, handEmis: o.handEmis });
        const R = K.root;
        // fist-forward flying pose
        aimArm(K.arms[1], -1.45, -0.15);
        aimArm(K.arms[0], 0.2, 0.55);
        if (o.capeCol !== null) K.cape = cape(R, o.capeCol !== undefined ? o.capeCol : RED, o.capeW || 0.78, o.capeH || 0.95, o.flare === undefined ? 0.45 : o.flare, 1.12, -0.26, 0.3, o.capeTrim);
        if (o.belt !== null) {
          P(R, tor(0.3, 0.05, Math.PI * 2, 8, 24), M(o.belt || GOLD, { m: 0.3, r: 0.35 }), 0, 0.6, 0, Math.PI / 2, 0, 0);
          const em = grp(R, 0, 0.93, 0.29, -0.15, 0, 0);
          P(em, cyl(0.12, 0.12, 0.03, 20), M(o.emblem || GOLD, { m: 0.3, r: 0.35, e: o.emblemEmis || 0 }), 0, 0, 0, Math.PI / 2);
          P(em, cyl(0.08, 0.08, 0.035, 18), M(o.emblemIn || RED, { r: 0.4 }), 0, 0, 0.004, Math.PI / 2);
          P(em, box(0.03, 0.1, 0.04), M(o.emblem || GOLD), 0, 0, 0.012, 0, 0, 0.6);
        }
        return K;
      }
      function laserVisor(head, frame, lens) {
        OL(P(head, band(0.61, 0.42, -Math.PI * 0.45, Math.PI * 0.9), M(frame, { m: 0.6, r: 0.25, ds: true }), 0, 0.07, 0), 0.03);
        P(head, band(0.625, 0.3, -Math.PI * 0.3, Math.PI * 0.6), M(lens, { basic: true, ds: true }), 0, 0.07, 0);
        P(head, band(0.63, 0.04, -Math.PI * 0.28, Math.PI * 0.56), M(0xffffff, { basic: true, op: 0.55, ds: true }), 0, 0.16, 0);
      }
      function superLook(R, P_) {
        let K, ex = { muzzles: [], spin: [], pulse: [] };
        if (R === 0 || (P_ === 0 && R <= 2)) {
          K = superBase({});
          if (R === 1) laserVisor(K.head, GOLD, 0xff2a2a);
          if (R === 2) {
            [[-0.17, 0.06, 0.53, 0.13], [0.17, 0.06, 0.53, 0.13], [-0.1, 0.38, 0.44, 0.1]].forEach(function(l) {
              const g = grp(K.head, l[0], l[1], l[2], -0.25 * (l[1] > 0.2 ? 2 : 0.4), l[0] * 0.8, 0);
              OL(P(g, tor(l[3], 0.04, Math.PI * 2, 8, 22), M(GOLD, { m: 0.6, r: 0.25 }), 0, 0, 0.03), 0.06);
              P(g, cyl(l[3], l[3], 0.03, 20), M(0xa855f7, { e: 0x7c22ce, ei: 0.8, r: 0.15 }), 0, 0, 0.03, Math.PI / 2);
              P(g, sph(0.03, 6, 6), M(0xf5d0fe, { basic: true }), -l[3] * 0.35, l[3] * 0.35, 0.06);
            });
            P(K.head, box(0.12, 0.05, 0.05), M(GOLD, { m: 0.6 }), 0, 0.08, 0.58);
          }
          ex.muzzles.push(muzzle(K.hands[1], 0, -0.1, 0.1));
        } else if (P_ === 0) {
          if (R === 3) { // Sun Avatar: all-gold glowing monkey
            K = superBase({ suit: 0xf7b512, suitEmis: 0x9a5c00, suitEi: 0.55, suitRough: 0.3, suitMetal: 0.25, face: 0xffd65c, faceEmis: 0x8a5a00, hands: 0xf7b512, handEmis: 0x7a4a00, feet: 0xf7b512, tail: 0xf2a90c, eyes: 'glow', eyeCol: 0xfffbe6, capeCol: 0xffc21a, belt: 0xffe27a, emblem: 0xfff3b0, emblemIn: 0xf59e0b, mouth: 'none' });
            ex.pulse.push(glowBall(K.root, 0xffc93c, 1.05, 0, 1.15, 0, 0.16));
            ex.muzzles.push(muzzle(K.hands[1], 0, -0.1, 0.1));
          } else if (R === 4) { // Sun Temple: golden stepped pyramid crowned by a sun monkey head
            K = { root: grp(null) };
            const tm = M(0xf2ae10, { e: 0x6b3f00, ei: 0.45, r: 0.35, m: 0.25 }), tl = M(0xffd34d, { e: 0x7a4a00, ei: 0.5, r: 0.3 });
            const steps = [[2.1, 0.32], [1.7, 0.32], [1.3, 0.32], [0.95, 0.3]];
            let y = 0;
            steps.forEach(function(s, i) { OL(P(K.root, box(s[0], s[1], s[0]), i % 2 ? tl : tm, 0, y + s[1] / 2, 0), 0.02); y += s[1]; });
            for (let i = 0; i < 6; i++) P(K.root, box(0.5, 0.06, 0.16), tl, 0, 0.05 + i * 0.2, 1.05 - i * 0.2 * 0.62 + 0.0);
            const hk = monkey({ headOnly: true, suit: 0xf7b512, suitEmis: 0x9a5c00, suitEi: 0.6, face: 0xffd65c, faceEmis: 0x8a5a00, eyes: 'glow', eyeCol: 0xfffbe6, mouth: 'none' });
            hk.head.position.set(0, y + 0.55, 0);
            hk.head.scale.setScalar(1.15);
            K.root.add(hk.head);
            K.head = hk.head;
            const rays = grp(K.root, 0, y + 0.6, -0.15);
            for (let r = 0; r < 12; r++) { const a = (r / 12) * Math.PI * 2; P(rays, cone(0.08, 0.55, 4), M(0xffe066, { basic: true, op: 0.7, add: true }), Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0, 0, 0, a - Math.PI / 2); }
            ex.spin.push({ o: rays, ax: 'z', s: 0.6 });
            ex.pulse.push(glowBall(K.root, 0xffd23f, 1.4, 0, 1.2, 0, 0.14));
            ex.muzzles.push(muzzle(K.root, 0, y + 0.55, 0.7));
            return finish(K, ex);
          } else { // True Sun God: pale white-gold deity with a rayed halo, floating
            K = superBase({ suit: 0xfff1cf, suitEmis: 0x8a6a2a, suitEi: 0.35, suitRough: 0.35, face: 0xffe6a8, faceEmis: 0x6b4a10, hands: 0xfff1cf, feet: 0xfff1cf, tail: 0xffe7b0, eyes: 'glow', eyeCol: 0xffffff, capeCol: null, belt: GOLD, emblem: GOLD, emblemIn: 0xffffff, emblemEmis: 0x7a5a00, mouth: 'none' });
            aimArm(K.arms[0], -0.2, 1.1); aimArm(K.arms[1], -0.2, -1.1);
            const gm = M(GOLD, { m: 0.65, r: 0.25, e: 0x5a3a00, ei: 0.4 });
            K.arms.forEach(function(a) { P(a, tor(0.1, 0.035, Math.PI * 2, 6, 16), gm, 0, -0.32, 0, Math.PI / 2, 0, 0); });
            K.legs.forEach(function(l) { P(l, tor(0.11, 0.035, Math.PI * 2, 6, 16), gm, 0, -0.28, 0, Math.PI / 2, 0, 0); });
            P(K.root, tor(0.26, 0.05, Math.PI * 2, 8, 20), gm, 0, 1.08, 0, Math.PI / 2 - 0.2, 0, 0);
            const halo = grp(K.head, 0, 0.1, -0.5);
            OL(P(halo, tor(0.72, 0.06, Math.PI * 2, 8, 40), gm, 0, 0, 0), 0.04);
            for (let r = 0; r < 14; r++) { const a = (r / 14) * Math.PI * 2; P(halo, cone(0.09, 0.42, 4), M(0xffd84a, { e: 0x8a5a00, ei: 0.6, m: 0.4, r: 0.3 }), Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0, 0, 0, a - Math.PI / 2); }
            P(halo, cyl(0.68, 0.68, 0.02, 32), M(0xfff3c4, { basic: true, op: 0.35, add: true }), 0, 0, -0.02, Math.PI / 2);
            ex.spin.push({ o: halo, ax: 'z', s: 0.5 });
            ex.pulse.push(glowBall(K.root, 0xfff3c4, 1.1, 0, 1.2, 0, 0.18));
            ex.float = true; ex.bob = 0.12;
            ex.muzzles.push(muzzle(K.hands[1], 0, -0.1, 0.1), muzzle(K.hands[0], 0, -0.1, 0.1));
            K.root.position.y = 0;
            const out = finish(K, ex);
            out.userData.rig.lift = 0.3;
            return out;
          }
        } else if (P_ === 1) {
          if (R <= 2) {
            K = superBase({ capeTrim: GOLD });
            const cm = M(R === 1 ? GOLD : STEEL, { m: 0.6, r: 0.3 });
            K.arms.forEach(function(a) { OL(P(a, cyl(0.11, 0.1, 0.13, 14), cm, 0, -0.3, 0), 0.06); });
            if (R === 2) {
              OL(P(K.head, tor(0.565, 0.08, Math.PI, 8, 26), M(STEEL, { m: 0.55, r: 0.3 }), 0, 0, 0, 0, Math.PI / 2, 0), 0.03);
              K.legs.forEach(function(l) { P(l, cyl(0.12, 0.12, 0.12, 14), cm, 0, -0.25, 0); });
            }
            ex.muzzles.push(muzzle(K.hands[1], 0, -0.1, 0.1));
          } else {
            const robo = R === 3 ? { body: 0x8d939c, trim: 0x6d28d9, gun: 0x7c3aed, ring: 0x2e1065, eye: null } : R === 4 ? { body: 0x4b5260, trim: 0x22c55e, gun: 0x7c3aed, ring: 0x22c55e, eye: 0xff2a2a } : { body: 0xb21d1d, trim: 0x1f1f1f, gun: 0xf5b70f, ring: 0xd92323, eye: 0xff3b1f };
            K = superBase({ suit: robo.body, suitMetal: 0.55, suitRough: 0.32, hands: robo.body, feet: robo.trim === 0x1f1f1f ? 0x1f1f1f : 0x2b2f36, tail: R === 5 ? 0x1f1f1f : 0x6b7280, eyes: robo.eye ? 'glow' : 'none', eyeCol: robo.eye, eyeTilt: 0.3, cowl: true, capeCol: null, belt: null, mouth: R === 3 ? 'open' : 'none', face: R === 3 ? FACE : 0x2b2f36 });
            const mm = M(robo.body, { m: 0.55, r: 0.32 }), dk = M(0x22252b, { m: 0.5, r: 0.4 }), tr = M(robo.trim, { m: 0.4, r: 0.35, e: R === 4 ? 0x0f5a2a : 0, ei: 0.6 });
            if (R === 3) laserVisor(K.head, 0x2b2f36, 0x111317);
            if (R >= 4) { // skull grill + jaw
              for (let i = -2; i <= 2; i++) P(K.head, box(0.05, 0.09, 0.05), M(R === 5 ? 0xe5e5e5 : 0xf1f5f9, { r: 0.3 }), i * 0.06, -0.27, 0.55);
              P(K.head, box(0.36, 0.06, 0.12), dk, 0, -0.33, 0.48);
              if (R === 5) [-1, 1].forEach(function(s) { P(K.head, cone(0.08, 0.3, 6), dk, s * 0.38, 0.45, 0, 0, 0, -s * 0.5); });
              else [-1, 1].forEach(function(s) { P(K.head, cyl(0.02, 0.02, 0.35, 6), dk, s * 0.32, 0.6, 0, 0, 0, -s * 0.3); P(K.head, sph(0.05, 8, 6), M(0x22c55e, { basic: true }), s * 0.37, 0.77, 0); });
            }
            OL(P(K.root, box(0.5, 0.36, 0.2), mm, 0, 0.88, 0.16), 0.03);
            P(K.root, box(0.3, 0.06, 0.05), tr, 0, 0.92, 0.27);
            [-1, 1].forEach(function(s) { OL(P(K.root, sph(0.16, 14, 10), tr, s * 0.36, 1.1, 0, 0, 0, 0, 1.0, 0.7, 1.0), 0.05); });
            // arm cannons
            const big = R === 5 ? 1.35 : (R === 4 ? 1.15 : 1.0);
            const armsWithGun = R === 3 ? [1] : [0, 1];
            aimArm(K.arms[0], -1.35, 0.18); aimArm(K.arms[1], -1.35, -0.18);
            armsWithGun.forEach(function(idx) {
              const a = K.arms[idx];
              const gun = grp(a, 0, -0.42, 0.04, Math.PI / 2, 0, 0, big);
              OL(P(gun, cyl(0.16, 0.16, 0.62, 18), M(robo.gun, { m: 0.4, r: 0.35 }), 0, -0.12, 0), 0.04);
              [-0.32, 0.0, 0.12].forEach(function(yy) { P(gun, cyl(0.175, 0.175, 0.07, 18), M(robo.ring, { m: 0.4, r: 0.35, e: R === 4 ? 0x0f5a2a : 0, ei: 0.8 }), 0, yy, 0); });
              P(gun, cyl(0.1, 0.12, 0.06, 16), M(R === 4 ? 0x4ade80 : (R === 5 ? 0xff3b1f : 0xc4b5fd), { basic: true }), 0, -0.44, 0);
              ex.muzzles.push(muzzle(gun, 0, -0.5, 0));
            });
            if (R === 3) ex.muzzles.push(muzzle(K.hands[0], 0, -0.1, 0.1));
            if (R === 4) { const tank = grp(K.root, 0, 0.95, -0.35); OL(P(tank, cyl(0.15, 0.15, 0.5, 14), M(0x22c55e, { e: 0x0f5a2a, ei: 0.6, r: 0.3 }), 0, 0, 0), 0.04); P(tank, sph(0.15, 12, 8), dk, 0, 0.25, 0); }
            if (R === 5) ex.pulse.push(glowBall(K.root, 0xff3b1f, 0.22, 0, 0.9, 0.3, 0.35));
          }
        } else {
          if (R <= 2) {
            K = superBase({ eyes: R === 2 ? 'white' : undefined, eyeTilt: 0 });
            const ym = M(GOLD, { r: 0.4 });
            OL(P(K.head, tor(0.56, 0.13, Math.PI, 8, 28), ym, 0, 0.02, 0, 0, Math.PI / 2, 0), 0.02);
            K.ears.forEach(function(e) { P(e, cyl(0.185, 0.185, 0.05, 18), ym, 0, 0, 0, 0, 0, Math.PI / 2); });
            if (R === 2) K.eyes.forEach(function(e) { P(e, tor(0.135, 0.03, Math.PI * 2, 6, 20), M(0x1e3a8a, { r: 0.3 }), 0, 0, 0.05, 0, 0, 0, 0.92, 1.12, 1); });
            ex.muzzles.push(muzzle(K.hands[1], 0, -0.1, 0.1));
          } else {
            const dark = R === 5 ? 0x3a4459 : (R === 4 ? 0x1d1c2a : 0x24252b);
            K = superBase({ suit: dark, suitMetal: R === 5 ? 0.5 : 0.1, suitRough: R === 5 ? 0.35 : 0.6, hands: dark, feet: 0x15161a, tail: dark, eyes: R === 5 ? 'glow' : 'white', eyeCol: 0x9be7ff, eyeTilt: 0.45, cowl: true, capeCol: R === 5 ? null : (R === 4 ? 0x2d2540 : 0x2a2c33), capeW: R === 4 ? 0.9 : 0.8, capeH: R === 4 ? 1.15 : 1.0, flare: R === 4 ? 0.9 : 0.55, belt: 0x6b7280, emblem: R === 5 ? 0x7dd3fc : 0x6b7280, emblemIn: R === 5 ? 0x0c4a6e : dark, mouth: 'none' });
            const dm = M(dark, { m: R === 5 ? 0.5 : 0.1, r: R === 5 ? 0.35 : 0.6 });
            K.ears.forEach(function(e) { e.visible = false; });
            [-1, 1].forEach(function(s) { OL(P(K.head, cone(0.13, R >= 4 ? 0.5 : 0.36, 4), dm, s * 0.3, 0.55, -0.02, 0, 0, -s * 0.22), 0.05); });
            if (R >= 4) {
              const bl = M(0xd4d9e0, { m: 0.75, r: 0.2 });
              K.arms.forEach(function(a, i) { const s = i ? 1 : -1; const b = grp(a, s * 0.08, -0.25, 0.08, 0, 0, s * 0.3); P(b, tor(0.22, 0.03, Math.PI * 0.75, 6, 16), bl, 0, 0, 0, Math.PI / 2, 0, 0); });
              [-1, 1].forEach(function(s) { P(K.root, cone(0.06, 0.24, 6), dm, s * 0.34, 1.2, -0.02, 0, 0, -s * 0.9); });
            }
            if (R === 5) {
              const wm = M(0x2f3a55, { ds: true, r: 0.5, m: 0.3 });
              [-1, 1].forEach(function(s) {
                const sh = new THREE.Shape();
                sh.moveTo(0, 0); sh.lineTo(1.25, 0.55); sh.lineTo(1.1, -0.1); sh.quadraticCurveTo(0.95, -0.15, 0.85, -0.42); sh.quadraticCurveTo(0.7, -0.25, 0.55, -0.48); sh.quadraticCurveTo(0.42, -0.25, 0.25, -0.5); sh.lineTo(0, -0.2); sh.lineTo(0, 0);
                const wg = GEO('batwing', function() { return new THREE.ShapeGeometry(sh); });
                const w = grp(K.root, s * 0.2, 1.1, -0.3, 0, s * 0.35, 0);
                w.scale.set(s, 1, 1);
                P(w, wg, wm, 0, 0, 0);
                P(w, box(1.3, 0.025, 0.02), M(0x7dd3fc, { basic: true }), 0.62, 0.27, 0.01, 0, 0, 0.42);
              });
              K.arms.forEach(function(a) { P(a, box(0.2, 0.14, 0.2), M(0x5b6880, { m: 0.6, r: 0.3 }), 0, -0.05, 0); });
              ex.pulse.push(glowBall(K.root, 0x38bdf8, 0.8, 0, 1.1, 0, 0.1));
            }
            ex.muzzles.push(muzzle(K.hands[1], 0, -0.1, 0.1));
          }
        }
        return finish(K, ex);
      }

      // ================= DARTLING GUNNER =================
      function helmet(K, hex, o) {
        o = o || {};
        const h = grp(K.head, 0, 0.1, -0.02, -0.12, 0, 0);
        const hm = M(hex, { r: o.r !== undefined ? o.r : 0.5, m: o.m || 0 });
        OL(P(h, hemi(o.size || 0.62, o.cover || 0.52), hm, 0, 0, 0, 0, 0, 0, 1, o.sy || 0.95, 1), 0.04);
        P(h, tor(o.size ? o.size - 0.02 : 0.6, 0.045, Math.PI * 2, 8, 30), M(o.rim || hex, { r: 0.5 }), 0, 0.02, 0, Math.PI / 2, 0, 0);
        K.helmet = h;
        return h;
      }
      function badge(h, kind, a, b) {
        const g = grp(h, 0, 0.36, 0.48, -0.65, 0, 0);
        if (kind === 'none') return g;
        P(g, cyl(0.12, 0.12, 0.03, 20), M(a, { r: 0.4 }), 0, 0, 0, Math.PI / 2);
        if (kind === 'half') P(g, GEO('halfdisc', function() { return new THREE.CircleGeometry(0.115, 20, 0, Math.PI); }), M(b, { r: 0.4 }), 0, 0, 0.017);
        if (kind === 'dot') { P(g, tor(0.085, 0.025, Math.PI * 2, 6, 18), M(b, { r: 0.4 }), 0, 0, 0.018); P(g, cyl(0.06, 0.06, 0.035, 16), M(RED, { r: 0.4 }), 0, 0, 0.006, Math.PI / 2); }
        if (kind === 'wings') { P(g, cyl(0.06, 0.06, 0.035, 16), M(RED), 0, 0, 0.006, Math.PI / 2); [-1, 1].forEach(function(s) { P(g, box(0.14, 0.05, 0.03), M(b), s * 0.14, 0.02, 0.01, 0, 0, s * 0.3); }); }
        if (kind === 'tri') P(g, cone(0.09, 0.03, 3), M(b, { r: 0.4 }), 0, 0, 0.02, Math.PI / 2, 0, Math.PI);
        if (kind === 'diag') P(g, box(0.05, 0.22, 0.035), M(b, { r: 0.4 }), 0, 0, 0.01, 0, 0, 0.75);
        return g;
      }
      function gatling(parent, o) {
        o = o || {};
        const g = grp(parent, o.x !== undefined ? o.x : 0.32, o.y !== undefined ? o.y : 0.8, o.z !== undefined ? o.z : 0.3, 0, 0, 0, o.s || 1.55);
        const body = M(o.body || GUNMETAL, { m: 0.55, r: 0.35 }), ring = M(o.ring || 0x6aa121, { r: 0.45, e: o.ringEmis || 0, ei: 0.8 });
        OL(P(g, cyl(0.17, 0.17, 0.38, 18), body, 0, 0, 0, Math.PI / 2), 0.04);
        P(g, cyl(0.185, 0.185, 0.08, 18), ring, 0, 0, 0.12, Math.PI / 2);
        P(g, cyl(0.185, 0.185, 0.08, 18), ring, 0, 0, -0.1, Math.PI / 2);
        P(g, box(0.12, 0.16, 0.2), body, -0.18, 0.02, -0.08);
        const bg = grp(g, 0, 0, 0.22);
        const bm = M(o.barrel || 0x9aa3ad, { m: 0.65, r: 0.25 });
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P(bg, cyl(0.04, 0.04, 0.55, 10), bm, Math.cos(a) * 0.095, Math.sin(a) * 0.095, 0.27, Math.PI / 2); if (o.tips) P(bg, cyl(0.045, 0.045, 0.06, 10), M(o.tips, { basic: true }), Math.cos(a) * 0.095, Math.sin(a) * 0.095, 0.55, Math.PI / 2); }
        P(bg, cyl(0.15, 0.15, 0.05, 18), M(o.ring || 0x6aa121, { r: 0.45 }), 0, 0, 0.42, Math.PI / 2);
        if (o.scope) OL(P(g, box(0.07, 0.07, 0.22), M(o.scope, { r: 0.4 }), 0, 0.2, 0.02), 0.06);
        const mz = muzzle(g, 0, 0, 0.62);
        return { g: g, barrel: bg, muzzle: mz };
      }
      function holdGun(K) { aimArm(K.arms[1], -1.05, -0.05); aimArm(K.arms[0], -1.2, -0.75); }
      function dartlingLook(R, P_) {
        const ex = { muzzles: [], spin: [], pulse: [] };
        let K;
        if (R <= 2 || (P_ === 0 && R === 3) || (P_ === 1 && R === 3) || (P_ === 2 && R === 3)) {
          K = monkey({ suit: P_ === 0 && R === 3 ? FUR : FUR, hands: FACE, feet: FUR, belly: true, mouth: 'open' });
          holdGun(K);
          let hel, gun;
          if (P_ === 0 && R === 3) {
            hel = helmet(K, 0xd81b1b, { r: 0.4 });
            badge(hel, 'dot', GOLD, GOLD);
            const vis = grp(K.head, 0, 0.06, 0);
            for (let i = 0; i < 5; i++) P(vis, band(0.6 + (i % 2) * 0.003, 0.045, -Math.PI * 0.4, Math.PI * 0.8), M(i % 2 ? 0x1c1d21 : 0x84cc16, { r: 0.35, ds: true }), 0, -0.08 + i * 0.04, 0);
            gun = gatling(K.root, { body: BLACK, ring: 0x2a2d33, barrel: 0x2a2d33 });
            P(gun.g, sph(0.13, 14, 10), M(0xff1e1e, { basic: true }), 0, 0, 0.68);
            ex.pulse.push(glowBall(gun.g, 0xff2a2a, 0.22, 0, 0, 0.7, 0.4));
          } else if (P_ === 1 && R === 3) {
            hel = helmet(K, 0x6d28d9, { size: 0.64, cover: 0.62, r: 0.45 });
            badge(hel, 'tri', 0x6d28d9, 0x84cc16);
            // gas mask
            OL(P(K.head, sph(0.2, 16, 12), M(0x6b7280, { r: 0.4, m: 0.3 }), 0, -0.2, 0.5, 0, 0, 0, 1.15, 0.9, 0.8), 0.05);
            [-1, 1].forEach(function(s) { P(K.head, cyl(0.07, 0.07, 0.1, 12), M(0x4ade80, { e: 0x166534, ei: 0.6 }), s * 0.16, -0.27, 0.6, Math.PI / 2 - 0.3, 0, -s * 0.5); });
            const pod = grp(K.root, -0.22, 1.2, -0.32, 0.25, 0, 0.15);
            OL(P(pod, cyl(0.13, 0.13, 0.9, 16), M(0x6d28d9, { r: 0.45 }), 0, 0, 0), 0.04);
            P(pod, cone(0.13, 0.3, 16), M(0x84cc16, { e: 0x3f6212, ei: 0.6, r: 0.4 }), 0, 0.6, 0);
            gun = gatling(K.root, { body: 0x3b2f5c, ring: 0x6d28d9, tips: 0x4ade80 });
          } else if (P_ === 2 && R === 3) {
            hel = helmet(K, 0x1e5fbf, { r: 0.35, m: 0.2 });
            P(hel, tor(0.6, 0.09, Math.PI, 8, 26), M(GOLD, { r: 0.4 }), 0, 0, 0, 0, Math.PI / 2, 0);
            [-1, 1].forEach(function(s) { OL(P(K.head, cyl(0.2, 0.2, 0.14, 18), M(0x1e3a8a, { r: 0.4 }), s * 0.6, 0, 0, 0, 0, Math.PI / 2), 0.05); P(K.head, cyl(0.12, 0.12, 0.15, 16), M(GOLD), s * 0.62, 0, 0, 0, 0, Math.PI / 2); });
            gun = gatling(K.root, { body: 0x8a929c, ring: 0x84cc16, barrel: 0xc0c6cd });
            P(gun.g, cyl(0.24, 0.12, 0.2, 18, true), M(0xc0c6cd, { m: 0.6, r: 0.25, ds: true }), 0, 0, 0.7, Math.PI / 2);
            for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P(gun.g, cone(0.025, 0.14, 5), M(GOLD, { m: 0.5 }), Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.82, Math.PI / 2); }
          } else {
            hel = helmet(K, 0x4a7a17, { r: 0.6 });
            if (P_ === 2 && R === 2) [[0.5, 0.35, 0.2, GOLD], [-0.4, 0.4, 0.15, GOLD], [0.1, 0.5, -0.35, 0x3f6212], [-0.25, 0.3, -0.45, GOLD], [0.45, 0.2, -0.3, 0x3f6212], [-0.05, 0.55, 0.2, 0x3f6212]].forEach(function(c) { const v = new THREE.Vector3(c[0], c[1], c[2]).normalize().multiplyScalar(0.64); const pm = P(hel, sph(0.16, 10, 8), M(c[3], { r: 0.6 }), v.x, v.y * 0.95, v.z, 0, 0, 0, 1, 1, 1); pm.lookAt(0, 0, 0); pm.scale.set(1.3, 0.8, 0.28); });
            const bk = R === 0 ? ['half', 0xf8fafc, GOLD] : P_ === 0 ? (R === 1 ? ['dot', GOLD, GOLD] : ['wings', GOLD, GOLD]) : P_ === 1 ? ['tri', 0x5b9a1e, R === 2 ? 0x4ade80 : GOLD] : ['diag', 0xf8fafc, GOLD];
            badge(hel, bk[0], bk[1], bk[2]);
            const go = { body: GUNMETAL, ring: 0x6aa121 };
            if (P_ === 0 && R === 1) go.scope = GOLD;
            if (P_ === 0 && R === 2) { go.barrel = 0x1c1d21; go.tips = 0xff2a2a; zigzag(K.hands[0], 0xff4d4d, 0, 0, 0.12, 0.35, 4, 0.4); }
            if (P_ === 1) { go.ring = 0x7c3aed; if (R === 2) { go.tips = 0x4ade80; go.body = 0x3b2f5c; } }
            gun = gatling(K.root, go);
            if (P_ === 2 && R >= 1) { // tripod swivel stand
              const tm = M(0x2563eb, { r: 0.4, m: 0.3 });
              [0, 2.1, 4.2].forEach(function(a) { P(K.root, cyl(0.03, 0.03, 0.85, 8), tm, 0.3 + Math.cos(a) * 0.18, 0.38, 0.28 + Math.sin(a) * 0.18, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); });
              P(K.root, cyl(0.07, 0.07, 0.12, 10), tm, 0.3, 0.68, 0.28);
            }
          }
          ex.muzzles.push(gun.muzzle); ex.barrel = gun.barrel;
          return finish(K, ex);
        }
        if (P_ === 0) { // Plasma Accelerator / Ray of Doom: full red armour
          const red = 0xd31f1f;
          K = monkey({ suit: red, suitMetal: 0.35, suitRough: 0.35, hands: 0xb81818, feet: 0x8f1212, tail: FUR, cowl: true, eyes: 'none', mouth: 'none', face: 0x8f1212 });
          holdGun(K);
          const hel = helmet(K, red, { size: 0.66, cover: 0.62, r: 0.3, m: 0.3, rim: GOLD });
          const vis = grp(K.head, 0, 0.0, 0);
          P(vis, band(0.62, 0.26, -Math.PI * 0.42, Math.PI * 0.84), M(0x18181b, { r: 0.3, ds: true }), 0, 0, 0);
          for (let i = 0; i < 3; i++) P(vis, band(0.63, 0.035, -Math.PI * 0.32, Math.PI * 0.64), M(GOLD, { basic: true, ds: true }), 0, -0.07 + i * 0.07, 0);
          const gm = M(GOLD, { m: 0.55, r: 0.3 });
          [-1, 1].forEach(function(s) { OL(P(K.root, sph(0.17, 14, 10), R === 5 ? gm : M(red, { m: 0.35 }), s * 0.36, 1.1, 0, 0, 0, 0, 1.0, 0.7, 1.0), 0.05); });
          // big plasma cannon
          const c = grp(K.root, 0.32, 0.8, 0.3, 0, 0, 0, R === 5 ? 1.45 : 1.35);
          OL(P(c, box(0.3, 0.3, 0.95), gm, 0, 0, 0.25), 0.03);
          [0.0, 0.3, 0.55].forEach(function(z) { P(c, box(0.32, 0.32, 0.06), M(RED, { r: 0.4 }), 0, 0, z); });
          P(c, cyl(0.12, 0.15, 0.12, 16), M(0x18181b), 0, 0, 0.78, Math.PI / 2);
          P(c, sph(0.1, 12, 8), M(0xff3355, { basic: true }), 0, 0, 0.84);
          ex.muzzles.push(muzzle(c, 0, 0, 0.9));
          if (R === 5) {
            P(hel, tor(0.66, 0.06, Math.PI, 6, 24), gm, 0, 0.05, 0, 0, Math.PI / 2, 0);
            OL(P(K.root, box(0.6, 0.45, 0.25), gm, 0, 0.9, 0.12), 0.03);
            const back = grp(K.root, -0.42, 1.25, -0.2, -0.12, 0, 0);
            OL(P(back, cyl(0.26, 0.3, 1.5, 18), M(0x2a2d33, { m: 0.55, r: 0.35 }), 0, 0, 0.35, Math.PI / 2), 0.03);
            [-0.1, 0.35, 0.8].forEach(function(z) { P(back, cyl(0.31, 0.31, 0.1, 18), gm, 0, 0, z, Math.PI / 2); });
            P(back, sph(0.2, 14, 10), M(0xff1e1e, { basic: true }), 0, 0, 1.12);
            ex.pulse.push(glowBall(back, 0xff1e1e, 0.38, 0, 0, 1.15, 0.45));
            ex.muzzles.unshift(muzzle(back, 0, 0, 1.2));
            [[-0.7, 0.7, 0.3, 0.6], [0.75, 1.3, -0.2, 2.6], [-0.6, 0.3, -0.5, 4.0]].forEach(function(z) { zigzag(K.root, 0xff4d6d, z[0], z[1], z[2], 0.7, 5, z[3]); });
          }
          return finish(K, ex);
        }
        if (P_ === 1) { // Rocket Storm / M.A.D: purple-green mech
          const mech = R === 5 ? 0x2f2b3a : 0x3f3f46;
          K = monkey({ suit: mech, suitMetal: 0.5, suitRough: 0.35, hands: R === 5 ? 0x4ade80 : mech, handEmis: R === 5 ? 0x166534 : 0, feet: 0x27272a, tail: mech, cowl: true, eyes: 'glow', eyeCol: 0x7cff4f, eyeTilt: 0.35, mouth: 'none', face: 0x27272a });
          holdGun(K);
          const pm = M(0x7c3aed, { r: 0.4, m: 0.2 }), lg = M(0x84cc16, { e: 0x3f6212, ei: 0.7, r: 0.4 });
          for (let i = -2; i <= 2; i++) P(K.head, box(0.05, 0.08, 0.05), M(0xd4d4d8), i * 0.06, -0.27, 0.55);
          OL(P(K.root, box(0.56, 0.4, 0.26), M(R === 5 ? 0x6d28d9 : 0x52525b, { m: 0.45, r: 0.35 }), 0, 0.88, 0.14), 0.03);
          P(K.root, cone(0.1, 0.06, 3), M(0x4ade80, { basic: true }), 0, 0.92, 0.29, Math.PI / 2, 0, Math.PI);
          const n = R === 5 ? 3 : 2;
          [-1, 1].forEach(function(s) {
            for (let i = 0; i < n; i++) {
              const r = grp(K.root, s * (0.32 + i * 0.13), 1.25 + i * 0.05, -0.12 - i * 0.05, -0.35, 0, -s * (0.3 + i * 0.15));
              OL(P(r, cyl(0.08, 0.08, 0.55, 12), pm, 0, 0, 0), 0.05);
              P(r, cone(0.08, 0.2, 12), lg, 0, 0.37, 0);
              P(r, cone(0.12, 0.12, 4), pm, 0, -0.28, 0);
            }
          });
          const gun = gatling(K.root, { body: 0x3b2f5c, ring: 0x7c3aed, tips: 0x4ade80, s: R === 5 ? 1.45 : 1.3 });
          ex.muzzles.push(gun.muzzle); ex.barrel = gun.barrel;
          if (R === 5) {
            K.root.scale.setScalar(1.12);
            [-1, 1].forEach(function(s) { OL(P(K.root, box(0.3, 0.3, 0.34), pm, s * 0.42, 1.08, 0), 0.03); });
            OL(P(K.hands[0], sph(0.17, 14, 10), lg, 0, 0, 0), 0.05);
          }
          for (let i = 0; i < 4; i++) ex.pulse.push(glowBall(K.root, 0x4ade80, 0.16 + i * 0.03, (i - 1.5) * 0.25, 0.1, -0.2, 0.22));
          return finish(K, ex);
        }
        // Bottom: BADS / BEZ turret platforms
        K = { root: grp(null) };
        const blue = M(0x1d4ed8, { r: 0.4, m: 0.25 }), white = M(0xf1f5f9, { r: 0.45 }), gold = M(GOLD, { m: 0.5, r: 0.3 }), gm2 = M(0x8a929c, { m: 0.6, r: 0.3 });
        const H = R === 5 ? 1.55 : 0.9, RAD = R === 5 ? 0.62 : 0.55;
        const nb = R === 5 ? 6 : 5;
        for (let i = 0; i < nb; i++) OL(P(K.root, cyl(RAD, RAD, H / nb, 22), R === 5 ? (i % 3 === 1 ? gold : (i % 3 === 2 ? M(0x1e293b, { m: 0.4 }) : blue)) : (i % 2 ? white : blue), 0, (i + 0.5) * (H / nb), 0), 0.02);
        P(K.root, cyl(RAD * 1.15, RAD * 1.2, 0.12, 22), M(0x334155, { m: 0.4 }), 0, 0.06, 0);
        const mk = monkey({ headOnly: true, suit: FUR, eyes: 'normal', mouth: 'open' });
        mk.head.position.set(0, H + 0.42, 0);
        mk.head.scale.setScalar(R === 5 ? 0.8 : 0.9);
        K.root.add(mk.head);
        K.head = mk.head;
        const hel = grp(mk.head, 0, 0.1, -0.02, -0.12, 0, 0);
        OL(P(hel, hemi(0.62, 0.52), M(R === 5 ? GOLD : 0x2563eb, { r: 0.35, m: 0.3 }), 0, 0, 0, 0, 0, 0, 1, 0.95, 1), 0.04);
        P(hel, tor(0.6, 0.08, Math.PI, 8, 24), R === 5 ? blue : gold, 0, 0, 0, 0, Math.PI / 2, 0);
        [-1, 1].forEach(function(s) { P(mk.head, cyl(0.2, 0.2, 0.14, 18), gold, s * 0.6, 0, 0, 0, 0, Math.PI / 2); });
        const nGuns = R === 5 ? 3 : 1;
        for (let i = 0; i < nGuns; i++) {
          const a = R === 5 ? (i - 1) * 0.9 : 0;
          const tg = grp(K.root, Math.sin(a) * (RAD + 0.05), R === 5 ? 0.75 + (i % 2) * 0.35 : H * 0.55, Math.cos(a) * (RAD + 0.05), 0, a, 0);
          OL(P(tg, box(0.28, 0.26, 0.3), gm2, 0, 0, 0.05), 0.04);
          OL(P(tg, cyl(0.11, 0.13, 0.5, 16), M(0x52525b, { m: 0.6, r: 0.3 }), 0, 0, 0.35, Math.PI / 2), 0.04);
          P(tg, cyl(0.09, 0.09, 0.04, 14), M(0x111111), 0, 0, 0.6, Math.PI / 2);
          ex.muzzles.push(muzzle(tg, 0, 0, 0.65));
        }
        if (R === 5) {
          P(K.root, hemi(0.5, 0.5), M(0x93c5fd, { basic: true, op: 0.25 }), 0, H, 0);
          for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ex.pulse.push(glowBall(K.root, 0xfde047, 0.06 + (i % 3) * 0.02, Math.cos(a) * 0.9, 0.4 + (i % 4) * 0.35, Math.sin(a) * 0.9, 0.85)); }
        }
        return finish(K, ex);
      }

      // ================= PARAGON FORMS (R = 6) =================
      // Eclipse Sovereign: True Sun God (gold, left) fused with Legend of the Night (obsidian, right),
      // Anti-Bloon cannons on both shoulders, sun halo with a sliding eclipse disc.
      function eclipseLook() {
        const ex = { muzzles: [], spin: [], pulse: [] };
        const K = superBase({ suit: 0xfff1cf, suitEmis: 0x8a6a2a, suitEi: 0.35, suitRough: 0.35, face: 0xffe6a8, faceEmis: 0x6b4a10, hands: 0xfff1cf, feet: 0xfff1cf, tail: 0x2f3a55, eyes: 'glow', eyeCol: 0xffffff, capeCol: null, belt: GOLD, emblem: GOLD, emblemIn: 0x111827, emblemEmis: 0x7a5a00, mouth: 'none' });
        aimArm(K.arms[0], -0.25, 1.05); aimArm(K.arms[1], -0.25, -1.05);
        const gm = M(GOLD, { m: 0.65, r: 0.25, e: 0x5a3a00, ei: 0.45 });
        const ob = M(0x1b2033, { m: 0.65, r: 0.28 });
        const cyan = M(0x7dd3fc, { basic: true });
        // obsidian half shells (x > 0 side)
        OL(P(K.head, GEO('eclHH', function() { return new THREE.SphereGeometry(0.585, 28, 20, Math.PI / 2, Math.PI); }), ob, 0, 0, 0), 0.03);
        P(K.head, sph(0.11, 12, 10), cyan, 0.19, 0.07, 0.53, 0, 0, -0.4, 1.1, 0.75, 0.5);
        OL(P(K.head, cone(0.13, 0.5, 4), ob, 0.3, 0.55, -0.02, 0, 0, -0.22), 0.05);
        OL(P(K.root, GEO('eclHB', function() { return new THREE.SphereGeometry(0.345, 22, 16, Math.PI / 2, Math.PI); }), ob, 0, 0.82, 0, 0, 0, 0, 1.0, 1.12, 0.88), 0.03);
        P(K.root, box(0.03, 0.62, 0.62), cyan, 0.0, 0.85, 0.02, 0, 0, 0, 1, 1, 0.9);
        OL(P(K.arms[1], cyl(0.1, 0.095, 0.3, 12), ob, 0, -0.2, 0), 0.05);
        OL(P(K.legs[1], cyl(0.115, 0.11, 0.3, 12), ob, 0, -0.15, 0), 0.05);
        const bl = M(0xd4d9e0, { m: 0.75, r: 0.2 });
        const blade = grp(K.arms[1], 0.08, -0.25, 0.08, 0, 0, 0.3);
        P(blade, tor(0.24, 0.035, Math.PI * 0.8, 6, 16), bl, 0, 0, 0, Math.PI / 2, 0, 0);
        // gold bracers on the sun side
        P(K.arms[0], tor(0.1, 0.035, Math.PI * 2, 6, 16), gm, 0, -0.32, 0, Math.PI / 2, 0, 0);
        P(K.legs[0], tor(0.11, 0.035, Math.PI * 2, 6, 16), gm, 0, -0.28, 0, Math.PI / 2, 0, 0);
        // bat wing (night side) + sun ray wing (day side)
        const wm = M(0x2f3a55, { ds: true, r: 0.5, m: 0.3 });
        const sh = new THREE.Shape();
        sh.moveTo(0, 0); sh.lineTo(1.25, 0.55); sh.lineTo(1.1, -0.1); sh.quadraticCurveTo(0.95, -0.15, 0.85, -0.42); sh.quadraticCurveTo(0.7, -0.25, 0.55, -0.48); sh.quadraticCurveTo(0.42, -0.25, 0.25, -0.5); sh.lineTo(0, -0.2); sh.lineTo(0, 0);
        const wg = GEO('batwing', function() { return new THREE.ShapeGeometry(sh); });
        const w = grp(K.root, 0.2, 1.1, -0.3, 0, 0.35, 0);
        P(w, wg, wm, 0, 0, 0);
        P(w, box(1.3, 0.025, 0.02), cyan, 0.62, 0.27, 0.01, 0, 0, 0.42);
        const sw = grp(K.root, -0.2, 1.1, -0.3, 0, -0.35, 0);
        for (let i = 0; i < 6; i++) { const a = 0.15 + i * 0.22; P(sw, cone(0.07, 0.95 - i * 0.07, 4), M(0xffd84a, { e: 0x8a5a00, ei: 0.6, m: 0.4, r: 0.3 }), -Math.cos(a) * 0.55, Math.sin(a) * 0.55 - 0.15, 0, 0, 0, Math.PI / 2 + a); }
        // Anti-Bloon shoulder cannons
        [-1, 1].forEach(function(s) {
          const c = grp(K.root, s * 0.42, 1.28, 0.05, 0, 0, 0, 0.75);
          OL(P(c, cyl(0.16, 0.16, 0.55, 16), M(s > 0 ? 0xb21d1d : 0xf5b70f, { m: 0.45, r: 0.35 }), 0, 0, 0.12, Math.PI / 2), 0.04);
          [0.0, 0.22].forEach(function(z) { P(c, cyl(0.18, 0.18, 0.06, 16), gm, 0, 0, z, Math.PI / 2); });
          P(c, cyl(0.1, 0.12, 0.05, 14), M(0xff3b1f, { basic: true }), 0, 0, 0.41, Math.PI / 2);
          ex.muzzles.push(muzzle(c, 0, 0, 0.46));
        });
        // Sun halo + eclipse disc
        const halo = grp(K.head, 0, 0.12, -0.55);
        OL(P(halo, tor(0.7, 0.055, Math.PI * 2, 8, 40), gm, 0, 0, 0), 0.04);
        for (let r = 0; r < 16; r++) { const a = (r / 16) * Math.PI * 2; P(halo, cone(0.09, r % 2 ? 0.32 : 0.5, 4), M(0xffd84a, { e: 0x8a5a00, ei: 0.7, m: 0.4, r: 0.3 }), Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0, 0, 0, a - Math.PI / 2); }
        P(halo, cyl(0.7, 0.7, 0.02, 36), M(0xfff3c4, { basic: true, op: 0.16, add: true }), 0, 0, -0.02, Math.PI / 2);
        const ecl = grp(halo, 0, 0, 0.03);
        P(ecl, cyl(0.5, 0.5, 0.03, 32), M(0x0b0d17), 0.32, 0.1, 0, Math.PI / 2);
        P(ecl, tor(0.5, 0.03, Math.PI * 2, 6, 32), cyan, 0.32, 0.1, 0.02);
        ex.spin.push({ o: halo, ax: 'z', s: 0.6 }, { o: ecl, ax: 'z', s: -1.1 });
        ex.pulse.push(glowBall(K.root, 0xfff3c4, 1.15, -0.2, 1.2, 0, 0.16), glowBall(K.root, 0x38bdf8, 0.9, 0.25, 1.1, 0, 0.12));
        ex.muzzles.push(muzzle(K.hands[1], 0, -0.1, 0.1), muzzle(K.hands[0], 0, -0.1, 0.1));
        ex.float = true; ex.bob = 0.14;
        const out = finish(K, ex);
        out.userData.rig.lift = 0.35;
        return out;
      }
      // Omega Doomcaster: Ray of Doom body + M.A.D purple-green missile pods + a halo of 6 B.E.Z drones
      function doomLook() {
        const g = dartlingLook(5, 0);
        const ud = g.userData;
        const pm = M(0x6d28d9, { r: 0.4, m: 0.3 }), lg = M(0x84cc16, { e: 0x3f6212, ei: 0.8, r: 0.4 }), gold = M(GOLD, { m: 0.55, r: 0.3 });
        [-1, 1].forEach(function(s) {
          for (let i = 0; i < 3; i++) {
            const r = grp(g, s * (0.36 + i * 0.13), 1.3 + i * 0.05, -0.2 - i * 0.05, -0.35, 0, -s * (0.3 + i * 0.15));
            OL(P(r, cyl(0.08, 0.08, 0.55, 12), pm, 0, 0, 0), 0.05);
            P(r, cone(0.08, 0.2, 12), lg, 0, 0.37, 0);
          }
        });
        const ring = grp(g, 0, 2.45, 0);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const d = grp(ring, Math.cos(a) * 0.95, Math.sin(i * 1.7) * 0.06, Math.sin(a) * 0.95, 0, -a, 0);
          OL(P(d, box(0.22, 0.1, 0.22), M(0x1d4ed8, { m: 0.4, r: 0.35 }), 0, 0, 0), 0.06);
          P(d, cyl(0.12, 0.12, 0.015, 12), M(0xe2e8f0, { basic: true, op: 0.5 }), 0, 0.08, 0);
          P(d, sph(0.04, 6, 6), M(0xfde047, { basic: true }), 0, -0.04, 0.12);
        }
        P(ring, tor(0.95, 0.02, Math.PI * 2, 6, 40), gold, 0, 0, 0, Math.PI / 2, 0, 0);
        ud.spin.push({ o: ring, ax: 'y', s: 1.6 });
        ud.pulse.push(glowBall(g, 0xff1e1e, 0.95, 0, 1.1, 0, 0.12));
        return g;
      }
      const PAR6 = { supermonkey: eclipseLook, super: eclipseLook, dartling: doomLook };
      const BUILDERS = { supermonkey: superLook, super: superLook, dartling: dartlingLook };
      function build(unit, R, P_) {
        const fn = BUILDERS[unit];
        if (!fn) return null;
        const g = (R === 6 && PAR6[unit]) ? PAR6[unit]() : fn(Math.max(0, Math.min(5, R | 0)), Math.max(0, Math.min(2, P_ | 0)));
        g.name = 'b13_real_body';
        return g;
      }
      return { build: build, has: function(u) { return !!BUILDERS[u]; }, has6: function(u) { return !!PAR6[u]; } };
    })();

    // Units that use the real BTD6 look system (others keep the gear system until their batch lands)
    const B13_REAL_UNITS = { supermonkey: true, super: true, dartling: true };
    const B13_REAL_NAMES = {
      supermonkey: [
        ['Laser Blasts', 'Plasma Blasts', 'Sun Avatar', 'Sun Temple', 'True Sun God'],
        ['Super Range', 'Epic Range', 'Robo Monkey', 'Tech Terror', 'The Anti-Bloon'],
        ['Knockback', 'Ultravision', 'Dark Knight', 'Dark Champion', 'Legend of the Night']
      ],
      dartling: [
        ['Focused Firing', 'Laser Shock', 'Laser Cannon', 'Plasma Accelerator', 'Ray of Doom'],
        ['Advanced Targeting', 'Faster Barrel Spin', 'Hydra Rocket Pods', 'Rocket Storm', 'M.A.D'],
        ['Faster Swivel', 'Powerful Darts', 'Buckshot', 'Bloon Area Denial System', 'Bloon Exclusion Zone']
      ]
    };
    B13_REAL_NAMES.super = B13_REAL_NAMES.supermonkey;
    const B13_REAL_DESCS = {
      dartling: [
        ['Tighter spread: darts fly straighter at your cursor.', 'Darts shock bloons with a jolt of electricity.', 'Swaps darts for a piercing red laser that pops Lead.', 'Fires a long plasma beam that cuts through whole bloon lines.', 'A huge continuous Ray of Doom that pierces everything.'],
        ['Locks on harder: darts hit Camo bloons.', 'Barrels spin faster: much higher fire rate.', 'Fires explosive Hydra rockets that pop Lead and Black.', 'Rocket Storm: extra rockets every volley.', 'M.A.D: giant MOAB-shredding missiles.'],
        ['Swivel mount: faster turning and fire rate.', 'Heavier darts: +1 damage, pops Frozen.', 'Buckshot: a short-range spread of 6 heavy pellets with knockback.', 'B.A.D.S: bigger pellet spread that wrecks MOABs.', 'B.E.Z: a fortress of pellets, huge MOAB damage.']
      ]
    };

    function b13RealPathState(unitKey, st) {
      let p = [0, 0, 0];
      if (unitKey === 'supermonkey') {
        const h = st && st.hero;
        if (h) p = [h.volleyTier || 0, h.weaponTier || h.elementalTier || 0, h.explosiveTier || 0];
      } else if (st && st.squad && st.squad[unitKey]) {
        const sq = st.squad[unitKey];
        if (!Array.isArray(sq.paths)) sq.paths = [Math.max(0, Math.min(5, (sq.level || 1) - 1)), 0, 0];
        p = sq.paths;
      }
      let P = 0;
      for (let i = 1; i < 3; i++) if (p[i] > p[P]) P = i;
      return { paths: p, R: Math.min(5, p[P]), P: P };
    }

    const b13RealBodies = new Set();
    function b13BaseFrame(mesh) {
      if (mesh.userData._b13Base) return mesh.userData._b13Base;
      const saved = { p: mesh.position.clone(), r: mesh.rotation.clone(), s: mesh.scale.clone() };
      mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
      mesh.updateMatrixWorld(true);
      const bb = new THREE.Box3();
      mesh.children.forEach(function(c) { if (String(c.name).indexOf('b13_') !== 0) bb.expandByObject(c); });
      mesh.position.copy(saved.p); mesh.rotation.copy(saved.r); mesh.scale.copy(saved.s);
      mesh.updateMatrixWorld(true);
      const H = bb.isEmpty() ? 2.0 : Math.max(0.8, Math.min(4.0, bb.max.y - bb.min.y));
      mesh.userData._b13Base = { minY: bb.isEmpty() ? 0 : bb.min.y, H: H };
      return mesh.userData._b13Base;
    }
    function b13ApplyRealLook(mesh, unitKey, R, P, opt) {
      if (!mesh) return;
      const sig = 'real_' + unitKey + '_R' + R + '_P' + P;
      if (mesh.userData._b13EvoSig === sig) return;
      const base = b13BaseFrame(mesh);
      mesh.userData._b13EvoSig = sig;
      ['b13_real_body', 'b13_tier_crest', 'b13_safe_gear'].forEach(function(n) { const o = mesh.getObjectByName(n); if (o && o.parent) o.parent.remove(o); });
      const body = B13R.build(unitKey, R, P);
      if (!body) return;
      const s = base.H / 2.0;
      body.userData.inner = body.scale.x;
      body.userData.worldH = opt && opt.worldH ? opt.worldH : 0;
      body.scale.multiplyScalar(s);
      body.position.y = body.userData.worldH ? 0 : base.minY;
      body.userData.baseY = body.position.y;
      body.userData.s = s;
      body.userData.shot = 0;
      mesh.add(body);
      mesh.userData.b13Real = body;
      if (body.userData.barrelGroup) mesh.userData.barrelGroup = body.userData.barrelGroup;
      mesh.children.forEach(function(c) { if (c !== body) c.visible = false; });
      b13RealBodies.add(body);
    }
    const b13RealTmp = new THREE.Vector3();
    function animateB13Real(dt) {
      b13RealBodies.forEach(function(b) {
        const par = b.parent;
        if (!par) { b13RealBodies.delete(b); return; }
        const ud = b.userData;
        for (let i = 0; i < par.children.length; i++) { const c = par.children[i]; if (c !== b && c.visible && c.name !== 'b13_paragon_aura') c.visible = false; }
        ud.clock = (ud.clock || 0) + dt;
        if (ud.worldH) { const ps = Math.abs(par.scale.y) || 1; ud.s = ud.worldH / (2.0 * ps); b.scale.setScalar(ud.inner * ud.s); }
        const px = par.position.x, pz = par.position.z;
        const sp = ud.lx === undefined ? 0 : Math.hypot(px - ud.lx, pz - ud.lz) / Math.max(dt, 1e-3);
        ud.lx = px; ud.lz = pz;
        ud.move = (ud.move || 0) + (Math.min(1, sp / 4) - (ud.move || 0)) * Math.min(1, dt * 8);
        ud.phase = (ud.phase || 0) + dt * (4 + sp * 1.2);
        const rig = ud.rig;
        if (rig) {
          if (rig.legs && rig.legs.length === 2 && !rig.float) {
            const a = Math.sin(ud.phase) * 0.7 * ud.move;
            rig.legs[0].rotation.x = a; rig.legs[1].rotation.x = -a;
          }
          const lift = (rig.lift || 0) + (rig.float ? Math.sin(ud.clock * 2.2) * rig.bob : Math.abs(Math.sin(ud.phase)) * 0.05 * ud.move);
          b.position.y = ud.baseY + lift * (ud.s || 1);
        }
        for (let i = 0; i < ud.spin.length; i++) { const sp2 = ud.spin[i]; sp2.o.rotation[sp2.ax] += sp2.s * dt; }
        for (let i = 0; i < ud.pulse.length; i++) ud.pulse[i].scale.setScalar(1 + Math.sin(ud.clock * 3.2 + i) * 0.07);
        if (window.__IN_DEV_SHOWCASE && ud.barrelGroup) ud.barrelGroup.rotation.z += dt * 10;
      });
    }
    // World position of the unit's next muzzle (alternates between muzzles, e.g. Robo Monkey's twin arm cannons)
    function b13RealMuzzle(mesh, vx, vz) {
      const b = mesh && mesh.userData && mesh.userData.b13Real;
      if (!b || !b.parent || !b.userData.muzzles || !b.userData.muzzles.length) return null;
      const list = b.userData.muzzles;
      const m = list[(b.userData.shot++) % list.length];
      mesh.updateMatrixWorld(true);
      m.getWorldPosition(b13RealTmp);
      // Only trust the model muzzle when the unit faces roughly along the shot
      const fx = Math.sin(mesh.rotation.y), fz = Math.cos(mesh.rotation.y), sp = Math.hypot(vx, vz) || 1;
      if ((fx * vx + fz * vz) / sp < 0.5) return null;
      return { x: b13RealTmp.x, z: b13RealTmp.z };
    }

    // In-game: swap the 9 original simple companion meshes for the full 3D monkey rigs
    let b13SquadUpgradeDone = false;
    function b13UpgradeSquadMeshes() {
      if (b13SquadUpgradeDone) return;
      const PAF = G.ProceduralAssetForge, sm = G.squadMeshes;
      if (!PAF || !sm || typeof PAF.createCompanionMesh !== 'function') return;
      if (String(PAF.createCompanionMesh).indexOf('createFullMonkeyMesh') === -1) return; // rig polyfill not installed yet
      Object.keys(sm).forEach(function(k) {
        const old = sm[k];
        if (!old || (old.userData && old.userData.isFull3DMonkeyRig)) return;
        let nm = null;
        try { nm = PAF.createCompanionMesh(k); } catch (err) { nm = null; }
        if (!nm) return;
        nm.userData.isFull3DMonkeyRig = true;
        nm.position.copy(old.position);
        nm.rotation.copy(old.rotation);
        nm.scale.copy(old.scale);
        nm.visible = old.visible;
        const parent = old.parent || G.scene;
        parent.remove(old);
        parent.add(nm);
        sm[k] = nm;
      });
      b13SquadUpgradeDone = true;
    }

    function updateAllHeroAndCompanionEvolutions() {
      const st = G.gameState;
      const h = st && st.hero;
      if (!h) return;
      b13UpgradeSquadMeshes();

      const vTier = h.volleyTier || 0;
      const eTier = h.weaponTier || h.elementalTier || 0;
      const xTier = h.explosiveTier || 0;
      const maxHeroTier = 1 + Math.max(vTier, eTier, xTier);
      const dominantPath = vTier >= eTier && vTier >= xTier ? 0 : (eTier >= xTier ? 1 : 2);

      const pathTiers = [vTier, eTier, xTier];
      let secPath = -1, secTier = 0;
      for (let p = 0; p < 3; p++) if (p !== dominantPath && pathTiers[p] > secTier) { secTier = pathTiers[p]; secPath = p; }
      if (B13_REAL_UNITS[h.id]) { const rs = b13RealPathState(h.id, st); b13ApplyRealLook(G.heroMesh, h.id, h.b13Paragon && B13R.has6(h.id) ? 6 : rs.R, rs.P); }
      else applyCharacterTierEvolution(G.heroMesh, h.id || 'quincy', maxHeroTier, dominantPath, secTier >= 2 ? { path: secPath, tier: Math.min(5, 1 + secTier) } : null);
      b13ParagonForm(G.heroMesh, 'hero', !!h.b13Paragon);

      if (G.squadMeshes && st.squad) {
        Object.keys(G.squadMeshes).forEach(function(k) {
          const m = G.squadMeshes[k];
          const lvl = st.squad[k] ? st.squad[k].level : 0;
          if (m && lvl > 0) {
            if (B13_REAL_UNITS[k]) { const rs = b13RealPathState(k, st); b13ApplyRealLook(m, k, st.squad[k] && st.squad[k].paragon && B13R.has6(k) ? 6 : rs.R, rs.P, { worldH: 4.5 * (window.B13_UNIT_SCALE || 1) }); }
            else applyCharacterTierEvolution(m, k, lvl, 0);
            b13ParagonForm(m, k, !!(st.squad[k] && st.squad[k].paragon));
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
          const eTier = h.weaponTier || h.elementalTier || 0;
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
            // Super Monkey path-specific projectiles: Sun (3-way T4 / 5-way T5), Robo twin parallel blasters, Dark Knight glaives
            if (h.id === 'supermonkey' || h.id === 'super') {
              const smPath = vTier >= eTier && vTier >= xTier ? 0 : (eTier >= xTier ? 1 : 2);
              const SM_PROJ = [
                [0x93c5fd, 0xff2a2a, 0xa855f7, 0xfacc15, 0xfff7d6],
                [0x93c5fd, 0x38bdf8, 0x22d3ee, 0x22c55e, 0x4ade80],
                [0x93c5fd, 0x7e22ce, 0x6b21a8, 0x581c87, 0xa855f7]
              ];
              opts.colorHex = SM_PROJ[smPath][highestTier - 1];
              if (opts.vx !== undefined && opts.vz !== undefined && highestTier >= 4) {
                const baseSpd = Math.hypot(opts.vx, opts.vz) || 28;
                const baseAng = Math.atan2(opts.vx, opts.vz);
                const spawnChild = function(da, lateral) {
                  const cloneOpts = Object.assign({}, opts, {
                    vx: Math.sin(baseAng + da) * baseSpd,
                    vz: Math.cos(baseAng + da) * baseSpd,
                    _isChildBeam: true
                  });
                  if (lateral) {
                    cloneOpts.x = (opts.x || 0) + Math.cos(baseAng) * lateral;
                    cloneOpts.z = (opts.z || 0) - Math.sin(baseAng) * lateral;
                  }
                  origSpawnProj(cloneOpts);
                };
                if (smPath === 0) {
                  (highestTier >= 5 ? [-0.24, -0.12, 0.12, 0.24] : [-0.15, 0.15]).forEach(function(da) { spawnChild(da, 0); });
                } else if (smPath === 1) {
                  spawnChild(0, 0.38);
                  if (highestTier >= 5) spawnChild(0, -0.38);
                } else {
                  (highestTier >= 5 ? [-0.3, -0.15, 0.15, 0.3] : [-0.2, 0.2]).forEach(function(da) { spawnChild(da, 0); });
                }
              }
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
          } else if (k === 'GOLDEN') {
            const sheenBand = 1.0 - smoothstep(0.0, 0.16, Math.abs((bpX * 0.7 + bpY * 0.7) - 0.18));
            const goldRim = smoothstep(-0.20, -0.08, bodyDist);
            br = mix(mix(br, 1.00, sheenBand * 0.75), 0.72, goldRim * 0.6);
            bg = mix(mix(bg, 0.96, sheenBand * 0.75), 0.45, goldRim * 0.6);
            bb = mix(mix(bb, 0.62, sheenBand * 0.75), 0.05, goldRim * 0.6);
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

    // North Grid (Z = -26 to -42): every Hero & Companion, columns T1 (front) -> T5 (back)
    const B13_DEV_HEROES = ['quincy', 'gwendolin', 'obyn', 'sauda', 'benjamin', 'supermonkey', 'silas', 'rosalia', 'corvus', 'geraldo'];
    const B13_DEV_COMPS = ['dart', 'boomer', 'tack', 'sniper', 'ninja', 'wizard', 'mortar', 'ice', 'super', 'dartling', 'mermonkey', 'beasthandler', 'desperado', 'alchemist', 'druid'];
    const B13_PATH_NAMES = {
      quincy: ['Master Bowman', 'Titan Piercer', 'Supernova Quiver'], gwendolin: ['Solar Inferno', 'Magma Core', 'World Burner'],
      obyn: ['Sovereign of Nature', "Gaia's Judgment", 'World Tree'], sauda: ['Thousand Cuts', 'Crimson Ronin', 'Blade Tempest'],
      benjamin: ['Root Admin Matrix', 'System Wipe', 'Infinite Mint'], supermonkey: ['True Sun God', 'Tech Terror', 'Dark Champion'],
      silas: ['Absolute Zero', "Winter's Mercy", 'Eternal Permafrost'], rosalia: ['Skyforge Valkyrie', 'Kinetic Payload', 'Supersonic Ace'],
      corvus: ['Ancestral Might', 'Omnipresent Haunt', 'Grim Singularity'], geraldo: ['Grand Emporium', 'Mystic Arsenal', 'Wonder Emporium']
    };
    const B13_COMP_T5 = {
      dart: 'Paragon: Crossbow Master', boomer: 'Paragon: Glaive Dominus', tack: 'Paragon: Super Maelstrom', sniper: 'Paragon: Elite Defender', ninja: 'Paragon: Ascended Shadow',
      wizard: 'Paragon: Magus Perfectus', mortar: 'Paragon: Pop and Awe Battery', ice: 'Paragon: Absolute Zero', super: 'Paragon: True Sun God', dartling: 'Paragon: M.A.D.',
      mermonkey: 'Paragon: Poseidon', beasthandler: 'Paragon: Beast Lord', desperado: 'Paragon: Golden Justice', alchemist: 'Paragon: Rubber to Gold', druid: 'Paragon: Avatar of Wrath'
    };
    function b13CompTierTitle(u, t) {
      if (typeof B13_TREE !== 'undefined' && B13_TREE[u]) return B13_TREE[u].paths[0][Math.max(0, Math.min(4, t - 1))];
      if (t >= 5) return B13_COMP_T5[u] || 'Paragon';
      const comp = (G.COMPANION_CATALOG || []).find(function(c) { return c && c.key === u; });
      return (comp && comp.titles && comp.titles[t - 1]) || ('Tier ' + t);
    }
    const b13TierSpriteCache = {};
    function b13TierSprite(t) {
      if (b13TierSpriteCache[t]) return new THREE.Sprite(b13TierSpriteCache[t]);
      const c = document.createElement('canvas');
      c.width = 128; c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = ['#94a3b8', '#38bdf8', '#a855f7', '#f97316', '#facc15'][t - 1];
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.roundRect(4, 4, 120, 56, 16); ctx.fill(); ctx.stroke();
      ctx.font = '900 34px sans-serif'; ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('T' + t, 64, 34);
      b13TierSpriteCache[t] = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true });
      return new THREE.Sprite(b13TierSpriteCache[t]);
    }
    const devUnitColumns = [];
    function b13UnitName(it) {
      if (it.hero) return (G.HERO_CONFIGS && G.HERO_CONFIGS[it.u] && G.HERO_CONFIGS[it.u].name) || it.u;
      const comp = (G.COMPANION_CATALOG || []).find(function(c) { return c && c.key === it.u; });
      const NAMES = { dart: 'Dart Monkey', boomer: 'Boomerang Monkey', tack: 'Tack Shooter', sniper: 'Sniper Monkey', ninja: 'Ninja Monkey', wizard: 'Wizard Monkey', mortar: 'Mortar Monkey', ice: 'Ice Monkey', super: 'Super Monkey', dartling: 'Dartling Gunner', mermonkey: 'Mermonkey', beasthandler: 'Beast Handler', desperado: 'Desperado', alchemist: 'Alchemist', druid: 'Druid' };
      return (comp && (comp.name || comp.shortName)) || NAMES[it.u] || it.u;
    }
    function b13ColumnSub(col) {
      if (B13_REAL_UNITS[col.u]) return 'Path ' + (col.path + 1) + '/3: ' + ['Top', 'Middle', 'Bottom'][col.path] + ' -> ' + B13_REAL_NAMES[col.u][col.path][4];
      return col.hero ? ('Path ' + (col.path + 1) + '/3: ' + B13_PATH_NAMES[col.u][col.path]) : (B13_COMP_T5[col.u] || 'Paragon');
    }
    function b13RefreshColumn(col) {
      col.exhibits.forEach(function(ex) {
        if (B13_REAL_UNITS[col.u]) {
          b13ApplyRealLook(ex.mesh, col.u, ex.tier, col.path);
          const nm = B13_REAL_NAMES[col.u][col.path][ex.tier - 1];
          const code = col.path === 0 ? ex.tier + '-0-0' : (col.path === 1 ? '0-' + ex.tier + '-0' : '0-0-' + ex.tier);
          ex.cat = (col.hero ? 'HERO' : 'COMPANION') + ' • ' + b13ColumnSub(col);
          ex.speed = ['Top', 'Middle', 'Bottom'][col.path] + ' path';
          ex.lore = nm + ' (BTD6 ' + code + ')';
          ex.name = col.name + ' — ' + nm;
          return;
        }
        applyCharacterTierEvolution(ex.mesh, col.u, ex.tier, col.path);
        ex.cat = (col.hero ? 'HERO' : 'COMPANION') + ' • ' + b13ColumnSub(col);
        ex.speed = col.hero ? B13_PATH_NAMES[col.u][col.path] : 'Single Path';
        ex.lore = col.hero ? ('Tier ' + ex.tier + ' of the ' + B13_PATH_NAMES[col.u][col.path] + ' path') : b13CompTierTitle(col.u, ex.tier);
      });
      if (col.header && col.header.parent) col.header.parent.remove(col.header);
      col.header = createLabelSprite(col.name, b13ColumnSub(col));
      col.header.position.set(0, 4.6, 0);
      if (col.exhibits[0]) col.exhibits[0].holder.add(col.header);
    }
    function buildDevEvolutionRow(pedMat, rimMat) {
      const PAF = G.ProceduralAssetForge;
      if (!PAF) return;
      const units = B13_DEV_HEROES.map(function(u) { return { u: u, hero: true }; }).concat(B13_DEV_COMPS.map(function(u) { return { u: u, hero: false }; }));
      const COLW = 4.2, ROWD = 4.2, Z0 = -26;
      let x = 5 - ((units.length - 1) * COLW) / 2;
      units.forEach(function(it) {
        const col = { u: it.u, hero: it.hero, multi: !!(it.hero || B13_REAL_UNITS[it.u]), path: 0, name: b13UnitName(it), exhibits: [], header: null };
        for (let t = 1; t <= 5; t++) {
          let mesh = null;
          try { mesh = it.hero ? PAF.createMonkeyHero(it.u) : PAF.createCompanionMesh(it.u); } catch (err) { mesh = null; }
          if (!mesh || !mesh.children || mesh.children.length === 0) break;
          const box = new THREE.Box3().setFromObject(mesh);
          const hgt = Math.max(0.2, box.max.y - box.min.y);
          mesh.scale.multiplyScalar(2.3 / hgt);
          mesh.position.y = 0.26;
          const holder = new THREE.Group();
          holder.position.set(x, 0, Z0 - (t - 1) * ROWD);
          const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.12, 0.25, 24), pedMat);
          ped.position.y = 0.12;
          const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 8, 28).rotateX(Math.PI / 2), rimMat);
          rim.position.y = 0.25;
          holder.add(ped, rim, mesh);
          const tl = b13TierSprite(t);
          tl.scale.set(1.1, 0.55, 1);
          tl.position.set(0, 3.3, 0);
          holder.add(tl);
          devShowcaseGroup.add(holder);
          const ex = { kind: 'unit', key: it.u + '_T' + t, name: col.name + ' — Tier ' + t, cat: '', scaleTxt: 'T' + t, lore: '', children: '', hp: t, speed: '', imm: '', tier: t, hero: it.hero, col: col, x: holder.position.x, z: holder.position.z, mesh: mesh, holder: holder };
          col.exhibits.push(ex);
          devExhibits.push(ex);
        }
        if (col.exhibits.length) { devUnitColumns.push(col); b13RefreshColumn(col); }
        x += COLW;
      });
    }

    // Real in-game 2D bloons pinned on the south pedestals (same instanced renderer as gameplay)
    const b13DevBloonSet = new Set();
    function b13SyncDevBloons(h, post) {
      if (!G.bloonActive || !h) return;
      b13DevBloonSet.clear();
      for (let i = 0; i < devExhibits.length; i++) {
        const ex = devExhibits[i];
        if (ex.kind !== 'bloon' || !ex.realBloon) continue;
        let idx = ex.bloonIdx;
        const near = Math.hypot(ex.x - h.x, ex.z - h.z) < 34;
        if (!near) {
          if (idx >= 0 && G.bloonTypeKey[idx] === ex.key) G.bloonActive[idx] = 0;
          continue;
        }
        if (idx < 0 || G.bloonTypeKey[idx] !== ex.key) {
          if (post) continue;
          idx = G.spawnBloon(ex.key, ex.x, ex.z, 0, 0, 0, ex.key);
          ex.bloonIdx = idx;
          if (idx < 0) continue;
        }
        G.bloonActive[idx] = 1;
        G.bloonX[idx] = ex.x;
        G.bloonZ[idx] = ex.z;
        G.bloonVX[idx] = 0;
        G.bloonVZ[idx] = 0;
        G.bloonHP[idx] = G.bloonMaxHP[idx];
        G.bloonFreezeTimer[idx] = 0;
        G.bloonBleedTimer[idx] = 0;
        b13DevBloonSet.add(idx);
      }
      for (let i = 0; i < G.bloonActive.length; i++) {
        if (G.bloonActive[i] === 1 && !b13DevBloonSet.has(i)) G.bloonActive[i] = 0;
      }
    }
    function b13ClearDevBloons() {
      for (let i = 0; i < devExhibits.length; i++) {
        const ex = devExhibits[i];
        if (ex.kind === 'bloon' && ex.bloonIdx >= 0 && G.bloonActive && G.bloonTypeKey[ex.bloonIdx] === ex.key) G.bloonActive[ex.bloonIdx] = 0;
        if (ex.kind === 'bloon') ex.bloonIdx = -1;
      }
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
        { key: 'FORTIFIED_ZOMG', name: 'Fortified Z.O.M.G.', cat: 'Armored Gargantuan Zeppelin', hp: 13000, speed: '0.18x', lore: '44 ft 8 in (2x Armor)', scaleTxt: '2.75x', children: '4x Fortified B.F.B.', imm: '2x Fortified Hull', kind: 'moab', gap: 24.0 },
        { key: 'BAD', name: 'B.A.D.', cat: 'Big Airship of Doom', hp: 18000, speed: '0.18x', lore: '113 ft 5 in (2 ZOMGs + 3 DDTs)', scaleTxt: '3.70x', children: '2x Z.O.M.G. + 3x D.D.T.', imm: 'Stun & Slow Immune', kind: 'moab', gap: 28.0 },
        { key: 'FORTIFIED_BAD', name: 'Fortified B.A.D.', cat: 'Supreme Armored Airship of Doom', hp: 36000, speed: '0.18x', lore: '113 ft 5 in (2x Dreadnought)', scaleTxt: '3.70x', children: '2x Fort. ZOMG + 3x Fort. DDT', imm: 'Total Crowd-Control Immunity', kind: 'moab', gap: 29.0 },

        // All 7 Boss Bloons continuing in the exact same horizontal line!
        { key: 'BLOONARIUS', name: 'Bloonarius the Inflator', cat: '1st Boss — Poison Swamp', hp: 25000, speed: '0.14x', lore: 'Swamp Behemoth (3 Skulls)', scaleTxt: '4.30x', children: 'Bloon Tide Swarm on Skull', imm: '3x Skull Shield Gates', kind: 'moab', gap: 30.0 },
        { key: 'LYCH', name: 'Gravelord Lych', cat: '2nd Boss — Ghost Undead', hp: 24000, speed: '0.18x', lore: 'Stitched Necro-Zeppelin', scaleTxt: '4.25x', children: 'Resurrects Chained Moabs', imm: 'Drains Buffs & Heals', kind: 'moab', gap: 30.0 },
        { key: 'VORTEX', name: 'Vortex: Master of Air', cat: '3rd Boss — Electric Tempest', hp: 24500, speed: '0.24x', lore: 'Supersonic Storm Blimp', scaleTxt: '4.25x', children: 'Shockwave Stun on Skull', imm: 'Wind Slipstream Shield', kind: 'moab', gap: 30.0 },
        { key: 'DREADBLOON', name: 'Dreadbloon: Behemoth', cat: '4th Boss — Armored Rock Drill', hp: 28000, speed: '0.12x', lore: 'Titanium Spiral Drill', scaleTxt: '4.35x', children: 'Rock Bloon Escort Swarm', imm: 'Rotating Rock Shield', kind: 'moab', gap: 30.0 },
        { key: 'PHAYZE', name: 'Phayze: Reality Warper', cat: '5th Boss — Twin-Hull Dark Glitch', hp: 26000, speed: '0.20x', lore: 'Split Dimensional Airship', scaleTxt: '4.35x', children: 'Rift Warp Dash on Skull', imm: 'Radar-Jamming Camo Pulse', kind: 'moab', gap: 30.0 },
        { key: 'BLASTAPOPOULOS', name: 'Blastapopoulos: Core Demon', cat: '6th Boss — Volcanic Magma', hp: 29000, speed: '0.15x', lore: 'Molten Magma Dreadnought', scaleTxt: '4.45x', children: 'Meteor Fireballs on Skull', imm: 'Overheats Rapid Towers', kind: 'moab', gap: 30.0 },
        { key: 'TERRACOTTA', name: 'Quetzal: Ancient Guardian', cat: '7th Boss — Ground Temple Serpent', hp: 32000, speed: '0.16x', lore: '5-Segment Aztec Serpent', scaleTxt: '4.40x', children: 'Golden Temple Totems', imm: 'Stone Armor Segments', kind: 'moab', gap: 30.0 }
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

        let displayMesh = null;
        item.bloonIdx = -1;
        item.realBloon = item.kind === 'bloon' && typeof BLOON_TYPES !== 'undefined' && !!BLOON_TYPES[item.key];
        if (item.kind === 'bloon') {
          if (!item.realBloon) {
            displayMesh = create2DCartoonBloonShowcaseSprite(item.col, item.stripe, item.key);
            displayMesh.position.y = 0.0;
          } // else: the real in-game 2D bloon is spawned & pinned on this pedestal every frame
        } else {
          displayMesh = buildAuthentic3DAirshipOrBoss(item.key);
          displayMesh.position.y = 0.65;
        }
        if (displayMesh) holder.add(displayMesh);

        const label = createLabelSprite(item.name, item.scaleTxt + ' Scale • ' + item.hp + ' HP');
        label.position.set(0, item.kind === 'moab' ? 6.8 : 3.6, 0);
        holder.add(label);

        devShowcaseGroup.add(holder);
        item.mesh = displayMesh;
        item.holder = holder;
        devExhibits.push(item);
      });

      buildDevEvolutionRow(pedMat, rimMat);
    }

    // Dev World fast travel: 1-5 sections, Q/E previous/next exhibit
    function b13DevTravel(dest, h) {
      let target = null;
      if (dest === 'prev' || dest === 'next') {
        let ci = 0, best = Infinity;
        devExhibits.forEach(function(ex, i) { const d = Math.hypot(ex.x - h.x, ex.z - h.z); if (d < best) { best = d; ci = i; } });
        const n = devExhibits.length;
        target = devExhibits[(ci + (dest === 'next' ? 1 : n - 1)) % n];
      } else {
        target = devExhibits.find(function(ex) {
          if (dest === 'bloons') return ex.kind === 'bloon';
          if (dest === 'moabs') return ex.key === 'MOAB';
          if (dest === 'bosses') return ex.key === 'BLOONARIUS';
          if (dest === 'heroes') return ex.kind === 'unit' && ex.hero;
          if (dest === 'comps') return ex.kind === 'unit' && !ex.hero;
          return false;
        });
      }
      if (!target) return;
      const back = target.kind === 'moab' ? (B13_BOSS_SET.has(target.key) ? 6 : 4) : 2.5;
      h.x = target.x;
      h.z = target.z + back;
      if (G.heroMesh) G.heroMesh.position.set(h.x, G.heroMesh.position.y, h.z);
      window.triggerHaptic(12);
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
        '  <span class="text-[10px] text-amber-200 font-bold">💡 South Row: real in-game Bloons -> MOABs -> 7 Bosses • North Grid (walk up): every Hero & Companion, T1 front -> T5 back</span>',
        '  <div class="flex items-center gap-1.5">',
        '    <button id="btn-waila-path" type="button" style="display:none" class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-btd text-xs cursor-pointer">🔀 SWITCH PATH</button>',
        '    <button id="btn-waila-spin" type="button" class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-btd text-xs cursor-pointer">🔄 SPIN MODELS</button>',
        '    <button id="btn-exit-dev-world" type="button" class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-btd text-xs cursor-pointer">🚪 EXIT DEV WORLD</button>',
        '  </div>',
        '</div>',
        '<div class="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-700/80">',
        '  <span class="text-[10px] text-sky-300 font-black mr-1">🧭 TRAVEL [1-5] • [Q]/[E] prev/next • hold [SHIFT] to sprint</span>',
        '  <button type="button" data-dev-go="bloons" class="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-white font-btd text-[11px] cursor-pointer">1 🎈 BLOONS</button>',
        '  <button type="button" data-dev-go="moabs" class="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-white font-btd text-[11px] cursor-pointer">2 🛸 MOABS</button>',
        '  <button type="button" data-dev-go="bosses" class="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-white font-btd text-[11px] cursor-pointer">3 💀 BOSSES</button>',
        '  <button type="button" data-dev-go="heroes" class="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-white font-btd text-[11px] cursor-pointer">4 🦸 HEROES</button>',
        '  <button type="button" data-dev-go="comps" class="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-white font-btd text-[11px] cursor-pointer">5 🐒 COMPANIONS</button>',
        '  <button type="button" data-dev-go="prev" class="px-2 py-0.5 rounded-md bg-sky-700 hover:bg-sky-600 text-white font-btd text-[11px] cursor-pointer">◀ Q</button>',
        '  <button type="button" data-dev-go="next" class="px-2 py-0.5 rounded-md bg-sky-700 hover:bg-sky-600 text-white font-btd text-[11px] cursor-pointer">E ▶</button>',
        '</div>'
      ].join('\n');
      document.body.appendChild(waila);

      let spinModels = true;
      waila.querySelector('#btn-waila-spin').addEventListener('click', function() {
        spinModels = !spinModels;
        window.__DEV_SPIN_MODELS = spinModels;
      });
      window.__DEV_SPIN_MODELS = true;
      const pathBtn = waila.querySelector('#btn-waila-path');
      if (pathBtn) pathBtn.addEventListener('click', function() { window.__B13_DEV_PATH_REQ = true; });
      waila.querySelectorAll('[data-dev-go]').forEach(function(b) { b.addEventListener('click', function() { window.__B13_DEV_GO = b.getAttribute('data-dev-go'); }); });
      window.addEventListener('keydown', function(e) {
        if (!window.__IN_DEV_SHOWCASE) return;
        const map = { Digit1: 'bloons', Digit2: 'moabs', Digit3: 'bosses', Digit4: 'heroes', Digit5: 'comps', KeyQ: 'prev', KeyE: 'next' };
        if (map[e.code] && !e.repeat) { window.__B13_DEV_GO = map[e.code]; e.preventDefault(); }
        if (e.key === 'Shift') window.__B13_DEV_SPRINT = true;
      });
      window.addEventListener('keyup', function(e) { if (e.key === 'Shift') window.__B13_DEV_SPRINT = false; });

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
      window.__DEV_CLOCK = 0;
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
      if (G.gameState) G.gameState.spawnAccumulator = 0;
      b13ClearDevBloons();
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
    // E2. REAL-GAMEPLAY AIRSHIP/BOSS GUARANTEE + FORTIFIED W24+ + BOSS ROTATION
    // ------------------------------------------------------------------------
    const B13_BOSS_ROTATION = ['BLOONARIUS', 'LYCH', 'VORTEX', 'DREADBLOON', 'PHAYZE', 'BLASTAPOPOULOS', 'TERRACOTTA'];
    const B13_BOSS_SET = new Set(B13_BOSS_ROTATION);
    // boss HP curve: see b13BossHpK
    const B13_FORTIFIABLE = ['MOAB', 'DDT', 'BFB', 'ZOMG', 'BAD'];
    let b13TypesRegistered = false;
    let b13LastBossWave = 0;

    function registerB13BlimpTypes() {
      const BT = G.BLIMP_TYPES;
      if (!BT || b13TypesRegistered) return;
      b13TypesRegistered = true;
      if (!BT.BLOONARIUS) BT.BLOONARIUS = { key: 'BLOONARIUS', title: 'BLOONARIUS — THE INFLATOR', icon: '🟢', hp: 2400, speed: 1.0, scale: 1.65, isCamo: false, isLead: false, moneyReward: 45, xpReward: 420, childBloons: ['CERAMIC', 'CERAMIC', 'RAINBOW', 'RAINBOW'], childBlimps: ['MOAB'] };
      if (!BT.LYCH) BT.LYCH = { key: 'LYCH', title: 'LYCH — GRAVELORD', icon: '💀', hp: 2600, speed: 1.4, scale: 1.6, isCamo: false, isLead: false, moneyReward: 48, xpReward: 460, childBloons: ['PURPLE', 'PURPLE'], childBlimps: ['MOAB', 'MOAB'] };
      if (!BT.TERRACOTTA) BT.TERRACOTTA = { key: 'TERRACOTTA', title: 'QUETZAL — ANCIENT GUARDIAN', icon: '🐍', hp: 6000, speed: 1.1, scale: 1.9, isCamo: false, isLead: true, moneyReward: 80, xpReward: 900, childBloons: ['CERAMIC', 'LEAD'], childBlimps: ['ZOMG'] };
      B13_FORTIFIABLE.forEach(function(k) {
        const src = BT[k];
        const fk = 'FORTIFIED_' + k;
        if (!src || BT[fk]) return;
        BT[fk] = Object.assign({}, src, {
          key: fk,
          title: 'FORTIFIED ' + src.title,
          hp: Math.round(src.hp * 2),
          moneyReward: Math.round((src.moneyReward || 40) * 1.6),
          xpReward: Math.round((src.xpReward || 120) * 1.6),
          childBloons: (src.childBloons || []).slice(),
          childBlimps: (src.childBlimps || []).map(function(c) { return B13_FORTIFIABLE.indexOf(c) !== -1 ? 'FORTIFIED_' + c : c; })
        });
      });
    }
    registerB13BlimpTypes();

    function b13AuthenticateBlimp(mb) {
      if (!mb) return;
      const key = String(mb.blimpKey || mb.type || 'MOAB').toUpperCase();
      const ud = mb.mesh && mb.mesh.userData;
      if (mb.mesh && ud && ud.isAuthenticB13 && String(ud.moabType || '').toUpperCase() === key) return;
      const fresh = buildAuthentic3DAirshipOrBoss(key);
      if (!fresh.userData || !fresh.userData.isAuthenticB13) {
        fresh.userData = Object.assign({}, fresh.userData || {}, { moabType: key, baseHierarchyScale: fresh.scale.x || 1.25, propellers: [], isAuthenticB13: true });
      }
      if (mb.mesh) {
        const parent = mb.mesh.parent || G.scene;
        fresh.position.copy(mb.mesh.position);
        fresh.rotation.copy(mb.mesh.rotation);
        parent.remove(mb.mesh);
        parent.add(fresh);
      } else {
        fresh.position.set(mb.x || 0, 0, mb.z || 0);
        G.scene.add(fresh);
      }
      mb.mesh = fresh;
      mb._skullShieldMesh = null;
    }

    function b13OnBlimpSpawned(mb) {
      if (!mb || mb._b13Seen) return;
      mb._b13Seen = true;
      const st = G.gameState;
      const key = String(mb.blimpKey || mb.type || 'MOAB').toUpperCase();
      mb.blimpKey = key;
      const w = (st && st.wave) || 1;
      if (!window.__IN_DEV_SHOWCASE && B13_FORTIFIABLE.indexOf(key) !== -1 && w >= 24) {
        const chance = Math.min(0.8, 0.35 + (w - 24) * 0.03);
        if (Math.random() < chance) {
          const fk = 'FORTIFIED_' + key;
          const fc = G.BLIMP_TYPES && G.BLIMP_TYPES[fk];
          mb.blimpKey = fk;
          mb.hp = Math.round((mb.hp || 0) * 2);
          mb.maxHp = Math.round((mb.maxHp || mb.hp) * 2);
          if (fc) mb.title = fc.title;
        }
      }
      if (B13_BOSS_SET.has(mb.blimpKey)) {
        if (!window.__IN_DEV_SHOWCASE) { const k = b13BossHpK(w); mb.hp = Math.round((mb.hp || 1) * k); mb.maxHp = Math.round((mb.maxHp || mb.hp) * k); }
        mb._skullGates = [0.75, 0.5, 0.25];
        mb._skullIdx = 0;
        mb._skullShield = 0;
      }
      b13AuthenticateBlimp(mb);
    }

    // Boss HP multiplier: bosses must outlast a full squad's tier power at their wave
    // Tuned with sim runs of typical squads: ~60 s fights at W15-W35, ~90 s at W45 (shield time included)
    const B13_BOSS_HP_CURVE = [[15, 12], [25, 110], [35, 300], [45, 420]];
    function b13BossHpK(w) {
      const st = G.gameState;
      const diff = (typeof DIFFICULTY_MODES !== 'undefined' && DIFFICULTY_MODES[st.difficultyId]) || { hpMult: 1 };
      const C = B13_BOSS_HP_CURVE;
      let k;
      if (w <= C[0][0]) k = C[0][1];
      else if (w >= C[C.length - 1][0]) k = C[C.length - 1][1] * (1 + (w - C[C.length - 1][0]) * 0.03);
      else { for (let i = 1; i < C.length; i++) if (w <= C[i][0]) { const a = C[i - 1], b = C[i], f = (w - a[0]) / (b[0] - a[0]); k = a[1] + (b[1] - a[1]) * f; break; } }
      // spawnAirshipBoss already applied the freeplay multiplier: divide it out so the curve is the total
      const fp = st.freeplayMode ? (1.0 + Math.max(0, w - 40) * 0.12) : 1.0;
      return Math.max(1, k / fp) * (diff.hpMult || 1);
    }
    function b13UpdateSkullGates(mb, dt) {
      if (mb._skullShield > 0) {
        mb._skullShield -= dt;
        if (mb.hp < mb._skullHpLock) mb.hp = mb._skullHpLock;
      } else if (mb._skullIdx < mb._skullGates.length && mb.hp > 0 && mb.hp <= mb.maxHp * mb._skullGates[mb._skullIdx]) {
        mb._skullHpLock = Math.ceil(mb.maxHp * mb._skullGates[mb._skullIdx]);
        mb.hp = mb._skullHpLock;
        mb._skullIdx++;
        mb._skullShield = 3.0;
        if (typeof G.spawnFloatingText === 'function') G.spawnFloatingText(mb.x, 4.5, mb.z, '💀 SKULL SHIELD ' + mb._skullIdx + '/3', 'crit');
        if (typeof G.triggerScreenShake === 'function') G.triggerScreenShake(0.18, 0.25, 0);
        window.triggerHaptic([40, 30, 40]);
      }
      if (!mb.mesh) return;
      let sh = mb._skullShieldMesh;
      if (!sh || sh.parent !== mb.mesh) {
        sh = new THREE.Mesh(
          new THREE.SphereGeometry(1.9, 22, 14),
          new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.3, wireframe: true, depthWrite: false })
        );
        sh.name = 'b13_skull_shield';
        sh.position.y = 0.9;
        mb.mesh.add(sh);
        mb._skullShieldMesh = sh;
      }
      sh.visible = mb._skullShield > 0;
      if (sh.visible) sh.rotation.y += dt * 2.2;
    }

    // Every legacy blimp build path now returns the authentic B13 hull
    const PAF13 = G.ProceduralAssetForge;
    if (PAF13 && typeof PAF13.createMOABBlimp === 'function' && !PAF13._b13BlimpPatched) {
      PAF13._b13BlimpPatched = true;
      const origCreateBlimp = PAF13.createMOABBlimp;
      PAF13.createMOABBlimp = function(blimpKey) {
        try {
          return buildAuthentic3DAirshipOrBoss(blimpKey || 'MOAB');
        } catch (err) {
          console.warn('[B13] authentic blimp build failed, using legacy mesh:', err);
          return origCreateBlimp.apply(this, arguments);
        }
      };
    }

    // Direct spawn hook (G.spawnAirshipBoss) + G.spawnMOAB alias
    if (typeof G.spawnAirshipBoss === 'function' && !G.spawnAirshipBoss._b13Hooked) {
      const origSpawnAirship = G.spawnAirshipBoss;
      const hookedSpawn = function(blimpKey, customX, customZ) {
        registerB13BlimpTypes();
        const list = G.activeMOABs;
        const before = list ? list.length : 0;
        const r = origSpawnAirship.apply(this, arguments);
        const after = G.activeMOABs;
        if (after) for (let i = before; i < after.length; i++) b13OnBlimpSpawned(after[i]);
        return r;
      };
      hookedSpawn._b13Hooked = true;
      G.spawnAirshipBoss = hookedSpawn;
    }
    G.spawnMOAB = function(blimpKey, customX, customZ) {
      return G.spawnAirshipBoss(blimpKey || 'MOAB', customX === undefined ? null : customX, customZ === undefined ? null : customZ);
    };
    window.__B13_BOSS_SCHEDULER = true;

    // ------------------------------------------------------------------------
    // E3. STRICT SEQUENTIAL UPGRADE CARD GATING (10 HEROES / 14 COMPANIONS)
    // ------------------------------------------------------------------------
    function b13PathAccessor(state, card) {
      const id = String((card && card.id) || '');
      const h = (state && state.hero) || {};
      if (id.indexOf('hero_volley') === 0) return { key: 'hv', get: function() { return h.volleyTier || 0; }, set: function(v) { h.volleyTier = v; } };
      if (id.indexOf('hero_elemental') === 0) return { key: 'he', get: function() { return h.weaponTier || 0; }, set: function(v) { h.weaponTier = v; } };
      if (id.indexOf('hero_explosive') === 0) return { key: 'hx', get: function() { return h.explosiveTier || 0; }, set: function(v) { h.explosiveTier = v; } };
      const m = id.match(/^(?:recruit|squad)_(.+)$/);
      if (m && state && state.squad) {
        const k = m[1];
        return {
          key: 'sq_' + k,
          get: function() { return (state.squad[k] && state.squad[k].level) || 0; },
          set: function(v) { if (state.squad[k]) state.squad[k].level = v; }
        };
      }
      return null;
    }
    function installB13UpgradeGating() {
      const cur = G.getAvailableUpgradeCards;
      if (typeof cur !== 'function' || cur._b13Gated) return;
      const gated = function(state) {
        const raw = cur.apply(this, arguments) || [];
        const seen = new Set();
        const out = [];
        for (let i = 0; i < raw.length; i++) {
          const card = raw[i];
          const acc = b13PathAccessor(state, card);
          if (!acc) { out.push(card); continue; }
          const nextT = acc.get() + 1;
          if (nextT > 5 || seen.has(acc.key)) continue;
          if (card.tier !== undefined && card.tier !== nextT) continue;
          const plv = (state && state.hero && state.hero.level) || 1;
          if (acc.key === 'hv' || acc.key === 'he' || acc.key === 'hx') {
            const hh = state.hero, hp = [hh.volleyTier || 0, hh.weaponTier || hh.elementalTier || 0, hh.explosiveTier || 0];
            if (!b13PathAllowed(hp, acc.key === 'hv' ? 0 : (acc.key === 'he' ? 1 : 2))) continue;
            if (plv < B13_TIER_LVL[nextT]) continue;
          } else if (nextT >= 2 && plv < B13_TIER_LVL[B13_OLD_LVL_T[Math.min(5, nextT)]]) continue;
          seen.add(acc.key);
          card.tier = nextT;
          if (typeof card.apply === 'function' && !card._b13Wrapped) {
            const origApply = card.apply;
            card._b13Wrapped = true;
            card.apply = function(st) {
              const a2 = b13PathAccessor(st, card);
              if (a2 && a2.get() !== nextT - 1) return; // stale card: path already advanced
              const res = origApply.apply(this, arguments);
              if (a2 && a2.get() > nextT) a2.set(nextT);
              return res;
            };
          }
          out.push(card);
        }
        return out;
      };
      gated._b13Gated = true;
      G.getAvailableUpgradeCards = gated;
    }
    installB13UpgradeGating();
    // ------------------------------------------------------------------------
    // E7. UPGRADE TREES: every hero and companion = 3 paths x 5 tiers + 1 Paragon (BTD6 5-2-0 rule)
    //     Companion names = real BTD6 upgrades. Hero trees are built from each hero's real level kit.
    // ------------------------------------------------------------------------
    const B13_PATH_LABEL = ['Top', 'Middle', 'Bottom'];
    const B13_TREE = {
      // ---- Heroes ----
      quincy: { name: 'Quincy', hero: true, paragon: 'Storm Legend Quincy', paths: [
        ['Bouncing Arrows', 'Sharp Bounce', 'Twin Arrows', 'Ricochet Master', 'Triple Volley'],
        ['Explosive Tips', 'Blast Arrows', 'Exploding Every 3rd', 'Cluster Fletching', 'Storm of Arrows'],
        ['Quick Draw', 'Rapid Shot', 'Hawk Eye', 'Longbow Range', 'Rapid Shot Mastery']] },
      gwendolin: { name: 'Gwendolin', hero: true, paragon: 'Queen of Flame', paths: [
        ['Hotter Flames', 'Burning Shots', 'Twin Streams', 'Pyrotechnics Expert', 'Triple Inferno'],
        ['Fire Bottle', 'Cocktail of Fire', 'Lingering Flames', 'MOAB Scorch', 'Molotov Barrage'],
        ['Heat Wave', 'Heat It Up', 'Burst Ring', 'Firestorm', 'Firestorm Supreme']] },
      obyn: { name: 'Obyn Greenfoot', hero: true, paragon: 'Spirit of the Ancients', paths: [
        ['Spirit Wolf', 'Swift Wolves', 'Pack Hunt', 'Dire Wolves', 'Wolf Pack Alpha'],
        ['Thorny Ground', 'Brambles', 'Iron Brambles', 'Wall of Trees', 'Ancient Grove'],
        ["Nature's Wrath", "Nature's Ward Totem", 'Druid Bond', "Nature's Clarity", 'Totem of the Wild']] },
      sauda: { name: 'Sauda', hero: true, paragon: 'Blade Sovereign', paths: [
        ['Sharp Blades', 'Swift Slash', 'Shatter Blades', 'Blade Flurry', 'Thousand Cuts'],
        ['Leap Strike', 'Leaping Sword', 'Heavy Landing', 'Crater Strike', 'Sky Splitter'],
        ['Bleeding Edge', 'Bloon Bleed', 'Sword Charge', 'Double Charge', 'Triple Sweep']] },
      benjamin: { name: 'Benjamin', hero: true, paragon: 'Mainframe Overlord', paths: [
        ['Data Packet', 'Bloon Trojan', 'Worm Spread', 'Rootkit', 'System Crash'],
        ['Overclock', 'Biohack', 'Deep Biohack', 'Neural Boost', 'Total Biohack'],
        ['Skimming', 'Bank Hack', 'Syphon Funding', 'Cyber Security', 'Infinite Funds']] },
      supermonkey: { name: 'Super Monkey', hero: true, paragon: 'Eclipse Sovereign', paths: [
        ['Laser Blasts', 'Plasma Blasts', 'Sun Avatar', 'Sun Temple', 'True Sun God'],
        ['Super Range', 'Epic Range', 'Robo Monkey', 'Tech Terror', 'The Anti-Bloon'],
        ['Knockback', 'Ultravision', 'Dark Knight', 'Dark Champion', 'Legend of the Night']] },
      silas: { name: 'Silas', hero: true, paragon: 'Lord of Everwinter', paths: [
        ['Rime Orb', 'Ricochet Orb', 'Freezing Orb', 'Shatter Orb', 'Absolute Orb'],
        ['Frost Path', 'Ice Wall', 'Frozen Cascade', 'Glacier Walls', 'Endless Winter'],
        ['Chill Aura', 'Frostbite', 'Frozen Burial', 'Deep Freeze Burst', "Winter's Grasp"]] },
      rosalia: { name: 'Rosalia', hero: true, paragon: 'Skyforge Valkyrie', paths: [
        ['Focused Laser', 'Enhanced Shots', 'Plasma Laser', 'MOAB Melter', 'Guardian Laser'],
        ['Grenade Launcher', 'Bouncing Grenades', 'Cluster Grenades', 'Big Clusters', 'Grenade Storm'],
        ['Adrenaline Rush', 'Scatter Missile', 'Flight Boost', 'Kinetic Charge', 'Guardian Automaton']] },
      corvus: { name: 'Corvus', hero: true, paragon: 'Raven King', paths: [
        ['Haunting Spirit', 'Spirit Spear', 'Echo', 'Spirit Storm', 'Ancestral Might'],
        ['Ember', 'Frostbound', 'Malevolence', 'Overload', 'Spellbook Master'],
        ['Nourishment', 'Soul Barrier', 'Soul Harvest', 'Dark Ritual', 'Spirit Walk']] },
      geraldo: { name: 'Geraldo', hero: true, paragon: 'Grand Emporium', paths: [
        ['Stack of Old Nails', 'Shooty Turret', 'Blade Trap', 'Sharpening Stone', 'Turret Workshop'],
        ['Jar of Pickles', 'See Invisibility Potion', "Gerry's Fire", 'Rejuv Potion', 'Master Brewer'],
        ['Creepy Idol', "Worn Hero's Cape", 'Pet Rabbit', 'Genie Bottle', 'Paragon Power Totem']] },
      // ---- Companions (real BTD6 upgrades) ----
      dart: { name: 'Dart Monkey', paragon: 'Apex Plasma Master', paths: [
        ['Sharp Shots', 'Razor Sharp Shots', 'Spike-o-pult', 'Juggernaut', 'Ultra-Juggernaut'],
        ['Quick Shots', 'Very Quick Shots', 'Triple Shot', 'Super Monkey Fan Club', 'Plasma Monkey Fan Club'],
        ['Long Range Darts', 'Enhanced Eyesight', 'Crossbow', 'Sharp Shooter', 'Crossbow Master']] },
      boomer: { name: 'Boomerang Monkey', paragon: 'Glaive Dominus', paths: [
        ['Improved Rangs', 'Glaives', 'Glaive Ricochet', 'M.O.A.R. Glaives', 'Glaive Lord'],
        ['Faster Throwing', 'Faster Rangs', 'Bionic Boomerang', 'Turbo Charge', 'Perma Charge'],
        ['Long Range Rangs', 'Red Hot Rangs', 'Kylie Boomerang', 'MOAB Press', 'MOAB Domination']] },
      tack: { name: 'Tack Shooter', paragon: 'Crucible of Steel and Flame', paths: [
        ['Faster Shooting', 'Even Faster Shooting', 'Hot Shots', 'Ring of Fire', 'Inferno Ring'],
        ['Long Range Tacks', 'Super Range Tacks', 'Blade Shooter', 'Blade Maelstrom', 'Super Maelstrom'],
        ['More Tacks', 'Even More Tacks', 'Tack Sprayer', 'Overdrive', 'The Tack Zone']] },
      sniper: { name: 'Sniper Monkey', paragon: 'Eternal Overwatch', paths: [
        ['Full Metal Jacket', 'Large Calibre', 'Deadly Precision', 'Maim MOAB', 'Cripple MOAB'],
        ['Night Vision Goggles', 'Shrapnel Shot', 'Bouncing Bullet', 'Supply Drop', 'Elite Sniper'],
        ['Fast Firing', 'Even Faster Firing', 'Semi-Automatic', 'Full Auto Rifle', 'Elite Defender']] },
      ninja: { name: 'Ninja Monkey', paragon: 'Ascended Shadow', paths: [
        ['Ninja Discipline', 'Sharp Shurikens', 'Double Shot', 'Bloonjitsu', 'Grandmaster Ninja'],
        ['Distraction', 'Counter-Espionage', 'Shinobi Tactics', 'Bloon Sabotage', 'Grand Saboteur'],
        ['Seeking Shuriken', 'Caltrops', 'Flash Bomb', 'Sticky Bomb', 'Master Bomber']] },
      wizard: { name: 'Wizard Monkey', paragon: 'Magus Perfectus', paths: [
        ['Guided Magic', 'Arcane Blast', 'Arcane Mastery', 'Arcane Spike', 'Archmage'],
        ['Fireball', 'Wall of Fire', "Dragon's Breath", 'Summon Phoenix', 'Wizard Lord Phoenix'],
        ['Intense Magic', 'Monkey Sense', 'Shimmer', 'Necromancer: Unpopped Army', 'Prince of Darkness']] },
      mortar: { name: 'Mortar Monkey', paragon: 'Cataclysm Battery', paths: [
        ['Bigger Blast', 'Bloon Buster', 'Shell Shock', 'The Big One', 'The Biggest One'],
        ['Faster Reload', 'Rapid Reload', 'Heavy Shells', 'Artillery Battery', 'Pop and Awe'],
        ['Increased Accuracy', 'Burny Stuff', 'Signal Flare', 'Shattering Shells', 'Blooncineration']] },
      ice: { name: 'Ice Monkey', paragon: 'Herald of Everfrost', paths: [
        ['Permafrost', 'Cold Snap', 'Ice Shards', 'Embrittlement', 'Super Brittle'],
        ['Enhanced Freeze', 'Deep Freeze', 'Arctic Wind', 'Snowstorm', 'Absolute Zero'],
        ['Larger Radius', 'Re-Freeze', 'Cryo Cannon', 'Icicles', 'Icicle Impale']] },
      super: { name: 'Super Monkey', paragon: 'Eclipse Sovereign', paths: [
        ['Laser Blasts', 'Plasma Blasts', 'Sun Avatar', 'Sun Temple', 'True Sun God'],
        ['Super Range', 'Epic Range', 'Robo Monkey', 'Tech Terror', 'The Anti-Bloon'],
        ['Knockback', 'Ultravision', 'Dark Knight', 'Dark Champion', 'Legend of the Night']] },
      dartling: { name: 'Dartling Gunner', paragon: 'Omega Doomcaster', paths: [
        ['Focused Firing', 'Laser Shock', 'Laser Cannon', 'Plasma Accelerator', 'Ray of Doom'],
        ['Advanced Targeting', 'Faster Barrel Spin', 'Hydra Rocket Pods', 'Rocket Storm', 'M.A.D'],
        ['Faster Swivel', 'Powerful Darts', 'Buckshot', 'Bloon Area Denial System', 'Bloon Exclusion Zone']] },
      mermonkey: { name: 'Mermonkey', paragon: 'Tidelord of the Abyss', paths: [
        ['Trident Efficiency', 'Trident Swiftness', 'Abyss Dweller', 'Abyssal Warrior', 'Lord of the Abyss'],
        ['Sharper Prongs', 'Tidal Chill', 'Riptide Champion', 'Arctic Knight', 'Popseidon'],
        ['Echosense Precision', 'Echosense Network', 'Alluring Melody', 'Symphonic Resonance', 'The Final Harmonic']] },
      beasthandler: { name: 'Beast Handler', paragon: 'Primeval Triumvirate', paths: [
        ['Piranha', 'Barracuda', 'Great White', 'Orca', 'Megalodon'],
        ['Microraptor', 'Adasaurus', 'Velociraptor', 'Tyrannosaurus Rex', 'Giganotosaurus'],
        ['Gyrfalcon', 'Horned Owl', 'Golden Eagle', 'Giant Condor', 'Pouakai']] },
      desperado: { name: 'Desperado', paragon: 'High Noon Eternal', paths: [
        ['Quickdraw', 'Standoff', 'Big Iron', 'Twin Sixes', 'The Blazing Sun'],
        ['Eagle Eye', 'Bullseye', 'Deadeye', 'Bounty Hunter', 'Golden Justice'],
        ['Wanderer', 'Nomad', 'Enforcer', 'Avenger', 'The Desert Phantom']] },
      alchemist: { name: 'Alchemist', paragon: 'Magnum Opus', paths: [
        ['Larger Potions', 'Acidic Mixture Dip', 'Berserker Brew', 'Stronger Stimulant', 'Permanent Brew'],
        ['Stronger Acid', 'Perishing Potions', 'Unstable Concoction', 'Transforming Tonic', 'Total Transformation'],
        ['Faster Throwing', 'Acid Pool', 'Lead to Gold', 'Rubber to Gold', 'Bloon Master Alchemist']] },
      druid: { name: 'Druid', paragon: 'Root of all Nature', paths: [
        ['Hard Thorns', 'Heart of Thunder', 'Druid of the Storm', 'Ball Lightning', 'Superstorm'],
        ['Thorn Swarm', 'Heart of Oak', 'Druid of the Jungle', "Jungle's Bounty", 'Spirit of the Forest'],
        ['Druidic Reach', 'Heart of Vengeance', 'Druid of Wrath', 'Poplust', 'Avatar of Wrath']] }
    };
    const B13_PATH_FLAVOR = ['+popping power', '+attack speed', '+pierce & range'];
    const B13_PARAGON_LVL = 22;
    function b13Code(p) { return p[0] + '-' + p[1] + '-' + p[2]; }
    function b13NextCode(p, idx) { const q = p.slice(); q[idx]++; return b13Code(q); }
    // Paths of any unit ('hero' or companion key). Companions get paths on first read (old saves: level -> top path).
    function b13UnitPaths(unit, st) {
      if (unit === 'hero') { const h = st.hero; return [h.volleyTier || 0, h.weaponTier || h.elementalTier || 0, h.explosiveTier || 0]; }
      const sq = st.squad && st.squad[unit];
      if (!sq) return [0, 0, 0];
      if (!Array.isArray(sq.paths)) sq.paths = [Math.max(0, Math.min(5, Math.floor(sq.level || 1) - 1)), 0, 0];
      return sq.paths;
    }
    function b13IsParagon(unit, st) { return unit === 'hero' ? !!(st.hero && st.hero.b13Paragon) : !!(st.squad && st.squad[unit] && st.squad[unit].paragon); }
    function b13ParagonReady(paths) { const s = paths.slice().sort(function(a, b) { return b - a; }); return s[0] === 5 && s[1] === 2; }
    function b13TreeKey(unit, st) { return unit === 'hero' ? (st.hero && st.hero.id) : unit; }
    // Path status for UI and rolls: 'open' | 'closed' (5-2-0 rule) and the cap for the path
    function b13PathCap(paths, p) {
      let others = 0, otherOver2 = false;
      for (let i = 0; i < 3; i++) { if (i === p) continue; if (paths[i] > 0) others++; if (paths[i] > 2) otherOver2 = true; }
      if (paths[p] === 0 && others >= 2) return 0;
      return otherOver2 ? 2 : 5;
    }

    function b13ParagonAura(mesh, on) {
      if (!mesh) return;
      let a = mesh.getObjectByName('b13_paragon_aura');
      if (!on) { if (a) a.visible = false; return; }
      if (!a) {
        a = new THREE.Group();
        a.name = 'b13_paragon_aura';
        const gold = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 8, 40), gold);
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; ring.name = 'b13_paragon_ring';
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.03, 6, 40), gold);
        ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.12;
        a.add(ring, ring2);
        a.userData = { spin: [{ o: ring2, ax: 'z', s: 1.4 }], orbit: [], clock: 0 };
        for (let i = 0; i < 3; i++) {
          const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
          a.add(orb);
          a.userData.orbit.push({ o: orb, r: 1.15, y: 1.4, s: 1.6, ph: (i / 3) * Math.PI * 2, bob: 0.15, face: false });
        }
        mesh.add(a);
        b13AnimatedCrests.add(a);
      }
      a.visible = true;
    }
    // ---- UI helpers for the Current Run Build window ----
    function b13Esc(t) { return String(t).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    window.__b13HeroPow = function() { b13PowCache.delete('hero'); return b13Pow('hero'); };
    window.__b13HeroPathLine = function() {
      const st = G.gameState, h = st && st.hero, tree = h && B13_TREE[h.id];
      if (!tree) return '';
      const p = b13UnitPaths('hero', st);
      return B13_PATH_LABEL.map(function(l, i) { return l + ': ' + (p[i] ? tree.paths[i][p[i] - 1] + ' (T' + p[i] + ')' : 'T0'); }).join(' • ') + ' • ' + b13Code(p) + (h.b13Paragon ? ' • ★ ' + tree.paragon : '');
    };
    window.__b13UnitSummary = function(k) {
      const st = G.gameState, tree = B13_TREE[k];
      if (!tree || !st || !st.squad || !st.squad[k]) return { code: '', name: '' };
      const p = b13UnitPaths(k, st);
      if (st.squad[k].paragon) return { code: 'PARAGON', name: tree.paragon };
      let best = 0; for (let i = 1; i < 3; i++) if (p[i] > p[best]) best = i;
      return { code: b13Code(p), name: p[best] ? tree.paths[best][p[best] - 1] : 'Base ' + tree.name };
    };
    window.__b13CompendiumHTML = function() {
      const st = G.gameState, h = st && st.hero;
      if (!st || !h) return '';
      const plv = h.level || 1;
      const squad = (st.recruitedOrder || []).filter(function(k) { return st.squad[k] && st.squad[k].level > 0; });
      const comps = (G.COMPANION_CATALOG || []).map(function(c) { return c.key; }).filter(function(k) { return B13_TREE[k]; });
      const heroes = ['quincy', 'gwendolin', 'obyn', 'sauda', 'benjamin', 'supermonkey', 'silas', 'rosalia', 'corvus', 'geraldo'];
      const order = [{ u: 'hero', key: h.id, active: true, hero: true }]
        .concat(squad.map(function(k) { return { u: k, key: k, active: true }; }))
        .concat(comps.filter(function(k) { return squad.indexOf(k) === -1; }).map(function(k) { return { u: k, key: k, active: false }; }))
        .concat(heroes.filter(function(k) { return k !== h.id && B13_TREE[k]; }).map(function(k) { return { u: k, key: k, active: false, hero: true }; }));
      const catalog = {}; (G.COMPANION_CATALOG || []).forEach(function(c) { catalog[c.key] = c; });
      return '<div class="text-[10px] text-stone-300 font-bold px-1">BTD6 rule: only 2 of the 3 paths can be upgraded, and only 1 of those 2 can go past Tier 2. A Paragon (T6) unlocks at LVL ' + B13_PARAGON_LVL + ' once a unit reaches 5-2-0. Tiers unlock at LVL ' + B13_TIER_LVL.slice(1).join(' / ') + '.</div>' + order.map(function(it) {
        const tree = B13_TREE[it.key];
        if (!tree) return '';
        const paths = it.active ? b13UnitPaths(it.u, st) : [0, 0, 0];
        const isPar = it.active && b13IsParagon(it.u, st);
        const comp = catalog[it.key];
        const status = it.u === 'hero' ? 'YOUR HERO • ' + (isPar ? 'PARAGON' : b13Code(paths)) : (it.active ? 'ACTIVE • ' + (isPar ? 'PARAGON' : b13Code(paths)) : (it.hero ? 'HERO TREE' : 'NOT RECRUITED'));
        const rows = [0, 1, 2].map(function(p) {
          const cap = it.active ? b13PathCap(paths, p) : 5;
          const closed = it.active && cap === 0;
          const chips = [1, 2, 3, 4, 5].map(function(t) {
            const owned = it.active && paths[p] >= t;
            const locked = it.active && !owned && t > cap;
            const next = it.active && !owned && !locked && t === paths[p] + 1 && !isPar;
            const lvlOk = plv >= B13_TIER_LVL[t];
            const cls = owned ? 'bg-cyan-950/80 border-yellow-400 text-white' : (next ? 'bg-emerald-950/70 border-emerald-400 border-dashed text-emerald-100' : (locked ? 'bg-black/60 border-white/5 text-stone-600' : 'bg-black/40 border-white/10 text-stone-400'));
            const tag = owned ? ' ✓' : (locked ? ' 🔒' : (next ? (lvlOk ? ' • NEXT' : ' • LV ' + B13_TIER_LVL[t]) : ''));
            return '<div class="p-1.5 rounded-lg border ' + cls + ' flex flex-col min-w-0"><span class="font-btd text-[9px] ' + (owned ? 'text-yellow-300' : '') + '">T' + t + tag + '</span><span class="font-bold text-[9.5px] leading-tight mt-0.5">' + b13Esc(tree.paths[p][t - 1]) + '</span></div>';
          }).join('');
          return '<div class="flex items-stretch gap-1.5"><div class="w-14 shrink-0 flex flex-col justify-center font-btd text-[9px] ' + (closed ? 'text-stone-600' : 'text-amber-200') + '">' + B13_PATH_LABEL[p].toUpperCase() + (closed ? '<span class="text-[8px]">🔒 CLOSED</span>' : (it.active && cap === 2 && paths[p] < 5 ? '<span class="text-[8px] text-stone-400">MAX T2</span>' : '')) + '</div><div class="grid grid-cols-5 gap-1 flex-1">' + chips + '</div></div>';
        }).join('');
        const parReady = it.active && !isPar && b13ParagonReady(paths);
        const parCls = isPar ? 'bg-amber-900/70 border-amber-300 text-amber-100' : (parReady ? 'bg-amber-950/60 border-amber-400 border-dashed text-amber-200' : 'bg-black/40 border-white/10 text-stone-400');
        const parTag = isPar ? ' ✓' : (parReady ? (plv >= B13_PARAGON_LVL ? ' • READY' : ' • LV ' + B13_PARAGON_LVL) : ' • needs 5-2-0');
        const icon = it.hero ? '👑' : (comp && comp.icon ? comp.icon : '🐒');
        return '<div class="p-2.5 rounded-2xl bg-stone-900/95 border-2 ' + (it.active ? 'border-yellow-400' : 'border-stone-700') + ' flex flex-col gap-1.5">' +
          '<div class="flex items-center justify-between"><span class="font-btd text-sm text-yellow-300">' + icon + ' ' + b13Esc(tree.name).toUpperCase() + (it.hero ? ' <span class="ml-1 px-1.5 rounded bg-purple-700 text-[9px] text-white align-middle">HERO</span>' : '') + '</span>' +
          '<span class="px-2 py-0.5 rounded-full ' + (it.active ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-400') + ' font-btd-sm text-[10px]">' + status + '</span></div>' + rows +
          '<div class="p-1.5 rounded-lg border ' + parCls + ' font-btd text-[10px]">⭐ PARAGON (T6): ' + b13Esc(tree.paragon) + parTag + '</div></div>';
      }).join('');
    };

    // ------------------------------------------------------------------------
    // E6. COMBAT BALANCE: every upgrade tier multiplies popping power, tiers unlock with player level,
    //     projectile speed depends on what it is (lasers fast, bombs slow).
    // ------------------------------------------------------------------------
    const B13_TIER_LVL = [0, 1, 4, 8, 13, 18];      // player level needed for tier 1..5
    const B13_TPOW = [1, 1.8, 3.2, 6, 12, 24, 40];      // damage multiplier at real tier 0..5
    const B13_OLD_LVL_T = [0, 0, 2, 3, 4, 5];       // legacy companion level 0..5 -> real tier (4 upgrade cards)
    const B13_SHOT_SPEED = { sunorb: 30, gplasma: 46, rplasma: 50, eclipse: 34, paraorb: 38, octa: 36, dart: 40, arrow: 48, bolt: 56, laser: 62, plasma: 50, sunbeam: 62, darkblade: 44, glaive: 34, shuriken: 38, tack: 32, flame: 21, bomb: 24, bullet: 62, iceshard: 42, iceorb: 30, rocket: 34, potion: 22, thorn: 32, wave: 26, spirit: 26, databit: 52, orb: 34, saw: 32 };
    const B13_SHOT_RANGE = { sunorb: 1.25, gplasma: 1.2, rplasma: 1.2, eclipse: 1.25, paraorb: 1.2, laser: 1.25, sunbeam: 1.25, bullet: 1.3, bolt: 1.2, plasma: 1.15, flame: 1.0, bomb: 1.0, rocket: 1.15 };
    function b13UnitTier(owner, st) {
      if (owner !== 'hero' && !(st.squad && st.squad[owner] && st.squad[owner].level > 0)) return { T: 0, sec: 0 };
      if (b13IsParagon(owner, st)) return { T: 6, sec: 0 };
      const p = b13UnitPaths(owner, st).slice().sort(function(a, b) { return b - a; });
      return { T: Math.min(5, p[0]), sec: p[1] };
    }
    const b13PowCache = new Map();
    function b13Pow(owner) {
      if (!owner) return 1;
      if (b13PowCache.has(owner)) return b13PowCache.get(owner);
      const st = G.gameState;
      if (!st || !st.hero) return 1;
      const t = b13UnitTier(owner, st), lvl = st.hero.level || 1;
      const p = B13_TPOW[t.T] * (1 + 0.15 * t.sec) * (1 + 0.04 * (lvl - 1));
      b13PowCache.set(owner, p);
      return p;
    }
    function b13PierceBonus(owner) {
      const st = G.gameState;
      if (!owner || !st || !st.hero) return 0;
      if (owner === 'hero' && st.hero.id === 'supermonkey') return 0; // set by its path stats
      return b13UnitTier(owner, st).T;
    }
    // Direct damage (no projectile) is scaled at the hit by the active owner context.
    // Projectiles, slashes and ground hazards are scaled once when spawned.
    (function installB13DamageWrappers() {
      if (typeof damageBloon === 'function' && !damageBloon._b13) {
        const _db = damageBloon;
        damageBloon = function(idx, dmg) { const c = window.__B13_CTX; if (c) arguments[1] = dmg * b13Pow(c); return _db.apply(this, arguments); };
        damageBloon._b13 = true;
      }
      if (typeof damageMOAB === 'function' && !damageMOAB._b13) {
        const _dm = damageMOAB;
        damageMOAB = function(m, dmg) {
          const c = window.__B13_CTX;
          if (c) dmg = dmg * b13Pow(c);
          const mb = G.activeMOABs && G.activeMOABs[m];
          let gateHit = false, lock = 0;
          if (mb && mb._b13Ent && mb._b13Ent.t < mb._b13Ent.dur) return;
          if (mb && B13_BOSS_SET.has(mb.blimpKey) && !window.__IN_DEV_SHOWCASE) {
            const now = window.__b13Clock || 0, cap = mb.maxHp * 0.07;
            if (mb._b13BudT === undefined) { mb._b13BudT = now; mb._b13Bud = cap; }
            mb._b13Bud = Math.min(cap, mb._b13Bud + Math.max(0, now - mb._b13BudT) * cap);
            mb._b13BudT = now;
            dmg = Math.min(dmg, mb.maxHp * 0.025, mb._b13Bud);
            if (dmg <= 0) return;
            mb._b13Bud -= dmg;
          }
          if (mb && mb._skullGates) {
            if (mb._skullShield > 0) {
              const now = performance.now();
              if (!mb._b13ShieldTxt || now - mb._b13ShieldTxt > 450) { mb._b13ShieldTxt = now; if (typeof spawnFloatingText === 'function') spawnFloatingText(mb.x, 4.2, mb.z, 'SHIELDED!', 'lead'); }
              return;
            }
            if (mb._skullIdx < mb._skullGates.length) {
              lock = Math.ceil(mb.maxHp * mb._skullGates[mb._skullIdx]);
              if (mb.hp - dmg <= lock) { dmg = Math.max(0, mb.hp - lock); gateHit = true; }
            }
          }
          arguments[1] = dmg;
          const res = _dm.apply(this, arguments);
          if (gateHit && mb) { mb.hp = lock; mb._skullHpLock = lock; mb._skullIdx++; mb._skullShield = 3.0; }
          return res;
        };
        damageMOAB._b13 = true;
      }
      if (typeof spawnGroundHazard === 'function' && !spawnGroundHazard._b13) {
        const _gh = spawnGroundHazard;
        spawnGroundHazard = function(x, z, type, damage) { const c = window.__B13_CTX; if (c) arguments[3] = (damage === undefined ? 1 : damage) * b13Pow(c); return _gh.apply(this, arguments); };
        spawnGroundHazard._b13 = true;
      }
      if (typeof spawnCrescentSlash === 'function' && !spawnCrescentSlash._b13) {
        const _cs = spawnCrescentSlash;
        spawnCrescentSlash = function(o) { const c = window.__B13_CTX; if (c && o) { o.damage = (o.damage === undefined ? 1.5 : o.damage) * b13Pow(c); o.pierce = (o.pierce === undefined ? 5 : o.pierce) + b13PierceBonus(c); } return _cs.apply(this, arguments); };
        spawnCrescentSlash._b13 = true;
      }
      if (typeof triggerHeroSkill === 'function' && !triggerHeroSkill._b13) {
        const _ts = triggerHeroSkill;
        triggerHeroSkill = function() { const prev = window.__B13_CTX; window.__B13_CTX = 'hero'; try { return _ts.apply(this, arguments); } finally { window.__B13_CTX = prev || null; } };
        triggerHeroSkill._b13 = true;
      }
      try { if (G.damageBloon && G.damageBloon !== damageBloon) G.damageBloon = damageBloon; } catch (err) { /* read-only bridge prop */ }
      try { if (typeof damageMOAB === 'function' && G.damageMOAB && G.damageMOAB !== damageMOAB) G.damageMOAB = damageMOAB; } catch (err) { /* read-only bridge prop */ }
    })();
    // Super Monkey real path stats: beam count / pierce follow the BTD6 upgrade, plus Tech Terror / Anti-Bloon nova
    function b13SuperMonkeyStats(h, dt) {
      if (!h || h.id !== 'supermonkey') return;
      const t = h.volleyTier || 0, m = h.weaponTier || h.elementalTier || 0, b = h.explosiveTier || 0;
      let count = 1;
      if (t >= 5) count = 5; else if (t >= 3) count = 3;
      if (m >= 3) count = Math.max(count, 2);
      if (b >= 5) count = Math.max(count, 3); else if (b >= 4) count = Math.max(count, 2);
      h.projectiles = count;
      h.pierce = 2 + t * 2 + (m >= 3 ? 2 : 0) + (b >= 3 ? b * 2 : 0);
      if (t >= 1 || m >= 3 || b >= 3) h.canPopLead = true;
      if (b >= 2) h.canSeeCamo = true;
      h.knockback = 1.3 + b * 0.5;
      if (m >= 4) {
        h._b13Nova = (h._b13Nova === undefined ? 2 : h._b13Nova) - dt;
        if (h._b13Nova <= 0 && typeof spatialGrid !== 'undefined' && typeof queryBuffer !== 'undefined') {
          h._b13Nova = m >= 5 ? 3.0 : 4.5;
          const R = m >= 5 ? 14 : 9, base = m >= 5 ? 6 : 3;
          const prev = window.__B13_CTX; window.__B13_CTX = 'hero';
          try {
            spatialGrid.queryRadius(h.x, h.z, R, queryBuffer);
            for (let q = 0; q < queryBuffer.length; q++) {
              const bi = queryBuffer[q];
              if (G.bloonActive[bi] !== 1) continue;
              const dx = G.bloonX[bi] - h.x, dz = G.bloonZ[bi] - h.z, d = Math.hypot(dx, dz) || 1;
              if (d <= R) damageBloon(bi, base, true, false, dx / d, dz / d, 2.2, true);
            }
            if (G.activeMOABs) for (let k = G.activeMOABs.length - 1; k >= 0; k--) { const mb = G.activeMOABs[k]; if (Math.hypot(mb.x - h.x, mb.z - h.z) <= R + 2) damageMOAB(k, base * 10, true); }
          } finally { window.__B13_CTX = prev || null; }
          if (typeof spawnExplosionVFX === 'function') spawnExplosionVFX(h.x, h.z, R * 0.6);
          b13ShotFx(h.x, B13_SHOT_Y, h.z, m >= 5 ? 0xff3b1f : 0x4ade80, R * 0.9, 0.35, 0.6);
          b13V5Nova(h.x, h.z, R, m >= 5);
        }
      }
    }
    function b13PathAllowed(paths, p) {
      const next = paths[p] + 1;
      if (next > 5) return false;
      let others = 0, otherOver2 = false;
      for (let i = 0; i < 3; i++) { if (i === p) continue; if (paths[i] > 0) others++; if (paths[i] > 2) otherOver2 = true; }
      if (paths[p] === 0 && others >= 2) return false;
      if (next > 2 && otherOver2) return false;
      return true;
    }
    function b13CardUnitKey(id) {
      id = String(id || '');
      if (/^hero_/.test(id) || id === 'paragon_hero') return 'hero';
      let m = id.match(/^(?:recruit|squad)_(.+)$/); if (m) return m[1];
      m = id.match(/^sqpath_(.+)_\d$/); if (m) return m[1];
      m = id.match(/^paragon_(.+)$/); if (m) return m[1];
      return null;
    }
    function b13CompPathCard(k, p, paths) {
      const tree = B13_TREE[k], next = paths[p] + 1;
      const comp = (G.COMPANION_CATALOG || []).find(function(c) { return c.key === k; }) || {};
      const custom = B13_REAL_DESCS[k] && B13_REAL_DESCS[k][p] && B13_REAL_DESCS[k][p][next - 1];
      return {
        id: 'sqpath_' + k + '_' + p, tier: next,
        path: (comp.shortName || k.toUpperCase()) + ' • ' + B13_PATH_LABEL[p].toUpperCase() + ' • T' + next,
        badgeColor: ['from-red-500 to-rose-700', 'from-violet-500 to-purple-700', 'from-sky-500 to-blue-700'][p],
        icon: comp.icon || '🐒',
        name: tree.paths[p][next - 1] + ' (' + b13NextCode(paths, p) + ')',
        desc: custom || (B13_PATH_LABEL[p] + ' path tier ' + next + ': popping power x' + B13_TPOW[next] + ', ' + B13_PATH_FLAVOR[p] + '.'),
        apply: function(st) {
          const s2 = st.squad && st.squad[k];
          if (!s2) return;
          const ps = b13UnitPaths(k, st);
          if (ps[p] !== next - 1 || !b13PathAllowed(ps, p)) return;
          ps[p] = next;
          s2.level = 1 + Math.min(4, Math.max(ps[0], ps[1], ps[2]));
        }
      };
    }
    function b13ParagonCard(unit, st) {
      const tree = B13_TREE[b13TreeKey(unit, st)];
      if (!tree) return null;
      return {
        id: unit === 'hero' ? 'paragon_hero' : 'paragon_' + unit, tier: 5,
        path: '★ PARAGON • ' + tree.name.toUpperCase(),
        badgeColor: 'from-amber-400 to-yellow-600', icon: '⭐',
        name: 'PARAGON: ' + tree.paragon,
        desc: 'Fuses all 3 paths into the Paragon form: popping power x' + B13_TPOW[6] + ' with every path effect.',
        apply: function(s2) {
          if (unit === 'hero') { if (s2.hero) s2.hero.b13Paragon = true; }
          else if (s2.squad && s2.squad[unit]) { s2.squad[unit].paragon = true; s2.squad[unit].level = 5; }
        }
      };
    }
    function installB13PathCards() {
      const cur = G.getAvailableUpgradeCards;
      if (typeof cur !== 'function' || cur._b13Paths) return;
      const w = function(state) {
        const raw = cur.apply(this, arguments) || [];
        if (!state || !state.hero) return raw;
        const plv = state.hero.level || 1;
        const banished = state.banishedCardIds || new Set();
        const out = raw.filter(function(c) { return !(c && /^squad_/.test(String(c.id))); });
        // Hero cards: real tree names + code
        const htree = B13_TREE[state.hero.id];
        if (htree) {
          const hp = b13UnitPaths('hero', state);
          out.forEach(function(c) {
            const id = String(c.id);
            const p = /^hero_volley/.test(id) ? 0 : (/^hero_elemental/.test(id) ? 1 : (/^hero_explosive/.test(id) ? 2 : -1));
            if (p < 0 || !c.tier) return;
            c.name = htree.paths[p][c.tier - 1] + ' (' + b13NextCode(hp, p) + ')';
            c.path = htree.name.toUpperCase() + ' • ' + B13_PATH_LABEL[p].toUpperCase() + ' • T' + c.tier;
            if (!c._b13Desc) { c._b13Desc = true; c.desc = B13_PATH_LABEL[p] + ' path tier ' + c.tier + ': popping power x' + B13_TPOW[c.tier] + '. ' + (c.desc || ''); }
          });
          if (!state.hero.b13Paragon && b13ParagonReady(hp) && plv >= B13_PARAGON_LVL && !banished.has('paragon_hero')) { const pc = b13ParagonCard('hero', state); if (pc) out.push(pc); }
        }
        // Companion path cards (every companion, 5-2-0, level-gated) + Paragon
        if (state.squad) (G.COMPANION_CATALOG || []).forEach(function(comp) {
          const k = comp.key, sq = state.squad[k];
          if (!sq || !(sq.level > 0) || !B13_TREE[k] || sq.paragon) return;
          const paths = b13UnitPaths(k, state);
          for (let p = 0; p < 3; p++) {
            if (!b13PathAllowed(paths, p)) continue;
            if (plv < B13_TIER_LVL[paths[p] + 1]) continue;
            const card = b13CompPathCard(k, p, paths);
            if (!banished.has(card.id)) out.push(card);
          }
          if (b13ParagonReady(paths) && plv >= B13_PARAGON_LVL && !banished.has('paragon_' + k)) out.push(b13ParagonCard(k, state));
        });
        // One card per unit per roll (no two upgrades for the same monkey in one roll)
        const groups = new Map(), rest = [];
        out.forEach(function(c) {
          if (!c) return;
          const u = b13CardUnitKey(c.id);
          if (!u) { rest.push(c); return; }
          if (!groups.has(u)) groups.set(u, []);
          groups.get(u).push(c);
        });
        const picked = [];
        groups.forEach(function(list) { const par = list.find(function(c) { return /^paragon_/.test(String(c.id)); }); picked.push(par || list[Math.floor(Math.random() * list.length)]); });
        return picked.concat(rest);
      };
      w._b13Paths = true;
      w._b13Gated = true;
      G.getAvailableUpgradeCards = w;
    }
    installB13PathCards();

    // ------------------------------------------------------------------------
    // E4. BOSS BAR: priority ordering (boss first) + 3 skull markers (bosses only)
    //     + true 3D projectile meshes in flight
    // ------------------------------------------------------------------------
    function b13BlimpPriority(a, b) {
      const ab = B13_BOSS_SET.has(String(a.blimpKey || '').toUpperCase()) ? 1 : 0;
      const bb = B13_BOSS_SET.has(String(b.blimpKey || '').toUpperCase()) ? 1 : 0;
      if (ab !== bb) return bb - ab;
      return (b.maxHp || 0) - (a.maxHp || 0);
    }
    function ensureBossBarSkulls() {
      const hpBar = document.getElementById('moab-boss-hp-bar');
      if (!hpBar || !hpBar.parentElement || document.getElementById('boss-skull-marker-0')) return;
      const track = hpBar.parentElement;
      [75, 50, 25].forEach(function(pct, idx) {
        const sk = document.createElement('div');
        sk.id = 'boss-skull-marker-' + idx;
        sk.className = 'boss-skull-marker';
        sk.style.left = pct + '%';
        sk.textContent = '💀';
        track.appendChild(sk);
      });
    }
    function syncBossBarSkulls() {
      ensureBossBarSkulls();
      const primary = G.activeMOABs && G.activeMOABs[0];
      const isBoss = !!(primary && primary._skullGates);
      [0, 1, 2].forEach(function(idx) {
        const el = document.getElementById('boss-skull-marker-' + idx);
        if (!el) return;
        el.style.display = isBoss ? '' : 'none';
        if (!isBoss) return;
        const shieldOn = primary._skullShield > 0 && primary._skullIdx === idx + 1;
        const passed = primary._skullIdx > idx && !shieldOn;
        el.classList.toggle('skull-shield-active', shieldOn);
        el.classList.toggle('skull-broken', passed);
        el.textContent = shieldOn ? '🛡️' : '💀';
      });
    }

    // ------------------------------------------------------------------------
    // Build 13.3 PROJECTILES: every shot drawn (all 500 slots) with a per-unit,
    // per-tier 3D look, fired from the muzzle, at chest height of the 2x units.
    // Shots are classified the frame they appear (origin vs hero / companions).
    // ------------------------------------------------------------------------
    const B13_PROJ_MAX = (G.MAX_PROJECTILES || 500);
    const B13_SHOT_Y = 1.6;
    const P_OX = typeof projOriginX !== 'undefined' ? projOriginX : null;
    const P_OZ = typeof projOriginZ !== 'undefined' ? projOriginZ : null;
    const P_EN = typeof projIsEnergy !== 'undefined' ? projIsEnergy : null;
    const P_BM = typeof projIsBoomerang !== 'undefined' ? projIsBoomerang : null;
    const P_EX = typeof projExplosive !== 'undefined' ? projExplosive : null;
    const vpTempCol = new THREE.Color();
    const shotType = new Uint8Array(B13_PROJ_MAX);
    const shotColor = new Uint32Array(B13_PROJ_MAX);
    const shotSize = new Float32Array(B13_PROJ_MAX);
    const shotSrc = new Uint8Array(B13_PROJ_MAX);
    const shotSeenOX = new Float32Array(B13_PROJ_MAX).fill(NaN);
    const shotSeenOZ = new Float32Array(B13_PROJ_MAX).fill(NaN);
    const shotPrevActive = new Uint8Array(B13_PROJ_MAX);
    const shotLastX = new Float32Array(B13_PROJ_MAX), shotLastZ = new Float32Array(B13_PROJ_MAX);

    const solidMat = function() { return new THREE.MeshLambertMaterial({ color: 0xffffff }); };
    const solidGlowMat = function() { return new THREE.MeshBasicMaterial({ color: 0xffffff }); };
    const glowMat = function(op) { return new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }); };
    const fwd = function(geo) { return geo.rotateX(Math.PI / 2); }; // lathe/cylinder axis (y) -> forward (z)
    const lathe = function(pts, seg) { return fwd(new THREE.LatheGeometry(pts.map(function(p) { return new THREE.Vector2(p[0], p[1]); }), seg || 8)); };
    const extrudeFlat = function(shape, depth) { const g = new THREE.ExtrudeGeometry(shape, { depth: depth || 0.05, bevelEnabled: false }); g.translate(0, 0, -(depth || 0.05) / 2); return g.rotateX(Math.PI / 2); };
    const starShape = function(n, ro, ri) { const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = (i / (n * 2)) * Math.PI * 2; if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); return s; };
    const boomShape = function() { const s = new THREE.Shape(); s.moveTo(-0.42, -0.12); s.quadraticCurveTo(0, 0.38, 0.42, -0.12); s.lineTo(0.32, -0.2); s.quadraticCurveTo(0, 0.18, -0.32, -0.2); s.closePath(); return s; };

    // type: [coreGeo, coreMat, haloGeo|null, haloOpacity, spinRadPerSec, fixedCoreColor|null]
    const PT_DEF = [
      ['octa',     new THREE.OctahedronGeometry(0.26, 0).scale(0.8, 0.8, 1.9), solidMat(), null, 0, 0, null],
      ['dart',     lathe([[0, 0.55], [0.07, 0.38], [0.035, 0.35], [0.035, -0.3], [0.13, -0.5], [0, -0.52]]), solidMat(), null, 0, 0, null],
      ['arrow',    lathe([[0, 0.7], [0.09, 0.5], [0.03, 0.47], [0.03, -0.45], [0.12, -0.62], [0, -0.64]]), solidMat(), null, 0, 0, null],
      ['bolt',     lathe([[0, 0.6], [0.11, 0.38], [0.045, 0.35], [0.045, -0.4], [0, -0.42]]), solidMat(), null, 0, 0, null],
      ['laser',    fwd(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 8)), solidGlowMat(), fwd(new THREE.CylinderGeometry(0.17, 0.17, 1.9, 10)), 0.55, 0, null],
      ['plasma',   new THREE.IcosahedronGeometry(0.26, 1), solidGlowMat(), new THREE.IcosahedronGeometry(0.55, 1), 0.45, 0, null],
      ['sunbeam',  fwd(new THREE.CylinderGeometry(0.13, 0.13, 2.6, 10)), solidGlowMat(), fwd(new THREE.CylinderGeometry(0.34, 0.34, 2.8, 12)), 0.5, 0, null],
      ['darkblade', new THREE.TorusGeometry(0.42, 0.075, 6, 18, Math.PI).rotateX(Math.PI / 2).rotateY(-Math.PI / 2), solidMat(), new THREE.TorusGeometry(0.42, 0.18, 6, 18, Math.PI).rotateX(Math.PI / 2).rotateY(-Math.PI / 2), 0.35, 0, null],
      ['glaive',   new THREE.TorusGeometry(0.34, 0.06, 6, 20, Math.PI * 1.5).rotateX(Math.PI / 2), solidMat(), null, 0, 18, null],
      ['boomerang', extrudeFlat(boomShape(), 0.06), solidMat(), null, 0, 16, null],
      ['shuriken', extrudeFlat(starShape(4, 0.3, 0.09), 0.04), solidMat(), null, 0, 22, null],
      ['tack',     fwd(new THREE.ConeGeometry(0.07, 0.42, 6)), solidMat(), null, 0, 0, null],
      ['flame',    new THREE.IcosahedronGeometry(0.22, 0), solidGlowMat(), new THREE.IcosahedronGeometry(0.46, 1), 0.5, 6, null],
      ['bomb',     new THREE.SphereGeometry(0.24, 12, 10), solidMat(), new THREE.SphereGeometry(0.07, 6, 6).translate(0, 0.26, 0), 1.0, 0, null],
      ['bullet',   fwd(new THREE.CylinderGeometry(0.045, 0.05, 0.32, 8)), solidMat(), fwd(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6).translate(0, -0.9, 0)), 0.6, 0, null],
      ['iceshard', new THREE.OctahedronGeometry(0.2, 0).scale(0.6, 0.6, 1.9), solidMat(), new THREE.OctahedronGeometry(0.36, 0).scale(0.6, 0.6, 1.6), 0.35, 4, null],
      ['iceorb',   new THREE.IcosahedronGeometry(0.24, 1), solidMat(), new THREE.IcosahedronGeometry(0.46, 1), 0.4, 3, null],
      ['rocket',   lathe([[0, 0.5], [0.09, 0.32], [0.09, -0.3], [0.14, -0.42], [0, -0.42]]), solidMat(), fwd(new THREE.ConeGeometry(0.11, 0.6, 8).rotateX(Math.PI).translate(0, -0.7, 0)), 0.85, 0, null],
      ['potion',   new THREE.SphereGeometry(0.17, 12, 10), solidGlowMat(), new THREE.SphereGeometry(0.34, 10, 8), 0.3, 5, null],
      ['thorn',    fwd(new THREE.ConeGeometry(0.08, 0.5, 5)), solidMat(), null, 0, 0, null],
      ['wave',     new THREE.TorusGeometry(0.5, 0.07, 6, 20, Math.PI * 0.9).rotateX(Math.PI / 2).rotateY(-Math.PI * 0.95), solidGlowMat(), null, 0, 0, null],
      ['spirit',   new THREE.IcosahedronGeometry(0.22, 1), solidGlowMat(), new THREE.IcosahedronGeometry(0.5, 1), 0.4, 0, null],
      ['databit',  new THREE.BoxGeometry(0.16, 0.16, 0.4), solidGlowMat(), new THREE.BoxGeometry(0.34, 0.34, 0.7), 0.3, 0, null],
      ['orb',      new THREE.IcosahedronGeometry(0.24, 1), solidGlowMat(), new THREE.IcosahedronGeometry(0.52, 1), 0.45, 0, null],
      ['saw',      new THREE.CylinderGeometry(0.34, 0.34, 0.04, 14), solidMat(), null, 0, 20, null],
      ['sunorb',   new THREE.IcosahedronGeometry(0.42, 2), solidGlowMat(), new THREE.IcosahedronGeometry(0.95, 2), 0.55, 2, null],
      ['gplasma',  new THREE.IcosahedronGeometry(0.27, 1), solidGlowMat(), new THREE.IcosahedronGeometry(0.6, 1), 0.55, 0, null],
      ['rplasma',  new THREE.IcosahedronGeometry(0.3, 1), solidGlowMat(), new THREE.IcosahedronGeometry(0.68, 1), 0.6, 0, null],
      ['eclipse',  new THREE.SphereGeometry(0.36, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0b0d17 }), new THREE.TorusGeometry(0.55, 0.16, 8, 24).rotateX(Math.PI / 2), 0.9, 3, 0x2a1650],
      ['paraorb',  new THREE.IcosahedronGeometry(0.3, 1), solidGlowMat(), new THREE.IcosahedronGeometry(0.72, 1), 0.55, 0, null]
    ];
    const PT = {};
    const ptList = [];
    PT_DEF.forEach(function(d, idx) {
      const core = new THREE.InstancedMesh(d[1], d[2], B13_PROJ_MAX);
      core.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      core.frustumCulled = false;
      core.setColorAt(0, new THREE.Color(0xffffff)); // allocate colour buffer at full capacity BEFORE count = 0
      core.count = 0;
      G.scene.add(core);
      let halo = null;
      if (d[3]) {
        halo = new THREE.InstancedMesh(d[3], glowMat(Math.min(1, d[4] * 1.35)), B13_PROJ_MAX);
        halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        halo.frustumCulled = false;
        halo.setColorAt(0, new THREE.Color(0xffffff));
        halo.count = 0;
        G.scene.add(halo);
      }
      const t = { id: idx, name: d[0], core: core, halo: halo, spin: d[5], fixed: d[6], n: 0 };
      PT[d[0]] = t;
      ptList.push(t);
    });

    // Per-unit, per-tier projectile looks [type, colour, size]
    function b13HeroShot(id, T, P) {
      switch (id) {
        case 'supermonkey':
          if (P === 0) return T >= 5 ? ['sunbeam', 0xfde047, 1.35] : T === 4 ? ['sunbeam', 0xfacc15, 1.1] : T === 3 ? ['plasma', 0xd946ef, 1.0] : T === 2 ? ['laser', 0xff2a2a, 1.0] : ['dart', 0x94a3b8, 1.0];
          if (P === 1) return T >= 5 ? ['plasma', 0x38bdf8, 1.35] : T === 4 ? ['plasma', 0x22d3ee, 1.1] : T === 3 ? ['laser', 0x38bdf8, 1.0] : ['dart', 0x94a3b8, 1.0];
          return T >= 5 ? ['darkblade', 0xa21caf, 1.5] : T === 4 ? ['darkblade', 0xdc2626, 1.25] : T === 3 ? ['darkblade', 0x7e22ce, 1.05] : ['dart', 0x94a3b8, 1.0];
        case 'quincy':
          if (P === 2) return ['arrow', T >= 4 ? 0xf97316 : 0xef4444, 1.0 + T * 0.06];
          if (P === 1) return ['arrow', T >= 4 ? 0xcbd5e1 : 0x94a3b8, 1.0 + T * 0.1];
          return ['arrow', T >= 4 ? 0x67e8f9 : 0x84cc16, 1.0 + T * 0.05];
        case 'gwendolin': return ['flame', P === 1 ? 0xef4444 : 0xf97316, 0.9 + T * 0.1];
        case 'obyn': return P === 2 ? ['thorn', 0x65a30d, 1.0 + T * 0.08] : ['spirit', P === 1 ? 0x4ade80 : 0x67e8f9, 0.9 + T * 0.08];
        case 'sauda': return ['darkblade', P === 1 ? 0xef4444 : 0xe2e8f0, 1.0 + T * 0.08];
        case 'benjamin': return ['databit', P === 1 ? 0xef4444 : (P === 2 ? 0xfacc15 : 0x22c55e), 0.9 + T * 0.06];
        case 'silas': return P === 1 ? ['iceshard', 0xe0f2fe, 1.0 + T * 0.1] : ['iceorb', 0x7dd3fc, 1.0 + T * 0.08];
        case 'rosalia': return P === 1 ? ['bomb', 0x3f6212, 1.0 + T * 0.06] : ['laser', 0xef4444, 0.9 + T * 0.1];
        case 'corvus': return ['spirit', P === 2 ? 0xf97316 : 0xa78bfa, 0.9 + T * 0.1];
        case 'geraldo': return ['potion', [0x60a5fa, 0xfacc15, 0x22c55e][P] || 0x60a5fa, 1.0 + T * 0.06];
        default: return null;
      }
    }
    function b13CompShot(k, T) {
      switch (k) {
        case 'super': { const sp = b13UnitPaths('super', G.gameState); return b13SuperLookP(sp[0], sp[1], sp[2]); }
        case 'dart': return T >= 3 ? ['bolt', 0x92400e, 1.0 + T * 0.08] : ['dart', 0x94a3b8, 1.0];
        case 'boomer': return T >= 2 ? ['glaive', T >= 5 ? 0xfacc15 : 0xcbd5e1, 1.0 + T * 0.08] : ['boomerang', 0xf59e0b, 1.0];
        case 'tack': return T >= 4 ? ['flame', 0xf97316, 1.1] : T === 3 ? ['flame', 0xfb923c, 0.85] : ['tack', 0xe11d48, 1.0];
        case 'ninja': return ['shuriken', T >= 5 ? 0xef4444 : 0xcbd5e1, 1.0 + T * 0.06];
        case 'wizard': return T >= 5 ? ['flame', 0xf97316, 1.4] : T >= 3 ? ['flame', 0xf97316, 1.0] : ['orb', 0xa855f7, 0.9];
        case 'mortar': return ['bomb', 0x1f2937, 1.0 + T * 0.12];
        case 'ice': return T >= 4 ? ['iceshard', 0xe0f2fe, 1.2] : ['iceshard', 0x7dd3fc, 1.0];
        case 'dartling': return T >= 4 ? ['laser', 0xef4444, 1.3] : T === 3 ? ['rocket', 0x9ca3af, 1.0] : ['dart', 0x94a3b8, 0.9];
        case 'mermonkey': return ['wave', T >= 4 ? 0x5eead4 : 0x22d3ee, 0.9 + T * 0.1];
        case 'beasthandler': return ['darkblade', 0xd6d3d1, 0.9 + T * 0.08];
        case 'desperado': return ['bullet', T >= 5 ? 0xfacc15 : 0xd6d3d1, 1.0];
        case 'alchemist': return ['potion', T >= 3 ? 0xef4444 : 0x84cc16, 1.0 + T * 0.06];
        case 'druid': return T >= 4 ? ['orb', 0xfde047, 1.1] : ['thorn', 0x65a30d, 1.0];
        default: return null;
      }
    }
    const B13_MUZZLE = { dartling: 1.8, sniper: 2.0, desperado: 1.2, wizard: 1.3, mortar: 1.1, mermonkey: 1.3, ice: 1.2, alchemist: 1.0 };

    // Muzzle flashes + impact bursts (sprite pools)
    const fxPool = [];
    for (let i = 0; i < 48; i++) { const s = b13Sprite(0xffffff, 0.6, 0); s.visible = false; G.scene.add(s); fxPool.push({ s: s, t: 0, life: 0.1, grow: 1 }); }
    let fxCursor = 0;
    function b13ShotFx(x, y, z, hex, size, life, grow) {
      const f = fxPool[fxCursor]; fxCursor = (fxCursor + 1) % fxPool.length;
      f.s.position.set(x, y, z); f.s.material.color.setHex(hex); f.s.visible = true;
      f.t = 0; f.life = life; f.size = size; f.grow = grow;
    }

    // Super Monkey: projectile follows the Top path (dart -> laser -> plasma -> sunbeam), Bottom 3+ throws dark blades
    function b13SuperShot(h) { return b13SuperLookP(h.volleyTier || 0, h.weaponTier || h.elementalTier || 0, h.explosiveTier || 0); }
    function b13SuperLookP(t, m, b) {
      if (m >= 4 && m > t && m > b) return m >= 5 ? ['rplasma', 0xff3b1f, 1.3] : ['gplasma', 0x4ade80, 1.15];
      if (b >= 3 && b > t) return b >= 5 ? ['darkblade', 0x38bdf8, 1.45] : (b === 4 ? ['darkblade', 0x6d28d9, 1.25] : ['darkblade', 0x52525b, 1.05]);
      if (t >= 5) return ['sunorb', 0xffd84a, 1.4];
      if (t === 4) return ['sunbeam', 0xfacc15, 1.1];
      if (t === 3) return ['sunbeam', 0xfbbf24, 1.0];
      if (t === 2) return ['plasma', 0xd946ef, 1.05];
      if (t === 1) return ['laser', 0xff2a2a, 1.0];
      return ['dart', 0x94a3b8, m >= 3 ? 1.1 : 1.0];
    }
    function b13DartlingShot(st) {
      const rs = b13RealPathState('dartling', st), p = rs.paths;
      if (p[0] >= 3) return p[0] >= 5 ? ['laser', 0xff1a1a, 2.4] : (p[0] === 4 ? ['laser', 0xff3b6b, 1.6] : ['laser', 0xff2a2a, 1.2]);
      if (p[1] >= 3) return p[1] >= 5 ? ['rocket', 0x84cc16, 1.8] : ['rocket', 0x7c3aed, p[1] === 4 ? 1.2 : 1.05];
      if (p[2] >= 3) return p[2] >= 5 ? ['bullet', 0xfde047, 1.0] : ['bullet', 0xd1d5db, p[2] === 4 ? 0.95 : 0.8];
      if (p[0] === 2) return ['dart', 0x7dd3fc, 1.05];
      if (p[1] === 2) return ['dart', 0x86efac, 1.0];
      return ['dart', 0x94a3b8, 0.95];
    }
    const shotOwner = new Array(B13_PROJ_MAX).fill(null);
    const shotFix = new Uint8Array(B13_PROJ_MAX);
    function b13ClassifyShot(i, st, h, ox, oz, ownerKey) {
      if (ox === undefined) { ox = P_OX ? P_OX[i] : G.projX[i]; oz = P_OZ ? P_OZ[i] : G.projZ[i]; }
      let look = null, muzzle = 0.9;
      if (!ownerKey && h && Math.hypot(ox - h.x, oz - h.z) < 1.9) {
        const v = h.volleyTier || 0, w = h.weaponTier || h.elementalTier || 0, x = h.explosiveTier || 0;
        const P = v >= w && v >= x ? 0 : (w >= x ? 1 : 2);
        look = b13ParLookFor('hero', h.id === 'supermonkey' ? b13SuperShot(h) : b13HeroShot(h.id, Math.min(5, 1 + Math.max(v, w, x)), P));
        if (G.heroMesh && G.heroMesh.userData.b13Real) { shotOwner[i] = G.heroMesh; shotFix[i] = 1; }
      } else if (G.squadMeshes && st.squad) {
        let best = ownerKey && G.squadMeshes[ownerKey] ? ownerKey : null, bd = 1.6;
        if (!best) for (const k in G.squadMeshes) { const m = G.squadMeshes[k]; if (!m || !m.visible) continue; const d = Math.hypot(m.position.x - ox, m.position.z - oz); if (d < bd) { bd = d; best = k; } }
        if (best) {
          look = b13ParLookFor(best, best === 'dartling' ? b13DartlingShot(st) : b13CompShot(best, Math.max(1, Math.min(5, (st.squad[best] && st.squad[best].level) || 1))));
          muzzle = B13_MUZZLE[best] || 0.9;
          shotOwner[i] = G.squadMeshes[best]; shotFix[i] = 1;
        }
      }
      if (!look) {
        if (P_BM && P_BM[i]) look = ['boomerang', 0, 1];
        else if (P_EX && P_EX[i]) look = ['bomb', 0x1f2937, 1];
        else if (P_EN && P_EN[i]) look = ['laser', 0, 1];
        else look = ['octa', 0, 1];
      }
      const t = PT[look[0]] || PT.octa;
      if (b13ShotPar) b13ShotPar[i] = look[3] ? 1 : 0;
      shotType[i] = t.id;
      if (look[1]) shotColor[i] = look[1];
      else { G.projInstancedMesh.getColorAt(i, vpTempCol); shotColor[i] = vpTempCol.getHex(); }
      shotSize[i] = look[2] || 1;
      // Move the shot to the muzzle along its flight direction
      const vx = G.projVX[i], vz = G.projVZ[i], sp = Math.hypot(vx, vz) || 1;
      G.projX[i] += (vx / sp) * muzzle;
      G.projZ[i] += (vz / sp) * muzzle;
      b13ShotFx(G.projX[i], B13_SHOT_Y, G.projZ[i], shotColor[i], 0.9 * shotSize[i], 0.07, 1.6);
    }

    const vpDummy = new THREE.Object3D();
    // Tag every shot at the instant it is fired (exact origin match with the shooter).
    // Wraps both the global spawnProjectile and G.spawnProjectile; tags every slot a call fills.
    function b13TagRange(start, opts) {
      if (!opts || typeof projCursor === 'undefined') return;
      const st = G.gameState, h = st && st.hero;
      const end = projCursor;
      let n = (end - start + B13_PROJ_MAX) % B13_PROJ_MAX;
      for (let k = 0; k < n; k++) {
        const idx = (start + k) % B13_PROJ_MAX;
        if (G.projActive[idx] !== 1) continue;
        b13ClassifyShot(idx, st, h, opts.x || 0, opts.z || 0, opts._b13owner);
        shotSrc[idx] = 1;
        shotPrevActive[idx] = 1;
        shotSeenOX[idx] = P_OX ? P_OX[idx] : NaN;
        shotSeenOZ[idx] = P_OZ ? P_OZ[idx] : NaN;
        shotLastX[idx] = G.projX[idx]; shotLastZ[idx] = G.projZ[idx];
      }
    }
    function b13DartlingPre(opts) {
      const st = G.gameState, sq = st && st.squad && st.squad.dartling;
      if (!sq || !(sq.level > 0)) return null;
      const p = b13RealPathState('dartling', st).paths, t = p[0], mid = p[1], b = p[2];
      let cd = 1;
      opts.pierce = 1; opts.damage = 1 + (b >= 2 ? 1 : 0) + (t >= 2 ? 0.5 : 0); opts.explosive = false; opts.canPopLead = b >= 2; opts.scale = 0.9;
      if (t >= 1 || b >= 1) cd *= 0.9;
      if (mid >= 2) cd *= 0.72;
      let extra = null;
      if (t >= 3) {
        opts.isEnergy = true; opts.canPopLead = true;
        opts.pierce = t >= 5 ? 30 : (t >= 4 ? 12 : 5);
        opts.damage = t >= 5 ? 2.2 : (t >= 4 ? 1.5 : 1.2);
        opts.life = (opts.life || 0.95) * (t >= 4 ? 1.6 : 1.25);
        cd *= t >= 5 ? 0.45 : (t >= 4 ? 0.55 : 1);
      } else if (mid >= 3) {
        opts.explosive = true; opts.canPopLead = true; opts.pierce = 3;
        opts.damage = mid >= 5 ? 4 : (mid >= 4 ? 2 : 1.5);
        cd *= mid >= 5 ? 2.0 : 1.5;
        if (mid >= 4) {
          const sp = Math.hypot(opts.vx, opts.vz) || 26, a0 = Math.atan2(opts.vx, opts.vz);
          extra = [-0.16, 0.16].map(function(da) { return Object.assign({}, opts, { vx: Math.sin(a0 + da) * sp, vz: Math.cos(a0 + da) * sp, _b13pre: true }); });
        }
      } else if (b >= 3) {
        const n = b >= 5 ? 10 : (b >= 4 ? 8 : 6), sp = Math.hypot(opts.vx, opts.vz) || 26, a0 = Math.atan2(opts.vx, opts.vz);
        opts.life = 0.42; opts.pierce = 2; opts.damage = b >= 5 ? 1.6 : (b >= 4 ? 1.3 : 1.1); opts.canPopLead = true;
        cd *= 2.2;
        extra = [];
        for (let i = 1; i < n; i++) { const a = a0 + (Math.random() - 0.5) * 0.55, k = 0.85 + Math.random() * 0.3; extra.push(Object.assign({}, opts, { vx: Math.sin(a) * sp * k, vz: Math.cos(a) * sp * k, _b13pre: true })); }
      }
      if (sq.cooldown > 0) sq.cooldown *= cd;
      return extra;
    }
    // Owner of a shot: the damage context set by each attack block, else the closest shooter
    function b13ShotOwner(opts) {
      const st = G.gameState, h = st && st.hero;
      const c = window.__B13_CTX;
      if (c) return c;
      if (h && Math.hypot((opts.x || 0) - h.x, (opts.z || 0) - h.z) < 1.9) return 'hero';
      let best = null, bd = 0.6;
      if (G.squadMeshes) for (const k in G.squadMeshes) { const m = G.squadMeshes[k]; if (!m || !m.visible) continue; const d = Math.hypot(m.position.x - (opts.x || 0), m.position.z - (opts.z || 0)); if (d < bd) { bd = d; best = k; } }
      return best;
    }
    function b13PredictLook(owner, st, opts) {
      const h = st.hero;
      if (owner === 'hero') {
        if (h.id === 'supermonkey') return b13SuperShot(h);
        const v = h.volleyTier || 0, w = h.weaponTier || h.elementalTier || 0, x = h.explosiveTier || 0;
        return b13HeroShot(h.id, Math.min(5, 1 + Math.max(v, w, x)), v >= w && v >= x ? 0 : (w >= x ? 1 : 2));
      }
      if (owner === 'dartling') return b13DartlingShot(st);
      if (st.squad && st.squad[owner]) return b13CompShot(owner, Math.max(1, Math.min(5, Math.floor(st.squad[owner].level || 1))));
      return opts.explosive ? ['bomb'] : (opts.isEnergy ? ['laser'] : ['dart']);
    }
    function b13PreShot(opts) {
      if (!opts || opts._b13pre) return null;
      const st = G.gameState, h = st && st.hero;
      if (!h || window.__IN_DEV_SHOWCASE) return null;
      const owner = b13ShotOwner(opts);
      opts._b13pre = true;
      if (!owner) return null;
      let extra = null;
      if (owner === 'dartling') { opts._b13owner = 'dartling'; extra = b13DartlingPre(opts); }
      else if (owner !== 'hero') opts._b13owner = owner;
      if (owner === 'hero' && h.id === 'supermonkey') opts._isChildBeam = true; // path stats drive the beam count, not the old fan hook
      const pw = b13Pow(owner), pb = b13PierceBonus(owner);
      const look = b13ParLookFor(owner, b13PredictLook(owner, st, opts)) || ['dart'];
      const sp1 = B13_SHOT_SPEED[look[0]];
      const tune = function(o) {
        o._b13pre = true;
        if (o !== opts && opts._b13owner) o._b13owner = opts._b13owner;
        o.damage = (o.damage !== undefined ? o.damage : 1) * pw;
        o.pierce = (o.pierce !== undefined ? o.pierce : 2) + pb;
        if (sp1 && !o.isBoomerang && !o.isHoming && o.vx !== undefined && o.vz !== undefined) {
          const sp0 = Math.hypot(o.vx, o.vz) || 1;
          const k = sp1 / sp0;
          o.vx *= k; o.vz *= k;
          o.life = (o.life !== undefined ? o.life : 1.4) / k * (B13_SHOT_RANGE[look[0]] || 1.1);
        }
      };
      tune(opts);
      if (extra) extra.forEach(tune);
      if (owner !== 'hero' && owner !== 'dartling' && st.squad && st.squad[owner]) {
        const fp = b13UnitPaths(owner, st), sq = st.squad[owner];
        const fl = function(o) { o.damage *= 1 + 0.1 * fp[0]; o.pierce += fp[2]; if (o.life) o.life *= 1 + 0.06 * fp[2]; };
        fl(opts);
        if (extra) extra.forEach(fl);
        if (sq.cooldown > 0 && sq.cooldown !== sq._b13CdSeen) { sq.cooldown *= Math.max(0.55, 1 - 0.07 * fp[1]); sq._b13CdSeen = sq.cooldown; }
      }
      return extra;
    }
    function b13MakeTagged(fn) {
      const w = function(opts) {
        let extra = null;
        try { extra = b13PreShot(opts); } catch (err) { extra = null; }
        const start = projCursor;
        const res = fn.apply(this, arguments);
        try { b13TagRange(start, opts); } catch (err) { /* visuals only */ }
        if (extra) extra.forEach(function(o2) { const s2 = projCursor; fn.call(this, o2); try { b13TagRange(s2, o2); } catch (err) { /* visuals only */ } });
        return res;
      };
      w._b13Tag = true;
      return w;
    }
    if (typeof projCursor !== 'undefined') {
      if (typeof spawnProjectile === 'function' && !spawnProjectile._b13Tag) spawnProjectile = b13MakeTagged(spawnProjectile);
      if (typeof G.spawnProjectile === 'function' && !G.spawnProjectile._b13Tag) G.spawnProjectile = b13MakeTagged(G.spawnProjectile);
    }
    G.__b13ShotDebug = function() {
      const out = [], st = G.gameState, h = st && st.hero;
      for (let i = 0; i < B13_PROJ_MAX; i++) {
        if (G.projActive[i] !== 1) continue;
        let near = 'none', bd = 99;
        if (G.squadMeshes) for (const k in G.squadMeshes) { const m = G.squadMeshes[k]; if (!m || !m.visible) continue; const d = Math.hypot(m.position.x - P_OX[i], m.position.z - P_OZ[i]); if (d < bd) { bd = d; near = k; } }
        out.push({ src: shotSrc[i], life: (typeof projLife !== 'undefined' ? projLife[i] : -1), slot: i, type: (ptList[shotType[i]] || {}).name, col: shotColor[i].toString(16), hero: h ? Math.hypot(h.x - P_OX[i], h.z - P_OZ[i]).toFixed(2) : '-', near: near + ':' + bd.toFixed(2), en: P_EN ? P_EN[i] : -1, ex: P_EX ? P_EX[i] : -1 });
      }
      return out;
    };
    let vpTime = 0;
    function sync3DProjectilesInFlight(dt) {
      if (!G.projActive || !G.projInstancedMesh) return;
      G.projInstancedMesh.visible = false;
      vpTime += dt;
      const st = G.gameState, h = st && st.hero;
      for (let k = 0; k < ptList.length; k++) ptList[k].n = 0;
      const N = Math.min(B13_PROJ_MAX, G.MAX_PROJECTILES || B13_PROJ_MAX);
      for (let i = 0; i < N; i++) {
        const active = G.projActive[i] === 1;
        if (!active) {
          if (shotPrevActive[i]) {
            shotPrevActive[i] = 0;
            b13ShotFx(shotLastX[i], B13_SHOT_Y, shotLastZ[i], shotColor[i] || 0xffffff, 0.8 * (shotSize[i] || 1), 0.16, 2.4); // impact burst
            if (b13V5Ready) b13ImpactSparks(shotLastX[i], shotLastZ[i], shotColor[i], ptList[shotType[i]], i);
          }
          continue;
        }
        const ox = P_OX ? P_OX[i] : NaN, oz = P_OZ ? P_OZ[i] : NaN;
        if (!shotPrevActive[i] || (P_OX && (ox !== shotSeenOX[i] || oz !== shotSeenOZ[i]))) {
          shotSeenOX[i] = ox; shotSeenOZ[i] = oz;
          b13ClassifyShot(i, st, h);
          shotSrc[i] = 2;
        }
        shotPrevActive[i] = 1;
        if (shotFix[i]) {
          shotFix[i] = 0;
          const own = shotOwner[i];
          if (own && own.visible !== false && P_OX) {
            const vx0 = G.projVX[i], vz0 = G.projVZ[i], sp0 = Math.hypot(vx0, vz0) || 1;
            const traveled = Math.hypot(G.projX[i] - P_OX[i], G.projZ[i] - P_OZ[i]);
            const mz = own.userData && own.userData.b13Real ? b13RealMuzzle(own, vx0, vz0) : null;
            const bx = mz ? mz.x : own.position.x + (vx0 / sp0) * (traveled + 0.0);
            const bz = mz ? mz.z : own.position.z + (vz0 / sp0) * (traveled + 0.0);
            const lead = mz ? Math.min(traveled, 0.6) : 0;
            const nx = bx + (vx0 / sp0) * lead, nz = bz + (vz0 / sp0) * lead;
            if (Math.hypot(nx - G.projX[i], nz - G.projZ[i]) < 9) { G.projX[i] = nx; G.projZ[i] = nz; }
          }
          shotOwner[i] = null;
        }
        const px = G.projX[i], pz = G.projZ[i];
        shotLastX[i] = px; shotLastZ[i] = pz;
        const t = ptList[shotType[i]] || PT.octa;
        const sc = (G.projScale ? G.projScale[i] : 1) * shotSize[i] * 1.9;
        let y = B13_SHOT_Y;
        if (t.name === 'bomb' && P_OX) { const d = Math.hypot(px - P_OX[i], pz - P_OZ[i]); y += Math.sin(Math.min(1, d / 12) * Math.PI) * 2.6; }
        vpDummy.position.set(px, y, pz);
        vpDummy.rotation.set(0, t.spin ? vpTime * t.spin + i : Math.atan2(G.projVX[i], G.projVZ[i]), 0);
        vpDummy.scale.setScalar(sc);
        vpDummy.updateMatrix();
        const n = t.n++;
        t.core.setMatrixAt(n, vpDummy.matrix);
        t.core.setColorAt(n, vpTempCol.setHex(t.fixed !== null ? t.fixed : shotColor[i]));
        if (t.halo) { t.halo.setMatrixAt(n, vpDummy.matrix); t.halo.setColorAt(n, vpTempCol.setHex(t.name === 'bomb' ? 0xfbbf24 : (t.name === 'eclipse' ? 0xffd23f : shotColor[i]))); }
        if (b13V5Ready) b13Trail(i, px, y, pz, t, sc, dt);
      }
      for (let k = 0; k < ptList.length; k++) {
        const t = ptList[k];
        t.core.count = t.n;
        t.core.instanceMatrix.needsUpdate = true;
        if (t.core.instanceColor) t.core.instanceColor.needsUpdate = true;
        if (t.halo) { t.halo.count = t.n; t.halo.instanceMatrix.needsUpdate = true; if (t.halo.instanceColor) t.halo.instanceColor.needsUpdate = true; }
      }
      for (let f = 0; f < fxPool.length; f++) {
        const p = fxPool[f];
        if (!p.s.visible) continue;
        p.t += dt;
        const k = p.t / p.life;
        if (k >= 1) { p.s.visible = false; continue; }
        const s = p.size * (1 + k * p.grow);
        p.s.scale.set(s, s, 1);
        p.s.material.opacity = 1 - k;
      }
    }

    // ------------------------------------------------------------------------
    // E8. BUILD 13.5 + BUILD 13.6: PARAGON FORMS + SIGNATURE ATTACKS, PROJECTILE TRAILS,
    //     BOSS ARMOR, BLOONS-STYLE BLIMP ENTRANCE
    //     Refs: references/BTD6_Paragons_real.png, BTD6_VISUAL_REFERENCE.md 5a/5b,
    //     wiki: Tech Terror green plasma, Anti-Bloon red plasma + red lightning, TSG giant sun orbs
    // ------------------------------------------------------------------------
    var b13V5Ready = false;
    var b13ShotPar = new Uint8Array(B13_PROJ_MAX);
    var b13FxList = [];
    var b13LaterList = [];
    var b13ParGroups = new Set();
    var b13ParState = {};
    var b13Entrances = [];

    const V5GEO = new Map();
    function v5g(key, make) { if (!V5GEO.has(key)) V5GEO.set(key, make()); return V5GEO.get(key); }
    const V5MAT = new Map();
    function v5m(hex, o) {
      o = o || {};
      const key = hex + '|' + JSON.stringify(o);
      if (V5MAT.has(key)) return V5MAT.get(key);
      let m;
      if (o.add) m = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: o.op === undefined ? 0.8 : o.op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: o.map || null });
      else if (o.basic) m = new THREE.MeshBasicMaterial({ color: hex, transparent: o.op !== undefined, opacity: o.op === undefined ? 1 : o.op, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });
      else m = new THREE.MeshStandardMaterial({ color: hex, roughness: o.r === undefined ? 0.45 : o.r, metalness: o.m || 0, emissive: o.e || 0, emissiveIntensity: o.ei === undefined ? 1 : o.ei, transparent: o.op !== undefined, opacity: o.op === undefined ? 1 : o.op, flatShading: !!o.flat, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });
      m.userData.keep = true;
      V5MAT.set(key, m);
      return m;
    }
    function v5mesh(parent, geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
      if (parent) parent.add(m);
      return m;
    }
    function v5grp(parent, x, y, z, rx, ry, rz) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); g.rotation.set(rx || 0, ry || 0, rz || 0); if (parent) parent.add(g); return g; }
    const G_SPH = function(r, w) { return v5g('s' + r + '_' + (w || 14), function() { return new THREE.SphereGeometry(r, w || 14, Math.max(8, Math.round((w || 14) * 0.7))); }); };
    const G_CYL = function(a, b, h, s, open) { return v5g('c' + a + '_' + b + '_' + h + '_' + (s || 14) + (open ? 'o' : ''), function() { return new THREE.CylinderGeometry(a, b, h, s || 14, 1, !!open); }); };
    const G_CONE = function(r, h, s) { return v5g('k' + r + '_' + h + '_' + (s || 10), function() { return new THREE.ConeGeometry(r, h, s || 10); }); };
    const G_BOX = function(x, y, z) { return v5g('b' + x + '_' + y + '_' + z, function() { return new THREE.BoxGeometry(x, y, z); }); };
    const G_TOR = function(r, t, arc, ts) { return v5g('t' + r + '_' + t + '_' + (arc || 6.283).toFixed(2) + '_' + (ts || 32), function() { return new THREE.TorusGeometry(r, t, 8, ts || 32, arc || Math.PI * 2); }); };
    const G_OCT = function(r) { return v5g('o' + r, function() { return new THREE.OctahedronGeometry(r, 0); }); };
    const G_RING = v5g('ring', function() { return new THREE.RingGeometry(0.8, 1.0, 56).rotateX(-Math.PI / 2); });
    const G_DISC = v5g('disc', function() { return new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2); });
    const G_BEAM = v5g('beam', function() { return new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).translate(0, 0.5, 0); });

    function v5canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t; }
    const V5_SIGIL = v5canvasTex(256, 256, function(c) {
      c.translate(128, 128); c.strokeStyle = '#fff'; c.fillStyle = '#fff';
      c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 118, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 100, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(0, 0, 58, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 24; i++) { c.save(); c.rotate(i / 24 * Math.PI * 2); c.fillRect(-2, -116, 4, i % 2 ? 10 : 16); c.restore(); }
      c.lineWidth = 4; c.beginPath();
      for (let i = 0; i <= 8; i++) { const a = (i * 3 / 8) * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * 96, y = Math.sin(a) * 96; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * 79, Math.sin(a) * 79, 7, 0, Math.PI * 2); c.fill(); }
    });
    const V5_PILLAR = v5canvasTex(8, 128, function(c, w, h) { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.9)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    const V5_HAZARD = v5canvasTex(256, 256, function(c) {
      c.translate(128, 128);
      for (let i = 0; i < 20; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ef4444'; c.beginPath(); c.arc(0, 0, 124, (i / 20) * Math.PI * 2, ((i + 1) / 20) * Math.PI * 2); c.arc(0, 0, 104, ((i + 1) / 20) * Math.PI * 2, (i / 20) * Math.PI * 2, true); c.closePath(); c.fill(); }
      c.fillStyle = 'rgba(239,68,68,0.28)'; c.beginPath(); c.arc(0, 0, 104, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 54, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2); c.beginPath(); c.moveTo(0, -62); c.lineTo(-18, -92); c.lineTo(18, -92); c.closePath(); c.fill(); c.restore(); }
      c.fillRect(-3, -30, 6, 60); c.fillRect(-30, -3, 60, 6);
    });

    // ---------------- generic FX layer ----------------
    function v5Later(sec, fn) { b13LaterList.push({ t: sec, fn: fn }); }
    function v5Fx(obj, life, upd) { G.scene.add(obj); b13FxList.push({ o: obj, t: 0, life: life, upd: upd }); return obj; }
    function v5Dispose(o) { o.traverse(function(c) { if (c.material && !(c.material.userData && c.material.userData.keep)) c.material.dispose(); }); }
    function v5AddMat(hex, op, map) { return new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op === undefined ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: map || null }); }
    function v5Ring(x, z, R, hex, life, y, op) {
      const m = new THREE.Mesh(G_RING, v5AddMat(hex, op === undefined ? 0.95 : op));
      m.position.set(x, y === undefined ? 0.12 : y, z);
      return v5Fx(m, life || 0.5, function(o, k) { const s = R * (0.15 + 0.85 * (1 - Math.pow(1 - k, 3))); o.scale.set(s, 1, s); o.material.opacity = (op === undefined ? 0.95 : op) * (1 - k); });
    }
    function v5Disc(x, z, R, hex, life, op) {
      const m = new THREE.Mesh(G_DISC, v5AddMat(hex, op || 0.5));
      m.position.set(x, 0.1, z);
      return v5Fx(m, life || 0.4, function(o, k) { const s = R * (0.4 + 0.6 * k); o.scale.set(s, 1, s); o.material.opacity = (op || 0.5) * (1 - k); });
    }
    function v5Flash(x, y, z, hex, size, life) {
      const s = b13Sprite(hex, size, 1);
      s.position.set(x, y, z);
      return v5Fx(s, life || 0.3, function(o, k) { const q = size * (0.6 + k * 1.2); o.scale.set(q, q, 1); o.material.opacity = 1 - k; });
    }
    function v5Beam(x, z, hex, w, life) {
      const g = new THREE.Group();
      const outer = new THREE.Mesh(G_BEAM, v5AddMat(hex, 0.55)); outer.scale.set(w, 34, w);
      const core = new THREE.Mesh(G_BEAM, v5AddMat(0xffffff, 0.9)); core.scale.set(w * 0.38, 34, w * 0.38);
      g.add(outer, core);
      g.position.set(x, 0, z);
      v5Ring(x, z, w * 3.2, hex, (life || 0.6) * 0.9);
      v5Flash(x, 0.8, z, hex, w * 5, 0.35);
      return v5Fx(g, life || 0.6, function(o, k) { const f = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85; outer.scale.set(w * (0.4 + f * 0.8), 34, w * (0.4 + f * 0.8)); core.scale.set(w * 0.38 * f, 34, w * 0.38 * f); outer.material.opacity = 0.55 * f; core.material.opacity = 0.9 * f; });
    }
    function v5Bolt(x1, y1, z1, x2, y2, z2, hex, life, jag) {
      const N = 9, pos = new Float32Array(N * 3);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const g = new THREE.Group();
      const l1 = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
      const l2 = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      l2.position.y = 0.06; g.add(l1, l2);
      const J = jag === undefined ? 0.7 : jag;
      const rej = function() { for (let i = 0; i < N; i++) { const f = i / (N - 1), e = (i === 0 || i === N - 1) ? 0 : 1; pos[i * 3] = x1 + (x2 - x1) * f + (Math.random() - 0.5) * J * e; pos[i * 3 + 1] = y1 + (y2 - y1) * f + (Math.random() - 0.5) * J * e; pos[i * 3 + 2] = z1 + (z2 - z1) * f + (Math.random() - 0.5) * J * e; } geo.attributes.position.needsUpdate = true; };
      rej();
      v5Flash(x2, y2, z2, hex, 2.2, 0.25);
      return v5Fx(g, life || 0.28, function(o, k) { if (Math.random() < 0.5) rej(); l1.material.opacity = 1 - k; l2.material.opacity = 0.8 * (1 - k); });
    }
    function v5Puff(x, y, z, vx, vy, vz, size, life, hex) {
      const m = new THREE.Mesh(G_SPH(0.5, 10), new THREE.MeshLambertMaterial({ color: hex || 0xffffff, transparent: true, opacity: 0.95 }));
      m.position.set(x, y, z);
      return v5Fx(m, life, function(o, k, dt) { o.position.x += vx * dt; o.position.y += vy * dt; o.position.z += vz * dt; vx *= 0.94; vz *= 0.94; vy *= 0.96; const s = size * (0.6 + 0.9 * Math.sqrt(k)); o.scale.setScalar(s); o.material.opacity = 0.95 * (1 - k * k); });
    }
    function v5Chunk(x, y, z, hex, sp) {
      const m = new THREE.Mesh(G_BOX(0.22, 0.12, 0.22), v5m(hex, { r: 0.6 }));
      m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2, v = sp * (0.5 + Math.random());
      let vx = Math.cos(a) * v, vz = Math.sin(a) * v, vy = 6 + Math.random() * 7;
      const rs = (Math.random() - 0.5) * 18;
      return v5Fx(m, 1.1 + Math.random() * 0.4, function(o, k, dt) { vy -= 24 * dt; o.position.x += vx * dt; o.position.y = Math.max(0.06, o.position.y + vy * dt); o.position.z += vz * dt; if (o.position.y <= 0.06) { vx *= 0.8; vz *= 0.8; vy = Math.abs(vy) * 0.3; } o.rotation.x += rs * dt; o.rotation.z += rs * dt * 0.7; if (k > 0.75) o.scale.setScalar(1 - (k - 0.75) * 4); });
    }
    function v5Meteor(x, z, hex, R, onHit, big) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(G_SPH(0.55, 14), v5m(0xfff7d6, { basic: true }));
      g.add(core, b13Sprite(hex, big ? 5 : 3.2, 1));
      core.scale.setScalar(big ? 1.6 : 1);
      const sx = x + 7, sy = 26, sz = z + 4;
      g.position.set(sx, sy, sz);
      let trailT = 0;
      return v5Fx(g, 0.62, function(o, k, dt) {
        const e = k * k;
        o.position.set(sx + (x - sx) * e, sy + (0.6 - sy) * e, sz + (z - sz) * e);
        trailT -= dt; if (trailT <= 0) { trailT = 0.03; v5Flash(o.position.x, o.position.y, o.position.z, hex, big ? 2.6 : 1.8, 0.25); }
        if (k > 0.97 && !o.userData.hit) { o.userData.hit = true; v5Boom(x, z, R, hex, big); if (onHit) onHit(); }
      });
    }
    function v5Boom(x, z, R, hex, big) {
      v5Flash(x, 1.2, z, 0xffffff, R * 1.4, 0.25);
      v5Flash(x, 1.0, z, hex, R * 2.4, 0.45);
      v5Ring(x, z, R * 1.3, hex, 0.5);
      v5Disc(x, z, R, hex, 0.35, 0.45);
      for (let i = 0; i < (big ? 10 : 6); i++) { const a = (i / (big ? 10 : 6)) * Math.PI * 2; v5Puff(x, 0.6, z, Math.cos(a) * R * 1.6, 1.4, Math.sin(a) * R * 1.6, big ? 1.4 : 0.9, 0.6, 0x9ca3af); }
      if (typeof triggerScreenShake === 'function') triggerScreenShake(big ? 0.22 : 0.1, big ? 0.25 : 0.12, 0);
    }
    function v5Step(dt) {
      for (let i = b13LaterList.length - 1; i >= 0; i--) { const l = b13LaterList[i]; l.t -= dt; if (l.t <= 0) { b13LaterList.splice(i, 1); try { l.fn(); } catch (err) { /* fx only */ } } }
      for (let i = b13FxList.length - 1; i >= 0; i--) {
        const f = b13FxList[i];
        f.t += dt;
        const k = Math.min(1, f.t / f.life);
        try { f.upd(f.o, k, dt, f); } catch (err) { k === k; }
        if (f.t >= f.life) { G.scene.remove(f.o); v5Dispose(f.o); b13FxList.splice(i, 1); }
      }
    }

    // ---------------- damage helpers (owner context -> b13Pow, boss armor in damageMOAB) ----------------
    function v5Bloons() { return { X: (typeof bloonX !== 'undefined' ? bloonX : G.bloonX), Z: (typeof bloonZ !== 'undefined' ? bloonZ : G.bloonZ), A: (typeof bloonActive !== 'undefined' ? bloonActive : G.bloonActive), HP: (typeof bloonHP !== 'undefined' ? bloonHP : G.bloonHP), F: (typeof bloonFreezeTimer !== 'undefined' ? bloonFreezeTimer : G.bloonFreezeTimer) }; }
    function v5Query(x, z, R) {
      if (typeof spatialGrid === 'undefined' || typeof queryBuffer === 'undefined') return [];
      spatialGrid.queryRadius(x, z, R, queryBuffer);
      const out = [];
      for (let q = 0; q < queryBuffer.length; q++) out.push(queryBuffer[q]);
      return out;
    }
    function v5Hit(owner, x, z, R, bd, md, opt) {
      opt = opt || {};
      const B = v5Bloons();
      const prev = window.__B13_CTX; window.__B13_CTX = owner;
      try {
        if (bd > 0 && typeof damageBloon === 'function' && B.A) {
          const list = v5Query(x, z, R);
          for (let q = 0; q < list.length; q++) {
            const bi = list[q];
            if (B.A[bi] !== 1) continue;
            const dx = B.X[bi] - x, dz = B.Z[bi] - z, d = Math.hypot(dx, dz) || 1;
            if (d > R) continue;
            if (opt.freeze && B.F) B.F[bi] = Math.max(B.F[bi] || 0, opt.freeze);
            if (opt.pull) { B.X[bi] -= dx * opt.pull; B.Z[bi] -= dz * opt.pull; }
            damageBloon(bi, bd, true, false, dx / d, dz / d, opt.kb === undefined ? 1.2 : opt.kb, false);
          }
        }
        const M = G.activeMOABs;
        if (md > 0 && M && typeof damageMOAB === 'function') {
          for (let k = M.length - 1; k >= 0; k--) {
            const mb = M[k];
            if (!mb || Math.hypot(mb.x - x, mb.z - z) > R + 2.5) continue;
            if (opt.stun) mb.stunTimer = Math.max(mb.stunTimer || 0, opt.stun);
            damageMOAB(k, md, true);
          }
        }
      } finally { window.__B13_CTX = prev || null; }
    }
    function v5Targets(x, z, R, n) {
      const out = [], M = G.activeMOABs || [];
      for (let k = 0; k < M.length && out.length < n; k++) { const mb = M[k]; if (Math.hypot(mb.x - x, mb.z - z) <= R + 4) out.push({ x: mb.x, z: mb.z, moab: true }); }
      if (out.length < n) {
        const B = v5Bloons();
        const list = v5Query(x, z, R).filter(function(bi) { return B.A && B.A[bi] === 1; });
        if (B.HP) list.sort(function(a, b) { return (B.HP[b] || 0) - (B.HP[a] || 0); });
        const step = Math.max(1, Math.floor(list.length / Math.max(1, n - out.length)));
        for (let q = 0; q < list.length && out.length < n; q += step) out.push({ x: B.X[list[q]], z: B.Z[list[q]], moab: false });
      }
      return out;
    }

    // ---------------- Paragon data ----------------
    const B13_PAR_THEME = {
      supermonkey: [0xffd23f, 0x38bdf8], super: [0xffd23f, 0x38bdf8], dart: [0xff4fd8, 0xf97316], boomer: [0xd946ef, 0x4ade80], tack: [0xff7a1a, 0xfacc15],
      sniper: [0xff2a2a, 0x65a30d], ninja: [0x4ade80, 0xef4444], wizard: [0xa855f7, 0x60a5fa], mortar: [0xf97316, 0xfacc15], ice: [0x7dd3fc, 0xffffff],
      dartling: [0xff1a1a, 0xa855f7], mermonkey: [0x2dd4bf, 0x60a5fa], beasthandler: [0xfacc15, 0x84cc16], desperado: [0xfacc15, 0xef4444], alchemist: [0xfacc15, 0xef4444],
      druid: [0x84cc16, 0xe879f9], quincy: [0x67e8f9, 0xfacc15], gwendolin: [0xff5a1f, 0xfacc15], obyn: [0x4ade80, 0x2dd4bf], sauda: [0xfde047, 0xef4444],
      benjamin: [0x22c55e, 0x22d3ee], silas: [0xbae6fd, 0x60a5fa], rosalia: [0xfacc15, 0x06b6d4], corvus: [0xc084fc, 0x22d3ee], geraldo: [0xfacc15, 0x60a5fa]
    };
    // [type, colour, size, paragon flag]
    const B13_PAR_SHOT = {
      supermonkey: ['eclipse', 0xffd23f, 1.15, 1], super: ['eclipse', 0xffd23f, 1.05, 1], dart: ['paraorb', 0xff4fd8, 1.5, 1], boomer: ['glaive', 0xd946ef, 1.8, 1],
      tack: ['flame', 0xff7a1a, 1.5, 1], sniper: ['bullet', 0xff2a2a, 1.5, 1], ninja: ['shuriken', 0x38bdf8, 1.7, 1], wizard: ['paraorb', 0xa855f7, 1.5, 1],
      mortar: ['bomb', 0x111827, 2.0, 1], ice: ['iceorb', 0xbae6fd, 1.7, 1], dartling: ['laser', 0xff1a1a, 2.8, 1], mermonkey: ['wave', 0x5eead4, 1.8, 1],
      beasthandler: ['darkblade', 0xfacc15, 1.6, 1], desperado: ['bullet', 0xfacc15, 1.5, 1], alchemist: ['potion', 0xfacc15, 1.6, 1], druid: ['paraorb', 0x84cc16, 1.4, 1],
      quincy: ['arrow', 0x67e8f9, 1.7, 1], gwendolin: ['flame', 0xff5a1f, 1.7, 1], obyn: ['spirit', 0x4ade80, 1.7, 1], sauda: ['darkblade', 0xfde047, 1.7, 1],
      benjamin: ['databit', 0x22d3ee, 1.6, 1], silas: ['iceshard', 0xe0f2fe, 1.8, 1], rosalia: ['laser', 0xfde047, 1.5, 1], corvus: ['spirit', 0xc084fc, 1.7, 1], geraldo: ['potion', 0xfacc15, 1.7, 1]
    };
    // Signature attack per Paragon (auto-cast)
    const B13_PAR_SIG = {
      supermonkey: { name: 'TOTAL ECLIPSE', kind: 'eclipse', cd: 15 }, super: { name: 'TOTAL ECLIPSE', kind: 'eclipse', cd: 17 },
      dart: { name: 'PLASMA JUGGERNAUTS', kind: 'volley', cd: 9, n: 14, shot: 'paraorb' }, boomer: { name: 'GLAIVE STORM', kind: 'volley', cd: 9, n: 12, shot: 'glaive' },
      tack: { name: 'CYCLONE OF FIRE AND METAL', kind: 'nova', cd: 9, R: 12 }, sniper: { name: 'ORBITAL MARK', kind: 'beams', cd: 10, n: 8, w: 0.7 },
      ninja: { name: 'SHADOW CLONE BARRAGE', kind: 'volley', cd: 8, n: 18, shot: 'shuriken' }, wizard: { name: 'ARCANE CATACLYSM', kind: 'chain', cd: 9, n: 10 },
      mortar: { name: 'DOOMSDAY SALVO', kind: 'meteors', cd: 11, n: 12 }, ice: { name: 'ETERNAL WINTER', kind: 'nova', cd: 11, R: 15, freeze: 2.6 },
      dartling: { name: 'OVERCLOCK MELTDOWN', kind: 'beams', cd: 10, n: 10, w: 0.9 }, mermonkey: { name: 'MAELSTROM REQUIEM', kind: 'nova', cd: 10, R: 13, pull: 0.35 },
      beasthandler: { name: 'EXTINCTION EVENT', kind: 'meteors', cd: 12, n: 3, big: true }, desperado: { name: 'HIGH NOON', kind: 'beams', cd: 10, n: 12, w: 0.5 },
      alchemist: { name: 'THE GREAT WORK', kind: 'nova', cd: 11, R: 14 }, druid: { name: 'WRATH OF NATURE', kind: 'chain', cd: 9, n: 12 },
      quincy: { name: 'STORM OF ARROWS', kind: 'chain', cd: 9, n: 10 }, gwendolin: { name: 'FIRESTORM', kind: 'meteors', cd: 10, n: 10 },
      obyn: { name: 'ANCIENT SPIRITS', kind: 'nova', cd: 10, R: 13 }, sauda: { name: 'THOUSAND BLADES', kind: 'volley', cd: 8, n: 16, shot: 'darkblade' },
      benjamin: { name: 'SYSTEM OVERRIDE', kind: 'beams', cd: 10, n: 9, w: 0.6 }, silas: { name: 'ABSOLUTE ZERO', kind: 'nova', cd: 11, R: 15, freeze: 2.8 },
      rosalia: { name: 'SKYFORGE STRIKE', kind: 'beams', cd: 10, n: 9, w: 0.7 }, corvus: { name: 'RAVEN STORM', kind: 'chain', cd: 9, n: 12 },
      geraldo: { name: 'GRAND CLEARANCE SALE', kind: 'meteors', cd: 11, n: 10 }
    };
    function v5UnitKey(owner) { if (owner === 'hero') { const h = G.gameState && G.gameState.hero; return h ? h.id : 'quincy'; } return owner; }
    function v5IsPar(owner) { const st = G.gameState; if (!st) return false; if (owner === 'hero') return !!(st.hero && st.hero.b13Paragon); return !!(st.squad && st.squad[owner] && st.squad[owner].paragon); }
    function b13ParLookFor(owner, look) {
      if (!owner || !b13V5Ready) return look;
      if (!v5IsPar(owner)) return look;
      return B13_PAR_SHOT[v5UnitKey(owner)] || look;
    }

    // ---------------- Paragon form (aura + signature props) ----------------
    function v5Orbit(ud, o, r, y, s, ph, bob, self) { ud.orbit.push({ o: o, r: r, y: y, s: s, ph: ph, bob: bob || 0, self: self || 0 }); }
    function v5Fan(g, hex, n, len, y, z, side, o) {
      o = o || {};
      const w = v5grp(g, side * 0.35, y, z, 0, side * 0.35, 0);
      for (let i = 0; i < n; i++) {
        const a = 0.2 + i * (1.2 / n);
        const p = v5mesh(w, o.geo || G_CONE(o.r || 0.16, len * (1 - i * 0.08), 4), v5m(hex, o.mat || { m: 0.4, r: 0.35, e: o.e || 0, ei: 0.7 }), side * Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5, 0, 0, 0, -side * (Math.PI / 2 - a));
        if (o.flat) p.scale.z = 0.3;
      }
      return w;
    }
    function v5Props(g, key, ud, H, c1, c2) {
      const top = H * 0.94, mid = H * 0.55;
      const gold = v5m(0xfacc15, { m: 0.6, r: 0.3, e: 0x5a3a00, ei: 0.5 });
      switch (key) {
        case 'dart': {
          const legM = v5m(0xe2521d, { m: 0.35, r: 0.4 }), jM = v5m(0x3b2f2f, { m: 0.5 });
          for (let i = 0; i < 4; i++) {
            const a = Math.PI / 4 + i * Math.PI / 2, lg = v5grp(g, 0, 0.9, 0, 0, -a, 0);
            v5mesh(lg, G_BOX(0.28, 0.28, 1.5), legM, 0, 0.45, 0.7, -0.6, 0, 0);
            v5mesh(lg, G_SPH(0.22, 10), jM, 0, 0.9, 1.35);
            v5mesh(lg, G_BOX(0.24, 1.3, 0.24), legM, 0, 0.2, 1.55, 0.25, 0, 0);
          }
          for (let i = 0; i < 3; i++) { const s = b13Sprite(c1, 0.9, 0.9); s.position.set(Math.cos(i * 2.1) * 1.3, mid, Math.sin(i * 2.1) * 1.3); g.add(s); ud.flick.push(s); }
          break;
        }
        case 'boomer': {
          v5mesh(g, G_CONE(1.05, 1.7, 14), v5m(0x9f1239, { r: 0.5 }), 0, top + 0.35, -0.1);
          v5mesh(g, G_TOR(0.95, 0.07, Math.PI * 2, 28), gold, 0, top - 0.42, -0.1, Math.PI / 2, 0, 0);
          v5mesh(g, G_SPH(0.32, 14), v5m(0x4ade80, { basic: true }), 0, mid, 0.85);
          for (let i = 0; i < 4; i++) {
            const gl = v5grp(g);
            v5mesh(gl, G_TOR(0.55, 0.11, Math.PI * 1.4, 20), v5m(0xd946ef, { m: 0.4, r: 0.3, e: 0x701a75, ei: 0.6 }), 0, 0, 0, Math.PI / 2, 0, 0);
            v5mesh(gl, G_SPH(0.14, 10), v5m(0x4ade80, { basic: true }), 0, 0, 0);
            v5Orbit(ud, gl, 2.3, mid, 1.6, i * Math.PI / 2, 0.15, 9);
          }
          break;
        }
        case 'tack': {
          const iron = v5m(0x374151, { m: 0.7, r: 0.35 });
          for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; v5mesh(g, G_CONE(0.16, 0.8, 6), iron, Math.cos(a) * 1.45, mid, Math.sin(a) * 1.45, 0, 0, 0).lookAt(Math.cos(a) * 9, mid, Math.sin(a) * 9); }
          const lot = v5grp(g, 0, 0.25, 0);
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const p = v5mesh(lot, G_CONE(0.45, 1.1, 4), gold, Math.cos(a) * 1.25, 0.3, Math.sin(a) * 1.25); p.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); p.scale.z = 0.35; }
          ud.spin.push({ o: lot, ax: 'y', s: 0.5 });
          for (let i = 0; i < 8; i++) { const s = b13Sprite(i % 2 ? 0xff7a1a : 0xfacc15, 1.3, 0.9); s.position.set(Math.cos(i * 0.8) * 1.2, mid + 0.6, Math.sin(i * 0.8) * 1.2); g.add(s); ud.flick.push(s); }
          break;
        }
        case 'sniper': {
          for (let i = 0; i < 2; i++) {
            const d = v5grp(g);
            v5mesh(d, G_BOX(0.6, 0.22, 0.6), v5m(0x4b5563, { m: 0.5 }), 0, 0, 0);
            [-1, 1].forEach(function(s) { v5mesh(d, G_CYL(0.28, 0.28, 0.02, 14), v5m(0xe2e8f0, { add: true, op: 0.45 }), s * 0.45, 0.15, 0); });
            v5mesh(d, G_SPH(0.08, 8), v5m(0xff2a2a, { basic: true }), 0, -0.1, 0.32);
            v5Orbit(ud, d, 1.9, top + 1.2, 1.1, i * Math.PI, 0.2, 0);
          }
          const back = v5grp(g, 0, mid, -0.6);
          for (let i = 0; i < 10; i++) v5mesh(back, G_CONE(0.2, 0.8, 5), v5m(i % 2 ? 0x4d7c0f : 0x65a30d, { r: 0.8 }), (Math.random() - 0.5) * 1.2, (Math.random() - 0.3) * 1.6, 0, 0.4, 0, (Math.random() - 0.5) * 1.2);
          break;
        }
        case 'ninja': {
          v5mesh(g, G_CONE(1.7, 0.75, 20), v5m(0xb0864a, { r: 0.8 }), 0, top + 0.35, 0);
          [-1, 1].forEach(function(s) { v5mesh(g, G_CONE(0.16, 0.7, 8), v5m(0xdc2626, { r: 0.4 }), s * 0.75, top + 0.75, 0.2, 0, 0, -s * 0.35); });
          for (let i = 0; i < 6; i++) { const s = b13Sprite(0x4ade80, 2.0, 0.35); s.position.set(Math.cos(i) * 1.1, 0.6 + (i % 3) * 0.5, Math.sin(i) * 1.1); g.add(s); ud.flick.push(s); }
          const orb = b13Sprite(0xef4444, 1.2, 1); orb.position.set(1.1, mid, 0.7); g.add(orb); ud.flick.push(orb);
          break;
        }
        case 'wizard': case 'corvus': {
          const col = key === 'wizard' ? 0x4c1d95 : 0x111827;
          [-1, 1].forEach(function(s) { v5Fan(g, col, 6, 2.6, mid + 0.4, -0.7, s, { geo: G_OCT(0.32), mat: { m: 0.3, r: 0.25, e: key === 'wizard' ? 0x3b0764 : 0x1e1b4b, ei: 0.8, flat: true } }).children.forEach(function(c) { c.scale.set(0.45, 2.2, 0.45); }); });
          for (let i = 0; i < 6; i++) { const s = b13Sprite(i % 2 ? c1 : c2, 0.5, 1); v5Orbit(ud, s, 1.8 + (i % 2) * 0.4, mid + (i % 3) * 0.6, 1.3 + i * 0.1, i, 0.3, 0); g.add(s); }
          if (key === 'corvus') for (let i = 0; i < 4; i++) { const r = v5grp(g); v5mesh(r, G_CONE(0.18, 0.6, 4), v5m(0x0f172a), 0, 0, 0, Math.PI / 2, 0, 0); [-1, 1].forEach(function(s) { v5mesh(r, G_BOX(0.6, 0.04, 0.2), v5m(0x1e1b4b), s * 0.32, 0, 0, 0, 0, s * 0.3); }); v5Orbit(ud, r, 2.4, top + 0.6, 1.4, i * 1.57, 0.4, 0); }
          break;
        }
        case 'mortar': {
          const bar = v5m(0x1f2937, { m: 0.6, r: 0.35 }), hot = v5m(0xf97316, { e: 0xea580c, ei: 1.2, r: 0.3 });
          [-1, 0, 1].forEach(function(s) { const b = v5grp(g, s * 0.75, mid, -1.0, -0.75, 0, -s * 0.2); v5mesh(b, G_CYL(s === 0 ? 0.42 : 0.3, s === 0 ? 0.48 : 0.34, 2.4, 14), s === 1 ? hot : bar, 0, 0.8, 0); v5mesh(b, G_TOR(s === 0 ? 0.45 : 0.33, 0.06, Math.PI * 2, 18), gold, 0, 1.9, 0, Math.PI / 2, 0, 0); });
          v5mesh(g, G_TOR(1.5, 0.18, Math.PI * 2, 32), v5m(0x334155, { m: 0.6 }), 0, 0.3, 0, Math.PI / 2, 0, 0);
          break;
        }
        case 'ice': case 'silas': {
          const im = v5m(0xbae6fd, { op: 0.75, r: 0.1, m: 0.2, e: 0x0c4a6e, ei: 0.5 });
          for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const c = v5mesh(g, G_OCT(0.4), im, Math.cos(a) * 1.9, 0.9, Math.sin(a) * 1.9, 0, a, (Math.random() - 0.5) * 0.4); c.scale.set(0.6, 2.6 + (i % 3) * 0.6, 0.6); }
          for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; v5mesh(g, G_CONE(0.13, 0.6, 5), im, Math.sin(a) * 0.6, top + 0.25, 0.1, 0, 0, -a * 0.6); }
          for (let i = 0; i < 6; i++) { const s = b13Sprite(0xffffff, 0.35, 1); v5Orbit(ud, s, 1.6, mid + (i % 3) * 0.6, 1.0, i, 0.3, 0); g.add(s); }
          break;
        }
        case 'mermonkey': {
          const tr = v5grp(g, 1.2, mid, 0.2, 0, 0, -0.2);
          v5mesh(tr, G_CYL(0.06, 0.06, 3.2, 8), gold, 0, 0, 0);
          [-0.25, 0, 0.25].forEach(function(x) { v5mesh(tr, G_CONE(0.09, 0.5, 6), v5m(0xe0f2fe, { m: 0.6, r: 0.2 }), x, 1.8, 0); });
          ud.spin.push({ o: tr, ax: 'y', s: 0.8 });
          for (let i = 0; i < 5; i++) { const n = v5grp(g); v5mesh(n, G_SPH(0.16, 10), v5m(i % 2 ? 0x5eead4 : 0x60a5fa, { basic: true }), 0, 0, 0, 0, 0, 0, 1.3, 1, 1); v5mesh(n, G_BOX(0.04, 0.5, 0.04), v5m(0xe0f2fe, { basic: true }), 0.18, 0.25, 0); v5Orbit(ud, n, 1.9, mid + 0.4, 1.2, i * 1.25, 0.35, 0); }
          const wr = v5mesh(g, G_TOR(1.9, 0.12, Math.PI * 2, 40), v5m(0x2dd4bf, { add: true, op: 0.55 }), 0, 0.35, 0, Math.PI / 2, 0, 0);
          ud.spin.push({ o: wr, ax: 'z', s: 1.2 });
          break;
        }
        case 'beasthandler': {
          const bird = v5grp(g);
          v5mesh(bird, G_SPH(0.45, 12), v5m(0x7c2d12, { r: 0.7 }), 0, 0, 0, 0, 0, 0, 0.9, 0.7, 1.4);
          v5mesh(bird, G_CONE(0.12, 0.4, 6), v5m(0xfacc15), 0, 0, 0.75, Math.PI / 2, 0, 0);
          const wings = [-1, 1].map(function(s) { return v5mesh(bird, G_BOX(1.4, 0.06, 0.5), v5m(0x9a3412, { r: 0.7 }), s * 0.8, 0.05, 0); });
          ud.flap = wings;
          v5Orbit(ud, bird, 2.6, top + 1.2, 0.9, 0, 0.3, 0);
          const fin = v5mesh(null, G_CONE(0.5, 1.2, 4), v5m(0x475569, { r: 0.5 }), 0, 0, 0);
          fin.scale.z = 0.3; g.add(fin);
          v5Orbit(ud, fin, 2.8, 0.45, -1.3, 1.5, 0, 0);
          break;
        }
        case 'desperado': {
          v5mesh(g, G_CYL(1.25, 1.25, 0.08, 24), gold, 0, top + 0.1, 0);
          v5mesh(g, G_CYL(0.55, 0.65, 0.6, 18), gold, 0, top + 0.45, 0);
          v5mesh(g, G_TOR(0.62, 0.06, Math.PI * 2, 18), v5m(0x7f1d1d), 0, top + 0.22, 0, Math.PI / 2, 0, 0);
          for (let i = 0; i < 2; i++) { const gun = v5grp(g); v5mesh(gun, G_BOX(0.18, 0.3, 0.7), gold, 0, 0, 0); v5mesh(gun, G_CYL(0.07, 0.07, 0.5, 8), v5m(0x9ca3af, { m: 0.8 }), 0, 0.05, 0.55, Math.PI / 2, 0, 0); const f = b13Sprite(0xff7a1a, 0.9, 1); f.position.set(0, 0.05, 0.9); gun.add(f); ud.flick.push(f); v5Orbit(ud, gun, 1.6, mid + 0.3, 1.5, i * Math.PI, 0.2, 0); }
          break;
        }
        case 'alchemist': case 'geraldo': {
          const cols = [0xef4444, 0x22c55e, 0xfacc15, 0xa855f7, 0x22d3ee, 0xf97316];
          for (let i = 0; i < 6; i++) { const f = v5grp(g); v5mesh(f, G_SPH(0.26, 12), v5m(cols[i], { op: 0.85, r: 0.1, e: cols[i], ei: 0.4 }), 0, 0, 0); v5mesh(f, G_CYL(0.08, 0.1, 0.25, 8), v5m(0xe0f2fe, { op: 0.6 }), 0, 0.3, 0); v5mesh(f, G_CYL(0.09, 0.09, 0.08, 8), v5m(0x92400e), 0, 0.45, 0); v5Orbit(ud, f, 1.7, mid + (i % 2) * 0.5, 1.1, i * 1.05, 0.25, 2); }
          if (key === 'alchemist') { const st = v5mesh(g, G_OCT(0.32), v5m(0xdc2626, { e: 0xdc2626, ei: 1.2 }), 0, mid, 0.75); ud.spin.push({ o: st, ax: 'y', s: 2 }); }
          else for (let i = 0; i < 6; i++) { const c = v5mesh(null, G_CYL(0.26, 0.26, 0.06, 16), gold, 0, 0, 0, Math.PI / 2, 0, 0); g.add(c); v5Orbit(ud, c, 2.3, top + 0.4, -0.9, i * 1.05, 0.2, 3); }
          break;
        }
        case 'druid': case 'obyn': {
          const ant = v5m(key === 'druid' ? 0xfacc15 : 0x92400e, { m: key === 'druid' ? 0.5 : 0, r: 0.4, e: key === 'druid' ? 0x5a3a00 : 0, ei: 0.5 });
          [-1, 1].forEach(function(s) { const a = v5grp(g, s * 0.45, top - 0.1, 0, 0, 0, -s * 0.5); v5mesh(a, G_CYL(0.06, 0.08, 1.1, 6), ant, 0, 0.5, 0); v5mesh(a, G_CYL(0.05, 0.05, 0.6, 6), ant, s * 0.2, 0.75, 0, 0, 0, -s * 0.9); v5mesh(a, G_CYL(0.05, 0.05, 0.5, 6), ant, -s * 0.12, 0.95, 0, 0, 0, s * 0.6); });
          if (key === 'druid') { const rb = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x3b82f6, 0xa855f7]; rb.forEach(function(c, i) { v5mesh(g, G_TOR(2.0 - i * 0.12, 0.06, Math.PI, 40), v5m(c, { add: true, op: 0.75 }), 0, 0.4, -0.9); }); for (let i = 0; i < 6; i++) { const t = v5mesh(g, G_CONE(0.2, 0.9, 5), v5m(0xa855f7, { e: 0x6b21a8, ei: 0.8 }), Math.cos(i) * 1.6, 0.4, Math.sin(i) * 1.6, (Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6); t.scale.set(1, 1, 1); } }
          for (let i = 0; i < 6; i++) { const lf = v5mesh(null, G_CONE(0.2, 0.5, 4), v5m(i % 2 ? 0x22c55e : 0x86efac, { ds: true }), 0, 0, 0, Math.PI / 2, 0, 0); lf.scale.z = 0.25; g.add(lf); v5Orbit(ud, lf, 1.8, mid + (i % 3) * 0.5, 1.2, i, 0.3, 4); }
          break;
        }
        case 'quincy': {
          for (let i = 0; i < 6; i++) v5mesh(g, G_SPH(0.6 + (i % 3) * 0.2, 12), v5m(0x6b7280, { r: 0.9, op: 0.92 }), Math.cos(i) * 0.8, top + 1.5 + (i % 2) * 0.2, Math.sin(i) * 0.6);
          for (let i = 0; i < 5; i++) { const a = v5mesh(null, G_CONE(0.12, 0.8, 6), v5m(0x67e8f9, { basic: true }), 0, 0, 0, Math.PI / 2, 0, 0); g.add(a); v5Orbit(ud, a, 1.8, mid + (i % 2) * 0.5, 1.6, i * 1.25, 0.2, 0); }
          ud.storm = true;
          break;
        }
        case 'gwendolin': {
          for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; v5mesh(g, G_CONE(0.15, 0.7, 6), v5m(0xff5a1f, { e: 0xea580c, ei: 1.1 }), Math.sin(a) * 0.7, top + 0.2, Math.cos(a) * 0.15, 0, 0, -a * 0.5); }
          for (let i = 0; i < 4; i++) { const f = v5grp(g); v5mesh(f, G_SPH(0.22, 10), v5m(0xfff7d6, { basic: true }), 0, 0, 0); f.add(b13Sprite(0xff5a1f, 1.3, 0.95)); v5Orbit(ud, f, 1.9, mid, 1.8, i * 1.57, 0.25, 0); }
          break;
        }
        case 'sauda': {
          for (let i = 0; i < 6; i++) { const s = v5grp(g); v5mesh(s, G_BOX(0.12, 1.4, 0.04), v5m(0xe5e7eb, { m: 0.9, r: 0.15 }), 0, 0.5, 0); v5mesh(s, G_BOX(0.5, 0.08, 0.1), gold, 0, -0.2, 0); v5mesh(s, G_BOX(0.08, 0.35, 0.08), v5m(0x7f1d1d), 0, -0.42, 0); v5Orbit(ud, s, 2.0, mid, 1.4, i * 1.05, 0.2, 0); }
          break;
        }
        case 'benjamin': {
          const scr = v5canvasTex(128, 96, function(c) { c.fillStyle = 'rgba(0,40,20,0.6)'; c.fillRect(0, 0, 128, 96); c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.strokeRect(3, 3, 122, 90); c.fillStyle = '#4ade80'; for (let i = 0; i < 7; i++) c.fillRect(10, 12 + i * 11, 20 + ((i * 37) % 80), 5); });
          for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(v5g('scr', function() { return new THREE.PlaneGeometry(1.4, 1.05); }), new THREE.MeshBasicMaterial({ map: scr, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); p.material.userData.keep = true; g.add(p); v5Orbit(ud, p, 2.0, mid + 0.5, 0.7, i * 2.09, 0.2, 0); ud.face.push(p); }
          for (let i = 0; i < 6; i++) { const c = v5mesh(null, G_BOX(0.25, 0.25, 0.25), v5m(0x22d3ee, { basic: true }), 0, 0, 0); g.add(c); v5Orbit(ud, c, 1.4, top + 0.3, -1.6, i, 0.3, 3); }
          break;
        }
        case 'rosalia': {
          [-1, 1].forEach(function(s) { v5Fan(g, 0xfacc15, 6, 2.4, mid + 0.4, -0.6, s, { geo: G_BOX(0.22, 1, 0.06), mat: { m: 0.7, r: 0.25 } }); });
          [-1, 1].forEach(function(s) { const j = b13Sprite(0x06b6d4, 1.2, 1); j.position.set(s * 0.4, mid - 0.4, -0.9); g.add(j); ud.flick.push(j); });
          break;
        }
        default: break;
      }
    }
    function b13ParagonForm(mesh, owner, on) {
      if (!mesh) return;
      let a = mesh.getObjectByName('b13_paragon_aura');
      const key = v5UnitKey(owner);
      if (a && a.userData.v5key !== key) { a.parent.remove(a); b13ParGroups.delete(a); a = null; }
      if (!on) { if (a) a.visible = false; return; }
      if (!a) {
        const th = B13_PAR_THEME[key] || [0xffd23f, 0xffffff];
        a = new THREE.Group();
        a.name = 'b13_paragon_aura';
        const ud = a.userData = { v5key: key, owner: owner, spin: [], orbit: [], flick: [], face: [], clock: Math.random() * 10, c1: th[0], c2: th[1] };
        const sig = v5mesh(a, G_DISC, v5AddMat(th[0], 0.85, V5_SIGIL), 0, 0.09, 0, 0, 0, 0, 2.6, 1, 2.6);
        sig.material.userData.keep = true;
        const sig2 = v5mesh(a, G_DISC, v5AddMat(th[1], 0.5, V5_SIGIL), 0, 0.1, 0, 0, 0, 0, 1.7, 1, 1.7);
        sig2.material.userData.keep = true;
        ud.spin.push({ o: sig, ax: 'y', s: 0.7 }, { o: sig2, ax: 'y', s: -1.3 });
        const pil = v5mesh(a, G_CYL(1.3, 1.6, 7, 24, true), new THREE.MeshBasicMaterial({ color: th[0], map: V5_PILLAR, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 3.5, 0);
        pil.material.userData.keep = true;
        ud.pillar = pil;
        ud.motes = [];
        for (let i = 0; i < 12; i++) { const s = b13Sprite(i % 3 ? th[0] : 0xffffff, 0.35, 1); a.add(s); ud.motes.push({ s: s, t: Math.random(), x: (Math.random() - 0.5) * 2.6, z: (Math.random() - 0.5) * 2.6 }); }
        const glow = b13Sprite(th[0], 4.5, 0.35); glow.position.y = 2.2; a.add(glow); ud.glow = glow;
        if (!(B13R.has6 && B13R.has6(key) && (B13_REAL_UNITS[key] || key === 'supermonkey'))) { let Hw = 4.4; try { const bf = b13BaseFrame(mesh); Hw = Math.max(2.4, Math.min(5.5, bf.H * (Math.abs(mesh.scale.y) || 1) / (window.B13_UNIT_SCALE || 1))); } catch (err) { Hw = 4.4; } ud.H = Hw; v5Props(a, key, ud, Hw, th[0], th[1]); }
        mesh.add(a);
        b13ParGroups.add(a);
      }
      a.visible = true;
    }
    function v5AnimParagons(dt) {
      b13ParGroups.forEach(function(a) {
        if (!a.parent) { b13ParGroups.delete(a); return; }
        if (!a.visible) return;
        const ud = a.userData, p = a.parent;
        const ps = Math.abs(p.scale.y) || 1;
        a.scale.setScalar((window.B13_UNIT_SCALE || 1) / ps);
        ud.clock += dt;
        const t = ud.clock;
        for (let i = 0; i < ud.spin.length; i++) ud.spin[i].o.rotation[ud.spin[i].ax] += ud.spin[i].s * dt;
        for (let i = 0; i < ud.orbit.length; i++) { const o = ud.orbit[i], an = o.ph + t * o.s; o.o.position.set(Math.cos(an) * o.r, o.y + Math.sin(t * 2.2 + i) * o.bob, Math.sin(an) * o.r); if (o.self === 9) o.o.rotation.y += dt * 9; else if (o.self === 2) o.o.rotation.z = Math.sin(t * 3 + i) * 0.4; else if (o.self === 3) o.o.rotation.y += dt * 4; else if (o.self === 4) { o.o.rotation.y = -an; o.o.rotation.z = Math.sin(t * 4 + i) * 0.6; } else o.o.rotation.y = -an + (o.s > 0 ? Math.PI : 0); }
        for (let i = 0; i < ud.flick.length; i++) { const s = ud.flick[i], f = 0.75 + Math.random() * 0.5; s.scale.set(s.userData.b || (s.userData.b = s.scale.x), (s.userData.b || s.scale.x) * f * 1.15, 1); }
        for (let i = 0; i < ud.face.length; i++) ud.face[i].lookAt(p.position.x, ud.face[i].getWorldPosition(new THREE.Vector3()).y, p.position.z);
        if (ud.flap) ud.flap.forEach(function(w, i) { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 10) * 0.5; });
        if (ud.pillar) ud.pillar.material.opacity = 0.22 + 0.12 * Math.sin(t * 3);
        if (ud.glow) { const g = 4.2 + Math.sin(t * 2.5) * 0.5; ud.glow.scale.set(g, g, 1); }
        for (let i = 0; i < ud.motes.length; i++) { const m = ud.motes[i]; m.t += dt * 0.45; if (m.t > 1) { m.t = 0; m.x = (Math.random() - 0.5) * 2.8; m.z = (Math.random() - 0.5) * 2.8; } m.s.position.set(m.x, 0.2 + m.t * 5.5, m.z); m.s.material.opacity = Math.sin(m.t * Math.PI); }
        if (ud.storm && Math.random() < dt * 1.5) { const wp = p.position; v5Bolt(wp.x, 5.8, wp.z, wp.x + (Math.random() - 0.5) * 3, 3.6, wp.z + (Math.random() - 0.5) * 3, 0x67e8f9, 0.15, 0.5); }
      });
    }

    // ---------------- Paragon signature attacks ----------------
    function v5OwnerPos(owner) {
      if (owner === 'hero') { const h = G.gameState.hero; return { x: h.x, z: h.z }; }
      const m = G.squadMeshes && G.squadMeshes[owner];
      return m ? { x: m.position.x, z: m.position.z } : null;
    }
    function v5Cast(owner) {
      const key = v5UnitKey(owner), sig = B13_PAR_SIG[key];
      if (!sig) return false;
      const P0 = v5OwnerPos(owner);
      if (!P0) return false;
      const th = B13_PAR_THEME[key] || [0xffd23f, 0xffffff];
      const R = 26;
      const tg = v5Targets(P0.x, P0.z, R, sig.n || 8);
      if (!tg.length) return false;
      if (typeof spawnFloatingText === 'function') spawnFloatingText(P0.x, 4.6, P0.z, '★ ' + sig.name + '!', 'crit');
      if (G.soundFX && G.soundFX.playExplosion) G.soundFX.playExplosion(1.2);
      v5Ring(P0.x, P0.z, 5, th[0], 0.45);
      v5Flash(P0.x, 2.4, P0.z, th[0], 6, 0.4);
      if (sig.kind === 'eclipse') v5Eclipse(owner, P0, th);
      else if (sig.kind === 'beams') tg.forEach(function(t, i) { v5Later(i * 0.08, function() { v5Beam(t.x, t.z, th[0], sig.w || 0.7, 0.55); v5Hit(owner, t.x, t.z, 2.6, 6, 45, { stun: 0.4 }); }); });
      else if (sig.kind === 'meteors') tg.forEach(function(t, i) { v5Later(i * 0.12, function() { v5Meteor(t.x, t.z, th[0], sig.big ? 5 : 3.2, function() { v5Hit(owner, t.x, t.z, sig.big ? 5.2 : 3.4, sig.big ? 16 : 6, sig.big ? 140 : 45, { stun: sig.big ? 1.2 : 0.3, kb: 2.5 }); }, sig.big); }); });
      else if (sig.kind === 'chain') {
        let px = P0.x, pz = P0.z, py = 3.0;
        tg.forEach(function(t, i) { const sx = px, sz = pz, sy = py; v5Later(i * 0.06, function() { v5Bolt(sx, sy, sz, t.x, 1.6, t.z, th[0], 0.3, 1.0); v5Hit(owner, t.x, t.z, 2.4, 5, 38, { stun: 0.2 }); }); px = t.x; pz = t.z; py = 1.6; });
      } else if (sig.kind === 'nova') {
        const Rn = sig.R || 13;
        v5Ring(P0.x, P0.z, Rn, th[0], 0.6); v5Later(0.12, function() { v5Ring(P0.x, P0.z, Rn * 0.8, th[1], 0.55); });
        v5Disc(P0.x, P0.z, Rn, th[0], 0.5, 0.35);
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; v5Puff(P0.x, 0.7, P0.z, Math.cos(a) * Rn * 1.4, 0.6, Math.sin(a) * Rn * 1.4, 1.0, 0.65, sig.freeze ? 0xe0f2fe : (key === 'tack' ? 0xfb923c : 0xffffff)); }
        v5Later(0.15, function() { v5Hit(owner, P0.x, P0.z, Rn, 6, 40, { freeze: sig.freeze, pull: sig.pull, stun: sig.freeze ? 1.5 : 0.4, kb: sig.pull ? 0 : 2.4 }); });
      } else if (sig.kind === 'volley' && typeof spawnProjectile === 'function') {
        const n = sig.n || 12, prev = window.__B13_CTX;
        window.__B13_CTX = owner;
        try {
          for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2, sp = 26;
            spawnProjectile({ x: P0.x, z: P0.z, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, life: 1.3, pierce: 10, damage: 2.4, scale: 1.4, colorHex: th[0], canPopLead: true, explosive: false, isEnergy: false, _b13owner: owner === 'hero' ? undefined : owner });
          }
        } finally { window.__B13_CTX = prev || null; }
      }
      return true;
    }
    function v5Eclipse(owner, P0, th) {
      let ov = document.getElementById('b13-eclipse');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'b13-eclipse';
        ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;opacity:0;transition:opacity .35s;background:radial-gradient(circle at 50% 12%, rgba(255,214,90,0.0) 0, rgba(255,214,90,0.0) 70px, rgba(255,200,60,0.55) 78px, rgba(8,8,26,0.55) 96px, rgba(4,4,16,0.72) 100%)';
        const disc = document.createElement('div');
        disc.style.cssText = 'position:absolute;left:50%;top:12%;width:140px;height:140px;margin:-70px 0 0 -70px;border-radius:50%;background:#05060d;box-shadow:0 0 40px 18px rgba(255,210,80,.75), inset 0 0 18px rgba(56,189,248,.6)';
        ov.appendChild(disc);
        document.body.appendChild(ov);
      }
      ov.style.opacity = '1';
      v5Later(2.6, function() { ov.style.opacity = '0'; });
      const tg = v5Targets(P0.x, P0.z, 30, 12);
      tg.forEach(function(t, i) { v5Later(0.35 + i * 0.12, function() { v5Beam(t.x, t.z, i % 2 ? th[1] : th[0], t.moab ? 1.3 : 0.8, 0.65); v5Hit(owner, t.x, t.z, 3.0, 8, 60, { stun: 0.6 }); }); });
      v5Later(2.1, function() {
        const p = v5OwnerPos(owner) || P0;
        v5Ring(p.x, p.z, 18, 0x0b1020, 0.7, 0.14, 0.9); v5Ring(p.x, p.z, 16, th[1], 0.65); v5Ring(p.x, p.z, 13, th[0], 0.55);
        v5Disc(p.x, p.z, 16, 0x1e1b4b, 0.6, 0.5);
        if (typeof triggerScreenShake === 'function') triggerScreenShake(0.3, 0.35, 0);
        v5Hit(owner, p.x, p.z, 17, 7, 50, { kb: 3 });
      });
    }
    function v5ParagonStep(dt) {
      const st = G.gameState;
      if (!st || !st.hero) return;
      const units = [];
      if (st.hero.b13Paragon) units.push('hero');
      if (st.squad) for (const k in st.squad) if (st.squad[k] && st.squad[k].paragon && st.squad[k].level > 0) units.push(k);
      units.forEach(function(u) {
        const s = b13ParState[u] || (b13ParState[u] = { cd: 3 });
        s.cd -= dt;
        if (s.cd <= 0) { const sig = B13_PAR_SIG[v5UnitKey(u)]; s.cd = v5Cast(u) ? (sig ? sig.cd : 12) : 1.0; }
      });
      // orbiting parts nick bloons they pass through
      b13ParGroups.forEach(function(a) {
        if (!a.visible || !a.parent || !a.userData.orbit.length) return;
        const ud = a.userData;
        ud.hitT = (ud.hitT || 0) - dt;
        if (ud.hitT > 0) return;
        ud.hitT = 0.3;
        const px = a.parent.position.x, pz = a.parent.position.z;
        for (let i = 0; i < ud.orbit.length; i++) { const o = ud.orbit[i]; if (o.y > 3.4) continue; const an = o.ph + ud.clock * o.s; v5Hit(ud.owner, px + Math.cos(an) * o.r, pz + Math.sin(an) * o.r, 1.1, 1.2, 0, { kb: 0.6 }); }
      });
    }

    // ---------------- projectile trails + impact sparks ----------------
    const V5_TRAIL = { laser: [0.5, 0.05], plasma: [0.9, 0.03], sunbeam: [0.9, 0.04], flame: [1.0, 0.03], orb: [0.8, 0.04], spirit: [0.8, 0.04], iceorb: [0.8, 0.05], potion: [0.6, 0.06], wave: [0.8, 0.05], databit: [0.5, 0.05], darkblade: [0.7, 0.05], glaive: [0.7, 0.05], sunorb: [2.2, 0.025], gplasma: [1.1, 0.03], rplasma: [1.2, 0.025], eclipse: [1.2, 0.025], paraorb: [1.4, 0.025], rocket: [0.8, 0.03], bomb: [0.5, 0.06] };
    var b13TrailT = new Float32Array(B13_PROJ_MAX);
    const v5Pool = [];
    for (let i = 0; i < 220; i++) { const s = b13Sprite(0xffffff, 0.5, 0); s.visible = false; G.scene.add(s); v5Pool.push({ s: s, t: 0, life: 0.2, size: 0.5, vx: 0, vy: 0, vz: 0 }); }
    let v5Cur = 0;
    function v5Spark(x, y, z, hex, size, life, vx, vy, vz) {
      const p = v5Pool[v5Cur]; v5Cur = (v5Cur + 1) % v5Pool.length;
      p.s.position.set(x, y, z); p.s.material.color.setHex(hex); p.s.visible = true; p.s.material.opacity = 1;
      p.t = 0; p.life = life; p.size = size; p.vx = vx || 0; p.vy = vy || 0; p.vz = vz || 0;
    }
    function b13Trail(i, x, y, z, t, sc, dt) {
      const spec = V5_TRAIL[t.name];
      const par = b13ShotPar[i];
      if (!spec && !par) return;
      b13TrailT[i] -= dt;
      if (b13TrailT[i] > 0) return;
      b13TrailT[i] = spec ? spec[1] : 0.04;
      const col = shotColor[i] || 0xffffff;
      const sz = (spec ? spec[0] : 0.6) * Math.max(0.6, sc * 0.55);
      v5Spark(x, y, z, col, sz, 0.22);
      if (t.name === 'rplasma' || t.name === 'sunorb' || t.name === 'eclipse' || t.name === 'gplasma') { if (Math.random() < 0.6) { const a = Math.random() * Math.PI * 2, r = sz * 0.45; v5Spark(x + Math.cos(a) * r, y + (Math.random() - 0.5) * r, z + Math.sin(a) * r, t.name === 'rplasma' ? 0xffffff : (t.name === 'gplasma' ? 0xd9f99d : 0xfff7d6), sz * 0.35, 0.1); } }
      if (par && Math.random() < 0.7) v5Spark(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6, 0xffe680, 0.3, 0.35, 0, 0.8, 0);
    }
    function b13ImpactSparks(x, z, hex, t, i) {
      const big = t && (t.name === 'sunorb' || t.name === 'eclipse' || t.name === 'rplasma' || t.name === 'paraorb' || t.name === 'gplasma') || b13ShotPar[i];
      const n = big ? 6 : 3;
      for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, v = (big ? 7 : 4.5) * (0.6 + Math.random() * 0.6); v5Spark(x, B13_SHOT_Y, z, k % 2 ? 0xffffff : (hex || 0xffffff), big ? 0.45 : 0.3, 0.22, Math.cos(a) * v, 1.5 + Math.random() * 2, Math.sin(a) * v); }
      if (big) v5Ring(x, z, 2.2, hex || 0xffffff, 0.25, 1.0, 0.7);
    }
    function v5PoolStep(dt) {
      for (let i = 0; i < v5Pool.length; i++) {
        const p = v5Pool[i];
        if (!p.s.visible) continue;
        p.t += dt;
        const k = p.t / p.life;
        if (k >= 1) { p.s.visible = false; continue; }
        if (p.vx || p.vy || p.vz) { p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt; p.vy -= 9 * dt; }
        const s = p.size * (1 - k * 0.6);
        p.s.scale.set(s, s, 1);
        p.s.material.opacity = 1 - k;
      }
    }
    function b13V5Nova(x, z, R, red) {
      if (!b13V5Ready) return;
      const c = red ? 0xff3b1f : 0x4ade80;
      v5Ring(x, z, R * 1.15, c, 0.5); v5Ring(x, z, R * 0.8, 0xffffff, 0.35, 0.15, 0.7); v5Disc(x, z, R, c, 0.35, 0.3);
      if (red) for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + Math.random() * 0.4; v5Bolt(x, 1.6, z, x + Math.cos(a) * R, 0.6 + Math.random() * 2, z + Math.sin(a) * R, 0xff3b1f, 0.3, 1.4); }
      else for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; v5Spark(x, 1.6, z, 0x86efac, 0.9, 0.4, Math.cos(a) * R * 2, 0.5, Math.sin(a) * R * 2); }
    }

    // ---------------- Bloons-style blimp entrance ----------------
    const V5_ENT_COL = { MOAB: 0x38bdf8, BFB: 0xef4444, ZOMG: 0x84cc16, DDT: 0x94a3b8, BAD: 0xa855f7, BLOONARIUS: 0x84cc16, LYCH: 0xa855f7, VORTEX: 0x38bdf8, DREADBLOON: 0xfacc15, PHAYZE: 0x22d3ee, BLASTAPOPOULOS: 0xf97316, TERRACOTTA: 0x14b8a6 };
    function v5EntranceBegin(mb, h) {
      const key = String(mb.blimpKey || 'MOAB').toUpperCase().replace('FORTIFIED_', '');
      const boss = B13_BOSS_SET.has(key);
      const ang = Math.atan2(mb.z - h.z, mb.x - h.x);
      const rad = boss ? 13 : 12;
      mb.x = h.x + Math.cos(ang) * rad; mb.z = h.z + Math.sin(ang) * rad;
      const R = boss ? 6.2 : (key === 'MOAB' || key === 'DDT' ? 3.6 : 4.8);
      const decal = new THREE.Mesh(G_DISC, new THREE.MeshBasicMaterial({ map: V5_HAZARD, transparent: true, opacity: 0, depthWrite: false }));
      decal.position.set(mb.x, 0.11, mb.z); decal.scale.set(R, 1, R);
      const shadow = new THREE.Mesh(G_DISC, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
      shadow.position.set(mb.x, 0.12, mb.z);
      G.scene.add(decal, shadow);
      const E = { mb: mb, key: key, boss: boss, t: 0, warn: boss ? 1.8 : 0.9, drop: boss ? 0.62 : 0.45, settle: 0.5, R: R, x: mb.x, z: mb.z, decal: decal, shadow: shadow, col: V5_ENT_COL[key] || 0xffffff, landed: false };
      E.dur = E.warn + E.drop + E.settle;
      mb._b13Ent = E;
      mb._entranceTimer = 99; mb._entranceDuration = 1.15; mb._landShockTriggered = true;
      b13Entrances.push(E);
      if (boss) v5Flash(mb.x, 0.5, mb.z, E.col, 4, 0.5);
    }
    function v5EntranceStep(dt) {
      const st = G.gameState, h = st && st.hero;
      if (!h) return;
      const M = G.activeMOABs || [];
      for (let i = 0; i < M.length; i++) {
        const mb = M[i];
        if (mb._b13Ent || mb._b13EntSkip) continue;
        if (mb._b13IsChild || window.__IN_DEV_SHOWCASE) { mb._b13EntSkip = true; continue; }
        if (mb._entranceTimer === undefined && !mb._bossEntranceInitialized) continue;
        if (mb._entranceTimer >= 98 && !mb._b13Ent && mb._bossEntranceInitialized && mb._b13IsChild) { mb._b13EntSkip = true; continue; }
        v5EntranceBegin(mb, h);
      }
      for (let i = b13Entrances.length - 1; i >= 0; i--) {
        const E = b13Entrances[i], mb = E.mb;
        E.t += dt;
        const alive = M.indexOf(mb) !== -1;
        const done = E.t >= E.dur || !alive;
        if (alive) { mb.x = E.x; mb.z = E.z; }
        const ms = mb.mesh, base = (ms && ms.userData && ms.userData.baseHierarchyScale) || 1.25;
        if (E.t < E.warn) {
          const k = E.t / E.warn;
          E.decal.material.opacity = Math.min(1, k * 3) * (0.75 + 0.25 * Math.sin(E.t * 18));
          E.decal.rotation.y += dt * 1.6;
          const ps = 1 + 0.06 * Math.sin(E.t * 12); E.decal.scale.set(E.R * ps, 1, E.R * ps);
          E.shadow.material.opacity = 0.15 + 0.2 * k; const ss = E.R * (0.35 + 0.35 * k); E.shadow.scale.set(ss, 1, ss);
          if (ms) { ms.visible = false; ms.position.y = 40; }
        } else if (E.t < E.warn + E.drop) {
          const k = (E.t - E.warn) / E.drop, e = k * k;
          if (ms) { ms.visible = true; ms.position.set(E.x, 30 * (1 - e), E.z); ms.scale.setScalar(base); }
          E.decal.material.opacity = 1; E.decal.rotation.y += dt * 4;
          E.shadow.material.opacity = 0.35 + 0.25 * k; const ss = E.R * (0.7 + 0.35 * k); E.shadow.scale.set(ss, 1, ss);
          if (Math.random() < 0.5 && ms) v5Spark(E.x + (Math.random() - 0.5) * 3, ms.position.y + 2 + Math.random() * 3, E.z + (Math.random() - 0.5) * 3, 0xffffff, 0.6, 0.18, 0, 14, 0);
        } else {
          if (!E.landed) { E.landed = true; v5EntranceLand(E); }
          const k = (E.t - E.warn - E.drop) / E.settle;
          const sq = Math.sin(Math.min(1, k) * Math.PI) * (1 - k) * 0.45;
          if (ms) { ms.position.y = 0; ms.scale.setScalar(base * (1 + sq * 0.3)); }
          E.decal.material.opacity = Math.max(0, 1 - k * 2.2);
          E.shadow.material.opacity = Math.max(0, 0.6 - k);
        }
        if (done) {
          G.scene.remove(E.decal, E.shadow); E.decal.material.dispose(); E.shadow.material.dispose();
          if (ms) { ms.visible = true; ms.position.y = 0; ms.scale.setScalar(base); }
          if (alive && !E.landed) v5EntranceLand(E);
          b13Entrances.splice(i, 1);
        }
      }
    }
    function v5EntranceLand(E) {
      const x = E.x, z = E.z, R = E.R;
      // BUILD 13.6: everything stays outside / under the hull so the blimp never looks like it vanished
      v5Ring(x, z, R * 2.4, 0xffffff, 0.5, 0.13, 0.85);
      v5Ring(x, z, R * 1.9, E.col, 0.55, 0.14, 0.8);
      const n = E.boss ? 18 : 12;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.random() * 0.2, v = R * (1.1 + Math.random() * 0.6); v5Puff(x + Math.cos(a) * R * 1.05, 0.35, z + Math.sin(a) * R * 1.05, Math.cos(a) * v, 0.5 + Math.random() * 0.8, Math.sin(a) * v, (E.boss ? 1.1 : 0.8) * (0.8 + Math.random() * 0.4), 0.65 + Math.random() * 0.25, i % 3 ? 0xffffff : 0xe5e7eb); }
      if (E.boss) {
        for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2; v5Chunk(x + Math.cos(a) * R * 0.9, 0.6, z + Math.sin(a) * R * 0.9, i % 3 ? E.col : 0xffffff, 6); }
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; v5Spark(x + Math.cos(a) * R * 1.1, 0.5, z + Math.sin(a) * R * 1.1, E.col, 0.9, 0.7, 0, 5 + Math.random() * 3, 0); }
        v5Later(0.1, function() { v5Ring(x, z, R * 3.0, E.col, 0.7, 0.13, 0.7); });
      }
      if (typeof triggerScreenShake === 'function') triggerScreenShake(E.boss ? 0.35 : 0.16, E.boss ? 0.4 : 0.2, 0);
      if (G.soundFX && G.soundFX.playExplosion) G.soundFX.playExplosion(E.boss ? 1.6 : 1.1);
      if (typeof spawnFloatingText === 'function' && E.boss) spawnFloatingText(x, 6, z, '⚠️ BOSS ARRIVED!', 'crit');
    }

    // ---------------- per-frame driver ----------------
    function b13V5Frame(dt) {
      if (!b13V5Ready) return;
      window.__b13Clock = (window.__b13Clock || 0) + dt;
      try { v5EntranceStep(dt); } catch (err) { /* entrance fx only */ }
      try { v5ParagonStep(dt); } catch (err) { /* paragon */ }
      v5AnimParagons(dt);
      v5Step(dt);
      v5PoolStep(dt);
    }
    window.__b13BossWaveTitle = function(w) {
      if (!(w >= 15 && w % 5 === 0)) return null;
      const idx = ((((w / 5) - 3) % B13_BOSS_ROTATION.length) + B13_BOSS_ROTATION.length) % B13_BOSS_ROTATION.length;
      const BT = G.BLIMP_TYPES || {}, k = B13_BOSS_ROTATION[idx];
      return '⚠️ BOSS: ' + ((BT[k] && BT[k].title) || k);
    };
    (function v5Prewarm() {
      try {
        const tmp = new THREE.Group();
        tmp.position.set(0, -400, 0);
        tmp.add(new THREE.Mesh(G_SPH(0.5, 10), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })));
        tmp.add(new THREE.Mesh(G_BOX(0.22, 0.12, 0.22), v5m(0xffffff, { r: 0.6 })));
        tmp.add(new THREE.Mesh(G_BEAM, v5AddMat(0xffffff, 0.5)));
        tmp.add(new THREE.Mesh(G_DISC, new THREE.MeshBasicMaterial({ map: V5_HAZARD, transparent: true, opacity: 0.5, depthWrite: false })));
        tmp.add(new THREE.Mesh(G_DISC, v5AddMat(0xffffff, 0.5, V5_SIGIL)));
        tmp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 1, 1)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending })));
        G.scene.add(tmp);
        if (G.renderer && G.renderer.compile && G.camera) G.renderer.compile(G.scene, G.camera);
        G.scene.remove(tmp);
      } catch (err) { /* prewarm is optional */ }
    })();
    G.__b13V5 = { cast: v5Cast, hit: v5Hit, ring: v5Ring, beam: v5Beam, fxCount: function() { return b13FxList.length; } };
    b13V5Ready = true;

    // ------------------------------------------------------------------------
    // F. MAIN SIMULATION LOOP HOOK
    // ------------------------------------------------------------------------
    const prevSim = G.updateSimulation;
    G.updateSimulation = function(dt) {
      const st = G.gameState;
      const h = st && st.hero;
      const b13DevPre = (window.__IN_DEV_SHOWCASE && h) ? [h.x, h.z] : null;

      if (window.__IN_DEV_SHOWCASE && h) {
        // Freeze the wave clock + natural spawner so Dev World never advances past W1
        st.waveTimer = 999999;
        st.elapsedTime = 0;
        st.spawnAccumulator = -1e9;
        st.firstMoabSpawned = false;
        st.finalBadSpawned = true;
        st.blimpSpawnTimer = 999999;
        h.invulnTimer = Math.max(h.invulnTimer || 0, 1.0);
        b13SyncDevBloons(h, false);
        if (G.activeMOABs && G.activeMOABs.length > 0) {
          G.activeMOABs.forEach(function(m) { if (m.mesh) G.scene.remove(m.mesh); });
          G.activeMOABs.length = 0;
        }
        if (G.squadMeshes) {
          Object.values(G.squadMeshes).forEach(function(m) { if (m) m.visible = false; });
        }
        h.fireCooldown = 999;
      }

      window.__b13Frame = (window.__b13Frame || 0) + 1;
      b13PowCache.clear();
      if (h && !st.paused && !st.gameOver && !st.inStartMenu && !window.__IN_DEV_SHOWCASE) { try { b13SuperMonkeyStats(h, dt); } catch (err) { /* stats only */ } }
      prevSim(dt);
      window.__B13_CTX = null;

      if (!h || st.paused || st.gameOver || st.inStartMenu) return;

      installB13UpgradeGating();
      installB13PathCards();
      updateAllHeroAndCompanionEvolutions();
      animateB13Crests(dt);
      animateB13Real(dt);
      sync3DProjectilesInFlight(dt);
      if (!window.__IN_DEV_SHOWCASE) b13V5Frame(dt);

      if (window.__IN_DEV_SHOWCASE) {
        window.__DEV_CLOCK = (window.__DEV_CLOCK || 0) + dt;
        const devClock = window.__DEV_CLOCK;
        // Keep only the pinned pedestal bloons (real in-game 2D bloons); wild wave bloons stay at zero
        if (G.bloonInstancedMesh) G.bloonInstancedMesh.visible = true;
        if (G.bloonOutlineInstancedMesh) G.bloonOutlineInstancedMesh.visible = true;
        b13SyncDevBloons(h, true);
        if (b13DevPre) {
          const mult = window.__B13_DEV_SPRINT ? 7 : 3;
          h.x = b13DevPre[0] + (h.x - b13DevPre[0]) * mult;
          h.z = b13DevPre[1] + (h.z - b13DevPre[1]) * mult;
        }
        if (window.__B13_DEV_GO) { const go = window.__B13_DEV_GO; window.__B13_DEV_GO = null; b13DevTravel(go, h); }
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
              qMesh.position.y = 1.35 + Math.sin(devClock * 3.5 + i * 0.7) * 0.08;
            }
          }
          if (ex.mesh && ex.kind === 'moab' && window.__DEV_SPIN_MODELS) {
            ex.mesh.rotation.y += dt * 0.65;
            if (ex.mesh.userData && ex.mesh.userData.propellers) {
              ex.mesh.userData.propellers.forEach(function(p) { p.rotation.z += dt * 16; });
            }
          }
          if (ex.mesh && ex.kind === 'moab' && ex.mesh.userData && typeof ex.mesh.userData.fx === 'function' && (!ex.holder || ex.holder.visible)) {
            ex.mesh.userData.fx(dt, devClock, Math.floor(devClock / 4) % 3);
          }
          if (ex.mesh && ex.kind === 'unit' && window.__DEV_SPIN_MODELS) {
            ex.mesh.rotation.y += dt * 0.5;
          }
          if (ex.holder) { const cdz = ex.z - h.z; ex.holder.visible = Math.abs(ex.x - h.x) < (ex.kind === 'moab' ? 44 : 30) && cdz > -36 && cdz < 14; }
          const d = Math.hypot(ex.x - h.x, ex.z - h.z);
          if (d < minDist) {
            minDist = d;
            closest = ex;
          }
        }

        const pathBtnEl = document.getElementById('btn-waila-path');
        if (pathBtnEl) pathBtnEl.style.display = (closest && closest.kind === 'unit' && closest.col && closest.col.multi) ? '' : 'none';
        if (window.__B13_DEV_PATH_REQ) {
          window.__B13_DEV_PATH_REQ = false;
          if (closest && closest.kind === 'unit' && closest.col && closest.col.multi) {
            closest.col.path = (closest.col.path + 1) % 3;
            b13RefreshColumn(closest.col);
            window.triggerHaptic(15);
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
          if (closest.kind === 'unit') {
            if (tEl) tEl.textContent = closest.name;
            if (cEl) cEl.textContent = closest.cat;
            if (sEl) sEl.textContent = 'Tier ' + closest.tier + ' / 5';
            if (lEl) lEl.textContent = '3D Gear: ' + closest.lore;
            if (hpEl) hpEl.textContent = '⭐ T' + closest.tier;
            if (spEl) spEl.textContent = '🧭 ' + closest.speed;
            if (imEl) imEl.textContent = (closest.col && closest.col.multi) ? '🔀 3 paths: press SWITCH PATH' : '🛠️ Sequential T1 → T5';
          } else {
            if (tEl) tEl.textContent = closest.name;
            if (cEl) cEl.textContent = closest.cat;
            if (sEl) sEl.textContent = '3D Scale: ' + closest.scaleTxt;
            if (lEl) lEl.textContent = 'Lore Size: ' + closest.lore + ' • Pop Spawns: ' + closest.children;
            if (hpEl) hpEl.textContent = '❤️ ' + closest.hp.toLocaleString() + ' HP';
            if (spEl) spEl.textContent = '⚡ ' + closest.speed + ' SPD';
            if (imEl) imEl.textContent = '🛡️ ' + closest.imm;
          }
        }
        return;
      }

      // Boss rotation: W15, W20, W25, W30, W35, W40, then every 5 waves in Freeplay (W45+)
      if (st.wave < b13LastBossWave) b13LastBossWave = 0;
      if (st.wave !== b13LastBossWave) {
        b13LastBossWave = st.wave;
        const bw = st.wave;
        if (bw >= 15 && bw % 5 === 0) {
          const idx = ((((bw / 5) - 3) % B13_BOSS_ROTATION.length) + B13_BOSS_ROTATION.length) % B13_BOSS_ROTATION.length;
          G.spawnAirshipBoss(B13_BOSS_ROTATION[idx]);
        }
      }

      let activeRiftBoss = null;
      if (G.activeMOABs && G.activeMOABs.length > 0) {
        for (let m = 0; m < G.activeMOABs.length; m++) {
          const mb = G.activeMOABs[m];
          if (!mb._b13Seen) b13OnBlimpSpawned(mb); // catches closure-internal spawns (wave timer, child blimps)
          b13AuthenticateBlimp(mb);
          if (mb._skullGates) b13UpdateSkullGates(mb, dt);

          if (mb.mesh) {
            const trueScale = (mb.mesh.userData && mb.mesh.userData.baseHierarchyScale) || 1.25;
            if (mb._entranceTimer !== undefined && mb._entranceTimer < (mb._entranceDuration || 1.15)) {
              activeRiftBoss = mb;
              const p = Math.min(1.0, mb._entranceTimer / (mb._entranceDuration || 1.15));
              mb.mesh.scale.setScalar(trueScale * Math.max(0.15, p));
            } else if (!mb._b13Ent || mb._b13Ent.t >= mb._b13Ent.dur) {
              mb.mesh.scale.setScalar(trueScale);
            }
            if (mb.mesh.userData && mb.mesh.userData.propellers) {
              mb.mesh.userData.propellers.forEach(function(p) { p.rotation.z += dt * 18.0; });
            }
            if (mb.mesh.userData && typeof mb.mesh.userData.fx === 'function') {
              mb.mesh.userData.fx(dt, st.elapsedTime, mb._skullShield > 0 ? 2 : ((mb.hp / Math.max(1, mb.maxHp)) < 0.5 ? 1 : 0));
            }
          }
        }
      }

      if (G.activeMOABs && G.activeMOABs.length > 1) G.activeMOABs.sort(b13BlimpPriority);
      syncBossBarSkulls();
      const bannerPrimary = G.activeMOABs && G.activeMOABs[0];
      if (bannerPrimary) {
        const tEl = document.getElementById('moab-boss-title');
        if (tEl && bannerPrimary.title && tEl.textContent !== bannerPrimary.title) tEl.textContent = bannerPrimary.title;
        const iEl = document.getElementById('moab-boss-icon');
        if (iEl && bannerPrimary.icon && iEl.textContent !== bannerPrimary.icon) iEl.textContent = bannerPrimary.icon;
        const hEl = document.getElementById('moab-boss-hp-text');
        if (hEl) hEl.textContent = Math.max(0, Math.ceil(bannerPrimary.hp)) + ' / ' + bannerPrimary.maxHp + ' HP';
        const bEl = document.getElementById('moab-boss-hp-bar');
        if (bEl) bEl.style.width = Math.max(0, Math.min(100, (bannerPrimary.hp / Math.max(1, bannerPrimary.maxHp)) * 100)) + '%';
      }

      if (activeRiftBoss) {
        bossRiftVFX.visible = false;
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

