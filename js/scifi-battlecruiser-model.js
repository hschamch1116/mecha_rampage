import * as THREE from 'three';

export function createSciFiBattlecruiserModel(options = {}) {
  const root = new THREE.Group();
  root.name = 'SciFiBattlecruiser';
  const castShadow = options.castShadow ?? false;
  const receiveShadow = options.receiveShadow ?? false;
  const wireframe = options.wireframe ?? false;
  const mat = (color, roughness, metalness, emissive = 0, emissiveIntensity = 0) => new THREE.MeshStandardMaterial({
    color, roughness, metalness, emissive, emissiveIntensity, wireframe, side: THREE.DoubleSide
  });
  const hullDarkMat = mat(0x1a1f26, .55, .8);
  const armorNavyMat = mat(0x2b3e52, .45, .65);
  const accentRedMat = mat(0xc53030, .5, .3);
  const accentYellowMat = mat(0xd69e2e, .4, .3);
  const engineIronMat = mat(0x111317, .7, .9);
  const glowCyanMat = mat(0x38bdf8, .2, .15, 0x38bdf8, 2.5);
  const glowOrangeMat = mat(0xf97316, .2, .15, 0xf97316, 3);
  const turretList = [];
  const radarList = [];
  const add = (geometry, material, parent, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    parent.add(mesh);
    return mesh;
  };
  const applyShadows = object => object.traverse(child => {
    if (child.isMesh) {
      child.castShadow = castShadow;
      child.receiveShadow = receiveShadow;
    }
  });

  const hullGroup = new THREE.Group();
  hullGroup.name = 'MainHull';
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 3.2);
  hullShape.lineTo(.5, 2.5);
  hullShape.lineTo(1.1, .5);
  hullShape.lineTo(1.3, -1.8);
  hullShape.lineTo(.9, -2.5);
  hullShape.lineTo(-.9, -2.5);
  hullShape.lineTo(-1.3, -1.8);
  hullShape.lineTo(-1.1, .5);
  hullShape.lineTo(-.5, 2.5);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: .5, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .08, bevelThickness: .1 });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.center();
  add(hullGeo, hullDarkMat, hullGroup);

  const deckShape = new THREE.Shape();
  deckShape.moveTo(0, 2.3);
  deckShape.lineTo(.7, .6);
  deckShape.lineTo(.95, -1.6);
  deckShape.lineTo(-.95, -1.6);
  deckShape.lineTo(-.7, .6);
  deckShape.closePath();
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: .25, bevelEnabled: true, bevelSegments: 2, bevelSize: .04, bevelThickness: .05 });
  deckGeo.rotateX(Math.PI / 2);
  deckGeo.center();
  add(deckGeo, armorNavyMat, hullGroup, [0, .3, -.2]);

  const bowGroup = new THREE.Group();
  bowGroup.name = 'BowProngs';
  [-.42, .42].forEach(x => {
    add(new THREE.BoxGeometry(.35, .45, 1.4), armorNavyMat, bowGroup, [x, .05, 2.4]);
    add(new THREE.CylinderGeometry(.12, .12, .1, 16), engineIronMat, bowGroup, [x, .05, 3.1]).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(.08, .08, .12, 16), glowCyanMat, bowGroup, [x, .05, 3.11]).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(.36, .04, .8), accentRedMat, bowGroup, [x, .28, 2.4]);
  });
  hullGroup.add(bowGroup);

  const flightDeck = new THREE.Group();
  flightDeck.name = 'FlightDeck';
  add(new THREE.BoxGeometry(.8, .05, 2.2), engineIronMat, flightDeck, [0, .44, .4]);
  [-.42, .42].forEach(x => add(new THREE.BoxGeometry(.06, .06, 2.2), accentRedMat, flightDeck, [x, .45, .4]));
  [-.18, .18].forEach(x => [ .8, .2, -.4 ].forEach(z => {
    add(new THREE.BoxGeometry(.22, .04, .35), armorNavyMat, flightDeck, [x, .47, z]);
    add(new THREE.BoxGeometry(.24, .02, .37), accentYellowMat, flightDeck, [x, .46, z]);
  }));
  hullGroup.add(flightDeck);

  const sideArmor = new THREE.Group();
  sideArmor.name = 'SideArmor';
  [-1, 1].forEach(side => {
    const wing = add(new THREE.BoxGeometry(.3, .4, 2.6), armorNavyMat, sideArmor, [side * 1.15, .1, -.3]);
    wing.rotation.z = side * -.15;
    add(new THREE.BoxGeometry(.04, .42, 1.2), accentRedMat, sideArmor, [side * 1.31, .1, .2]);
    add(new THREE.BoxGeometry(.04, .15, .6), accentYellowMat, sideArmor, [side * 1.31, .2, -.7]);
    [-.8, -.2, .4].forEach(z => {
      const pod = add(new THREE.CylinderGeometry(.08, .08, .25, 12), engineIronMat, sideArmor, [side * 1.32, -.05, z]);
      pod.rotation.z = Math.PI / 2;
    });
  });
  hullGroup.add(sideArmor);

  const bridge = new THREE.Group();
  bridge.name = 'CommandBridge';
  add(new THREE.BoxGeometry(1.4, .35, 1.2), armorNavyMat, bridge, [0, .6, -1.4]);
  add(new THREE.BoxGeometry(1, .3, .8), hullDarkMat, bridge, [0, .9, -1.5]);
  add(new THREE.BoxGeometry(.6, .25, .5), armorNavyMat, bridge, [0, 1.15, -1.55]);
  add(new THREE.BoxGeometry(.52, .08, .05), glowCyanMat, bridge, [0, 1.17, -1.29]);
  [-.2, .2].forEach(x => add(new THREE.CylinderGeometry(.015, .02, .6, 8), engineIronMat, bridge, [x, 1.5, -1.6]));
  const radar = new THREE.Group();
  radar.add(add(new THREE.CylinderGeometry(.08, .1, .1, 12), engineIronMat, radar));
  add(new THREE.BoxGeometry(.3, .06, .08), accentYellowMat, radar, [0, .08, 0]);
  radar.position.set(0, 1.35, -1.5);
  bridge.add(radar);
  radarList.push(radar);
  hullGroup.add(bridge);

  [[-.45, .45, 1.2], [.45, .45, 1.2], [-.5, .78, -1], [.5, .78, -1]].forEach((pos, index) => {
    const turret = new THREE.Group();
    turret.name = `Turret_${index}`;
    turret.add(add(new THREE.CylinderGeometry(.12, .15, .08, 16), hullDarkMat, turret));
    add(new THREE.BoxGeometry(.16, .1, .2), armorNavyMat, turret, [0, .08, 0]);
    [-.04, .04].forEach(x => {
      const barrel = add(new THREE.CylinderGeometry(.02, .02, .25, 8), engineIronMat, turret, [x, .08, .18]);
      barrel.rotation.x = Math.PI / 2;
    });
    turret.position.set(...pos);
    hullGroup.add(turret);
    turretList.push(turret);
  });

  const engineBlock = new THREE.Group();
  engineBlock.name = 'EngineBlock';
  [-.5, 0, .5].forEach((x, index) => {
    const radius = index === 1 ? .26 : .22;
    const nozzle = add(new THREE.CylinderGeometry(radius * .8, radius, .4, 24), engineIronMat, engineBlock, [x, .05, -2.6]);
    nozzle.rotation.x = Math.PI / 2;
    const glow = add(new THREE.CylinderGeometry(radius * .7, radius * .7, .38, 24), glowOrangeMat, engineBlock, [x, .05, -2.59]);
    glow.rotation.x = Math.PI / 2;
  });
  [-.9, .9].forEach(x => {
    const nozzle = add(new THREE.CylinderGeometry(.12, .16, .3, 16), engineIronMat, engineBlock, [x, -.05, -2.45]);
    nozzle.rotation.x = Math.PI / 2;
    const glow = add(new THREE.CylinderGeometry(.1, .1, .29, 16), glowCyanMat, engineBlock, [x, -.05, -2.44]);
    glow.rotation.x = Math.PI / 2;
  });
  hullGroup.add(engineBlock);
  applyShadows(hullGroup);
  root.add(hullGroup);
  const clock = new THREE.Clock();
  root.userData.tick = delta => {
    const time = clock.getElapsedTime();
    turretList.forEach((turret, index) => { turret.rotation.y = Math.sin(time * .8 + index) * .35; });
    radarList.forEach(item => { item.rotation.y += delta * 1.5; });
    glowOrangeMat.emissiveIntensity = 2.5 + Math.sin(time * 4) * .8;
    glowCyanMat.emissiveIntensity = 2 + Math.cos(time * 3) * .5;
  };
  return root;
}
