(() => {
  const T = THREE;
  const data = EXHIBITION;
  const wood = '#845c43';
  const cream = '#f9edce';
  const loader = new T.GLTFLoader();
  const modelStatus = {};

  function object(parent, geometry, color, x, y, z) {
    const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({color, roughness: .8}));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function box(parent, w, h, d, color, x, y, z) {
    return object(parent, new T.BoxGeometry(w, h, d), color, x, y, z);
  }

  function disk(parent, r, bottom, h, color, x, y, z) {
    return object(parent, new T.CylinderGeometry(r, bottom, h, 32), color, x, y, z);
  }

  function sign(parent, text, width, color, x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fffbea';
    ctx.font = 'bold 63px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 384, 80, 720);
    const mesh = new T.Mesh(new T.PlaneGeometry(width, width * 160 / 768),
      new T.MeshBasicMaterial({map: new T.CanvasTexture(canvas), side: T.DoubleSide}));
    mesh.position.set(x, y, z);
    parent.add(mesh);
  }

  function kiosk(parent, title, color, w, h) {
    for (const x of [-w * .43, w * .43]) for (const z of [-.48, .48]) {
      box(parent, .10, h, .10, wood, x, h / 2, z);
    }
    box(parent, w, .72, .95, color, 0, .36, 0);
    box(parent, w + .13, .10, 1.02, cream, 0, .76, 0);
    for (let i = 0; i < 9; i++) {
      const stripe = box(parent, w / 9 + .025, .09, 1.35, i % 2 ? cream : color, (i - 4) * w / 9, h, .11);
      stripe.rotation.x = -.16;
    }
    sign(parent, title, w * .94, color, 0, h - .24, .83);
  }

  const flagTextures = new Map();

  function flagTexture(path) {
    if (!flagTextures.has(path)) {
      const pixels = ExhibitionFlagPixels[path];
      const ready = pixels ? Promise.resolve(decodeFlag(pixels)) : new Promise(resolve => {
        new T.TextureLoader().load(path, resolve, undefined, () => {
          console.warn('Flag image could not be loaded:', path);
          resolve(null);
        });
      });
      flagTextures.set(path, ready);
    }
    return flagTextures.get(path);
  }

  function decodeFlag([width, height, encodedPalette, encodedRuns]) {
    const palette = atob(encodedPalette);
    const runs = atob(encodedRuns);
    const rgba = new Uint8Array(width * height * 4);
    let offset = 0;
    for (let i = 0; i < runs.length; i += 2) {
      const color = runs.charCodeAt(i + 1) * 3;
      const count = runs.charCodeAt(i);
      for (let j = 0; j < count; j++) {
        rgba[offset++] = palette.charCodeAt(color);
        rgba[offset++] = palette.charCodeAt(color + 1);
        rgba[offset++] = palette.charCodeAt(color + 2);
        rgba[offset++] = 255;
      }
    }
    const texture = new T.DataTexture(rgba, width, height, T.RGBAFormat);
    texture.flipY = true;
    texture.minFilter = T.LinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function flag(parent, path, x, z = .05, height = 2.3, width = .58) {
    box(parent, .045, height, .045, wood, x, height / 2, z);
    flagTexture(path).then(texture => {
      if (!texture) return;
      // Match the r147 exhibit's linear output while keeping source RGB values.
      texture.encoding = T.LinearEncoding;
      const flagHeight = width * texture.image.height / texture.image.width;
      const material = new T.MeshBasicMaterial({
        map: texture, color: 0xffffff, side: T.DoubleSide, toneMapped: false, fog: false
      });
      const mesh = new T.Mesh(new T.PlaneGeometry(width, flagHeight), material);
      mesh.name = 'Country flag ' + path;
      mesh.position.set(x + width / 2 + .022, height - .055 - flagHeight / 2, z);
      parent.add(mesh);
    });
  }

  function lantern(parent, x, y, z, color) {
    box(parent, .017, .14, .017, wood, x, y + .13, z);
    const lamp = ingredient(parent, color, x, y, z, .098, .112, .091);
    lamp.material.emissive.set(color);
    lamp.material.emissiveIntensity = .30;
    for (const offset of [-.093, .093]) disk(parent, .053, .053, .028, '#d39653', x, y + offset, z);
  }

  function bamboo(parent, x, z) {
    for (let stalk = 0; stalk < 3; stalk++) {
      const px = x + (stalk - 1) * .105, pz = z + (stalk % 2) * .10;
      const h = 1.14 + stalk * .19;
      disk(parent, .029, .039, h, '#759950', px, h / 2, pz);
      for (let j = 1; j < 5; j++) disk(parent, .041, .04, .017, '#567445', px, h * j / 5, pz);
      for (let j = 0; j < 4; j++) {
        const leaf = ingredient(parent, j % 2 ? '#6b983f' : '#4d783b', px + (j % 2 ? -.11 : .10),
          h * (.57 + j * .095), pz + .04, .14, .019, .047, j * 1.2);
        leaf.rotation.z = j % 2 ? -.35 : .35;
      }
    }
  }

  function pitchedRoof(parent, width, depth, eave, rise, color, edge) {
    const slope = Math.hypot(depth / 2, rise);
    for (const side of [-1, 1]) {
      const panel = box(parent, width, .09, slope, color, 0, eave + rise / 2, side * depth / 4);
      panel.rotation.x = side * Math.atan2(rise, depth / 2);
      box(parent, width + .035, .075, .055, edge, 0, eave, side * depth / 2);
    }
    box(parent, width + .09, .07, .10, edge, 0, eave + rise + .012, 0);
  }

  function canopy(parent, width, height, color, contrasting) {
    for (let i = 0; i < 9; i++) {
      const stripe = box(parent, width / 9 + .007, .083, 1.33, i % 2 ? contrasting : color,
        (i - 4) * width / 9, height, .10);
      stripe.rotation.x = .16;
    }
  }

  function pattern(parent, kind, width) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = kind === 'batik' ? '#453650' : '#72523c';
    context.fillRect(0, 0, 384, 64);
    for (let x = 24; x < 384; x += 48) {
      context.fillStyle = '#e7b872';
      context.beginPath();
      context.moveTo(x, 7);
      context.lineTo(x + 17, 32);
      context.lineTo(x, 57);
      context.lineTo(x - 17, 32);
      context.closePath();
      context.fill();
      context.fillStyle = kind === 'batik' ? '#b76c57' : '#517663';
      context.beginPath();
      context.arc(x, 32, 7, 0, Math.PI * 2);
      context.fill();
      if (kind === 'batik') {
        context.fillStyle = '#f5dfae';
        for (const offset of [-18, -9, 9, 18]) {
          context.beginPath();
          context.arc(x + offset, 47, 2, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    const band = new T.Mesh(new T.PlaneGeometry(width, .19),
      new T.MeshBasicMaterial({map: new T.CanvasTexture(canvas)}));
    band.position.set(0, .50, .494);
    parent.add(band);
  }

  function pavilion(parent, country, id) {
    const w = id === 'tw' ? 2.31 : 2.12;
    const eave = 1.73;
    const raised = id === 'ph' || id === 'my';
    const post = id === 'ph' || id === 'vn' ? '#b99453' : wood;
    box(parent, w, .13, 1.22, raised ? '#ab8059' : country.color, 0, .13, 0);
    box(parent, w * .90, .53, .95, country.color, 0, .41, 0);
    box(parent, w + .06, .09, 1.02, cream, 0, .72, 0);
    for (const x of [-w * .43, w * .43]) for (const z of [-.48, .48]) {
      box(parent, .096, eave, .10, post, x, eave / 2, z);
    }
    if (raised) {
      for (let i = 0; i < 7; i++) box(parent, .145, .39, .068, i % 2 ? '#b28154' : '#c09667',
        (i - 3) * .22, .43, .49);
      box(parent, .68, .075, .23, '#9b724e', 0, .045, .72);
    }
    if (id === 'ph' || id === 'my' || id === 'th') {
      const roof = id === 'ph' ? ['#ac8050', '#e4bd79', .64] :
        id === 'my' ? ['#9a5946', '#e2ad6f', .49] : ['#a34947', '#efbd70', .43];
      pitchedRoof(parent, w + .30, 1.45, eave, roof[2], roof[0], roof[1]);
      if (id === 'ph') for (let i = -4; i <= 4; i++) {
        const slat = box(parent, .033, .023, .94, '#c39e62', i * .259, eave + roof[2] / 2 + .062, .36);
        slat.rotation.x = Math.atan2(roof[2], .725);
      }
      if (id === 'th') {
        pitchedRoof(parent, w - .33, 1.02, eave + .28, .45, '#894744', '#dfaa62');
        for (const side of [-1, 1]) {
          const finial = box(parent, .052, .27, .06, '#efba65', side * (w - .33) / 2, eave + .79, 0);
          finial.rotation.z = -side * .27;
        }
      }
    } else {
      canopy(parent, w + .14, eave, country.color, id === 'tw' ? '#eacb91' : cream);
    }
    if (id === 'my') pattern(parent, 'wood', w * .87);
    if (id === 'id') pattern(parent, 'batik', w * .87);
    if (['vn', 'th', 'tw'].includes(id)) for (const x of [-w * .40, w * .40]) {
      lantern(parent, x, eave - .27, .67, id === 'th' ? '#f3ae53' : '#cf5b42');
    }
    sign(parent, country.name, w * .85, country.color, 0, eave - .17, .86);
  }

  function bench(parent, x, y, z, angle = 0) {
    const seat = new T.Group();
    seat.position.set(x, y, z);
    seat.rotation.y = angle;
    parent.add(seat);
    for (const dx of [-.36, .36]) box(seat, .09, .27, .27, wood, dx, .14, 0);
    box(seat, .94, .08, .32, '#ba8759', 0, .29, 0);
    box(seat, .94, .15, .063, '#ba8759', 0, .47, -.125);
  }

  function path(parent, y, x, z, w, length, rotation = 0) {
    const trail = box(parent, w, .027, length, '#d9be91', x, y, z);
    trail.rotation.y = rotation;
  }

  function welcomeFlag(parent, ground, signZ) {
    const x = 2.08, top = ground + 4.52, z = signZ + .02;
    const extension = top - (ground + 2.78);
    box(parent, .105, extension, .105, wood, x, top - extension / 2, z);
    ingredient(parent, '#d4aa69', x, top + .035, z, .085, .066, .085);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#315b4d';
    ctx.fillRect(0, 0, 512, 384);
    ctx.strokeStyle = '#dab784';
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, 488, 360);
    const texture = new T.CanvasTexture(canvas);
    const geometry = new T.PlaneGeometry(1.77, 1.33, 16, 3);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const u = positions.getX(i) / 1.77 + .5;
      positions.setY(i, positions.getY(i) - .11 * u * u);
      positions.setZ(i, .11 * u * Math.sin(u * Math.PI * 2));
    }
    const cloth = new T.Mesh(geometry, new T.MeshBasicMaterial({
      map: texture, side: T.DoubleSide, toneMapped: false
    }));
    cloth.name = 'More Than a Meal logo flag';
    cloth.position.set(x + .933, top - .72, z);
    parent.add(cloth);

    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 80, 16, 352, 352);
      texture.needsUpdate = true;
    };
    image.src = window.ExhibitionWelcomeLogo;
  }

  function welcomeGarden(def, api) {
    const parent = def.group;
    const ground = api.surf(0, 0);
    const signZ = -def.r * .81;
    for (const x of [-2.08, 2.08]) box(parent, .145, 2.8, .15, wood, x, ground + 1.4, signZ);
    box(parent, 4.89, .92, .20, '#754c37', 0, ground + 2.66, signZ);
    sign(parent, 'MORE THAN A MEAL', 4.67, '#315b4d', 0, ground + 2.66, signZ + .106);
    welcomeFlag(parent, ground, signZ);
    const dinner = new T.Group();
    dinner.position.set(0, ground + .085, .12);
    parent.add(dinner);
    const table = disk(dinner, .93, .91, .115, '#aa734e', 0, .58, 0);
    table.scale.z = .77;
    disk(dinner, .16, .29, .57, wood, 0, .29, 0);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const x = Math.cos(angle), z = Math.sin(angle);
      disk(dinner, .124, .103, .035, cream, x * .60, .652, z * .46);
      disk(dinner, .167, .14, .08, '#ad805a', x * 1.05, .32, z * .89);
      disk(dinner, .057, .095, .28, wood, x * 1.05, .15, z * .89);
    }
    disk(dinner, .102, .074, .17, '#71988b', 0, .73, 0);
    for (let i = 0; i < 4; i++) {
      ingredient(dinner, i % 2 ? '#cb6658' : '#efa95a', (i - 1.5) * .058, .88 + i % 2 * .06,
        (i % 2) * .085 - .038, .047, .051, .042);
    }
    Object.values(data.countries).forEach((country, i) => {
      const front = i >= 3;
      const x = (i % 3 - 1) * (front ? 1.27 : 1.35) - .25;
      flag(dinner, country.flag, x, front ? 1.17 : -.99, front ? .86 : 1.27, .44);
    });
    for (const side of [-1, 1]) {
      const x = side * def.r * .63, z = def.r * .52;
      bench(parent, x, api.surf(x, z), z, side * -.48);
    }
  }

  function sinigang(parent) {
    const bowlHeight = .24;
    const radius = .39;
    const bowl = new T.Group();
    parent.add(bowl);
    const rim = object(bowl, new T.TorusGeometry(radius, .028, 9, 36), '#fcf2d8', 0, bowlHeight, 0);
    rim.rotation.x = Math.PI / 2;
    disk(bowl, radius, .22, bowlHeight, '#e6e2ca', 0, bowlHeight / 2, 0);
    disk(bowl, .36, .34, .03, '#b88642', 0, bowlHeight + .002, 0);
    for (let i = 0; i < 10; i++) {
      const angle = i * 2.399;
      const r = (i % 3 + 1) * .09;
      const color = ['#436c3c','#a1b358','#d66d45','#e5cb9c'][i % 4];
      const topping = object(bowl, new T.SphereGeometry(.07, 8, 5), color,
        Math.cos(angle) * r, bowlHeight + .04, Math.sin(angle) * r);
      topping.rotation.y = angle;
      topping.scale.set(1.34, .58, .64);
    }
    for (let i = 0; i < 3; i++) {
      const okra = disk(bowl, .027, .047, .24, '#567a3a', -.21 + i * .14, .31, .04 - i * .08);
      okra.rotation.set(.95, 0, .94 - i * .31);
    }
    return bowl;
  }

  function ingredient(parent, color, x, y, z, sx, sy, sz, angle = 0) {
    const mesh = object(parent, new T.SphereGeometry(1, 10, 6), color, x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.y = angle;
    return mesh;
  }

  function vessel(parent, color, broth) {
    const bowl = new T.Group();
    parent.add(bowl);
    const height = broth ? .21 : .055;
    disk(bowl, .40, broth ? .23 : .35, height, color, 0, height / 2, 0);
    const rim = object(bowl, new T.TorusGeometry(.385, .021, 7, 28), color, 0, height, 0);
    rim.rotation.x = Math.PI / 2;
    if (broth) disk(bowl, .367, .35, .024, broth, 0, .207, 0);
    return bowl;
  }

  function noodles(parent, thick, y) {
    for (let i = 0; i < 7; i++) {
      const points = [];
      for (let j = 0; j < 9; j++) {
        const x = -.22 + j * .055;
        points.push(new T.Vector3(x, y + Math.sin(j * .8 + i) * .016,
          -.18 + i * .058 + Math.sin(j * .9 + i * 1.4) * .034));
      }
      const curve = new T.CatmullRomCurve3(points);
      object(parent, new T.TubeGeometry(curve, 16, thick, 5, false),
        thick > .023 ? '#fff2d6' : '#f4d598', 0, 0, 0);
    }
  }

  function egg(parent, x, y, z, boiled) {
    ingredient(parent, '#fff6df', x, y, z, .113, boiled ? .052 : .036, .086, .5);
    ingredient(parent, '#efa824', x + .013, y + (boiled ? .046 : .031), z, .058, .022, .052);
  }

  function rice(parent, fried) {
    const plate = vessel(parent, fried ? '#e8b275' : '#80a989');
    if (!fried) ingredient(plate, '#477349', 0, .061, 0, .35, .016, .29, .35);
    const color = fried ? '#af6a36' : '#f6e9cf';
    ingredient(plate, color, -.043, .105, -.047, .193, .132, .173);
    for (let i = 0; i < 19; i++) {
      const angle = i * 2.399;
      const r = .032 + (i % 6) * .023;
      const y = .105 + .13 * Math.sqrt(1 - (r / .193) ** 2);
      ingredient(plate, fried ? ['#d99856', '#e17c45', '#7b9f4b'][i % 3] : '#fff4df',
        Math.cos(angle) * r - .043, y, Math.sin(angle) * r - .047, .028, .014, .011, angle);
    }
    egg(plate, .20, .11, -.11, !fried);
    for (let i = 0; i < 4; i++) {
      const x = -.25 + i * .055;
      if (fried) ingredient(plate, i % 2 ? '#dd8342' : '#789545', x, .082, .17, .04, .024, .027);
      else {
        disk(plate, .047, .047, .018, '#50794b', x, .083 + i * .009, .16);
        disk(plate, .038, .038, .004, '#c4d99a', x, .095 + i * .009, .16);
      }
    }
    if (!fried) {
      ingredient(plate, '#a83327', .196, .105, .16, .10, .049, .072, .3);
      for (let i = 0; i < 5; i++) ingredient(plate, i < 3 ? '#bf915c' : '#9d8364',
        .009 + i * .035, .085, .249, .024, .019, i < 3 ? .017 : .039, .45);
    }
    return plate;
  }

  function noodleBowl(parent, beef) {
    const bowl = vessel(parent, beef ? '#8ca5bf' : '#e9c8ad', beef ? '#843e27' : '#ca9454');
    noodles(bowl, beef ? .015 : .028, .23);
    for (let i = 0; i < 4; i++) {
      if (beef) {
        const piece = box(bowl, .107, .054, .064, '#773d2e', -.205 + i * .107, .254, -.17 + (i % 2) * .04);
        piece.rotation.y = i * .57;
      } else ingredient(bowl, '#e9ad80', -.20 + i * .117, .25, -.16, .055, .027, .047, i * .4);
      ingredient(bowl, '#588847', .135 + i * .032, .258, .106 + (i % 2) * .039, .076, .018, .026, i * .48);
    }
    return bowl;
  }

  function tomYum(parent) {
    const bowl = vessel(parent, '#e1bd94', '#cd5527');
    for (let i = 0; i < 4; i++) {
      const x = -.19 + i * .116, z = -.143 + (i % 2) * .1;
      disk(bowl, .024, .03, .066, '#f3d6aa', x, .24, z);
      ingredient(bowl, '#a77553', x, .279, z, .067, .031, .052);
      const leaf = ingredient(bowl, '#5d7b38', x + .02, .239, .122, .08, .013, .029, i * .9);
      leaf.rotation.z = .12;
    }
    for (let i = 0; i < 3; i++) {
      const shrimp = object(bowl, new T.TorusGeometry(.061, .023, 6, 12, Math.PI * 1.42),
        '#f59569', -.19 + i * .174, .24, .027 + (i % 2) * .095);
      shrimp.rotation.set(Math.PI / 2, 0, i * 1.4);
    }
    return bowl;
  }

  function dumplings(parent) {
    const plate = vessel(parent, '#719b91');
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const parcel = new T.Group();
      plate.add(parcel);
      parcel.position.set(Math.cos(angle) * .207, .07, Math.sin(angle) * .207);
      parcel.rotation.y = -angle + Math.PI / 2;
      ingredient(parcel, '#f6dda9', 0, .047, 0, .105, .062, .049);
      for (let fold = -2; fold <= 2; fold++) {
        ingredient(parcel, '#ffebc3', fold * .031, .102 - .006 * fold ** 2,
          -.013, .026, .022, .015, -.55);
      }
    }
    disk(plate, .068, .052, .035, '#dbb179', 0, .079, 0);
    disk(plate, .053, .05, .012, '#733b2f', 0, .099, 0);
    return plate;
  }

  const foodSculpts = {
    sinigang,
    'banh-canh': parent => noodleBowl(parent, false),
    'nasi-lemak': parent => rice(parent, false),
    'nasi-goreng': parent => rice(parent, true),
    'tom-yum': tomYum,
    'beef-noodles': parent => noodleBowl(parent, true),
    dumplings
  };

  function foodDisplay(parent, dish, x, api) {
    const display = new T.Group();
    display.position.set(x, 0, 1.62);
    parent.add(display);
    box(display, 1.08, .12, .98, cream, 0, .82, 0);
    box(display, .83, .76, .72, wood, 0, .38, 0);
    disk(display, .46, .46, .055, '#8da5a0', 0, .91, 0);
    sign(display, dish.name, 1, '#395a50', 0, .58, .38);
    const mount = new T.Group();
    mount.position.y = .94;
    display.add(mount);
    const placeholder = foodSculpts[dish.id](mount);
    api.pick(display, dish.id);
    modelStatus[dish.id] = 'Stylized 3D placeholder';
    if (!dish.model) return;
    loader.load(dish.model, ({scene}) => {
      const bounds = new T.Box3().setFromObject(scene);
      const size = bounds.getSize(new T.Vector3());
      const largest = Math.max(size.x, size.y * 1.35, size.z);
      if (!Number.isFinite(largest) || largest <= 0) return;
      const center = bounds.getCenter(new T.Vector3());
      const model = new T.Group();
      scene.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
      model.add(scene);
      model.scale.setScalar(.83 / largest);
      mount.add(model);
      placeholder.visible = false;
      api.unpick(placeholder);
      api.pick(model, dish.id);
      modelStatus[dish.id] = 'Imported 3D model';
    }, undefined, () => {});
  }

  function activityBoard(base, station, reflection) {
    const width = reflection ? 2.0 : 1.81;
    for (const x of [-width * .4, width * .4]) {
      box(base, .093, 1.6, .11, wood, x, .8, 0);
    }
    box(base, width, .83, .14, station.color, 0, 1.33, 0);
    sign(base, station.title, width * .96, station.color, 0, 1.51, .077);
    if (reflection) {
      for (const [x, color, angle] of [[-.43, '#edbe7b', .16], [0, '#fce3b3', -.12], [.43, '#d5ada9', .11]]) {
        const note = box(base, .24, .21, .026, color, x, 1.19, .078);
        note.rotation.z = angle;
      }
    } else {
      for (const x of [-.44, 0, .44]) {
        box(base, .23, .075, .03, '#e6c993', x, 1.19, .08);
      }
    }
    box(base, width + .12, .09, .23, '#b38556', 0, 1.79, .02);
  }

  function decorate(def, api) {
    const {group, r, index} = def;
    const island = data.islands[index];
    const ground = api.surf(0, 0);
    def.pathR = r * (index ? .76 : .74);
    disk(group, r * .72, r * .73, .055, '#e6d4aa', 0, ground + .02, 0);
    disk(group, r * .65, r * .65, .045, index ? '#f4e6c8' : '#efe2bc', 0, ground + .045, 0);
    if (index) {
      for (const side of [-1, 1]) {
        disk(group, r * .32, r * .32, .04, side < 0 ? '#e5caa6' : '#d8dec0',
          side * r * .45, ground + .07, r * .04);
      }
    }
    if (index) {
      path(group, ground + .101, 0, .42, r * 1.23, .55, Math.PI / 2);
      path(group, ground + .087, 0, r * .41, .69, r * .64);
    } else {
      path(group, ground + .071, 0, 0, r * 1.20, .65, Math.PI / 2);
      path(group, ground + .073, 0, 0, .72, r * 1.24);
      welcomeGarden(def, api);
    }
    const spots = index ? [[-.46, -.17], [.46, -.17]] :
      [[0, -.53], [-.44, -.12], [.44, -.12], [-.33, .42], [.37, .42], [0, .59], [-.56, -.45], [.57, -.45]];
    island.exhibits.forEach((id, i) => {
      const [dx, dz] = spots[i];
      const x = dx * r, z = dz * r;
      const base = new T.Group();
      base.position.set(x, api.surf(x, z) + .09, z);
      group.add(base);
      if (index) {
        const country = data.countries[id];
        pavilion(base, country, id);
        api.pick(base, country.dishes[0].id);
        const side = i === 0 ? -1 : 1;
        flag(base, country.flag, side * 1.34 - (i ? .16 : 0), -.29, 2.80, .66);
        if (id === 'ph' || id === 'vn') bamboo(base, side * 1.20, -.83);
        country.dishes.forEach((dish, j) => foodDisplay(base, dish, (j - (country.dishes.length - 1) / 2) * 1.25, api));
      } else {
        const station = data.stations[id];
        if (id === 'quiz' || id === 'reflection') activityBoard(base, station, id === 'reflection');
        else if (id === 'feedback') {
          box(base, 1.76, .59, .72, station.color, 0, .30, 0);
          box(base, 1.85, .08, .80, cream, 0, .62, 0);
          box(base, .55, .22, .30, wood, 0, .77, -.06);
          box(base, .28, .012, .035, '#2a433b', 0, .884, -.06);
          sign(base, station.title, 1.63, station.color, 0, .48, .414);
        } else kiosk(base, station.title, station.color, id === 'vegetarian' ? 2.8 : 2.35, 1.85);
        if (id === 'interviews') box(base, 1.45, .66, .09, '#283e49', 0, 1.27, .33);
        if (id === 'map') for (let pin = 0; pin < 3; pin++) {
          disk(base, .15, .19, .12, data.islands[pin + 1].color, (pin - 1) * .42, .9, .32);
        }
        api.pick(base, id);
      }
    });
    for (let i = 0; i < 11; i++) {
      const angle = i * Math.PI * 2 / 11;
      const x = Math.cos(angle) * r * .85, z = Math.sin(angle) * r * .85;
      const plant = i % 3 === 1 || z > r * .45 ? api.flowers(4) : api.tree('round', .7 + api.rng() * .35);
      plant.position.set(x, api.surf(x, z), z);
      plant.userData.shorePlant = true;
      group.add(plant);
    }
    if (index) bench(group, 0, ground, r * .68, Math.PI);
    for (const x of [-r * .48, r * .48]) {
      const z = r * .60;
      const y = api.surf(x, z);
      box(group, .07, .96, .07, wood, x, y + .48, z);
      lantern(group, x, y + .98, z, '#f2ad53');
      disk(group, .11, .16, .09, wood, x, y + 1.12, z);
      if (!index) {
        const light = new T.PointLight('#ffc878', .28, 2.2, 2);
        light.position.set(x, y + 1.11, z);
        group.add(light);
      }
    }
  }

  function bridges(islands, parent) {
    const main = islands[0];
    for (const island of islands.slice(1)) {
      const dx = island.x - main.x, dz = island.z - main.z;
      const distance = Math.hypot(dx, dz);
      const ux = dx / distance, uz = dz / distance;
      const start = main.r * .88, end = distance - island.r * .88;
      const length = end - start;
      const fromY = main.yAt(ux * start, uz * start);
      const toY = island.yAt(-ux * island.r * .88, -uz * island.r * .88);
      const bridge = new T.Group();
      bridge.name = 'Footbridge to ' + island.name;
      bridge.position.set(main.x + ux * start, fromY, main.z + uz * start);
      bridge.rotation.y = Math.atan2(dx, dz);
      parent.add(bridge);
      const rise = z => (toY - fromY) * z / length + .26 * Math.sin(Math.PI * z / length);
      const width = 1.28;
      const count = Math.ceil(length / .31);
      const step = length / count;
      const planks = new T.InstancedMesh(new T.BoxGeometry(width, .095, step - .018),
        new T.MeshStandardMaterial({color: 0xffffff, roughness: .87}), count);
      const dummy = new T.Object3D();
      const colors = ['#a86f48', '#bb8356', '#c68e60', '#b57b50'].map(color => new T.Color(color));
      for (let i = 0; i < count; i++) {
        const z = (i + .5) * step;
        dummy.position.set(0, rise(z) - .015, z);
        dummy.rotation.x = -Math.atan2(rise(z + step / 2) - rise(z - step / 2), step);
        dummy.updateMatrix();
        planks.setMatrixAt(i, dummy.matrix);
        planks.setColorAt(i, colors[i % colors.length]);
      }
      planks.castShadow = true;
      planks.receiveShadow = true;
      bridge.add(planks);

      // Extend the wood to walkable ground. Start rails outside the busy shore paths.
      const railStart = main.r * .16;
      const railEnd = length - island.r * .16;
      const bays = Math.ceil((railEnd - railStart) / 1.40);
      for (const side of [-1, 1]) {
        const x = side * .60;
        let previous;
        for (let i = 0; i <= bays; i++) {
          const z = railStart + (railEnd - railStart) * i / bays;
          const y = rise(z);
          box(bridge, .083, .55, .083, wood, x, y + .28, z);
          if (i > 0 && i < bays && i % 3 === 0) {
            const height = fromY + y + .28;
            box(bridge, .14, height, .14, '#775138', x, (y + .28 - fromY) / 2, z);
          }
          if ((i === 0 || i === bays) && side === (i === 0 ? -1 : 1)) {
            lantern(bridge, x, y + .54, z, '#edac5f');
          }
          if (previous) {
            const dz = z - previous.z, dy = y - previous.y;
            for (const level of [.29, .50]) {
              const rail = box(bridge, .065, .065, Math.hypot(dz, dy) + .035,
                '#925f40', x, (y + previous.y) / 2 + level, (z + previous.z) / 2);
              rail.rotation.x = -Math.atan2(dy, dz);
            }
          }
          previous = {y, z};
        }
      }

      for (const [def, sign] of [[main, 1], [island, -1]]) {
        for (const plant of def.group.children.filter(child => child.userData.shorePlant)) {
          const {x, z} = plant.position;
          if ((x * ux + z * uz) * sign < def.r * .7 || Math.abs(x * uz - z * ux) > .83) continue;
          const angle = Math.atan2(z, x) + .34;
          plant.position.x = Math.cos(angle) * def.r * .85;
          plant.position.z = Math.sin(angle) * def.r * .85;
        }
      }
    }
  }

  window.ExhibitionScenery = {decorate, bridges, modelStatus};
})();
