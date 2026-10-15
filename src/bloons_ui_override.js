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
    ProceduralAssetForge.createDartlingMesh = () => createFullMonkeyMesh('sniper');
    ProceduralAssetForge.createGlueMesh = () => createFullMonkeyMesh('wizard');
    ProceduralAssetForge.createSuperMesh = () => (ProceduralAssetForge.createMonkeyHero ? ProceduralAssetForge.createMonkeyHero('supermonkey') : createFullMonkeyMesh('super'));

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
          return ProceduralAssetForge.createMonkeyHero ? ProceduralAssetForge.createMonkeyHero(hId) : createFullMonkeyMesh(hId);
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

  function installSmoothBloonGeometry() {
    if (typeof ProceduralAssetForge === 'undefined') return;

    ProceduralAssetForge.createBloonGeometry = function() {
      const points = [];
      // 1. Knot base
      points.push(new THREE.Vector2(0.0, -1.02));
      points.push(new THREE.Vector2(0.12, -0.98));
      points.push(new THREE.Vector2(0.14, -0.94));
      points.push(new THREE.Vector2(0.07, -0.90));
      points.push(new THREE.Vector2(0.09, -0.84));

      // 2. Lower body: plump, smooth balloon shape up to equator
      const stepsLower = 32;
      const yNeck = -0.84;
      const yEq = 0.15;
      const rNeck = 0.09;
      const rMax = 0.98;
      for (let i = 1; i < stepsLower; i++) {
        const u = i / stepsLower;
        const ease = Math.sin(u * Math.PI * 0.5);
        const r = rNeck + (rMax - rNeck) * Math.pow(ease, 1.15);
        const y = yNeck + (yEq - yNeck) * u;
        points.push(new THREE.Vector2(r, y));
      }

      // 3. Equator
      points.push(new THREE.Vector2(rMax, yEq));

      // 4. Upper dome: pure smooth spherical arc from equator to apex (ZERO cone pointiness!)
      const stepsTop = 32;
      const hTop = 0.68;
      for (let i = 1; i <= stepsTop; i++) {
        const theta = (i / stepsTop) * (Math.PI * 0.5);
        const r = rMax * Math.cos(theta);
        const y = yEq + hTop * Math.sin(theta);
        points.push(new THREE.Vector2(Math.max(0.0, r), y));
      }

      const geo = new THREE.LatheGeometry(points, 36);
      geo.computeVertexNormals();
      return geo;
    };

    if (typeof scene !== 'undefined') {
      scene.traverse(obj => {
        if (obj.isInstancedMesh && obj.count >= 1000) {
          const newGeo = ProceduralAssetForge.createBloonGeometry();
          if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.aLivery) {
            newGeo.setAttribute('aLivery', obj.geometry.attributes.aLivery);
          }
          obj.geometry = newGeo;
        }
      });
    }
  }

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
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
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
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
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
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
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
        id: 'hero_quincy_rapid',
        category: 'hero',
        path: 'QUINCY',
        tier: 1,
        name: 'Rapid Fire Volley',
        desc: '+25% Bow Attack Speed and +1 Arrow Pierce across all shots.',
        apply: (st) => { if (st.hero) { st.hero.fireRate *= 1.25; st.hero.pierce += 1; } }
      },
      {
        id: 'recruit_mermonkey',
        category: 'companion',
        path: 'MERMONKEY',
        tier: 1,
        name: 'Mermonkey',
        desc: 'Fires high-velocity sonic waves and piercing water tridents.',
        apply: (st) => { if (st.squad && st.squad.mermonkey) { st.squad.mermonkey.level = 1; if (!st.recruitedOrder.includes('mermonkey')) st.recruitedOrder.push('mermonkey'); } }
      },
      {
        id: 'recruit_ninja',
        category: 'companion',
        path: 'NINJA MONKEY',
        tier: 1,
        name: 'Ninja Monkey',
        desc: 'Fires fast homing shurikens that seek and pop Camo Bloons.',
        apply: (st) => { if (st.squad && st.squad.ninja) { st.squad.ninja.level = 1; if (!st.recruitedOrder.includes('ninja')) st.recruitedOrder.push('ninja'); } }
      },
      {
        id: 'recruit_alchemist',
        category: 'companion',
        path: 'ALCHEMIST',
        tier: 1,
        name: 'Alchemist',
        desc: 'Hurls explosive acid potions that melt Lead Bloons.',
        apply: (st) => { if (st.squad && st.squad.alchemist) { st.squad.alchemist.level = 1; if (!st.recruitedOrder.includes('alchemist')) st.recruitedOrder.push('alchemist'); } }
      },
      {
        id: 'upgrade_tack_blade',
        category: 'companion',
        path: 'TACK SHOOTER',
        tier: 2,
        name: 'Blade Shooter',
        desc: 'Fires large, razor-sharp blades that slice through bloon packs.',
        apply: (st) => { if (st.squad && st.squad.tack) st.squad.tack.level = 2; }
      },
      {
        id: 'mastery_overdrive',
        category: 'hero',
        path: 'OVERDRIVE',
        tier: 5,
        name: 'Overdrive Tuning',
        desc: '+15% Attack Speed, +0.5 Damage, and +5% Crit Chance!',
        apply: (st) => { if (st.hero) { st.hero.fireRate *= 1.15; st.hero.damage += 0.5; } }
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
      if (['SCRIPT', 'STYLE'].includes(node.tagName)) return;
      Array.from(node.childNodes).forEach(replaceTextEmojisInNode);
    }
  }

  // Update Hero & Stage Cards on Title Screen with 3D Snapshots
  function polishTitleScreenCards() {
    // Stage select cards
    const stageMeadow = document.getElementById('stage-card-meadow');
    if (stageMeadow) {
      const icon = stageMeadow.querySelector('div');
      if (icon) icon.innerHTML = BADGE_3D_SVGS['🌻'];
    }
    const stageFrozen = document.getElementById('stage-card-frozen');
    if (stageFrozen) {
      const icon = stageFrozen.querySelector('div');
      if (icon) icon.innerHTML = BADGE_3D_SVGS['❄️'];
    }
    const stageCastle = document.getElementById('stage-card-castle');
    if (stageCastle) {
      const icon = stageCastle.querySelector('div');
      if (icon) icon.innerHTML = BADGE_3D_SVGS['🏰'];
    }

    // Hero select cards
    ['quincy', 'gwendolin', 'obyn', 'sauda', 'benjamin', 'supermonkey'].forEach(hId => {
      const card = document.getElementById(`hero-card-${hId}`);
      if (card) {
        const iconDiv = card.querySelector('.w-11.h-11');
        if (iconDiv) {
          const snap = safeGet3DModelSnapshot(hId);
          if (snap) {
            iconDiv.innerHTML = `<img src="${snap}" alt="${hId}" class="w-full h-full object-contain filter drop-shadow(0 2px 4px rgba(0,0,0,0.5))">`;
          }
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
          persistentStats.monkeyMoney = Math.min(15000, Math.max(persistentStats.monkeyMoney || 0, parsed.monkeyMoney));
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
      persistentStats.monkeyMoney = Math.min(15000, persistentStats.monkeyMoney || 0);

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

    const unlocked = (typeof persistentStats !== 'undefined' && persistentStats.unlockedHeroes)
      ? persistentStats.unlockedHeroes
      : ['quincy', 'gwendolin'];

    const currentSelected = (typeof selectedHeroId !== 'undefined') ? selectedHeroId : 'quincy';

    // Inject missing new hero cards if not in DOM
    const firstCard = document.querySelector('.hero-card');
    const heroGrid = firstCard ? firstCard.parentElement : null;
    if (heroGrid) {
      ['rosalia', 'corvus', 'geraldo', 'silas'].forEach(newH => {
        if (!heroGrid.querySelector(`.hero-card[data-hero="${newH}"]`)) {
          const card = document.createElement('div');
          card.id = `hero-card-${newH}`;
          card.className = 'hero-card relative p-2 sm:p-2.5 rounded-2xl flex flex-col items-center justify-between cursor-pointer transition-all bg-gradient-to-b from-stone-800 to-stone-900 border-2 border-stone-700/80 hover:border-yellow-400 hover:scale-[1.03] active:scale-95 shadow-lg select-none';
          card.setAttribute('data-hero', newH);
          card.innerHTML = `
            <div class="hero-price-tag"></div>
            <div class="hero-3d-portrait w-12 h-12 sm:w-14 sm:h-14 my-1 flex items-center justify-center"></div>
            <div class="font-btd text-xs text-white uppercase tracking-wider text-center">${newH}</div>
          `;
          heroGrid.appendChild(card);

          card.addEventListener('click', () => {
            const isUnl = (typeof persistentStats !== 'undefined' && persistentStats.unlockedHeroes && persistentStats.unlockedHeroes.includes(newH));
            if (isUnl) {
              if (typeof selectedHeroId !== 'undefined') selectedHeroId = newH;
              if (typeof gameState !== 'undefined') gameState.heroId = newH;
              saveMasterState();
              renderMainMenuHeroPrices();
            } else {
              // Open unlock prompt
              const cost = heroPrices[newH] || 3000;
              const modalUnlock = document.getElementById('modal-hero-unlock');
              if (modalUnlock) {
                const nameEl = document.getElementById('unlock-hero-name');
                const costEl = document.getElementById('unlock-hero-cost');
                const balEl = document.getElementById('unlock-user-balance');
                if (nameEl) nameEl.textContent = newH.toUpperCase();
                if (costEl) costEl.textContent = `$${cost.toLocaleString()}`;
                if (balEl && typeof persistentStats !== 'undefined') balEl.textContent = `$${(persistentStats.monkeyMoney || 0).toLocaleString()}`;
                modalUnlock.dataset.pendingHero = newH;
                modalUnlock.dataset.pendingCost = cost;
                modalUnlock.classList.remove('hidden');
                modalUnlock.classList.add('flex');
              }
            }
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

      // 1. Price Tag / Unlocked Tag Badge
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
        tagEl.innerHTML = `<span class="badge-3d-icon w-3 h-3">${get3DIconSVG('lock')}</span> $${price.toLocaleString()}`;
        card.classList.add('opacity-75');
        card.classList.remove('selected');
      }

      // 2. Large 3D Hero Portrait (Auto-fitted without giant eyeball zoom)
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

      // 3. Hero Star Mastery Badge (★1 to ★10)
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
          starBtn.textContent = `★ Upgrade ($${upgradeCost})`;
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
  function setupEscapeKeyHandler() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Dismiss topmost opened menu
        const barracksModal = document.getElementById('barracks-modal');
        if (barracksModal && !barracksModal.classList.contains('hidden')) {
          barracksModal.classList.add('hidden');
          barracksModal.classList.remove('flex');
          return;
        }

        const unlockModal = document.getElementById('modal-hero-unlock');
        if (unlockModal && !unlockModal.classList.contains('hidden')) {
          unlockModal.classList.add('hidden');
          unlockModal.classList.remove('flex');
          return;
        }

        const shopModal = document.getElementById('shop-modal');
        if (shopModal && !shopModal.classList.contains('hidden')) {
          shopModal.classList.add('hidden');
          shopModal.classList.remove('flex');
          return;
        }

        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
          settingsModal.classList.add('hidden');
          settingsModal.classList.remove('flex');
          return;
        }

        const statsModal = document.getElementById('stats-modal');
        if (statsModal && !statsModal.classList.contains('hidden')) {
          statsModal.classList.add('hidden');
          statsModal.classList.remove('flex');
          return;
        }

        const pauseModal = document.getElementById('pause-modal');
        if (typeof gameState !== 'undefined' && !gameState.inStartMenu && !gameState.gameOver) {
          if (pauseModal && !pauseModal.classList.contains('hidden')) {
            pauseModal.classList.add('hidden');
            pauseModal.classList.remove('flex');
            gameState.paused = false;
          } else if (pauseModal) {
            pauseModal.classList.remove('hidden');
            pauseModal.classList.add('flex');
            gameState.paused = true;
          }
        }
      }
    });
  }

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
    // Intercept getAvailableUpgradeCards so it never throws on missing companion/skill state
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

    // Intercept openLevelUpModal so squad is guaranteed initialized before level-up runs
    if (typeof openLevelUpModal === 'function') {
      const _origOpenLevelUpModal = openLevelUpModal;
      openLevelUpModal = function() {
        ensureSquadInitialized();
        return _origOpenLevelUpModal.apply(this, arguments);
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
  const SETTINGS_KEY_V11 = 'bloons_blitz_settings_v11';
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
        fpsMode: 'native',
        dpi: 1,
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

        // Periodic special bloon spawner (every 12s)
        if (!gameState.paused && !gameState.gameOver && typeof spawnBloon === 'function') {
          if (Math.random() < 0.20) {
            const specials = ['GLASS', 'DYNAMITE', 'DIAMOND', 'GOLDEN'];
            const chosen = specials[Math.floor(Math.random() * specials.length)];
            const a = Math.random() * Math.PI * 2;
            const r = 9 + Math.random() * 6;
            spawnBloon(chosen, Math.cos(a) * r, Math.sin(a) * r);
          }
        }
      }
    }, 2000);
  }

  // ==========================================================================
  // 14. INITIALIZATION & TEST AUTOMATION HOOKS
  // ==========================================================================
  function init() {
    if (typeof THREE !== 'undefined' && THREE.WebGLRenderer && !THREE.WebGLRenderer.prototype.__origRender) {
      THREE.WebGLRenderer.prototype.__origRender = THREE.WebGLRenderer.prototype.render;
      THREE.WebGLRenderer.prototype.render = function(s, c) {
        if (s && s.isScene && !window.__ACTIVE_GAME_SCENE__) {
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

    ensureSquadInitialized();
    setInterval(ensureSquadInitialized, 500);

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
