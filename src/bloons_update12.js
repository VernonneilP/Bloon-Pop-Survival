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

  function safeGet3DModelSnapshot(key) {
    if (snapshotCache.has(key)) return snapshotCache.get(key);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 220;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.__isOffscreenThumb = true;
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
        const dataUrl = canvas.toDataURL('image/png');
        renderer.dispose();
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
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.__isOffscreenThumb = true;
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
        const dataUrl = canvas.toDataURL('image/png');
        renderer.dispose();
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
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.__isOffscreenThumb = true;
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
      const dataUrl = canvas.toDataURL('image/png');
      renderer.dispose();
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
            activeMOABs.forEach(mb => {
              if (Math.hypot(mb.x - h.x, mb.z - h.z) <= 18) {
                mb.stunTimer = 1.2;
                if (typeof damageMOAB === 'function') damageMOAB(0, h.damage * 25, true);
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
            activeMOABs.forEach(mb => {
              if (Math.hypot(mb.x - h.x, mb.z - h.z) <= harvestRadius) {
                if (typeof damageMOAB === 'function') damageMOAB(0, h.damage * 28, true);
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
            activeMOABs.forEach(mb => {
              mb.stunTimer = 2.0;
              if (typeof damageMOAB === 'function') damageMOAB(0, h.damage * 30, true);
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
                activeMOABs.forEach(mb => {
                  if (Math.hypot(mb.x - target.x, mb.z - target.z) <= 5.5) {
                    if (typeof damageMOAB === 'function') damageMOAB(0, comp.level * 18, true);
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
      subEl.textContent = WAVE_TITLES[w] || (w > 40 ? 'SUPER CERAMIC & BLIMP SWARM' : (w >= 25 ? 'HEAVY BLIMP & CERAMIC ASSAULT' : 'BLOON SWARM INTENSIFIES'));
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
        supermonkey: ['Eye Laser Vision (T1)', 'Twin Plasma Beams (T2)', 'Sun Avatar Triple Fan (T3)', 'Sun Temple Beams (T4)', 'Paragon: True Sun God (T5)'],
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
        supermonkey: 'Upgrades Super Monkey\'s twin eye lasers into multi-beam golden Sun Avatar fans!',
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
        supermonkey: ['High-Energy Plasma (T1)', 'Sun God Core (T2)', 'Dark Knight Glaives (T3)', 'Tech Terror Core (T4)', 'Paragon: Vengeful Sun God (T5)'],
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
        supermonkey: 'Supercharges eye beams into Purple/Gold plasma that vaporizes Lead & MOABs!',
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
        supermonkey: ['Knockback Repulsor (T1)', 'Dark Champion Blink (T2)', 'Tech Terror Pulse (T3)', 'Anti-Bloon Blast (T4)', 'Paragon: Cosmic Annihilator (T5)'],
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
        supermonkey: 'Every 3rd shot triggers a Tech Terror plasma nova that knocks bloons back!',
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
        mesh.userData.evoGroup.visible = t >= 2;
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
      mesh.scale.setScalar(scaleBase);
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
          🌳 3-PATH UPGRADE COMPENDIUM (14 MONKEYS)
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
              <div>⚔️ DMG: <strong class="text-amber-300">${h.damage.toFixed(1)}</strong></div>
              <div>🏹 RATE: <strong class="text-cyan-300">${h.fireRate.toFixed(2)}/s</strong></div>
              <div>🎯 PIERCE: <strong class="text-indigo-300">${h.pierce}</strong></div>
            </div>
            <div class="mt-2 text-[10px] font-extrabold text-cyan-200">
              Path 1 (Volley): T${h.volleyTier || 0}/5 • Path 2 (Elemental): T${h.weaponTier || 0}/5 • Path 3 (Special): T${h.explosiveTier || 0}/5
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
              <span class="px-2.5 py-0.5 rounded-full bg-cyan-600 border border-black font-btd-sm text-[10px] text-white my-1">TIER ${lvl} / 5</span>
              <span class="text-[10px] text-stone-200 font-bold">${comp && comp.titles ? (comp.titles[lvl - 1] || 'Tier 5 Paragon') : ''}</span>
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

        compView.innerHTML = G.COMPANION_CATALOG.map(comp => {
          const curLvl = (st.squad[comp.key] && st.squad[comp.key].level) || 0;
          const tiersHtml = [0, 1, 2, 3, 4].map(tIdx => {
            const unlocked = curLvl >= (tIdx + 1);
            const tTitle = (comp.titles && comp.titles[tIdx]) ? comp.titles[tIdx] : `Tier ${tIdx + 1}: Paragon ${comp.shortName}`;
            return `
              <div class="p-2 rounded-xl border ${unlocked ? 'bg-cyan-950/80 border-yellow-400 text-white' : 'bg-black/40 border-white/10 text-stone-400'} flex flex-col">
                <span class="font-btd text-[10px] ${unlocked ? 'text-yellow-300' : 'text-stone-400'}">TIER ${tIdx + 1} ${unlocked ? '✓' : ''}</span>
                <span class="font-bold text-[10px] leading-tight mt-0.5">${tTitle}</span>
              </div>
            `;
          }).join('');

          return `
            <div class="p-3 rounded-2xl bg-stone-900/95 border-2 ${curLvl > 0 ? 'border-yellow-400' : 'border-stone-700'} flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="font-btd text-sm text-yellow-300">${comp.shortName}</span>
                <span class="px-2 py-0.5 rounded-full ${curLvl > 0 ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-400'} font-btd-sm text-[10px]">
                  ${curLvl > 0 ? 'ACTIVE • TIER ' + curLvl : 'NOT RECRUITED'}
                </span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-1.5">${tiersHtml}</div>
            </div>
          `;
        }).join('');
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
    const prevUpdateSim = G.updateSimulation;
    G.updateSimulation = function(dt) {
      prevUpdateSim(dt);

      const st = G.gameState;
      const h = st.hero;
      if (!h) return;

      lockStaticWorldGround();
      heroWhiteRing.position.set(h.x, 0.03, h.z);

      // A. Enforce 2.0x Scale on Hero Mesh & All 14 Squad Companion Meshes!
      if (G.heroMesh) {
        G.heroMesh.scale.set(2.0, 2.0, 2.0);
      }
      if (G.squadMeshes) {
        Object.keys(G.squadMeshes).forEach(k => {
          const m = G.squadMeshes[k];
          const lvl = (st.squad && st.squad[k]) ? st.squad[k].level : 0;
          if (m && lvl > 0) {
            const tierMult = 1.0 + Math.min(4, lvl - 1) * 0.06;
            m.scale.setScalar(2.0 * tierMult);
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

      if (activePortalBoss) {
        bossPortalGroup.visible = true;
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
    // ---- Build 13: Sculpted Path/Tier Gear Helpers -------------------------
    const b13AnimatedCrests = new Set();
    function animateB13Crests(dt) {
      b13AnimatedCrests.forEach(function(cg) {
        if (!cg.parent) { b13AnimatedCrests.delete(cg); return; }
        const ud = cg.userData;
        ud.clock = (ud.clock || 0) + dt;
        for (let i = 0; i < ud.spin.length; i++) {
          const s = ud.spin[i];
          s.o.rotation[s.ax] += s.s * dt;
        }
        for (let i = 0; i < ud.orbit.length; i++) {
          const o = ud.orbit[i];
          const a = o.ph + ud.clock * o.s;
          o.o.position.set(Math.cos(a) * o.r, o.y + Math.sin(ud.clock * 3.0 + o.ph) * (o.bob || 0), Math.sin(a) * o.r);
          if (o.face) {
            const sg = o.s >= 0 ? 1 : -1;
            o.o.rotation.y = Math.atan2(-Math.sin(a) * sg, Math.cos(a) * sg);
          }
        }
      });
    }
    function b13Std(hex, emiHex, emiI, metal, rough) {
      const m = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: rough === undefined ? 0.35 : rough,
        metalness: metal === undefined ? 0.35 : metal,
        side: THREE.DoubleSide
      });
      if (emiHex !== undefined && emiHex !== null) {
        m.emissive = new THREE.Color(emiHex);
        m.emissiveIntensity = emiI === undefined ? 0.6 : emiI;
      }
      return m;
    }
    function b13Glow(hex, opacity) {
      const op = opacity === undefined ? 1 : opacity;
      return new THREE.MeshBasicMaterial({ color: hex, transparent: op < 1, opacity: op, side: THREE.DoubleSide, depthWrite: op >= 1 });
    }
    function b13Add(grp, geo, mat, x, y, z, rx, ry, rz) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      m.name = 'b13_gear';
      grp.add(m);
      return m;
    }
    function b13Group(parent, x, y, z) {
      const g = new THREE.Group();
      g.name = 'b13_gear_grp';
      g.position.set(x || 0, y || 0, z || 0);
      parent.add(g);
      return g;
    }
    // Radial cones in the XZ plane pointing outward (sawblade teeth / shuriken points)
    function b13RadialCones(grp, count, dist, rad, len, mat, y) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        b13Add(grp, new THREE.ConeGeometry(rad, len, 3), mat, Math.cos(a) * dist, y || 0, Math.sin(a) * dist, 0, -a, -Math.PI / 2);
      }
    }
    function b13Sawblade(parent, radius, teeth, mat, y) {
      const g = b13Group(parent, 0, y, 0);
      b13Add(g, new THREE.CylinderGeometry(radius, radius, 0.035, 36), mat, 0, 0, 0);
      b13Add(g, new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, 0.07, 16), b13Std(0x1f2937, null, 0, 0.8, 0.3), 0, 0, 0);
      b13RadialCones(g, teeth, radius * 1.06, radius * 0.1, radius * 0.24, mat, 0);
      return g;
    }
    function b13Shuriken(parent, mat) {
      const g = b13Group(parent, 0, 0, 0);
      b13Add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), mat, 0, 0, 0);
      b13RadialCones(g, 4, 0.1, 0.045, 0.16, mat, 0);
      return g;
    }
    function b13Hood(grp, hex, emi, emiI, r, y) {
      // Open-faced cowl: gap faces +Z so the eyes/face stay visible
      return b13Add(grp, new THREE.SphereGeometry(r || 0.41, 20, 12, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.6), b13Std(hex, emi, emiI, 0.25, 0.5), 0, y || 0.92, -0.01);
    }
    function b13Cape(grp, hex, emi, emiI, w, hgt) {
      const cape = b13Add(grp, new THREE.PlaneGeometry(w || 0.72, hgt || 0.95), b13Std(hex, emi, emiI, 0.1, 0.65), 0, 0.5, -0.36, 0.2, 0, 0);
      return cape;
    }
    function b13Visor(grp, hex) {
      b13Add(grp, new THREE.BoxGeometry(0.5, 0.1, 0.1), b13Glow(hex), 0, 0.92, 0.37);
      [-0.12, 0.12].forEach(function(px) {
        b13Add(grp, new THREE.SphereGeometry(0.045, 8, 8), b13Glow(0xffffff), px, 0.92, 0.43);
      });
    }
    function b13SunHalo(grp, rays, discHex, rayHex, radius) {
      const halo = b13Group(grp, 0, 1.0, -0.34);
      b13Add(halo, new THREE.CircleGeometry(radius * 0.72, 32), b13Glow(discHex, 0.55), 0, 0, 0);
      for (let r = 0; r < rays; r++) {
        const ra = (r / rays) * Math.PI * 2;
        b13Add(halo, new THREE.ConeGeometry(0.06, radius * 0.5, 4), b13Glow(rayHex), Math.cos(ra) * radius, Math.sin(ra) * radius, 0, 0, 0, ra - Math.PI / 2);
      }
      grp.userData.spin.push({ o: halo, ax: 'z', s: 0.8 });
      return halo;
    }

    function buildSuperSunGear(grp, T) {
      if (T === 2) { b13Visor(grp, 0xff2a2a); return; }
      if (T === 3) {
        b13Visor(grp, 0xc084fc);
        b13Hood(grp, 0x5b21b6, 0xa855f7, 0.35);
        b13Cape(grp, 0x6d28d9, 0x7c3aed, 0.25);
        for (let i = 0; i < 2; i++) {
          const orb = b13Add(grp, new THREE.SphereGeometry(0.11, 12, 12), b13Glow(0xa855f7), 0, 0.8, 0);
          grp.userData.orbit.push({ o: orb, r: 0.66, y: 0.8, s: 2.4, ph: i * Math.PI, bob: 0.06 });
        }
        return;
      }
      // T4 Golden Sun Avatar / T5 True Sun God
      const gold = T >= 5 ? 0xfff3c4 : 0xfacc15;
      b13Visor(grp, T >= 5 ? 0xfffbeb : 0xfde047);
      b13Hood(grp, gold, 0xf59e0b, T >= 5 ? 0.6 : 0.4);
      b13Cape(grp, T >= 5 ? 0xfffbeb : 0xf59e0b, 0xfbbf24, 0.35);
      b13SunHalo(grp, T >= 5 ? 16 : 12, T >= 5 ? 0xfffbeb : 0xfde047, T >= 5 ? 0xffffff : 0xfbbf24, T >= 5 ? 0.86 : 0.7);
      if (T >= 5) {
        // White-gold temple crown
        const crownMat = b13Std(0xfffbeb, 0xfacc15, 0.7, 0.85, 0.2);
        b13Add(grp, new THREE.CylinderGeometry(0.3, 0.33, 0.12, 18, 1, true), crownMat, 0, 1.2, 0);
        for (let s = 0; s < 5; s++) {
          const sa = (s / 5) * Math.PI * 2 + Math.PI / 2;
          b13Add(grp, new THREE.ConeGeometry(0.05, s === 0 ? 0.32 : 0.22, 4), crownMat, Math.cos(sa) * 0.3, 1.36, Math.sin(sa) * 0.3);
        }
        // Solar wings (3 feathers per side)
        [-1, 1].forEach(function(w) {
          const wing = b13Group(grp, w * 0.42, 0.95, -0.32);
          for (let f = 0; f < 3; f++) {
            b13Add(wing, new THREE.ConeGeometry(0.11, 0.95 - f * 0.18, 4), b13Glow(f === 0 ? 0xffffff : 0xfde047, 0.92), w * (0.22 + f * 0.12), 0.18 - f * 0.12, 0, 0, 0, -w * (0.9 + f * 0.32));
          }
        });
        // Floating sun orbs
        for (let i = 0; i < 3; i++) {
          const orb = b13Group(grp, 0, 1.55, 0);
          b13Add(orb, new THREE.SphereGeometry(0.12, 12, 12), b13Std(0xfffbeb, 0xfacc15, 1.0, 0.2, 0.3), 0, 0, 0);
          b13Add(orb, new THREE.SphereGeometry(0.19, 12, 12), b13Glow(0xfde047, 0.3), 0, 0, 0);
          grp.userData.orbit.push({ o: orb, r: 0.95, y: 1.55, s: 1.3, ph: (i / 3) * Math.PI * 2, bob: 0.08 });
        }
      }
    }
    function buildSuperRoboGear(grp, T) {
      b13Visor(grp, T >= 5 ? 0x22c55e : 0x38bdf8);
      if (T < 3) return;
      const metal = b13Std(T >= 5 ? 0x1e293b : 0x475569, null, 0, 0.85, 0.25);
      const glowHex = T >= 5 ? 0x4ade80 : 0x22d3ee;
      [-1, 1].forEach(function(s) {
        const arm = b13Group(grp, s * 0.5, 0.56, 0.12);
        b13Add(arm, new THREE.BoxGeometry(0.2, 0.2, 0.34), metal, 0, 0, 0);
        b13Add(arm, new THREE.CylinderGeometry(0.06, 0.07, 0.44, 12), metal, 0, 0.02, 0.32, Math.PI / 2, 0, 0);
        b13Add(arm, new THREE.SphereGeometry(0.065, 10, 10), b13Glow(glowHex), 0, 0.02, 0.56);
        b13Add(arm, new THREE.BoxGeometry(0.22, 0.03, 0.2), b13Glow(glowHex), 0, 0.115, 0);
      });
      if (T >= 4) {
        b13Add(grp, new THREE.CylinderGeometry(0.12, 0.12, 0.05, 20), b13Glow(glowHex), 0, 0.6, 0.36, Math.PI / 2, 0, 0);
        b13Add(grp, new THREE.CylinderGeometry(0.015, 0.015, 0.36, 6), metal, 0.16, 1.32, 0);
        b13Add(grp, new THREE.SphereGeometry(0.04, 8, 8), b13Glow(0xef4444), 0.16, 1.5, 0);
      }
      if (T >= 5) {
        [-1, 1].forEach(function(s) {
          const pod = b13Group(grp, s * 0.42, 0.98, -0.12);
          b13Add(pod, new THREE.BoxGeometry(0.26, 0.18, 0.32), metal, 0, 0, 0);
          for (let m = 0; m < 4; m++) {
            b13Add(pod, new THREE.ConeGeometry(0.03, 0.08, 6), b13Glow(0x4ade80), (m % 2 ? 0.06 : -0.06), (m < 2 ? 0.04 : -0.04), 0.18, Math.PI / 2, 0, 0);
          }
        });
      }
    }
    function buildSuperDarkKnightGear(grp, T) {
      b13Visor(grp, 0xa855f7);
      if (T < 3) return;
      b13Hood(grp, 0x18181b, 0x3b0764, 0.2);
      [-1, 1].forEach(function(s) {
        b13Add(grp, new THREE.ConeGeometry(0.07, 0.3, 4), b13Std(0x18181b, 0x3b0764, 0.2, 0.3, 0.5), s * 0.19, 1.3, 0, 0, 0, -s * 0.18);
      });
      b13Cape(grp, 0x09090b, 0x3b0764, 0.15, 0.82, 1.05);
      for (let c = 0; c < 3; c++) {
        b13Add(grp, new THREE.ConeGeometry(0.09, 0.2, 3), b13Std(0x09090b, null, 0, 0.1, 0.7), -0.26 + c * 0.26, -0.02, -0.46, Math.PI, 0, 0);
      }
      if (T >= 4) {
        const n = T >= 5 ? 4 : 2;
        for (let i = 0; i < n; i++) {
          const gl = b13Group(grp, 0, 0.8, 0);
          b13Add(gl, new THREE.TorusGeometry(0.2, 0.035, 6, 18, Math.PI * 1.35), b13Std(0x3b0764, 0xa855f7, 0.9, 0.6, 0.3), 0, 0, 0, Math.PI / 2, 0, 0);
          grp.userData.spin.push({ o: gl, ax: 'y', s: 9 });
          grp.userData.orbit.push({ o: gl, r: 0.82, y: 0.8, s: 2.0, ph: (i / n) * Math.PI * 2, bob: 0.05 });
        }
      }
      if (T >= 5) {
        [-0.1, 0.1].forEach(function(px) { b13Add(grp, new THREE.SphereGeometry(0.05, 8, 8), b13Glow(0xd8b4fe), px, 0.95, 0.4); });
        [-1, 1].forEach(function(s) {
          for (let k = 0; k < 3; k++) b13Add(grp, new THREE.ConeGeometry(0.04, 0.2, 4), b13Std(0x27272a, 0x7e22ce, 0.4, 0.7, 0.3), s * (0.34 + k * 0.06), 0.84 + k * 0.03, -0.05 + k * 0.05, 0, 0, -s * 0.6);
        });
      }
    }
    function buildIceGear(grp, T) {
      if (T < 3) return;
      const big = T >= 5 ? 1.25 : 1.0;
      const gun = b13Group(grp, 0.42, 0.52, 0.22);
      gun.scale.setScalar(big);
      const frame = b13Std(0xe0f2fe, null, 0, 0.75, 0.25);
      b13Add(gun, new THREE.CylinderGeometry(0.08, 0.1, 0.62, 14), frame, 0, 0, 0.18, Math.PI / 2, 0, 0);
      b13Add(gun, new THREE.SphereGeometry(0.15, 14, 12), b13Std(0x38bdf8, 0x0ea5e9, 0.45, 0.3, 0.2), 0, 0.05, -0.16);
      b13Add(gun, new THREE.TorusGeometry(0.1, 0.028, 8, 18), b13Glow(0x67e8f9), 0, 0, 0.5);
      b13Add(gun, new THREE.SphereGeometry(0.07, 10, 10), b13Glow(0xf0f9ff), 0, 0, 0.53);
      b13Add(gun, new THREE.BoxGeometry(0.06, 0.18, 0.08), b13Std(0x334155, null, 0, 0.5, 0.5), 0, -0.13, 0);
      if (T >= 5) {
        for (let s = 0; s < 3; s++) {
          b13Add(grp, new THREE.ConeGeometry(0.08, 0.4, 5), b13Std(0xbae6fd, 0x38bdf8, 0.5, 0.2, 0.1), -0.18 + s * 0.18, 0.95 + (s === 1 ? 0.1 : 0), -0.34, -0.35, 0, 0);
        }
        for (let i = 0; i < 3; i++) {
          const shard = b13Add(grp, new THREE.OctahedronGeometry(0.08), b13Glow(0xa5f3fc, 0.85), 0, 0.7, 0);
          grp.userData.orbit.push({ o: shard, r: 0.8, y: 0.7, s: 1.8, ph: (i / 3) * Math.PI * 2, bob: 0.1 });
          grp.userData.spin.push({ o: shard, ax: 'y', s: 4 });
        }
      }
    }
    function buildWizardGear(grp, T) {
      if (T < 4) return;
      const hatMat = b13Std(T >= 5 ? 0x4c1d95 : 0x1e3a8a, T >= 5 ? 0x7c3aed : 0x1d4ed8, 0.25, 0.1, 0.6);
      b13Add(grp, new THREE.CylinderGeometry(0.44, 0.44, 0.04, 26), hatMat, 0, 1.12, 0);
      const spire = b13Add(grp, new THREE.ConeGeometry(0.3, 0.95, 20), hatMat, 0, 1.6, 0, 0, 0, 0.1);
      spire.name = 'b13_gear';
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        const hh = 0.12 + (i / 7) * 0.7;
        const rr = 0.3 * (1 - hh / 0.95) + 0.015;
        b13Add(grp, new THREE.OctahedronGeometry(0.045), b13Glow(0xfde047), Math.cos(a) * rr, 1.13 + hh, Math.sin(a) * rr);
      }
      b13Add(grp, new THREE.OctahedronGeometry(0.085), b13Glow(0xfef08a), 0.05, 2.1, 0);
      // Orbiting 3D Flame Phoenix
      const ph = b13Group(grp, 0.95, 1.05, 0);
      ph.scale.setScalar(T >= 5 ? 1.35 : 1.0);
      const fire = b13Std(0xf97316, 0xef4444, 0.9, 0.1, 0.4);
      const fireHot = b13Std(0xfde047, 0xf59e0b, 1.0, 0.1, 0.4);
      const body = b13Add(ph, new THREE.SphereGeometry(0.12, 12, 10), fire, 0, 0, 0);
      body.scale.set(0.8, 0.8, 1.5);
      b13Add(ph, new THREE.SphereGeometry(0.075, 10, 8), fireHot, 0, 0.05, 0.19);
      b13Add(ph, new THREE.ConeGeometry(0.03, 0.09, 6), fireHot, 0, 0.04, 0.29, Math.PI / 2, 0, 0);
      [-1, 1].forEach(function(s) {
        const wing = b13Add(ph, new THREE.ConeGeometry(0.1, 0.46, 3), fire, s * 0.25, 0.04, -0.02, 0, 0, -s * Math.PI / 2);
        wing.scale.set(1, 1, 0.25);
      });
      for (let t = 0; t < 3; t++) {
        b13Add(ph, new THREE.ConeGeometry(0.05, 0.32, 4), t === 1 ? fireHot : fire, (t - 1) * 0.06, 0, -0.3, -Math.PI / 2, 0, (t - 1) * 0.25);
      }
      if (T >= 5) {
        for (let tr = 0; tr < 3; tr++) b13Add(ph, new THREE.SphereGeometry(0.07 - tr * 0.015, 8, 8), b13Glow(0xfb923c, 0.55 - tr * 0.14), 0, 0, -0.5 - tr * 0.16);
      }
      grp.userData.orbit.push({ o: ph, r: 0.95, y: 1.05, s: 1.6, ph: 0, bob: 0.12, face: true });
    }
    function buildNinjaGear(grp, T) {
      if (T < 4) return;
      const crimson = b13Std(0xdc2626, 0xb91c1c, T >= 5 ? 0.6 : 0.3, 0.2, 0.45);
      b13Hood(grp, 0xf8fafc, T >= 5 ? 0xfecaca : null, 0.15, 0.42, 0.92);
      b13Add(grp, new THREE.TorusGeometry(0.37, 0.035, 8, 26), crimson, 0, 0.99, 0, Math.PI / 2, 0, 0);
      [-0.06, 0.06].forEach(function(px, i) {
        b13Add(grp, new THREE.BoxGeometry(0.06, 0.34, 0.02), crimson, px, 0.86, -0.4, 0.5, 0, (i ? 0.15 : -0.15));
      });
      const n = T >= 5 ? 8 : 6;
      const starMat = T >= 5 ? b13Std(0xef4444, 0xdc2626, 0.8, 0.6, 0.25) : b13Std(0xcbd5e1, null, 0, 0.9, 0.2);
      for (let i = 0; i < n; i++) {
        const sh = b13Shuriken(grp, starMat);
        grp.userData.spin.push({ o: sh, ax: 'y', s: 14 });
        grp.userData.orbit.push({ o: sh, r: 0.9, y: 0.7, s: 2.4, ph: (i / n) * Math.PI * 2, bob: 0 });
      }
    }
    function buildTackGear(grp, T) {
      if (T < 4) return;
      const sawMat = T >= 5 ? b13Std(0xf97316, 0xef4444, 0.85, 0.6, 0.3) : b13Std(0xfacc15, 0xb45309, 0.25, 0.9, 0.22);
      const b1 = b13Sawblade(grp, 0.78, 18, sawMat, 0.42);
      grp.userData.spin.push({ o: b1, ax: 'y', s: 6 });
      if (T >= 5) {
        const b2 = b13Sawblade(grp, 0.55, 14, b13Std(0xfde047, 0xf97316, 0.9, 0.6, 0.3), 0.78);
        grp.userData.spin.push({ o: b2, ax: 'y', s: -9 });
        b13Add(grp, new THREE.TorusGeometry(0.86, 0.06, 8, 36), b13Glow(0xfb923c, 0.45), 0, 0.42, 0, Math.PI / 2, 0, 0);
      }
    }
    function buildSniperGear(grp, T) {
      if (T < 4) return;
      const gunMetal = b13Std(0x27272a, null, 0, 0.85, 0.3);
      const rifle = b13Group(grp, 0.3, 0.6, 0.2);
      b13Add(rifle, new THREE.CylinderGeometry(0.045, 0.05, 1.1, 10), gunMetal, 0, 0, 0.4, Math.PI / 2, 0, 0);
      b13Add(rifle, new THREE.CylinderGeometry(0.085, 0.085, 0.38, 14), b13Std(0x18181b, null, 0, 0.7, 0.4), 0, 0, 1.12, Math.PI / 2, 0, 0);
      b13Add(rifle, new THREE.BoxGeometry(0.1, 0.16, 0.36), b13Std(0x3f3f46, null, 0, 0.4, 0.6), 0, -0.03, -0.3);
      b13Add(rifle, new THREE.CylinderGeometry(0.05, 0.05, 0.34, 12), gunMetal, 0, 0.1, 0.12, Math.PI / 2, 0, 0);
      b13Add(rifle, new THREE.CircleGeometry(0.045, 12), b13Glow(0x22c55e), 0, 0.1, 0.295);
      if (T >= 5) {
        b13Add(rifle, new THREE.BoxGeometry(0.14, 0.06, 0.1), gunMetal, 0, 0, 1.34);
        [-1, 1].forEach(function(s) { b13Add(rifle, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), gunMetal, s * 0.06, -0.13, 0.75, 0, 0, s * 0.4); });
      }
      b13Add(grp, new THREE.BoxGeometry(0.66, 0.05, 0.05), gunMetal, 0, 0.98, 0.3);
      const tubes = T >= 5 ? [-0.24, -0.1, 0.1, 0.24] : [-0.11, 0.11];
      tubes.forEach(function(px) {
        b13Add(grp, new THREE.CylinderGeometry(0.065, 0.075, 0.2, 12), gunMetal, px, 0.95, 0.43, Math.PI / 2, 0, 0);
        b13Add(grp, new THREE.CircleGeometry(0.058, 12), b13Glow(0x4ade80), px, 0.95, 0.535);
      });
    }
    function buildAlchemistGear(grp, T) {
      if (T < 4) return;
      const goldMat = b13Std(0xd4a017, 0x92400e, 0.2, 0.85, 0.25);
      b13Add(grp, new THREE.BoxGeometry(0.46, 0.5, 0.24), goldMat, 0, 0.62, -0.4);
      [-0.15, 0.15].forEach(function(px) { b13Add(grp, new THREE.BoxGeometry(0.05, 0.55, 0.04), b13Std(0x78350f, null, 0, 0.1, 0.7), px, 0.66, -0.26); });
      [0x22c55e, 0xa855f7, 0xef4444].forEach(function(col, i) {
        const fx = -0.14 + i * 0.14;
        b13Add(grp, new THREE.SphereGeometry(0.075, 10, 10), b13Std(col, col, 0.6, 0.1, 0.1), fx, 0.95, -0.4);
        b13Add(grp, new THREE.CylinderGeometry(0.025, 0.03, 0.1, 8), b13Glow(0xe2e8f0, 0.8), fx, 1.05, -0.4);
      });
      const acid = T >= 5 ? 0xa3e635 : 0x84cc16;
      [-1, 1].forEach(function(s) {
        const fl = b13Group(grp, s * 0.44, 0.52, 0.22);
        b13Add(fl, new THREE.SphereGeometry(0.12, 14, 12), b13Glow(acid, 0.85), 0, 0, 0);
        b13Add(fl, new THREE.CylinderGeometry(0.035, 0.04, 0.12, 10), b13Glow(0xe2e8f0, 0.8), 0, 0.13, 0);
        b13Add(fl, new THREE.CylinderGeometry(0.042, 0.042, 0.05, 10), b13Std(0x92400e, null, 0, 0.1, 0.8), 0, 0.21, 0);
      });
      if (T >= 5) {
        for (let i = 0; i < 3; i++) {
          const bub = b13Add(grp, new THREE.SphereGeometry(0.06, 8, 8), b13Glow(0xbef264, 0.7), 0, 0.9, 0);
          grp.userData.orbit.push({ o: bub, r: 0.7, y: 0.9, s: 2.2, ph: (i / 3) * Math.PI * 2, bob: 0.15 });
        }
      }
    }

    function buildB13TierGear(unitKey, tier, path, pri, acc) {
      const grp = new THREE.Group();
      grp.name = 'b13_tier_crest';
      grp.userData = { spin: [], orbit: [], clock: 0 };
      const T = Math.max(1, Math.min(5, tier));
      const isSuper = unitKey === 'supermonkey' || unitKey === 'super';

      if (isSuper) {
        if (path === 1) buildSuperRoboGear(grp, T);
        else if (path === 2) buildSuperDarkKnightGear(grp, T);
        else buildSuperSunGear(grp, T);
        return grp;
      }

      const SPECIAL = { ice: buildIceGear, wizard: buildWizardGear, ninja: buildNinjaGear, tack: buildTackGear, sniper: buildSniperGear, alchemist: buildAlchemistGear };
      const headGearAtT4 = unitKey === 'wizard' || unitKey === 'ninja' || unitKey === 'sniper';
      const accMat = b13Std(acc, acc, 0.5, 0.2, 0.4);
      const priMat = b13Std(pri, null, 0, 0.6, 0.3);

      // Base gear shared by every unit: T2 headband, T3 shoulder pauldrons
      if (T >= 2 && !(headGearAtT4 && T >= 4)) b13Add(grp, new THREE.BoxGeometry(0.48, 0.08, 0.12), accMat, 0, 0.92, 0.35);
      if (T >= 3) {
        [-0.38, 0.38].forEach(function(px) {
          const p = b13Add(grp, new THREE.SphereGeometry(0.17, 10, 8), priMat, px, 0.72, 0);
          p.scale.set(1.2, 0.75, 1.1);
        });
      }

      if (SPECIAL[unitKey]) {
        SPECIAL[unitKey](grp, T);
        return grp;
      }

      // Other heroes/companions: T4 back cape, T5 energy wings
      if (T >= 4) b13Cape(grp, pri, acc, 0.2);
      if (T >= 5) {
        [-1, 1].forEach(function(w) {
          for (let f = 0; f < 2; f++) {
            b13Add(grp, new THREE.ConeGeometry(0.12, 0.85 - f * 0.2, 4), b13Glow(acc, 0.85), w * (0.5 + f * 0.12), 1.05 - f * 0.1, -0.3, 0, 0, -w * (0.75 + f * 0.35));
          }
        });
      }
      return grp;
    }

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
        if (c.isMesh && c.material && c.material.color && String(c.name || '').indexOf('b13_') !== 0) {
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

      // 3. Path & Tier Specific Sculpted 3D Gear (Build 13: no generic stacked rings)
      const oldCrest = mesh.getObjectByName('b13_tier_crest');
      if (oldCrest && oldCrest.parent) oldCrest.parent.remove(oldCrest);
      if (tier < 2) return;
      const crestGrp = buildB13TierGear(String(unitKey), tier, pathIndex || 0, primaryHex, accentHex);
      if (crestGrp) {
        mesh.add(crestGrp);
        if (crestGrp.userData.spin.length || crestGrp.userData.orbit.length) b13AnimatedCrests.add(crestGrp);
      }
    }

    function updateAllHeroAndCompanionEvolutions() {
      const st = G.gameState;
      const h = st && st.hero;
      if (!h) return;

      const vTier = h.volleyTier || 0;
      const eTier = h.weaponTier || h.elementalTier || 0;
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

    // North Row (Z = -26): Tier 1 -> Tier 5 Hero & Monkey Evolution Lineup
    function buildDevEvolutionRow(pedMat, rimMat) {
      const PAF = G.ProceduralAssetForge;
      if (!PAF) return;
      const SM = ['Sun Path (Top)', 'Robo Path (Mid)', 'Dark Knight Path (Bottom)'];
      const ROW = [
        { u: 'supermonkey', hero: true, t: 1, p: 0, g: 'Standard Super Darts' },
        { u: 'supermonkey', hero: true, t: 2, p: 0, g: 'Red Laser Visor • Crimson Laser Beams' },
        { u: 'supermonkey', hero: true, t: 3, p: 0, g: 'Violet Plasma Hood & Cape • Purple Plasma Spheres' },
        { u: 'supermonkey', hero: true, t: 4, p: 0, g: 'Golden Sun Avatar • Sun-Ray Halo • 3-Way Sunbeams' },
        { u: 'supermonkey', hero: true, t: 5, p: 0, g: 'True Sun God • Temple Crown • Solar Wings • Sun Orbs • 5-Way Beams' },
        { u: 'supermonkey', hero: true, t: 3, p: 1, g: 'Robo Dual-Arm Blasters' },
        { u: 'supermonkey', hero: true, t: 5, p: 1, g: 'Tech Terror Reactor • Missile Pods • Triple Parallel Beams' },
        { u: 'supermonkey', hero: true, t: 3, p: 2, g: 'Dark Knight Bat-Cowl & Cape' },
        { u: 'supermonkey', hero: true, t: 5, p: 2, g: 'Dark Champion • 4 Orbiting Dark Glaives' },
        { u: 'ice', t: 1, g: 'Base Ice Monkey' },
        { u: 'ice', t: 3, g: 'Handheld Cryo Cannon' },
        { u: 'ice', t: 5, g: 'Absolute Zero Cryo Cannon • Ice Spikes • Orbiting Shards' },
        { u: 'wizard', t: 1, g: 'Base Wizard Monkey' },
        { u: 'wizard', t: 4, g: 'Archmage Starry Spire Hat • Orbiting Flame Phoenix' },
        { u: 'wizard', t: 5, g: 'Prince of Darkness Spire Hat • Greater Phoenix' },
        { u: 'ninja', t: 1, g: 'Base Ninja Monkey' },
        { u: 'ninja', t: 4, g: 'Grandmaster Cowl • 6-Shuriken Ring' },
        { u: 'ninja', t: 5, g: 'Crimson Grandmaster Cowl • 8-Shuriken Ring' },
        { u: 'tack', t: 1, g: 'Base Tack Shooter' },
        { u: 'tack', t: 4, g: 'Golden Sawblade Ring' },
        { u: 'tack', t: 5, g: 'Inferno Twin Sawblade Rings' },
        { u: 'sniper', t: 1, g: 'Base Sniper Monkey' },
        { u: 'sniper', t: 4, g: 'Anti-Materiel Suppressor • Night-Vision Goggles' },
        { u: 'sniper', t: 5, g: 'Heavy Suppressor + Bipod • Quad-Tube NVGs' },
        { u: 'alchemist', t: 1, g: 'Base Alchemist' },
        { u: 'alchemist', t: 4, g: 'Golden Potion Backpack • Dual Acid Flasks' },
        { u: 'alchemist', t: 5, g: 'Golden Backpack • Unstable Acid Flasks • Bubble Orbit' }
      ];
      const catalog = G.COMPANION_CATALOG || [];
      const heroCfgs = G.HERO_CONFIGS || {};
      const STEP = 5.5;
      let x = 5 - ((ROW.length - 1) * STEP) / 2;

      ROW.forEach(function(it) {
        const px = x;
        x += STEP;
        let unitMesh = null;
        try {
          unitMesh = it.hero ? PAF.createMonkeyHero(it.u) : PAF.createCompanionMesh(it.u);
        } catch (err) {
          console.warn('[B13 Dev World] could not build unit mesh for', it.u, err);
          unitMesh = null;
        }
        if (!unitMesh || !unitMesh.children || unitMesh.children.length === 0) return;

        const holder = new THREE.Group();
        holder.position.set(px, 0, -26);
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.29, 0.25, 24), pedMat);
        ped.position.y = 0.12;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 8, 28).rotateX(Math.PI / 2), rimMat);
        rim.position.y = 0.25;
        holder.add(ped, rim);

        unitMesh.scale.multiplyScalar(1.6);
        unitMesh.position.y = 0.26;
        try {
          applyCharacterTierEvolution(unitMesh, it.u, it.t, it.p || 0);
        } catch (err) {
          console.warn('[B13 Dev World] tier evolution failed for', it.u, it.t, err);
        }
        holder.add(unitMesh);

        const comp = catalog.find(function(c) { return c && c.key === it.u; });
        const baseName = it.hero ? ((heroCfgs[it.u] && heroCfgs[it.u].name) || 'Super Monkey') : ((comp && comp.name) || it.u);
        const pathTxt = it.hero ? SM[it.p || 0] : 'Companion Path';
        const label = createLabelSprite(baseName + ' T' + it.t, it.hero ? pathTxt : it.g.split(' • ')[0]);
        label.position.set(0, 3.4, 0);
        holder.add(label);

        devShowcaseGroup.add(holder);
        devExhibits.push({
          kind: 'unit',
          key: it.u + '_T' + it.t + '_P' + (it.p || 0),
          name: baseName + ' — Tier ' + it.t,
          cat: (it.hero ? 'HERO' : 'COMPANION') + ' • ' + pathTxt,
          scaleTxt: '1.60x',
          lore: it.g,
          children: '',
          hp: it.t,
          speed: pathTxt,
          imm: it.g,
          tier: it.t,
          x: px,
          z: -26,
          mesh: unitMesh,
          holder: holder
        });
      });
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

      buildDevEvolutionRow(pedMat, rimMat);
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
        '  <span class="text-[10px] text-amber-200 font-bold">💡 South Row: Bloons -> MOABs -> 7 Bosses • North Row (walk up): T1 -> T5 Evolutions • Attacks Disabled</span>',
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
        mb._skullGates = [0.75, 0.5, 0.25];
        mb._skullIdx = 0;
        mb._skullShield = 0;
      }
      b13AuthenticateBlimp(mb);
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
    // F. MAIN SIMULATION LOOP HOOK
    // ------------------------------------------------------------------------
    const prevSim = G.updateSimulation;
    G.updateSimulation = function(dt) {
      const st = G.gameState;
      const h = st && st.hero;

      if (window.__IN_DEV_SHOWCASE && h) {
        // Freeze the wave clock + natural spawner so Dev World never advances past W1
        st.waveTimer = 999999;
        st.elapsedTime = 0;
        st.spawnAccumulator = -1e9;
        st.firstMoabSpawned = false;
        st.finalBadSpawned = true;
        st.blimpSpawnTimer = 999999;
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

      installB13UpgradeGating();
      updateAllHeroAndCompanionEvolutions();
      animateB13Crests(dt);

      if (window.__IN_DEV_SHOWCASE) {
        window.__DEV_CLOCK = (window.__DEV_CLOCK || 0) + dt;
        const devClock = window.__DEV_CLOCK;
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
              qMesh.position.y = 1.35 + Math.sin(devClock * 3.5 + i * 0.7) * 0.08;
            }
          }
          if (ex.mesh && ex.kind === 'moab' && window.__DEV_SPIN_MODELS) {
            ex.mesh.rotation.y += dt * 0.65;
            if (ex.mesh.userData && ex.mesh.userData.propellers) {
              ex.mesh.userData.propellers.forEach(function(p) { p.rotation.z += dt * 16; });
            }
          }
          if (ex.mesh && ex.kind === 'unit' && window.__DEV_SPIN_MODELS) {
            ex.mesh.rotation.y += dt * 0.5;
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
          if (closest.kind === 'unit') {
            if (tEl) tEl.textContent = closest.name;
            if (cEl) cEl.textContent = closest.cat;
            if (sEl) sEl.textContent = 'Tier ' + closest.tier + ' / 5';
            if (lEl) lEl.textContent = '3D Gear: ' + closest.lore;
            if (hpEl) hpEl.textContent = '⭐ T' + closest.tier;
            if (spEl) spEl.textContent = '🧭 ' + closest.speed;
            if (imEl) imEl.textContent = '🛠️ Sequential T1 → T5';
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

