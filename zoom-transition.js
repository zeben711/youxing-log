// All timings are normalized to the lifetime of the transition.
export const zoomProfiles = {
  approach: { duration: 2030, travelEnd: .91, trailSpan: -1.42 },
  push: {
    duration: 1320, pushEnd: .78, startRate: .30, pushDistance: 2.42,
    power: 3.45, trailSpan: 3.25, arrivalStart: .82,
    revealAt: .55, revealLength: .24,
  },
  pull: {
    duration: 1230, pushEnd: .58, startRate: .54, pushDistance: .99,
    power: 2.8, trailSpan: -1.52, arrivalStart: .63,
    revealAt: .51, revealLength: .33, pullAt: .59, pullLength: .19, pullDistance: .55,
  },
};

const smooth = value => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};

export function sampleZoom(t, profile) {
  if (profile.travelEnd) {
    const travel = Math.min(1, t / profile.travelEnd);
    const settle = smooth((travel - .28) / .72);
    const opening = smooth((t - .36) / .64);
    return {
      zoom: 1.015 + .38 * travel + 1.08 * settle,
      blur: smooth((travel - .30) / .24) * (1 - smooth((travel - .54) / .39)),
      stretch: .50 * smooth((travel - .15) / .36) * (1 - settle),
      roll: .38 * smooth((travel - .09) / .57),
      iris: smooth((travel - .19) / .68),
      incoming: smooth((travel - .41) / .52),
      arrivalScale: .73 + .27 * settle,
      fieldScale: 1 + .06 * (1 - settle),
      fieldOpacity: smooth((travel - .20) / .66),
      orbitOpacity: smooth((travel - .37) / .36),
      orbitOpening: opening,
      innerTrace: smooth((travel - .36) / .51) * 100,
      middleTrace: smooth((travel - .44) / .49) * 100,
      outerTrace: smooth((travel - .50) / .47) * 100,
      planetOpacity: smooth((travel - .42) / .53),
      sunOpacity: smooth((travel - .29) / .51),
    };
  }
  const push = Math.min(1, t / profile.pushEnd);
  const pull = profile.pullDistance ? smooth((t - profile.pullAt) / profile.pullLength) : 0;
  const stretch = profile.pullDistance ? smooth((t - .20) / .37) * (1 - .72 * pull) : 0;
  const zoom = 1.015 + profile.startRate * push + profile.pushDistance * push ** profile.power
    - (profile.pullDistance ?? 0) * pull;
  const blur = profile.pullDistance
    ? smooth((t - .35) / .24) * (1 - smooth((t - .70) / .24))
    : smooth((push - .20) / .76);
  const incoming = smooth((t - profile.revealAt) / profile.revealLength);
  const settle = smooth((t - .44) / .56);
  return {
    zoom, blur, stretch, incoming,
    arrivalScale: profile.arrivalStart + (1 - profile.arrivalStart) * settle,
    fieldOpacity: smooth((t - .20) / .31),
    fieldScale: 1 + .06 * (1 - settle),
  };
}

