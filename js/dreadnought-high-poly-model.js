import * as THREE from 'three';

export function createDreadnoughtHighPolyModel(options = {}) {
  const castShadow = options.castShadow ?? false;
  const receiveShadow = options.receiveShadow ?? false;
    const materials = [];
    const wireframeAware = [];
    const mat = (color, roughness, metalness, emissive = 0x000000, emissiveIntensity = 0) => {
      const m = new THREE.MeshStandardMaterial({
        color, roughness, metalness, emissive, emissiveIntensity, side: THREE.DoubleSide
      });
      materials.push(m);
      wireframeAware.push(m);
      return m;
    };
    const basicMat = (color, opacity = 1) => {
      const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
      materials.push(m);
      return m;
    };

    const hullMat       = mat(0x141b21, .56, .84);
    const armorMat      = mat(0x273743, .44, .72);
    const armorLiteMat  = mat(0x394d5b, .40, .68);
    const recessMat     = mat(0x0a0e12, .72, .80);
    const mechanicalMat = mat(0x15191d, .48, .91);
    const gunMat        = mat(0x262b30, .38, .95);
    const warningMat    = mat(0x8a5b32, .63, .36);
    const redMat        = mat(0x6d2929, .58, .40);
    const glassMat      = mat(0x203844, .24, .52, 0x112d37, .8);
    const engineMat     = mat(0x17191b, .42, .95);
    const engineCoreMat = mat(0xff7a2e, .15, .22, 0xff7a2e, 4.0);
    const engineRingMat = mat(0xc67335, .20, .78, 0xff8d36, 3.0);
    const maneuverMat   = mat(0x31505f, .24, .62, 0x4ba7d7, 1.0);
    const glowDiscMat   = basicMat(0xffa25a, .98);
    const glowHaloMat   = basicMat(0xff8a32, .22);

    const root = new THREE.Group();
    root.name = 'Dreadnought_MKII_6_HighPoly';
    const ship = root;

    const hullGroup = new THREE.Group();
    const portHullGroup = new THREE.Group();
    const starboardHullGroup = new THREE.Group();
    const bridgeGroup = new THREE.Group();
    ship.add(hullGroup);
    ship.add(portHullGroup);
    ship.add(starboardHullGroup);
    ship.add(bridgeGroup);

    const turrets = [];
    const radarParts = [];
    const engineCores = [];
    const engineRings = [];
    const glowPlanes = [];

    function prism(points, height, material, y = 0, parent = hullGroup) {
      const shape = new THREE.Shape();
      shape.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        steps: 1,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: Math.min(.05, height * .12),
        bevelThickness: Math.min(.05, height * .12)
      });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, height * .5, 0);

      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = y - height * .5;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      parent.add(mesh);
      return mesh;
    }

    function box(size, material, pos, parent = hullGroup, rot = [0,0,0]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      parent.add(mesh);
      return mesh;
    }

    function cyl(r1, r2, h, seg, material, pos, parent = hullGroup, rot = [0,0,0]) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), material);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      parent.add(mesh);
      return mesh;
    }

    function disc(radius, pos, parent = hullGroup, rot = [0,0,0], matRef = glowDiscMat) {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 28), matRef);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      parent.add(mesh);
      return mesh;
    }

    function createTurret({ x=0, y=1, z=0, scale=1, barrels=2, heavy=false, sideMount=false, invert=false, parent=hullGroup }) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.scale.setScalar(scale);

      cyl(heavy ? .23 : .13, heavy ? .30 : .17, heavy ? .15 : .10, 18, mechanicalMat, [0,0,0], g);
      box(heavy ? [.55,.24,.60] : [.34,.16,.36], armorMat, [0,.13,.04], g);
      box(heavy ? [.43,.10,.32] : [.25,.07,.22], armorLiteMat, [0,.27,.08], g);

      const spacing = heavy ? .15 : .09;
      const barrelLen = heavy ? .92 : .52;
      const radius = heavy ? .045 : .025;

      for (let i = 0; i < barrels; i++) {
        const bx = (i - (barrels - 1) * .5) * spacing;
        cyl(radius, radius * .78, barrelLen, 10, gunMat, [bx,.22,.44 + barrelLen*.5], g, [Math.PI/2,0,0]);
      }

      if (sideMount) g.rotation.z = x > 0 ? -.08 : .08;
      if (invert) g.rotation.x = Math.PI;
      parent.add(g);
      turrets.push(g);
      return g;
    }

    function createMicroTurret({x=0, y=0, z=0, sideMount=false, flip=false, parent=hullGroup}) {
      const anchor = new THREE.Group();
      anchor.position.set(x,y,z);

      // anchoring collar so it visually sinks into hull
      box([.16,.05,.16], mechanicalMat, [0,.01,0], anchor);
      box([.24,.03,.24], armorMat, [0,-.01,0], anchor);

      const g = new THREE.Group();
      g.position.set(0,.02,0);
      cyl(.08,.10,.06,14,mechanicalMat,[0,0,0],g);
      box([.22,.09,.20], armorMat, [0,.08,.01], g);
      [-.045,.045].forEach(px => cyl(.016,.016,.26,8,gunMat,[px,.10,.18],g,[Math.PI/2,0,0]));
      box([.11,.03,.12], armorLiteMat,[0,.17,.06],g);

      if (sideMount) g.rotation.z = x > 0 ? -.10 : .10;
      if (flip) g.rotation.x = Math.PI;

      anchor.add(g);
      parent.add(anchor);
      turrets.push(g);
      return anchor;
    }

    function createEngine(x, y, z, radius, length, coreScale = .75, parent = hullGroup) {
      cyl(radius*.80, radius, length, 24, engineMat, [x,y,z], parent, [Math.PI/2,0,0]);
      const core = cyl(radius*coreScale, radius*coreScale, length*.82, 24, engineCoreMat, [x,y,z-.01], parent, [Math.PI/2,0,0]);
      engineCores.push(core);

      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(radius*1.05, radius*.10, 10, 28), engineRingMat);
      outerRing.position.set(x,y,z - length*.50);
      outerRing.castShadow = true;
      outerRing.receiveShadow = true;
      parent.add(outerRing);
      engineRings.push(outerRing);

      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(radius*.76, radius*.05, 10, 24), engineRingMat);
      innerRing.position.set(x,y,z - length*.36);
      innerRing.castShadow = true;
      innerRing.receiveShadow = true;
      parent.add(innerRing);
      engineRings.push(innerRing);

      const boosterFlare = new THREE.Mesh(new THREE.ConeGeometry(radius*.62, length*.36, 18, 1, true), engineCoreMat);
      boosterFlare.position.set(x, y, z - length*.72);
      boosterFlare.rotation.x = -Math.PI/2;
      parent.add(boosterFlare);
      engineCores.push(boosterFlare);

      // Bright visible exhaust discs / halos
      const glow = disc(radius*.72, [x,y,z - length*.90], parent, [0,0,0], glowDiscMat);
      glowPlanes.push(glow);
      const halo = disc(radius*1.18, [x,y,z - length*.91], parent, [0,0,0], glowHaloMat);
      glowPlanes.push(halo);

      const lamp = new THREE.PointLight(0xff8b35, radius > .2 ? 20 : 10, radius > .2 ? 6 : 4, 2);
      lamp.position.set(x, y, z - length*.55);
      parent.add(lamp);
      return { core, outerRing, innerRing, glow, halo, lamp };
    }

    // MAIN HULL
    prism([
      [ 0.00,  3.55],[ 0.55,  3.12],[ 1.10,  2.15],[ 1.48, 0.65],[ 1.58,-1.15],
      [ 1.38, -2.45],[ 1.02, -3.05],[-1.02,-3.05],[-1.38,-2.45],[-1.58,-1.15],
      [-1.48,  0.65],[-1.10,  2.15],[-0.55, 3.12]
    ], .62, hullMat, 0);

    prism([
      [0,3.12],[.52,2.6],[1.02,1.15],[1.16,-1.35],[.86,-2.25],
      [-.86,-2.25],[-1.16,-1.35],[-1.02,1.15],[-.52,2.6]
    ], .28, armorMat, .50);

    prism([
      [0,2.7],[.34,2.25],[.48,.35],[.42,-2.25],[-.42,-2.25],[-.48,.35],[-.34,2.25]
    ], .20, armorLiteMat, .82);

    prism([
      [0,2.75],[.34,2.05],[.50,-1.4],[.30,-3.0],[-.30,-3.0],[-.50,-1.4],[-.34,2.05]
    ], .32, recessMat, -.55);

    prism([
      [0,2.25],[.16,1.8],[.22,-2.55],[-.22,-2.55],[-.16,1.8]
    ], .28, mechanicalMat, -.88);

    // Bridge connection neck / truss so bridge no longer feels detached
    box([.82,.22,.95], armorMat, [0, .96, -.82], hullGroup);
    box([.52,.16,1.18], armorLiteMat, [0, 1.10, -.95], hullGroup);
    for (const s of [-1,1]) {
      box([.10,.48,.88], hullMat, [s*.34, 1.06, -.88], hullGroup, [0,0,s*.10]);
      box([.08,.30,.72], mechanicalMat, [s*.24, .82, -.88], hullGroup, [0,0,s*.08]);
    }

    // Split armored prow + spinal cannon
    for (const side of [-1,1]) {
      box([.38,.50,1.62], armorMat, [side*.48,.13,3.18], hullGroup, [0, side*.018, 0]);
      box([.20,.22,1.80], mechanicalMat, [side*.48,-.23,3.10], hullGroup);
      box([.30,.08,1.15], redMat, [side*.48,.43,3.14], hullGroup);
      cyl(.105,.105,.18,18, gunMat,[side*.48,.06,4.00],hullGroup,[Math.PI/2,0,0]);
    }
    box([.38,.24,1.85], recessMat, [0,.36,2.72], hullGroup);
    cyl(.085,.105,1.28,16,gunMat,[0,.38,3.54],hullGroup,[Math.PI/2,0,0]);

    // Side sponsons / hangar recesses + hull-anchored micro turrets
    for (const side of [-1,1]) {
      const s = side;
      const sideParent = s > 0 ? starboardHullGroup : portHullGroup;
      prism([
        [s*1.05,1.75],[s*1.62,.85],[s*1.72,-1.45],[s*1.42,-2.38],
        [s*.98,-2.12],[s*.94,1.1]
      ].map(([x,z])=>[x,z]), .34, armorMat, .08, sideParent);

      [
        [1.46, 1.18, 1.02, .36],
        [1.58, 0.02, 1.55, .34],
        [1.50,-1.45, 1.15, .32]
      ].forEach(([x,z,len,h], idx) => {
        box([.20,h,len], idx===1 ? armorLiteMat : armorMat, [s*x,.15,z], sideParent, [0,0,s*.055]);
      });

      box([.10,.42,1.10], recessMat, [s*1.71,.02,-.42], sideParent);
      for (let i=0;i<4;i++) box([.06,.34,.07], mechanicalMat, [s*1.77,.02,-.82 + i*.27], sideParent);
      box([.05,.08,.78], warningMat, [s*1.79,.24,-.42], sideParent);
      box([.42,.18,1.65], hullMat, [s*1.42,-.58,-.95], sideParent, [0,0,s*.09]);

      [-1.65,-.95,.75].forEach((z)=>{
        cyl(.075,.09,.22,14,engineMat,[s*1.73,-.24,z],sideParent,[0,0,Math.PI/2]);
        const glow = cyl(.052,.052,.20,14,maneuverMat,[s*1.74,-.24,z],sideParent,[0,0,Math.PI/2]);
        engineCores.push(glow);
      });

      // Anchored micro turrets
      createMicroTurret({ x:s*1.56, y:.28, z:1.38, sideMount:true, parent:sideParent });
      createMicroTurret({ x:s*1.67, y:.18, z:-.08, sideMount:true, parent:sideParent });
      createMicroTurret({ x:s*1.53, y:.12, z:-1.58, sideMount:true, parent:sideParent });
    }

    // Bridge / superstructure
    prism([[-.72,-.55],[.72,-.55],[.62,.72],[0,1.05],[-.62,.72]], .30, armorMat, 1.03, bridgeGroup);
    box([1.12,.34,.88], hullMat, [0,1.43,-1.38], bridgeGroup);
    box([.82,.28,.62], armorLiteMat, [0,1.71,-1.42], bridgeGroup);
    box([.58,.23,.43], armorMat, [0,1.96,-1.46], bridgeGroup);
    box([.52,.07,.07], glassMat, [0,2.00,-1.22], bridgeGroup);

    // extra bridge buttress so side meshes connect
    box([.90,.18,.66], armorMat, [0,1.18,-1.08], bridgeGroup);
    for(const s of [-1,1]){
      box([.18,.42,.70], armorMat, [s*.62,1.46,-1.36], bridgeGroup, [0,0,s*.08]);
      box([.09,.20,.50], recessMat, [s*.73,1.46,-1.36], bridgeGroup);
      box([.16,.28,.52], hullMat, [s*.54,1.20,-1.05], bridgeGroup, [0,0,s*.10]);
      createMicroTurret({ x:s*.58, y:1.35, z:-.86, sideMount:true, parent:bridgeGroup });
    }

    cyl(.05,.07,.58,10,mechanicalMat,[0,2.34,-1.48],bridgeGroup);
    box([.58,.07,.11], armorLiteMat, [0,2.60,-1.48], bridgeGroup);
    box([.18,.05,.42], warningMat,[0,2.66,-1.48],bridgeGroup);
    const radar = new THREE.Group();
    radar.position.set(0,2.70,-1.48);
    box([.55,.055,.13], mechanicalMat,[0,0,0],radar);
    box([.10,.04,.48], armorLiteMat,[0,.04,0],radar);
    bridgeGroup.add(radar);
    radarParts.push(radar);

    // Main heavy battery
    createTurret({x:0,y:1.16,z:1.76,scale:1.10,barrels:3,heavy:true,parent:hullGroup});
    createTurret({x:0,y:1.13,z:.58,scale:1.00,barrels:3,heavy:true,parent:hullGroup});
    createTurret({x:0,y:1.10,z:-2.08,scale:.92,barrels:2,heavy:true,parent:hullGroup});

    // Secondary broadside batteries
    for(const side of [-1,1]){
      createTurret({x:side*1.43,y:.56,z:.68,scale:.62,barrels:2,sideMount:true,parent:hullGroup});
      createTurret({x:side*1.53,y:.50,z:-.72,scale:.56,barrels:2,sideMount:true,parent:hullGroup});
      createTurret({x:side*1.37,y:.43,z:-1.72,scale:.50,barrels:2,sideMount:true,parent:hullGroup});
    }

    // Ventral defensive batteries
    [-.62,0,.62].forEach((x,i)=> createTurret({x,y:-.78,z:-.30 + i*.18,scale:.42,barrels:2,invert:true,parent:hullGroup}));
    [-1,1].forEach(s => {
      createMicroTurret({ x:s*.88, y:-1.02, z:.90, flip:true, parent:hullGroup });
      createMicroTurret({ x:s*.68, y:-.98, z:-1.48, flip:true, parent:hullGroup });
    });

    // Stern armor and engine block
    box([2.25,.70,.55], hullMat,[0,.03,-3.12],hullGroup);
    box([1.72,.48,.42], armorMat,[0,.48,-3.20],hullGroup);
    box([1.12,.32,.34], mechanicalMat,[0,-.48,-3.18],hullGroup);

    createEngine( 0.00, -.06, -3.43, .30, .56, .75, hullGroup);
    createEngine(-.55,  .03, -3.38, .24, .50, .72, hullGroup);
    createEngine( .55,  .03, -3.38, .24, .50, .72, hullGroup);
    createEngine(-1.05,  .00, -3.25, .16, .42, .70, hullGroup);
    createEngine( 1.05,  .00, -3.25, .16, .42, .70, hullGroup);
    createEngine(-.92, -.45, -3.17, .13, .38, .70, hullGroup);
    createEngine( .92, -.45, -3.17, .13, .38, .70, hullGroup);

    for(const s of [-1,1]){
      box([.11,.82,1.22], armorMat,[s*1.36,.03,-2.57],hullGroup,[0,0,s*.10]);
      box([.06,.54,.86], recessMat,[s*1.43,.02,-2.62],hullGroup);
      for(let i=0;i<4;i++) box([.04,.035,.65], mechanicalMat,[s*1.48,-.18+i*.13,-2.62],hullGroup);
    }

    // Dorsal panel seams
    const panelZ = [2.18,1.42,.58,-.32,-1.15,-1.92];
    panelZ.forEach((z,i)=>{
      box([1.55,.035,.035], mechanicalMat,[0,.855,z],hullGroup);
      if(i%2===0) box([.50,.045,.16], redMat,[.72,.89,z-.16],hullGroup);
    });
    for(const s of [-1,1]){
      [2.0,1.25,.35,-.55,-1.35,-2.05].forEach((z,i)=>{
        box([.08,.34,.035], mechanicalMat,[s*1.18,.25,z],hullGroup,[0,0,s*.08]);
        if(i===1 || i===4) box([.045,.17,.30], warningMat,[s*1.30,.28,z],hullGroup);
      });
    }

    // UNDERSIDE DETAIL PASS
    box([.72,.14,1.85], armorMat, [0,-1.18,.12], hullGroup);
    box([.52,.08,1.22], recessMat, [0,-1.27,.05], hullGroup);

    [-1.86,-1.15,-.35,.55,1.35].forEach((z, idx)=>{
      box([.92,.028,.04], mechanicalMat,[0,-1.03,z],hullGroup);
      box([.26,.035,.18], idx % 2 ? warningMat : armorLiteMat, [.33,-1.00,z+.02], hullGroup);
      box([.26,.035,.18], idx % 2 ? armorLiteMat : warningMat, [-.33,-1.00,z-.02], hullGroup);
    });

    [-.72,-.36,0,.36,.72].forEach(x=> box([.06,.22,4.35], hullMat,[x,-1.08,.15],hullGroup));

    for(const s of [-1,1]){
      box([.28,.20,.52], mechanicalMat,[s*.58,-1.14,-.82],hullGroup);
      box([.20,.14,.42], armorLiteMat,[s*.78,-1.08,1.24],hullGroup);
      box([.14,.14,.86], recessMat,[s*.98,-.96,-.38],hullGroup);
      for(let i=0;i<5;i++) box([.03,.10,.07], mechanicalMat,[s*.98,-.94,-.66 + i*.16],hullGroup);
    }

    for(const s of [-1,1]){
      cyl(.10,.10,.26,12,gunMat,[s*.46,-1.10,2.18],hullGroup,[0,0,Math.PI/2]);
      cyl(.07,.07,.18,12,glassMat,[s*.20,-1.16,-2.10],hullGroup,[0,0,Math.PI/2]);
    }

    for(const s of [-1,1]){
      cyl(.022,.028,.32,8,mechanicalMat,[s*.52,1.16,-.48],hullGroup);
      cyl(.022,.028,.26,8,mechanicalMat,[s*.88,.79,-1.05],hullGroup);
      box([.18,.08,.12], armorLiteMat,[s*.52,1.32,-.48],hullGroup);
      box([.16,.07,.10], armorLiteMat,[s*.88,.92,-1.05],hullGroup);
    }



    root.userData.tick = delta => {
      const time = root.userData.clock?.getElapsedTime?.() ?? 0;
      turrets.forEach((turret, index) => { turret.rotation.y = Math.sin(time * .8 + index) * .35; });
      radarParts.forEach(item => { item.rotation.y += delta * 1.5; });
      engineCoreMat.emissiveIntensity = 4.0 + Math.sin(time * 5.8) * .35;
      engineRingMat.emissiveIntensity = Math.max(1.1, 3.0 + Math.cos(time * 4.3) * .30);
      maneuverMat.emissiveIntensity = Math.max(.6, 1.0 + Math.sin(time * 4.0) * .12);
      engineRings.forEach((ring, index) => { ring.rotation.z += delta * (.8 + index * .03); });
      glowPlanes.forEach((glow, index) => {
        const pulse = 1 + Math.sin(time * (5.2 + index * .05)) * (index % 2 === 0 ? .08 : .14);
        glow.scale.setScalar(pulse * (index % 2 === 0 ? 1.12 : 1.42));
      });
    };
    root.userData.clock = new THREE.Clock();
    root.userData.baseScale = 3.75;
    root.scale.setScalar(options.scale ?? 1);
    return root;

}