export function createZoomPass(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: true, preserveDrawingBuffer: true,
  });
  if (!gl) return null;
  const shader = (type, source) => {
    const code = gl.createShader(type);
    gl.shaderSource(code, source);
    gl.compileShader(code);
    return gl.getShaderParameter(code, gl.COMPILE_STATUS) ? code : null;
  };
  const vertex = shader(gl.VERTEX_SHADER, `
    attribute vec2 point;
    varying vec2 uv;
    void main() {
      uv = vec2(point.x + 1.0, 1.0 - point.y) * .5;
      gl_Position = vec4(point, 0.0, 1.0);
    }
  `);
  const fragment = shader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D scene;
    uniform vec2 fit;
    uniform float zoom;
    uniform float strength;
    uniform float frameHeightRatio;
    uniform float stretch;
    uniform float trailSpan;
    uniform float iris;
    uniform float roll;
    uniform float sourceAspect;
    void main() {
      vec2 sourceCenter = vec2(.5, .48);
      vec2 offset = uv - vec2(.5, .48 + .02 * iris);
      vec2 ray = offset * fit / zoom;
      float edge = smoothstep(.10, .66, length(offset));
      // Deform the image along the tilted lens axes before applying the shutter blur.
      vec2 axes = mat2(.958,.287,-.287,.958) * ray;
      axes /= vec2(1.0 + .44 * stretch, 1.0 + .07 * stretch);
      ray = mat2(.958,-.287,.287,.958) * axes;
      ray *= 1.0 - .16 * stretch * edge * edge;
      float sine = sin(roll), cosine = cos(roll);
      vec2 rotated = mat2(cosine,sine,-sine,cosine) * (ray * vec2(sourceAspect, 1.0));
      ray = rotated / vec2(sourceAspect, 1.0);
      float smear = strength * edge;
      vec3 sharp = texture2D(scene, sourceCenter + ray).rgb;
      vec3 color = sharp;
      if (smear > .006) {
        const vec3 luma = vec3(.2126, .7152, .0722);
        float localLuma = dot(sharp, luma);
        vec3 sum = vec3(0.0);
        float total = 0.0;
        for (int i = 0; i < 19; i++) {
          float t = float(i) / 18.0;
          // A zoom-out shutter samples larger prior frames without crossing the optical center.
          float scale = trailSpan < 0.0
            ? 1.0 / (1.0 - t * trailSpan * smear)
            : 1.0 + smear * (t * trailSpan - .27);
          vec3 tap = texture2D(scene, sourceCenter + ray * scale).rgb;
          float spread = max(0.0, dot(tap, luma) - localLuma);
          float weight = (1.0 - .36 * t) * (1.0 - .94 * smoothstep(.045, .245, spread));
          sum += tap * weight;
          total += weight;
        }
        color = mix(sharp, sum / total, edge);
      }
      float exposure = 1.0 - .36 * smoothstep(1.19, 2.96, zoom);
      float videoY = sourceCenter.y + offset.y * frameHeightRatio / zoom;
      float matte = clamp((videoY - .10) / .08, 0.0, 1.0)
                  * clamp((1.0 - videoY) / .08, 0.0, 1.0);
      // Reveal the next star field around the old nucleus before letting the center go.
      float alpha = 1.0 - iris * mix(.37, 1.0, smoothstep(.06, .52, length(offset)));
      gl_FragColor = vec4(color * exposure * matte * alpha, alpha);
    }
  `);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  gl.useProgram(program);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const point = gl.getAttribLocation(program, 'point');
  gl.enableVertexAttribArray(point);
  gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const uniforms = Object.fromEntries(['fit','zoom','strength','frameHeightRatio','stretch','trailSpan','iris','roll','sourceAspect']
    .map(name => [name, gl.getUniformLocation(program, name)]));
  const videoFrame = video => video.getVideoPlaybackQuality?.().totalVideoFrames || Math.floor(video.currentTime * 24);
  let textureWidth = 0, textureHeight = 0;
  return (frame, {viewWidth, viewHeight, sourceWidth, sourceHeight, trailSpan}) => {
    const width = frame.videoWidth || frame.naturalWidth || frame.width;
    const height = frame.videoHeight || frame.naturalHeight || frame.height;
    if (!width || !height || gl.isContextLost()) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (textureWidth === width && textureHeight === height) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
      textureWidth = width;
      textureHeight = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    const fit = Math.max(sourceWidth / width, sourceHeight / height);
    gl.uniform2f(uniforms.fit, viewWidth / (width * fit), viewHeight / (height * fit));
    gl.uniform1f(uniforms.frameHeightRatio, viewHeight / sourceHeight);
    gl.uniform1f(uniforms.trailSpan, trailSpan);
    gl.uniform1f(uniforms.sourceAspect, width / height);
    const video = frame instanceof HTMLVideoElement ? frame : null;
    let rendered = video && videoFrame(video);
    return ({zoom, blur, stretch, iris = 0, roll = 0}) => {
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const current = videoFrame(video);
        if (current !== rendered) {
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
          rendered = current;
        }
      }
      gl.uniform1f(uniforms.zoom, zoom);
      gl.uniform1f(uniforms.strength, blur);
      gl.uniform1f(uniforms.stretch, stretch);
      gl.uniform1f(uniforms.iris, iris);
      gl.uniform1f(uniforms.roll, roll);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  };
}

